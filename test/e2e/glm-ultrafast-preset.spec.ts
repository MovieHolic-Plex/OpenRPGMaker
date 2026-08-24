import { expect, test, type Page } from "@playwright/test";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

test.describe("glm-5.2-ultrafast preset", () => {
  test("appears in apiKey model preset dropdown", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "expert");
    });
    await page.setViewportSize({ width: 1600, height: 920 });
    await page.goto("/?glmPresetVerify=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) {
      await restore.click();
    }

    await expect(page.getByTestId("topbar-ai-settings")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("topbar-ai-settings").click();
    await expect(page.getByTestId("ai-settings-modal")).toBeVisible();

    await page.getByTestId("ai-auth-api-key").click();
    await expect(page.getByTestId("ai-auth-api-key")).toHaveClass(/is-active/);

    const preset = page.getByTestId("ai-config-model-preset");
    await expect(preset).toBeVisible();
    await expect(preset.locator("option[value='glm-5.2-ultrafast']")).toHaveCount(1);

    await preset.selectOption("glm-5.2-ultrafast");
    await expect(page.getByTestId("ai-config-model")).toHaveValue("glm-5.2-ultrafast");
  });
});
