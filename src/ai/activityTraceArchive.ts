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
const PRUNE_INTERVAL = 60_000;
const settledPhases = new Set(["완료", "적용됨", "버림", "중단", "실패", "검토 대기"]);
let lastPruned = 0;
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
        let remaining = batch.length;
        let prune = Date.now() - lastPruned >= PRUNE_INTERVAL;
        for (const trace of batch) {
          // Compare only this run, in a transaction shared with other tab writers.
          const request = store.get(trace.id);
          request.onsuccess = () => {
            const saved = request.result as ActivityTrace | undefined;
            if (!saved || saved.serial < trace.serial) {
              store.put(trace);
              prune ||= !saved || (settledPhases.has(trace.phase) && saved.phase !== trace.phase);
            }
            if (--remaining !== 0 || !prune) return;
            const all = store.getAll();
            all.onsuccess = () => {
              let bytes = 0;
              (all.result as ActivityTrace[]).sort((a, b) => b.updatedAt - a.updatedAt).forEach((trace, index) => {
                bytes += trace.bytes * 2;
                if (Date.now() - trace.updatedAt > TTL || index >= 20 || bytes > MAX_BYTES) store.delete(trace.id);
              });
            };
          };
        }
        tx.oncomplete = () => { if (prune) lastPruned = Date.now(); resolve(); }; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
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
