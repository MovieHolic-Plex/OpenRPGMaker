/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { audioSearchProject, audioElement, AUDIO_SEARCH_ID } from "./support/audioSearchFixture";
import { installPreviewMedia, mediaEvent, mediaMetadata, previewMedia } from "./support/previewMedia";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { createAudioDescriptionDetail } from "@/editor/panels/audioDescriptionDetail";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { getAudioEngine } from "@/player/audio";

const disposals: (() => void)[] = [];

const previous = store.getCurrent();
beforeEach(() => { store.replace(audioSearchProject()); installPreviewMedia(); });
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="audio-test-close"]')?.click();
  document.querySelector<HTMLButtonElement>('[data-testid="preview-picker-cancel"]')?.click();
  disposals.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  resetModalStackForTest();
  store.replace(previous);
  vi.restoreAllMocks();
});

function openSurface(surface: "dialog" | "manager" | "picker"): string {
  switch (surface) {
    case "dialog":
      openAudioTestDialog();
      document.querySelector<HTMLButtonElement>(`[data-testid="audio-test-list"] [data-resource-id="${AUDIO_SEARCH_ID}"]`)?.click();
      return "audio-test";
    case "manager": {
      const resource = listAudioResources("music", store.getCurrent()).find(entry => entry.id === AUDIO_SEARCH_ID);
      if (!resource) throw new Error("Audio fixture missing");
      const detail = createAudioDescriptionDetail(resource, { import: vi.fn(), save: vi.fn(), reset: vi.fn(), delete: vi.fn() });
      document.body.append(detail.element); disposals.push(detail.dispose);
      return "audio-description-preview";
    }
    case "picker":
      openDatabaseResourcePickerDialog({ kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID, testidPrefix: "preview-picker", onConfirm: vi.fn() });
      return "db-resource-picker-audio";
  }
}

