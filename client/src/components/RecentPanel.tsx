import { Trash2 } from "lucide-react";
import type { HistoryItem } from "../types";
import { formatCny, formatDate, formatTime } from "../lib/format";

type Props = {
  items: HistoryItem[];
  loading: boolean;
  onOpen: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onClear: () => void;
};

function metaFor(item: HistoryItem): string {
  const date = formatDate(item.createdAt);
  if (item.mode === "tts") {
    return `${date} · ${item.durationSec ? formatTime(item.durationSec) : "—"} · 免费`;
  }
  return `${date} · ${formatTime(item.durationSec ?? 0)} · ${formatCny(
    item.estimatedCostCny ?? 0,
  )}`;
}

export function RecentPanel({ items, loading, onOpen, onDelete, onClear }: Props) {
  return (
    <section className="recent" aria-labelledby="recentTitle">
      <div className="recent-head">
        <div>
          <h2 className="recent-heading" id="recentTitle">
            Recent / 最近
          </h2>
          <p className="ledger-sub recent-kicker">ONLY ON THIS DEVICE · 30 ENTRIES</p>
        </div>
        <div className="recent-actions">
          <span className="ledger-sub">{items.length} ENTRIES</span>
          <button
            className="link-btn"
            type="button"
            onClick={onClear}
            disabled={items.length === 0}
            style={{ opacity: items.length === 0 ? 0.4 : 1 }}
          >
            清空记录
          </button>
        </div>
      </div>
      <p className="recent-note">
        每次完成的转写与合成，会像纸条一样留在这里。刷新不丢，清理即走。
      </p>

      {loading ? (
        <p className="history-loading">正在读取本机记录…</p>
      ) : items.length === 0 ? (
        <div className="history-empty">
          还没有记录。完成一次转写或合成后，会在这里留下一行。
        </div>
      ) : (
        <ul className="ledger-list">
          {items.map((item, index) => (
            <li className="ledger-item" key={item.id}>
              <button
                className="ledger-row"
                type="button"
                onClick={() => onOpen(item)}
                aria-label={`打开记录：${item.text}`}
              >
                <span className="ledger-num">{String(index + 1).padStart(2, "0")}</span>
                <span className="ledger-type">
                  {item.mode.toUpperCase()}
                  {item.mock ? " · MOCK" : ""}
                </span>
                <span className="ledger-text">{item.text}</span>
                <span className="ledger-meta">{metaFor(item)}</span>
                <span className="ledger-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button
                className="ledger-delete"
                type="button"
                aria-label="删除这条记录"
                title="删除这条记录"
                onClick={() => onDelete(item)}
              >
                <Trash2 size={14} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
