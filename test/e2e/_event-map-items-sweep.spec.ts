import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test.setTimeout(900_000);

const DIR = ".omo/evidence/event-map-items/before";

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
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1_500 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    if (await openButton.isVisible().catch(() => false)) await openButton.click();
    else await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await expect(editor).toBeVisible();
  return editor;
}

async function openPickerViaEmptyLine(page: Page): Promise<Locator> {
  const line = page.getByTestId("event-command-empty-line").first();
  await expect(line).toBeAttached({ timeout: 8_000 });
  await line.evaluate((node) => {
    node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  });
  const picker = page.getByTestId("event-command-picker").first();
  await expect(picker).toBeVisible({ timeout: 8_000 });
  return picker;
}

type Item = { testId: string; label: string };

test("sweep every 지도·화면 효과 item (fresh dialog each item)", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  await openEventEditor(page);
  let picker = await openPickerViaEmptyLine(page);

  const tab = picker.getByTestId("event-command-picker-tab-3");
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(300);

  await picker.screenshot({ path: `${DIR}/00-picker-tab3-full.png` });

  const buttons = picker.locator('[data-testid^="command-picker-add-"], [data-testid^="command-picker-info-"]');
  const count = await buttons.count();
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const tid = (await buttons.nth(i).getAttribute("data-testid")) ?? `idx-${i}`;
    if (!items.some((x) => x.testId === tid)) items.push({ testId: tid, label: "" });
  }
  await writeFile(`${DIR}/inventory.json`, JSON.stringify(items, null, 2), "utf8");

  const manifest: Record<string, string> = {};
  for (const item of items) {
    // 시작 상태: 편집기만 열려 있음 (피커/서브다이얼로그 모두 닫힘)
    picker = await openPickerViaEmptyLine(page);
    const tab2 = picker.getByTestId("event-command-picker-tab-3");
    await tab2.click();
    await expect(tab2).toHaveAttribute("aria-selected", "true");

    const btn = picker.locator(`[data-testid="${item.testId}"]`).first();
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.click();

    // 클릭 결과물(피커+서브다이얼로그+폼)이 안정될 때까지 대기
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${DIR}/item-${item.testId.replace(/^command-picker-(add|info)-/, "")}.png` });
    manifest[item.testId] = `${DIR}/item-${item.testId.replace(/^command-picker-(add|info)-/, "")}.png`;

    // 정리: Escape를 최대 6회 — modalStack이 최상위 한 겹씩 닫는다
    for (let i = 0; i < 6; i++) {
      const anyOverlay = page.locator(".event-subdialog-backdrop, [data-testid='event-command-picker']").first();
      if (!(await anyOverlay.isVisible().catch(() => false))) break;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
    await expect(page.locator(".event-subdialog-backdrop").first()).toHaveCount(0);
    await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  }

  await writeFile(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2), "utf8");
  console.log("MAP_ITEMS_COUNT", items.length, "CAPTURED", Object.keys(manifest).length);
  expect(Object.keys(manifest).length).toBe(items.length);
});
