import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { Voice } from "../types";
import { useAnchoredPopover } from "../hooks/useAnchoredPopover";

type Props = {
  voices: Voice[];
  value: string;
  onChange: (id: string) => void;
  labelledBy: string;
};

const GROUP_ORDER = [
  { id: "auto", label: "默认" },
  { id: "zh", label: "中文音色" },
  { id: "en", label: "英文音色" },
];

function splitLabel(label: string): { name: string; meta: string } {
  const [name, ...rest] = label.split(" · ");
  return { name, meta: rest.join(" · ") };
}

function badgeFor(language: string): string {
  if (language === "en") return "EN";
  if (language === "zh") return "中";
  return "AUTO";
}

function shortMeta(meta: string): string {
  return meta.replace(/^(中文|英文)/, "");
}

export function VoiceSelect({ voices, value, onChange, labelledBy }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const {
    open,
    placement,
    anchorRef,
    triggerRef,
    popoverRef,
    openPopover,
    close,
  } = useAnchoredPopover<HTMLDivElement>(320);
  const baseId = useId();
  const listId = `${baseId}-listbox`;

  const groups = GROUP_ORDER.map((group) => ({
    ...group,
    voices: voices.filter((voice) => voice.language === group.id),
  })).filter((group) => group.voices.length > 0);
  const flat = groups.flatMap((group) => group.voices);
  const selected = voices.find((voice) => voice.id === value) ?? voices[0];
  const selectedIndex = Math.max(
    0,
    flat.findIndex((voice) => voice.id === selected?.id),
  );

  function closeAndFocus() {
    close();
    triggerRef.current?.focus();
  }

  function handleOpen() {
    setActiveIndex(selectedIndex);
    openPopover();
  }

  function choose(voice: Voice) {
    onChange(voice.id);
    closeAndFocus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const box = popoverRef.current;
    const option = optionRefs.current[activeIndex];
    if (!box || !option) return;

    const boxRect = box.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < boxRect.top + 8) {
      box.scrollTop -= boxRect.top + 8 - optionRect.top;
    } else if (optionRect.bottom > boxRect.bottom - 8) {
      box.scrollTop += optionRect.bottom - (boxRect.bottom - 8);
    }
  }, [open, activeIndex, popoverRef]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      handleOpen();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(flat.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const voice = flat[activeIndex];
      if (voice) choose(voice);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocus();
    } else if (event.key === "Tab") {
      event.preventDefault();
      closeAndFocus();
    }
  }

  const selectedParts = selected
    ? splitLabel(selected.label)
    : { name: "", meta: "" };
  const selectedMeta = shortMeta(selectedParts.meta);
  const activeId =
    open && flat[activeIndex] ? `${baseId}-option-${activeIndex}` : undefined;

  return (
    <div className="voice-select" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="voice-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelledBy} ${baseId}-value`}
        onClick={() => (open ? closeAndFocus() : handleOpen())}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          className="voice-badge"
          data-lang={selected?.language ?? "auto"}
          aria-hidden="true"
        >
          {badgeFor(selected?.language ?? "auto")}
        </span>
        <span className="voice-trigger-name" aria-hidden="true">
          {selectedParts.name}
        </span>
        {selectedMeta ? (
          <span className="voice-trigger-meta" aria-hidden="true">
            {selectedMeta}
          </span>
        ) : null}
        <ChevronDown
          className="voice-chevron"
          size={16}
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <span id={`${baseId}-value`} className="sr-only">
          {selected?.label ?? ""}
        </span>
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={popoverRef}
              className="voice-popover"
              style={{
                top: placement.top,
                bottom: placement.bottom,
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
              }}
            >
              <div
                ref={listRef}
                id={listId}
                className="voice-listbox"
                role="listbox"
                aria-labelledby={labelledBy}
                aria-activedescendant={activeId}
                tabIndex={-1}
                onKeyDown={onListKeyDown}
              >
                {groups.map((group) => {
                  const groupId = `${baseId}-group-${group.id}`;
                  return (
                    <div
                      key={group.id}
                      className="voice-group"
                      role="group"
                      aria-labelledby={groupId}
                    >
                      <div id={groupId} className="voice-group-label">
                        {group.label}
                      </div>
                      <div className="voice-options">
                        {group.voices.map((voice) => {
                          const index = flat.indexOf(voice);
                          const parts = splitLabel(voice.label);
                          const isSelected = voice.id === selected?.id;
                          return (
                            <div
                              key={voice.id}
                              id={`${baseId}-option-${index}`}
                              ref={(node) => {
                                optionRefs.current[index] = node;
                              }}
                              role="option"
                              aria-selected={isSelected}
                              className={[
                                "voice-option",
                                group.voices.length === 1 ? "is-wide" : "",
                                activeIndex === index ? "is-active" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onPointerEnter={() => setActiveIndex(index)}
                              onClick={() => choose(voice)}
                            >
                              <span
                                className="voice-option-badge"
                                data-lang={voice.language}
                                aria-hidden="true"
                              >
                                {badgeFor(voice.language)}
                              </span>
                              <span className="voice-option-copy">
                                <span className="voice-option-name">
                                  {parts.name}
                                </span>
                                <span className="voice-option-meta">
                                  {parts.meta}
                                </span>
                              </span>
                              {isSelected ? (
                                <Check
                                  className="voice-option-check"
                                  size={14}
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
