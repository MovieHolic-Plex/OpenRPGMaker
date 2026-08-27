// test/e2e/_actor-battle-post-rm.spec.ts
// RM2003 UI 작별 후 「동료 · 전투」 저작 작업면 계약(.omo/plans/event-editor-actor-battle-adversarial-review.md
// 「재리뷰 계약」). 네 계약을 실제 Chromium 화면에서 GREEN 으로 증명하고 증거를 남긴다.
//
//   1) 한 레이어   : 명령을 고르면 피커가 닫힌다 (stackedPickerBehind === false).
//   2) 읽히는 배지 : .ecp-battle-badge 의 color 가 자기 backgroundColor 와 다르다.
//   3) 이름만 나열 : 전투 트룹 「변수」 모드 목록에 "(이름 없음)" 슬롯이 0건이다.
//   4) 얼굴 크롭   : 얼굴 변경 미리보기가 faceset 크롭 DOM 이다 (요약 폴백 금지).
//
// 증거: output/evidence/event-editor-actor-battle-post-rm/
//   07-picker-closed.png/.json · 05-battle-preview.png/.json ·
//   06-troop-variable-named.png/.json · 05-faceset-preview.png/.json · probe.json
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test.setTimeout(180_000);

/** 스크린샷·계약 JSON 이 쌓이는 곳. 로그는 이 아래 green/ 에 감독자가 저장한다. */
const EVIDENCE_DIR = "output/evidence/event-editor-actor-battle-post-rm";

/** afterAll 에서 probe.json 으로 합쳐 쓰는 계약 관측값. */
const probe: Record<string, unknown> = {};

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});

test.afterAll(async () => {
  await writeJson("probe.json", {
    surface: "event editor · 동료 · 전투 (post-RM)",
    plan: ".omo/plans/event-editor-actor-battle-adversarial-review.md",
    capturedAt: new Date().toISOString(),
    contracts: probe,
  });
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

test("1) 명령을 고르면 피커는 편집 창 뒤에 남지 않는다", async ({ page }) => {
  await openBlankEditor(page);
  await openEventEditor(page);
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-tab-2").click();

  const battle = picker.getByTestId("command-picker-add-battleProcessing");
  await expect(battle).toBeVisible();
  await battle.click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();

  // 계약: stackedPickerBehind === false. 편집 창이 열리면 피커는 보이지 않는다(닫혀 있다).
  await expect(page.getByTestId("event-command-picker")).toBeHidden();
  const stackedPickerBehind = await picker.isVisible().catch(() => false);
  const observed = {
    stackedPickerBehind,
    pickerCount: await page.getByTestId("event-command-picker").count(),
    dialogVisible: await dialog.isVisible(),
    // 확인 버튼은 편집 창의 유일한 1차 액션이다.
    confirmVisible: await dialog.getByTestId("event-command-edit-ok").isVisible().catch(() => false),
  };
  probe["pickerClosed"] = observed;
  await shot(page, "07-picker-closed.png");
  await shot(page, "07-edit-dialog.png", dialog);
  await writeJson("07-picker-closed.json", observed);

  expect(
    stackedPickerBehind,
    "stackedPickerBehind must be false: picker should close when a command opens its edit dialog",
  ).toBe(false);
});

test("2) 전투 미리보기 배지는 배경과 다른 색으로 칠한다", async ({ page }) => {
  await openBlankEditor(page);
  await openEventEditor(page);
  const preview = await openCommandForPreview(page, "command-picker-add-battleProcessing", 2);

  // 빈 전투는 .ecp-battle-badge("⚔") 를 렌더한다.
  const badge = preview.locator(".ecp-battle-badge").first();
  await expect(badge).toBeVisible();
  const colors = await badge.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, backgroundColor: style.backgroundColor };
  });
  const observed = {
    badge: colors,
    distinct: colors.color !== colors.backgroundColor,
    imgs: await preview.locator("img").count(),
    emptyWarnings: await preview.getByTestId("ecp-battle-empty-warn").count(),
  };
  probe["battleBadge"] = observed;
  await shot(page, "05-battle-preview.png", preview);
  await writeJson("05-battle-preview.json", observed);

  expect(
    colors.color !== colors.backgroundColor,
    `.ecp-battle-badge color(${colors.color}) must differ from backgroundColor(${colors.backgroundColor})`,
  ).toBe(true);
});

test("3) 전투 트룹 변수 목록은 이름 있는 슬롯만 나열한다", async ({ page }) => {
  await openBlankEditor(page);
  await openEventEditor(page);
  const picker = await openCommandPicker(page);
  await picker.getByTestId("event-command-picker-tab-2").click();
  await picker.getByTestId("command-picker-add-battleProcessing").click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();

  // 「누구와 싸울까」를 변수로 바꾸면 접힌 한 줄이어야 한다 — 빈 슬롯 덤프 금지.
  await dialog.getByTestId("battle-processing-troop-source-segment-variable").click();
  const variableField = dialog.getByTestId("battle-processing-troop-variable");
  await expect(variableField).toBeVisible();

  const optionLabels = await variableField
    .locator("select option")
    .evaluateAll((options) => options.map((option) => option.textContent?.trim() ?? ""));
  const unnamedCount = optionLabels.filter((label) => label === "(이름 없음)").length;
  const observed = {
    unnamedCount,
    optionLabels,
    // 고정 트룹 컨트롤은 슬롯에서 빠져 한 컨트롤만 남는다.
    troopSelectVisible: await dialog
      .getByTestId("battle-processing-troop-select")
      .isVisible()
      .catch(() => false),
  };
  probe["namedVariablesOnly"] = observed;
  await shot(page, "06-troop-variable-named.png", dialog);
  await writeJson("06-troop-variable-named.json", observed);

  expect(
    unnamedCount,
    "variable picker must list only named slots — found unnamed '(이름 없음)' dump",
  ).toBe(0);
});

