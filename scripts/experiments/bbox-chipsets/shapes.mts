// (copied from bbox-dungeon round 2, agent/bbox-dungeon worktree, for the bbox-chipsets yard grounds and paths)
// bbox-dungeon round 2: shape vocabulary the model controls; this code only rasterises it deterministically.
//   shapes: {rect:[x,y,w,h]} · {poly:[[x,y],...]} (cell-corner vertices) · {ellipse:[cx,cy,rx,ry]} · {blob:[[x,y,r],...]} (control points + radius)
//   edges:  smooth · rough (seeded jitter, amplitude 1) · crumbled (finer jitter, amplitude 1, occasional 2-deep bites)
//   paths:  line (polyline, any angle) · curve (Catmull-Rom spline through the points), square brush of width w
export type Shape = { rect?: number[]; poly?: number[][]; ellipse?: number[]; blob?: number[][] };
export type Edge = "smooth" | "rough" | "crumbled";

const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Cells covered by one shape (cell (x,y) is in when its centre is inside). Returns an error string for a malformed shape. */
export function rasterShape(s: Shape, W: number, H: number): { cells: Set<number>; error?: string } {
  const cells = new Set<number>();
  const add = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < W && y < H) cells.add(y * W + x); };
  if (Array.isArray(s?.rect)) {
    const [x, y, w, h] = s.rect;
    if (![x, y, w, h].every(isNum) || w! < 1 || h! < 1) return { cells, error: `rect needs [x,y,w,h] with w,h >= 1 (got ${JSON.stringify(s.rect)})` };
    for (let yy = Math.round(y!); yy < Math.round(y! + h!); yy += 1) for (let xx = Math.round(x!); xx < Math.round(x! + w!); xx += 1) add(xx, yy);
    return { cells };
  }
  if (Array.isArray(s?.ellipse)) {
    const [cx, cy, rx, ry] = s.ellipse;
    if (![cx, cy, rx, ry].every(isNum) || rx! < 0.5 || ry! < 0.5) return { cells, error: `ellipse needs [cx,cy,rx,ry] with radii >= 1 (got ${JSON.stringify(s.ellipse)})` };
    const ax = rx! + 0.5, ay = ry! + 0.5;
    for (let y = Math.floor(cy! - ay); y <= Math.ceil(cy! + ay); y += 1) for (let x = Math.floor(cx! - ax); x <= Math.ceil(cx! + ax); x += 1)
      if (((x - cx!) / ax) ** 2 + ((y - cy!) / ay) ** 2 <= 1) add(x, y);
    return { cells };
  }
  if (Array.isArray(s?.poly)) {
    const p = s.poly;
    if (p.length < 3 || !p.every((v) => Array.isArray(v) && isNum(v[0]) && isNum(v[1]))) return { cells, error: `poly needs at least 3 vertices [[x,y],...] (got ${JSON.stringify(p).slice(0, 80)})` };
    const xs = p.map((v) => v[0]!), ys = p.map((v) => v[1]!);
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y += 1) for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x += 1) {
      const px = x + 0.5, py = y + 0.5; let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
        const [xi, yi] = p[i]!, [xj, yj] = p[j]!;
        if ((yi! > py) !== (yj! > py) && px < ((xj! - xi!) * (py - yi!)) / (yj! - yi!) + xi!) inside = !inside;
      }
      if (inside) add(x, y);
    }
    return { cells };
  }
  if (Array.isArray(s?.blob)) {
    const p = s.blob;
    if (!p.length || !p.every((v) => Array.isArray(v) && isNum(v[0]) && isNum(v[1]) && isNum(v[2]) && v[2]! >= 1)) return { cells, error: `blob needs control points [[x,y,r],...] with r >= 1 (got ${JSON.stringify(p).slice(0, 80)})` };
    const segs = p.length === 1 ? [[p[0]!, p[0]!]] : p.slice(1).map((b, i) => [p[i]!, b]);
    const rmax = Math.max(...p.map((v) => v[2]!)) + 1;
    const xs = p.map((v) => v[0]!), ys = p.map((v) => v[1]!);
    for (let y = Math.floor(Math.min(...ys) - rmax); y <= Math.ceil(Math.max(...ys) + rmax); y += 1) for (let x = Math.floor(Math.min(...xs) - rmax); x <= Math.ceil(Math.max(...xs) + rmax); x += 1) {
      for (const [a, b] of segs) {
        const dx = b![0]! - a![0]!, dy = b![1]! - a![1]!, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, ((x - a![0]!) * dx + (y - a![1]!) * dy) / L2)) : 0;
        const r = a![2]! + (b![2]! - a![2]!) * t;
        if (Math.hypot(x - (a![0]! + dx * t), y - (a![1]! + dy * t)) <= r + 0.3) { add(x, y); break; }
      }
    }
    return { cells };
  }
  return { cells, error: `unknown shape ${JSON.stringify(s).slice(0, 80)} — use {rect}, {poly}, {ellipse} or {blob}` };
}

