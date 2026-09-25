// Biome layer over the outdoor builder (lib/outdoor-kit.mjs) for tiledata/atlas-biomes: the atlas biome tilesets
// (build-atlas-biome-chipsets.py → atlasBiomes.ts), their drawn pieces as tree stamps the fill can plant, water / sky
// decorations, cliff vines, blob grounds that close the emptiness gate with the ground itself, and the border zone
// (a region repainted with the neighbour biome's lawn, re-grounded road / shore / cliff cells and neighbour pieces).
import assert from "node:assert/strict";
import fs from "node:fs";
import { OutdoorMap, WALKABLE_UPPER, N8, GROUND } from "./outdoor-kit.mjs";

export const BIOME_KINDS = ["jungle", "swamp", "mushroom", "crystal", "badlands", "savanna", "taiga", "tundra", "blight", "skyisle", "tropical"];
export const biomeTilesetId = (k) => `atlas_biome_${k}`;
const SHEETS = JSON.parse(fs.readFileSync("tiledata/atlas-biomes/sheets.json"));

/** Per biome: its tileset, piece stamps (id → {w,h,lower,upper,roles,cat,tiles}), blob groups, twin map. */
export function loadBiomes(api, kit) {
  const out = {};
  for (const k of BIOME_KINDS) {
    const ts = api.createAtlasBiomeTileset(k), s = SHEETS.biomes[k];
    const pieces = {};
    for (const p of s.pieces) {
      const g = ts.tileGroups.find((q) => q.id === "atlas-biome:" + p.id);
      pieces[p.id] = { id: p.id, name: p.name, cat: p.cat, w: p.w, h: p.h, roles: p.roles, tiles: p.tiles, lower: g.previewMap.lowerTiles, upper: g.previewMap.upperTiles, neighbour: p.neighbour ?? null };
    }
    const blobs = {};
    for (const [gid, b] of Object.entries(s.blobs)) blobs[gid] = { ...b, group: ts.autotileGroups.find((g) => g.id === `atlas_${k}_${gid.replace(/-/g, "_")}_47`) };
    out[k] = { kind: k, tileset: ts, pieces, blobs, twins: new Map(s.twins ?? []), neighbour: s.neighbour ?? null, name: s.name, tag: s.tag,
      walkable: new Set(s.pieces.flatMap((p) => p.tiles.filter((t, j) => t >= 0 && (p.roles[j] === "W" || p.roles[j] === "C")))) };
  }
  return out;
}

// The fill plants trees by kit.trees id; biome pieces register as "<biome>/<piece>" (per map, see useBiome).
const EXTRA_WALKABLE = new Set();
export function useBiome(kit, biome) {
  for (const t of EXTRA_WALKABLE) WALKABLE_UPPER.delete(t);
  EXTRA_WALKABLE.clear();
  for (const t of biome.walkable) if (!WALKABLE_UPPER.has(t)) { WALKABLE_UPPER.add(t); EXTRA_WALKABLE.add(t); }
  for (const [id, p] of Object.entries(biome.pieces)) kit.trees[`${biome.kind}/${id}`] = { id: `${biome.kind}/${id}`, w: p.w, h: p.h, lower: p.lower, upper: p.upper };
}
export const tileOf = (biome, id) => { const p = biome.pieces[id]; assert(p, "Unknown biome piece " + biome.kind + "/" + id); return p.tiles.find((t) => t >= 0); };

