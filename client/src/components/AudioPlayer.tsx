import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Download, Pause, Play } from "lucide-react";
import type { PlayerState } from "../types";
import { downloadBlob, formatTime } from "../lib/format";
import { decodeWaveform } from "../lib/waveform";

const BAR_COUNT = 46;
const MIN_BAR_HEIGHT = 6;
const MAX_BAR_HEIGHT = 32;
const MOTION_RANGE = 9;

const FLAT_BARS = Array.from({ length: BAR_COUNT }, () => MIN_BAR_HEIGHT);

type Props = {
  player: PlayerState;
  active: boolean;
  onToast: (message: string) => void;
};

export function AudioPlayer({ player, active, onToast }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const graphRef = useRef<{ context: AudioContext; analyser: AnalyserNode } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(player.durationSec || 0);
  const [bars, setBars] = useState<number[]>(FLAT_BARS);

  const stopMotion = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    for (const bar of barRefs.current) {
      if (bar) bar.style.transform = "";
    }
  }, []);

  const startMotion = useCallback(() => {
    stopMotion();
    const graph = graphRef.current;
    const audio = audioRef.current;
    if (!graph || !audio) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const samples = new Uint8Array(graph.analyser.fftSize);
    let level = 0;

    const tick = () => {
      graph.analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const value = (samples[index] - 128) / 128;
        sum += value * value;
      }
      const target = Math.min(1, Math.sqrt(sum / samples.length) * 2.8);
      level += (target - level) * (target > level ? 0.5 : 0.12);

      const total = audio.duration;
      const head =
        Number.isFinite(total) && total > 0
          ? (audio.currentTime / total) * BAR_COUNT
          : 0;

      barRefs.current.forEach((bar, index) => {
        if (!bar) return;
        const distance = Math.abs(index - head);
        const weight = distance >= MOTION_RANGE ? 0 : 1 - distance / MOTION_RANGE;
        const scale = 1 + level * (0.08 + 0.5 * weight * weight);
        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      });

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [stopMotion]);

  const ensureGraph = useCallback(() => {
    const existing = graphRef.current;
    if (existing) {
      void existing.context.resume().catch(() => {});
      return;
    }
    const audio = audioRef.current;
    if (!audio || typeof AudioContext === "undefined") return;
    try {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(context.destination);
      graphRef.current = { context, analyser };
      void context.resume().catch(() => {});
    } catch {
      graphRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const peaks = await decodeWaveform(player.blob, BAR_COUNT);
        if (cancelled) return;
        setBars(
          peaks.map((peak) => {
            const shaped = peak ** 0.72;
            return Math.round((MIN_BAR_HEIGHT + shaped * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)) * 2) / 2;
          }),
        );
      } catch {
        if (!cancelled) setBars(FLAT_BARS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player.blob]);

  useEffect(() => {
    const audio = audioRef.current;
    setPlaying(false);
    setCurrent(0);
    setDuration(player.durationSec || 0);
    setBars(FLAT_BARS);
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

  useEffect(() => {
    if (!playing) {
      stopMotion();
      return;
    }
    startMotion();
    return stopMotion;
  }, [playing, startMotion, stopMotion]);

  useEffect(() => {
    return () => {
      stopMotion();
      const graph = graphRef.current;
      graphRef.current = null;
      audioRef.current?.pause();
      if (graph) void graph.context.close().catch(() => {});
    };
  }, [stopMotion]);

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
      ensureGraph();
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
        <div className={`wave${playing ? " is-live" : ""}`} aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={index}
              ref={(element) => {
                barRefs.current[index] = element;
              }}
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
