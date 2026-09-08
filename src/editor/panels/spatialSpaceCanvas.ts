import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import {
  layoutIssue,
  mutateWorkingSpace,
  workingProject,
  workingSpace,
} from "@/editor/panels/spatialSpaceCommands";
import {
  addFixedSlot,
  movePort,
  moveSlot,
  slotFixed,
  spaceDraftTarget,
} from "@/editor/panels/spatialSpaceDraft";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { cellsFromMapRect, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { INTERIOR_OBJECT_THUMB_BACKGROUND_TILE } from "@/editor/panels/structureKitDbSources";
import { spatialId } from "@/project/spatial/domain";
import type { SpaceDesign, SpatialId } from "@/project/spatial/types";
import { el } from "@/util/dom";

export const SPACE_TILE_PX = 24;

function tileOf(event: Pick<MouseEvent, "clientX" | "clientY">, board: HTMLElement): { x: number; y: number } {
  const box = board.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - box.left) / SPACE_TILE_PX),
    y: Math.floor((event.clientY - box.top) / SPACE_TILE_PX),
  };
}

function renderBoard(space: SpaceDesign, project = workingProject()): HTMLElement {
  let art: HTMLElement;
  try {
    const layout = spaceLayout(project, space, { mapId: `spatial-canvas:${space.id}`, seed: 7 });
    const cells = cellsFromMapRect(layout.map, {
      x: 0, y: 0, width: layout.map.width, height: layout.map.height,
    });
    const tileset = project.tilesets[space.tilesetId];
    art = tileset
      ? renderTileCellsToCanvas({
        tileset,
        widthTiles: layout.map.width,
        heightTiles: layout.map.height,
        cells,
        scale: Math.max(1, Math.floor(SPACE_TILE_PX / 16)),
        backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
      })
      : el("div", { class: "spatial-space-board-fallback" });
  } catch {
    art = el("div", {
      class: "spatial-space-board-fallback",
      attrs: {
        style: `width:${space.width * SPACE_TILE_PX}px;height:${space.height * SPACE_TILE_PX}px`,
      },
    });
  }
  art.classList.add("spatial-space-board-art");
  return art;
}

function slotNode(space: SpaceDesign, slotId: SpatialId, onSelect: (id: SpatialId) => void): HTMLElement {
  const slot = space.objectSlots.find((entry) => entry.id === slotId);
  const x = slot?.placement.mode === "fixed" ? slot.placement.x : 0;
  const y = slot?.placement.mode === "fixed" ? slot.placement.y : 0;
  const selected = spaceChromeState.selectedSlotId === slotId;
  return el("button", {
    class: `spatial-space-slot${selected ? " is-selected" : ""}${slot?.required ? " is-required" : ""}`,
    text: slot?.quantity === 1 ? "" : String(slot?.quantity ?? ""),
    attrs: {
      type: "button",
      style: `left:${x * SPACE_TILE_PX}px;top:${y * SPACE_TILE_PX}px`,
    },
    dataset: { testid: `spatial-slot-${slotId}`, slotId },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        spaceChromeState.selectedSlotId = slotId;
        spaceChromeState.selectedPortId = null;
        spaceChromeState.gesture = { kind: "slot", id: slotId, originX: x, originY: y };
        onSelect(slotId);
      },
    },
  });
}

function portNode(space: SpaceDesign, portId: SpatialId, onSelect: (id: SpatialId) => void): HTMLElement {
  const port = space.ports.find((entry) => entry.id === portId);
  if (!port) return el("span");
  const selected = spaceChromeState.selectedPortId === portId;
  return el("button", {
    class: `spatial-space-port${selected ? " is-selected" : ""}`,
    text: port.name,
    attrs: {
      type: "button",
      style: `left:${port.x * SPACE_TILE_PX}px;top:${port.y * SPACE_TILE_PX}px`,
    },
    dataset: { testid: `spatial-port-${portId}`, portId },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        spaceChromeState.selectedPortId = portId;
        spaceChromeState.selectedSlotId = null;
        spaceChromeState.gesture = { kind: "port", id: portId, originX: port.x, originY: port.y };
        onSelect(portId);
      },
    },
  });
}

