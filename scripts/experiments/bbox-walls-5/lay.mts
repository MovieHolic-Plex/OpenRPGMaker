// bbox-walls test: walls are first-class layout primitives. The model writes the outer wall ring, partition wall paths,
// doors on walls, rooms (labels), wall_items bound to a wall, floor objects. This code only rasterizes and validates
// (English messages for the Rejected/Fixed loop) and lays the result exactly on atlas_biome_interior v5.
//   bun scripts/experiments/bbox-walls/lay.mts <layout.json> <out dir> <base dir> [--render]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { analyseHandInteriorPlan, buildHandInteriorLayers, floorLayX, HandInteriorError, HAND_INTERIOR_SPEC as S, HAND_INTERIOR_TILESET_ID, type HandInteriorInput } from "../../../src/editor/handInterior/builder";

const [lf, outDir, baseDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
const ai = process.argv.indexOf("--task"); const TASK = ai > 0 ? process.argv[ai + 1]! : "";
mkdirSync(outDir!, { recursive: true });
const L = JSON.parse(readFileSync(lf!, "utf8"));
// ---- base project + object pool baked into the experiment chipset (local only; never bundled or published) ----
const { loadHeadlessProject } = await import("../../../src/headless/index");
const base = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const POOL: any[] = existsSync(resolve(baseDir!, "..", "pool.json")) ? JSON.parse(readFileSync(resolve(baseDir!, "..", "pool.json"), "utf8")) : [];
const poolIds = new Set<string>();
{
  const { bakeWorkshopObject, workshopAssetId } = await import("../../../src/project/workshopTiles");
  const { PNG } = await import("pngjs");
  const T = 16;
  for (const p of POOL) {
    if ((S.objects as any)[p.id]) continue;
    const png = PNG.sync.read(readFileSync(p.png));
    const cols = Math.round(png.width / T), rows = Math.round(png.height / T);
    const cells: { sourceTile: number; dx: number; dy: number }[] = []; const tiles: Buffer[] = [];
    for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < cols; dx++) {
      const b = Buffer.alloc(T * T * 4); let any = false;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const sI = ((dy * T + y) * png.width + dx * T + x) * 4; png.data.copy(b, (y * T + x) * 4, sI, sI + 4); if (png.data[sI + 3]! > 0) any = true; }
      if (any) { cells.push({ sourceTile: tiles.length, dx, dy }); tiles.push(b); }
    }
    if (!cells.length) continue;
    const sheet = new PNG({ width: 30 * T, height: Math.ceil(tiles.length / 30) * T });
    tiles.forEach((b, i) => { const ox = (i % 30) * T, oy = Math.floor(i / 30) * T; for (let y = 0; y < T; y++) b.copy(sheet.data, ((oy + y) * sheet.width + ox) * 4, y * T * 4, (y + 1) * T * 4); });
    const dataUrl = `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`;
    const kit = bakeWorkshopObject(base as any, HAND_INTERIOR_TILESET_ID, { objectId: `workshop:pool-${p.id}`, title: p.name, description: p.brief ?? "", kind: p.kind,
      columns: cols, rows, footRows: p.kind === "floor" || p.kind === "wall" ? Math.max(1, p.h) : 0, risePx: p.up * T, use: [], gridHash: `pool-${p.id}-${cells.length}`,
      asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height }, cells, provenance: { aiGenerated: true, tool: "objpool (bbox-walls-2, local only)" } as any });
    const top = p.kind === "floor" || p.kind === "wall" ? rows - Math.max(1, p.h) : 0;
    const spec: any = { ko: p.name, category: p.category, kind: p.kind, w: p.w, h: p.kind === "hang" ? 0 : Math.max(1, p.h), up: p.up * T, use: ["block"], desc: p.brief ?? "", tags: [], place: "", pair: [], cells: [] };
    (kit.rows as any[]).forEach((row: any, dy: number) => row.upperTiles.forEach((tile: number, dx: number) => { if (tile >= 0) spec.cells.push([dx, dy - top, tile, p.kind === "flat" ? 2 : 3]); }));
    (S.objects as any)[p.id] = spec; poolIds.add(p.id);
  }
}
const errors: string[] = [], warnings: string[] = [], notes: string[] = [];
const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const W: number = L.map?.w, H: number = L.map?.h;
let extra: Record<string, unknown> = {};
const done = () => { const r = { ok: errors.length === 0, errors, warnings, notes, ...extra }; writeFileSync(resolve(outDir!, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
if (!num(W) || !num(H) || W < 8 || H < 8 || W > 60 || H > 60) { errors.push(`map.w/map.h must be integers 8..60 (got ${W}x${H}).`); done(); }
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const idx = (x: number, y: number) => y * W + x;
const P = (x: number, y: number) => `(${x},${y})`;

// ---- walls: rasterize paths ----
type Wall = { id: string; material: string; outer: boolean; thickness: number; stub: boolean; cells: number[]; ends: [number, number][]; horiz: Set<number>; vert: Set<number> };
const wallOf = new Int32Array(W * H).fill(-1);
const walls: Wall[] = [];
function raster(id: string, path: any, thickness: number, outer: boolean): Omit<Wall, "id" | "material" | "outer" | "stub"> | undefined {
  if (!Array.isArray(path) || path.length < 2 || !path.every((p: any) => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]))) { errors.push(`wall "${id}": path must be a list of at least 2 [x,y] integer points.`); return; }
  const pts: [number, number][] = path.map((p: any) => [p[0], p[1]]);
  if (outer) {
    const a = pts[0]!, b = pts[pts.length - 1]!;
    if (a[0] !== b[0] || a[1] !== b[1]) { if (a[0] === b[0] || a[1] === b[1]) pts.push([a[0], a[1]]); else { errors.push(`outer wall path is not closed: last point ${P(...b)} must return to the first point ${P(...a)} with straight segments.`); return; } }
  }
  const cells: number[] = [], horiz = new Set<number>(), vert = new Set<number>();
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k]!, [x1, y1] = pts[k + 1]!;
    if (x0 !== x1 && y0 !== y1) { errors.push(`wall "${id}": segment ${P(x0, y0)}->${P(x1, y1)} is diagonal — every segment must be horizontal or vertical.`); return; }
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    for (let s = 0; s <= n; s++) for (let t = 0; t < thickness; t++) {
      const x = x0 + s * sx + (sy !== 0 ? t : 0), y = y0 + s * sy + (sx !== 0 ? t : 0);
      if (!inMap(x, y)) { errors.push(`wall "${id}" cell ${P(x, y)} is outside the ${W}x${H} map.`); return; }
      cells.push(idx(x, y)); (sx !== 0 ? horiz : vert).add(idx(x, y));
    }
  }
  return { thickness, cells, ends: outer ? [] : [pts[0]!, pts[pts.length - 1]!], horiz, vert };
}
// shell: the building is ONE mass = a union of rectangles (outer wall included); its outer wall is the rim of that union
const shellCells = new Uint8Array(W * H);
let ow: any = L.outer_wall;
if (L.shell) {
  const parts = Array.isArray(L.shell.parts) ? L.shell.parts : [];
  if (!parts.length) { errors.push(`shell.parts must be a list of [x, y, w, h] rectangles whose union is the building (outer wall included).`); done(); }
  for (const p of parts) {
    if (!Array.isArray(p) || p.length !== 4 || !p.every(num) || p[2] < 3 || p[3] < 3) { errors.push(`shell part ${JSON.stringify(p)}: must be [x, y, w, h] integers, at least 3x3.`); continue; }
    if (p[0] < 0 || p[1] < 0 || p[0] + p[2] > W || p[1] + p[3] > H) { errors.push(`shell part [${p.join(",")}] goes outside the ${W}x${H} map.`); continue; }
    for (let y = p[1]; y < p[1] + p[3]; y++) for (let x = p[0]; x < p[0] + p[2]; x++) shellCells[idx(x, y)] = 1;
  }
  if (errors.length) done();
  // one mass: the union must be 4-connected
  { const all = [...shellCells.keys()].filter((i) => shellCells[i]); const seen = new Uint8Array(W * H); const q = [all[0]!]; seen[all[0]!] = 1; let n = 0;
    while (q.length) { const i = q.pop()!; n++; const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (inMap(X, Y) && shellCells[idx(X, Y)] && !seen[idx(X, Y)]) { seen[idx(X, Y)] = 1; q.push(idx(X, Y)); } } }
    if (n !== all.length) errors.push(`shell parts do not form one connected building (${all.length - n} cells are cut off) — real buildings are one mass: make the parts overlap or touch along a side.`); }
  ow = { material: L.shell.material ?? L.outer_wall?.material };
  const cells: number[] = [], horiz = new Set<number>(), vert = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (shellCells[idx(x, y)]) {
    const out = (X: number, Y: number) => !inMap(X, Y) || !shellCells[idx(X, Y)];
    let rim = false; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (out(x + a, y + b)) rim = true;
    if (rim) { cells.push(idx(x, y)); (out(x, y - 1) || out(x, y + 1) ? horiz : vert).add(idx(x, y)); }
  }
  if (!S.walls[ow.material]) errors.push(`shell: unknown wall material "${ow.material}" — use a catalog wall id.`);
  walls.push({ id: "outer", material: ow.material, outer: true, stub: false, thickness: 1, cells, ends: [], horiz, vert });
} else {
  if (!ow) { errors.push("shell is missing."); done(); }
  if (!S.walls[ow.material]) errors.push(`outer_wall: unknown wall material "${ow.material}" — use a catalog wall id.`);
  const r0 = raster("outer", ow.path, 1, true);
  if (r0) walls.push({ id: "outer", material: ow.material, outer: true, stub: false, ...r0 });
}
for (const w of Array.isArray(L.walls) ? L.walls : []) {
  const id = String(w.id ?? `wall${walls.length}`);
  if (id === "outer" || walls.some((x) => x.id === id)) { errors.push(`wall id "${id}" is used twice.`); continue; }
  if (!S.walls[w.material]) errors.push(`wall "${id}": unknown wall material "${w.material}" — use a catalog wall id.`);
  const t = w.thickness ?? 1;
  if (t !== 1 && t !== 2) { errors.push(`wall "${id}": thickness must be 1 or 2.`); continue; }
  const r = raster(id, w.path, t, false);
  if (r) walls.push({ id, material: w.material, outer: false, stub: Boolean(w.stub), ...r });
}
if (errors.length) done();
walls.forEach((w, k) => { for (const i of w.cells) if (wallOf[i] < 0 || w.outer) wallOf[i] = k; });
const wallByName = new Map(walls.map((w, k) => [w.id, k]));
// outside = flood from the map edge through non-wall cells
const outside = new Uint8Array(W * H);
{ const q: number[] = [];
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (wallOf[idx(x, y)] < 0 && !outside[idx(x, y)]) { outside[idx(x, y)] = 1; q.push(idx(x, y)); }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (wallOf[idx(x, y)] < 0 && !outside[idx(x, y)]) { outside[idx(x, y)] = 1; q.push(idx(x, y)); }
  while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (inMap(X, Y) && wallOf[idx(X, Y)] < 0 && !outside[idx(X, Y)]) { outside[idx(X, Y)] = 1; q.push(idx(X, Y)); } } } }
