// Ship decks, ship-sheet quays and sky scenes for tiledata/atlas-scenes — GridMap plans on the pipeline copy of
// easyrpg_chipset_ship (vehicle pieces grafted from 480). Ship-sheet props (barrels 385, crates 379, cannons 324/325 ·
// 326/356 · 327/357, helm 58, rope 263, anchor 259, lantern 119 …) are the sheet's own tiles.
import assert from "node:assert/strict";
import { GridMap, piece, SHIP_BASE } from "./atlas-scenes-kit.mjs";

export const SEA = 0, SAND = 240, STONE = 367;
export const P = {
  barrel: [385], tallBarrel: [[299], [329]], crate: [379], chest: [382], jar: [386], table: [387], stool: [417], bucket: [415],
  anchor: [259], rope: [263], swords: [295], helm: [58], lantern: [119], potions: [148], grate: [202],
  cannonL: [324, 325], cannonR: [354, 355], cannonDown: [[326], [356]], cannonUp: [[327], [357]],
  flag: [288], banner: [318], ladder: [328],
};

/** Deck cells of a placed vehicle: walkable lower cells (plank), with free = upper empty. */
export function deckOf(g, v) {
  const p = piece(v.name), cells = [];
  for (let k = 0; k < p.w * p.h; k++) {
    const lo = p.lower[k];
    if (lo < 0) continue;
    const x = v.x + (k % p.w), y = v.y + Math.floor(k / p.w);
    if (!g.ts.passability[SHIP_BASE + lo]?.up) continue;
    cells.push([x, y]);
  }
  const has = new Set(cells.map(([x, y]) => g.at(x, y)));
  const free = (x, y) => has.has(g.at(x, y)) && g.upper[g.at(x, y)] === -1;
  const ys = cells.map((c) => c[1]), xs = cells.map((c) => c[0]);
  return { cells, has, free, top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
}

/** Put a prop (rows of tiles) on free deck/floor cells at or near (x, y) (spiral ≤ r), keeping a walk lane: never on `keep`. */
export function propNear(g, deck, tiles, x, y, purpose, { r = 3, keep = new Set() } = {}) {
  const rows = Array.isArray(tiles[0]) ? tiles : [tiles], w = rows[0].length, h = rows.length;
  const spots = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) * 1.1]);
  spots.sort((a, b) => a[2] - b[2]);
  for (const [X, Y] of spots) {
    let ok = true;
    for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w; dx++) {
      const cx = X + dx, cy = Y + dy;
      if (rows[dy][dx] < 0) continue;
      if (!deck.free(cx, cy) || keep.has(g.at(cx, cy))) { ok = false; break; }
    }
    if (!ok) continue;
    g.prop(rows, X, Y, w, purpose);
    return [X, Y];
  }
  throw new assert.AssertionError({ message: `${g.map.id}: no deck room for ${purpose} near ${x},${y}` });
}

/** Stone quay (ship-sheet grammar): body 367, north edge 397 (398 NE), south edge 457 (458 SE), east edge 428,
 *  west edge 426 when the quay meets sand, and the stone front face 169 (170 at the east end) on the water row below. */
export function quay(g, x0, y0, x1, y1, { westLand = true, face = true } = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let t = STONE;
    if (y === y0) t = x === x1 ? 398 : 397;
    else if (y === y1) t = x === x1 ? 458 : 457;
    else if (x === x1) t = 428;
    else if (x === x0 && westLand) t = 426;
    g.set(x, y, t, "lower");
  }
  if (face && y1 + 1 < g.H) for (let x = x0; x <= x1; x++) { g.set(x, y1 + 1, SEA, "lower"); g.set(x, y1 + 1, x === x1 ? 170 : x === x0 && westLand ? 168 : 169); }
}

/** Open sea with a few glints; `sand` = [x0,y0,x1,y1] beach rectangle. */
export function sea(g) { g.rect(0, 0, g.W, g.H, SEA); }

export function lockWater(ts) {
  // The ship sheet marks its sea tiles walkable (deck maps relied on events); these maps need the sea to stop walkers.
  for (const base of [0, 30, 60, 90, 120, 150, 180, 210]) for (let d = 0; d < 6; d++) ts.passability[base + d] = { up: false, down: false, left: false, right: false };
}

