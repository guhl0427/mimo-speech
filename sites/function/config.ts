// Self-contained copy: the Sites packager only uploads this function directory.
export const MODEL_TTS = "mimo-v2.5-tts";
export const MODEL_ASR = "mimo-v2.5-asr";
export const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
export const TTS_TIMEOUT_MS = 60_000;
export const VERIFY_TIMEOUT_MS = 15_000;

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
  { id: "mimo_default", label: "MiMo 默认 · 随集群", language: "auto" },
  { id: "冰糖", label: "冰糖 · 中文女声", language: "zh" },
  { id: "茉莉", label: "茉莉 · 中文女声", language: "zh" },
  { id: "苏打", label: "苏打 · 中文男声", language: "zh" },
  { id: "白桦", label: "白桦 · 中文男声", language: "zh" },
  { id: "Mia", label: "Mia · 英文女声", language: "en" },
  { id: "Chloe", label: "Chloe · 英文女声", language: "en" },
  { id: "Milo", label: "Milo · 英文男声", language: "en" },
  { id: "Dean", label: "Dean · 英文男声", language: "en" },
] as const;

export const VOICE_IDS: readonly string[] = VOICES.map((voice) => voice.id);
