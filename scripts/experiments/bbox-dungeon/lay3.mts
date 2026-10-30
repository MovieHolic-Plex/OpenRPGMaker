// bbox-dungeon round 3 (round 2 + decor scatter with density, rock size check, hazard speck cleanup, decor density metric): execute a model-written dungeon floor with a shape vocabulary (rect, rect union, polygon, ellipse, cave blob,
// edge styles; line/curve/fissure corridors; bridges; rock islands; water/lava/pit pools; ledges with stairs; scatter) on the beodeul dungeon kits.
//   bun scripts/experiments/bbox-dungeon/lay3.mts <layout.json> <out dir> [--render]
// Prints {ok, errors[], warnings[], stats} (English, for the repair call). The model decides every shape; this code rasterises them
// deterministically (shapes.mts), derives wall/ceiling/floor art from the open cells, stamps named pieces and checks:
// connectivity from the entrance stairs (with ledges and stairs), boss only through the antechamber, hazards leave a path,
// solid gaps thick enough for wall art. Box ratio (share of rooms that are one plain smooth rect) is reported, never forced.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { composeDungeon } from "../../../src/editor/dungeonKit/beodeul/compose";
import { dungeonReliefStyle } from "../../../src/editor/dungeonKit/reliefPlan";
import { Grid } from "../../../src/editor/dungeonKit/grid";
import { checkGroundSupportForStamp, kitSupportKind } from "../../../src/project/groundSupport";
import { invalidateReliefSlopes } from "../../../src/project/relief/walk";
import type { GameEvent, GameMap, StructureKitDef, TilesetDef } from "../../../src/project/types";
import { PIECES, THEMES } from "./pieces.mts";
import { loadPool, POOL_CLASS } from "./pool.mts";
import { applyEdge, rasterPath, rasterShapes, seedOf, type Edge } from "./shapes.mts";

