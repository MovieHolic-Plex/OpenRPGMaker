// bbox-chipsets: execute a model-written OUTDOOR layout exactly on a chipset without a room role table (joseon_baram etc.):
//   base ground + ground rects (autotile edges by the engine's shapeAllAutotileGroupsAround) + whole kits stamped at their art-box top-left.
//   bun lay_outdoor.mts <tilesetId> <layout.json> <out dir> <base dir> [--render]     prints {ok, errors[], warnings[]} (English)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { shapeAllAutotileGroupsAround } from "../../../src/project/defaults/autotileEngine";
import { passabilityOf } from "../../../src/project/collision";
import { outdoorSpace, outdoorProblems } from "./space.mts";
import { rasterShape, applyEdge, rasterPath, pathCentre, seedOf } from "./shapes.mts";
import { floorReport } from "./floors.mts";
const [TS, lf, outDir, baseDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
mkdirSync(outDir!, { recursive: true });
const L = JSON.parse(readFileSync(lf!, "utf8"));
const errors: string[] = [], warnings: string[] = [];
const done = (extra: Record<string, unknown> = {}) => { const r = { ok: errors.length === 0, errors, warnings, ...extra }; writeFileSync(resolve(outDir!, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
const num = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const W = L.map?.w, H = L.map?.h;
if (!num(W) || !num(H) || W < 8 || H < 8 || W > 80 || H > 80) { errors.push(`map.w/map.h must be integers 8..80 (got ${W}x${H}).`); done(); }
const { loadHeadlessProject } = await import("../../../src/headless/index");
const base = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
const t = base.tilesets[TS!]!;
const autoByMember = new Map<number, any>();
for (const g of Object.values(t.autotileGroups ?? {}) as any[]) for (const m of g.memberTileIds ?? []) autoByMember.set(m, g);
const grounds = new Map<string, { tiles: number[]; auto: any }>();
for (const g of (t.tileGroups ?? []) as any[]) if (["terrain", "water"].includes(g.role) && g.tileIds?.length) grounds.set(g.id.replace(/^[a-z]+:/u, ""), { tiles: g.tileIds, auto: autoByMember.get(g.tileIds[0]) ?? null });
const kits = new Map<string, any>(); for (const k of t.structureKits ?? []) kits.set(k.id, k);
const map = { width: W, height: H, lowerTiles: Array(W * H).fill(-1) as number[], upperTiles: Array(W * H).fill(-1) as number[] };
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const autoPts = new Map<any, { x: number; y: number }[]>();
const groundAt = new Array<string>(W * H).fill("");
// earth grounds (dirt yard / dirt road autotiles) have grass-rimmed edge art: two different earth grounds side by side draw a green seam
// through bare dirt (round 3 sol2: yard16 paths over a yard64 base became a maze of green lines). Dirt painted over dirt is left as it was.
const EARTH = /^(yard|yard16|yard64|road16|road64|slab_dirt)$/u;
const earthSkips = new Map<string, number>();
const paintCells = (gid: string, cells: Iterable<number>, tag: string) => {
  const g = grounds.get(gid);
  if (!g) { errors.push(`${tag}: unknown ground id "${gid}" — use a ground id from the catalog.`); return; }
  for (const i of cells) {
    const x = i % W, y = Math.floor(i / W); if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const was = groundAt[i]!;
    if (was && was !== gid && EARTH.test(was) && EARTH.test(gid)) { const k = `${tag} over "${was}"`; earthSkips.set(k, (earthSkips.get(k) ?? 0) + 1); continue; }
    groundAt[i] = gid;
    if (g.auto) { map.lowerTiles[i] = g.auto.variantMap[String(g.auto.neighborhood === 8 ? 255 : 15)]; (autoPts.get(g.auto) ?? autoPts.set(g.auto, []).get(g.auto)!).push({ x, y }); }
    else map.lowerTiles[i] = g.tiles[hash(x, y) % g.tiles.length]!;
  }
};
const rectCells = (x0: number, y0: number, w: number, h: number) => { const c: number[] = []; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) c.push(y * W + x); return c; };
paintCells(L.base, rectCells(0, 0, W, H), "base");
// ground zones: a rect (x,y,w,h) or a free shape {"shape": {rect|poly|ellipse|blob}, "edge": "smooth"|"rough"} — irregular outlines, autotile grounds blend at the edge
const openRectsG: { x: number; y: number; w: number; h: number }[] = [];
for (const r of Array.isArray(L.grounds) ? L.grounds : []) {
  if (r.shape) {
    const rs = rasterShape(r.shape, W, H);
    if (rs.error) { errors.push(`ground "${r.id}": ${rs.error}.`); continue; }
    const cells = applyEdge(rs.cells, r.edge, seedOf(`${r.id}:${JSON.stringify(r.shape)}`), W, H).cells;
    paintCells(r.id, cells, `ground "${r.id}"`);
    if (r.open === true && cells.size) { const xs = [...cells].map((c) => c % W), ys = [...cells].map((c) => Math.floor(c / W)); openRectsG.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }); }
    continue;
  }
  if (![r.x, r.y, r.w, r.h].every(num)) { errors.push(`ground ${JSON.stringify(r).slice(0, 80)}: give x,y,w,h integers or a "shape".`); continue; }
  if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) errors.push(`ground "${r.id}" rect (${r.x},${r.y},${r.w}x${r.h}) is out of bounds of the ${W}x${H} map.`);
  paintCells(r.id, rectCells(r.x, r.y, r.w, r.h), `ground "${r.id}"`);
  if (r.open === true) openRectsG.push({ x: r.x, y: r.y, w: r.w, h: r.h });
}
// paths: the model draws the line, this code renders it. {"ground": id, "points": [[x,y],...], "width": 1-3, "curve": bool} paints a continuous path;
// {"stones": kit id, "points": [...], "spacing": 2-4, "curve": bool} sets stepping stones at an even spacing along the line (after all pieces, never over them).
const stonePaths: { kit: any; id: string; cells: [number, number][]; spacing: number }[] = [];
for (const p of Array.isArray(L.paths) ? L.paths : []) {
  const pts = Array.isArray(p?.points) ? p.points : [];
  if (pts.length < 2 || !pts.every((v: any) => Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]))) { errors.push(`path ${JSON.stringify(p).slice(0, 80)}: needs "points": [[x,y],[x,y],...] (2 or more).`); continue; }
  if (typeof p.ground === "string") paintCells(p.ground, rasterPath(pts, Math.max(1, Math.min(3, p.width ?? 1)), !!p.curve, W, H), `path ground "${p.ground}"`);
  else if (typeof p.stones === "string") { const k = kits.get(p.stones); if (!k) { errors.push(`path stones: unknown kit id "${p.stones}".`); continue; } stonePaths.push({ kit: k, id: p.stones, cells: pathCentre(pts, !!p.curve, W, H), spacing: Math.max(2, Math.min(4, p.spacing ?? 2)) }); }
  else errors.push(`path ${JSON.stringify(p).slice(0, 80)}: give "ground": <ground id> or "stones": <kit id>.`);
}
for (const [g, pts] of autoPts) shapeAllAutotileGroupsAround(map, [g], pts);
// pieces
const owner = new Map<number, string>();
const placed: { id: string; x: number; y: number; k: any }[] = [];
for (const o of [...(L.landmark ? [L.landmark] : []), ...(Array.isArray(L.objects) ? L.objects : [])]) {
  if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) { errors.push(`object ${JSON.stringify(o).slice(0, 80)}: needs id, integer x, y.`); continue; }
  const k = kits.get(o.id);
  if (!k) { errors.push(`unknown catalog id "${o.id}" at (${o.x},${o.y}) — use an exact id from the catalog.`); continue; }
  const n = o.repeat?.count ?? 1, dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0;
  for (let i = 0; i < Math.max(1, n); i++) placed.push({ id: o.id, x: o.x + i * dx, y: o.y + i * dy, k });
}
for (const p of placed) {
  const label = `"${p.id}"@(${p.x},${p.y})`;
  if (p.x < 0 || p.y < 0 || p.x + p.k.width > W || p.y + p.k.rows.length > H) { errors.push(`${label} (${p.k.width}x${p.k.rows.length}) is out of bounds of the ${W}x${H} map.`); continue; }
  p.k.rows.forEach((row: any, ry: number) => { for (let rx = 0; rx < p.k.width; rx++) {
    const lo = row.tiles?.[rx] ?? -1, up = row.upperTiles?.[rx] ?? -1;
    if (lo < 0 && up < 0) continue;
    const i = (p.y + ry) * W + p.x + rx, had = owner.get(i);
    if (had && had !== label) errors.push(`two pieces overlap at (${p.x + rx},${p.y + ry}): ${had} and ${label} — move one of them (only '.' cells of a piece may share a cell)`);
    owner.set(i, label);
    if (lo >= 0) map.lowerTiles[i] = lo; if (up >= 0) map.upperTiles[i] = up;
  } });
}
// stepping stones: even spacing along each drawn line, skipped where a piece already stands (never moved, never overlapping)
let stonesSet = 0, stonesSkipped = 0;
for (const sp of stonePaths) for (let k = 0; k < sp.cells.length; k += sp.spacing) {
  const [x, y] = sp.cells[k]!, rows = sp.kit.rows, kw = sp.kit.width;
  if (x + kw > W || y + rows.length > H) { stonesSkipped++; continue; }
  let free = true;
  rows.forEach((row: any, ry: number) => { for (let rx = 0; rx < kw; rx++) if (((row.tiles?.[rx] ?? -1) >= 0 || (row.upperTiles?.[rx] ?? -1) >= 0) && owner.has((y + ry) * W + x + rx)) free = false; });
  if (!free) { stonesSkipped++; continue; }
  const label = `"${sp.id}"@(${x},${y}) path`;
  rows.forEach((row: any, ry: number) => { for (let rx = 0; rx < kw; rx++) { const lo = row.tiles?.[rx] ?? -1, up = row.upperTiles?.[rx] ?? -1; if (lo < 0 && up < 0) continue;
    const i = (y + ry) * W + x + rx; owner.set(i, label); if (lo >= 0) map.lowerTiles[i] = lo; if (up >= 0) map.upperTiles[i] = up; } });
  placed.push({ id: sp.id, x, y, k: sp.kit }); stonesSet++;
}
// soft ground checks: single-cell ground islands, hard edges between two non-autotile grounds (they draw a straight seam)
const fr = floorReport(W, H, (x, y) => groundAt[y * W + x] || null, []);
warnings.push(...fr.warnings.map((w) => w.replace("floor:", "ground:").replace("floor island", "ground island")));
let hardEdges = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
  const a = groundAt[y * W + x], b = x + dx < W && y + dy < H ? groundAt[(y + dy) * W + x + dx] : "";
  if (a && b && a !== b && !grounds.get(a)?.auto && !grounds.get(b)?.auto && !owner.has(y * W + x) && !owner.has((y + dy) * W + x + dx)) hardEdges++;
}
for (const [k, n] of earthSkips) warnings.push(`ground: ${k}: ${n} cells left unpainted — two dirt grounds next to each other draw a grass-rimmed seam through the dirt, so dirt is never painted over dirt. Across a dirt yard use a stepping-stone path ("stones"); dirt paths and dirt zones belong on grass.`);
if (hardEdges > 12) warnings.push(`ground: ${hardEdges} cell edges are straight seams between two non-autotile grounds (e.g. grass next to paving) — for zones on open ground use an autotile ground (marked "autotile edges") or a "shape" so the outline blends.`);
const ent = L.entrance;
const pass = (x: number, y: number) => passabilityOf(t, map.lowerTiles[y * W + x]!, -1, map.upperTiles[y * W + x]!, -1);
const walk = (x: number, y: number) => { const q = pass(x, y); return q.up || q.down || q.left || q.right; };
if (!ent || !num(ent.x) || !num(ent.y) || !(ent.x === 0 || ent.y === 0 || ent.x === W - 1 || ent.y === H - 1)) errors.push("entrance {x,y} must be a cell on the map edge.");
else if (!walk(ent.x, ent.y)) errors.push(`entrance (${ent.x},${ent.y}) is not walkable${owner.get(ent.y * W + ent.x) ? ` — covered by ${owner.get(ent.y * W + ent.x)}` : ""}.`);
if (errors.length) done();
// reachability (engine passability flags, both sides must allow the step)
const seen = new Uint8Array(W * H); const q = [[ent.x, ent.y]]; seen[ent.y * W + ent.x] = 1;
const D = [[0, -1, "up", "down"], [0, 1, "down", "up"], [-1, 0, "left", "right"], [1, 0, "right", "left"]] as const;
while (q.length) { const [x, y] = q.pop()!; const a = pass(x!, y!) as any;
  for (const [ddx, ddy, f, b] of D) { const nx = x! + ddx, ny = y! + ddy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
    if (a[f] && (pass(nx, ny) as any)[b]) { seen[ny * W + nx] = 1; q.push([nx, ny]); } } }
