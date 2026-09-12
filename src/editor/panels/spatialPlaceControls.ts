import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { commitWorkingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import { nestChild, placeDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import { addPlacedPickerChild } from "@/editor/panels/spatialPlacePlaced";
import { floorsOf, pickerCandidates } from "@/editor/panels/spatialPlaceQuery";
import { childSourceLabel } from "@/editor/panels/spatialPlacePreview";
import { placedPlaceChildren } from "@/editor/spatial/placedPlaceEdits";
import { spatialId } from "@/project/spatial/domain";
import { genId } from "@/util/id";
import type { PlaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

export { renderPlaceLinkActions } from "@/editor/panels/spatialPlaceLinks";

export function renderPlaceFloorStrip(
  place: PlaceDesign,
  target: ReturnType<typeof placeDraftTarget>,
  session: SpatialAuthoringSession,
  rerender: () => void,
): HTMLElement {
  const levels = session.mode === "instances" && target.occurrenceId
    ? [...new Set(placedPlaceChildren(workingProject(), target.occurrenceId).map((child) => child.level))].sort((a, b) => a - b)
    : floorsOf(place);
  return el("div", {
    class: "spatial-place-floors",
    attrs: { role: "tablist", "aria-label": "층" },
    dataset: { testid: "spatial-place-floors" },
    children: [
      el("button", {
        class: `spatial-source-chip${placeChromeState.selectedFloor === null ? " is-active" : ""}`,
        text: "전체",
        attrs: { type: "button", role: "tab", "aria-pressed": String(placeChromeState.selectedFloor === null) },
        dataset: { testid: "spatial-place-floor-all" },
        on: { click: () => { placeChromeState.selectedFloor = null; rerender(); } },
      }),
      ...levels.map((level) => el("button", {
        class: `spatial-source-chip${placeChromeState.selectedFloor === level ? " is-active" : ""}`,
        text: level === 0 ? "지상" : `${level}층`,
        attrs: { type: "button", role: "tab", "aria-pressed": String(placeChromeState.selectedFloor === level) },
        dataset: { testid: `spatial-place-floor-${level}` },
        on: { click: () => { placeChromeState.selectedFloor = level; rerender(); } },
      })),
    ],
  });
}

export function renderPlaceChildPicker(
  place: PlaceDesign,
  target: ReturnType<typeof placeDraftTarget>,
  session: SpatialAuthoringSession,
  rerender: () => void,
): HTMLElement {
  const library = workingProject().spatialAuthoring?.library;
  const candidates = library ? pickerCandidates(library, place) : [];
  return el("div", {
    class: "spatial-place-picker",
    dataset: { testid: "spatial-place-picker" },
    children: candidates.map((slot) => el("button", {
      class: "spatial-place-pick",
      text: `${slot.source.kind === "space" ? "공간" : "장소"} · ${childSourceLabel(workingProject(), slot.source.kind, slot.source.id)}`,
      attrs: { type: "button" },
      dataset: { testid: `spatial-place-pick-${slot.source.id}` },
      on: {
        click: () => {
          if (!library) return;
          if (session.mode === "instances" && target.occurrenceId) {
            addPlacedPickerChild(target.occurrenceId, slot);
          } else {
            commitWorkingPlace(target, nestChild(place, library, {
              ...slot,
              id: spatialId(genId("place-child")),
              x: 4,
              y: 4,
            }));
          }
          rerender();
        },
      },
    })),
  });
}

export { renderPlaceExterior } from "@/editor/panels/spatialPlaceExterior";
