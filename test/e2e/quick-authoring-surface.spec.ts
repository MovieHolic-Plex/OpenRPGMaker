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
 * 탭 1 「빠른 저작」 저작 작업면 계약.
 * 계획: `.omo/plans/event-editor-quick-authoring-adversarial-review.md`
 *
 * - 한 레이어: 명령을 고르면 피커는 닫힌다.
 * - 말하기: 빈 본문이어도 게임 창에 샘플 대사와 얼굴이 보인다. `...` 만 남으면 실패.
 * - 이동: 장소 이동은 클릭 가능한 맵, 이동 경로는 기본 한 걸음 궤적.
 * - 거래: 첫 화면에 판매 목록 ≥ 1, 자료집 카탈로그는 접혀 있다.
 * - 탭 그리드에 고를 수 없는 안내 행 0개. 28행 전수 삽입은 성공 조건이 아니다.
 */
test.setTimeout(180_000);

const EVIDENCE_DIR = process.env.TAB1_EVIDENCE_DIR ?? "output/evidence/remaining-tab1";
const SURFACE_HEADINGS = ["말하기", "고르기", "옮기기", "거래", "흐름", "소리"];

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

test("quick authoring tab is a story work surface: speak, face, map, route, shop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);

  // ── 진입: 빈 이벤트 CTA 는 말하기 / 장소 옮기기 / 상점 열기 ─────────────
  const quickStarts = editor.getByTestId("event-storyboard-quick-starts");
  await expect(quickStarts).toBeVisible();
  await expect(editor.getByTestId("event-storyboard-quick-text")).toBeVisible();
  await expect(editor.getByTestId("event-storyboard-quick-transfer")).toBeVisible();
  await expect(editor.getByTestId("event-storyboard-quick-shop")).toBeVisible();
  await shot(page, editor, "00-empty-event-cta.png");

  const picker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(picker, 1);

  // IA: 작업면 헤딩만. RM 분류명(대화/입력 · 보상/상점)이 아니다.
  const headings = await pickerGrid(picker).locator(".event-command-picker-group-heading").allTextContents();
  expect(headings.length).toBeGreaterThan(0);
  for (const heading of headings) expect(SURFACE_HEADINGS).toContain(heading.trim());

  // 고를 수 없는 안내 행은 0개 — 허위 발견성 금지.
  await expect(pickerGrid(picker).locator(".event-command-picker-command.is-informational")).toHaveCount(0);
  await expect(pickerGrid(picker).locator(".event-command-picker-command:disabled")).toHaveCount(0);
  await expect(pickerGrid(picker).getByTestId("command-picker-add-comment")).toHaveCount(0);
  await shot(page, picker, "01-picker-tab1.png");

  // ── 말하기: 빈 본문에도 샘플 대사 + 얼굴 ───────────────────────────
  const textDialog = await pickCommand(page, picker, "문장 표시...");
  await expect(picker, "명령을 고르면 피커는 닫힌다(한 레이어)").toBeHidden();
  // 문장 표시는 전용 편집면이 자기 LIVE 무대를 그린다 — 범용 프리뷰 패널이 아니다.
  const textPreview = textDialog;
  const messageWindow = textPreview.getByTestId("ecp-message-window").first();
  await expect(messageWindow).toBeVisible();
  await expect(messageWindow).toHaveAttribute("data-sample", "true");
  const sampleBody = (await textPreview.getByTestId("ecp-message-body").first().innerText()).trim();
  expect(sampleBody.length).toBeGreaterThan(3);
  expect(sampleBody).not.toBe("...");
  expect(await messageWindow.locator(".event-command-face-crop-shell").count()).toBeGreaterThanOrEqual(1);
  await expect(textPreview.locator(".ecp-summary-card")).toHaveCount(0);
  await expect(textPreview.getByTestId("ecp-message-sample-note").first()).toBeVisible();
  await shot(page, messageWindow, "02-speak-sample-stage.png");
  await textDialog.getByTestId("event-command-edit-cancel").click();
  await expect(textDialog).toHaveCount(0);

  // ── 얼굴: faceset 크롭 ────────────────────────────────────────────
  const facePicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(facePicker, 1);
  const faceDialog = await pickCommand(page, facePicker, "얼굴 바꾸기...");
  await expect(facePicker).toBeHidden();
  const facePreview = faceDialog;
  expect(await facePreview.locator(".event-command-face-crop-shell").count()).toBeGreaterThanOrEqual(1);
  await expect(facePreview.locator(".ecp-summary-card")).toHaveCount(0);
  await shot(page, facePreview, "03-face-crop.png");
  await faceDialog.getByTestId("event-command-edit-cancel").click();

  // ── 이동: 클릭 가능한 맵 ──────────────────────────────────────────
  const transferPicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(transferPicker, 1);
  const transferDialog = await pickCommand(page, transferPicker, "장소 이동...");
  await expect(transferPicker).toBeHidden();
  const mapCanvas = transferDialog.getByTestId("transfer-player-map-preview");
  await expect(mapCanvas).toBeVisible();
  const beforeTarget = await transferDialog.getByTestId("transfer-player-target").innerText();
  const canvasBox = await mapCanvas.boundingBox();
  if (!canvasBox) throw new Error("transfer map preview has no box");
  await mapCanvas.click({ position: { x: Math.floor(canvasBox.width * 0.7), y: Math.floor(canvasBox.height * 0.6) } });
  await expect(transferDialog.getByTestId("transfer-player-target")).not.toHaveText(beforeTarget);
  // 좌표는 요약에 반영된다 — 클릭이 실제로 목적지를 옮겼다는 증거.
  await expect(transferDialog.getByTestId("transfer-command-summary")).toContainText("(");
  await shot(page, transferDialog, "04-transfer-map.png");
  await transferDialog.getByTestId("event-command-edit-cancel").click();

  // ── 경로: 기본 한 걸음 궤적 ───────────────────────────────────────
  const routePicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(routePicker, 1);
  const routeDialog = await pickCommand(page, routePicker, "이동 경로 설정...");
  await expect(routePicker).toBeHidden();
  // 이동 경로도 전용 편집면이 자기 무대를 그린다.
  const routePreview = routeDialog;
  await expect(routePreview.getByTestId("ecp-move-grid-box").first()).toBeVisible();
  await expect(routePreview.getByTestId("ecp-move-grid-box").first()).toContainText("궤적");
  expect(await routePreview.locator(".ecp-move-step, .ecp-move-line").count()).toBeGreaterThanOrEqual(1);
  await expect(routePreview.getByTestId("ecp-move-tape").first()).not.toContainText("이동 명령 없음");
  await shot(page, routePreview.getByTestId("ecp-move-preview").first(), "05-move-route-trajectory.png");
  await routeDialog.getByTestId("event-command-edit-cancel").click();

  // ── 거래: 첫 화면 진열 ≥ 1, 담긴 행이 맨 위 ────────────────────────
  const shopPicker = await openCommandPicker(page, "quick-next");
  await openPickerTab(shopPicker, 1);
  const shopDialog = await pickCommand(page, shopPicker, "상점...");
  await expect(shopPicker).toBeHidden();
  // 첫 화면은 진열대다: 잡화점 프리셋이 이미 깔려 있고 빈 상점 배너는 없다.
  await expect(shopDialog.getByTestId("shop-header-badge")).toContainText("3");
  await expect(shopDialog.getByTestId("shop-empty-banner")).toHaveCount(0);
  await expect(shopDialog).toContainText("회복약");
  // 첫 화면에는 진열한 상품만 있고 자료집은 상품 추가에서 연다.
  const saleRows = shopDialog.locator('[data-testid="shop-sale-list"] [data-testid^="shop-item-row-"]');
  await expect(saleRows).toHaveCount(3);
  await expect(shopDialog.getByTestId("shop-stock-pool")).toHaveCount(0);
  await expect(shopDialog.getByTestId("shop-add-goods")).toBeVisible();
  await expect(shopDialog.getByTestId("shop-item-catalog")).toBeVisible();
  await shot(page, shopDialog, "06-shop-stock.png");

  // 상점 미리보기(플레이 창)에도 판매 목록이 최소 하나 그려진다.
  await shopDialog.getByTestId("shop-preview-toggle").click();
  const shopWindow = shopDialog.getByTestId("ecp-shop-window").first();
  await expect(shopWindow).toBeVisible();
  await expect(shopDialog.getByTestId("ecp-shop-empty-warn")).toHaveCount(0);
  expect(await shopWindow.locator(".ecp-shop-item-row").count()).toBeGreaterThanOrEqual(1);
  await shot(page, shopWindow, "06b-shop-window.png");

  // 확인은 유일한 1차 액션 — 피커가 뒤에 남지 않고 스토리보드에 명령이 생긴다.
  await shopDialog.getByTestId("event-command-edit-ok").click();
  await expect(shopDialog).toHaveCount(0);
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await expect(editor.getByTestId("event-storyboard-card-0")).toBeVisible();
  await shot(page, editor, "07-storyboard-after-confirm.png");
});

async function shot(page: Page, target: Locator | Page, name: string): Promise<void> {
  const file = path.join(EVIDENCE_DIR, name);
  if (target !== page) {
    await (target as Locator).screenshot({ path: file });
    return;
  }
  await page.screenshot({ path: file, fullPage: false });
}
