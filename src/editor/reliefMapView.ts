// Shared geometry for browser assistant previews and the headless live runner.
// Uses the exact strip renderer and tile lift field from EditScene / PlayScene.
import { effectiveHeights, renderRelief, type ReliefGroundSurface } from "@/project/relief/render";
import { cellLift, reliefLiftField, reliefPaintsCell, reliefRenderOptions, reliefRowStrips } from "@/project/relief/screen";
import { gridFromRelief, RELIEF_TILE } from "@/project/relief/types";
import { hasRelief } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";

export function reliefMapView(map: GameMap, drawSize: number, ground?: ReliefGroundSurface) {
  if (!hasRelief(map.relief)) return null;
  // Native relief raster buffers are much larger than the final model image.
  // Refuse an oversized image explicitly; never silently send a flat substitute.
  if (map.width * map.height > 65_536) throw new Error("map-relief-rendering-unavailable: request a smaller map region");
  const r = map.relief, render = renderRelief(effectiveHeights(gridFromRelief(r)), reliefRenderOptions(r, ground));
  const scale = drawSize / RELIEF_TILE, field = reliefLiftField(r);
  const under = new Map(reliefRowStrips(render, map.width, "under").map(strip => [strip.row, strip]));
  const over = new Map(reliefRowStrips(render, map.width, "over").map(strip => [strip.row, strip]));
  return { width: map.width * drawSize, height: render.SH * scale, pad: render.pad * scale, scale,
    rows: Array.from({ length: map.height }, (_, y) => ({ y, under: under.get(y), over: over.get(y),
      cells: Array.from({ length: map.width }, (_, x) => ({ x, y: (y - cellLift(field, x, y)) * drawSize + render.pad * scale,
        paintLower: !ground && !reliefPaintsCell(r, x, y) })) })) };
}