describe.each(["dialog", "manager", "picker"] as const)("common transport in %s", surface => {
  it("plays on the first click during metadata loading, then pauses and seeks from media state", async () => {
    const prefix = openSurface(surface);
    const media = previewMedia();
    const play = audioElement(document, "button", `${prefix}-play`);
    media.dispatchEvent(new Event("loadstart"));
    expect(play.getAttribute("aria-pressed")).toBe("false");
    const requested = mediaEvent(media, "play");
    play.click(); await requested;
    expect(play.getAttribute("aria-pressed")).toBe("false");
    media.dispatchEvent(new Event("playing"));
    expect(play.getAttribute("aria-pressed")).toBe("true");
    mediaMetadata(media, 0.18);
    expect(audioElement(document, "output", `${prefix}-time`).textContent).toContain("0:00.18");
    const seek = audioElement(document, "input", `${prefix}-seek`);
    seek.value = "0.1"; seek.dispatchEvent(new Event("input"));
    expect(media.currentTime).toBe(0.1);
    const paused = mediaEvent(media, "pause"); play.click(); await paused;
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(`[data-testid="${prefix}-transport"]`)?.getAttribute("data-state")).toBe("paused");
  });
  it("does not touch gameplay audio when settings, playback and stop are used", async () => {
    const engine = getAudioEngine();
    const before = engine.audioStateSnapshot();
    const gamePlay = vi.spyOn(engine, "play"); const gameStop = vi.spyOn(engine, "stopAll");
    const prefix = openSurface(surface);
    const media = previewMedia();
    const requested = mediaEvent(media, "play");
    audioElement(document, "button", `${prefix}-play`).click(); await requested;
    media.dispatchEvent(new Event("playing"));
    for (const [id, value] of [["volume", "40"], ["tempo", "135"], ["fade", "4"]]) {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="${prefix}-${id}"] input`);
      if (!input) throw new Error("Preview slider missing");
      input.value = value ?? ""; input.dispatchEvent(new Event("input"));
    }
    expect(media.volume).toBe(0.4); expect(media.playbackRate).toBe(1.35);
    audioElement(document, "button", `${prefix}-stop`).click();
    expect(engine.audioStateSnapshot()).toEqual(before);
    expect(gamePlay).not.toHaveBeenCalled(); expect(gameStop).not.toHaveBeenCalled();
  });
});

it("keeps authored description reset unique and typing keys native", () => {
  openSurface("manager");
  expect(document.querySelectorAll('[data-testid="audio-description-reset"]')).toHaveLength(1);
  expect(document.querySelectorAll('[data-testid="audio-description-preview-reset"]')).toHaveLength(1);
  const input = audioElement(document, "textarea", "audio-description-input");
  input.focus();
  for (const key of [" ", "ArrowLeft", "ArrowRight"]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    input.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  }
});

it("keeps only one selected picker media and preserves it through search", () => {
  openSurface("picker");
  const media = previewMedia();
  const search = audioElement(document, "input", "preview-picker-search");
  search.value = "empty-results-9999"; search.dispatchEvent(new Event("input"));
  expect(previewMedia()).toBe(media);
  expect(document.querySelectorAll("audio")).toHaveLength(1);
  expect(document.querySelector('[data-testid="preview-picker-list"] audio')).toBeNull();
});

it("stops a picker selection even when the next resource resolves to the same URL", async () => {
  const project = store.getCurrent();
  const original = project.assets.uploaded[AUDIO_SEARCH_ID];
  if (!original) throw new Error("Audio fixture missing");
  store.replace({ ...project, assets: { ...project.assets, uploaded: { ...project.assets.uploaded, alias: { ...original, id: "alias", name: "alias" } } } });
  openSurface("picker");
  const media = previewMedia();
  const requested = mediaEvent(media, "play");
  audioElement(document, "button", "db-resource-picker-audio-play").click(); await requested;
  const paused = mediaEvent(media, "pause");
  audioElement(document, "button", "preview-picker-option-alias").click(); await paused;
  expect(media.hasAttribute("src")).toBe(false);
  expect(previewMedia()).not.toBe(media);
  expect(audioElement(document, "button", "db-resource-picker-audio-play").getAttribute("aria-pressed")).toBe("false");
});

it("releases playing inline media when the owning DOM is replaced", async () => {
  const control = resourcePickerControl({ label: "Audio", kind: "music", resourceId: AUDIO_SEARCH_ID, testid: "inline-audio", onChange: vi.fn(), rerender: vi.fn() });
  document.body.append(control);
  const media = previewMedia();
  const requested = mediaEvent(media, "play");
  audioElement(document, "button", "db-resource-picker-audio-play").click(); await requested;
  media.dispatchEvent(new Event("playing"));
  const paused = mediaEvent(media, "pause");
  control.replaceWith(document.createElement("div")); await paused;
  expect(media.hasAttribute("src")).toBe(false);
});

it("stops an active picker when another editor preview starts", async () => {
  openSurface("picker"); const old = previewMedia();
  const first = mediaEvent(old, "play");
  audioElement(document, "button", "db-resource-picker-audio-play").click(); await first;
  old.dispatchEvent(new Event("playing"));
  openSurface("dialog");
  const paused = mediaEvent(old, "pause"); audioElement(document, "button", "audio-test-play").click(); await paused;
  expect(old.paused).toBe(true);
});

it("exposes an idle seekable transport without autoplay when a dialog resource is selected", () => {
  // Given: the actual existing dialog, not a mocked component.
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  openAudioTestDialog();
  // When
  document.querySelector<HTMLButtonElement>(
    '[data-testid="audio-test-list"] [data-resource-id="' + AUDIO_SEARCH_ID + '"]',
  )?.click();
  // Then: this assertion fails on the current UI because seek does not exist.
  expect(document.querySelector('[data-testid="audio-test-seek"]')).not.toBeNull();
  expect(audioElement(document, "button", "audio-test-play").disabled).toBe(false);
  expect(play).not.toHaveBeenCalled();
});
