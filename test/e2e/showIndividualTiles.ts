import { expect, type Page } from "@playwright/test";

/**
 * 메타데이터가 있는 타일셋은 지형 카드가 기본이다.
 * 격자·분류·칸 클릭을 보는 검수는 개별 타일 탭을 연 뒤 이어서 간다.
 */
export async function showIndividualTiles(page: Page): Promise<void> {
  const tab = page.getByTestId("palette-tab-tiles");
  const palette = page.getByTestId("tile-palette");
  await expect(tab.or(palette).first()).toBeVisible({ timeout: 20_000 });
  if (await tab.count() === 0) return;
  if ((await tab.getAttribute("aria-selected")) === "true") return;
  await tab.click();
  await expect(palette).toBeVisible();
}
