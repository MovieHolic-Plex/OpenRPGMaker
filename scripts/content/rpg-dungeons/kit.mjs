// Assembly kit for the RPG dungeon maps (tiledata/rpg-dungeons). Terrain and placement only — no events.
// A map is ASCII art (terrain) + an overlay of the same size (props anchored at their top-left cell).
// Walls are never hand-stacked: every open cell whose upper neighbours are void becomes the theme's
// two-row wall face (the 「무너진 납골당」 grammar), void cells take the theme's rim autotile, and every
// material patch (lava, ice, carpet, chasm, pits, dirt, dais) is shaped by its own autotile group.
import assert from "node:assert/strict";

export const DIRS8 = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];

/** Terrain themes on the dungeon sheet (and its recoloured copies, which keep the numbers). */
export const THEMES = {
  // brown rock face over grey-green stone — the ossuary / waterworks look
  stone: { rim: "abyss-gray", wall: [[21, 22, 23], [51, 52, 53]], floor: 187 },
  // same face over the dirt floor of the approved iron-vein mine
  cave: { rim: "abyss-gray", wall: [[21, 22, 23], [51, 52, 53]], floor: 421 },
  // blue ice cliff over snow, blue rim — the approved ice cave
  ice: { rim: "abyss-blue", wall: [[373, 373, 373], [403, 403, 403]], floor: 67 },
  // red gravel + root-curtain face over redrock, gold-trimmed dark rim — the approved lava cave
  // (the sheet flags 103 walkable, so the face starts one row lower: 133 over the root curtain 163)
  lava: { rim: "pit-gold", wall: [[133, 133, 133], [163, 163, 163]], floor: 301 },
  // cut stone tiles for built halls (temple, tower, demon keep)
  hall: { rim: "abyss-gray", wall: [[21, 22, 23], [51, 52, 53]], floor: 108 },
  // redrock under the brown face — the shipped 마왕성 왕좌의 방
  demon: { rim: "abyss-gray", wall: [[21, 22, 23], [51, 52, 53]], floor: 301 },
};

/** Terrain characters. `fill` is a plain tile, `group` an autotile group shaped after placement. */
export const TERRAIN = {
  ".": { floor: true },
  "~": { fill: 3 }, // water, stone-edged canal skin (the renderer shapes the shore from tile 3)
  "_": { fill: 110 }, // blue-grey cobble ledge (pool edges, walkways)
  ",": { fill: 187 }, // grey-green stone (secondary floor)
  ";": { fill: 421 }, // dirt (secondary floor)
  "t": { fill: 108 }, // cut stone tile
  "q": { fill: 109 }, // concentric square tile (shrine centre)
  "s": { fill: 67 }, // snow
  "R": { fill: 301 }, // redrock
  "w": { fill: 141 }, // wooden boards (floor, walkway)
  "|": { fill: 171 }, // wooden boards, one board wide
  "=": { fill: 3, upper: 141 }, // plank bridge laid over water: the water stays one body under it
  "&": { group: "lava", upper: 141 }, // plank bridge laid over lava
  "%": { group: "chasm", upper: 141 }, // plank bridge laid over a chasm (or cave water): one body under it
  "W": { group: "chasm" }, // cave water: on the cave / sea repaints the chasm autotile is a pool with a rock lip
  "L": { group: "lava" },
  "i": { group: "ice" },
  "r": { group: "red-carpet" },
  "c": { group: "chasm" },
  "p": { group: "pit-pale" },
  "o": { group: "pit-gold" },
  "d": { group: "dirt" },
  "b": { group: "abyss-blue", solid: true },
  "D": { nine: [135, 136, 137, 165, 166, 167, 195, 196, 197] }, // brown dais
  "P": { nine: [405, 406, 407, 435, 436, 437, 465, 466, 467] }, // green-grey rock dais
  "m": { fill: 487, solid: false }, // crenellated parapet (tower roof edge), grafted from the town sheet
  "y": { fill: 82 }, // packed arena sand
  "k": { fill: 111 }, // dark damp stone (wet cellar / swamp floor)
  "!": { group: "pit-pale", upper: 141 }, // plank boardwalk laid over a bog pit: one body under it
  "a": { fill: 172 }, "v": { fill: 173 }, "<": { fill: 202 }, ">": { fill: 203 }, // arrow floor panels
};
export const VOID = new Set([" ", "#"]);