const [lf, outDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
if (!lf || !outDir) throw Error("lay3.mts <layout.json> <out dir> [--render]");
mkdirSync(outDir, { recursive: true });
const L = JSON.parse(readFileSync(lf, "utf8"));
const errors: string[] = [], warnings: string[] = [];
const project = createBlankProject();
const poolCount = await loadPool(project);
const done = (extra: Record<string, unknown> = {}) => { const r = { ok: errors.length === 0, errors, warnings, ...extra }; writeFileSync(resolve(outDir, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
const num = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const W = L.map?.w, H = L.map?.h;
if (!num(W) || !num(H) || W < 16 || H < 16 || W > 90 || H > 80) { errors.push(`map.w/map.h must be integers, w 16..90, h 16..80 (got ${W}x${H}).`); done(); }
if (!(THEMES as readonly string[]).includes(L.theme)) errors.push(`theme must be one of ${THEMES.join(", ")} (got "${L.theme}").`);
const idx = (x: number, y: number) => y * W + x;
const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const P = (x: number, y: number) => `(${x},${y})`;
const PC = (c: number) => P(c % W, (c / W) | 0);
const EDGES = ["smooth", "rough", "crumbled"];
const edgeOf = (v: unknown, tag: string): Edge => { if (v === undefined) return "smooth"; if (!EDGES.includes(v as string)) { errors.push(`${tag}: edge must be smooth, rough or crumbled (got "${v}").`); return "smooth"; } return v as Edge; };
const interior = (c: number) => { const x = c % W, y = (c / W) | 0; return x >= 1 && x <= W - 2 && y >= 3 && y <= H - 2; };
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

// ---- regions ----
type Region = { id: string; kind: "room" | "corridor"; purpose?: string; cells: Set<number>; added: Set<number>; removed: Set<number>; links: Set<string> };
const regionList: Region[] = [];
const byId = new Map<string, Region>();
const PURPOSES = ["entrance", "guard", "puzzle", "treasure", "antechamber", "boss", "other"];
const rooms: any[] = Array.isArray(L.rooms) ? L.rooms : [];
const corridors: any[] = Array.isArray(L.corridors) ? L.corridors : [];
const shapeKinds: Record<string, number> = {};
let plainRects = 0;
for (const r of rooms) {
  const tag = `room "${r.id}"`;
  if (typeof r.id !== "string" || byId.has(r.id)) { errors.push(`a room has a missing or duplicate id (${JSON.stringify(r.id)}).`); continue; }
  if (!PURPOSES.includes(r.purpose)) errors.push(`${tag}: purpose must be one of ${PURPOSES.join(", ")} (got "${r.purpose}").`);
  const shapes = Array.isArray(r.shapes) ? r.shapes : [];
  const edge = edgeOf(r.edge, tag);
  for (const s of shapes) for (const k of Object.keys(s ?? {})) shapeKinds[k] = (shapeKinds[k] ?? 0) + 1;
  if (shapes.length === 1 && shapes[0]?.rect && edge === "smooth") plainRects += 1;
  const raw = rasterShapes(shapes, W, H, errors, tag);
  for (const c of raw) if (!interior(c)) { errors.push(`${tag}: cell ${PC(c)} is outside the open band x 1..${W - 2}, y 4..${H - 2} (rows above every open area hold its wall face).`); break; }
  const e = applyEdge(new Set([...raw].filter(interior)), edge, Number.isInteger(r.seed) ? r.seed : seedOf(r.id), W, H);
  const reg: Region = { id: r.id, kind: "room", purpose: r.purpose, cells: new Set([...e.cells].filter(interior)), added: e.added, removed: e.removed, links: new Set(Array.isArray(r.joins) ? r.joins : []) };
  regionList.push(reg); byId.set(r.id, reg);
}
const byPurpose = (p: string) => rooms.filter((r) => r.purpose === p);
for (const p of ["entrance", "antechamber", "boss"]) if (byPurpose(p).length !== 1) errors.push(`need exactly one room with purpose "${p}" (got ${byPurpose(p).length}).`);
for (const c of corridors) {
  const tag = `corridor "${c.id}"`;
  if (typeof c.id !== "string" || byId.has(c.id)) { errors.push(`a corridor has a missing or duplicate id (${JSON.stringify(c.id)}).`); continue; }
  const w = c.width ?? 1;
  if (!num(w) || w < 1 || w > 4) errors.push(`${tag}: width must be 1..4.`);
  const pts: any[] = Array.isArray(c.points) ? c.points : [];
  if (pts.length < 2 || !pts.every((p) => Array.isArray(p) && num(p[0]) && num(p[1]))) { errors.push(`${tag}: points needs at least 2 integer waypoints [[x,y],...].`); continue; }
  if (c.path !== undefined && c.path !== "line" && c.path !== "curve") errors.push(`${tag}: path must be "line" or "curve".`);
  for (const id of [c.from, c.to]) if (!rooms.some((r) => r.id === id)) errors.push(`${tag}: from/to "${id}" is not a room id.`);
  const raw = rasterPath(pts, Math.max(1, Math.min(4, w | 0)), c.path === "curve", W, H);
  for (const q of raw) if (!interior(q)) { errors.push(`${tag}: cell ${PC(q)} is outside the open band x 1..${W - 2}, y 4..${H - 2}.`); break; }
  const e = applyEdge(new Set([...raw].filter(interior)), edgeOf(c.edge, tag), seedOf(c.id), W, H);
  const reg: Region = { id: c.id, kind: "corridor", cells: new Set([...e.cells].filter(interior)), added: e.added, removed: e.removed, links: new Set([c.from, c.to]) };
  regionList.push(reg); byId.set(c.id, reg);
}
for (const r of regionList) for (const l of r.links) byId.get(l)?.links.add(r.id);
const linked = (a: Region, b: Region) => a === b || a.links.has(b.id) || b.links.has(a.id) || (a.kind === "corridor" && b.kind === "corridor");
// ownership: rooms first (declared order), then corridors fill cells no room owns.
const owner = new Int32Array(W * H).fill(-1);
const claim = (ri: number) => {
  const reg = regionList[ri]!;
  for (const c of reg.cells) {
    const o = owner[c]!;
    if (o < 0) { owner[c] = ri; continue; }
    const other = regionList[o]!;
    if (linked(reg, other)) continue;   // overlap with a linked region merges into it
    if (reg.added.has(c)) continue;      // edge jitter never pushes into an unlinked region
    if (other.added.has(c)) { owner[c] = ri; continue; }
    errors.push(`${reg.kind} "${reg.id}" overlaps ${other.kind} "${other.id}" at ${PC(c)} — they are not linked (corridor from/to or room "joins"); move one or link them.`);
    break;
  }
};
regionList.forEach((r, i) => { if (r.kind === "room") claim(i); });
regionList.forEach((r, i) => { if (r.kind === "corridor") claim(i); });
// contacts between unlinked regions: drop jitter-added cells first, then report.
const contacts = (report: boolean) => {
  let changed = false;
  for (let c = 0; c < W * H; c += 1) {
    const o = owner[c]!; if (o < 0) continue;
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of DIR4) {
      if (!inb(x + dx, y + dy) || owner[c]! < 0) continue;
      const n = idx(x + dx, y + dy), o2 = owner[n]!;
      if (o2 < 0 || o2 === o || linked(regionList[o]!, regionList[o2]!)) continue;
      const a = regionList[o]!, b = regionList[o2]!;
      if (a.added.has(c)) { owner[c] = -1; changed = true; continue; }
      if (b.added.has(n)) { owner[n] = -1; changed = true; continue; }
      if (report) errors.push(`${a.kind} "${a.id}" touches ${b.kind} "${b.id}" at ${P(x, y)}-${P(x + dx, y + dy)} but they are not linked — leave solid rock between them, or link them (corridor from/to, or room "joins": ["${b.id}"]).`);
    }
  }
  return changed;
};
for (let k = 0; k < 6 && contacts(false); k += 1);
contacts(true);
const touchedErr = new Set<string>();
for (let k = errors.length - 1; k >= 0; k -= 1) { const m = errors[k]!.match(/^(\w+) "([^"]+)" touches \w+ "([^"]+)"/u); if (m) { const key = [m[2], m[3]].sort().join("|"); if (touchedErr.has(key)) errors.splice(k, 1); else touchedErr.add(key); } }
const isOpen = (x: number, y: number) => inb(x, y) && owner[idx(x, y)]! >= 0;

// ---- rock islands (solid shapes inside open areas) ----
const rockAdded = new Set<number>(), rockCells = new Set<number>();
for (const [k, rk] of (Array.isArray(L.rocks) ? L.rocks : []).entries()) {
  const tag = `rock #${k}`;
  const raw = rasterShapes(rk.shapes, W, H, errors, tag);
  const e = applyEdge(raw, edgeOf(rk.edge, tag), seedOf(`rock${k}`), W, H);
  const mine: number[] = [];
  for (const c of e.cells) { if (owner[c]! < 0) continue; owner[c] = -1; rockCells.add(c); mine.push(c); if (e.added.has(c)) rockAdded.add(c); }
  if (mine.length) {
    const xs = mine.map((c) => c % W), ys = mine.map((c) => (c / W) | 0);
    const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
    if (bw < 2 || bh < 2) errors.push(`${tag} is only ${bw}x${bh} cells — a rock island must be at least 2x2 (and 3 rows tall); make it bigger, or use a scatter rock piece instead (rock pillar, cave stalagmite, wide spike rock, mossy boulder).`);
  }
}
// ---- thin solid runs: open cell, then 1-2 solid rows, then open cell above in the same column → no room for a wall face + ceiling.
// Jitter made them? undo the jitter. Otherwise it is a layout error.
const jitterRemoved = (c: number) => regionList.some((r) => r.removed.has(c));
const jitterAdded = (c: number) => { const o = owner[c]!; return o >= 0 && regionList[o]!.added.has(c); };
const thinRuns = () => {
  const runs: { x: number; top: number; bot: number }[] = [];
  for (let x = 0; x < W; x += 1) {
    let lastOpen = -1;
    for (let y = 0; y < H; y += 1) {
      if (!isOpen(x, y)) continue;
      const gap = y - lastOpen - 1;
      if (lastOpen >= 0 && gap >= 1 && gap <= 2) runs.push({ x, top: lastOpen + 1, bot: y - 1 });
      lastOpen = y;
    }
  }
  return runs;
};
for (let pass = 0; pass < 6; pass += 1) {
  const runs = thinRuns(); if (!runs.length) break;
  let changed = false;
  for (const { x, top, bot } of runs) {
    const cells = Array.from({ length: bot - top + 1 }, (_, k) => idx(x, top + k));
    if (cells.every((c) => !rockCells.has(c) || rockAdded.has(c)) && cells.some((c) => jitterRemoved(c) || rockAdded.has(c))) {
      // reopen: give the cells back to the region below
      const below = owner[idx(x, bot + 1)]!;
      for (const c of cells) { owner[c] = below; rockCells.delete(c); }
      changed = true; continue;
    }
    const above = idx(x, top - 1), below = idx(x, bot + 1);
    const ra = regionList[owner[above]!]!, rb = regionList[owner[below]!]!;
    if (!cells.some((c) => rockCells.has(c)) && ra !== rb && linked(ra, rb)) {
      // two linked regions (a corridor and its own room) pass within 1-2 rows: join them through the gap
      for (const c of cells) owner[c] = rb.kind === "corridor" ? owner[below]! : owner[above]!;
      warnings.push(`${ra.kind} "${ra.id}" and ${rb.kind} "${rb.id}" passed within ${cells.length} row(s) of each other at ${P(x, top)}; the gap was opened to join them.`);
      changed = true; continue;
    }
    if (!cells.some((c) => rockCells.has(c)) && ra === rb) {
      for (const c of cells) owner[c] = owner[above]!;
      warnings.push(`${ra.kind} "${ra.id}" folds back on itself with a ${cells.length}-row gap at ${P(x, top)}; the gap was filled.`);
      changed = true; continue;
    }
    if (jitterAdded(above)) { owner[above] = -1; changed = true; continue; }
    if (jitterAdded(below)) { owner[below] = -1; changed = true; continue; }
  }
  if (!changed) break;
}
{
  const runs = thinRuns(); const seenPair = new Set<string>();
  for (const { x, top, bot } of runs) {
    const a = regionList[owner[idx(x, top - 1)]!]!, b = regionList[owner[idx(x, bot + 1)]!]!;
    const isRock = rockCells.has(idx(x, top));
    const key = `${a.id}|${b.id}|${isRock}`; if (seenPair.has(key)) continue; seenPair.add(key);
    errors.push(isRock
      ? `rock at ${P(x, top)} is only ${bot - top + 1} row(s) tall between open cells — a rock island needs at least 3 rows top to bottom in every column (its top row is ceiling, the 2 below become its wall face), or remove it.`
      : `only ${bot - top + 1} solid row(s) between ${a.kind} "${a.id}" (above, ${P(x, top - 1)}) and ${b.kind} "${b.id}" (below, ${P(x, bot + 1)}) — keep at least 3 solid rows (4 gives a full wall face) between an open cell and any open cell above it in the same column, or join them into one open area.`);
  }
}
for (const r of regionList) { r.cells = new Set(); }
for (let c = 0; c < W * H; c += 1) if (owner[c]! >= 0) regionList[owner[c]!]!.cells.add(c);
for (const r of regionList) if (!r.cells.size) errors.push(`${r.kind} "${r.id}" has no open cell left.`);

// ---- hazards (water / lava / pit pools, shapes + edge) and bridges ----
const liqKind = new Uint8Array(W * H), bridge = new Uint8Array(W * H);
const HZ: Record<string, number> = { water: 1, lava: 2, pit: 3 };
for (const [k, h] of (Array.isArray(L.hazards) ? L.hazards : []).entries()) {
  const tag = `hazard #${k} (${h.kind})`;
  if (!HZ[h.kind]) { errors.push(`${tag}: kind must be water, lava or pit.`); continue; }
  const raw = rasterShapes(h.shapes, W, H, errors, tag);
  const e = applyEdge(raw, edgeOf(h.edge, tag), seedOf(`hz${k}`), W, H);
  let inside = 0;
  for (const c of e.cells) if (owner[c]! >= 0) { liqKind[c] = HZ[h.kind]!; inside += 1; }
  if (!inside) errors.push(`${tag}: none of its cells is inside a room or corridor.`);
  else if (inside < raw.size * 0.6) warnings.push(`${tag}: ${raw.size - inside} of its cells fall on solid rock and were dropped.`);
}
// mechanical cleanup of rough shores: hazard specks of 1-2 cells cut off from their pool (not a deliberate 1-2 cell hazard) are dropped, and a dry cell
// enclosed on all 4 sides by the same hazard is filled (a lone cell of shore inside a pool reads as a defect).
{
  const tinyRaw = new Set<number>();
  for (const [k, h] of (Array.isArray(L.hazards) ? L.hazards : []).entries()) { if (!HZ[h.kind]) continue; const raw = rasterShapes(h.shapes, W, H, [], ""); if (raw.size <= 2) for (const c of raw) tinyRaw.add(c); }
  const seenL = new Uint8Array(W * H); let dropped = 0, filled = 0;
  for (let i = 0; i < W * H; i += 1) {
    if (!liqKind[i] || seenL[i]) continue;
    const q = [i]; seenL[i] = 1;
    for (let j = 0; j < q.length; j += 1) { const c = q[j]!, x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (!seenL[n] && liqKind[n] === liqKind[i]) { seenL[n] = 1; q.push(n); } } }
    if (q.length <= 2 && !q.some((c) => tinyRaw.has(c))) for (const c of q) { liqKind[c] = 0; dropped += 1; }
  }
  for (let i = 0; i < W * H; i += 1) {
    if (liqKind[i] || owner[i]! < 0) continue;
    const x = i % W, y = (i / W) | 0; const ks = DIR4.map(([dx, dy]) => (inb(x + dx, y + dy) ? liqKind[idx(x + dx, y + dy)]! : 0));
    if (ks[0] && ks.every((v) => v === ks[0])) { liqKind[i] = ks[0]!; filled += 1; }
  }
  if (dropped || filled) warnings.push(`shore cleanup: dropped ${dropped} stray hazard cell(s), filled ${filled} enclosed dry cell(s).`);
}
for (const [k, b] of (Array.isArray(L.bridges) ? L.bridges : []).entries()) {
  const tag = `bridge #${k}`;
  const [x0, y0] = b.from ?? [], [x1, y1] = b.to ?? [], w = b.width ?? 1;
  if (![x0, y0, x1, y1].every(num) || !num(w) || w < 1 || w > 3) { errors.push(`${tag}: needs from:[x,y], to:[x,y] (integers) and width 1..3.`); continue; }
  if (x0 !== x1 && y0 !== y1) { errors.push(`${tag}: from ${P(x0, y0)} and to ${P(x1, y1)} must share a row or column (bridges are straight).`); continue; }
  let n = 0;
  for (const c of rasterPath([[x0, y0], [x1, y1]], w, false, W, H)) if (liqKind[c]) { bridge[c] = 1; n += 1; }
  if (!n) errors.push(`${tag}: does not cross any hazard cell.`);
}
const isWalkFloor = (x: number, y: number) => isOpen(x, y) && (!liqKind[idx(x, y)] || bridge[idx(x, y)] === 1);

// ---- ledges (raised floor levels) and stairs ----
const levels = new Array<number>(W * H).fill(0), ramps = new Array<number>(W * H).fill(0);
for (const [k, l] of (Array.isArray(L.ledges) ? L.ledges : []).entries()) {
  const tag = `ledge #${k}`;
  if (l.level !== 1 && l.level !== 2) { errors.push(`${tag}: level must be 1 or 2.`); continue; }
  const raw = rasterShapes(l.shapes, W, H, errors, tag);
  const e = applyEdge(raw, edgeOf(l.edge, tag), seedOf(`ledge${k}`), W, H);
  let n = 0; for (const c of e.cells) if (owner[c]! >= 0) { levels[c] = l.level; n += 1; }
  if (!n) errors.push(`${tag}: covers no open cell.`);
}
const SD: Record<string, [number, number, number]> = { n: [0, -1, 5], s: [0, 1, 6], e: [1, 0, 7], w: [-1, 0, 8] };
type Flight = { cells: Set<number>; dx: number; dy: number; lo: number; hi: number; first: Set<number>; last: Set<number> };
const flights: Flight[] = [];
for (const [k, s] of (Array.isArray(L.stairs) ? L.stairs : []).entries()) {
  const tag = `stairs #${k}`;
  const d = SD[s.up], w = s.width ?? 2;
  if (!d || !num(s.x) || !num(s.y) || !num(w) || w < 1 || w > 3) { errors.push(`${tag}: needs integer x,y, up: n|s|e|w and width 1..3.`); continue; }
  const [dx, dy, code] = d; const px = dy ? 1 : 0, py = dx ? 1 : 0;
  const f: Flight = { cells: new Set(), dx, dy, lo: 0, hi: 0, first: new Set(), last: new Set() };
  let bad = "";
  for (let j = 0; j < w && !bad; j += 1) {
    const sx = s.x + px * j, sy = s.y + py * j;
    if (!isWalkFloor(sx - dx, sy - dy) || !isWalkFloor(sx, sy)) { bad = `the cell before it ${P(sx - dx, sy - dy)} and its first cell ${P(sx, sy)} must be walkable floor`; break; }
    const lo = levels[idx(sx - dx, sy - dy)]!, hi = levels[idx(sx, sy)]!;
    if (hi <= lo) { bad = `its first cell ${P(sx, sy)} (level ${hi}) must be on a higher ledge than the cell before it ${P(sx - dx, sy - dy)} (level ${lo}) — put (x,y) on the ledge's edge cell, facing up`; break; }
    const len = hi - lo + 1;
    const top = [sx + dx * len, sy + dy * len] as const;
    if (!isWalkFloor(...top) || levels[idx(...top)] !== hi) { bad = `it climbs ${len} cells; the landing at ${P(...top)} must be walkable floor on level ${hi}`; break; }
    for (let t = 0; t < len; t += 1) { const X = sx + dx * t, Y = sy + dy * t; if (!isWalkFloor(X, Y) || levels[idx(X, Y)] !== hi) { bad = `step cell ${P(X, Y)} must be walkable ledge floor (level ${hi})`; break; } }
    if (bad) break;
    if (f.lo === 0 && f.hi === 0) { f.lo = lo; f.hi = hi; } else if (f.lo !== lo || f.hi !== hi) { bad = "all its lanes must climb between the same two levels"; break; }
    for (let t = 0; t < len; t += 1) { const c = idx(sx + dx * t, sy + dy * t); levels[c] = lo; ramps[c] = code; f.cells.add(c); if (t === 0) f.first.add(c); if (t === len - 1) f.last.add(c); }
  }
  if (bad) { errors.push(`${tag} at ${P(s.x, s.y)} up ${s.up}: ${bad}.`); continue; }
  flights.push(f);
}
const flightOf = (i: number) => flights.find((f) => f.cells.has(i));
const stepOk = (a: number, b: number): boolean => {
  const fa = flightOf(a), fb = flightOf(b);
  if (!fa && !fb) return levels[a] === levels[b];
  const ax = a % W, ay = (a - ax) / W, bx = b % W, by = (b - bx) / W, sx = bx - ax, sy = by - ay;
  if (fa && fb) return fa === fb && sx * fa.dy === 0 && sy * fa.dx === 0;
  const f = (fa ?? fb)!;
  if (sx * f.dy !== 0 || sy * f.dx !== 0) return false;
  const rampCell = fa ? a : b, plain = fa ? b : a, out = fa ? [sx, sy] : [-sx, -sy];
  const up = out[0] === f.dx && out[1] === f.dy;
  return up ? f.last.has(rampCell) && levels[plain] === f.hi : f.first.has(rampCell) && levels[plain] === f.lo;
};

// ---- pieces ----
type Put = { name: string; x: number; y: number; scatter?: boolean };
const puts: Put[] = [];
const expand = (o: any): Put[] => { const n = o.repeat?.count ?? 1, dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0; return Array.from({ length: Math.max(1, Math.min(30, n)) }, (_, i) => ({ name: o.id, x: o.x + i * dx, y: o.y + i * dy })); };
for (const r of rooms) {
  if (!r.landmark) { errors.push(`room "${r.id}" has no landmark — give each room one memorable piece {id,x,y}.`); continue; }
  puts.push(...expand(r.landmark));
}
for (const o of [...(Array.isArray(L.objects) ? L.objects : []), ...(Array.isArray(L.traps) ? L.traps : [])]) puts.push(...expand(o));
for (const p of puts) if (!PIECES[p.name] || !num(p.x) || !num(p.y)) errors.push(`piece ${JSON.stringify(p).slice(0, 80)}: unknown catalog id or non-integer x,y — use an exact id from the catalog.`);
const chests: any[] = Array.isArray(L.chests) ? L.chests : [];
const gates: any[] = Array.isArray(L.gates) ? L.gates : [];
for (const g of gates) if (!num(g.x) || !num(g.y) || !isWalkFloor(g.x, g.y)) errors.push(`gate ${JSON.stringify(g).slice(0, 60)}: needs integer x,y on walkable floor.`);
if (puts.filter((p) => p.name === "stairs up").length !== 1) errors.push(`need exactly one "stairs up" (the entrance stairs, on the entrance room's north wall face).`);
if (errors.length) done({ stats: { boxRatio: rooms.length ? +(plainRects / rooms.length).toFixed(2) : 0 } });

// ---- compose: walls / ceiling / floor / liquid art from the open cells ----
const ts = project.tilesets["beodeul_city"]!;
const kits = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((k) => [k.id, k]));
const g = new Grid(W, H);
const roomRegions = regionList.filter((r) => r.kind === "room");
const order = [...roomRegions].sort((a, b) => (a.purpose === "entrance" ? -1 : b.purpose === "entrance" ? 1 : 0));
const KIND: Record<string, string> = { entrance: "entrance", boss: "boss", treasure: "vault", guard: "hall", puzzle: "shrine", antechamber: "hall", other: "hall" };
for (let i = 0; i < W * H; i += 1) {
  const o = owner[i]!; if (o < 0) continue;
  g.floor[i] = 1;
  const reg = regionList[o]!;
  g.roomAt[i] = reg.kind === "room" ? order.indexOf(reg) : -1;
  if (liqKind[i] && !bridge[i]) g.liquid[i] = 1;
  if (bridge[i]) g.bridge[i] = 1;
}
const placedRooms = order.map((r) => {
  const xs = [...r.cells].map((c) => c % W), ys = [...r.cells].map((c) => (c / W) | 0);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { id: r.id, kind: KIND[r.purpose ?? "other"] ?? "hall", x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1, from: null, dir: null, depth: 0 };
});
let comp: any;
try {
  comp = composeDungeon(ts, { type: L.theme, seed: 7, exact: { layout: { rooms: placedRooms, corridors: [], width: W, height: H, notes: [], grid: g, thin: true }, liqKind } } as never);
} catch (e) {
  const m = String((e as Error).message ?? e);
  const cells = m.match(/\(\d+,\d+\)/gu)?.slice(0, 6).join(" ") ?? "";
  if (/stranded-wall|벽 앞면 위에 천장/u.test(m)) errors.push(`wall too thin above open cells ${cells}: keep at least 3 solid rows between an open cell and any open cell above it in the same column.`);
  else errors.push(`painter failed: ${m.slice(0, 300)}`);
  done();
}
const { lower, upper, wallB } = comp.exactOut as { lower: number[]; upper: number[]; wallB: Int8Array };
const isFace = (x: number, y: number) => inb(x, y) && wallB[idx(x, y)]! >= 0;
const pseudo = { id: "bbox", name: "bbox", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
const occupied = new Map<number, string>();
const stamped: { name: string; x: number; y: number; w: number; h: number; cls: string }[] = [];
let stairsFront: [number, number] | null = null;
const classOf = (name: string, def: StructureKitDef) => {
  if (POOL_CLASS[name]) return POOL_CLASS[name]!;
  const hasUp = def.rows.some((r) => (r.upperTiles ?? []).some((t) => t >= 0));
  const sk = kitSupportKind(def); const role = String(def.ai?.role ?? "");
  return name === "stairs up" || sk === "mount" || sk === "door" ? "wall" : role === "terrain" || role === "floor" || !hasUp ? "decal" : "floor";
};
const tryStamp = (p: Put, report: boolean): boolean => {
  const def = kits.get(PIECES[p.name]!);
  if (!def) { if (report) errors.push(`piece "${p.name}" is missing from this tileset.`); return false; }
  const cls = classOf(p.name, def);
  const at = `"${p.name}" at ${P(p.x, p.y)} (${def.width}x${def.height}, ${cls === "wall" ? "wall-mounted" : cls})`;
  if (p.x < 0 || p.y < 0 || p.x + def.width > W || p.y + def.height > H) { if (report) errors.push(`${at} is out of the map.`); return false; }
  let bad = "";
  for (let dy = 0; dy < def.height && !bad; dy += 1) for (let dx = 0; dx < def.width && !bad; dx += 1) {
    const X = p.x + dx, Y = p.y + dy, bottom = dy === def.height - 1;
    const lo = def.rows[dy]!.tiles[dx] ?? -1, up = def.rows[dy]!.upperTiles?.[dx] ?? -1;
    if (lo < 0 && up < 0) continue;
    if (cls === "wall") { if (!isFace(X, Y)) bad = `cell ${P(X, Y)} is not wall face (wall-mounted pieces hang on the solid rows right above an open area's top floor row)`; else if (bottom && !(isFace(X, Y + 1) || isWalkFloor(X, Y + 1))) bad = `bottom cell ${P(X, Y)} must have wall face or floor below it`; }
    else if (cls === "decal") { if (!isWalkFloor(X, Y) || ramps[idx(X, Y)]) bad = `cell ${P(X, Y)} is not walkable floor (or is a stair step)`; }
    else if (bottom ? !isWalkFloor(X, Y) || ramps[idx(X, Y)] : !(isWalkFloor(X, Y) || isFace(X, Y))) bad = bottom ? `base cell ${P(X, Y)} is not walkable floor (not on solid, wall face, water, lava, pit or stairs)` : `art cell ${P(X, Y)} is neither floor nor wall face`;
    if (!bad && cls !== "decal" && occupied.has(idx(X, Y))) bad = `cell ${P(X, Y)} is already used by "${occupied.get(idx(X, Y))}"`;
  }
  if (!bad && cls !== "wall") { const lv = new Set<number>(); for (let dx = 0; dx < def.width; dx += 1) { const c = idx(p.x + dx, p.y + def.height - 1); if (isWalkFloor(p.x + dx, p.y + def.height - 1)) lv.add(levels[c]!); } if (lv.size > 1) bad = "its base straddles two floor levels (ledge edge)"; }
  if (!bad && cls !== "decal") { const s = checkGroundSupportForStamp(pseudo, ts, def, p.x, p.y); if (s) bad = "wrong support (wall pieces on wall face, floor pieces on floor)"; }
  if (bad) { if (report) errors.push(`${at}: ${bad}.`); return false; }
  for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
    const X = p.x + dx, Y = p.y + dy;
    const lo = def.rows[dy]!.tiles[dx] ?? -1, up = def.rows[dy]!.upperTiles?.[dx] ?? -1;
    if (lo >= 0) lower[idx(X, Y)] = lo;
    if (up >= 0) upper[idx(X, Y)] = up;
    if ((lo >= 0 || up >= 0) && cls !== "decal") occupied.set(idx(X, Y), p.name);
  }
  stamped.push({ name: p.name, x: p.x, y: p.y, w: def.width, h: def.height, cls });
  if (p.name === "stairs up") {
    const fx = p.x, fy = p.y + def.height;
    const ent = roomRegions.find((r) => r.purpose === "entrance")!;
    if (!ent.cells.has(idx(fx, fy))) errors.push(`"stairs up" at ${P(p.x, p.y)}: the floor cell in front of it ${P(fx, fy)} must belong to the entrance room "${ent.id}".`);
    stairsFront = [fx, fy];
  }
  return true;
};
// rough edges move the wall line, so a piece that does not fit where written is snapped to the nearest fitting cell
// (wall-mounted: same column, up to 3 rows; floor: up to 2 cells), and only then reported.
const SNAP_WALL = [[0, -1], [0, 1], [0, -2], [0, 2], [0, -3], [0, 3]], SNAP_FLOOR = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]];
for (const p of puts) {
  if (tryStamp(p, false)) continue;
  const def = kits.get(PIECES[p.name]!);
  const offs = def && classOf(p.name, def) === "wall" ? SNAP_WALL : SNAP_FLOOR;
  const hit = offs.find(([dx, dy]) => tryStamp({ ...p, x: p.x + dx!, y: p.y + dy! }, false));
  if (hit) { if (Math.abs(hit[0]!) + Math.abs(hit[1]!) > 1) warnings.push(`"${p.name}" at ${P(p.x, p.y)} was snapped to ${P(p.x + hit[0]!, p.y + hit[1]!)}.`); continue; }
  tryStamp(p, true);
}
for (const c of chests) {
  if (!num(c.x) || !num(c.y) || !isWalkFloor(c.x, c.y) || ramps[idx(c.x, c.y)]) { errors.push(`chest ${P(c.x, c.y)} must be on walkable floor (not a stair step).`); continue; }
  if (occupied.has(idx(c.x, c.y))) { errors.push(`chest ${P(c.x, c.y)} sits on "${occupied.get(idx(c.x, c.y))}".`); continue; }
  occupied.set(idx(c.x, c.y), "chest");
}
for (const g of gates) occupied.set(idx(g.x, g.y), "gate");
if (errors.length) done();

