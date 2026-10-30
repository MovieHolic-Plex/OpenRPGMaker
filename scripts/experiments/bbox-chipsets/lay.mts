// bbox-chipsets: execute a model-written bbox layout exactly, on ANY chipset with a room role table (effective spec = roomKit + chipset kits).
//   bun scripts/experiments/bbox-chipsets/lay.mts <tilesetId> <layout.json> <out dir> <base dir> [--render]
// Prints {ok, errors[], warnings[]} (English, for the repair call). With --render and no errors it writes the map into
// a copy of the base project (<base>/before.json, assets in <base>/assets), saves <out>/after.json and renders <out>/map.png (1x, review render).
// The model decided every cell; this code only translates rects → plan rows and placements → buildHandInteriorLayers input.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorTable } from "../../../src/editor/handInterior/builder";
import { effectiveSpec } from "./spec.mts";
import { indoorSpace, indoorProblems, boxRegions } from "./space.mts";
import { footprints, typesOf } from "./measure.mts";
import { tatamiTiling, tatamiSizes, floorReport } from "./floors.mts";

const [TS, lf, outDir, baseDir] = process.argv.slice(2);
const render = process.argv.includes("--render");
if (!TS || !lf || !outDir || !baseDir) throw Error("lay.mts <tilesetId> <layout.json> <out dir> <base dir> [--render]");
const { loadHeadlessProject } = await import("../../../src/headless/index");
const base = loadHeadlessProject(readFileSync(resolve(baseDir, "before.json"), "utf8"));
const tileset = base.tilesets[TS];
const S = effectiveSpec(tileset);
if (!tileset || !S) throw Error(`no room spec for ${TS}`);
mkdirSync(outDir, { recursive: true });
const L = JSON.parse(readFileSync(lf, "utf8"));
const errors: string[] = [], warnings: string[] = [];
const num = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const W = L.map?.w, H = L.map?.h;
const done = (extra: Record<string, unknown> = {}) => { const r = { ok: errors.length === 0, errors, warnings, ...extra }; writeFileSync(resolve(outDir, "check.json"), JSON.stringify(r, null, 1)); console.log(JSON.stringify(r)); process.exit(0); };
if (!num(W) || !num(H) || W < 5 || H < 5 || W > 60 || H > 60) { errors.push(`map.w/map.h must be integers 5..60 (got ${W}x${H}).`); done(); }

const grid: string[][] = Array.from({ length: H }, () => Array(W).fill("#"));
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
const regions: any[] = Array.isArray(L.regions) ? L.regions : [];
if (!regions.length) errors.push("No regions: give at least one region rect.");
for (const r of regions) {
  const tag = `region "${r.id}"`;
  if (![r.x, r.y, r.w, r.h].every(num) || r.w < 1 || r.h < 1) { errors.push(`${tag}: x,y,w,h must be integers, w,h >= 1.`); continue; }
  if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) errors.push(`${tag} rect (${r.x},${r.y},${r.w}x${r.h}) is out of bounds of the ${W}x${H} map.`);
  if (!S.floors[r.floor]) errors.push(`${tag}: unknown floor id "${r.floor}". Use one of the catalog floor ids (part after 'floor:').`);
  if (!S.walls[r.wall]) errors.push(`${tag}: unknown wall id "${r.wall}". Use one of the catalog wall ids (part after 'wall:').`);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(x, y)) grid[y]![x] = ".";
}
const openings: any[] = Array.isArray(L.openings) ? L.openings : [];
for (const o of openings) {
  const w = o.w ?? 1, h = o.h ?? 1;
  if (![o.x, o.y, w, h].every(num)) { errors.push(`opening ${JSON.stringify(o)}: x,y (and optional w,h) must be integers.`); continue; }
  for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) { if (inMap(x, y)) grid[y]![x] = "."; else errors.push(`opening cell (${x},${y}) is out of bounds.`); }
}
const ent = L.entrance;
if (!ent || !num(ent.x) || !num(ent.y)) errors.push("entrance {x,y} is missing.");
else if (ent.y !== H - 1) errors.push(`entrance (${ent.x},${ent.y}) must be on the bottom map row y=${H - 1}.`);
else if (!inMap(ent.x, ent.y)) errors.push(`entrance (${ent.x},${ent.y}) is out of bounds.`);
else { grid[ent.y]![ent.x] = "."; if (!inMap(ent.x, ent.y - 1) || grid[ent.y - 1]![ent.x] !== ".") errors.push(`entrance (${ent.x},${ent.y}) must sit directly below a region cell (${ent.x},${ent.y - 1}).`); }
// bottom row: only the entrance may be open (the builder treats any open bottom-row cell as an exit)
for (let x = 0; x < W; x++) if (grid[H - 1]![x] === "." && !(ent && x === ent.x)) errors.push(`cell (${x},${H - 1}) on the bottom map row is open but is not the entrance — keep the bottom row solid except the entrance (end regions at y <= ${H - 2}).`);