// ── deck dressing by role ────────────────────────────────────────────────────────────────────────────────────────
function railCannons(g, deck, v, every, { north = false, south = true } = {}, lane = new Set()) {
  const n = [];
  const ok = (x, y) => deck.free(x, y) && !lane.has(g.at(x, y));
  for (let x = deck.left + 4; x <= deck.right - 3; x += every) {
    if (north && ok(x, deck.top) && ok(x, deck.top + 1)) { g.prop(P.cannonUp, x, deck.top, 1, "뱃전 대포(북쪽)"); n.push([x, deck.top]); }
    if (south && ok(x, deck.bottom - 1) && ok(x, deck.bottom)) { g.prop(P.cannonDown, x, deck.bottom - 1, 1, "뱃전 대포(남쪽)"); n.push([x, deck.bottom]); }
  }
  return n;
}

function cargoPile(g, deck, x, y, kinds, purpose, keep) {
  for (const [dx, dy, k] of kinds) tryProp(g, deck, P[k], x + dx, y + dy, purpose, keep, 2);
}

/** propNear that records a skip instead of failing (a crowded deck just gets one prop fewer). */
export function tryProp(g, deck, tiles, x, y, purpose, keep, r = 3) {
  try { return propNear(g, deck, tiles, x, y, purpose, { r, keep }); }
  catch (e) { if (!(e instanceof assert.AssertionError)) throw e; (g.skipped ??= []).push(purpose); return null; }
}

/**
 * A ship deck scene. spec: { ship: piece name, x, y, cannons: every n | 0, cargo: [[x,y,[[dx,dy,kind]...],purpose]],
 * helm: true, extras: [[kind, x, y, purpose]] } — coordinates relative to the ship piece origin.
 */
/** Largest empty rectangle (area, and its centre) of free deck cells off the lane — the deck's emptiness measure.
 *  Decks are long and narrow, so a square measure misses the long empty strips between the rails. */
export function deckEmpty(g, deck, lane = new Set()) {
  const ok = (x, y) => deck.free(x, y) && !lane.has(g.at(x, y));
  let best = { area: 0, at: null };
  for (const [x, y] of deck.cells) {
    if (!ok(x, y)) continue;
    let minW = 99;
    for (let h = 1; h <= 4 && ok(x, y + h - 1); h++) {
      let w = 0; while (w < 12 && ok(x + w, y + h - 1)) w++;
      minW = Math.min(minW, w);
      if (minW * h > best.area) best = { area: minW * h, at: [x + Math.floor(minW / 2), y + Math.floor((h - 1) / 2)] };
    }
  }
  return best;
}
export const deckEmptySquare = (g, deck, lane) => deckEmpty(g, deck, lane).area;

/** Walkable deck cells connected to `from` (4-neighbour, props block). */
function deckReach(g, deck, from) {
  const walk = (x, y) => deck.has.has(g.at(x, y)) && (g.upper[g.at(x, y)] === -1 || g.ts.passability[g.upper[g.at(x, y)]]?.up);
  const seen = new Set([g.at(...from)]), q = [from];
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = g.at(x + dx, y + dy); if (!seen.has(i) && walk(x + dx, y + dy)) { seen.add(i); q.push([x + dx, y + dy]); } } }
  return seen;
}

/** Fill the deck with small clusters from `pool` until no empty square larger than `maxSq` is left off the lane,
 *  never cutting the walkable deck apart (a cluster that shrinks the reachable deck by more than its own cells is undone). */
