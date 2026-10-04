import type { GameMap, TilesetDef } from "./types";
import { effectiveHeights, prune, samplePixelHeight } from "./relief/render";
import { gridFromRelief, RELIEF_TILE, type HeightGrid } from "./relief/types";
import { reliefLiftField, type ReliefLiftField } from "./relief/screen";
import { reliefBridgeMask } from "./relief/walk";
import { structureSunlightArt, SUN_ART_RESOLUTION, type SunlightArt, type SunlightArtSource, type SunlightVolume } from "./sunlightArt";

export interface MapSunlight {
  enabled: boolean;
  /** Direction toward the sun, clockwise from north. */
  azimuth?: number;
  altitude?: number;
  opacity?: number;
  softness?: number;
  /** Multiplier on inferred building/tree heights; does not change terrain or collision. */
  heightScale?: number;
}
export interface SunlightParams {
  enabled: boolean; azimuth: number; altitude: number; opacity: number; softness: number; heightScale: number;
}
export const SUNLIGHT_LIMITS = {
  altitude: { min: 12, max: 85 }, opacity: { min: 0, max: .65 },
  softness: { min: 0, max: 4 }, heightScale: { min: .25, max: 2 },
} as const;
export const DEFAULT_SUNLIGHT: Readonly<SunlightParams> = {
  enabled: false, azimuth: 315, altitude: 40, opacity: .32, softness: 1, heightScale: 1,
};
const bounded = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function normalizeSunlight(value: unknown): SunlightParams {
  const v = value && typeof value === "object" ? value as Partial<MapSunlight> : {};
  const az = bounded(v.azimuth, DEFAULT_SUNLIGHT.azimuth, -1e6, 1e6);
  return {
    enabled: v.enabled === true, azimuth: ((az % 360) + 360) % 360,
    altitude: bounded(v.altitude, DEFAULT_SUNLIGHT.altitude, 12, 85),
    opacity: bounded(v.opacity, DEFAULT_SUNLIGHT.opacity, 0, .65),
    softness: bounded(v.softness, DEFAULT_SUNLIGHT.softness, 0, 4),
    heightScale: bounded(v.heightScale, DEFAULT_SUNLIGHT.heightScale, .25, 2),
  };
}
/** Partial edits and off/on retain authored numeric settings. */
export function patchSunlight(current: MapSunlight | undefined, patch: Partial<MapSunlight>): MapSunlight {
  return normalizeSunlight({ ...current, ...patch });
}
export function sunDirectionLabel(azimuth: number): string {
  return ["북", "북동", "동", "남동", "남", "남서", "서", "북서"][Math.round(azimuth / 45) % 8]!;
}

interface Caster {
  id: string; kind: "house" | "tree";
  x: number; y: number; w: number; d: number; base: number; height: number;
  /** Native art stays above the projected ground shadow. */
  art: { x: number; y: number; w: number; h: number };
  silhouette?: SunlightArt;
  volumes?: SunlightVolume[];
}
export interface SunlightRow {
  row: number; x: number; y: number; w: number; h: number; scale: number; rgba: Uint8ClampedArray;
}

/** Ray receiver/caster model. World x/y/z are measured in map tiles, never screen coordinates. */
export class SunlightField {
  readonly params: SunlightParams;
  readonly maxHeight: number;
  readonly maxTerrain: number;
  readonly casters: readonly Caster[];
  private readonly lift: ReliefLiftField | null;
  private readonly terrain: HeightGrid | null;
  private readonly bridges: ReturnType<typeof reliefBridgeMask>;
  private readonly casterCells = new Map<number, Caster[]>();
  private readonly visibleArt = new Map<number, { caster: Caster; lift: number }[]>();
  private readonly pixelChunks = new Map<number, Float32Array>();
  private readonly vectors: readonly { x: number; y: number; slope: number }[];
  private readonly rayLength: number;

