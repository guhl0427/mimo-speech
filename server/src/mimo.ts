import { randomUUID } from "node:crypto";
import {
  APP_MODE,
  ASR_TIMEOUT_MS,
  MIMO_API_KEY,
  MIMO_BASE_URL,
  MODEL_ASR,
  MODEL_TTS,
  TTS_TIMEOUT_MS,
} from "./config.js";
import { createMockWav, sniffAudioMime } from "./audio.js";
import { AppError } from "./errors.js";

type TtsInput = {
  text: string;
  voiceId: string;
  style: string;
  speed: number;
};

type AsrInput = {
  base64: string;
  durationSec: number;
  language: "zh" | "en" | "auto";
};

export type TtsResult = {
  buffer: Buffer;
  mime: string;
  requestId: string;
  provider: "mimo";
  mock: boolean;
};

export type AsrResult = {
  text: string;
  requestId: string;
  provider: "mimo";
  mock: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-key": MIMO_API_KEY,
  };
  // MiMo documentation shows both api-key and OpenAI-compatible Bearer auth.
  if (MIMO_API_KEY) headers.Authorization = `Bearer ${MIMO_API_KEY}`;
  return headers;
}

function upstreamError(status: number, retryAfterHeader: string | null): AppError {
  const retryAfter = Number(retryAfterHeader);
  if (status === 401 || status === 403) {
    return new AppError(
      "PROVIDER_AUTH_ERROR",
      "MiMo API Key 无效或没有权限，请检查服务端配置。",
      502,
    );
  }
  if (status === 429) {
    return new AppError(
      "PROVIDER_RATE_LIMITED",
      "MiMo 当前限流，请稍后再试。",
      429,
      Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfter } : {},
    );
  }
  if (status >= 500) {
    return new AppError(
      "PROVIDER_UNAVAILABLE",
      "MiMo 服务暂时不可用，请稍后再试。",
      502,
    );
  }
  return new AppError(
    "PROVIDER_ERROR",
    `MiMo 返回了异常状态（${status}），请稍后再试。`,
    502,
  );
}

type ChatResponse = {
  json: unknown;
  requestId: string;
  contentType: string;
};

async function postChat(body: unknown, timeoutMs: number): Promise<ChatResponse> {
  if (APP_MODE === "unconfigured") {
    throw new AppError(
      "MIMO_NOT_CONFIGURED",
      "服务端尚未配置 MIMO_API_KEY。请在 .env 中填入 Key 并重启服务。",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "TimeoutError";
    throw new AppError(
      isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      isTimeout
        ? "MiMo 响应超时，请稍后重试。"
        : "无法连接 MiMo，请检查网络或服务端配置。",
      isTimeout ? 504 : 502,
      { cause: error },
    );
  }

  const headerRequestId = response.headers.get("x-request-id");
  if (!response.ok) {
    throw upstreamError(response.status, response.headers.get("retry-after"));
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回了无法解析的响应，请稍后重试。",
      502,
      { cause: error },
    );
  }

  const jsonRequestId =
    json && typeof json === "object" && "id" in json
      ? (json as { id?: unknown }).id
      : undefined;

  return {
    json,
    requestId:
      (typeof jsonRequestId === "string" && jsonRequestId) ||
      headerRequestId ||
      `mimo-${randomUUID()}`,
    contentType: response.headers.get("content-type") ?? "",
  };
}

function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" ||
    buffer.subarray(0, 4).toString("ascii") === "OggS"
  ) {
    return true;
  }
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") return true;
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf) return true;
  return buffer.length > 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function findAudioBase64(value: unknown, depth = 0): string | null {
  if (depth > 7) return null;

  if (typeof value === "string") {
    const dataUri = value.match(/^data:audio\/[^;]+;base64,([\s\S]+)$/);
    if (dataUri) return dataUri[1].replace(/\s/g, "");

    const cleaned = value.replace(/\s/g, "");
    if (cleaned.length > 200 && /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
      try {
        const decoded = Buffer.from(cleaned, "base64");
        if (looksLikeAudio(decoded)) return cleaned;
      } catch {
        // Not a usable audio payload.
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioBase64(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = ["data", "audio", "message", "choices", "content"];
    for (const key of preferredKeys) {
      if (key in record) {
        const found = findAudioBase64(record[key], depth + 1);
        if (found) return found;
      }
    }
    for (const item of Object.values(record)) {
      const found = findAudioBase64(item, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

export async function synthesizeSpeech(input: TtsInput): Promise<TtsResult> {
  if (APP_MODE === "mock") {
    await delay(650);
    return {
      buffer: createMockWav(),
      mime: "audio/wav",
      requestId: `mock-tts-${randomUUID()}`,
      provider: "mimo",
      mock: true,
    };
  }

  const instructions: string[] = [];
  if (input.style.trim()) instructions.push(input.style.trim());
  if (Math.abs(input.speed - 1) > 0.001) {
    instructions.push(`语速约为原来的 ${input.speed.toFixed(1)} 倍`);
  }

  const body = {
    model: MODEL_TTS,
    messages: [
      { role: "user", content: instructions.join("；") || "自然、清晰" },
      { role: "assistant", content: input.text },
    ],
    audio: { format: "mp3", voice: input.voiceId },
    stream: false,
  };

  const { json, requestId, contentType } = await postChat(body, TTS_TIMEOUT_MS);

  const knownData = (json as {
    choices?: Array<{ message?: { audio?: { data?: unknown } } }>;
  })?.choices?.[0]?.message?.audio?.data;

  const base64 =
    typeof knownData === "string" && knownData.length > 100
      ? knownData.replace(/^data:audio\/[^;]+;base64,/, "").replace(/\s/g, "")
      : findAudioBase64(json);

  if (!base64) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 没有返回可用的音频数据，请稍后再试。",
      502,
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (error) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回的音频数据无法解码。",
      502,
      { cause: error },
    );
  }

  if (!buffer.length || !looksLikeAudio(buffer)) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回的音频格式无法识别。",
      502,
    );
  }

  return {
    buffer,
    mime: sniffAudioMime(buffer) || contentType || "audio/mpeg",
    requestId,
    provider: "mimo",
    mock: false,
  };
}

function extractText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const record = json as {
    text?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  if (typeof record.text === "string") return record.text;

  const content = record.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }

  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }

  return "";
}

export async function transcribeSpeech(input: AsrInput): Promise<AsrResult> {
  if (APP_MODE === "mock") {
    await delay(750);
    return {
      text:
        "这是一段 Mock 模式生成的示例转写。接入真实 MiMo API 后，这里会返回你的音频内容。你可以继续编辑文本、复制，或导出为 TXT。",
      requestId: `mock-asr-${randomUUID()}`,
      provider: "mimo",
      mock: true,
    };
  }

  const body: Record<string, unknown> = {
    model: MODEL_ASR,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: `data:audio/mpeg;base64,${input.base64}`,
            },
          },
        ],
      },
    ],
  };

  if (input.language !== "auto") {
    body.asr_options = { language: input.language };
  }

  const { json, requestId } = await postChat(body, ASR_TIMEOUT_MS);
  const text = extractText(json).trim();

  if (!text) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 没有返回可用的转写文本，请稍后再试。",
      502,
    );
  }

  return { text, requestId, provider: "mimo", mock: false };
}
