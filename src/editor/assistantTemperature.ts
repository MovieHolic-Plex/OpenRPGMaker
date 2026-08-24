// 조수 대기 온도 — 도크(위치)와 독립. 레이아웃 JSON에 chatDock 과 함께 저장한다.

export type AssistantTemperature = "quiet-gold" | "ink-only" | "map-first";

export const DEFAULT_ASSISTANT_TEMPERATURE: AssistantTemperature = "quiet-gold";

export const EDITOR_LAYOUT_STORAGE_KEY = "oprn:editor-layout:v4";

export const ASSISTANT_TEMPERATURES = [
  { id: "quiet-gold", code: "A", label: "조용한 골드", english: "Quiet Gold" },
  { id: "ink-only", code: "B", label: "잉크만", english: "Ink Only" },
  { id: "map-first", code: "C", label: "맵 우선", english: "Map First" },
] as const satisfies readonly {
  readonly id: AssistantTemperature;
  readonly code: "A" | "B" | "C";
  readonly label: string;
  readonly english: string;
}[];

export function parseAssistantTemperature(
  raw: unknown,
  fallback: AssistantTemperature = DEFAULT_ASSISTANT_TEMPERATURE,
): AssistantTemperature {
  if (raw === "quiet-gold" || raw === "ink-only" || raw === "map-first") return raw;
  return fallback;
}

export function assistantTemperatureMenuLabel(id: AssistantTemperature): string {
  const row = ASSISTANT_TEMPERATURES.find((item) => item.id === id);
  return row ? `${row.code} ${row.label}` : id;
}

export function persistAssistantTemperature(next: AssistantTemperature): void {
  const value = parseAssistantTemperature(next);
  try {
    const ls = typeof localStorage === "undefined" ? null : localStorage;
    if (!ls) return;
    const raw = ls.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const base = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    ls.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify({ ...base, assistantTemperature: value }));
  } catch {
    // layout cache is best-effort
  }
}
