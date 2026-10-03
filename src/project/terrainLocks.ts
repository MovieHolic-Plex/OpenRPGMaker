import type { GameMap } from "./types";
import { layerTileAt, setLayerTileAt, shadowAt, setShadowAt, TILE_LAYER_NOS } from "./mapLayers";
import { emptyRelief } from "./relief/edit";

/** All tile editing uses this choke point; undo/general map replacement is not filtered. */
export function restoreLockedTerrainCells(before: GameMap, draft: GameMap): void {
  const locks = before.terrainDesign?.lockedCells;
  if (!locks?.length) return;
  for (const index of locks) {
    for (const layer of TILE_LAYER_NOS) if (layerTileAt(before, layer, index) !== layerTileAt(draft, layer, index)) setLayerTileAt(draft, layer, index, layerTileAt(before, layer, index));
    if (shadowAt(before, index) !== shadowAt(draft, index)) setShadowAt(draft, index, shadowAt(before, index));
    const level = before.relief?.levels[index] ?? 0, ramp = before.relief?.ramps?.[index] ?? 0;
    if ((draft.relief?.levels[index] ?? 0) !== level || (draft.relief?.ramps?.[index] ?? 0) !== ramp) {
      draft.relief ??= emptyRelief(draft.width, draft.height);
      draft.relief.levels[index] = level;
      if (ramp || draft.relief.ramps) { draft.relief.ramps ??= new Array<number>(draft.width * draft.height).fill(0); draft.relief.ramps[index] = ramp; }
    }
    const depth = before.terrainDesign?.waterDepth?.[index] ?? 0;
    if ((draft.terrainDesign?.waterDepth?.[index] ?? 0) !== depth) {
      draft.terrainDesign ??= {};
      draft.terrainDesign.waterDepth ??= new Array<number>(draft.width * draft.height).fill(0);
      draft.terrainDesign.waterDepth[index] = depth;
    }
  }
  if (before.relief?.wallDecor || draft.relief?.wallDecor) {
    const held = new Set(locks), decor = [...(draft.relief?.wallDecor ?? []).filter(d => !held.has(d.y * draft.width + d.x)), ...(before.relief?.wallDecor ?? []).filter(d => held.has(d.y * before.width + d.x))];
    if (decor.length) { draft.relief ??= emptyRelief(draft.width, draft.height); draft.relief.wallDecor = decor.map(d => ({ ...d })); }
    else if (draft.relief) delete draft.relief.wallDecor;
  }
}
