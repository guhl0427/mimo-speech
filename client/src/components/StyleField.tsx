import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useAnchoredPopover } from "../hooks/useAnchoredPopover";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  inputId: string;
};

const PRESET_GROUPS = [
  {
    id: "general",
    label: "通用",
    presets: [
      "自然、亲切，像和朋友聊天",
      "温柔、稍慢，像深夜电台",
      "沉稳、清晰，像新闻播报",
      "平静、克制，像纪录片旁白",
      "轻快、有活力，像短视频口播",
    ],
  },
  {
    id: "emotion",
    label: "情绪",
    presets: [
      "兴奋、语速偏快，带一点笑意",
      "低落、语速慢，声音有点哑",
      "疲惫、轻声，像快要睡着",
      "紧张，句子之间有明显停顿",
      "严肃、压低声音，像在警告",
      "温柔鼓励，像在安慰一个小朋友",
    ],
  },
  {
    id: "character",
    label: "角色",
    presets: [
      "苍老的说书人，声音沙哑、节奏慢",
      "天真的小女孩，语调上扬",
      "冷峻的旁白，没有多余情绪",
      "热情的广告配音，重音明显",
      "耐心的老师，边讲边停顿",
    ],
  },
  {
    id: "scene",
    label: "场景",
    presets: [
      "深夜电台，近距离、气声多一点",
      "发布会开场，有仪式感、字正腔圆",
      "客服播报，礼貌、清楚、语速适中",
      "有声书旁白，平稳、留白多",
    ],
  },
  {
    id: "dialect",
    label: "方言",
    presets: [
      "带一点四川口音的普通话",
      "东北口音，豪爽、尾音上扬",
      "带粤语腔的普通话",
    ],
  },
  {
    id: "english",
    label: "英文",
    presets: [
      "warm and conversational, like talking to a friend",
      "calm and professional, clear news-anchor delivery",
      "bright and energetic, with a smile in the voice",
      "low and magnetic, slow movie-trailer pacing",
    ],
  },
];

export function StyleField({ value, onChange, maxLength, inputId }: Props) {
  const [activeGroup, setActiveGroup] = useState(PRESET_GROUPS[0].id);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    open,
    placement,
    anchorRef,
    triggerRef,
    popoverRef,
    openPopover,
    close,
  } = useAnchoredPopover<HTMLDivElement>(380);
  const baseId = useId();
  const popoverId = `${baseId}-style-popover`;

  const groups = PRESET_GROUPS.map((group) => ({
    ...group,
    presets: group.presets.filter((preset) => preset.length <= maxLength),
  })).filter((group) => group.presets.length > 0);
  const current = groups.find((group) => group.id === activeGroup) ?? groups[0];

  useLayoutEffect(() => {
    if (!open) return;
    popoverRef.current?.focus({ preventScroll: true });
  }, [open, popoverRef]);

  function closeAndEdit() {
    close();
    inputRef.current?.focus();
  }

  function selectPreset(preset: string) {
    onChange(preset);
    closeAndEdit();
  }

  function clearStyle() {
    onChange("");
    closeAndEdit();
  }

  function toggleOpen() {
    if (open) closeAndEdit();
    else openPopover();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openPopover();
    }
  }

  function onPopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndEdit();
    }
  }

  function onPopoverBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (
      next &&
      (popoverRef.current?.contains(next) || triggerRef.current?.contains(next))
    ) {
      return;
    }
    close();
  }

  return (
    <div className={`style-field${open ? " is-open" : ""}`} ref={anchorRef}>
      <input
        ref={inputRef}
        className="text-input style-input"
        id={inputId}
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="温柔、稍慢，像深夜电台"
        autoComplete="off"
      />
      <button
        ref={triggerRef}
        type="button"
        className="style-preset-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={open ? "关闭语气预设" : "打开语气预设"}
        title="语气预设"
        onClick={toggleOpen}
        onKeyDown={onTriggerKeyDown}
      >
        <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              className="style-popover"
              role="dialog"
              aria-label="语气预设"
              tabIndex={-1}
              style={{
                top: placement.top,
                bottom: placement.bottom,
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
              }}
              onKeyDown={onPopoverKeyDown}
              onBlur={onPopoverBlur}
            >
              <div className="style-popover-head">
                <span className="style-popover-title">
                  Style Presets / 语气预设
                </span>
                <span className="style-popover-hint">选择后仍可手动修改</span>
                {value ? (
                  <button
                    type="button"
                    className="link-btn style-clear-btn"
                    onClick={clearStyle}
                  >
                    清空
                  </button>
                ) : null}
              </div>

              <div
                className="style-preset-tabs style-popover-tabs"
                role="group"
                aria-label="语气分类"
              >
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className="style-preset-tab"
                    aria-pressed={group.id === current?.id}
                    onClick={() => setActiveGroup(group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              <div className="style-popover-list">
                {current?.presets.map((preset) => {
                  const selected = value === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`style-option${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => selectPreset(preset)}
                    >
                      <span className="style-option-text">{preset}</span>
                      {selected ? (
                        <Check
                          className="style-option-check"
                          size={14}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
