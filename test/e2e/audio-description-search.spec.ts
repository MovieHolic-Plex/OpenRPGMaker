import { expect, test } from "@playwright/test";
import { prepareAudioEditor } from "./audioDescriptionHarness";

test.beforeEach(async ({ page }) => {
  await prepareAudioEditor(page);
});

test("finds an uploaded description through the real audio-test toolbar", async ({ page }) => {
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
