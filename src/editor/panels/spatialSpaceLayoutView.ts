import { spaceLayout } from "@/editor/spatial/spaceLayout";
import type { SpaceDesign } from "@/project/spatial/types";
import type { Project } from "@/project/types";

export const SPACE_TILE_PX = 24;
export const SPACE_TILE_SCALE = SPACE_TILE_PX / 16;

export function spaceCanvasLayout(project: Project, space: SpaceDesign) {
  return spaceLayout(project, space, { mapId: `spatial-canvas:${space.id}`, seed: 7 });
}

export function tileOf(event: Pick<MouseEvent, "clientX" | "clientY">, board: HTMLElement): { x: number; y: number } {
  const box = board.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - box.left) / SPACE_TILE_PX),
    y: Math.floor((event.clientY - box.top) / SPACE_TILE_PX),
  };
}

export function liveSpaceBoard(root?: ParentNode | null): HTMLElement | null {
  const board = (root ?? document).querySelector("[data-testid='spatial-space-board']");
  return board instanceof HTMLElement && document.contains(board) ? board : null;
}
