import type { KeyboardEvent } from "react";
import type { AppConfig, Mode } from "../types";

type Props = {
  config: AppConfig;
  mode: Mode;
  onChange: (mode: Mode) => void;
};

export function ModeSwitch({ config, mode, onChange }: Props) {
  const minutes = Math.round(config.limits.audioMaxDurationSec / 60);

  function select(next: Mode) {
    onChange(next);
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
        onClick={() => onChange("stt")}
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
        onClick={() => onChange("tts")}
      >
        <span className="mode-index">02</span>
        <span className="mode-name">
          文字转语音
          <small>
            TEXT → SPEECH{" "}
            <span className="mode-extra">
              · {config.limits.textMax.toLocaleString("zh-CN")} CHARS
            </span>
          </small>
        </span>
        <span className="mode-arrow" aria-hidden="true">
          →
        </span>
      </button>
    </nav>
  );
}
