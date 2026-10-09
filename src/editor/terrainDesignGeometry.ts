export interface TerrainPoint { x: number; y: number }
export type TerrainSymmetry = "none" | "mirrorX" | "mirrorY" | "both" | "rotate2" | "rotate4";
export function symmetryVariants(mode: TerrainSymmetry, width: number, height: number): number[] {
  return mode === "none" ? [0] : mode === "both" ? [0, 1, 2, 3] : mode === "rotate4" && width === height ? [0, 4, 3, 5] : mode === "rotate2" ? [0, 3] : [0, mode === "mirrorX" ? 1 : 2];
}
export function transformPoint(p: TerrainPoint, width: number, height: number, variant: number): TerrainPoint {
  if (variant === 4) return { x: width - 1 - p.y, y: p.x };
  if (variant === 5) return { x: p.y, y: height - 1 - p.x };
  return { x: variant & 1 ? width - 1 - p.x : p.x, y: variant & 2 ? height - 1 - p.y : p.y };
}
export function symmetricPoints(p: TerrainPoint, mode: TerrainSymmetry, width: number, height: number): TerrainPoint[] {
  const seen = new Set<string>();
  return symmetryVariants(mode, width, height).map(v => transformPoint(p, width, height, v)).filter(p => { const key = `${p.x},${p.y}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export function lineCells(points: readonly TerrainPoint[]): TerrainPoint[] {
  const out: TerrainPoint[] = [], seen = new Set<string>();
  for (let n = 0; n < Math.max(1, points.length - 1); n++) {
    const a = points[n], b = points[n + 1] ?? a; if (!a || !b) continue;
    let x = a.x, y = a.y; const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y), sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1; let error = dx - dy;
    for (;;) {
      const key = `${x},${y}`; if (!seen.has(key)) { seen.add(key); out.push({ x, y }); }
      if (x === b.x && y === b.y) break;
      // Add the intermediate orthogonal cell so a diagonal road is actually walkable.
      const e = 2 * error;
      if (e > -dy) { error -= dy; x += sx; if (e < dx) { const k = `${x},${y}`; if (!seen.has(k)) { seen.add(k); out.push({ x, y }); } } }
      if (e < dx) { error += dx; y += sy; }
    }
  }
  return out;
}
export function polygonCells(points: readonly TerrainPoint[], width: number, height: number): TerrainPoint[] {
  if (points.length < 3) return [];
  const out = lineCells([...points, points[0]!]), seen = new Set(out.map(p => `${p.x},${p.y}`));
  const x0 = Math.max(0, Math.min(...points.map(p => p.x))), x1 = Math.min(width - 1, Math.max(...points.map(p => p.x)));
  const y0 = Math.max(0, Math.min(...points.map(p => p.y))), y1 = Math.min(height - 1, Math.max(...points.map(p => p.y)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const a = points[i]!, b = points[j]!; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside; }
    const key = `${x},${y}`; if (inside && !seen.has(key)) { seen.add(key); out.push({ x, y }); }
  }
  return out.filter(p => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height);
}
export function terrainHash(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 17, 73856093) ^ Math.imul(y + 29, 19349663) ^ Math.imul(seed, 83492791);
  h = Math.imul(h ^ h >>> 16, 0x7feb352d); h = Math.imul(h ^ h >>> 15, 0x846ca68b);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
