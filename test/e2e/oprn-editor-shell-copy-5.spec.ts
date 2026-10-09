import { expect, test } from "@playwright/test";

test("editor copies the first five RM2000 workbench shell affordances", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&rm2kShell=1");

  // 2026-09-03 스튜디오 바 — 한 줄. 프로젝트 이름(메뉴)·저장·자료집이 왼쪽, ▶ 테스트가 오른쪽에 있다.
  await expect(page.getByTestId("oprn-menu-bar")).toBeVisible();
  await expect(page.getByTestId("menu-project")).toBeVisible();
  await expect(page.getByTestId("oprn-toolbar")).toHaveCount(0);
  await expect(page.getByTestId("toolbar-save")).toBeVisible();
  await expect(page.getByTestId("toolbar-database")).toBeVisible();
  await expect(page.getByTestId("mode-play")).toBeVisible();

  await expect(page.getByTestId("left-palette-root")).toBeVisible();
  await expect(page.getByTestId("left-map-root")).toBeVisible();
  await expect(page.getByTestId("editor-canvas-scroll-shell")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("editor-statusbar")).toHaveCount(0);

  const beforeWindowScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const workArea = page.getByTestId("editor-canvas-scroll-shell");
  await workArea.evaluate((node) => {
    node.scrollLeft = 80;
    node.scrollTop = 64;
  });
  // chipset-tile 클릭 시 window 스크롤이 튀지 않는지 검증.
  await page.getByTestId("chipset-tile-6").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("6");
  await expect.poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(beforeWindowScroll);

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("test-play-window-title")).toContainText("시연 실행");
  // 예전 계약은 창 제목에 "RPG 쯔꾸르"가 들어가길 요구했다 — 침해 문자열을 테스트가
  // 지키던 자리다. 이제는 상표 인접 표현이 없는지만 본다. (탈-쯔구르 2026-08-21)
  await expect(page.getByTestId("test-play-window")).not.toContainText(/쯔꾸르|쯔구르|RPG\s*Maker|RPG\s*만들기/i);
  await page.getByTestId("test-play-window-close").click();
  await expect(page.getByTestId("test-play-window")).toBeHidden();

  await page.screenshot({ path: testInfo.outputPath("rm2k-copy-5-shell.png"), fullPage: true });
});