  constructor(readonly map: GameMap, tileset?: TilesetDef, artSource?: SunlightArtSource) {
    this.params = normalizeSunlight(map.sunlight);
    this.lift = map.relief ? reliefLiftField(map.relief) : null;
    this.terrain = map.relief ? prune(effectiveHeights(gridFromRelief(map.relief))) : null;
    this.bridges = map.relief ? reliefBridgeMask(map.relief) : null;
    this.maxTerrain = this.lift?.maxLift ?? 0;
    const casters: Caster[] = [];
    const kits = new Map(tileset?.structureKits?.map(k => [k.id, k]));
    for (const p of map.structurePlacements ?? []) {
      const kit = kits.get(p.kitId);
      if (kit?.kind !== "section") continue;
      const isHouse = kit.parts?.some(part => part.kind === "entrance")
        || /house|cottage|manor|집|주택|저택/i.test(`${kit.id} ${kit.name ?? ""}`);
      const isTree = !isHouse && /tree|나무|수목/i.test(`${kit.id} ${kit.name ?? ""}`);
      if (!isHouse && !isTree) continue;
      const silhouette = structureSunlightArt(map, p, kit, artSource);
      if (!silhouette.volumes.length) continue; // erased stamps do not cast ghost shadows
      const volumes = silhouette.volumes;
      const x = Math.min(...volumes.map(v => v.x)), y = Math.min(...volumes.map(v => v.y));
      const w = Math.max(...volumes.map(v => v.x + v.w)) - x, d = Math.max(...volumes.map(v => v.y + v.d)) - y;
      const main = volumes.reduce((a, b) => a.w * a.height > b.w * b.height ? a : b);
      const base = this.terrainAt(main.x + main.w / 2, main.y + main.d - .125);
      casters.push({ id: p.id, kind: isHouse ? "house" : "tree", x, y, w, d, base,
        height: Math.max(...volumes.map(v => v.height)) * this.params.heightScale,
        art: { x: p.x, y: p.y, w: p.w, h: p.h }, silhouette, volumes });
    }
    // Authored tree clusters use their actual occupied cells, preserving gaps in the grove.
    for (const group of map.doodadGroups ?? []) {
      if (!/tree|forest|나무|숲/i.test(`${group.kitId} ${group.label}`)) continue;
      for (const cell of group.cells) {
        if (map.upperTiles[cell.index] !== cell.tile) continue; // later hand edits are authoritative
        const x = cell.index % map.width, y = Math.floor(cell.index / map.width);
        casters.push({ id: `${group.id}:${cell.index}`, kind: "tree", x, y, w: 1, d: 1,
          base: this.terrainAt(x + .5, y + .8), height: 2 * this.params.heightScale,
          art: { x, y, w: 1, h: 1 } });
      }
    }
    this.casters = casters;
    let maximum = this.maxTerrain;
    for (const c of casters) {
      maximum = Math.max(maximum, c.base + c.height);
      for (let y = Math.max(0, Math.floor(c.y)); y < Math.min(map.height, Math.ceil(c.y + c.d)); y++)
        for (let x = Math.max(0, Math.floor(c.x)); x < Math.min(map.width, Math.ceil(c.x + c.w)); x++) {
          const key = y * map.width + x;
          const bucket = this.casterCells.get(key) ?? []; bucket.push(c); this.casterCells.set(key, bucket);
        }
      for (let y = Math.max(0, c.art.y); y < Math.min(map.height, c.art.y + c.art.h); y++)
        for (let x = Math.max(0, c.art.x); x < Math.min(map.width, c.art.x + c.art.w); x++) {
          const elevation = this.lift?.elevation[y * map.width + x] ?? 0;
          for (let sy = Math.floor(y - elevation); sy < Math.ceil(y + 1 - elevation); sy++) {
            const key = sy * map.width + x, bucket = this.visibleArt.get(key) ?? [];
            bucket.push({ caster: c, lift: elevation }); this.visibleArt.set(key, bucket);
          }
        }
    }
    this.maxHeight = maximum;
    const angle = this.params.azimuth * Math.PI / 180, slope = Math.tan(this.params.altitude * Math.PI / 180);
    const spread = this.params.softness * .008;
    this.vectors = (spread ? [-spread, 0, spread] : [0]).map(a => ({ x: Math.sin(angle + a), y: -Math.cos(angle + a), slope }));
    this.rayLength = maximum / slope + 1;
  }

