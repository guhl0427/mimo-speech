const STORAGE_KEY = "shengxi-mimo-key";

export function getBrowserKey(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function saveBrowserKey(apiKey: string): void {
  const key = apiKey.trim();
  if (!key) throw new Error("API Key 不能为空。");
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    throw new Error("无法写入浏览器存储，请检查浏览器的隐私设置。");
  }
}

export function clearBrowserKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The key is already inaccessible.
  }
}