/** Overlay props: rows of tiles anchored at the letter's cell. layer "lower" replaces the terrain tile. */
export const PROPS = {
  T: { name: "화로", rows: [[263], [293]] },
  w: { name: "벽 횃불", rows: [[264]] },
  I: { name: "석주", rows: [[446], [476]] },
  S: { name: "여신 석상", rows: [[145], [175]] },
  G: { name: "가고일 석상", rows: [[146], [176]] },
  X: { name: "십자 비석", rows: [[147]] },
  Y: { name: "석판 비석", rows: [[148]] },
  k: { name: "회색 석순", rows: [[261], [291]] },
  q: { name: "작은 갈색 석순", rows: [[288]] },
  C: { name: "푸른 수정 기둥", rows: [[262], [292]] },
  e: { name: "작은 푸른 수정", rows: [[289]] },
  Q: { name: "큰 푸른 수정", rows: [[320, 321], [350, 351]] },
  n: { name: "수정 무더기", rows: [[413]] },
  B: { name: "큰 갈색 바위", rows: [[318, 319], [348, 349]] },
  O: { name: "큰 회색 바위", rows: [[322, 323], [352, 353]] },
  o: { name: "둥근 돌", rows: [[290]] },
  R: { name: "돌무더기", rows: [[259, 260]] },
  u: { name: "회색 자갈", rows: [[382]] },
  U: { name: "잔돌 더미", rows: [[383]] },
  z: { name: "갈색 잔돌", rows: [[412]] },
  K: { name: "해골과 뼈", rows: [[299]] },
  E: { name: "나무통", rows: [[417]] },
  J: { name: "항아리", rows: [[418]] },
  j: { name: "물통", rows: [[419]] },
  N: { name: "붉은 마법진", rows: [[441, 442, 443], [471, 472, 473], [27, 28, 29]] },
  A: { name: "석조 아치 문", rows: [[438, 439, 440], [468, 469, 470]] },
  // Stairs: steps climbing into a straight wall face (up), and steps sunk in the floor behind an iron rail (down).
  "^": { name: "오르는 돌계단(벽면)", rows: [["stepL", "stepM", "stepR"], ["stepL", "stepM", "stepR"]], layer: "lower" },
  "-": { name: "계단 난간", rows: [[234, 235, 236]] },
  Z: { name: "왕좌", rows: [[447, 448, 449], [477, 478, 479]] },
  F: { name: "바닥 불길", rows: [[207]] },
  f: { name: "바닥 불길 작은", rows: [[209]] },
  d: { name: "어둠 출입구", rows: [[295], [325]], layer: "lower" },
  x: { name: "벽 균열", rows: [[267]] },
  y: { name: "벽 균열 큰", rows: [[268, 269]] },
  l: { name: "벽 레버", rows: [[266]] },
  p: { name: "벽 석판", rows: [[265]] },
  "=": { name: "쇠창살", rows: [[235]] },
  "[": { name: "쇠창살 왼끝", rows: [[234]] },
  "]": { name: "쇠창살 오른끝", rows: [[236]] },
  "0": { name: "창살 문", rows: [[205]] },
  V: { name: "덩굴", rows: [[177]] },
  W: { name: "덩굴 긴", rows: [[178]] },
  s: { name: "표지판", rows: [[298]] },
  h: { name: "사다리 선반", rows: [[297]] },
  b: { name: "책장", rows: [[329], [359]] },
  t: { name: "긴 탁자", rows: [[385, 386, 387]] },
  c: { name: "둥근 탁자", rows: [[326]] },
  g: { name: "이끼", rows: [[394]] },
  H: { name: "보물상자", rows: [["chest"]] },
  m: { name: "광차", rows: [["cart0", "cart1"]] },
  "*": { name: "얼음 블록", rows: [[232]] },
  "(": { name: "의자(왼쪽 보기)", rows: [[327]] },
  ")": { name: "의자(오른쪽 보기)", rows: [[328]] },
  "}": { name: "침대", rows: [[384], [414]] },
  "{": { name: "긴 나무 탁자(세로)", rows: [[294], [324], [354]] },
  "_": { name: "내려가는 돌계단", rows: [["stepL", "stepM", "stepR"], ["stepL", "stepM", "stepR"]], layer: "lower" },
  "&": { name: "눈 쌓인 봉우리", rows: [[408, 409]] },
  v: { name: "걸상", rows: [[356]] },
  M: { name: "파라오 석관(사막 시트 전용)", rows: [[54, 55], [84, 85], [116, 144]] },
};

