export type DatabaseWorkbenchSummary = {
  readonly recordId?: string;
  readonly recordName?: string;
  readonly selectedIndex?: number;
  readonly tabId: string;
  readonly tabLabel: string;
  readonly totalCount?: number;
};

export const DATABASE_FOOTER_ACTION_TEST_IDS = {
  apply: "database-footer-apply",
  ok: "database-footer-ok",
} as const;

export function databaseWorkbenchStatusText(summary: DatabaseWorkbenchSummary): string {
  const base = `탭 ${summary.tabLabel} (${summary.tabId})`;
  if (!summary.recordId || !summary.recordName || !summary.selectedIndex || !summary.totalCount) {
    return `${base} | 레코드 없음`;
  }
  return `${base} | 선택 ${summary.recordName} | ${summary.selectedIndex} / ${summary.totalCount}`;
}

// 푸터 상태줄. 설명을 길게 적으면 항상 보이는 1500px 배너가 되어 노이즈만 늘어난다.
// 상태는 짧게, "지금 저장"과의 관계 설명은 버튼 title 로 넘긴다(DATABASE_APPLY_BUTTON_HINT).
export function databaseFooterStatusText(): string {
  return "✓ 자동 저장됨";
}

// "자동 저장됨"과 "지금 저장"이 모순처럼 보이는 것은 버튼 툴팁에서 풀어준다.
// 편집은 즉시 메모리에 반영되고, 이 버튼은 store.flush() 로 온라인·브라우저에 확정한다.
export const DATABASE_APPLY_BUTTON_HINT =
  "편집은 이미 자동으로 반영됩니다. 이 버튼은 지금 상태를 온라인·브라우저에 즉시 확정합니다.";
