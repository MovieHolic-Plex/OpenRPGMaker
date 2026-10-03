import { cloneExtraLayers, compactMapLayers, layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { emptyRelief } from "@/project/relief/edit";
import { RELIEF_MAX_LEVEL } from "@/project/relief/types";
import { normalizeTerrainDesign, terrainLocked } from "@/project/terrainDesign";
import type { GameMap, TilesetDef } from "@/project/types";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { terrainIsReserved, terrainMaterialTile } from "./terrainMaterials";
import { reliefDoodadCatalog } from "./reliefDoodads";
import { planReliefRamp } from "./reliefRampPlan";
import { lineCells, polygonCells, symmetryVariants, terrainHash, transformPoint, type TerrainPoint, type TerrainSymmetry } from "./terrainDesignGeometry";
import { genId } from "@/util/id";

export interface TerrainDesignOptions {
  symmetry: TerrainSymmetry;
  areaShape: "polygon" | "rect" | "line";
  width: number;
  delta: number;
  seed: number;
  weights: readonly [number, number, number];
  waterLevel: number;
  maxDepth: number;
  shallowWidth: number;
  flattenRoad: boolean;
  unlock: boolean;
  density: number;
}
export interface TerrainDesignPlan { ok: boolean; reason: string; indices: number[]; apply?: (map: GameMap) => void }
export function terrainEditable(map: GameMap, index: number, objects = true, ramps = true): boolean {
  return index >= 0 && index < map.width * map.height && !terrainLocked(map.terrainDesign, index)
    && (!objects || layerTileAt(map, 3, index) < 0 && layerTileAt(map, 4, index) < 0)
    && (!ramps || !(map.relief?.ramps?.[index] ?? 0))
    && !map.events.some(e => e.x === index % map.width && e.y === Math.floor(index / map.width));
}
function copied(map: GameMap): GameMap { return { ...map, lowerTiles: map.lowerTiles.slice(), upperTiles: map.upperTiles.slice(), ...cloneExtraLayers(map) }; }
function clampHeight(v: number): number { return Math.min(RELIEF_MAX_LEVEL, Math.max(0, Math.round(v))); }
function footprint(map: GameMap, points: readonly TerrainPoint[], width: number, distances?: Map<number, number>): TerrainPoint[] {
  const seen = new Map<number, TerrainPoint>(), r = Math.max(0, (width - 1) / 2);
  for (const p of points) for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
    const x = p.x + dx, y = p.y + dy; if (dx * dx + dy * dy <= (r + .4) ** 2 && x >= 0 && y >= 0 && x < map.width && y < map.height) {
      const i = y * map.width + x; seen.set(i, { x, y });
      if (distances) distances.set(i, Math.min(distances.get(i) ?? Infinity, Math.hypot(dx, dy)));
    }
  }
  return [...seen.values()];
}
function shapeMaterials(map: GameMap, tileset: TilesetDef, edits: { index: number; tile: number }[]): void {
  const previous = edits.map(e => layerTileAt(map, 1, e.index)), points = edits.map(e => ({ x: e.index % map.width, y: Math.floor(e.index / map.width) }));
  for (const e of edits) { setLayerTileAt(map, 1, e.index, e.tile); setLayerTileAt(map, 2, e.index, -1); }
  for (const group of autotileGroupsForTileset(tileset)) if ((group.layer ?? "lower") === "lower" && edits.some((e, n) => autotileEditTriggersGroup(group, previous[n]!, e.tile))) shapeAutotileGroupAround(map, group, points);
}
function finish(map: GameMap, next: GameMap, cells: Set<number>, reason: string): TerrainDesignPlan {
  // Autotiles can change a two-cell fringe; annotate it too for incremental rendering.
  const dirty = new Set(cells);
  for (const i of cells) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = i % map.width + dx, y = Math.floor(i / map.width) + dy;
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) dirty.add(y * map.width + x);
  }
  const design = normalizeTerrainDesign(next.terrainDesign, map.width * map.height);
  if (design) next.terrainDesign = design; else delete next.terrainDesign;
  compactMapLayers(next);
  return { ok: cells.size > 0, reason: cells.size ? reason : "잠금·물체·통로를 피해 빈 영역을 고르세요", indices: [...dirty], apply: draft => {
    for (const layer of [1, 2, 3, 4] as const) for (const i of dirty) if (layerTileAt(draft, layer, i) !== layerTileAt(next, layer, i)) setLayerTileAt(draft, layer, i, layerTileAt(next, layer, i));
    if (next.relief) draft.relief = next.relief; else delete draft.relief;
    if (next.terrainDesign) draft.terrainDesign = next.terrainDesign; else delete draft.terrainDesign;
    if (next.doodadGroups) draft.doodadGroups = next.doodadGroups; else delete draft.doodadGroups;
    compactMapLayers(draft);
  } };
}

