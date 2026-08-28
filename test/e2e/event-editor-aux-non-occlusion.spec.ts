import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { mockupProject } from "./mockupProbeSeeds";
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

test("AI assist stays readable above the compact inspector", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  const { project, eventId } = mockupProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await page.evaluate(async ({ mapId, id }) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openEventEditorModal(mapId, id);
  }, { mapId: project.startMapId, id: eventId });

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-view-toggle-list").click();
  await editor.locator(".cmd-item .cmd-head").first().click();
  await expect(editor.getByTestId("event-editor-inspector")).toBeVisible();

  const auxShell = editor.getByTestId("event-editor-aux-tools");
  await auxShell.locator(":scope > summary").click();
  const ai = editor.getByTestId("ai-event-assist");
  await ai.locator(":scope > summary").click();
  const card = ai.locator(".ai-event-assist-body");
  await expect(card).toBeVisible();

  const probe = await card.evaluate((body) => {
    const cardRect = body.getBoundingClientRect();
    const modalRect = body.closest<HTMLElement>('[role="dialog"]')?.getBoundingClientRect();
    const summaryRect = body.parentElement?.querySelector("summary")?.getBoundingClientRect();
    const inspectorRect = body.closest<HTMLElement>(".event-editor-workbench")
      ?.querySelector<HTMLElement>(".event-editor-inspector-column")
      ?.getBoundingClientRect();
    const input = body.querySelector<HTMLElement>(".ai-event-input");
    const inputStyle = input ? getComputedStyle(input) : null;
    const overlapX = inspectorRect ? Math.max(cardRect.left, inspectorRect.left) + 12 : cardRect.right - 12;
    const overlapY = inspectorRect ? Math.max(cardRect.top, inspectorRect.top) + 12 : cardRect.top + 12;
    const topNode = document.elementFromPoint(overlapX, overlapY);

    return {
      cardAboveInspector: Boolean(topNode && body.contains(topNode)),
      cardWithinModal: Boolean(
        modalRect &&
          cardRect.left >= modalRect.left &&
          cardRect.right <= modalRect.right &&
          cardRect.top >= modalRect.top &&
          cardRect.bottom <= modalRect.bottom
      ),
      clearsChipRow: Boolean(summaryRect && cardRect.bottom < summaryRect.top),
      inputLineHeight: Number.parseFloat(inputStyle?.lineHeight ?? "0"),
      inputHeight: input?.getBoundingClientRect().height ?? 0,
      width: cardRect.width,
    };
  });

  expect(probe.cardAboveInspector).toBe(true);
  expect(probe.cardWithinModal).toBe(true);
  expect(probe.clearsChipRow).toBe(true);
  expect(probe.width).toBeLessThanOrEqual(680);
  expect(probe.inputLineHeight).toBeGreaterThanOrEqual(21);
  expect(probe.inputHeight).toBeGreaterThanOrEqual(96);

  await mkdir("output/evidence/event-ai-assist-ux", { recursive: true });
  await editor.screenshot({ path: "output/evidence/event-ai-assist-ux/960x900-compact.png" });
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

/** Prefer the flowchart chip; fall back to the AI chip when absent. */
async function openAuxChip(editor: Locator): Promise<Locator> {
  const shell = editor.getByTestId("event-editor-aux-tools");
  const shellOpen = await shell.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
  if (!shellOpen) await shell.locator(":scope > summary").click();

  const candidates = [
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
