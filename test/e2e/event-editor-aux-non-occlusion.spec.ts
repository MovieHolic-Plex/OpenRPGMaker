import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";

/** AC10: open aux chip must not fully cover the command list (cmd-list height stays usable). */
const CMD_LIST_MIN_HEIGHT_PX = 48;

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-aux-non-occlusion");
  });
});

test("event editor aux chip leaves command list geometry usable (AC10)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = createBlankProject();
  await seedProjectForEditor(page, project);

  const editor = await openEventEditor(page, project.startMapId);
  await editor.getByTestId("event-view-toggle-list").click();
  const cmdList = editor.locator(".event-contents-fieldset .cmd-list");
  await expect(cmdList).toBeVisible();

  const closedBox = await cmdList.boundingBox();
  if (!closedBox) throw new Error("cmd-list geometry was not measurable before aux open");
  expect(closedBox.height).toBeGreaterThan(CMD_LIST_MIN_HEIGHT_PX);

  const auxChip = await openAuxChip(editor);
  await expect(auxChip).toHaveJSProperty("open", true);

  const openBox = await cmdList.boundingBox();
  if (!openBox) throw new Error("cmd-list geometry was not measurable while aux open");
  expect(openBox.height).toBeGreaterThan(CMD_LIST_MIN_HEIGHT_PX);
});

test("event editor preset and toolbar do not overlap the command list", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1180 });
  const project = createBlankProject();
  await seedProjectForEditor(page, project);

  const editor = await openEventEditor(page, project.startMapId);
  const cmdList = editor.locator(".event-contents-fieldset .cmd-list");
  const toolbar = editor.locator(".event-editor-command-toolbar");
  const presetBar = editor.getByTestId("follower-preset-bar");
  const viewSwitcher = editor.getByTestId("event-view-toggle");
  const storyboard = editor.locator(".event-storyboard");
  const graph = editor.locator(".event-graph-placeholder");

  await editor.getByTestId("event-view-toggle-storyboard").click();
  await expect(storyboard).toBeVisible();
  await expect(cmdList).toBeHidden();
  await expect(graph).toBeHidden();
  await editor.getByTestId("event-view-toggle-list").click();

  await expect(cmdList).toBeVisible();
  await expect(storyboard).toBeHidden();
  await expect(graph).toBeHidden();
  await editor.getByTestId("event-editor-aux-tools").locator(":scope > summary").click();
  await expect(toolbar).toBeVisible();
  await expect(presetBar).toBeVisible();
  await expect(viewSwitcher).toBeVisible();

  const [cmdListBox, toolbarBox, presetBox, viewSwitcherBox] = await Promise.all([
    cmdList.boundingBox(),
    toolbar.boundingBox(),
    presetBar.boundingBox(),
    viewSwitcher.boundingBox(),
  ]);
  if (!cmdListBox || !toolbarBox || !presetBox || !viewSwitcherBox) {
    throw new Error("event editor command geometry was not measurable");
  }

  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(cmdListBox.y);
  const presetOverlapsList =
    presetBox.y < cmdListBox.y + cmdListBox.height &&
    presetBox.y + presetBox.height > cmdListBox.y;
  expect(presetOverlapsList).toBe(false);
  expect(viewSwitcherBox.y + viewSwitcherBox.height).toBeLessThanOrEqual(cmdListBox.y);
});

async function openEventEditor(page: Page, mapId: string): Promise<Locator> {
  await page.evaluate(async (activeMapId) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openNewEventEditorModal(activeMapId, 3, 3);
  }, mapId);

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * 겹침 검사용 보조 칩을 하나 연다.
 *
 * 예전 1순위였던 `event-script-flowchart` 는 이 목록에 없다 — 플로우는 도구 팝오버
 * 아코디언에서 「이 페이지가 하는 일」 칼럼의 네 번째 보기 방식으로 승격됐고,
 * 그러면서 겹칠 수 있는 오버레이 자체를 그만뒀다.
 */
async function openAuxChip(editor: Locator): Promise<Locator> {
  // 조수 입구는 명령 칼럼 맨 아래 한 줄 입력칸이다(늘 보인다).
  const chip = editor.getByTestId("event-edit-line");
  await expect(chip).toBeVisible();
  return chip;
}
