import type { AppConfig } from "../types";

type Props = {
  config: AppConfig;
};

export function Intro({ config }: Props) {
  const minutes = Math.round(config.limits.audioMaxDurationSec / 60);

  return (
    <section className="intro" aria-labelledby="pageTitle">
      <span className="ghost" aria-hidden="true">
        声
      </span>
      <p className="eyebrow">Private voice desk · 2026</p>

      <h1 id="pageTitle">
        把声音留成文字，
        <br />
        <em>也让文字</em>重新发声。
      </h1>

      <div className="intro-body">
        <div className="intro-copy">
          <p className="lede">
            一个只服务 MiMo 的私人语音工作台。转录按量计费，合成限时免费；所有历史留在本机。
          </p>
          <p className="intro-foot">
            <strong>声音是第二种笔迹。</strong>这里不保存你的音频，只留下你愿意留下的文字。
          </p>
        </div>

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
      </div>
    </section>
  );
}
