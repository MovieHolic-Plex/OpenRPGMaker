import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.setTimeout(300_000);
const DIR = ".omo/evidence/event-map-items/after";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const tool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await tool.count()) > 0) await tool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  try { await editor.waitFor({ state: "visible", timeout: 1500 }); }
  catch {
    const btn = page.getByTestId("event-editor-open");
    if (await btn.isVisible().catch(() => false)) await btn.click();
    else await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await expect(editor).toBeVisible();
  return editor;
}

async function openPicker(page: Page): Promise<Locator> {
  const line = page.getByTestId("event-command-empty-line").first();
  await line.evaluate((n) => n.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true })));
  const picker = page.getByTestId("event-command-picker").first();
  await expect(picker).toBeVisible({ timeout: 8000 });
  return picker;
}

test("after shots: picker tab3 + changeTile + setLighting", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20000 });
  await openEventEditor(page);

  // 1. 피커 3탭 — 애니메이션 표시가 하나만 보이는지
  let picker = await openPicker(page);
  const tab = picker.getByTestId("event-command-picker-tab-3");
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(400);
  await picker.screenshot({ path: `${DIR}/00-picker-tab3-full.png` });
  const animCount = await picker.locator('[data-testid^="command-picker-add-"]', { hasText: "애니메이션 표시" }).count();
  console.log("AFTER_ANIM_COUNT", animCount);
  // Escape로 닫기 (modalStack이 서브창부터 닫으므로 여러 번)
  for (let i = 0; i < 4; i++) {
    if (!(await page.getByTestId("event-command-picker").first().isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  async function openItem(testId: string): Promise<void> {
    picker = await openPicker(page);
    const t = picker.getByTestId("event-command-picker-tab-3");
    await t.click();
    await expect(t).toHaveAttribute("aria-selected", "true");
    await picker.locator(`[data-testid="${testId}"]`).first().click();
    await page.waitForTimeout(700);
  }

  // 2. 타일 변경 — 맵 캔버스 미리보기
  await openItem("command-picker-add-changeTile");
  const tilePreview = page.getByTestId("change-tile-map-preview");
  if (await tilePreview.isVisible().catch(() => false)) console.log("CHANGE_TILE_PREVIEW visible");
  await page.screenshot({ path: `${DIR}/item-changeTile.png` });
  for (let i = 0; i < 4; i++) {
    if (!(await page.getByTestId("event-command-picker").first().isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  await expect(page.locator(".event-subdialog-backdrop").first()).toHaveCount(0);

  // 3. 조명 설정 — 밝기 (%) 스케일
  await openItem("command-picker-add-setLighting");
  await page.screenshot({ path: `${DIR}/item-setLighting.png` });
  const val = await page.getByTestId("set-lighting-ambient-input").inputValue();
  console.log("LIGHTING_INPUT_VALUE", val);
});
