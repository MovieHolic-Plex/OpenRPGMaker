/**
 * 화면 표시 필터(system.displayFilter) — 옛 TV 느낌. 맵·전투·대화·메뉴를 한꺼번에 덮는다(.play-stage 맨 위 층).
 *
 * - scanlines: 논리 2px 마다 어두운 가로줄. 도트가 "브라운관에서 보던" 결로 읽힌다.
 * - crt: 가로줄 + 붉은·초록·푸른 세로 결(섀도 마스크) + 가장자리 어둡게(비네트) + 둥근 모서리 그늘.
 *
 * 생략 = 없음. 깜빡임은 넣지 않는다(광과민성). 그리기는 player/displayFilterDom.ts.
 */
export const DISPLAY_FILTERS = ["none", "scanlines", "crt"] as const;
export type DisplayFilterName = (typeof DISPLAY_FILTERS)[number];

export const DISPLAY_FILTER_LABELS: Record<DisplayFilterName, string> = {
  none: "없음",
  scanlines: "주사선 (가로줄)",
  crt: "브라운관 (주사선·색 결·가장자리 어둡게)",
};

export function isDisplayFilterName(value: unknown): value is DisplayFilterName {
  return typeof value === "string" && (DISPLAY_FILTERS as readonly string[]).includes(value);
}

/** 저장용. none·모르는 값은 생략. */
export function normalizeDisplayFilter(value: unknown): Exclude<DisplayFilterName, "none"> | undefined {
  return isDisplayFilterName(value) && value !== "none" ? value : undefined;
}
