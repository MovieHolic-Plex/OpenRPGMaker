// ai/session/unknownValue.ts
// 경계에서 도착한 unknown 을 좁히는 원시 판정. 모델이 보낸 툴 인자·툴 결과 data 처럼
// 스키마를 신뢰할 수 없는 값만 여기를 지난다 — 내부 타입 값에는 쓰지 않는다.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
