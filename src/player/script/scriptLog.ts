// player/script/scriptLog.ts — ring buffer of script log lines and errors (developer-facing, never saved).
//
// `game.log` / `console.log` inside scripts and every script error land here and in the browser console.
// Read with `readScriptLog()` (tests, headless dry runs) or `globalThis.__oprnScriptLog()` in dev tools.
export type ScriptLogLevel = "log" | "error";

export interface ScriptLogEntry {
  readonly level: ScriptLogLevel;
  readonly message: string;
  /** Event id or common-event context that ran the script, when known. */
  readonly source?: string;
  readonly at: number;
}

const LIMIT = 200;
const entries: ScriptLogEntry[] = [];
const listeners = new Set<(entry: ScriptLogEntry) => void>();

export function recordScriptLog(level: ScriptLogLevel, message: string, source?: string): void {
  const entry: ScriptLogEntry = { level, message: message.slice(0, 2000), ...(source ? { source } : {}), at: Date.now() };
  entries.push(entry);
  if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
  const prefix = source ? `[script ${source}]` : "[script]";
  if (level === "error") console.error(prefix, entry.message);
  else console.log(prefix, entry.message);
  for (const listener of listeners) {
    try { listener(entry); } catch { /* a listener must never break the game */ }
  }
}

export function readScriptLog(): readonly ScriptLogEntry[] {
  return entries.slice();
}

export function clearScriptLog(): void {
  entries.length = 0;
}

/** Headless runners (dry_run_script, scene tests) subscribe to collect lines for one run. */
export function onScriptLog(listener: (entry: ScriptLogEntry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof globalThis !== "undefined") {
  (globalThis as { __oprnScriptLog?: () => readonly ScriptLogEntry[] }).__oprnScriptLog = readScriptLog;
}
