export type Mode = "stt" | "tts";

export type AppMode = "live" | "mock" | "unconfigured";

export type Voice = {
  id: string;
  label: string;
  language: string;
};

export type Limits = {
  textMax: number;
  styleMax: number;
  speedMin: number;
  speedMax: number;
  uploadMaxBytes: number;
  audioMaxDurationSec: number;
  base64MaxBytes: number;
  pricePerHourCny: number;
};

export type AppConfig = {
  mode: AppMode;
  mimoConfigured: boolean;
  mock: boolean;
  voices: Voice[];
  limits: Limits;
  tts: { model: string; free: string };
  stt: { model: string; pricePerHourCny: number };
};

export type HistoryItem = {
  id: string;
  mode: "tts" | "stt";
  text: string;
  provider: string;
  voiceId?: string;
  style?: string;
  speed?: number;
  durationSec?: number;
  estimatedCostCny?: number;
  audioKey?: string;
  sizeBytes?: number;
  mock?: boolean;
  createdAt: number;
};

export type PlayerState = {
  url: string;
  blob: Blob;
  title: string;
  durationSec: number;
  downloadName: string;
  historyId?: string;
  mock?: boolean;
};

export type PendingAudio = {
  file: File;
  durationSec: number;
  source: "record" | "upload";
};

export type TtsApiResult = {
  blob: Blob;
  mime: string;
  provider: string;
  mock: boolean;
  requestId?: string;
};

export type SttApiResult = {
  text: string;
  provider: string;
  durationSec: number;
  estimatedCostCny: number;
  requestId?: string;
  mock: boolean;
};

export type RecordingResult = {
  blob: Blob;
  name: string;
  durationSec: number;
  mime: string;
};

export const DEFAULT_LIMITS: Limits = {
  textMax: 1000,
  styleMax: 80,
  speedMin: 0.5,
  speedMax: 1.5,
  uploadMaxBytes: 25 * 1024 * 1024,
  audioMaxDurationSec: 300,
  base64MaxBytes: 10 * 1024 * 1024,
  pricePerHourCny: 0.5,
};

export const DEFAULT_VOICES: Voice[] = [
  { id: "mimo_default", label: "默认中文 · MiMo", language: "zh" },
  { id: "default_zh", label: "Default ZH · 中文", language: "zh" },
  { id: "Mia", label: "Mia · 中文", language: "zh" },
  { id: "Chloe", label: "Chloe · 中文", language: "zh" },
  { id: "Milo", label: "Milo · 中文", language: "zh" },
  { id: "Dean", label: "Dean · 中文", language: "zh" },
  { id: "default_en", label: "Default EN · English", language: "en" },
];

export const FALLBACK_CONFIG: AppConfig = {
  mode: "unconfigured",
  mimoConfigured: false,
  mock: false,
  voices: DEFAULT_VOICES,
  limits: DEFAULT_LIMITS,
  tts: { model: "mimo-v2.5-tts", free: "limited" },
  stt: { model: "mimo-v2.5-asr", pricePerHourCny: 0.5 },
};
