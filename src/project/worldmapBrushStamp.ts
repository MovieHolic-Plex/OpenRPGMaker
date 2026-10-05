import type { GameMap, TilesetDef } from './types';
import { autotileGroupLayer, autotileGroupLayerView, shapeAutotileGroupAround } from './defaults/autotileEngine';
/** Exact stamps own their footprint; adjacent worldmap brushes still lose neighbors. */
export function shapeWorldmapOutsideStamp(
    map: GameMap, tileset: TilesetDef | undefined,
    lower: readonly { x: number; y: number }[], upper: readonly { x: number; y: number }[],
): void {
    for (const group of tileset?.autotileGroups ?? []) {
        if (!group.id.startsWith('worldmap-brush-')) continue;
        const points = autotileGroupLayer(group) === 'upper' ? upper : lower;
        if (!points.length) continue;
        const protectedCells = new Set(points.map(p => `${p.x},${p.y}`));
        shapeAutotileGroupAround(autotileGroupLayerView(map, group), group, points,
            (x, y) => !protectedCells.has(`${x},${y}`));
    }
}

/** Restoring a kit's exact before tiles also restores its outside connections. */
export function shapeWorldmapOutsideRestoredPlacement(
    map: GameMap, tileset: TilesetDef | undefined,
    rect: { x: number; y: number; w: number; h: number },
): void {
    const points = Array.from({ length: rect.w * rect.h }, (_, i) =>
        ({ x: rect.x + i % rect.w, y: rect.y + Math.floor(i / rect.w) }));
    shapeWorldmapOutsideStamp(map, tileset, points, points);
}