export function planTerrainDesign(map: GameMap, tileset: TilesetDef, tool: "contour" | "road" | "ridge" | "valley" | "lake" | "mix" | "mixedCluster" | "lock", points: readonly TerrainPoint[], o: TerrainDesignOptions): TerrainDesignPlan {
  const polygon = tool === "contour" && o.areaShape !== "line" || tool === "lake" || tool === "lock";
  if (points.length < (polygon ? 3 : tool === "mix" || tool === "mixedCluster" ? 1 : 2)) return { ok: false, reason: polygon ? "외곽 점을 세 개 이상 찍으세요" : "시작·끝 점을 찍으세요", indices: [] };
  if (o.symmetry === "rotate4" && map.width !== map.height) return { ok: false, reason: "4방향 회전 대칭은 정사각형 맵에서 사용합니다", indices: [] };
  const next = copied(map), touched = new Set<number>();
  const variants = symmetryVariants(o.symmetry, map.width, map.height), all = new Map<number, TerrainPoint>(), centers: TerrainPoint[] = [], distances = new Map<number, number>();
  for (const v of variants) {
    const p = points.map(p => transformPoint(p, map.width, map.height, v));
    const line = lineCells(p); centers.push(...line);
    const area = polygon ? polygonCells(p, map.width, map.height) : footprint(map, line, o.width, tool === "ridge" || tool === "valley" ? distances : undefined);
    for (const c of area) all.set(c.y * map.width + c.x, c);
  }
  if (tool === "lock") {
    const locked = new Set(map.terrainDesign?.lockedCells);
    for (const i of all.keys()) { if (o.unlock) locked.delete(i); else locked.add(i); touched.add(i); }
    next.terrainDesign = { ...next.terrainDesign, lockedCells: [...locked].sort((a, b) => a - b) };
    return finish(map, next, touched, `${touched.size}칸 ${o.unlock ? "잠금 해제" : "보호"}`);
  }
  if (tool === "mixedCluster") return planMixedCluster(map, tileset, points[0]!, o);
  const cells = [...all.keys()].filter(i => terrainEditable(map, i));
  if (tool === "contour" || tool === "ridge" || tool === "valley") {
    next.relief ??= emptyRelief(map.width, map.height);
    const grass = terrainMaterialTile(tileset, "grass");
    for (const i of cells) {
      const distance = distances.get(i) ?? 0;
      const delta = tool === "contour" ? o.delta : (tool === "valley" ? -1 : 1) * Math.max(1, Math.round(Math.abs(o.delta) * (1 - distance / Math.max(1, o.width / 2))));
      const level = clampHeight((map.relief?.levels[i] ?? 0) + delta);
      if (level === (map.relief?.levels[i] ?? 0)) continue;
      next.relief.levels[i] = level;
      if (grass !== undefined && layerTileAt(next, 1, i) < 0) setLayerTileAt(next, 1, i, grass);
      touched.add(i);
    }
    return finish(map, next, touched, `${tool === "contour" ? "절벽 윤곽" : tool === "ridge" ? "능선" : "계곡"} ${touched.size}칸`);
  }
  if (tool === "lake") {
    const tile = terrainMaterialTile(tileset, "water"); if (tile === undefined) return { ok: false, reason: "이 칩셋에는 물 재질이 없습니다", indices: [] };
    const water = new Set(cells), distance = new Map<number, number>(), queue: number[] = [];
    for (const i of cells) {
      const x = i % map.width, y = Math.floor(i / map.width);
      if ([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => x + dx! < 0 || x + dx! >= map.width || y + dy! < 0 || y + dy! >= map.height || !water.has((y + dy!) * map.width + x + dx!))) { queue.push(i); distance.set(i, 0); }
    }
    for (let n = 0; n < queue.length; n++) { const i = queue[n]!; for (const j of [i - map.width, i + map.width, i - 1, i + 1]) if (water.has(j) && !distance.has(j)) { distance.set(j, distance.get(i)! + 1); queue.push(j); } }
    next.relief ??= emptyRelief(map.width, map.height);
    next.terrainDesign ??= {}; next.terrainDesign.waterDepth ??= new Array<number>(map.width * map.height).fill(0);
    for (const i of cells) { next.relief.levels[i] = clampHeight(o.waterLevel); next.terrainDesign.waterDepth[i] = Math.min(o.maxDepth, (distance.get(i) ?? 0) < o.shallowWidth ? 1 : (distance.get(i) ?? 0) - o.shallowWidth + 2); touched.add(i); }
    shapeMaterials(next, tileset, cells.map(index => ({ index, tile })));
    return finish(map, next, touched, `호수 ${cells.length}칸 · 수위 ${o.waterLevel} · 얕은 물 ${o.shallowWidth}칸`);
  }
  const materials = ["grass", "dirt", "stone"] as const, available = materials.map((m, n) => ({ tile: terrainMaterialTile(tileset, m), weight: Math.max(0, o.weights[n]) })).filter(m => m.tile !== undefined && m.weight > 0);
  const dirt = terrainMaterialTile(tileset, "dirt"), edits: { index: number; tile: number }[] = [];
  if (tool === "road" && dirt === undefined || tool === "mix" && !available.length) return { ok: false, reason: "선택한 재질이 이 칩셋에 없습니다", indices: [] };
  const sum = available.reduce((s, m) => s + m.weight, 0);
  for (const i of cells) {
    if (tool === "road" && terrainIsReserved(map, tileset, i)) continue;
    let tile = dirt!;
    if (tool === "mix") { let choice = terrainHash(i % map.width, Math.floor(i / map.width), o.seed) * sum; tile = available.at(-1)!.tile!; for (const m of available) { choice -= m.weight; if (choice < 0) { tile = m.tile!; break; } } }
    edits.push({ index: i, tile }); touched.add(i);
    if (next.terrainDesign?.waterDepth) next.terrainDesign.waterDepth[i] = 0;
    if (tool === "road" && o.flattenRoad) { next.relief ??= emptyRelief(map.width, map.height); next.relief.levels[i] = map.relief?.levels[points[0]!.y * map.width + points[0]!.x] ?? 0; }
  }
  shapeMaterials(next, tileset, edits);
  let ramps = 0;
  if (tool === "road" && !o.flattenRoad && next.relief) for (const p of centers) {
    const here = next.relief.levels[p.y * map.width + p.x] ?? 0;
    if (next.relief.ramps?.[p.y * map.width + p.x] || ![[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => { const x = p.x + dx!, y = p.y + dy!; return x >= 0 && y >= 0 && x < map.width && y < map.height && here !== next.relief!.levels[y * map.width + x]; })) continue;
    const width = o.width >= 5 ? 4 : 2, ramp = planReliefRamp(next, { ...p, face: "top" }, width, false);
    if (ramp.ok && ramp.apply) {
      const probe = copied(next); ramp.apply(probe);
      const changed = probe.relief!.ramps!.flatMap((code, i) => code !== (next.relief?.ramps?.[i] ?? 0) ? [i] : []);
      if (changed.every(i => terrainEditable(map, i))) { ramp.apply(next); for (const i of changed) touched.add(i); ramps++; }
    }
  }
  return finish(map, next, touched, tool === "road" ? `길 ${edits.length}칸 · 경사 접합 ${ramps}곳` : `재질 혼합 ${edits.length}칸 · 시드 ${o.seed}`);
}

export function planMixedCluster(map: GameMap, tileset: TilesetDef, center: TerrainPoint, o: TerrainDesignOptions): TerrainDesignPlan {
  const props = reliefDoodadCatalog(tileset).filter(d => d.kind === "prop"), next = copied(map), occupied = new Set<number>(), cells: { index: number; tile: number; before: number }[] = [];
  const buckets = [props.filter(d => d.tab === "tree"), props.filter(d => d.tab === "rock" && !/bush|덤불|관목/i.test(d.label)), props.filter(d => d.tab === "rock" && /bush|덤불|관목/i.test(d.label))];
  const choices = buckets.flatMap((b, n) => b.length && o.weights[n] > 0 ? [{ props: b, weight: o.weights[n] }] : []), total = choices.reduce((s, b) => s + b.weight, 0);
  if (!total) return { ok: false, reason: "이 칩셋에서 사용할 나무·바위·덤불을 고르세요", indices: [] };
  const radius = Math.max(1, (o.width - 1) / 2), anchors = new Map<number, TerrainPoint>();
  for (const v of symmetryVariants(o.symmetry, map.width, map.height)) {
    const c = transformPoint(center, map.width, map.height, v);
    for (const p of footprint(map, [c], o.width)) {
      const d = Math.hypot(p.x - c.x, p.y - c.y), fade = Math.max(.1, 1 - (d / radius) ** 2);
      if (terrainHash(p.x, p.y, o.seed) <= o.density / 100 * fade) anchors.set(p.y * map.width + p.x, p);
    }
  }
  let objects = 0;
  for (const p of anchors.values()) {
    let pick = terrainHash(p.x, p.y, o.seed + 1) * total, bucket = choices.at(-1)!;
    for (const b of choices) { pick -= b.weight; if (pick < 0) { bucket = b; break; } }
    const prop = bucket.props[Math.floor(terrainHash(p.x, p.y, o.seed + 2) * bucket.props.length)]!;
    if (prop.kind !== "prop") continue;
    const kit = prop.kit, stamp: typeof cells = [], base = map.relief?.levels[p.y * map.width + p.x] ?? 0; let blocked = false;
    for (let y = 0; y < kit.height; y++) for (let x = 0; x < kit.width; x++) {
      const X = p.x - Math.floor((kit.width - 1) / 2) + x, Y = p.y - kit.height + 1 + y, index = Y * map.width + X, tile = kit.rows[y]?.upperTiles?.[x] ?? -1;
      if (X < 0 || Y < 0 || X >= map.width || Y >= map.height || !terrainEditable(map, index) || terrainIsReserved(map, tileset, index) || occupied.has(index) || (map.relief?.levels[index] ?? 0) !== base) blocked = true;
      if (tile >= 0) stamp.push({ index, tile, before: layerTileAt(map, 3, index) });
    }
    if (blocked || !stamp.length) continue;
    objects++; for (const c of stamp) { occupied.add(c.index); cells.push(c); setLayerTileAt(next, 3, c.index, c.tile); }
  }
  if (cells.length) next.doodadGroups = [...(next.doodadGroups ?? []), { id: genId("doodad"), label: "혼합 군집", kitId: "mixed", cells }];
  return finish(map, next, occupied, `혼합 소품 ${objects}개 · 가장자리 밀도 완화`);
}