// ---- walking (relief-aware) ----
const passTile = (t: number) => { const p = ts.passability[t]; return !!p && Object.values(p).some(Boolean); };
const blocks = (c: number) => { const o = occupied.get(c); return o !== undefined && (o === "chest" || o === "gate" || !!o); };
const walkable = (c: number) => { const x = c % W, y = (c / W) | 0; return isWalkFloor(x, y) && passTile(lower[c]!) && (upper[c]! < 0 || passTile(upper[c]!)) && !blocks(c); };
const floodFrom = (start: number, blockRoom?: Region, openGates = false) => {
  const seen = new Uint8Array(W * H);
  const ok = (c: number) => (walkable(c) || (openGates && occupied.get(c) === "gate")) && !(blockRoom && blockRoom.cells.has(c));
  if (!ok(start)) return seen;
  const q = [start]; seen[start] = 1;
  while (q.length) { const c = q.pop()!; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (!seen[n] && ok(n) && stepOk(c, n)) { seen[n] = 1; q.push(n); } } }
  return seen;
};
const start = stairsFront ? idx(...(stairsFront as [number, number])) : -1;
const seen = start >= 0 ? floodFrom(start, undefined, true) : new Uint8Array(W * H);
if (start >= 0 && !seen[start]) errors.push(`the floor cell in front of "stairs up" ${PC(start)} is blocked.`);
const hazardCut = (r: Region) => [...r.cells].some((c) => liqKind[c] && !bridge[c]);
for (const r of regionList) {
  const cells = [...r.cells].filter(walkable);
  if (!cells.length) { errors.push(`${r.kind} "${r.id}" has no walkable cell left.`); continue; }
  if (!cells.some((c) => seen[c])) errors.push(`${r.kind} "${r.id}" is not reachable on foot from the entrance stairs.${hazardCut(r) ? " Its water/lava/pit cells are not walkable — leave a dry path along a shore or add a bridge." : ""}${[...r.cells].some((c) => levels[c]) ? " It has a raised ledge — a ledge is reached only by its stairs (move up at the stairs' x,y)." : ""} Pieces with a solid base also block.`);
}
const nb4 = (x: number, y: number) => DIR4.map(([dx, dy]) => [x + dx, y + dy] as const);
for (const c of chests) if (!nb4(c.x, c.y).some(([x, y]) => inb(x, y) && seen[idx(x, y)])) errors.push(`chest ${P(c.x, c.y)} cannot be reached (no reachable floor next to it).`);
const ante = roomRegions.find((r) => r.purpose === "antechamber"), boss = roomRegions.find((r) => r.purpose === "boss");
if (ante && boss && start >= 0) {
  const s2 = floodFrom(start, ante, true);
  const leak = [...boss.cells].find((c) => s2[c]);
  if (leak !== undefined) errors.push(`the boss room "${boss.id}" can be reached without passing through the antechamber "${ante.id}" (e.g. at ${PC(leak)}). The only way into the boss room must lead through the antechamber.`);
}
// ---- scatter: the model picks ids, area, density, where (near walls / centre / anywhere), pattern (clusters / even) and whether to
// avoid the main path. Code only executes it with a seed: it ranks free cells, stamps pieces until the asked share of the area's
// floor is covered, and skips any spot that would cut a walking route. Wall-mounted ids go on the wall face above the area.
const pathCells = new Set<number>();
if (start >= 0) {
  const par = new Int32Array(W * H).fill(-2); par[start] = -1; const q = [start];
  for (let k = 0; k < q.length; k += 1) { const c = q[k]!, x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (par[n] === -2 && (walkable(n) || occupied.get(n) === "gate") && stepOk(c, n)) { par[n] = c; q.push(n); } } }
  for (const r of roomRegions) {
    const xs = [...r.cells].map((c) => c % W), ys = [...r.cells].map((c) => (c / W) | 0);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    let best = -1, bd = 1e9; for (const c of r.cells) if (par[c] !== -2) { const d = Math.hypot(c % W - cx, ((c / W) | 0) - cy); if (d < bd) { bd = d; best = c; } }
    for (let c = best; c >= 0; c = par[c]!) { pathCells.add(c); const x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) if (inb(x + dx, y + dy)) pathCells.add(idx(x + dx, y + dy)); }
  }
}
const wallDist = new Int16Array(W * H).fill(99);
{ const q: number[] = []; for (let i = 0; i < W * H; i += 1) if (owner[i]! >= 0 && DIR4.some(([dx, dy]) => !isOpen(i % W + dx, ((i / W) | 0) + dy))) { wallDist[i] = 1; q.push(i); }
  for (let k = 0; k < q.length; k += 1) { const c = q[k]!, x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!isOpen(X, Y)) continue; const n = idx(X, Y); if (wallDist[n]! > wallDist[c]! + 1) { wallDist[n] = wallDist[c]! + 1; q.push(n); } } } }
