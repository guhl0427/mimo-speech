import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  CLIENT_DIST,
  LIMITS,
  MODEL_ASR,
  MODEL_TTS,
  PORT,
  VOICE_IDS,
  VOICES,
  estimateCostCny,
} from "./config.js";
import { prepareAudio } from "./audio.js";
import { AppError, asyncRoute, errorHandler, notFoundHandler } from "./errors.js";
import { synthesizeSpeech, transcribeSpeech, verifyMimoKey } from "./mimo.js";
import {
  clearStoredApiKey,
  getAppMode,
  getEffectiveApiKey,
  getKeyStatus,
  saveStoredApiKey,
} from "./settings.js";

const app = express();
app.disable("x-powered-by");
// Required when running behind Vite's dev proxy or a personal reverse proxy.
app.set("trust proxy", 1);
app.use(express.json({ limit: "64kb" }));
app.use((_req, res, next) => {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.uploadMaxBytes, files: 1 },
});

const ttsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError("RATE_LIMITED", "请求太频繁，请稍后再试。", 429));
  },
});

const sttLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError("RATE_LIMITED", "请求太频繁，请稍后再试。", 429));
  },
});

const settingsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError("RATE_LIMITED", "操作太频繁，请稍后再试。", 429));
  },
});

const ttsSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "先写下要朗读的文字。")
    .max(LIMITS.textMax, `文本不能超过 ${LIMITS.textMax} 字符。`),
  voiceId: z
    .string()
    .refine((id) => VOICE_IDS.includes(id), "请选择一个可用的 MiMo 音色。"),
  style: z
    .string()
    .trim()
    .max(LIMITS.styleMax, `语气描述不能超过 ${LIMITS.styleMax} 字。`)
    .optional()
    .default(""),
  speed: z
    .number()
    .min(LIMITS.speedMin, "语速不能低于 0.5 倍。")
    .max(LIMITS.speedMax, "语速不能高于 1.5 倍。")
    .optional()
    .default(1),
});

const mimoKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(8, "API Key 太短，请检查是否复制完整。")
    .max(512, "API Key 过长，请检查是否复制了多余内容。")
    .regex(/^[\x21-\x7e]+$/, "API Key 不能包含空格或换行。"),
});

function settingsPayload() {
  const status = getKeyStatus();
  return {
    ok: true,
    mode: getAppMode(),
    keySource: status.source,
    keyHint: status.hint,
    envConfigured: status.envConfigured,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: getAppMode(),
    mimoConfigured: getAppMode() === "live",
  });
});

app.get("/api/config", (_req, res) => {
  const status = getKeyStatus();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    mode: getAppMode(),
    mimoConfigured: getAppMode() === "live",
    mock: getAppMode() === "mock",
    keySource: status.source,
    keyHint: status.hint,
    envConfigured: status.envConfigured,
    keyEditable: true,
    keyMode: "server",
    serverKeyConfigured: status.configured,
    features: { stt: true },
    voices: VOICES,
    limits: LIMITS,
    tts: { model: MODEL_TTS, free: "limited" },
    stt: {
      model: MODEL_ASR,
      pricePerHourCny: LIMITS.pricePerHourCny,
    },
  });
});

app.post(
  "/api/settings/mimo-key",
  settingsLimiter,
  asyncRoute(async (req, res) => {
    const parsed = mimoKeySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "API Key 格式不正确。",
        400,
      );
    }

    saveStoredApiKey(parsed.data.apiKey);
    console.log("[shengxi] MiMo API Key updated from settings.");
    res.setHeader("Cache-Control", "no-store");
    res.json(settingsPayload());
  }),
);

app.delete(
  "/api/settings/mimo-key",
  settingsLimiter,
  asyncRoute(async (_req, res) => {
    clearStoredApiKey();
    console.log("[shengxi] Stored MiMo API Key cleared from settings.");
    res.setHeader("Cache-Control", "no-store");
    res.json(settingsPayload());
  }),
);

app.post(
  "/api/settings/mimo-key/test",
  settingsLimiter,
  asyncRoute(async (_req, res) => {
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
      throw new AppError(
        "MIMO_NOT_CONFIGURED",
        "还没有可测试的 Key，请先填写并保存。",
        400,
      );
    }

    const result = await verifyMimoKey(apiKey);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, latencyMs: result.latencyMs });
  }),
);

app.post(
  "/api/tts",
  ttsLimiter,
  asyncRoute(async (req, res) => {
    if (getAppMode() === "unconfigured") {
      throw new AppError(
        "MIMO_NOT_CONFIGURED",
        "尚未配置 MiMo API Key。请打开设置填写，或在 .env 中配置 MIMO_API_KEY。",
        503,
      );
    }

    const parsed = ttsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "请求参数不正确。",
        400,
      );
    }

    const result = await synthesizeSpeech(parsed.data);
    const extension = result.mime === "audio/wav" ? "wav" : "mp3";
    const safeVoice = parsed.data.voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 12);

    res.setHeader("Content-Type", result.mime);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Provider", result.provider);
    res.setHeader("X-Request-Id", result.requestId);
    res.setHeader("X-Mimo-Mode", result.mock ? "mock" : "live");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="shengxi-${safeVoice || "mimo"}-${stamp}.${extension}"`,
    );
    res.send(result.buffer);
  }),
);

app.post(
  "/api/stt",
  sttLimiter,
  upload.single("file"),
  asyncRoute(async (req, res) => {
    if (getAppMode() === "unconfigured") {
      throw new AppError(
        "MIMO_NOT_CONFIGURED",
        "尚未配置 MiMo API Key。请打开设置填写，或在 .env 中配置 MIMO_API_KEY。",
        503,
      );
    }

    if (!req.file) {
      throw new AppError("VALIDATION_ERROR", "请上传一个音频文件。", 400);
    }

    if (!req.file.size) {
      throw new AppError("VALIDATION_ERROR", "上传的音频文件为空。", 400);
    }

    const language =
      req.body?.language === "en"
        ? "en"
        : req.body?.language === "auto"
          ? "auto"
          : "zh";
    const durationHint = Number(req.body?.durationSec);
    const prepared = await prepareAudio(
      req.file.buffer,
      req.file.originalname,
      Number.isFinite(durationHint) && durationHint > 0 ? durationHint : undefined,
    );

    const result = await transcribeSpeech({
      base64: prepared.base64,
      durationSec: prepared.durationSec,
      language,
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({
      text: result.text,
      provider: result.provider,
      durationSec: prepared.durationSec,
      estimatedCostCny: estimateCostCny(prepared.durationSec),
      requestId: result.requestId,
      mock: result.mock,
    });
  }),
);

app.use("/api", notFoundHandler);

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      name: "shengxi-api",
      mode: getAppMode(),
      message: "Development UI runs on http://127.0.0.1:5173.",
    });
  });
}

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "页面或接口不存在。",
      requestId: res.locals.requestId,
    },
  });
});

app.use(errorHandler);

const startupMode = getAppMode();
if (startupMode === "mock") {
  console.warn(
    "[shengxi] MOCK_MIMO=1: TTS/STT requests use local sample data. No MiMo calls will be made.",
  );
} else if (startupMode === "unconfigured") {
  console.warn(
    "[shengxi] No MiMo API Key found. Add one in the in-app settings or set MIMO_API_KEY in .env.",
  );
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[shengxi] API listening on http://127.0.0.1:${PORT} (${getAppMode()})`,
  );
});
