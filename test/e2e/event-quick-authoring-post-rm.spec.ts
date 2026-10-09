import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const EVIDENCE_DIR = "output/evidence/event-quick-authoring-post-rm";

async function dumpEvidence(
  page: Page,
  name: string,
  metrics: Record<string, unknown>,
): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
  writeFileSync(
    join(EVIDENCE_DIR, `${name}.json`),
    `${JSON.stringify({ name, ...metrics, at: new Date().toISOString() }, null, 2)}\n`,
  );
}

/**
 * post-RM 「빠른 저작」 계약 — .omo/plans/event-editor-quick-authoring-adversarial-review.md
 *
 * 이 스펙은 RM2003 표면(4탭 PDF 카탈로그·말줄임표·선택 불가 안내 행·모달 스택·28행 전수
 * 리스트)을 성공 기준으로 삼지 않는다. 「빠른 저작」은 명령 덤프가 아니라 이야기 작업면이다:
 * 말하기·이동·거래 미리보기가 한 화면에서 보여야 하고, 명령을 고르면 피커는 닫히고, 상점은
 * 빈 상점+아이콘 홍수가 아니라 판매 목록이 보여야 한다.
 *
 * RED 단계: 제품 코드는 아직 이 계약을 만족하지 않으므로 아래 결함 단언들이 실패해야 한다.
 */

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-quick-authoring-post-rm");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
});

/** 레이어 → 이벤트 도구 → 캔버스 더블클릭으로 이벤트 에디터 모달을 연다. */
async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const eventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await eventTool.count()) > 0) await eventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

/** + 버튼으로 피커를 열고 「빠른 저작」 탭(1번)을 고른다. */
async function openPicker(editor: Locator, page: Page): Promise<Locator> {
  const current = page.getByTestId("event-command-picker");
  if (await current.isVisible().catch(() => false)) {
    await current.getByTestId("event-command-picker-tab-1").click();
    return current;
  }
  await editor.getByTestId("event-command-toolbar-add").click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-1").click();
  await expect(picker.getByTestId("event-command-picker-tab-1")).toHaveAttribute("aria-selected", "true");
  return picker;
}

/** 피커에서 카탈로그 명령(m2-*) 행을 눌러 편집 다이얼로그를 연다. */
async function pickCommand(editor: Locator, page: Page, commandId: string): Promise<Locator> {
  const picker = await openPicker(editor, page);
  const button = picker
    .locator(`.event-command-picker-command-wrap[data-command-id="${commandId}"] .event-command-picker-command`)
    .first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** 편집 다이얼로그 안에서 페이스셋 이미지/캔버스/크롭 박스가 실제로 보이는지 확인한다. */
async function dialogFacesetVisible(dialog: Locator): Promise<boolean> {
  return dialog.evaluate((host) => {
    const h = host as HTMLElement;
    const imgRendered = Array.from(h.querySelectorAll<HTMLImageElement>("img")).some(
      (img) => img.complete && img.naturalWidth > 0,
    );
    if (imgRendered) return true;
    const canvasRendered = Array.from(h.querySelectorAll<HTMLCanvasElement>("canvas")).some(
      (canvas) => canvas.width > 0 && canvas.height > 0,
    );
    if (canvasRendered) return true;
    const cropBox = h.querySelector(
      '[data-testid="event-command-faceset-crop"], .faceset-crop-box, [data-testid="faceset-crop"]',
    );
    return Boolean(cropBox);
  });
}

/** 이동 경로 미리보기 격자 위 궤적 노드 수(시작점 포함)를 센다. */
async function moveTrajectoryNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-testid="ecp-move-grid-box"]');
    if (!grid) return 0;
    return grid.querySelectorAll(".ecp-move-start, .ecp-move-step").length;
  });
}

const COMMAND_IDS = {
  showText: "m2-001-show-text",
  changeFaceset: "m2-003-change-faceset",
  showChoices: "m2-004-show-choices",
  transferPlayer: "m2-035-transfer-player",
  moveEvent: "m2-057-move-event",
  shopProcessing: "m2-032-shop-processing",
} as const;

test("빠른 저작 탭1: 선택 불가 안내 행 0 — 작업면은 카탈로그 1페이지가 아니라 이야기다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const picker = await openPicker(editor, page);

  // 「빠른 저작」 작업면에 aria-disabled=true 명령 행이 하나도 없어야 한다.
  await expect(picker.locator('.event-command-picker-command[aria-disabled="true"]')).toHaveCount(0);
  const pickerDump = await picker.evaluate((host) => (host as HTMLElement).outerHTML);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, "picker-tab1-dom.html"), pickerDump);
  await dumpEvidence(page, "tab1-no-disabled-rows", {
    ariaDisabledCommandRows: 0,
    stackedPickerBehind: false,
  });
});

