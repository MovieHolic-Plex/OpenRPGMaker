import { expect, test, type Page } from "@playwright/test";

// 실측 회귀(2026-08-27): Phaser 캔버스는 포커스를 받지 않아, 어시스턴트 입력창에 한 번 타이핑하면
// 맵을 칠한 뒤 누른 Ctrl+Z 가 맵이 아니라 프롬프트 글자를 지웠다("마을에 길 하나" → "마을에 길 하").
type EditorSnapshot = {
  readonly tool: string;
  readonly lower: readonly number[];
};

async function snapshot(page: Page): Promise<EditorSnapshot> {
  const raw = await page.getByTestId("project-export-json").textContent();
  if (!raw) throw new Error("missing project export");
  const parsed = JSON.parse(raw) as {
    project: { startMapId: string; maps: Record<string, { lowerTiles: number[] }> };
    editor: { currentMapId: string | null; tool: string };
  };
  const mapId = parsed.editor.currentMapId ?? parsed.project.startMapId;
  const map = parsed.project.maps[mapId];
  if (!map) throw new Error("missing current map");
  return { tool: parsed.editor.tool, lower: map.lowerTiles };
}

function changedCells(before: readonly number[], after: readonly number[]): number {
  return before.reduce((total, value, index) => total + (value !== after[index] ? 1 : 0), 0);
}

async function canvasPaintPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator(".phaser-container").boundingBox();
  if (!box) throw new Error("missing canvas host");
  const point = await page.evaluate(
    ({ x, y, w, h }) => {
      for (const fy of [0.85, 0.75, 0.9, 0.65]) {
        for (const fx of [0.85, 0.75, 0.9, 0.65]) {
          const cx = Math.floor(x + w * fx);
          const cy = Math.floor(y + h * fy);
          const element = document.elementFromPoint(cx, cy);
          if (element && (element.tagName === "CANVAS" || element.classList.contains("phaser-container"))) {
            return { x: cx, y: cy };
          }
        }
      }
      return null;
    },
    { x: box.x, y: box.y, w: box.width, h: box.height }
  );
  if (!point) throw new Error("no uncovered canvas point");
  return point;
}

async function paintStroke(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 34, point.y, { steps: 5 });
  await page.mouse.up();
}

test("Ctrl+Z undoes the map edit after the assistant composer held focus", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("tool-paint").click();
  await page.getByTestId("chipset-tile-7").click();

  const composer = page.getByTestId("ai-input");
  await composer.click();
  await composer.pressSequentially("마을에 길 하나");
  await expect(composer).toBeFocused();

  const point = await canvasPaintPoint(page);
  const before = await snapshot(page);
  await paintStroke(page, point);
  await expect.poll(async () => changedCells(before.lower, (await snapshot(page)).lower)).toBeGreaterThan(0);
  const painted = await snapshot(page);
  const paintedCells = changedCells(before.lower, painted.lower);

  await page.keyboard.press("Control+z");

  await expect.poll(async () => changedCells(painted.lower, (await snapshot(page)).lower)).toBe(paintedCells);
  await expect(composer).toHaveValue("마을에 길 하나");
  await expect(page.locator("[class*='toast']").filter({ hasText: "되돌" }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("undo-after-composer-focus.png") });
});

test("editor tool hotkeys still reach the map after the tile search box held focus", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("tool-paint").click();
  await page.getByTestId("tile-search-input").click();

  const point = await canvasPaintPoint(page);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("g");

  await expect.poll(async () => (await snapshot(page)).tool).toBe("fill");
});

test("Ctrl+Z inside a text field still belongs to the browser", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("tool-paint").click();
  await page.getByTestId("chipset-tile-7").click();

  const point = await canvasPaintPoint(page);
  const before = await snapshot(page);
  await paintStroke(page, point);
  await expect.poll(async () => changedCells(before.lower, (await snapshot(page)).lower)).toBeGreaterThan(0);
  const painted = await snapshot(page);

  // 타일 검색창은 입력마다 팔레트를 재렌더해 포커스를 잃으므로, 포커스를 지키는 필드로 잰다.
  const composer = page.getByTestId("ai-input");
  await composer.click();
  await composer.fill("여기에 집");
  await expect(composer).toBeFocused();
  await page.keyboard.press("Control+z");

  expect(changedCells(painted.lower, (await snapshot(page)).lower)).toBe(0);
});
