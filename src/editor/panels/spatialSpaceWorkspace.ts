import { listSpatialGalleryCards, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { selectSpatialDesign, patchSpatialSession, type SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { renderSpatialChrome } from "@/editor/panels/spatialStage";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";
import { el } from "@/util/dom";

export function renderSpatialSpaceWorkspace(session: SpatialAuthoringSession, selected: SpatialGalleryCard | undefined, rerender: () => void): HTMLElement {
  const cards = listSpatialGalleryCards({ ...session, source: "all" });
  const choices = el("div", { class: "space-workspace-choices", children: cards.map(card => el("button", {
    class: `space-workspace-choice${selected?.id === card.id ? " is-selected" : ""}`,
    attrs: { type: "button", "aria-pressed": String(selected?.id === card.id) }, dataset: { cardId: card.id, testid: `spatial-card-${card.id}`, source: card.source },
    children: [renderSpatialCardThumb(card), el("span", { text: card.name })],
    on: { click: () => { selectSpatialDesign(card.id); patchSpatialSession({ source: "all", inspectorOpen: true }); rerender(); } },
  })) });
  return el("div", { class: "spatial-shell spatial-space-workspace", attrs: { tabindex: "0" }, dataset: { testid: "spatial-shell-spaces" }, children: [
    el("header", { class: "asset-browser-top", children: [
      el("div", { class: "asset-browser-heading", children: [el("h2", { text: "공간 편집" }), el("p", { text: "오브젝트를 배치해 방과 공간을 구성하세요." })] }),
      el("details", { class: "space-workspace-picker", children: [el("summary", { text: `${selected?.name ?? "공간 선택"} · 다른 공간 열기` }), choices] }),
      renderSpatialChrome(session, rerender, { browser: true }),
    ] }),
    el("div", { class: "space-workspace-body", children: [
      renderSpatialSpacesCanvas(session, selected, rerender, { objectBrowser: true }),
      el("section", { class: "asset-browser-detail", attrs: { "aria-label": "공간과 배치 속성" }, children: [renderSpatialSpacesInspector(selected, true, rerender)] }),
    ] }),
  ] });
}
