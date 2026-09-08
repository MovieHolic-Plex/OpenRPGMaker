import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import { store } from "@/project/store";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { audioDescriptionView, audioPlaybackBadge } from "@/editor/panels/audioResourcePresentation";
import { renderEditorIcon as editorIcon } from "./editorIcons";

// 오디오 명령(재생/정지) 프리뷰. 자동 재생은 하지 않는다(누수·의도치 않은 소리 방지) —
// 선택한 음원 정보와 명령의 동작만 요약한다. 신호를 측정한 것처럼 그리지 않는다.
export function previewAudio(cmd: Extract<Command, { kind: "playAudio" | "stopAudio" }>): HTMLElement {
  const root = el("div", { class: "ecp-audio", dataset: { testid: "ecp-audio-preview" } });
  if (cmd.kind === "stopAudio") {
    root.append(el("div", { class: "ecp-audio-icon stop", children: [editorIcon("stop")] }));
    root.append(el("div", { class: "ecp-audio-name", text: "재생 중인 소리를 정지합니다" }));
    return root;
  }
  const project = store.getCurrent();
  const resource = listAudioResources("music", project).find(entry => entry.id === cmd.resourceId)
    ?? listAudioResources("sound", project).find(entry => entry.id === cmd.resourceId);
  root.append(el("div", { class: "ecp-audio-icon play", children: [editorIcon("sound")] }));
  root.append(el("div", { class: "ecp-audio-name", text: resource?.name ?? (cmd.resourceId || "(소리 선택 없음)") }));
  root.append(audioDescriptionView(resource));
  root.append(audioPlaybackBadge(cmd.resourceId, project));
  root.append(el("div", { class: "audio-preview-meta", text: "명령 요약 · 자동 재생하지 않음" }));
  root.append(
    el("div", {
      class: "ecp-audio-badges",
      children: [el("span", { class: `ecp-audio-badge ${cmd.loop ? "on" : "off"}`, text: cmd.loop ? "반복 재생" : "1회 재생" })],
    })
  );
  return root;
}
