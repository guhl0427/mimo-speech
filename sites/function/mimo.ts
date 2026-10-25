import {
  MIMO_BASE_URL,
  MODEL_TTS,
  TTS_TIMEOUT_MS,
  VERIFY_TIMEOUT_MS,
} from "./config.ts";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfter?: number;

  constructor(code: string, message: string, status = 500, retryAfter?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

export type TtsInput = {
  text: string;
  voiceId: string;
  style: string;
  speed: number;
};

export type TtsResult = {
  bytes: Uint8Array;
  mime: string;
  requestId: string;
};

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-key": apiKey,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function upstreamError(status: number, retryAfterHeader: string | null): AppError {
  const retryAfter = Number(retryAfterHeader);
  if (status === 401 || status === 403) {
    return new AppError(
      "PROVIDER_AUTH_ERROR",
      "MiMo API Key 无效或没有权限，请到设置中检查。",
      502,
    );
  }
  if (status === 429) {
    return new AppError(
      "PROVIDER_RATE_LIMITED",
      "MiMo 当前限流，请稍后再试。",
      429,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
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

async function postChat(
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: authHeaders(apiKey),
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
    );
  }

  const headerRequestId = response.headers.get("x-request-id");
  if (!response.ok) {
    throw upstreamError(response.status, response.headers.get("retry-after"));
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回了无法解析的响应，请稍后重试。",
      502,
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
      `mimo-${crypto.randomUUID()}`,
    contentType: response.headers.get("content-type") ?? "",
  };
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let value = "";
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function looksLikeAudio(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (ascii(bytes, 0, 4) === "RIFF" || ascii(bytes, 0, 4) === "OggS") {
    return true;
  }
  if (ascii(bytes, 0, 3) === "ID3") return true;
  if (bytes.length >= 4 && ascii(bytes, 4, 4) === "ftyp") return true;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function mimeFor(bytes: Uint8Array): string | null {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return "audio/wav";
  }
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (bytes.length >= 4 && ascii(bytes, 4, 4) === "ftyp") return "audio/mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf) {
    return "audio/webm";
  }
  if (ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

function findAudioBase64(value: unknown, depth = 0): string | null {
  if (depth > 7) return null;

  if (typeof value === "string") {
    const dataUri = value.match(/^data:audio\/[^;]+;base64,([\s\S]+)$/);
    if (dataUri) return dataUri[1].replace(/\s/g, "");

    const cleaned = value.replace(/\s/g, "");
    if (cleaned.length > 200 && /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
      const decoded = decodeBase64(cleaned);
      if (decoded && looksLikeAudio(decoded)) return cleaned;
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

export async function synthesizeSpeech(
  apiKey: string,
  input: TtsInput,
): Promise<TtsResult> {
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

  const { json, requestId, contentType } = await postChat(
    apiKey,
    body,
    TTS_TIMEOUT_MS,
  );

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

  const bytes = decodeBase64(base64);
  if (!bytes || !bytes.length) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回的音频数据无法解码。",
      502,
    );
  }

  if (!looksLikeAudio(bytes)) {
    throw new AppError(
      "PROVIDER_RESPONSE_INVALID",
      "MiMo 返回的音频格式无法识别。",
      502,
    );
  }

  return {
    bytes,
    mime: mimeFor(bytes) || contentType || "audio/mpeg",
    requestId,
  };
}

export async function verifyMimoKey(
  apiKey: string,
): Promise<{ latencyMs: number }> {
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${MIMO_BASE_URL}/models`, {
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "TimeoutError";
    throw new AppError(
      isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      isTimeout
        ? "验证超时，请检查网络后重试。"
        : "无法连接 MiMo，请检查网络后重试。",
      isTimeout ? 504 : 502,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      "PROVIDER_AUTH_ERROR",
      "这个 Key 无效，或没有访问 MiMo API 的权限。请检查后重新填写。",
      400,
    );
  }

  if (!response.ok) {
    throw upstreamError(response.status, response.headers.get("retry-after"));
  }

  try {
    await response.body?.cancel();
  } catch {
    // The verification result is already known.
  }

  return { latencyMs: Date.now() - startedAt };
}
