// Festivals, markets and story scenes of tiledata/atlas-scenes (OutdoorMap on forest_harmony / climate sheets):
// wedding, harvest, knight tournament, lantern night, maypole, circus; markets; the execution square, coronation,
// procession, funeral, farewell; the ending hill, a flashback village; boss stages (dragon, demon lord, giant, ice
// wyrm, sand serpent, forest spirit); temple forecourts and sanctuary entrances. Scene pieces (stands, pavilions, list
// fence, gallows, thrones, rune circles, braziers, arches, carpets, garlands) come from the vehicle sheet.
import { V, Vnear, F, SNOW, ASH, SAND, AUTUMN } from "./atlas-scenes-outdoor.mjs";
import { piles } from "./atlas-scenes-harbors.mjs";

/** A carpet runner from (x, y0) down to y1 (south end cap), or across from x0 to x1 on row y. */
export function carpetV(b, x, y0, y1, purpose = "융단") { for (let y = y0; y <= y1; y++) V(b, y === y0 ? "carpet:end_n" : y === y1 ? "carpet:end_s" : "carpet:v", x, y, { on: "any", purpose }); }
export function carpetH(b, x0, x1, y, purpose = "융단") { for (let x = x0; x <= x1; x++) V(b, "carpet:h", x, y, { on: "any", purpose }); }
/** Overhead garland string along a row / column (★ pieces; walkers pass under). */
export function garlandRow(b, kind, x0, x1, y, step = 1, purpose = "축제 줄등") { for (let x = x0; x <= x1; x += step) { const i = b.at(x, y); if (b.upper[i] === -1 && !b.water.has(i)) V(b, "garland:" + kind, x, y, { on: "any", purpose }); } }
/** A pair of braziers flanking (x, y) at distance d. */
export function braziers(b, x, y, d, purpose = "화로") { Vnear(b, "brazier", x - d, y, { purpose }, 2); Vnear(b, "brazier", x + d, y, { purpose }, 2); }