export function clutterDeck(g, deck, lane, pool, from, { maxArea = 5, seed = 1 } = {}) {
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let guard = 0;
  while (deckEmpty(g, deck, lane).area > maxArea && guard++ < 120) {
    const target = deckEmpty(g, deck, lane).at;
    if (!target) break;
    const [kinds, purpose] = pool[Math.floor(rand() * pool.length)];
    const before = deckReach(g, deck, from).size;
    const snapshot = [...g.upper], nPlaced = g.placements.length;
    let cells = 0, first = null;
    for (const kind of kinds) {
      const tiles = P[kind] ?? kind;
      const at = tryProp(g, deck, tiles, first ? first[0] : target[0], first ? first[1] : target[1], purpose, lane, first ? 1 : 1);
      if (!at) continue;
      first ??= at;
      cells += (Array.isArray(tiles[0]) ? tiles.flat() : tiles).length;
    }
    if (!first) { if (process.env.ATLAS_DEBUG) console.log("nofit", target, kinds); lane.add(g.at(...target)); continue; }
    if (process.env.ATLAS_DEBUG) console.log("try", target, kinds, before, deckReach(g, deck, from).size, cells);
    if (deckReach(g, deck, from).size < before - cells) { g.upper.splice(0, g.upper.length, ...snapshot); g.placements.length = nPlaced; lane.add(g.at(...target)); }
  }
  return deckEmpty(g, deck, lane).area;
}

// Deck piles by ship kind (each entry is one small pile: 1~3 things that stand together).
export const CLUTTER = {
  merchant: [[["crate", "crate", "barrel"], "갑판 짐 더미"], [["barrel", "barrel"], "물통 두 개"], [["rope", "bucket"], "밧줄과 양동이"], [["crate", "jar"], "상자와 항아리"], [["grate"], "화물칸 환기 격자"]],
  warship: [[["barrel", "barrel"], "화약통"], [["chest", "crate"], "포탄 궤"], [["rope"], "감긴 밧줄"], [["grate"], "포갑판 환기 격자"], [["bucket", "barrel"], "소화용 물통"]],
  pirate: [[["barrel", "chest"], "럼통과 약탈 궤"], [["crate", "barrel", "jar"], "약탈품 더미"], [["rope"], "감긴 밧줄"], [["swords"], "칼 걸이"], [["grate"], "화물칸 격자"]],
  royal: [[["chest", "chest"], "왕실 궤"], [["banner"], "금빛 깃발"], [["barrel", "crate"], "보급품"], [["grate"], "환기 격자"]],
  liner: [[["crate", "crate"], "승객 짐"], [["table", "stool"], "쉼 탁자"], [["barrel"], "물통"], [["jar", "crate"], "항아리와 궤"]],
  fishing: [[["barrel", "bucket"], "생선 통"], [["rope"], "그물 밧줄"], [["jar"], "미끼 항아리"], [["crate", "barrel"], "얼음 상자와 통"]],
};

export function dressShip(g, v, spec) {
  const deck = deckOf(g, v);
  const lane = new Set();
  // keep a walking lane one row north of the deck centre (the mast collars sit on the centre row), the cells in front
  // of the deckhouse door and the gangway column
  const mid = Math.round((deck.top + deck.bottom) / 2);
  for (let x = deck.left; x <= deck.right; x++) lane.add(g.at(x, mid - 1));
  // the row in front of the deckhouse door runs the whole deck too
  for (const d of v.doors) for (let x = deck.left; x <= deck.right; x++) lane.add(g.at(x, d.y + 1));
  if (v.gangway) for (let y = deck.top; y <= v.gangway.y; y++) lane.add(g.at(v.gangway.x, y));
  if (spec.cannons) railCannons(g, deck, v, spec.cannons, spec.cannonSides ?? {}, lane);
  for (const [x, y, kinds, purpose] of spec.cargo ?? []) cargoPile(g, deck, v.x + x, v.y + y, kinds, purpose, lane);
  if (spec.helm !== false) tryProp(g, deck, P.helm, deck.right - 2, mid, "조타륜", lane);
  for (const [kind, x, y, purpose] of spec.extras ?? []) tryProp(g, deck, P[kind] ?? kind, v.x + x, v.y + y, purpose, lane);
  const entry = [...lane].map((i) => [i % g.W, Math.floor(i / g.W)]).filter(([x, y]) => deck.free(x, y))
    .sort((a, b) => Math.abs(a[0] - (deck.left + deck.right) / 2) - Math.abs(b[0] - (deck.left + deck.right) / 2))[0];
  if (process.env.ATLAS_DEBUG) console.log("clutter", g.map.id, deckEmptySquare(g, deck, lane), deck.cells.length, entry);
  const empty = clutterDeck(g, deck, lane, spec.clutter ?? CLUTTER[spec.kind ?? "merchant"], entry, { seed: spec.seed ?? 1 });
  if (process.env.ATLAS_DEBUG) console.log("after", empty);
  return { deck, mid, entry, empty };
}