let walkable = 0, reached = 0; const lost: string[] = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walk(x, y)) { walkable++; if (seen[y * W + x]) reached++; else if (lost.length < 6) lost.push(`(${x},${y})`); }
if (reached < walkable) warnings.push(`${walkable - reached} walkable cells are not reachable from the entrance (e.g. ${lost.join(" ")}) — walls or pieces close them off`);
for (const p of placed) if (p.k.ai?.role === "building") {
  const H2 = p.k.rows.length; let ok = false;
  for (let rx = 0; rx < p.k.width && !ok; rx++) { const x = p.x + rx, y = p.y + H2; if (y < H && seen[y * W + x]) ok = true; }
  if (!ok) warnings.push(`building "${p.id}"@(${p.x},${p.y}) has no reachable cell right below its front (door side)`);
}
const structOk = errors.length === 0;
const openRects = openRectsG;
if (openRects.length > 1) errors.push(`only one grounds rect may be the intentional open courtyard ("open": true); you marked ${openRects.length}.`);
const space = outdoorSpace(W, H, (x, y) => owner.has(y * W + x), walk, openRects.slice(0, 1));
errors.push(...outdoorProblems(space));
const types = new Set(placed.map((p) => p.id)).size;
// framed madang: share of the cells just outside the yard's open centre (the declared open courtyard, else the largest bare rect)
// that touch a purposeful piece (prop or building — not a wall run). Measured only; the open centre itself is allowed.
const purposeful = new Uint8Array(W * H);
for (const p of placed) if (["prop", "building"].includes(p.k.ai?.role)) p.k.rows.forEach((row: any, ry: number) => { for (let rx = 0; rx < p.k.width; rx++) {
  if ((row.tiles?.[rx] ?? -1) >= 0 || (row.upperTiles?.[rx] ?? -1) >= 0) { const x = p.x + rx, y = p.y + ry; if (x >= 0 && y >= 0 && x < W && y < H) purposeful[y * W + x] = 1; } } });