export class BiomeMap extends OutdoorMap {
  constructor(kit, spec, seed, biome) { super(kit, spec, seed); this.biome = biome; this.zone = null; }
  // Sky islands: the rocky underside hangs in the sky cells below every south rim cell (deep mid-rim, shallow at the
  // ends of a rim run), never under a bridge or a pier. Upper layer, solid (the sky is not walkable anyway).
  undersides() {
    const P = this.biome.pieces, deep = ["underside-deep-1", "underside-deep-2"].map((k) => P[k]), shallow = ["underside-1", "underside-2"].map((k) => P[k]);
    if (!deep[0] || !shallow[0]) return 0;
    const sky = (x, y) => this.inside(x, y) && this.water.has(this.at(x, y)) && !this.bridgeCells.has(this.at(x, y)) && this.upper[this.at(x, y)] === -1;
    const rim = (x, y) => this.inside(x, y) && !this.water.has(this.at(x, y)) && sky(x, y + 1);
    let n = 0;
    for (let y = 0; y < this.H - 1; y++) for (let x = 0; x < this.W; x++) {
      if (!rim(x, y)) continue;
      const run = (d) => { let k = 0; while (rim(x + d * (k + 1), y) || rim(x + d * (k + 1), y - 1) || rim(x + d * (k + 1), y + 1)) k++; return k; };
      const inner = Math.min(run(-1), run(1)) >= 1 && sky(x, y + 2);
      const p = (inner ? deep : shallow)[(x * 7 + y * 3) % 2];
      for (let d = 0; d < p.h; d++) { const i = this.at(x, y + 1 + d); this.upper[i] = p.tiles[d]; this.solid.add(i); this.occupied.add(i); this.keep.add(i); }
      n++;
    }
    this.placements.push({ name: "섬 밑동", kind: "dressing", cluster: "underside", cells: n, x: 0, y: 0 });
    return n;
  }
  // biomes without leafy woods (badlands): the layout's edge woods are left out, the fill and groves close the gaps
  forest(opts) { if (this.noForest) return; return super.forest(opts); }
  // Cave mouth (the sheet's own 2×2 arch drawn on its cliff texture) at the foot of the cliff face at columns x, x+1:
  // it covers the two bottom face rows, so the opening meets the ground; the cell below is the approach.
  shaft(x) {
    const p = this.biome.pieces["cave-mouth"], cols = [x, x + 1].map((X) => this.cliffPlan.columns.find((k) => k.x === X));
    assert(p && cols.every((c) => c && c.y === cols[0].y && c.height === cols[0].height && c.height >= 3), `Cave mouth must sit on an even face ${this.spec.id} ${x}`);
    const c = cols[0], y0 = c.y + c.height - 1;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = this.at(x + dx, y0 + dy);
      assert(this.cliffCells.has(i) && ![111, 112, 113].includes(this.lower[i]) && !this.fallCells.has(i), `Cave mouth off the face ${this.spec.id} ${x + dx},${y0 + dy}`);
      this.upper[i] = p.upper[dy * 2 + dx]; this.solid.add(i);
    }
    const foot = { x, y: c.y + c.height + 1 };
    this.access.push({ role: "cave-approach", ...foot });
    this.reserve(x, c.y + c.height + 1, 2, 2, 0);
    this.placements.push({ name: "동굴 입구", kind: "shaft", x, y: y0, w: 2, h: 2 });
    return foot;
  }
  // Nearest water cell to x on row y (a bridge hint).
  findWaterX(y, x) { for (let d = 0; d < this.W; d++) for (const X of [x - d, x + d]) if (this.inside(X, y) && this.water.has(this.at(X, y)) && this.water.has(this.at(X, y + 1))) return X; assert.fail("No water on row " + y); }
  // ── pieces ──
  piece(id, x, y, opts = {}) { return this.stampTree(`${this.biome.kind}/${id}`, x, y, { ring: 1, ...opts }); }
  // Clumps of a piece family on open ground within a region: `count` clumps of 1..n pieces standing shoulder to shoulder.
  clumps(ids, count, { region = null, per = [1, 3], gapCheck = 4, near = null } = {}) {
    let made = 0;
    const [rx, ry, rw, rh] = region ?? [1, 1, this.W - 2, this.H - 2];
    for (let tries = 0; made < count && tries < 1200; tries++) {
      const x = rx + Math.floor(this.random() * rw), y = ry + Math.floor(this.random() * rh);
      if (near && !near(x, y)) continue;
      const id = ids[Math.floor(this.random() * ids.length)], p = this.biome.pieces[id];
      if (this.placements.some((o) => o.kind === "vegetation" && Math.abs(o.x - x) < gapCheck && Math.abs(o.y - y) < gapCheck)) continue;
      if (!this.piece(id, x, y, { ring: 1 })) continue;
      made++;
      const want = per[0] + Math.floor(this.random() * (per[1] - per[0] + 1));
      const mine = [{ x, y, w: p.w, h: p.h }];
      for (let n = 1, k = 0; n < want && k < 14; k++) {
        const id2 = ids[Math.floor(this.random() * ids.length)], q = this.biome.pieces[id2], m = mine[Math.floor(this.random() * mine.length)], j = Math.floor(this.random() * 3) - 1;
        const spots = [[m.x + m.w, m.y + j + (m.h - q.h)], [m.x - q.w, m.y + j + (m.h - q.h)], [m.x + j, m.y + m.h - 1], [m.x + j, m.y - q.h + 1]];
        const [ox, oy] = spots[Math.floor(this.random() * spots.length)];
        if (this.piece(id2, ox, oy, { ring: 0, loose: true })) { mine.push({ x: ox, y: oy, w: q.w, h: q.h }); n++; }
      }
    }
    return made;
  }
  // Water (or sky) decorations: upper pieces on water cells 1..reach from the shore, in small groups, never on bridges.
  waterDeco(ids, count, { reach = [1, 3], per = [2, 4], group = 2 } = {}) {
    const dist = this.shoreDistance();
    let made = 0;
    for (let tries = 0; made < count && tries < 2000; tries++) {
      const i = Math.floor(this.random() * this.W * this.H);
      if (!this.water.has(i) || this.bridgeCells.has(i) || !(dist.get(i) >= reach[0] && dist.get(i) <= reach[1])) continue;
      const [x, y] = this.xy(i), want = per[0] + Math.floor(this.random() * (per[1] - per[0] + 1));
      let n = 0;
      for (let k = 0; k < want * 6 && n < want; k++) {
        const id = ids[Math.floor(this.random() * ids.length)], p = this.biome.pieces[id];
        const ox = x + Math.floor(this.random() * (group * 2 + 1)) - group, oy = y + Math.floor(this.random() * (group * 2 + 1)) - group;
        if (this.decoFits(p, ox, oy, dist, reach)) { this.stampDeco(p, ox, oy, "물 위 장식"); n++; }
      }
      if (n) made++;
    }
    return made;
  }
  decoFits(p, x, y, dist, reach) {
    for (let dy = -1; dy <= p.h; dy++) for (let dx = -1; dx <= p.w; dx++) {
      const X = x + dx, Y = y + dy, i = this.at(X, Y), own = dx >= 0 && dy >= 0 && dx < p.w && dy < p.h;
      if (!this.inside(X, Y)) return false;
      if (own && (!this.water.has(i) || this.bridgeCells.has(i) || this.upper[i] !== -1 || !(dist.get(i) >= reach[0]))) return false;
      if (!own && (this.bridgeCells.has(i) || (this.water.has(i) && this.upper[i] !== -1))) return false;
    }
    return true;
  }
  stampDeco(p, x, y, name) {
    for (let k = 0; k < p.w * p.h; k++) { const t = p.upper[k]; if (t < 0) continue; const i = this.at(x + k % p.w, y + Math.floor(k / p.w)); this.upper[i] = t; this.occupied.add(i); }
    this.placements.push({ name: name + " · " + p.name, kind: "deco", x, y, w: p.w, h: p.h });
  }
  shoreDistance() {
    const d = new Map(), q = [];
    for (const i of this.water) { const [x, y] = this.xy(i); if (N8.some(([dx, dy]) => this.inside(x + dx, y + dy) && !this.water.has(this.at(x + dx, y + dy)))) { d.set(i, 1); q.push(i); } }
    while (q.length) { const i = q.shift(), [x, y] = this.xy(i); for (const [dx, dy] of N8.slice(0, 4)) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && this.water.has(j) && !d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } } }
    return d;
  }
  // Land cells by distance (4-steps) to the nearest water cell.
  shoreDistanceLand() {
    const d = new Map(), q = [];
    for (const i of this.water) { d.set(i, 0); q.push(i); }
    while (q.length) { const i = q.shift(), [x, y] = this.xy(i); for (const [dx, dy] of N8.slice(0, 4)) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && !d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } } }
    return d;
  }
  // Vines hanging down cliff faces (1×2, upper): only face cells (not the rim row, stairs, falls or shafts).
  cliffVines(ids, count) {
    const cols = this.cliffPlan?.columns ?? [];
    let made = 0;
    for (let tries = 0; made < count && tries < 400; tries++) {
      const c = cols[Math.floor(this.random() * cols.length)];
      if (!c || c.height < 3 || c.side !== "front") continue;
      const y = c.y + 1 + Math.floor(this.random() * Math.max(1, c.height - 2)), p = this.biome.pieces[ids[Math.floor(this.random() * ids.length)]];
      const cells = [0, 1].map((d) => this.at(c.x, y + d));
      if (!cells.every((i, d) => this.cliffCells.has(i) && y + d < c.y + c.height && this.upper[i] >= 0 && !this.fallCells.has(i) && !this.water.has(i) && ![111, 112, 113].includes(this.lower[i]) && !this.solid.has(i))) continue;
      if (this.placements.some((o) => o.kind === "vine" && Math.abs(o.x - c.x) < 4)) continue;
      // the vine art sits over the cliff face: the face goes to the lower layer
      for (let d = 0; d < 2; d++) { const i = cells[d]; if (this.lower[i] === this.ground) this.lower[i] = this.upper[i]; this.upper[i] = p.upper[d]; }
      this.placements.push({ name: p.name, kind: "vine", x: c.x, y, w: 1, h: 2 });
      made++;
    }
    return made;
  }
  // ── blob grounds: patches grown from 2×2 blocks on plain ground (walkable unless the group is a pool) ──
  plainForGround(i, gid = null) {
    if (!(this.lower[i] === this.ground && this.upper[i] === -1 && !this.roads.has(i) && !this.paved.has(i) && !this.keep.has(i) && !this.occupied.has(i) && !this.nearAccessSet().has(i))) return false;
    // the neighbour's ground only deep in the zone (its rim is drawn on the neighbour lawn), the biome's own never in it
    if (gid === "nb-ground") { const [x, y] = this.xy(i); return !!this.zone && N8.every(([dx, dy]) => !this.inside(x + dx, y + dy) || this.zone.has(this.at(x + dx, y + dy))); }
    return !(this.zone?.has(i));
  }
  nearAccessSet() {
    if (this._nearAccess && this._nearAccessN === this.access.length) return this._nearAccess;
    const s = new Set(); for (const a of this.access) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.add(this.at(a.x + dx, a.y + dy));
    for (const e of this.exitList) for (const [x, y] of [[e.x, e.y], e.inner]) s.add(this.at(x, y));
    this._nearAccess = s; this._nearAccessN = this.access.length; return s;
  }
  groundPatch(gid, x, y, size, { pool = false } = {}) {
    const blocks = [[x, y]], cells = new Set();
    const ok2 = (X, Y) => [0, 1].every((dy) => [0, 1].every((dx) => { const i = this.at(X + dx, Y + dy); return this.inside(X + dx, Y + dy) && (cells.has(i) || this.plainForGround(i, gid)) && (!pool || !this.nearSolid(X + dx, Y + dy, 1)); }));
    if (!ok2(x, y)) return 0;
    const add = (X, Y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) cells.add(this.at(X + dx, Y + dy)); };
    add(x, y);
    // an organic ellipse (noisy rim, random tilt) grown breadth-first from the seed block: no stair-stepped rectangles
    const r = Math.sqrt(size / Math.PI) + 0.4, ax = r * (0.8 + this.random() * 0.6), ay = (r * r) / ax, rot = this.random() * Math.PI;
    const ph = [this.random() * 6.3, this.random() * 6.3], cx = x + 0.5, cy = y + 0.5;
    const inside = (X, Y) => { const u = X + 0.5 - cx, v = Y + 0.5 - cy, a = Math.atan2(v, u);
      const p = (u * Math.cos(rot) + v * Math.sin(rot)) / ax, q = (-u * Math.sin(rot) + v * Math.cos(rot)) / ay;
      return p * p + q * q <= 1 + 0.28 * Math.sin(3 * a + ph[0]) + 0.18 * Math.sin(5 * a + ph[1]); };
    const seenB = new Set([x + "," + y]);
    for (let k = 0; k < blocks.length && cells.size < size * 1.3; k++) {
      const [bx, by] = blocks[k];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = bx + dx, Y = by + dy, key = X + "," + Y;
        if (seenB.has(key)) continue; seenB.add(key);
        if (inside(X, Y) && ok2(X, Y)) { add(X, Y); blocks.push([X, Y]); }
      }
    }
    if (cells.size < 4) return 0;
    const before = { lower: this.lower.slice() };
    const g = this.biome.blobs[gid];
    this.groundCells ??= new Map();
    for (const i of cells) this.groundCells.set(i, gid);
    this.paintGround(gid);
    if (pool || g.kind === "pool") {
      // a pool must not cut a door, exit or target off
      const seen = this.walk(this.map, this.exitList[0].inner);
      if (!this.access.every((a) => seen.has(this.at(a.x, a.y)))) { for (const i of cells) { this.groundCells.delete(i); this.lower[i] = before.lower[i]; } this.paintGround(gid); return 0; }
      for (const i of cells) this.solid.add(i);
    }
    for (const i of cells) { this.occupied.add(i); }
    this.placements.push({ name: g.name, kind: "ground", group: gid, x, y, cells: cells.size });
    return cells.size;
  }
  nearSolid(x, y, r) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const j = this.at(x + dx, y + dy); if (this.inside(x + dx, y + dy) && (this.solid.has(j) || this.water.has(j) || this.cliffCells.has(j) || this.roads.has(j))) return true; } return false; }
  paintGround(gid) {
    const g = this.biome.blobs[gid], cells = [...this.groundCells].filter(([, k]) => k === gid).map(([i]) => i), set = new Set(cells);
    for (const i of cells) {
      const [x, y] = this.xy(i); let mask = 0;
      N8.forEach(([dx, dy], b) => { if (!this.inside(x + dx, y + dy) || set.has(this.at(x + dx, y + dy))) mask |= 1 << b; });
      let t = g.variantMap[String(mask)];
      if (mask === 255) { const v = [g.body, ...g.interior]; t = v[(x * 7 + y * 13) % 5 < 3 ? 0 : 1 + ((x + y) & 1)]; }
      this.lower[i] = t;
    }
  }
  // Close the emptiness gate with ground patches of the given grounds (after the fill): in the emptiest screen first.
  groundFill(gids, { maxSq = 5, screen = 0.47, size = [16, 34], cap = 60, pool = null } = {}) {
    let n = 0, fails = 0;
    for (; n < cap && fails < 80;) {
      const e = this.emptiness();
      if (e.maxSq <= maxSq && e.screen <= screen) break;
      const [x0, y0, w, h] = e.maxSq > maxSq ? [e.at[0], e.at[1], e.maxSq, e.maxSq] : [e.screenAt[0], e.screenAt[1], 17, 13];
      const x = x0 + Math.floor(this.random() * Math.max(1, w - 1)), y = y0 + Math.floor(this.random() * Math.max(1, h - 1));
      const gid = gids[Math.floor(this.random() * gids.length)];
      const got = this.groundPatch(gid, x, y, size[0] + Math.floor(this.random() * (size[1] - size[0] + 1)), { pool: pool === gid });
      if (got) { n++; fails = 0; } else fails++;
    }
    const g = this.emptiness();
    this.fillReport = { ...(this.fillReport ?? {}), maxSq: g.maxSq, screen: g.screen, at: g.at, screenAt: g.screenAt, groundPatches: n };
    return g;
  }
  // ── border zone: the neighbour biome's lawn over a region ──
  setZone(fn) {
    this.zone = new Set();
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (fn(x, y)) this.zone.add(this.at(x, y));
    // the fill leaves the zone alone (its own pieces go in with zoneFill)
    for (const i of this.zone) { if (!this.keep.has(i)) { this.keep.add(i); (this.zoneKeep ??= new Set()).add(i); } }
  }
  // Neighbour pieces in the zone, until the zone's own emptiness passes the gate (lawn in the zone counted as plain).
  zoneFill({ trees = [], smalls = [], decals = [], maxSq = 5, screen = 0.45 } = {}) {
    for (const i of this.zoneKeep ?? []) this.keep.delete(i);
    // tall grass the fill grew into the zone is this biome's grass: the zone gets the neighbour's own pieces instead
    for (const i of this.zone) if (this.grassCells.has(i)) { this.grassCells.delete(i); this.dress.delete(i); this.occupied.delete(i); this.clusterOf.delete(i); if (this.paved.get(i) !== "sand" && this.paved.get(i) !== "dirt") this.paved.delete(i); if (this.upper[i] === -1) this.lower[i] = this.ground; }
    for (const c of this.clusters ?? []) if (c.cells) for (const i of [...c.cells]) if (this.zone.has(i)) c.cells.delete(i);
    for (const i of this.zone) if (this.paved.get(i) === "tallGrass") { this.paved.delete(i); this.dress.delete(i); this.occupied.delete(i); this.clusterOf.delete(i); this.grassCells.delete(i); if (this.upper[i] === -1) this.lower[i] = this.ground; }
    const inZone = (i) => this.zone.has(i);
    const zoneEmpty = () => { const P = new Uint8Array(this.W * this.H); for (const i of this.zone) if (this.lower[i] === this.ground && this.upper[i] === -1 && !this.roads.has(i)) P[i] = 1; return this.emptiness(P); };
    let fails = 0, placed = 0;
    for (let step = 0; step < 1500 && fails < 260; step++) {
      const e = zoneEmpty();
      if (e.maxSq <= maxSq && e.screen <= screen) break;
      const [x0, y0, w, h] = e.maxSq > maxSq ? [e.at[0], e.at[1], e.maxSq, e.maxSq] : [e.screenAt[0], e.screenAt[1], 17, 13];
      // a plain zone cell of the emptiest window (not any cell of the window: the window straddles the zone edge)
      const cand = [];
      for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) { const j = this.at(xx, yy); if (this.inside(xx, yy) && inZone(j) && this.lower[j] === this.ground && this.upper[j] === -1 && !this.roads.has(j)) cand.push([xx, yy]); }
      if (!cand.length) { fails++; continue; }
      const [x, y] = cand[Math.floor(this.random() * cand.length)];
      const r = this.random();
      let ok = false;
      if (this.biome.blobs["nb-ground"] && r > 0.72) ok = !!this.groundPatch("nb-ground", x, y, 14 + Math.floor(this.random() * 20));
      else if (trees.length && r < 0.6) ok = !!this.clumps(trees, 1, { region: [x - 2, y - 2, 4, 4], per: [2, 3], gapCheck: 1, near: (X, Y) => inZone(this.at(X, Y)) });
      else if (smalls.length && r < 0.9) ok = this.clusterTiles(smalls, x, y, (trees.length > 2 ? 4 : 6) + Math.floor(this.random() * 4), inZone, false, false);
      else if (decals.length) ok = this.clusterTiles(decals, x, y, 5 + Math.floor(this.random() * 3), inZone, true, false);
      if (ok) { placed++; fails = 0; } else fails++;
    }
    this.zoneReport = { placed, ...zoneEmpty() };
    return this.zoneReport;
  }
  // L-shaped cluster of 1×1 upper tiles (never a straight line of three), one bare ring from other dressing.
  clusterTiles(tiles, x, y, size, within = () => true, walk = false, ring = true) {
    const ok = (X, Y) => { const i = this.at(X, Y); if (!this.inside(X, Y) || !within(i) || !this.bare(i) || this.occupied.has(i) || this.keep.has(i) || this.roads.has(i) || this.nearAccessSet().has(i)) return false;
      if (!walk) for (const [dx, dy] of N8) { const j = this.at(X + dx, Y + dy); if (this.inside(X + dx, Y + dy) && (this.roads.has(j) || this.water.has(j) || this.bridgeCells.has(j))) return false; }
      return true; };
    const L = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]]][Math.floor(this.random() * 4)];
    const cells = L.map(([dx, dy]) => [x + dx, y + dy]);
    if (!cells.every(([X, Y]) => ok(X, Y))) return false;
    const set = new Set(cells.map(([X, Y]) => this.at(X, Y)));
    for (let k = 0; k < size * 6 && set.size < size; k++) {
      const [cx, cy] = this.xy([...set][Math.floor(this.random() * set.size)]), [dx, dy] = N8[Math.floor(this.random() * 4)];
      const X = cx + dx, Y = cy + dy, i = this.at(X, Y);
      if (ok(X, Y) && !set.has(i)) {
        const n = N8.filter(([ex, ey]) => set.has(this.at(X + ex, Y + ey))).length;
        if (n >= 2) set.add(i);
      }
    }
    const xs = new Set([...set].map((i) => i % this.W)), ys = new Set([...set].map((i) => Math.floor(i / this.W)));
    if (set.size >= 3 && (xs.size === 1 || ys.size === 1)) return false;
    // keep a ring from other dressing
    if (ring) for (const i of set) { const [X, Y] = this.xy(i); for (const [dx, dy] of N8) { const j = this.at(X + dx, Y + dy); if (this.inside(X + dx, Y + dy) && !set.has(j) && this.dress.has(j) && !this.treeCells.has(j)) return false; } }
    for (const i of set) { this.upper[i] = tiles[Math.floor(this.random() * tiles.length)]; this.occupied.add(i); this.dress.add(i); if (!walk) { this.solid.add(i); this.keep.add(i); } }
    const [x0, y0] = this.xy([...set][0]);
    this.placements.push({ name: walk ? "바닥 장식 무리" : "작은 조각 무리", kind: "dressing", cluster: walk ? "decal" : "small", cells: set.size, x: x0, y: y0 });
    return true;
  }
  // Repaint the zone: its lawn becomes the neighbour lawn (blob autotile, edges only on the zone boundary), road /
  // shore / cliff / stair / trunk cells take their re-grounded twins.
  paintZone() {
    const g = this.biome.blobs.neighbour; assert(g, "No neighbour ground on " + this.biome.kind);
    const LAWN = new Set([this.ground, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);
    let twins = 0, lawn = 0;
    for (const i of this.zone) {
      const [x, y] = this.xy(i);
      if (LAWN.has(this.lower[i]) || this.lower[i] === g.body) {
        let mask = 0;
        N8.forEach(([dx, dy], b) => { if (!this.inside(x + dx, y + dy) || this.zone.has(this.at(x + dx, y + dy))) mask |= 1 << b; });
        let t = g.variantMap[String(mask)];
        if (mask === 255) { const v = [g.body, ...g.interior]; t = v[(x * 7 + y * 13) % 5 < 3 ? 0 : 1 + ((x + y) & 1)]; }
        this.lower[i] = t; lawn++;
      } else if (this.biome.twins.has(this.lower[i])) { this.lower[i] = this.biome.twins.get(this.lower[i]); twins++; }
      if (this.biome.twins.has(this.upper[i])) { this.upper[i] = this.biome.twins.get(this.upper[i]); twins++; }
    }
    this.zonePaint = { cells: this.zone.size, lawn, twins };
    return this.zonePaint;
  }
}
