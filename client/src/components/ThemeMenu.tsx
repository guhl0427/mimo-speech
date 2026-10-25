import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useAnchoredPopover } from "../hooks/useAnchoredPopover";
import { useTheme, type ResolvedTheme, type ThemeMode } from "../hooks/useTheme";

const OPTIONS = [
  { value: "system", label: "跟随系统", Icon: Monitor },
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
] as const satisfies ReadonlyArray<{
  value: ThemeMode;
  label: string;
  Icon: typeof Sun;
}>;

function themeName(theme: ResolvedTheme): string {
  return theme === "dark" ? "深色" : "浅色";
}

function modeName(mode: ThemeMode, theme: ResolvedTheme): string {
  return mode === "system" ? `跟随系统（${themeName(theme)}）` : themeName(mode);
}

export function ThemeMenu() {
  const { mode, theme, system, setMode } = useTheme();
  const pressedWhileOpen = useRef(false);
  const {
    open,
    placement,
    anchorRef,
    triggerRef,
    popoverRef,
    openPopover,
    close,
  } = useAnchoredPopover<HTMLDivElement>(232, "end");
  const baseId = useId();
  const popoverId = `${baseId}-theme-popover`;
  const TriggerIcon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;
  const label = `主题：${modeName(mode, theme)}`;

  useLayoutEffect(() => {
    if (!open) return;
    popoverRef.current?.focus({ preventScroll: true });
  }, [open, popoverRef]);

  function closeAndFocus() {
    close();
    triggerRef.current?.focus();
  }

  function toggleOpen() {
    if (open || pressedWhileOpen.current) closeAndFocus();
    else openPopover();
    pressedWhileOpen.current = false;
  }

  function selectMode(next: ThemeMode) {
    setMode(next);
    closeAndFocus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openPopover();
    }
  }

  function onPopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeAndFocus();
    }
  }

  return (
    <div className="theme-menu" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="theme-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={label}
        title={label}
        onPointerDown={() => {
          pressedWhileOpen.current = open;
        }}
        onClick={toggleOpen}
        onKeyDown={onTriggerKeyDown}
      >
        <TriggerIcon size={17} strokeWidth={1.7} aria-hidden="true" />
      </button>

      {open && placement
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              className="theme-popover"
              role="dialog"
              aria-label="外观"
              tabIndex={-1}
              style={{
                top: placement.top,
                bottom: placement.bottom,
                left: placement.left,
                width: placement.width,
                maxHeight: placement.maxHeight,
              }}
              onKeyDown={onPopoverKeyDown}
            >
              <p className="theme-popover-title">Appearance / 外观</p>
              <div className="theme-options">
                {OPTIONS.map(({ value, label: optionLabel, Icon }) => {
                  const selected = mode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className="theme-option"
                      aria-pressed={selected}
                      onClick={() => selectMode(value)}
                    >
                      <Icon
                        className="theme-option-icon"
                        size={16}
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                      <span className="theme-option-copy">
                        <span className="theme-option-label">{optionLabel}</span>
                        {value === "system" ? (
                          <span className="theme-option-meta">
                            当前系统为{themeName(system)}
                          </span>
                        ) : null}
                      </span>
                      {selected ? (
                        <Check
                          className="theme-option-check"
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