// placements → builder input (in the order the model wrote them; landmark first)
type P = { id: string; x: number; y: number; purpose?: string };
const expand = (o: any): P[] => {
  const n = o.repeat?.count ?? o.repeat?.n ?? 1, dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0;
  return Array.from({ length: Math.max(1, n) }, (_, i) => ({ id: o.id, x: o.x + i * dx, y: o.y + i * dy, purpose: o.purpose }));
};
const objs: P[] = [];
const tables: HandInteriorTable[] = [];
for (const o of [...(L.landmark ? [L.landmark] : []), ...(Array.isArray(L.objects) ? L.objects : [])]) {
  if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) { errors.push(`object ${JSON.stringify(o).slice(0, 80)}: needs id, integer x, y.`); continue; }
  const sized = /^([a-z][a-z0-9-]*) (\d+)x(\d+)$/u.exec(o.id);
  if (!S.objects[o.id] && sized && S.tables[sized[1]!]) { for (const p of expand(o)) tables.push({ style: sized[1]!, x: p.x, y: p.y, w: Number(sized[2]), h: Number(sized[3]) }); continue; }
  if (!S.objects[o.id]) { errors.push(`unknown catalog id "${o.id}" at (${o.x},${o.y}) — use an exact id from the catalog.`); continue; }
  objs.push(...expand(o));
}
const lines: { id: string; rect: { x0: number; y0: number; x1: number; y1: number } }[] = [];
for (const c of Array.isArray(L.carpets) ? L.carpets : []) {
  if (!S.lines[c.id] || S.lines[c.id]!.kind !== "flat") { errors.push(`unknown carpet id "${c.id}".`); continue; }
  if (![c.x, c.y, c.w, c.h].every(num)) { errors.push(`carpet ${c.id}: x,y,w,h must be integers.`); continue; }
  lines.push({ id: c.id, rect: { x0: c.x, y0: c.y, x1: c.x + c.w - 1, y1: c.y + c.h - 1 } });
}
const daises: { id: string; x: number; y: number; w: number; h: number }[] = [];
for (const d of Array.isArray(L.daises) ? L.daises : []) {
  if (!S.daises[d.id]) { errors.push(`unknown dais id "${d.id}" — use one of ${Object.keys(S.daises).join(", ")}.`); continue; }
  if (![d.x, d.y, d.w, d.h].every(num)) { errors.push(`dais ${d.id}: x,y,w,h must be integers.`); continue; }
  daises.push({ id: d.id, x: d.x, y: d.y, w: d.w, h: d.h });
}
for (const p of objs) {
  const d = S.objects[p.id]; const w = d?.w ?? 1, h = Math.max(1, d?.h ?? 1);
  if (p.x < 0 || p.y < 0 || p.x + w > W || p.y + h > H) errors.push(`"${p.id}" at (${p.x},${p.y}) (${w}x${h}) is out of bounds of the ${W}x${H} map.`);
}
if (errors.length) done();