export function scenePlans() {
  const plans = [];
  const add = (p) => plans.push({ gate: "town", ...p });

  // ── festivals ──
  add({
    id: "fest-wedding-garden", category: "festivals", name: "장미 교회 혼례식", tilesetId: F, width: 44, height: 38, seed: 7301,
    purpose: "마을 교회 앞뜰의 혼례식. 교회 문에서 장미 아치를 지나 광장까지 붉은 융단, 양옆 하객 의자와 줄등, 잔칫상",
    note: "북쪽 돌벽 교회 문 앞에서 장미 아치를 지나 남쪽 광장까지 붉은 융단이 깔렸다. 융단 양옆으로 하객 의자(벤치)가 두 줄씩 아치를 보고 앉아 있고, 머리 위로 등불 줄이 걸렸다. 광장 동쪽 잔칫상과 술통, 서쪽 꽃 화단, 둘레에 마을 집 셋",
    plaza: [["cobble", ["꽃 화단", "화분", "돌등"]]],
    build(b) {
      const church = b.landmark("church", 18, 2);
      const dx = church.doors[0].x;
      V(b, "arch:rose", dx - 1, 13, { purpose: "신랑 신부가 지나는 장미 아치" });
      carpetV(b, dx, 11, 12, "교회 문 앞 융단");
      carpetV(b, dx, 14, 27, "혼례 융단");
      for (const y of [17, 19, 21, 23]) { b.put("벤치", dx - 4, y, { owner: "혼례식", purpose: "하객 의자" }); b.put("벤치", dx + 3, y, { owner: "혼례식", purpose: "하객 의자" }); }
      garlandRow(b, "lantern", dx - 5, dx - 1, 16, 2, "혼례 등불 줄"); garlandRow(b, "lantern", dx + 1, dx + 5, 16, 2, "혼례 등불 줄");
      garlandRow(b, "bunting", dx - 5, dx - 1, 25, 2, "혼례 깃발 줄"); garlandRow(b, "bunting", dx + 1, dx + 5, 25, 2, "혼례 깃발 줄");
      b.pave(b.ellipseCells(dx + 0.5, 30, 9, 3.4, 0.08), "cobble", { name: "잔치 광장" });
      b.houseNear(0, 3, 4, { role: "신부네 집", yard: "garden", side: "right", window: 85 });
      b.houseNear(4, 34, 4, { role: "주막", yard: "tavern", side: "left", window: 86 });
      b.houseNear(6, 4, 24, { role: "집", yard: "laundry", side: "right", window: 85 });
      b.exits([{ side: "south", at: dx, meets: "마을 들길(필드)" }, { side: "east", at: 30, meets: "마을 큰길" }]);
      b.access.push({ role: "carpet", x: dx, y: 27 });
      b.spine([["exit:0", [dx, 34], [dx + 1, 30]], [[dx + 1, 30], [34, 30], "exit:1"], [[dx - 2, 30], [8, 30], [8, 22]], [[34, 30], [37, 14]]]);
      b.connect(); b.paintRoads();
      b.props([["가로 탁자", dx + 5, 28, "잔칫상", "혼례식"], ["술통", dx + 9, 28, "잔치 술통", "혼례식"], ["과일 좌판", dx + 5, 32, "잔치 과일", "혼례식"], ["꽃 화단", dx - 8, 28, "광장 꽃 화단", "혼례식"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 36, 5, 3, 10], [41, 36, 5, 3, 10]], clear: [[dx, 20, 14, 12, 14]] });
      b.edgeClumps(3);
      b.tallGrass(2, [4, 7]);
      b.threes(348, 3);
    },
  });

  add({
    id: "fest-harvest-fair", category: "festivals", name: "황금들 추수 잔치", tilesetId: AUTUMN, width: 50, height: 40, seed: 7311, fill: { flowerCap: 20 },
    purpose: "가을 추수를 마친 마을의 잔치. 나무 무대와 오월 기둥, 호박·건초 수레, 과일 좌판, 곡식 창고 앞 건초 더미",
    note: "마을 한가운데 흙 광장 북쪽에 나무 무대가 서고, 광장 가운데 오월 기둥 둘레로 춤판이 벌어진다. 광장 둘레 과일 좌판과 노점, 호박 수레·건초 수레가 짐을 부려 놓았고 곡식 창고 앞엔 건초 더미와 호박 무더기. 머리 위 깃발 줄, 둘레에 농가 넷과 밭",
    plaza: [["dirt", ["과일 좌판", "나무 상자", "술통"]]],
    build(b) {
      b.pave(b.ellipseCells(25, 20, 10, 6, 0.1), "dirt", { name: "잔치 광장" });
      b.stage(21, 12, 9, 3, "추수 잔치 무대");
      V(b, "maypole", 25, 19, { on: "any", purpose: "춤판 오월 기둥" });
      garlandRow(b, "bunting", 17, 33, 16, 2, "잔치 깃발 줄");
      Vnear(b, "cart:pumpkins", 15, 22, { on: "any", purpose: "호박 수레" });
      Vnear(b, "cart:hay", 33, 22, { on: "any", purpose: "건초 수레" });
      b.houseNear(2, 4, 4, { role: "곡식 창고", yard: "farm", side: "right", window: 86 });
      b.houseNear(5, 40, 4, { role: "농가", yard: "farm", side: "left", window: 85 });
      b.houseNear(1, 4, 27, { role: "농가", yard: "storage", side: "right", window: 85 });
      b.houseNear(3, 40, 28, { role: "방앗간", yard: "storage", side: "left", window: 86 });
      b.exits([{ side: "south", at: 25, meets: "추수 들판(필드)" }, { side: "west", at: 20, meets: "단풍 숲길" }]);
      b.spine([["exit:0", [25, 30], [25, 26]], ["exit:1", [14, 20]], [[35, 20], [42, 20], [42, 13]], [[14, 20], [8, 13]]]);
      b.connect(); b.paintRoads();
      for (const [x, y] of [[11, 8], [12, 8], [11, 9], [13, 9]]) Vnear(b, "haybale", x, y, { on: "any", purpose: "곡식 창고 앞 건초 더미" }, 2);
      Vnear(b, "pumpkins", 14, 10, { on: "any", purpose: "곡식 창고 앞 호박 무더기" }, 2);
      b.props([["과일 좌판", 18, 24, "사과 좌판", "잔치 광장"], ["장터 노점", 29, 25, "파이 노점", "잔치 광장"], ["벤치", 20, 26, "구경꾼 쉼터", "잔치 광장"], ["술통", 31, 17, "사과주 통", "추수 잔치 무대"]]);
      b.yards();
      b.gardenPlots(3, { owner: "마을 밭" });
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 38, 5, 3, 10], [47, 38, 5, 3, 10]], clear: [[25, 20, 16, 12, 14]], noise: 0.8 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  add({
    id: "fest-knight-tournament", category: "festivals", name: "왕실 마상 창 시합장", tilesetId: F, width: 56, height: 44, seed: 7321, as: "region", regionKind: "terrain",
    purpose: "기사들의 마상 창 시합장. 가운데 긴 시합 울타리, 북쪽 귀빈·시민 관람석, 양 끝에 두 편 기사 천막과 말",
    note: "들판 한가운데 동서로 긴 시합 울타리(틸트)가 놓였고, 그 북쪽에 푸른 귀빈석과 붉은 시민석 관람석 넷이 시합장을 보고 앉았다. 울타리 서쪽 끝엔 붉은 편 기사 천막 둘과 말, 동쪽 끝엔 푸른 편 천막 둘과 말, 천막마다 창걸이. 남쪽엔 노점과 술통, 깃발 줄이 머리 위에 걸렸다",
    gate: "field",
    build(b) {
      const y = 22;
      V(b, "list:left", 14, y, { purpose: "시합 울타리" });
      for (let x = 15; x < 41; x++) V(b, "list:mid", x, y, { purpose: "시합 울타리" });
      V(b, "list:right", 41, y, { purpose: "시합 울타리" });
      b.pave(b.rectCells(12, 19, 32, 7), "dirt", { name: "시합 주로" });
      V(b, "stand:blue", 14, 13, { purpose: "귀빈 관람석" }); V(b, "stand:red", 21, 13, { purpose: "시민 관람석" });
      V(b, "stand:blue", 29, 13, { purpose: "귀빈 관람석" }); V(b, "stand:red", 36, 13, { purpose: "시민 관람석" });
      garlandRow(b, "bunting", 14, 41, 18, 2, "시합장 깃발 줄");
      V(b, "pavilion:붉은", 4, 17, { purpose: "붉은 편 기사 천막" }); V(b, "pavilion:붉은", 4, 23, { purpose: "붉은 편 기사 천막" });
      V(b, "pavilion:푸른", 49, 17, { purpose: "푸른 편 기사 천막" }); V(b, "pavilion:푸른", 49, 23, { purpose: "푸른 편 기사 천막" });
      V(b, "horse:right", 8, 20, { purpose: "붉은 편 군마" }); V(b, "horse:left", 46, 20, { purpose: "푸른 편 군마" });
      b.exits([{ side: "south", at: 28, meets: "왕도로 가는 큰길(필드)" }, { side: "west", at: 32, meets: "기사 야영지" }]);
      b.spine([["exit:0", [28, 34], [28, 27]], [[28, 30], [10, 30], [8, 27]], [[28, 30], [46, 30], [47, 27]], ["exit:1", [10, 32]], [[12, 11], [44, 11]], [[12, 11], [10, 16]], [[44, 11], [46, 16]]]);
      b.connect(); b.paintRoads();
      b.props([["무기 거치대", 8, 16, "기사 창걸이", "붉은 편 기사 천막"], ["무기 거치대", 8, 25, "기사 창걸이", "붉은 편 기사 천막"], ["무기 거치대", 47, 16, "기사 창걸이", "푸른 편 기사 천막"], ["무기 거치대", 47, 25, "기사 창걸이", "푸른 편 기사 천막"],
        ["장터 노점", 18, 32, "구경꾼 노점"], ["장터 노점", 34, 32, "구경꾼 노점"], ["술통", 22, 33, "구경꾼 술통", "장터 노점"], ["성 깃발", 13, 11, "왕실 깃발", "귀빈 관람석"], ["성 깃발", 42, 11, "왕실 깃발", "귀빈 관람석"]]);
      b.forest({ bands: { north: [3, 1.5], south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 42, 6, 4, 12], [53, 42, 6, 4, 12], [3, 3, 5, 3, 10], [53, 3, 5, 3, 10]], clear: [[28, 22, 24, 12, 16]] });
      b.edgeClumps(3);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 4);
    },
  });

  add({
    id: "fest-lantern-night", category: "festivals", name: "연못가 등불 축제", tilesetId: F, width: 46, height: 38, seed: 7331,
    purpose: "여름밤 연못가 등불 축제. 연못 둘레 등불 줄과 돌등, 물가 무대, 노점 거리와 천막",
    note: "마을 연못을 등불 줄이 두르고, 연못 남쪽 물가에 나무 무대가 서서 악사가 연주한다. 연못 동쪽 길을 따라 노점 셋과 붉은 천막 가게, 서쪽 물가엔 소원 등을 띄우는 선착장. 돌등이 광장을 밝히고 둘레에 집 셋",
    plaza: [["cobble", ["돌등", "벤치", "꽃 화단"]]],
    build(b) {
      b.pond(22, 12, 8, 4.5, 0.14); b.smoothWater(); b.paintWater();
      b.pave(b.rectCells(14, 20, 18, 5), "cobble", { name: "물가 광장" });
      b.stage(18, 21, 9, 3, "물가 등불 무대");
      b.pier(13, 12, "east", 3);
      V(b, "pavilion:붉은", 36, 16, { purpose: "등불 가게 천막" });
      b.houseNear(0, 3, 3, { role: "집", yard: "garden", side: "right", window: 85 });
      b.houseNear(3, 38, 3, { role: "등불 공방", yard: "woodwork", side: "left", window: 86 });
      b.houseNear(6, 4, 27, { role: "주막", yard: "tavern", side: "right", window: 86 });
      b.exits([{ side: "south", at: 23, meets: "마을 큰길" }]);
      b.spine([["exit:0", [23, 32], [23, 25]], [[23, 27], [34, 27], [34, 12], [33, 8]], [[23, 27], [11, 26], [9, 18], "pier-foot:0"]]);
      b.connect(); b.paintRoads();
      for (const [x0, x1, y] of [[13, 31, 6], [13, 31, 18]]) garlandRow(b, "lantern", x0, x1, y, 2, "연못 등불 줄");
      b.props([["장터 노점", 37, 22, "등불 노점"], ["장터 노점", 37, 27, "먹거리 노점"], ["과일 좌판", 30, 29, "과일 좌판"], ["벤치", 16, 26, "구경꾼 쉼터", "물가 광장"], ["돌등", 13, 24, "광장 등불"], ["돌등", 32, 24, "광장 등불"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 36, 5, 3, 10], [43, 36, 5, 3, 10]], clear: [[23, 18, 18, 14, 14]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 4);
    },
  });

  add({
    id: "fest-maypole-meadow", category: "festivals", name: "봄꽃 들판 오월제", tilesetId: F, width: 42, height: 34, seed: 7341, gate: "field",
    purpose: "마을 밖 꽃 들판의 오월제. 오월 기둥 둘레 춤판, 꽃 화단과 깃발 줄, 소풍 탁자와 과일 좌판",
    note: "꽃이 핀 들판 한가운데 오월 기둥이 서고 그 둘레 흙바닥이 춤판이다. 춤판 둘레로 깃발 줄이 걸리고 꽃 화단과 벤치가 둥글게 놓였다. 동쪽엔 소풍 탁자와 과일 좌판, 서쪽엔 건초 수레와 말, 남쪽 들길로 마을에 이어진다",
    build(b) {
      b.pave(b.ellipseCells(20, 15, 5.5, 3.6, 0.05), "dirt", { name: "오월제 춤판" });
      V(b, "maypole", 20, 13, { on: "any", purpose: "오월 기둥" });
      garlandRow(b, "bunting", 15, 25, 10, 2, "오월제 깃발 줄");
      garlandRow(b, "bunting", 15, 25, 20, 2, "오월제 깃발 줄");
      Vnear(b, "cart:hay", 8, 14, { purpose: "들판에 댄 건초 수레" });
      V(b, "horse:right", 5, 14, { purpose: "수레 말" });
      b.exits([{ side: "south", at: 20, meets: "마을 들길" }]);
      b.spine([["exit:0", [20, 26], [20, 19]]]);
      b.paintRoads();
      b.props([["가로 탁자", 30, 13, "소풍 탁자", "오월제"], ["과일 좌판", 30, 17, "과일 좌판", "오월제"], ["벤치", 13, 17, "춤판 쉼터", "오월제"], ["벤치", 26, 17, "춤판 쉼터", "오월제"], ["꽃 화단", 14, 11, "춤판 꽃 화단", "오월제"], ["꽃 화단", 25, 11, "춤판 꽃 화단", "오월제"]]);
      b.forest({ bands: { north: [3, 1.5], west: [3, 1.5], east: [3, 1.5], south: [2, 1] }, blobs: [[3, 32, 5, 3, 10], [39, 32, 5, 3, 10]], clear: [[20, 15, 16, 10, 14]] });
      b.edgeClumps(4);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 8);
      b.threes(288, 4);
    },
    extraTargets: [[20, 16]],
  });

  add({
    id: "fest-circus-fair", category: "festivals", name: "떠돌이 곡마단 천막 마당", tilesetId: F, width: 50, height: 40, seed: 7351,
    purpose: "마을 밖 공터에 들어선 떠돌이 곡마단. 가운데 큰 무대, 둘레 줄무늬 천막 넷, 곡마단 포장마차와 말, 매표 부스",
    note: "마을 동쪽 공터에 곡마단이 자리를 폈다. 가운데 나무 무대를 두고 붉은·푸른·초록·보라 줄무늬 천막 넷이 둘러섰고, 남쪽 입구엔 매표 부스 둘과 깃발 줄. 북쪽엔 곡마단 포장마차 셋과 말이 쉬고, 구경꾼 노점과 술통이 있다",
    plaza: [["dirt", ["술통", "나무 상자", "벤치"]]],
    build(b) {
      b.pave(b.ellipseCells(25, 20, 12, 8, 0.08), "dirt", { name: "곡마단 마당" });
      b.stage(20, 17, 11, 5, "곡마단 무대");
      V(b, "pavilion:붉은", 14, 14, { on: "any", purpose: "곡예사 천막" }); V(b, "pavilion:푸른", 34, 14, { on: "any", purpose: "마술사 천막" });
      V(b, "pavilion:초록", 14, 23, { on: "any", purpose: "점쟁이 천막" }); V(b, "pavilion:보라", 34, 23, { on: "any", purpose: "맹수 천막" });
      V(b, "booth:red", 21, 28, { on: "any", purpose: "매표 부스" }); V(b, "booth:blue", 28, 28, { on: "any", purpose: "매표 부스" });
      garlandRow(b, "bunting", 18, 32, 26, 2, "곡마단 깃발 줄");
      Vnear(b, "wagon:red", 12, 5, { purpose: "곡마단 포장마차" }); Vnear(b, "wagon:green", 20, 5, { purpose: "곡마단 포장마차(말 매어 둠)" }); Vnear(b, "wagon:canvas", 30, 5, { purpose: "곡마단 짐마차(말 매어 둠)" });
      V(b, "horse:left", 9, 5, { purpose: "쉬는 곡마단 말" });
      b.exits([{ side: "south", at: 25, meets: "마을로 가는 길" }, { side: "west", at: 20, meets: "들판 길(필드)" }]);
      b.spine([["exit:0", [25, 34], [25, 30]], ["exit:1", [11, 20]], [[25, 12], [25, 9], [38, 9]]]);
      b.connect(); b.paintRoads();
      b.props([["장터 노점", 40, 30, "구경꾼 먹거리 노점"], ["과일 좌판", 8, 30, "사탕 좌판"], ["술통", 43, 28, "노점 술통", "장터 노점"]]);
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 38, 5, 3, 10], [47, 38, 5, 3, 10]], clear: [[25, 18, 26, 18, 14]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 4);
    },
    extraTargets: [[25, 18]],
  });

  // ── markets ──
  add({
    id: "market-forest-square", category: "markets", name: "느티나무 장터 광장", tilesetId: F, width: 48, height: 40, seed: 7401,
    purpose: "닷새마다 서는 마을 장터. 돌 광장에 노점 줄과 천막 가게, 짐수레, 가운데 우물, 둘레 가게 집",
    note: "마을 한가운데 돌 광장에 노점이 두 줄로 서고, 붉은·초록 천막 가게와 짐 부린 손수레가 섞여 있다. 광장 가운데 우물과 게시판, 둘레에 대장간·잡화점·주막·빵집이 광장을 보고 서 있다. 네 방향 길이 광장으로 모인다",
    plaza: [["cobble", ["과일 좌판", "나무 상자", "술통", "벤치"]]],
    build(b) {
      b.pave(b.ellipseCells(24, 20, 11, 7, 0.06), "cobble", { name: "장터 광장" });
      b.put("낮은 돌 우물", 23, 19, { purpose: "광장 우물" });
      for (const [x, y] of [[15, 15], [19, 15], [28, 15], [32, 15]]) b.put("장터 노점", x, y, { owner: "장터", purpose: "노점" });
      V(b, "pavilion:붉은", 15, 22, { on: "any", purpose: "옷감 천막 가게" }); V(b, "pavilion:초록", 31, 22, { on: "any", purpose: "약초 천막 가게" });
      Vnear(b, "cart:crates", 20, 24, { on: "any", purpose: "짐 부린 손수레" }); Vnear(b, "cart:pumpkins", 26, 24, { on: "any", purpose: "호박 손수레" });
      b.houseNear(4, 4, 4, { role: "대장간", yard: "smith", side: "right", window: 87 });
      b.houseNear(2, 20, 2, { role: "잡화점", yard: "shop", side: "right", window: 85 });
      b.houseNear(0, 37, 4, { role: "주막", yard: "tavern", side: "left", window: 86 });
      b.houseNear(6, 5, 28, { role: "빵집", yard: "shop", side: "right", window: 85 });
      b.houseNear(3, 39, 29, { role: "집", yard: "laundry", side: "left", window: 86 });
      b.exits([{ side: "south", at: 24, meets: "남쪽 들길" }, { side: "west", at: 20, meets: "서쪽 숲길" }, { side: "east", at: 20, meets: "동쪽 큰길" }]);
      b.spine([["exit:0", [24, 30], [24, 27]], ["exit:1", [13, 20]], [[35, 20], "exit:2"], [[24, 13], [24, 10]]]);
      b.connect(); b.paintRoads();
      b.props([["게시판", 26, 18, "장날 알림판", "장터"], ["과일 좌판", 20, 18, "과일 좌판", "장터"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 38, 5, 3, 10], [45, 38, 5, 3, 10]], clear: [[24, 20, 26, 18, 14]] });
      b.edgeClumps(3);
      b.tallGrass(2, [4, 7]);
      b.threes(348, 3);
    },
  });

  add({
    id: "market-snow-winter-fair", category: "markets", name: "서리마을 겨울 장", tilesetId: SNOW, width: 46, height: 38, seed: 7411,
    purpose: "눈 덮인 마을의 겨울 장. 화로 둘레 노점, 모피·땔감 천막 가게, 썰매 대신 짐수레, 따뜻한 술 부스",
    note: "눈 광장 가운데 화로 둘을 두고 노점이 둘러섰다. 북쪽엔 모피 천막과 땔감 천막, 남쪽엔 따뜻한 술을 파는 부스 둘과 짐수레. 둘레에 눈 지붕 집 넷, 눈 덮인 침엽 숲이 마을을 감싼다",
    plaza: [["cobble", ["나무 상자", "술통", "장작 더미"]]],
    build(b) {
      b.pave(b.ellipseCells(23, 19, 10, 6, 0.06), "cobble", { name: "겨울 장 광장" });
      braziers(b, 23, 18, 3, "광장 화로");
      V(b, "pavilion:푸른", 15, 14, { on: "any", purpose: "모피 천막 가게" }); V(b, "pavilion:붉은", 29, 14, { on: "any", purpose: "땔감 천막 가게" });
      V(b, "booth:red", 17, 21, { on: "any", purpose: "따뜻한 술 부스" }); V(b, "booth:blue", 28, 21, { on: "any", purpose: "군밤 부스" });
      Vnear(b, "cart:crates", 22, 23, { on: "any", purpose: "장작 싣는 짐수레" });
      b.houseNear(7, 3, 3, { role: "모피 상인 집", yard: "storage", side: "right", window: 87 });
      b.houseNear(1, 35, 3, { role: "주막", yard: "tavern", side: "left", window: 85 });
      b.houseNear(6, 4, 27, { role: "대장간", yard: "smith", side: "right", window: 87 });
      b.houseNear(5, 36, 28, { role: "집", yard: "woodwork", side: "left", window: 86 });
      b.exits([{ side: "south", at: 23, meets: "설원 길(필드)" }]);
      b.spine([["exit:0", [23, 30], [23, 26]], [[13, 19], [10, 12]], [[33, 19], [37, 12]], [[13, 19], [10, 25]], [[33, 19], [37, 25]]]);
      b.connect(); b.paintRoads();
      b.props([["장터 노점", 14, 18, "털장갑 노점", "겨울 장 광장"], ["장터 노점", 30, 18, "훈제고기 노점", "겨울 장 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 36, 5, 3, 10], [43, 36, 5, 3, 10]], clear: [[23, 19, 24, 16, 14]], noise: 0.7 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  add({
    id: "market-desert-bazaar", category: "markets", name: "모래바람 대상 시장", tilesetId: SAND, width: 50, height: 40, seed: 7421, fill: { flowerCap: 16 },
    purpose: "사막 오아시스 곁 대상 시장. 줄무늬 천막 가게 거리, 대상 포장마차와 말, 향신료 항아리 더미, 물가 야자수",
    note: "작은 오아시스 남쪽 모래 광장에 줄무늬 천막 가게 여섯이 두 줄로 늘어선 시장 골목이 있다. 골목 끝엔 대상 포장마차 둘과 말, 향신료 항아리와 궤짝 더미. 오아시스 둘레 야자수와 물지기 집, 둘레에 흙빛 집 셋",
    build(b) {
      b.pond(25, 7, 6, 3, 0.15); b.smoothWater(); b.paintWater();
      b.pave(b.rectCells(12, 15, 26, 11), "sand", { name: "시장 골목" });
      for (const [x, n] of [[13, "붉은"], [18, "초록"], [23, "보라"], [28, "푸른"], [33, "붉은"]]) V(b, "pavilion:" + n, x, 15, { on: "any", purpose: "천막 가게" });
      for (const [x, n] of [[13, "푸른"], [18, "보라"], [28, "초록"], [33, "붉은"]]) V(b, "pavilion:" + n, x, 22, { on: "any", purpose: "천막 가게" });
      Vnear(b, "wagon:red", 5, 27, { purpose: "대상 포장마차" }); Vnear(b, "wagon:green", 40, 27, { purpose: "대상 포장마차(말 매어 둠)" });
      V(b, "horse:right", 10, 28, { purpose: "대상 말" });
      b.houseNear(2, 3, 4, { role: "물지기 집", yard: "desert", side: "right", window: 86 });
      b.houseNear(3, 40, 3, { role: "상인 집", yard: "storage", side: "left", window: 86 });
      b.houseNear(5, 42, 13, { role: "환전상", yard: "shop", side: "left", window: 85 });
      b.exits([{ side: "south", at: 24, meets: "사막 대상 길(필드)" }, { side: "west", at: 20, meets: "모래언덕 길" }]);
      b.spine([["exit:0", [24, 32], [24, 20], [25, 12]], ["exit:1", [12, 20]], [[37, 20], [42, 20]]]);
      b.connect(); b.paintRoads();
      piles(b, [["jars", 21, 26, "향신료 항아리 더미"], ["luggage", 9, 24, "대상 짐"], ["jars", 38, 24, "물항아리"]]);
      b.singlesWhere(770, 8, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 3, { shore: true });
      b.yards();
    },
  });

  add({
    id: "market-autumn-crossroads", category: "markets", name: "갈림길 가을 장", tilesetId: AUTUMN, width: 44, height: 36, seed: 7431,
    purpose: "세 갈래 길이 만나는 단풍 숲 갈림길의 장. 짐수레째 파는 수레 장수들, 이정표, 쉼터 주막",
    note: "단풍 숲 세 갈래 길이 만나는 흙 광장에 수레째 장사하는 장수들이 모였다. 호박 수레·건초 수레·궤짝 수레와 포장마차가 둥글게 서고, 가운데 이정표와 모닥불. 광장 북쪽엔 쉼터 주막, 동쪽엔 마구간 집",
    plaza: [["dirt", ["나무 상자", "술통"]]],
    build(b) {
      b.pave(b.ellipseCells(21, 18, 8, 5, 0.08), "dirt", { name: "갈림길 광장" });
      b.put("나무 이정표", 21, 17, { purpose: "갈림길 이정표" });
      Vnear(b, "cart:pumpkins", 14, 15, { on: "any", purpose: "호박 수레 장수" }); Vnear(b, "cart:hay", 26, 15, { on: "any", purpose: "건초 수레 장수" });
      Vnear(b, "cart:crates", 14, 20, { on: "any", purpose: "궤짝 수레 장수" }); Vnear(b, "wagon:green", 24, 20, { on: "any", purpose: "천 장수 포장마차(말 매어 둠)" });
      b.houseNear(4, 16, 3, { role: "쉼터 주막", yard: "tavern", side: "right", window: 86 });
      b.houseNear(7, 33, 6, { role: "마구간 집", yard: "storage", side: "left", window: 87 });
      b.exits([{ side: "west", at: 18, meets: "서쪽 단풍 숲길" }, { side: "east", at: 22, meets: "동쪽 마을 길" }, { side: "south", at: 21, meets: "남쪽 들길" }]);
      b.spine([["exit:0", [13, 18]], [[29, 18], "exit:1"], ["exit:2", [21, 23]], [[21, 13], [19, 11]]]);
      b.connect(); b.paintRoads();
      b.props([["모닥불", 18, 18, "장수들 모닥불", "갈림길 광장"], ["통나무 더미", 17, 19, "모닥불 둘레 통나무", "갈림길 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 34, 5, 3, 10], [41, 34, 5, 3, 10], [3, 3, 4, 3, 10]], clear: [[21, 18, 20, 12, 14]], noise: 0.8 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  // ── story scenes ──
  add({
    id: "scene-execution-square", category: "scenes", name: "잿빛 처형 광장", tilesetId: F, width: 44, height: 36, seed: 7501,
    purpose: "도시 한복판 처형 광장. 북쪽 교수대와 참수대, 칼틀, 군중을 막는 목책과 경비, 포고문 게시판",
    note: "돌 광장 북쪽에 교수대가 서고 그 옆에 참수대와 칼 씌우는 틀(칼틀)이 놓였다. 교수대 앞을 목책 넷이 가로막아 군중을 떼어 놓고, 목책 양끝에 경비 창걸이와 화로. 광장 남쪽엔 포고문 게시판, 둘레에 관청·감옥·집이 광장을 둘러싼다",
    plaza: [["cobble", ["돌등", "벤치", "나무 상자"]]],
    build(b) {
      b.pave(b.ellipseCells(22, 17, 11, 7, 0.05), "cobble", { name: "처형 광장" });
      V(b, "gallows", 20, 10, { on: "any", purpose: "교수대" });
      V(b, "block", 26, 13, { on: "any", purpose: "참수대" });
      V(b, "stocks", 15, 12, { on: "any", purpose: "칼틀" });
      for (const x of [14, 18, 22, 26]) V(b, "barrier", x, 17, { on: "any", purpose: "군중 막는 목책" });
      braziers(b, 22, 14, 8, "교수대 화로");
      b.houseNear(7, 3, 4, { role: "관청", yard: "guard", side: "right", window: 87 });
      b.houseNear(6, 35, 4, { role: "감옥", yard: "guard", side: "left", window: 87 });
      b.houseNear(1, 4, 25, { role: "집", yard: "laundry", side: "right", window: 85 });
      b.houseNear(3, 36, 26, { role: "집", yard: "storage", side: "left", window: 86 });
      b.exits([{ side: "south", at: 22, meets: "도시 큰길" }, { side: "east", at: 18, meets: "성으로 가는 길" }]);
      b.spine([["exit:0", [22, 30], [22, 24]], [[33, 18], "exit:1"], [[11, 18], [10, 13]], [[22, 24], [11, 25]], [[22, 24], [34, 25]]]);
      b.connect(); b.paintRoads();
      b.props([["게시판", 17, 22, "처형 포고문", "처형 광장"], ["무기 거치대", 12, 16, "경비 창걸이", "처형 광장"], ["무기 거치대", 31, 16, "경비 창걸이", "처형 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 34, 5, 3, 10], [41, 34, 5, 3, 10]], clear: [[22, 17, 26, 18, 14]] });
      b.edgeClumps(2, ["round-bush", "small-bush"]);
    },
    extraTargets: [[21, 19]],
  });

  add({
    id: "scene-coronation-court", category: "scenes", name: "대관식 왕궁 앞뜰", tilesetId: F, width: 50, height: 42, seed: 7511, as: "region", regionKind: "terrain",
    purpose: "새 왕의 대관식이 열리는 왕궁 앞뜰. 무대 위 옥좌, 옥좌까지 붉은 융단, 양옆 귀빈석과 왕실 깃발, 근위대",
    note: "교회를 등진 앞뜰 북쪽 나무 무대에 붉은 옥좌가 놓였고, 남쪽 정문에서 옥좌 발치까지 붉은 융단이 곧게 깔렸다. 융단 양옆에 푸른 귀빈석 둘과 붉은 시민석 둘이 마주 보고, 왕실 깃발과 화로 한 쌍, 근위대 창걸이가 줄지어 선다",
    plaza: [["cobble", ["꽃 화단", "화분", "돌등"]]],
    build(b) {
      b.landmark("church", 3, 2);
      b.stage(19, 5, 11, 5, "대관식 무대");
      V(b, "throne:red", 23, 5, { on: "any", purpose: "새 왕의 옥좌" });
      carpetV(b, 24, 9, 33, "대관식 융단");
      V(b, "stand:blue", 15, 13, { purpose: "귀족 귀빈석" }); V(b, "stand:blue", 28, 13, { purpose: "귀족 귀빈석" });
      V(b, "stand:red", 15, 20, { purpose: "시민석" }); V(b, "stand:red", 28, 20, { purpose: "시민석" });
      braziers(b, 24, 10, 4, "무대 화로");
      b.houseNear(7, 38, 3, { role: "근위대 막사", yard: "guard", side: "left", window: 87 });
      b.exits([{ side: "south", at: 24, meets: "왕도 큰길" }]);
      b.access.push({ role: "carpet", x: 24, y: 10 });
      b.spine([["exit:0", [24, 37], [21, 34], [12, 34], [10, 13]], [[26, 34], [38, 34], [41, 12]]]);
      b.connect(); b.paintRoads("cobble");
      b.props([["성 깃발", 18, 11, "왕실 깃발", "대관식 무대"], ["성 깃발", 30, 11, "왕실 깃발", "대관식 무대"], ["무기 거치대", 22, 27, "근위대 창걸이", "대관식 융단"], ["무기 거치대", 26, 27, "근위대 창걸이", "대관식 융단"],
        ["무기 거치대", 22, 31, "근위대 창걸이", "대관식 융단"], ["무기 거치대", 26, 31, "근위대 창걸이", "대관식 융단"], ["꽃 화단", 14, 27, "앞뜰 꽃 화단", "대관식 융단"], ["꽃 화단", 33, 27, "앞뜰 꽃 화단", "대관식 융단"]]);
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 40, 5, 3, 10], [47, 40, 5, 3, 10]], clear: [[24, 20, 28, 30, 14]] });
      b.edgeClumps(2, ["round-bush", "small-bush"]);
      b.threes(348, 3);
    },
  });

  add({
    id: "scene-royal-procession", category: "scenes", name: "왕실 행차 가로수길", tilesetId: F, width: 58, height: 32, seed: 7521,
    purpose: "왕실 마차가 지나는 가로수 큰길. 붉은 사두마차와 호위 마차, 길가 관람석과 깃발 줄, 길을 막는 목책",
    note: "동서로 곧은 돌길 큰길 가운데로 붉은 왕실 사두마차가 동쪽으로 달리고 뒤를 푸른 호위 마차가 따른다. 길 양옆 목책 뒤로 시민 관람석과 구경꾼 노점, 머리 위 깃발 줄이 길을 가로지른다. 길가에 가로수와 집 셋",
    gate: "field",
    build(b) {
      b.exits([{ side: "west", at: 15, meets: "성문" }, { side: "east", at: 15, meets: "왕도 광장" }]);
      b.spine([["exit:0", [28, 15], "exit:1"]]);
      b.paintRoads("cobble");
      for (let y = 14; y <= 17; y++) for (let x = 0; x < 58; x++) { const i = b.at(x, y); if (!b.roads.has(i)) b.roads.add(i); }
      b.paintRoads("cobble");
      V(b, "coach:red", 30, 14, { on: "any", purpose: "왕실 사두마차" });
      V(b, "coach:blue", 20, 14, { on: "any", purpose: "호위 마차" });
      for (const x of [8, 12, 40, 44]) { V(b, "barrier", x, 12, { purpose: "길가 목책" }); V(b, "barrier", x, 19, { purpose: "길가 목책" }); }
      V(b, "stand:red", 16, 6, { purpose: "시민 관람석" }); V(b, "stand:blue", 34, 6, { purpose: "시민 관람석" });
      V(b, "stand:red", 26, 21, { purpose: "시민 관람석" });
      for (const x of [6, 18, 30, 42, 52]) for (let y = 13; y <= 18; y += 5) V(b, "garland:bunting", x, y, { on: "any", purpose: "행차 깃발 줄" });
      b.houseNear(0, 4, 2, { role: "집", yard: "garden", side: "right", window: 85 });
      b.houseNear(5, 48, 3, { role: "집", yard: "laundry", side: "left", window: 86 });
      b.houseNear(2, 46, 22, { role: "주막", yard: "tavern", side: "left", window: 86 });
      b.spine([[[8, 14], [8, 11]], [[50, 14], [50, 11]], [[48, 17], [48, 21]]]);
      b.connect(); b.paintRoads("cobble");
      b.props([["장터 노점", 8, 23, "구경꾼 노점"], ["장터 노점", 37, 24, "구경꾼 노점"], ["돌등", 24, 12, "길가 등불"], ["돌등", 36, 19, "길가 등불"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1] }, blobs: [[3, 30, 5, 3, 10], [55, 30, 5, 3, 10]], clear: [[28, 15, 60, 8, 14]] });
      b.edgeClumps(4);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 4);
    },
  });

  add({
    id: "scene-funeral-hill", category: "scenes", name: "언덕 묘지 장례 행렬", tilesetId: F, width: 42, height: 36, seed: 7531, theme: "graves",
    purpose: "마을 뒤 언덕 묘지로 가는 장례 행렬. 관을 실은 짐수레, 묘지 울타리 안 새 무덤과 비석, 조문객 의자",
    note: "마을에서 올라온 오솔길 끝 언덕 묘지 울타리 문 앞에 관을 실은 초록 포장마차가 멈춰 섰다. 울타리 안엔 옛 비석들 사이 새로 판 흙 무덤과 큰 비석, 무덤 앞 조문객 의자 두 줄과 화로 한 쌍. 묘지 옆 묘지기 집, 마른나무가 선다",
    build(b) {
      const g = b.landmark("graveyard", 16, 6);
      Vnear(b, "wagon:green", 18, 16, { purpose: "관을 실은 장례 마차(말 매어 둠)" });
      b.put("흙 무덤", 29, 10, { owner: "장례식", purpose: "새로 판 무덤" });
      b.put("큰 비석", 28, 6, { owner: "장례식", purpose: "새 무덤 비석" });
      b.put("벤치", 27, 13, { owner: "장례식", purpose: "조문객 의자" }); b.put("벤치", 30, 13, { owner: "장례식", purpose: "조문객 의자" });
      braziers(b, 29, 11, 3, "무덤가 화로");
      b.houseNear(3, 4, 5, { role: "묘지기 집", yard: "garden", side: "right", window: 86 });
      b.exits([{ side: "south", at: 20, meets: "마을 뒷길" }]);
      b.spine([["exit:0", [20, 28], [20, 14]], [[20, 20], [8, 20], [7, 14]], [[24, 14], [28, 15]]]);
      b.connect(); b.paintRoads();
      b.props([["마른나무", 36, 8], ["마른나무", 12, 26], ["돌 십자가", 34, 16, "언덕 돌 십자가"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [3, 1.5], south: [2, 1] }, blobs: [[3, 34, 5, 3, 10], [39, 34, 5, 3, 10]], clear: [[22, 14, 26, 16, 14]] });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(4, [4, 8]);
    },
    extraTargets: [[29, 12]],
  });

  add({
    id: "scene-ending-hill", category: "scenes", name: "노을 언덕 · 마지막 장면", tilesetId: F, width: 44, height: 34, seed: 7541, gate: "field",
    purpose: "여정이 끝나는 바닷가 언덕. 큰 느티나무 아래 벤치에서 바다를 내려다보고, 꽃밭과 옛 약속의 석상",
    note: "남쪽으로 바다가 내려다보이는 언덕 꼭대기에 큰 느티나무 한 그루가 서고, 그 아래 벤치 둘이 바다를 향해 놓였다. 나무 곁엔 옛 약속을 새긴 석상과 들꽃밭, 언덕 비탈엔 오솔길이 마을 쪽 북쪽으로 내려간다. 바닷가엔 작은 선착장",
    build(b) {
      b.waterWhere((x, y) => y > 25 + 2 * Math.sin(x / 5) + (x > 30 ? -(x - 30) * 0.2 : 0));
      b.smoothWater(); b.paintWater();
      b.stampTree("big-oak", 20, 9);
      b.put("벤치", 18, 16, { owner: "언덕 느티나무", purpose: "바다를 보는 벤치" });
      b.put("벤치", 22, 16, { owner: "언덕 느티나무", purpose: "바다를 보는 벤치" });
      b.put("돌 석상", 26, 11, { owner: "언덕 느티나무", purpose: "옛 약속을 새긴 석상" });
      b.exits([{ side: "north", at: 20, meets: "마을 뒷길" }]);
      b.spine([["exit:0", [20, 6], [17, 12], [20, 17]], [[20, 17], [30, 22]]]);
      b.paintRoads();
      b.pier(30, 22, "south", 3);
      b.forest({ bands: { north: [3, 1.5], west: [4, 2], east: [4, 2] }, blobs: [[3, 3, 5, 4, 10], [41, 3, 5, 4, 10]], clear: [[20, 14, 20, 14, 14]] });
      b.edgeClumps(3);
      b.threes(348, 10, [8, 8, 28, 16]);
      b.threes(288, 5, [8, 8, 28, 16]);
      b.tallGrass(3, [4, 8]);
    },
  });

  add({
    id: "scene-flashback-burned-village", category: "scenes", name: "회상 · 불탄 고향 마을", tilesetId: F, width: 44, height: 36, seed: 7551, theme: "ruins",
    purpose: "주인공 회상 속 불탄 고향. 지붕 내려앉은 집들, 꺼져 가는 불씨(모닥불·화로), 쓰러진 우물가와 부서진 울타리",
    note: "지붕이 내려앉고 벽만 남은 집 넷이 우물 광장을 둘러싸고, 집 앞마다 아직 꺼지지 않은 불씨가 연기를 올린다. 우물가엔 뒤집힌 짐수레와 흩어진 궤짝, 부서진 울타리와 돌무더기, 마을 어귀엔 마른나무와 해골이 남았다",
    build(b) {
      b.pave(b.ellipseCells(22, 17, 6, 4, 0.2), "cobble", { name: "불탄 우물 광장" });
      b.put("낮은 돌 우물", 21, 16, { purpose: "무너진 우물" });
      for (const [t, x, y] of [[0, 4, 3], [2, 33, 3], [1, 4, 22], [6, 34, 23]]) b.ruin(b.houseNear(t, x, y, { role: "불탄 집", window: 88 }));
      Vnear(b, "cart:crates", 25, 19, { on: "any", purpose: "버려진 짐수레" });
      b.exits([{ side: "south", at: 22, meets: "마을 어귀 길" }]);
      b.spine([["exit:0", [22, 28], [22, 21]], [[16, 17], [10, 12]], [[28, 17], [36, 12]], [[16, 17], [10, 30]], [[28, 17], [37, 31]]]);
      b.connect(); b.paintRoads();
      b.props([["모닥불", 12, 12, "꺼져 가는 불씨", "불탄 집"], ["모닥불", 31, 12, "꺼져 가는 불씨", "불탄 집"], ["모닥불", 13, 30, "꺼져 가는 불씨", "불탄 집"],
        ["부서진 울타리", 16, 24], ["부서진 울타리", 17, 24], ["돌 무더기", 28, 24], ["해골", 20, 32], ["마른나무", 40, 18], ["마른나무", 3, 17]]);
      piles(b, [["cargo", 18, 20, "흩어진 궤짝"]]);
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 34, 5, 3, 10], [41, 34, 5, 3, 10]], clear: [[22, 17, 30, 24, 14]] });
      b.edgeClumps(2, ["small-bush", "round-bush"]);
      b.tallGrass(8, [5, 10]);
      b.threes(740, 4, null, 2);
    },
  });

  add({
    id: "scene-farewell-coach-stop", category: "scenes", name: "이별의 역마차 정류장", tilesetId: F, width: 42, height: 32, seed: 7561,
    purpose: "마을 어귀 역마차 정류장의 이별 장면. 떠날 푸른 역마차, 짐 궤짝, 배웅하는 벤치와 이정표, 정류장 주막",
    note: "마을 어귀 큰길가 흙 정류장에 푸른 역마차가 말을 매고 떠날 채비를 한다. 마차 곁엔 여행 궤짝과 짐, 길 건너 배웅 벤치와 돌등, 이정표가 먼 도시를 가리킨다. 정류장 뒤엔 역참 주막과 마구간",
    build(b) {
      b.exits([{ side: "west", at: 16, meets: "마을 안길" }, { side: "east", at: 16, meets: "먼 도시로 가는 큰길(필드)" }]);
      b.spine([["exit:0", [20, 16], "exit:1"]]);
      b.pave(b.rectCells(14, 11, 16, 4), "dirt", { name: "역마차 정류장" });
      V(b, "coach:blue", 18, 12, { on: "any", purpose: "떠날 역마차" });
      piles(b, [["luggage", 15, 11, "여행 궤짝"], ["luggage", 26, 12, "여행 짐"]]);
      b.houseNear(4, 12, 2, { role: "역참 주막", yard: "tavern", side: "right", window: 86 });
      b.houseNear(7, 27, 3, { role: "마구간", yard: "storage", side: "left", window: 87 });
      b.houseNear(1, 30, 21, { role: "집", yard: "garden", side: "left", window: 85 });
      b.connect(); b.paintRoads();
      b.props([["벤치", 18, 19, "배웅 벤치"], ["돌등", 16, 19, "정류장 등불"], ["나무 이정표", 24, 19, "먼 도시 이정표"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [3, 1.5] }, blobs: [[3, 30, 5, 3, 10], [39, 30, 5, 3, 10]], clear: [[21, 15, 30, 10, 14]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 3);
    },
  });

  add({
    id: "scene-army-camp", category: "scenes", name: "결전 전야 군영", tilesetId: F, width: 54, height: 42, seed: 7571, as: "region", regionKind: "terrain", gate: "field",
    purpose: "결전 전날 밤 들판의 군영. 가운데 지휘관 천막과 작전 탁자, 둘레 병사 천막 줄, 모닥불, 무기 거치대, 보급 마차와 말, 목책 둘레",
    note: "들판에 목책으로 둘러친 군영 한가운데 보라 지휘관 천막과 작전 탁자가 있고, 그 둘레로 병사 천막 여섯이 두 줄로 섰다. 천막 줄마다 모닥불과 창걸이, 동쪽엔 보급 포장마차 둘과 군마, 건초 더미. 남쪽 목책 문에 경비 초소 부스 둘",
    build(b) {
      const fx = 10, fy = 7;
      V(b, "pavilion:보라", 25, 12, { purpose: "지휘관 천막" });
      b.props([["가로 탁자", 25, 16, "작전 탁자", "지휘관 천막"], ["성 깃발", 23, 12, "군기", "지휘관 천막"], ["성 깃발", 29, 12, "군기", "지휘관 천막"]]);
      for (const [x, y] of [[13, 10], [13, 16], [13, 22], [36, 10], [36, 16], [36, 22]]) b.put("천막", x, y, { owner: "군영", purpose: "병사 천막" });
      for (const [x, y] of [[18, 13], [18, 20], [33, 13], [33, 20]]) b.put("모닥불", x, y, { owner: "군영", purpose: "천막 줄 모닥불" });
      for (const [x, y] of [[17, 10], [17, 23], [34, 10], [34, 23]]) b.put("무기 거치대", x, y, { owner: "군영", purpose: "창걸이" });
      Vnear(b, "wagon:canvas", 41, 28, { purpose: "보급 포장마차(말 매어 둠)" }); Vnear(b, "wagon:red", 30, 28, { purpose: "보급 마차" });
      V(b, "horse:left", 21, 28, { purpose: "군마" }); V(b, "horse:right", 17, 28, { purpose: "군마" });
      for (const [x, y] of [[23, 29], [24, 29]]) Vnear(b, "haybale", x, y, { purpose: "군마 건초" }, 2);
      for (let x = fx; x <= 44; x += 3) if (x < 24 || x > 28) V(b, "barrier", x, 32, { purpose: "군영 목책" });
      V(b, "booth:red", 24, 33, { purpose: "경비 초소" }); V(b, "booth:red", 29, 33, { purpose: "경비 초소" });
      b.exits([{ side: "south", at: 27, meets: "결전의 들판(필드)" }]);
      b.spine([["exit:0", [27, 36], [27, 18]], [[27, 25], [15, 25], [15, 13]], [[27, 25], [39, 25], [39, 13]]]);
      b.paintRoads();
      b.forest({ bands: { north: [3, 1.5], west: [3, 1.5], east: [3, 1.5], south: [2, 1] }, blobs: [[3, 40, 6, 4, 12], [51, 40, 6, 4, 12]], clear: [[27, 20, 40, 30, 16]], seedShift: fy });
      b.edgeClumps(3);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 4);
    },
  });

  add({
    id: "scene-duel-ring", category: "scenes", name: "달빛 결투장", tilesetId: F, width: 38, height: 32, seed: 7581, theme: "ruins", gate: "field",
    purpose: "숲속 옛 돌기둥 원 안의 결투장. 가운데 마법진, 기둥 둘레 화로 넷, 입회인 벤치",
    note: "숲속 빈터에 옛 흰 돌기둥 여섯이 둥글게 서고 그 가운데 흙바닥에 붉은 마법진이 그려졌다. 기둥 사이 화로 넷이 결투장을 밝히고, 남쪽 입구 곁엔 입회인 벤치와 칼걸이. 둘레는 짙은 숲",
    build(b) {
      b.pave(b.ellipseCells(19, 14, 7, 5, 0.05), "dirt", { name: "결투장 바닥" });
      V(b, "rune:red", 18, 13, { on: "any", purpose: "결투 마법진" });
      for (const [x, y] of [[12, 11], [26, 11], [12, 16], [26, 16], [16, 8], [22, 8]]) b.put("흰 돌기둥", x, y, { owner: "결투장", purpose: "옛 돌기둥" });
      for (const [x, y] of [[14, 9], [24, 9], [14, 19], [24, 19]]) V(b, "brazier", x, y, { purpose: "결투장 화로" });
      b.exits([{ side: "south", at: 19, meets: "숲길(필드)" }]);
      b.spine([["exit:0", [19, 24], [19, 19]]]);
      b.paintRoads();
      b.props([["벤치", 21, 22, "입회인 벤치", "결투장"], ["무기 거치대", 16, 22, "칼걸이", "결투장"]]);
      b.forest({ bands: { north: [4, 2], west: [4, 2], east: [4, 2], south: [3, 1.5] }, clear: [[19, 15, 20, 16, 14]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
    },
    extraTargets: [[19, 14]],
  });

  // ── boss stages ──
  add({
    id: "boss-dragon-crater", category: "boss", name: "용의 분화구 결전장", tilesetId: ASH, width: 46, height: 40, seed: 7601, gate: "field", fill: { spotCap: 30 },
    purpose: "화산 분화구 바닥의 용 결전장. 붉은 봉인진, 둘레 화로와 흰 기둥, 흩어진 해골, 용이 지키는 보물 궤",
    note: "잿빛 분화구 한가운데 붉은 봉인 마법진이 있고 그 위가 용이 내려앉는 결전장이다. 마법진 둘레를 화로 여섯과 부서진 흰 기둥이 둥글게 두르고, 북쪽 바위 곁엔 용이 모은 보물 궤와 해골이 쌓였다. 남쪽 잿빛 비탈길로 올라온다",
    build(b) {
      b.pave(b.ellipseCells(23, 18, 10, 7, 0.1), "dirt", { name: "분화구 결전장" });
      V(b, "rune:red", 22, 17, { on: "any", purpose: "용의 봉인 마법진" });
      for (const [x, y] of [[15, 14], [31, 14], [15, 21], [31, 21], [19, 11], [27, 11]]) V(b, "brazier", x, y, { purpose: "결전장 화로" });
      for (const [x, y] of [[13, 17], [33, 17]]) b.put("흰 돌기둥", x, y, { owner: "결전장", purpose: "부서진 옛 기둥" });
      piles(b, [["loot", 21, 8, "용이 모은 보물"], ["arms", 26, 8, "쓰러진 기사들의 칼"]]);
      b.exits([{ side: "south", at: 23, meets: "화산 비탈길(필드)" }]);
      b.spine([["exit:0", [23, 32], [23, 25]]]);
      b.paintRoads();
      b.props([["해골", 17, 8, "용에게 진 자", "결전장"], ["해골", 29, 25, "용에게 진 자", "결전장"], ["돌 무더기", 30, 8, "분화구 바위", "결전장"]]);
    },
    extraTargets: [[23, 18]],
  });

  add({
    id: "boss-demon-throne", category: "boss", name: "마왕의 옥좌 제단", tilesetId: ASH, width: 42, height: 38, seed: 7611, gate: "field", fill: { spotCap: 30 },
    purpose: "마왕이 기다리는 잿빛 제단. 무대 위 보라 옥좌, 옥좌 앞 보라 마법진, 양옆 기둥 줄과 화로, 붉은 융단 길",
    note: "잿빛 고원 북쪽 무대 위에 보라 옥좌가 놓였고 그 앞에 보라 마법진이 빛난다. 남쪽 입구에서 옥좌까지 붉은 융단이 곧게 뻗고, 융단 양옆에 흰 돌기둥 두 줄과 화로가 교대로 선다. 제단 둘레엔 해골과 돌무더기",
    build(b) {
      b.stage(15, 5, 11, 5, "마왕의 제단");
      V(b, "throne:purple", 19, 5, { on: "any", purpose: "마왕의 옥좌" });
      V(b, "rune:purple", 19, 11, { on: "any", purpose: "마왕의 마법진" });
      carpetV(b, 20, 14, 30, "제단 융단");
      for (const y of [15, 21, 27]) { b.put("흰 돌기둥", 16, y, { owner: "제단", purpose: "제단 기둥" }); b.put("흰 돌기둥", 24, y, { owner: "제단", purpose: "제단 기둥" }); }
      for (const y of [18, 24]) { V(b, "brazier", 16, y, { purpose: "제단 화로" }); V(b, "brazier", 24, y, { purpose: "제단 화로" }); }
      b.exits([{ side: "south", at: 20, meets: "마왕성 성문(던전)" }]);
      b.access.push({ role: "carpet", x: 20, y: 14 });
      b.spine([["exit:0", [20, 33], [20, 31]]]);
      b.paintRoads();
      b.props([["해골", 12, 12, "제물의 뼈", "제단"], ["해골", 28, 12, "제물의 뼈", "제단"], ["돌 무더기", 11, 20, "무너진 벽", "제단"], ["돌 무더기", 29, 26, "무너진 벽", "제단"]]);
    },
    extraTargets: [[20, 12]],
  });

  add({
    id: "boss-giant-ruins", category: "boss", name: "거인의 무너진 신전터", tilesetId: F, width: 50, height: 42, seed: 7621, theme: "ruins", gate: "field",
    purpose: "거인이 잠든 무너진 신전터. 금빛 큰 마법진, 쓰러진 기둥 줄과 돌무더기, 거인의 큰 비석과 오벨리스크",
    note: "숲속 무너진 신전터 한가운데 금빛 큰 마법진(거인의 잠자리)이 있고, 그 둘레 기둥 줄은 반쯤 쓰러져 돌무더기가 되었다. 북쪽엔 거인을 봉한 큰 비석과 오벨리스크 둘, 동서로 옛 계단 자리. 남쪽 숲길로 들어온다",
    build(b) {
      b.pave(b.ellipseCells(25, 20, 12, 8, 0.12), "cobble", { name: "무너진 신전 바닥" });
      V(b, "rune:gold", 23, 18, { on: "any", purpose: "거인의 봉인 마법진" });
      for (const [x, y] of [[15, 14], [19, 14], [31, 14], [35, 14], [15, 25], [35, 25]]) b.put("흰 돌기둥", x, y, { owner: "신전터", purpose: "신전 기둥" });
      for (const [x, y] of [[23, 14], [27, 25], [19, 25], [31, 25]]) b.put("돌 무더기", x, y, { owner: "신전터", purpose: "쓰러진 기둥 잔해" });
      b.put("큰 비석", 24, 8, { owner: "신전터", purpose: "거인을 봉한 비석" });
      b.put("돌 오벨리스크", 20, 9, { owner: "신전터", purpose: "봉인 오벨리스크" }); b.put("돌 오벨리스크", 29, 9, { owner: "신전터", purpose: "봉인 오벨리스크" });
      b.exits([{ side: "south", at: 25, meets: "숲길(필드)" }]);
      b.spine([["exit:0", [25, 34], [25, 28]]]);
      b.paintRoads();
      b.forest({ bands: { north: [3, 1.5], west: [3, 1.5], east: [3, 1.5], south: [3, 1.5] }, clear: [[25, 19, 30, 22, 14]] });
      b.edgeClumps(3);
      b.tallGrass(6, [5, 10]);
      b.threes(740, 3, null, 2);
    },
    extraTargets: [[25, 20]],
  });

  add({
    id: "boss-ice-wyrm-lake", category: "boss", name: "얼음 용의 호수", tilesetId: SNOW, width: 46, height: 40, seed: 7631, gate: "field",
    purpose: "얼어붙은 호수 위 얼음 용 결전장. 얼음판 가운데 푸른 봉인진 대신 보라 마법진, 호숫가 화로와 쓰러진 기사의 칼",
    note: "눈 덮인 침엽 숲에 둘러싸인 큰 호수가 꽁꽁 얼어 걸어서 들어간다. 얼음판 한가운데 보라 봉인 마법진이 있고, 호숫가 네 곳에 꺼지지 않는 화로가 선다. 남쪽 물가엔 쓰러진 기사의 칼과 궤, 해골. 남쪽 눈길로 온다",
    build(b) {
      b.pond(23, 17, 13, 8, 0.14); b.smoothWater(); b.paintWater(); b.freeze();
      V(b, "rune:purple", 22, 16, { on: "any", purpose: "얼음 용의 봉인 마법진" });
      for (const [x, y] of [[8, 16], [38, 16], [23, 7], [16, 27]]) Vnear(b, "brazier", x, y, { purpose: "호숫가 화로" }, 3);
      piles(b, [["arms", 28, 28, "쓰러진 기사의 칼과 궤"]]);
      b.exits([{ side: "south", at: 23, meets: "설원 길(필드)" }]);
      b.spine([["exit:0", [23, 32], [23, 26]]]);
      b.paintRoads();
      b.props([["해골", 25, 29, "쓰러진 기사", "호숫가"]]);
      b.forest({ bands: { north: [3, 1.5], west: [3, 1.5], east: [3, 1.5], south: [2, 1] }, clear: [[23, 17, 32, 22, 14]], noise: 0.7 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
    extraTargets: [[23, 17]],
  });

  add({
    id: "boss-sand-serpent-pit", category: "boss", name: "모래 뱀의 구덩이", tilesetId: SAND, width: 46, height: 40, seed: 7641, gate: "field",
    purpose: "사막 한가운데 모래 뱀이 솟는 구덩이. 금빛 큰 마법진 둘레 오벨리스크 넷, 반쯤 묻힌 대상 마차와 짐",
    note: "모래언덕 사이 움푹한 모래 구덩이 가운데 금빛 큰 마법진이 드러나 있고, 네 귀퉁이에 옛 오벨리스크가 섰다. 구덩이 가장자리엔 모래 뱀에게 당한 대상의 포장마차와 흩어진 짐, 해골. 서쪽 모랫길로 온다",
    build(b) {
      b.pave(b.ellipseCells(24, 19, 11, 8, 0.1), "sand", { name: "모래 구덩이" });
      V(b, "rune:gold", 22, 17, { on: "any", purpose: "모래 뱀의 봉인 마법진" });
      for (const [x, y] of [[16, 12], [31, 12], [16, 24], [31, 24]]) b.put("돌 오벨리스크", x, y, { owner: "구덩이", purpose: "봉인 오벨리스크" });
      Vnear(b, "wagon:red", 34, 29, { purpose: "모래 뱀에게 당한 대상 마차" });
      piles(b, [["luggage", 30, 31, "흩어진 대상 짐"], ["jars", 37, 32, "깨진 물항아리"]]);
      b.exits([{ side: "west", at: 19, meets: "사막 대상 길(필드)" }]);
      b.spine([["exit:0", [13, 19]]]);
      b.paintRoads();
      b.props([["해골", 29, 27, "대상의 뼈", "구덩이"]]);
    },
    extraTargets: [[24, 19]],
  });

  add({
    id: "boss-forest-spirit-grove", category: "boss", name: "숲 정령의 성소", tilesetId: F, width: 42, height: 38, seed: 7651, gate: "field",
    purpose: "타락한 숲 정령이 기다리는 성소. 울타리 친 못과 석상, 못 앞 금빛 마법진, 돌등 길",
    note: "짙은 숲 깊은 곳 울타리 친 못과 석상(정령의 옛 성소) 앞에 금빛 마법진이 빛나고, 그 위가 정령과의 결전장이다. 남쪽 숲길에서 돌등 네 쌍이 마법진까지 길을 밝히고, 둘레엔 꽃 관목과 들꽃",
    build(b) {
      const s = b.landmark("shrine-pond", 13, 3);
      V(b, "rune:gold", 18, 17, { on: "any", purpose: "정령의 마법진" });
      b.exits([{ side: "south", at: 20, meets: "숲길(필드)" }]);
      b.spine([["exit:0", [20, 30], [20, 23]], [[20, 17], s ? [s.gate.x, s.gate.y + 1] : [20, 15]]]);
      b.paintRoads();
      for (const y of [24, 27]) { b.put("돌등", 18, y, { owner: "성소 길", purpose: "성소 길 돌등" }); b.put("돌등", 22, y, { owner: "성소 길", purpose: "성소 길 돌등" }); }
      b.forest({ bands: { north: [2, 1], west: [4, 2], east: [4, 2], south: [3, 1.5] }, clear: [[20, 16, 26, 24, 14]] });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
      b.threes(768, 4, [8, 12, 26, 18], 2);
      b.threes(348, 6);
    },
    extraTargets: [[20, 19]],
  });

  // ── temples ──
  add({
    id: "temple-forest-forecourt", category: "temples", name: "새벽 성당 앞뜰", tilesetId: F, width: 44, height: 40, seed: 7701,
    purpose: "순례자가 모이는 성당 앞뜰. 돌 광장과 분수 우물, 금빛 성스러운 문양, 순례자 천막과 봉헌 촛대(화로)",
    note: "북쪽 돌벽 성당 문 앞 돌 광장 한가운데 금빛 성스러운 문양이 새겨져 있고, 그 둘레에 화로 한 쌍과 꽃 화단, 분수 우물이 있다. 광장 서쪽엔 순례자 천막 둘과 짐, 동쪽엔 수도사 숙소와 약초밭. 남쪽 순례길이 광장으로 들어온다",
    plaza: [["cobble", ["꽃 화단", "화분", "벤치"]]],
    build(b) {
      const c = b.landmark("church", 18, 2);
      const dx = c.doors[0].x;
      b.pave(b.ellipseCells(dx + 0.5, 18, 10, 5.5, 0.05), "cobble", { name: "성당 앞 광장" });
      V(b, "rune:gold", dx - 2, 16, { on: "any", purpose: "성스러운 문양" });
      braziers(b, dx, 14, 4, "봉헌 화로");
      b.put("낮은 돌 우물", dx + 6, 20, { purpose: "광장 분수 우물" });
      V(b, "pavilion:푸른", 4, 15, { purpose: "순례자 천막" }); V(b, "pavilion:초록", 4, 21, { purpose: "순례자 천막" });
      b.houseNear(7, 34, 5, { role: "수도사 숙소", yard: "herbs", side: "left", window: 87 });
      b.exits([{ side: "south", at: dx, meets: "순례길(필드)" }]);
      b.spine([["exit:0", [dx, 32], [dx, 24]], [[dx - 9, 18], [8, 19]], [[dx + 9, 18], [37, 14]]]);
      b.connect(); b.paintRoads();
      piles(b, [["luggage", 9, 23, "순례자 짐"]]);
      b.yards();
      b.gardenPlots(1, { owner: "수도원 약초밭" });
      b.forest({ bands: { west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 38, 5, 3, 10], [41, 38, 5, 3, 10], [3, 3, 5, 4, 10]], clear: [[dx, 18, 28, 18, 14]] });
      b.edgeClumps(3);
      b.threes(348, 4);
    },
    extraTargets: [[dx0(18), 17]],
  });

  add({
    id: "temple-sanctuary-gate", category: "temples", name: "정령 성역 입구", tilesetId: F, width: 42, height: 40, seed: 7711, gate: "field",
    purpose: "성역으로 들어가는 숲길 입구. 오벨리스크 두 쌍이 지키는 돌길, 성역 문 앞 금빛 문양과 화로, 순례자 쉼터",
    note: "남쪽 숲길이 북쪽 성역 못으로 이어지고, 길 입구와 중간을 돌 오벨리스크 두 쌍이 지킨다. 성역 울타리 문 앞 흙마당엔 금빛 문양과 화로 한 쌍이 있고, 길가 순례자 쉼터에 벤치와 천막. 둘레는 짙은 숲과 꽃 관목",
    build(b) {
      const s = b.landmark("shrine-pond", 13, 2);
      V(b, "rune:gold", 18, 16, { on: "any", purpose: "성역 문 앞 문양" });
      braziers(b, 20, 17, 4, "성역 화로");
      b.exits([{ side: "south", at: 20, meets: "숲 순례길(필드)" }]);
      b.spine([["exit:0", [20, 34], [20, 21]], [[20, 16], [s.gate.x, s.gate.y + 1]]]);
      b.paintRoads();
      for (const y of [23, 30]) { b.put("돌 오벨리스크", 18, y, { owner: "성역 길", purpose: "성역 길 오벨리스크" }); b.put("돌 오벨리스크", 22, y, { owner: "성역 길", purpose: "성역 길 오벨리스크" }); }
      b.props([["천막", 26, 26, "순례자 쉼터 천막"], ["벤치", 26, 30, "순례자 쉼터", "천막"], ["모닥불", 30, 29, "쉼터 모닥불"]]);
      b.forest({ bands: { west: [4, 2], east: [4, 2], south: [3, 1.5] }, clear: [[20, 18, 24, 26, 14]] });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
      b.threes(768, 4, [8, 14, 26, 20], 2);
      b.threes(348, 5);
    },
  });

  add({
    id: "temple-snow-monastery", category: "temples", name: "설봉 수도원 앞마당", tilesetId: SNOW, width: 44, height: 38, seed: 7721,
    purpose: "눈 덮인 산 수도원 앞마당. 성당과 수도사 숙소, 마당 가운데 화로 둘과 성스러운 문양, 순례자 짐수레",
    note: "눈 덮인 수도원 성당 앞 돌마당 가운데 금빛 문양이 눈 속에 드러나 있고 화로 둘이 불을 지핀다. 마당 둘레엔 수도사 숙소와 땔감 창고, 순례자가 끌고 온 짐수레와 말. 눈 덮인 침엽 숲이 둘러싼다",
    plaza: [["cobble", ["장작 더미", "나무 상자", "벤치"]]],
    build(b) {
      const c = b.landmark("church", 18, 2);
      const dx = c.doors[0].x;
      b.pave(b.ellipseCells(dx + 0.5, 17, 9, 5, 0.05), "cobble", { name: "수도원 마당" });
      V(b, "rune:gold", dx - 2, 15, { on: "any", purpose: "성스러운 문양" });
      braziers(b, dx, 13, 4, "마당 화로");
      Vnear(b, "cart:crates", 10, 24, { purpose: "순례자 짐수레" }); V(b, "horse:right", 6, 24, { purpose: "짐수레 말" });
      b.houseNear(7, 3, 4, { role: "수도사 숙소", yard: "woodwork", side: "right", window: 87 });
      b.houseNear(6, 35, 5, { role: "땔감 창고", yard: "storage", side: "left", window: 87 });
      b.exits([{ side: "south", at: dx, meets: "눈 덮인 산길(필드)" }]);
      b.spine([["exit:0", [dx, 30], [dx, 23]], [[dx - 8, 17], [8, 13]], [[dx + 8, 17], [37, 13]]]);
      b.connect(); b.paintRoads();
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[3, 36, 5, 3, 10], [41, 36, 5, 3, 10]], clear: [[dx, 17, 26, 16, 14]], noise: 0.7 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  add({
    id: "temple-desert-sun", category: "temples", name: "태양 신전 앞 광장", tilesetId: SAND, width: 46, height: 40, seed: 7731, fill: { flowerCap: 16 },
    purpose: "사막 태양 신전 앞 광장. 오벨리스크 줄이 이끄는 길 끝 금빛 문양, 신전 천막과 봉헌 항아리, 순례 대상",
    note: "모래 광장 북쪽 신전(돌벽 성당) 앞에 금빛 태양 문양이 새겨져 있고, 남쪽 입구에서 문양까지 오벨리스크 세 쌍이 길을 이끈다. 광장 둘레엔 순례자 천막과 봉헌 항아리 더미, 대상 포장마차. 물가 야자수 곁 사제의 집",
    build(b) {
      const c = b.landmark("church", 19, 2);
      const dx = c.doors[0].x;
      b.pave(b.ellipseCells(dx + 0.5, 19, 10, 6, 0.06), "sand", { name: "신전 광장" });
      V(b, "rune:gold", dx - 2, 14, { on: "any", purpose: "태양 문양" });
      for (const y of [21, 25, 29]) { b.put("돌 오벨리스크", dx - 3, y, { owner: "신전 길", purpose: "신전 길 오벨리스크" }); b.put("돌 오벨리스크", dx + 3, y, { owner: "신전 길", purpose: "신전 길 오벨리스크" }); }
      V(b, "pavilion:붉은", 9, 16, { purpose: "순례자 천막" }); V(b, "pavilion:보라", 34, 16, { purpose: "순례자 천막" });
      Vnear(b, "wagon:red", 34, 26, { purpose: "순례 대상 포장마차" });
      b.pond(8, 30, 4, 2.5, 0.15); b.smoothWater(); b.paintWater();
      b.houseNear(3, 3, 4, { role: "사제의 집", yard: "desert", side: "right", window: 86 });
      b.exits([{ side: "south", at: dx, meets: "사막 순례길(필드)" }]);
      b.spine([["exit:0", [dx, 34], [dx, 17]], [[dx - 8, 19], [8, 12]]]);
      b.connect(); b.paintRoads();
      piles(b, [["jars", 14, 20, "봉헌 항아리"], ["jars", 30, 21, "봉헌 항아리"]]);
      b.singlesWhere(770, 5, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 3, { shore: true });
      b.yards();
    },
  });

  return plans;
}
const dx0 = (x) => x + 3;
