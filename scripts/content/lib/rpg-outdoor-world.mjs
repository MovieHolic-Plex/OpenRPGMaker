// World map of the outdoor set, on the bundled EasyRPG world tileset (easyrpg_chipset_world).
// One continent in a sea: a snow north (snow forest, snow mountains, a citadel), a green middle with the royal castle,
// forests and mountain ranges, a marsh in the west, a desert in the south-east, a volcano in the south-west mountains.
// Every outdoor place of tiledata/rpg-outdoors sits on it as an icon (towns, castles, shrines) or as a named region
// (fields), joined by dirt roads. Terrain groups are the tileset's own autotiles: coast harness-world-coast-v1-sea and
// harness-world-v2-terrain-* (a cell gets the variant of its 8-neighbour mask, like the painters do).
// Terrain and placement only — no events. buildWorldMap(api, tileset, plan) → { map, meta, check }.
import assert from "node:assert/strict";

const N8 = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
const G = (k) => "harness-world-v2-terrain-" + k;
// Class → autotile group (null = plain grass 240).
const GROUP = { sea: "harness-world-coast-v1-sea", forest: G("forest"), mountain: G("mountain"), sand: G("sand"), snow: G("snow"),
  snowforest: G("snow-forest"), snowmountain: G("snow-mountain"), marsh: G("marsh"), road: G("dirt"), grass: G("tall-grass") };
