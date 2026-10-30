// bbox-dungeon: execute a model-written whole dungeon floor exactly, on the beodeul_city dungeon kits (the chipset author_dungeon uses).
//   bun scripts/experiments/bbox-dungeon/lay.mts <layout.json> <out dir> [--render]
// Prints {ok, errors[], warnings[], stats} (English, for the repair call). The model decided every cell; this code only translates
// rooms/corridors/hazards into the compose grid (walls, ceiling and floor art are derived from the open cells), stamps the named pieces,
// and checks: connectivity from the entrance stairs, boss only through the antechamber, corridors meet rooms at doors, hazards leave a path.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { composeDungeon } from "../../../src/editor/dungeonKit/beodeul/compose";
import { Grid } from "../../../src/editor/dungeonKit/grid";
import { checkGroundSupportForStamp, kitSupportKind } from "../../../src/project/groundSupport";
import type { GameEvent, GameMap, StructureKitDef } from "../../../src/project/types";
import { PIECES, THEMES } from "./pieces.mts";

const [lf, outDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
if (!lf || !outDir) throw Error("lay.mts <layout.json> <out dir> [--render]");
mkdirSync(outDir, { recursive: true });
const L = JSON.parse(readFileSync(lf, "utf8"));
const errors: string[] = [], warnings: string[] = [];
const done = (extra: Record<string, unknown> = {}) => { const r = { ok: errors.length === 0, errors, warnings, ...extra }; writeFileSync(resolve(outDir, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
const num = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const W = L.map?.w, H = L.map?.h;
if (!num(W) || !num(H) || W < 16 || H < 16 || W > 80 || H > 70) { errors.push(`map.w/map.h must be integers, w 16..80, h 16..70 (got ${W}x${H}).`); done(); }
if (!(THEMES as readonly string[]).includes(L.theme)) errors.push(`theme must be one of ${THEMES.join(", ")} (got "${L.theme}").`);
const idx = (x: number, y: number) => y * W + x;
const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const P = (x: number, y: number) => `(${x},${y})`;

// ---- regions: rooms and corridors → open cells, owner per cell ----
type Region = { id: string; kind: "room" | "corridor"; purpose?: string; cells: Set<number> };
const regions = new Map<string, Region>();
const owner = new Int32Array(W * H).fill(-1);   // index into regionList
const regionList: Region[] = [];
const addRegion = (r: Region) => { if (regions.has(r.id)) errors.push(`duplicate id "${r.id}" — room and corridor ids must be unique.`); regions.set(r.id, r); regionList.push(r); };
const PURPOSES = ["entrance", "guard", "puzzle", "treasure", "antechamber", "boss", "other"];
const rooms: any[] = Array.isArray(L.rooms) ? L.rooms : [];
for (const r of rooms) {
  const tag = `room "${r.id}"`;
  if (typeof r.id !== "string") { errors.push(`a room has no string id.`); continue; }
  if (!PURPOSES.includes(r.purpose)) errors.push(`${tag}: purpose must be one of ${PURPOSES.join(", ")} (got "${r.purpose}").`);
  const reg: Region = { id: r.id, kind: "room", purpose: r.purpose, cells: new Set() };
  addRegion(reg);
  const rects: any[] = Array.isArray(r.rects) ? r.rects : [r];
  for (const q of rects) {
    if (![q.x, q.y, q.w, q.h].every(num) || q.w < 1 || q.h < 1) { errors.push(`${tag}: every rect needs integer x,y,w,h >= 1.`); continue; }
    if (q.x < 1 || q.x + q.w > W - 1 || q.y < 4 || q.y + q.h > H - 1) errors.push(`${tag} rect (${q.x},${q.y},${q.w}x${q.h}) must lie inside x 1..${W - 2}, y 4..${H - 2} (the 3 rows above every open area are its wall face, and a solid border stays).`);
    for (let y = q.y; y < q.y + q.h; y += 1) for (let x = q.x; x < q.x + q.w; x += 1) {
      if (!inb(x, y)) continue;
      const o = owner[idx(x, y)]!;
      if (o >= 0 && regionList[o] !== reg) { errors.push(`${tag} overlaps ${regionList[o]!.kind} "${regionList[o]!.id}" at ${P(x, y)} — rooms must not overlap; leave solid cells between them and connect with a door or corridor.`); continue; }
      owner[idx(x, y)] = regionList.indexOf(reg); reg.cells.add(idx(x, y));
    }
  }
}
const byPurpose = (p: string) => rooms.filter((r) => r.purpose === p);
for (const p of ["entrance", "antechamber", "boss"]) if (byPurpose(p).length !== 1) errors.push(`need exactly one room with purpose "${p}" (got ${byPurpose(p).length}).`);
for (const p of ["guard", "puzzle", "treasure"]) if (!byPurpose(p).length) errors.push(`need at least one room with purpose "${p}".`);
const corridors: any[] = Array.isArray(L.corridors) ? L.corridors : [];
for (const c of corridors) {
  const tag = `corridor "${c.id}"`;
  if (typeof c.id !== "string") { errors.push("a corridor has no string id."); continue; }
  const w = c.width ?? 1;
  if (!num(w) || w < 1 || w > 3) errors.push(`${tag}: width must be 1, 2 or 3.`);
  const path: any[] = Array.isArray(c.path) ? c.path : [];
  if (path.length < 2) { errors.push(`${tag}: path needs at least 2 waypoints [[x,y],...].`); continue; }
  const reg: Region = { id: c.id, kind: "corridor", cells: new Set() };
  addRegion(reg);
  for (const id of [c.from, c.to]) if (!rooms.some((r) => r.id === id)) errors.push(`${tag}: from/to "${id}" is not a room id.`);
  for (let k = 1; k < path.length; k += 1) {
    const [x0, y0] = path[k - 1] ?? [], [x1, y1] = path[k] ?? [];
    if (![x0, y0, x1, y1].every(num)) { errors.push(`${tag}: waypoints must be integer pairs [x,y].`); break; }
    if (x0 !== x1 && y0 !== y1) { errors.push(`${tag}: waypoints ${P(x0, y0)} -> ${P(x1, y1)} are not on one row or column; add a corner waypoint.`); continue; }
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s += 1) {
      const x = x0 + Math.sign(x1 - x0) * s, y = y0 + Math.sign(y1 - y0) * s;
      for (let dy = 0; dy < w; dy += 1) for (let dx = 0; dx < w; dx += 1) {
        const X = x + dx, Y = y + dy;
        if (X < 1 || Y < 1 || X > W - 2 || Y > H - 2) { errors.push(`${tag}: cell ${P(X, Y)} leaves the map interior.`); continue; }
        const o = owner[idx(X, Y)]!;
        if (o >= 0) { const other = regionList[o]!; if (other.kind === "room" && other.id !== c.from && other.id !== c.to) errors.push(`${tag} runs through room "${other.id}" at ${P(X, Y)} — route around it (only its from/to rooms may be entered).`); continue; }
        owner[idx(X, Y)] = regionList.indexOf(reg); reg.cells.add(idx(X, Y));
      }
    }
  }
}
// ---- doors: every touching pair of regions needs a door; every corridor needs a door at each end ----
const doors: any[] = Array.isArray(L.doors) ? L.doors : [];
const near = (reg: Region | undefined, x: number, y: number, d = 1) => !!reg && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reg.cells.has(idx(x + dx! * d, y + dy! * d)) || (d > 1 && reg.cells.has(idx(x + dx!, y + dy!))));
for (const d of doors) {
  const [a, b] = Array.isArray(d.connects) ? d.connects : [];
  if (!num(d.x) || !num(d.y) || !regions.has(a) || !regions.has(b)) { errors.push(`door ${JSON.stringify(d).slice(0, 80)}: needs integer x,y and connects:[idA,idB] of existing rooms/corridors.`); continue; }
  if (owner[idx(d.x, d.y)]! < 0) errors.push(`door ${P(d.x, d.y)} is on a solid cell — a door is an open cell where ${a} and ${b} meet.`);
  else if (!near(regions.get(a), d.x, d.y) || !near(regions.get(b), d.x, d.y)) errors.push(`door ${P(d.x, d.y)} does not touch both "${a}" and "${b}" — put it on the cell where they meet.`);
}
const hasDoor = (a: string, b: string, x?: number, y?: number) => doors.some((d) => Array.isArray(d.connects) && d.connects.includes(a) && d.connects.includes(b) && (x === undefined || Math.abs(d.x - x) + Math.abs(d.y - y!) <= 4));
for (const c of corridors) for (const end of [c.from, c.to]) if (typeof c.id === "string" && regions.has(end) && !hasDoor(c.id, end)) errors.push(`corridor "${c.id}" has no door into room "${end}" — add a door {x,y,connects:["${c.id}","${end}"]} where they meet.`);
const touched = new Set<string>();
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  const o = owner[idx(x, y)]!; if (o < 0) continue;
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    if (!inb(x + dx, y + dy)) continue;
    const o2 = owner[idx(x + dx, y + dy)]!;
    if (o2 < 0 || o2 === o) continue;
    const a = regionList[o]!.id, b = regionList[o2]!.id, key = [a, b].sort().join("|");
    if (touched.has(key)) continue;
    if (!hasDoor(a, b, x, y)) { touched.add(key); errors.push(`"${a}" and "${b}" touch at ${P(x, y)}-${P(x + dx, y + dy)} with no door there — leave a solid cell between them or add a door at the meeting cell.`); }
  }
}
// ---- hazards / bridges ----
const liqKind = new Uint8Array(W * H), bridge = new Uint8Array(W * H);
const HZ: Record<string, number> = { water: 1, lava: 2, pit: 3 };
for (const h of Array.isArray(L.hazards) ? L.hazards : []) {
  if (!HZ[h.kind] || ![h.x, h.y, h.w ?? 1, h.h ?? 1].every(num)) { errors.push(`hazard ${JSON.stringify(h).slice(0, 80)}: kind water|lava|pit with integer x,y,w,h.`); continue; }
  for (let y = h.y; y < h.y + (h.h ?? 1); y += 1) for (let x = h.x; x < h.x + (h.w ?? 1); x += 1) {
    if (!inb(x, y) || owner[idx(x, y)]! < 0) { errors.push(`hazard ${h.kind} cell ${P(x, y)} is not inside a room or corridor.`); continue; }
    liqKind[idx(x, y)] = HZ[h.kind]!;
  }
}
for (const b of Array.isArray(L.bridges) ? L.bridges : []) {
  if (![b.x, b.y, b.w ?? 1, b.h ?? 1].every(num)) { errors.push(`bridge ${JSON.stringify(b).slice(0, 60)}: integer x,y,w,h.`); continue; }
  for (let y = b.y; y < b.y + (b.h ?? 1); y += 1) for (let x = b.x; x < b.x + (b.w ?? 1); x += 1) {
    if (!inb(x, y) || !liqKind[idx(x, y)]) { errors.push(`bridge cell ${P(x, y)} is not over a hazard cell (bridges only cross water/lava/pit).`); continue; }
    bridge[idx(x, y)] = 1;
  }
}
// ---- pieces ----
type Put = { name: string; x: number; y: number; room?: string };
const puts: Put[] = [];
const expand = (o: any): Put[] => { const n = o.repeat?.count ?? 1, dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0; return Array.from({ length: Math.max(1, n) }, (_, i) => ({ name: o.id, x: o.x + i * dx, y: o.y + i * dy, room: o.room })); };
for (const r of rooms) {
  if (!r.landmark) { errors.push(`room "${r.id}" has no landmark — give each room one memorable piece {id,x,y}.`); continue; }
  puts.push(...expand({ ...r.landmark, room: r.id }));
}
for (const o of [...(Array.isArray(L.objects) ? L.objects : []), ...(Array.isArray(L.traps) ? L.traps : [])]) puts.push(...expand(o));
for (const p of puts) if (!PIECES[p.name] || !num(p.x) || !num(p.y)) errors.push(`piece ${JSON.stringify(p).slice(0, 80)}: unknown catalog id or non-integer x,y — use an exact id from the catalog.`);
const chests: any[] = Array.isArray(L.chests) ? L.chests : [];
const ups = puts.filter((p) => p.name === "stairs up");
if (ups.length !== 1) errors.push(`need exactly one "stairs up" (the entrance stairs, on the entrance room's north wall face) — got ${ups.length}.`);
if (errors.length) done();