const madang = openRects[0] ?? space.largestAny;
let ring = 0, framed = 0;
if (madang) {
  const cells: [number, number][] = [];
  for (let x = madang.x; x < madang.x + madang.w; x++) cells.push([x, madang.y - 1], [x, madang.y + madang.h]);
  for (let y = madang.y; y < madang.y + madang.h; y++) cells.push([madang.x - 1, y], [madang.x + madang.w, y]);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    ring++;
    let hit = false; for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && purposeful[ny * W + nx]) { hit = true; break; } }
    if (hit) framed++;
  }
}
const stats = { w: W, h: H, walkable, reached, objects: placed.length, emptyPct: space.barePct, largest: space.largest, openBare: space.openBare, types, madang, edgeFramedPct: ring ? Math.round((100 * framed) / ring) : null, stonesSet, stonesSkipped, groundIslands: fr.islands, hardEdges, earthSkipped: [...earthSkips.values()].reduce((a, b) => a + b, 0) };
if (!render) done({ stats, structOk });
const { addRenderAssetRoot, renderReviewMapPng } = await import("../../qa-game/render.mts");
const { store } = await import("../../../src/project/store");
addRenderAssetRoot(resolve(baseDir!, "assets"));
const id = "bbox-room";
base.maps[id] = { ...structuredClone(Object.values(base.maps)[0]), id, name: L.name ?? "bbox place", width: W, height: H, tilesetId: TS, tileSize: t.tileSize,
  lowerTiles: map.lowerTiles, upperTiles: map.upperTiles, lowerOverlayTiles: Array(W * H).fill(-1), upperOverlayTiles: Array(W * H).fill(-1), events: [], climate: { mode: "outdoor" } } as any;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax", "terrainDesign"]) delete (base.maps[id] as any)[k];
base.mapTree.children.push({ mapId: id, children: [] });
store.replaceProject(base);
const cur = store.getCurrent();
writeFileSync(resolve(outDir!, "map.png"), renderReviewMapPng(cur, cur.maps[id]!, 1).png as Buffer);
writeFileSync(resolve(outDir!, "after.json"), JSON.stringify(cur));
done({ stats, structOk, rendered: true });
