import {
  AUDIO_DESCRIPTION_SOURCE_LABELS,
  isCatalogBgmAvailable,
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

export function audioResourceDocument(resource: AudioResource, project: Pick<Project, "assets">): HTMLElement {
  return el("div", {
    class: "audio-preview-document",
    children: [
      el("h3", { text: resource.name }),
      el("div", { class: "audio-preview-tags", text: resource.tags.join(" · ") }),
      audioDescriptionView(resource),
      el("details", { class: "audio-preview-meta", children: [
        el("summary", { text: `${resource.kind === "music" ? "음악" : "효과음"} · 파일 정보` }),
        el("div", { text: resource.id }),
        el("div", { text: resolveAudioSource(resource.id, project) ?? "파일 없음" }),
      ] }),
    ],
  });
}

export function audioPlayback(
  resourceId: string,
  project: Pick<Project, "assets">,
): { readonly url: string | null; readonly playable: boolean; readonly midi: boolean } {
  const url = resolveAudioSource(resourceId, project);
  const midi = url !== null && /\.midi?(?:[?#]|$)/iu.test(url);
  const playable = url !== null && !midi && isCatalogBgmAvailable(resourceId) && (
    /\.(?:wav|ogg|mp3|m4a)(?:[?#]|$)/iu.test(url)
    || /^data:audio\//iu.test(url)
    || url.startsWith("blob:")
  );
  return { url, playable, midi };
}

/** 목록 행 글자 — 「필드 — Town Theme (CC0)」 를 곡 이름(주)과 「필드 · CC0」(보조)로 나눈다. */
export function audioRowParts(name: string): { readonly title: string; readonly meta: string } {
  const license = name.match(/\s*\((CC0|CC-BY[^)]*|CC BY[^)]*)\)\s*$/u);
  const base = license ? name.slice(0, license.index).trim() : name.trim();
  const dash = base.indexOf(" — ");
  const title = dash > 0 ? base.slice(dash + 3).trim() : base;
  const meta = [dash > 0 ? base.slice(0, dash).trim() : "", license?.[1] ?? ""].filter(Boolean).join(" · ");
  return { title, meta };
}

/** 미리 듣기를 못 하는 이유 한 마디. */
export function audioUnplayableReason(playback: { readonly url: string | null; readonly midi: boolean }): string {
  if (playback.midi) return "MIDI · 미리 듣기 불가";
  if (playback.url === null) return "파일 없음";
  return "지원하지 않는 형식";
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
