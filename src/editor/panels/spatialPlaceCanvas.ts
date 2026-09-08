import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import {
  openSpatialDestination,
  pushSpatialBreadcrumb,
  selectSpatialDesign,
  selectSpatialOccurrence,
} from "@/editor/panels/spatialAuthoringSession";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { commitWorkingPlace, workingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import {
  renderPlaceChildPicker,
  renderPlaceExterior,
  renderPlaceFloorStrip,
  renderPlaceLinkActions,
} from "@/editor/panels/spatialPlaceControls";
import { moveChild, placeDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import { childrenOnFloor, libraryPlaceCardId } from "@/editor/panels/spatialPlaceQuery";
import { childSourceLabel, previewPlaceRasters } from "@/editor/panels/spatialPlacePreview";
import type { PlaceDesign, SpatialId } from "@/project/spatial/types";
import { el } from "@/util/dom";

export const PLACE_TILE_PX = 24;

function tileOf(event: PointerEvent, board: HTMLElement): { x: number; y: number } {
  const box = board.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - box.left) / PLACE_TILE_PX),
    y: Math.floor((event.clientY - box.top) / PLACE_TILE_PX),
  };
}

function childToken(place: PlaceDesign, childId: SpatialId, rerender: () => void): HTMLElement {
  const child = place.children.find((entry) => entry.id === childId);
  if (!child) return el("span");
  const selected = placeChromeState.selectedChildId === childId;
  return el("button", {
    class: `spatial-place-child${selected ? " is-selected" : ""}`,
    text: childSourceLabel(workingProject(), child.source.kind, child.source.id),
    attrs: {
      type: "button",
      style: `left:${child.x * PLACE_TILE_PX}px;top:${child.y * PLACE_TILE_PX}px`,
    },
    dataset: { testid: `spatial-place-child-${child.id}`, childId: child.id },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        placeChromeState.selectedChildId = childId;
        rerender();
      },
    },
  });
}

function portLinks(place: PlaceDesign, visible: ReadonlySet<string>, rerender: () => void): HTMLElement {
  const children = new Map(place.children.map((child) => [child.id, child]));
  return el("div", {
    class: "spatial-place-links",
    dataset: { testid: "spatial-place-links" },
    children: place.connections.flatMap((link) => {
      const from = link.from.childId ? children.get(link.from.childId) : undefined;
      const to = link.to.childId ? children.get(link.to.childId) : undefined;
      if (!from || !to || !visible.has(from.id) || !visible.has(to.id)) return [];
      const selected = placeChromeState.selectedConnectionId === link.id;
      const dx = (to.x - from.x) * PLACE_TILE_PX;
      const dy = (to.y - from.y) * PLACE_TILE_PX;
      const length = Math.max(1, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      return [el("button", {
        class: `spatial-place-link${selected ? " is-selected" : ""}`,
        attrs: {
          type: "button",
          "aria-label": "포트 연결",
          style: `left:${from.x * PLACE_TILE_PX + 12}px;top:${from.y * PLACE_TILE_PX + 12}px;width:${length}px;transform:rotate(${angle}rad)`,
        },
        dataset: { testid: `spatial-place-link-${link.id}` },
        on: { click: () => { placeChromeState.selectedConnectionId = link.id; rerender(); } },
      })];
    }),
  });
}

export function renderSpatialPlacesCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  const place = workingPlace(card);
  const target = card ? placeDraftTarget(card) : undefined;
  const visible = place ? childrenOnFloor(place, placeChromeState.selectedFloor) : [];
  const visibleIds = new Set(visible.map((child) => child.id));
  const board = el("div", {
    class: "spatial-places-board",
    attrs: { tabindex: "0", "aria-label": "장소 배치" },
    dataset: { testid: "spatial-places-board" },
  });
  if (place) {
    const preview = previewPlaceRasters({
      project: workingProject(),
      place,
      ...(target?.occurrenceId ? { occurrenceId: target.occurrenceId } : {}),
      floor: placeChromeState.selectedFloor,
      scale: PLACE_TILE_PX / 16,
    });
    board.style.width = `${Math.max(preview.width, 8) * PLACE_TILE_PX}px`;
    board.style.height = `${Math.max(preview.height, 6) * PLACE_TILE_PX}px`;
    for (const stamp of preview.stamps) board.append(stamp.canvas);
    if (preview.error) {
      board.append(el("p", {
        class: "spatial-place-preview-error",
        text: preview.error,
        dataset: { testid: "spatial-place-preview-error" },
      }));
    }
    board.append(portLinks(place, visibleIds, rerender));
    for (const child of visible) board.append(childToken(place, child.id, rerender));
  }
  board.addEventListener("pointerup", (event) => {
    if (!target || !place || !placeChromeState.selectedChildId) return;
    const tile = tileOf(event, board);
    commitWorkingPlace(target, moveChild(place, placeChromeState.selectedChildId, tile.x, tile.y));
    rerender();
  });
  board.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !placeChromeState.selectedChildId || !place) return;
    const child = place.children.find((entry) => entry.id === placeChromeState.selectedChildId);
    if (!child) return;
    event.preventDefault();
    pushSpatialBreadcrumb();
    if (child.source.kind === "space") {
      openSpatialDestination("spaces", librarySpaceCardId(child.source.id));
      rerender();
      return;
    }
    if (session.mode === "instances") selectSpatialOccurrence(child.id);
    else selectSpatialDesign(libraryPlaceCardId(child.source.id));
    rerender();
  });
  return el("div", {
    class: "spatial-canvas spatial-places-canvas",
    dataset: { testid: "spatial-canvas" },
    children: [
      place && target ? renderPlaceFloorStrip(place, rerender) : el("div"),
      place && target ? renderPlaceChildPicker(place, target, rerender) : el("div"),
      board,
      place && target ? renderPlaceLinkActions(place, target, rerender) : el("div"),
      place && target ? renderPlaceExterior(place, target, rerender) : el("div"),
    ],
  });
}
