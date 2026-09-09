import { AUDIO_DESCRIPTION_SOURCE_LABELS, type AudioResource } from "@/assets/audioResourceCatalog";
import { AUDIO_DESCRIPTION_MAX_LENGTH, getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { createAudioPreviewPlayer } from "./audioPreviewPlayer";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type AudioDetailActions = {
  readonly import: () => void;
  readonly save: () => void;
  readonly reset: () => void;
  readonly delete: () => void;
};

export function createAudioDescriptionDetail(resource: AudioResource, actions: AudioDetailActions) {
  const name = el("h3", { class: "rm-audio-name" });
  const identity = el("div", { class: "rm-audio-meta" });
  const tags = el("div", { class: "audio-preview-tags" });
  const player = createAudioPreviewPlayer("audio-description-preview");
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
    children: [el("div", { class: "rm-audio-detail-scroll", children: [
      el("button", {
        class: "rm-command-button", text: "가져오기...", attrs: { type: "button" },
        dataset: { testid: "resource-import-button" }, on: { click: actions.import },
      }),
      name, tags,
      el("label", { class: "rm-audio-field", children: ["설명", input] }),
      source, identity,
      el("button", {
        class: "rm-command-button primary", text: "설명 저장", attrs: { type: "button" },
        dataset: { testid: "audio-description-save" }, on: { click: actions.save },
      }),
      reset, status, remove,
      el("div", {
        class: "rm-audio-meta",
        text: "빈 설명을 저장하면 기본 설명도 표시하지 않습니다. 복원은 프로젝트 설명을 제거합니다.",
      }),
      player.advanced,
    ] }), player.transport],
  });
  const update = (current: AudioResource): void => {
    const project = store.getCurrent();
    name.textContent = current.name;
    tags.textContent = current.tags.join(" · ");
    identity.textContent = `${current.kind === "music" ? "BGM" : "SE"} · ${current.id}`;
    source.textContent = AUDIO_DESCRIPTION_SOURCE_LABELS[current.descriptionSource];
    source.dataset.source = current.descriptionSource;
    reset.disabled = getAudioDescriptionOverride(project.audioDescriptions, {
      kind: current.kind, resourceId: current.id,
    }) === undefined;
    remove.disabled = project.assets.uploaded[current.id]?.kind !== current.kind;
    remove.title = remove.disabled ? "기본 음원 파일은 삭제할 수 없습니다." : "";
    player.select(current, project);
  };
  update(resource);
  return {
    element, input, status, update,
    dispose: player.dispose,
  };
}

export type AudioDescriptionDetail = ReturnType<typeof createAudioDescriptionDetail>;