const plan = grid.map((r) => r.join(""));
const zones = regions.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1, floor: r.floor, wall: r.wall }));
// thresholds: an opening / the entrance lies outside every region, so the builder gave it the first region's floor — a third material
// in the doorway. Each opening cell takes the floor of the region it opens onto (below, else above, else left, else right).
const regionAt = (x: number, y: number) => { let hit: any = null; for (const r of regions) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = r; return hit; };
let thresholds = 0;
for (const o of [...openings.flatMap((o: any) => Array.from({ length: (o.w ?? 1) * (o.h ?? 1) }, (_, k) => ({ x: o.x + (k % (o.w ?? 1)), y: o.y + Math.floor(k / (o.w ?? 1)) }))), ...(ent ? [ent] : [])]) {
  if (regionAt(o.x, o.y)) continue;
  const side = regionAt(o.x, o.y + 1) ?? regionAt(o.x, o.y - 1) ?? regionAt(o.x - 1, o.y) ?? regionAt(o.x + 1, o.y);
  if (side) { zones.push({ x0: o.x, y0: o.y, x1: o.x, y1: o.y, floor: side.floor, wall: side.wall }); thresholds++; }
}
// tatami "jo" (optional): a jo is one 1x2-cell mat
for (const r of regions) if (r.floor === "tatami" && r.jo !== undefined) {
  const cells = r.w * Math.max(0, r.h - 2);
  if (!num(r.jo) || cells !== 2 * r.jo) errors.push(`floor: region "${r.id}" says ${r.jo} jo but its tatami floor is ${r.w}x${r.h - 2} = ${cells} cells; a jo is one 1x2-cell mat, so ${r.jo} jo needs ${2 * r.jo} floor cells (${tatamiSizes(2 * r.jo) || "pick another jo"}). Resize the region (its floor rows = h - 2) or change "jo".`);
}
const input: HandInteriorInput = { plan, floor: regions[0].floor, wall: regions[0].wall, zones, objects: objs.map(({ id, x, y }) => ({ id, x, y })), tables, lines, daises, start: ent ? [{ x: ent.x, y: ent.y }] : undefined };

