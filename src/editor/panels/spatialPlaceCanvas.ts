import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import {
  PLACE_TILE_PX,
  placedChildToken,
  placedLinkLayer,
  placedMemberMarker,
  placeTileOf,
  sourceChildToken,
  sourceLinkLayer,
} from "@/editor/panels/spatialPlaceBoard";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { commitWorkingPlace, workingPlace, workingProject } from "@/editor/panels/spatialPlaceCommands";
import {
  renderPlaceChildPicker,
  renderPlaceExterior,
  renderPlaceFloorStrip,
  renderPlaceLinkActions,
} from "@/editor/panels/spatialPlaceControls";
import { moveChild, placeDraftTarget } from "@/editor/panels/spatialPlaceDraft";
import {
  movePlacedChild,
  openPlaceChild,
  ordinaryPlacedConnections,
  selectedPlacedChild,
} from "@/editor/panels/spatialPlacePlaced";
import { childrenOnFloor } from "@/editor/panels/spatialPlaceQuery";
import { previewPlaceRasters } from "@/editor/panels/spatialPlacePreview";
import { placedPlaceChildren } from "@/editor/spatial/placedPlaceEdits";
import { el } from "@/util/dom";

export { PLACE_TILE_PX };

function typingTarget(event: Event): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function renderSpatialPlacesCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  const place = workingPlace(card);
  const target = card ? placeDraftTarget(card) : undefined;
  const project = workingProject();
  const placed = session.mode === "instances" && target?.occurrenceId
    ? placedPlaceChildren(project, target.occurrenceId)
    : null;
  const visiblePlaced = placed
    ? placed.filter((child) => placeChromeState.selectedFloor === null || child.level === placeChromeState.selectedFloor)
    : [];
  const visibleSource = place ? childrenOnFloor(place, placeChromeState.selectedFloor) : [];
  const board = el("div", {
    class: "spatial-places-board",
    attrs: { tabindex: "0", "aria-label": "장소 배치" },
    dataset: { testid: "spatial-places-board" },
  });
  if (place) {
    const preview = previewPlaceRasters({
      project,
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
    if (placed && target?.occurrenceId) {
      board.append(placedLinkLayer(project, target.occurrenceId, ordinaryPlacedConnections(project, target.occurrenceId), visiblePlaced, rerender));
      for (const child of visiblePlaced) {
        board.append(placedMemberMarker(child));
        board.append(placedChildToken(child, rerender));
      }
    } else {
      board.append(sourceLinkLayer(place, new Set(visibleSource.map((child) => child.id)), rerender));
      for (const child of visibleSource) board.append(sourceChildToken(place, child.id, rerender));
    }
  }
  board.addEventListener("pointermove", (event) => {
    if (!placeChromeState.gesture || !(event instanceof PointerEvent)) return;
    if (Math.hypot(event.clientX - placeChromeState.gesture.originClientX, event.clientY - placeChromeState.gesture.originClientY) < 4) return;
    const tile = placeTileOf(event, board);
    placeChromeState.gesture.liveX = tile.x;
    placeChromeState.gesture.liveY = tile.y;
    rerender();
  });
  board.addEventListener("pointerup", (event) => {
    const gesture = placeChromeState.gesture;
    if (!gesture || !target || !place) return;
    if (!(event instanceof PointerEvent)) {
      placeChromeState.gesture = null;
      return;
    }
    const dragged = Math.hypot(event.clientX - gesture.originClientX, event.clientY - gesture.originClientY) >= 4;
    const tile = placeTileOf(event, board);
    placeChromeState.gesture = null;
    if (!dragged || (tile.x === gesture.originX && tile.y === gesture.originY)) {
      rerender();
      return;
    }
    if (placed && target.occurrenceId) {
      const child = placed.find((entry) => entry.occurrenceId === gesture.childId);
      if (child) movePlacedChild(target.occurrenceId, child, { x: tile.x, y: tile.y, level: child.level });
    } else {
      commitWorkingPlace(target, moveChild(place, gesture.childId, tile.x, tile.y));
    }
    rerender();
  });
  board.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || typingTarget(event) || !place || !target) return;
    if (event.key === "Escape") {
      if (!placeChromeState.gesture) return;
      event.preventDefault();
      event.stopPropagation();
      placeChromeState.gesture = null;
      rerender();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openPlaceChild(target, place, project);
      rerender();
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    placeChromeState.gesture = null;
    if (placed && target.occurrenceId) {
      const child = selectedPlacedChild(project, target.occurrenceId);
      if (!child) return;
      movePlacedChild(target.occurrenceId, child, { x: child.x + dx, y: child.y + dy, level: child.level });
    } else if (placeChromeState.selectedChildId) {
      const child = place.children.find((entry) => entry.id === placeChromeState.selectedChildId);
      if (!child) return;
      commitWorkingPlace(target, moveChild(place, child.id, child.x + dx, child.y + dy));
    }
    rerender();
  });
  return el("div", {
    class: "spatial-canvas spatial-places-canvas",
    dataset: { testid: "spatial-canvas" },
    children: [
      place && target ? renderPlaceFloorStrip(place, target, session, rerender) : el("div"),
      place && target ? renderPlaceChildPicker(place, target, session, rerender) : el("div"),
      board,
      place && target ? renderPlaceLinkActions(place, target, session, rerender) : el("div"),
      place && target ? renderPlaceExterior(place, target, rerender) : el("div"),
    ],
  });
}
