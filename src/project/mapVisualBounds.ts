/** Authored native-pixel headroom; it changes framing, never the ground grid. */
export function normalizeVisualTopOverhangPx(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(4096, Math.ceil(value));
}