const built = buildHandInteriorLayers(input, tileset, S);
const EN: Record<string, (m: string) => string> = {
  overlap: () => "two pieces overlap on this cell — move one of them",
  "not-on-floor": () => "this footprint cell is not walkable floor (it is solid or a wall-face row: the top two rows under any solid cell are wall face)",
  "hang-not-on-face": () => "wall-mounted piece must be on the UPPER wall-face row (the first row below a solid cell)",
  "wall-piece-needs-face": () => "against-wall piece must stand on the first floor row directly below a north wall face",
  "stairs-not-at-wall": () => "stairs up must stand on the first floor row directly below a north wall face",
  "table-one-row": () => "counter/kcounter can only be 1 row tall",
  "out-of-bounds": () => "piece art goes out of the map",
  "no-entrance": () => "the entrance cell is blocked or not walkable",
  "door-not-in-gap": () => "a door must sit in a 1-cell opening of a horizontal solid wall (solid cells left and right, a room above, floor for two rows below)",
  "sidedoor-not-in-gap": () => "a side door must sit on the bottom (walkable) cell of a 3-cell-tall opening in a vertical solid wall",
  "stair-entrance-blocked": () => "the stairs' entry side cell is not floor — open the side it is entered from",
  "invalid-table": () => "sized piece has an invalid size",
  "table-piece": () => "sized piece cannot be drawn at this size",
  "unknown-object": () => "unknown piece id",
  "goods-needs-surface": () => "tabletop item needs a table/counter under it",
  "flat-stacked": () => "two floor decals on the same cell",
};
const who = (x?: number, y?: number) => {
  if (x === undefined || y === undefined) return "";
  const hit = objs.filter((p) => { const d = S.objects[p.id]; const s = /^([a-z]+) (\d+)x(\d+)$/u.exec(p.id); const w = d?.w ?? Number(s?.[2] ?? 1), h = Math.max(1, d?.h ?? Number(s?.[3] ?? 1)); return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h; });
  return hit.length ? ` [${hit.map((p) => `"${p.id}"@(${p.x},${p.y})`).join(", ")}]` : "";
};
for (const i of built.issues) {
  const at = i.x !== undefined ? ` at (${i.x},${i.y})` : "";
  const txt = (EN[i.code]?.(i.message) ?? `${i.code} (${i.message.replace(/[^\x00-\x7F]+/g, " ").replace(/\s+/g, " ").trim()})`) + at + who(i.x, i.y);
  if (i.severity === "error") errors.push(txt);
  else if (i.code === "unreached-floor") warnings.push(`${built.unreachedFloor.length} floor cells are not reachable from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => `(${c.x},${c.y})`).join(" ")}) — furniture blocks the way or a region is closed off (vertical-wall openings need 3 cells tall; the bottom one is the walkable one)`);
  else if (i.code === "unreachable-piece") warnings.push(`a piece has no reachable side: ${i.message.replace(/[^\x00-\x7F]+/g, "").trim()}`);
  else if (i.severity === "warning" && i.code !== "too-many-layers") warnings.push(`${i.code}${at}${who(i.x, i.y)}`);
  else if (i.code === "too-many-layers") warnings.push(`too many stacked pieces${at}${who(i.x, i.y)}`);
}
// tatami: lay whole mats per connected tatami area (edge-aligned, no four corners meeting) instead of the floor's 4x4 wallpaper,
// which tiles from the map origin and cuts mats at every wall. The floor's own pattern holds the mat halves: (0,0)|(1,0) = horizontal mat, (2,0)/(2,1) = vertical.
const TAT = S.floors.tatami;
let tatamiMats = 0;
if (TAT && TAT.cols === 4) {
  const pos = new Map<number, number>(); TAT.tiles.forEach((t, k) => pos.set(t, k));
  const W2 = built.width, isT = (i: number) => pos.has(built.lowerTiles[i]!);
  const seen = new Set<number>();
  for (let i = 0; i < built.lowerTiles.length; i++) if (isT(i) && !seen.has(i)) {
    const comp = new Set<number>(), q = [i]; seen.add(i);
    while (q.length) { const c = q.pop()!; comp.add(c); for (const n of [c - 1, c + 1, c - W2, c + W2]) if (n >= 0 && n < built.lowerTiles.length && Math.abs((n % W2) - (c % W2)) <= 1 && isT(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
    const mats = tatamiTiling(comp, W2);
    const xs = [...comp].map((c) => c % W2), ys = [...comp].map((c) => Math.floor(c / W2));
    const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
    const who = regions.find((r: any) => r.floor === "tatami" && xs[0]! >= r.x && xs[0]! < r.x + r.w && ys[0]! >= r.y && ys[0]! < r.y + r.h)?.id ?? "?";
    if (!mats) { errors.push(`floor: region "${who}" has a tatami floor of ${comp.size} cells (${bw}x${bh} around x ${Math.min(...xs)}, y ${Math.min(...ys)}) that cannot be laid with whole mats (each mat is 1x2 cells, no four mat corners meeting, mats aligned to the walls). Resize its floor to an even rectangle such as 4x4, 4x6 or 6x6 cells (floor rows = region h - 2), or pick another floor.`); continue; }
    const put = (c: number, k: number) => { const sh = pos.get(built.lowerTiles[c]!)! % 4; built.lowerTiles[c] = TAT.tiles[k * 4 + sh]!; };
    for (const m of mats) { if (m.dir === "h") { put(m.a, 0); put(m.b, 1); } else { put(m.a, 2); put(m.b, 6); } }
    tatamiMats += mats.length;
  }
}
// soft floor checks (warnings): one dominant floor per room + at most one sub-zone, single-cell islands
const floorAt = (x: number, y: number) => {
  if (plan[y]?.[x] !== "." || plan[y - 1]?.[x] === "#" || plan[y - 2]?.[x] === "#" || y === H - 1) return null;
  let f: string | null = null; for (const z of zones) if (z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1) f = z.floor; return f;
};
const par = regions.map((_: any, i: number) => i); const fnd = (i: number): number => (par[i] === i ? i : (par[i] = fnd(par[i])));
regions.forEach((a: any, i: number) => regions.forEach((b: any, j: number) => { if (j > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) par[fnd(i)] = fnd(j); }));
const groups = new Map<number, { id: string; cells: number[] }>();
regions.forEach((r: any, i: number) => { const g = groups.get(fnd(i)) ?? groups.set(fnd(i), { id: r.id, cells: [] }).get(fnd(i))!; if (g.id !== r.id && !g.id.includes(r.id)) g.id += `+${r.id}`;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g.cells.push(y * W + x); });
for (const g of groups.values()) g.cells = [...new Set(g.cells)];
const fr = floorReport(W, H, floorAt, [...groups.values()]);
warnings.push(...fr.warnings);
const structOk = errors.length === 0;
// size/space checks (space.mts): only measured once the structure is valid, named as "space:" errors so the repair call can shrink or fill
const space = indoorSpace(plan, footprints(S, objs, tables, daises), regions.map((r: any) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })));
// sketch arm: a room drawn as one letter is cut into several rectangles; judge space per room (a 1-row notch strip is not a room of its own)
if (L.regionRoom && typeof L.regionRoom === "object") {
  const by = new Map<string, any[]>();
  for (const r of space.rooms) { const k = L.regionRoom[r.id] ?? r.id; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
  space.rooms = [...by.entries()].map(([id, rs]) => {
    const floor = rs.reduce((a, r) => a + r.floor, 0), bare = rs.reduce((a, r) => a + r.bare, 0);
    const largest = rs.map((r) => r.largest).filter(Boolean).sort((a: any, b: any) => b.w * b.h - a.w * a.h)[0] ?? null;
    const x0 = Math.min(...rs.map((r) => r.rect.x)), y0 = Math.min(...rs.map((r) => r.rect.y)), x1 = Math.max(...rs.map((r) => r.rect.x + r.rect.w)), y1 = Math.max(...rs.map((r) => r.rect.y + r.rect.h));
    return rs.length === 1 ? rs[0] : { id, floor, bare, emptyPct: floor ? Math.round((100 * bare) / floor) : 0, largest, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, used: null };
  });
}
if (structOk) errors.push(...indoorProblems(space));
const types = typesOf(S, [...objs.map((p) => p.id), ...tables.map((t) => `${t.style} ${t.w}x${t.h}`)]);
const boxes = boxRegions(regions, plan, daises);
const stats = { w: W, h: H, plan, boxRegions: boxes, regionCount: regions.length, boxPct: regions.length ? Math.round((100 * boxes) / regions.length) : null, reachable: built.reachable, floorCells: built.floorCells, objects: objs.length, emptyPct: space.total.emptyPct,
  rooms: space.rooms.map((r) => ({ id: r.id, emptyPct: r.emptyPct, largest: r.largest })), types: types.length, thresholds, tatamiMats, floorIslands: fr.islands, floorMix: fr.mix };
if (!structOk || !render) done({ stats, structOk });

const { addRenderAssetRoot, renderReviewMapPng } = await import("../../qa-game/render.mts");
const { store } = await import("../../../src/project/store");
addRenderAssetRoot(resolve(baseDir, "assets"));
const id = "bbox-room";
base.maps[id] = { ...structuredClone(Object.values(base.maps)[0]), id, name: L.name ?? "bbox room", width: built.width, height: built.height,
  tilesetId: TS, tileSize: tileset.tileSize, lowerTiles: built.lowerTiles, upperTiles: built.upperTiles,
  lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles, events: [], climate: { mode: "indoor" } } as any;
for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "background", "parallax"]) delete (base.maps[id] as any)[k];
base.mapTree.children.push({ mapId: id, children: [] });
store.replaceProject(base);
const cur = store.getCurrent();
writeFileSync(resolve(outDir, "map.png"), renderReviewMapPng(cur, cur.maps[id]!, 1).png as Buffer);
writeFileSync(resolve(outDir, "after.json"), JSON.stringify(cur));
done({ stats, structOk, rendered: true });
