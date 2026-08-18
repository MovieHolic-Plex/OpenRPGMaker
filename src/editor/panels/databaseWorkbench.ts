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

export function databaseFooterStatusText(): string {
  // 상태 pill 한 줄 — 장문 안내 대신 요약. ("자동 저장" / "선택" 포함은 footer 테스트 계약)
  return "✓ 자동 저장됨 — 실수는 Ctrl+Z, 닫을 때 '열 때 상태로 되돌리기' 선택 가능";
}
