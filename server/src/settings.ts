import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  ENV_MIMO_API_KEY,
  MOCK_MIMO,
  ROOT_DIR,
  type AppMode,
} from "./config.js";

const SETTINGS_DIR = path.join(ROOT_DIR, "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

type StoredSettings = {
  mimoApiKey?: unknown;
};

export type KeySource = "settings" | "env" | "none";

export type KeyStatus = {
  source: KeySource;
  configured: boolean;
  hint: string | null;
  envConfigured: boolean;
};

function readStoredApiKey(): string {
  let raw: string;
  try {
    raw = readFileSync(SETTINGS_FILE, "utf8");
  } catch {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as StoredSettings;
    return typeof parsed.mimoApiKey === "string"
      ? parsed.mimoApiKey.trim()
      : "";
  } catch {
    return "";
  }
}

export function getEffectiveApiKey(): string {
  return readStoredApiKey() || ENV_MIMO_API_KEY;
}

export function getKeyStatus(): KeyStatus {
  const stored = readStoredApiKey();
  const key = stored || ENV_MIMO_API_KEY;
  return {
    source: stored ? "settings" : ENV_MIMO_API_KEY ? "env" : "none",
    configured: Boolean(key),
    hint: key.length >= 8 ? key.slice(-4) : null,
    envConfigured: Boolean(ENV_MIMO_API_KEY),
  };
}

export function getAppMode(): AppMode {
  if (MOCK_MIMO) return "mock";
  return getKeyStatus().configured ? "live" : "unconfigured";
}

export function saveStoredApiKey(apiKey: string): void {
  const key = apiKey.trim();
  mkdirSync(SETTINGS_DIR, { recursive: true });

  const tempFile = `${SETTINGS_FILE}.${process.pid}.tmp`;
  writeFileSync(tempFile, `${JSON.stringify({ mimoApiKey: key }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tempFile, SETTINGS_FILE);

  try {
    chmodSync(SETTINGS_FILE, 0o600);
  } catch {
    // Windows does not enforce POSIX modes.
  }
}

export function clearStoredApiKey(): void {
  rmSync(SETTINGS_FILE, { force: true });
}
