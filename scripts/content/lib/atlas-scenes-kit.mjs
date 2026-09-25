// Vehicles and scene pieces for tiledata/atlas-scenes (탈것·항구·특수 장면).
//
// The pieces are painted by scripts/content/atlas-scenes/build_vehicles.py into the bundled custom sheet
// `oprn_atlas_vehicles` (public/assets/atlas-scenes/vehicles.png). A map uses them through tile grafts on its own
// pipeline copy of a bundled tileset:
//   - forest_harmony (and the climate sheets that share its numbers): grafts from 3611 (field E's slot range
//     3611~3910; the bundled forest_harmony stays untouched — only this pipeline's copy carries them);
//   - easyrpg_chipset_ship: grafts from 480 (ship decks, the sky, ship-sheet harbors).
// While authoring, every vehicle slot s sits at base + s (a working tileset). `compactVehicleGrafts` then renumbers
// the slots the maps actually use to base, base+1, … and drops the rest, so the saved tileset only carries used grafts.
import fs from "node:fs";
import assert from "node:assert/strict";

export const VEHICLES = JSON.parse(fs.readFileSync("tiledata/atlas-scenes/vehicles.json", "utf8"));
export const VEHICLE_TEXTURE = "tex_oprn_atlas_vehicles";
export const FOREST_BASE = 3611, FOREST_LIMIT = 3911, SHIP_BASE = 480;
const OPEN = { up: true, down: true, left: true, right: true };

export function piece(name) {
  const p = VEHICLES.pieces[name];
  assert(p, "Unknown vehicle piece " + name);
  return p;
}

/** Working copy of `ts` with every vehicle slot s grafted at base + s (blank slots filled up to base). */
export function withVehicleGrafts(ts, vehicles, base, { id, name } = {}) {
  const t = structuredClone(ts);
  delete t.referenceDocuments;
  if (id) t.id = id;
  if (name) t.name = name;
  t.tileMeta ??= [];
  for (let i = t.count; i < base; i++) {
    t.passability[i] = { ...OPEN }; t.priority[i] = "lower"; t.terrain[i] = 0; t.tileMeta[i] = { label: "", description: "", source: "unknown" };
  }
  t.tileGrafts = (t.tileGrafts ?? []).filter((g) => g.targetTile < base);
  for (let s = 0; s < VEHICLES.used; s++) {
    const target = base + s;
    t.passability[target] = structuredClone(vehicles.passability[s]);
    t.priority[target] = vehicles.priority[s];
    t.terrain[target] = 0;
    t.tileMeta[target] = { label: vehicles.tileMeta[s].label, description: "", source: "custom", defaultLayer: vehicles.tileMeta[s].defaultLayer };
    t.tileGrafts.push({ targetTile: target, sourceChipset: VEHICLE_TEXTURE, sourceTile: s });
  }
  t.count = base + VEHICLES.used;
  t.passability.length = t.priority.length = t.terrain.length = t.tileMeta.length = t.count;
  return t;
}

/** Renumber the vehicle tiles the maps use to base.. (in slot order), rewrite the maps, trim the tileset. */
export function compactVehicleGrafts(ts, maps, base, limit = Infinity) {
  const used = new Set();
  const layers = (m) => ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"].filter((k) => Array.isArray(m[k]));
  for (const m of maps) for (const k of layers(m)) for (const t of m[k]) if (t >= base) used.add(t);
  const order = [...used].sort((a, b) => a - b);
  assert(base + order.length <= limit, `${ts.id}: ${order.length} vehicle tiles do not fit ${base}~${limit - 1}`);
  const remap = new Map(order.map((t, k) => [t, base + k]));
  for (const m of maps) for (const k of layers(m)) m[k] = m[k].map((t) => (t >= base ? remap.get(t) : t));
  const t = structuredClone(ts);
  const byTarget = new Map(t.tileGrafts.map((g) => [g.targetTile, g]));
  const keep = t.tileGrafts.filter((g) => g.targetTile < base);
  const pass = [], prio = [], terr = [], meta = [];
  for (const old of order) {
    const g = byTarget.get(old);
    keep.push({ ...g, targetTile: remap.get(old) });
    pass.push(t.passability[old]); prio.push(t.priority[old]); terr.push(t.terrain[old]); meta.push(t.tileMeta[old]);
  }
  t.tileGrafts = keep;
  t.passability = [...t.passability.slice(0, base), ...pass];
  t.priority = [...t.priority.slice(0, base), ...prio];
  t.terrain = [...t.terrain.slice(0, base), ...terr];
  t.tileMeta = [...t.tileMeta.slice(0, base), ...meta];
  t.count = base + order.length;
  return { tileset: t, used: order.length, remap };
}

