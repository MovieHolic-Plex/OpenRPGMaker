// 조수의 대기 화면 밀도. 저장 ID는 기존 배포와 호환하고, 라디오에는 아이콘+한국어를 그대로 보인다.

export type AssistantTemperature = "quiet-gold" | "ink-only" | "map-first";

export const DEFAULT_ASSISTANT_TEMPERATURE: AssistantTemperature = "quiet-gold";
export const EDITOR_LAYOUT_STORAGE_KEY = "oprn:editor-layout:v4";

export const ASSISTANT_TEMPERATURES = [
  { id: "quiet-gold", icon: "✦", label: "추천 함께 보기" },
  { id: "ink-only", icon: "◫", label: "조수만 보기" },
  { id: "map-first", icon: "⌨", label: "입력창만 보기" },
] as const satisfies readonly {
  readonly id: AssistantTemperature;
  readonly icon: string;
  readonly label: string;
}[];

export function parseAssistantTemperature(
  raw: unknown,
  fallback: AssistantTemperature = DEFAULT_ASSISTANT_TEMPERATURE,
): AssistantTemperature {
  if (raw === "quiet-gold" || raw === "ink-only" || raw === "map-first") return raw;
  return fallback;
}

/** 라디오의 보이는 글. hover title 전용이 아니다. */
export function assistantTemperatureMenuLabel(id: AssistantTemperature): string {
  const item = ASSISTANT_TEMPERATURES.find((candidate) => candidate.id === id);
  return item ? `${item.icon} ${item.label}` : id;
}

/** 다른 레이아웃 필드를 보존한 채 대기 화면 선택만 저장한다. */
export function persistAssistantTemperature(next: AssistantTemperature): void {
  try {
    const storage = typeof localStorage === "undefined" ? null : localStorage;
    if (!storage) return;
    const raw = storage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const base = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    storage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify({
      ...base,
      assistantTemperature: parseAssistantTemperature(next),
    }));
  } catch {
    // UI 환경설정은 best-effort다. 저장 실패가 편집을 막아서는 안 된다.
  }
}
