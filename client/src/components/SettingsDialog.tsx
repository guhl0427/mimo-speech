import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import type { AppConfig } from "../types";
import { clearMimoKey, saveMimoKey, testMimoKey } from "../lib/api";
import {
  clearBrowserKey,
  getBrowserKey,
  saveBrowserKey,
} from "../lib/browserKey";

type Props = {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onToast: (message: string) => void;
};

type VerifyState = {
  tone: "ok" | "error";
  text: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "操作失败，请稍后重试。";
}

export function SettingsDialog({
  open,
  config,
  onClose,
  onChanged,
  onToast,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyState | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setReveal(false);
    setSaving(false);
    setTesting(false);
    setClearing(false);
    setConfirmClear(false);
    setError(null);
    setVerify(null);
  }, [open]);

  const busy = saving || clearing;
  const browserMode = config.keyMode === "hybrid";
  const browserKeyActive = config.keySource === "browser";
  const configured = config.keySource !== "none";

  const sourceLabel = browserKeyActive
    ? "个人 Key（浏览器）"
    : config.keySource === "server"
      ? "站点默认 Key（兜底）"
      : config.keySource === "settings"
        ? "个人 Key"
        : config.keySource === "env"
          ? "服务端 .env"
          : "尚未配置";

  const sourceDetail = browserKeyActive
    ? config.keyHint
      ? `尾号 ${config.keyHint} · 只保存在此浏览器`
      : "只保存在此浏览器"
    : config.keySource === "server"
      ? "由站点服务端提供，不回显 Key"
      : config.keySource === "none"
        ? browserMode
          ? "填入个人 Key 后即可使用"
          : "填入 Key 后立即启用 TTS / ASR"
        : config.keyHint
          ? `尾号 ${config.keyHint} · 不回显完整 Key`
          : "已配置";

  async function runTest(saved: boolean) {
    setTesting(true);
    setVerify(null);
    const usingBrowserKey = browserMode && Boolean(getBrowserKey());
    const sourceName = browserMode
      ? usingBrowserKey
        ? "个人 Key"
        : "站点默认 Key"
      : "当前 Key";

    try {
      const result = await testMimoKey();
      setVerify({
        tone: "ok",
        text: `${saved ? "新 Key 已生效，" : ""}${sourceName}连接正常（${result.latencyMs}ms）。`,
      });
    } catch (testError) {
      const message = errorMessage(testError);
      setVerify({
        tone: "error",
        text: saved
          ? `Key 已保存，但验证未通过：${message}`
          : `验证未通过：${message}`,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    const apiKey = draft.trim();
    if (apiKey.length < 8) {
      setError("请粘贴完整的 MiMo API Key（至少 8 位）。");
      inputRef.current?.focus();
      return;
    }
    if (apiKey.length > 512 || !/^[\x21-\x7e]+$/.test(apiKey)) {
      setError("Key 只能包含可见字符，且不能超过 512 位。");
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    setVerify(null);
    setConfirmClear(false);
    try {
      if (browserMode) {
        saveBrowserKey(apiKey);
        setDraft("");
        setReveal(false);
        await onChanged();
        onToast("个人 Key 已保存到此浏览器");
        await runTest(true);
      } else {
        await saveMimoKey(apiKey);
        setDraft("");
        setReveal(false);
        await onChanged();
        onToast("个人 API Key 已保存");
        await runTest(true);
      }
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setError(null);
    setVerify(null);
    try {
      if (browserMode) {
        clearBrowserKey();
        setConfirmClear(false);
        await onChanged();
        onToast(
          config.serverKeyConfigured
            ? "个人 Key 已清除，改用站点默认 Key"
            : "个人 Key 已清除",
        );
      } else {
        await clearMimoKey();
        setConfirmClear(false);
        await onChanged();
        onToast(
          config.envConfigured
            ? "个人 Key 已清除，已回退到服务端 .env"
            : "个人 Key 已清除",
        );
      }
    } catch (clearError) {
      setError(errorMessage(clearError));
    } finally {
      setClearing(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settingsTitle"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog-body settings-body">
        <div className="settings-head">
          <p className="dialog-eyebrow">Settings / 接口设置</p>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <h2 className="dialog-title" id="settingsTitle">
          {browserMode ? "连接 MiMo。" : "连接你自己的 MiMo。"}
        </h2>
        <p className="dialog-text">
          {browserMode
            ? "填入你自己的 Key 直连 MiMo；不填则使用站点默认 Key。个人 Key 只保存在此浏览器。"
            : "填入 MiMo 开放平台创建的 API Key，保存后立即生效，无需重启。Key 只保存在这台服务器上，不会回传给浏览器。"}
        </p>

        <div className="settings-status">
          <span
            className={`settings-status-dot ${configured ? "is-live" : ""}`}
            aria-hidden="true"
          />
          <div className="settings-status-copy">
            <span className="settings-status-label">当前 Key</span>
            <strong>{sourceLabel}</strong>
            <span className="settings-status-meta">{sourceDetail}</span>
          </div>
          {configured ? (
            <button
              className="secondary-btn settings-test-btn"
              type="button"
              disabled={testing || busy}
              onClick={() => void runTest(false)}
            >
              {testing ? "验证中…" : "验证连接"}
            </button>
          ) : null}
        </div>

        {config.mode === "mock" ? (
          <p className="settings-note">
            当前服务端启用了 <code>MOCK_MIMO=1</code>：Key
            可以保存，但关闭 Mock 并重启后才会真正调用 MiMo。
          </p>
        ) : null}

        {config.keyEditable ? (
          <form
            className="settings-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <label className="field-label" htmlFor="mimoKeyInput">
              <span>新的 API Key</span>
              <span className="field-hint">
                {browserMode
                  ? browserKeyActive
                    ? "输入新 Key 可替换"
                    : config.serverKeyConfigured
                      ? "留空则继续使用站点默认 Key"
                      : "sk-… 或 tp-…"
                  : config.keySource === "settings"
                    ? "输入新 Key 可替换"
                    : "sk-… 或 tp-…"}
              </span>
            </label>
            <div className="secret-field">
              <input
                ref={inputRef}
                id="mimoKeyInput"
                className="text-input secret-input"
                type={reveal ? "text" : "password"}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                  setVerify(null);
                }}
                placeholder="粘贴 API Key，保存后不回显"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby="mimoKeyHelp"
              />
              <button
                className="secret-toggle"
                type="button"
                onClick={() => setReveal((current) => !current)}
                aria-label={reveal ? "隐藏 API Key" : "显示 API Key"}
                aria-pressed={reveal}
                disabled={busy}
              >
                {reveal ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="settings-form-foot">
              <p className="settings-privacy" id="mimoKeyHelp">
                {browserMode ? (
                  <>
                    个人 Key 只写入这台浏览器的 <code>localStorage</code>
                    ，用于直连 MiMo，不经过站点服务器。
                  </>
                ) : (
                  <>
                    Key 写入服务端 <code>data/settings.json</code>
                    ，不会写入日志；个人 Key 优先于 <code>.env</code>。
                  </>
                )}
              </p>
              <button
                className="primary-btn"
                type="submit"
                disabled={busy || testing || draft.trim().length < 8}
              >
                {saving ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    保存并验证中…
                  </>
                ) : (
                  <>
                    保存并验证 <span className="btn-arrow">→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className="inline-error settings-error" role="alert">
            {error}
          </p>
        ) : null}

        {verify ? (
          <p
            className={`settings-verify ${verify.tone === "ok" ? "is-ok" : "is-error"}`}
            role="status"
          >
            {verify.tone === "ok" ? <Check size={15} aria-hidden="true" /> : null}
            <span>{verify.text}</span>
          </p>
        ) : null}

        <div className="settings-extra">
          {browserMode ? (
            <>
              还没有个人 Key？可以留空使用站点默认 Key（如有），或到{" "}
              <a
                href="https://platform.xiaomimimo.com/"
                target="_blank"
                rel="noreferrer"
              >
                MiMo 开放平台
              </a>{" "}
              创建。
            </>
          ) : (
            <>
              还没有 Key？在{" "}
              <a
                href="https://platform.xiaomimimo.com/"
                target="_blank"
                rel="noreferrer"
              >
                MiMo 开放平台
              </a>{" "}
              创建个人 API Key。
            </>
          )}
        </div>

        <div className="settings-foot">
          {browserMode ? (
            browserKeyActive ? (
              confirmClear ? (
                <div
                  className="settings-clear-confirm"
                  role="group"
                  aria-label="确认清除个人 Key"
                >
                  <span>清除后改用站点默认 Key（如有）。</span>
                  <button
                    className="link-btn"
                    type="button"
                    disabled={clearing}
                    onClick={() => setConfirmClear(false)}
                  >
                    取消
                  </button>
                  <button
                    className="link-btn is-danger"
                    type="button"
                    disabled={clearing}
                    onClick={() => void handleClear()}
                  >
                    {clearing ? "清除中…" : "确认清除"}
                  </button>
                </div>
              ) : (
                <button
                  className="link-btn is-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClear(true)}
                >
                  清除个人 Key
                </button>
              )
            ) : (
              <span className="settings-foot-note">
                {config.serverKeyConfigured
                  ? "当前使用站点默认 Key；填入个人 Key 后优先使用。"
                  : "保存后立即启用真实接口。"}
              </span>
            )
          ) : config.keySource === "settings" ? (
            confirmClear ? (
              <div
                className="settings-clear-confirm"
                role="group"
                aria-label="确认清除个人 Key"
              >
                <span>清除后改用服务端 .env 中的 Key（如有）。</span>
                <button
                  className="link-btn"
                  type="button"
                  disabled={clearing}
                  onClick={() => setConfirmClear(false)}
                >
                  取消
                </button>
                <button
                  className="link-btn is-danger"
                  type="button"
                  disabled={clearing}
                  onClick={() => void handleClear()}
                >
                  {clearing ? "清除中…" : "确认清除"}
                </button>
              </div>
            ) : (
              <button
                className="link-btn is-danger"
                type="button"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
              >
                清除个人 Key
              </button>
            )
          ) : (
            <span className="settings-foot-note">
              {config.envConfigured
                ? "也可以继续使用服务端 .env 中的 Key。"
                : "保存后立即启用真实接口。"}
            </span>
          )}
          <button className="secondary-btn" type="button" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </dialog>
  );
}
