import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

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
  await seedProjectFromSupabaseCanonical(page, project);

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
  await seedProjectFromSupabaseCanonical(page, project);

  const editor = await openEventEditor(page, project.startMapId);
  const cmdList = editor.locator(".event-contents-fieldset .cmd-list");
  const toolbar = editor.locator(".event-editor-command-toolbar");
  const presetBar = editor.getByTestId("follower-preset-bar");
  const viewSwitcher = editor.locator(".event-storyboard-host");
  const storyboard = editor.locator(".event-storyboard");
  const graph = editor.locator(".event-graph-placeholder");

  await expect(storyboard).toBeVisible();
  await expect(cmdList).toBeHidden();
  await expect(graph).toBeHidden();
  await editor.getByTestId("event-view-toggle-list").click();

  await expect(cmdList).toBeVisible();
  await expect(storyboard).toBeHidden();
  await expect(graph).toBeHidden();
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
  expect(presetBox.y + presetBox.height).toBeLessThanOrEqual(cmdListBox.y);
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

/** Prefer live preview; fall back to flowchart / AI chip if preview is absent. */
async function openAuxChip(editor: Locator): Promise<Locator> {
  const candidates = [
    "event-script-live-preview",
    "event-script-flowchart",
    "ai-event-assist",
  ] as const;

  for (const testId of candidates) {
    const chip = editor.getByTestId(testId);
    if ((await chip.count()) === 0) continue;
    await expect(chip).toBeVisible();
    const isOpen = await chip.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
    if (!isOpen) {
      await chip.locator("summary").first().click();
    }
    await expect
      .poll(async () => chip.evaluate((node) => node instanceof HTMLDetailsElement && node.open))
      .toBe(true);
    return chip;
  }

  throw new Error("no event-editor aux chip found for AC10 non-occlusion check");
}
