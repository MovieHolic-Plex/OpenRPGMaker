// bbox-chipsets: execute a model-written OUTDOOR layout exactly on a chipset without a room role table (joseon_baram etc.):
//   base ground + ground rects (autotile edges by the engine's shapeAllAutotileGroupsAround) + whole kits stamped at their art-box top-left.
//   bun lay_outdoor.mts <tilesetId> <layout.json> <out dir> <base dir> [--render]     prints {ok, errors[], warnings[]} (English)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { shapeAllAutotileGroupsAround } from "../../../src/project/defaults/autotileEngine";
import { passabilityOf } from "../../../src/project/collision";
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
const paint = (gid: string, x0: number, y0: number, w: number, h: number, tag: string) => {
  const g = grounds.get(gid);
  if (!g) { errors.push(`${tag}: unknown ground id "${gid}" — use a ground id from the catalog.`); return; }
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (g.auto) { map.lowerTiles[y * W + x] = g.auto.variantMap[String(g.auto.neighborhood === 8 ? 255 : 15)]; (autoPts.get(g.auto) ?? autoPts.set(g.auto, []).get(g.auto)!).push({ x, y }); }
    else map.lowerTiles[y * W + x] = g.tiles[hash(x, y) % g.tiles.length]!;
  }
};
paint(L.base, 0, 0, W, H, "base");
for (const r of Array.isArray(L.grounds) ? L.grounds : []) {
  if (![r.x, r.y, r.w, r.h].every(num)) { errors.push(`ground ${JSON.stringify(r).slice(0, 80)}: x,y,w,h must be integers.`); continue; }
  if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) errors.push(`ground "${r.id}" rect (${r.x},${r.y},${r.w}x${r.h}) is out of bounds of the ${W}x${H} map.`);
  paint(r.id, r.x, r.y, r.w, r.h, `ground "${r.id}"`);
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
const stats = { w: W, h: H, walkable, reached, objects: placed.length };
if (!render) done({ stats });
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
done({ stats, rendered: true });
