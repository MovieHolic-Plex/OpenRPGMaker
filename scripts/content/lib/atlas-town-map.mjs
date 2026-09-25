// Town builder of tiledata/atlas-towns: the OutdoorMap of lib/outdoor-kit.mjs plus
//   - gable houses: every approved gable form (editor/gableHouseCompose, audited by the house-form rules) × house kit,
//     stamped whole with its door (359 two cells) and a door front that the road network must reach;
//   - fitted castle walls: a rectangle of the castle-town reference (wall ring, gate) shrunk *or grown* to any size;
//   - atlas town parts (forest_harmony 3311~, lib/atlas-town-parts.mjs): fountain, market stalls, festival lanterns and
//     bunting, fire and ash, scaffolding, steam, hide tents, totems and the docked sailing ship.
// Terrain and placement only — no events. Used by scripts/content/author-atlas-towns.mjs.
import fs from "node:fs";
import assert from "node:assert/strict";
import { OutdoorMap, loadKit, GROUND, WALKABLE_UPPER } from "./outdoor-kit.mjs";
import { ATLAS_PARTS } from "./atlas-town-parts.mjs";

export const CASTLE_TOWN = "src/project/regionReferences/castle-town.json";
const REF_GRASS = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332]);
const KEEP_UP = [18, 19, 20, 78, 80, 108, 109, 110, 24, 25, 54, 55, 179, 209];

// Cut a rectangle of an approved reference map and fit it to w×h: repeated columns/rows are dropped (shrink) or
// doubled (grow) in the middle of the longest identical run, so corners, gates and towers keep their shape.
export function carveFit(file, [x0, y0, x1, y1], w, h, { blank = [] } = {}) {
  const ref = JSON.parse(fs.readFileSync(file)).map, W = ref.width;
  let cols = [];
  for (let x = x0; x <= x1; x++) {
    const col = [];
    for (let y = y0; y <= y1; y++) {
      const inBlank = blank.some(([bx0, by0, bx1, by1]) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1);
      const lo = ref.lowerTiles[y * W + x], up = ref.upperTiles[y * W + x];
      col.push(inBlank ? [-1, -1] : [REF_GRASS.has(lo) ? -1 : lo, REF_GRASS.has(lo) && up >= 0 && !KEEP_UP.includes(up) ? -1 : up]);
    }
    cols.push(col);
  }
  const same = (a, b) => a.length === b.length && a.every((c, k) => c[0] === b[k][0] && c[1] === b[k][1]);
  const fit = (lines, target) => {
    while (lines.length !== target) {
      let best = -1, bestLen = 0;
      for (let i = 0; i < lines.length;) {
        let j = i; while (j + 1 < lines.length && same(lines[j + 1], lines[i])) j++;
        if (j - i + 1 > bestLen && (j > i || lines.length < target)) { bestLen = j - i + 1; best = i + ((j - i) >> 1); }
        i = j + 1;
      }
      assert(best >= 0, `Cannot fit ${file} to ${target}`);
      if (lines.length > target) lines.splice(best, 1); else lines.splice(best, 0, lines[best].map((c) => [...c]));
    }
    return lines;
  };
  // Keep the gate in the middle: fit the columns left and right of the source's middle separately.
  if (cols.length !== w) { const mid = cols.length >> 1, wl = w >> 1; cols = [...fit(cols.slice(0, mid), wl), ...fit(cols.slice(mid), w - wl)]; }
  let rows = cols[0].map((_, y) => cols.map((c) => c[y]));
  rows = fit(rows, h);
  return { w, h, lower: rows.flat().map((c) => c[0]), upper: rows.flat().map((c) => c[1]) };
}
// Column of a carved ring whose bottom row is the middle of its cobble gate.
export const gateColumn = (piece) => { const row = piece.lower.slice((piece.h - 1) * piece.w); const xs = row.map((t, x) => [t, x]).filter(([t]) => t === 190).map(([, x]) => x); return xs[xs.length >> 1]; };
export const gateSpan = (piece) => { const row = piece.lower.slice((piece.h - 1) * piece.w); const xs = row.map((t, x) => [t, x]).filter(([t]) => t === 190).map(([, x]) => x); return [xs[0], xs.at(-1) - xs[0] + 1]; };

