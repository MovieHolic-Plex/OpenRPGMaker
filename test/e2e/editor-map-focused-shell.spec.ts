import { expect, test } from "@playwright/test";

test("edit mode restores existing chrome, removes the bottom bar, and exposes scrollable AI settings", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/?freshProject=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("topbar-ai-settings")).toBeVisible();

  // 맵 메뉴(2026-08-26)·게임 메뉴·클래식 툴바 행·작업 칩(2026-09-03)은 없다. 전문가의 도구 창은 인라인 버튼.
  for (const testId of [
    "menu-project",
    "toolbar-save",
    "toolbar-database",
    "toolbar-resource-manager",
    "toolbar-world",
    "menu-help",
    "workspace-panels-button",
    "workspace-command-palette-button",
    "topbar-test-play",
    "topbar-battle-test",
  ]) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }

  for (const testId of [
    "editor-statusbar",
    "db-connection-status",
    "toggle-layout-bboxes",
    "ai-connection-status",
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
  // 수동 「지금 저장」은 없다 — 푸터는 자동 저장 상태만 보여 준다.
  await expect(page.getByTestId("ai-config-saved-hint")).toBeVisible();
});
