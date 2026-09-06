import {
  AUDIO_DESCRIPTION_SOURCE_LABELS,
  type AudioResource,
} from "@/assets/audioResourceCatalog";
import { resolveAudioSource } from "@/player/audio/audioResources";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export function audioDescriptionView(resource: AudioResource | undefined): HTMLElement {
  const source = resource?.descriptionSource ?? "missing";
  return el("div", {
    dataset: { testid: "audio-description", descriptionSource: source },
    children: [
      el("div", {
        text: resource?.description ?? "",
        attrs: { style: "white-space:pre-wrap;overflow-wrap:anywhere" },
        dataset: { testid: "audio-description-text" },
      }),
      el("small", {
        text: AUDIO_DESCRIPTION_SOURCE_LABELS[source],
        dataset: { testid: "audio-description-source" },
      }),
    ],
  });
}

export function audioPlayback(
  resourceId: string,
  project: Pick<Project, "assets">,
): { readonly url: string | null; readonly playable: boolean; readonly midi: boolean } {
  const url = resolveAudioSource(resourceId, project);
  const midi = url !== null && /\.midi?(?:[?#]|$)/iu.test(url);
  const playable = url !== null && !midi && (
    /\.(?:wav|ogg|mp3|m4a)(?:[?#]|$)/iu.test(url)
    || /^data:audio\//iu.test(url)
    || url.startsWith("blob:")
  );
  return { url, playable, midi };
}

export function audioPlaybackBadge(
  resourceId: string,
  project: Pick<Project, "assets">,
): HTMLElement {
  const { playable, midi } = audioPlayback(resourceId, project);
  return el("span", {
    text: playable ? "미리 듣기 가능" : midi ? "MIDI 비재생" : "미리 듣기 불가",
    dataset: {
      testid: "audio-playback-status",
      playback: playable ? "playable" : midi ? "midi" : "unavailable",
    },
  });
}
