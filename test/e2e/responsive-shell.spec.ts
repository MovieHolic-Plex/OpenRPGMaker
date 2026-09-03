// test/e2e/responsive-shell.spec.ts
// 스펙 §5 검증: 1024/1280/1440에서 기본·전문가 모드 줄바꿈·잘림·겹침 없음.
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const SIZES = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const EDITOR_LAYOUT_KEY = "oprn:editor-layout:v4";
const EDITOR_LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const PANEL_COLLAPSED_KEY = "oprn:ai-panel-collapsed";
const EDITOR_LAYOUT_VERSION = "2026-07-24-maptree-300";

for (const size of SIZES) {
  for (const mode of ["basic", "expert"] as const) {
    for (const dock of ["side", "float"] as const) {
    test(`${mode} ${dock} ${size.name}px collapsed rail restores composer`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript(
        ({ layoutKey, layoutVersionKey, layoutVersion, collapsedKey, chatDock }) => {
          localStorage.removeItem("oprn:editor-layout");
          localStorage.removeItem("oprn:editor-layout:v2");
          localStorage.removeItem("oprn:editor-layout:v3");
          localStorage.setItem(layoutVersionKey, layoutVersion);
          localStorage.setItem(layoutKey, JSON.stringify({ chatDock }));
          localStorage.setItem(collapsedKey, "1");
        },
        {
          layoutKey: EDITOR_LAYOUT_KEY,
          layoutVersionKey: EDITOR_LAYOUT_VERSION_KEY,
          layoutVersion: EDITOR_LAYOUT_VERSION,
          collapsedKey: PANEL_COLLAPSED_KEY,
          chatDock: dock,
        },
      );
      await page.goto("/?freshProject=1");
      await page.waitForSelector("[data-testid='editor-layout']");
      await page.evaluate((m) => (window as never as { __oprnEditorUiMode: { set(v: string): void } }).__oprnEditorUiMode.set(m), mode);
      await page.waitForTimeout(300);

      // 1) 문서 가로 스크롤 없음
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // 2) 메뉴바 한 줄 (두 줄 꺾임이면 높이가 커진다)
      const menuBar = page.locator(".oprn-menu-bar");
      await expect(menuBar).toBeVisible();
      const menuBox = await menuBar.boundingBox();
      expect(menuBox?.height).toBeLessThanOrEqual(48);

      // 3) 보내기 버튼이 뷰포트 안에 온전히 존재
      const panel = page.getByTestId("ai-panel");
      const restore = page.getByTestId("ai-collapsed-restore");
      await expect(panel).toHaveClass(/is-collapsed/);
      await expect(restore).toBeVisible();
      await expect(restore).toHaveAttribute("aria-label", "AI 패널 펼치기");
      await expect(page.locator(".ai-chat-send").first()).toBeHidden();
      const restoreBox = await restore.boundingBox();
      expect(restoreBox).toBeTruthy();
      expect(restoreBox!.x).toBeGreaterThanOrEqual(0);
      expect(restoreBox!.y).toBeGreaterThanOrEqual(0);
      expect(restoreBox!.x + restoreBox!.width).toBeLessThanOrEqual(size.width + 1);
      expect(restoreBox!.y + restoreBox!.height).toBeLessThanOrEqual(size.height + 1);
      expect(Math.min(restoreBox!.width, restoreBox!.height)).toBeGreaterThanOrEqual(44);
      if (dock === "side") expect(restoreBox!.width).toBeGreaterThanOrEqual(44);

      const send = page.locator(".ai-chat-send").first();
      await restore.click();
      await expect(panel).not.toHaveClass(/is-collapsed/);
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), PANEL_COLLAPSED_KEY)).toBe("0");
      await expect(send).toBeVisible();

      await page.reload();
      await page.waitForSelector("[data-testid='editor-layout']");
      await expect(panel).toHaveClass(/is-collapsed/);
      await restore.focus();
      await expect(restore).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(panel).not.toHaveClass(/is-collapsed/);
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), PANEL_COLLAPSED_KEY)).toBe("0");
      await expect(send).toBeVisible();
      const box = await send.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);

      if (mode === "expert") {
        // 4) 맵 트리 이름이 실제 폭을 가진다
        const name = page.locator(".map-tree-name").first();
        await expect(name).toBeVisible();
        const nameBox = await name.boundingBox();
        expect(nameBox && nameBox.width).toBeGreaterThan(20);
        // 5) 스튜디오 바는 한 줄이다 — 1024px 에서도 두 번째 툴바 행이 생기지 않는다(2026-09-03).
        await expect(page.getByTestId("oprn-toolbar")).toHaveCount(0);
        const barBox = await page.getByTestId("oprn-menu-bar").boundingBox();
        expect(barBox && barBox.height).toBeLessThanOrEqual(49);
      } else {
        // 기본 모드: 아이콘 레일 존재 + 폭 72
        const rail = page.locator("[data-testid='basic-left-rail']");
        await expect(rail).toBeVisible();
        const railBox = await rail.boundingBox();
        expect(railBox?.width).toBe(72);
      }

      await page.screenshot({ path: `test-results/ai-panel-${mode}-${dock}-${size.name}.png` });
      await writeFile(
        testInfo.outputPath("ai-panel-metrics.json"),
        `${JSON.stringify({ viewport: size, mode, dock, overflow, restore: restoreBox, send: box }, null, 2)}\n`,
      );
    });
    }
  }
}
