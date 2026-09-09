import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { workingProject } from "@/editor/panels/spatialPlaceCommands";
import { containingPlacedChild } from "@/editor/panels/spatialPlacePlaced";
import { childSourceLabel } from "@/editor/panels/spatialPlacePreview";
import type { PlacedPlaceChild } from "@/editor/spatial/placedPlaceEdits";
import type { PlaceDesign, SpatialConnection, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export const PLACE_TILE_PX = 24;

export function placeTileOf(event: Pick<MouseEvent, "clientX" | "clientY">, board: HTMLElement): { x: number; y: number } {
  const box = board.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - box.left + board.scrollLeft) / PLACE_TILE_PX),
    y: Math.floor((event.clientY - box.top + board.scrollTop) / PLACE_TILE_PX),
  };
}

function livePoint(id: SpatialId, x: number, y: number): { x: number; y: number } {
  const gesture = placeChromeState.gesture;
  if (gesture?.childId === id) return { x: gesture.liveX, y: gesture.liveY };
  return { x, y };
}

export function sourceChildToken(place: PlaceDesign, childId: SpatialId, rerender: () => void): HTMLElement {
  const child = place.children.find((entry) => entry.id === childId);
  if (!child) return el("span");
  const point = livePoint(childId, child.x, child.y);
  return el("button", {
    class: `spatial-place-child${placeChromeState.selectedChildId === childId ? " is-selected" : ""}`,
    text: childSourceLabel(workingProject(), child.source.kind, child.source.id),
    attrs: { type: "button", style: `left:${point.x * PLACE_TILE_PX}px;top:${point.y * PLACE_TILE_PX}px` },
    dataset: { testid: `spatial-place-child-${child.id}`, childId: child.id },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        placeChromeState.selectedChildId = childId;
        placeChromeState.gesture = {
          kind: "move", childId, originX: child.x, originY: child.y, originLevel: child.level,
          originClientX: event instanceof PointerEvent ? event.clientX : 0,
          originClientY: event instanceof PointerEvent ? event.clientY : 0,
          liveX: child.x, liveY: child.y,
        };
      },
      pointerup: (event) => {
        const gesture = placeChromeState.gesture;
        if (gesture && gesture.liveX === gesture.originX && gesture.liveY === gesture.originY) {
          event.stopPropagation();
          window.setTimeout(() => rerender(), 0);
        }
      },
    },
  });
}

export function placedChildToken(child: PlacedPlaceChild, rerender: () => void): HTMLElement {
  const point = livePoint(child.occurrenceId, child.x, child.y);
  return el("button", {
    class: `spatial-place-child${placeChromeState.selectedChildId === child.occurrenceId ? " is-selected" : ""}`,
    text: child.name,
    attrs: { type: "button", style: `left:${point.x * PLACE_TILE_PX}px;top:${point.y * PLACE_TILE_PX}px` },
    dataset: {
      testid: `spatial-place-child-${child.occurrenceId}`,
      childId: child.occurrenceId,
      member: `${child.slotId}-${child.index}`,
    },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        placeChromeState.selectedChildId = child.occurrenceId;
        placeChromeState.gesture = {
          kind: "move", childId: child.occurrenceId, originX: child.x, originY: child.y, originLevel: child.level,
          originClientX: event instanceof PointerEvent ? event.clientX : 0,
          originClientY: event instanceof PointerEvent ? event.clientY : 0,
          liveX: child.x, liveY: child.y,
        };
      },
      pointerup: (event) => {
        const gesture = placeChromeState.gesture;
        if (gesture && gesture.liveX === gesture.originX && gesture.liveY === gesture.originY) {
          event.stopPropagation();
          window.setTimeout(() => rerender(), 0);
        }
      },
    },
  });
}

export function placedMemberMarker(child: PlacedPlaceChild): HTMLElement {
  return el("span", { dataset: { testid: `spatial-member-${child.slotId}-${child.index}` } });
}

function linkButton(
  id: SpatialId,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  rerender: () => void,
): HTMLElement {
  const selected = placeChromeState.selectedConnectionId === id;
  const dx = (to.x - from.x) * PLACE_TILE_PX;
  const dy = (to.y - from.y) * PLACE_TILE_PX;
  return el("button", {
    class: `spatial-place-link${selected ? " is-selected" : ""}`,
    attrs: {
      type: "button",
      "aria-label": "포트 연결",
      style: `left:${from.x * PLACE_TILE_PX + 12}px;top:${from.y * PLACE_TILE_PX + 12}px;width:${Math.max(1, Math.hypot(dx, dy))}px;transform:rotate(${Math.atan2(dy, dx)}rad)`,
    },
    dataset: { testid: `spatial-place-link-${id}` },
    on: { click: () => { placeChromeState.selectedConnectionId = id; rerender(); } },
  });
}

export function sourceLinkLayer(place: PlaceDesign, visible: ReadonlySet<string>, rerender: () => void): HTMLElement {
  const children = new Map(place.children.map((child) => [child.id, child]));
  return el("div", {
    class: "spatial-place-links",
    dataset: { testid: "spatial-place-links" },
    children: place.connections.flatMap((link) => {
      const from = link.from.childId ? children.get(link.from.childId) : undefined;
      const to = link.to.childId ? children.get(link.to.childId) : undefined;
      if (!from || !to || !visible.has(from.id) || !visible.has(to.id)) return [];
      return [linkButton(link.id, from, to, rerender)];
    }),
  });
}

export function placedLinkLayer(
  project: Project,
  parentId: SpatialId,
  links: readonly SpatialConnection[],
  visible: readonly PlacedPlaceChild[],
  rerender: () => void,
): HTMLElement {
  const visibleIds = new Set(visible.map((child) => child.occurrenceId));
  return el("div", {
    class: "spatial-place-links",
    dataset: { testid: "spatial-place-links" },
    children: links.flatMap((link) => {
      const from = containingPlacedChild(project, parentId, link.from.occurrenceId);
      const to = containingPlacedChild(project, parentId, link.to.occurrenceId);
      if (!from || !to || !visibleIds.has(from.occurrenceId) || !visibleIds.has(to.occurrenceId)) return [];
      return [linkButton(link.id, from, to, rerender)];
    }),
  });
}

