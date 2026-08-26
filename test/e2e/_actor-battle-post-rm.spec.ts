// test/e2e/_actor-battle-post-rm.spec.ts
// RM2003 UI 작별 후 「동료 · 전투」 저작 작업면 계약(event-editor-actor-battle-post-rm plan §3).
//
// 현재 코드 실측 결함 4건을 RED 로 증명한다.
//   1) 피커 스태킹  : 명령을 고르면 피커가 편집 창 뒤에 남는다 (stackedPickerBehind === true).
//   2) 보이지 않는 배지 : .ecp-battle-badge 색이 배경과 같다 (color === backgroundColor).
//   3) 무명 변수 덤프   : 전투 트룹 "변수" 모드의 변수 목록이 "(이름 없음)" 슬롯을 늘어놓는다.
//   4) 빠진 faceset 크롭 : 얼굴 변경 커맨드 프리뷰가 요약 폴백이고 faceset 크롭 DOM 이 없다.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test.setTimeout(180_000);

const EVIDENCE_DIR = "output/evidence/event-editor-actor-battle-post-rm/red";

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-actor-battle-post-rm");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("1) command picker closes instead of stacking behind the edit dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  const editor = await openEventEditor(page);
  await expect(editor).toBeVisible();
  await openCommandPicker(page);

  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-2").click();

  const battle = picker.getByTestId("command-picker-add-battleProcessing");
  await expect(battle).toBeVisible();
  await battle.click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();

  // 계약: stackedPickerBehind === false — 명령을 고르면 피커는 닫혀 있어야 한다.
  const stackedBehind = await picker.isVisible();
  await shot(page, "01-stacked-picker.png");
  expect(
    stackedBehind,
    "stackedPickerBehind must be false: picker should close when a command opens its edit dialog",
  ).toBe(false);
});

test("2) battle preview badge paints text distinct from its background", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  const editor = await openEventEditor(page);
  await openCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("event-command-picker-tab-2").click();
  await picker.getByTestId("command-picker-add-battleProcessing").click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  const preview = dialog.getByTestId("event-command-preview");
  await expect(preview).toBeVisible();

  // 빈 전투는 .ecp-battle-badge("⚔") 를 렌더한다.
  const badge = preview.locator(".ecp-battle-badge").first();
  await expect(badge).toBeVisible();
  const colors = await badge.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, backgroundColor: style.backgroundColor };
  });
  await shot(page, "02-battle-badge.png", preview);
  expect(
    colors.color !== colors.backgroundColor,
    `.ecp-battle-badge color(${colors.color}) must differ from backgroundColor(${colors.backgroundColor})`,
  ).toBe(true);
});

test("3) battle troop variable picker lists only named variables (no unnamed dump)", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  const editor = await openEventEditor(page);
  await openCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("event-command-picker-tab-2").click();
  await picker.getByTestId("command-picker-add-battleProcessing").click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();

  // 트룹을 "변수" 로 고르면 무명 변수 슬롯이 펼쳐진다.
  await dialog.getByTestId("battle-processing-troop-source-segment-variable").click();
  const variableField = dialog.getByTestId("battle-processing-troop-variable");
  await expect(variableField).toBeVisible();

  const unnamedCount = await variableField
    .locator("select option")
    .evaluateAll((options) =>
      options.filter((option) => option.textContent?.trim() === "(이름 없음)").length,
    );
  await shot(page, "03-troop-variable-dump.png", dialog);
  expect(
    unnamedCount,
    "variable picker must list only named slots — found unnamed '(이름 없음)' dump",
  ).toBe(0);
});

test("4) actor faceset change preview renders a faceset crop", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  const editor = await openEventEditor(page);
  await openCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("event-command-picker-tab-2").click();

  // m2 "Change Actor Faceset" (인덱스 25) — 동료 · 전투 탭.
  const faceset = picker.getByTestId("command-picker-add-m2-025-change-actor-faceset");
  await faceset.click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  const preview = dialog.getByTestId("event-command-preview");
  await expect(preview).toBeVisible();

  // 계약: 얼굴 변경 미리보기는 faceset 크롭이다. 요약 폴백은 실패.
  const cropShell = preview.getByTestId("event-command-face-crop-shell");
  const facePreview = preview.getByTestId("event-command-face-preview");
  const cropPresent =
    (await cropShell.count()) > 0 || (await facePreview.count()) > 0;
  await shot(page, "04-faceset-change.png", preview);
  expect(
    cropPresent,
    "faceset change preview must render a faceset crop, not a handler-less summary fallback",
  ).toBe(true);
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

async function openCommandPicker(page: Page): Promise<void> {
  const picker = page.getByTestId("event-command-picker").first();
  if (await picker.isVisible().catch(() => false)) return;
  const searchTemplate = page.getByTestId("event-template-empty-search").first();
  const templateVisible = await searchTemplate.isVisible().catch(() => false);
  if (templateVisible) {
    await searchTemplate.click();
  } else {
    const emptyLine = page.getByTestId("event-command-empty-line").first();
    await emptyLine.evaluate((node) => {
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
  }
  await expect(picker).toBeVisible({ timeout: 8_000 });
}

async function shot(page: Page, name: string, locator?: Locator): Promise<void> {
  const dest = path.join(EVIDENCE_DIR, name);
  if (locator && (await locator.count()) > 0) {
    await locator.screenshot({ path: dest });
    return;
  }
  await page.screenshot({ path: dest, fullPage: false });
}
