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

// 푸터 상태줄. "자동 저장됨"과 "지금 저장" 버튼이 나란히 서 있어 둘이 모순처럼 보이는
// 민원이 있었다 — 서로 다른 일을 하는 둘임을 한 줄에 밝힌다(편집은 즉시 메모리에 반영,
// 지금 저장은 store.flush() 로 온라인·브라우저에 즉시 확정).
export function databaseFooterStatusText(): string {
  return "✓ 자동 저장됨 · ‘지금 저장’은 지금 상태를 온라인·브라우저에 즉시 확정합니다";
}
