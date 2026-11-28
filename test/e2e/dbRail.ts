import type { Page } from "@playwright/test";

/**
 * 자료집 좌측 단일 통합 레일(2026-11-28, 안 B)에서는 넓은 창의 모든 구획이 상시 펼쳐져 있다.
 * 사용자가 수동으로 52px 아이콘 레일로 접어 둔 상태(`data-rail-collapsed="1"`)이거나,
 * 599px 이하 휴대 폭에서 탭 고르기 단추(`db-tab-switcher`)가 닫혀 있을 때만 목록을 펼친다.
 */
export async function revealDbRailTab(page: Page, _tab?: string): Promise<void> {
  const action = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".database-modal-body");
    if (!body) return null;
    const switcher = body.querySelector<HTMLElement>("[data-testid='db-tab-switcher']");
    if (switcher && switcher.getBoundingClientRect().width > 0) {
      return body.dataset.railOpen === "1" ? null : "switcher";
    }
    const collapseToggle = body.querySelector<HTMLElement>("[data-testid='db-rail-collapse-toggle']");
    if (body.dataset.railCollapsed === "1" && collapseToggle && collapseToggle.getBoundingClientRect().width > 0) {
      return "expand";
    }
    return null;
  });
  if (action === "switcher") await page.getByTestId("db-tab-switcher").click();
  else if (action === "expand") await page.getByTestId("db-rail-collapse-toggle").click();
}
