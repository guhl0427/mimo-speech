export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function estimateCost(seconds: number, pricePerHour = 0.5): number {
  return Math.max(
    0.01,
    Math.round((Number(seconds || 0) / 3600) * pricePerHour * 100) / 100,
  );
}

export function formatCny(value: number): string {
  return `¥${Number(value || 0).toFixed(2)}`;
}

export function titleFromText(text: string, max = 18): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

export function extensionFromMime(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  return "mp3";
}

export function buildDownloadName(voiceId: string, mime: string): string {
  const safeVoice = voiceId.replace(/[^\p{L}\p{N}_-]/gu, "") || "mimo";
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `shengxi-${safeVoice}-${stamp}.${extensionFromMime(mime)}`;
}

export function readAudioDuration(url: string, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
    };
    const timer = window.setTimeout(() => finish(0), timeoutMs);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

export async function readFileDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await readAudioDuration(url, 4000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `shengxi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
