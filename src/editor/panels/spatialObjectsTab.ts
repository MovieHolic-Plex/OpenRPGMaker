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
