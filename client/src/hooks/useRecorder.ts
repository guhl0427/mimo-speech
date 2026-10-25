import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingResult } from "../types";

type Options = {
  maxSec: number;
  onComplete: (result: RecordingResult) => void;
  onError: (message: string) => void;
};

function microphoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "麦克风权限被拒绝，请在浏览器地址栏允许后重试，或改为上传音频。";
    }
    if (error.name === "NotFoundError") {
      return "没有找到麦克风设备，请检查系统设置。";
    }
    if (error.name === "NotReadableError") {
      return "麦克风被其他程序占用，请关闭后重试。";
    }
  }
  return "无法开始录音，请检查麦克风权限或改为上传音频。";
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useRecorder({ maxSec, onComplete, onError }: Options) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (recordingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onErrorRef.current("当前浏览器不支持录音，请改用上传音频。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      completedRef.current = false;
      recordingRef.current = true;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setRecording(true);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (completedRef.current) return;
        completedRef.current = true;
        recordingRef.current = false;
        clearTimers();
        const durationSec = Math.max(0.8, (Date.now() - startedAtRef.current) / 1000);
        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        const name = `recording-${Date.now()}.${finalMime.includes("mp4") ? "m4a" : "webm"}`;
        setRecording(false);
        setSeconds(durationSec);
        stopStream();
        if (!mountedRef.current) return;
        if (blob.size > 0) {
          onCompleteRef.current({
            blob,
            name,
            durationSec,
            mime: finalMime,
          });
        } else {
          onErrorRef.current("没有录到音频，请重试或改用上传。");
        }
      };

      recorder.start(1000);
      timerRef.current = window.setInterval(() => {
        if (!mountedRef.current) return;
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
      autoStopRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, maxSec * 1000);
    } catch (error) {
      recordingRef.current = false;
      setRecording(false);
      setSeconds(0);
      clearTimers();
      stopStream();
      onErrorRef.current(microphoneErrorMessage(error));
    }
  }, [clearTimers, maxSec, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingRef.current = false;
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Ignore teardown races.
        }
      }
      stopStream();
    };
  }, [clearTimers, stopStream]);

  return { recording, seconds, start, stop };
}
