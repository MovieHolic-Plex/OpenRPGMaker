import type { GameMap, SectionStructureKitDef, StructurePlacement } from "./types";

/** Native art is sampled only for occupied tiles, never as a full-map bitmap. */
export const SUN_ART_RESOLUTION = 4;
export interface SunlightArtSource { tileMask(tile: number): Uint8Array | null }
export interface SunlightVolume {
  x: number; y: number; w: number; d: number; height: number;
  /** Per-column vertical bands: roof overhangs have air underneath. */
  low: Float32Array; high: Float32Array;
}
export interface SunlightArt {
  width: number; height: number; mask: Uint8Array; volumes: SunlightVolume[];
}

/** Recover a 2.5D silhouette from the still-present upper art. Detached props get
 * their own ground line; a statue in a stamp must not raise the entire house. */
export function structureSunlightArt(map: GameMap, p: StructurePlacement, kit: SectionStructureKitDef,
  source?: SunlightArtSource): SunlightArt {
  const r = SUN_ART_RESOLUTION, width = p.w * r, height = p.h * r;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const tile = kit.rows[y]?.upperTiles?.[x] ?? -1;
    if (tile < 0 || map.upperTiles[(p.y + y) * map.width + p.x + x] !== tile) continue;
    const alpha = source?.tileMask(tile);
    for (let py = 0; py < r; py++) for (let px = 0; px < r; px++)
      mask[(y * r + py) * width + x * r + px] = alpha ? alpha[py * r + px]! : 1;
  }
  // A thin tip can touch the house's bottom pixels (the manor's statues do).
  // Separate a narrow trailing prop at the broad body's ground line as well.
  const rowCounts = new Uint32Array(height), seams = new Set<number>();
  for (let i = 0; i < mask.length; i++) if (mask[i]) rowCounts[Math.floor(i / width)]!++;
  const widest = Math.max(...rowCounts);
  for (let y = Math.ceil(height / 2); y < height - 1; y++)
    if (rowCounts[y - 1]! >= widest * .5 && rowCounts[y]! < widest * .2 && rowCounts[y + 1]! < widest * .2)
      seams.add(y);
  const seen = new Uint8Array(mask.length), volumes: SunlightVolume[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed] || seen[seed]) continue;
    const cells = [seed]; seen[seed] = 1;
    let left = width, right = 0, top = height, bottom = 0;
    for (let i = 0; i < cells.length; i++) {
      const index = cells[i]!, x = index % width, y = Math.floor(index / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, n = yy * width + xx;
        if (dy !== 0 && seams.has(Math.max(y, yy))) continue;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height || seen[n] || !mask[n]) continue;
        seen[n] = 1; cells.push(n);
      }
    }
    if (cells.length < 2) continue;
    const columns = right - left + 1, first = new Float32Array(columns).fill(height), last = new Float32Array(columns).fill(-1);
    for (const i of cells) {
      const x = i % width - left, y = Math.floor(i / width);
      first[x] = Math.min(first[x]!, y); last[x] = Math.max(last[x]!, y + 1);
    }
    const span = (bottom + 1 - top) / r, depth = Math.min(3, Math.max(.5, span * .25));
    const ground = (bottom + 1) / r, low = new Float32Array(columns), high = new Float32Array(columns);
    let highest = 0;
    for (let x = 0; x < columns; x++) {
      if (last[x]! < 0) continue;
      high[x] = Math.max(.25, ground - first[x]! / r - depth * .5);
      // Art ending well above the component ground is an eave, not a full-height wall.
      low[x] = Math.max(0, ground - last[x]! / r - depth * .5);
      highest = Math.max(highest, high[x]!);
    }
    volumes.push({ x: p.x + left / r, y: p.y + ground - depth, w: columns / r, d: depth, height: highest, low, high });
  }
  return { width, height, mask, volumes };
}

/** Raster adapter used by headless assistant evidence. */
export function rasterSunlightArt(image: { width: number; height: number; data: ArrayLike<number> },
  tileSize: number, tilesPerRow: number): SunlightArtSource {
  const masks = new Map<number, Uint8Array>(), r = SUN_ART_RESOLUTION;
  return { tileMask(tile) {
    let mask = masks.get(tile); if (mask) return mask;
    mask = new Uint8Array(r * r);
    const sx = tile % tilesPerRow * tileSize, sy = Math.floor(tile / tilesPerRow) * tileSize;
    for (let y = 0; y < r; y++) for (let x = 0; x < r; x++) {
      const px = sx + Math.floor((x + .5) * tileSize / r), py = sy + Math.floor((y + .5) * tileSize / r);
      mask[y * r + x] = px < image.width && py < image.height && image.data[(py * image.width + px) * 4 + 3]! >= 128 ? 1 : 0;
    }
    masks.set(tile, mask); return mask;
  } };
}
