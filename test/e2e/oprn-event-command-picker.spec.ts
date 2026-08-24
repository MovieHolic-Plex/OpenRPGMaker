import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-command-picker");
  });
});

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
  const eventLayerButton = page.getByTestId("layer-event");
  if (await eventLayerButton.isVisible().catch(() => false)) {
    await eventLayerButton.click();
  } else {
    await page.getByRole("button", { name: "도구", exact: true }).click();
    await page.getByTestId("menu-tools-layer-event").click();
  }
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
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
  await expect(emptyLine).toHaveText("◆");
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
  for (const heading of ["대화/입력", "조건/흐름", "맵/이동", "보상/상점", "소리"]) {
    await expect(picker.locator(".event-command-picker-group-heading").filter({ hasText: heading })).toBeVisible();
  }
  await expect(picker.getByRole("button", { name: "문장 표시..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "문장 표시 설정..." })).toBeEnabled();
  await expect(picker.getByRole("button", { name: "스위치 조작..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "조건 분기..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "장소 이동..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "BGM 재생..." })).toBeVisible();
  expect(await picker.locator(".event-command-picker-command").count()).toBeGreaterThanOrEqual(21);
  await expect(picker.getByRole("button", { name: "경험치 변경..." })).toHaveCount(0);

  await picker.getByTestId("event-command-picker-tab-2").click();
  await expect(picker.getByRole("button", { name: "경험치 변경..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "전투 처리..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "장소 이동..." })).toHaveCount(0);

  await picker.getByTestId("event-command-picker-tab-3").click();
  await expect(picker.getByRole("button", { name: "그림 표시..." })).toBeVisible();
  await expect(picker.getByRole("button", { name: "화면 색조 변경..." })).toBeVisible();

  await picker.getByTestId("event-command-picker-tab-4").click();
  await expect
    .poll(async () =>
      picker.locator(".event-command-picker-grid").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)
    )
    .toBe(2);
  const commandGrid = picker.locator(".event-command-picker-grid");
  await expect(commandGrid.locator(".event-command-picker-command:disabled")).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "저장 메뉴 열기" })).toBeVisible();
  await expect(picker.getByRole("button", { name: "로드 메뉴 열기" })).toBeEnabled();
  const battleOnlyInfo = picker.getByRole("button", { name: "적 HP 변경..." });
  await expect(battleOnlyInfo).toBeVisible();
  await expect(battleOnlyInfo).toHaveAttribute("aria-disabled", "true");

  const unavailable = picker.getByTestId("command-picker-info-checkpointSave");
  await expect(unavailable).toBeVisible();
  await unavailable.focus();
  await expect(unavailable).toBeFocused();
  await expect(unavailable).toHaveAttribute("aria-disabled", "true");
  await expect(unavailable).toHaveAttribute("data-runtime-support", "runtime-partial");
  await expect(unavailable).toHaveAttribute("data-runtime-owner", "interpreter");
  await expect(unavailable).toHaveAttribute("aria-describedby", "command-picker-guidance-checkpointSave");
  await expect(picker.getByTestId("command-picker-guidance-checkpointSave")).toContainText("사용 경로: 빠른 저작");
  await unavailable.focus();
  await expect(unavailable).toBeFocused();
  await unavailable.press("Enter");
  await expect(picker).toBeVisible();
  await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);

  await picker.getByTestId("event-command-picker-tab-1").click();
  await expect(picker.getByTestId("command-picker-add-setSwitch")).toHaveAttribute("data-runtime-owner", "interpreter");
  await picker.getByTestId("event-command-picker-tab-2").click();
  await expect(picker.getByTestId("command-picker-add-battleProcessing")).toHaveAttribute("data-runtime-owner", "battle");
  await picker.getByTestId("event-command-picker-tab-1").click();
  await expect(picker.getByTestId("command-picker-add-transfer")).toHaveAttribute("data-runtime-owner", "player");

  await picker.getByTestId("event-command-picker-tab-1").click();
  await picker.screenshot({ path: testInfo.outputPath("rm2k3-event-command-picker.png") });
  await picker.getByTestId("command-picker-add-text").click();
  await expect(picker).toBeVisible();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("문장 표시");
  await expect(commandDialog.locator("textarea")).toBeVisible();
  await expect(commandDialog.getByRole("button", { name: "확인" })).toBeVisible();
  await expect(commandDialog.getByRole("button", { name: "취소" })).toBeVisible();
  await commandDialog.locator("textarea").fill("취소될 대사");
  await commandDialog.getByTestId("event-command-edit-cancel").click();
  await expect(commandDialog).toBeHidden();
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-cancel").click();
  await expect(picker).toBeHidden();
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

test("event editor clamps to the viewport while keeping desktop columns at compact desktop widths", async ({
  page,
}, testInfo) => {
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
  expect(windowBox.width).toBeLessThanOrEqual(1024);
  expect(windowBox.width).toBeGreaterThan(1000);
  expect(contentsBox.x).toBeGreaterThan(settingsBox.x + settingsBox.width);
  expect(Math.abs(contentsBox.y - settingsBox.y)).toBeLessThan(2);
  expect(contentsBox.width).toBeGreaterThan(420);
  expect(contentsBox.height).toBeGreaterThan(620);
  await expect
    .poll(async () =>
      editor.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      }))
    )
    .toEqual({ clientWidth: 1024, scrollLeft: 0, scrollWidth: 1024 });

  await page.screenshot({ path: testInfo.outputPath("event-editor-compact-desktop-columns.png"), fullPage: true });
});

