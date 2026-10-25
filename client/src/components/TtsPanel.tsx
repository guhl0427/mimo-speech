import { useEffect, useRef, useState } from "react";
import type { AppConfig, HistoryItem, PlayerState } from "../types";
import { ApiError, generateSpeech } from "../lib/api";
import {
  buildDownloadName,
  newId,
  readAudioDuration,
  titleFromText,
} from "../lib/format";
import { AudioPlayer } from "./AudioPlayer";
import { StyleField } from "./StyleField";
import { VoiceSelect } from "./VoiceSelect";

type Props = {
  config: AppConfig;
  active: boolean;
  player: PlayerState | null;
  historySeed: HistoryItem | null;
  onPlayerCreated: (player: PlayerState, item: HistoryItem, blob: Blob) => void;
  onToast: (message: string) => void;
};

function storedValue(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function storeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are optional.
  }
}

export function TtsPanel({
  config,
  active,
  player,
  historySeed,
  onPlayerCreated,
  onToast,
}: Props) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(() =>
    storedValue("shengxi-voice", config.voices[0]?.id ?? "mimo_default"),
  );
  const [style, setStyle] = useState("");
  const [speed, setSpeed] = useState(() => {
    const stored = Number(storedValue("shengxi-speed", "1"));
    return Number.isFinite(stored) ? stored : 1;
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canRun = config.mode !== "unconfigured";
  const length = text.length;
  const tooLong = length > config.limits.textMax;
  const blocked = !text.trim() || tooLong || generating || !canRun;

  useEffect(() => {
    if (!config.voices.some((voice) => voice.id === voiceId)) {
      setVoiceId(config.voices[0]?.id ?? "mimo_default");
    }
  }, [config.voices, voiceId]);

  useEffect(() => {
    storeValue("shengxi-voice", voiceId);
  }, [voiceId]);

  useEffect(() => {
    storeValue("shengxi-speed", String(speed));
  }, [speed]);

  useEffect(() => {
    if (!historySeed || historySeed.mode !== "tts") return;
    setText(historySeed.text);
    if (historySeed.voiceId) setVoiceId(historySeed.voiceId);
    setStyle(historySeed.style ?? "");
    if (typeof historySeed.speed === "number") setSpeed(historySeed.speed);
    setError(null);
  }, [historySeed]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function fillExample() {
    setText(
      "晚上好，这里是声息。今天想和你聊聊，声音如何被记住。窗外的风停了一会儿，房间里只剩下翻页的声音。",
    );
    setError(null);
  }

  function clearText() {
    setText("");
    setError(null);
  }

  async function handleGenerate() {
    if (!canRun) {
      setError("服务端尚未配置 MIMO_API_KEY，配置后即可生成。");
      return;
    }
    if (!text.trim()) {
      setError("先写下要朗读的文字。");
      return;
    }
    if (tooLong) {
      setError(`超出 ${config.limits.textMax} 字符，请删减后再生成。`);
      return;
    }

    setGenerating(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await generateSpeech(
        { text: text.trim(), voiceId, style, speed },
        controller.signal,
      );
      const url = URL.createObjectURL(result.blob);
      try {
        const duration = await readAudioDuration(url);
        const id = newId();
        const title = titleFromText(text);
        const item: HistoryItem = {
          id,
          mode: "tts",
          text: text.trim(),
          provider: result.provider,
          voiceId,
          style,
          speed,
          durationSec: duration || undefined,
          audioKey: id,
          sizeBytes: result.blob.size,
          mock: result.mock,
          createdAt: Date.now(),
        };
        onPlayerCreated(
          {
            url,
            blob: result.blob,
            title,
            durationSec: duration,
            downloadName: buildDownloadName(voiceId, result.mime),
            historyId: id,
            mock: result.mock,
          },
          item,
          result.blob,
        );
      } catch (prepareError) {
        URL.revokeObjectURL(url);
        throw prepareError;
      }
      onToast(result.mock ? "Mock 音频已生成（未调用 MiMo）" : "语音已生成");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        onToast("已取消生成");
      } else {
        setError(
          caught instanceof ApiError ? caught.message : "生成失败，请稍后重试。",
        );
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  return (
    <article
      className="tool-panel"
      id="panel-tts"
      role="tabpanel"
      aria-labelledby="tab-tts"
      tabIndex={0}
      hidden={!active}
    >
      <header className="panel-head">
        <span className="panel-kicker">Synthesize / 合成台</span>
        <span className="panel-status">
          MiMo TTS · {config.tts.free === "limited" ? "限时免费" : config.tts.free}
        </span>
      </header>

      <div className="panel-body">
        <h2 className="sr-only">文字转语音</h2>
        <div className="field-label">
          <span>Input / 文本</span>
          <span className="field-hint">最多 {config.limits.textMax.toLocaleString("zh-CN")} 字符</span>
        </div>
        <div className="textarea-wrap">
          <label className="sr-only" htmlFor="ttsText">
            要转换为语音的文本
          </label>
          <textarea
            id="ttsText"
            spellCheck={false}
            value={text}
            maxLength={config.limits.textMax + 1}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            placeholder={"把要朗读的文字放在这里。\n\n例如：晚上好，这里是声息。今天想和你聊聊，声音如何被记住。"}
          />
        </div>
        <div className="text-meta">
          <div className="text-meta-left">
            <button className="link-btn" type="button" onClick={fillExample}>
              试试示例
            </button>
            <button className="link-btn" type="button" onClick={clearText}>
              清空
            </button>
          </div>
          <span className={`char-count${tooLong ? " is-over" : ""}`}>
            {length.toLocaleString("zh-CN")} /{" "}
            {config.limits.textMax.toLocaleString("zh-CN")}
          </span>
        </div>
        {tooLong ? (
          <p className="inline-error">
            超出 {config.limits.textMax} 字符，请删减后再生成。
          </p>
        ) : null}

        <div className="controls">
          <div className="control">
            <span className="control-label" id="voiceLabel">
              Voice / 音色
            </span>
            <VoiceSelect
              voices={config.voices}
              value={voiceId}
              onChange={(id) => setVoiceId(id)}
              labelledBy="voiceLabel"
            />
          </div>
          <div className="control">
            <label className="control-label" htmlFor="styleInput">
              Style / 语气
            </label>
            <StyleField
              value={style}
              onChange={(next) => setStyle(next)}
              maxLength={config.limits.styleMax}
              inputId="styleInput"
            />
          </div>
          <div className="control">
            <label className="control-label" htmlFor="speedRange">
              Speed / 语速
            </label>
            <div className="speed-row">
              <input
                id="speedRange"
                type="range"
                min={config.limits.speedMin}
                max={config.limits.speedMax}
                step={0.1}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <span className="speed-value">{speed.toFixed(1)}×</span>
            </div>
          </div>
        </div>

        <div className="action-row">
          <p className="action-note">
            {config.mode === "unconfigured"
              ? "配置 MIMO_API_KEY 后即可生成语音。"
              : config.mode === "mock"
                ? "当前为 Mock 模式，生成的是本地示例音频，不会调用 MiMo。"
                : "当前由 MiMo TTS 提供，限时免费。生成后可试听并下载音频；若官方结束免费，以官方计费为准。"}
          </p>
          <div className="action-buttons">
            {generating ? (
              <button className="link-btn" type="button" onClick={() => abortRef.current?.abort()}>
                取消
              </button>
            ) : null}
            <button
              className={`primary-btn${generating ? " is-loading" : ""}`}
              id="ttsGenerate"
              type="button"
              disabled={blocked}
              onClick={handleGenerate}
              title={!canRun ? "需要先配置 MIMO_API_KEY" : undefined}
            >
              <span className="btn-label">{generating ? "正在合成" : "生成语音"}</span>
              <span className="btn-arrow" aria-hidden="true">
                {generating ? "◌" : "→"}
              </span>
            </button>
          </div>
        </div>

        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}

        {player && !generating ? (
          <AudioPlayer player={player} active={active} onToast={onToast} />
        ) : null}
      </div>

      <footer className="panel-foot">
        <span>文本会发送给 MiMo 用于合成</span>
        <span>历史音频仅保存在这台浏览器</span>
      </footer>
    </article>
  );
}
