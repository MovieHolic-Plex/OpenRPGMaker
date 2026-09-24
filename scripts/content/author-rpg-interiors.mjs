// Author the RPG interiors (inn, church, homes, guild, magic trades, library, classroom, castle rooms, ship below decks,
// arena, casino, auction) from existing grammars only — terrain and furnishing, no doors/NPCs/shops/dialogue:
//  - walls/ceiling: the house grammar of interiorRoomPipeline (plan → floor → walls; rooms + innerDoors for partitions),
//    furnished with named Tibo kits on tibo_interior_expanded (its first 480 tiles are the EasyRPG interior chipset);
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

  // ── map primitives (same as author-rpg-places) ──
  const idx = (m, x, y) => y * m.width + x;
  const get = (m, x, y, layer = "lowerTiles") => m[layer][idx(m, x, y)];
  const put = (m, x, y, t, layer = "upperTiles") => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m[layer][idx(m, x, y)] = t; };
  let placed = [];
  const block = (m, x, y, rows, layer = "upperTiles") => {
    placed.push({ kind: "tiles", layer: layer.replace("Tiles", ""), x, y, w: rows[0].length, h: rows.length, rows });
    rows.forEach((r, dy) => r.forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, t, layer); }));
  };
  const one = (m, x, y, t, layer = "upperTiles") => block(m, x, y, [[t]], layer);
  let tileMap = (t) => t; // ship maps re-point Tibo kit tiles to grafted ids
  const stamp = (m, id, x, y) => {
    const k = kits.get(id); assert(k, id);
    placed.push({ kind: "tibo-kit", kitId: id, name: k.name, x, y, w: k.width, h: k.height });
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
  // Rugs are separate islands: each is shaped on its own so two rugs never merge into one.
  const rug = (name) => (m, x0, y0, x1, y1) => {
    const g = group(TIBO, name);
    placed.push({ kind: "rug", group: g.id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    fill(m, x0, y0, x1, y1, g.variantMap["255"]);
    const mem = new Set(g.memberTileIds), saved = [];
    for (let i = 0; i < m.lowerTiles.length; i++) {
      const x = i % m.width, y = (i / m.width) | 0;
      if (mem.has(m.lowerTiles[i]) && (x < x0 || y < y0 || x > x1 || y > y1)) { saved.push([i, m.lowerTiles[i]]); m.lowerTiles[i] = -2; }
    }
    autotile(m, g);
    for (const [i, t] of saved) m.lowerTiles[i] = t;
  };
  const redRug = rug("red-carpet"), tealRug = rug("teal-carpet");
  const CEIL = group(INT, "ceiling"), CEIL_TILES = [...new Set(Object.values(CEIL.variantMap))];
  const reshapeCeiling = (m) => autotile(m, CEIL, CEIL_TILES);

  // ── interior shells: the pipeline's own plan/floor/walls, furniture left to the plans below ──
  const shell = (w, h, spec) => {
    const plan = { mapId: "shell", name: "shell", width: w, height: h, wings: spec.wings ?? [], ...(spec.rooms ? { rooms: spec.rooms } : {}),
      ...(spec.innerDoors ? { innerDoors: spec.innerDoors } : {}), door: spec.door, theme: "storage", seed: 1, ...(spec.wall ? { wallMaterial: spec.wall } : {}) };
    let map = api.createEmptyRoomMap(plan);
    for (const layer of ["plan", "floor", "walls"]) {
      const r = api.applyInteriorRoomLayer(map, plan, layer);
      assert(r.ok, `${layer}: ${r.warnings.join(";")}`);
      map = r.map;
    }
    api.retintHouseWallFace(map, spec.wall);
    return { width: w, height: h, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
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
  // Up-stairs cut into the north wall (wizard tower precedent): 111 over 141 over 171 on the lower layer.
  const stairsUp = (m, x, floorY) => block(m, x, floorY - 2, [[111], [141], [171]], "lowerTiles");
  const stairsDown = (m, x, y) => one(m, x, y, 474);

  // ── ship sheet: same shell, re-pointed faces; Tibo cargo grafted after 480 ──
  const SHIP_FACE = { 74: 104, 75: 105, 76: 106, 104: 134, 105: 135, 106: 136 };
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
  // Ladder up to the deck: the sheet's own wooden ladder 22|23 in the two wall-face rows.
  const shipLadder = (m, x, floorY) => block(m, x, floorY - 2, [[22, 23], [22, 23]], "lowerTiles");

  // Deterministic scatter for the abandoned house.
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

  const places = [];
  const add = (id, name, tilesetId, m, spec) => { places.push({ id, name, tilesetId, map: m, ...spec, placements: placed }); placed = []; };
  const T = "tibo_interior_expanded";

  // ═════════ 여관 ═════════
  // 1층 — 주점과 접수대. 왼쪽 뒤 바, 가운데 벽난로, 오른쪽 뒤 접수대와 2층 계단.
  let m = shell(22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 11, y: 12 } });
  stamp(m, "tibo-fantasy-ale-rack", 2, 4); stamp(m, "tibo-library-133", 5, 4); stamp(m, "tibo-library-134", 6, 4);
  stamp(m, "tibo-fantasy-bar-counter", 3, 7); stamp(m, "tibo-library-029", 3, 9); stamp(m, "tibo-library-029", 5, 9);
  stamp(m, "tibo-library-144", 8, 3); stamp(m, "tibo-library-034", 8, 4);
  stamp(m, "tibo-medieval-stone-fireplace", 10, 4);
  stamp(m, "tibo-library-138", 14, 3);
  stamp(m, "tibo-fantasy-dining-set", 8, 8); stamp(m, "tibo-fantasy-dining-set", 13, 8);
  stamp(m, "tibo-fantasy-hanging-pot", 2, 11);
  stamp(m, "tibo-library-025", 6, 10); stamp(m, "tibo-library-030", 5, 11); stamp(m, "tibo-library-030", 7, 11);
  one(m, 18, 3, 57); stamp(m, "tibo-v8-1-0", 16, 3); stamp(m, "tibo-library-125", 16, 6); stamp(m, "tibo-library-079", 17, 5);
  stairsUp(m, 19, 5);
  stamp(m, "tibo-library-209", 18, 11); stamp(m, "tibo-library-229", 17, 11);
  stamp(m, "tibo-library-025", 17, 8); stamp(m, "tibo-library-030", 16, 9); stamp(m, "tibo-library-030", 18, 9);
  redRug(m, 9, 7, 13, 7); redRug(m, 9, 11, 14, 11);
  for (const x of [7, 13]) one(m, x, 3, 24);
  add("interior-inn-tavern-1f", "여관 1층 · 주점과 접수대", T, m, {
    group: "inn-homes", entry: [11, 13], keeper: [4, 6], targets: [[4, 6], [9, 7], [16, 5], [19, 5]],
    use: "여관 주인이 운영하는 1층. 손님은 문으로 들어와 오른쪽 접수대에서 방을 잡고, 바에서 술을 받아 긴 식탁에서 먹는다. 계단으로 2층 객실에 오른다",
    note: "크림 벽 18×8칸 홀. 왼쪽 뒤 술통 선반·맥주통·포도주 선반, 그 앞 바 카운터와 높은 걸상 둘(주인 자리 (4,6)), 벽에 술집 간판·메뉴 칠판, 가운데 뒤 장작 벽난로, 벽 다트판, 긴 식탁과 벤치 두 벌, 앞 왼쪽 솥 걸이와 원형 식탁. 오른쪽 뒤 여관 간판 57·열쇠판·접수 계산대·편지 쟁반, 벽에 뚫은 오르막 계단 111/141/171(x=19). 빈 바닥을 끊는 붉은 러그 둘(벽난로 앞, 식탁 앞 통로), 오른쪽 원형 식탁과 걸상 둘",
  });
  // 2층 — 객실 셋(1인실·2인실·특실)과 복도. 문 없이 계단으로만 오간다.
  m = shell(23, 16, {
    rooms: [{ id: "single", x: 3, y: 4, w: 5, h: 4 }, { id: "twin", x: 9, y: 4, w: 5, h: 4 }, { id: "suite", x: 15, y: 4, w: 6, h: 4 }, { id: "hall", x: 3, y: 11, w: 18, h: 3 }],
    innerDoors: [{ x: 5, y: 8 }, { x: 11, y: 8 }, { x: 17, y: 8 }], door: { x: 12, y: 13 },
  });
  closeDoor(m, 12, 14);
  block(m, 3, 4, [[324], [354]]);
  stamp(m, "tibo-library-039", 4, 4); stamp(m, "tibo-library-050", 7, 3); one(m, 5, 2, 54); stamp(m, "tibo-v7-1-2", 7, 6); stamp(m, "tibo-library-045", 3, 7);
  block(m, 9, 4, [[324], [354]]); block(m, 12, 4, [[324], [354]]); stamp(m, "tibo-library-039", 10, 4); one(m, 11, 2, 54);
  stamp(m, "tibo-v3-1-1", 13, 3); stamp(m, "tibo-library-045", 9, 7);
  stamp(m, "tibo-fantasy-bed", 15, 3); stamp(m, "tibo-library-039", 18, 4); stamp(m, "tibo-library-040", 19, 4);
  stamp(m, "tibo-warm-bench", 19, 6); one(m, 18, 2, 56); redRug(m, 15, 6, 16, 7);
  stairsDown(m, 3, 12); redRug(m, 5, 12, 18, 12); stamp(m, "tibo-library-027", 16, 11);
  tealRug(m, 4, 6, 6, 6); tealRug(m, 10, 6, 11, 7); stamp(m, "tibo-v7-1-2", 13, 7);
  stamp(m, "tibo-library-059", 7, 10); stamp(m, "tibo-library-037", 8, 11); one(m, 14, 9, 84); one(m, 20, 11, 288);
  one(m, 9, 9, 206); one(m, 15, 9, 206); stamp(m, "tibo-library-061", 20, 12); stamp(m, "tibo-library-215", 13, 11);
  add("interior-inn-rooms-2f", "여관 2층 · 객실", T, m, {
    group: "inn-homes", entry: [3, 12], targets: [[5, 6], [11, 6], [17, 7], [19, 12]],
    use: "여관 손님이 묵는 2층. 1층 계단을 오르면 복도 왼쪽 끝으로 나오고, 복도에서 1인실·2인실·특실로 들어간다",
    note: "방 넷(1인실 5×4·2인실 5×4·특실 6×4·복도 18×3)을 파이프라인 칸막이로 나눴다. 1인실 침대 324/354·협탁·대야 받침·의자·궤짝, 2인실 침대 둘·협탁·서랍장, 특실 목제 침대 3×3·협탁·화장대·쿠션 의자·붉은 러그·커튼 창 56, 복도에 린넨 장·이불 더미·그림·랜턴·빗자루·화분. 내려가는 계단 474는 복도 왼쪽 끝 (3,12). 1인실·2인실에 청록 러그, 2인실 의자, 복도에 붉은 러너와 짧은 벤치",
  });

  // ═════════ 교회 ═════════
  m = shell(19, 18, { wings: [{ x: 2, y: 5, w: 15, h: 11 }], door: { x: 9, y: 15 }, wall: "stone-brick" });
  floorTo(m, 42);
  fill(m, 4, 5, 14, 7, 163); placed.push({ kind: "floor", tile: 163, x: 4, y: 5, w: 11, h: 3 });
  redRug(m, 8, 8, 10, 15);
  stamp(m, "tibo-fantasy-altar", 8, 5); block(m, 9, 3, [[88], [118]]);
  for (const x of [3, 5, 13, 15]) one(m, x, 3, 144);
  stamp(m, "tibo-v4-5-2", 6, 4); stamp(m, "tibo-v4-5-2", 12, 4); stamp(m, "tibo-lectern", 12, 6); stamp(m, "tibo-v9-1-3", 6, 6);
  stamp(m, "tibo-library-169", 15, 4); stamp(m, "tibo-library-168", 3, 5);
  for (const y of [9, 11, 13]) { stamp(m, "tibo-fantasy-pew", 4, y); stamp(m, "tibo-fantasy-pew", 11, y); }
  for (const y of [9, 13]) { block(m, 2, y - 1, [[89], [119]]); block(m, 16, y - 1, [[89], [119]]); }
  for (const y of [11, 15]) { one(m, 2, y, 204); one(m, 16, y, 204); }
  redRug(m, 5, 7, 13, 7); one(m, 4, 6, 288); one(m, 14, 6, 288);
  stamp(m, "tibo-library-238", 7, 15); one(m, 11, 15, 204);
  add("interior-church-nave", "교회 · 예배당", T, m, {
    group: "civic", entry: [9, 16], keeper: [9, 7], targets: [[9, 7], [3, 9], [15, 14]],
    use: "사제가 예배를 올리고 마을 사람이 앉아 기도하는 곳. 교구마을 「교회 언덕」의 석벽 교회(스테인드글라스 두 장, 가운데 문)와 짝을 이룬다",
    note: "석벽·회색 돌바닥 42. 앞쪽(북쪽) 제단부를 아이보리 대리석 오토타일로 깔고 제단 3×2 뒤 벽에 성녀 석상 88/118, 벽에 스테인드글라스 144 넷, 양옆 촛대 탁자·향로·독서대(설교대)·작은 오르간(업라이트 피아노)·의식 초. 문에서 제단까지 폭3 붉은 카펫, 좌우로 긴 의자 4×2 세 줄씩, 옆 통로에 기둥 89/119, 문 옆 헌금함(자물쇠 금고함)과 촛대. 제단부 앞 한 줄 붉은 카펫(무릎 꿇는 자리)과 화분 둘, 옆 통로 기둥 사이 촛대 넷",
  });

  // ═════════ 민가 ═════════
  // 한 칸 집 — 농부 부부 한 칸 살림: 침대·화덕·식탁·찬장·물레.
  m = shell(15, 13, { wings: [{ x: 2, y: 5, w: 11, h: 5 }], door: { x: 7, y: 9 } });
  block(m, 2, 5, [[324], [354]]); stamp(m, "tibo-library-039", 3, 5); one(m, 4, 3, 54);
  stamp(m, "tibo-medieval-stone-fireplace", 6, 4); stamp(m, "tibo-library-235", 9, 5);
  stamp(m, "tibo-fantasy-cupboard", 10, 4); stamp(m, "tibo-library-229", 12, 4);
  block(m, 4, 7, [[108, 109, 110], [138, 139, 140], [168, 169, 170]], "lowerTiles");
  stamp(m, "tibo-library-026", 5, 7); stamp(m, "tibo-v7-1-2", 4, 8); one(m, 6, 8, 298);
  stamp(m, "tibo-v11-1-2", 10, 8); stamp(m, "tibo-library-015", 12, 9); stamp(m, "tibo-library-061", 2, 8);
  stamp(m, "tibo-v6-1-1", 9, 9);
  add("interior-home-one-room", "민가 · 한 칸 집", T, m, {
    group: "inn-homes", entry: [7, 10], targets: [[3, 6], [5, 9], [9, 7]],
    use: "농부 부부가 사는 한 칸짜리 집. 한 방에서 자고(왼쪽), 불 때 밥하고(가운데 벽난로), 먹고(짚 돗자리 위 식탁), 실을 잣는다(오른쪽 물레)",
    note: "크림 벽 11×5칸. 왼쪽 침대 324/354·협탁·창 54, 가운데 장작 벽난로와 장작 옆 항아리, 오른쪽 찬장 2×3·뚜껑 통, 짚 돗자리 108~170 위 정사각 식탁과 의자 둘, 앞쪽 물레·감자 바구니·물 양동이·기댄 빗자루",
  });
  // 2층 집 1층 — 부엌과 거실, 계단.
  m = shell(17, 13, { wings: [{ x: 2, y: 5, w: 13, h: 5 }], door: { x: 8, y: 9 } });
  stamp(m, "tibo-bread-oven", 2, 4); stamp(m, "tibo-fantasy-hanging-pot", 4, 4); stamp(m, "tibo-library-011", 3, 3);
  stamp(m, "tibo-fantasy-prep-table", 2, 7); stamp(m, "tibo-library-013", 2, 9); stamp(m, "tibo-library-018", 3, 9);
  stamp(m, "tibo-library-026", 7, 6); stamp(m, "tibo-v7-1-2", 6, 7); one(m, 8, 7, 298); block(m, 7, 4, [[389], [419]]);
  stamp(m, "tibo-medieval-stone-fireplace", 9, 4); stamp(m, "tibo-fantasy-bookcase", 12, 4);
  tealRug(m, 10, 7, 12, 8); stamp(m, "tibo-warm-bench", 10, 7);
  stairsUp(m, 14, 5); stamp(m, "tibo-coat-rack", 13, 8); stamp(m, "tibo-boot-rack", 6, 9);
  add("interior-home-two-story-1f", "민가 · 2층 집 1층", T, m, {
    group: "inn-homes", entry: [8, 10], targets: [[7, 8], [14, 5], [11, 9]],
    use: "네 식구가 사는 2층 집의 아래층. 왼쪽이 부엌(화덕·솥·조리대), 가운데 식탁, 오른쪽 거실(벽난로·책장·쿠션 의자), 오른쪽 뒤 계단으로 2층 침실에 오른다",
    note: "크림 벽 13×5칸. 부엌에 작은 빵 화덕·솥 걸이·향신료 선반·조리대·밀가루 포대·당근 상자, 식탁 1×2와 의자 둘·괘종시계 389, 거실에 장작 벽난로·두꺼운 책장·청록 러그 위 쿠션 긴 의자, 문 옆 옷걸이·신발 받침대, 벽 계단 111/141/171(x=14)",
  });
  // 2층 집 2층 — 부모 방·계단참·아이 방.
  m = shell(19, 13, {
    rooms: [{ id: "parents", x: 2, y: 5, w: 6, h: 5 }, { id: "landing", x: 9, y: 5, w: 3, h: 5 }, { id: "child", x: 13, y: 5, w: 4, h: 5 }],
    innerDoors: [{ x: 8, y: 8 }, { x: 12, y: 8 }], door: { x: 10, y: 9 },
  });
  closeDoor(m, 10, 10);
  stamp(m, "tibo-fantasy-bed", 2, 4); stamp(m, "tibo-library-039", 5, 5); stamp(m, "tibo-fantasy-wardrobe", 6, 4);
  stamp(m, "tibo-library-040", 2, 9); stamp(m, "tibo-library-041", 7, 8); stamp(m, "tibo-library-045", 4, 9); one(m, 5, 3, 54);
  stairsDown(m, 10, 9); stamp(m, "tibo-library-059", 9, 4); one(m, 11, 5, 288); one(m, 10, 3, 84);
  block(m, 13, 5, [[324], [354]]); stamp(m, "tibo-library-181", 16, 9); stamp(m, "tibo-library-186", 13, 9); stamp(m, "tibo-library-183", 16, 4);
  stamp(m, "tibo-v4-4-2", 15, 5); one(m, 15, 6, 268); stamp(m, "tibo-library-184", 15, 9); one(m, 14, 3, 54);
  add("interior-home-two-story-2f", "민가 · 2층 집 2층", T, m, {
    group: "inn-homes", entry: [10, 9], targets: [[4, 7], [14, 8]],
    use: "2층 집의 위층 침실. 계단을 오르면 가운데 계단참, 왼쪽이 부부 방(큰 침대·옷장·화장대), 오른쪽이 아이 방(작은 침대·책상·장난감)",
    note: "방 셋(부부 6×5·계단참 3×5·아이 4×5)을 칸막이로 나누고 칸막이 가운데 줄을 틔웠다. 부부 방 목제 침대 3×3·협탁·옷장 2×3·화장대·전신 거울·궤짝, 계단참 린넨 장·화분·그림과 내려가는 계단 474, 아이 방 침대 324/354·독서 탁자와 의자·목마·장난감 상자·헝겊 인형·곰 인형",
  });
  // 촌장집 — 서재·응접실·침실.
  m = shell(27, 15, {
    rooms: [{ id: "study", x: 2, y: 5, w: 6, h: 7 }, { id: "hall", x: 9, y: 5, w: 9, h: 7 }, { id: "bed", x: 19, y: 5, w: 6, h: 7 }],
    innerDoors: [{ x: 8, y: 9 }, { x: 18, y: 9 }], door: { x: 13, y: 11 },
  });
  stamp(m, "tibo-library-078", 2, 4); stamp(m, "tibo-v12-1-2", 3, 4); stamp(m, "tibo-v3-1-0", 5, 4);
  stamp(m, "tibo-medieval-scribe-desk", 3, 8); stamp(m, "tibo-library-238", 7, 11); stamp(m, "tibo-library-073", 2, 11);
  stamp(m, "tibo-medieval-stone-fireplace", 9, 4); stamp(m, "tibo-v6-2-0", 13, 3); stamp(m, "tibo-library-223", 15, 3);
  stamp(m, "tibo-medieval-banquet-table", 12, 7); for (const x of [13, 14]) { one(m, x, 6, 267); one(m, x, 9, 268); } one(m, 11, 8, 297); one(m, 16, 8, 298);
  redRug(m, 12, 10, 14, 11); stamp(m, "tibo-library-209", 16, 10); stamp(m, "tibo-library-215", 9, 11); stamp(m, "tibo-warm-crockery", 16, 4);
  stamp(m, "tibo-fantasy-bed", 19, 4); stamp(m, "tibo-library-039", 22, 5); stamp(m, "tibo-fantasy-wardrobe", 23, 4);
  stamp(m, "tibo-fantasy-washstand", 22, 9); stamp(m, "tibo-library-045", 19, 11); one(m, 20, 3, 54);
  add("interior-home-chief", "민가 · 촌장집", T, m, {
    group: "inn-homes", entry: [13, 12], keeper: [4, 7], targets: [[4, 7], [13, 10], [21, 8]],
    use: "마을 촌장이 사는 집. 가운데 응접실에서 마을 사람을 맞고 회의를 하며(긴 식탁·마을 지도), 왼쪽 서재에서 장부를 보고, 오른쪽이 촌장 부부의 침실",
    note: "방 셋(서재 6×7·응접실 9×7·침실 6×7)을 칸막이로 나누고 칸막이 가운데 줄을 틔웠다. 서재에 문서 분류장·지구본·책장 수납장 3×3·필경사 책상 3×2와 의자·금고함·책 더미, 응접실에 장작 벽난로·강 지도 액자·사슴뿔 벽판·연회용 긴 식탁 4×2와 의자·식기장·붉은 러그·야자 화분, 침실에 목제 침대·협탁·옷장·세면대·궤짝",
  });
  // 폐가 — 한 칸 집과 같은 껍데기, 바닥 구멍·새싹·잔해·벽 균열. 벽은 뚫지 않는다.
  m = shell(15, 13, { wings: [{ x: 2, y: 5, w: 11, h: 5 }], door: { x: 7, y: 9 } });
  for (let y = 5; y <= 9; y++) for (let x = 2; x <= 12; x++) {
    if (x === 7 || (y === 9 && Math.abs(x - 7) <= 1)) continue; // 문에서 들어오는 길은 멀쩡한 바닥
    const r = rnd();
    put(m, x, y, r < 0.12 ? 73 : r < 0.24 ? 102 : r < 0.3 ? 222 : r < 0.34 ? 223 : 72, "lowerTiles");
  }
  block(m, 2, 5, [[324], [354]]); one(m, 4, 5, 386); one(m, 4, 6, 387); one(m, 10, 7, 417); one(m, 3, 3, 388); one(m, 3, 4, 418); one(m, 10, 3, 388); one(m, 10, 4, 418);
  stamp(m, "tibo-fantasy-cupboard", 6, 4); one(m, 8, 5, 387); one(m, 9, 5, 416); one(m, 12, 5, 415); one(m, 11, 8, 414);
  stamp(m, "tibo-library-237", 11, 4); stamp(m, "tibo-library-214", 12, 7); stamp(m, "tibo-v6-2-3", 3, 9); stamp(m, "tibo-library-071", 9, 9);
  one(m, 12, 9, 55); stamp(m, "tibo-library-230", 4, 8);
  add("interior-home-abandoned", "민가 · 폐가", T, m, {
    group: "inn-homes", entry: [7, 10], targets: [[7, 7], [3, 7], [11, 6]],
    use: "오래 비어 있던 집. 한 칸 집과 같은 틀에 가구는 부서지고 바닥은 썩었다 — 조사·귀신 이야기·숨은 물건 자리",
    note: "한 칸 집 껍데기를 그대로 두고 벽 조립은 건드리지 않았다(폐성과 같은 규칙). 바닥 72에 구멍 73·널 102·새싹 222/223을 흩되 문에서 안쪽 찬장까지 길은 멀쩡하게, 벽에 균열 388/418 둘, 낡은 침대·먼지 앉은 찬장(불 꺼진 집이라 벽난로는 두지 않음), 세운 판자 386·판자 더미 387, 부서진 벽돌 416·바위 더미 415·광석 414, 빈 벽장·말린 꽃병·꺼진 등불·재 양동이·나무 궤짝·빈 상자",
  });

  // ═════════ 모험가 길드 ═════════
  m = shell(22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 11, y: 12 } });
  stamp(m, "tibo-fantasy-ale-rack", 2, 4); stamp(m, "tibo-library-133", 5, 4);
  stamp(m, "tibo-v6-1-0", 7, 3); stamp(m, "tibo-v6-1-0", 9, 3); stamp(m, "tibo-v6-2-0", 11, 4); stamp(m, "tibo-library-223", 12, 3);
  block(m, 14, 7, [[325, 326, 326, 326, 327]]); stamp(m, "tibo-library-078", 14, 4); stamp(m, "tibo-library-078", 15, 4);
  stamp(m, "tibo-v8-1-0", 16, 3); stamp(m, "tibo-library-238", 18, 5); stamp(m, "tibo-library-079", 17, 5); stamp(m, "tibo-library-221", 19, 3);
  stamp(m, "tibo-fantasy-dining-set", 3, 8); stamp(m, "tibo-fantasy-dining-set", 7, 8);
  stamp(m, "tibo-fantasy-weapon-rack", 18, 10); stamp(m, "tibo-library-194", 2, 12); stamp(m, "tibo-library-196", 3, 12); stamp(m, "tibo-library-198", 16, 11);
  tealRug(m, 10, 8, 11, 12); stamp(m, "tibo-library-025", 14, 10); stamp(m, "tibo-library-030", 13, 11); stamp(m, "tibo-library-030", 15, 11);
  redRug(m, 3, 11, 9, 11); stamp(m, "tibo-library-133", 6, 4); stamp(m, "tibo-lectern", 12, 5); stamp(m, "tibo-library-209", 16, 9); stamp(m, "tibo-boot-rack", 7, 12); stamp(m, "tibo-library-230", 4, 12); stamp(m, "tibo-library-199", 5, 12);
  for (const x of [6, 13]) one(m, x, 3, 24);
  add("interior-adventurers-guild", "모험가 길드", T, m, {
    group: "civic", entry: [11, 13], keeper: [16, 6], targets: [[16, 8], [8, 5], [10, 7]],
    use: "모험가가 의뢰를 받고 보고하는 곳. 뒷벽 게시판에서 의뢰서를 고르고, 오른쪽 접수 카운터에서 접수원에게 등록·보상 수령, 왼쪽 식탁에서 동료를 모은다",
    note: "크림 벽 18×8칸. 뒷벽에 메모 게시판 둘(의뢰판)·강 지도 액자·사슴뿔 벽판·방패 벽 장식·횃불과 의뢰 장부 독서대, 오른쪽 접수 카운터 325·326·327과 뒤편 문서 분류장 둘·열쇠판·편지 쟁반·금고함(접수원 자리 (16,6)), 왼쪽 뒤 술통 선반·맥주통, 긴 식탁과 벤치 두 벌, 문 앞 청록 러그, 앞 모서리 무기 거치대·배낭·밧줄·지도통. 앞쪽 붉은 러그·정사각 상자·물주머니·신발 받침대, 오른쪽 원형 식탁과 걸상·야자 화분, 맥주통 둘",
  });

  // ═════════ 마법 상점 · 연금술 공방 ═════════
  m = shell(16, 13, { wings: [{ x: 2, y: 5, w: 12, h: 5 }], door: { x: 8, y: 9 } });
  stamp(m, "tibo-v4-2-0", 2, 4); stamp(m, "tibo-v4-2-2", 5, 4); stamp(m, "tibo-library-163", 7, 3); stamp(m, "tibo-library-159", 9, 4);
  stamp(m, "tibo-library-167", 10, 5); stamp(m, "tibo-fantasy-crystal-stand", 12, 4); stamp(m, "tibo-library-164", 10, 3);
  block(m, 6, 7, [[325, 326, 326, 327]]); one(m, 11, 7, 329); stamp(m, "tibo-library-129", 4, 7);
  stamp(m, "tibo-library-158", 2, 9); stamp(m, "tibo-library-165", 12, 9); stamp(m, "tibo-library-160", 10, 9);
  tealRug(m, 7, 8, 9, 9);
  add("interior-magic-shop", "마법 상점", T, m, {
    group: "civic", entry: [8, 10], keeper: [7, 6], targets: [[7, 8], [7, 6], [11, 8]],
    use: "마법 도구를 파는 가게. 손님은 청록 러그를 따라 카운터로 가고, 상인은 카운터 뒤에서 물약·두루마리·마법봉을 꺼내 준다. 오른쪽 점술대에서 점을 봐 준다",
    note: "크림 벽 12×5칸(무기점과 같은 가게 틀). 뒷벽에 물약 진열장 3×3·두루마리 수납장·달 위상 벽판·별자리 판·마법봉 걸이·부적 진열대·수정구 받침, 카운터 325·326·327(상인 자리 (7,6)) 옆 가격 표지판과 점술대 329, 앞쪽에 펼친 룬 서적·수정 표본 쟁반·봉인 주문 두루마리",
  });
  m = shell(18, 14, { wings: [{ x: 2, y: 5, w: 14, h: 6 }], door: { x: 9, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  stamp(m, "tibo-medieval-herbal-cabinet", 2, 4); stamp(m, "tibo-fantasy-alchemy-desk", 6, 4); stamp(m, "tibo-library-147", 10, 4);
  stamp(m, "tibo-library-151", 11, 4); stamp(m, "tibo-library-145", 12, 4); stamp(m, "tibo-library-104", 14, 4);
  stamp(m, "tibo-library-166", 13, 7); stamp(m, "tibo-brazier", 14, 7); stamp(m, "tibo-library-098", 15, 7);
  stamp(m, "tibo-library-146", 5, 8); stamp(m, "tibo-library-003", 7, 8); stamp(m, "tibo-v7-3-2", 6, 9);
  stamp(m, "tibo-library-150", 2, 10); stamp(m, "tibo-library-155", 4, 10); stamp(m, "tibo-library-153", 2, 8); stamp(m, "tibo-v4-4-1", 3, 8);
  stamp(m, "tibo-fantasy-bookcase", 9, 4); stamp(m, "tibo-library-076", 11, 8); stamp(m, "tibo-library-158", 11, 9);
  stamp(m, "tibo-library-234", 15, 9);
  add("interior-alchemy-workshop", "연금술 공방", T, m, {
    group: "civic", entry: [9, 11], keeper: [7, 6], targets: [[7, 6], [12, 7], [6, 10]],
    use: "연금술사가 약을 달이고 재료를 갈무리하는 작업실. 벽 쪽이 재료·도구, 오른쪽이 불(작은 화덕·가마솥·화로), 가운데 도마에서 재료를 썰고 빻는다",
    note: "석벽·돌바닥 42, 14×6칸. 뒷벽에 약초 건조장 3×3·연금술 작업대 3×2·두꺼운 책장·증류 유리병 받침·뿌리 표본병·약재 서랍장·작은 대장간 화덕(가마 불), 오른쪽 물약 가마솥·화로·석탄 통, 가운데 약초 도마·절구와 공이·의자, 왼쪽 앞 약초차 통·약초 단지·말린 버섯 쟁반·환약 단지, 잉크와 깃펜·펼친 룬 서적(처방 기록), 저장 옹기",
  });

  // ═════════ 도서관 · 마법 학원 교실 ═════════
  m = shell(22, 16, { wings: [{ x: 2, y: 5, w: 18, h: 9 }], door: { x: 11, y: 13 } });
  floorTo(m, 102);
  const CASE = [[18, 19, 20], [48, 49, 50], [78, 79, 80]];
  for (const x of [2, 5, 14, 17]) block(m, x, 4, CASE, "lowerTiles");
  stamp(m, "tibo-lectern", 9, 5); stamp(m, "tibo-library-074", 11, 4); stamp(m, "tibo-v12-1-2", 13, 4);
  for (const x of [3, 4, 5, 6, 15, 16, 17, 18]) block(m, x, 8, [[147], [177]]);
  for (const x of [3, 4, 5, 6, 17, 18]) block(m, x, 11, [[147], [177]]);
  block(m, 9, 9, [[325, 326, 327]]); one(m, 9, 8, 267); one(m, 11, 8, 267);
  block(m, 9, 11, [[325, 326, 327]]); one(m, 9, 12, 268); one(m, 11, 12, 268);
  tealRug(m, 8, 7, 12, 13); stamp(m, "tibo-library-083", 12, 8); one(m, 2, 7, 288); one(m, 19, 7, 288); stamp(m, "tibo-library-240", 7, 8); stamp(m, "tibo-library-073", 7, 12); stamp(m, "tibo-library-073", 12, 12);
  stamp(m, "tibo-warm-scribe-desk", 14, 11); stamp(m, "tibo-library-079", 16, 12); 
  add("interior-library", "도서관", T, m, {
    group: "civic", entry: [11, 14], keeper: [14, 10], targets: [[10, 6], [8, 10], [14, 10], [19, 12], [2, 10]],
    use: "책을 빌려 읽는 도서관. 문에서 곧장 가운데 열람 탁자로, 양옆 서가 두 줄 사이 통로로 책을 찾고, 문 오른쪽 사서 책상에서 대출을 받는다",
    note: "크림 벽·널 바닥 102, 18×9칸. 뒷벽에 큰 책장 18~80(3×3, 아래층) 넷과 독서대·펼친 지도책 받침·지구본, 양옆에 1×2 서가 147/177를 줄지어 세운 두 줄(y=8, 11)로 통로를 만들고, 가운데 긴 열람 탁자 325·326·327 둘(위 탁자는 탁자를 보는 의자 267, 아래 탁자는 등을 보인 의자 268, 두 탁자 사이 한 줄은 통로)·독서등, 서가 옆 접이 사다리·책 더미·발판, 오른쪽 앞 서가 두 칸을 비운 자리에 사서의 필경사 책상과 편지 쟁반(사서 자리 (14,10)). 열람 구역 전체에 청록 러그, 양쪽 서가 끝 화분",
  });
  m = shell(20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 8 }], door: { x: 10, y: 12 }, wall: "stone-brick" });
  floorTo(m, 102);
  stamp(m, "tibo-library-164", 7, 3); stamp(m, "tibo-library-163", 11, 3); stamp(m, "tibo-library-034", 12, 4); stamp(m, "tibo-library-034", 6, 4);
  stamp(m, "tibo-lectern", 9, 4); stamp(m, "tibo-warm-scribe-desk", 13, 5); stamp(m, "tibo-v11-1-0", 12, 6); one(m, 15, 5, 298);
  block(m, 8, 6, [[381, 382, 383], [411, 412, 413], [441, 442, 443]]);
  for (const y of [9, 11]) for (const x of [3, 5, 7, 12, 14, 16]) { stamp(m, "tibo-v4-4-2", x, y); one(m, x, y + 1, 268); }
  redRug(m, 9, 9, 10, 12); stamp(m, "tibo-library-165", 3, 7); stamp(m, "tibo-library-073", 17, 7); stamp(m, "tibo-fantasy-bookcase", 2, 4); stamp(m, "tibo-fantasy-crystal-stand", 17, 4); stamp(m, "tibo-v12-1-2", 16, 4); stamp(m, "tibo-library-157", 4, 5);
  add("interior-academy-classroom", "마법 학원 · 교실", T, m, {
    group: "civic", entry: [10, 13], keeper: [9, 6], targets: [[9, 6], [4, 12], [15, 12], [14, 7]],
    use: "마법 학원의 강의실. 선생은 앞(북쪽) 독서대와 칠판 앞에서 가르치고 바닥 마법진에서 시범을 보이며, 학생은 책상 열두 개에 앉아 북쪽을 본다",
    note: "석벽·널 바닥 102, 16×8칸. 앞벽에 별자리 판·달 위상 벽판·칠판(메뉴 칠판 1×2) 둘, 교탁(독서대)·교사 책상과 모래시계, 그 앞 마법진 381~443(3×3), 학생 독서 탁자와 등을 보인 의자 268 여섯 쌍×두 줄(가운데 통로 x=8~11, 모두 북쪽 교탁을 본다), 옆벽 쪽 두꺼운 책장·수정구 받침 둘·지구본. 가운데 통로 붉은 러너, 교탁 옆 수정 표본 쟁반·책 더미",
  });

  // ═════════ 성 ═════════
  m = shell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 }, wall: "gold-brick" });
  floorTo(m, 42);
  redRug(m, 5, 6, 14, 9);
  stamp(m, "tibo-medieval-banquet-table", 6, 7); stamp(m, "tibo-medieval-banquet-table", 10, 7);
  for (const x of [6, 8, 11, 13]) { one(m, x, 6, 267); one(m, x, 9, 268); }
  block(m, 5, 7, [[446], [476]]); block(m, 14, 7, [[446], [476]]);
  stamp(m, "tibo-medieval-stone-fireplace", 16, 4); stamp(m, "tibo-warm-crockery", 2, 4); stamp(m, "tibo-library-134", 2, 7);
  stamp(m, "tibo-library-218", 7, 3); stamp(m, "tibo-library-218", 12, 3); stamp(m, "tibo-library-217", 9, 3);
  block(m, 5, 3, [[142, 143], [172, 173]]); block(m, 14, 3, [[142, 143], [172, 173]]);
  stamp(m, "tibo-library-031", 18, 8); stamp(m, "tibo-library-036", 2, 10); one(m, 19, 10, 288); one(m, 4, 10, 288);
  add("interior-castle-dining", "성 · 식당", T, m, {
    group: "castle", entry: [11, 11], targets: [[10, 6], [7, 5], [15, 8], [4, 7]],
    use: "왕과 손님이 식사하는 성의 큰 식당. 붉은 카펫 위 긴 연회 식탁 양 끝에 왕·왕비의 붉은 의자, 벽난로와 식기장, 시종은 오른쪽 음식 운반대로 나른다",
    note: "금벽돌 벽·돌바닥 42, 18×6칸. 붉은 카펫 10×4 위에 연회용 긴 식탁 4×2 두 개를 이어 8칸 식탁을 만들고 위쪽은 식탁을 보는 의자 267, 아래쪽은 등을 보인 의자 268 넷씩, 양 끝 붉은 의자 446/476(왕·왕비), 뒷벽에 초상화 둘·풍경화·붉은 커튼 142/143·172/173 두 쌍, 왼쪽 식기장·포도주 선반, 오른쪽 뒤 장작 벽난로, 앞 오른쪽 음식 운반대·왼쪽 물 피처·화분 둘. 식탁 뒤 줄(y=5)도 양 끝으로 돌아 들어갈 수 있다",
  });
  m = shell(18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 9, y: 9 }, wall: "gold-brick" });
  redRug(m, 6, 7, 11, 8);
  stamp(m, "tibo-medieval-canopy-bed", 7, 4); stamp(m, "tibo-library-039", 6, 5); stamp(m, "tibo-library-039", 10, 5);
  stamp(m, "tibo-fantasy-wardrobe", 2, 4); stamp(m, "tibo-library-040", 4, 5); stamp(m, "tibo-library-041", 5, 4);
  stamp(m, "tibo-medieval-stone-fireplace", 13, 4); stamp(m, "tibo-warm-scribe-desk", 2, 8); one(m, 4, 9, 298);
  stamp(m, "tibo-warm-bench", 12, 8); stamp(m, "tibo-library-045", 15, 9); one(m, 11, 3, 56); one(m, 6, 3, 56); stamp(m, "tibo-library-219", 9, 3);
  add("interior-castle-bedchamber", "성 · 침실", T, m, {
    group: "castle", entry: [9, 10], targets: [[9, 7], [3, 7], [14, 8]],
    use: "왕족의 침실. 가운데 천개 침대 양옆에 협탁, 왼쪽이 옷장·화장대(몸단장), 오른쪽이 벽난로와 쿠션 의자(휴식), 앞 왼쪽 책상에서 편지를 쓴다",
    note: "금벽돌 벽·나무 바닥 72, 14×5칸. 천개 침대 3×3(뒷벽에 붙임) 양옆 협탁, 커튼 창 56 둘·타원 가족 초상화, 침대 앞 붉은 러그 6×2, 왼쪽 옷장 2×3·화장대, 오른쪽 장작 벽난로·쿠션 긴 의자, 앞 왼쪽 필경사 책상과 의자, 앞 오른쪽 궤짝",
  });
  m = shell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  for (const x of [2, 4, 6, 8, 14, 16, 18]) { block(m, x, 5, [[324], [354]]); stamp(m, "tibo-library-045", x, 7); }
  stamp(m, "tibo-fantasy-weapon-rack", 10, 4); stamp(m, "tibo-medieval-armor-stand", 12, 4);
  for (const x of [3, 7, 15, 19]) one(m, x, 3, 24); stamp(m, "tibo-library-221", 5, 3); stamp(m, "tibo-library-221", 17, 3);
  stamp(m, "tibo-v4-4-0", 3, 9); stamp(m, "tibo-library-028", 3, 10); stamp(m, "tibo-v4-4-0", 7, 9); stamp(m, "tibo-library-028", 7, 10);
  stamp(m, "tibo-warm-scribe-desk", 17, 9); one(m, 16, 10, 297); stamp(m, "tibo-library-111", 14, 9); stamp(m, "tibo-v6-1-1", 2, 10); stamp(m, "tibo-library-061", 13, 9);
  add("interior-castle-barracks", "성 · 병영", T, m, {
    group: "castle", entry: [11, 11], targets: [[11, 7], [3, 6], [5, 8], [19, 10]],
    use: "성 경비병이 자고 무장하는 병영. 뒷벽을 따라 침대와 발치 궤짝이 줄지어 있고, 가운데 뒤 무기·갑옷 거치대에서 무장, 앞 왼쪽 식탁에서 먹고, 앞 오른쪽이 부대장 책상과 훈련용 허수아비",
    note: "석벽·돌바닥 42, 18×6칸. 침대 324/354 일곱 개와 발치 여행용 궤짝, 가운데 뒤 무기 거치대·갑옷 거치대, 벽 횃불 넷·방패 벽 장식 둘, 침대 사이는 한 칸 통로, 궤짝 앞 줄(y=8)은 비운 복도, 앞 왼쪽 식사 탁자와 그 아래 긴 벤치 두 벌, 앞 오른쪽 필경사 책상·의자·재봉 마네킹(허수아비), 물 양동이·기댄 빗자루",
  });
  m = shell(16, 13, { wings: [{ x: 2, y: 5, w: 12, h: 5 }], door: { x: 8, y: 9 }, wall: "gold-brick" });
  floorTo(m, 42);
  redRug(m, 7, 7, 9, 9);
  stamp(m, "tibo-library-162", 7, 5); stamp(m, "tibo-fantasy-crystal-stand", 9, 4); stamp(m, "tibo-library-221", 5, 3); stamp(m, "tibo-library-221", 11, 3);
  block(m, 3, 4, [[263], [293]]); block(m, 12, 4, [[263], [293]]); one(m, 2, 4, 290); one(m, 13, 4, 262); one(m, 4, 3, 260); one(m, 10, 3, 261);
  for (const [x, y] of [[2, 7], [2, 9], [13, 7], [13, 9]]) stamp(m, "tibo-library-045", x, y);
  stamp(m, "tibo-library-100", 3, 9); stamp(m, "tibo-library-100", 11, 9); stamp(m, "tibo-library-238", 12, 7); stamp(m, "tibo-v10-1-0", 3, 7); stamp(m, "tibo-library-165", 3, 5);
  one(m, 5, 9, 321); stamp(m, "tibo-v10-1-1", 12, 5);
  block(m, 6, 8, [[87], [117]]); block(m, 10, 8, [[87], [117]]);
  add("interior-castle-treasury", "성 · 보물고", T, m, {
    group: "castle", entry: [8, 10], targets: [[8, 6], [3, 6], [12, 6]],
    use: "왕실 보물을 넣어 두는 작은 방. 문 양옆 갑옷 전시대가 지키고, 가운데 돌 제단의 수정구가 가장 귀한 보물, 양옆 벽에 전설의 무기·방패·갑옷, 바닥에 궤짝과 금속 주괴",
    note: "금벽돌 벽·돌바닥 42, 12×5칸(작다). 뒷벽 가운데 작은 돌 제단과 수정구 받침, 방패 벽 장식 둘, 검 진열대 263/293 둘, 벽에 건 갑옷 290·방패 262·검 260·망치 261, 왼쪽 여행용 궤짝 둘·봉인 상자·수정 표본 쟁반·주괴 더미·목걸이 321, 오른쪽 궤짝 둘·금고함·룬 석판·주괴 더미, 문 양옆 갑옷 전시대 87/117, 문에서 제단까지 붉은 카펫",
  });

  // ═════════ 투기장 · 카지노 · 경매장 ═════════
  m = shell(20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 10, y: 10 }, wall: "stone-brick" });
  floorTo(m, 42);
  stairsUp(m, 10, 5); one(m, 9, 3, 24); one(m, 11, 3, 24); stamp(m, "tibo-library-221", 7, 3); stamp(m, "tibo-library-221", 13, 3);
  stamp(m, "tibo-fantasy-weapon-rack", 2, 4); stamp(m, "tibo-fantasy-weapon-rack", 4, 4); stamp(m, "tibo-medieval-armor-stand", 14, 4); stamp(m, "tibo-medieval-armor-stand", 16, 4);
  for (const x of [3, 6, 13, 16]) stamp(m, "tibo-library-028", x, 8);
  stamp(m, "tibo-fantasy-water-tub", 6, 5); stamp(m, "tibo-v9-1-1", 12, 4); stamp(m, "tibo-library-149", 12, 5); stamp(m, "tibo-library-148", 11, 6);
  stamp(m, "tibo-library-054", 2, 10); stamp(m, "tibo-v6-1-1", 17, 10); stamp(m, "tibo-library-051", 15, 10);
  stamp(m, "tibo-v6-1-0", 4, 3); stamp(m, "tibo-library-202", 9, 9); stamp(m, "tibo-library-231", 6, 10);
  add("interior-arena-waiting-room", "투기장 · 대기실", T, m, {
    group: "leisure", entry: [10, 11], targets: [[10, 5], [4, 9], [15, 9]],
    use: "투사가 경기 전에 무장하고 기다리는 방. 문으로 들어와 벽의 무기·갑옷으로 채비하고, 벤치에서 순서를 기다리다 뒷벽 가운데 계단으로 경기장에 오른다. 물통과 약품함은 경기 뒤 치료용",
    note: "석벽·돌바닥 42, 16×6칸. 뒷벽 가운데 경기장으로 오르는 계단 111/141/171(x=10)과 양옆 횃불·방패 벽 장식, 왼쪽 무기 거치대 둘, 오른쪽 갑옷 거치대 둘, 물통 3×2, 약품함·붕대 바구니·약병 세 개, 벽에 대진표(메모 게시판), 긴 벤치 넷·접이식 걸상, 앞쪽 긴 공구 상자·접은 수건·물 양동이·수건 걸이",
  });
  m = shell(22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 11, y: 12 }, wall: "gold-brick" });
  floorTo(m, 42);
  tealRug(m, 7, 7, 14, 11);
  for (const [x, y] of [[8, 7], [12, 7], [8, 10], [12, 10]]) stamp(m, "tibo-library-140", x, y);
  stamp(m, "tibo-library-139", 10, 9); stamp(m, "tibo-chessboard", 14, 9); stamp(m, "tibo-chessboard", 7, 9);
  block(m, 15, 7, [[325, 326, 326, 327]]); stamp(m, "tibo-library-121", 15, 5); stamp(m, "tibo-library-122", 17, 5); stamp(m, "tibo-library-238", 18, 5);
  stamp(m, "tibo-library-134", 2, 4); stamp(m, "tibo-fantasy-ale-rack", 4, 4); stamp(m, "tibo-fantasy-bar-counter", 2, 7);
  stamp(m, "tibo-library-029", 3, 9); stamp(m, "tibo-library-029", 5, 9); stamp(m, "tibo-library-169", 13, 4);
  block(m, 10, 3, [[88], [118]]); stamp(m, "tibo-library-138", 8, 3); stamp(m, "tibo-library-217", 11, 3);
  stamp(m, "tibo-library-209", 15, 11); stamp(m, "tibo-library-209", 5, 11); block(m, 2, 11, [[89], [119]]); block(m, 19, 11, [[89], [119]]);
  add("interior-casino", "카지노", T, m, {
    group: "leisure", entry: [11, 13], keeper: [16, 6], targets: [[16, 8], [10, 8], [3, 6]],
    use: "돈을 걸고 노는 도박장. 들어오면 오른쪽 환전 창구(카운터 뒤 돈 서랍·동전 쟁반·금고)에서 칩을 바꾸고, 청록 카펫 위 카드 탁자·주사위 판에서 놀고, 왼쪽 뒤 바에서 술을 마신다",
    note: "금벽돌 벽·돌바닥 42, 18×8칸. 가운데 청록 카펫 8×5 위 카드 탁자 2×2 넷·주사위 쟁반·체스판 둘, 오른쪽 환전 카운터 325·326·327(점원 자리 (16,6))와 돈 서랍·동전 계산 쟁반·금고함, 왼쪽 뒤 포도주 선반·술통 선반 앞에 바 카운터 4×2(바텐더 줄 y=6)와 높은 걸상, 뒷벽에 여자 흉상·다트판·풍경화, 업라이트 피아노, 문 양옆 기둥 89/119와 야자 화분",
  });
  m = shell(20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 8 }], door: { x: 10, y: 12 } });
  redRug(m, 4, 5, 15, 6);
  block(m, 2, 3, [[142, 143], [172, 173], [202, 203]]); block(m, 16, 3, [[142, 143], [172, 173], [202, 203]]);
  stamp(m, "tibo-lectern", 10, 5); stamp(m, "tibo-bell", 11, 5); stamp(m, "tibo-medieval-armor-stand", 5, 4); stamp(m, "tibo-easel", 8, 5);
  redRug(m, 9, 7, 10, 12); stamp(m, "tibo-fantasy-crystal-stand", 13, 5); stamp(m, "tibo-library-214", 14, 5); one(m, 7, 3, 84); one(m, 12, 3, 85);
  for (const y of [8, 10]) { stamp(m, "tibo-fantasy-pew", 4, y); stamp(m, "tibo-fantasy-pew", 12, y); }
  stamp(m, "tibo-library-125", 15, 12); stamp(m, "tibo-library-238", 17, 12); stamp(m, "tibo-library-076", 16, 11);
  stamp(m, "tibo-library-215", 2, 12); stamp(m, "tibo-library-215", 3, 12);
  add("interior-auction-house", "경매장", T, m, {
    group: "leisure", entry: [10, 13], keeper: [10, 7], targets: [[10, 7], [3, 9], [17, 11]],
    use: "귀한 물건을 경매로 파는 홀. 앞쪽 붉은 카펫 무대에 오늘의 물건(갑옷·그림·수정구)이 놓이고 경매인은 독서대와 종 앞에서 호가를 부르며, 손님은 긴 의자에 앉아 값을 부른다. 낙찰되면 문 옆 계산대에서 치른다",
    note: "크림 벽 16×8칸. 뒷벽 양 끝 커튼 142/143·172/173·202/203, 앞쪽 붉은 카펫 무대 12×2에 갑옷 거치대·그림 이젤·수정구 받침·말린 꽃병, 벽에 그림 84·85, 경매인 독서대와 탁상 종(경매인 자리 (10,7)), 가운데 통로를 두고 긴 의자 4×2 두 줄씩, 문 옆 상점 계산대·금고함·잉크와 깃펜, 둥근 관목 화분. 무대에서 문까지 가운데 통로에 붉은 러너",
  });

  // ═════════ 배 (easyrpg_chipset_ship, 갑판 맵과 같은 시트) ═════════
  tileMap = graft;
  m = shipShell(21, 13, { rooms: [{ id: "captain", x: 2, y: 5, w: 8, h: 5 }, { id: "crew", x: 11, y: 5, w: 8, h: 5 }], innerDoors: [{ x: 10, y: 8 }], door: { x: 14, y: 9 } });
  closeDoor(m, 14, 10);
  shipLadder(m, 17, 5);
  block(m, 2, 5, [[416], [446]]); one(m, 3, 4, 384); one(m, 4, 3, 414); block(m, 6, 3, [[388, 389]]); one(m, 9, 3, 295); one(m, 3, 3, 358);
  one(m, 6, 7, 387); one(m, 5, 7, 417); one(m, 7, 7, 417); one(m, 8, 4, 148); stamp(m, "tibo-library-045", 9, 5); stamp(m, "tibo-library-201", 5, 9); one(m, 2, 9, 385);
  stamp(m, "tibo-library-198", 3, 8);
  for (const x of [11, 13, 15]) block(m, x, 5, [[416], [446]]);
  one(m, 18, 7, 385); one(m, 18, 8, 385); one(m, 16, 9, 386); one(m, 18, 9, 263); one(m, 15, 7, 387); one(m, 16, 7, 417);
  one(m, 12, 3, 119); one(m, 15, 3, 119); stamp(m, "tibo-library-045", 13, 9); stamp(m, "tibo-library-045", 12, 9);
  add("interior-ship-cabin", "배 · 선실", "easyrpg_chipset_ship", m, {
    group: "ship", entry: [17, 5], targets: [[6, 6], [9, 8], [12, 7], [16, 8]],
    use: "배의 갑판 아래 선실. 갑판에서 사다리로 내려오면 오른쪽 선원 침실(침상·짐통), 칸막이 문을 지나 왼쪽이 선장실(침대·책장·해도 그림·탁자)",
    note: "배 칩셋(푸른물결호 갑판과 같은 시트). 집 실내 껍데기에서 벽면만 둥근 창 벽 104~106/선체 판벽 134~136으로, 바닥을 목재 갑판 279로 바꿨다(천장 테두리 371·399~461·공허 430은 시트 배치가 같다). 선장실 침대 416/446·책장 384·책 선반 414·해도 그림 388/389·엇갈린 검 295·그림 358·둥근 탁자 387과 걸상 417·물약 선반 148·궤짝·나침반 상자·지도통, 선원실 침상 셋·오크통·항아리·밧줄·탁자·걸상·랜턴 119·궤짝, 벽에 사다리 22|23(x=17~18)",
  });
  m = shipShell(22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 } });
  closeDoor(m, 11, 11);
  shipLadder(m, 10, 5);
  for (const [x, y] of [[2, 5], [3, 5], [2, 6], [4, 5], [16, 5], [17, 5], [18, 5], [19, 5], [19, 6], [18, 6]]) one(m, x, y, 385);
  stamp(m, "tibo-library-232", 6, 4); stamp(m, "tibo-library-232", 7, 4); stamp(m, "tibo-library-230", 8, 5); stamp(m, "tibo-library-230", 13, 5);
  stamp(m, "tibo-fantasy-grain-sacks", 13, 8); stamp(m, "tibo-library-013", 16, 9); stamp(m, "tibo-library-014", 17, 9); stamp(m, "tibo-library-229", 14, 4);
  block(m, 2, 9, [[324, 325]]); block(m, 5, 9, [[324, 325]]); one(m, 8, 9, 263); one(m, 8, 10, 259); one(m, 2, 8, 386); one(m, 3, 8, 386);
  stamp(m, "tibo-library-123", 18, 9); one(m, 6, 6, 385); one(m, 7, 6, 385); stamp(m, "tibo-library-196", 9, 7); stamp(m, "tibo-library-232", 13, 6); one(m, 16, 7, 386); one(m, 12, 3, 202); one(m, 7, 3, 202);
  block(m, 11, 7, [[72, 73], [102, 103]], "lowerTiles");
  add("interior-ship-hold", "배 · 화물칸", "easyrpg_chipset_ship", m, {
    group: "ship", entry: [10, 5], targets: [[11, 9], [3, 7], [18, 8]],
    use: "배 밑바닥 화물칸. 갑판에서 사다리로 내려오면 양옆으로 짐이 쌓여 있다 — 왼쪽 물·술 오크통과 예비 대포, 가운데 급수 펌프, 오른쪽 식량 자루·상자·소포",
    note: "선실과 같은 배 칩셋 껍데기(18×6칸). 오크통 385 열 개를 양 끝 벽에 쌓고, Tibo 쌓인 나무 상자·정사각 상자·뚜껑 둥근 통·식재료 자루·밀가루/쌀 포대·소포 더미를 이 시트 뒤쪽 칸에 이식해 놓았다. 앞 왼쪽 예비 대포 324/325 둘·감긴 밧줄 263·닻 259·항아리 386, 가운데 급수 펌프 72/73/102/103(아래층), 벽에 환기 격자창 202, 사다리 22|23(x=10~11). 사다리 아래 오크통 둘·쌓인 상자·밧줄·항아리를 더 쌓아 가운데 빈 바닥을 끊음",
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
  assert((!bad.length && !pocketed.length) || process.env.INTERIORS_LENIENT, "unreachable targets or sealed floor");
  fs.mkdirSync(OUT, { recursive: true });
  const plans = places.map(({ map: _m, ...spec }) => spec);
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  console.log({ maps: Object.keys(maps).length, grafts: graftOf.size, reach: report.map((r) => `${r.id}:${r.reachable}/${r.walkable}`) });
});