export function renderSpatialSpacesCanvas(
  _session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  const space = workingSpace(card);
  const target = card ? spaceDraftTarget(card) : undefined;
  const issue = layoutIssue(card);
  if (issue) spaceChromeState.previewError = issue;
  const board = el("div", {
    class: "spatial-space-board",
    attrs: {
      tabindex: "0",
      "aria-label": "공간 배치",
      style: space
        ? `width:${Math.max(space.width, 8) * SPACE_TILE_PX}px;height:${Math.max(space.height, 6) * SPACE_TILE_PX}px`
        : "",
    },
    dataset: { testid: "spatial-space-board" },
  });
  if (space) {
    board.append(renderBoard(space));
    for (const slot of space.objectSlots) board.append(slotNode(space, slot.id, () => rerender()));
    for (const port of space.ports) board.append(portNode(space, port.id, () => rerender()));
  }
  board.addEventListener("pointermove", (event) => {
    if (!spaceChromeState.gesture || !target || !space) return;
    const tile = tileOf(event, board);
    const gesture = spaceChromeState.gesture;
    if (gesture.kind === "slot") mutateWorkingSpace(target, (current) => moveSlot(current, gesture.id, tile.x, tile.y));
    else mutateWorkingSpace(target, (current) => movePort(current, gesture.id, tile.x, tile.y));
    rerender();
  });
  board.addEventListener("pointerup", () => { spaceChromeState.gesture = null; });
  board.addEventListener("keydown", (event) => {
    if (!target || !space) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (spaceChromeState.gesture) {
        const gesture = spaceChromeState.gesture;
        if (gesture.kind === "slot") mutateWorkingSpace(target, (current) => moveSlot(current, gesture.id, gesture.originX, gesture.originY));
        else mutateWorkingSpace(target, (current) => movePort(current, gesture.id, gesture.originX, gesture.originY));
        spaceChromeState.gesture = null;
        rerender();
      }
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    const slotId = spaceChromeState.selectedSlotId;
    const portId = spaceChromeState.selectedPortId;
    if (slotId) {
      const slot = space.objectSlots.find((entry) => entry.id === slotId);
      const x = (slot?.placement.mode === "fixed" ? slot.placement.x : 0) + dx;
      const y = (slot?.placement.mode === "fixed" ? slot.placement.y : 0) + dy;
      mutateWorkingSpace(target, (current) => moveSlot(current, slotId, x, y));
      rerender();
    } else if (portId) {
      const port = space.ports.find((entry) => entry.id === portId);
      mutateWorkingSpace(target, (current) => movePort(current, portId, (port?.x ?? 0) + dx, (port?.y ?? 0) + dy));
      rerender();
    }
  });
  const objects = Object.values(workingProject().spatialAuthoring?.library.objects ?? {});
  const gallery = el("div", {
    class: "spatial-space-object-gallery",
    dataset: { testid: "spatial-object-gallery" },
    children: objects.map((object) => el("button", {
      class: "spatial-space-object",
      attrs: { type: "button", draggable: "true" },
      dataset: { testid: `spatial-object-${object.id}`, objectId: object.id },
      children: [renderSpatialCardThumb({
        id: object.id,
        name: object.name,
        source: "own",
        kind: "objects",
        usage: 0,
        tilesetId: object.graphic.tilesetId,
        objectId: object.graphic.kitId,
        localId: object.id,
      })],
      on: {
        dragstart: (event) => {
          const data = event instanceof DragEvent ? event.dataTransfer : null;
          data?.setData("text/spatial-object", object.id);
        },
      },
    })),
  });
  board.addEventListener("dragover", (event) => event.preventDefault());
  board.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!target || !(event instanceof DragEvent)) return;
    const objectId = event.dataTransfer?.getData("text/spatial-object");
    if (!objectId) return;
    const tile = tileOf(event, board);
    const id = `slot-${objectId}-${tile.x}-${tile.y}`;
    mutateWorkingSpace(target, (current) => addFixedSlot(current, slotFixed(id, spatialId(objectId), tile.x, tile.y, true)));
    spaceChromeState.selectedSlotId = spatialId(id);
    rerender();
  });
  const filters: Array<typeof spaceChromeState.environment> = ["all", "interior", "outdoor"];
  const env = el("div", {
    class: "spatial-space-env",
    children: filters.map((id) => el("button", {
      class: `spatial-source-chip${spaceChromeState.environment === id ? " is-active" : ""}`,
      text: id === "all" ? "모두" : id === "interior" ? "실내" : "실외",
      attrs: { type: "button", "aria-pressed": String(spaceChromeState.environment === id) },
      dataset: { testid: `spatial-env-${id}` },
      on: { click: () => { spaceChromeState.environment = id; rerender(); } },
    })),
  });
  return el("div", {
    class: "spatial-canvas spatial-spaces-canvas",
    attrs: { tabindex: "0", "aria-label": "공간 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [
      env,
      gallery,
      el("div", { class: "spatial-canvas-camera", children: [board] }),
    ],
  });
}
