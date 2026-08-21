import { expect, test, type Page } from "@playwright/test";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  try {
    await guest.waitFor({ state: "visible", timeout: 5_000 });
    await guest.click();
  } catch {
    /* already past */
  }
}

test.describe("beginner AI first run", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "beginner");
      localStorage.removeItem("rpg-zzu:ai-panel-collapsed");
      localStorage.removeItem("rpg-zzu:coachmarks-basic-v1");
      localStorage.setItem("rpg-zzu:editor-welcome-dismissed", "1");
    });
  });

  test("첫 방문은 초보고, 장소 카드는 야외 장소이며 슬래시는 한글이다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?blankProject=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).toHaveClass(/editor-ui-beginner/);
    await expect(page.getByTestId("basic-left-rail")).toBeVisible();
    await expect(page.getByTestId("basic-rail-flyout")).toHaveCount(0);

    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await expect(page.getByTestId("ai-panel")).toBeVisible();
    await expect(page.getByTestId("ai-input")).toHaveAttribute("placeholder", /무엇을 만들까/);

    const place = page.getByTestId("ai-start-visual-place");
    await expect(place).toContainText("장소 만들기");
    await place.click();
    await expect(page.getByTestId("ai-input")).toHaveValue(/야외 장소/);

    await page.getByTestId("ai-input").fill("/");
    await expect(page.getByTestId("ai-slash-item-build-house")).toContainText("집 짓기");
    await expect(page.getByTestId("ai-slash-item-build-house")).not.toContainText("/build-house");
    await page.screenshot({ path: "output/evidence/ai-hostile-ux/14-beginner-fixed.png" });
  });
});