// the outer ring must enclose: no outside cell may be 4-adjacent to a cell enclosed by the ring... (enclosed = not outside, not wall)
let interiorN = 0; for (let i = 0; i < W * H; i++) if (!outside[i] && wallOf[i] < 0) interiorN++;
if (!interiorN) { errors.push("outer wall encloses no interior cells — the ring must surround the building (its inside must be at least 1 cell from the ring on every side)."); done(); }
for (const w of walls) if (!w.outer) {
  const bad = w.cells.filter((i) => { const x = i % W, y = (i - x) / W; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMap(x + dx!, y + dy!) && outside[idx(x + dx!, y + dy!)]); });
  const self = new Set(w.cells);
  const onOuter = w.cells.filter((i) => walls[wallOf[i]!]!.outer);
  if (bad.length) errors.push(`wall "${w.id}" runs outside the outer wall near ${P(bad[0]! % W, Math.floor(bad[0]! / W))} — partitions must stay inside the outer ring.`);
  if (onOuter.length > 2) warnings.push(`wall "${w.id}" lies on the outer wall for ${onOuter.length} cells — partitions should only touch the outer wall at their ends.`);
  if (!w.stub) for (const [ex, ey] of w.ends) {
    const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = ex + dx!, Y = ey + dy!; return inMap(X, Y) && wallOf[idx(X, Y)]! >= 0 && !self.has(idx(X, Y)); }) || walls[wallOf[idx(ex, ey)]!]!.id !== w.id;
    if (!touch) errors.push(`wall "${w.id}" end ${P(ex, ey)} does not touch another wall — a partition must run from wall to wall so rooms are closed (extend the path by one cell until it meets the other wall), or mark it "stub": true for a freestanding wall piece.`);
  }
}
const grid: string[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (outside[idx(x, y)] || wallOf[idx(x, y)]! >= 0 ? "#" : ".")));

// ---- doors ----
type Door = { wall: string; cells: number[]; piece?: string; x: number; y: number; vertical: boolean };
const doors: Door[] = [];
const doorCell = new Set<number>();
for (const d of Array.isArray(L.doors) ? L.doors : []) {
  const k = wallByName.get(d.wall);
  if (k === undefined) { errors.push(`door ${P(d.x, d.y)}: unknown wall "${d.wall}".`); continue; }
  if (!num(d.x) || !num(d.y)) { errors.push(`door on "${d.wall}": x,y must be integers.`); continue; }
  const w = walls[k]!;
  if (w.outer) { errors.push(`door ${P(d.x, d.y)} is on the outer wall — the only opening in the outer wall is the "entrance" (bottom map row). Interior doors go on partition walls.`); continue; }
  const i0 = idx(d.x, d.y);
  if (!inMap(d.x, d.y) || !w.cells.includes(i0)) { errors.push(`door ${P(d.x, d.y)} is not on wall "${w.id}" — x,y must be a cell of that wall's path.`); continue; }
  const vertical = w.vert.has(i0) && !w.horiz.has(i0);
  const cells: number[] = [];
  if (!vertical) {
    const width = d.width ?? 1;
    for (let s = 0; s < width; s++) for (let t = 0; t < w.thickness; t++) cells.push(idx(d.x + s, d.y + t));
  } else {
    for (let t = 0; t < w.thickness; t++) for (const dy of [0, -1, -2]) cells.push(idx(d.x + t, d.y + dy));
  }
  const off = cells.filter((i) => !w.cells.includes(i));
  if (off.length) { errors.push(vertical
    ? `door ${P(d.x, d.y)} in vertical wall "${w.id}": a vertical-wall opening is 3 cells tall — (x,y) is the walkable bottom cell, and (x,y-1),(x,y-2) above it (they become wall face) must also be cells of "${w.id}"; ${off.map((i) => P(i % W, Math.floor(i / W))).join(" ")} are not. Move the door down or lengthen the wall.`
    : `door ${P(d.x, d.y)} width ${d.width ?? 1} runs off wall "${w.id}" at ${off.map((i) => P(i % W, Math.floor(i / W))).join(" ")}.`); continue; }
  // the door must join two interior cells
  const [a, b] = vertical ? [[d.x - 1, d.y], [d.x + w.thickness, d.y]] : [[d.x, d.y - 1], [d.x, d.y + w.thickness]];
  const open = (p: number[]) => inMap(p[0]!, p[1]!) && grid[p[1]!]![p[0]!] === ".";
  if (!open(a!) || !open(b!)) { errors.push(`door ${P(d.x, d.y)} on "${w.id}" does not join two rooms: ${P(a![0]!, a![1]!)} and ${P(b![0]!, b![1]!)} must both be room cells (not wall).`); continue; }
  if (d.piece !== undefined && d.piece !== null && !["locked door", "iron gate", "iron gate open"].includes(d.piece)) errors.push(`door ${P(d.x, d.y)}: piece "${d.piece}" — a door piece must be one of locked door, iron gate, iron gate open (or omit it for an open doorway).`);
  for (const i of cells) doorCell.add(i);
  if (vertical && d.piece) { errors.push(`door ${P(d.x, d.y)} in vertical wall "${w.id}": a "${d.piece}" leaf is drawn facing south, so it only fits a doorway in a horizontal wall — in a side wall it shows as a stray tile and blocks the way. Leave this doorway open (piece null), or move the door to a horizontal wall.`); d.piece = null; }
  doors.push({ wall: w.id, cells, piece: d.piece ?? undefined, x: d.x, y: d.y, vertical });
}
// entrance
const ent = L.entrance;
if (!ent || !num(ent.x) || !num(ent.y)) errors.push("entrance {x,y} is missing.");
else if (ent.y !== H - 1) errors.push(`entrance ${P(ent.x, ent.y)} must be on the bottom map row y=${H - 1}, in the outer wall (so the outer wall's south side must run along y=${H - 1} there).`);
else if (!inMap(ent.x, ent.y) || wallOf[idx(ent.x, ent.y)] < 0 || !walls[wallOf[idx(ent.x, ent.y)]!]!.outer) errors.push(`entrance ${P(ent.x, ent.y)} must be a cell of the outer wall on the bottom map row.`);
else if (grid[ent.y - 1]![ent.x] !== ".") errors.push(`entrance ${P(ent.x, ent.y)} must have a room cell directly above it ${P(ent.x, ent.y - 1)}.`);
if (errors.some((e) => e.startsWith("entrance"))) done();