test("event editor keeps two columns at an 800px viewport by compressing the settings column", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  await page.setViewportSize({ width: 800, height: 926 });

  const settingsBox = await editor.locator(".event-editor-settings-column").boundingBox();
  const contentsBox = await editor.locator(".event-contents-fieldset").boundingBox();
  const windowBox = await editor.locator(".event-editor-modal-window").boundingBox();
  const nameBox = await editor.getByTestId("event-page-name-input").boundingBox();
  const pageTabsBox = await editor.locator(".event-page-tabs").boundingBox();
  if (settingsBox === null || contentsBox === null || windowBox === null || nameBox === null || pageTabsBox === null) {
    throw new Error("missing event editor responsive layout boxes");
  }

  expect(windowBox.x).toBeGreaterThanOrEqual(0);
  expect(windowBox.width).toBeLessThanOrEqual(800);
  expect(nameBox.y).toBeLessThan(pageTabsBox.y);
  expect(contentsBox.x).toBeGreaterThan(settingsBox.x + settingsBox.width);
  expect(Math.abs(contentsBox.y - settingsBox.y)).toBeLessThan(2);
  expect(settingsBox.width).toBeLessThan(380);
  expect(contentsBox.width).toBeGreaterThan(390);
  expect(contentsBox.height).toBeGreaterThan(620);
  await expect
    .poll(async () =>
      editor.evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      }))
    )
    .toEqual({ clientWidth: 800, scrollLeft: 0, scrollWidth: 800 });

  await page.screenshot({ path: testInfo.outputPath("event-editor-800px-two-columns.png"), fullPage: true });
});

