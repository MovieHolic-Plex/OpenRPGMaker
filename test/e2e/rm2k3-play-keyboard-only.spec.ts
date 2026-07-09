import { expect, test, type Page } from "@playwright/test";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { makeCommerceProject, runtimeState, tapKey } from "./rm2k3-commerce-fixtures";

test("runtime shop ignores mouse clicks but buys through keyboard", async ({ page }) => {
  // 자동화 예외(webdriver 허용)를 끄고 실사용자와 동일한 차단 동작을 검증한다.
  await page.addInitScript(() => {
    (globalThis as { __rpgzzuForcePointerBlock?: boolean }).__rpgzzuForcePointerBlock = true;
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, makeCommerceProject());
  await page.getByTestId("mode-play").click();
  await startTitleWithKeyboard(page);
  await expectRuntimeInput(page);

  await tapKey(page, "Space");
  await expect(page.getByTestId("shop-scene")).toBeVisible();

  await page.getByTestId("shop-mode-buy").click({ force: true });
  await expect(page.getByTestId("shop-mode-buy")).toBeVisible();
  await expect(page.getByTestId("shop-buy-item_potion")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("shop-buy-item_potion")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("inn-scene")).toBeVisible();

  const runtime = await runtimeState(page);
  expect(runtime.gold).toBe(88);
  expect(runtime.inventory.item_potion).toBe(1);
});

async function startTitleWithKeyboard(page: Page): Promise<void> {
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
}

async function expectRuntimeInput(page: Page): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => typeof (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput))
    .toBe("object");
}
