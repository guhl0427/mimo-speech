import type { AppConfig } from "../types";

type Props = {
  config: AppConfig;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSettings: () => void;
};

export function ConfigBanner({
  config,
  loading,
  error,
  onRetry,
  onSettings,
}: Props) {
  if (error) {
    return (
      <div className="config-banner is-error" role="status">
        <span className="config-banner-kicker">OFFLINE</span>
        <div className="banner-body">
          <p>
            <strong>无法连接 API 服务。</strong>
            {error}
          </p>
        </div>
        <button className="text-link banner-action" type="button" onClick={onRetry}>
          重试
        </button>
      </div>
    );
  }

  if (loading) return null;

  if (config.mode === "mock") {
    return (
      <div className="config-banner is-mock" role="status">
        <span className="config-banner-kicker">MOCK</span>
        <div className="banner-body">
          <p>
            <strong>当前是开发 Mock 模式。</strong>
            音频和转写均为本地示例，不会调用 MiMo。将{" "}
            <code>MOCK_MIMO</code> 设为 <code>0</code> 并重启后，即可使用设置中的
            Key。
          </p>
        </div>
      </div>
    );
  }

  if (config.mode === "unconfigured") {
    if (config.keyMode === "hybrid") {
      return (
        <div className="config-banner" role="status">
          <span className="config-banner-kicker">SETUP</span>
          <div className="banner-body">
            <p>
              <strong>还没有可用的 MiMo Key。</strong>
              打开设置填入你自己的 Key 即可开始使用。
            </p>
          </div>
          <button
            className="text-link banner-action"
            type="button"
            onClick={onSettings}
          >
            打开设置
          </button>
        </div>
      );
    }

    if (!config.keyEditable) {
      return (
        <div className="config-banner" role="status">
          <span className="config-banner-kicker">SETUP</span>
          <div className="banner-body">
            <p>
              <strong>站点还没有可用的 MiMo Key。</strong>
              完成服务端配置后刷新页面即可使用。
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="config-banner" role="status">
        <span className="config-banner-kicker">SETUP</span>
        <div className="banner-body">
          <p>
            <strong>还没有配置 MiMo API Key。</strong>
            打开设置填入你自己的 Key，保存后立即启用 TTS / ASR；也可以继续在服务端{" "}
            <code>.env</code> 中配置。
          </p>
        </div>
        <button
          className="text-link banner-action"
          type="button"
          onClick={onSettings}
        >
          打开设置
        </button>
      </div>
    );
  }

  return null;
}