test("4) 얼굴 변경 미리보기는 faceset 크롭을 그린다", async ({ page }) => {
  await openBlankEditor(page);
  await openEventEditor(page);
  // m2 「Change Actor Faceset」 — 동료 · 전투 탭.
  const preview = await openCommandForPreview(page, "command-picker-add-m2-025-change-actor-faceset", 2);

  const cropShell = preview.getByTestId("event-command-face-crop-shell");
  const facePreview = preview.getByTestId("event-command-face-preview");
  const cropShellCount = await cropShell.count();
  const facePreviewCount = await facePreview.count();
  const cropPresent = cropShellCount > 0 || facePreviewCount > 0;
  await shot(page, "05-faceset-preview-empty.png", preview);

  // 얼굴을 고르면 크롭이 실제로 칠해진다 — 빈 액자(data-empty="true")가 아니다.
  const dialog = page.getByTestId("event-command-edit-dialog");
  await dialog.getByTestId("change-actor-faceset-resource-select").selectOption({ index: 1 });
  await expect(cropShell.first()).not.toHaveAttribute("data-empty", "true");
  const crop = preview.getByTestId("event-command-face-crop").first();
  await expect(crop).toBeVisible();
  const paint = await crop.evaluate((el) => ({
    faceUrl: el.style.getPropertyValue("--face-url"),
    backgroundImage: getComputedStyle(el).backgroundImage,
  }));
  const painted = paint.faceUrl.includes("url(") || paint.backgroundImage.includes("url(");

  const observed = {
    cropPresent,
    cropShell: cropShellCount,
    facePreview: facePreviewCount,
    painted,
    resourceId: await cropShell.first().getAttribute("data-resource-id"),
    // 요약 폴백(summaryCard)이면 이 캡션이 없다.
    faceCaption: await preview.getByTestId("ecp-face-caption").count(),
    stage: await preview.getByTestId("ecp-m2-faceset-stage").count(),
  };
  probe["facesetCrop"] = observed;
  await shot(page, "05-faceset-preview.png", preview);
  await writeJson("05-faceset-preview.json", observed);

  expect(
    cropPresent,
    "faceset change preview must render a faceset crop, not a handler-less summary fallback",
  ).toBe(true);
  expect(painted, `faceset crop must paint a sheet image, got ${JSON.stringify(paint)}`).toBe(true);
});


test("5) 이름 있는 트룹 미리보기는 적 이미지 또는 이니셜을 그린다", async ({ page }) => {
  await openBlankEditor(page);
  await openEventEditor(page);
  const preview = await openCommandForPreview(page, "command-picker-add-battleProcessing", 2);
  const dialog = page.getByTestId("event-command-edit-dialog");
  const troopSelect = dialog.getByTestId("battle-processing-troop-select");
  await expect(troopSelect).toBeVisible();
  await troopSelect.selectOption({ index: 1 });
  const imgs = await preview.locator("img.ecp-battle-enemy").count();
  const initials = await preview.locator(".ecp-battle-enemy-fallback").count();
  const observed = { imgs, initials };
  probe["namedTroopPreview"] = observed;
  await shot(page, "05-battle-named-troop.png", preview);
  await writeJson("05-battle-named-troop.json", observed);
  expect(
    imgs >= 1 || initials >= 1,
    "named troop preview must show enemy imgs or identifiable initials",
  ).toBe(true);
});

async function openBlankEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
}

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

/** 빈 이벤트에서 명령 피커를 연다. 템플릿 CTA 가 있으면 그것이 정규 경로다. */
async function openCommandPicker(page: Page): Promise<Locator> {
  const picker = page.getByTestId("event-command-picker").first();
  if (await picker.isVisible().catch(() => false)) return picker;
  const searchTemplate = page.getByTestId("event-template-empty-search").first();
  if (await searchTemplate.isVisible().catch(() => false)) {
    await searchTemplate.click();
  } else {
    const emptyLine = page.getByTestId("event-command-empty-line").first();
    await emptyLine.evaluate((node) => {
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
  }
  await expect(picker).toBeVisible({ timeout: 8_000 });
  return picker;
}

/** 탭에서 명령 하나를 골라 편집 창 미리보기 로케이터를 돌려준다. */
async function openCommandForPreview(page: Page, addTestId: string, tab: number): Promise<Locator> {
  const picker = await openCommandPicker(page);
  await picker.getByTestId(`event-command-picker-tab-${tab}`).click();
  const entry = picker.getByTestId(addTestId);
  await expect(entry).toBeVisible();
  await entry.click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  const preview = dialog.getByTestId("event-command-preview");
  await expect(preview).toBeVisible();
  return preview;
}

async function shot(page: Page, name: string, locator?: Locator): Promise<void> {
  const dest = path.join(EVIDENCE_DIR, name);
  if (locator && (await locator.count()) > 0) {
    await locator.screenshot({ path: dest });
    return;
  }
  await page.screenshot({ path: dest, fullPage: false });
}

async function writeJson(name: string, data: unknown): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(path.join(EVIDENCE_DIR, name), JSON.stringify(data, null, 2), "utf8");
}
