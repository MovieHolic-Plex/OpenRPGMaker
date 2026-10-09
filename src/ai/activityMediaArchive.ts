import type { ActivityVisual, ActivityVisualRef } from "./activityVisual";

interface MediaRecord { id: string; at: number; visual: ActivityVisual; blob?: Blob; bytes: number }
const memory = new Map<string, MediaRecord>();
let database: Promise<IDBDatabase> | undefined;
let writing = Promise.resolve();
let prepare: ((id: string, visual: ActivityVisual) => void) | undefined;
let firstPruneScheduledAt: number | undefined;
let pruneTimer: ReturnType<typeof setTimeout> | undefined;
const MAX_BYTES = 64_000_000, TTL = 7 * 86400_000;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open("oprn-ai-activity-media", 2);
    request.onupgradeneeded = () => {
      const database = request.result, tx = request.transaction!;
      if (!database.objectStoreNames.contains("media")) database.createObjectStore("media", { keyPath: "id" });
      const metadata = database.createObjectStore("metadata", { keyPath: "id" });
      // Bytes are in the key: ordinary pruning uses openKeyCursor, never a Blob
      // or visual value. Existing v1 payloads are inspected only during upgrade.
      metadata.createIndex("newest", ["orderAt", "id", "bytes"]);
      const cursor = tx.objectStore("media").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const value = row.value as MediaRecord;
        metadata.put({ id: value.id, orderAt: -value.at, bytes: value.bytes });
        row.continue();
      };
    };
    request.onsuccess = () => {
      const connection = request.result;
      connection.onversionchange = () => { connection.close(); database = undefined; };
      resolve(connection);
    };
    request.onerror = () => reject(request.error);
  });
}
function remember(record: MediaRecord): void {
  memory.set(record.id, record);
  let bytes = [...memory.values()].reduce((total, value) => total + value.bytes, 0);
  for (const [id, value] of memory) {
    if (bytes <= 16_000_000 && memory.size <= 256) break;
    memory.delete(id); bytes -= value.bytes;
  }
}
function persist(record: MediaRecord): void {
  remember(record);
  if (pruneTimer !== undefined) clearTimeout(pruneTimer);
  firstPruneScheduledAt ??= Date.now();
  const delay = Math.max(0, Math.min(600, 5000 - (Date.now() - firstPruneScheduledAt)));
  pruneTimer = setTimeout(() => { pruneTimer = undefined; firstPruneScheduledAt = undefined; prune(); }, delay);
  writing = writing.then(async () => {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["media", "metadata"], "readwrite"), store = tx.objectStore("media");
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      try {
        store.put(record);
        tx.objectStore("metadata").put({ id: record.id, orderAt: -record.at, bytes: record.bytes });
      } catch (error) { tx.abort(); reject(error); }
    });
  }).catch(() => { /* A missing archive image is explicitly shown by the view. */ });
}
function prune(): void {
  writing = writing.then(async () => {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(["media", "metadata"], "readwrite");
      const store = tx.objectStore("media"), metadata = tx.objectStore("metadata");
      const request = metadata.index("newest").openKeyCursor();
      let bytes = 0;
      const cutoff = Date.now() - TTL;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const [orderAt, id, size] = cursor.key as [number, string, number];
        bytes += size;
        if (bytes > MAX_BYTES || -orderAt < cutoff) { store.delete(id); metadata.delete(id); memory.delete(id); }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }).catch(() => {});
}
export function setActivityMediaPreparer(callback: (id: string, visual: ActivityVisual) => void): void {
  prepare = callback;
  for (const record of memory.values()) if (!record.blob) callback(record.id, record.visual);
}
export function retainActivityVisuals(prefix: string, visuals: readonly ActivityVisual[]): ActivityVisualRef[] {
  return visuals.slice(0, 12).flatMap((visual, index) => {
    const id = `${prefix}:${index}`;
    const bytes = JSON.stringify(visual).length * 2;
    if (bytes > 2_100_000) return [];
    if (!memory.has(id)) {
      persist({ id, at: Date.now(), visual: structuredClone(visual), bytes });
      prepare?.(id, visual);
    }
    return [{ id, title: visual.title, phase: visual.phase, target: visual.target, kind: visual.kind }];
  });
}
export async function readActivityMedia(id: string): Promise<MediaRecord | undefined> {
  if (memory.has(id)) return memory.get(id);
  await writing;
  try {
    const database = await db();
    return await new Promise<MediaRecord | undefined>((resolve, reject) => {
      const request = database.transaction("media").objectStore("media").get(id);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  } catch { return undefined; }
}
export async function saveActivityMediaBlob(id: string, blob: Blob): Promise<void> {
  const record = await readActivityMedia(id);
  if (record && !record.blob) persist({ ...record, blob, bytes: record.bytes + blob.size });
}
export async function flushActivityMedia(): Promise<void> {
  if (pruneTimer !== undefined) { clearTimeout(pruneTimer); pruneTimer = undefined; firstPruneScheduledAt = undefined; prune(); }
  await writing;
}
