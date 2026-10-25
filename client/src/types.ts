export type Mode = "stt" | "tts";

export type AppMode = "live" | "mock" | "unconfigured";

export type KeySource = "settings" | "env" | "browser" | "server" | "none";

export type AppKeyMode = "server" | "hybrid";

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

export type AppFeatures = {
  stt: boolean;
};

export type AppConfig = {
  mode: AppMode;
  mimoConfigured: boolean;
  mock: boolean;
  keySource: KeySource;
  keyHint: string | null;
  envConfigured: boolean;
  keyEditable: boolean;
  keyMode: AppKeyMode;
  serverKeyConfigured: boolean;
  features: AppFeatures;
  voices: Voice[];
  limits: Limits;
  tts: { model: string; free: string };
  stt: { model: string; pricePerHourCny: number };
};

export type SettingsApiResult = {
  ok: true;
  mode: AppMode;
  keySource: KeySource;
  keyHint: string | null;
  envConfigured: boolean;
};

export type VerifyApiResult = {
  ok: true;
  latencyMs: number;
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
  { id: "mimo_default", label: "MiMo 默认 · 随集群", language: "auto" },
  { id: "冰糖", label: "冰糖 · 中文女声", language: "zh" },
  { id: "茉莉", label: "茉莉 · 中文女声", language: "zh" },
  { id: "苏打", label: "苏打 · 中文男声", language: "zh" },
  { id: "白桦", label: "白桦 · 中文男声", language: "zh" },
  { id: "Mia", label: "Mia · 英文女声", language: "en" },
  { id: "Chloe", label: "Chloe · 英文女声", language: "en" },
  { id: "Milo", label: "Milo · 英文男声", language: "en" },
  { id: "Dean", label: "Dean · 英文男声", language: "en" },
];

export const FALLBACK_CONFIG: AppConfig = {
  mode: "unconfigured",
  mimoConfigured: false,
  mock: false,
  keySource: "none",
  keyHint: null,
  envConfigured: false,
  keyEditable: true,
  keyMode: "server",
  serverKeyConfigured: false,
  features: { stt: true },
  voices: DEFAULT_VOICES,
  limits: DEFAULT_LIMITS,
  tts: { model: "mimo-v2.5-tts", free: "limited" },
  stt: { model: "mimo-v2.5-asr", pricePerHourCny: 0.5 },
};
