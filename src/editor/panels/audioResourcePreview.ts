import type { AudioResource } from "@/assets/audioResourceCatalog";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { audioResourceDocument } from "./audioResourcePresentation";
import { createAudioPreviewPlayer } from "./audioPreviewPlayer";

/** Selected/inline details only. Thumbnails must never instantiate this view. */
export function createAudioResourcePreview(prefix = "db-resource-picker-audio") {
  const player = createAudioPreviewPlayer(prefix);
  const document = el("div", { class: "audio-preview-scroll" });
  const element = el("section", { class: "audio-resource-preview", children: [document, player.transport] });
  return {
    element,
    update(resource: AudioResource | undefined): void {
      const project = store.getCurrent();
      document.replaceChildren(...(resource ? [audioResourceDocument(resource, project)] : [el("p", { text: "음원을 선택하세요." })]), player.advanced);
      player.select(resource, project);
    },
    dispose: player.dispose,
  };
}

/** Inline fields have no close callback; observe real DOM ownership, not a timer. */
export function releaseAudioPreviewOnRemoval(view: ReturnType<typeof createAudioResourcePreview>): void {
  let mounted = view.element.isConnected;
  const unsubscribe = store.subscribe((_project, change) => { if (change.projectSwitch) dispose(); });
  const observer = new MutationObserver(records => {
    mounted ||= view.element.isConnected || records.some(record => [...record.addedNodes].some(node => node === view.element || node.contains(view.element)));
    if (mounted && !view.element.isConnected) dispose();
  });
  function dispose(): void { observer.disconnect(); unsubscribe(); view.dispose(); }
  observer.observe(document.body, { childList: true, subtree: true });
}