// ── stamping onto an OutdoorMap (forest_harmony family) ─────────────────────────────────────────────────────────
/**
 * Stamp a vehicle piece at (x, y). `on` = "water" (ships, rafts: every hull/floor cell must be water, rig cells only
 * need a free upper), "land" (carts, tents: every drawn cell must be free ground or paving) or "any".
 * Walkable piece cells (decks, rafts, gangways, carpets, rune circles) become bridge cells so roads may cross them.
 */
export function stampVehicle(b, name, x, y, { on = "land", base = FOREST_BASE, purpose, owner } = {}) {
  const p = piece(name), ts = b.spec.tileset;
  const cells = [];
  for (let k = 0; k < p.w * p.h; k++) {
    const lo = p.lower[k], up = p.upper[k];
    if (lo < 0 && up < 0) continue;
    const X = x + (k % p.w), Y = y + Math.floor(k / p.w), i = b.at(X, Y);
    assert(b.inside(X, Y), `Vehicle ${name} leaves the map ${b.spec.id} ${X},${Y}`);
    const star = lo < 0 && ts.priority[base + up] === "upper" && ts.passability[base + up]?.up;
    if (star) assert(b.upper[i] === -1, `Vehicle ${name} rig over a filled cell ${b.spec.id} ${X},${Y}`);
    else if (on === "water") assert(b.water.has(i) && !b.bridgeCells.has(i) && b.upper[i] === -1, `Vehicle ${name} off the water ${b.spec.id} ${X},${Y}`);
    else if (on === "land") assert(!b.water.has(i) && !b.solid.has(i) && !b.occupied.has(i) && !b.cliffCells.has(i) && (b.upper[i] === -1), `Vehicle ${name} does not fit ${b.spec.id} ${X},${Y}`);
    cells.push({ i, lo, up, star });
  }
  for (const { i, lo, up, star } of cells) {
    if (lo >= 0) b.lower[i] = base + lo;
    if (up >= 0) b.upper[i] = base + up;
    b.keep.add(i);
    if (star) continue;
    b.occupied.add(i);
    const top = up >= 0 ? base + up : base + lo;
    const walk = ts.passability[top]?.up && !(up < 0 && ts.passability[base + lo]?.up === false);
    if (walk) { b.bridgeCells.add(i); b.solid.delete(i); b.noRoad.delete(i); } else b.solid.add(i);
  }
  const at = (c) => c && { x: x + c[0], y: y + c[1] };
  const out = { name, label: p.label, x, y, w: p.w, h: p.h, doors: (p.doors ?? []).map(at), gangway: at(p.meta?.gangway) };
  b.placements.push({ name: p.label, kind: "vehicle", piece: name, x, y, w: p.w, h: p.h, ...(purpose ? { purpose } : {}), ...(owner ? { owner } : {}) });
  (b.vehicles ??= []).push(out);
  return out;
}