const noise = (x: number, y: number, seed: number) => { const f = (a: number, b: number) => (seedOf(`${seed}:${a}:${b}`) / 100000) * 2 - 1; const ix = Math.floor(x / 4), iy = Math.floor(y / 4), tx = x / 4 - ix, ty = y / 4 - iy; const l = (a: number, b: number, t: number) => a + (b - a) * t; return l(l(f(ix, iy), f(ix + 1, iy), tx), l(f(ix, iy + 1), f(ix + 1, iy + 1), tx), ty); };
let scattered = 0;
for (const [k, s] of (Array.isArray(L.scatter) ? L.scatter : []).entries()) {
  const tag = `scatter #${k}`;
  const ids: string[] = Array.isArray(s.ids) ? s.ids : s.id ? [s.id] : [];
  if (!ids.length || ids.some((i) => !PIECES[i])) { errors.push(`${tag}: "ids" must list catalog piece ids (unknown: ${ids.filter((i) => !PIECES[i]).join(", ") || "none given"}).`); continue; }
  const area = s.in ? byId.get(s.in)?.cells : rasterShapes(s.shapes, W, H, errors, tag);
  if (!area) { errors.push(`${tag}: "in" must be a room or corridor id (or give shapes).`); continue; }
  const avoidPath = s.avoid !== "none", near = s.near ?? "walls", clusters = (s.pattern ?? "clusters") === "clusters", seed = Number.isInteger(s.seed) ? s.seed : seedOf(`${s.in ?? "shape"}#${k}`);
  const floorN = [...area].filter((c) => walkable(c)).length;
  const density = typeof s.density === "number" ? Math.max(0, Math.min(0.3, s.density)) : undefined;
  const wantCells = density !== undefined ? Math.round(density * floorN) : 0;
  const wantCount = density === undefined ? Math.max(0, Math.min(40, s.count ?? 4)) : Infinity;
  const score = (c: number) => { const x = c % W, y = (c / W) | 0; return (near === "walls" ? wallDist[c]! : near === "center" ? -wallDist[c]! : 0) * 1.0 - (clusters ? noise(x, y, seed) * 3 : 0) + (seedOf(`${seed}/${c}`) % 1000) / 1000 * (clusters ? 0.6 : 3); };
  const cand = [...area].filter((c) => seen[c] && !(avoidPath && pathCells.has(c))).sort((a, b) => score(a) - score(b));
  // wall-mounted ids: candidate wall-face cells directly above the area's top floor cells
  const faceCand = [...area].filter((c) => isOpen(c % W, ((c / W) | 0)) && !isOpen(c % W, ((c / W) | 0) - 1)).map((c) => c - W).sort((a, b) => (seedOf(`${seed}w${a}`) - seedOf(`${seed}w${b}`)));
  let gotCells = 0, got = 0, ci = 0, fi = 0, tries = 0;
  while ((density !== undefined ? gotCells < wantCells : got < wantCount) && tries < 600) {
    tries += 1;
    const name = ids[seedOf(`${seed}:pick:${tries}`) % ids.length]!;
    const def = kits.get(PIECES[name]!)!; const cls = classOf(name, def);
    let x: number, y: number;
    if (cls === "wall") { if (fi >= faceCand.length) { if (ci >= cand.length) break; continue; } const c = faceCand[fi++]!; x = c % W; y = ((c / W) | 0) - def.height + 1; }
    else { if (ci >= cand.length) { if (fi >= faceCand.length) break; continue; } const c = cand[ci++]!; x = c % W; y = ((c / W) | 0) - def.height + 1; }
    const before = stamped.length;
    const snapshot = { lower: lower.slice(), upper: upper.slice(), occ: new Map(occupied) };
    if (!tryStamp({ name, x, y }, false)) continue;
    if (cls !== "decal") {
      const s3 = floodFrom(start, undefined, true); let cut = false;
      for (let i = 0; i < W * H && !cut; i += 1) if (seen[i] && !s3[i] && !occupied.has(i)) cut = true;
      if (cut) { for (let i = 0; i < W * H; i += 1) { lower[i] = snapshot.lower[i]!; upper[i] = snapshot.upper[i]!; } occupied.clear(); for (const [a, b] of snapshot.occ) occupied.set(a, b); stamped.length = before; continue; }
    }
    got += 1; scattered += 1; gotCells += cls === "wall" ? 0 : def.width * def.height;
    if (cls === "wall") gotCells += 1;
  }
  if (density !== undefined ? gotCells < wantCells * 0.7 : got < wantCount) warnings.push(`${tag}: covered ${density !== undefined ? `${gotCells} of ${wantCells} cells` : `${got} of ${wantCount} pieces`} in "${s.in ?? "shape"}" (no more free spots that keep paths open${avoidPath ? " off the main path" : ""}).`);
}
// ---- decor density per room (reported; soft check under 3%) ----
const decorByRoom: Record<string, number> = {};
const sparse: string[] = [];
for (const r of roomRegions) {
  const floorN = [...r.cells].filter((c) => isWalkFloor(c % W, (c / W) | 0)).length || 1;
  let n = 0;
  for (const p of stamped) { if (p.name === "stairs up" || p.cls === "wall") continue; for (let dy = 0; dy < p.h; dy += 1) for (let dx = 0; dx < p.w; dx += 1) if (r.cells.has(idx(p.x + dx, p.y + dy))) n += 1; }
  decorByRoom[r.id] = +(n / floorN).toFixed(3);
  if (n / floorN < 0.03) sparse.push(`${r.id} ${(100 * n / floorN).toFixed(1)}%`);
}
if (sparse.length) warnings.push(`Soft check (not an error): rooms with under 3% of their floor dressed — ${sparse.join(", ")}. A big bare floor reads as unfinished; consider scatter with density 0.05-0.12 near walls, off the main path.`);
let pockets = 0;
const seenFinal = start >= 0 ? floodFrom(start, undefined, true) : seen;
for (let i = 0; i < W * H; i += 1) if (!seenFinal[i] && walkable(i)) pockets += 1;
if (process.env.BBD_DEBUG) { const rows: string[] = []; for (let y = 0; y < H; y += 1) { let r = ""; for (let x = 0; x < W; x += 1) { const i = idx(x, y); r += owner[i]! < 0 ? " " : seenFinal[i] ? (ramps[i] ? "^" : levels[i] ? "1" : ".") : walkable(i) ? "X" : liqKind[i] ? "~" : "o"; } rows.push(r); } console.error(rows.join("\n")); }
{
  const comp = new Uint8Array(W * H); let small = 0;
  for (let i = 0; i < W * H; i += 1) {
    if (seenFinal[i] || comp[i] || !walkable(i)) continue;
    const q = [i]; comp[i] = 1;
    for (let k = 0; k < q.length; k += 1) { const c = q[k]!; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (!comp[n] && !seenFinal[n] && walkable(n) && stepOk(c, n)) { comp[n] = 1; q.push(n); } } }
    if (q.length < 6) { small += q.length; continue; }
    const regs = [...new Set(q.map((c) => regionList[owner[c]!]!.id))].slice(0, 3).join(", ");
    const blockers = [...new Set(q.flatMap((c) => DIR4.map(([dx, dy]) => occupied.get(c + dx + dy * W)).filter((v): v is string => !!v)))].slice(0, 4);
    errors.push(`${q.length} walkable floor cells of ${regs} (e.g. ${PC(q[0]!)}) cannot be reached from the entrance stairs — cut off by ${blockers.length ? `pieces (${blockers.join(", ")}) next to them, ` : ""}water/lava/pit or a ledge without stairs. Open a path.`);
  }
  if (small) warnings.push(`${small} walkable floor cells in tiny pockets cannot be reached (cut off by pieces, hazards or ledges).`);
}
const nonRect = roomRegions.length - plainRects;
const stats = { w: W, h: H, theme: L.theme, rooms: roomRegions.length, corridors: corridors.length, curves: corridors.filter((c) => c.path === "curve").length,
  roughEdges: [...rooms, ...corridors].filter((r) => r.edge === "rough" || r.edge === "crumbled").length, shapeKinds,
  boxRatio: roomRegions.length ? +(plainRects / roomRegions.length).toFixed(2) : 0, nonRectRooms: nonRect,
  rocks: (L.rocks ?? []).length, hazards: (L.hazards ?? []).length, bridges: (L.bridges ?? []).length, ledges: (L.ledges ?? []).length, stairs: flights.length,
  gates: gates.length, pieces: stamped.length, scattered, decorByRoom, sparseRooms: sparse.length, poolPieces: poolCount, poolUsed: stamped.filter((p) => PIECES[p.name]?.startsWith("workshop:pool-")).length, chests: chests.length, pockets, floorCells: [...owner].filter((o) => o >= 0).length };
