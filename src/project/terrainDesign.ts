/** Optional map authoring metadata. Water depth is also used by runtime collision. */
export interface TerrainDesignData {
  lockedCells?: number[];
  features?: TerrainFeature[];
  gameplay?: TerrainGameplayRules;
  /** 0 dry, 1 walkable shallows, 2..14 deep water. Surface height lives in relief.levels. */
  waterDepth?: number[];
}
export interface TerrainGameplayRules {
  visionBlocking: boolean;
  highGroundVision: boolean;
  projectileHeight: boolean;
  visionRadius: number;
  visionGain: number;
  eyeHeight: number;
}
export interface TerrainFeatureOptions {
  symmetry: "none" | "mirrorX" | "mirrorY" | "both" | "rotate2" | "rotate4";
  areaShape: "polygon" | "rect" | "line";
  width: number; delta: number; seed: number; weights: readonly [number,number,number];
  waterLevel: number; maxDepth: number; shallowWidth: number; flattenRoad: boolean; unlock: boolean; density: number;
}
export interface TerrainFeature {
  id: string;
  tool: "contour" | "road" | "ridge" | "valley" | "lake";
  points: { x: number; y: number }[];
  options: TerrainFeatureOptions;
  patches: { index: number; before: TerrainStampCell; after: TerrainStampCell }[];
}
export const DEFAULT_TERRAIN_GAMEPLAY: TerrainGameplayRules = { visionBlocking: false, highGroundVision: false, projectileHeight: false, visionRadius: 8, visionGain: 1, eyeHeight: 1 };
export interface TerrainStampCell {
  layers: [number, number, number, number];
  shadow: number;
  level: number;
  ramp: number;
  depth: number;
}
export interface TerrainStamp {
  id: string;
  name: string;
  tilesetId: string;
  width: number;
  height: number;
  cells: TerrainStampCell[];
  style?: string;
  wallDecor?: { x: number; y: number; row: number; tile: number }[];
  groups?: { label: string; kitId: string; cells: { index: number; tile: number; before: number }[] }[];
}

