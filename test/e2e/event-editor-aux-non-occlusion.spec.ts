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
    window.localStorage.setItem("rpg-zzu-editor-session-id", "e2e-event-aux-non-occlusion");
  });
});

test("event editor aux chip leaves command list geometry usable (AC10)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject());

  const editor = await openEventEditor(page);
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

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();

  await page.locator(".event-list-row").first().click();
  await page.getByTestId("event-editor-open").click();

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
