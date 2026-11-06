import type { GameMap } from "@/project/types";

export interface SelectionRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export interface SelectionTerrain {
  readonly levels: ReadonlyMap<number, number>;
  readonly ramps: number;
  readonly water: number;
  readonly locked: number;
}

export function selectionTerrain(map: GameMap, rect: SelectionRect): SelectionTerrain {
  const levels = new Map<number, number>();
  let ramps = 0, water = 0, locked = 0;
  const lockSet = new Set(map.terrainDesign?.lockedCells ?? []);
  for (let y = Math.max(0, rect.y); y < Math.min(map.height, rect.y + rect.height); y++) {
    for (let x = Math.max(0, rect.x); x < Math.min(map.width, rect.x + rect.width); x++) {
      const i = y * map.width + x, level = map.relief?.levels[i] ?? 0;
      levels.set(level, (levels.get(level) ?? 0) + 1);
      if ((map.relief?.ramps?.[i] ?? 0) > 0) ramps++;
      if ((map.terrainDesign?.waterDepth?.[i] ?? 0) > 0) water++;
      if (lockSet.has(i)) locked++;
    }
  }
  return { levels, ramps, water, locked };
}

export function formatSelectionTerrain(map: GameMap, rect: SelectionRect): string {
  const t = selectionTerrain(map, rect);
  const levels = [...t.levels.entries()].sort((a, b) => a[0] - b[0]).map(([level, count]) => `${level}단 ${count}칸`).join("·");
  return `선택 지형: 높이 ${levels} · 경사로 ${t.ramps}칸 · 물 ${t.water}칸 · 잠금 ${t.locked}칸 — 높이·경사로·물은 바꾸지 말 것`;
}
