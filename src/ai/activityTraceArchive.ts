import type { ActivityTrace } from "./activityTrace";

// Separate from opt-in diagnostics and remote project/conversation persistence.
// Receipts stay on this device: seven days, twenty runs, ten MB (approx. UTF-16).
const TTL = 7 * 86400_000;
const MAX_BYTES = 10_000_000;
let database: Promise<IDBDatabase> | undefined;
const pending = new Map<string, ActivityTrace>();
let timer: ReturnType<typeof setTimeout> | undefined;
let writing = Promise.resolve();
const failed = new Set<string>();
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open("oprn-ai-execution-records", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("runs", { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export function activityArchiveFailed(id: string): boolean { return failed.has(id); }
export function retainActivityTrace(trace: ActivityTrace): void {
  if (!trace.projectId) return;
  const queued = pending.get(trace.id);
  if (queued && queued.serial >= trace.serial) return;
  pending.set(trace.id, trace);
  if (timer !== undefined) return;
  timer = setTimeout(() => { timer = undefined; void flushActivityArchive(); }, 600);
}
export async function flushActivityArchive(): Promise<void> {
  if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
  const batch = [...pending.values()]; pending.clear();
  writing = writing.then(async () => {
    if (!batch.length) return;
    try {
      const database = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction("runs", "readwrite");
        const store = tx.objectStore("runs");
        const all = store.getAll();
        all.onsuccess = () => {
          // Detached/older views can render again when preferences change. Never let
          // their snapshot overwrite a newer receipt or a settled run phase.
          const traces = new Map((all.result as ActivityTrace[]).map(trace => [trace.id, trace]));
          for (const trace of batch) {
            const saved = traces.get(trace.id);
            if (saved && saved.serial >= trace.serial) continue;
            traces.set(trace.id, trace);
            store.put(trace);
          }
          let bytes = 0;
          [...traces.values()].sort((a, b) => b.updatedAt - a.updatedAt).forEach((trace, index) => {
            bytes += trace.bytes * 2;
            if (Date.now() - trace.updatedAt > TTL || index >= 20 || bytes > MAX_BYTES) store.delete(trace.id);
          });
        };
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
      for (const trace of batch) failed.delete(trace.id);
    } catch { for (const trace of batch) failed.add(trace.id); }
  });
  await writing;
}
export async function readActivityArchive(projectId: string): Promise<ActivityTrace[]> {
  await flushActivityArchive();
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("runs", "readwrite");
    const store = tx.objectStore("runs");
    const request = store.getAll();
    let results: ActivityTrace[] = [];
    request.onsuccess = () => {
      results = (request.result as ActivityTrace[]).filter(trace => {
        if (Date.now() - trace.updatedAt > TTL) { store.delete(trace.id); return false; }
        return trace.version === 1 && trace.projectId === projectId && Array.isArray(trace.entries);
      }).sort((a, b) => b.updatedAt - a.updatedAt);
    };
    tx.oncomplete = () => resolve(results); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}

// Flush pending receipts when navigation hides the editor; an interrupted write is best-effort.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { void flushActivityArchive(); });
