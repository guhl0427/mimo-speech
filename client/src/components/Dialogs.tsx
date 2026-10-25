import { useEffect, useRef, useState } from "react";
import type { AppConfig } from "../types";
import { formatCny } from "../lib/format";

type BillingDialogProps = {
  open: boolean;
  cost: number;
  mode: "confirm" | "info";
  onCancel: () => void;
  onConfirm: () => void;
};

export function BillingDialog({
  open,
  cost,
  mode,
  onCancel,
  onConfirm,
}: BillingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setConsent(false);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="billingTitle"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel();
      }}
    >
      <div className="dialog-body">
        <p className="dialog-eyebrow">MiMo ASR / 计费确认</p>
        <h2 className="dialog-title" id="billingTitle">
          转写会按音频时长计费。
        </h2>
        <p className="dialog-text">
          MiMo ASR 当前价格为 ¥0.5/小时。第一版单次音频最长 5 分钟；失败不会自动重试，也不会有隐藏扣费。
        </p>
        <div className="cost-box">
          <span>本次预计</span>
          <strong>{formatCny(cost)}</strong>
        </div>
        {mode === "confirm" ? (
          <>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>我已知晓计费，并确认开始转写。此确认只保存在本机。</span>
            </label>
            <div className="dialog-actions">
              <button className="secondary-btn" type="button" onClick={onCancel}>
                取消
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={!consent}
                onClick={onConfirm}
              >
                确认并转写 →
              </button>
            </div>
          </>
        ) : (
          <div className="dialog-actions" style={{ marginTop: 22 }}>
            <button className="secondary-btn" type="button" onClick={onCancel}>
              知道了
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

type InfoDialogProps = {
  open: boolean;
  config: AppConfig;
  configError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onSettings: () => void;
};

export function InfoDialog({
  open,
  config,
  configError,
  onClose,
  onRetry,
  onSettings,
}: InfoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="infoTitle"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog-body">
        <p className="dialog-eyebrow">About / 说明</p>
        <h2 className="dialog-title" id="infoTitle">
          你的声音，只走必要的路。
        </h2>
        <p className="dialog-text">
          {config.keyMode === "hybrid"
            ? "使用个人 Key 时，文字会直接从这台浏览器发送给 MiMo，不经过本站服务器；未填写个人 Key 时，文字会经站点服务端使用默认 Key 转发给 MiMo。服务端不保存这些内容，历史记录只存在这台浏览器里。"
            : config.features.stt
              ? "文字转语音时，文本会经本站服务端发送给 MiMo；语音转文字时，音频会先在服务端转为 MP3，再发送给 MiMo ASR。服务端不保存这些内容，历史记录只存在这台浏览器里。"
              : "文字转语音时，文本会经本站服务端发送给 MiMo；服务端不保存这些内容，历史记录只存在这台浏览器里。"}
        </p>
        <p className="dialog-text" style={{ marginTop: 12 }}>
          {config.keyMode === "hybrid" ? (
            "个人 Key 只保存在此浏览器的 localStorage，用于直连 MiMo；站点默认 Key 保存在服务端，不会回显到浏览器或写入日志。"
          ) : config.keyEditable ? (
            <>
              设置中保存的 Key 仅写入服务端 <code>data/settings.json</code>
              ，不会回显到浏览器或写入日志。
            </>
          ) : (
            "站点使用的 MiMo Key 保存在服务端，不会回显到浏览器或写入日志。"
          )}
        </p>
        <p className="dialog-text" style={{ marginTop: 12 }}>
          {config.features.stt
            ? "第一版尚未提供 SRT / 实时识别；转写结果需要人工核对。请勿上传敏感或机密音频。"
            : "请勿输入敏感或机密内容。"}
        </p>

        <div className="cost-box" style={{ marginTop: 18 }}>
          <span>当前状态</span>
          <strong style={{ fontSize: 15 }}>
            {configError
              ? "API 未连接"
              : config.mode === "live"
                ? "MIMO READY"
                : config.mode === "mock"
                  ? "MOCK 模式"
                  : "未配置 KEY"}
          </strong>
        </div>

        {config.mode === "unconfigured" ? (
          <p className="dialog-text">
            {config.keyMode === "hybrid" ? (
              "打开右上角「设置」填入你自己的 MiMo Key，保存后即可使用。"
            ) : config.keyEditable ? (
              <>
                打开右上角「设置」填入你自己的 MiMo API Key，保存后立即生效；也可以在项目根目录的{" "}
                <code>.env</code> 中配置 <code>MIMO_API_KEY</code> 后重启服务。设置中的个人
                Key 优先生效。
              </>
            ) : (
              "站点尚未配置 MiMo Key。请联系站点管理员完成服务端配置后刷新页面。"
            )}
          </p>
        ) : null}
        {config.mode === "mock" ? (
          <p className="dialog-text">
            当前由 <code>MOCK_MIMO=1</code> 提供本地示例。可在设置中先保存 Key；关闭
            Mock 并重启后才会调用真实接口。
          </p>
        ) : null}
        {configError ? (
          <p className="dialog-text">
            无法连接 API 服务：{configError}
          </p>
        ) : null}

        <div className="dialog-actions" style={{ marginTop: 22 }}>
          {configError ? (
            <button className="secondary-btn" type="button" onClick={onRetry}>
              重试连接
            </button>
          ) : null}
          <button className="secondary-btn" type="button" onClick={onSettings}>
            打开设置
          </button>
          <button className="secondary-btn" type="button" onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </dialog>
  );
}
