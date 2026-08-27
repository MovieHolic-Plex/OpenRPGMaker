import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  openCommandPicker,
  openMapEventEditor,
  openPickerTab,
  pickCommand,
  pickerGrid,
} from "./eventStoryboardPicker";

/**
 * 탭 3 「지도 · 화면 효과」 저작 작업면 계약.
 * 계획: `.omo/plans/event-editor-map-screen-effects-adversarial-review.md`
 *
 * - 스토리보드 CTA → 탭 3 두 클릭. 조명 · 날씨 · 그림 · 화면 효과가 모두 여기 있다.
 * - 화면 효과 / 카메라 미리보기는 미니 캔버스 무대다. 토큰 요약 카드면 실패.
 * - 지형 변경은 칩셋 크롭 + 팔레트. 번호 스와치면 실패.
 * - 헤딩은 작업면 다섯 개(지도 · 조명·날씨 · 그림 · 화면 연출 · 값 읽기)뿐.
 * - 한 레이어: 명령을 고르면 피커는 닫힌다.
 */
test.setTimeout(180_000);

const EVIDENCE_DIR = process.env.TAB3_EVIDENCE_DIR ?? "output/evidence/remaining-tab3";
const SURFACE_HEADINGS = ["지도", "조명·날씨", "그림", "화면 연출", "값 읽기"];

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("map and screen tab is a staging work surface: effects, camera, lighting, weather, picture, chipset", async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);

  // ── 발견성: 스토리보드 CTA → 탭 3 (두 클릭) ───────────────────────
  const picker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(picker, 3);
  await shot(page, picker, "20-picker-tab3-repaired.png");

  const headings = await pickerGrid(picker).locator(".event-command-picker-group-heading").allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  for (const heading of headings) expect(SURFACE_HEADINGS).toContain(heading.trim());

  // 고를 수 없는 안내 행 0개 — 허위 발견성 금지.
  await expect(pickerGrid(picker).locator(".event-command-picker-command.is-informational")).toHaveCount(0);

  // 조명 · 날씨 · 그림 · 화면 효과 · 카메라 · 지형이 전부 탭 3에 있다.
  for (const testId of [
    "command-picker-add-setLighting",
    "command-picker-add-setWeather",
    "command-picker-add-showPicture",
    "command-picker-add-m2-202-screen-effect",
    "command-picker-add-m2-201-camera-control",
    "command-picker-add-changeTile",
  ]) {
    await expect(pickerGrid(picker).getByTestId(testId).first()).toBeVisible();
  }

  // 날씨 통일: 네이티브 「날씨 설정」이 레거시 m2-050 위에 온다.
  const weatherOrder = await pickerGrid(picker).evaluate((grid) => {
    const ids = Array.from(grid.querySelectorAll<HTMLElement>(".event-command-picker-command-wrap"))
      .map((wrap) => wrap.dataset.commandId ?? "");
    return { native: ids.indexOf("setWeather"), legacy: ids.indexOf("m2-050-set-weather-effects") };
  });
  expect(weatherOrder.native).toBeGreaterThanOrEqual(0);
  expect(weatherOrder.legacy).toBeGreaterThan(weatherOrder.native);

  // ── 화면 효과: 공용 미니 모니터 무대 + 필드 반응 ────────────────
  const effectDialog = await pickCommand(page, picker, "화면 효과...");
  await expect(picker, "명령을 고르면 피커는 닫힌다(한 레이어)").toBeHidden();
  const effectPreview = effectDialog.getByTestId("event-command-preview");
  const effectStage = effectPreview.getByTestId("ecp-screen-effect-stage");
  await expect(effectStage).toBeVisible();
  await expect(effectPreview.getByTestId("ecp-screen-effect-scene")).toBeVisible();
  const overlay = effectPreview.getByTestId("ecp-screen-effect-overlay");
  await expect(overlay).toBeAttached();
  await expect(effectPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await expect(effectPreview.getByTestId("ecp-runtime-effect")).toHaveCount(0);
  const beforeBackground = await overlay.evaluate((node) => (node as HTMLElement).style.background);
  await shot(page, effectPreview, "21-screen-effect-fadein.png");

  // 필드를 바꾸면 무대가 바뀐다 — 캐션만 같은 폴백이 아니다.
  const effectOptions = await effectDialog.getByTestId("m2-command-effect-option-select").locator("option").evaluateAll(
    (nodes) => nodes.map((node) => (node as HTMLOptionElement).value),
  );
  expect(effectOptions).not.toContain("blur");
  await effectDialog.getByTestId("m2-command-effect-option-select").selectOption("tint");
  await effectDialog.getByTestId("m2-command-value-input").fill("red");
  await effectDialog.getByTestId("m2-command-value-input").blur();
  await expect(effectStage).toHaveAttribute("data-effect", "tint");
  const afterBackground = await effectPreview.getByTestId("ecp-screen-effect-overlay").evaluate(
    (node) => (node as HTMLElement).style.background,
  );
  expect(afterBackground).not.toBe(beforeBackground);
  expect(afterBackground.replace(/\s+/g, "")).toContain("255,0,0");
  await shot(page, effectPreview, "22-screen-effect-tint-red.png");
  await effectDialog.getByTestId("event-command-edit-cancel").click();
  await expect(effectDialog).toHaveCount(0);

  // ── 레거시 RM 화면 행도 같은 무대에 서다 ──────────────────
  const legacyPicker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(legacyPicker, 3);
  const legacyDialog = await pickCommand(page, legacyPicker, "화면 색조 변경...");
  await expect(legacyPicker).toBeHidden();
  const legacyPreview = legacyDialog.getByTestId("event-command-preview");
  await expect(legacyPreview.getByTestId("ecp-screen-effect-stage")).toHaveAttribute("data-effect", "tint");
  await expect(legacyPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, legacyPreview, "23-legacy-tint-screen.png");
  await legacyDialog.getByTestId("event-command-edit-cancel").click();
  await expect(legacyDialog).toHaveCount(0);

  // ── 카메라 제어: 뷰포트가 대상까지 이동한다 ────────────────────────
  const cameraPicker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(cameraPicker, 3);
  const cameraDialog = await pickCommand(page, cameraPicker, "카메라 제어...");
  await expect(cameraPicker).toBeHidden();
  const cameraPreview = cameraDialog.getByTestId("event-command-preview");
  await expect(cameraPreview.getByTestId("ecp-camera-stage")).toBeVisible();
  expect(await cameraPreview.locator("canvas.ecp-fx-canvas").count()).toBe(3);
  await expect(cameraPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await cameraDialog.getByTestId("m2-command-zoom-input").fill("2");
  await cameraDialog.getByTestId("m2-command-zoom-input").blur();
  await expect(cameraPreview.getByTestId("ecp-camera-stage")).toHaveAttribute("data-zoom", "2");
  await shot(page, cameraPreview, "24-camera-control.png");
  await cameraDialog.getByTestId("event-command-edit-cancel").click();

  // ── 조명 / 날씨 / 그림: 이미 정직한 무대 (증거 갱신) ───────────────
  for (const [label, name] of [
    ["조명 설정", "25-set-lighting.png"],
    ["날씨 설정", "26-set-weather.png"],
    ["그림 표시...", "27-show-picture.png"],
  ] as const) {
    const nextPicker = await openCommandPicker(page, "storyboard-cta");
    await openPickerTab(nextPicker, 3);
    const dialog = await pickCommand(page, nextPicker, label);
    await expect(nextPicker).toBeHidden();
    const preview = dialog.getByTestId("event-command-preview");
    await expect(preview.locator(".ecp-summary-card")).toHaveCount(0);
    await shot(page, dialog, name);
    await dialog.getByTestId("event-command-edit-cancel").click();
    await expect(dialog).toHaveCount(0);
  }

  // ── 지형 변경: 칩셋 크롭 + 같은 줄 팔레트 ─────────────────────────
  const tilePicker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(tilePicker, 3);
  const tileDialog = await pickCommand(page, tilePicker, "지형 변경...");
  await expect(tilePicker).toBeHidden();
  const tilePreview = tileDialog.getByTestId("event-command-preview");
  const chipsel = tilePreview.getByTestId("ecp-tile-chipsel");
  await expect(chipsel).toBeVisible();
  const chip = tilePreview.getByTestId("ecp-tile-chip-selected");
  await expect(chip).toBeVisible();
  expect(await chip.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("url(");
  expect(await tilePreview.getByTestId("ecp-tile-chip-strip").locator(".ecp-tile-chip").count()).toBeGreaterThanOrEqual(4);
  await expect(tilePreview.locator(".ecp-tile-swatch")).toHaveCount(0);
  await shot(page, tilePreview, "28-change-tile-chipsel.png");

  // 번호를 바꾸면 칩이 다른 그림을 가리킨다.
  await tileDialog.getByTestId("change-tile-tile-input").fill("18");
  await tileDialog.getByTestId("change-tile-tile-input").blur();
  await expect(chipsel).toHaveAttribute("data-tile", "18");
  await shot(page, tilePreview, "29-change-tile-chipsel-18.png");

  // 확인 → 스토리보드에 남는다. 피커가 뒤에 남지 않는다.
  await tileDialog.getByTestId("event-command-edit-ok").click();
  await expect(tileDialog).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await expect(editor.getByTestId("event-storyboard-card-0")).toBeVisible();
  await shot(page, editor, "30-storyboard-after-confirm.png");
});

async function shot(page: Page, target: Locator | Page, name: string): Promise<void> {
  const file = path.join(EVIDENCE_DIR, name);
  if (target !== page) {
    await (target as Locator).screenshot({ path: file });
    return;
  }
  await page.screenshot({ path: file, fullPage: false });
}
