const MINUTES_PER_DAY = 24 * 60;
const INTERVALS = [
  [365 * MINUTES_PER_DAY, "year"],
  [30 * MINUTES_PER_DAY, "month"],
  [7 * MINUTES_PER_DAY, "week"],
  [MINUTES_PER_DAY, "day"],
  [60, "hour"],
  [1, "minute"],
] as const;

export function formatLastOpenedTime(iso: string | null | undefined, locale = "ko", now = Date.now()): string {
  const at = Date.parse(iso ?? "");
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [length, unit] of INTERVALS) {
    if (minutes >= length) return relative.format(-Math.floor(minutes / length), unit);
  }
  return relative.format(0, "second");
}
