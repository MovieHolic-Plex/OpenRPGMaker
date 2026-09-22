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
import { placeCatalogRasters, previewPlaceRasters } from "@/editor/panels/spatialPlacePreview";
import { humanizeSpatialError } from "@/editor/panels/spatialFeedback";
import { placedPlaceChildren } from "@/editor/spatial/placedPlaceEdits";
import { el } from "@/util/dom";

export { PLACE_TILE_PX };

function typingTarget(event: Event): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function floorIn(levels: readonly number[]): number | null {
  const selected = placeChromeState.selectedFloor;
  if (selected === null || !levels.includes(selected)) return null;
  return selected;
}

function revealBoard(board: HTMLElement, camera: SpatialAuthoringSession["camera"]): void {
  board.scrollLeft = Math.max(0, -camera.x);
  board.scrollTop = Math.max(0, -camera.y);
  const selected = board.querySelector<HTMLElement>(".spatial-place-child.is-selected");
  const fallback = board.querySelectorAll<HTMLElement>(".spatial-place-child");
  const focused = selected ?? fallback[fallback.length - 1];
  // Scrolling is a browser affordance; headless render walks provide no scrollIntoView.
  if (typeof focused?.scrollIntoView === "function") focused.scrollIntoView({ block: "nearest", inline: "nearest" });
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
  const levels = placed
    ? [...new Set(placed.map((child) => child.level))]
    : place ? [...new Set(place.children.map((child) => child.level))] : [];
  placeChromeState.selectedFloor = floorIn(levels);
  const floor = placeChromeState.selectedFloor;
  const visiblePlaced = placed
    ? placed.filter((child) => floor === null || child.level === floor)
    : [];
  const visibleSource = place ? childrenOnFloor(place, floor) : [];
  const board = el("div", {
    class: "spatial-places-board",
    attrs: { tabindex: "0", "aria-label": "장소 배치" },
    dataset: { testid: "spatial-places-board" },
  });
  const world = el("div", {
    class: "spatial-places-world",
    dataset: { testid: "spatial-places-world" },
  });
  if (place) {
    const preview = previewPlaceRasters({
      project,
      place,
      ...(target?.occurrenceId ? { occurrenceId: target.occurrenceId } : {}),
      floor,
      scale: PLACE_TILE_PX / 16,
    });
    const kids = placed ? visiblePlaced : visibleSource;
    world.style.width = `${Math.max(preview.width, 8, ...kids.map((child) => child.x + 3)) * PLACE_TILE_PX}px`;
    world.style.height = `${Math.max(preview.height, 6, ...kids.map((child) => child.y + 3)) * PLACE_TILE_PX}px`;
    for (const stamp of preview.stamps) world.append(stamp.canvas);
    if (preview.error) {
      world.append(el("p", {
        class: "spatial-place-preview-error",
        text: humanizeSpatialError(preview.error) ?? preview.error,
        dataset: { testid: "spatial-place-preview-error" },
      }));
    }
    if (placed && target?.occurrenceId) {
      world.append(placedLinkLayer(project, target.occurrenceId, ordinaryPlacedConnections(project, target.occurrenceId), visiblePlaced, rerender));
      for (const child of visiblePlaced) {
        world.append(placedMemberMarker(child));
        world.append(placedChildToken(child, rerender));
      }
    } else {
      world.append(sourceLinkLayer(place, new Set(visibleSource.map((child) => child.id)), rerender));
      for (const child of visibleSource) world.append(sourceChildToken(place, child.id, rerender));
    }
  } else if (card && session.mode !== "instances") {
    // 꾸러미 시설 등 설계 레코드가 없는 카드 — 카탈로그 래스터로 무엇인지 보여 준다(읽기 전용).
    const preview = placeCatalogRasters(project, card, PLACE_TILE_PX / 16, rerender);
    world.style.width = `${Math.max(preview.width, 8) * PLACE_TILE_PX}px`;
    world.style.height = `${Math.max(preview.height, 6) * PLACE_TILE_PX}px`;
    for (const stamp of preview.stamps) world.append(stamp.canvas);
    if (preview.error) {
      world.append(el("p", {
        class: "spatial-place-preview-error",
        text: humanizeSpatialError(preview.error) ?? preview.error,
        dataset: { testid: "spatial-place-preview-error" },
      }));
    }
    if (preview.stamps.length > 0) {
      world.append(el("p", {
        class: "spatial-readonly-note",
        text: "기본 설계 미리보기 — 읽기 전용입니다.",
        dataset: { testid: "spatial-readonly-note" },
      }));
    }
  } else if (!card) {
    world.append(el("p", {
      class: "spatial-empty-copy",
      text: "선택된 장소가 없습니다 — 왼쪽 목록에서 고르세요.",
      dataset: { testid: "spatial-empty-copy" },
    }));
  }
  board.append(world);
  const viewport = el("div", {
    class: "spatial-places-viewport",
    dataset: { testid: "spatial-places-viewport" },
    children: [board],
  });
  queueMicrotask(() => revealBoard(board, session.camera));
  board.addEventListener("pointermove", (event) => {
    const gesture = placeChromeState.gesture;
    if (!gesture || !(event instanceof PointerEvent)) return;
    if (Math.hypot(event.clientX - gesture.originClientX, event.clientY - gesture.originClientY) < 4) return;
    const tile = placeTileOf(event, board);
    gesture.liveX = tile.x;
    gesture.liveY = tile.y;
    const token = board.querySelector<HTMLElement>(`[data-child-id="${gesture.childId}"]`);
    if (token) {
      token.style.left = `${tile.x * PLACE_TILE_PX}px`;
      token.style.top = `${tile.y * PLACE_TILE_PX}px`;
    }
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
      viewport,
      place && target ? renderPlaceLinkActions(place, target, session, rerender) : el("div"),
      place && target ? renderPlaceExterior(place, target, rerender) : el("div"),
    ],
  });
}