export function loadTownKit(api, forestTileset) {
  const kit = loadKit(api);
  // The outdoor kit reads the diverse-village copy; the towns draw on the full bundled forest_harmony (house parts
  // 3060~, treetop 3131~, atlas parts 3311~). Same numbering below 2730.
  kit.ts = forestTileset;
  kit.gables = new Map(api.GABLE_HOUSE_FORM_SPECS.map((s) => [s.id, s]));
  kit.parts.push(...ATLAS_PARTS);
  for (const p of ATLAS_PARTS) if (p.passage === "passable") for (const row of p.upper) for (const t of row) if (t >= 0) WALKABLE_UPPER.add(t);
  return kit;
}

const BASE_KITS = new Set(["blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall"]);

// The towns' tilesets: the full bundled forest_harmony (diverse-village grafts + shared tails + atlas parts) and the
// four climate sheets, exactly as a project saved by save-atlas-towns.mjs carries them.
export async function townTilesets(api) {
  const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
  const p = api.createBlankProject();
  p.tilesets.forest_harmony = { ...structuredClone(village.tileset), referenceDocuments: p.tilesets.forest_harmony.referenceDocuments };
  api.ensureBundledTilesets(p);
  const tilesets = { forest_harmony: p.tilesets.forest_harmony };
  for (const k of ["snow", "volcano", "desert", "autumn"]) { const t = p.tilesets[`forest_harmony_${k}`] ?? api.createClimateVillageTileset(k); tilesets[t.id] = t; }
  return tilesets;
}