  private squareCell(x: number, y: number): boolean {
    if (!this.bridges) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < this.map.width && yy < this.map.height && this.bridges[yy * this.map.width + xx]) return true;
    }
    return false;
  }

  terrainAt(x: number, y: number): number {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.terrain || cx < 0 || cy < 0 || cx >= this.map.width || cy >= this.map.height) return 0;
    const owner = this.lift?.slopeOwners[cy * this.map.width + cx] ?? -1;
    const s = owner >= 0 ? this.lift!.slopes[owner] : undefined;
    if (s) {
      const length = s.dir === "n" || s.dir === "s" ? s.h : s.w;
      const along = s.dir === "n" ? s.y + s.h - y : s.dir === "s" ? y - s.y : s.dir === "w" ? s.x + s.w - x : x - s.x;
      let t = Math.max(0, Math.min(1, along / length));
      if (s.steps) t = Math.floor(t * s.steps) / s.steps;
      return s.lo + t * (s.hi - s.lo);
    }
    // Bounded cache of exact native marching-square heights; no full-map pixel allocation.
    const bx = Math.floor(cx / 16), by = Math.floor(cy / 16), key = by * Math.ceil(this.map.width / 16) + bx;
    let pixels = this.pixelChunks.get(key);
    if (!pixels) {
      pixels = new Float32Array(64 * 64);
      for (let py = 0; py < 64; py++) for (let px = 0; px < 64; px++) {
        const wx = bx * 16 + (px + .5) / 4, wy = by * 16 + (py + .5) / 4;
        if (wx < this.map.width && wy < this.map.height)
          pixels[py * 64 + px] = samplePixelHeight(this.terrain, Math.floor(wx * RELIEF_TILE), Math.floor(wy * RELIEF_TILE), (xx, yy) => this.squareCell(xx, yy));
      }
      if (this.pixelChunks.size >= 128) this.pixelChunks.delete(this.pixelChunks.keys().next().value!);
      this.pixelChunks.set(key, pixels);
    }
    const px = Math.min(63, Math.floor((x - bx * 16) * 4)), py = Math.min(63, Math.floor((y - by * 16) * 4));
    return pixels[py * 64 + px]!;
  }

  /** Highest roof sample; ray blocking also checks the air under an overhang. */
  casterAt(x: number, y: number): number {
    let height = this.terrainAt(x, y);
    for (const c of this.casterCells.get(Math.floor(y) * this.map.width + Math.floor(x)) ?? [])
      height = Math.max(height, this.volumeTop(c, x, y));
    return height;
  }

  private volumeTop(c: Caster, x: number, y: number, rayZ?: number): number {
    if (c.volumes && c.kind === "house") {
      let top = 0;
      for (const v of c.volumes) {
        if (x < v.x || x >= v.x + v.w || y < v.y || y >= v.y + v.d) continue;
        const column = Math.floor((x - v.x) * SUN_ART_RESOLUTION), high = v.high[column]!;
        if (high <= 0) continue;
        const lowZ = c.base + v.low[column]! * this.params.heightScale, highZ = c.base + high * this.params.heightScale;
        if (rayZ === undefined || rayZ >= lowZ && rayZ + .06 < highZ) top = Math.max(top, highZ);
      }
      return top;
    }
    const u = (x - c.x) / c.w, v = (y - c.y) / c.d;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
    const ridge = Math.sqrt(Math.max(0, 1 - ((u - .5) * 2) ** 2 - ((v - .5) * 2) ** 2));
    return ridge > 0 && (rayZ === undefined || rayZ >= c.base) ? c.base + c.height * ridge : 0;
  }

  private blocksRay(x: number, y: number, z: number): boolean {
    if (this.terrainAt(x, y) > z + .06) return true;
    for (const c of this.casterCells.get(Math.floor(y) * this.map.width + Math.floor(x)) ?? [])
      if (this.volumeTop(c, x, y, z) > z + .06) return true;
    return false;
  }

  private artAt(screenX: number, screenY: number): boolean {
    const list = this.visibleArt.get(Math.floor(screenY) * this.map.width + Math.floor(screenX));
    for (const { caster: c, lift } of list ?? []) {
      const x = screenX - c.art.x, y = screenY + lift - c.art.y;
      if (x < 0 || y < 0 || x >= c.art.w || y >= c.art.h) continue;
      if (!c.silhouette || c.silhouette.mask[Math.floor(y * SUN_ART_RESOLUTION) * c.silhouette.width + Math.floor(x * SUN_ART_RESOLUTION)]) return true;
    }
    return false;
  }

  shadowAt(x: number, y: number, z = this.terrainAt(x, y)): number {
    if (!this.params.enabled || this.params.opacity === 0 || this.maxHeight <= z) return 0;
    let blocked = 0;
    for (const light of this.vectors) {
      const length = Math.min(this.rayLength, (this.maxHeight - z) / light.slope + .5);
      for (let distance = .2; distance <= length; distance += .25) {
        const xx = x + light.x * distance, yy = y + light.y * distance;
        if (xx < 0 || yy < 0 || xx >= this.map.width || yy >= this.map.height) break;
        if (this.blocksRay(xx, yy, z + distance * light.slope)) { blocked++; break; }
      }
    }
    return blocked / this.vectors.length;
  }

  /** A small row/column patch, independent of camera zoom and draw size. */
  row(row: number, startX = 0, endX = this.map.width): SunlightRow {
    const resolution = 4, lift = Math.ceil(this.maxTerrain * resolution), w = (endX - startX) * resolution, h = lift + resolution + 1;
    const rgba = new Uint8ClampedArray(w * h * 4);
    if (!this.params.enabled || this.params.opacity === 0)
      return { row, x: startX * resolution, y: row * resolution - lift, w, h, scale: 1 / resolution, rgba };
    const put = (px: number, py: number, alpha: number) => {
      if (py < 0 || py >= h || alpha <= 0) return;
      const screenX = startX + (px + .5) / resolution, screenY = row + (py + .5 - lift) / resolution;
      if (this.artAt(screenX, screenY)) return;
      const offset = (py * w + px) * 4;
      rgba[offset] = 18; rgba[offset + 1] = 25; rgba[offset + 2] = 39;
      rgba[offset + 3] = Math.max(rgba[offset + 3]!, Math.round(255 * this.params.opacity * alpha));
    };
    for (let px = 0; px < w; px++) for (let py = 0; py < resolution; py++) {
      const x = startX + (px + .5) / resolution, y = row + (py + .5) / resolution;
      const z = this.terrainAt(x, y), next = this.terrainAt(x, y + 1 / resolution);
      const top = Math.round(py + lift - z * resolution), bottom = Math.round(py + 1 + lift - next * resolution);
      const shadow = this.shadowAt(x, y, z);
      if (z - next < .4) {
        for (let sy = top; sy < Math.max(top + 1, bottom); sy++) put(px, sy, shadow);
      } else {
        put(px, top, shadow);
        // Actual south cliff face, with height decreasing down the wall.
        const facing = Math.max(0, -this.vectors[Math.floor(this.vectors.length / 2)]!.y) * .25;
        for (let sy = top + 1; sy < bottom; sy++) {
          const wallZ = (py + 1 + lift - sy) / resolution;
          put(px, sy, Math.max(facing, this.shadowAt(x, y + 1 / resolution + .015, wallZ)));
        }
      }
    }
    return { row, x: startX * resolution, y: row * resolution - lift, w, h, scale: 1 / resolution, rgba };
  }
}

/** Exact scalar inputs are part of the key; immutable map edits refresh the geometry. */
// Bound cached fields even while editor undo history retains old map objects.
const fields = new Map<GameMap, { tileset?: TilesetDef; artSource?: SunlightArtSource; key: string; field: SunlightField }>();
export function sunlightField(map: GameMap, tileset?: TilesetDef, artSource?: SunlightArtSource): SunlightField | null {
  const params = normalizeSunlight(map.sunlight);
  if (!params.enabled || params.opacity === 0) return null;
  const key = JSON.stringify([params, map.relief, map.structurePlacements, map.doodadGroups, map.upperTiles]);
  const old = fields.get(map);
  if (old && old.tileset === tileset && old.artSource === artSource && old.key === key) return old.field.maxHeight > 0 ? old.field : null;
  const field = new SunlightField(map, tileset, artSource);
  if (fields.size >= 2) fields.delete(fields.keys().next().value!);
  fields.set(map, { tileset, artSource, key, field });
  return field.maxHeight > 0 ? field : null;
}