export function rasterShapes(list: unknown, W: number, H: number, errors: string[], tag: string): Set<number> {
  const out = new Set<number>();
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  if (!arr.length) errors.push(`${tag}: needs "shapes": [one or more {rect}|{poly}|{ellipse}|{blob}].`);
  for (const s of arr) { const r = rasterShape(s as Shape, W, H); if (r.error) errors.push(`${tag}: ${r.error}.`); for (const c of r.cells) out.add(c); }
  return out;
}

// ---- deterministic value noise ----
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
}
function vnoise(x: number, y: number, period: number, seed: number): number {
  const fx = x / period, fy = y / period, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * s(tx)) + ((c + (d - c) * s(tx)) - (a + (b - a) * s(tx))) * s(ty);
}
export const seedOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h % 100000; };

/** Edge style: jitter the boundary of a cell set. Removals never thin the set below 2 cells across; width-1/2 parts only grow. */
export function applyEdge(cells: Set<number>, edge: Edge | undefined, seed: number, W: number, H: number): { cells: Set<number>; added: Set<number>; removed: Set<number> } {
  const added = new Set<number>(), removed = new Set<number>();
  if (!edge || edge === "smooth") return { cells, added, removed };
  const crumbled = edge === "crumbled";
  const period = crumbled ? 2 : 3, t = crumbled ? 0.1 : 0.2;
  const inb = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  const has = (x: number, y: number) => inb(x, y) && cells.has(y * W + x);
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const out = new Set(cells);
  for (const c of cells) {
    const x = c % W, y = (c - x) / W;
    for (const [dx, dy] of D) {
      if (has(x + dx, y + dy)) continue;          // (x,y) is a boundary cell facing outward along d
      const n = vnoise(x, y, period, seed);
      // remove: only when 2 more cells stand behind it (keeps thickness >= 2)
      if (n < -t && has(x - dx, y - dy) && has(x - 2 * dx, y - 2 * dy)) {
        out.delete(c); removed.add(c);
        if (crumbled && n < -0.55 && has(x - 3 * dx, y - 3 * dy) && has(x - 4 * dx, y - 4 * dy)) { out.delete(c - dx - dy * W); removed.add(c - dx - dy * W); }
      }
      const X = x + dx, Y = y + dy;
      if (inb(X, Y) && vnoise(X, Y, period, seed + 17) > t) { out.add(Y * W + X); added.add(Y * W + X); }
    }
  }
  for (const c of added) removed.delete(c);
  return { cells: out, added, removed };
}

/** Thick path through points: line = straight segments (any angle), curve = Catmull-Rom spline. 4-connected centreline, square brush of width w. */
export function rasterPath(points: number[][], width: number, curve: boolean, W: number, H: number): Set<number> {
  const pts = points.map((p) => [p[0]!, p[1]!] as [number, number]);
  const sample: [number, number][] = [];
  const seg = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
    const n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 6));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      if (!curve) { sample.push([b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t]); continue; }
      const t2 = t * t, t3 = t2 * t;
      const f = (p0: number, p1: number, p2: number, p3: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      sample.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]);
    }
  };
  for (let i = 0; i + 1 < pts.length; i += 1) seg(pts[Math.max(0, i - 1)]!, pts[i]!, pts[i + 1]!, pts[Math.min(pts.length - 1, i + 2)]!);
  const line: [number, number][] = [];
  for (const [fx, fy] of sample) {
    const x = Math.round(fx), y = Math.round(fy), last = line[line.length - 1];
    if (last && last[0] === x && last[1] === y) continue;
    if (last && last[0] !== x && last[1] !== y) line.push([x, last[1]]);   // keep it 4-connected
    line.push([x, y]);
  }
  lastCentre = line;
  const out = new Set<number>();
  const o = Math.floor((width - 1) / 2);
  for (const [x, y] of line) for (let dy = 0; dy < width; dy += 1) for (let dx = 0; dx < width; dx += 1) {
    const X = x - o + dx, Y = y - o + dy;
    if (X >= 0 && Y >= 0 && X < W && Y < H) out.add(Y * W + X);
  }
  return out;
}

/** Ordered 4-connected centreline cells of the last rasterPath call (for evenly spaced stepping stones). */
let lastCentre: [number, number][] = [];
export function pathCentre(points: number[][], curve: boolean, W: number, H: number): [number, number][] { rasterPath(points, 1, curve, W, H); return lastCentre.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H); }
