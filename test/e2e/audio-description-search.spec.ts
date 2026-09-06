import { expect, test } from "@playwright/test";
import { prepareAudioEditor } from "./audioDescriptionHarness";

test.beforeEach(async ({ page }) => {
  await prepareAudioEditor(page);
});

test("finds and refreshes uploaded descriptions through the real audio-test toolbar", async ({ page }, info) => {
  // Given: seed project data, not the implementation being asserted.
  const id = "qa-browser-description-upload";
  const description = "BROWSER_AUDIO_ONLY_A71";
  await page.evaluate(async ({ id, description }) => {
    const path = "/src/project/store.ts";
    const module: typeof import("../../src/project/store") = await import(/* @vite-ignore */ path);
    const project = module.store.getCurrent();
    module.store.replace({
      ...project,
      resourceProfiles: [{ kind: "music", assetId: id, name: "profile-name" }],
      assets: {
        ...project.assets,
        uploaded: {
          [id]: {
            id, kind: "music", name: "upload-name",
            dataUrl: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
            meta: {},
          },
        },
      },
      audioDescriptions: { music: { [id]: description } },
    });
  }, { id, description });
  // When
  await page.getByTestId("toolbar-sound-test").click();
  await page.getByTestId("audio-test-filter").fill(description);
  await page.getByTestId("audio-test-list").locator(`button[data-resource-id="${id}"]`).click();
  // Then
  const details = page.getByTestId("audio-test-description");
  await expect(details.getByTestId("audio-description-text")).toHaveText(description);
  await expect(details.getByTestId("audio-description")).toHaveAttribute("data-description-source", "project");
  await expect(page.getByTestId("audio-test-play")).toBeEnabled();
  await expect(page.getByTestId("audio-test-list").locator(`[data-resource-id="${id}"]`)).toHaveCount(1);
  const updated = "BROWSER_AUDIO_UPDATED_A71";
  await page.evaluate(async ({ id, updated }) => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    store.update(project => { project.audioDescriptions = { music: { [id]: updated } }; });
  }, { id, updated });
  await expect(details.getByTestId("audio-description-text")).toHaveText(updated);
  await expect(page.getByTestId("audio-test-list").locator(`[data-resource-id="${id}"]`)).toHaveCount(0);
  await page.getByTestId("audio-test-filter").fill(updated);
  await expect(page.getByTestId("audio-test-list").locator(`[data-resource-id="${id}"]`)).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("audio-test-live-update.png") });
  await page.evaluate(async id => {
    const path = "/src/project/store.ts";
    const { store }: typeof import("../../src/project/store") = await import(path);
    store.replaceProject({
      ...store.getCurrent(),
      audioDescriptions: { music: { [id]: "OTHER_PROJECT_A71" } },
    });
  }, id);
  await expect(page.getByTestId("audio-test-dialog")).toHaveCount(0);
});

test("keeps MIDI unplayable when selected through the real audio-test toolbar", async ({ page }) => {
  // Given
  await page.getByTestId("toolbar-sound-test").click();
  const midi = page.getByTestId("audio-test-list").locator('button[data-audio-midi="true"]').first();
  // When: these existing rows permit inspection but advertise disabled playback.
  await midi.click({ force: true });
  // Then
  await expect(page.getByTestId("audio-test-play")).toBeDisabled();
  await expect(page.getByTestId("audio-test-description").getByTestId("audio-description"))
    .toHaveAttribute("data-description-source", "metadata-derived");
  await expect(midi).toHaveAttribute("aria-disabled", "true");
});