test("event editor supports resizing the split columns and modal window", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openEventEditor(page);
  await page.setViewportSize({ width: 800, height: 926 });

  const settings = editor.locator(".event-editor-settings-column");
  const contents = editor.locator(".event-contents-fieldset");
  const splitter = editor.getByTestId("event-editor-column-resizer");
  const windowNode = editor.locator(".event-editor-modal-window");
  const windowHandle = editor.getByTestId("event-editor-modal-resize-handle");

  const initialSettingsBox = await settings.boundingBox();
  const initialContentsBox = await contents.boundingBox();
  const splitterBox = await splitter.boundingBox();
  if (initialSettingsBox === null || initialContentsBox === null || splitterBox === null) {
    throw new Error("missing event editor split resize boxes");
  }

  await page.mouse.move(splitterBox.x + splitterBox.width / 2, splitterBox.y + 80);
  await page.mouse.down();
  await page.mouse.move(splitterBox.x - 48, splitterBox.y + 80);
  await page.mouse.up();

  const resizedSettingsBox = await settings.boundingBox();
  const resizedContentsBox = await contents.boundingBox();
  if (resizedSettingsBox === null || resizedContentsBox === null) {
    throw new Error("missing event editor resized split boxes");
  }
  expect(resizedSettingsBox.width).toBeLessThan(initialSettingsBox.width - 20);
  expect(resizedContentsBox.width).toBeGreaterThan(initialContentsBox.width + 20);

  const initialWindowBox = await windowNode.boundingBox();
  const handleBox = await windowHandle.boundingBox();
  if (initialWindowBox === null || handleBox === null) throw new Error("missing event editor window resize boxes");

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 96, handleBox.y - 96);
  await page.mouse.up();

  const resizedWindowBox = await windowNode.boundingBox();
  if (resizedWindowBox === null) throw new Error("missing resized event editor window box");
  expect(resizedWindowBox.width).toBeLessThan(initialWindowBox.width - 20);
  expect(resizedWindowBox.height).toBeLessThan(initialWindowBox.height - 40);

  await page.setViewportSize({ width: 1024, height: 926 });
  const restorableWindowBox = await windowNode.boundingBox();
  if (restorableWindowBox === null) throw new Error("missing window geometry before full view");
  const fullscreenButton = editor.getByTestId("event-editor-window-fullscreen");
  await fullscreenButton.click();
  await expect(windowNode).toHaveClass(/is-fullscreen/);
  await expect(fullscreenButton).toHaveAttribute("aria-pressed", "true");
  const fullscreenBox = await windowNode.boundingBox();
  expect(fullscreenBox).toMatchObject({ x: 6, y: 6, width: 1012, height: 914 });

  await page.screenshot({ path: testInfo.outputPath("event-editor-fullscreen.png") });

  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await expect(windowNode).not.toHaveClass(/is-fullscreen/);
  await expect(fullscreenButton).toHaveAttribute("aria-pressed", "false");
  const restoredWindowBox = await windowNode.boundingBox();
  expect(restoredWindowBox?.width).toBeCloseTo(restorableWindowBox.width, 0);
  expect(restoredWindowBox?.height).toBeCloseTo(restorableWindowBox.height, 0);

  await page.screenshot({ path: testInfo.outputPath("event-editor-resizable-window-and-columns.png"), fullPage: true });

  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
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
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await commandDialog.locator("textarea").fill("context menu seed");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(editor.locator('[data-testid="event-command-text"]').filter({ hasText: "context menu seed" })).toBeVisible();

  const textCommand = editor.locator('[data-testid="event-command-text"]').filter({ hasText: "context menu seed" });
  await textCommand.locator(".cmd-head").click({ button: "right" });
  const contextMenu = page.getByTestId("event-command-context-menu");
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu.getByTestId("event-command-menu-insert")).toContainText("삽입...");
  await expect(contextMenu.getByTestId("event-command-menu-insert")).toContainText("Enter");
  await expect(contextMenu.getByTestId("event-command-menu-edit")).toContainText("Space");
  await expect(contextMenu.getByTestId("event-command-menu-copy")).toContainText("Ctrl+C");
  await expect(contextMenu.getByTestId("event-command-menu-paste")).toBeDisabled();
  await expect(contextMenu.getByTestId("event-command-menu-edit")).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("event-editor-context-menu-open.png"), fullPage: true });

  await page.keyboard.press("Space");
  await expect(contextMenu).toBeHidden();
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("문장 표시");
  await commandDialog.getByTestId("event-command-edit-cancel").click();
  await expect(commandDialog).toBeHidden();

  await textCommand.locator(".cmd-head").click({ button: "right" });
  await contextMenu.getByTestId("event-command-menu-copy").click();

  await textCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-insert").click();
  picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-setSwitch").click();
  await expect(editor.getByTestId("event-command-setSwitch")).toHaveCount(0);
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("스위치 조작");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(picker).toBeHidden();

  const switchCommand = editor.getByTestId("event-command-setSwitch");
  await expect(switchCommand).toBeVisible();
  await switchCommand.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-edit").click();
  await expect(commandDialog).toBeVisible();
  await commandDialog.getByTestId("event-switch-picker-open").click();
  const recordPicker = page.getByTestId("event-record-picker");
  await expect(recordPicker).toBeVisible();
  await recordPicker.getByTestId("event-record-picker-add").click();
  const selectedSwitchRow = recordPicker.locator(".event-record-picker-row[aria-selected='true']");
  await expect(selectedSwitchRow).toContainText("새 스위치");
  await page.screenshot({ path: testInfo.outputPath("event-editor-switch-picker-open.png"), fullPage: true });
  await selectedSwitchRow.click();
  await recordPicker.getByTestId("event-record-picker-ok").click();
  await expect(recordPicker).toBeHidden();
  await commandDialog.getByTestId("event-command-edit-ok").click();

  await editor.getByTestId("event-page-trigger-select").selectOption("auto");
  await expect(editor.getByTestId("event-page-safety-warning")).toBeVisible();
  await expect(editor.getByTestId("event-page-safety-warning")).toContainText("조건 없는 자동/병렬 이벤트");

  await page.screenshot({ path: testInfo.outputPath("event-editor-context-menu-picker-warning.png"), fullPage: true });
});
