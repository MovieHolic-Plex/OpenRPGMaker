/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { getAudioEngine, stopAllAudio } from "@/player/audio";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import {
  AUDIO_SEARCH_ID,
  AUDIO_SEARCH_SENTINEL,
  audioCommandContext,
  audioElement,
  audioSearchProject,
  catalogDescriptionProbe,
  enterAudioSearch,
} from "./support/audioSearchFixture";

let previous: Project;
beforeEach(() => {
  previous = store.getCurrent();
  store.replace(audioSearchProject());
});
afterEach(() => {
  stopAllAudio();
  document.body.replaceChildren();
  store.replace(previous);
  vi.restoreAllMocks();
});

describe("selected command audio descriptions", () => {
  it("finds the effective description when searching the inline play-audio editor", () => {
    // Given
    const body = playAudioBodyForTest(audioCommandContext(), {
      kind: "playAudio", resourceId: "", loop: true,
    });
    document.body.append(body);
    // When
    enterAudioSearch("play-audio-search", AUDIO_SEARCH_SENTINEL);
    // Then
    const select = audioElement(body, "select", "play-audio-resource-select");
    expect([...select.options].map(option => option.value)).toEqual(["", AUDIO_SEARCH_ID]);
  });

  it("reads fresh metadata when editing a selection after the project changed", () => {
    // Given
    const body = playAudioBodyForTest(audioCommandContext(), {
      kind: "playAudio", resourceId: AUDIO_SEARCH_ID, loop: true,
    });
    document.body.append(body);
    store.replace(audioSearchProject("music", "EDITED_DESCRIPTION_C811"));
    const select = audioElement(body, "select", "play-audio-resource-select");
    // When
    select.dispatchEvent(new Event("change"));
    // Then
    expect(audioElement(body, "div", "audio-description-text").textContent)
      .toBe("EDITED_DESCRIPTION_C811");
  });

  it.each([
    ["music", "m2-027-change-system-bgm"],
    ["sound", "m2-028-change-system-se"],
  ] as const)("updates the actual M2 preview when selecting %s", (kind, commandId) => {
    // Given
    store.replace(audioSearchProject(kind));
    const replace = vi.fn();
    const body = renderM2CommandBody(audioCommandContext(replace), {
      kind: "m2Command", commandId, fields: { resourceId: "", volume: 100 },
    });
    assert.ok(body);
    document.body.append(body);
    const select = audioElement(body, "select", "m2-command-resourceId-picker");
    select.value = AUDIO_SEARCH_ID;
    // When
    select.dispatchEvent(new Event("change"));
    // Then
    const preview = audioElement(body, "div", "m2-command-resourceId-preview");
    expect(preview.dataset.resourceId).toBe(AUDIO_SEARCH_ID);
    expect(audioElement(preview, "div", "audio-description-text").textContent)
      .toBe(AUDIO_SEARCH_SENTINEL);
    expect(audioElement(preview, "div", "audio-description").dataset.descriptionSource)
      .toBe("project");
    expect(replace).toHaveBeenCalledWith([0], expect.objectContaining({
      fields: expect.objectContaining({ resourceId: AUDIO_SEARCH_ID }),
    }));
  });

  it("includes catalog-only resources when rendering an M2 audio selector", () => {
    // Given
    const { track } = catalogDescriptionProbe();
    const project = audioSearchProject();
    project.resourceProfiles = [];
    store.replace(project);
    // When
    const body = renderM2CommandBody(audioCommandContext(), {
      kind: "m2Command",
      commandId: "m2-027-change-system-bgm",
      fields: { resourceId: track.id, volume: 100 },
    });
    // Then
    assert.ok(body);
    const select = audioElement(body, "select", "m2-command-resourceId-picker");
    expect([...select.options].map(option => option.value)).toContain(track.id);
    expect(audioElement(body, "div", "audio-description-text").textContent).toBe(track.brief);
  });

  it("shows the full effective description through the real command-preview dispatch", () => {
    // Given
    const description = `${AUDIO_SEARCH_SENTINEL}${"z".repeat(260)}`;
    store.replace(audioSearchProject("music", description));
    const play = vi.spyOn(getAudioEngine(), "play").mockImplementation(() => undefined);
    // When
    const preview = renderCommandPreview({
      kind: "playAudio", resourceId: AUDIO_SEARCH_ID, loop: true,
    });
    // Then
    expect(audioElement(preview, "div", "audio-description-text").textContent).toBe(description);
    expect(audioElement(preview, "div", "audio-description").dataset.descriptionSource)
      .toBe("project");
    expect(play).not.toHaveBeenCalled();
  });

  it("retains the stopAudio surface without adding selected-resource metadata", () => {
    // Given
    const play = vi.spyOn(getAudioEngine(), "play").mockImplementation(() => undefined);
    // When
    const preview = renderCommandPreview({ kind: "stopAudio" });
    // Then
    expect(preview.querySelector(".ecp-audio-icon.stop")).not.toBeNull();
    expect(preview.querySelector('[data-testid="audio-description"]')).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });
});
