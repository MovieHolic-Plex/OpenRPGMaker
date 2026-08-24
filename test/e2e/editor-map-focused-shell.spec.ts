import { expect, test } from "@playwright/test";

test("edit mode keeps chrome focused on the map and exposes scrollable AI settings", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "standard"));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/?freshProject=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("topbar-ai-settings")).toBeVisible();

  for (const testId of [
    "menu-project",
    "menu-map",
    "menu-tools",
    "menu-game",
    "menu-help",
    "workspace-preset-toggle",
    "workspace-panels-button",
    "workspace-command-palette-button",
    "oprn-toolbar",
    "topbar-test-play",
    "topbar-battle-test",
    "db-connection-status",
    "toggle-layout-bboxes",
    "ai-connection-status",
    "build-palette-ai",
    "ai-settings-toggle",
    "ai-settings-command-bar",
  ]) {
    await expect(page.getByTestId(testId)).toHaveCount(0);
  }

  await page.getByTestId("topbar-ai-settings").click();
  await expect(page.getByTestId("ai-settings-modal")).toBeVisible();
  await expect(page.getByTestId("ai-settings-advanced")).toHaveAttribute("open", "");

  const body = page.getByTestId("ai-settings-body");
  await expect(body).toHaveCSS("overflow-y", "scroll");
  const scroll = await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return {
      top: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  expect(scroll.top).toBeGreaterThan(0);
  await expect(page.getByTestId("ai-config-save")).toBeVisible();
});