// ---- rooms = enclosed spaces (doors closed) ----
const comp = new Int32Array(W * H).fill(-1); const comps: number[][] = [];
for (let i = 0; i < W * H; i++) if (grid[Math.floor(i / W)]![i % W] === "." && comp[i] < 0) {
  const c = comps.length, q = [i], cells: number[] = []; comp[i] = c;
  while (q.length) { const j = q.pop()!; cells.push(j); const x = j % W, y = (j - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (inMap(X, Y) && grid[Y]![X] === "." && comp[idx(X, Y)] < 0) { comp[idx(X, Y)] = c; q.push(idx(X, Y)); } } }
  comps.push(cells);
}
const rooms: any[] = Array.isArray(L.rooms) ? L.rooms : [];
const roomOfComp = new Map<number, any>();
for (const r of rooms) {
  const at = r.at;
  if (!Array.isArray(at) || !num(at[0]) || !num(at[1]) || !inMap(at[0], at[1])) { errors.push(`room "${r.id}": "at" must be an [x,y] cell inside the room.`); continue; }
  if (!S.floors[r.floor]) errors.push(`room "${r.id}": unknown floor "${r.floor}" — use a catalog floor id.`);
  const c = comp[idx(at[0], at[1])]!;
  if (c < 0) { errors.push(`room "${r.id}" label ${P(at[0], at[1])} is on a wall or outside the outer wall — put "at" on a cell inside the room.`); continue; }
  const prev = roomOfComp.get(c);
  if (prev) {
    const xs = comps[c]!.map((i) => i % W), ys = comps[c]!.map((i) => Math.floor(i / W));
    errors.push(`rooms "${prev.id}" and "${r.id}" are one connected space (cells ${P(Math.min(...xs), Math.min(...ys))}..${P(Math.max(...xs), Math.max(...ys))}) — the wall between them is not closed. Walls must run wall to wall; only a door may make a gap.`);
    continue;
  }
  roomOfComp.set(c, r);
}
comps.forEach((cells, c) => {
  if (roomOfComp.has(c)) return;
  const xs = cells.map((i) => i % W), ys = cells.map((i) => Math.floor(i / W));
  errors.push(`enclosed space ${P(Math.min(...xs), Math.min(...ys))}..${P(Math.max(...xs), Math.max(...ys))} (${cells.length} cells) has no room label — add it to "rooms" or close it off with wall (no leftover pockets between walls).`);
});
// face rows: every room's north side shows 2 rows of wall face; a room must keep floor below its face
for (const [c, r] of roomOfComp) {
  const floorN = comps[c]!.filter((i) => { const x = i % W, y = (i - x) / W; return !(y >= 1 && grid[y - 1]![x] === "#") && !(y >= 2 && grid[y - 2]![x] === "#"); }).length;
  if (floorN < 4) errors.push(`room "${r.id}" has only ${floorN} floor cells — the two rows under every north wall are wall face (not floor), so make the room taller.`);
}
if (!roomOfComp.size) done();

// ---- door cells carved, entrance carved ----
for (const i of doorCell) grid[Math.floor(i / W)]![i % W] = ".";
grid[ent.y]![ent.x] = ".";
const plan = grid.map((r) => r.join(""));
const A = analyseHandInteriorPlan(plan);
// wall cell above a face cell
const wallAbove = (x: number, y: number): number => { for (let k = 1; k <= 2; k++) { const Y = y - k; if (Y < 0) return -1; if (grid[Y]![x] === "#") return wallOf[idx(x, Y)]!; } return -1; };

// ---- placements ----
type Pl = { id: string; x: number; y: number; wall?: string };
const expand = (o: any): Pl[] => { const n = o.repeat?.count ?? 1, dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0;
  return Array.from({ length: Math.max(1, n) }, (_, i) => ({ id: o.id, x: o.x + i * dx, y: o.y + i * dy, wall: o.wall })); };
const objs: Pl[] = [];
const misplacedStairs: { id: string; x: number; y: number }[] = [];
const stairItems: { id: string; x: number; y: number; k: number; o: any }[] = [];
const late: string[] = [];   // errors that do not stop the layout from being built and measured
const sizedRe = /^([a-z]+) (\d+)x(\d+)$/u;
const daisRe = /^(dais(?:-w)?) (\d+)x(\d+) ([a-z]+)$/u;   // raised platform, any size: "dais 5x3 wood" (walkable; pieces may stand on it)
const isDais = (id: string) => { const m = daisRe.exec(id); return !!(m && (S as any).daises?.[`${m[1]} ${m[4]}`]); };
const fp = (id: string) => { const d = S.objects[id]; const m = daisRe.exec(id); if (!d && m) return { w: Number(m[2]), h: Number(m[3]) };
  const s = sizedRe.exec(id); return d ? { w: d.w, h: Math.max(1, d.h) } : { w: Number(s?.[2] ?? 1), h: Number(s?.[3] ?? 1) }; };
const flatId = (id: string) => { const d = S.objects[id]; return isDais(id) || !!(d && (d.kind === "hang" || d.kind === "flat")); };
const WINDOWS = new Set(["window", "curtained window", "boarded window", "tall stained window", "round window", "stained glass"]);
for (const o of Array.isArray(L.objects) ? L.objects : []) {
  if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) { errors.push(`object ${JSON.stringify(o).slice(0, 80)}: needs id and integer x, y.`); continue; }
  const d = S.objects[o.id], s = sizedRe.exec(o.id);
  if (!d && daisRe.test(o.id)) { if (!isDais(o.id)) { errors.push(`unknown platform "${o.id}" — use "dais WxH wood|marble|stone" (or "dais-w WxH marble|stone").`); continue; } objs.push(...expand(o)); continue; }
  if (!d && !(s && S.tables[s[1]!] && !S.objects[o.id])) { if (!(s && S.tables[s[1]!])) { errors.push(`unknown catalog id "${o.id}" at ${P(o.x, o.y)}.`); continue; } }
  if (d && d.kind === "wall" && d.stairs === "up") { misplacedStairs.push({ id: o.id, x: o.x, y: o.y }); continue; }
  if (d && (d.kind === "hang" || d.kind === "wall")) { errors.push(`"${o.id}" at ${P(o.x, o.y)} is a wall piece — move it to "wall_items" with the "wall" it belongs to.`); continue; }
  if (["locked door", "iron gate", "iron gate open"].includes(o.id)) {
    // gate pieces in objects are allowed only in a bars gap (jail); door pieces in walls go on the door
    const onDoor = doors.some((dd) => dd.cells.includes(idx(o.x, o.y)));
    if (onDoor) { errors.push(`"${o.id}" at ${P(o.x, o.y)} sits in a wall door — give it as "piece" on that door instead.`); continue; }
  }
  objs.push(...expand(o));
}
for (const o of Array.isArray(L.wall_items) ? L.wall_items : []) {
  if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) { errors.push(`wall_item ${JSON.stringify(o).slice(0, 80)}: needs id, wall and integer x, y.`); continue; }
  const d = S.objects[o.id];
  if (!d) { errors.push(`unknown catalog id "${o.id}" at ${P(o.x, o.y)}.`); continue; }
  if (d.kind !== "hang" && d.kind !== "wall") { errors.push(`"${o.id}" is not a wall piece — put it in "objects".`); continue; }
  const k = wallByName.get(o.wall);
  if (k === undefined) { errors.push(`wall_item "${o.id}" at ${P(o.x, o.y)}: unknown wall "${o.wall}" — name the wall it hangs on / stands against.`); continue; }
  if (d.stairs === "up") stairItems.push({ id: o.id, x: o.x, y: o.y, k, o });
  if (WINDOWS.has(o.id) && !walls[k]!.outer) errors.push(`"${o.id}" at ${P(o.x, o.y)} is a window on interior wall "${o.wall}" — windows go on the outer wall only.`);
  for (const p of expand(o)) {
    const cols = Array.from({ length: Math.max(1, d.w) }, (_, i) => p.x + i);
    const hang = d.kind === "hang";
    const bad = cols.filter((x) => hang ? !(A.face[p.y]?.[x] === 1 && wallOf[idx(x, p.y - 1)] === k) : !(A.face[p.y - 1]?.[x] === 2 && wallOf[idx(x, p.y - 3)] === k));
    if (bad.length) {
      // where is the face of that wall in this column?
      const x0 = bad[0]!; let hint = "";
      for (let y = 0; y < H; y++) if (wallOf[idx(x0, y)] === k && A.face[y + 1]?.[x0] === 1) { hint = ` — the face of "${o.wall}" in column ${x0} starts at y=${y + 1}, so ${hang ? `hang it at y=${y + 1}` : `stand it at y=${y + 3}`}`; break; }
      if (!hint) hint = ` — "${o.wall}" has no visible face in column ${x0} (only the south side of a horizontal wall shows a face; vertical walls and the south outer wall show no face, so nothing can hang on them)`;
      errors.push(`"${o.id}" at ${P(p.x, p.y)} does not touch the face of wall "${o.wall}" at column(s) ${bad.join(",")}: ${hang ? "a wall-mounted piece goes on the UPPER face row (the row right below the wall cap)" : "an against-wall piece stands on the first floor row right below the 2-row face"}${hint}.`);
    }
    objs.push(p);
  }
}
for (const d of doors) if (d.piece) {
  // the leaf sits on the walkable cell of the doorway
  const x = d.x, y = d.vertical ? d.y : d.y;
  objs.push({ id: d.piece, x, y });
}
const lines: { id: string; cells?: { x: number; y: number }[]; rect?: { x0: number; y0: number; x1: number; y1: number } }[] = [];
for (const c of Array.isArray(L.carpets) ? L.carpets : []) {
  if (!S.lines[c.id] || S.lines[c.id]!.kind !== "flat") { errors.push(`unknown carpet id "${c.id}".`); continue; }
  if (![c.x, c.y, c.w, c.h].every(num)) { errors.push(`carpet ${c.id}: x,y,w,h must be integers.`); continue; }
  lines.push({ id: c.id, rect: { x0: c.x, y0: c.y, x1: c.x + c.w - 1, y1: c.y + c.h - 1 } });
}
const railCells = new Set<number>();
for (const r of Array.isArray(L.rails) ? L.rails : []) {
  if (!S.lines[r.id] || S.lines[r.id]!.kind !== "floor") { errors.push(`unknown rail id "${r.id}".`); continue; }
  const pts = Array.isArray(r.path) ? r.path : [];
  const cells: { x: number; y: number }[] = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
    if (x0 !== x1 && y0 !== y1) { errors.push(`rail ${r.id}: segment ${P(x0, y0)}->${P(x1, y1)} is diagonal.`); break; }
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) cells.push({ x: x0 + s * Math.sign(x1 - x0), y: y0 + s * Math.sign(y1 - y0) });
  }
  for (const c of cells) { if (!A.isFloor(c.x, c.y)) errors.push(`rail ${r.id} cell ${P(c.x, c.y)} is not floor.`); railCells.add(idx(c.x, c.y)); }
  lines.push({ id: r.id, cells });
}
for (const p of objs) { const { w, h } = fp(p.id); if (p.x < 0 || p.y < 0 || p.x + w > W || p.y + h > H) errors.push(`"${p.id}" at ${P(p.x, p.y)} (${w}x${h}) is out of the map.`); }
// ---- stairs: exact kit footprint (3x3 = 2 face rows + 1 floor row) and a free entry side, English with a Fixed call ----
const occ = new Map<number, string>();
for (const p of objs) { const d = S.objects[p.id]; if (flatId(p.id)) continue; if (d?.stairs) continue;
  const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) occ.set(idx(p.x + dx, p.y + dy), `"${p.id}"@${P(p.x, p.y)}`); }
