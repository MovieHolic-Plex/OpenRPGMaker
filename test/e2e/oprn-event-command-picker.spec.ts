import { expect, test } from "@playwright/test";
import {
  openCommandPicker,
  pickerGrid,
  openMapEventEditor,
  openPickerTab,
  pickCommand,
  showCommandList,
} from "./eventStoryboardPicker";

/**
 * 명령 피커 계약 — 스토리보드 우선 표면 기준.
 *
 * 폐기된 RM2003 계약은 여기서 단언하지 않는다: 2열 그리드, 1400×860 모달,
 * exact `조건`/`그래픽`/`실행 내용` 라벨, 기본 visible `event-command-empty-line`,
 * 탭4 버튼 24개 고정. 모달 비율/리사이즈는 `event-editor-responsive-mockup`과
 * `event-editor-backdrop-persistence`가 맡는다.
 */

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-command-picker");
  });
  await page.setViewportSize({ width: 1478, height: 926 });
});

test("storyboard CTA opens the command picker and authors the first command", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  // 기본 작업면은 스토리보드다. 목록의 빈 줄은 숨어 있고, 추가 경로는 CTA다.
  await expect(editor.getByTestId("event-storyboard")).toBeVisible();
  await expect(editor.getByTestId("event-command-empty-line")).toBeHidden();
  await expect(editor.getByTestId("event-command-header")).toContainText("0개");
  const cta = editor.getByTestId("event-storyboard-add");
  await expect(cta).toContainText("첫 명령 추가");
  await expect(cta).toContainText("명령 팔레트 열기");

  const picker = await openCommandPicker(page, "storyboard-cta");
  await expect(picker.getByRole("heading", { name: "명령 추가" })).toBeVisible();
  await expect(picker.getByTestId("event-command-picker-tab-1")).toHaveAttribute("aria-selected", "true");
  // 탭 1 헤딩은 저작면이다: 말하기 / 고르기 / 옮기기 / 거래 / 흐름 / 소리.
  for (const heading of ["말하기", "흐름", "거래", "소리"]) {
    await expect(pickerGrid(picker).locator(".event-command-picker-group-heading").filter({ hasText: heading }).first()).toBeVisible();
  }
  for (const label of ["문장 표시...", "스위치 조작...", "조건 분기...", "장소 이동...", "BGM 재생..."]) {
    await expect(pickerGrid(picker).getByRole("button", { name: label, exact: true })).toBeEnabled();
  }
  expect(await pickerGrid(picker).locator(".event-command-picker-command").count()).toBeGreaterThanOrEqual(21);
  await expect(pickerGrid(picker).getByRole("button", { name: "경험치 변경...", exact: true })).toHaveCount(0);
  await picker.screenshot({ path: testInfo.outputPath("event-command-picker-tab-1.png") });

  const dialog = await pickCommand(page, picker, "문장 표시...");
  await expect(dialog).toContainText("문장 표시");
  await expect(dialog.locator("textarea")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "확인" })).toBeVisible();

  // 한 레이어: 명령을 고르면 피커는 닫힌다. 취소하면 아무것도 남기지 않고 스토리보드로 돌아온다.
  await dialog.locator("textarea").fill("취소될 대사");
  await dialog.getByTestId("event-command-edit-cancel").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);
  await expect(editor.getByTestId("event-command-header")).toContainText("0개");

  const secondPicker = await openCommandPicker(page, "storyboard-cta");
  const secondDialog = await pickCommand(page, secondPicker, "문장 표시...");
  await secondDialog.locator("textarea").fill("스토리보드 첫 대사");
  await secondDialog.getByTestId("event-command-edit-ok").click();
  await expect(secondPicker).toBeHidden();

  const firstCard = editor.getByTestId("event-storyboard-card-0");
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toContainText("스토리보드 첫 대사");
  await expect(editor.getByTestId("event-command-header")).toContainText("1개");
  await expect(editor.getByTestId("event-command-empty-line")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("event-storyboard-first-command.png"), fullPage: true });
});

