import type {
  AppConfig,
  SettingsApiResult,
  SttApiResult,
  TtsApiResult,
  VerifyApiResult,
} from "../types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(
    message: string,
    status = 0,
    code = "UNKNOWN_ERROR",
    requestId?: string,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
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
    const response = await fetch("/api/config", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as AppConfig;
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
  try {
    const response = await fetch("/api/tts", {
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

    const response = await fetch("/api/stt", {
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
    const response = await fetch("/api/settings/mimo-key", {
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
    const response = await fetch("/api/settings/mimo-key", {
      method: "DELETE",
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as SettingsApiResult;
  } catch (error) {
    return networkError(error);
  }
}

export async function testMimoKey(): Promise<VerifyApiResult> {
  try {
    const response = await fetch("/api/settings/mimo-key/test", {
      method: "POST",
    });
    if (!response.ok) await throwApiError(response);
    return (await response.json()) as VerifyApiResult;
  } catch (error) {
    return networkError(error);
  }
}
