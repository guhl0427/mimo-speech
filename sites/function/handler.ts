import {
  LIMITS,
  MODEL_ASR,
  MODEL_TTS,
  VOICE_IDS,
  VOICES,
} from "./config.ts";
import { AppError, synthesizeSpeech, verifyMimoKey } from "./mimo.ts";

type EnvReader = (name: string) => string;

const JSON_BODY_LIMIT_BYTES = 64 * 1024;

const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function jsonResponse(
  payload: unknown,
  status: number,
  requestId: string,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-Id": requestId,
      ...extra,
    },
  });
}

function errorResponse(error: AppError, requestId: string): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      },
    },
    error.status,
    requestId,
    error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined,
  );
}

function methodNotAllowed(allow: string, requestId: string): Response {
  return jsonResponse(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "请求方法不受支持。",
        requestId,
      },
    },
    405,
    requestId,
    { Allow: allow },
  );
}

function normalizePath(pathname: string): string {
  const stripped = pathname.replace(
    /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(?=\/|$)/,
    "",
  );
  return stripped || "/";
}

async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > JSON_BODY_LIMIT_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "请求内容过大。", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > JSON_BODY_LIMIT_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "请求内容过大。", 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_ERROR", "请求参数不正确。", 400);
  }
}

function validateTts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "请求参数不正确。", 400);
  }

  const record = value as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (!text) {
    throw new AppError("VALIDATION_ERROR", "先写下要朗读的文字。", 400);
  }
  if (text.length > LIMITS.textMax) {
    throw new AppError(
      "VALIDATION_ERROR",
      `文本不能超过 ${LIMITS.textMax} 字符。`,
      400,
    );
  }

  const voiceId = typeof record.voiceId === "string" ? record.voiceId : "";
  if (!VOICE_IDS.includes(voiceId)) {
    throw new AppError("VALIDATION_ERROR", "请选择一个可用的 MiMo 音色。", 400);
  }

  const style = typeof record.style === "string" ? record.style.trim() : "";
  if (style.length > LIMITS.styleMax) {
    throw new AppError(
      "VALIDATION_ERROR",
      `语气描述不能超过 ${LIMITS.styleMax} 字。`,
      400,
    );
  }

  const speed =
    typeof record.speed === "number" && Number.isFinite(record.speed)
      ? record.speed
      : 1;
  if (speed < LIMITS.speedMin || speed > LIMITS.speedMax) {
    throw new AppError(
      "VALIDATION_ERROR",
      "语速需要在 0.5 到 1.5 倍之间。",
      400,
    );
  }

  return { text, voiceId, style, speed };
}

function configPayload(apiKey: string) {
  return {
    mode: apiKey ? "live" : "unconfigured",
    mimoConfigured: Boolean(apiKey),
    mock: false,
    keySource: apiKey ? "server" : "none",
    keyHint: null,
    envConfigured: Boolean(apiKey),
    keyEditable: true,
    keyMode: "hybrid",
    serverKeyConfigured: Boolean(apiKey),
    features: { stt: false },
    voices: VOICES,
    limits: LIMITS,
    tts: { model: MODEL_TTS, free: "limited" },
    stt: {
      model: MODEL_ASR,
      pricePerHourCny: LIMITS.pricePerHourCny,
    },
  };
}

function getApiKey(getEnv: EnvReader): string {
  return getEnv("MIMO_API_KEY").trim();
}

export function createHandler(getEnv: EnvReader) {
  return async function handler(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    const apiKey = getApiKey(getEnv);

    try {
      const path = normalizePath(new URL(request.url).pathname);

      if (path === "/api/health") {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }
        return jsonResponse(
          {
            ok: true,
            mode: apiKey ? "live" : "unconfigured",
            mimoConfigured: Boolean(apiKey),
          },
          200,
          requestId,
        );
      }

      if (path === "/api/config") {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }
        return jsonResponse(configPayload(apiKey), 200, requestId);
      }

      if (path === "/api/tts") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }
        if (!apiKey) {
          throw new AppError(
            "MIMO_NOT_CONFIGURED",
            "站点尚未配置 MiMo API Key。",
            503,
          );
        }

        const input = validateTts(await readJson(request));
        const result = await synthesizeSpeech(apiKey, input);
        const extension = result.mime === "audio/wav" ? "wav" : "mp3";
        const safeVoice = input.voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
        const stamp = new Date()
          .toISOString()
          .replace(/[-:T]/g, "")
          .slice(0, 12);

        return new Response(result.bytes.slice().buffer, {
          status: 200,
          headers: {
            ...BASE_HEADERS,
            "Content-Type": result.mime,
            "X-Provider": "mimo",
            "X-Request-Id": requestId,
            "X-Mimo-Mode": "live",
            "Content-Disposition": `attachment; filename="shengxi-${safeVoice || "mimo"}-${stamp}.${extension}"`,
          },
        });
      }

      if (path === "/api/settings/mimo-key/test") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }
        if (!apiKey) {
          throw new AppError(
            "MIMO_NOT_CONFIGURED",
            "站点尚未配置 MiMo API Key。",
            400,
          );
        }

        const result = await verifyMimoKey(apiKey);
        return jsonResponse({ ok: true, latencyMs: result.latencyMs }, 200, requestId);
      }

      if (path === "/api/settings/mimo-key") {
        if (request.method !== "POST" && request.method !== "DELETE") {
          return methodNotAllowed("POST, DELETE", requestId);
        }
        throw new AppError(
          "KEY_MANAGED_BY_SERVER",
          "站点版由服务端管理 MiMo Key，无法在页面中修改。",
          403,
        );
      }

      if (path === "/api/stt") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }
        throw new AppError(
          "STT_UNAVAILABLE",
          "站点版暂不支持语音转文字。",
          501,
        );
      }

      return jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "页面或接口不存在。",
            requestId,
          },
        },
        404,
        requestId,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error, requestId);
      }
      return errorResponse(
        new AppError("INTERNAL_ERROR", "服务暂时不可用，请稍后再试。", 500),
        requestId,
      );
    }
  };
}