test("한 레이어: 명령을 고르면 피커는 닫힌다 — 모달 스택 없음", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const picker = await openPicker(editor, page);

  const showText = picker
    .locator(`.event-command-picker-command-wrap[data-command-id="${COMMAND_IDS.showText}"] .event-command-picker-command`)
    .first();
  await showText.scrollIntoViewIfNeeded();
  await showText.click();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();

  // 편집 창이 열리는 순간 뒤에 남은 피커가 없어야 한다(피커 count 0).
  await expect(picker).toHaveCount(0);
  await dumpEvidence(page, "picker-closes-on-select", {
    stackedPickerBehind: false,
    pickerCount: 0,
  });
});

test("문장 표시 라이브 프리뷰는 '...' 로만 끝나지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const dialog = await pickCommand(editor, page, COMMAND_IDS.showText);

  const livePreview = page.getByTestId("event-command-text-live-preview");
  await expect(livePreview).toHaveCount(1);
  // 빈 본문이어도 샘플 문장·얼굴이 보여야 한다. innerText 가 '...' 만이면 실패다.
  // (toHaveText 는 textContent 로 비교해 캡션까지 포함하므로, 보이는 innerText 를 직접 본다.)
  expect((await livePreview.innerText()).trim()).not.toBe("...");
  await dumpEvidence(page, "show-text-live-preview", {
    livePreviewInnerText: (await livePreview.innerText()).trim(),
    stackedPickerBehind: (await page.getByTestId("event-command-picker").count()) > 0,
  });
});

test("얼굴 바꾸기 미리보기에 페이스셋 이미지/캔버스/크롭이 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const dialog = await pickCommand(editor, page, COMMAND_IDS.changeFaceset);

  // 카피만 있고 실제 페이스셋 그림이 없으면 실패다. crop DOM 또는 img/canvas 자연 크기 > 0.
  expect(await dialogFacesetVisible(dialog)).toBe(true);
  await dumpEvidence(page, "change-faceset-crop", { facesetGraphicVisible: true });
});

test("장소 이동 미리보기에 궤적 노드 ≥ 1 — '이동 단계 없음' 빈 카피만이면 실패", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const dialog = await pickCommand(editor, page, COMMAND_IDS.moveEvent);

  expect(await moveTrajectoryNodeCount(page)).toBeGreaterThanOrEqual(1);
  await dumpEvidence(page, "move-route-trail", {
    trajectoryNodes: await moveTrajectoryNodeCount(page),
  });
});

test("상점 미리보기에 판매 목록 ≥ 1 — 빈 상점 + 아이콘 홍수는 실패", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);
  const dialog = await pickCommand(editor, page, COMMAND_IDS.shopProcessing);

  const saleRows = dialog.locator('[data-testid="shop-sale-list"] [data-testid^="shop-item-row-"]');
  await expect(saleRows.first()).toBeVisible();
  expect(await saleRows.count()).toBeGreaterThanOrEqual(1);
  await expect(dialog.getByTestId("shop-stock-pool")).toHaveCount(0);
  await dialog.getByTestId("shop-add-goods").click();
  const picker = page.getByTestId("shop-catalog-dialog");
  const catalog = picker.getByTestId("shop-catalog-list");
  await expect(catalog).toBeVisible();
  const catalogScroll = await catalog.evaluate((node) => ({ clientH: node.clientHeight, scrollH: node.scrollHeight }));
  expect(catalogScroll.scrollH).toBeGreaterThan(catalogScroll.clientH);
  await dumpEvidence(page, "shop-stocked-catalog", {
    saleRows: await saleRows.count(),
    catalogRows: await catalog.locator('[data-testid^="shop-catalog-item-"]').count(),
    catalogScroll,
  });
  await picker.getByTestId("shop-catalog-cancel").click();
});

test("말하기·이동·상점·선택지 각 1회 삽입 — 28행 카탈로그 아님 + pageerror 0", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/?freshProject=1");
  const editor = await openEventEditor(page);

  const insert = async (commandId: string): Promise<void> => {
    const picker = await openPicker(editor, page);
    const button = picker
      .locator(`.event-command-picker-command-wrap[data-command-id="${commandId}"] .event-command-picker-command`)
      .first();
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const dialog = page.getByTestId("event-command-edit-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("event-command-edit-ok").click();
    await expect(dialog).toHaveCount(0);
  };

  // 말하기·이동·상점·선택지 — 각각 1회씩. 28행 전수 삽입은 성공 기준이 아니다.
  await insert(COMMAND_IDS.showText);
  await insert(COMMAND_IDS.transferPlayer);
  await insert(COMMAND_IDS.shopProcessing);
  await insert(COMMAND_IDS.showChoices);

  const roots = editor.locator('.cmd-item[data-cmd-depth="0"]');
  await expect(roots).toHaveCount(4);
  for (const kind of ["text", "transfer", "shop", "choices"] as const) {
    await expect(editor.getByTestId(`event-command-${kind}`)).toHaveCount(1);
  }

  expect(pageErrors).toEqual([]);
  await dumpEvidence(page, "four-insert-regression", {
    pageerrorCount: pageErrors.length,
    roots: 4,
    catalogLengthPassCondition: false,
  });
});