export function shipPlans() {
  const plans = [];
  const deckPlan = (id, name, W, H, shipName, sx, sy, spec, meta) => plans.push({
    id, name, tileset: "ship", as: "place", width: W, height: H, ...meta,
    build(ctx) {
      const g = new GridMap({ id, name, width: W, height: H, tileset: ctx.ship, fill: SEA });
      const pre = spec.before?.(g, ctx);
      const v = g.vehicle(shipName, sx, sy, { purpose: meta.purpose });
      const { deck, entry: laneEntry } = dressShip(g, v, { kind: shipName.split(":")[2], ...spec });
      const after = spec.after?.(g, ctx, v, deck, pre) ?? {};
      const entry = after.entry ?? laneEntry;
      g.targets.push(...v.doors.map((d) => [d.x, d.y]), ...(after.targets ?? []));
      return { g, entry };
    },
  });

  // 1 대형 상선 · 항해 중
  deckPlan("deck-merchant-galleon-sailing", "대형 상선 · 갑판(항해 중)", 40, 22, "ship:galleon:merchant:sailing:left", 3, 3, {
    cargo: [[20, 12, [[0, 0, "barrel"], [1, 0, "barrel"], [0, -1, "crate"], [1, -1, "crate"]], "갑판 짐 더미(선실 앞)"],
      [13, 12, [[0, 0, "crate"], [1, 0, "jar"]], "주돛대 곁 짐"], [6, 11, [[0, 0, "rope"], [1, 0, "anchor"]], "뱃머리 닻과 밧줄"]],
    extras: [["rope", 11, 11, "돛대 밧줄"], ["rope", 18, 11, "돛대 밧줄"], ["grate", 15, 12, "화물칸 환기 격자"], ["lantern", 23, 11, "선실 앞 등불"], ["bucket", 9, 12, "갑판 물 양동이"]],
  }, { purpose: "대양을 건너는 상선의 윗갑판. 돛 셋을 펴고 달린다. 선실 문 아래로 화물칸이 있다", placeTags: ["항해"] });

  // 2 왕국 군함 · 항해 중 (양 뱃전 대포)
  deckPlan("deck-warship-galleon-sailing", "왕국 군함 · 갑판(항해 중)", 40, 22, "ship:galleon:warship:sailing:left", 3, 3, {
    cannons: 3,
    cargo: [[20, 12, [[0, 0, "barrel"], [1, 0, "barrel"], [0, -1, "chest"]], "화약통과 포탄 궤(선실 앞)"]],
    extras: [["swords", 12, 11, "무기 걸이"], ["flag", 26, 10, "함장기"], ["lantern", 23, 11, "선실 앞 등불"], ["grate", 15, 12, "포갑판 환기 격자"], ["anchor", 6, 11, "뱃머리 닻"]],
  }, { purpose: "왕국 해군 전열함의 윗갑판. 양 뱃전에 대포가 줄지어 있고 붉은 십자 돛을 폈다", placeTags: ["항해", "전투"] });

  // 3 해적선 · 추격 중
  deckPlan("deck-pirate-galleon-chase", "해적선 · 갑판(추격 중)", 40, 22, "ship:galleon:pirate:sailing:left", 3, 3, {
    cannons: 4, cannonSides: { north: false },
    cargo: [[19, 12, [[0, 0, "barrel"], [1, 0, "chest"], [0, -1, "barrel"]], "약탈품 궤와 럼통"], [10, 12, [[0, 0, "rope"], [1, 0, "crate"]], "갑판 밧줄과 상자"]],
    extras: [["swords", 13, 11, "해적 칼 걸이"], ["flag", 26, 10, "해골 깃발"], ["lantern", 23, 11, "선실 앞 등불"], ["anchor", 6, 11, "뱃머리 닻"]],
  }, { purpose: "검은 해골 돛을 단 해적선. 남쪽 뱃전 대포로 상선을 쫓는다", placeTags: ["항해", "전투", "해적"] });

  // 4 왕실 기함 (붉은 돛, 가운데 붉은 길)
  deckPlan("deck-royal-flagship", "왕실 기함 · 갑판(순행)", 40, 22, "ship:galleon:royal:sailing:left", 3, 3, {
    cannons: 5,
    cargo: [[20, 12, [[0, 0, "chest"], [1, 0, "chest"]], "왕실 보물 궤(선실 앞)"]],
    extras: [["banner", 9, 11, "금빛 깃발"], ["banner", 17, 11, "금빛 깃발"], ["lantern", 23, 11, "선실 앞 등불"], ["potions", 21, 10, "시종의 물약 선반"]],
  }, { purpose: "왕이 타는 기함. 붉은 돛과 금빛 깃발, 선실 앞에 왕실 보물 궤", placeTags: ["항해", "왕실"] });

  // 5 여객선 (중형) — 승객 짐
  deckPlan("deck-liner-brig", "여객선 · 갑판(뱃길)", 32, 20, "ship:brig:liner:sailing:left", 3, 3, {
    cargo: [[13, 9, [[0, 0, "crate"], [1, 0, "crate"], [0, -1, "jar"]], "승객 짐 궤"], [5, 9, [[0, 0, "table"], [-1, 0, "stool"], [1, 0, "stool"]], "갑판 쉼 탁자와 걸상"]],
    extras: [["lantern", 16, 8, "선실 앞 등불"], ["bucket", 9, 10, "물 양동이"], ["rope", 8, 8, "돛대 밧줄"]],
  }, { purpose: "섬과 섬을 잇는 여객선. 푸른 줄무늬 돛, 갑판에 쉼 탁자와 승객 짐", placeTags: ["항해", "여행"] });

  // 6 해적 쌍돛선 (중형)
  deckPlan("deck-pirate-brig", "해적 쌍돛선 · 갑판", 32, 20, "ship:brig:pirate:sailing:left", 3, 3, {
    cannons: 3,
    cargo: [[13, 9, [[0, 0, "barrel"], [1, 0, "barrel"], [0, -1, "chest"]], "럼통과 약탈 궤"]],
    extras: [["swords", 9, 8, "칼 걸이"], ["lantern", 16, 8, "선실 앞 등불"]],
  }, { purpose: "작은 해적단의 쌍돛선. 대포 몇 문과 럼통", placeTags: ["항해", "해적"] });

  // 7 고깃배 (작은 범선)
  deckPlan("deck-fishing-sloop", "고깃배 · 갑판(새벽 조업)", 24, 16, "ship:sloop:fishing:sailing:left", 3, 3, {
    helm: false,
    cargo: [[8, 7, [[0, 0, "barrel"], [1, 0, "bucket"]], "생선 통과 양동이"]],
    extras: [["rope", 4, 7, "그물 밧줄"], ["jar", 10, 6, "미끼 항아리"]],
  }, { purpose: "새벽 바다의 작은 고깃배. 생선 통·그물 밧줄·미끼 항아리", placeTags: ["항해", "어업"] });

  // 8 상선 정박 (돌부두 남쪽, 승선 판자)
  deckPlan("deck-merchant-galleon-docked", "대형 상선 · 갑판(정박, 돌부두)", 42, 24, "ship:galleon:merchant:docked:left", 4, 2, {
    cargo: [[20, 11, [[0, 0, "barrel"], [1, 0, "barrel"], [0, -1, "crate"]], "하역할 짐(선실 앞)"], [8, 12, [[0, 0, "crate"], [1, 0, "crate"], [0, -1, "crate"]], "하역할 궤짝"]],
    extras: [["rope", 12, 11, "돛대 밧줄"], ["anchor", 6, 10, "뱃머리 닻"], ["lantern", 23, 10, "선실 앞 등불"]],
    after(g, ctx, v) {
      // quay below the gangway: stone body with its north edge on the hull's water line, sand beyond
      const qy = v.y + v.h;
      quay(g, 0, qy, 41, 23, { westLand: false, face: false });
      // cargo landed on the quay in piles either side of the gangway, a cannon for the harbour salute, rope at the bollards
      const piles = [[3, 1, [[385, 385, 379], [379, 385, -1]], "부리는 짐 더미"], [10, 2, [[379, 379], [385, -1]], "궤짝 더미"],
        [28, 1, [[385, 263, 379], [-1, 379, 385]], "실을 짐 더미"], [35, 2, [[386, 386], [415, -1]], "물 항아리"], [16, 3, [[324, 325]], "예포 대포"],
        [38, 0, [[263]], "계류 밧줄"], [1, 0, [[263]], "계류 밧줄"]];
      for (const [x, dy, rows, n] of piles) g.prop(rows, x, qy + dy, rows[0].length, n);
      return { targets: [[v.gangway.x, qy + 1], [20, 22]], entry: [v.gangway.x, qy + 2] };
    },
  }, { purpose: "돛을 접고 돌부두에 댄 상선. 가운데 승선 판자로 부두와 갑판이 이어진다", placeTags: ["정박", "항구"] });

  // 9 군함 정박 (닻 내린 만, 작은 배 곁)
  deckPlan("deck-warship-anchored", "군함 · 갑판(닻 내린 만)", 52, 22, "ship:galleon:warship:furled:right", 17, 3, {
    cannons: 3,
    cargo: [[12, 11, [[0, 0, "barrel"], [1, 0, "chest"]], "화약통"]],
    extras: [["swords", 16, 11, "무기 걸이"], ["anchor", 26, 11, "닻 감개"], ["lantern", 9, 10, "선실 앞 등불"]],
    after(g, ctx, v) {
      // a sloop moored alongside to the south-west (the ship's boat)
      g.vehicle("ship:sloop:fishing:furled:left", 1, v.y + 3, { purpose: "군함 고물에 매어 둔 작은 배" });
      return {};
    },
  }, { purpose: "돛을 접고 닻을 내린 군함. 곁에 작은 배 한 척", placeTags: ["정박", "전투"] });

  // 10 해적선이 상선에 뱃머리를 붙인 장면 (두 척, 뱃머리끼리 판자)
  plans.push({
    id: "deck-pirate-boarding", name: "해적의 습격 · 뱃머리를 맞댄 두 배", tileset: "ship", as: "place", width: 62, height: 22,
    purpose: "해적 쌍돛선(왼쪽)이 상선(오른쪽)에 뱃머리를 맞대고 건너 판자 둘을 걸쳤다. 해적은 판자를 건너 상선 갑판으로 넘어간다",
    placeTags: ["항해", "전투", "해적"],
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 62, height: 22, tileset: ctx.ship, fill: SEA });
      const pirate = g.vehicle("ship:brig:pirate:sailing:right", 2, 4, { purpose: "습격하는 해적선" });
      const merchant = g.vehicle("ship:galleon:merchant:sailing:left", 27, 3, { purpose: "습격당한 상선" });
      const dp = deckOf(g, pirate), dm = deckOf(g, merchant);
      const plank = SHIP_BASE + piece("plank:h").upper[0];
      for (const y of [12, 14]) {
        // from the pirate's last deck cell on this row to the merchant's first
        let x0 = dp.right; while (x0 > dp.left && !dp.has.has(g.at(x0, y))) x0--;
        let x1 = dm.left; while (x1 < dm.right && !dm.has.has(g.at(x1, y))) x1++;
        for (let x = x0 + 1; x < x1; x++) { g.set(x, y, plank, "upper"); }
      }
      dressShip(g, pirate, { kind: "pirate", cannons: 4, cannonSides: { north: false }, extras: [["swords", 8, 9, "칼 걸이"], ["barrel", 14, 9, "럼통"]], helm: false });
      dressShip(g, merchant, { kind: "merchant", cargo: [[20, 12, [[0, 0, "crate"], [1, 0, "crate"], [0, -1, "barrel"]], "상선 짐"]], extras: [["lantern", 23, 11, "선실 앞 등불"], ["chest", 12, 11, "상선 금고 궤"]] });
      g.targets.push(...merchant.doors.map((d) => [d.x, d.y]), ...pirate.doors.map((d) => [d.x, d.y]), [dm.left + 2, 12]);
      return { g, entry: [dp.left + 6, 12] };
    },
  });
  return plans;
}
