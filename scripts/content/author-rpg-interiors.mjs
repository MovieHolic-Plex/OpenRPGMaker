// Author the RPG interiors (inn, church, homes, guild, magic trades, library, classroom, castle rooms and a large castle
// first floor, ship below decks, arena, casino, auction) from existing grammars only — terrain and furnishing, no
// doors/NPCs/shops/dialogue:
//  - walls/ceiling: the house grammar of interiorRoomPipeline (plan → floor → walls; rooms + innerDoors for partitions).
//    The pipeline stops a vertical partition at the first floor row, so its ceiling is carried up through the room's
//    wall face into the north ceiling here (a real wall, not a pillar stub standing in front of a continuous wall);
//  - furnishing: named Tibo kits on tibo_interior_expanded (its first 480 tiles are the EasyRPG interior chipset).
//    Tabletop things (mortar, bottles, books, crystals, quill, coins) only go on a table top drawn with the sheet's own
//    wooden table autotile (terrain-deck) or white-cloth table; chairs and stools sit next to a table; wall hangings stay
//    inside the two wall-face rows; stairs stand on the floor against a straight wall. The rule check at the bottom
//    rejects any placement that breaks these;
//  - ship: the same shell on easyrpg_chipset_ship — that sheet keeps the interior layout (ceiling rim 371/399~461 around
//    void 430), so only the wall face (74~76 → porthole 104~106, 104~106 → hull planks 134~136) and floor are re-pointed.
//    Crates and sacks the ship sheet lacks are grafted from Tibo after tile 480.
// Usage: node scripts/content/author-rpg-interiors.mjs [outDir]   (default tiledata/rpg-interiors)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";

const OUT = process.argv[2] ?? "tiledata/rpg-interiors";