if (errors.length || !render) done({ stats });

// ---- render ----
const { renderReviewMapPng } = await import("../../qa-game/render.mts");
const { createBuildRun } = await import("../../../src/ai/v2/buildRun");
const { resolveGraphic } = await import("../../../src/editor/tools/eventCompile");
const { upsertEventIntoMap } = await import("../../../src/editor/tools/eventTools");
const id = "bbox-dungeon";
const start0 = project.maps[project.startMapId]!;
project.maps[id] = { ...structuredClone(start0), id, name: L.name ?? "bbox dungeon", width: W, height: H, tilesetId: ts.id, tileSize: ts.tileSize,
  lowerTiles: lower, upperTiles: upper, lowerOverlayTiles: new Array(W * H).fill(-1), upperOverlayTiles: new Array(W * H).fill(-1), events: [], climate: { mode: "indoor" } } as GameMap;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax", "locations"]) delete (project.maps[id] as any)[k];
project.mapTree.children.push({ mapId: id, children: [] });
const m0 = project.maps[id]!;
if (levels.some((v) => v > 0)) {
  // walls / ceiling follow the floor just below them (wall face rows + 1), like reliefPlan step 4
  const WR = L.theme === "cave" ? 2 : 3;
  const lv = levels.slice();
  for (let x = 0; x < W; x += 1) for (let y = 0; y < H; y += 1) {
    const i = idx(x, y); if (owner[i]! >= 0) continue;
    let v = 0; for (let k = 1; k <= WR + 1 && y + k < H; k += 1) { const j = idx(x, y + k); if (owner[j]! >= 0) { v = levels[j]!; break; } }
    lv[i] = v;
  }
  m0.relief = { width: W, height: H, levels: lv, ramps: ramps.slice(), style: dungeonReliefStyle(L.theme) } as never;
  invalidateReliefSlopes(m0.relief as never);
  paintReliefStairTiles(m0, ts);
}
const ctx = { project, currentMapId: id, assistantRun: true } as never as { project: typeof project; currentMapId: string };
const run = createBuildRun(ctx as never);
for (const c of chests) { const r = run.call("place_chest", { mapId: id, x: c.x, y: c.y, contents: { gold: 50 } }) as { ok?: boolean; summary?: string }; if (!r.ok) warnings.push(`chest ${P(c.x, c.y)} not placed: ${String(r.summary).slice(0, 80)}`); }
const bars = resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
const fixedMove = { type: "fixed" } as never;
const m = ctx.project.maps[id]!;
gates.forEach((d, k) => upsertEventIntoMap(m, { id: `ev_gate_${k}`, name: "잠긴 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [], pages: [
  { id: `ev_gate_${k}_p1`, name: "잠긴 문", conditions: [], graphic: bars, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: fixedMove, commands: [] }] } as unknown as GameEvent));