const WALK = new Set(["plain", "sand", "snow", "road", "grass"]);
// Icons (upper layer over the ground they stand on). Cells of -1 stay empty.
const ICON = {
  castle: [[322, 323], [352, 353]], fortress: [[320, 321], [350, 351]], citadel: [[440, 441], [470, 471]], volcano: [[438, 439], [468, 469]],
  bigtree: [[318, 319], [348, 349]], tower: [[380], [410]], ruins: [[381], [411]], house: [[262]], snowhouse: [[263]], hut: [[292]],
  temple: [[382]], smalltower: [[383]], cave: [[413]], grave: [[88]], bones: [[118]], spring: [[125]], sign: [[116]],
};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildWorldMap(api, tileset, plan) {
  const W = plan.width, H = plan.height, random = rng(plan.seed), at = (x, y) => y * W + x, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const seedN = Math.floor(random() * 1e9);
  const hash = (a, b, s) => { let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ (seedN + s); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff; };
  const vnoise = (x, y, s) => { const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, sm = (t) => t * t * (3 - 2 * t), l = (a, b, t) => a + (b - a) * sm(t);
    return l(l(hash(ix, iy, s), hash(ix + 1, iy, s), tx), l(hash(ix, iy + 1, s), hash(ix + 1, iy + 1, s), tx), ty); };
  const fbm = (x, y, s) => 0.55 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.15 * vnoise(x * 4.3, y * 4.3, s + 13);
  const cls = Array(W * H).fill("sea");

  // 1. Continent: noisy radial falloff; two-cell sea rim; keep the largest landmass (plus islands of 10+ cells).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W * 0.47), dy = (y - H / 2) / (H * 0.45), d = Math.sqrt(dx * dx + dy * dy);
    const v = fbm(x / 9, y / 9, 1) * 0.62 + (1 - d ** 1.7) * 0.8;
    if (v > (plan.landAt ?? 0.66) && x > 1 && y > 1 && x < W - 2 && y < H - 2) cls[at(x, y)] = "plain";
  }
  const comps = components((i) => cls[i] !== "sea");
  comps.sort((a, b) => b.length - a.length);
  for (const c of comps.slice(1)) if (c.length < 10) for (const i of c) cls[i] = "sea";
  const main = new Set(comps[0]);
  smooth((i) => cls[i] === "sea", (i, wet) => { cls[i] = wet ? "sea" : "plain"; });

  // 2. Places: fixed fractions of the map; each is snapped to the nearest open land cell of the main mass.
  const places = [];
  for (const p of plan.places) {
    const icon = ICON[p.icon], w = icon ? icon[0].length : 1, h = icon ? icon.length : 1;
    const want = [Math.round(p.at[0] * W), Math.round(p.at[1] * H)];
    let best = null, bd = Infinity;
    for (let y = 3; y < H - 3 - h; y++) for (let x = 3; x < W - 3 - w; x++) {
      let ok = true;
      for (let dy = -2; dy <= h + 1 && ok; dy++) for (let dx = -2; dx <= w + 1 && ok; dx++) ok = cls[at(x + dx, y + dy)] !== "sea" && main.has(at(x + dx, y + dy)) && !places.some((q) => x + dx >= q.x - 1 && x + dx < q.x + q.w + 1 && y + dy >= q.y - 1 && y + dy < q.y + q.h + 1);
      if (p.coast && ok) { let wet = false; for (let dy = -3; dy <= h + 2; dy++) for (let dx = -3; dx <= w + 2; dx++) if (inside(x + dx, y + dy) && cls[at(x + dx, y + dy)] === "sea") wet = true; ok = wet; }
      if (!ok) continue;
      const d = Math.abs(x - want[0]) + Math.abs(y - want[1]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    assert(best, "No land for world place " + p.id);
    places.push({ ...p, x: best[0], y: best[1], w, h });
  }
  const placeRing = new Set();
  for (const p of places) for (let dy = -1; dy <= p.h; dy++) for (let dx = -1; dx <= p.w; dx++) placeRing.add(at(p.x + dx, p.y + dy));

  // 3. Climates: the snow north, the desert south-east, the marsh west (by the place anchors that ask for them).
  const snowLine = (x) => H * plan.snowLine + 2.5 * Math.sin(x / 5) + 3 * (vnoise(x / 6, 3, 21) - 0.5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cls[at(x, y)] === "plain" && y < snowLine(x)) cls[at(x, y)] = "snow";
  for (const [cx, cy, rx, ry, k] of plan.patches) blobPaint(cx * W, cy * H, rx, ry, k);

  // 4. Mountain ranges (polylines), then forests and tall grass from noise, all kept off the place rings.
  for (const { points, width, kind } of plan.ranges) for (let n = 1; n < points.length; n++) {
    const [ax, ay] = [points[n - 1][0] * W, points[n - 1][1] * H], [bx, by] = [points[n][0] * W, points[n][1] * H], len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= len; t += 0.5) {
      const x = ax + (bx - ax) * t / len, y = ay + (by - ay) * t / len, r = width * (0.75 + 0.5 * vnoise(x / 3, y / 3, 31));
      for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        if (!inside(xx, yy) || (xx - x) ** 2 + (yy - y) ** 2 > r * r || placeRing.has(at(xx, yy))) continue;
        const c = cls[at(xx, yy)];
        if (c === "plain" || c === "sand" || c === "grass") cls[at(xx, yy)] = kind ?? "mountain";
        else if (c === "snow") cls[at(xx, yy)] = "snowmountain";
      }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y); if (placeRing.has(i)) continue;
    const f = fbm(x / 5, y / 5, 41), g = fbm(x / 4, y / 4, 57);
    if (cls[i] === "plain" && f > 0.62) cls[i] = "forest";
    else if (cls[i] === "snow" && f > 0.6) cls[i] = "snowforest";
    else if (cls[i] === "plain" && g > 0.64) cls[i] = "grass";
  }

  // 5. Roads: a spanning tree of the places plus the extra links, A* over walkable land (forest and grass are cut
  // through, mountains, marsh and sea never), then painted as dirt. Places keep their own cells.
  const roadCells = new Set();
  const cost = (i) => { const c = cls[i]; if (c === "sea" || c === "mountain" || c === "snowmountain" || c === "marsh") return Infinity; return c === "road" ? 0.4 : c === "forest" || c === "snowforest" ? 2.4 : 1; };
  const door = (p) => [p.x + (p.w >> 1), p.y + p.h];
  const edges = [];
  { const inTree = [0], left = places.map((_, k) => k).slice(1);
    while (left.length) { let best = null;
      for (const a of inTree) for (const b of left) { const [ax, ay] = door(places[a]), [bx, by] = door(places[b]), d = Math.abs(ax - bx) + Math.abs(ay - by); if (!best || d < best[2]) best = [a, b, d]; }
      edges.push([best[0], best[1]]); inTree.push(best[1]); left.splice(left.indexOf(best[1]), 1); } }
  for (const [a, b] of plan.links ?? []) edges.push([places.findIndex((p) => p.id === a), places.findIndex((p) => p.id === b)]);
  const placeCells = new Set(); for (const p of places) for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) placeCells.add(at(p.x + dx, p.y + dy));
  for (const [a, b] of edges) {
    if (places[a].noRoad || places[b].noRoad) continue;
    const path = route(door(places[a]), door(places[b]));
    assert(path, `No world road ${places[a].id} → ${places[b].id}`);
    for (const i of path) if (!placeCells.has(i)) { cls[i] = "road"; roadCells.add(i); }
  }
  // Road-less places (field regions) still need a way in: a short spur to the nearest road.
  for (const p of places.filter((q) => q.noRoad)) { let best = null, bd = Infinity; const [px, py] = door(p);
    for (const i of roadCells) { const d = Math.abs(i % W - px) + Math.abs(Math.floor(i / W) - py); if (d < bd) { bd = d; best = i; } }
    const path = best !== null && route([px, py], [best % W, Math.floor(best / W)]); if (path) for (const i of path) if (!placeCells.has(i)) { cls[i] = "road"; roadCells.add(i); } }

  // 6. Close the gate (plain 240 only counts as empty): forest or tall-grass blobs in the biggest bare square / screen.
  for (let k = 0; k < 400; k++) {
    const e = emptiness();
    if (e.maxSq <= plan.gate.maxSq && e.screen <= plan.gate.screen) break;
    const [x0, y0, w, h] = e.maxSq > plan.gate.maxSq ? [e.at[0], e.at[1], e.maxSq, e.maxSq] : [e.screenAt[0], e.screenAt[1], 17, 13];
    const cand = []; for (let y = y0; y < Math.min(H, y0 + h); y++) for (let x = x0; x < Math.min(W, x0 + w); x++) if (cls[at(x, y)] === "plain" && !placeRing.has(at(x, y)) && !nearRoad(x, y)) cand.push([x, y]);
    if (!cand.length) break;
    const [x, y] = cand[Math.floor(random() * cand.length)];
    blobPaint(x, y, 1.6 + random() * 1.6, 1.2 + random() * 1.4, random() < 0.6 ? "forest" : "grass", true);
  }

  // 7. Paint: ground classes → autotile variants by 8-neighbour mask; icons on the upper layer.
  const groups = new Map((tileset.autotileGroups ?? []).map((g) => [g.id, g]));
  const rep = (c) => c === "plain" ? 240 : groups.get(GROUP[c]).variantMap["255"];
  const lower = cls.map(rep), upper = Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cls[at(x, y)]; if (c === "plain") continue;
    const g = groups.get(GROUP[c]); assert(g, "Missing world group " + GROUP[c]);
    const join = new Set(g.connectTileIds ?? g.memberTileIds);
    let mask = 0; for (const [dx, dy, bit] of N8) if (!inside(x + dx, y + dy) || join.has(rep(cls[at(x + dx, y + dy)]))) mask |= bit;
    lower[at(x, y)] = g.variantMap[String(mask)];
  }
  for (const p of places) {
    const icon = ICON[p.icon]; if (!icon) continue;
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) { const t = icon[dy][dx]; if (t < 0) continue; if (p.lowerIcon) lower[at(p.x + dx, p.y + dy)] = t; else upper[at(p.x + dx, p.y + dy)] = t; }
  }
  const map = { id: plan.id, name: plan.name, width: W, height: H, tileSize: 16, tilesetId: plan.tilesetId, lowerTiles: lower, upperTiles: upper, events: [] };

  // 8. Check: every place's approach cell is walkable and all of them are joined on foot (tileset passability).
  const pass = (i) => { const u = upper[i], t = u >= 0 ? u : lower[i], f = tileset.passability[t]; return Boolean(f && (f.up || f.down || f.left || f.right)) && (u < 0 || (() => { const g = tileset.passability[lower[i]]; return g && (g.up || g.down); })()); };
  const start = door(places[0]), seen = new Set([at(...start)]), q = [at(...start)];
  assert(pass(at(...start)), "World start not walkable " + start);
  while (q.length) { const i = q.pop(), x = i % W, y = Math.floor(i / W); for (const [dx, dy] of N8.slice(0, 4)) { const j = at(x + dx, y + dy); if (inside(x + dx, y + dy) && !seen.has(j) && pass(j)) { seen.add(j); q.push(j); } } }
  const blocked = places.filter((p) => !seen.has(at(...door(p))));
  assert.equal(blocked.length, 0, "World places cut off: " + blocked.map((p) => p.id).join(","));
  const e = emptiness();
  const counts = {}; for (const c of cls) counts[c] = (counts[c] ?? 0) + 1;
  const meta = { places: places.map(({ id, name, placeId, icon, kind, x, y, w, h }) => ({ id, name, placeId, icon, kind, x, y, w, h, approach: door({ x, y, w, h }) })), terrain: counts,
    roads: roadCells.size };
  return { map, meta, check: { reachable: seen.size, places: places.length, emptiness: { maxSq: e.maxSq, screen: +e.screen.toFixed(3), at: e.at, screenAt: e.screenAt } } };

  // ——— helpers ———
  function components(pred) {
    const seen2 = new Set(), out = [];
    for (let i = 0; i < W * H; i++) { if (seen2.has(i) || !pred(i)) continue; const c = [i], st = [i]; seen2.add(i);
      while (st.length) { const j = st.pop(), x = j % W, y = Math.floor(j / W); for (const [dx, dy] of N8.slice(0, 4)) { const k = at(x + dx, y + dy); if (inside(x + dx, y + dy) && !seen2.has(k) && pred(k)) { seen2.add(k); st.push(k); c.push(k); } } }
      out.push(c); }
    return out;
  }
  function smooth(isWet, set) {
    for (let n = 0; n < 4; n++) for (let i = 0; i < W * H; i++) { const x = i % W, y = Math.floor(i / W); if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const wet = N8.slice(0, 4).filter(([dx, dy]) => isWet(at(x + dx, y + dy))).length;
      if (isWet(i) && wet <= 1) set(i, false); else if (!isWet(i) && wet >= 3) set(i, true); }
  }
  function blobPaint(cx, cy, rx, ry, kind, gate = false) {
    const ph = random() * 6.28;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!inside(x, y)) continue;
      const i = at(x, y), t = Math.atan2((y - cy) / ry, (x - cx) / rx), r = 1 + 0.2 * Math.sin(t * 3 + ph);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > r * r || placeRing.has(i)) continue;
      const c = cls[i];
      if (gate && (c !== "plain" || nearRoad(x, y))) continue;
      if (kind === "lake") { if (c !== "sea") cls[i] = "sea"; continue; }
      if (c === "sea" || c === "road") continue;
      cls[i] = kind === "forest" && c === "snow" ? "snowforest" : kind;
    }
  }
  function nearRoad(x, y) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && cls[at(x + dx, y + dy)] === "road") return true; return false; }
  function route(a, b) {
    const s = at(...a), g = at(...b), dist = new Map([[s, 0]]), prev = new Map(), open = [s];
    while (open.length) {
      let k = 0; for (let n = 1; n < open.length; n++) if (dist.get(open[n]) < dist.get(open[k])) k = n;
      const i = open.splice(k, 1)[0]; if (i === g) break;
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of N8.slice(0, 4)) { const j = at(x + dx, y + dy); if (!inside(x + dx, y + dy)) continue;
        const c = j === g ? 1 : placeCells.has(j) ? Infinity : cost(j); if (!Number.isFinite(c)) continue;
        const nd = dist.get(i) + c + 0.02 * ((x * 7 + y * 13) % 5); if (nd < (dist.get(j) ?? Infinity)) { dist.set(j, nd); prev.set(j, i); if (!open.includes(j)) open.push(j); } }
    }
    if (!prev.has(g) && s !== g) return null;
    const out = []; for (let i = g; i !== undefined && i !== s; i = prev.get(i)) out.push(i); out.push(s); return out;
  }
  function emptiness() {
    const P = cls.map((c) => (c === "plain" ? 1 : 0));
    for (const p of places) for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) P[at(p.x + dx, p.y + dy)] = 0;
    const dp = new Int32Array((W + 1) * (H + 1)); let best = 0, bat = [0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (P[at(x, y)]) { const v = 1 + Math.min(dp[y * (W + 1) + x + 1], dp[(y + 1) * (W + 1) + x], dp[y * (W + 1) + x]); dp[(y + 1) * (W + 1) + x + 1] = v; if (v > best) { best = v; bat = [x - v + 1, y - v + 1]; } }
    let worst = 0, wat = [0, 0];
    for (let y0 = 0; y0 + 13 <= H; y0 += 2) for (let x0 = 0; x0 + 17 <= W; x0 += 2) { let n = 0; for (let y = y0; y < y0 + 13; y++) for (let x = x0; x < x0 + 17; x++) n += P[at(x, y)]; if (n / 221 > worst) { worst = n / 221; wat = [x0, y0]; } }
    return { maxSq: best, at: bat, screen: worst, screenAt: wat };
  }
}
export { WALK };

// The bundled world sheet paints its object cells (castles, houses, caves) on the #ff678b key colour and the bundled
// tileset carries no transparentColor, so icons on the upper layer would show a pink square. The world map uses a copy
// of that tileset with the key set (same art, same autotile groups).
export const WORLD_TILESET_ID = "oprn_world_keyed";
export function worldKeyedTileset(base) {
  return { ...structuredClone(base), id: WORLD_TILESET_ID, name: "월드맵 · EasyRPG (분홍 키 투명)", transparentColor: "#ff678b" };
}