for (const i of railCells) occ.set(i, "a rail");
const stairWhy = (id: string, x: number, y: number, k: number): string | null => {
  const d = S.objects[id]!; const cols = Array.from({ length: d.w }, (_, i) => x + i);
  const badCol = cols.filter((c) => !(A.face[y - 2]?.[c] === 1 && A.face[y - 1]?.[c] === 2 && wallOf[idx(c, y - 3)] === k && A.isFloor(c, y)));
  if (badCol.length) return `its ${d.w}x3 kit does not fit: columns ${badCol.join(",")} are not [2 face rows of wall "${walls[k]?.id}" at rows ${y - 2},${y - 1}] + [floor at row ${y}] (the wall must run straight over all ${d.w} columns, with no door or corner in them)`;
  const ent = cols.map((c) => [c, y + 1] as const);
  const blocked = ent.filter(([c, r]) => !A.isFloor(c, r) || occ.has(idx(c, r)) || doorCell.has(idx(c, r)));
  if (blocked.length) return `its entry side (south) is blocked: ${blocked.map(([c, r]) => P(c, r) + (occ.has(idx(c, r)) ? " by " + occ.get(idx(c, r)) : doorCell.has(idx(c, r)) ? " (a doorway)" : " (not floor)")).join(", ")} — the ${d.w} cells ${P(x, y + 1)}..${P(x + d.w - 1, y + 1)} must stay free walkable floor`;
  return null;
};
const stairSpots = (id: string, k?: number): { x: number; y: number; k: number }[] => {
  const out: { x: number; y: number; k: number }[] = [];
  for (let y = 3; y < H - 1; y++) for (let x = 0; x < W; x++) { const kk = wallOf[idx(x, y - 3)]!; if (kk < 0 || (k !== undefined && kk !== k)) continue; if (!stairWhy(id, x, y, kk)) out.push({ x, y, k: kk }); }
  return out;
};
const fixed = (id: string, x: number, y: number, k?: number): string => {
  let c = k !== undefined ? stairSpots(id, k) : []; if (!c.length) c = stairSpots(id);
  if (!c.length) return ` No wall in this layout has a free straight ${S.objects[id]!.w}-cell north face with free floor in front: lengthen a room northward or clear a stretch of a north wall.`;
  c.sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - Math.abs(b.x - x) - Math.abs(b.y - y));
  const f = c[0]!; return ` Fixed call: {"id": "${id}", "wall": "${walls[f.k]!.id}", "x": ${f.x}, "y": ${f.y}} (kit covers ${P(f.x, f.y - 2)}..${P(f.x + 2, f.y)}, entry ${P(f.x, f.y + 1)}..${P(f.x + 2, f.y + 1)}).`;
};
const stairStats = { placed: 0, ok: 0 };
for (const m of misplacedStairs) { stairStats.placed++; late.push(`"${m.id}" at ${P(m.x, m.y)} is in "objects" — stairs up is a 3x3 kit that climbs a north wall, so it goes in "wall_items" with that wall.${fixed(m.id, m.x, m.y)}`); }
for (const st of stairItems) {
  stairStats.placed++;
  const d = S.objects[st.id]!; const decl = st.o.footprint ?? (st.o.w !== undefined || st.o.h !== undefined ? `${st.o.w}x${st.o.h}` : undefined);
  if (decl !== undefined && String(decl).replace(/\s/g, "") !== `${d.w}x3`) { late.push(`"${st.id}" at ${P(st.x, st.y)}: you gave footprint ${decl}, but this stair is a ${d.w}x3 kit (${d.w} wide; 2 face rows + 1 floor row).${fixed(st.id, st.x, st.y, st.k)}`); continue; }
  const why = stairWhy(st.id, st.x, st.y, st.k);
  if (why) { late.push(`"${st.id}" at ${P(st.x, st.y)} on wall "${walls[st.k]!.id}": ${why}.${fixed(st.id, st.x, st.y, st.k)}`); continue; }
  stairStats.ok++;
}
for (const p of objs) { const d = S.objects[p.id]; if (d?.stairs === "down") { stairStats.placed++;
  const bad = Array.from({ length: d.w }, (_, i) => [p.x + i, p.y + Math.max(1, d.h)] as const).filter(([c, r]) => !A.isFloor(c, r) || occ.has(idx(c, r)));
  if (bad.length) late.push(`"${p.id}" at ${P(p.x, p.y)} is a ${d.w}x${d.h} kit entered from the south: ${bad.map(([c, r]) => P(c, r)).join(" ")} must stay free walkable floor.`); else stairStats.ok++; } }
const NEED_STAIRS = TASK === "inn" || TASK === "manor";
const stairUpId = TASK === "manor" ? "stairs up stone" : "stairs up wood";
if (NEED_STAIRS && !stairItems.length && !misplacedStairs.length) late.push(`The request needs a staircase up and the layout has none.${fixed(stairUpId, Math.floor(W / 2), H - 2)}`);
if (errors.length) { errors.push(...late); done(); }

// ---- zones: room floors, face material = the wall above ----
const zones: { x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string }[] = [];
const roomAt = new Int32Array(W * H).fill(-1);
const roomList = [...roomOfComp.entries()];
roomList.forEach(([c], k) => { for (const i of comps[c]!) roomAt[i] = k; });
for (const d of doors) for (const i of d.cells) { // door cells take the floor of the room they open into (south / east side)
  const x = i % W, y = (i - x) / W; const nb = d.vertical ? idx(x + 1, y) : idx(x, y + 1); roomAt[i] = roomAt[nb] >= 0 ? roomAt[nb] : roomAt[d.vertical ? idx(x - 1, y) : idx(x, y - 1)]!; }
