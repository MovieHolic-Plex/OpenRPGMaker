import type { GameMap } from "@/project/types";
import { terrainHeight, type TerrainSightPoint } from "@/project/terrainGameplay";
export interface TerrainVisionWindow { left: number; right: number; top: number; bottom: number; worldY: number; width: number; height: number }
export function terrainVisionWindow(map: GameMap, size: number, camera: { scrollX: number; scrollY: number; width: number; height: number; zoom: number }): TerrainVisionWindow {
  const left = Math.floor(camera.scrollX / size) - 4, columns = Math.ceil(camera.width / camera.zoom / size) + 9, right = left + columns - 1;
  return { left, right, top: Math.max(0, Math.floor(camera.scrollY / size) - 4), bottom: Math.min(map.height - 1, Math.ceil((camera.scrollY + camera.height / camera.zoom) / size) + 16), worldY: (Math.floor(camera.scrollY / size) - 16) * size, width: columns * size, height: Math.max(1, Math.ceil(camera.height / camera.zoom) + 34 * size) };
}
const scratch = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();
/** Project the true visibility silhouette, then feather it into a rounded penumbra. */
export function paintTerrainVision(context: CanvasRenderingContext2D, map: GameMap, size: number, visible: ReadonlySet<number>, view: TerrainVisionWindow, player?: TerrainSightPoint): void {
  let raw = scratch.get(context);
  if (!raw) { raw = document.createElement("canvas"); scratch.set(context, raw); }
  if (raw.width !== view.width || raw.height !== view.height) { raw.width = view.width; raw.height = view.height; }
  const mask = raw.getContext("2d")!;
  mask.clearRect(0, 0, view.width, view.height); mask.fillStyle = "#070e18";
  for (let y = view.top; y <= view.bottom; y++) for (let x = Math.max(0, view.left); x <= Math.min(map.width - 1, view.right); x++) {
    const lift = terrainHeight(map, x, y), px = (x - view.left) * size, py = (y - lift) * size - view.worldY;
    const south = y + 1 < map.height ? terrainHeight(map, x, y + 1) : 0, span = size * Math.max(1, 1 + lift - south);
    mask.clearRect(px, py, size, span);
    if (!visible.has(y * map.width + x)) mask.fillRect(px, py, size, span);
  }
  context.clearRect(0, 0, view.width, view.height);
  context.save(); context.filter = `blur(${Math.max(2, size * .8)}px)`; context.drawImage(raw, 0, 0); context.restore();
  if (player) {
    const cx = (player.x + .5 - view.left) * size, cy = (player.y + .1 - terrainHeight(map, player.x, player.y)) * size - view.worldY, radius = size * 1.4;
    const clear = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    clear.addColorStop(0, "rgba(0,0,0,1)"); clear.addColorStop(.6, "rgba(0,0,0,1)"); clear.addColorStop(1, "rgba(0,0,0,0)");
    context.save(); context.globalCompositeOperation = "destination-out"; context.fillStyle = clear;
    context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2); context.restore();
  }
}
