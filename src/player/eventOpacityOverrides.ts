/**
 * 이동 경로 changeOpacity 가 남긴 이벤트 불투명도 — 경로가 끝나도·표면을 다시 그려도 그 페이지가 서 있는 동안 유지한다.
 * 없으면 흐려져 떠난 인물이 다음 갱신에 255 로 되살아나 몸과 들고 있던 빛이 다시 보였다(폴른 스타 B4 숲지기, 2026-11-03).
 */
export type EventOpacityOverrides = Map<string, { readonly pageId: string | undefined; readonly opacity: number }>;

/** 이 페이지에서 경로가 흐려 둔 불투명도(0..255). 페이지가 바뀌었으면(다른 그림·상태로 다시 나타남) 기록을 지우고 undefined. */
export function keptEventOpacity(overrides: EventOpacityOverrides | undefined, eventId: string, pageId: string | undefined): number | undefined {
  const kept = overrides?.get(eventId);
  if (!kept) return undefined;
  if (kept.pageId !== pageId) {
    overrides!.delete(eventId);
    return undefined;
  }
  return kept.opacity;
}