/** Props that hang on a wall face, and props that may stand either on the face or the floor. */
export const WALL_PROPS = new Set(["w", "x", "y", "l", "p", "^", "A", "d", "V", "W", "h"]);
export const ANY_PROPS = new Set(["b", "-"]);

/** Tibo props copied onto the dungeon sheet (same slots on every dungeon-family tileset copy). */
export const GRAFTS = {
  chest: { source: 837, target: 480, label: "보물상자(닫힘)" },
  cart0: { source: 1231, target: 481, label: "광차 앞" },
  cart1: { source: 1232, target: 482, label: "광차 뒤" },
  // EasyRPG town sheet (same CC0 set as the dungeon sheet): stone steps that read as stairs, and the
  // crenellated parapet top for the tower roof.
  stepL: { chipset: "town", source: 111, target: 483, label: "돌계단 왼끝" },
  stepM: { chipset: "town", source: 112, target: 484, label: "돌계단 가운데" },
  stepR: { chipset: "town", source: 113, target: 485, label: "돌계단 오른끝" },
  crenelL: { chipset: "town", source: 108, target: 486, label: "흉벽 왼끝" },
  crenelM: { chipset: "town", source: 109, target: 487, label: "흉벽" },
  crenelR: { chipset: "town", source: 110, target: 488, label: "흉벽 오른끝" },
};
export const GRAFT_CHIPSETS = { tibo: "tex_tibo_interior_expanded", town: "tex_easyrpg_chipset_combined_town" };

/**
 * Rectangles → art text. ops: [ch, x0, y0, x1, y1] inclusive, painted in order over a void grid.
 * A sixth element { blob: seed } paints an irregular body inside the box instead of the rectangle: an
 * ellipse with a wobbling rim (seeded), cleaned so no one-cell spurs or notches are left. Water, lava, ice and
 * pits use it — square tanks and stickers read as man-made.
 */
export function grid(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill("#"));
  for (const [c, x0, y0, x1 = x0, y1 = y0, opt] of ops) {
    const cells = opt?.blob !== undefined ? blobCells(x0, y0, x1, y1, opt.blob, opt.wobble ?? 0.28) : null;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
      if (!cells || cells.has(`${x},${y}`)) g[y][x] = c;
  }
  return "\n" + g.map((r) => r.join("")).join("\n") + "\n";
}