// ---- compose: walls / ceiling / floor / liquid art from the open cells ----
const project = createBlankProject();
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
  if (/stranded-wall|벽 앞면 위에 천장/u.test(m)) errors.push(`wall too thin above open cells ${cells}: an open cell has another open cell 1-3 rows above it in the same column. Keep at least 4 solid rows between an open area and any open cell above it (3 become its wall face, 1 stays ceiling), or join them into one open area.`);
  else errors.push(`painter failed: ${m.slice(0, 300)}`);
  done();
}
const { lower, upper, wallB } = comp.exactOut as { lower: number[]; upper: number[]; wallB: Int8Array };
const isOpen = (x: number, y: number) => inb(x, y) && owner[idx(x, y)]! >= 0;
const isWalkFloor = (x: number, y: number) => isOpen(x, y) && (!liqKind[idx(x, y)] || bridge[idx(x, y)] === 1);
const isFace = (x: number, y: number) => inb(x, y) && wallB[idx(x, y)]! >= 0;
const pseudo = { id: "bbox", name: "bbox", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
const occupied = new Map<number, string>();
const stamped: { name: string; x: number; y: number; w: number; h: number; cls: string }[] = [];
let stairsFront: [number, number] | null = null;
const stairsDownAt: [number, number][] = [];
for (const p of puts) {
  const def = kits.get(PIECES[p.name]!);
  if (!def) { errors.push(`piece "${p.name}" is missing from this tileset.`); continue; }
  const hasUp = def.rows.some((r) => (r.upperTiles ?? []).some((t) => t >= 0));
  const sk = kitSupportKind(def);
  const role = String(def.ai?.role ?? "");
  const cls = p.name === "stairs up" || sk === "mount" || sk === "door" ? "wall" : role === "terrain" || role === "floor" || !hasUp ? "decal" : "floor";
  const at = `"${p.name}" at ${P(p.x, p.y)} (${def.width}x${def.height}, ${cls === "wall" ? "wall-mounted" : cls})`;
  if (p.x < 0 || p.y < 0 || p.x + def.width > W || p.y + def.height > H) { errors.push(`${at} is out of the map.`); continue; }
  let bad = "";
  for (let dy = 0; dy < def.height && !bad; dy += 1) for (let dx = 0; dx < def.width && !bad; dx += 1) {
    const X = p.x + dx, Y = p.y + dy, bottom = dy === def.height - 1;
    const lo = def.rows[dy]!.tiles[dx] ?? -1, up = def.rows[dy]!.upperTiles?.[dx] ?? -1;
    if (lo < 0 && up < 0) continue;
    if (cls === "wall") { if (!isFace(X, Y)) bad = `cell ${P(X, Y)} is not wall face (wall-mounted pieces hang on the 3 solid rows right above an open area's top floor row; for a 2-tall piece use the two rows just above the floor)`; else if (bottom && !(isFace(X, Y + 1) || isWalkFloor(X, Y + 1))) bad = `bottom cell ${P(X, Y)} must have wall face or floor below it`; }
    else if (cls === "decal") { if (!isWalkFloor(X, Y)) bad = `cell ${P(X, Y)} is not walkable floor`; }
    else if (bottom ? !isWalkFloor(X, Y) : !(isWalkFloor(X, Y) || isFace(X, Y))) bad = bottom ? `base cell ${P(X, Y)} is not walkable floor (not on solid, wall face, water, lava or pit)` : `art cell ${P(X, Y)} is neither floor nor wall face`;
    if (!bad && cls !== "decal" && occupied.has(idx(X, Y))) bad = `cell ${P(X, Y)} is already used by "${occupied.get(idx(X, Y))}"`;
  }
  if (!bad && cls !== "decal") { const s = checkGroundSupportForStamp(pseudo, ts, def, p.x, p.y); if (s) bad = "wrong support (wall pieces on wall face, floor pieces on floor)"; }
  if (bad) { errors.push(`${at}: ${bad}.`); continue; }
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
  if (p.name === "stairs down") stairsDownAt.push([p.x, p.y]);
}
for (const c of chests) {
  if (!num(c.x) || !num(c.y) || !isWalkFloor(c.x, c.y)) { errors.push(`chest ${P(c.x, c.y)} must be on walkable floor.`); continue; }
  if (occupied.has(idx(c.x, c.y))) { errors.push(`chest ${P(c.x, c.y)} sits on "${occupied.get(idx(c.x, c.y))}".`); continue; }
  occupied.set(idx(c.x, c.y), "chest");
}
if (errors.length) done();

// ---- validation: walk from the entrance stairs ----
const passTile = (t: number) => { const p = ts.passability[t]; return !!p && Object.values(p).some(Boolean); };
const walkable = (x: number, y: number, blockRoom?: Region) => isWalkFloor(x, y) && passTile(lower[idx(x, y)]!) && (upper[idx(x, y)]! < 0 || passTile(upper[idx(x, y)]!))
  && occupied.get(idx(x, y)) !== "chest" && !(blockRoom && blockRoom.cells.has(idx(x, y)));
const flood = (blockRoom?: Region) => {
  const seen = new Uint8Array(W * H);
  if (!stairsFront || !walkable(stairsFront[0], stairsFront[1], blockRoom)) return seen;
  const q: [number, number][] = [stairsFront]; seen[idx(...stairsFront)] = 1;
  while (q.length) { const [x, y] = q.pop()!; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) if (inb(nx, ny) && !seen[idx(nx, ny)] && walkable(nx, ny, blockRoom)) { seen[idx(nx, ny)] = 1; q.push([nx, ny]); } }
  return seen;
};
const seen = flood();
if (stairsFront && !seen[idx(...stairsFront)]) errors.push(`the floor cell in front of "stairs up" ${P(...stairsFront)} is blocked.`);
const hazardNote = (L.hazards?.length ? " Water/lava/pit cells are not walkable — leave a dry path or add a bridge." : "") + " Pieces with a solid base also block.";
for (const r of regionList) {
  const cells = [...r.cells].filter((c) => isWalkFloor(c % W, (c / W) | 0) && walkable(c % W, (c / W) | 0));
  if (!cells.length) { errors.push(`${r.kind} "${r.id}" has no walkable cell left.`); continue; }
  if (!cells.some((c) => seen[c])) errors.push(`${r.kind} "${r.id}" is not reachable on foot from the entrance stairs.${hazardNote}`);
}
const nb4 = (x: number, y: number) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const;
for (const c of chests) if (!nb4(c.x, c.y).some(([x, y]) => inb(x, y) && seen[idx(x, y)])) errors.push(`chest ${P(c.x, c.y)} cannot be reached (no reachable floor next to it).`);
for (const [x, y] of stairsDownAt) if (!seen[idx(x, y)] && !nb4(x, y).some(([a, b]) => inb(a, b) && seen[idx(a, b)])) errors.push(`"stairs down" ${P(x, y)} cannot be reached.`);
const ante = roomRegions.find((r) => r.purpose === "antechamber"), boss = roomRegions.find((r) => r.purpose === "boss");
if (ante && boss) {
  const s2 = flood(ante);
  const leak = [...boss.cells].find((c) => s2[c]);
  if (leak !== undefined) errors.push(`the boss room "${boss.id}" can be reached without passing through the antechamber "${ante.id}" (e.g. at ${P(leak % W, (leak / W) | 0)}). The only way into the boss room must lead through the antechamber.`);
}
let pockets = 0;
for (let i = 0; i < W * H; i += 1) if (!seen[i] && isWalkFloor(i % W, (i / W) | 0) && walkable(i % W, (i / W) | 0)) pockets += 1;
if (pockets) warnings.push(`${pockets} walkable floor cells cannot be reached from the entrance (cut off by pieces or hazards).`);
const locked = doors.filter((d) => d.locked);
const stats = { w: W, h: H, theme: L.theme, rooms: roomRegions.length, corridors: corridors.length, doors: doors.length, locked: locked.length, hazards: (L.hazards ?? []).length, pieces: stamped.length, chests: chests.length, pockets,
  floorCells: [...owner].filter((o) => o >= 0).length };
