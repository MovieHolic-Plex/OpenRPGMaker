import type { GameMap } from "@/project/types";
import { terrainHeight, type TerrainSightPoint } from "@/project/terrainGameplay";
export interface TerrainVisionWindow { left: number; right: number; top: number; bottom: number; worldY: number; width: number; height: number }
export function terrainVisionWindow(map: GameMap, size: number, camera: { scrollX: number; scrollY: number; width: number; height: number; zoom: number }): TerrainVisionWindow {
  const left = Math.max(0, Math.floor(camera.scrollX / size) - 2), right = Math.min(map.width - 1, Math.ceil((camera.scrollX + camera.width / camera.zoom) / size) + 2);
  return { left, right, top: Math.max(0, Math.floor(camera.scrollY / size) - 2), bottom: Math.min(map.height - 1, Math.ceil((camera.scrollY + camera.height / camera.zoom) / size) + 16), worldY: (Math.floor(camera.scrollY / size) - 16) * size, width: Math.max(1, (right - left + 1) * size), height: Math.max(1, Math.ceil(camera.height / camera.zoom) + 34 * size) };
}
/** Shared editor/player painter. Hidden cells are opaque; foreground ownership clears the projected background. */
export function paintTerrainVision(context: CanvasRenderingContext2D, map: GameMap, size: number, visible: ReadonlySet<number>, view: TerrainVisionWindow, player?: TerrainSightPoint): void {
  context.clearRect(0, 0, view.width, view.height); context.fillStyle = "#070e18";
  for (let y = view.top; y <= view.bottom; y++) for (let x = view.left; x <= view.right; x++) {
    const lift = terrainHeight(map, x, y), px = (x - view.left) * size, py = (y - lift) * size - view.worldY;
    const south = y + 1 < map.height ? terrainHeight(map, x, y + 1) : 0, span = size * Math.max(1, 1 + lift - south);
    context.clearRect(px, py, size, span);
    if (!visible.has(y * map.width + x)) context.fillRect(px, py, size, span);
  }
  if (player) { const feet = (player.y + 1 - terrainHeight(map, player.x, player.y)) * size - view.worldY; context.clearRect((player.x - view.left) * size - 2, feet - size * 2, size + 4, size * 2); }
}
