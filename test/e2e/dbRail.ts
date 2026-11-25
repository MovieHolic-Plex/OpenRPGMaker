import type { Page } from "@playwright/test";

/**
 * 자료집 레일 접기(impl-database) 뒤에는 탭 목록이 묶음 아이콘을 눌러야 뜬다.
 * 그 탭이 속한 묶음 아이콘을 눌러 목록을 연다. tab 을 비우면 지금 묶음의 목록(검색 칸 포함)을 연다.
 * 이미 그 묶음 목록이 열려 있으면 아무것도 누르지 않는다(같은 묶음을 다시 누르면 닫히므로).
 */
export async function revealDbRailTab(page: Page, tab?: string): Promise<void> {
  const slug = await page.evaluate((id) => {
    const body = document.querySelector<HTMLElement>(".database-modal-body[data-rail-open]");
    if (!body) return null;
    let node: Element | null = id ? document.querySelector(`[data-testid="db-tab-${id}"]`) : null;
    if (id && !node) return null;
    while (node && !node.classList.contains("db-tab-group")) node = node.previousElementSibling;
    const owner = (node as HTMLElement | null)?.dataset.groupSlug
      ?? document.querySelector<HTMLElement>(".db-group-strip-btn.active")?.dataset.groupSlug
      ?? null;
    const viewing = document.querySelector<HTMLElement>(".database-modal-body > .db-tabs")?.dataset.viewGroup;
    if (body.dataset.railOpen === "1" && viewing === owner) return null;
    return owner;
  }, tab ?? null);
  if (slug) await page.getByTestId(`db-group-strip-${slug}`).click();
}
