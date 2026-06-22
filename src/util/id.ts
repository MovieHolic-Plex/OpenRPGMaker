// util/id.ts — 식별자 생성.
// crypto.randomUUID를 우선 사용, 구형 환경은 폴백.
export function genId(prefix = "id"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${uuid}`;
}