test("quick next and toolbar add open the same picker without leaving the storyboard", async ({ page }) => {
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const fromQuickTools = await openCommandPicker(page, "quick-next");
  await expect(fromQuickTools.getByTestId("event-command-picker-tab-1")).toHaveAttribute("aria-selected", "true");
  await fromQuickTools.getByTestId("event-command-picker-cancel").click();
  await expect(fromQuickTools).toBeHidden();
  await expect(editor.getByTestId("event-storyboard")).toBeVisible();
  await expect(editor.getByTestId("event-command-empty-line")).toBeHidden();

  const fromToolbar = await openCommandPicker(page, "toolbar-add");
  await expect(fromToolbar.getByRole("heading", { name: "명령 추가" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(fromToolbar).toBeHidden();
  await expect(editor).toBeVisible();
});

test("system and tools tab keeps only system and tools groups", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1");

  await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "quick-next");
  await openPickerTab(picker, 4);

  // 탭4 IA: 시스템·도구 두 헤딩만. 대화/흐름/전투 전용이 흘러들면 실패한다.
  await expect(pickerGrid(picker).locator(".event-command-picker-group-heading")).toHaveText(["시스템", "도구"]);
  for (const label of ["저장 메뉴 열기", "로드 메뉴 열기", "메뉴 화면 열기", "UI 명령...", "데이터 조회..."]) {
    await expect(pickerGrid(picker).getByRole("button", { name: label, exact: true })).toBeEnabled();
  }
  // 그리드에는 고를 수 없는 정보 행이 없다 — 허위 발견성 금지.
  await expect(pickerGrid(picker).locator(".event-command-picker-command.is-informational")).toHaveCount(0);
  await expect(pickerGrid(picker).locator(".event-command-picker-command:disabled")).toHaveCount(0);
  await expect(pickerGrid(picker).getByRole("button", { name: "체크포인트 저장...", exact: true })).toHaveCount(1);
  await expect(pickerGrid(picker).getByRole("button", { name: "적 HP 변경...", exact: true })).toHaveCount(0);
  await expect(pickerGrid(picker).getByRole("button", { name: "문장 표시...", exact: true })).toHaveCount(0);
  await picker.screenshot({ path: testInfo.outputPath("event-command-picker-system-tools.png") });

  // 고를 수 없는 행은 전 탭 검색에서만, 대체 경로 안내와 함께 보인다.
  await picker.getByTestId("event-command-picker-search").fill("체크포인트");
  const info = picker.getByTestId("command-picker-info-checkpointSave");
  await expect(info).toBeVisible();
  await expect(info).toHaveAttribute("aria-disabled", "true");
  await expect(info).toHaveAttribute("aria-describedby", "command-picker-guidance-checkpointSave");
  await expect(picker.getByTestId("command-picker-guidance-checkpointSave")).toContainText("빠른 저작");
  await info.focus();
  await expect(info).toBeFocused();
  await info.press("Enter");
  await expect(picker).toBeVisible();
  await expect(page.getByTestId("event-command-edit-dialog")).toHaveCount(0);
});

test("picker exposes runtime owners per tab and inserts from the cross-tab search", async ({ page }) => {
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "storyboard-cta");

  await expect(picker.getByTestId("command-picker-add-setSwitch")).toHaveAttribute("data-runtime-owner", "interpreter");
  await expect(picker.getByTestId("command-picker-add-transfer")).toHaveAttribute("data-runtime-owner", "player");
  await openPickerTab(picker, 2);
  await expect(picker.getByTestId("command-picker-add-battleProcessing")).toHaveAttribute("data-runtime-owner", "battle");

  // 탭 스트립은 화살표 키로 넘어간다.
  await picker.getByTestId("event-command-picker-tab-2").press("ArrowRight");
  await expect(picker.getByTestId("event-command-picker-tab-3")).toHaveAttribute("aria-selected", "true");
  await expect(pickerGrid(picker).getByRole("button", { name: "화면 색조 변경...", exact: true })).toBeEnabled();

  // 검색은 전 탭을 훑는다. ↓/Enter 한 번으로 후보가 편집 대화상자로 넘어간다.
  const search = picker.getByTestId("event-command-picker-search");
  await search.fill("소지금");
  await expect(picker.getByTestId("event-command-picker-search-count")).toContainText("검색 결과");
  await expect(pickerGrid(picker).getByRole("button", { name: "소지금 변경...", exact: true })).toBeVisible();
  await search.press("Enter");
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("소지금");
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(picker).toBeHidden();
  await expect(editor.getByTestId("event-storyboard-card-0")).toContainText("소지금");
});

test("list view keeps the context menu, switch picker, and trigger safety warning", async ({ page }, testInfo) => {
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "quick-next");
  const seedDialog = await pickCommand(page, picker, "문장 표시...");
  await seedDialog.locator("textarea").fill("context menu seed");
  await seedDialog.getByTestId("event-command-edit-ok").click();
  await expect(picker).toBeHidden();

  await showCommandList(editor);
  const textCommand = editor.locator('[data-testid="event-command-text"]').filter({ hasText: "context menu seed" });
  await expect(textCommand).toBeVisible();

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

  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await page.keyboard.press("Space");
  await expect(contextMenu).toBeHidden();
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("문장 표시");
  await commandDialog.getByTestId("event-command-edit-cancel").click();
  await expect(commandDialog).toBeHidden();

  await textCommand.locator(".cmd-head").click({ button: "right" });
  await contextMenu.getByTestId("event-command-menu-copy").click();

  await textCommand.locator(".cmd-head").click({ button: "right" });
  await contextMenu.getByTestId("event-command-menu-insert").click();
  const insertPicker = page.getByTestId("event-command-picker");
  await expect(insertPicker).toBeVisible();
  await insertPicker.getByTestId("command-picker-add-setSwitch").click();
  await expect(editor.getByTestId("event-command-setSwitch")).toHaveCount(0);
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("스위치 조작");
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(insertPicker).toBeHidden();

  const switchCommand = editor.getByTestId("event-command-setSwitch");
  await expect(switchCommand).toBeVisible();
  await switchCommand.locator(".cmd-head").click({ button: "right" });
  await contextMenu.getByTestId("event-command-menu-edit").click();
  await expect(commandDialog).toBeVisible();
  await commandDialog.getByTestId("event-switch-picker-open").click();
  const recordPicker = page.getByTestId("event-record-picker");
  await expect(recordPicker).toBeVisible();
  await recordPicker.getByTestId("event-record-picker-add").click();
  const selectedSwitchRow = recordPicker.locator(".event-record-picker-row[aria-selected='true']");
  await expect(selectedSwitchRow).toContainText("새 스위치");
  await selectedSwitchRow.click();
  await recordPicker.getByTestId("event-record-picker-ok").click();
  await expect(recordPicker).toBeHidden();
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(commandDialog).toBeHidden();

  await editor.getByTestId("event-page-trigger-select").selectOption("auto");
  await expect(editor.getByTestId("event-page-safety-warning")).toBeVisible();
  await expect(editor.getByTestId("event-page-safety-warning")).toContainText("자동");
  await page.screenshot({ path: testInfo.outputPath("event-editor-context-menu-picker-warning.png"), fullPage: true });
});