if (errors.length || !render) done({ stats });

// ---- render ----
const { renderReviewMapPng } = await import("../../qa-game/render.mts");
const { createBuildRun } = await import("../../../src/ai/v2/buildRun");
const { resolveGraphic } = await import("../../../src/editor/tools/eventCompile");
const { upsertEventIntoMap } = await import("../../../src/editor/tools/eventTools");
const id = "bbox-dungeon";
const start = project.maps[project.startMapId]!;
project.maps[id] = { ...structuredClone(start), id, name: L.name ?? "bbox dungeon", width: W, height: H, tilesetId: ts.id, tileSize: ts.tileSize,
  lowerTiles: lower, upperTiles: upper, lowerOverlayTiles: new Array(W * H).fill(-1), upperOverlayTiles: new Array(W * H).fill(-1), events: [], climate: { mode: "indoor" } } as GameMap;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax", "locations"]) delete (project.maps[id] as any)[k];
project.mapTree.children.push({ mapId: id, children: [] });
const ctx = { project, currentMapId: id, assistantRun: true } as never as { project: typeof project; currentMapId: string };
const run = createBuildRun(ctx as never);
for (const c of chests) { const r = run.call("place_chest", { mapId: id, x: c.x, y: c.y, contents: { gold: 50 } }) as { ok?: boolean; summary?: string }; if (!r.ok) warnings.push(`chest ${P(c.x, c.y)} not placed: ${String(r.summary).slice(0, 80)}`); }
const bars = resolveGraphic({ textureKey: "tex_easyrpg_charset_object1", characterIndex: 5 } as never);
const fixedMove = { type: "fixed" } as never;
const m = ctx.project.maps[id]!;
locked.forEach((d, k) => upsertEventIntoMap(m, { id: `ev_locked_${k}`, name: "잠긴 문", x: d.x, y: d.y, trigger: { kind: "action" }, commands: [], pages: [
  { id: `ev_locked_${k}_p1`, name: "잠긴 문", conditions: [], graphic: bars, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: fixedMove, commands: [] }] } as unknown as GameEvent));
writeFileSync(resolve(outDir, "map.png"), renderReviewMapPng(ctx.project, m, 1).png as Buffer);
writeFileSync(resolve(outDir, "stamped.json"), JSON.stringify(stamped));
done({ stats, rendered: true });
