import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { prepareAudioEditor } from "./audioDescriptionHarness";

test.describe.configure({ retries: 0 });

async function openMusic(page: Page): Promise<void> {
  await page.getByTestId("toolbar-resource-manager").click();
  await page.getByTestId("resource-category-list").getByRole("option", { name: "음악 (BGM)", exact: true }).click();
}

/** Subscribe before the UI action; the emitted store change is the completion signal. */
async function storeAction(page: Page, action: () => Promise<unknown>): Promise<void> {
  const token = `audio-description-store-${crypto.randomUUID()}`;
  await page.evaluate(async signal => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    const abort = AbortSignal.timeout(30000);
    const unsubscribe = store.subscribe(() => {
      unsubscribe();
      abort.removeEventListener("abort", unsubscribe);
      console.info(signal);
    });
    abort.addEventListener("abort", unsubscribe, { once: true });
  }, token);
  const changed = page.waitForEvent("console", {
    predicate: message => message.text() === token, timeout: 30000,
  }).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await action();
  const observation = await changed;
  if (!observation.ok) throw observation.error;
}

async function projectJson(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    return JSON.stringify(store.getCurrent());
  });
}

async function importProject(page: Page, json: string): Promise<void> {
  await page.getByTestId("menu-project").click();
  const choosing = page.waitForEvent("filechooser");
  await page.getByTestId("menu-project-import").click();
  const chooser = await choosing;
  await storeAction(page, () => chooser.setFiles({
    name: "audio-project.json", mimeType: "application/json", buffer: Buffer.from(json),
  }));
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => {
      await prepareAudioEditor(page);
    });

    test("edits SE descriptions with matching search and AI detail", async ({ page }, info) => {
      const openSound = async (): Promise<void> => {
        await page.getByTestId("toolbar-resource-manager").click();
        await page.getByTestId("resource-category-list")
          .getByRole("option", { name: "효과음 (SE)", exact: true }).click();
      };
      await openSound();
      const id = await page.locator('[data-testid="audio-resource-row"][aria-pressed="true"]')
        .getAttribute("data-resource-id");
      if (!id) throw new Error("No sound resource selected");
      const description = "AUDIO_DESC_QA_20260906";
      await page.getByTestId("audio-description-input").fill(description);
      await storeAction(page, () => page.getByTestId("audio-description-save").click());
      await page.getByTestId("resource-modal-close").click();
      await openSound();
      expect(await page.getByTestId("audio-description-input").inputValue()).toBe(description);
      await page.getByTestId("audio-description-search").fill(description);
      expect(await page.getByTestId("audio-resource-row").count()).toBe(1);
      const detail = await page.evaluate(async id => {
        const storePath = "/src/project/store.ts";
        const toolsPath = "/src/editor/tools/index.ts";
        const { store }: typeof import("../../src/project/store") = await import(storePath);
        const { runTool }: typeof import("../../src/editor/tools") = await import(toolsPath);
        return runTool({ project: store.getCurrent() }, "get_audio_resource", {
          kind: "sound", resourceId: id,
        });
      }, id);
      expect(detail).toMatchObject({
        ok: true,
        data: { resource: { id, description, descriptionSource: "project" } },
      });
      expect(await page.getByTestId("audio-description-save").evaluate(button => {
        const pane = button.closest("aside");
        if (!pane) throw new Error("Missing audio detail pane");
        const bounds = button.getBoundingClientRect();
        const parent = pane.getBoundingClientRect();
        return bounds.top >= parent.top && bounds.bottom <= parent.bottom
          && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
      await page.screenshot({ path: info.outputPath("se-description-parity.png") });
    });

    test("edits, reopens, clears, resets and undoes through the resource manager", async ({ page }, info) => {
      // Given:
      await openMusic(page);
      const input = page.getByTestId("audio-description-input");
      expect(await input.count()).toBe(1);
      const initial = await input.inputValue();
      expect(initial.length).toBeGreaterThan(0);
      const originalSource = await page.getByTestId("audio-description-source").getAttribute("data-source");
      const id = await page.locator('[data-testid="audio-resource-row"][aria-pressed="true"]').getAttribute("data-resource-id");
      expect(id).toBeTruthy();
      // When: one authoring narrative.
      await input.fill("<b>browser sentinel</b>\nsecond line");
      await storeAction(page, () => page.getByTestId("audio-description-save").click());
      await page.getByTestId("resource-modal-close").click();
      await openMusic(page);
      expect(await input.inputValue()).toBe("<b>browser sentinel</b>\nsecond line");
      await page.getByTestId("audio-description-search").fill("browser sentinel");
      expect(await page.getByTestId("audio-resource-row").count()).toBe(1);
      await page.getByTestId("audio-description-search").fill("");
      expect(await page.getByTestId("resource-modal").locator("b").count()).toBe(0);
      await input.fill("");
      await storeAction(page, () => page.getByTestId("audio-description-save").click());
      expect(await input.inputValue()).toBe("");
      expect(await page.getByTestId("audio-description-source").getAttribute("data-source")).toBe("project");
      await storeAction(page, () => page.getByTestId("audio-description-reset").click());
      expect(await input.inputValue()).toBe(initial);
      await page.getByTestId("audio-description-save").focus();
      await storeAction(page, () => page.keyboard.press("Control+z"));
      expect(await input.inputValue()).toBe("");
      await page.getByTestId("audio-description-save").focus();
      await storeAction(page, () => page.keyboard.press("Control+y"));
      // Then:
      expect(await input.inputValue()).toBe(initial);
      expect(await page.getByTestId("audio-description-source").getAttribute("data-source")).toBe(originalSource);
      expect(await page.getByTestId("resource-modal").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath("edit-clear-reset-undo.png") });
    });

    test("preserves typed content and keyboard ownership after dirty cancellation", async ({ page }, info) => {
      // Given:
      await openMusic(page);
      const input = page.getByTestId("audio-description-input");
      await input.fill("dirty cancellation sentinel");
      // When:
      await page.keyboard.press("Escape");
      await page.getByTestId("audio-description-dirty-cancel").click();
      await page.getByTestId("resource-category-list").getByRole("option", { name: "효과음 (SE)", exact: true }).click();
      await page.getByTestId("audio-description-dirty-cancel").click();
      await page.keyboard.press("Escape");
      await page.getByTestId("audio-description-dirty-cancel").click();
      // Then:
      expect(await input.inputValue()).toBe("dirty cancellation sentinel");
      expect(await page.getByTestId("resource-category-list").getByRole("option", { name: "음악 (BGM)", exact: true })
        .getAttribute("aria-selected")).toBe("true");
      await page.screenshot({ path: info.outputPath("dirty-canceled.png") });
    });

    test("selects an upload, edits its description and deletes it", async ({ page }, info) => {
      // Given:
      await openMusic(page);
      const buffer = await readFile("public/assets/cc0/audio/ui-confirm.wav");
      // When:
      await storeAction(page, () => page.getByTestId("resource-file-input").setInputFiles({
        name: "audio-browser-upload.wav", mimeType: "audio/wav", buffer,
      }));
      const selected = page.locator('[data-testid="audio-resource-row"][aria-pressed="true"]');
      const id = await selected.getAttribute("data-resource-id");
      if (!id) throw new Error("Imported resource was not selected");
      expect(id.startsWith("bgm")).toBe(true);
      await page.getByTestId("audio-description-input").fill("upload sentinel");
      await storeAction(page, () => page.getByTestId("audio-description-save").click());
      await page.screenshot({ path: info.outputPath("upload-edited.png") });
      await storeAction(page, () => page.getByTestId("audio-description-delete").click());
      // Then:
      const remaining = await page.getByTestId("audio-resource-row").evaluateAll(nodes =>
        nodes.map(node => node.getAttribute("data-resource-id")));
      expect(remaining).not.toContain(id);
    });

    test("isolates descriptions across actual project imports", async ({ page }, info) => {
      // Given:
      await openMusic(page);
      const input = page.getByTestId("audio-description-input");
      const original = await input.inputValue();
      const projectB = await projectJson(page);
      await input.fill("project A only");
      await storeAction(page, () => page.getByTestId("audio-description-save").click());
      const projectA = await projectJson(page);
      await page.getByTestId("resource-modal-close").click();
      // When:
      await importProject(page, projectB);
      await openMusic(page);
      expect(await input.inputValue()).toBe(original);
      await page.getByTestId("resource-modal-close").click();
      await importProject(page, projectA);
      await openMusic(page);
      // Then:
      expect(await input.inputValue()).toBe("project A only");
      await page.screenshot({ path: info.outputPath("project-isolation.png") });
    });
  });
}
