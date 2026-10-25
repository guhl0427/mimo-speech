import { Settings } from "lucide-react";
import type { AppConfig } from "../types";

type Props = {
  config: AppConfig;
  loading: boolean;
  error: string | null;
  onSettings: () => void;
  onInfo: () => void;
};

function statusFor(config: AppConfig, loading: boolean, error: string | null) {
  if (error) return { label: "API 离线", className: "is-warn" };
  if (loading) return { label: "连接中", className: "is-muted" };
  if (config.mode === "live") return { label: "MIMO READY", className: "is-live" };
  if (config.mode === "mock") return { label: "MOCK 模式", className: "is-mock" };
  return { label: "未配置 KEY", className: "is-warn" };
}

function keyTitle(config: AppConfig): string {
  if (config.keySource === "settings") {
    return config.keyHint
      ? `使用设置中的个人 Key（尾号 ${config.keyHint}）`
      : "使用设置中的个人 Key";
  }
  if (config.keySource === "env") {
    return config.keyHint
      ? `使用服务端 .env 中的 Key（尾号 ${config.keyHint}）`
      : "使用服务端 .env 中的 Key";
  }
  return "尚未配置 MiMo API Key，打开设置填写";
}

export function TopBar({ config, loading, error, onSettings, onInfo }: Props) {
  const status = statusFor(config, loading, error);

  return (
    <header className="topbar">
      <a className="brand" href="#stt" aria-label="声息，返回语音转文字">
        <span className="seal" aria-hidden="true">
          声
        </span>
        <span className="brand-copy">
          <span className="wordmark">声息</span>
          <span className="brand-sub">Voice / Text Desk</span>
        </span>
      </a>
      <div className="top-actions">
        <span
          className={`demo-chip ${status.className}`}
          title={error ? "MiMo 接口状态" : keyTitle(config)}
        >
          <span className="dot" aria-hidden="true" />
          {status.label}
        </span>
        <button
          className="text-link settings-link"
          type="button"
          onClick={onSettings}
          aria-label="打开 MiMo Key 设置"
        >
          <Settings size={14} aria-hidden="true" />
          设置
        </button>
        <button className="text-link" type="button" onClick={onInfo}>
          说明
        </button>
      </div>
    </header>
  );
}
