import type { M2CommandFields } from "@/project/types";

/** Explicit milliseconds win; legacy duration keeps its historical seconds heuristic. */
export function tintDurationMs(fields: M2CommandFields): number {
  const value = Number(fields.durationMs ?? fields.duration ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(fields.durationMs === undefined && value <= 60 ? value * 1000 : value);
}
