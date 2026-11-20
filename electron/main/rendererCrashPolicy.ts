import type { RenderProcessGoneDetails } from "electron";

const RELOAD_WINDOW_MS = 60_000;
const MAX_RELOADS = 2;

export function planRendererCrashRecovery(
  reason: RenderProcessGoneDetails["reason"],
  now: number,
  reloads: readonly number[],
) {
  if (reason === "clean-exit") return { action: "ignore" } as const;
  const recent = reloads.filter((at) => now - at < RELOAD_WINDOW_MS);
  if (recent.length >= MAX_RELOADS) return { action: "report" } as const;
  return { action: "reload", reloads: [...recent, now] } as const;
}
