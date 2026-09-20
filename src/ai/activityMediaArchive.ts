import type { ActivityVisual, ActivityVisualRef } from "./activityVisual";

interface MediaRecord { id: string; at: number; visual: ActivityVisual; blob?: Blob; bytes: number }
const memory = new Map<string, MediaRecord>();
let database: Promise<IDBDatabase> | undefined;
let writing = Promise.resolve();
let prepare: ((id: string, visual: ActivityVisual) => void) | undefined;
let pruneTimer: ReturnType<typeof setTimeout> | undefined;
const MAX_BYTES = 64_000_000, TTL = 7 * 86400_000;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open("oprn-ai-activity-media", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("media", { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
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
  pruneTimer = setTimeout(() => { pruneTimer = undefined; prune(); }, 600);
  writing = writing.then(async () => {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("media", "readwrite"), store = tx.objectStore("media");
      store.put(record);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }).catch(() => { /* A missing archive image is explicitly shown by the view. */ });
}
function prune(): void {
  writing = writing.then(async () => {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("media", "readwrite"), store = tx.objectStore("media");
      const request = store.getAll();
      request.onsuccess = () => {
        let bytes = 0;
        (request.result as MediaRecord[]).sort((a, b) => b.at - a.at).forEach(item => {
          bytes += item.bytes;
          if (bytes > MAX_BYTES || Date.now() - item.at > TTL) { store.delete(item.id); memory.delete(item.id); }
        });
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
  if (pruneTimer !== undefined) { clearTimeout(pruneTimer); pruneTimer = undefined; prune(); }
  await writing;
}