/** Irregular body inside a box: wobbly ellipse, then spurs trimmed and notches filled (2 passes). */
export function blobCells(x0, y0, x1, y1, seed, wobble = 0.28) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
  // a few low-frequency bumps around the rim, from the seed
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const bumps = Array.from({ length: 4 }, () => ({ k: 2 + Math.floor(rnd() * 3), a: rnd() * Math.PI * 2, w: (0.4 + rnd() * 0.6) * wobble }));
  const set = new Set();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - (cx + 0.5)) / rx, dy = (y + 0.5 - (cy + 0.5)) / ry, t = Math.atan2(dy, dx);
    // the rim wobbles inward from the box edge, so the box never clips the body into a rectangle
    const r = 1.04 - wobble * 0.9 + bumps.reduce((acc, b) => acc + b.w * Math.sin(b.k * t + b.a), 0);
    if (Math.hypot(dx, dy) <= r) set.add(`${x},${y}`);
  }
  for (let pass = 0; pass < 2; pass++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => set.has(`${x + a},${y + b}`)).length;
    const k = `${x},${y}`;
    if (set.has(k) && n <= 1) set.delete(k);
    else if (!set.has(k) && n >= 3) set.add(k);
  }
  // one body only: stray crumbs left by the wobble go
  let best = new Set();
  const left = new Set(set);
  while (left.size) {
    const first = left.values().next().value, comp = new Set([first]), q = [first];
    left.delete(first);
    while (q.length) {
      const [x, y] = q.pop().split(",").map(Number);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + a},${y + b}`;
        if (left.has(k)) { left.delete(k); comp.add(k); q.push(k); }
      }
    }
    if (comp.size > best.size) best = comp;
  }
  return best;
}

/**
 * No floating wall stubs: a void body that does not reach the map border (8-connected) would render as a
 * boxed block standing in the room. It becomes floor. Solid autotile chars (crevasses) are not void and stay.
 */
export function dropFloatingVoid(rows) {
  const H = rows.length, W = rows[0].length, g = rows.map((r) => [...r]);
  const seen = new Set(), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && VOID.has(g[y][x])) { seen.add(y * W + x); q.push([x, y]); }
  while (q.length) {
    const [x, y] = q.pop();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy, k = Y * W + X;
      if (X >= 0 && Y >= 0 && X < W && Y < H && !seen.has(k) && VOID.has(g[Y][X])) { seen.add(k); q.push([X, Y]); }
    }
  }
  // A small boxed void is a floating wall stub; a big one is the rock core a loop of passages runs round.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!VOID.has(g[y][x]) || seen.has(y * W + x)) continue;
    const comp = [[x, y]], qq = [[x, y]];
    seen.add(y * W + x);
    while (qq.length) {
      const [a, b] = qq.pop();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = a + dx, Y = b + dy, k = Y * W + X;
        if (X >= 0 && Y >= 0 && X < W && Y < H && !seen.has(k) && VOID.has(g[Y][X])) { seen.add(k); comp.push([X, Y]); qq.push([X, Y]); }
      }
    }
    if (comp.length < 40) for (const [a, b] of comp) g[b][a] = ".";
  }
  // …and no crumbs of water or lava: a body under four cells is a puddle sticker, it becomes floor
  const liquid = new Set(["~", "W", "L", "i"]), done = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!liquid.has(g[y][x]) || done.has(y * W + x)) continue;
    const c = g[y][x], comp = [[x, y]], qq = [[x, y]];
    done.add(y * W + x);
    while (qq.length) {
      const [a, b] = qq.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = a + dx, Y = b + dy, k = Y * W + X;
        if (X >= 0 && Y >= 0 && X < W && Y < H && !done.has(k) && g[Y][X] === c) { done.add(k); comp.push([X, Y]); qq.push([X, Y]); }
      }
    }
    if (comp.length < 6) for (const [a, b] of comp) g[b][a] = ".";
  }
  // …and no islands: open ground cut off from the main body (a boxed pocket inside the rock) becomes rock
  const body = new Set(), comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (VOID.has(g[y][x]) || body.has(y * W + x)) continue;
    const comp = [[x, y]], qq = [[x, y]];
    body.add(y * W + x);
    while (qq.length) {
      const [a, b] = qq.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = a + dx, Y = b + dy, k = Y * W + X;
        if (X >= 0 && Y >= 0 && X < W && Y < H && !body.has(k) && !VOID.has(g[Y][X])) { body.add(k); comp.push([X, Y]); qq.push([X, Y]); }
      }
    }
    comps.push(comp);
  }
  const main = Math.max(...comps.map((c) => c.length));
  for (const comp of comps) if (comp.length < main && comp.length < 40) for (const [a, b] of comp) g[b][a] = "#";
  return g.map((r) => r.join(""));
}

/** Template text → rows; only the empty first/last line around the backticks is dropped. */
export function lines(text) {
  const rows = text.split("\n");
  if (rows[0] === "") rows.shift();
  if (rows.at(-1).trim() === "") rows.pop();
  return rows;
}

export function createKit(DUN) {
  const group = (id) => { const g = DUN.autotileGroups.find((x) => x.id.endsWith("-" + id)); assert(g, id); return g; };
  const autotile = (m, g, members = g.memberTileIds, connect) => {
    const mem = new Set(members), con = new Set([...(connect ?? g.connectTileIds ?? g.memberTileIds), ...mem]), src = [...m.lowerTiles];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!mem.has(src[y * m.width + x])) continue;
      let mask = 0;
      for (const [dx, dy, bit] of DIRS8) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= m.width || Y >= m.height || con.has(src[Y * m.width + X])) mask |= bit;
      }
      const v = g.variantMap[String(mask)];
      if (v !== undefined) m.lowerTiles[y * m.width + x] = v;
    }
  };
  const members = (g) => [...new Set([...g.memberTileIds, ...Object.values(g.variantMap)])];

  /** Build one map from its spec. Returns { map, placements }. */
  function build(spec) {
    const theme = THEMES[spec.theme]; assert(theme, spec.theme);
    const art = dropFloatingVoid(lines(spec.art));
    const H = art.length, W = Math.max(...art.map((r) => r.length));
    art.forEach((r, y) => assert.equal(r.length, W, `${spec.id}: art row ${y} is ${r.length} wide, not ${W}`));
    // Off-map cells repeat the edge cell: a corridor drawn to the edge runs on out of view without a wall.
    const ch = (x, y) => art[Math.max(0, Math.min(H - 1, y))][Math.max(0, Math.min(W - 1, x))] ?? "#";
    const isVoid = (x, y) => VOID.has(ch(x, y)) || TERRAIN[ch(x, y)]?.solid;
    const m = { width: W, height: H, lowerTiles: Array(W * H).fill(430), upperTiles: Array(W * H).fill(-1) };
    const rim = group(theme.rim);
    const rimCentre = rim.variantMap["255"];
    const walls = spec.wall ?? theme.wall, floor = spec.floor ?? theme.floor;
    const patches = new Map();
    // Wall face: the first rows under void. Built from the open mask, so faces follow every notch.
    const wallRow = (x, y) => {
      if (isVoid(x, y)) return -1;
      for (let k = 0; k < walls.length; k++) {
        if (isVoid(x, y - 1 - k)) return k;
        if (isVoid(x, y - 1 - k) === false && k === walls.length - 1) return -1;
      }
      return -1;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = ch(x, y);
      if (VOID.has(c)) { m.lowerTiles[i] = rimCentre; continue; }
      const def = TERRAIN[c]; assert(def, `${spec.id}: unknown terrain ${JSON.stringify(c)} at ${x},${y}`);
      if (def.solid) { m.lowerTiles[i] = group(def.group).variantMap["255"]; continue; }
      const row = wallRow(x, y);
      if (row >= 0 && !spec.noWallChars?.includes(c)) {
        const face = walls[row];
        // End pieces where the face stops: the side neighbour is void or not the same face row.
        const left = wallRow(x - 1, y) !== row, right = wallRow(x + 1, y) !== row;
        m.lowerTiles[i] = left && !right ? face[0] : right && !left ? face[2] : face[1];
        continue;
      }
      if (def.upper !== undefined) m.upperTiles[i] = def.upper;
      if (def.floor) m.lowerTiles[i] = floor;
      else if (def.fill !== undefined) m.lowerTiles[i] = def.fill;
      else if (def.group) { const g = group(def.group); m.lowerTiles[i] = g.variantMap["255"]; patches.set(def.group, g); }
      else if (def.nine) m.lowerTiles[i] = -2 - "PD".indexOf(c); // resolved below
    }
    // Nine-slice daises.
    for (const c of ["P", "D"]) {
      const nine = TERRAIN[c].nine, tag = -2 - "PD".indexOf(c);
      const is = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.lowerTiles[y * W + x] === tag;
      const out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (is(x, y)) {
        const col = !is(x - 1, y) ? 0 : !is(x + 1, y) ? 2 : 1, rowi = !is(x, y - 1) ? 0 : !is(x, y + 1) ? 2 : 1;
        out.push([y * W + x, nine[rowi * 3 + col]]);
      }
      for (const [i, t] of out) m.lowerTiles[i] = t;
    }
    for (const g of patches.values()) autotile(m, g, members(g));
    autotile(m, rim, members(rim));
    for (const [c, g] of Object.entries(spec.solidGroups ?? {})) autotile(m, group(g), members(group(g)));
    if (spec.abyss) { const g = group("abyss-blue"); autotile(m, g, members(g)); }

    const placements = [];
    const put = (x, y, t, layer) => { if (x >= 0 && y >= 0 && x < W && y < H) m[layer][y * W + x] = t; };
    // Rails: every `+` in the rail overlay joins its 4-neighbours; only native straight/corner pieces.
    if (spec.rails) {
      const rails = lines(spec.rails);
      // Junctions are turntables (2×2, 54 55 / 84 85): every track that meets one ends on its rim, so a
      // branch leaves the main line there instead of crossing it (the sheet has no T piece).
      const turn = new Map();
      for (const [tx, ty] of spec.turntables ?? []) [[0, 0, 54], [1, 0, 55], [0, 1, 84], [1, 1, 85]].forEach(([a, b, t]) => turn.set(`${tx + a},${ty + b}`, t));
      const r = (x, y) => (rails[y]?.[x] ?? " ") === "+" || turn.has(`${x},${y}`);
      const PIECE = { 6: 54, 12: 55, 3: 84, 9: 85, 1: 144, 4: 144, 5: 144, 2: 116, 8: 116, 10: 116 };
      const cells = [];
      for (const [k, t] of turn) { const [x, y] = k.split(",").map(Number); put(x, y, t, "upperTiles"); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (r(x, y) && !turn.has(`${x},${y}`)) {
        const bits = (r(x, y - 1) ? 1 : 0) | (r(x + 1, y) ? 2 : 0) | (r(x, y + 1) ? 4 : 0) | (r(x - 1, y) ? 8 : 0);
        assert(PIECE[bits], `${spec.id}: rail junction ${bits} at ${x},${y}`);
        put(x, y, PIECE[bits], "upperTiles"); cells.push([x, y]);
      }
      placements.push({ kind: "rail", cells: cells.length, pieces: "직선 116(가로)·144(세로), 굽이 54(→↓)·55(←↓)·84(↑→)·85(↑←)" });
    }
    if (spec.overlay) {
      const ov = lines(spec.overlay);
      assert.equal(ov.length, H, `${spec.id}: overlay height`);
      const wrong = ov.map((r, y) => [y, r.length]).filter(([, n]) => n !== W);
      assert(!wrong.length, `${spec.id}: overlay rows of the wrong width (want ${W}): ${JSON.stringify(wrong)}`);
      for (let y = 0; y < ov.length; y++) for (let x = 0; x < ov[y].length; x++) {
        // The overlay is a copy of the art with prop letters written over it; unchanged cells are skipped.
        const c = ov[y][x];
        if (c === " " || c === art[y][x]) continue;
        const p = PROPS[c]; assert(p, `${spec.id}: unknown prop ${JSON.stringify(c)} at ${x},${y}`);
        const layer = p.layer === "lower" ? "lowerTiles" : "upperTiles";
        const rows = p.rows.map((row) => row.map((t) => (typeof t === "string" ? GRAFTS[t].target : t)));
        rows.forEach((row, dy) => row.forEach((t, dx) => put(x + dx, y + dy, t, layer)));
        placements.push({ prop: p.name, x, y, w: rows[0].length, h: rows.length, layer: layer.replace("Tiles", ""), tiles: rows });
      }
    }
    const faceAt = (x, y) => !isVoid(x, y) && wallRow(x, y) >= 0 && !spec.noWallChars?.includes(ch(x, y));
    const warnings = [];
    for (const [c, x, y] of spec.props ?? []) {
      const p = PROPS[c]; assert(p, `${spec.id}: unknown prop ${JSON.stringify(c)}`);
      // wall pieces hang on the face; everything else stands on open floor (not void, not a wall face)
      const cells = p.rows.flatMap((row, dy) => row.map((_, dx) => [x + dx, y + dy]));
      const bad = cells.filter(([a, b]) => (WALL_PROPS.has(c) ? !faceAt(a, b) : ANY_PROPS.has(c) ? isVoid(a, b) : isVoid(a, b) || faceAt(a, b)));
      // a piece that would stand in the rock or hang off a wall it is not on is left out, not drawn wrong
      if (bad.length) { warnings.push(`${c}@${x},${y} (${p.name}) ${WALL_PROPS.has(c) ? "not on a wall face" : "off the floor"} — dropped: ${JSON.stringify(bad)}`); continue; }
      const layer = p.layer === "lower" ? "lowerTiles" : "upperTiles";
      const rows = p.rows.map((row) => row.map((t) => (typeof t === "string" ? GRAFTS[t].target : t)));
      rows.forEach((row, dy) => row.forEach((t, dx) => put(x + dx, y + dy, t, layer)));
      placements.push({ prop: p.name, x, y, w: rows[0].length, h: rows.length, layer: layer.replace("Tiles", ""), tiles: rows });
    }
    for (const [x, y, t, layer = "upperTiles"] of spec.extra ?? []) put(x, y, t, layer);
    return { map: m, placements, chars: art, warnings };
  }
  return { build, group, autotile, members };
}