const lockCache = new WeakMap<TerrainDesignData, Set<number>>();
export function terrainLocked(data: TerrainDesignData | undefined, index: number): boolean {
  if (!data?.lockedCells?.length) return false;
  let locks = lockCache.get(data);
  if (!locks) { locks = new Set(data.lockedCells); lockCache.set(data, locks); }
  return locks.has(index);
}
export function cloneTerrainDesign(data: TerrainDesignData | undefined): TerrainDesignData | undefined {
  return data ? structuredClone(data) : undefined;
}
export function normalizeTerrainDesign(value: unknown, count: number): TerrainDesignData | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as TerrainDesignData, out: TerrainDesignData = {};
  if (Array.isArray(data.lockedCells)) {
    const cells = [...new Set(data.lockedCells.filter(i => Number.isInteger(i) && i >= 0 && i < count))].sort((a, b) => a - b);
    if (cells.length) out.lockedCells = cells;
  }
  if (Array.isArray(data.waterDepth) && data.waterDepth.length === count) {
    const depth = data.waterDepth.map(v => Number.isFinite(v) ? Math.min(14, Math.max(0, Math.round(v))) : 0);
    if (depth.some(Boolean)) out.waterDepth = depth;
  }
  if (data.gameplay && typeof data.gameplay === "object") {
    const g = data.gameplay;
    const bounded = (v: number, min: number, max: number, fallback: number) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
    out.gameplay = { visionBlocking: g.visionBlocking === true, highGroundVision: g.highGroundVision === true, projectileHeight: g.projectileHeight === true, visionRadius: bounded(g.visionRadius, 1, 32, 8), visionGain: bounded(g.visionGain, 0, 4, 1), eyeHeight: bounded(g.eyeHeight, .1, 4, 1) };
  }
  if (Array.isArray(data.features)) {
    const ids = new Set<string>();
    out.features = data.features.filter(f => {
      if (!f || typeof f.id !== "string" || ids.has(f.id) || !["contour", "road", "ridge", "valley", "lake"].includes(f.tool) || !Array.isArray(f.points) || f.points.length < 2 || f.points.length > 256 || !f.points.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y)) || !f.options || !Array.isArray(f.patches) || f.patches.length > count) return false;
      const o = f.options;
      if (!["none", "mirrorX", "mirrorY", "both", "rotate2", "rotate4"].includes(o.symmetry) || !["polygon", "rect", "line"].includes(o.areaShape) || ![o.width, o.delta, o.seed, o.waterLevel, o.maxDepth, o.shallowWidth, o.density].every(Number.isFinite) || !Array.isArray(o.weights) || o.weights.length !== 3 || !o.weights.every(Number.isFinite)) return false;
      if (o.width < 1 || o.width > 15 || Math.abs(o.delta) > 14 || o.waterLevel < 0 || o.waterLevel > 14 || o.maxDepth < 1 || o.maxDepth > 14 || o.shallowWidth < 0 || o.shallowWidth > 8 || o.density < 1 || o.density > 100) return false;
      if (!f.patches.every(p => p && Number.isInteger(p.index) && p.index >= 0 && p.index < count && validCell(p.before) && validCell(p.after))) return false;
      ids.add(f.id); return true;
    }).map(f => structuredClone(f));
    if (!out.features.length) delete out.features;
  }
  return Object.keys(out).length ? out : undefined;
}
export function remapTerrainDesign(data: TerrainDesignData | undefined, count: number, source: (i: number) => number): TerrainDesignData | undefined {
  if (!data) return undefined;
  const locks = new Set(data.lockedCells), lockedCells: number[] = [], waterDepth = data.waterDepth ? new Array<number>(count).fill(0) : undefined;
  for (let i = 0; i < count; i++) { const from = source(i); if (from < 0) continue; if (locks.has(from)) lockedCells.push(i); if (waterDepth) waterDepth[i] = data.waterDepth![from] ?? 0; }
  return normalizeTerrainDesign({ lockedCells, waterDepth, gameplay: data.gameplay }, count);
}
export function normalizeTerrainStamps(value: unknown): TerrainStamp[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>(), out: TerrainStamp[] = [];
  for (const stamp of value) {
    if (!stamp || typeof stamp.id !== "string" || !stamp.id || ids.has(stamp.id) || typeof stamp.name !== "string" || typeof stamp.tilesetId !== "string"
      || !Number.isInteger(stamp.width) || !Number.isInteger(stamp.height) || stamp.width < 1 || stamp.height < 1 || stamp.width > 128 || stamp.height > 128
      || !Array.isArray(stamp.cells) || stamp.cells.length !== stamp.width * stamp.height) continue;
    if (stamp.cells.some((c: TerrainStampCell) => !c || !Array.isArray(c.layers) || c.layers.length !== 4 || c.layers.some(t => !Number.isInteger(t) || t < -1)
      || !Number.isInteger(c.level) || c.level < 0 || c.level > 14 || !Number.isInteger(c.ramp) || c.ramp < 0 || c.ramp > 9
      || !Number.isInteger(c.depth) || c.depth < 0 || c.depth > 14 || !Number.isInteger(c.shadow) || c.shadow < 0 || c.shadow > 15)) continue;
    ids.add(stamp.id);
    const groups = Array.isArray(stamp.groups) ? stamp.groups.filter((g: NonNullable<TerrainStamp["groups"]>[number]) => g && typeof g.label === "string" && typeof g.kitId === "string" && Array.isArray(g.cells)
      && g.cells.every(c => c && Number.isInteger(c.index) && c.index >= 0 && c.index < stamp.cells.length && Number.isInteger(c.tile) && c.tile >= 0 && Number.isInteger(c.before) && c.before >= -1)) : undefined;
    const wallDecor = Array.isArray(stamp.wallDecor) ? stamp.wallDecor.filter((d: NonNullable<TerrainStamp["wallDecor"]>[number]) => d && Number.isInteger(d.x) && Number.isInteger(d.y) && d.x >= 0 && d.x < stamp.width && d.y >= 0 && d.y < stamp.height && Number.isInteger(d.row) && d.row > 0 && Number.isInteger(d.tile) && d.tile >= 0) : undefined;
    out.push({ id: stamp.id, name: stamp.name.slice(0, 100), tilesetId: stamp.tilesetId, width: stamp.width, height: stamp.height, cells: stamp.cells.map((c: TerrainStampCell) => ({ ...c, layers: [...c.layers] as TerrainStampCell["layers"] })), ...(typeof stamp.style === "string" ? { style: stamp.style } : {}), ...(groups?.length ? { groups: structuredClone(groups) } : {}), ...(wallDecor?.length ? { wallDecor: structuredClone(wallDecor) } : {}) });
  }
  return out.length ? out : undefined;
}

function validCell(c: TerrainStampCell): boolean {
  return !!c && Array.isArray(c.layers) && c.layers.length === 4 && c.layers.every(t => Number.isInteger(t) && t >= -1) && Number.isInteger(c.level) && c.level >= 0 && c.level <= 14 && Number.isInteger(c.ramp) && c.ramp >= 0 && c.ramp <= 9 && Number.isInteger(c.depth) && c.depth >= 0 && c.depth <= 14 && Number.isInteger(c.shadow) && c.shadow >= 0 && c.shadow <= 15;
}
