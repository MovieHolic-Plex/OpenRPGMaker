// bbox-walls test: walls are first-class layout primitives. The model writes the outer wall ring, partition wall paths,
// doors on walls, rooms (labels), wall_items bound to a wall, floor objects. This code only rasterizes and validates
// (English messages for the Rejected/Fixed loop) and lays the result exactly on atlas_biome_interior v5.
//   bun scripts/experiments/bbox-walls/lay.mts <layout.json> <out dir> <base dir> [--render]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { analyseHandInteriorPlan, buildHandInteriorLayers, HandInteriorError, HAND_INTERIOR_SPEC as S, HAND_INTERIOR_TILESET_ID, type HandInteriorInput } from "../../../src/editor/handInterior/builder";

const [lf, outDir, baseDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
mkdirSync(outDir!, { recursive: true });
const L = JSON.parse(readFileSync(lf!, "utf8"));
const errors: string[] = [], warnings: string[] = [];
const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const W: number = L.map?.w, H: number = L.map?.h;
let extra: Record<string, unknown> = {};
const done = () => { const r = { ok: errors.length === 0, errors, warnings, ...extra }; writeFileSync(resolve(outDir!, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
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
const ow = L.outer_wall;
if (!ow) { errors.push("outer_wall is missing."); done(); }
if (!S.walls[ow.material]) errors.push(`outer_wall: unknown wall material "${ow.material}" — use a catalog wall id.`);
const r0 = raster("outer", ow.path, 1, true);
if (r0) walls.push({ id: "outer", material: ow.material, outer: true, stub: false, ...r0 });
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
const sizedRe = /^([a-z]+) (\d+)x(\d+)$/u;
const fp = (id: string) => { const d = S.objects[id]; const s = sizedRe.exec(id); return d ? { w: d.w, h: Math.max(1, d.h) } : { w: Number(s?.[2] ?? 1), h: Number(s?.[3] ?? 1) }; };
const WINDOWS = new Set(["window", "curtained window", "boarded window", "tall stained window", "round window", "stained glass"]);
for (const o of Array.isArray(L.objects) ? L.objects : []) {
  if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) { errors.push(`object ${JSON.stringify(o).slice(0, 80)}: needs id and integer x, y.`); continue; }
  const d = S.objects[o.id], s = sizedRe.exec(o.id);
  if (!d && !(s && S.tables[s[1]!] && !S.objects[o.id])) { if (!(s && S.tables[s[1]!])) { errors.push(`unknown catalog id "${o.id}" at ${P(o.x, o.y)}.`); continue; } }
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
if (errors.length) done();

// ---- zones: room floors, face material = the wall above ----
const zones: { x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string }[] = [];
const roomAt = new Int32Array(W * H).fill(-1);
const roomList = [...roomOfComp.entries()];
roomList.forEach(([c], k) => { for (const i of comps[c]!) roomAt[i] = k; });
for (const d of doors) for (const i of d.cells) { // door cells take the floor of the room they open into (south / east side)
  const x = i % W, y = (i - x) / W; const nb = d.vertical ? idx(x + 1, y) : idx(x, y + 1); roomAt[i] = roomAt[nb] >= 0 ? roomAt[nb] : roomAt[d.vertical ? idx(x - 1, y) : idx(x, y - 1)]!; }
roomAt[idx(ent.x, ent.y)] = roomAt[idx(ent.x, ent.y - 1)]!;
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const k = roomAt[idx(x, y)]!; let x1 = x; while (x1 + 1 < W && roomAt[idx(x1 + 1, y)] === k) x1++; if (k >= 0) zones.push({ x0: x, y0: y, x1, y1: y, floor: roomList[k]![1].floor }); x = x1 + 1; } }
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A.face[y]![x]) { const k = wallAbove(x, y); if (k >= 0) zones.push({ x0: x, y0: y, x1: x, y1: y, wall: walls[k]!.material }); }

const input: HandInteriorInput = { plan, floor: roomList[0]![1].floor, wall: ow.material, zones, objects: objs.map(({ id, x, y }) => ({ id, x, y })), lines, start: [{ x: ent.x, y: ent.y }] };
const { loadHeadlessProject } = await import("../../../src/headless/index");
const base = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const tileset = base.tilesets[HAND_INTERIOR_TILESET_ID]!;
let built: ReturnType<typeof buildHandInteriorLayers>;
try { built = buildHandInteriorLayers(input, tileset); } catch (e) { errors.push(e instanceof HandInteriorError ? `builder: ${e.code}` : String(e)); done(); throw e; }
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
  if (i.severity === "error") errors.push((EN[i.code] ?? i.code) + at + who(i.x, i.y));
  else if (i.code === "unreached-floor") warnings.push(`${built.unreachedFloor.length} floor cells are not reachable from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => P(c.x, c.y)).join(" ")}) — furniture blocks the way.`);
  else if (i.code === "unreachable-piece") warnings.push(`a piece has no reachable side: ${i.message.replace(/[^\x00-\x7F]+/g, " ").replace(/\s+/g, " ").trim()}`);
  else if (i.code === "too-many-layers") warnings.push(`too many stacked pieces${at}${who(i.x, i.y)}`);
}
// ---- every room reachable (gate leaves count as passable doors) ----
const block = new Uint8Array(W * H);
for (const p of objs) { const d = S.objects[p.id]; if (d && (d.kind === "hang" || d.kind === "flat")) continue; if (["locked door", "iron gate", "iron gate open"].includes(p.id)) continue;
  const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) block[idx(p.x + dx, p.y + dy)] = 1; }
for (const i of railCells) block[i] = 1;
const seen = new Uint8Array(W * H); { const q = [idx(ent.x, ent.y)]; seen[q[0]!] = 1;
  while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; const j = idx(X, Y); if (inMap(X, Y) && !seen[j] && A.isFloor(X, Y) && !block[j]) { seen[j] = 1; q.push(j); } } } }
const roomReport: Record<string, { cells: number; floor: number; reached: number }> = {};
roomList.forEach(([c, r]) => { const fl = comps[c]!.filter((i) => A.isFloor(i % W, Math.floor(i / W))); const reached = fl.filter((i) => seen[i]).length;
  roomReport[r.id] = { cells: comps[c]!.length, floor: fl.length, reached };
  if (!reached) errors.push(`room "${r.id}" cannot be reached from the entrance — give it a door, and keep the doorway and the cell on each side of it free of furniture.`); });
const ch = (k: number) => (k < 0 ? "." : "0123456789abcdefghijklmnopqrstuvwxyz"[k % 36]!);
const wallGrid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ch(wallOf[idx(x, y)]!)).join(""));
const roomGrid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ch(roomAt[idx(x, y)]!)).join(""));
extra = { stats: { w: W, h: H, plan, wallGrid, roomGrid, wallIds: walls.map((w) => w.id), roomIds: roomList.map(([, r]) => r.id), rooms: roomReport, walls: walls.map((w) => ({ id: w.id, outer: w.outer, cells: w.cells.length })), doors: doors.length, objects: objs.length, floorCells: built.floorCells } };
if (errors.length || !render) done();

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
