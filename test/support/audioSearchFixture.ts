import assert from "node:assert/strict";
import { BGM_CATALOG, bgmTrackLabel } from "@/assets/bgmCatalog";
import { createBlankProject } from "@/project/defaults";
import type { AudioResourceKind, Project } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";

export const AUDIO_SEARCH_ID = "qa-audio-description-upload";
export const AUDIO_SEARCH_SENTINEL = "AUDIO_SEARCH_ONLY_6F12C9";
export const AUDIO_SEARCH_DATA_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function audioSearchProject(
  kind: AudioResourceKind = "music",
  description = AUDIO_SEARCH_SENTINEL,
): Project {
  const project = createBlankProject();
  return {
    ...project,
    resourceProfiles: [
      { kind, assetId: AUDIO_SEARCH_ID, name: "profile-name" },
      { kind, assetId: "qa-audio-profile-only", name: "profile-only" },
    ],
    assets: {
      ...project.assets,
      uploaded: {
        [AUDIO_SEARCH_ID]: {
          id: AUDIO_SEARCH_ID,
          kind,
          name: "upload-name",
          dataUrl: AUDIO_SEARCH_DATA_URL,
          meta: {},
        },
      },
    },
    audioDescriptions: { [kind]: { [AUDIO_SEARCH_ID]: description } },
  };
}

export function catalogDescriptionProbe() {
  const track = BGM_CATALOG[0];
  assert.ok(track);
  const metadata = [bgmTrackLabel(track), ...track.tags, track.titleEn, track.trackCode];
  const token = track.brief.split(/\s+/u).find(word =>
    word.length > 2
    && !metadata.some(text => text.toLowerCase().includes(word.toLowerCase())),
  );
  assert.ok(token, "fixture requires a description-only catalog token");
  return { track, token };
}

export function audioCommandContext(
  replaceCommand: CommandListActions["replaceCommand"] = () => undefined,
): CommandEditContext {
  return {
    path: [0],
    actions: {
      addCommand: () => undefined,
      insertCommand: () => undefined,
      replaceCommand,
      deleteCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
    },
  };
}

export function audioElement<K extends keyof HTMLElementTagNameMap>(
  root: ParentNode,
  tag: K,
  testid: string,
): HTMLElementTagNameMap[K] {
  const result = root.querySelector<HTMLElementTagNameMap[K]>(
    `${tag}[data-testid="${testid}"]`,
  );
  assert.ok(result, `missing ${testid}`);
  return result;
}

export function enterAudioSearch(testid: string, value: string): void {
  const input = audioElement(document, "input", testid);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
