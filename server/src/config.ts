import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, "../..");
export const CLIENT_DIST = path.join(ROOT_DIR, "client", "dist");

export const PORT = Number(process.env.PORT ?? 8787);
export const MIMO_API_KEY = (process.env.MIMO_API_KEY ?? "").trim();
export const MIMO_BASE_URL = (
  process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1"
).replace(/\/+$/, "");
export const MOCK_MIMO = process.env.MOCK_MIMO === "1";

export type AppMode = "mock" | "live" | "unconfigured";
export const APP_MODE: AppMode = MOCK_MIMO
  ? "mock"
  : MIMO_API_KEY
    ? "live"
    : "unconfigured";

export const MODEL_TTS = "mimo-v2.5-tts";
export const MODEL_ASR = "mimo-v2.5-asr";

export const LIMITS = {
  textMax: 1000,
  styleMax: 80,
  speedMin: 0.5,
  speedMax: 1.5,
  uploadMaxBytes: 25 * 1024 * 1024,
  audioMaxDurationSec: 300,
  base64MaxBytes: 10 * 1024 * 1024,
  pricePerHourCny: 0.5,
} as const;

export const VOICES = [
  { id: "mimo_default", label: "默认中文 · MiMo", language: "zh" },
  { id: "default_zh", label: "Default ZH · 中文", language: "zh" },
  { id: "Mia", label: "Mia · 中文", language: "zh" },
  { id: "Chloe", label: "Chloe · 中文", language: "zh" },
  { id: "Milo", label: "Milo · 中文", language: "zh" },
  { id: "Dean", label: "Dean · 中文", language: "zh" },
  { id: "default_en", label: "Default EN · English", language: "en" },
] as const;

export const VOICE_IDS = VOICES.map((voice) => voice.id) as string[];

export const TTS_TIMEOUT_MS = 60_000;
export const ASR_TIMEOUT_MS = 120_000;

export function estimateCostCny(durationSec: number): number {
  return Math.max(
    0.01,
    Math.round((durationSec / 3600) * LIMITS.pricePerHourCny * 100) / 100,
  );
}
