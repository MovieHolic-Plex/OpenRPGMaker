import { expect, test } from "@playwright/test";

test("editor copies the first five RM2000 workbench shell affordances", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&rm2kShell=1");

  await expect(page.getByTestId("rm2k3-menu-bar")).toBeVisible();
  await expect(page.getByTestId("rm2k3-menu-bar")).toContainText("프로젝트");
  await expect(page.getByTestId("rm2k3-menu-bar")).toContainText("맵");
  await expect(page.getByTestId("rm2k3-toolbar-row-primary")).toBeVisible();
  await expect(page.getByTestId("rm2k3-toolbar-row-edit")).toBeVisible();
  await expect(page.getByTestId("toolbar-save")).toBeVisible();
  await expect(page.getByTestId("mode-play")).toBeVisible();

  await expect(page.getByTestId("left-palette-root")).toBeVisible();
  await expect(page.getByTestId("left-map-root")).toBeVisible();
  await expect(page.getByTestId("editor-canvas-scroll-shell")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("editor-statusbar")).toContainText("하위 레이어");
  await expect(page.getByTestId("editor-statusbar")).toContainText("맵:");
  await expect(page.getByTestId("editor-statusbar")).toContainText("타일:");
  await expect(page.getByTestId("editor-statusbar")).toContainText("줌:");

  const beforeWindowScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const workArea = page.getByTestId("editor-canvas-scroll-shell");
  await workArea.evaluate((node) => {
    node.scrollLeft = 80;
    node.scrollTop = 64;
  });
  await page.getByTestId("chipset-scroll-right").click();
  await page.getByTestId("chipset-tile-132").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("132");
  await expect.poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(beforeWindowScroll);

  await page.getByTestId("toolbar-test-play-window").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("test-play-window-title")).toContainText("테스트 플레이");
  await expect(page.getByTestId("test-play-window")).toContainText("RPG 쯔꾸르");
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toBeHidden();

  await page.screenshot({ path: testInfo.outputPath("rm2k-copy-5-shell.png"), fullPage: true });
});
