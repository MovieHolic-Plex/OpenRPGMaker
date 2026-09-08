/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BGM_CATALOG } from "@/assets/bgmCatalog";
import { SE_CATALOG } from "@/assets/seCatalog";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import {
  listDatabaseResourceOptions,
  openDatabaseResourcePickerDialog,
} from "@/editor/panels/databaseResourcePickerDialog";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { stopAllAudio } from "@/player/audio";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import {
  AUDIO_SEARCH_ID,
  AUDIO_SEARCH_SENTINEL,
  audioElement,
  audioSearchProject,
  catalogDescriptionProbe,
  enterAudioSearch,
} from "./support/audioSearchFixture";

// Preserve baseline fallback surface coverage; audioAiDescriptions.test.ts uses real drafts.
vi.mock("@/assets/audioAiDescriptions", () => ({ getAudioAiDescription: () => undefined }));

let previous: Project;
beforeEach(() => {
  previous = store.getCurrent();
  store.replace(audioSearchProject());
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="description-pick-cancel"]')?.click();
  document.querySelector<HTMLButtonElement>('[data-testid="audio-test-close"]')?.click();
  stopAllAudio();
  document.body.replaceChildren();
  resetModalStackForTest();
  store.replace(previous);
  vi.restoreAllMocks();
});

describe("audio picker descriptions", () => {
  it("does not confirm a removed selected audio resource", () => {
    const confirmed = vi.fn();
    openDatabaseResourcePickerDialog({
      kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: confirmed,
    });
    store.update(project => {
      delete project.assets.uploaded[AUDIO_SEARCH_ID];
      project.resourceProfiles = project.resourceProfiles.filter(profile => profile.assetId !== AUDIO_SEARCH_ID);
    });

    audioElement(document, "button", "description-pick-ok").click();

    expect(confirmed).not.toHaveBeenCalled();
  });

  it("refreshes an open picker when its project description changes", () => {
    openDatabaseResourcePickerDialog({
      kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    });
    const preview = audioElement(document, "div", "description-pick-preview");

    store.replace(audioSearchProject("music", "LIVE_DESCRIPTION_813"));

    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe("LIVE_DESCRIPTION_813");
  });

  it("stops refreshing detached content when the picker closes", () => {
    openDatabaseResourcePickerDialog({
      kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    });
    const preview = audioElement(document, "div", "description-pick-preview");
    audioElement(document, "button", "description-pick-cancel").click();

    store.replace(audioSearchProject("music", "AFTER_CLOSE_912"));

    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe(AUDIO_SEARCH_SENTINEL);
  });

  it("closes the old audio picker when the project is replaced", () => {
    openDatabaseResourcePickerDialog({
      kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    });

    store.replaceProject(audioSearchProject("music", "OTHER_PROJECT_612"));

    expect(document.querySelector('[data-testid="description-pick"]')).toBeNull();
  });

  it.each(["music", "sound"] as const)("retrieves a description-only result in the %s picker", kind => {
    // Given
    store.replace(audioSearchProject(kind));
    openDatabaseResourcePickerDialog({
      kind, title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    });
    // When
    enterAudioSearch("description-pick-search", AUDIO_SEARCH_SENTINEL);
    // Then
    const list = audioElement(document, "div", "description-pick-list");
    expect([...list.querySelectorAll<HTMLElement>("[data-resource-id]")]
      .map(node => node.dataset.resourceId)).toEqual([AUDIO_SEARCH_ID]);
    const preview = audioElement(document, "div", "description-pick-preview");
    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe(AUDIO_SEARCH_SENTINEL);
    expect(audioElement(preview, "div", "audio-description").dataset.descriptionSource)
      .toBe("project");
  });

  it.each(["cleared", "reset"] as const)("refreshes catalog inheritance when reopening after %s", state => {
    // Given
    const { track, token } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.audioDescriptions = { music: { [track.id]: AUDIO_SEARCH_SENTINEL } };
    store.replace(project);
    const options = {
      kind: "music" as const, title: "Audio", currentId: track.id,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    };
    openDatabaseResourcePickerDialog(options);
    audioElement(document, "button", "description-pick-cancel").click();
    store.replace({
      ...project,
      audioDescriptions: state === "cleared" ? { music: { [track.id]: "" } } : {},
    });
    // When
    openDatabaseResourcePickerDialog(options);
    enterAudioSearch("description-pick-search", token);
    // Then
    const list = audioElement(document, "div", "description-pick-list");
    const ids = [...list.querySelectorAll<HTMLElement>("[data-resource-id]")]
      .map(node => node.dataset.resourceId);
    expect(ids.includes(track.id)).toBe(state === "reset");
    const preview = audioElement(document, "div", "description-pick-preview");
    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe(state === "reset" ? track.brief : "");
    expect(audioElement(preview, "div", "audio-description").dataset.descriptionSource)
      .toBe(state === "reset" ? "catalog-brief" : "project");
  });

  it("uses the new project when reopening the picker after a project switch", () => {
    // Given
    const options = {
      kind: "music" as const, title: "Audio", currentId: AUDIO_SEARCH_ID,
      testidPrefix: "description-pick", onConfirm: () => undefined,
    };
    openDatabaseResourcePickerDialog(options);
    audioElement(document, "button", "description-pick-cancel").click();
    store.replace(audioSearchProject("music", "SECOND_PROJECT_987"));
    // When
    openDatabaseResourcePickerDialog(options);
    enterAudioSearch("description-pick-search", "SECOND_PROJECT_987");
    // Then
    const preview = audioElement(document, "div", "description-pick-preview");
    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe("SECOND_PROJECT_987");
    expect(audioElement(document, "div", "description-pick-list")
      .querySelectorAll("[data-resource-id]")).toHaveLength(1);
  });

  it("keeps the upload name and one option when a profile references the same upload", () => {
    // Given
    const project = audioSearchProject();
    // When
    const options = listDatabaseResourceOptions("music", project);
    // Then
    expect(options.filter(option => option.id === AUDIO_SEARCH_ID))
      .toEqual([expect.objectContaining({ name: "upload-name" })]);
    expect(options.some(option => option.id === "qa-audio-profile-only")).toBe(true);
  });
});

