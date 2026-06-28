import { expect, test, type Locator, type Page } from "@playwright/test";

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function dblclickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1000 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    const hasOpenButton = await openButton.waitFor({ state: "visible", timeout: 500 }).then(() => true).catch(() => false);
    if (hasOpenButton) {
      await openButton.click();
    } else {
      await dblclickMapCenter(page);
    }
  }
  await expect(editor).toBeVisible();
  return editor;
}

test("double-clicking the @> contents line opens the Korean RM2003 command window", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  await expect(editor.getByText("조건", { exact: true })).toBeVisible();
  await expect(editor.getByText("그래픽", { exact: true })).toBeVisible();
  await expect(editor.getByText("실행 내용", { exact: true })).toBeVisible();

  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await expect(emptyLine).toHaveText("@>");
  await expect(editor.getByTestId("event-command-text")).toHaveCount(0);
  await expect(editor.getByTestId("event-npc-quick-author")).toHaveCount(0);
  await expect(editor.getByTestId("event-npc-name-input")).toHaveCount(0);
  await expect(editor.getByTestId("event-npc-dialogue-input")).toHaveCount(0);
  await expect(editor.getByTestId("event-npc-quick-create")).toHaveCount(0);
  await expect(editor.getByTestId("event-monster-encounter-create")).toHaveCount(0);
  await emptyLine.click();
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await emptyLine.dblclick();

  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("heading", { name: "이벤트 명령" })).toBeVisible();
  await expect(picker.getByTestId("event-command-picker-tab-1")).toHaveAttribute("aria-selected", "true");
  await expect(picker.getByRole("button", { name: "문장 표시..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "문장 표시 설정..." })).toBeEnabled();
  await expect(picker.getByRole("button", { name: "스위치 조작..." })).toBeVisible();

  await picker.getByTestId("event-command-picker-tab-2").click();
  await expect(picker.getByRole("button", { name: "전투 처리..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "장소 이동..." })).toBeVisible();

  await picker.getByTestId("event-command-picker-tab-3").click();
  await expect(picker.getByRole("button", { name: "BGM 재생..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "조건 분기..." })).toBeVisible();

  await picker.getByTestId("event-command-picker-tab-4").click();
  await expect(picker.getByRole("button", { name: "주인공 직업 변경..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "로드 메뉴 열기" })).toBeDisabled();
  await expect(picker.getByRole("button", { name: "적 HP 변경..." })).toBeDisabled();

  await picker.getByTestId("event-command-picker-tab-1").click();
  await picker.getByTestId("command-picker-add-text").click();
  await expect(picker).toBeVisible();
  const showTextDialog = page.getByTestId("event-command-text-dialog");
  await expect(showTextDialog).toBeVisible();
  await expect(showTextDialog.getByTestId("event-command-text-body")).toBeVisible();
  await expect(showTextDialog.getByTestId("event-command-text-body")).toBeFocused();
  await expect(showTextDialog.getByTestId("event-command-text-line-guide")).toContainText("최대 4줄");
  await expect(showTextDialog.getByTestId("event-command-text-line-count")).toContainText("1/4줄");
  await expect(showTextDialog.getByRole("button", { name: "OK" })).toBeVisible();
  await expect(showTextDialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(showTextDialog.getByRole("button", { name: "Help" })).toBeVisible();
  await showTextDialog.getByTestId("event-command-text-help").click();
  await expect(showTextDialog.getByTestId("event-command-text-control-help")).toContainText("\\v[n]");
  await showTextDialog.getByTestId("event-command-text-body").fill("1\n2\n3\n4\n5");
  await expect(showTextDialog.getByTestId("event-command-text-ok")).toBeDisabled();
  await expect(showTextDialog.getByTestId("event-command-text-line-count")).toContainText("최대 4줄");
  await showTextDialog.getByTestId("event-command-text-cancel").click();
  await expect(showTextDialog).toBeHidden();
  await expect(picker).toBeVisible();

  await picker.getByTestId("command-picker-add-text").click();
  await expect(showTextDialog).toBeVisible();
  await showTextDialog.getByTestId("event-command-text-body").fill("테스트 대사");
  await showTextDialog.getByTestId("event-command-text-ok").click();
  await expect(showTextDialog).toBeHidden();
  await expect(picker).toBeHidden();
  await expect(editor.locator('[data-testid="event-command-text"]').filter({ hasText: "테스트 대사" })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("rm2k3-event-command-picker.png"), fullPage: true });
});

test("event editor modal matches the RPG Maker reference window proportions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);

  const windowBox = await editor.locator(".event-editor-modal-window").boundingBox();
  if (windowBox === null) throw new Error("missing event editor window");
  expect(windowBox.width).toBeGreaterThan(1400);
  expect(windowBox.height).toBeGreaterThan(860);
  await expect(editor.locator(".event-editor-id-row")).not.toBeVisible();

  const nameBox = await editor.getByTestId("event-page-name-input").boundingBox();
  const contentsBox = await editor.locator(".event-contents-fieldset").boundingBox();
  if (nameBox === null || contentsBox === null) throw new Error("missing event editor layout boxes");
  expect(contentsBox.x).toBeGreaterThan(nameBox.x + nameBox.width);
  expect(contentsBox.height).toBeGreaterThan(620);

  await page.screenshot({ path: testInfo.outputPath("event-editor-reference-proportions.png"), fullPage: true });
});

test("event editor keeps the desktop contents column at compact desktop widths", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);

  const settingsBox = await editor.locator(".event-editor-settings-column").boundingBox();
  const contentsBox = await editor.locator(".event-contents-fieldset").boundingBox();
  const windowBox = await editor.locator(".event-editor-modal-window").boundingBox();
  if (settingsBox === null || contentsBox === null || windowBox === null) {
    throw new Error("missing event editor desktop columns");
  }

  expect(windowBox.x).toBeGreaterThanOrEqual(0);
  expect(windowBox.width).toBeGreaterThan(1400);
  expect(contentsBox.x).toBeGreaterThan(settingsBox.x + settingsBox.width);
  expect(Math.abs(contentsBox.y - settingsBox.y)).toBeLessThan(2);
  expect(contentsBox.width).toBeGreaterThan(600);
  expect(contentsBox.height).toBeGreaterThan(620);
  await expect
    .poll(async () =>
      editor.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      }))
    )
    .toEqual({ clientWidth: 1024, scrollLeft: 0, scrollWidth: 1488 });

  await page.screenshot({ path: testInfo.outputPath("event-editor-compact-desktop-columns.png"), fullPage: true });
});

test("event command context menu, switch picker, and trigger safety warning work in the editor", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  const emptyLine = page.getByTestId("event-command-empty-line");
  await emptyLine.dispatchEvent("dblclick");
  let picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-text").click();
  const textDialog = page.getByTestId("event-command-text-dialog");
  await textDialog.getByTestId("event-command-text-body").fill("context menu seed");
  await textDialog.getByTestId("event-command-text-ok").click();
  await expect(editor.locator('[data-testid="event-command-text"]').filter({ hasText: "context menu seed" })).toBeVisible();

  const textCommand = editor.locator('[data-testid="event-command-text"]').filter({ hasText: "context menu seed" });
  await textCommand.locator(".cmd-head").click({ button: "right" });
  const contextMenu = page.getByTestId("event-command-context-menu");
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu.getByTestId("event-command-menu-insert")).toBeVisible();
  await expect(contextMenu.getByTestId("event-command-menu-copy")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("event-editor-context-menu-open.png"), fullPage: true });
  await contextMenu.getByTestId("event-command-menu-copy").click();

  await textCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-insert").click();
  picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-setSwitch").click();
  await expect(picker).toBeHidden();

  const switchCommand = editor.getByTestId("event-command-setSwitch");
  await expect(switchCommand).toBeVisible();
  await switchCommand.locator(".cmd-head").dblclick();
  await switchCommand.getByTestId("event-switch-picker-open").click();
  const recordPicker = page.getByTestId("event-record-picker");
  await expect(recordPicker).toBeVisible();
  await recordPicker.getByTestId("event-record-picker-add").click();
  await expect(recordPicker.getByTestId("event-record-picker-row-1")).toContainText("0001");
  await page.screenshot({ path: testInfo.outputPath("event-editor-switch-picker-open.png"), fullPage: true });
  await recordPicker.getByTestId("event-record-picker-row-1").click();
  await recordPicker.getByTestId("event-record-picker-ok").click();
  await expect(recordPicker).toBeHidden();

  await editor.getByTestId("event-page-trigger-select").selectOption("auto");
  await expect(editor.getByTestId("event-page-safety-warning")).toBeVisible();
  await expect(editor.getByTestId("event-page-safety-warning")).toContainText("조건 없는 자동/병렬 이벤트");

  await page.screenshot({ path: testInfo.outputPath("event-editor-context-menu-picker-warning.png"), fullPage: true });
});
