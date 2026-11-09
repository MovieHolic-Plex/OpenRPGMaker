// Opt-in dispatcher event log (play.mjs --events). One JSON row per fact a control-room view needs, written by the
// process that actually caused it: queued / spawn / ack / progress / done / retry per session, plus gauge samples.
// Every row carries the owning lane or agent id (`owner`) and a monotonic clock (`mono`, ms since the log opened,
// from process.hrtime) next to the wall clock (`at`), so rows from one run order correctly even if the wall clock steps.
import fs from "node:fs";

export const EVENT_TYPES = ["run", "queued", "spawn", "ack", "progress", "done", "retry", "gauge", "end"];
/** player.mjs prints this prefix (only when QA_EVENTS=1) once per kept frame; play.mjs turns it into a progress row. */
export const STEP_PREFIX = "@@qa-step ";

/**
 * @param {string} file  events.jsonl path (appended)
 * @param {{ owner: string, run: string, clock?: () => bigint, wall?: () => Date }} opts
 */
export function createEventLog(file, { owner, run, clock = () => process.hrtime.bigint(), wall = () => new Date() }) {
  if (!owner) throw new Error("event log needs an owner (lane or agent id)");
  const origin = clock();
  let last = 0;
  const fd = fs.openSync(file, "a");
  return {
    emit(type, id, extra = {}) {
      if (!EVENT_TYPES.includes(type)) throw new Error(`unknown event type ${type}`);
      // hrtime is monotonic; the max() only guards a test clock that is not.
      const mono = Math.max(last, Number((clock() - origin) / 1000n) / 1000);
      last = mono;
      const row = { mono, at: wall().toISOString(), run, owner, type, ...(id ? { id } : {}), ...extra };
      fs.writeSync(fd, JSON.stringify(row) + "\n");
      return row;
    },
    close() { fs.closeSync(fd); },
  };
}

/** Split a child's stdout chunk stream into complete lines; returns the parsed step rows and the leftover partial line. */
export function parseStepLines(buffer) {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const steps = [];
  for (const line of lines) {
    if (!line.startsWith(STEP_PREFIX)) continue;
    try { steps.push(JSON.parse(line.slice(STEP_PREFIX.length))); } catch { /* a malformed step line is not a step */ }
  }
  return { steps, rest };
}

/** Read an events.jsonl back into per-session lifecycles (for the control-room renderer and for checks). */
export function sessionLifecycles(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!r.id) continue;
    const s = by.get(r.id) ?? { id: r.id, owner: r.owner, attempts: 0, steps: 0, queuedAt: null, spawnAt: null, ackAt: null, doneAt: null, code: null };
    if (r.type === "queued") s.queuedAt = r.mono;
    if (r.type === "spawn") { s.attempts += 1; s.spawnAt ??= r.mono; }
    if (r.type === "ack") s.ackAt ??= r.mono;
    if (r.type === "progress") s.steps += 1;
    if (r.type === "done") { s.doneAt = r.mono; s.code = r.code; }
    by.set(r.id, s);
  }
  return [...by.values()];
}
