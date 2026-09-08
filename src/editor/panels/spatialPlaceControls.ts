import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { commitWorkingPlace, mutateWorkingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import {
  connectLocal,
  nestChild,
  placeDraftTarget,
  withPlaceExterior,
} from "@/editor/panels/spatialPlaceDraft";
import { floorsOf, newConnectionId, pickerCandidates } from "@/editor/panels/spatialPlaceQuery";
import { childSourceLabel } from "@/editor/panels/spatialPlacePreview";
import { spatialId } from "@/project/spatial/domain";
import { genId } from "@/util/id";
import type { PlaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

export function renderPlaceFloorStrip(place: PlaceDesign, rerender: () => void): HTMLElement {
  const floors = floorsOf(place);
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
      ...floors.map((level) => el("button", {
        class: `spatial-source-chip${placeChromeState.selectedFloor === level ? " is-active" : ""}`,
        text: `${level}층`,
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
  rerender: () => void,
): HTMLElement {
  const library = workingProject().spatialAuthoring?.library;
  const candidates = library ? pickerCandidates(library, place) : [];
  return el("div", {
    class: "spatial-place-picker",
    dataset: { testid: "spatial-place-picker" },
    children: candidates.map((slot) => el("button", {
      class: "spatial-place-pick",
      text: childSourceLabel(workingProject(), slot.source.kind, slot.source.id),
      attrs: { type: "button" },
      dataset: { testid: `spatial-place-pick-${slot.source.id}` },
      on: {
        click: () => {
          if (!library) return;
          commitWorkingPlace(target, nestChild(place, library, {
            ...slot,
            id: spatialId(genId("place-child")),
            x: 4,
            y: 4,
          }));
          rerender();
        },
      },
    })),
  });
}

export function renderPlaceExterior(
  place: PlaceDesign,
  target: ReturnType<typeof placeDraftTarget>,
  rerender: () => void,
): HTMLElement {
  const commit = (tilesetId: string, kitId: string): void => {
    mutateWorkingPlace(target, (current) => withPlaceExterior(
      current,
      tilesetId.trim().length === 0 || kitId.trim().length === 0
        ? undefined
        : { tilesetId: tilesetId.trim(), kitId: kitId.trim() },
    ));
    rerender();
  };
  return el("div", {
    class: "spatial-place-exterior",
    dataset: { testid: "spatial-place-exterior" },
    children: [
      el("label", {
        class: "spatial-place-field",
        children: [
          el("span", { text: "외관 타일셋" }),
          el("input", {
            attrs: { type: "text", value: place.exterior?.tilesetId ?? "" },
            dataset: { testid: "spatial-place-exterior-tileset" },
            on: {
              change: (event) => {
                const input = event.target;
                if (!(input instanceof HTMLInputElement)) return;
                commit(input.value, place.exterior?.kitId ?? "");
              },
            },
          }),
        ],
      }),
      el("label", {
        class: "spatial-place-field",
        children: [
          el("span", { text: "외관 키트" }),
          el("input", {
            attrs: { type: "text", value: place.exterior?.kitId ?? "" },
            dataset: { testid: "spatial-place-exterior-kit" },
            on: {
              change: (event) => {
                const input = event.target;
                if (!(input instanceof HTMLInputElement)) return;
                commit(place.exterior?.tilesetId ?? "", input.value);
              },
            },
          }),
        ],
      }),
    ],
  });
}

export function renderPlaceLinkActions(
  place: PlaceDesign,
  target: ReturnType<typeof placeDraftTarget>,
  rerender: () => void,
): HTMLElement {
  const selected = placeChromeState.selectedChildId;
  const others = place.children.filter((child) => child.id !== selected);
  return el("div", {
    class: "spatial-place-link-actions",
    dataset: { testid: "spatial-place-link-actions" },
    children: others.slice(0, 1).map((other) => el("button", {
      class: "spatial-action",
      text: "층 연결",
      attrs: { type: "button", ...(selected ? {} : { disabled: "" }) },
      dataset: { testid: "spatial-place-connect" },
      on: {
        click: () => {
          if (!selected) return;
          commitWorkingPlace(target, connectLocal(place, {
            id: newConnectionId(),
            from: { childId: selected, portId: spatialId("landing") },
            to: { childId: other.id, portId: spatialId("landing") },
            bidirectional: true,
          }));
          rerender();
        },
      },
    })),
  });
}
