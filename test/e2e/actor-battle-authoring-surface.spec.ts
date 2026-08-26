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
 * 탭 2 「동료 · 전투」 저작 작업면 계약.
 * 계획: `.omo/plans/event-editor-actor-battle-adversarial-review.md`
 *
 * - 명령을 고르면 피커는 닫힌다(한 레이어). 확인이 뒷창에 삼키지 않는다.
 * - 트룹은 카드다: 전장 + 몬스터 아트. 빈 검 배지는 없다.
 * - 파티는 얼굴 칩. 수치는 게이지. 얼굴 변경은 faceset 크롭.
 * - 탭 그리드에 고를 수 없는 정보 행은 0개.
 */
test.setTimeout(180_000);

const EVIDENCE_DIR = process.env.TAB2_EVIDENCE_DIR ?? "output/evidence/remaining-tab2";
const SURFACE_HEADINGS = ["전투", "파티", "능력·성장", "모습·이름"];

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

test("companions and battle tab is one authoring layer with troop art, face chips, and gauges", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(picker, 2);

  // IA: 작업면 헤딩만. RM 분류명(배우/전투 · 전투 전용)이나 시스템 쓰레기통은 없다.
  const headings = await pickerGrid(picker).locator(".event-command-picker-group-heading").allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  for (const heading of headings) expect(SURFACE_HEADINGS).toContain(heading.trim());

  // 그리드에 고를 수 없는 정보 행은 없다 — 허위 발견성 금지.
  await expect(pickerGrid(picker).locator(".event-command-picker-command.is-informational")).toHaveCount(0);
  await expect(pickerGrid(picker).locator(".event-command-picker-command:disabled")).toHaveCount(0);
  await shot(page, picker, "01-picker-tab2.png");

  // ── 전투: 한 레이어 + 트룹 카드 + 몬스터 아트 ─────────────────────────
  const battleDialog = await pickCommand(page, picker, "전투...");
  await expect(picker, "명령을 고르면 피커는 닫힌다(한 레이어)").toBeHidden();
  const battlePreview = battleDialog.getByTestId("event-command-preview-body");
  await expect(battlePreview.getByTestId("ecp-troop-card")).toBeVisible();
  await expect(battlePreview.locator(".ecp-battle-badge")).toHaveCount(0);
  await expect(battlePreview.getByTestId("ecp-battle-enemy-missing")).toBeVisible();

  const troopSelect = battleDialog.getByTestId("battle-processing-troop-select");
  const troopValue = await firstRecordValue(troopSelect);
  await troopSelect.selectOption(troopValue);
  await expect(battlePreview.getByTestId("ecp-battle-enemy-missing")).toHaveCount(0);
  expect(await battlePreview.locator(".ecp-battle-enemy, .ecp-battle-enemy-fallback").count()).toBeGreaterThanOrEqual(1);
  await expect(battlePreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, battlePreview, "02-battle-troop-card.png");
  await battleDialog.getByTestId("event-command-edit-cancel").click();
  await expect(battleDialog).toHaveCount(0);

  // ── 파티: 얼굴 칩 전/후 ────────────────────────────────────────────
  const partyPicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(partyPicker, 2);
  const partyDialog = await pickCommand(page, partyPicker, "파티 멤버 변경...");
  await expect(partyPicker).toBeHidden();
  const partyPreview = partyDialog.getByTestId("event-command-preview-body");
  await expect(partyPreview.getByTestId("ecp-party-stage")).toBeVisible();
  await expect(partyPreview.getByTestId("ecp-party-before")).toBeVisible();
  await expect(partyPreview.getByTestId("ecp-party-after")).toBeVisible();
  expect(await partyPreview.locator(".ecp-party-chip").count()).toBeGreaterThanOrEqual(2);
  expect(await partyPreview.locator(".event-command-face-crop-shell").count()).toBeGreaterThanOrEqual(2);
  await expect(partyPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, partyPreview, "03-party-face-chips.png");
  await partyDialog.getByTestId("event-command-edit-cancel").click();

  // ── 수치: HP 게이지 (문장 카드 금지) ───────────────────────────────
  const hpPicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(hpPicker, 2);
  const hpDialog = await pickCommand(page, hpPicker, "HP 변경...");
  await expect(hpPicker).toBeHidden();
  const hpPreview = hpDialog.getByTestId("event-command-preview-body");
  expect(await hpPreview.getByTestId("ecp-gauge-hp").count()).toBeGreaterThanOrEqual(1);
  await expect(hpPreview.getByTestId("ecp-gauge-hp").first()).toBeVisible();
  await expect(hpPreview.locator(".ecp-gauge-fill").first()).toBeVisible();
  await expect(hpPreview.getByTestId("ecp-gauge-numbers-hp").first()).toContainText("→");
  await expect(hpPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, hpPreview, "04-hp-gauge.png");
  await hpDialog.getByTestId("event-command-edit-cancel").click();

  // ── 얼굴 변경: faceset 크롭 ───────────────────────────────────────
  const facePicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(facePicker, 2);
  const faceDialog = await pickCommand(page, facePicker, "주인공 얼굴 변경...");
  await expect(facePicker).toBeHidden();
  const facePreview = faceDialog.getByTestId("event-command-preview-body");
  await expect(facePreview.getByTestId("ecp-faceset-change-stage")).toBeVisible();
  await expect(
    facePreview.getByTestId("ecp-faceset-after").locator(".event-command-face-crop-shell")
  ).toHaveCount(1);
  await expect(facePreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, facePreview, "05-faceset-crop.png");

  // 확인은 유일한 1차 액션 — 뒷창 없이 스토리보드에 명령이 남는다.
  await faceDialog.getByTestId("event-command-edit-ok").click();
  await expect(faceDialog).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await expect(editor.getByTestId("event-storyboard-card-0")).toBeVisible();
  await shot(page, editor, "06-storyboard-after-confirm.png");
});

async function firstRecordValue(select: Locator): Promise<string> {
  const values = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value).filter((value) => value.length > 0)
  );
  const first = values[0];
  if (!first) throw new Error("record picker has no selectable option");
  return first;
}

async function shot(page: Page, target: Locator | Page, name: string): Promise<void> {
  const file = path.join(EVIDENCE_DIR, name);
  if ("screenshot" in target && target !== page) {
    await (target as Locator).screenshot({ path: file });
    return;
  }
  await page.screenshot({ path: file, fullPage: false });
}
