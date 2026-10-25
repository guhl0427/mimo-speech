import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Download, Pause, Play } from "lucide-react";
import type { PlayerState } from "../types";
import { downloadBlob, formatTime } from "../lib/format";

type Props = {
  player: PlayerState;
  active: boolean;
  onToast: (message: string) => void;
};

export function AudioPlayer({ player, active, onToast }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(player.durationSec || 0);

  const bars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, index) => {
        const height =
          6 + Math.abs(Math.sin(index * 0.54)) * 24 + (index % 7 === 0 ? 7 : 0);
        return Math.min(38, height);
      }),
    [],
  );

  useEffect(() => {
    const audio = audioRef.current;
    setPlaying(false);
    setCurrent(0);
    setDuration(player.durationSec || 0);
    if (audio) {
      audio.pause();
      audio.load();
    }
  }, [player.url, player.durationSec]);

  useEffect(() => {
    if (!active) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [active]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (
        audio.ended ||
        (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.05)
      ) {
        audio.currentTime = 0;
      }
      try {
        await audio.play();
      } catch {
        onToast("无法播放这段音频，请下载后试听。");
      }
    } else {
      audio.pause();
    }
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <section className="player is-visible" id="player" aria-label="MiMo 音频播放器">
      <div className="player-top">
        <span className="player-title">{player.title || "MiMo 语音"}</span>
        <span className="player-badge">{player.mock ? "MOCK AUDIO" : "MIMO AUDIO"}</span>
      </div>
      <div className="player-body">
        <button
          className="play-btn"
          type="button"
          onClick={toggle}
          aria-label={playing ? "暂停音频" : "播放音频"}
        >
          {playing ? (
            <Pause size={18} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={18} fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <div className="wave" aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={index}
              style={{ "--h": `${height}px` } as CSSProperties}
              className={index / bars.length < progress ? "is-played" : ""}
            />
          ))}
        </div>
        <span className="player-time">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <button
          className="icon-btn"
          type="button"
          aria-label="下载音频"
          title="下载音频"
          onClick={() => {
            downloadBlob(player.blob, player.downloadName);
            onToast("音频已开始下载");
          }}
        >
          <Download size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="player-foot">
        {player.mock
          ? "开发 Mock 音频 · 未调用 MiMo · 仅供界面联调"
          : "由 MiMo TTS 提供 · 当前限时免费 · 以官方计费为准"}
      </div>
      <audio
        ref={audioRef}
        src={player.url}
        preload="metadata"
        hidden
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(audioRef.current?.duration ?? duration);
        }}
        onError={() => onToast("音频加载失败，请重新生成或下载历史音频。")}
      />
    </section>
  );
}
