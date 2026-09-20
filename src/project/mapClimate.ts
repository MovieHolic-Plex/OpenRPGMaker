import type { WeatherKind } from "./types";

export type MapClimate =
  | { mode: "inherit" | "indoor" }
  | { mode: "fixed"; weather: WeatherKind; intensity: number };

export function normalizeMapClimate(value: unknown): MapClimate | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.mode === "inherit" || raw.mode === "indoor") return { mode: raw.mode };
  if (raw.mode !== "fixed") return undefined;
  const weather = ["none", "rain", "snow", "storm", "fog"].includes(String(raw.weather))
    ? raw.weather as WeatherKind : "none";
  const intensity = typeof raw.intensity === "number" && Number.isFinite(raw.intensity)
    ? Math.max(0, Math.min(1, raw.intensity)) : 0.5;
  return { mode: "fixed", weather, intensity: weather === "none" ? 0 : intensity };
}
