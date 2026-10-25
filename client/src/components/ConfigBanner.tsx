import type { AppConfig } from "../types";

type Props = {
  config: AppConfig;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onInfo: () => void;
};

export function ConfigBanner({ config, loading, error, onRetry, onInfo }: Props) {
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
            <code>MOCK_MIMO</code> 设为 <code>0</code> 并填入 Key 后重启即可使用真实接口。
          </p>
        </div>
      </div>
    );
  }

  if (config.mode === "unconfigured") {
    return (
      <div className="config-banner" role="status">
        <span className="config-banner-kicker">SETUP</span>
        <div className="banner-body">
          <p>
            <strong>服务端尚未配置 MIMO_API_KEY。</strong>在项目根目录创建{" "}
            <code>.env</code>，填入 <code>MIMO_API_KEY</code> 并重启服务即可启用
            TTS / ASR。
          </p>
        </div>
        <button className="text-link banner-action" type="button" onClick={onInfo}>
          查看说明
        </button>
      </div>
    );
  }

  return null;
}