roomAt[idx(ent.x, ent.y)] = roomAt[idx(ent.x, ent.y - 1)]!;
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const k = roomAt[idx(x, y)]!; let x1 = x; while (x1 + 1 < W && roomAt[idx(x1 + 1, y)] === k) x1++; if (k >= 0) zones.push({ x0: x, y0: y, x1, y1: y, floor: roomList[k]![1].floor }); x = x1 + 1; } }
const zoneList: { room: string; k: number; serves: string; x: number; y: number; w: number; h: number; floor?: string }[] = [];
for (const z of Array.isArray(L.zones) ? L.zones : []) {
  const k = roomList.findIndex(([, r]) => r.id === z.room); const rc = z.rect;
  if (k < 0) { late.push(`zone "${z.serves}": unknown room "${z.room}" — a zone lies inside one room; give that room's id.`); continue; }
  if (!Array.isArray(rc) || rc.length !== 4 || !rc.every(num) || rc[2] < 2 || rc[3] < 2) { late.push(`zone "${z.serves}" in room "${z.room}": "rect" must be [x, y, w, h] integers, at least 2x2.`); continue; }
  if (z.floor !== undefined && !S.floors[z.floor]) { late.push(`zone "${z.serves}": unknown floor "${z.floor}".`); continue; }
  const outside = []; for (let y = rc[1]; y < rc[1] + rc[3]; y++) for (let x = rc[0]; x < rc[0] + rc[2]; x++) if (!inMap(x, y) || roomAt[idx(x, y)] !== k) outside.push(P(x, y));
  if (outside.length) { late.push(`zone "${z.serves}" rect [${rc.join(",")}] is not inside room "${z.room}" (e.g. ${outside.slice(0, 3).join(" ")}).`); continue; }
  zoneList.push({ room: z.room, k, serves: String(z.serves ?? ""), x: rc[0], y: rc[1], w: rc[2], h: rc[3], floor: z.floor });
  if (z.floor) for (let y = rc[1]; y < rc[1] + rc[3]; y++) zones.push({ x0: rc[0], y0: y, x1: rc[0] + rc[2] - 1, y1: y, floor: z.floor });
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A.face[y]![x]) { const k = wallAbove(x, y); if (k >= 0) zones.push({ x0: x, y0: y, x1: x, y1: y, wall: walls[k]!.material }); }

const input: HandInteriorInput = { plan, floor: roomList[0]![1].floor, wall: ow.material, zones, objects: objs.map(({ id, x, y }) => ({ id, x, y })), lines, start: [{ x: ent.x, y: ent.y }] };
const tileset = base.tilesets[HAND_INTERIOR_TILESET_ID]!;
let built: ReturnType<typeof buildHandInteriorLayers>;
try { built = buildHandInteriorLayers(input, tileset); } catch (e) { errors.push(e instanceof HandInteriorError ? `builder: ${e.code}` : String(e)); done(); throw e; }
// vertical-wall doorways: the builder drew the two cells above the walkable cell as wall face, so the doorway read as a wall panel.
// Draw the whole 3-cell gap as the floor of the room it opens into (the wall cap above stays as the lintel), so it reads as an opening.
const VDOOR = !process.argv.includes("--old-vdoor");
if (VDOOR) for (const d of doors) if (d.vertical) {
  const w = walls[wallByName.get(d.wall)!]!;
  for (let t = 0; t < w.thickness; t++) for (const dy of [0, -1, -2]) {
    const x = d.x + t, y = d.y + dy, i = idx(x, y); if (!inMap(x, y)) continue;
    const k = roomAt[i]! >= 0 ? roomAt[i]! : roomAt[idx(x - 1, d.y)]!; const r = roomList[k >= 0 ? k : 0]![1];
    const zf = zoneList.find((z) => z.floor && x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h)?.floor;
    const fd = S.floors[zf ?? r.floor]!; const sh = dy === -2 ? 1 : 0;
    (built.lowerTiles as number[])[i] = fd.tiles[((y % fd.rows) * fd.cols + (floorLayX(fd as any, x, y) % fd.cols)) * 4 + sh]!;
    if (dy < 0) { (built.lowerOverlayTiles as number[])[i] = -1; (built.upperTiles as number[])[i] = -1; (built.upperOverlayTiles as number[])[i] = -1; }
  }
}
const EN: Record<string, string> = {
  overlap: "two pieces overlap on this cell — move one of them",
  "not-on-floor": "this footprint cell is not walkable floor (it is wall, or one of the 2 face rows under a wall)",
  "hang-not-on-face": "wall-mounted piece is not on the upper face row",
  "wall-piece-needs-face": "against-wall piece must stand on the first floor row right below a 2-row wall face",
  "stairs-not-at-wall": "stairs up must stand on the first floor row right below a north wall face",
  "table-one-row": "counter/kcounter can only be 1 row tall",
  "out-of-bounds": "piece art goes out of the map",
  "no-entrance": "the entrance cell is blocked",
  "stair-entrance-blocked": "the stairs' front cell is blocked or not floor",
  "travel-landing-unreached": "the cell in front of the stairs cannot be reached",
};
const who = (x?: number, y?: number) => { if (x === undefined || y === undefined) return "";
  const hit = objs.filter((p) => { const { w, h } = fp(p.id); return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h; });
  return hit.length ? ` [${hit.map((p) => `"${p.id}"@${P(p.x, p.y)}`).join(", ")}]` : ""; };
for (const i of built.issues) {
  const at = i.x !== undefined ? ` at ${P(i.x, i.y!)}` : "";
  if (i.severity === "error" && ["stair-entrance-blocked", "stairs-not-at-wall", "travel-landing-unreached"].includes(i.code) && late.some((e) => /stair/i.test(e))) continue;
  if (i.severity === "error") errors.push((EN[i.code] ?? i.code) + at + who(i.x, i.y));
  else if (i.code === "unreached-floor" && built.unreachedFloor.length >= 8) errors.push(`${built.unreachedFloor.length} floor cells cannot be reached from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => P(c.x, c.y)).join(" ")}) — furniture, a door leaf or a rail blocks the way; open a path.`);
  else if (i.code === "unreached-floor") warnings.push(`${built.unreachedFloor.length} floor cells are not reachable from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => P(c.x, c.y)).join(" ")}) — furniture blocks the way.`);
  else if (i.code === "unreachable-piece") warnings.push(`a piece has no reachable side: ${i.message.replace(/[^\x00-\x7F]+/g, " ").replace(/\s+/g, " ").trim()}`);
  else if (i.code === "too-many-layers") warnings.push(`too many stacked pieces${at}${who(i.x, i.y)}`);
}
// ---- every room reachable (gate leaves count as passable doors) ----
const block = new Uint8Array(W * H);
for (const p of objs) { if (flatId(p.id)) continue; if (["locked door", "iron gate", "iron gate open"].includes(p.id)) continue;
  const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) block[idx(p.x + dx, p.y + dy)] = 1; }
for (const i of railCells) block[i] = 1;
const seen = new Uint8Array(W * H); { const q = [idx(ent.x, ent.y)]; seen[q[0]!] = 1;
  while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; const j = idx(X, Y); if (inMap(X, Y) && !seen[j] && A.isFloor(X, Y) && !block[j]) { seen[j] = 1; q.push(j); } } } }
const roomReport: Record<string, { cells: number; floor: number; reached: number }> = {};
roomList.forEach(([c, r]) => { const fl = comps[c]!.filter((i) => A.isFloor(i % W, Math.floor(i / W))); const reached = fl.filter((i) => seen[i]).length;
  roomReport[r.id] = { cells: comps[c]!.length, floor: fl.length, reached };
  if (!reached) errors.push(`room "${r.id}" cannot be reached from the entrance — give it a door, and keep the doorway and the cell on each side of it free of furniture.`); });
