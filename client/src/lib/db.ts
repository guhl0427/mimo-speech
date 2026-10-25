import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { HistoryItem } from "../types";

const DB_NAME = "shengxi";
const DB_VERSION = 1;
const MAX_ITEMS = 30;
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;

interface ShengxiDB extends DBSchema {
  history: {
    key: string;
    value: HistoryItem;
    indexes: { "by-created": number };
  };
  audio: {
    key: string;
    value: Blob;
  };
}

let databasePromise: Promise<IDBPDatabase<ShengxiDB>> | null = null;

function database(): Promise<IDBPDatabase<ShengxiDB>> {
  if (!databasePromise) {
    databasePromise = openDB<ShengxiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("by-created", "createdAt");
        }
        if (!db.objectStoreNames.contains("audio")) {
          db.createObjectStore("audio");
        }
      },
    });
  }
  return databasePromise;
}

export async function listHistory(): Promise<HistoryItem[]> {
  const db = await database();
  const items = await db.getAll("history");
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function trimHistory(): Promise<void> {
  const db = await database();
  const items = await listHistory();

  const remove = new Set<HistoryItem>();
  items.slice(MAX_ITEMS).forEach((item) => remove.add(item));

  let audioBytes = items
    .slice(0, MAX_ITEMS)
    .reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);

  for (let index = Math.min(MAX_ITEMS, items.length) - 1; index >= 0; index -= 1) {
    if (audioBytes <= MAX_AUDIO_BYTES) break;
    const item = items[index];
    remove.add(item);
    audioBytes -= item.sizeBytes ?? 0;
  }

  if (!remove.size) return;

  const tx = db.transaction(["history", "audio"], "readwrite");
  const historyStore = tx.objectStore("history");
  const audioStore = tx.objectStore("audio");
  const requests: Array<Promise<unknown>> = [];
  for (const item of remove) {
    requests.push(historyStore.delete(item.id));
    if (item.audioKey) requests.push(audioStore.delete(item.audioKey));
  }
  await Promise.all(requests);
  await tx.done;
}

export async function saveHistoryItem(
  item: HistoryItem,
  audio?: Blob,
): Promise<void> {
  const db = await database();
  const tx = db.transaction(["history", "audio"], "readwrite");
  const requests: Array<Promise<unknown>> = [
    tx.objectStore("history").put(item),
  ];
  if (audio && item.audioKey) {
    requests.push(tx.objectStore("audio").put(audio, item.audioKey));
  }
  await Promise.all(requests);
  await tx.done;
  await trimHistory();
}

export async function getHistoryAudio(audioKey: string): Promise<Blob | undefined> {
  const db = await database();
  return db.get("audio", audioKey);
}

export async function deleteHistoryItem(item: HistoryItem): Promise<void> {
  const db = await database();
  const tx = db.transaction(["history", "audio"], "readwrite");
  const requests: Array<Promise<unknown>> = [
    tx.objectStore("history").delete(item.id),
  ];
  if (item.audioKey) {
    requests.push(tx.objectStore("audio").delete(item.audioKey));
  }
  await Promise.all(requests);
  await tx.done;
}

export async function clearHistoryItems(): Promise<void> {
  const db = await database();
  const tx = db.transaction(["history", "audio"], "readwrite");
  await Promise.all([
    tx.objectStore("history").clear(),
    tx.objectStore("audio").clear(),
  ]);
  await tx.done;
}
