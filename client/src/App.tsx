import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig, HistoryItem, Mode, PlayerState } from "./types";
import { FALLBACK_CONFIG } from "./types";
import { ApiError, fetchConfig } from "./lib/api";
import {
  clearHistoryItems,
  deleteHistoryItem,
  getHistoryAudio,
  listHistory,
  saveHistoryItem,
} from "./lib/db";
import { buildDownloadName, readAudioDuration, titleFromText } from "./lib/format";
import { TopBar } from "./components/TopBar";
import { Intro } from "./components/Intro";
import { ConfigBanner } from "./components/ConfigBanner";
import { TtsPanel } from "./components/TtsPanel";
import { SttPanel } from "./components/SttPanel";
import { RecentPanel } from "./components/RecentPanel";
import { Footer } from "./components/Footer";
import { InfoDialog } from "./components/Dialogs";
import { Toast } from "./components/Toast";

function initialMode(): Mode {
  return window.location.hash === "#tts" ? "tts" : "stt";
}

export function App() {
  const [config, setConfig] = useState<AppConfig>(FALLBACK_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySeed, setHistorySeed] = useState<HistoryItem | null>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const toastTimer = useRef<number | null>(null);
  const playerUrlRef = useRef<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const replacePlayer = useCallback((next: PlayerState | null) => {
    if (playerUrlRef.current && playerUrlRef.current !== next?.url) {
      URL.revokeObjectURL(playerUrlRef.current);
    }
    playerUrlRef.current = next?.url ?? null;
    setPlayer(next);
  }, []);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const next = await fetchConfig();
      setConfig(next);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "无法连接服务端，请确认 API 服务已启动。";
      setConfigError(message);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistoryItems(await listHistory());
    } catch {
      showToast("读取本机历史失败，请检查浏览器存储权限。");
    } finally {
      setHistoryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadConfig();
    void refreshHistory();
  }, [loadConfig, refreshHistory]);

  useEffect(() => {
    const onHashChange = () => setMode(initialMode());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (playerUrlRef.current) URL.revokeObjectURL(playerUrlRef.current);
    };
  }, []);

  const changeMode = useCallback((next: Mode) => {
    setMode(next);
    window.history.replaceState(null, "", `#${next}`);
  }, []);

  const handleTtsCreated = useCallback(
    (nextPlayer: PlayerState, item: HistoryItem, blob: Blob) => {
      replacePlayer(nextPlayer);
      void (async () => {
        try {
          await saveHistoryItem(item, blob);
          await refreshHistory();
        } catch {
          showToast("音频已生成，但历史保存失败。你仍可下载或重新生成。");
        }
      })();
    },
    [refreshHistory, replacePlayer, showToast],
  );

  const handleSttCompleted = useCallback(
    (item: HistoryItem) => {
      void (async () => {
        try {
          await saveHistoryItem(item);
          await refreshHistory();
        } catch {
          showToast("转写完成，但历史保存失败。你仍可复制或导出 TXT。");
        }
      })();
    },
    [refreshHistory, showToast],
  );

  const openHistory = useCallback(
    (item: HistoryItem) => {
      const seed = { ...item };
      setHistorySeed(seed);
      changeMode(item.mode);
      if (item.mode !== "tts") return;

      replacePlayer(null);
      void (async () => {
        if (!item.audioKey) {
          showToast("这条记录没有音频文件。");
          return;
        }
        try {
          const blob = await getHistoryAudio(item.audioKey);
          if (!blob) {
            showToast("音频已不在本机历史中，可能已被清理。");
            return;
          }
          const url = URL.createObjectURL(blob);
          const duration = item.durationSec ?? (await readAudioDuration(url));
          replacePlayer({
            url,
            blob,
            title: titleFromText(item.text),
            durationSec: duration,
            downloadName: buildDownloadName(item.voiceId ?? "mimo", blob.type),
            historyId: item.id,
            mock: item.mock ?? false,
          });
        } catch {
          showToast("读取历史音频失败。");
        }
      })();
    },
    [changeMode, replacePlayer, showToast],
  );

  const handleDeleteHistory = useCallback(
    (item: HistoryItem) => {
      void (async () => {
        try {
          await deleteHistoryItem(item);
          setHistoryItems((current) => current.filter((entry) => entry.id !== item.id));
          if (player?.historyId === item.id) replacePlayer(null);
          showToast("记录已删除");
        } catch {
          showToast("删除失败，请稍后重试。");
        }
      })();
    },
    [player?.historyId, replacePlayer, showToast],
  );

  const handleClearHistory = useCallback(() => {
    if (!historyItems.length) return;
    const confirmed = window.confirm("清空全部本地记录？历史音频也会一并删除。");
    if (!confirmed) return;
    void (async () => {
      try {
        await clearHistoryItems();
        setHistoryItems([]);
        replacePlayer(null);
        showToast("本地记录已清空");
      } catch {
        showToast("清空失败，请稍后重试。");
      }
    })();
  }, [historyItems.length, replacePlayer, showToast]);

  const status = (() => {
    if (configError) {
      return {
        text: "API 服务未连接 · 请检查服务端是否启动",
        warning: true,
      };
    }
    if (configLoading) return { text: "正在连接 MiMo 服务…", warning: false };
    if (config.mode === "live") {
      return { text: "MiMo API 已连接 · 音频不落盘", warning: false };
    }
    if (config.mode === "mock") {
      return { text: "开发 Mock 模式 · 结果均为本地示例", warning: true };
    }
    return {
      text: "服务端未配置 MIMO_API_KEY · 填入 .env 后重启",
      warning: true,
    };
  })();

  return (
    <>
      <div className="side-note" aria-hidden="true">
        VOICE — TEXT — MI-MO
      </div>

      <TopBar
        config={config}
        loading={configLoading}
        error={configError}
        onInfo={() => setInfoOpen(true)}
      />

      <main className="shell">
        <Intro config={config} mode={mode} onModeChange={changeMode} />

        <section className="workspace">
          <ConfigBanner
            config={config}
            loading={configLoading}
            error={configError}
            onRetry={() => void loadConfig()}
            onInfo={() => setInfoOpen(true)}
          />

          <TtsPanel
            config={config}
            active={mode === "tts"}
            player={mode === "tts" ? player : null}
            historySeed={historySeed?.mode === "tts" ? historySeed : null}
            onPlayerCreated={handleTtsCreated}
            onToast={showToast}
          />

          <SttPanel
            config={config}
            active={mode === "stt"}
            historySeed={historySeed?.mode === "stt" ? historySeed : null}
            onCompleted={handleSttCompleted}
            onToast={showToast}
          />

          <RecentPanel
            items={historyItems}
            loading={historyLoading}
            onOpen={openHistory}
            onDelete={handleDeleteHistory}
            onClear={handleClearHistory}
          />
        </section>
      </main>

      <Footer statusText={status.text} warning={status.warning} onInfo={() => setInfoOpen(true)} />

      <InfoDialog
        open={infoOpen}
        config={config}
        configError={configError}
        onClose={() => setInfoOpen(false)}
        onRetry={() => void loadConfig()}
      />

      <Toast message={toast} />
    </>
  );
}
