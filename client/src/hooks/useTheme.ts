import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "shengxi-theme";
const LIGHT_THEME_COLOR = "#f2ede3";
const DARK_THEME_COLOR = "#14110d";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be blocked; fall back to the system preference.
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readThemeMode);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme = mode === "system" ? system : mode;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The chosen theme still applies for this session.
    }
  }, []);

  return { mode, theme, system, setMode };
}