// ---- room checks: purpose = own room or bounded zone, size to contents (empty floor), rug cap ----
const REQ: Record<string, { need: Record<string, number>; extra: string[] }> = {
  inn: { need: { "common hall": 1, kitchen: 1, "guest room": 2 }, extra: ["corridor", "storage", "pantry", "washroom", "stair hall", "office"] },
  library: { need: { "book stacks": 1, "reading room": 1 }, extra: ["archive", "office", "corridor", "storage", "entrance hall", "stair hall"] },
  jail: { need: { "guard room": 1, corridor: 1, cell: 2 }, extra: ["storage", "office", "armory", "interrogation room", "washroom"] },
  manor: { need: { "entrance hall": 1, "drawing room": 1, "dining room": 1, kitchen: 1 }, extra: ["corridor", "pantry", "storage", "study", "stair hall", "washroom", "servants room"] },
};
const CONTENT: Record<string, [RegExp, string]> = {
  kitchen: [/kitchen range|stove|kitchen sink|kcounter|oven|hearth/, "a kitchen range, stove, sink or kitchen counter"],
  "guest room": [/\bbed\b|double bed/, "a bed"], "common hall": [/dining|table:|reception|counter|bench/, "dining tables or the reception counter"],
  "book stacks": [/bookshelf|bookcase|cabinet:book|shelf:book|scroll rack/, "bookshelves"], "reading room": [/desk|armchair|sofa|lectern|tea|reading/, "desks, armchairs or a lectern"],
  "guard room": [/desk|work|weapon rack|sword rack|spear rack|table:|bench/, "a desk/table or weapon racks"], cell: [/prison cot|straw pile|cot/, "a cot or straw pile"],
  "drawing room": [/sofa|armchair|piano|tea|chaise|settee|loveseat/, "sofas, armchairs or a piano"], "dining room": [/dining/, "a dining table"],
};
const req = REQ[TASK];
const ofRoom = new Map<number, string[]>();   // pieces by room (footprint anchor cell)
const pieceAt = (p: Pl) => { const d = S.objects[p.id]; const yy = d?.kind === "hang" ? p.y + 2 : p.y; return roomAt[idx(p.x, Math.min(H - 1, yy))] ?? -1; };
for (const p of objs) { const k = pieceAt(p); if (k >= 0) ofRoom.set(k, [...(ofRoom.get(k) ?? []), `${p.id} ${S.objects[p.id]?.ko ?? ""}`.toLowerCase()]); }
const inZone = (z: (typeof zoneList)[number]) => objs.filter((p) => { const { w, h } = fp(p.id); return p.x < z.x + z.w && p.x + w > z.x && p.y < z.y + z.h && p.y + h > z.y; }).map((p) => `${p.id} ${S.objects[p.id]?.ko ?? ""}`.toLowerCase());
const roomWalls = (k: number) => { const set = new Set<string>(); for (const i of comps[roomList[k]![0]]!) { const x = i % W, y = (i - x) / W;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (inMap(X, Y) && wallOf[idx(X, Y)]! >= 0) set.add(walls[wallOf[idx(X, Y)]!]!.id === "outer" ? "the outer wall" : `wall "${walls[wallOf[idx(X, Y)]!]!.id}"`); } } return [...set]; };
if (req) {
  const allowed = [...Object.keys(req.need), ...req.extra];
  const served: Record<string, number> = {};
  roomList.forEach(([, r], k) => {
    const sv = String(r.serves ?? "").toLowerCase().trim();
    if (!sv) { late.push(`room "${r.id}" has no "serves" — give each room exactly one purpose from: ${allowed.join(", ")}.`); return; }
    if (!allowed.includes(sv)) { late.push(`room "${r.id}" serves "${r.serves}" — use one of: ${allowed.join(", ")} (one purpose per room; a second purpose needs its own walled room or a bounded zone).`); return; }
    served[sv] = (served[sv] ?? 0) + 1;
    const c = CONTENT[sv]; if (c && !(ofRoom.get(k) ?? []).some((t) => c[0].test(t))) late.push(`room "${r.id}" serves "${sv}" but has no ${c[1]} — furnish it for its purpose (or give it the purpose its furniture shows).`);
  });
  for (const z of zoneList) {
    const sv = z.serves.toLowerCase().trim();
    if (!allowed.includes(sv)) { late.push(`zone in room "${z.room}" serves "${z.serves}" — use one of: ${allowed.join(", ")}.`); continue; }
    // bounded: every side of the rect is a wall, or at least half of it is lined with blocking pieces / a fence (a 1-2 cell gap to walk in is fine)
    const sides: [string, [number, number][]][] = [
      ["north", Array.from({ length: z.w }, (_, i) => [z.x + i, z.y - 1])], ["south", Array.from({ length: z.w }, (_, i) => [z.x + i, z.y + z.h])],
      ["west", Array.from({ length: z.h }, (_, i) => [z.x - 1, z.y + i])], ["east", Array.from({ length: z.h }, (_, i) => [z.x + z.w, z.y + i])]];
    const inner = (side: string, x: number, y: number): [number, number] => side === "north" ? [x, y + 1] : side === "south" ? [x, y - 1] : side === "west" ? [x + 1, y] : [x - 1, y];
    const open = sides.filter(([side, cells]) => { if (cells.every(([x, y]) => !A.isFloor(x, y) || roomAt[idx(x, y)] !== z.k)) return false;
      const lined = cells.filter(([x, y]) => !A.isFloor(x, y) || block[idx(x, y)] || (() => { const [a, b] = inner(side, x, y); return block[idx(a, b)] === 1; })()).length;
      return lined < Math.ceil(cells.length / 2); }).map(([side]) => side);
    if (open.length) late.push(`zone "${z.serves}" [${z.x},${z.y},${z.w},${z.h}] in room "${z.room}" is not bounded on its ${open.join(", ")} side(s): line each open side with a 'fence' rail, a counter or shelves (leave a 1-2 cell gap to walk in), or make it its own walled room with a door.`);
    else served[sv] = (served[sv] ?? 0) + 1;
    const c = CONTENT[sv]; if (c && !inZone(z).some((t) => c[0].test(t))) late.push(`zone "${z.serves}" in room "${z.room}" has no ${c[1]} inside its rect.`);
  }
  for (const [tag, n] of Object.entries(req.need)) if ((served[tag] ?? 0) < n)
    late.push(`the request needs ${n} "${tag}" — found ${served[tag] ?? 0}. Give each its own walled room (close it with partition walls and a door) or a clearly bounded zone; do not merge two purposes into one open hall.`);
}
// empty floor: floor cells with nothing in them or next to them (8 neighbours: no wall, face, piece or rail), not on a circulation path
const daisCell = new Set<number>(); for (const p of objs) if (isDais(p.id)) { const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) daisCell.add(idx(p.x + dx, p.y + dy)); }
const solidAt = (x: number, y: number) => !inMap(x, y) || !A.isFloor(x, y) || block[idx(x, y)] === 1 || daisCell.has(idx(x, y));
const roomStats: Record<string, any> = {};
let floorAll = 0, emptyAll = 0, emptyRawAll = 0;
roomList.forEach(([c, r], k) => {
  const fl = comps[c]!.filter((i) => A.isFloor(i % W, Math.floor(i / W)));
  // circulation: shortest free-floor paths between this room's doors (entrance, doorways, stair entries), widened to 3 cells, are not "empty"
  const inRoom = new Set(fl);
  const portals = new Set<number>();
  const portalSrc = [...doorCell, idx(ent.x, ent.y)];
  for (const i of portalSrc) { const x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = idx(x + dx!, y + dy!); if (inMap(x + dx!, y + dy!) && inRoom.has(j) && !block[j]) portals.add(j); } }
  for (const st of stairItems) for (let c = 0; c < 3; c++) { const j = idx(st.x + c, st.y + 1); if (inRoom.has(j) && !block[j]) portals.add(j); }
  const circ = new Uint8Array(W * H);
  const P0 = [...portals];
  for (let a = 0; a < P0.length; a++) {
    const prev = new Int32Array(W * H).fill(-2); prev[P0[a]!] = -1; const q = [P0[a]!]; let h = 0;
    while (h < q.length) { const i = q[h++]!; const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; const j = idx(X, Y); if (inMap(X, Y) && inRoom.has(j) && !block[j] && prev[j] === -2) { prev[j] = i; q.push(j); } } }
    for (let b = a + 1; b < P0.length; b++) { let i = P0[b]!; if (prev[i] === -2) continue;
      while (i >= 0) { const x = i % W, y = (i - x) / W; circ[i] = 1; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(x + dx!, y + dy!)) circ[idx(x + dx!, y + dy!)] = 1; i = prev[i]!; } }
  }
  const dead = new Uint8Array(W * H); let nd = 0, ndRaw = 0;
  for (const i of fl) { const x = i % W, y = (i - x) / W; if (block[i]) continue; let ok = true;
    for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1; a++) if (solidAt(x + a, y + b)) { ok = false; break; }
    if (ok) { ndRaw++; if (!circ[i]) { dead[i] = 1; nd++; } } }
  emptyRawAll += ndRaw;
  // largest all-dead rectangle (histogram)
  let best = 0, br: number[] | null = null; const hh = new Array<number>(W).fill(0);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) hh[x] = dead[idx(x, y)] ? hh[x]! + 1 : 0;
    const st: [number, number][] = [];
    for (let x = 0; x <= W; x++) { const cur = x < W ? hh[x]! : 0; let s0 = x;
      while (st.length && st[st.length - 1]![1] >= cur) { const [s1, h1] = st.pop()!; s0 = s1; const a = h1 * (x - s1);
        if (a > best && Math.min(h1, x - s1) >= 1) { best = a; br = [s1, y - h1 + 1, x - s1, h1]; } }
      st.push([s0, cur]); } }
  const carpets = (Array.isArray(L.carpets) ? L.carpets : []).filter((cp: any) => num(cp.x) && num(cp.y) && inMap(cp.x, cp.y) && roomAt[idx(cp.x, cp.y)] === k).length;
  const decals = objs.filter((p) => ["round rug", "runner"].includes(p.id) && roomAt[idx(p.x, p.y)] === k).length;
  const rugs = carpets + decals;
  const pct = Math.round((100 * nd) / Math.max(1, fl.length));
  // hall fill (off the door-to-door walkways): share of that floor taken by furniture, and cells with no furniture within 2 cells
  let off = 0, blocked = 0, far = 0;
  const pieceNear = (x: number, y: number, r0: number) => { for (let b = -r0; b <= r0; b++) for (let a = -r0; a <= r0; a++) { const X = x + a, Y = y + b; if (inMap(X, Y) && block[idx(X, Y)] && inRoom.has(idx(X, Y))) return true; } return false; };
  for (const i of fl) { if (block[i]) { blocked++; continue; } if (circ[i]) continue; off++; const x = i % W, y = (i - x) / W; if (!pieceNear(x, y, 2)) far++; }
  const fillPct = Math.round((100 * blocked) / Math.max(1, off + blocked)), farPct = Math.round((100 * far) / Math.max(1, off + blocked));
  const svk = String(r.serves ?? "").toLowerCase();
  if (fl.length >= 80 && !(svk === "corridor" || /corridor/.test(String(r.id))) && (fillPct < 20 || farPct > 10) && !late.some((e) => e.startsWith(`room "${r.id}" has an empty`) || e.startsWith(`room "${r.id}": `))) {
    const farMask = new Uint8Array(W * H); for (const i of fl) { if (block[i] || circ[i]) continue; const x = i % W, y = (i - x) / W; if (!pieceNear(x, y, 2)) farMask[i] = 1; }
    let fb = 0, fr: number[] | null = null; const h2 = new Array<number>(W).fill(0);
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) h2[x] = farMask[idx(x, y)] ? h2[x]! + 1 : 0; const st: [number, number][] = [];
      for (let x = 0; x <= W; x++) { const cur = x < W ? h2[x]! : 0; let s0 = x; while (st.length && st[st.length - 1]![1] >= cur) { const [s1, h1] = st.pop()!; s0 = s1; if (h1 * (x - s1) > fb) { fb = h1 * (x - s1); fr = [s1, y - h1 + 1, x - s1, h1]; } } st.push([s0, cur]); } }
    const where = fr ? ` — e.g. around x=${Math.max(0, fr[0]! - 2)}..${fr[0]! + fr[2]! + 1}, y=${Math.max(0, fr[1]! - 2)}..${fr[1]! + fr[3]! + 1}` : "";
    const IDEAS: Record<string, string> = { "book stacks": "rows of bookshelves back to back with 1-2 cell aisles, a ladder, catalog drawers", "reading room": "rows of reading tables with chairs and lamps, a lectern",
      "common hall": "dining tables in rows with benches or chairs, a bar with stools, a hearth corner", "entrance hall": "a centrepiece (fountain or statue) flanked by columns, benches, plants and vases along the walls",
      "drawing room": "a seating group (sofa, armchairs, tea table), a piano, display cabinets", "dining room": "a long table with chairs all round, a sideboard", kitchen: "work counters, a prep table, barrels, shelves",
      "guard room": "a table with stools, weapon racks, a brazier", "stair hall": "a centrepiece, benches, plants" };
    late.push(`room "${r.id}" (${fl.length} floor cells) is too sparse away from its walkways: only ${fillPct}% of that floor is furnished and ${farPct}% has no furniture within 2 cells${where}. The walkways between doors may stay open, but the rest of a big room must be filled with purpose: ${IDEAS[svk] ?? "groups of furniture that belong together"}. Or make the room smaller.`);
  }
  roomStats[r.id] = { floor: fl.length, empty: nd, emptyPct: pct, rect: br, rugs, fillPct, farPct, area: comps[c]!.length } as any;
  floorAll += fl.length; emptyAll += nd;
  const sv = String(r.serves ?? "").toLowerCase();
  const corridor = sv === "corridor" || /corridor/.test(String(r.id));
  // the empty area as the player sees it: the all-empty rectangle plus the 1-cell margin around it
  const raw = br ? [Math.max(0, br[0]! - 1), Math.max(0, br[1]! - 1), br[0]! + br[2]!, br[1]! + br[3]!] : null;
  const rawTxt = raw ? `x=${raw[0]}..${raw[2]}, y=${raw[1]}..${raw[3]} (${raw[2]! - raw[0]! + 1}x${raw[3]! - raw[1]! + 1} cells)` : "";
  const wallsTxt = roomWalls(k).join(" or ");
  const choices = `Choose one: (a) shrink the room to its contents — move ${wallsTxt} in so this space disappears (shrink the map too), or (b) fill it with a purposeful group that serves this room ("${sv || r.id}") (furniture that belongs together, e.g. a table with its chairs, a seating corner, a work counter with shelves). Rugs do not count as filling.`;
  if (corridor) { if (pct > 30 && br && Math.min(br[2]!, br[3]!) >= 2) late.push(`corridor "${r.id}" is too wide: ${pct}% of its floor is empty (empty area ${rawTxt}). Make it 2-3 cells wide (move ${wallsTxt}) or line it with benches, racks or torches.`); }
  else if (br && Math.min(br[2]!, br[3]!) >= 3 && best >= 12) late.push(`room "${r.id}" has an empty floor area ${rawTxt} — nothing stands in it or next to it and no walkway between doors crosses it (${pct}% of the room's floor is empty; walkways up to 3 cells wide between doors are not counted). ${choices}`);
  else if (pct > 25 && fl.length >= 30) late.push(`room "${r.id}": ${pct}% of its floor is empty (cells with nothing in or next to them; largest empty area ${rawTxt}). ${choices}`);
  const cap = fl.length >= 150 ? 2 : 1;
  if (rugs > cap) late.push(`room "${r.id}" has ${rugs} rugs (carpets + round rug/runner) — at most ${cap} in a room of ${fl.length} floor cells. Remove ${rugs - cap}; vary the look with the room's floor instead (the catalog lists several floor types; a zone may also take its own floor).`);
});
// ---- room hierarchy: size by importance (reported: CV of room areas; soft note on rows of same-size rooms with different purposes) ----
const RANK: Record<string, number> = { "entrance hall": 5, "common hall": 5, "book stacks": 5, "dining room": 4, "reading room": 4, "drawing room": 4, kitchen: 3, "guard room": 3, study: 3, office: 3, archive: 3,
  "stair hall": 3, "guest room": 2, cell: 2, corridor: 2, "interrogation room": 2, storage: 1, pantry: 1, washroom: 1, "servants room": 1, armory: 1 };
