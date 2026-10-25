import type { KeyboardEvent } from "react";
import type { AppConfig, Mode } from "../types";

type Props = {
  config: AppConfig;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export function Intro({ config, mode, onModeChange }: Props) {
  const minutes = Math.round(config.limits.audioMaxDurationSec / 60);

  function select(next: Mode) {
    onModeChange(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`tab-${next}`)?.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(mode === "stt" ? "tts" : "stt");
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(mode === "stt" ? "tts" : "stt");
    } else if (event.key === "Home") {
      event.preventDefault();
      select("stt");
    } else if (event.key === "End") {
      event.preventDefault();
      select("tts");
    }
  }

  return (
    <section className="intro" aria-labelledby="pageTitle">
      <span className="ghost" aria-hidden="true">
        声
      </span>
      <p className="eyebrow">Private voice desk · 2026</p>
      <h1 id="pageTitle">
        把声音
        <br />
        留成文字，
        <br />
        <em>也让文字</em>
        <br />
        重新发声。
      </h1>
      <p className="lede">
        一个只服务 MiMo 的私人语音工作台。转录按量计费，合成限时免费；所有历史留在本机。
      </p>

      <div className="rate-strip" aria-label="服务与计费概览">
        <div className="rate-cell">
          <div className="rate-key">TTS / 合成</div>
          <div className="rate-value">
            限时免费<small>MiMo TTS · 以官方为准</small>
          </div>
        </div>
        <div className="rate-cell">
          <div className="rate-key">ASR / 转写</div>
          <div className="rate-value">
            ¥{config.stt.pricePerHourCny}
            <small>每小时 · 单次 {minutes} 分钟</small>
          </div>
        </div>
      </div>

      <nav
        className="modes"
        role="tablist"
        aria-label="语音工作模式"
        onKeyDown={handleKeyDown}
      >
        <button
          className="mode-tab"
          role="tab"
          id="tab-stt"
          type="button"
          aria-selected={mode === "stt"}
          aria-controls="panel-stt"
          tabIndex={mode === "stt" ? 0 : -1}
          onClick={() => onModeChange("stt")}
        >
          <span className="mode-index">01</span>
          <span className="mode-name">
            语音转文字
            <small>
              SPEECH → TEXT <span className="mode-extra">· {minutes} MIN</span>
            </small>
          </span>
          <span className="mode-arrow" aria-hidden="true">
            →
          </span>
        </button>
        <button
          className="mode-tab"
          role="tab"
          id="tab-tts"
          type="button"
          aria-selected={mode === "tts"}
          aria-controls="panel-tts"
          tabIndex={mode === "tts" ? 0 : -1}
          onClick={() => onModeChange("tts")}
        >
          <span className="mode-index">02</span>
          <span className="mode-name">
            文字转语音
            <small>
              TEXT → SPEECH <span className="mode-extra">· {config.limits.textMax.toLocaleString("zh-CN")} CHARS</span>
            </small>
          </span>
          <span className="mode-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </nav>

      <p className="intro-foot">
        <strong>声音是第二种笔迹。</strong>
        <br />
        这里不保存你的音频，只留下你愿意留下的文字。
      </p>
    </section>
  );
}
