// Author the fantasy RPG places (shops, castle interior, demon castle, wizard tower, ruin) from existing grammars only:
//  - interiors: the house wall/ceiling grammar of interiorRoomPipeline (plan → floor → walls → entrance, no auto furniture),
//    furnished with named Tibo kits on the Tibo expanded interior sheet (its first 480 tiles are the EasyRPG interior chipset);
//  - dungeon rooms: the 「무너진 납골당」 assembly (void 430 rim autotile, 22/52 two-row wall face, floor);
//  - exteriors: 여울성 나루 houses and castle kept as authored; only signs, yards and ruin dressing change.
// Usage: node scripts/content/author-rpg-places.mjs [outDir]   (default tiledata/rpg-places)
import fs from "node:fs";
import assert from "node:assert/strict";
import { withTsModule } from "../ontology-ts-loader.mjs";

const OUT = process.argv[2] ?? "tiledata/rpg-places";
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));

await withTsModule("scripts/content/lib/rpg-places-entry.ts", "rpg-places-entry.mjs", async (api) => {
  const base = api.createBlankProject();
  const TIBO = structuredClone(base.tilesets.tibo_interior_expanded);
  const DUN = structuredClone(base.tilesets.easyrpg_chipset_dungeon);
  const INT = base.tilesets.easyrpg_chipset_interior;
  const FH = structuredClone(village.tileset);
  delete TIBO.referenceDocuments; delete DUN.referenceDocuments; delete FH.referenceDocuments;
  const kits = new Map(TIBO.structureKits.map((k) => [k.id, k]));
  const group = (ts, id) => ts.autotileGroups.find((g) => g.id.endsWith(id));

  // ── map primitives ──
  const blank = (w, h, lower = 430) => ({ width: w, height: h, lowerTiles: Array(w * h).fill(lower), upperTiles: Array(w * h).fill(-1) });
  const get = (m, x, y) => m.lowerTiles[y * m.width + x];
  const put = (m, x, y, t, layer = "upperTiles") => { if (x >= 0 && y >= 0 && x < m.width && y < m.height) m[layer][y * m.width + x] = t; };
  // Every furnishing is logged with its origin so the guide can list it as (x,y,w,h) + source.
  let placed = [];
  const block = (m, x, y, rows, layer = "upperTiles") => {
    placed.push({ kind: "tiles", layer: layer.replace("Tiles", ""), x, y, w: rows[0].length, h: rows.length, rows });
    rows.forEach((r, dy) => r.forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, t, layer); }));
  };
  const stamp = (m, id, x, y, tile = (t) => t) => {
    const k = kits.get(id); assert(k, id);
    placed.push({ kind: "tibo-kit", kitId: id, name: k.name, x, y, w: k.width, h: k.height });
    k.rows.forEach((r, dy) => {
      (r.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, tile(t)); });
      (r.lowerTiles ?? []).forEach((t, dx) => { if (t >= 0) put(m, x + dx, y + dy, tile(t), "lowerTiles"); });
    });
  };
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  // Same neighbour mask as autotileEngine (8-neighbourhood); off-map counts as connected.
  const autotile = (m, g, members = g.memberTileIds) => {
    const mem = new Set(members), con = new Set([...(g.connectTileIds ?? g.memberTileIds), ...mem]), src = [...m.lowerTiles];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!mem.has(src[y * m.width + x])) continue;
      let mask = 0;
      for (const [dx, dy, bit] of DIRS) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= m.width || Y >= m.height || con.has(src[Y * m.width + X])) mask |= bit;
      }
      const v = g.variantMap[String(mask)];
      if (v !== undefined) m.lowerTiles[y * m.width + x] = v;
    }
  };
  const fill = (m, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(m, x, y, t, "lowerTiles"); };
  const carpet = (m, ts, x0, y0, x1, y1) => { const g = group(ts, "red-carpet"); fill(m, x0, y0, x1, y1, g.variantMap["255"]); autotile(m, g); };
  const CEIL = group(INT, "ceiling"), CEIL_TILES = [...new Set(Object.values(CEIL.variantMap))];
  const reshapeCeiling = (m) => autotile(m, CEIL, CEIL_TILES);

  // ── interior shells: the pipeline's own plan/floor/walls/entrance layers, furniture left to the plan below ──
  const shell = (w, h, room, door, wallMaterial) => {
    const plan = { mapId: "shell", name: "shell", width: w, height: h, wings: [room], door, theme: "storage", seed: 1, ...(wallMaterial ? { wallMaterial } : {}) };
    let map = api.createEmptyRoomMap(plan);
    for (const layer of ["plan", "floor", "walls"]) {
      const r = api.applyInteriorRoomLayer(map, plan, layer);
      assert(r.ok, `${layer}: ${r.warnings.join(";")}`);
      map = r.map;
    }
    api.retintHouseWallFace(map, wallMaterial);
    return { width: w, height: h, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
  };
  const retintFloor = (m, from, to) => { m.lowerTiles = m.lowerTiles.map((t) => (t === from ? to : t)); };
  const closeDoor = (m, x, y) => {
    for (let yy = y; yy < m.height; yy++) put(m, x, yy, 430, "lowerTiles");
    for (let yy = y - 1; yy < m.height; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (CEIL_TILES.includes(get(m, xx, yy))) put(m, xx, yy, 430, "lowerTiles");
    reshapeCeiling(m);
  };

  // ── dungeon rooms: 「무너진 납골당」 assembly ──
  const VOID = group(DUN, "abyss-gray"), VOID_TILES = [...new Set(Object.values(VOID.variantMap))];
  const dungeon = (w, h, rects, floor = 187, voids = []) => {
    const m = blank(w, h), open = new Set();
    for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) open.add(y * w + x);
    for (const [x, y] of voids) open.delete(y * w + x);
    for (const i of open) {
      const up1 = open.has(i - w), up2 = open.has(i - 2 * w);
      m.lowerTiles[i] = !up1 ? 22 : !up2 ? 52 : floor;
    }
    autotile(m, VOID, VOID_TILES);
    return m;
  };

  // ── forest exteriors: Tibo props grafted after the village sheet ──
  const graftOf = new Map();
  const firstGraft = Math.ceil(FH.count / 30) * 30;
  const graft = (tiboTile) => {
    if (!graftOf.has(tiboTile)) {
      const id = firstGraft + graftOf.size;
      graftOf.set(tiboTile, id);
      FH.tileGrafts.push({ sourceChipset: "tex_tibo_interior_expanded", sourceTile: tiboTile, targetTile: id });
    }
    return graftOf.get(tiboTile);
  };
  const crop = (m, x0, y0, w, h) => {
    const o = { width: w, height: h, lowerTiles: [], upperTiles: [] };
    for (let y = y0; y < y0 + h; y++) {
      o.lowerTiles.push(...m.lowerTiles.slice(y * m.width + x0, y * m.width + x0 + w));
      o.upperTiles.push(...m.upperTiles.slice(y * m.width + x0, y * m.width + x0 + w));
    }
    return o;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const sample = (a, n) => { const c = [...a], out = []; while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; };

  const places = [];
  const add = (id, name, tilesetId, m, spec) => { places.push({ id, name, tilesetId, map: m, ...spec, placements: placed }); placed = []; };

  // ① 무기점
  let m = shell(16, 13, { x: 2, y: 5, w: 12, h: 5 }, { x: 8, y: 9 });
  stamp(m, "tibo-library-221", 4, 3); stamp(m, "tibo-library-222", 5, 3); stamp(m, "tibo-library-222", 9, 3); stamp(m, "tibo-library-221", 11, 3);
  stamp(m, "tibo-fantasy-weapon-rack", 2, 4); stamp(m, "tibo-fantasy-weapon-rack", 12, 4);
  block(m, 7, 4, [[263], [293]]); block(m, 9, 4, [[263], [293]]);
  block(m, 6, 7, [[325, 326, 326, 326, 327]]);
  carpet(m, TIBO, 7, 8, 9, 9);
  stamp(m, "tibo-library-231", 2, 9); stamp(m, "tibo-library-100", 12, 9); stamp(m, "tibo-library-129", 4, 7);
  add("fantasy-weapon-shop", "무기점", "tibo_interior_expanded", m, {
    series: "interior", entry: [8, 10], keeper: [8, 6], targets: [[8, 8], [8, 6]],
    note: "크림 벽 집 실내. 뒷벽에 방패·교차검, 양옆 무기 거치대, 상인 뒤 검·물약 진열대 263/293, 긴 카운터 325·326·327, 문에서 카운터까지 붉은 러그",
  });
  // ① 방어구점
  m = shell(16, 13, { x: 2, y: 5, w: 12, h: 5 }, { x: 8, y: 9 }, "stone-brick");
  stamp(m, "tibo-library-221", 6, 3); stamp(m, "tibo-library-221", 9, 3); block(m, 7, 3, [[262, 262]]);
  stamp(m, "tibo-medieval-armor-stand", 2, 4); stamp(m, "tibo-medieval-armor-stand", 4, 4); stamp(m, "tibo-library-111", 12, 4); stamp(m, "tibo-library-111", 13, 4);
  block(m, 7, 7, [[325, 326, 327]]);
  stamp(m, "tibo-library-200", 2, 9); stamp(m, "tibo-library-194", 4, 9); stamp(m, "tibo-library-119", 11, 9); stamp(m, "tibo-library-129", 10, 7);
  carpet(m, TIBO, 7, 8, 9, 9);
  add("fantasy-armor-shop", "방어구점", "tibo_interior_expanded", m, {
    series: "interior", entry: [8, 10], keeper: [8, 6], targets: [[8, 8], [8, 6]],
    note: "석벽 집 실내. 왼쪽 갑옷 거치대 둘, 오른쪽 마네킹 둘, 벽에 방패, 앞쪽에 장화·배낭·가죽",
  });
  // ① 도구점
  m = shell(16, 13, { x: 2, y: 5, w: 12, h: 5 }, { x: 8, y: 9 });
  stamp(m, "tibo-v4-2-0", 2, 4); stamp(m, "tibo-library-145", 5, 4); stamp(m, "tibo-library-132", 11, 4); stamp(m, "tibo-fantasy-herb-rack", 8, 4);
  block(m, 5, 7, [[325, 326, 326, 327]]);
  stamp(m, "tibo-fantasy-grain-sacks", 11, 8); stamp(m, "tibo-library-130", 2, 9); stamp(m, "tibo-library-126", 4, 8); stamp(m, "tibo-library-148", 9, 5);
  add("fantasy-item-shop", "도구점", "tibo_interior_expanded", m, {
    series: "interior", entry: [8, 10], keeper: [7, 6], targets: [[7, 8], [7, 6]],
    note: "크림 벽 집 실내. 물약 진열장·약재 서랍장·약초 건조대·잡화 선반을 뒷벽에, 카운터 앞쪽에 식재료 자루·진열 받침",
  });
  // ① 대장간
  m = shell(18, 14, { x: 2, y: 5, w: 14, h: 6 }, { x: 9, y: 10 }, "stone-brick");
  retintFloor(m, 72, 42);
  stamp(m, "tibo-medieval-stone-fireplace", 2, 4); stamp(m, "tibo-fantasy-bellows", 5, 5); stamp(m, "tibo-library-102", 9, 4); stamp(m, "tibo-library-108", 12, 4); stamp(m, "tibo-fantasy-weapon-rack", 14, 4);
  stamp(m, "tibo-library-098", 4, 8); stamp(m, "tibo-fantasy-anvil-bench", 5, 8); stamp(m, "tibo-library-101", 10, 8); stamp(m, "tibo-grindstone", 13, 8);
  stamp(m, "tibo-library-100", 2, 10); stamp(m, "tibo-library-106", 14, 10); stamp(m, "tibo-library-103", 15, 10); stamp(m, "tibo-library-105", 12, 10);
  add("fantasy-smithy", "대장간", "tibo_interior_expanded", m, {
    series: "interior", entry: [9, 11], keeper: [7, 7], targets: [[7, 7], [9, 7]],
    note: "석벽·돌바닥 42. 벽난로 화덕 옆 풀무, 가운데 모루 작업대·담금질 물통·숫돌, 벽에 편자·앞치마·무기 거치대",
  });
  // ② 왕좌의 방
  m = shell(24, 22, { x: 2, y: 5, w: 20, h: 14 }, { x: 12, y: 18 }, "gold-brick");
  retintFloor(m, 72, 42);
  carpet(m, TIBO, 8, 5, 16, 7); carpet(m, TIBO, 11, 9, 13, 18);
  block(m, 11, 8, [[465, 466, 467]], "lowerTiles");
  block(m, 11, 5, [[447, 448, 449], [477, 478, 479]]);
  block(m, 10, 3, [[318], [348]]); block(m, 14, 3, [[319], [349]]);
  block(m, 8, 3, [[142, 143], [172, 173], [202, 203]]); block(m, 15, 3, [[142, 143], [172, 173], [202, 203]]);
  for (const x of [3, 6, 18, 20]) put(m, x, 3, 54);
  for (const x of [5, 19]) put(m, x, 4, 24);
  for (const y of [9, 13]) { block(m, 6, y, [[89], [119]]); block(m, 17, y, [[89], [119]]); }
  for (const y of [10, 14]) { block(m, 9, y, [[87], [117]]); block(m, 15, y, [[87], [117]]); }
  put(m, 7, 6, 204); put(m, 17, 6, 204);
  add("fantasy-throne-room", "왕좌의 방", "tibo_interior_expanded", m, {
    series: "castle", entry: [12, 19], keeper: [12, 7], targets: [[12, 7], [12, 9]],
    note: "금벽돌 벽·돌바닥. 붉은 카펫 단(계단 465·466·467) 위 왕좌 447~449/477~479, 뒤에 커튼 142/143·172/173·202/203과 휘장 318/348·319/349, 기둥 89/119 두 줄과 기사 석상 87/117, 창 54·벽 횃불 24",
  });
  // ② 성 복도
  m = shell(30, 11, { x: 2, y: 5, w: 26, h: 3 }, { x: 15, y: 7 }, "stone-brick");
  retintFloor(m, 72, 42);
  carpet(m, TIBO, 2, 6, 27, 6);
  for (let x = 4; x < 27; x += 5) { put(m, x, 3, 54); put(m, x + 2, 4, 24); }
  for (const x of [3, 8, 13, 18, 23]) block(m, x, 4, [[87], [117]]);
  add("fantasy-castle-corridor", "성 복도", "tibo_interior_expanded", m, {
    series: "castle", entry: [15, 8], targets: [[2, 6], [27, 6]],
    note: "석벽 복도. 창 54와 벽 횃불 24를 번갈아, 기사 석상 87/117을 한쪽 벽을 따라, 가운데 붉은 러너",
  });
  // ② 성 지하 감옥
  const pillars = [];
  for (const x of [8, 14, 20]) for (let y = 0; y < 8; y++) pillars.push([x, y]);
  m = dungeon(28, 18, [[2, 2, 25, 12], [13, 13, 15, 16]], 187, pillars);
  for (const [x0, x1] of [[2, 7], [9, 13], [15, 19], [21, 25]]) {
    for (let x = x0; x <= x1; x++) put(m, x, 8, 235);
    put(m, x0, 8, 234); put(m, x1, 8, 236); put(m, (x0 + x1) >> 1, 8, 205);
  }
  for (const [x, y] of [[3, 6], [11, 5], [17, 6], [24, 5]]) put(m, x, y, 299);
  for (const x of [5, 11, 17, 23]) block(m, x, 9, [[263], [293]]);
  block(m, 21, 10, [[324], [354]]); put(m, 22, 10, 327); put(m, 20, 11, 327);
  add("fantasy-castle-jail", "성 지하 감옥", "easyrpg_chipset_dungeon", m, {
    series: "castle", entry: [14, 16], targets: [[4, 9], [11, 9], [17, 9], [23, 9]],
    note: "던전 칩셋, 「무너진 납골당」과 같은 벽 조립. 감방 넷을 공허 기둥으로 나누고 쇠창살 234·235·236(가운데 205가 감방 문), 복도 횃불 263/293, 간수 탁자 324/354와 의자 327",
  });
  // ③ 마왕성 왕좌의 방
  const RED = group(DUN, "redrock").variantMap["255"], LAVA = group(DUN, "lava");
  m = dungeon(30, 26, [[2, 2, 27, 22], [13, 23, 15, 24]], RED);
  fill(m, 3, 9, 7, 19, LAVA.variantMap["255"]); fill(m, 22, 9, 26, 19, LAVA.variantMap["255"]);
  autotile(m, LAVA);
  carpet(m, DUN, 13, 6, 15, 24); carpet(m, DUN, 10, 4, 18, 6);
  block(m, 13, 4, [[447, 448, 449], [477, 478, 479]]);
  block(m, 6, 4, [[441, 442, 443], [471, 472, 473]]); block(m, 21, 4, [[441, 442, 443], [471, 472, 473]]);
  for (const y of [9, 13, 17]) { block(m, 11, y, [[146], [176]]); block(m, 17, y, [[146], [176]]); }
  for (const y of [8, 12, 16, 20]) { block(m, 9, y, [[446], [476]]); block(m, 19, y, [[446], [476]]); }
  for (const x of [4, 10, 18, 25]) block(m, x, 2, [[263], [293]]);
  for (const [x, y] of [[8, 20], [21, 8], [3, 21], [26, 21], [12, 21]]) put(m, x, y, 299);
  add("fantasy-demon-throne", "마왕성 왕좌의 방", "easyrpg_chipset_dungeon", m, {
    series: "demon", entry: [14, 24], keeper: [14, 6], targets: [[14, 6], [8, 21], [21, 21]],
    note: "던전 칩셋. 적암 바닥, 양옆 용암 못(용암 오토타일), 붉은 카펫 끝에 왕좌 447~479, 좌우 붉은 마법진 441~443/471~473(칩셋에 반쪽뿐), 가고일 146/176·기둥 446/476 두 줄, 벽 앞 화로 263/293, 해골 299",
  });
  // ③ 마법사 탑 한 층
  m = shell(20, 18, { x: 2, y: 5, w: 16, h: 10 }, { x: 10, y: 14 }, "stone-brick");
  retintFloor(m, 72, 42); closeDoor(m, 10, 15);
  block(m, 8, 8, [[381, 382, 383], [411, 412, 413], [441, 442, 443]]);
  block(m, 2, 4, [[18, 19, 20], [48, 49, 50], [78, 79, 80]], "lowerTiles"); block(m, 5, 4, [[18, 20], [48, 50], [78, 80]], "lowerTiles");
  block(m, 16, 3, [[111], [141], [171]], "lowerTiles");
  stamp(m, "tibo-fantasy-alchemy-desk", 12, 5); stamp(m, "tibo-library-166", 15, 9); stamp(m, "tibo-fantasy-crystal-stand", 11, 11); stamp(m, "tibo-library-164", 8, 4); stamp(m, "tibo-v11-1-3", 14, 12);
  stamp(m, "tibo-v12-1-2", 2, 8); stamp(m, "tibo-library-168", 9, 12); stamp(m, "tibo-library-159", 16, 7); stamp(m, "tibo-library-158", 4, 11);
  for (const [y, xs] of [[14, [2, 3, 4, 15, 16, 17]], [13, [2, 3, 16, 17]], [12, [2, 17]]]) for (const x of xs) { put(m, x, y, 430, "lowerTiles"); put(m, x, y, -1); }
  put(m, 5, 13, 475, "lowerTiles");
  reshapeCeiling(m);
  add("fantasy-wizard-tower-floor", "마법사 탑 · 한 층", "tibo_interior_expanded", m, {
    series: "demon", entry: [16, 6], targets: [[5, 12], [10, 11], [13, 7]],
    note: "문 없이 계단으로 오가는 탑 한 층. 오른쪽 위 올라가는 계단 111/141/171, 왼쪽 아래 내려가는 계단 475, 가운데 마법진 381~443, 책장 18~80, 연금술 작업대·가마솥·수정구·별자리 판·망원경. 아래 두 모서리를 깎아 둥근 탑 느낌",
  });

  // ① 상점가 외관 — 여울성 나루 아랫단의 세 집
  const ford = village.maps["ford-castle-town"];
  const X0 = 6, Y0 = 50;
  m = crop(ford, X0, Y0, 62, 15);
  const P = (x, y, t) => put(m, x - X0, y - Y0, t);
  const T = (id, x, y) => stamp(m, id, x - X0, y - Y0, graft);
  for (let x = 16; x < 20; x++) for (let y = 58; y < 62; y++) P(x, y, -1); // 빨랫줄 자리
  P(13, 60, 627); P(11, 60, 628); // 칼·방패 간판
  P(16, 59, 687); P(16, 60, 717); P(18, 59, 687); P(18, 60, 717); // 앞마당 갑옷 거치대
  P(29, 61, 629); // 항아리 간판
  for (let x = 50; x < 58; x++) for (let y = 55; y < 62; y++) P(x, y, -1); // 게시판·우물 자리를 대장간 마당으로
  T("tibo-library-104", 55, 57); T("tibo-anvil", 53, 59); T("tibo-library-101", 51, 60);
  T("tibo-library-100", 55, 60); T("tibo-library-098", 57, 59); T("tibo-fantasy-weapon-rack", 51, 56);
  P(59, 59, -1); P(59, 60, -1);
  add("fantasy-shop-street", "상점가 · 무기·도구점과 대장간", "forest_harmony", m, {
    series: "exterior", entry: [30, 14], targets: [[6, 12], [22, 13], [53, 12], [48, 11]],
    note: "여울성 나루 아랫단의 집 셋을 그대로 쓰고 간판·마당만 바꿨다. 무기·방어구점은 문 옆 칼 627·방패 628 간판과 앞마당 갑옷 거치대 687/717, 도구점은 항아리 간판 629, 돌집 대장간은 옆 노천 작업장(화덕·모루·담금질 물통·주괴·석탄·무기 거치대)",
  });
  // ③ 폐성 — 여울성의 성, 조립은 그대로 두고 바닥·장식만 폐허로
  m = crop(ford, 25, 2, 50, 38);
  const COURT = new Set([306, 307, 308, 276, 277, 278, 336, 337, 338]), W = m.width, L = m.lowerTiles, U = m.upperTiles;
  for (let i = 0; i < L.length; i++) if (COURT.has(L[i]) && U[i] >= 0) U[i] = -1; // 화분·벤치·등
  const court = L.map((t, i) => (COURT.has(t) ? i : -1)).filter((i) => i >= 0);
  for (const i of court) if (rnd() < 0.33) L[i] = 732; // 이끼 낀 돌바닥
  for (const i of sample(court, 26)) U[i] = pick([537, 537, 888, 948, 383]);
  const treeCells = court.filter((i) => i + W < L.length && (COURT.has(L[i + W]) || L[i + W] === 732) && U[i] < 0 && U[i + W] < 0);
  for (const i of sample(treeCells, 6)) { U[i] = 261; U[i + W] = 291; }
  const faces = L.map((t, i) => (t === 51 && L[i + W] === 81 && U[i] < 0 ? i : -1)).filter((i) => i >= 0);
  for (const i of sample(faces, 26)) { U[i] = 265; U[i + W] = 295; }
  for (let i = 0; i < U.length; i++) if (U[i] === 179 || U[i] === 209 || (i / W | 0) >= 36) U[i] = -1; // 깃발·성 앞 소품
  add("fantasy-ruined-castle", "폐성", "forest_harmony", m, {
    series: "demon", entry: [25, 37], targets: [[25, 33]],
    note: "여울성의 작은 성을 그대로 두고(두 겹 성벽·흉벽·탑 조립은 손대지 않음) 깃발·화분·벤치를 치운 뒤 안뜰에 이끼 돌바닥 732·돌무더기 537/888/948·해골 383·마른 나무 261/291, 벽면에 덩굴 265/295",
  });

  // Grafted Tibo props take the Tibo slot's walkability, priority and a readable label.
  const kitName = new Map();
  for (const k of TIBO.structureKits) for (const r of k.rows) for (const t of r.upperTiles ?? []) if (t >= 0 && !kitName.has(t)) kitName.set(t, k.name);
  FH.count = Math.ceil((firstGraft + graftOf.size) / 30) * 30;
  while (FH.terrain.length < FH.count) FH.terrain.push(0);
  while (FH.priority.length < FH.count) FH.priority.push("lower");
  while (FH.passability.length < FH.count) FH.passability.push({ up: false, down: false, left: false, right: false });
  while (FH.tileMeta.length < FH.count) FH.tileMeta.push({ label: "미사용", source: "unknown" });
  for (const [src, id] of graftOf) {
    FH.passability[id] = structuredClone(TIBO.passability[src]);
    FH.priority[id] = TIBO.priority[src];
    FH.tileMeta[id] = { label: `${kitName.get(src) ?? "실내 소품"} · Tibo ${src}`, source: "custom" };
  }
  // The three hanging shop signs were labelled by their colours; name them by what they sell.
  const signs = JSON.parse(fs.readFileSync("tiledata/rpg-places/sign-labels.json"));
  for (const [tile, { before: _shipped, ...meta }] of Object.entries(signs)) FH.tileMeta[+tile] = { ...FH.tileMeta[+tile], ...meta };

  // ── reachability with the runtime move rule ──
  const tilesets = { tibo_interior_expanded: TIBO, easyrpg_chipset_dungeon: DUN, forest_harmony: FH };
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
    const blocked = p.targets.filter(([x, y]) => !seen.has(y * map.width + x));
    report.push({ id: p.id, entry: p.entry, targets: p.targets, reachable: seen.size, blocked });
  }
  const bad = report.filter((r) => r.blocked.length);
  assert(!bad.length, "unreachable: " + JSON.stringify(bad));
  fs.mkdirSync(OUT, { recursive: true });
  const plans = places.map(({ map: _m, ...spec }) => spec);
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({ plans, maps, tilesets }) + "\n");
  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify(report, null, 2) + "\n");
  console.log({ maps: Object.keys(maps), grafts: graftOf.size, reach: report.map((r) => `${r.id}:${r.reachable}`) });
});