writeFileSync(resolve(outDir, "map.png"), renderReviewMapPng(ctx.project, m, 1).png as Buffer);
writeFileSync(resolve(outDir, "stamped.json"), JSON.stringify(stamped));
writeFileSync(resolve(outDir, "mask.json"), JSON.stringify({ W, H, owner: [...owner], liq: [...liqKind], bridge: [...bridge], levels, ramps, regions: regionList.map((r) => ({ id: r.id, kind: r.kind, purpose: r.purpose })) }));
done({ stats, rendered: true });

// copy of dungeonTools.paintReliefStairTiles (not exported): N/S stair cells drawn with the beodeul stone stair pieces.
function paintReliefStairTiles(map: GameMap, tileset: TilesetDef): void {
  const r = map.relief as { ramps?: number[] } | undefined; if (!r?.ramps) return;
  const kit = (id: string) => (tileset.structureKits ?? []).find((k) => k.id === id);
  const quay = kit("bd-capital-quay-steps-w"), quayE = kit("bd-capital-quay-steps-e") ?? quay, mp = kit("bd-mpart-stairs");
  const tileAt = (k: typeof mp, col: number, row: number) => k?.rows[row]?.tiles?.[col] ?? -1;
  const ns = (c: number) => { const v = r.ramps![c] ?? 0; return v >= 5 && v <= 6; };
  const seen = new Uint8Array(W * H);
  for (let c0 = 0; c0 < W * H; c0 += 1) {
    if (seen[c0] || !ns(c0)) continue;
    const fl = [c0]; seen[c0] = 1;
    for (let h = 0; h < fl.length; h += 1) { const c = fl[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of DIR4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = Y * W + X; if (!seen[n] && ns(n)) { seen[n] = 1; fl.push(n); } } }
    const xs = fl.map((c) => c % W), ys = fl.map((c) => Math.floor(c / W));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys);
    for (const c of fl) {
      const x = c % W, y = Math.floor(c / W), row = (y1 - y) % 2 === 0 ? 1 : 0;
      const t = x1 - x0 <= 1 ? tileAt(x === x0 ? quay : quayE, 0, 0) : tileAt(mp, x === x0 ? 1 : x === x1 ? 3 : 2, row);
      if (t < 0) continue;
      map.lowerTiles[c] = t; map.upperTiles[c] = -1;
    }
  }
}
