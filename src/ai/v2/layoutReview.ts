// 칸 배치 자기 검토(review_layout) 단계의 작은 상수 — 할 일 검사(todo/checks)·관문(loop/roomZones)·빌더가 같이 읽는다(무거운 빌더를 끌어오지 않게 따로 둔다).
/** 자기 검토 바퀴 수 — OPRN_V2_LAYOUT_REVIEW_ROUNDS(기본 2, 0 = 끔). */
export function layoutReviewRounds(): number {
  const raw = typeof process !== "undefined" ? process.env?.OPRN_V2_LAYOUT_REVIEW_ROUNDS : undefined;
  const n = raw === undefined || raw.trim() === "" ? 2 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(4, Math.floor(n)) : 2;
}
/** 맵 위치 태그 reviews:N 에서 읽는 자기 검토 바퀴 수. */
export const REVIEWS_TAG = "reviews:";