describe("audio test dialog catalog", () => {
  it("refreshes selected metadata and description-only search while open", () => {
    openAudioTestDialog();
    enterAudioSearch("audio-test-filter", AUDIO_SEARCH_SENTINEL);
    document.querySelector<HTMLButtonElement>(
      `[data-testid="audio-test-list"] button[data-resource-id="${AUDIO_SEARCH_ID}"]`,
    )?.click();
    store.replace(audioSearchProject("music", "LIVE_AUDIO_TEST_821"));
    const details = audioElement(document, "div", "audio-test-description");
    expect(audioElement(details, "div", "audio-description-text").textContent).toBe("LIVE_AUDIO_TEST_821");
    expect(audioElement(document, "div", "audio-test-list").querySelectorAll("[data-resource-id]")).toHaveLength(1);
    enterAudioSearch("audio-test-filter", "LIVE_AUDIO_TEST_821");
    expect(audioElement(document, "div", "audio-test-list").querySelectorAll("[data-resource-id]")).toHaveLength(2);
  });

  it("closes an open audio test dialog on project replacement", () => {
    openAudioTestDialog();
    store.replaceProject(audioSearchProject("music", "OTHER_PROJECT_912"));
    expect(document.querySelector('[data-testid="audio-test-dialog"]')).toBeNull();
  });

  it("unsubscribes when closed or replaced by a new audio test dialog", () => {
    const subscribe = store.subscribe.bind(store);
    const stopped = vi.fn();
    vi.spyOn(store, "subscribe").mockImplementation(listener => {
      const unsubscribe = subscribe(listener);
      return () => { stopped(); unsubscribe(); };
    });
    openAudioTestDialog();
    openAudioTestDialog();
    expect(stopped).toHaveBeenCalledTimes(1);
    audioElement(document, "button", "audio-test-close").click();
    expect(stopped).toHaveBeenCalledTimes(2);
  });

  it("clears the selected audio-test resource when it is removed", () => {
    openAudioTestDialog();
    enterAudioSearch("audio-test-filter", AUDIO_SEARCH_SENTINEL);
    document.querySelector<HTMLButtonElement>(
      `[data-testid="audio-test-list"] button[data-resource-id="${AUDIO_SEARCH_ID}"]`,
    )?.click();
    expect(audioElement(document, "button", "audio-test-play").disabled).toBe(false);
    store.update(project => {
      delete project.assets.uploaded[AUDIO_SEARCH_ID];
      project.resourceProfiles = project.resourceProfiles.filter(profile => profile.assetId !== AUDIO_SEARCH_ID);
    });
    expect(audioElement(document, "button", "audio-test-play").disabled).toBe(true);
    expect(audioElement(document, "div", "audio-test-description").textContent).toBe("");
    expect(audioElement(document, "button", "audio-test-option-off").getAttribute("aria-selected")).toBe("true");
  });

  it.each(["music", "sound"] as const)("includes the large %s catalog and uploaded descriptions", kind => {
    // Given
    store.replace(audioSearchProject(kind));
    openAudioTestDialog();
    audioElement(document, "button", `audio-test-tab-${kind}`).click();
    // When
    enterAudioSearch("audio-test-filter", AUDIO_SEARCH_SENTINEL);
    // Then
    const list = audioElement(document, "div", "audio-test-list");
    const options = [...list.querySelectorAll<HTMLElement>("[data-resource-id]")]
      .filter(node => node.dataset.resourceId !== "");
    expect(options.map(node => node.dataset.resourceId)).toEqual([AUDIO_SEARCH_ID]);
    const count = audioElement(document, "span", "audio-test-list-count").textContent ?? "";
    const total = Number(count.split("/")[1]?.replace(/\D/gu, ""));
    expect(total).toBeGreaterThan(kind === "music" ? BGM_CATALOG.length : SE_CATALOG.length);
  });

  it("shows full selected upload metadata when the filtered upload is selected", () => {
    // Given
    const description = `${AUDIO_SEARCH_SENTINEL}${"x".repeat(250)}`;
    store.replace(audioSearchProject("music", description));
    openAudioTestDialog();
    enterAudioSearch("audio-test-filter", AUDIO_SEARCH_SENTINEL);
    const option = document.querySelector<HTMLButtonElement>(
      `[data-testid="audio-test-list"] button[data-resource-id="${AUDIO_SEARCH_ID}"]`,
    );
    expect(option).not.toBeNull();
    // When
    option?.click();
    // Then
    const details = audioElement(document, "div", "audio-test-description");
    expect(audioElement(details, "div", "audio-description-text").textContent).toBe(description);
    expect(audioElement(details, "div", "audio-description").dataset.descriptionSource)
      .toBe("project");
    expect(audioElement(document, "button", "audio-test-play").disabled).toBe(false);
  });
});
