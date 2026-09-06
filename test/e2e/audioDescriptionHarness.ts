import { expect, type Page } from "@playwright/test";

/** Real editor, loaded temporary store, and a small normal audio-authoring fixture. */
export async function prepareAudioEditor(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("toolbar-resource-manager")).toBeVisible({ timeout: 60000 });
  await page.evaluate(async () => {
    const storePath = "/src/project/store.ts";
    const defaultsPath = "/src/project/defaults.ts";
    const selectionPath = "/src/editor/mapSelection.ts";
    const [{ store }, { createBlankProject }, { focusProjectStartMap }]: [
      typeof import("../../src/project/store"),
      typeof import("../../src/project/defaults"),
      typeof import("../../src/editor/mapSelection"),
    ] = await Promise.all([import(storePath), import(defaultsPath), import(selectionPath)]);
    if (!store.isLoaded()) {
      await new Promise<void>((resolve, reject) => {
        const deadline = AbortSignal.timeout(60000);
        const expired = () => {
          unsubscribe();
          reject(new Error("Project load did not complete"));
        };
        const unsubscribe = store.subscribe(() => {
          if (!store.isLoaded()) return;
          unsubscribe();
          deadline.removeEventListener("abort", expired);
          resolve();
        });
        deadline.addEventListener("abort", expired, { once: true });
      });
    }
    if (store.isRemotePersistenceEnabled()) throw new Error("Audio QA requires a temporary session");
    store.replaceProject(createBlankProject());
    focusProjectStartMap();
  });
}
