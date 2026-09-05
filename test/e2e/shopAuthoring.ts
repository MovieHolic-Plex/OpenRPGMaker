import { expect, type Locator, type Page } from "@playwright/test";

/** Drive the catalog's staged add path; already listed items need no mutation. */
export async function addShopGoods(page: Page, dialog: Locator, itemId: string): Promise<void> {
  if (await dialog.getByTestId(`shop-item-row-${itemId}`).count()) return;
  await dialog.getByTestId("shop-add-goods").click();
  const catalog = page.getByTestId("shop-catalog-dialog");
  await catalog.getByTestId("shop-item-search").fill(itemId);
  await catalog.getByTestId(`shop-item-check-${itemId}`).check();
  await catalog.getByTestId("shop-catalog-add").click();
  await expect(dialog.getByTestId(`shop-item-row-${itemId}`)).toBeVisible();
}
