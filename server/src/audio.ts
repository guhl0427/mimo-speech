import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { LIMITS } from "./config.js";
import { AppError } from "./errors.js";

const require = createRequire(import.meta.url);
const ffmpeg = require("@ffmpeg-installer/ffmpeg") as { path: string };
const ffprobe = require("@ffprobe-installer/ffprobe") as { path: string };

type CommandResult = { stdout: string; stderr: string };

function run(binary: string, args: string[], timeoutMs = 60_000): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("ffmpeg command timed out"));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `command exited with code ${code}`));
    });
  });
}

async function probeDuration(inputPath: string): Promise<number | null> {
  const { stdout } = await run(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=duration",
    "-of",
    "json",
    inputPath,
  ]);

  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ duration?: string }>;
  };

  const candidates = [
    data.format?.duration,
    ...(data.streams ?? []).map((stream) => stream.duration),
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export function sniffAudioMime(buffer: Buffer): string {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "audio/webm";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return "audio/ogg";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "audio/mp4";
  }
  return "audio/mpeg";
}

export type PreparedAudio = {
  mp3: Buffer;
  base64: string;
  durationSec: number;
};

export async function prepareAudio(
  input: Buffer,
  originalName: string,
  durationHint?: number,
): Promise<PreparedAudio> {
  const workingDir = await mkdtemp(path.join(tmpdir(), "shengxi-audio-"));

  try {
    const extension = path.extname(originalName).toLowerCase() || ".bin";
    const inputPath = path.join(workingDir, `input${extension}`);
    const outputPath = path.join(workingDir, "output.mp3");
    await writeFile(inputPath, input);

    let probedDuration: number | null = null;
    try {
      probedDuration = await probeDuration(inputPath);
    } catch {
      // MediaRecorder WebM often misses duration metadata; fall back to the client hint.
    }

    const durationSec =
      probedDuration ??
      (Number.isFinite(durationHint) && (durationHint ?? 0) > 0 ? durationHint : null);

    if (!durationSec) {
      throw new AppError(
        "AUDIO_DURATION_UNKNOWN",
        "无法读取音频时长，请换一个文件或重新录制。",
        400,
      );
    }

    if (durationSec > LIMITS.audioMaxDurationSec + 1) {
      throw new AppError(
        "AUDIO_TOO_LONG",
        "音频超过单次 5 分钟上限，请截短后再试。",
        400,
      );
    }

    try {
      await run(ffmpeg.path, [
        "-y",
        "-v",
        "error",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        "-f",
        "mp3",
        outputPath,
      ]);
    } catch (error) {
      throw new AppError(
        "TRANSCODE_FAILED",
        "无法处理这个音频格式，请换一个文件试试。",
        400,
        { cause: error },
      );
    }

    const mp3 = await readFile(outputPath);
    const base64 = mp3.toString("base64");

    if (Buffer.byteLength(base64, "utf8") > LIMITS.base64MaxBytes) {
      throw new AppError(
        "AUDIO_TOO_LARGE",
        "音频过大，无法提交给 MiMo。请缩短音频后再试。",
        413,
      );
    }

    return { mp3, base64, durationSec };
  } finally {
    await rm(workingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function createMockWav(seconds = 1.6): Buffer {
  const sampleRate = 16000;
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 8) * Math.min(1, (seconds - t) * 8);
    const value =
      Math.sin(2 * Math.PI * 220 * t) * 0.18 +
      Math.sin(2 * Math.PI * 330 * t) * 0.06;
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, value * envelope)) * 32760),
      44 + i * 2,
    );
  }

  return buffer;
}