const areas = roomList.map(([c]) => comps[c]!.length);
const mean = areas.reduce((a, b) => a + b, 0) / Math.max(1, areas.length);
const cv = areas.length > 1 ? Math.sqrt(areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length) / Math.max(1, mean) : 0;
const bboxOf = (c: number) => { const xs = comps[c]!.map((i) => i % W), ys = comps[c]!.map((i) => Math.floor(i / W)); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1]; };
const bbs = roomList.map(([c]) => bboxOf(c));
const between = new Map<string, number>();   // "a,b" -> wall index separating them
for (let i = 0; i < W * H; i++) { const kw = wallOf[i]!; if (kw < 0) continue; const x = i % W, y = (i - x) / W;
  for (const [dx, dy] of [[1, 0], [0, 1]]) for (const th of [1, 2]) { const A0 = [x - dx!, y - dy!], B0 = [x + dx! * th, y + dy! * th];
    if (!inMap(A0[0]!, A0[1]!) || !inMap(B0[0]!, B0[1]!)) continue; const a = roomAt[idx(A0[0]!, A0[1]!)]!, b = roomAt[idx(B0[0]!, B0[1]!)]!;
    if (a >= 0 && b >= 0 && a !== b) between.set(`${Math.min(a, b)},${Math.max(a, b)}`, kw); } }
const same = (a: number, b: number) => { const A1 = bbs[a]!, B1 = bbs[b]!; const ar = areas[a]!, br2 = areas[b]!;
  return Math.abs(ar - br2) <= 0.12 * Math.max(ar, br2) && ((Math.abs(A1[2]! - B1[2]!) <= 1 && Math.abs(A1[3]! - B1[3]!) <= 1) || (Math.abs(A1[2]! - B1[3]!) <= 1 && Math.abs(A1[3]! - B1[2]!) <= 1)); };
const svOf = (k: number) => String(roomList[k]![1].serves ?? "").toLowerCase();
const adjSame = roomList.map(() => [] as number[]);
for (const key of between.keys()) { const [a, b] = key.split(",").map(Number) as [number, number];
  if (same(a, b) && !roomList[a]![1].repeat && !roomList[b]![1].repeat) { adjSame[a]!.push(b); adjSame[b]!.push(a); } }
