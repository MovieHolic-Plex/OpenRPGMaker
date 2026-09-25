import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { objectChromeState } from "@/editor/panels/spatialObjectChromeState";
import {
  objectDraftTarget,
  objectInspectorHandlers,
} from "@/editor/panels/spatialObjectCommands";
import { previewObjectDelete } from "@/editor/panels/spatialObjectDraft";
import { renderSpatialObjectInspector } from "@/editor/panels/spatialObjectInspector";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { el } from "@/util/dom";
import { sharedObjectDef } from "@/editor/tools/sharedDesignCatalog";
import { applyToolToStore } from "@/editor/tools/applyChangesetToStore";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";


let lastStamp: { objectId: string; text: string } | null = null;

/** 공용 오브젝트 속성 — 이름·크기·타일셋·통행·태그·「주인」(어디 곁에 두나)과 현재 맵에 찍기. */
function sharedObjectInspector(objectId: string, open: boolean, _rerender: () => void): HTMLElement {
  const def = sharedObjectDef(objectId);
  const facts = (pairs: [string, string][]) => el("dl", { class: "spatial-inspector-facts",
    children: pairs.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })]) });
  // The panel re-renders on every store change, so the last result is kept per object and shown again.
  const note = el("p", { class: "spatial-inspector-sub", text: lastStamp?.objectId === objectId ? lastStamp.text : "", dataset: { testid: "shared-object-stamp-note" } });
  const say = (text: string) => { lastStamp = { objectId, text }; note.textContent = text; };
  const stamp = el("button", { class: "spatial-action", text: "현재 맵 가운데에 찍기", attrs: { type: "button" },
    dataset: { testid: "shared-object-stamp" } });
  stamp.addEventListener("click", () => {
    const mapId = editorState.get().currentMapId;
    const map = mapId ? store.getCurrent().maps[mapId] : undefined;
    if (!def || !map) { say("먼저 맵을 여세요."); return; }
    const args = { objectId, mapId: map.id, x: Math.max(0, Math.floor((map.width - def.width) / 2)), y: Math.max(0, Math.floor((map.height - def.height) / 2)) };
    say("찍는 중…");
    void prepareTool("stamp_object", args).then(() => {
      const result = applyToolToStore("stamp_object", args);
      say(result.ok ? `${result.summary} — 되돌리기로 취소할 수 있다` : `실패: ${result.summary ?? ""}`);
    });
  });
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: def ? [
      el("h3", { class: "spatial-inspector-name", text: def.name }),
      el("p", { class: "spatial-inspector-sub", text: "공용 오브젝트" }),
      el("p", { class: "spatial-inspector-sub", text: `어디 곁에: ${def.owner}`, dataset: { testid: "shared-object-owner" } }),
      facts([["크기", `${def.width}×${def.height}칸`], ["타일셋", def.tilesetId], ["통행", def.passage], ["태그", def.tags.join(", ")], ["조수", `stamp_object({objectId:'${def.id}', mapId, x, y})`]]),
      el("div", { class: "spatial-object-actions", children: [stamp] }),
      note,
    ] : [el("h3", { class: "spatial-inspector-name", text: objectId })],
  });
}

export { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
export {
  objectDraftTarget,
  placeObjectOnCurrentMap,
  spatialObjectsChrome,
} from "@/editor/panels/spatialObjectCommands";

export function renderSpatialObjectsCanvas(
  _session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
): HTMLElement {
  if (!card) {
    return el("div", {
      class: "spatial-canvas spatial-objects-canvas",
      attrs: { tabindex: "0", "aria-label": "오브젝트 캔버스" },
      dataset: { testid: "spatial-canvas" },
      children: [el("div", { class: "spatial-canvas-empty" })],
    });
  }
  const art = renderSpatialCardThumb(card);
  art.classList.add("spatial-canvas-art", "spatial-object-stage-art");
  art.dataset.testid = "spatial-object-stage-art";
  return el("div", {
    class: "spatial-canvas spatial-objects-canvas",
    attrs: { tabindex: "0", "aria-label": "오브젝트 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [art],
  });
}

export function renderSpatialObjectsInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  rerender: () => void,
): HTMLElement {
  if (!card) {
    return el("aside", {
      class: `spatial-inspector${open ? " is-open" : ""}`,
      attrs: { "aria-label": "속성", id: "spatial-inspector" },
      dataset: { testid: "spatial-inspector" },
    });
  }
  if (card.sharedObjectId) return sharedObjectInspector(card.sharedObjectId, open, rerender);
  const target = objectDraftTarget(card);
  if (!target) {
    return el("aside", {
      class: `spatial-inspector${open ? " is-open" : ""}`,
      attrs: { "aria-label": "속성", id: "spatial-inspector" },
      dataset: { testid: "spatial-inspector" },
      children: [el("h3", { class: "spatial-inspector-name", text: card.name })],
    });
  }
  const design = target.libraryId
    ? visibleAuthoringProject().spatialAuthoring?.library.objects[target.libraryId]
    : undefined;
  const deletePreview = objectChromeState.deleteOpen ? previewObjectDelete(visibleAuthoringProject(), target) : null;
  return renderSpatialObjectInspector({
    card,
    open,
    target,
    design,
    deletePreview,
    handlers: objectInspectorHandlers(target, design, rerender),
  });
}