export class TownMap extends OutdoorMap {
  get climate() { return this.spec.tilesetId !== "forest_harmony"; }
  // A gable house (form id × kit id); accents (chimney, dormer, awning, finial) only on the forest sheet.
  gable(form, kitId, x, y, opt = {}) {
    const spec = this.kit.gables.get(form);
    assert(spec, "Unknown gable form " + form);
    if (this.climate) assert(BASE_KITS.has(kitId), `Kit ${kitId} needs the forest house parts (${this.spec.id})`);
    const accent = this.climate || opt.plain ? undefined : (opt.accent ?? (x * 73 + y * 31 + this.seed));
    const f = this.kit.api.composeGableHouseForm(spec, kitId, accent === undefined ? {} : { accentSeed: accent });
    const lower = [], upper = [];
    f.rows.forEach((r) => { lower.push(...r.tiles); upper.push(...(r.upperTiles ?? r.tiles.map(() => -1))); });
    for (const dy of [f.doorAt.y - 1, f.doorAt.y]) { lower[dy * f.w + f.doorAt.x] = 359; upper[dy * f.w + f.doorAt.x] = -1; }
    for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) {
      const i = this.at(x + dx, y + dy);
      assert(this.inside(x + dx, y + dy) && this.bare(i) && !this.water.has(i) && !this.occupied.has(i) && !this.paved.has(i) && !this.roads.has(i), `House overlaps ${this.spec.id} ${form} ${x + dx},${y + dy}`);
    }
    const key = `${form}:${kitId}`;
    this.kit.houses[key] ??= { template: key, label: spec.name, w: f.w, h: f.h, lower, upper, door: { ...f.doorAt }, front: { x: f.doorAt.x, y: f.doorAt.y + 1 } };
    for (let dy = 0; dy < f.h; dy++) for (let dx = 0; dx < f.w; dx++) {
      const k = dy * f.w + dx, i = this.at(x + dx, y + dy);
      if (lower[k] >= 0) this.lower[i] = lower[k];
      if (upper[k] >= 0) this.upper[i] = upper[k];
      if (lower[k] >= 0 || upper[k] >= 0) { this.occupied.add(i); this.solid.add(i); }
    }
    const front = { x: x + f.doorAt.x, y: y + f.doorAt.y + 1 };
    const entry = { id: `${this.spec.id}-house-${this.houses.length + 1}`, template: key, form, kit: kitId, label: `${spec.name} · ${kitId}`, role: opt.role ?? "집",
      yard: opt.yard ?? null, yardSide: opt.side ?? null, x, y, w: f.w, h: f.h, door: { x: x + f.doorAt.x, y: y + f.doorAt.y }, front, window: null, vines: [], stories: f.stories };
    this.houses.push(entry);
    this.reserve(x, y, f.w, f.h, 1);
    this.reserve(front.x, front.y, 1, 2, 0);
    this.access.push({ role: "door-front", ...front, house: entry.id });
    this.placements.push({ name: entry.label, kind: "house", x, y, w: f.w, h: f.h, role: entry.role, yard: entry.yard, form, kit: kitId });
    return entry;
  }
  gableSize(form, kitId = "blue-stone") { const f = this.kit.api.composeGableHouseForm(this.kit.gables.get(form), kitId, {}); return [f.w, f.h]; }
  // The house at (x,y) or the nearest spot within r whose footprint + ring + two front rows are free (like houseNear).
  gableNear(form, kitId, x, y, opt = {}, r = 8) {
    // A list of forms: the first that fits near (x, y) wins (smaller fallbacks after the wanted shape).
    if (Array.isArray(form)) {
      for (const [k, f] of form.entries()) { try { return this.gableNear(f, kitId, x, y, opt, r); } catch (e) { if (k === form.length - 1 || !/No room/.test(e.message)) throw e; } }
    }
    const [w, h] = this.gableSize(form, kitId), spots = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) * 1.2]);
    spots.sort((a, b) => a[2] - b[2]);
    for (const [X, Y] of spots) {
      if (!this.freeRect(X, Y, w, h, { keep: false })) continue;
      if (!this.freeRect(X - 1, Y - 1, w + 2, h + 3, { keep: false, road: false })) continue;
      if (this.houses.some((o) => X < o.x + o.w + 2 && X + w + 2 > o.x && Y < o.y + o.h + 2 && Y + h > o.y - 1)) continue;
      if (X !== x || Y !== y) this.log.skipped.push(`moved house ${form} ${x},${y}→${X},${Y}`);
      return this.gable(form, kitId, X, Y, opt);
    }
    assert.fail(`No room for house ${form} near ${x},${y} ${this.spec.id}`);
  }
  // A list of houses: [form, kit, x, y, role, yard, side].
  homes(list, r = 8) { return list.map(([form, kit, x, y, role, yard, side]) => this.gableNear(Array.isArray(form) ? form : [form, ...["gable-long-low", "gable-2f-narrow"].filter((f) => f !== form)], kit, x, y, { role, yard, side }, r)); }
  // A fitted wall ring of the castle-town reference: outer walk + wall face, one south gate (towers on each side).
  wallRing(x, y, w, h, { towers = true, name = "성벽" } = {}) {
    const ring = carveFit(CASTLE_TOWN, [3, 8, 96, 96], w, h, { blank: [[7, 15, 92, 89]] });
    this.stampPiece(name, x, y, w, h, ring.lower, ring.upper);
    const [g0, gw] = gateSpan(ring);
    if (towers) this.gateTowers(x, y + h - 8, x + g0, gw, name + " 문루");
    return { gx: x + gateColumn(ring), gate: [x + g0, gw], inner: [x + 7, y + 7, w - 14, h - 14] };
  }
  // A single straight wall (the ring's south wall with the gate) fitted to w: for gatehouses across a street.
  wallLine(x, y, w, { name = "성벽", towers = true, gate = true } = {}) {
    // Without a gate: the ring's south-west corner run (no gate in it) mirrored into a closed span, fitted to w.
    let wall;
    if (gate) wall = carveFit(CASTLE_TOWN, [3, 89, 96, 96], w, 8, { blank: [[7, 89, 92, 89]] });
    else {
      // the west run and the east run of the ring's south wall (both gate-free), each fitted to half the width
      const wl = w >> 1, a = carveFit(CASTLE_TOWN, [3, 89, 40, 96], wl, 8, { blank: [[7, 89, 40, 89]] }), c = carveFit(CASTLE_TOWN, [58, 89, 96, 96], w - wl, 8, { blank: [[58, 89, 92, 89]] });
      wall = { w, h: 8, lower: [], upper: [] };
      for (let r = 0; r < 8; r++) { wall.lower.push(...a.lower.slice(r * wl, (r + 1) * wl), ...c.lower.slice(r * (w - wl), (r + 1) * (w - wl))); wall.upper.push(...a.upper.slice(r * wl, (r + 1) * wl), ...c.upper.slice(r * (w - wl), (r + 1) * (w - wl))); }
    }
    this.stampPiece(name, x, y, w, 8, wall.lower, wall.upper);
    if (!gate) return { gx: null };
    const [g0, gw] = gateSpan(wall);
    if (towers) this.gateTowers(x, y, x + g0, gw, name + " 문루");
    return { gx: x + gateColumn(wall), gate: [x + g0, gw] };
  }
  // Night maps (festival, fire): the lighting the map applies on entry (runtime LightingState).
  night(ambient = 0.55, color = "#1c2448") { this.map.defaultLighting = { ambient, color, sources: [] }; }
  // Light sources of a night map: every lamp, lantern post, campfire, wall torch and blaze (runtime LightSource list).
  finishLighting() {
    const L = this.map.defaultLighting;
    if (!L) return;
    const sources = [], seen = new Set();
    const add = (x, y, radius, color, flicker, intensity = 0.9) => { const k = `${x},${y}`; if (seen.has(k)) return; seen.add(k); sources.push({ id: `light-${sources.length + 1}`, at: { x, y }, radius, intensity, color, flicker }); };
    const LAMPS = { "등롱 기둥": [4, "#ffb060", false], "돌등": [3, "#ffe0a0", false], "모닥불": [5, "#ff9040", true], "벽 횃불": [3, "#ffa050", true], "벽걸이 등불": [3, "#ffe0a0", false] };
    for (const o of this.placements) if (LAMPS[o.name]) add(o.x, o.y, ...LAMPS[o.name]);
    const flames = new Set(["불길 1", "불길 2", "불길 3", "큰 불길"].flatMap((n) => this.part(n).upper.flat()));
    // one light per blaze: flame cells at least 3 apart
    for (let i = 0; i < this.upper.length; i++) if (flames.has(this.upper[i])) {
      const [x, y] = this.xy(i);
      if (sources.some((s) => Math.abs(s.at.x - x) + Math.abs(s.at.y - y) < 4)) continue;
      add(x, y, 5, "#ff7030", true, 1);
    }
    L.sources = sources.slice(0, 64);
  }
  tileOf(name, dx = 0, dy = 0) { return this.part(name).upper[dy][dx]; }
  // Burn: a house's roof catches fire in one or two blazes (flame blobs round a seed, never confetti), smoke above them.
  burn(entry, { blazes = 2, size = 7 } = {}) {
    const flames = ["불길 1", "불길 2", "불길 3"].map((n) => this.tileOf(n));
    const roof = new Set();
    for (let y = entry.y; y < entry.door.y - 1; y++) for (let x = entry.x; x < entry.x + entry.w; x++) { const i = this.at(x, y); if (this.lower[i] >= 0 && this.solid.has(i)) roof.add(i); }
    const roofList = [...roof];
    let n = 0;
    for (let k = 0; k < blazes && roofList.length; k++) {
      const seed = roofList[Math.floor(this.random() * roofList.length)], [sx, sy] = this.xy(seed);
      const cells = this.blob(sx, sy, size, (j) => roof.has(j));
      for (const c of cells) { this.upper[c] = flames[(c * 7 + k) % 3]; roof.delete(c); n++; }
      // smoke rises from the blaze's top cell
      const top = cells.reduce((a, c) => (c < a ? c : a), cells[0]), [tx, ty] = this.xy(top);
      if (ty - 1 >= 0 && roof.has(this.at(tx, ty - 1))) this.upper[this.at(tx, ty - 1)] = this.tileOf("연기 " + (1 + (k % 2)));
    }
    entry.burning = true; entry.label = "불타는 집 · " + entry.label;
    this.placements.push({ name: "불타는 지붕", kind: "fire", x: entry.x, y: entry.y, w: entry.w, h: entry.h, owner: entry.id });
    return n;
  }
  // Burnt down: the roof falls in as a heap of charred beams and rubble with a blaze on it; the front wall stands.
  burnDown(entry) {
    const beams = [this.tileOf("그을린 들보 1"), this.tileOf("그을린 들보 2")];
    this.ruin(entry, { rubble: [...beams, beams[0], 29, 537], share: 0.8 });
    const heap = [];
    for (let y = entry.y; y < entry.door.y - 1; y++) for (let x = entry.x; x < entry.x + entry.w; x++) { const i = this.at(x, y); if (beams.includes(this.upper[i])) heap.push(i); }
    const big = this.part("큰 불길");
    for (const i of heap.slice(0, 2)) {
      const [x, y] = this.xy(i), above = this.at(x, y - 1);
      if (y > 0 && this.upper[above] === -1 && this.lower[above] === this.ground) { this.upper[above] = big.upper[0][0]; this.upper[i] = big.upper[1][0]; this.solid.add(above); this.occupied.add(above); }
      else this.upper[i] = this.tileOf("불길 1");
    }
    entry.label = "불타 무너진 집 · " + entry.label.replace(/^무너진 집 · /, "");
    return entry;
  }
  // Scaffolding over a house front (walls and eaves): forced over the house cells, as the builders' frame.
  scaffold(entry, dx = null) {
    const p = this.part("비계"), x = entry.x + (dx ?? Math.max(0, (entry.w - p.w) >> 1)), y = entry.door.y - p.h + 1;
    for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) {
      const t = p.upper[yy][xx], i = this.at(x + xx, y + yy);
      if (t < 0 || (x + xx === entry.door.x && y + yy >= entry.door.y - 1)) continue;
      this.upper[i] = t;
    }
    this.placements.push({ name: "비계", kind: "overlay", x, y, w: p.w, h: p.h, owner: entry.id });
  }
  // A row of houses standing on the north side of an east-west street at row `roadY`: every front one cell above the
  // street, `gap` cells between houses. choices = [[form, kit, role, yard, side], …] taken in turn; a spot that is not
  // free is skipped (the next house tries further along). Returns the houses.
  rowAbove(roadY, x0, x1, choices, { gap = 2, max = 99 } = {}) {
    const out = [];
    let x = x0, k = 0;
    while (x < x1 && out.length < max) {
      const [form, kit, role, yard, side] = choices[k % choices.length];
      const f = this.kit.api.composeGableHouseForm(this.kit.gables.get(form), kit, {});
      const y = roadY - 2 - f.doorAt.y;
      if (x + f.w <= x1 && y >= 1 && this.freeRect(x, y, f.w, f.h, { keep: false }) && this.freeRect(x - 1, y - 1, f.w + 2, f.h + 1, { keep: false, road: false })
        && !this.houses.some((o) => x < o.x + o.w + gap && x + f.w + gap > o.x && y < o.y + o.h + 1 && y + f.h > o.y - 1)) {
        out.push(this.gable(form, kit, x, y, { role, yard, side })); x += f.w + gap; k++;
      } else x++;
    }
    return out;
  }
  // Plaza pieces only on named plazas (pave(..., { name })) — never on a quay or a lane paved with the same group.
  plazaFill(groupName, items, maxSq = 3) {
    const hidden = [...this.paved.entries()].filter(([i, g]) => g === groupName && !this.plazaCells.has(i));
    for (const [i] of hidden) this.paved.delete(i);
    try { return super.plazaFill(groupName, items, maxSq); } finally { for (const [i, g] of hidden) this.paved.set(i, g); }
  }
  // A lone round wall tower (2×8, the castle-town wall end): watchtower, lighthouse, corner tower.
  tower(x, y, name = "원탑") {
    const TOWER = [[[21, 24], [412, 25]], [[138, -1], [139, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[142, -1], [143, -1]], [[140, -1], [141, -1]], [[81, 54], [81, 55]]];
    this.stampPiece(name, x, y, 2, 8, TOWER.flat().map((c) => c[0]), TOWER.flat().map((c) => c[1]));
    return { x, y, w: 2, h: 8 };
  }
  // A plank bridge across a north-south channel near row y: the first row pair (y, y±1, …) whose water runs match.
  bridgeNear(x, y, reach = 4) {
    const run = (yy) => { if (!this.water.has(this.at(x, yy))) return null; let a = x, c = x; while (this.water.has(this.at(a - 1, yy))) a--; while (this.water.has(this.at(c + 1, yy))) c++; return [a, c]; };
    for (let d = 0; d <= reach; d++) for (const yy of d ? [y + d, y - d] : [y]) {
      const r0 = run(yy), r1 = run(yy + 1);
      if (r0 && r1 && r0[0] === r1[0] && r0[1] === r1[1] && r0[1] - r0[0] <= 8) { this.bridges([[x, yy]]); return yy; }
    }
    assert.fail(`Bridge no matching rows near ${x},${y} ${this.spec.id}`);
  }
  // A boardwalk (dock planks 199, two cells wide) across whatever water lies on the straight run from (x, y) going `dir`
  // until land: the crossing for diagonal streams, where the two-row bridge pieces cannot sit. Returns both land ends.
  planks(x, y, dir = "east", width = 2) {
    const [dx, dy] = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] }[dir];
    let k = 0; while (!this.water.has(this.at(x, y)) && k++ < 30) { x += dx; y += dy; }
    assert(this.water.has(this.at(x, y)), `Pier planks find no water ${this.spec.id}`);
    const start = [x - dx, y - dy], cells = [];
    while (this.inside(x, y) && [...Array(width).keys()].some((w) => this.water.has(this.at(x + (dy ? w : 0), y + (dx ? w : 0))))) {
      for (let w = 0; w < width; w++) { const X = x + (dy ? w : 0), Y = y + (dx ? w : 0), i = this.at(X, Y); if (this.water.has(i)) cells.push(i); }
      x += dx; y += dy;
    }
    for (const i of cells) { this.upper[i] = 199; this.bridgeCells.add(i); }
    this.access.push({ role: "plank-end", x: start[0], y: start[1] }, { role: "plank-end", x, y });
    this.placements.push({ name: "판자 다리", kind: "bridge", x: Math.min(start[0], x), y: Math.min(start[1], y), w: Math.abs(x - start[0]) + 1, h: Math.abs(y - start[1]) + 1 });
    return { from: start, to: [x, y] };
  }
  // Moor a boat / the ship on the nearest open water spot to (x, y) where the whole hull floats.
  moorNear(name, x, y, opt = {}, r = 6) {
    const p = this.part(name), fits = (X, Y) => p.upper.every((row, dy) => row.every((t, dx) => { const i = this.at(X + dx, Y + dy); return t < 0 || (this.inside(X + dx, Y + dy) && this.water.has(i) && !this.bridgeCells.has(i) && this.upper[i] === -1); }));
    const spots = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (fits(x + dx, y + dy)) spots.push([Math.abs(dx) + Math.abs(dy), x + dx, y + dy]);
    spots.sort((a, c) => a[0] - c[0]);
    assert(spots.length, `Pier no water for ${name} near ${x},${y} ${this.spec.id}`);
    this.moor(name, spots[0][1], spots[0][2], opt);
    return { x: spots[0][1], y: spots[0][2] };
  }
  // A walkable overlay part (bunting, lantern string, steam, ash) drawn on the upper layer over any open cell — road,
  // paving, water — without taking the cell (★ passable in the tileset). Skips cells already carrying something.
  overlay(name, x, y, { owner } = {}) {
    const p = this.part(name);
    let n = 0;
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) {
      const t = p.upper[dy][dx], i = this.at(x + dx, y + dy);
      if (t < 0 || !this.inside(x + dx, y + dy) || this.upper[i] !== -1 || this.solid.has(i)) continue;
      this.upper[i] = t; this.dress.add(i); n++;
    }
    if (n) this.placements.push({ name, kind: "overlay", x, y, w: p.w, h: p.h, ...(owner ? { owner } : {}) });
    return n;
  }
  // Ash and scorch on the open ground of a burnt block (share of the bare cells), never on roads or door fronts.
  ashOver(x, y, w, h, share = 0.6) {
    const kinds = ["잿자리 1", "잿자리 2", "잿자리 3"];
    const doors = new Set(this.access.map((a) => this.at(a.x, a.y)));
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = this.at(xx, yy);
      if (!this.inside(xx, yy) || !this.bare(i) || this.roads.has(i) || doors.has(i) || this.random() > share) continue;
      this.overlay(kinds[Math.floor(this.random() * 3)], xx, yy, { owner: "불탄 자리" });
    }
  }
  // Bunting / lantern string across a street: posts at both ends (solid), the string between them (★).
  streamer(x0, x1, y, { string = "축제 깃발 줄", post = "등롱 기둥", owner = "축제" } = {}) {
    for (const x of [x0, x1]) if (this.freeRect(x, y, 1, 2, { keep: false, paved: true })) this.put(post, x, y, { owner, purpose: "줄을 거는 등롱 기둥" });
    for (let x = x0 + 1; x < x1; x++) this.overlay(string, x, y, { owner });
  }
}
export { GROUND };