const seenG = new Set<number>(); let sameRows = 0;
roomList.forEach((_, k) => { if (seenG.has(k) || !adjSame[k]!.length) return; const grp: number[] = []; const q = [k]; seenG.add(k);
  while (q.length) { const u = q.pop()!; grp.push(u); for (const v of adjSame[u]!) if (!seenG.has(v)) { seenG.add(v); q.push(v); } }
  if (grp.length < 3 || new Set(grp.map(svOf)).size < 2) return; sameRows++;
  grp.sort((a, b) => (RANK[svOf(b)] ?? 2) - (RANK[svOf(a)] ?? 2));
  const big = grp[0]!; const nb = grp.find((g) => g !== big && between.has(`${Math.min(big, g)},${Math.max(big, g)}`));
  let fix = "";
  if (nb !== undefined) { const kw = between.get(`${Math.min(big, nb)},${Math.max(big, nb)}`)!; const wl = L.walls?.find((w: any) => w.id === walls[kw]!.id);
    const p = wl?.path; const bb = bbs[nb]!;
    if (Array.isArray(p) && p.length === 2) { const vertical = p[0][0] === p[1][0]; const d = Math.max(2, Math.round((vertical ? bb[2]! : bb[3]!) / 3));
      const bigC = bbs[big]!; const toward = vertical ? (bb[0]! > bigC[0]! ? 1 : -1) : (bb[1]! > bigC[1]! ? 1 : -1);
      const np = vertical ? [[p[0][0] + toward * d, p[0][1]], [p[1][0] + toward * d, p[1][1]]] : [[p[0][0], p[0][1] + toward * d], [p[1][0], p[1][1] + toward * d]];
      fix = ` Fixed call (one way): {"id": "${wl.id}", "material": "${wl.material}", "thickness": ${wl.thickness ?? 1}, "path": ${JSON.stringify(np)}} — this makes "${roomList[big]![1].id}" larger and "${roomList[nb]![1].id}" smaller; move that wall's doors and wall items with it.`; } }
  const names = grp.map((g) => `"${roomList[g]![1].id}" (${svOf(g) || "?"}, ${bbs[g]![2]}x${bbs[g]![3]})`).join(", ");
  notes.push(`Rooms ${names} are the same size side by side but do not all serve the same purpose. Real buildings size rooms by importance and use — main hall > dining or drawing room > bedrooms > closets and storage — so a row of identical boxes reads as a grid, not a house. Resize them so their sizes follow their roles.${fix} If they genuinely are repeated rooms, add "repeat": true to each of them.`);
});
// ---- variety (distinct ids per room, repetition) + box rooms (reported; soft note on a room reusing one id > 4x) ----
const CATS: Record<string, string> = (() => { const ci = process.argv.indexOf("--cats"); try { return ci > 0 ? JSON.parse(readFileSync(process.argv[ci + 1]!, "utf8")) : {}; } catch { return {}; } })();
const REPEAT_OK = /chair|stool|bench|pew|seat|candle|sconce|torch|lantern|lamp|window|column|pillar|bars|iron gate|cot|straw|plant|fern|potted|bunk|bed|book|shelf|bookcase|stack|desk|table|dining|work/;
const famOf = (id: string) => (daisRe.test(id) ? "dais" : /^([a-z]+) \d+x\d+$/.exec(id)?.[1] ?? id);
const variety: Record<string, { pieces: number; distinct: number; repetition: number; top: [string, number][] }> = {};
let vPieces = 0, vDistinct = 0, boxRooms = 0, plainBoxRooms = 0;
const featureIn = (k: number) => { const cells = new Set(comps[roomList[k]![0]]!);
  return objs.some((p) => (isDais(p.id) || /column|pillar|folding screen|statue|bust/.test(p.id)) && cells.has(idx(p.x, p.y))) || [...railCells].some((i) => cells.has(i)) || zoneList.some((z) => z.room === roomList[k]![1].id); };
roomList.forEach(([c, r], k) => {
  const cnt = new Map<string, number>();
  for (const p of objs) { if (pieceAt(p) !== k || ["locked door", "iron gate", "iron gate open"].includes(p.id)) continue; const f = famOf(p.id); cnt.set(f, (cnt.get(f) ?? 0) + 1); }
  const n = [...cnt.values()].reduce((a, b) => a + b, 0);
  variety[r.id] = { pieces: n, distinct: cnt.size, repetition: n ? Math.round((100 * (1 - cnt.size / n))) / 100 : 0, top: [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) };
  vPieces += n; vDistinct += cnt.size;
  const [bx, by, bw, bh] = bboxOf(c); const box = comps[c]!.length === bw * bh; if (box) { boxRooms++; if (!featureIn(k)) plainBoxRooms++; }
  const sv = String(r.serves ?? "").toLowerCase();
  if (r.repeat || /cell|guest room/.test(sv)) return;
  for (const [f, m] of cnt) if (m > 4 && !REPEAT_OK.test(f)) {
    const cat = CATS[f]; const alts = cat ? Object.keys(CATS).filter((o) => CATS[o] === cat && o !== f && !cnt.has(o)).slice(0, 6) : [];
    notes.push(`Room "${r.id}" (${sv || "?"}) uses "${f}" ${m} times. A room reads as lived-in when its pieces differ: real rooms collect things over time, so the same object stamped over and over looks like a placeholder. Keep the repetition only where the function really repeats (a row of chairs, cell after cell); otherwise swap some of them for other pieces of the same kind${alts.length ? ` — e.g. ${alts.map((a) => `"${a}"`).join(", ")}${cat ? ` (category "${cat}"; find_pieces("${cat}") lists them all)` : ""}` : ""}.`);
  }
});
const varietyStats = { distinctPerRoom: Math.round((10 * vDistinct) / Math.max(1, roomList.length)) / 10, repetition: Math.round(100 * (1 - vDistinct / Math.max(1, vPieces))) / 100,
  boxRoomRatio: Math.round((100 * boxRooms) / Math.max(1, roomList.length)) / 100, plainBoxRatio: Math.round((100 * plainBoxRooms) / Math.max(1, roomList.length)) / 100, rooms: variety,
  daises: objs.filter((p) => isDais(p.id)).length, columns: objs.filter((p) => /column|pillar/.test(p.id)).length, stubs: (Array.isArray(L.walls) ? L.walls : []).filter((w: any) => w?.stub).length };
// ---- shell + wall metrics (reported only) ----
const inShell = (x: number, y: number) => inMap(x, y) && !outside[idx(x, y)];
let shellArea = 0, bx0 = W, by0 = H, bx1 = -1, by1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inShell(x, y)) { shellArea++; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
let corners = 0;
for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) { const a = inShell(x - 1, y - 1), b = inShell(x, y - 1), c = inShell(x - 1, y), d = inShell(x, y); const n = +a + +b + +c + +d;
  if (n === 1 || n === 3) corners++; else if (n === 2 && a === d) corners += 2; }
let wallNear = 0, wallShared = 0;
for (let i = 0; i < W * H; i++) if (wallOf[i]! >= 0) { const x = i % W, y = (i - x) / W; const rs = new Set<number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (inMap(X, Y) && roomAt[idx(X, Y)]! >= 0 && !doorCell.has(idx(X, Y))) rs.add(roomAt[idx(X, Y)]!); }
  if (rs.size) { wallNear++; if (rs.size >= 2) wallShared++; } }
const shellStats = { convexity: Math.round((100 * shellArea) / Math.max(1, (bx1 - bx0 + 1) * (by1 - by0 + 1))) / 100, outerRuns: corners, sharedWallRatio: Math.round((100 * wallShared) / Math.max(1, wallNear)) / 100 };
const types = new Set(objs.map((p) => famOf(p.id)));
for (const l of lines) if (S.lines[l.id]?.kind === "flat") types.add(l.id);
const ch = (k: number) => (k < 0 ? "." : "0123456789abcdefghijklmnopqrstuvwxyz"[k % 36]!);
const wallGrid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ch(wallOf[idx(x, y)]!)).join(""));
const roomGrid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ch(roomAt[idx(x, y)]!)).join(""));
errors.push(...late);
extra = { stats: { w: W, h: H, plan, wallGrid, roomGrid, wallIds: walls.map((w) => w.id), roomIds: roomList.map(([, r]) => r.id), rooms: roomReport, walls: walls.map((w) => ({ id: w.id, outer: w.outer, cells: w.cells.length })), doors: doors.length, objects: objs.length, floorCells: built.floorCells,
  measure: { variety: varietyStats, roomCV: Math.round(cv * 100) / 100, sameRows, notes: notes.length, shell: shellStats, emptyPctAll: Math.round((100 * emptyRawAll) / Math.max(1, floorAll)), emptyPct: Math.round((100 * emptyAll) / Math.max(1, floorAll)), rooms: roomStats, rugs: Object.values(roomStats).reduce((a, b) => a + b.rugs, 0), maxRugs: Math.max(0, ...Object.values(roomStats).map((r) => r.rugs)),
    stairs: stairStats, types: types.size, typeList: [...types].sort(), poolUsed: [...types].filter((t) => poolIds.has(t)), floors: [...new Set([...roomList.map(([, r]) => r.floor), ...zoneList.filter((z) => z.floor).map((z) => z.floor)])] } } };
if ((errors.length && !process.argv.includes("--force-render")) || !render) done();

const { addRenderAssetRoot, renderReviewMapPng } = await import("../../qa-game/render.mts");
const { store } = await import("../../../src/project/store");
addRenderAssetRoot(resolve(baseDir!, "assets"));
const id = "bbox-walls";
base.maps[id] = { ...structuredClone(Object.values(base.maps)[0]), id, name: L.name ?? "bbox walls", width: built.width, height: built.height,
  tilesetId: HAND_INTERIOR_TILESET_ID, tileSize: tileset.tileSize, lowerTiles: built.lowerTiles, upperTiles: built.upperTiles,
  lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles, events: [], climate: { mode: "indoor" } } as any;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete (base.maps[id] as any)[k];
base.mapTree.children.push({ mapId: id, children: [] });
store.replaceProject(base);
const cur = store.getCurrent();
writeFileSync(resolve(outDir!, "map.png"), renderReviewMapPng(cur, cur.maps[id]!, 1).png as Buffer);
extra = { ...extra, rendered: true };
done();
