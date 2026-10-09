/** Reusable canvases interpolate fog alpha without brightening areas hidden in both frames. */
export interface TerrainVisionBlend {
  canvas: HTMLCanvasElement;
  from: HTMLCanvasElement;
  target: HTMLCanvasElement;
  started: number;
  running: boolean;
}
export const TERRAIN_VISION_FADE_MS = 240;
export function createTerrainVisionBlend(width: number, height: number): TerrainVisionBlend {
  const make = () => { const c = document.createElement("canvas"); c.width = width; c.height = height; return c; };
  return { canvas: make(), from: make(), target: make(), started: 0, running: false };
}
export function setTerrainVisionTarget(blend: TerrainVisionBlend, now: number, paint: (context: CanvasRenderingContext2D) => void, shiftX = 0, shiftY = 0): void {
  const from = blend.from.getContext("2d")!, target = blend.target.getContext("2d")!;
  from.clearRect(0, 0, blend.from.width, blend.from.height); from.drawImage(blend.canvas, shiftX, shiftY);
  target.clearRect(0, 0, blend.target.width, blend.target.height); paint(target);
  blend.started = now; blend.running = true;
}
export function advanceTerrainVisionBlend(blend: TerrainVisionBlend, now: number): boolean {
  if (!blend.running) return false;
  const fraction = Math.max(0, Math.min(1, (now - blend.started) / TERRAIN_VISION_FADE_MS)), t = fraction * fraction * (3 - 2 * fraction);
  const context = blend.canvas.getContext("2d")!;
  context.clearRect(0, 0, blend.canvas.width, blend.canvas.height);
  context.save(); context.globalAlpha = 1 - t; context.drawImage(blend.from, 0, 0);
  context.globalCompositeOperation = "lighter"; context.globalAlpha = t; context.drawImage(blend.target, 0, 0); context.restore();
  blend.running = fraction < 1; return true;
}
