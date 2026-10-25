import type { AppConfig } from "../types";

type Props = {
  config: AppConfig;
  loading: boolean;
  error: string | null;
  onInfo: () => void;
};

function statusFor(config: AppConfig, loading: boolean, error: string | null) {
  if (error) return { label: "API 离线", className: "is-warn" };
  if (loading) return { label: "连接中", className: "is-muted" };
  if (config.mode === "live") return { label: "MIMO READY", className: "is-live" };
  if (config.mode === "mock") return { label: "MOCK 模式", className: "is-mock" };
  return { label: "未配置 KEY", className: "is-warn" };
}

export function TopBar({ config, loading, error, onInfo }: Props) {
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
          title="MiMo 接口状态"
        >
          <span className="dot" aria-hidden="true" />
          {status.label}
        </span>
        <button className="text-link" type="button" onClick={onInfo}>
          说明
        </button>
      </div>
    </header>
  );
}
