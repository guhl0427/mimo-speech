import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { Mic, Square, Upload } from "lucide-react";
import type {
  AppConfig,
  HistoryItem,
  PendingAudio,
  RecordingResult,
} from "../types";
import { ApiError, transcribeAudio } from "../lib/api";
import {
  downloadBlob,
  estimateCost,
  formatCny,
  formatTime,
  newId,
  readFileDuration,
} from "../lib/format";
import { useRecorder } from "../hooks/useRecorder";
import { BillingDialog } from "./Dialogs";

type Props = {
  config: AppConfig;
  active: boolean;
  historySeed: HistoryItem | null;
  onCompleted: (item: HistoryItem) => void;
  onToast: (message: string) => void;
};

type TranscriptResult = {
  durationSec: number;
  cost: number;
  mock: boolean;
};

function billingAckStored(): boolean {
  try {
    return localStorage.getItem("shengxi-billing-ack") === "1";
  } catch {
    return false;
  }
}

export function SttPanel({
  config,
  active,
  historySeed,
  onCompleted,
  onToast,
}: Props) {
  const maxMinutes = Math.round(config.limits.audioMaxDurationSec / 60);
  const canRun = config.mode !== "unconfigured";

  const [pending, setPending] = useState<PendingAudio | null>(null);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("zh");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingInfoOnly, setBillingInfoOnly] = useState(false);
  const [billingAck, setBillingAck] = useState(billingAckStored);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  const handleRecorded = useCallback(
    (recording: RecordingResult) => {
      const file = new File([recording.blob], recording.name, {
        type: recording.mime,
      });
      setPending({
        file,
        durationSec: recording.durationSec,
        source: "record",
      });
      setTranscript("");
      setResult(null);
      setError(null);
      onToast(`录音完成 · ${formatTime(recording.durationSec)}，确认费用后开始转写`);
    },
    [onToast],
  );

  const recorder = useRecorder({
    maxSec: config.limits.audioMaxDurationSec,
    onComplete: handleRecorded,
    onError: (message) => setError(message),
  });

  useEffect(() => {
    if (!active) {
      if (recorder.recording) recorder.stop();
      setBillingOpen(false);
    }
  }, [active, recorder.recording, recorder.stop]);

  useEffect(() => {
    if (!historySeed || historySeed.mode !== "stt") return;
    setPending(null);
    setTranscript(historySeed.text);
    setResult({
      durationSec: historySeed.durationSec ?? 0,
      cost: historySeed.estimatedCostCny ?? 0,
      mock: historySeed.mock ?? false,
    });
    setError(null);
    setBusy(false);
  }, [historySeed]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function handleFile(file: File) {
    if (recorder.recording || busy || !canRun) return;

    const isAudio =
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|m4a|webm|ogg|flac|mp4)$/i.test(file.name);
    if (!isAudio) {
      setError("请选择 mp3、wav、m4a、webm 等音频文件。");
      return;
    }
    if (file.size > config.limits.uploadMaxBytes) {
      setError("文件超过 25MB 上限，请压缩后再试。");
      return;
    }

    const duration = await readFileDuration(file);
    if (!duration) {
      setError("无法读取音频时长，请换一个文件或重新录制。");
      return;
    }
    if (duration > config.limits.audioMaxDurationSec + 1) {
      setError(`音频 ${formatTime(duration)}，超过单次 ${maxMinutes} 分钟上限。`);
      return;
    }

    setPending({ file, durationSec: duration, source: "upload" });
    setTranscript("");
    setResult(null);
    setError(null);
    onToast("音频已就绪 · 确认费用后开始转写");
  }

  function openBillingInfo() {
    if (!pending) return;
    setBillingInfoOnly(true);
    setBillingOpen(true);
  }

  function requestTranscription() {
    if (!pending) {
      onToast("先录音或选择一个音频文件");
      return;
    }
    if (!canRun) {
      setError("服务端尚未配置 MIMO_API_KEY，配置后即可转写。");
      return;
    }
    if (busy) return;
    if (!billingAck) {
      setBillingInfoOnly(false);
      setBillingOpen(true);
      return;
    }
    void runTranscription();
  }

  async function runTranscription() {
    if (!pending || busy) return;

    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await transcribeAudio({
        file: pending.file,
        language,
        durationSec: pending.durationSec,
        signal: controller.signal,
      });

      setTranscript(response.text);
      setResult({
        durationSec: response.durationSec,
        cost: response.estimatedCostCny,
        mock: response.mock,
      });

      const item: HistoryItem = {
        id: newId(),
        mode: "stt",
        text: response.text,
        provider: response.provider,
        durationSec: response.durationSec,
        estimatedCostCny: response.estimatedCostCny,
        mock: response.mock,
        createdAt: Date.now(),
      };
      onCompleted(item);
      onToast(response.mock ? "Mock 转写完成（未调用 MiMo）" : "转写完成");
      window.setTimeout(() => transcriptRef.current?.focus({ preventScroll: true }), 60);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        onToast("已取消转写");
      } else {
        setError(
          caught instanceof ApiError ? caught.message : "转写失败，请稍后重试。",
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function confirmBilling() {
    try {
      localStorage.setItem("shengxi-billing-ack", "1");
    } catch {
      // The current session can still proceed.
    }
    setBillingAck(true);
    setBillingOpen(false);
    void runTranscription();
  }

  function resetCurrent() {
    abortRef.current?.abort();
    setPending(null);
    setTranscript("");
    setResult(null);
    setError(null);
    setBusy(false);
  }

  async function copyTranscript() {
    if (!transcript) {
      onToast("还没有可复制的转写结果");
      return;
    }
    try {
      await navigator.clipboard.writeText(transcript);
      onToast("转写结果已复制");
    } catch {
      transcriptRef.current?.select();
      onToast("已选中文本，请按 Ctrl / Cmd + C 复制");
    }
  }

  function downloadTranscript() {
    if (!transcript) {
      onToast("还没有可下载的转写结果");
      return;
    }
    downloadBlob(
      new Blob([transcript], { type: "text/plain;charset=utf-8" }),
      `shengxi-transcript-${Date.now()}.txt`,
    );
    onToast("TXT 已开始下载");
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (recorder.recording || busy || !canRun) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const estimatedCost = pending
    ? estimateCost(pending.durationSec, config.stt.pricePerHourCny)
    : 0;
  const showingResult = Boolean(transcript);
  const displayCost = result?.cost ?? estimatedCost;
  const displayDuration = result?.durationSec ?? pending?.durationSec ?? 0;
  const recordTitle = recorder.recording
    ? "正在听。"
    : result
      ? "转写完成。"
      : pending
        ? "音频已就绪。"
        : "让声音落成文字。";
  const recordDesc = recorder.recording
    ? `再次按下停止。当前是真实录音，最长 ${maxMinutes} 分钟。`
    : result
      ? "结果已生成，可在下方编辑、复制或导出 TXT。若音频未保存，只能从本次结果中找回文本。"
      : pending
        ? "确认费用后开始转写。第一版单次最长 5 分钟，音频不会保存在服务端。"
        : `按下录音，或把一段音频拖进来。第一版单次最长 ${maxMinutes} 分钟，转写按 MiMo ASR ¥${config.stt.pricePerHourCny}/小时计费。`;
  const actionBlocked = !canRun || !pending || busy || recorder.recording;

  return (
    <article
      className="tool-panel"
      id="panel-stt"
      role="tabpanel"
      aria-labelledby="tab-stt"
      tabIndex={0}
      hidden={!active}
    >
      <header className="panel-head">
        <span className="panel-kicker">Transcribe / 转写台</span>
        <span className="panel-status">MiMo ASR · {maxMinutes} MIN</span>
      </header>

      <div className="panel-body">
        <div className="stt-plate">
          <button
            className={`record-btn${recorder.recording ? " is-recording" : ""}`}
            id="recordBtn"
            type="button"
            aria-pressed={recorder.recording}
            aria-label={recorder.recording ? "停止录音" : "开始录音"}
            onClick={() => {
              if (recorder.recording) recorder.stop();
              else void recorder.start();
            }}
            disabled={busy || !canRun}
            title={!canRun ? "需要先配置 MIMO_API_KEY" : undefined}
          >
            {recorder.recording ? (
              <Square size={20} fill="currentColor" aria-hidden="true" />
            ) : (
              <Mic size={25} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>

          <div className="record-copy">
            <p className="record-kicker">01 — 录音或上传</p>
            <h2 className="record-title">{recordTitle}</h2>
            <p className="record-desc">{recordDesc}</p>
            <p className="sr-only" id="recordStatus" aria-live="polite">
              {recorder.recording
                ? "开始录音。"
                : pending
                  ? `${pending.source === "record" ? "录音完成" : "音频已就绪"}，时长 ${formatTime(pending.durationSec)}。`
                  : ""}
            </p>
            <div className="record-meta">
              <span className="record-timer">{formatTime(recorder.seconds)}</span>
              <span className="live-wave" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => (
                  <span
                    key={index}
                    style={{ "--d": `${index * 0.08}s` } as CSSProperties}
                  />
                ))}
              </span>
              <span>mp3 · wav · m4a · webm</span>
              <span>≤ 25MB</span>
              <span>≤ {formatTime(config.limits.audioMaxDurationSec)}</span>
            </div>
          </div>
        </div>

        <button
          className={`drop-zone${dragging ? " is-dragging" : ""}${recorder.recording || busy || !canRun ? " is-disabled" : ""}`}
          type="button"
          aria-label="上传音频文件"
          disabled={recorder.recording || busy || !canRun}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!recorder.recording && !busy && canRun) setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="drop-left">
            <Upload size={19} strokeWidth={1.5} className="drop-icon" aria-hidden="true" />
            <span className="drop-copy">
              <strong>或拖入一个音频文件</strong>
              <small>文件只在本次处理中使用，不会留在服务器</small>
            </span>
          </span>
          <span className="drop-right">选择文件 →</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.mp4"
          aria-label="选择音频文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />

        <div className="stt-language">
          <label className="control-label" htmlFor="sttLanguage">
            Language / 识别语言
          </label>
          <div className="select-wrap">
            <select
              id="sttLanguage"
              value={language}
              disabled={busy || recorder.recording}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="auto">自动</option>
            </select>
          </div>
        </div>

        {pending && !recorder.recording ? (
          <div className="file-receipt is-visible" aria-live="polite">
            <div className="receipt-grid">
              <div className="receipt-name-cell">
                <div className="receipt-label">File / 文件</div>
                <div className="receipt-value" title={pending.file.name}>
                  {pending.file.name}
                </div>
              </div>
              <div>
                <div className="receipt-label">Length / 时长</div>
                <div className="receipt-value">{formatTime(displayDuration)}</div>
              </div>
              <div>
                <div className="receipt-label">Estimate / 预估</div>
                <div className="receipt-value cost">{formatCny(displayCost)}</div>
              </div>
            </div>
            <div className="receipt-actions">
              <div className="billing-copy">
                <p className="billing-note">
                  <strong>MiMo ASR 按 ¥{config.stt.pricePerHourCny}/小时计费。</strong>
                  金额为预估，实际以 MiMo 控制台账单为准；失败不会自动重试。
                </p>
                <button className="link-btn" type="button" onClick={openBillingInfo}>
                  计费说明
                </button>
              </div>
              <div className="action-buttons">
                {busy ? (
                  <button
                    className="link-btn"
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                  >
                    取消
                  </button>
                ) : null}
                <button
                  className="primary-btn"
                  id="sttStart"
                  type="button"
                  disabled={actionBlocked}
                  onClick={requestTranscription}
                  title={!canRun ? "需要先配置 MIMO_API_KEY" : undefined}
                >
                  <span className="btn-label">
                    {busy ? "正在转写" : showingResult ? "重新转写" : "开始转写"}
                  </span>
                  <span className="btn-cost">
                    {busy ? "请稍候…" : `约 ${formatCny(estimatedCost)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}

        <section
          className={`transcript${showingResult ? " is-visible" : ""}`}
          aria-labelledby="transcriptTitle"
        >
          <div className="transcript-head">
            <h3 className="transcript-title" id="transcriptTitle">
              转写结果
            </h3>
            <div className="transcript-actions">
              <button className="link-btn" type="button" onClick={copyTranscript}>
                复制
              </button>
              <button className="link-btn" type="button" onClick={downloadTranscript}>
                TXT
              </button>
              <button className="link-btn" type="button" onClick={resetCurrent}>
                清空
              </button>
            </div>
          </div>
          <label className="sr-only" htmlFor="transcriptText">
            可编辑的转写文本
          </label>
          <textarea
            id="transcriptText"
            ref={transcriptRef}
            spellCheck={false}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
          <div className="transcript-foot">
            <span>
              MiMo ASR · {formatTime(displayDuration)} · {formatCny(displayCost)}
              {result?.mock ? " · Mock 结果" : ""}
            </span>
            <span>转写结果需要人工核对</span>
          </div>
        </section>
      </div>

      <footer className="panel-foot">
        <span>音频不会保存在本站</span>
        <span>历史记录仅保存在这台浏览器</span>
      </footer>

      <BillingDialog
        open={billingOpen}
        cost={estimatedCost}
        mode={billingInfoOnly ? "info" : "confirm"}
        onCancel={() => setBillingOpen(false)}
        onConfirm={confirmBilling}
      />
    </article>
  );
}
