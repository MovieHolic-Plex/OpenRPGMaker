import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { SPACE_TILE_PX, spaceCanvasLayout } from "@/editor/panels/spatialSpaceLayoutView";
import { listPlacedSpaceMembers } from "@/editor/panels/spatialSpaceMembers";
import { workingProject } from "@/editor/panels/spatialSpaceCommands";
import { cellsFromMapRect, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { INTERIOR_OBJECT_THUMB_BACKGROUND_TILE } from "@/editor/panels/structureKitDbSources";
import type { SpaceDesign, SpatialId } from "@/project/spatial/types";
import { el } from "@/util/dom";

export function renderSpaceBoardArt(space: SpaceDesign): HTMLElement {
  let art: HTMLElement;
  try {
    const project = workingProject();
    const layout = spaceCanvasLayout(project, space);
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
        scale: SPACE_TILE_PX / 16,
        backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
      })
      : el("div", { class: "spatial-space-board-fallback" });
    art.style.left = `${-layout.room.x * SPACE_TILE_PX}px`;
    art.style.top = `${-layout.room.y * SPACE_TILE_PX}px`;
  } catch {
    art = el("div", {
      class: "spatial-space-board-fallback",
      attrs: { style: `width:${space.width * SPACE_TILE_PX}px;height:${space.height * SPACE_TILE_PX}px` },
    });
  }
  art.classList.add("spatial-space-board-art");
  return art;
}

function tokenButton(
  className: string,
  testid: string,
  x: number,
  y: number,
  text: string,
  extra: Record<string, string>,
  onDown: (event: Event) => void,
): HTMLElement {
  return el("button", {
    class: className,
    text,
    attrs: { type: "button", style: `left:${x * SPACE_TILE_PX}px;top:${y * SPACE_TILE_PX}px` },
    dataset: { testid, ...extra },
    on: { pointerdown: onDown, click: onDown },
  });
}

export function slotNode(space: SpaceDesign, slotId: SpatialId, onSelect: () => void): HTMLElement {
  const slot = space.objectSlots.find((entry) => entry.id === slotId);
  const x = slot?.placement.mode === "fixed" ? slot.placement.x : 0;
  const y = slot?.placement.mode === "fixed" ? slot.placement.y : 0;
  const selected = spaceChromeState.selectedSlotId === slotId && spaceChromeState.selectedIndex === null;
  return tokenButton(
    `spatial-space-slot${selected ? " is-selected" : ""}${slot?.required ? " is-required" : ""}`,
    `spatial-slot-${slotId}`,
    x, y, slot?.quantity === 1 ? "" : String(slot?.quantity ?? ""),
    { slotId },
    (event) => {
      event.stopPropagation();
      spaceChromeState.selectedSlotId = slotId;
      spaceChromeState.selectedIndex = null;
      spaceChromeState.selectedPortId = null;
      spaceChromeState.gesture = { kind: "slot", id: slotId, originX: x, originY: y };
      onSelect();
    },
  );
}

export function memberNode(view: ReturnType<typeof listPlacedSpaceMembers>[number], onSelect: () => void): HTMLElement {
  const { child, member, slot } = view;
  const selected = spaceChromeState.selectedSlotId === member.slotId && spaceChromeState.selectedIndex === member.index;
  return tokenButton(
    `spatial-space-slot${selected ? " is-selected" : ""}${slot?.required ? " is-required" : ""}`,
    `spatial-member-${member.slotId}-${member.index}`,
    child.x, child.y, "",
    { slotId: member.slotId, index: String(member.index), occurrenceId: child.id },
    (event) => {
      event.stopPropagation();
      spaceChromeState.selectedSlotId = member.slotId;
      spaceChromeState.selectedIndex = member.index;
      spaceChromeState.selectedPortId = null;
      spaceChromeState.gesture = { kind: "member", id: member.slotId, index: member.index, originX: child.x, originY: child.y };
      onSelect();
    },
  );
}

export function portNode(space: SpaceDesign, portId: SpatialId, onSelect: () => void): HTMLElement {
  const port = space.ports.find((entry) => entry.id === portId);
  if (!port) return el("span");
  const selected = spaceChromeState.selectedPortId === portId;
  return tokenButton(
    `spatial-space-port${selected ? " is-selected" : ""}`,
    `spatial-port-${portId}`,
    port.x, port.y, port.name,
    { portId },
    (event) => {
      event.stopPropagation();
      spaceChromeState.selectedPortId = portId;
      spaceChromeState.selectedSlotId = null;
      spaceChromeState.selectedIndex = null;
      spaceChromeState.gesture = { kind: "port", id: portId, originX: port.x, originY: port.y };
      onSelect();
    },
  );
}
