import type {
  AppConfig,
  AppKeyMode,
  KeySource,
  SettingsApiResult,
  SttApiResult,
  TtsApiResult,
  VerifyApiResult,
} from "../types";
import { getBrowserKey } from "./browserKey";
import { ApiError } from "./errors";
import { synthesizeDirect, testDirectKey } from "./mimoDirect";

export { ApiError } from "./errors";

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

let activeKeyMode: AppKeyMode = "server";

function withBrowserKey(config: AppConfig): AppConfig {
  if (config.keyMode !== "hybrid") return config;

  const browserKey = getBrowserKey();
  const serverKeyConfigured = config.serverKeyConfigured;
  const keySource: KeySource = browserKey
    ? "browser"
    : serverKeyConfigured
      ? "server"
      : "none";

  return {
    ...config,
    keySource,
    keyHint: browserKey.length >= 8 ? browserKey.slice(-4) : null,
    envConfigured: serverKeyConfigured,
    mode: keySource === "none" ? "unconfigured" : "live",
    mimoConfigured: keySource !== "none",
    mock: false,
  };
}

async function throwApiError(response: Response): Promise<never> {
  let payload: {
    error?: {
      code?: string;
      message?: string;
      requestId?: string;
      retryAfter?: number;
    };
  } | null = null;

  try {
    payload = await response.json();
  } catch {
    // Use the generic message below.
  }

  throw new ApiError(
    payload?.error?.message || `请求失败（HTTP ${response.status}）。`,
    response.status,
    payload?.error?.code || "HTTP_ERROR",
    payload?.error?.requestId,
    payload?.error?.retryAfter,
  );
}

function networkError(error: unknown): never {
  if (error instanceof ApiError || (error instanceof DOMException && error.name === "AbortError")) {
    throw error;
  }
  throw new ApiError(
    "无法连接服务端，请确认 API 服务已启动。",
    0,
    "NETWORK_ERROR",
  );
}

export async function fetchConfig(signal?: AbortSignal): Promise<AppConfig> {
  try {
    const response = await fetch(apiUrl("/config"), {
      cache: "no-store",
      signal,
    });
    if (!response.ok) await throwApiError(response);
    const config = (await response.json()) as AppConfig;
    activeKeyMode = config.keyMode === "hybrid" ? "hybrid" : "server";
    return withBrowserKey(config);
  } catch (error) {
    return networkError(error);
  }
}

export type GenerateSpeechInput = {
  text: string;
  voiceId: string;
  style: string;
  speed: number;
};

export async function generateSpeech(
  input: GenerateSpeechInput,
  signal?: AbortSignal,
): Promise<TtsApiResult> {
  const browserKey = activeKeyMode === "hybrid" ? getBrowserKey() : "";
  if (browserKey) {
    const result = await synthesizeDirect(input, browserKey, signal);
    return {
      blob: result.blob,
      mime: result.mime,
      provider: "mimo",
      mock: false,
      requestId: result.requestId,
    };
  }

  try {
    const response = await fetch(apiUrl("/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });

    if (!response.ok) await throwApiError(response);

    const blob = await response.blob();
    if (!blob.size) {
      throw new ApiError("MiMo 返回了空音频，请稍后重试。", 502, "EMPTY_AUDIO");
    }

    return {
      blob,
      mime: response.headers.get("content-type") || blob.type || "audio/mpeg",
      provider: response.headers.get("x-provider") || "mimo",
      mock: response.headers.get("x-mimo-mode") === "mock",
      requestId: response.headers.get("x-request-id") || undefined,
    };
  } catch (error) {
    return networkError(error);
  }
}

export type TranscribeInput = {
  file: File;
  language: string;
  durationSec: number;
  signal?: AbortSignal;
};

export async function transcribeAudio(input: TranscribeInput): Promise<SttApiResult> {
  try {
    const form = new FormData();
    form.append("file", input.file, input.file.name);
    form.append("language", input.language);
    form.append("durationSec", String(input.durationSec));

    const response = await fetch(apiUrl("/stt"), {
      method: "POST",
      body: form,
      signal: input.signal,
    });

    if (!response.ok) await throwApiError(response);
    return (await response.json()) as SttApiResult;
  } catch (error) {
    return networkError(error);
  }
}

export async function saveMimoKey(apiKey: string): Promise<SettingsApiResult> {
  try {
    const response = await fetch(apiUrl("/settings/mimo-key"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as SettingsApiResult;
  } catch (error) {
    return networkError(error);
  }
}

export async function clearMimoKey(): Promise<SettingsApiResult> {
  try {
    const response = await fetch(apiUrl("/settings/mimo-key"), {
      method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as SettingsApiResult;
  } catch (error) {
    return networkError(error);
  }
}

export async function testMimoKey(): Promise<VerifyApiResult> {
  const browserKey = activeKeyMode === "hybrid" ? getBrowserKey() : "";
  if (browserKey) {
    const result = await testDirectKey(browserKey);
    return { ok: true, latencyMs: result.latencyMs };
  }

  try {
    const response = await fetch(apiUrl("/settings/mimo-key/test"), {
      method: "POST",
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as VerifyApiResult;
  } catch (error) {
    return networkError(error);
  }
}
