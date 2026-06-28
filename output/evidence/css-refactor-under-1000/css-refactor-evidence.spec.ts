import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const evidenceDir = "output/evidence/css-refactor-under-1000";
mkdirSync(evidenceDir, { recursive: true });

async function captureState(page, name: string): Promise<void> {
  const state = await page.evaluate(() => {
    const pick = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        selector,
        text: node.textContent?.slice(0, 160) ?? "",
        visible: box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none",
        box: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        background: style.backgroundColor,
        color: style.color,
        fontSize: style.fontSize,
        overflow: style.overflow,
      };
    };
    return {
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      bodyClasses: [...document.body.classList],
      surfaces: [
        pick("[data-testid='rm2k3-menu-bar']"),
        pick("[data-testid='rm2k3-toolbar']"),
        pick("[data-testid='edit-canvas']"),
        pick("[data-testid='tile-palette']"),
        pick("[data-testid='database-modal']"),
        pick("[data-testid='resource-modal']"),
        pick("[data-testid='test-play-window']"),
        pick("[data-testid='title-screen']"),
      ].filter(Boolean),
    };
  });
  writeFileSync(`${evidenceDir}/${name}.json`, `${JSON.stringify(state, null, 2)}\n`);
}

test("css refactor browser evidence packet", async ({ page }) => {
  writeFileSync(`${evidenceDir}/scenario.json`, `${JSON.stringify({
    name: "css-refactor-under-1000",
    route: "/?freshProject=1&cssRefactorEvidence=1",
    viewports: [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }],
    path: ["open editor", "capture hover/focus", "open database", "open resource manager", "open test-play title screen", "capture mobile editor"],
    acceptance: ["all src/*.css files are <= 1000 lines", "RM2K3 menu/toolbar/editor canvas visible", "database/resource/title surfaces visible", "no document horizontal overflow", "screenshots nonblank"],
  }, null, 2)}\n`);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&cssRefactorEvidence=1");
  await expect(page.getByTestId("rm2k3-menu-bar")).toBeVisible();
  await expect(page.getByTestId("rm2k3-toolbar")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("tile-palette")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/desktop-editor-entry.png`, fullPage: true });
  await captureState(page, "desktop-editor-state");

  await page.getByTestId("toolbar-database").hover();
  await page.keyboard.press("Tab");
  await page.screenshot({ path: `${evidenceDir}/desktop-toolbar-hover-focus.png`, fullPage: true });

  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("database-modal")).toContainText(/주인공|Actors|데이터베이스/);
  await page.screenshot({ path: `${evidenceDir}/desktop-database-modal.png`, fullPage: true });
  await captureState(page, "desktop-database-state");
  await page.getByTestId("database-modal-close").click();
  await expect(page.getByTestId("database-modal")).toHaveCount(0);

  await page.getByTestId("toolbar-resource-manager").click();
  await expect(page.getByTestId("resource-modal")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/desktop-resource-modal.png`, fullPage: true });
  await captureState(page, "desktop-resource-state");
  await page.getByTestId("resource-modal-close").click();
  await expect(page.getByTestId("resource-modal")).toHaveCount(0);

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/desktop-runtime-title.png`, fullPage: true });
  await captureState(page, "desktop-runtime-title-state");
  await page.getByTestId("test-play-window-close").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?freshProject=1&cssRefactorEvidence=mobile");
  await expect(page.getByTestId("rm2k3-toolbar")).toBeVisible();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/mobile-editor-entry.png`, fullPage: true });
  await captureState(page, "mobile-editor-state");
});