await withTsModule("scripts/content/lib/rpg-places-entry.ts", "rpg-interiors-entry.mjs", async (api) => {
  const base = api.createBlankProject();
  const TIBO = structuredClone(base.tilesets.tibo_interior_expanded);
  const SHIP = structuredClone(base.tilesets.easyrpg_chipset_ship);
  const INT = base.tilesets.easyrpg_chipset_interior;
  delete TIBO.referenceDocuments; delete SHIP.referenceDocuments;
  // The bundled ship sheet still carries its magenta key on some props; the deck snapshots key it the same way.
  SHIP.transparentColor = "#ff678b";
  const kits = new Map(TIBO.structureKits.map((k) => [k.id, k]));
  const group = (ts, id) => ts.autotileGroups.find((g) => g.id.endsWith(id));

  // ── roles (what a placement is allowed to stand on) ──
  const K = (s) => s.split(/\s+/).filter(Boolean).map((n) => (/^(v\d|library|fantasy|medieval|warm)/.test(n) ? `tibo-${n}` : `tibo-${n}`));
  const TOP_KITS = new Set(K(`library-003 library-004 library-005 library-006 library-007 library-008 library-020 library-032 library-033
    library-036 library-052 library-053 library-073 library-076 library-079 library-080 library-090 library-095 library-096 library-120
    library-122 library-128 library-135 library-136 library-139 library-146 library-148 library-150 library-152 library-153 library-155
    library-157 library-158 library-160 library-165 library-168 library-170 library-172 library-177 library-187 library-189 library-201
    library-213 library-238 v11-1-0 v10-1-1 v4-4-1 v4-5-1 v12-1-0 bell balance-scale library-121`));
  const HANG_KITS = new Set(K(`hanging-herbs library-009 library-011 library-012 library-021 library-075 library-088 library-089
    library-099 library-108 library-138 library-144 library-163 library-164 library-217 library-218 library-219 library-220 library-221
    library-222 library-223 library-224 library-225 library-226 library-227 library-228 v6-1-0 v6-2-0 v8-1-0 v9-1-0 library-159`));
  const SEAT_KITS = new Set(K(`library-027 library-028 library-029 library-030 library-202 v3-3-1 v7-1-2 v7-2-2 v7-3-2`));
  const TABLE_KITS = new Set(K(`library-025 library-026 library-140 library-161 v4-4-0 v4-4-2 v4-5-2 v7-1-3 v7-2-3 v7-3-3
    fantasy-dining-set medieval-banquet-table medieval-scribe-desk warm-scribe-desk fantasy-alchemy-desk fantasy-prep-table
    fantasy-bar-counter chessboard fantasy-washstand library-040`));
  const HANG_TILES = new Set([24, 54, 56, 57, 58, 84, 85, 86, 142, 144, 262, 290, 388, 418, /* ship sheet */ 119, 202, 295, 358]);
  const SEAT_TILES = new Set([267, 268, 297, 298, 476]);
  const TABLE_TILES = new Set([325, 326, 327, 328, 234, 264, 294, 236, 329]);
  for (const id of TABLE_KITS) for (const r of kits.get(id).rows) for (const t of r.upperTiles ?? []) if (t >= 0) TABLE_TILES.add(t);
  const DECK = group(TIBO, "terrain-deck"), CLOTH = group(TIBO, "white-table");
  const TABLE_LOWER = new Set([...DECK.memberTileIds, ...Object.values(DECK.variantMap), ...CLOTH.memberTileIds, ...Object.values(CLOTH.variantMap)]);
  TABLE_LOWER.delete(127); // the deck group's own grass slot
  const FACE = new Set([74, 75, 76, 77, 104, 105, 106, 107, 134, 135, 136, 164, 165, 166, 314, 315, 316, 344, 345, 346]);
  const roleOfKit = (id) => (TOP_KITS.has(id) ? "top" : HANG_KITS.has(id) ? "hang" : SEAT_KITS.has(id) ? "seat" : TABLE_KITS.has(id) ? "table" : "furn");
  const roleOfTile = (t) => (HANG_TILES.has(t) ? "hang" : SEAT_TILES.has(t) ? "seat" : TABLE_TILES.has(t) ? "table" : "furn");

  // ── map primitives ──
  const idx = (m, x, y) => y * m.width + x;
  const get = (m, x, y, layer = "lowerTiles") => m[layer][idx(m, x, y)];
  const put = (m, x, y, t, layer = "upperTiles") => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m[layer][idx(m, x, y)] = t; };
  let placed = [];
  const block = (m, x, y, rows, layer = "upperTiles", role) => {
    const r0 = role ?? (layer === "lowerTiles" ? "floor" : roleOfTile(rows.flat().find((t) => t >= 0)));
    placed.push({ kind: "tiles", layer: layer.replace("Tiles", ""), x, y, w: rows[0].length, h: rows.length, rows, role: r0 });
    rows.forEach((r, dy) => r.forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, t, layer); }));
  };
  const one = (m, x, y, t, layer = "upperTiles", role) => block(m, x, y, [[t]], layer, role);
  let tileMap = (t) => t; // ship maps re-point Tibo kit tiles to grafted ids
  const stamp = (m, id, x, y) => {
    const k = kits.get(id); assert(k, id);
    placed.push({ kind: "tibo-kit", kitId: id, name: k.name, x, y, w: k.width, h: k.height, role: roleOfKit(id) });
    k.rows.forEach((r, dy) => (r.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, tileMap(t)); }));
  };
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  const autotile = (m, g, members = g.memberTileIds, box) => {
    const mem = new Set(members), con = new Set([...(g.connectTileIds ?? g.memberTileIds), ...mem]), src = [...m.lowerTiles];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!mem.has(src[idx(m, x, y)])) continue;
      if (box && (x < box[0] || y < box[1] || x > box[2] || y > box[3])) continue;
      let mask = 0;
      for (const [dx, dy, bit] of DIRS) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= m.width || Y >= m.height || con.has(src[Y * m.width + X])) mask |= bit;
      }
      const v = g.variantMap[String(mask)];
      if (v !== undefined) m.lowerTiles[idx(m, x, y)] = v;
    }
  };
  const fill = (m, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(m, x, y, t, "lowerTiles"); };
  // Rugs and table tops are separate islands: each is shaped on its own so two never merge into one.
  const island = (name, kind) => (m, x0, y0, x1, y1) => {
    const g = group(TIBO, name);
    placed.push({ kind, group: g.id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: kind });
    fill(m, x0, y0, x1, y1, g.variantMap["255"]);
    const mem = new Set(g.memberTileIds), saved = [];
    for (let i = 0; i < m.lowerTiles.length; i++) {
      const x = i % m.width, y = (i / m.width) | 0;
      if (mem.has(m.lowerTiles[i]) && (x < x0 || y < y0 || x > x1 || y > y1)) { saved.push([i, m.lowerTiles[i]]); m.lowerTiles[i] = -2; }
    }
    autotile(m, g);
    for (const [i, t] of saved) m.lowerTiles[i] = t;
  };
  const redRug = island("red-carpet", "rug"), tealRug = island("teal-carpet", "rug");
  // One rug island made of several rectangles (a T in front of a throne), shaped once so it has a single border.
  const redRugShape = (m, rects) => {
    const g = group(TIBO, "red-carpet"), mem = new Set(g.memberTileIds), saved = [];
    for (let i = 0; i < m.lowerTiles.length; i++) if (mem.has(m.lowerTiles[i])) { saved.push([i, m.lowerTiles[i]]); m.lowerTiles[i] = -2; }
    for (const [x0, y0, x1, y1] of rects) { placed.push({ kind: "rug", group: g.id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, role: "rug" }); fill(m, x0, y0, x1, y1, g.variantMap["255"]); }
    autotile(m, g);
    for (const [i, t] of saved) m.lowerTiles[i] = t;
  };
  const table = island("terrain-deck", "tabletop"), clothTable = island("white-table", "tabletop");
  const CEIL = group(INT, "ceiling"), CEIL_TILES = [...new Set(Object.values(CEIL.variantMap))];
  const isCeil = (t) => t === 430 || CEIL_TILES.includes(t);
  const reshapeCeiling = (m) => autotile(m, CEIL, CEIL_TILES);

  // ── interior shells: the pipeline's own plan/floor/walls, furniture left to the plans below ──
  const U = [74, 75, 76, 77], L = [104, 105, 106, 107];
  // Wall-face runs get their end pieces from their neighbours (left end · middle · right end · one-tile).
  const renormFaces = (m) => {
    for (const set of [U, L]) for (let y = 0; y < m.height; y++) {
      const row = [...Array(m.width).keys()].map((x) => set.includes(get(m, x, y)));
      for (let x = 0; x < m.width; x++) if (row[x]) {
        const l = x > 0 && row[x - 1], r = x < m.width - 1 && row[x + 1];
        put(m, x, y, set[l && r ? 1 : r ? 0 : l ? 2 : 3], "lowerTiles");
      }
    }
  };
  // A partition's ceiling that stops under two wall-face rows is carried up through them into the ceiling above.
  const joinPartitions = (m) => {
    const isFace = (t) => U.includes(t) || L.includes(t);
    let hit = 0;
    for (let y = 3; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (isCeil(get(m, x, y)) && isFace(get(m, x, y - 1)) && isFace(get(m, x, y - 2)) && isCeil(get(m, x, y - 3))) {
        put(m, x, y - 1, 430, "lowerTiles"); put(m, x, y - 2, 430, "lowerTiles"); hit++;
      }
    }
    if (hit) { reshapeCeiling(m); renormFaces(m); }
    return hit;
  };
  const shell = (w, h, spec) => {
    const plan = { mapId: "shell", name: "shell", width: w, height: h, wings: spec.wings ?? [], ...(spec.rooms ? { rooms: spec.rooms } : {}),
      ...(spec.innerDoors ? { innerDoors: spec.innerDoors } : {}), door: spec.door, theme: "storage", seed: 1, ...(spec.openPlan ? { openPlan: true } : {}) };
    let map = api.createEmptyRoomMap(plan);
    for (const layer of ["plan", "floor", "walls"]) {
      const r = api.applyInteriorRoomLayer(map, plan, layer);
      assert(r.ok, `${layer}: ${r.warnings.join(";")}`);
      map = r.map;
    }
    const m = { width: w, height: h, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
    joinPartitions(m);
    // North doorways (large maps): a dark opening through the two wall-face rows, leading on to another map.
    for (const x of spec.northDoors ?? []) {
      let y = 0; while (y < h && !U.includes(get(m, x, y))) y++;
      assert(y < h, `north door ${x}`);
      put(m, x, y, 116, "lowerTiles"); put(m, x, y + 1, 146, "lowerTiles");
      placed.push({ kind: "doorway", x, y, w: 1, h: 2, role: "doorway" });
      renormFaces(m);
    }
    api.retintHouseWallFace(m, spec.wall);
    return m;
  };
  const floorTo = (m, to, box) => {
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (box && (x < box[0] || y < box[1] || x > box[2] || y > box[3])) continue;
      if (get(m, x, y) === 72) put(m, x, y, to, "lowerTiles");
    }
  };
  // Upper floors: the south door opening is closed back into ceiling; people arrive by stairs.
  const closeDoor = (m, x, y) => {
    for (let yy = y; yy < m.height; yy++) put(m, x, yy, 430, "lowerTiles");
    for (let yy = y - 1; yy < m.height; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (CEIL_TILES.includes(get(m, xx, yy))) put(m, xx, yy, 430, "lowerTiles");
    reshapeCeiling(m);
  };
  // Stairs stand on the floor, never in the wall-face rows: up = the sheet's railed flight 111/141/171 (one column,
  // rail on the open left side, so it goes against an east wall); down = the stone flight 474|475 two rows deep.
  const walkable = (m, x, y) => { const q = TIBO.passability[get(m, x, y)]; return !!q && (q.up || q.down || q.left || q.right) && !FACE.has(get(m, x, y)); };
  const stairsUp = (m, x, y) => {
    for (let d = 0; d < 3; d++) assert(walkable(m, x, y + d), `stairs up on floor ${x},${y + d}`);
    block(m, x, y, [[111], [141], [171]], "lowerTiles", "stairs");
  };
  const stairsDown = (m, x, y) => {
    for (let d = 0; d < 2; d++) for (let e = 0; e < 2; e++) assert(walkable(m, x + e, y + d), `stairs down on floor ${x + e},${y + d}`);
    block(m, x, y, [[474, 475], [474, 475]], "upperTiles", "stairs");
  };

  // ── ship sheet: same shell, re-pointed faces; Tibo cargo grafted after 480 ──
  const SHIP_FACE = { 74: 104, 75: 105, 76: 106, 77: 135, 104: 134, 105: 135, 106: 136, 107: 135 };
  const shipShell = (w, h, spec) => {
    const m = shell(w, h, spec);
    m.lowerTiles = m.lowerTiles.map((t) => SHIP_FACE[t] ?? (t === 72 ? 279 : t));
    return m;
  };
  const graftOf = new Map();
  const firstGraft = Math.ceil(SHIP.count / 30) * 30;
  const graft = (tiboTile) => {
    if (!graftOf.has(tiboTile)) {
      const id = firstGraft + graftOf.size;
      graftOf.set(tiboTile, id);
      (SHIP.tileGrafts ??= []).push({ sourceChipset: "tex_tibo_interior_expanded", sourceTile: tiboTile, targetTile: id });
    }
    return graftOf.get(tiboTile);
  };
  // Ladder up to the deck: the sheet's wooden ladder 22|23, two rows, standing on the floor against the north wall.
  const shipLadder = (m, x, y) => block(m, x, y, [[22, 23], [22, 23]], "lowerTiles", "stairs");

  const places = [];
  const add = (id, name, tilesetId, m, spec) => { places.push({ id, name, tilesetId, map: m, ...spec, placements: placed }); placed = []; };
  const T = "tibo_interior_expanded";

  // ═════════ 여관 ═════════
  // 1층 — 왼쪽 돌바닥 주방(화덕·솥·조리대)과 홀(바·벽난로·긴 식탁·접수대), 동벽 계단으로 2층.
  let m = shell(22, 15, { rooms: [{ id: "kitchen", x: 2, y: 5, w: 5, h: 8 }, { id: "hall", x: 8, y: 5, w: 12, h: 8 }], innerDoors: [{ x: 7, y: 10 }], door: { x: 13, y: 12 } });
  floorTo(m, 42, [2, 5, 6, 12]);
  stamp(m, "tibo-bread-oven", 2, 5); stamp(m, "tibo-fantasy-hanging-pot", 5, 5);
  stamp(m, "tibo-hanging-herbs", 2, 3); stamp(m, "tibo-library-011", 4, 4); stamp(m, "tibo-library-012", 5, 3);
  stamp(m, "tibo-fantasy-prep-table", 2, 8);
  stamp(m, "tibo-library-013", 2, 11); stamp(m, "tibo-library-014", 3, 11); stamp(m, "tibo-library-015", 2, 12); stamp(m, "tibo-library-018", 3, 12); stamp(m, "tibo-library-229", 4, 11);
  stamp(m, "tibo-fantasy-ale-rack", 8, 4); stamp(m, "tibo-library-133", 11, 4);
  stamp(m, "tibo-fantasy-bar-counter", 8, 7); stamp(m, "tibo-library-029", 9, 9); stamp(m, "tibo-library-029", 11, 9);
  stamp(m, "tibo-medieval-stone-fireplace", 13, 3); redRug(m, 13, 6, 15, 6); one(m, 12, 3, 24); one(m, 16, 3, 24);
  stamp(m, "tibo-fantasy-dining-set", 13, 8);
  table(m, 17, 6, 18, 6); stamp(m, "tibo-library-079", 17, 6); stamp(m, "tibo-library-122", 18, 6); stamp(m, "tibo-v8-1-0", 17, 3); one(m, 19, 3, 57);
  stairsUp(m, 19, 5);
  stamp(m, "tibo-library-025", 9, 10); stamp(m, "tibo-library-030", 8, 11); stamp(m, "tibo-library-030", 10, 11);
  stamp(m, "tibo-library-025", 17, 8); stamp(m, "tibo-library-030", 16, 9); stamp(m, "tibo-library-030", 18, 9);
  redRug(m, 12, 11, 14, 12); stamp(m, "tibo-library-209", 18, 11);
  add("interior-inn-tavern-1f", "여관 1층 · 주점과 접수대", T, m, {
    group: "inn-homes", entry: [13, 13], keeper: [9, 6], targets: [[9, 6], [17, 5], [19, 8], [4, 7], [14, 11]],
    use: "여관 주인이 운영하는 1층. 손님은 문으로 들어와 오른쪽 접수대에서 방을 잡고, 바에서 술을 받아 긴 식탁에서 먹는다. 왼쪽 돌바닥 주방에서 요리하고, 동벽 계단으로 2층 객실에 오른다",
    note: "크림 벽, 주방 5×8(돌바닥 42)과 홀 12×8을 파이프라인 칸막이로 나눴다(문 (7,10)). 주방: 빵 화덕·불 피운 솥 걸이(돌바닥 위)·벽에 말린 약초·향신료 선반·국자 걸이·조리대·구석에 밀가루·쌀 포대·감자 바구니·당근 상자·뚜껑 통 한 덩이. 홀: 뒷벽 술통 선반·맥주통, 그 앞 바 카운터와 높은 걸상 둘(주인 자리 (9,6)), 가운데 뒤 장작 벽난로와 붉은 깔개, 긴 식탁과 벤치, 원형 식탁과 걸상 둘, 오른쪽 뒤 접수 탁자(나무 상판 위 편지 쟁반·동전 쟁반)와 벽 열쇠판·여관 간판, 동벽에 붙은 오르막 계단 111/141/171(x=19, 바닥 위), 앞 오른쪽 야자 화분",
  });
  // 2층 — 위 복도와 아래 객실 셋(1인실·2인실·특실). 객실마다 뒷벽에 문 틈. 1층 계단 자리(동벽)에 내려가는 계단.
  m = shell(22, 16, {
    rooms: [{ id: "hall", x: 2, y: 5, w: 18, h: 3 }, { id: "single", x: 2, y: 11, w: 5, h: 3 }, { id: "twin", x: 8, y: 11, w: 6, h: 3 }, { id: "suite", x: 15, y: 11, w: 5, h: 3 }],
    innerDoors: [{ x: 4, y: 8 }, { x: 10, y: 8 }, { x: 15, y: 8 }], door: { x: 11, y: 13 },
  });
  closeDoor(m, 11, 14);
  stairsDown(m, 18, 5); redRug(m, 3, 6, 16, 6);
  stamp(m, "tibo-library-059", 2, 4); stamp(m, "tibo-library-037", 3, 5); one(m, 6, 3, 54); one(m, 13, 3, 54); one(m, 9, 3, 84); stamp(m, "tibo-library-215", 17, 7);
  block(m, 2, 11, [[324], [354]]); stamp(m, "tibo-library-039", 3, 11); stamp(m, "tibo-library-050", 6, 10); stamp(m, "tibo-library-045", 2, 13); one(m, 3, 9, 85);
  block(m, 8, 11, [[324], [354]]); stamp(m, "tibo-library-039", 9, 11); block(m, 13, 11, [[324], [354]]); stamp(m, "tibo-library-039", 12, 11);
  stamp(m, "tibo-library-045", 8, 13); stamp(m, "tibo-library-045", 13, 13); one(m, 11, 9, 86);
  stamp(m, "tibo-fantasy-bed", 17, 10); stamp(m, "tibo-library-039", 16, 11); stamp(m, "tibo-library-045", 19, 13); redRug(m, 16, 12, 16, 13); one(m, 18, 9, 56);
  add("interior-inn-rooms-2f", "여관 2층 · 객실", T, m, {
    group: "inn-homes", entry: [18, 7], targets: [[4, 12], [10, 12], [15, 12], [3, 6]],
    use: "여관 손님이 묵는 2층. 1층 동벽 계단을 오르면 복도 오른쪽 끝으로 나오고, 복도에서 뒷벽 문 틈으로 1인실·2인실·특실에 들어간다",
    note: "위 복도 18×3과 아래 객실 셋(1인실 5×3·2인실 6×3·특실 5×3)을 파이프라인 가로 칸막이(천장 한 줄+벽면 두 줄)와 세로 칸막이로 나눴다. 세로 칸막이 천장은 북쪽 천장까지 이어 붙였다. 복도: 1층 계단 자리(동벽 x=18~19)에 내려가는 돌계단 474|475, 붉은 러너, 린넨 장·이불 더미, 창 둘·그림, 화분. 1인실 침대·협탁·대야 받침·궤짝, 2인실 침대 둘·협탁 둘·궤짝 둘, 특실 목제 침대 3×3·화장대·붉은 깔개·커튼 창",
  });

  // ═════════ 교회 ═════════
  m = shell(19, 18, { wings: [{ x: 2, y: 5, w: 15, h: 11 }], door: { x: 9, y: 15 }, wall: "stone-brick" });
  floorTo(m, 42);
  fill(m, 4, 5, 14, 7, 163); placed.push({ kind: "floor", tile: 163, x: 4, y: 5, w: 11, h: 3, role: "floor" });
  redRug(m, 8, 8, 10, 15);
  stamp(m, "tibo-fantasy-altar", 8, 5); block(m, 9, 3, [[88], [118]], "upperTiles", "hang");
  for (const x of [3, 5, 13, 15]) one(m, x, 3, 144);
  stamp(m, "tibo-v4-5-2", 6, 4); stamp(m, "tibo-v4-5-2", 12, 4); stamp(m, "tibo-lectern", 12, 6);
  for (const y of [9, 11, 13]) { stamp(m, "tibo-fantasy-pew", 4, y); stamp(m, "tibo-fantasy-pew", 11, y); }
  for (const y of [9, 13]) { block(m, 2, y - 1, [[89], [119]]); block(m, 16, y - 1, [[89], [119]]); }
  for (const y of [11, 15]) { one(m, 2, y, 204); one(m, 16, y, 204); }
  redRug(m, 5, 7, 13, 7); one(m, 4, 6, 288); one(m, 14, 6, 288);
  add("interior-church-nave", "교회 · 예배당", T, m, {
    group: "civic", entry: [9, 16], keeper: [9, 7], targets: [[9, 7], [3, 9], [15, 14]],
    use: "사제가 예배를 올리고 마을 사람이 앉아 기도하는 곳. 교구마을 「교회 언덕」의 석벽 교회(스테인드글라스 두 장, 가운데 문)와 짝을 이룬다",
    note: "석벽·회색 돌바닥 42. 앞쪽(북쪽) 제단부를 무늬 석판 163으로 깔고 제단 3×2 뒤 벽에 성녀 석상 88/118, 벽에 스테인드글라스 144 넷, 양옆 촛대 탁자·설교대 독서대. 문에서 제단까지 폭3 붉은 카펫, 좌우로 긴 의자 4×2 세 줄씩, 옆 통로에 기둥 89/119와 촛대, 제단부 앞 무릎 꿇는 붉은 카펫 한 줄과 화분 둘",
  });

  // ═════════ 민가 ═════════
  // 한 칸 집 — 농부 부부 한 칸 살림: 침대·벽난로·식탁·찬장·물레.
  m = shell(15, 13, { wings: [{ x: 2, y: 5, w: 11, h: 5 }], door: { x: 7, y: 9 } });
  block(m, 2, 5, [[324], [354]]); stamp(m, "tibo-library-039", 3, 5); one(m, 4, 3, 54);
  stamp(m, "tibo-medieval-stone-fireplace", 6, 4); stamp(m, "tibo-library-235", 4, 5);
  stamp(m, "tibo-fantasy-cupboard", 10, 4); stamp(m, "tibo-library-229", 12, 4);
  block(m, 4, 7, [[108, 109, 110], [138, 139, 140], [168, 169, 170]], "lowerTiles");
  stamp(m, "tibo-library-026", 5, 7); stamp(m, "tibo-v7-1-2", 4, 8); one(m, 6, 8, 298);
  stamp(m, "tibo-v11-1-2", 10, 8); stamp(m, "tibo-library-015", 12, 9); stamp(m, "tibo-library-061", 2, 8);
  stamp(m, "tibo-v6-1-1", 9, 9); redRug(m, 7, 7, 9, 7); stamp(m, "tibo-library-013", 12, 6); stamp(m, "tibo-library-014", 12, 7); stamp(m, "tibo-library-045", 2, 7);
  add("interior-home-one-room", "민가 · 한 칸 집", T, m, {
    group: "inn-homes", entry: [7, 10], targets: [[3, 6], [5, 9], [9, 7]],
    use: "농부 부부가 사는 한 칸짜리 집. 한 방에서 자고(왼쪽), 불 때 밥하고(가운데 벽난로), 먹고(짚 돗자리 위 식탁), 실을 잣는다(오른쪽 물레)",
    note: "크림 벽 11×5칸. 왼쪽 침대 324/354·협탁·창 54·침대 발치 궤짝, 가운데 장작 벽난로와 장작 받침대·붉은 난로 깔개, 오른쪽 찬장 2×3·뚜껑 통·밀가루·쌀 포대, 짚 돗자리 108~170 위 정사각 식탁과 의자 둘, 앞쪽 물레·물 양동이·감자 바구니·기댄 빗자루",
  });
  // 2층 집 1층 — 돌바닥 부엌과 거실, 동벽 계단.
  m = shell(19, 13, { rooms: [{ id: "kitchen", x: 2, y: 5, w: 4, h: 5 }, { id: "living", x: 7, y: 5, w: 10, h: 5 }], innerDoors: [{ x: 6, y: 7 }], door: { x: 9, y: 9 } });
  floorTo(m, 42, [2, 5, 5, 9]);
  stamp(m, "tibo-bread-oven", 2, 5); stamp(m, "tibo-fantasy-hanging-pot", 4, 5); stamp(m, "tibo-library-011", 3, 3);
  stamp(m, "tibo-fantasy-prep-table", 2, 8); stamp(m, "tibo-library-018", 5, 8); stamp(m, "tibo-library-013", 5, 9);
  redRug(m, 8, 6, 10, 8); stamp(m, "tibo-library-026", 9, 6); stamp(m, "tibo-v7-1-2", 8, 7); one(m, 10, 7, 298); block(m, 7, 4, [[389], [419]]);
  stamp(m, "tibo-medieval-stone-fireplace", 11, 3); tealRug(m, 10, 7, 13, 8); stamp(m, "tibo-warm-bench", 11, 7);
  stamp(m, "tibo-fantasy-bookcase", 14, 4); stairsUp(m, 16, 5);
  stamp(m, "tibo-coat-rack", 15, 8); stamp(m, "tibo-boot-rack", 7, 9);
  add("interior-home-two-story-1f", "민가 · 2층 집 1층", T, m, {
    group: "inn-homes", entry: [9, 10], targets: [[8, 8], [16, 8], [3, 7], [13, 9]],
    use: "네 식구가 사는 2층 집의 아래층. 왼쪽 돌바닥 부엌(화덕·솥·조리대), 가운데 식탁, 오른쪽 거실(벽난로·책장·쿠션 의자), 동벽 계단으로 2층 침실에 오른다",
    note: "크림 벽, 부엌 4×5(돌바닥 42)와 거실 10×5를 칸막이로 나눴다(문 (6,7)). 부엌에 작은 빵 화덕·불 피운 솥 걸이·향신료 선반·조리대·당근 상자·밀가루 포대, 거실에 붉은 러그 위 식탁과 의자 둘·괘종시계 389/419, 장작 벽난로 앞 청록 러그와 쿠션 긴 의자, 두꺼운 책장, 동벽에 붙은 오르막 계단(x=16, 바닥 위), 문 옆 옷걸이·신발 받침대",
  });
  // 2층 집 2층 — 아이 방·부부 방·계단참. 1층 계단 자리(동벽)에 내려가는 계단.
  m = shell(19, 13, {
    rooms: [{ id: "child", x: 2, y: 5, w: 5, h: 5 }, { id: "parents", x: 8, y: 5, w: 6, h: 5 }, { id: "landing", x: 15, y: 5, w: 2, h: 5 }],
    innerDoors: [{ x: 7, y: 8 }, { x: 14, y: 8 }], door: { x: 15, y: 9 },
  });
  closeDoor(m, 15, 10);
  stairsDown(m, 15, 5); stamp(m, "tibo-library-215", 16, 9); one(m, 15, 3, 84);
  block(m, 2, 5, [[324], [354]]); stamp(m, "tibo-v4-4-2", 5, 5); one(m, 5, 6, 268); one(m, 4, 3, 54);
  tealRug(m, 3, 7, 5, 8); stamp(m, "tibo-library-181", 2, 8); stamp(m, "tibo-library-186", 2, 9); stamp(m, "tibo-library-184", 3, 9);
  stamp(m, "tibo-fantasy-bed", 8, 4); stamp(m, "tibo-library-039", 11, 5); stamp(m, "tibo-fantasy-wardrobe", 12, 4); one(m, 10, 3, 54);
  redRug(m, 8, 8, 11, 9); stamp(m, "tibo-library-045", 9, 7); stamp(m, "tibo-library-040", 12, 9);
  add("interior-home-two-story-2f", "민가 · 2층 집 2층", T, m, {
    group: "inn-homes", entry: [16, 7], targets: [[4, 7], [10, 8], [15, 8]],
    use: "2층 집의 위층 침실. 계단을 오르면 동쪽 계단참, 가운데가 부부 방(큰 침대·옷장·화장대), 서쪽이 아이 방(작은 침대·독서 탁자·장난감)",
    note: "방 셋(아이 5×5·부부 6×5·계단참 2×5)을 세로 칸막이로 나누고 칸막이 천장을 북쪽 천장까지 이었다(문 (7,8)·(14,8)). 계단참에 1층 계단 자리의 내려가는 돌계단 474|475·그림·화분, 부부 방 목제 침대 3×3·협탁·옷장 2×3·침대 발치 궤짝·붉은 러그·화장대, 아이 방 침대·독서 탁자와 의자·청록 러그·목마·장난감 상자·곰 인형",
  });
  // 촌장집 — 서재·응접실·침실.
  m = shell(27, 15, {
    rooms: [{ id: "study", x: 2, y: 5, w: 6, h: 7 }, { id: "hall", x: 9, y: 5, w: 9, h: 7 }, { id: "bed", x: 19, y: 5, w: 6, h: 7 }],
    innerDoors: [{ x: 8, y: 9 }, { x: 18, y: 9 }], door: { x: 13, y: 11 },
  });
  stamp(m, "tibo-library-078", 2, 4); stamp(m, "tibo-v12-1-2", 3, 4); stamp(m, "tibo-v3-1-0", 5, 3);
  stamp(m, "tibo-medieval-scribe-desk", 3, 8); tealRug(m, 2, 7, 6, 10);
  stamp(m, "tibo-medieval-stone-fireplace", 9, 3); stamp(m, "tibo-v6-2-0", 13, 3); stamp(m, "tibo-library-223", 15, 3);
  redRug(m, 11, 7, 16, 10); stamp(m, "tibo-medieval-banquet-table", 12, 7); for (const x of [13, 14]) one(m, x, 9, 268); one(m, 11, 8, 297); one(m, 16, 8, 298);
  stamp(m, "tibo-warm-crockery", 16, 4); stamp(m, "tibo-library-215", 9, 10); stamp(m, "tibo-library-209", 16, 10);
  stamp(m, "tibo-fantasy-bed", 19, 4); stamp(m, "tibo-library-039", 22, 5); stamp(m, "tibo-fantasy-wardrobe", 23, 4);
  stamp(m, "tibo-fantasy-washstand", 22, 9); stamp(m, "tibo-library-045", 20, 7); one(m, 20, 3, 54); redRug(m, 19, 8, 21, 10);
  add("interior-home-chief", "민가 · 촌장집", T, m, {
    group: "inn-homes", entry: [13, 12], keeper: [4, 7], targets: [[4, 7], [13, 10], [21, 8]],
    use: "마을 촌장이 사는 집. 가운데 응접실에서 마을 사람을 맞고 회의를 하며(긴 식탁·마을 지도), 왼쪽 서재에서 장부를 보고, 오른쪽이 촌장 부부의 침실",
    note: "방 셋(서재 6×7·응접실 9×7·침실 6×7)을 세로 칸막이로 나누고 칸막이 천장을 북쪽 천장까지 이었다(문 (8,9)·(18,9)). 서재 문서 분류장·지구본·책장 수납장 3×3·청록 러그 위 필경사 책상, 응접실 장작 벽난로·강 지도 액자·사슴뿔 벽판·식기장·붉은 러그 위 연회 식탁과 의자 넷(앞 둘·양 끝 둘)·화분 둘, 침실 목제 침대·협탁·옷장·궤짝·붉은 깔개·세면대",
  });
  // 폐가 — 한 칸 집과 같은 껍데기. 무너진 곳은 북동 모서리 한 곳에 모은다(구멍·부서진 널·새싹·세운 판자·벽 균열).
  m = shell(15, 13, { wings: [{ x: 2, y: 5, w: 11, h: 5 }], door: { x: 7, y: 9 } });
  for (const [x, y, t] of [[9, 5, 102], [10, 5, 73], [11, 5, 102], [12, 5, 73], [10, 6, 222], [11, 6, 73], [12, 6, 103], [11, 7, 223], [12, 7, 102], [10, 7, 102], [12, 8, 222]]) put(m, x, y, t, "lowerTiles");
  placed.push({ kind: "floor", note: "collapsed corner", x: 9, y: 5, w: 4, h: 4, role: "floor" });
  one(m, 11, 3, 388); one(m, 11, 4, 418); one(m, 9, 6, 386); one(m, 10, 8, 387); one(m, 9, 7, 387);
  block(m, 2, 5, [[324], [354]]); stamp(m, "tibo-fantasy-cupboard", 4, 4); stamp(m, "tibo-library-237", 6, 4);
  stamp(m, "tibo-v6-2-3", 3, 5); stamp(m, "tibo-library-071", 6, 6); stamp(m, "tibo-library-214", 2, 8); stamp(m, "tibo-library-045", 3, 9);
  add("interior-home-abandoned", "민가 · 폐가", T, m, {
    group: "inn-homes", entry: [7, 10], targets: [[7, 7], [3, 7], [10, 9]],
    use: "오래 비어 있던 집. 한 칸 집과 같은 틀에 가구는 먼지를 쓰고, 북동 모서리는 천장이 새서 바닥이 무너졌다 — 조사·귀신 이야기·숨은 물건 자리",
    note: "한 칸 집 껍데기를 그대로 두고 벽 조립은 건드리지 않았다(폐성과 같은 규칙). 무너진 곳은 북동 모서리 4×4 한 곳에만: 바닥 구멍 73·부서진 널 102/103·새싹 222/223·세운 판자 386·판자 더미 387 둘·그 위 벽 균열 388/418. 나머지 바닥은 멀쩡한 널. 낡은 침대·꺼진 등불, 먼지 앉은 찬장·빈 벽장·재 양동이, 말린 꽃병·나무 궤짝(불 꺼진 집이라 벽난로는 두지 않음)",
  });

  // ═════════ 모험가 길드 ═════════
  m = shell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 11, y: 11 } });
  stamp(m, "tibo-v6-1-0", 3, 3); stamp(m, "tibo-v6-1-0", 6, 3); stamp(m, "tibo-lectern", 5, 4); stamp(m, "tibo-v6-2-0", 8, 3); stamp(m, "tibo-library-223", 11, 3);
  one(m, 2, 3, 24); one(m, 13, 3, 24);
  table(m, 14, 6, 18, 6); stamp(m, "tibo-library-079", 14, 6); stamp(m, "tibo-library-122", 16, 6); stamp(m, "tibo-library-238", 18, 6);
  stamp(m, "tibo-v8-1-0", 15, 4); stamp(m, "tibo-library-221", 18, 3); stamp(m, "tibo-library-078", 19, 4);
  redRug(m, 2, 7, 10, 9); stamp(m, "tibo-fantasy-dining-set", 3, 7); stamp(m, "tibo-fantasy-dining-set", 7, 7);
  tealRug(m, 13, 8, 15, 10); stamp(m, "tibo-library-025", 14, 8); stamp(m, "tibo-library-030", 13, 9); stamp(m, "tibo-library-030", 15, 9);
  stamp(m, "tibo-library-025", 11, 5); stamp(m, "tibo-library-030", 10, 6); stamp(m, "tibo-library-030", 12, 6);
  stamp(m, "tibo-fantasy-weapon-rack", 18, 9); stamp(m, "tibo-library-194", 17, 11); stamp(m, "tibo-library-196", 16, 11);
  stamp(m, "tibo-library-209", 2, 10);
  add("interior-adventurers-guild", "모험가 길드", T, m, {
    group: "civic", entry: [11, 12], keeper: [16, 5], targets: [[16, 7], [5, 6], [11, 7]],
    use: "모험가가 의뢰를 받고 보고하는 곳. 뒷벽 게시판에서 의뢰서를 고르고, 오른쪽 뒷벽을 등진 접수대에서 접수원에게 등록·보상 수령, 왼쪽 식탁에서 동료를 모은다",
    note: "크림 벽 18×7칸. 뒷벽에 의뢰 게시판 둘과 그 앞 의뢰 장부 독서대·강 지도 액자·사슴뿔 벽판·횃불, 오른쪽 뒷벽을 등진 접수 탁자(나무 상판 위 편지 쟁반·동전 쟁반·금고함)와 벽 열쇠판·방패 장식·문서 분류장(접수원 자리 (16,5)), 왼쪽 붉은 러그 위 긴 식탁과 벤치 두 벌, 가운데 원형 식탁과 걸상 둘, 앞 오른쪽 구석에 무기 거치대·배낭·밧줄 한 덩이, 앞 왼쪽 야자 화분",
  });

  // ═════════ 마법 상점 · 연금술 공방 ═════════
  m = shell(16, 13, { wings: [{ x: 2, y: 5, w: 12, h: 5 }], door: { x: 8, y: 9 } });
  stamp(m, "tibo-v4-2-0", 2, 3); stamp(m, "tibo-v4-2-2", 11, 4); stamp(m, "tibo-fantasy-crystal-stand", 13, 4); stamp(m, "tibo-library-167", 12, 5);
  stamp(m, "tibo-library-159", 6, 3); stamp(m, "tibo-library-163", 8, 3); stamp(m, "tibo-library-220", 10, 3);
  table(m, 6, 6, 10, 6); stamp(m, "tibo-library-148", 6, 6); stamp(m, "tibo-library-157", 8, 6); stamp(m, "tibo-library-165", 9, 6);
  redRug(m, 10, 8, 13, 9); one(m, 12, 8, 329); one(m, 11, 8, 297); one(m, 13, 8, 298);
  tealRug(m, 7, 8, 9, 9); stamp(m, "tibo-library-126", 2, 8); stamp(m, "tibo-v10-1-0", 3, 9);
  add("interior-magic-shop", "마법 상점", T, m, {
    group: "civic", entry: [8, 10], keeper: [8, 5], targets: [[8, 7], [8, 5], [11, 9]],
    use: "마법 도구를 파는 가게. 손님은 청록 러그를 지나 카운터로 가고, 상인은 뒷벽 진열장을 등지고 카운터 뒤에서 물약·수정을 꺼내 준다. 오른쪽 점술대에서 점을 봐 준다",
    note: "크림 벽 12×5칸. 뒷벽에 물약 진열장 3×3·마법봉 걸이·달 위상 벽판·별자리 판·두루마리 수납장·부적 진열대·수정구 받침, 나무 상판 카운터(x=6~10, 상인 자리 (8,5)) 위에 약병 세 개·수정구·수정 표본 쟁반, 오른쪽 앞 붉은 러그 위 점술대 329와 마주 앉는 의자 둘, 입구 청록 러그, 왼쪽 앞 상품 진열 받침·봉인 상자",
  });
  m = shell(18, 14, { wings: [{ x: 2, y: 5, w: 14, h: 6 }], door: { x: 9, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  stamp(m, "tibo-medieval-herbal-cabinet", 2, 3); stamp(m, "tibo-fantasy-alchemy-desk", 6, 4); stamp(m, "tibo-fantasy-bookcase", 9, 4);
  stamp(m, "tibo-library-147", 11, 4); stamp(m, "tibo-library-151", 12, 4); stamp(m, "tibo-library-104", 14, 4);
  stamp(m, "tibo-library-166", 14, 7); stamp(m, "tibo-library-098", 15, 8);
  table(m, 5, 7, 9, 8); stamp(m, "tibo-library-003", 5, 7); stamp(m, "tibo-library-148", 6, 7); stamp(m, "tibo-library-155", 9, 7);
  stamp(m, "tibo-library-146", 5, 8); stamp(m, "tibo-library-158", 8, 8); stamp(m, "tibo-library-030", 7, 9); stamp(m, "tibo-library-030", 4, 8);
  stamp(m, "tibo-fantasy-herb-rack", 11, 9); stamp(m, "tibo-library-234", 2, 9); stamp(m, "tibo-library-229", 3, 9);
  add("interior-alchemy-workshop", "연금술 공방", T, m, {
    group: "civic", entry: [9, 11], keeper: [7, 9], targets: [[7, 6], [13, 7], [4, 7]],
    use: "연금술사가 약을 달이고 재료를 갈무리하는 작업실. 뒷벽이 재료·책·증류 도구, 오른쪽이 불(작은 대장간 화덕·물약 가마솥·석탄 통), 가운데 작업대에서 재료를 빻고 달인다",
    note: "석벽·돌바닥 42, 14×6칸. 뒷벽에 약초 건조장 3×3·연금술 작업대 3×2(물약)·두꺼운 책장·증류 유리병 받침·뿌리 표본병·작은 대장간 화덕, 오른쪽 물약 가마솥·석탄 통(돌바닥 위 불), 가운데 나무 상판 작업대 5×2 위에 절구와 공이·약병 세 개·환약 단지·약초 도마·펼친 처방서, 작업대 옆 걸상 둘, 앞 오른쪽 약초 건조대, 앞 왼쪽 저장 옹기·뚜껑 통",
  });

  // ═════════ 도서관 · 마법 학원 교실 ═════════
  m = shell(22, 16, { wings: [{ x: 2, y: 5, w: 18, h: 9 }], door: { x: 11, y: 13 } });
  floorTo(m, 102);
  const CASE = [[18, 19, 20], [48, 49, 50], [78, 79, 80]];
  for (const x of [2, 5, 14, 17]) block(m, x, 4, CASE, "lowerTiles", "furn");
  stamp(m, "tibo-lectern", 9, 5); stamp(m, "tibo-library-074", 11, 4); stamp(m, "tibo-v12-1-2", 13, 4);
  for (const x of [3, 4, 5, 6, 15, 16, 17, 18]) block(m, x, 8, [[147], [177]]);
  for (const x of [3, 4, 5, 6, 17, 18]) block(m, x, 11, [[147], [177]]);
  tealRug(m, 8, 7, 12, 13);
  block(m, 9, 9, [[325, 326, 327]]); one(m, 9, 8, 267); one(m, 11, 8, 267);
  block(m, 9, 11, [[325, 326, 327]]); one(m, 9, 12, 268); one(m, 11, 12, 268);
  stamp(m, "tibo-library-083", 12, 8); one(m, 2, 7, 288); one(m, 19, 7, 288);
  stamp(m, "tibo-warm-scribe-desk", 14, 11); one(m, 16, 12, 298);
  add("interior-library", "도서관", T, m, {
    group: "civic", entry: [11, 14], keeper: [14, 10], targets: [[10, 6], [8, 10], [14, 10], [19, 12], [2, 10]],
    use: "책을 빌려 읽는 도서관. 문에서 곧장 가운데 열람 탁자로, 양옆 서가 두 줄 사이 통로로 책을 찾고, 문 오른쪽 사서 책상에서 대출을 받는다",
    note: "크림 벽·널 바닥 102, 18×9칸. 뒷벽에 큰 책장 18~80(3×3) 넷과 독서대·펼친 지도책 받침·지구본, 양옆에 1×2 서가 147/177 두 줄(y=8, 11), 가운데 청록 러그 위 긴 열람 탁자 둘(위 탁자는 탁자를 보는 의자 267, 아래 탁자는 등을 보인 의자 268)·독서등, 오른쪽 앞 사서 책상과 의자(사서 자리 (14,10)), 양쪽 서가 끝 화분",
  });
  m = shell(20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 8 }], door: { x: 10, y: 12 }, wall: "stone-brick" });
  floorTo(m, 102);
  stamp(m, "tibo-library-220", 7, 3); stamp(m, "tibo-library-163", 11, 3);
  tealRug(m, 3, 5, 6, 7); table(m, 4, 6, 5, 6); stamp(m, "tibo-library-165", 4, 6); stamp(m, "tibo-v11-1-3", 4, 4); stamp(m, "tibo-library-073", 5, 6);
  stamp(m, "tibo-lectern", 9, 4); table(m, 12, 6, 14, 6); stamp(m, "tibo-library-158", 12, 6); stamp(m, "tibo-v11-1-0", 14, 6); one(m, 13, 5, 267);
  block(m, 8, 6, [[381, 382, 383], [411, 412, 413], [441, 442, 443]]);
  for (const y of [9, 11]) for (const x of [3, 5, 7, 12, 14, 16]) { stamp(m, "tibo-v4-4-2", x, y); one(m, x, y + 1, 268); }
  redRug(m, 9, 9, 10, 12); stamp(m, "tibo-fantasy-bookcase", 2, 4); stamp(m, "tibo-fantasy-crystal-stand", 17, 4); stamp(m, "tibo-v12-1-2", 16, 4);
  stamp(m, "tibo-library-215", 2, 12); stamp(m, "tibo-library-215", 17, 12);
  add("interior-academy-classroom", "마법 학원 · 교실", T, m, {
    group: "civic", entry: [10, 13], keeper: [9, 6], targets: [[9, 6], [4, 12], [15, 12], [14, 7]],
    use: "마법 학원의 강의실. 선생은 앞(북쪽) 교탁과 교사 책상에서 가르치고 바닥 마법진에서 시범을 보이며, 학생은 책상 열두 개에 앉아 북쪽을 본다",
    note: "석벽·널 바닥 102, 16×8칸. 앞벽에 별자리 판·달 위상 벽판, 교탁(독서대)과 그 앞 마법진 381~443(3×3), 오른쪽 교사 책상(나무 상판 위 펼친 룬 서적·모래시계)과 학생 쪽을 보는 의자 267, 학생 독서 탁자와 등을 보인 의자 268 여섯 쌍×두 줄(가운데 통로 붉은 러너), 옆벽 쪽 두꺼운 책장·지구본·수정구 받침",
  });

  // ═════════ 성 ═════════
  // 식당·병영은 성 1층(대형 맵) 복도 북쪽 문 틈과, 침실은 성 1층 오르막 계단과, 보물고는 내리막 계단과 짝이다.
  m = shell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 }, wall: "gold-brick" });
  floorTo(m, 42);
  redRug(m, 5, 6, 14, 9);
  stamp(m, "tibo-medieval-banquet-table", 6, 7); stamp(m, "tibo-medieval-banquet-table", 10, 7);
  for (const x of [6, 8, 11, 13]) { one(m, x, 6, 267); one(m, x, 9, 268); }
  block(m, 5, 7, [[446], [476]]); block(m, 14, 7, [[446], [476]]);
  stamp(m, "tibo-medieval-stone-fireplace", 16, 3); stamp(m, "tibo-warm-crockery", 2, 4); stamp(m, "tibo-library-134", 2, 6);
  stamp(m, "tibo-library-218", 7, 3); stamp(m, "tibo-library-218", 12, 3); stamp(m, "tibo-library-217", 9, 3);
  block(m, 5, 3, [[142, 143], [172, 173]]); block(m, 14, 3, [[142, 143], [172, 173]]);
  stamp(m, "tibo-library-031", 16, 7); one(m, 19, 10, 288); one(m, 4, 10, 288);
  add("interior-castle-dining", "성 · 식당", T, m, {
    group: "castle", entry: [11, 11], targets: [[10, 6], [7, 5], [15, 8], [4, 7]],
    use: "왕과 손님이 식사하는 성의 큰 식당. 붉은 카펫 위 긴 연회 식탁 양 끝에 왕·왕비의 붉은 의자, 벽난로와 식기장, 시종은 오른쪽 음식 운반대로 나른다. 남쪽 문은 성 1층 서쪽 복도 북쪽 문 틈과 이어진다",
    note: "금벽돌 벽·돌바닥 42, 18×6칸. 붉은 카펫 10×4 위에 연회용 긴 식탁 4×2 두 개를 이어 8칸 식탁, 위쪽은 식탁을 보는 의자 267, 아래쪽은 등을 보인 의자 268 넷씩, 양 끝 붉은 의자 446/476, 뒷벽에 초상화 둘·풍경화·붉은 커튼 두 쌍, 서벽에 식기장과 그 아래 포도주 선반(한 덩이), 오른쪽 뒤 장작 벽난로와 식탁 끝 음식 운반대, 앞 화분 둘",
  });
  // 침실 — 성 1층 오르막 계단으로 올라오는 층. 남쪽 문은 닫고 동벽에 내려가는 계단.
  m = shell(18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 9, y: 9 }, wall: "gold-brick" });
  closeDoor(m, 9, 10);
  redRug(m, 6, 7, 11, 8);
  stamp(m, "tibo-medieval-canopy-bed", 7, 4); stamp(m, "tibo-library-039", 6, 5); stamp(m, "tibo-library-039", 10, 5);
  stamp(m, "tibo-fantasy-wardrobe", 2, 4); stamp(m, "tibo-library-040", 4, 5); stamp(m, "tibo-library-041", 5, 4);
  stamp(m, "tibo-medieval-stone-fireplace", 12, 3); stamp(m, "tibo-warm-scribe-desk", 2, 8); one(m, 4, 9, 298);
  stamp(m, "tibo-warm-bench", 12, 7); stairsDown(m, 14, 8); one(m, 11, 3, 56); one(m, 6, 3, 56); stamp(m, "tibo-library-219", 9, 3);
  add("interior-castle-bedchamber", "성 · 침실", T, m, {
    group: "castle", entry: [14, 7], targets: [[9, 7], [3, 7], [13, 9]],
    use: "왕족의 침실. 성 1층 계단실의 오르막 계단으로 올라오면 동벽 계단 앞. 가운데 천개 침대 양옆에 협탁, 왼쪽 옷장·화장대(몸단장), 오른쪽 벽난로와 쿠션 의자(휴식), 앞 왼쪽 책상에서 편지를 쓴다",
    note: "금벽돌 벽·나무 바닥 72, 14×5칸. 남쪽 문을 닫고 동벽 앞에 내려가는 돌계단 474|475(성 1층 계단실과 짝). 천개 침대 3×3 양옆 협탁, 커튼 창 56 둘·타원 가족 초상화, 침대 앞 붉은 러그, 왼쪽 옷장 2×3·화장대·전신 거울, 오른쪽 장작 벽난로·쿠션 긴 의자, 앞 왼쪽 필경사 책상과 의자",
  });
  m = shell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  for (const x of [2, 4, 6, 8, 14, 16, 18]) { block(m, x, 5, [[324], [354]]); stamp(m, "tibo-library-045", x, 7); }
  stamp(m, "tibo-fantasy-weapon-rack", 10, 4); stamp(m, "tibo-medieval-armor-stand", 12, 4);
  for (const x of [3, 7, 15, 19]) one(m, x, 3, 24); stamp(m, "tibo-library-221", 5, 3); stamp(m, "tibo-library-221", 17, 3);
  stamp(m, "tibo-v4-4-0", 3, 9); stamp(m, "tibo-library-028", 3, 10); stamp(m, "tibo-v4-4-0", 7, 9); stamp(m, "tibo-library-028", 7, 10);
  stamp(m, "tibo-warm-scribe-desk", 17, 9); one(m, 16, 10, 297); stamp(m, "tibo-grindstone", 11, 8);
  add("interior-castle-barracks", "성 · 병영", T, m, {
    group: "castle", entry: [11, 11], targets: [[11, 7], [3, 6], [5, 8], [19, 10]],
    use: "성 경비병이 자고 무장하는 병영. 뒷벽을 따라 침대와 발치 궤짝, 가운데 뒤 무기·갑옷 거치대에서 무장, 앞 왼쪽 식탁에서 먹고, 앞 오른쪽이 부대장 책상. 남쪽 문은 성 1층 동쪽 복도 북쪽 문 틈과 이어진다",
    note: "석벽·돌바닥 42, 18×6칸. 침대 324/354 일곱 개와 발치 여행용 궤짝, 가운데 뒤 무기 거치대·갑옷 거치대, 벽 횃불 넷·방패 벽 장식 둘, 궤짝 앞 줄(y=8)은 비운 복도, 앞 왼쪽 식사 탁자 둘과 긴 벤치, 앞 오른쪽 필경사 책상과 의자",
  });
  // 보물고 — 성 1층 내리막 계단으로 내려오는 지하. 남쪽 문은 닫고 동벽에 오르막 계단.
  m = shell(16, 13, { wings: [{ x: 2, y: 5, w: 12, h: 5 }], door: { x: 8, y: 9 }, wall: "gold-brick" });
  floorTo(m, 42); closeDoor(m, 8, 10);
  redRug(m, 6, 6, 10, 9);
  stamp(m, "tibo-fantasy-crystal-stand", 8, 4); stamp(m, "tibo-library-221", 5, 3); stamp(m, "tibo-library-221", 11, 3);
  block(m, 3, 4, [[263], [293]]); block(m, 11, 4, [[263], [293]]); one(m, 2, 4, 290);
  stamp(m, "tibo-library-045", 2, 7); stamp(m, "tibo-library-045", 2, 9); stamp(m, "tibo-v10-1-0", 3, 9); stamp(m, "tibo-library-100", 4, 9);
  stamp(m, "tibo-library-045", 12, 9); stamp(m, "tibo-library-100", 10, 9);
  block(m, 6, 7, [[87], [117]]); block(m, 10, 7, [[87], [117]]);
  stairsUp(m, 13, 5);
  add("interior-castle-treasury", "성 · 보물고", T, m, {
    group: "castle", entry: [13, 8], targets: [[8, 6], [3, 6], [11, 8]],
    use: "왕실 보물을 넣어 두는 지하 방. 성 1층 계단실의 내리막 계단으로 내려오면 동벽 계단 앞. 붉은 카펫 끝 수정구 받침이 가장 귀한 보물, 양옆에 전설의 검·방패, 갑옷 전시대가 지키고 벽을 따라 궤짝과 주괴",
    note: "금벽돌 벽·돌바닥 42, 12×5칸(작다). 남쪽 문을 닫고 동벽에 오르막 계단 111/141/171(성 1층 계단실과 짝). 뒷벽 가운데 수정구 받침과 방패 벽 장식 둘, 검 진열대 263/293 둘, 벽에 건 갑옷 290, 붉은 카펫 양옆 갑옷 전시대 87/117, 왼쪽 궤짝 둘·봉인 상자·주괴 더미, 오른쪽 궤짝·주괴 더미",
  });

  // ═════════ 성 1층 (대형) ═════════
  // 50×40 — 가운데 대연회장을 복도 고리(서·북·동·남)가 두르고, 북쪽 알현실, 서쪽 계단실·주방·식료 창고, 동쪽 무기고·
  // 경비 초소·세탁실. 남쪽 복도 가운데가 정문. 서쪽 복도 북쪽 끝 문 틈 → 식당, 동쪽 복도 북쪽 끝 문 틈 → 병영.
  {
    const R = (id, x, y, w, h) => ({ id, x, y, w, h });
    m = shell(50, 40, {
      rooms: [
        R("stairs", 2, 4, 10, 8), R("kitchen", 2, 15, 10, 6), R("scullery", 2, 24, 10, 3), R("larder", 2, 30, 10, 7),
        R("westHall", 13, 4, 2, 33), R("throne", 16, 4, 18, 11), R("northHall", 15, 18, 20, 2), R("greatHall", 16, 23, 18, 9),
        R("southHall", 15, 35, 20, 2), R("eastHall", 35, 4, 2, 33),
        R("armory", 38, 4, 10, 8), R("dorm", 38, 15, 10, 5), R("duty", 38, 23, 10, 4), R("laundry", 38, 30, 10, 5),
      ],
      innerDoors: [
        { x: 12, y: 8 }, { x: 12, y: 18 }, { x: 6, y: 21 }, { x: 12, y: 25 }, { x: 12, y: 33 }, { x: 37, y: 8 }, { x: 37, y: 17 }, { x: 37, y: 24 }, { x: 37, y: 33 },
        { x: 15, y: 9 }, { x: 34, y: 9 }, { x: 24, y: 15 }, { x: 25, y: 15 },
        { x: 24, y: 20 }, { x: 25, y: 20 }, { x: 15, y: 27 }, { x: 34, y: 27 }, { x: 24, y: 32 }, { x: 25, y: 32 },
      ],
      door: { x: 24, y: 36 }, northDoors: [13, 36], wall: "stone-brick", openPlan: true,
    });
    floorTo(m, 42);
    // 알현실 x16~33 y4~14: 단상(무늬 석판) 위 큰 왕좌와 붉은 의자 둘, 가운데 붉은 카펫, 기둥 두 줄(x=20·29).
    // 서쪽 통로에 서기의 책상, 동쪽 통로에 흰 천 작전 탁자, 구석마다 갑옷 거치대·야자 화분.
    redRugShape(m, [[21, 4, 28, 6], [19, 7, 30, 8], [23, 9, 26, 14]]); block(m, 23, 4, [[447, 448, 449], [477, 478, 479]]); block(m, 22, 5, [[446], [476]]); block(m, 27, 5, [[446], [476]]);
    block(m, 19, 2, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn"); block(m, 29, 2, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn");
    for (const y of [7, 10, 13]) for (const x of [20, 29]) block(m, x, y, [[89], [119]]);
    for (const x of [17, 32]) one(m, x, 3, 24); stamp(m, "tibo-library-221", 21, 2); stamp(m, "tibo-library-221", 28, 2);
    stamp(m, "tibo-brazier", 22, 7); stamp(m, "tibo-brazier", 27, 7); stamp(m, "tibo-medieval-armor-stand", 16, 4); stamp(m, "tibo-medieval-armor-stand", 32, 4);
    tealRug(m, 16, 10, 18, 12); stamp(m, "tibo-medieval-scribe-desk", 16, 10); one(m, 17, 12, 268); stamp(m, "tibo-library-078", 16, 8); stamp(m, "tibo-library-078", 17, 8);
    tealRug(m, 30, 10, 33, 13); clothTable(m, 31, 10, 32, 12); stamp(m, "tibo-library-160", 31, 10); stamp(m, "tibo-library-076", 31, 11); stamp(m, "tibo-library-168", 31, 12); one(m, 30, 11, 297); one(m, 33, 11, 298);
    stamp(m, "tibo-library-209", 16, 13); stamp(m, "tibo-library-209", 32, 13); for (const [x, y] of [[21, 12], [28, 12], [22, 9], [27, 9]]) one(m, x, y, 204);
    // 계단실 x2~11 y4~11: 동벽(칸막이) 앞 오르막 계단 → 성 침실, 서벽 앞 내리막 계단 → 성 보물고. 기다리는 손님용 원탁·괘종시계·초상화.
    stairsUp(m, 11, 4); stairsDown(m, 2, 4); stamp(m, "tibo-library-218", 5, 2); stamp(m, "tibo-library-218", 8, 2); one(m, 4, 2, 24); one(m, 9, 2, 24);
    block(m, 10, 4, [[389], [419]]); stamp(m, "tibo-medieval-armor-stand", 6, 3);
    tealRug(m, 4, 7, 9, 10); stamp(m, "tibo-library-025", 6, 7); stamp(m, "tibo-library-030", 5, 8); stamp(m, "tibo-library-030", 7, 8);
    block(m, 2, 7, [[87], [117]]); stamp(m, "tibo-library-209", 2, 10); stamp(m, "tibo-library-215", 10, 11);
    // 주방 x2~11 y15~20: 뒷벽 석조 빵 화덕·솥 걸이·약초·소시지 걸이·식기장, 서벽 조리대 둘, 가운데 큰 작업 탁자(나무 상판 위 식재료)와 걸상.
    stamp(m, "tibo-medieval-bread-oven", 2, 13); stamp(m, "tibo-fantasy-hanging-pot", 6, 15); stamp(m, "tibo-hanging-herbs", 8, 13); stamp(m, "tibo-library-021", 10, 13);
    stamp(m, "tibo-warm-crockery", 10, 15); stamp(m, "tibo-fantasy-prep-table", 2, 17); stamp(m, "tibo-fantasy-prep-table", 2, 19);
    table(m, 6, 18, 9, 20); stamp(m, "tibo-library-001", 6, 18); stamp(m, "tibo-library-004", 8, 18); stamp(m, "tibo-library-008", 9, 18);
    stamp(m, "tibo-library-020", 6, 20); stamp(m, "tibo-library-005", 7, 19); stamp(m, "tibo-library-036", 9, 20);
    stamp(m, "tibo-library-030", 8, 17); stamp(m, "tibo-library-030", 10, 19);
    // 설거지·곡물 방 x2~11 y24~26: 물통·버터 교반통·손맷돌·채소 상자와 자루.
    stamp(m, "tibo-fantasy-water-tub", 2, 24); stamp(m, "tibo-butter-churn", 5, 24); stamp(m, "tibo-medieval-grain-mill", 7, 24); stamp(m, "tibo-library-012", 3, 22);
    stamp(m, "tibo-library-013", 10, 24); stamp(m, "tibo-library-014", 11, 24); stamp(m, "tibo-library-018", 10, 26); stamp(m, "tibo-library-019", 11, 26);
    // 식료 창고 x2~11 y30~36: 뒷벽 술통 선반·포도주 선반·식재료 자루·양파 꾸러미, 앞쪽 쌓인 상자·통·생선 건조대·잡화 선반.
    stamp(m, "tibo-fantasy-ale-rack", 2, 29); stamp(m, "tibo-library-134", 5, 29); stamp(m, "tibo-fantasy-grain-sacks", 7, 29); stamp(m, "tibo-library-016", 10, 29);
    stamp(m, "tibo-library-232", 4, 33); stamp(m, "tibo-library-232", 5, 33); stamp(m, "tibo-library-230", 4, 35); stamp(m, "tibo-library-229", 2, 33); stamp(m, "tibo-library-133", 2, 35);
    stamp(m, "tibo-library-022", 8, 33); stamp(m, "tibo-library-132", 8, 35); stamp(m, "tibo-library-232", 6, 31); stamp(m, "tibo-library-230", 7, 32);
    // 대연회장 x16~33 y23~31: 붉은 카펫 위 연회 식탁 네 개와 의자, 북벽 벽난로·커튼·방패·횃불, 남쪽 모서리 기둥.
    redRug(m, 18, 24, 31, 31);
    for (const y of [25, 29]) {
      stamp(m, "tibo-medieval-banquet-table", 19, y); stamp(m, "tibo-medieval-banquet-table", 27, y);
      for (const x of [20, 21, 28, 29]) { one(m, x, y - 1, 267); one(m, x, y + 2, 268); }
    }
    stamp(m, "tibo-medieval-stone-fireplace", 24, 21); for (const x of [17, 32]) block(m, x, 21, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn");
    stamp(m, "tibo-library-221", 20, 21); stamp(m, "tibo-library-221", 29, 21); one(m, 22, 21, 24); one(m, 27, 21, 24);
    stamp(m, "tibo-library-031", 16, 27); stamp(m, "tibo-library-031", 32, 27); for (const x of [16, 33]) block(m, x, 30, [[89], [119]]);
    // 복도: 러너와 벽 횃불, 문 옆 갑옷 전시대·모퉁이 화분.
    redRug(m, 15, 18, 34, 19); redRug(m, 15, 35, 34, 36); redRug(m, 13, 5, 14, 34); redRug(m, 35, 5, 36, 34);
    for (const x of [18, 22, 28, 32]) one(m, x, 16, 24);
    for (const y of [12, 31]) { block(m, 13, y, [[87], [117]]); block(m, 36, y, [[87], [117]]); }
    stamp(m, "tibo-library-215", 14, 36); stamp(m, "tibo-library-215", 35, 36);
    // 무기고 x38~47 y4~11: 뒷벽 무기 거치대 넷·갑옷 거치대·연습검 걸이, 가운데 갑옷 거치대 세 벌, 앞쪽 숫돌·공구 상자·쌓인 상자.
    for (const x of [38, 40, 44, 46]) stamp(m, "tibo-fantasy-weapon-rack", x, 3);
    stamp(m, "tibo-medieval-armor-stand", 42, 3); stamp(m, "tibo-library-222", 42, 2);
    for (const x of [39, 42, 45]) stamp(m, "tibo-medieval-armor-stand", x, 7);
    stamp(m, "tibo-grindstone", 41, 10); stamp(m, "tibo-library-231", 38, 11); stamp(m, "tibo-library-231", 44, 11); stamp(m, "tibo-library-232", 47, 10); stamp(m, "tibo-library-232", 46, 10);
    // 경비 숙소 x38~47 y15~19: 뒷벽 침대 넷과 궤짝, 원탁과 걸상, 무기 거치대. 벽에 대진표·열쇠판.
    for (const x of [39, 41, 43, 45]) { block(m, x, 15, [[324], [354]]); stamp(m, "tibo-library-045", x, 17); }
    stamp(m, "tibo-v6-1-0", 38, 13); stamp(m, "tibo-v8-1-0", 46, 13);
    stamp(m, "tibo-library-025", 42, 18); stamp(m, "tibo-library-030", 41, 19); stamp(m, "tibo-library-030", 43, 19); stamp(m, "tibo-fantasy-weapon-rack", 46, 17);
    // 경비 초소 x38~47 y23~26: 식사 탁자와 벤치, 부대장 책상과 의자, 벽에 방패 장식.
    stamp(m, "tibo-v4-4-0", 39, 24); stamp(m, "tibo-library-028", 39, 23); stamp(m, "tibo-library-028", 39, 25); stamp(m, "tibo-library-221", 41, 21); stamp(m, "tibo-library-221", 43, 21);
    stamp(m, "tibo-medieval-scribe-desk", 44, 23); one(m, 45, 25, 268); stamp(m, "tibo-fantasy-weapon-rack", 42, 22);
    // 세탁실 x38~47 y30~36: 뒷벽 물통·빨래판·건조대 둘, 가운데 나무 상판 개는 탁자(접은 수건·이불), 빨래통·바구니·린넨 장.
    stamp(m, "tibo-fantasy-water-tub", 38, 29); stamp(m, "tibo-library-060", 41, 29); stamp(m, "tibo-library-069", 43, 29); stamp(m, "tibo-library-069", 45, 29);
    table(m, 41, 33, 43, 34); stamp(m, "tibo-library-054", 41, 33); stamp(m, "tibo-library-037", 42, 33); stamp(m, "tibo-library-054", 43, 34);
    stamp(m, "tibo-library-048", 38, 34); stamp(m, "tibo-v9-1-2", 39, 34); stamp(m, "tibo-library-070", 44, 34); stamp(m, "tibo-library-059", 47, 32);
    add("interior-castle-1f", "성 · 1층 (알현실과 대연회장)", T, m, {
      group: "castle", entry: [24, 37], keeper: [24, 7],
      targets: [[24, 7], [24, 27], [8, 6], [11, 7], [3, 6], [6, 26], [3, 32], [42, 7], [42, 25], [42, 31], [13, 5], [36, 5], [14, 20], [35, 30]],
      use: "성의 1층 전체. 정문으로 들어오면 남쪽 복도, 가운데 대연회장을 복도 고리가 둘러 어느 쪽으로 돌아도 이어진다. 북쪽 알현실에 왕좌, 서쪽에 계단실(오르막 → 성 침실, 내리막 → 성 보물고)·주방·식료 창고, 동쪽에 무기고·경비 초소·세탁실. 서쪽 복도 북쪽 끝 문 틈은 성 식당, 동쪽 복도 북쪽 끝 문 틈은 성 병영으로 이어진다",
      note: "석벽·돌바닥 42, 50×40(비취 대계곡급 대형 실내). 방 12개(계단실 10×8·주방 10×12·식료 창고 10×7·서복도 2×33·알현실 18×11·북복도 20×2·대연회장 18×9·남복도 20×2·동복도 2×33·무기고 10×8·경비 초소 10×12·세탁실 10×7)를 파이프라인 칸막이로 나누고 세로 칸막이 천장을 북쪽 천장까지 이었다. 복도 고리: 서복도(x=13~14)↔북복도(y=18~19)↔동복도(x=35~36)↔남복도(y=35~36), 대연회장 사방 문과 알현실 양옆·남쪽 문이 고리를 더 잇는다. 알현실: 무늬 석판 단상 위 큰 왕좌 3×2와 붉은 의자 둘, 붉은 카펫, 기둥 두 줄·커튼·방패·화로·갑옷 거치대·촛대. 계단실: 동벽 앞 오르막 111/141/171, 서쪽 내리막 474|475, 초상화·청록 러그·갑옷 거치대·화분. 주방: 석조 빵 화덕·불 피운 솥 걸이(돌바닥)·약초·소시지 걸이·조리대 둘·나무 상판 큰 작업 탁자(빵 도마·반죽 그릇·접시·치즈·주전자·피처)와 걸상 둘·식기장·물통·자루와 채소 상자 한 덩이. 식료 창고: 술통 선반·포도주 선반·식재료 자루·쌓인 상자·통·양파·마늘 꾸러미. 대연회장: 붉은 카펫 위 연회 식탁 네 개와 의자, 북벽 벽난로·커튼·방패·횃불, 남쪽 모서리 기둥. 무기고: 무기 거치대 넷·갑옷 거치대·연습검 걸이·긴 공구 상자·쌓인 상자. 경비 초소: 침대 넷과 궤짝, 대진표·열쇠판, 식사 탁자 둘과 벤치, 부대장 책상과 의자, 무기 거치대. 세탁실: 물통·빨래판·빨래 건조대 둘·빨래통·빨래 바구니·빨래집게 바구니·린넨 장",
    });
  }

  // ═════════ 투기장 · 카지노 · 경매장 ═════════
  m = shell(20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 10, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  stamp(m, "tibo-fantasy-weapon-rack", 2, 4); stamp(m, "tibo-fantasy-weapon-rack", 4, 4); stamp(m, "tibo-medieval-armor-stand", 12, 4); stamp(m, "tibo-medieval-armor-stand", 14, 4);
  stairsUp(m, 17, 5); one(m, 16, 3, 24); stamp(m, "tibo-library-221", 10, 3); stamp(m, "tibo-v6-1-0", 7, 3); one(m, 6, 3, 24);
  table(m, 7, 5, 9, 5); stamp(m, "tibo-library-148", 7, 5); stamp(m, "tibo-library-155", 9, 5); stamp(m, "tibo-library-149", 10, 5); stamp(m, "tibo-v9-1-1", 11, 5);
  for (const x of [3, 11]) { stamp(m, "tibo-v4-4-0", x, 8); stamp(m, "tibo-library-028", x, 7); stamp(m, "tibo-library-028", x, 9); }
  redRug(m, 7, 7, 9, 9); stamp(m, "tibo-library-229", 16, 9); stamp(m, "tibo-v6-1-1", 17, 10);
  add("interior-arena-waiting-room", "투기장 · 대기실", T, m, {
    group: "leisure", entry: [10, 11], targets: [[17, 8], [6, 8], [14, 8], [8, 6]],
    use: "투사가 경기 전에 무장하고 기다리는 방. 문으로 들어와 벽의 무기·갑옷으로 채비하고, 탁자에 앉아 순서를 기다리다 동벽 계단으로 경기장에 오른다. 뒷벽 약상은 경기 뒤 치료용",
    note: "석벽·돌바닥 42, 16×6칸. 뒷벽 왼쪽 무기 거치대 둘, 오른쪽 갑옷 거치대 둘, 동벽 앞 경기장으로 오르는 계단 111/141/171(바닥 위)과 횃불, 가운데 뒤 대진표·방패 장식과 약상(나무 상판 위 약병·환약 단지)·붕대 바구니·약품함, 대기용 식사 탁자 둘과 위아래 긴 벤치, 가운데 몸풀기 붉은 매트, 계단 옆 수건 걸이·물 양동이",
  });
  m = shell(22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 11, y: 12 }, wall: "gold-brick" });
  floorTo(m, 42);
  stamp(m, "tibo-library-134", 2, 4); stamp(m, "tibo-fantasy-ale-rack", 4, 4); stamp(m, "tibo-fantasy-bar-counter", 2, 7);
  stamp(m, "tibo-library-029", 3, 9); stamp(m, "tibo-library-029", 5, 9);
  table(m, 15, 6, 18, 6); stamp(m, "tibo-library-121", 15, 6); stamp(m, "tibo-library-122", 17, 6); stamp(m, "tibo-library-238", 18, 6);
  stamp(m, "tibo-library-217", 16, 3); block(m, 19, 4, [[88], [118]]); stamp(m, "tibo-v7-1-3", 17, 9); one(m, 16, 9, 297); one(m, 18, 9, 298);
  tealRug(m, 7, 7, 14, 11);
  stamp(m, "tibo-library-140", 8, 7); stamp(m, "tibo-library-140", 12, 7); one(m, 7, 8, 297); one(m, 10, 8, 298); one(m, 11, 8, 297); one(m, 14, 8, 298);
  table(m, 10, 10, 11, 10); stamp(m, "tibo-library-139", 10, 10); one(m, 10, 11, 268); one(m, 11, 11, 268);
  stamp(m, "tibo-chessboard", 8, 10); one(m, 7, 10, 297); stamp(m, "tibo-chessboard", 13, 10); one(m, 14, 10, 298);
  stamp(m, "tibo-library-169", 9, 4); stamp(m, "tibo-library-138", 11, 3);
  block(m, 2, 11, [[89], [119]]); block(m, 19, 11, [[89], [119]]); stamp(m, "tibo-library-209", 16, 11); stamp(m, "tibo-library-209", 4, 11);
  add("interior-casino", "카지노", T, m, {
    group: "leisure", entry: [11, 13], keeper: [16, 5], targets: [[16, 7], [10, 9], [3, 6]],
    use: "돈을 걸고 노는 도박장. 들어오면 오른쪽 뒷벽을 등진 환전 창구(나무 상판 위 돈 서랍·동전 쟁반·금고함)에서 칩을 바꾸고, 청록 카펫 위 카드 탁자·주사위 탁자·체스판에서 놀고, 왼쪽 뒤 바에서 술을 마신다",
    note: "금벽돌 벽·돌바닥 42, 18×8칸. 왼쪽 뒤 포도주 선반·술통 선반 앞 바 카운터 4×2와 높은 걸상 둘, 오른쪽 뒤 뒷벽을 등진 환전 탁자(점원 자리 (16,5))와 풍경화·여자 흉상, 가운데 청록 카펫 위 카드 탁자 둘과 양옆 의자, 주사위 탁자(나무 상판 위 주사위 쟁반)와 의자 둘, 체스판 둘과 의자, 뒷벽 업라이트 피아노·다트판, 문 양옆 기둥과 야자 화분",
  });
  m = shell(20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 8 }], door: { x: 10, y: 12 } });
  redRug(m, 4, 5, 15, 6);
  block(m, 2, 3, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn"); block(m, 16, 3, [[142, 143], [172, 173], [202, 203]], "upperTiles", "furn");
  stamp(m, "tibo-lectern", 10, 5); stamp(m, "tibo-medieval-armor-stand", 5, 4); stamp(m, "tibo-easel", 8, 5);
  redRug(m, 9, 7, 10, 12); stamp(m, "tibo-fantasy-crystal-stand", 13, 5); stamp(m, "tibo-library-214", 14, 5); one(m, 7, 3, 84); one(m, 12, 3, 85);
  for (const y of [8, 10]) { stamp(m, "tibo-fantasy-pew", 4, y); stamp(m, "tibo-fantasy-pew", 11, y); }
  table(m, 16, 9, 16, 11); stamp(m, "tibo-library-076", 16, 9); stamp(m, "tibo-library-122", 16, 10); stamp(m, "tibo-library-238", 16, 11);
  stamp(m, "tibo-library-215", 2, 12); stamp(m, "tibo-library-215", 3, 12);
  add("interior-auction-house", "경매장", T, m, {
    group: "leisure", entry: [10, 13], keeper: [10, 7], targets: [[10, 7], [3, 9], [17, 10]],
    use: "귀한 물건을 경매로 파는 홀. 앞쪽 붉은 카펫 무대에 오늘의 물건(갑옷·그림·수정구)이 놓이고 경매인은 독서대 앞에서 호가를 부르며, 손님은 긴 의자에 앉아 값을 부른다. 낙찰되면 동벽을 등진 계산대에서 치른다",
    note: "크림 벽 16×8칸. 뒷벽 양 끝 커튼 142/143·172/173·202/203, 앞쪽 붉은 카펫 무대 12×2에 갑옷 거치대·그림 이젤·수정구 받침·말린 꽃병, 벽에 그림 84·85, 경매인 독서대(경매인 자리 (10,7)), 가운데 통로 붉은 러너를 두고 긴 의자 4×2 두 줄씩, 동벽을 등진 세로 계산대(나무 상판 위 잉크와 깃펜·동전 쟁반·금고함, 점원 자리 x=17), 문 옆 둥근 관목 화분 둘",
  });

  // ═════════ 배 (easyrpg_chipset_ship, 갑판 맵과 같은 시트) ═════════
  tileMap = graft;
  m = shipShell(21, 13, { rooms: [{ id: "captain", x: 2, y: 5, w: 8, h: 5 }, { id: "crew", x: 11, y: 5, w: 8, h: 5 }], innerDoors: [{ x: 10, y: 8 }], door: { x: 14, y: 9 } });
  closeDoor(m, 14, 10);
  shipLadder(m, 17, 5);
  block(m, 2, 5, [[416], [446]]); one(m, 3, 5, 384); block(m, 5, 3, [[388, 389]]); one(m, 8, 3, 295); one(m, 3, 3, 358);
  one(m, 6, 7, 387); one(m, 5, 7, 417); one(m, 7, 7, 417); stamp(m, "tibo-library-045", 9, 5); stamp(m, "tibo-library-198", 8, 4);
  for (const x of [11, 13, 15]) block(m, x, 5, [[416], [446]]);
  one(m, 18, 8, 385); one(m, 18, 9, 385); one(m, 17, 9, 386); one(m, 16, 9, 263); one(m, 12, 3, 119); one(m, 15, 3, 119);
  stamp(m, "tibo-library-045", 11, 9); stamp(m, "tibo-library-045", 12, 9);
  add("interior-ship-cabin", "배 · 선실", "easyrpg_chipset_ship", m, {
    group: "ship", entry: [17, 7], targets: [[6, 8], [9, 7], [12, 7], [16, 8]],
    use: "배의 갑판 아래 선실. 갑판에서 사다리로 내려오면 오른쪽 선원 침실(침상·짐통), 칸막이 문을 지나 왼쪽이 선장실(침대·책장·해도 그림·탁자)",
    note: "배 칩셋(푸른물결호 갑판과 같은 시트). 집 실내 껍데기에서 벽면만 둥근 창 벽 104~106/선체 판벽 134~136으로, 바닥을 목재 갑판 279로 바꿨다(천장 테두리 371·399~461·공허 430은 시트 배치가 같다). 칸막이 천장은 북쪽 천장까지 이었다. 선장실 침대 416/446·책장 384·해도 그림 388/389·엇갈린 검 295·그림 358·둥근 탁자 387과 걸상 417 둘·궤짝·지도통, 선원실 침상 셋·오크통 둘·항아리·밧줄·랜턴 119 둘·궤짝 둘, 북벽 앞 바닥에 사다리 22|23(x=17~18)",
  });
  m = shipShell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 } });
  closeDoor(m, 11, 11);
  shipLadder(m, 10, 5);
  for (const [x, y] of [[2, 5], [3, 5], [2, 6], [4, 5], [16, 5], [17, 5], [18, 5], [19, 5], [19, 6], [18, 6]]) one(m, x, y, 385);
  stamp(m, "tibo-library-232", 6, 4); stamp(m, "tibo-library-232", 7, 4); stamp(m, "tibo-library-230", 8, 5); stamp(m, "tibo-library-230", 13, 5);
  stamp(m, "tibo-fantasy-grain-sacks", 13, 8); stamp(m, "tibo-library-013", 16, 9); stamp(m, "tibo-library-014", 17, 9); stamp(m, "tibo-library-229", 14, 4);
  block(m, 2, 9, [[324, 325]]); block(m, 5, 9, [[324, 325]]); one(m, 2, 8, 386); one(m, 3, 8, 386); one(m, 4, 8, 263);
  stamp(m, "tibo-library-123", 18, 9); one(m, 6, 6, 385); one(m, 7, 6, 385); stamp(m, "tibo-library-196", 9, 7); stamp(m, "tibo-library-232", 13, 6); one(m, 16, 7, 386); one(m, 14, 3, 202); one(m, 7, 3, 202);
  block(m, 12, 7, [[72, 73], [102, 103]], "lowerTiles", "furn");
  add("interior-ship-hold", "배 · 화물칸", "easyrpg_chipset_ship", m, {
    group: "ship", entry: [10, 7], targets: [[11, 9], [3, 7], [18, 8]],
    use: "배 밑바닥 화물칸. 갑판에서 사다리로 내려오면 양옆으로 짐이 쌓여 있다 — 왼쪽 물·술 오크통과 예비 대포, 가운데 급수 펌프, 오른쪽 식량 자루·상자·소포",
    note: "선실과 같은 배 칩셋 껍데기(18×6칸). 오크통 385를 양 끝 벽에 쌓고, Tibo 쌓인 나무 상자·정사각 상자·뚜껑 둥근 통·식재료 자루·밀가루/쌀 포대·소포 더미를 이 시트 뒤쪽 칸에 이식해 놓았다. 앞 왼쪽 예비 대포 324/325 둘과 그 뒤 항아리 둘·감긴 밧줄 263, 가운데 급수 펌프 72/73/102/103(아래층), 벽에 환기 격자창 202, 북벽 앞 바닥에 사다리 22|23(x=10~11)",
  });
  tileMap = (t) => t;

  // Grafted Tibo cargo takes the Tibo slot's walkability, priority and a readable label.
  const kitName = new Map();
  for (const k of TIBO.structureKits) for (const r of k.rows) for (const t of r.upperTiles ?? []) if (t >= 0 && !kitName.has(t)) kitName.set(t, k.name);
  SHIP.count = Math.ceil((firstGraft + graftOf.size) / 30) * 30;
  while (SHIP.terrain.length < SHIP.count) SHIP.terrain.push(0);
  while (SHIP.priority.length < SHIP.count) SHIP.priority.push("lower");
  while (SHIP.passability.length < SHIP.count) SHIP.passability.push({ up: false, down: false, left: false, right: false });
  SHIP.tileMeta ??= [];
  while (SHIP.tileMeta.length < SHIP.count) SHIP.tileMeta.push({ label: "미사용", source: "unknown" });
  for (const [src, id] of graftOf) {
    SHIP.passability[id] = structuredClone(TIBO.passability[src]);
    SHIP.priority[id] = TIBO.priority[src];
    SHIP.tileMeta[id] = { label: `${kitName.get(src) ?? "실내 소품"} · Tibo ${src}`, source: "custom" };
  }

  // ── placement rules on the finished maps ──
  const rules = [];
  for (const p of places) {
    const mm = p.map, ship = p.tilesetId !== T;
    const lo = (x, y) => get(mm, x, y), up = (x, y) => get(mm, x, y, "upperTiles");
    const cells = (q) => { const c = []; for (let dy = 0; dy < q.h; dy++) for (let dx = 0; dx < q.w; dx++) c.push([q.x + dx, q.y + dy]); return c; };
    const face = (x, y) => FACE.has(lo(x, y));
    const tableAt = (x, y) => x >= 0 && y >= 0 && x < mm.width && y < mm.height && (TABLE_LOWER.has(lo(x, y)) || TABLE_TILES.has(up(x, y)));
    for (const q of p.placements) {
      const c = cells(q), bad = (why) => rules.push(`${p.id}: ${q.kitId ?? q.rows?.flat().join("/") ?? q.kind} @${q.x},${q.y} — ${why}`);
      if (ship && q.kind === "tibo-kit") continue; // grafted cargo has no Tibo table/face vocabulary to check against
      if (q.role === "top" && !c.every(([x, y]) => TABLE_LOWER.has(lo(x, y)))) bad("tabletop item off a table");
      if (q.role === "hang" && !c.every(([x, y]) => face(x, y))) bad("wall hanging crosses the wall-face rows");
      if (q.role === "seat" && !c.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tableAt(x + dx, y + dy)))) bad("seat without a table");
      if ((q.role === "furn" || q.role === "table" || q.role === "seat" || q.role === "top") && q.layer !== "lower") {
        const bottom = c.filter(([, y]) => y === q.y + q.h - 1);
        if (bottom.some(([x, y]) => face(x, y) || isCeil(lo(x, y)))) bad("floor furniture floating on the wall");
      }
    }
  }
  if (rules.length) console.error("placement rules:\n  " + rules.join("\n  "));

  // ── reachability with the runtime move rule ──
  const tilesets = { tibo_interior_expanded: TIBO, easyrpg_chipset_ship: SHIP };
  const maps = {}, report = [];
  for (const p of places) {
    const map = { id: p.id, name: p.name, width: p.map.width, height: p.map.height, tileSize: 16, tilesetId: p.tilesetId, lowerTiles: p.map.lowerTiles, upperTiles: p.map.upperTiles, events: [] };
    maps[p.id] = map;
    const project = { maps: { [p.id]: map }, tilesets };
    const seen = new Set([p.entry[1] * map.width + p.entry[0]]), queue = [p.entry];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = Y * map.width + X;
        if (!seen.has(k) && api.canMove(project, map, x, y, X, Y)) { seen.add(k); queue.push([X, Y]); }
      }
    }
    // Walkable floor the entrance cannot reach is a furnishing mistake (a sealed pocket), not decoration.
    const floorCells = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const k = y * map.width + x;
      const lo = map.lowerTiles[k], up = map.upperTiles[k], ts = tilesets[map.tilesetId];
      const walk = (t) => { const q = ts.passability[t]; return q && (q.up || q.down || q.left || q.right); };
      if (walk(lo) && up < 0) floorCells.push(k);
    }
    const pockets = floorCells.filter((k) => !seen.has(k)).map((k) => [k % map.width, (k / map.width) | 0]);
    const blocked = p.targets.filter(([x, y]) => !seen.has(y * map.width + x));
    report.push({ id: p.id, entry: p.entry, targets: p.targets, reachable: seen.size, walkable: floorCells.length, blocked, pockets });
  }
  const bad = report.filter((r) => r.blocked.length);
  const pocketed = report.filter((r) => r.pockets.length);
  if (pocketed.length) console.warn("sealed pockets:", JSON.stringify(pocketed.map((r) => ({ id: r.id, pockets: r.pockets }))));
  if (bad.length) console.error("unreachable:", JSON.stringify(bad.map((r) => ({ id: r.id, blocked: r.blocked }))));
  fs.mkdirSync(OUT, { recursive: true });
  const plans = places.map(({ map: _m, ...spec }) => spec);
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  console.log({ maps: Object.keys(maps).length, grafts: graftOf.size, rules: rules.length, reach: report.map((r) => `${r.id}:${r.reachable}/${r.walkable}`) });
  assert((!bad.length && !pocketed.length && !rules.length) || process.env.INTERIORS_LENIENT, "unreachable targets, sealed floor or placement rule broken");
});