// ── a plain grid map (ship decks, the sky, ship-sheet quays) ───────────────────────────────────────────────────
export class GridMap {
  constructor({ id, name, width, height, tileset, fill = -1 }) {
    this.W = width; this.H = height; this.ts = tileset;
    this.map = { id, name, width, height, tileSize: 16, tilesetId: tileset.id, lowerTiles: Array(width * height).fill(fill), upperTiles: Array(width * height).fill(-1), events: [] };
    this.lower = this.map.lowerTiles; this.upper = this.map.upperTiles;
    this.placements = []; this.vehicles = []; this.targets = [];
  }
  at(x, y) { return y * this.W + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  rect(x, y, w, h, tile, layer = "lower") { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.inside(x + dx, y + dy)) this[layer][this.at(x + dx, y + dy)] = tile; }
  set(x, y, tile, layer = "upper") { assert(this.inside(x, y), `${this.map.id} ${x},${y} outside`); this[layer][this.at(x, y)] = tile; }
  /** Stamp a vehicle piece; `free` requires the upper layer under every drawn cell to be empty. */
  vehicle(name, x, y, { base = SHIP_BASE, purpose, free = true } = {}) {
    const p = piece(name);
    for (let k = 0; k < p.w * p.h; k++) {
      const lo = p.lower[k], up = p.upper[k], X = x + (k % p.w), Y = y + Math.floor(k / p.w);
      if (lo < 0 && up < 0) continue;
      assert(this.inside(X, Y), `Vehicle ${name} leaves ${this.map.id} at ${X},${Y}`);
      const i = this.at(X, Y);
      if (free && up >= 0) assert(this.upper[i] === -1, `Vehicle ${name} over a filled cell ${this.map.id} ${X},${Y}`);
      if (lo >= 0) this.lower[i] = base + lo;
      if (up >= 0) this.upper[i] = base + up;
    }
    const at = (c) => c && { x: x + c[0], y: y + c[1] };
    const out = { name, label: p.label, x, y, w: p.w, h: p.h, doors: (p.doors ?? []).map(at), gangway: at(p.meta?.gangway), meta: p.meta };
    this.placements.push({ name: p.label, kind: "vehicle", piece: name, x, y, w: p.w, h: p.h, ...(purpose ? { purpose } : {}) });
    this.vehicles.push(out);
    return out;
  }
  /** A single ship-sheet (or any) tile prop on the upper layer; the cell below must be walkable floor and empty. */
  prop(tiles, x, y, w, purpose, { layer = "upper" } = {}) {
    const rows = Array.isArray(tiles[0]) ? tiles : [tiles];
    rows.forEach((row, dy) => row.forEach((t, dx) => {
      if (t < 0) return;
      const i = this.at(x + dx, y + dy);
      assert(this.inside(x + dx, y + dy) && this[layer][i] === -1 || layer === "lower", `${this.map.id}: prop ${purpose} over ${x + dx},${y + dy}`);
      this[layer][i] = t;
    }));
    this.placements.push({ name: purpose, kind: "prop", x, y, w: rows[0].length, h: rows.length });
  }
  walk(api, project, from) {
    const seen = new Set([this.at(...from)]), q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const X = x + dx, Y = y + dy, k = this.at(X, Y);
        if (this.inside(X, Y) && !seen.has(k) && api.canMove(project, this.map, x, y, X, Y)) { seen.add(k); q.push([X, Y]); }
      }
    }
    return seen;
  }
  /** Every target (door, ladder, gangway foot…) is reachable from `entry`; returns the reachable count. */
  check(api, entry, targets = this.targets) {
    const project = { tilesets: { [this.ts.id]: this.ts }, maps: { [this.map.id]: this.map } };
    const seen = this.walk(api, project, entry);
    const near = ([x, y]) => [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => this.inside(x + dx, y + dy) && seen.has(this.at(x + dx, y + dy)));
    const blocked = targets.filter((t) => !near(t));
    assert.equal(blocked.length, 0, `Blocked ${this.map.id}: ${JSON.stringify(blocked.slice(0, 6))}`);
    return { reachable: seen.size, targets: targets.length };
  }
}
