import type { AudioDescriptionSource, AudioResource } from "@/assets/audioResourceCatalog";
import { AUDIO_DESCRIPTION_MAX_LENGTH, getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { store } from "@/project/store";
import { el } from "@/util/dom";

const SOURCE_LABELS = {
  project: "프로젝트 설명",
  "catalog-brief": "곡 기획 설명",
  "metadata-derived": "메타데이터 기반 설명",
  missing: "설명 없음",
} as const satisfies Record<AudioDescriptionSource, string>;

type AudioDetailActions = {
  readonly import: () => void;
  readonly save: () => void;
  readonly reset: () => void;
  readonly delete: () => void;
};

export function createAudioDescriptionDetail(resource: AudioResource, actions: AudioDetailActions) {
  const name = el("h3", { class: "rm-audio-name" });
  const identity = el("div", { class: "rm-audio-meta" });
  const source = el("div", {
    class: "rm-audio-meta", dataset: { testid: "audio-description-source" },
  });
  const input = el("textarea", {
    class: "rm-audio-description",
    attrs: { rows: "6", maxlength: String(AUDIO_DESCRIPTION_MAX_LENGTH) },
    dataset: { testid: "audio-description-input" },
  });
  const status = el("div", {
    class: "rm-audio-meta", attrs: { role: "status" },
    dataset: { testid: "audio-description-status" },
  });
  const playbackStatus = el("div", {
    class: "rm-audio-meta", attrs: { role: "status" },
    dataset: { testid: "audio-description-playback-status" },
  });
  const audio = el("audio", {
    attrs: { controls: "", preload: "none", "aria-label": "선택한 음원 미리듣기" },
    dataset: { testid: "audio-description-preview" },
  });
  audio.addEventListener("error", () => {
    playbackStatus.textContent = "이 음원을 재생할 수 없습니다.";
  });
  audio.addEventListener("playing", () => { playbackStatus.textContent = "재생 중"; });
  audio.addEventListener("pause", () => { playbackStatus.textContent = "일시 정지"; });
  audio.addEventListener("ended", () => { playbackStatus.textContent = "재생 완료"; });
  const reset = el("button", {
    class: "rm-command-button", text: "기본 설명 복원", attrs: { type: "button" },
    dataset: { testid: "audio-description-reset" }, on: { click: actions.reset },
  });
  const remove = el("button", {
    class: "rm-command-button", text: "업로드 삭제", attrs: { type: "button" },
    dataset: { testid: "audio-description-delete" }, on: { click: actions.delete },
  });
  const element = el("aside", {
    class: "rm-command-panel rm-audio-detail",
    dataset: { testid: "resource-command-panel" },
    attrs: { "aria-label": "음원 설명 편집" },
    children: [
      el("button", {
        class: "rm-command-button", text: "가져오기...", attrs: { type: "button" },
        dataset: { testid: "resource-import-button" }, on: { click: actions.import },
      }),
      name, identity, audio, playbackStatus, source,
      el("label", { class: "rm-audio-field", children: ["설명", input] }),
      el("button", {
        class: "rm-command-button primary", text: "설명 저장", attrs: { type: "button" },
        dataset: { testid: "audio-description-save" }, on: { click: actions.save },
      }),
      reset, status, remove,
      el("div", {
        class: "rm-audio-meta",
        text: "빈 설명을 저장하면 기본 설명도 표시하지 않습니다. 복원은 프로젝트 설명을 제거합니다.",
      }),
    ],
  });
  const update = (current: AudioResource): void => {
    const project = store.getCurrent();
    name.textContent = current.name;
    identity.textContent = `${current.kind === "music" ? "BGM" : "SE"} · ${current.id}`;
    source.textContent = SOURCE_LABELS[current.descriptionSource];
    source.dataset.source = current.descriptionSource;
    reset.disabled = getAudioDescriptionOverride(project.audioDescriptions, {
      kind: current.kind, resourceId: current.id,
    }) === undefined;
    remove.disabled = project.assets.uploaded[current.id]?.kind !== current.kind;
    remove.title = remove.disabled ? "기본 음원 파일은 삭제할 수 없습니다." : "";
    const url = resolveAudioSource(current.id, project);
    const playable = url !== null && !/\.midi?(?:[?#]|$)/iu.test(url);
    audio.hidden = !playable;
    if (!playable) {
      audio.pause();
      audio.removeAttribute("src");
      playbackStatus.textContent = url ? "재생 불가 (MIDI)" : "재생 가능한 파일이 없습니다.";
    } else if (audio.getAttribute("src") !== url) {
      audio.pause();
      audio.src = url;
      playbackStatus.textContent = "미리듣기";
    }
  };
  update(resource);
  return {
    element, input, status, update,
    dispose: (): void => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

export type AudioDescriptionDetail = ReturnType<typeof createAudioDescriptionDetail>;
