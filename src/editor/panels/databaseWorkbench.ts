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
  return "✓ 자동 저장됨";
}
