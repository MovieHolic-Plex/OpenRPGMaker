// Round-2 outdoor plans (2026-09-25): the places an ordinary fantasy RPG still lacked — the demon lord's castle seen from
// outside, an early forest maze, a snowy dragon summit (boss field), a forest campsite, a farm with pastures and a
// lighthouse cape. Same OutdoorMap builder as lib/rpg-outdoor-plans.mjs; exits only say what they meet (the matching
// dungeons and interiors of tiledata/rpg-dungeons and tiledata/rpg-interiors carry the same names).
const F = "forest_harmony", SNOW = "forest_harmony_snow", ASH = "forest_harmony_volcano";
// Round wall tower of the castle-town wall end (2×8), as in OutdoorMap.gateTowers: [lower, upper] per cell.
const TOWER = [[[21, 24], [412, 25]], [[138, -1], [139, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[140, -1], [141, -1]], [[142, -1], [143, -1]], [[140, -1], [141, -1]], [[81, 54], [81, 55]]];
// Moor a boat on the nearest open water spot to (x, y) where the whole hull floats.
const moorNear = (b, name, x, y, opt) => {
  const p = b.part(name), fits = (X, Y) => p.upper.every((row, dy) => row.every((t, dx) => { const i = b.at(X + dx, Y + dy); return t < 0 || (b.inside(X + dx, Y + dy) && b.water.has(i) && !b.bridgeCells.has(i) && b.upper[i] === -1); }));
  const spots = []; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (fits(x + dx, y + dy)) spots.push([Math.abs(dx) + Math.abs(dy), x + dx, y + dy]);
  spots.sort((a, c) => a[0] - c[0]);
  if (!spots.length) throw new Error(`No water for ${name} near ${x},${y}`);
  b.moor(name, spots[0][1], spots[0][2], opt);
};
const tower = (b, x, y, name) => b.stampPiece(name, x, y, 2, 8, TOWER.flat().map((c) => c[0]), TOWER.flat().map((c) => c[1]));

export const ROUND2_PLANS = [
  {
    id: "outdoor-demon-castle", gate: "field", fill: { spotCap: 4 }, name: "마왕성 외관 · 재의 성채", category: "volcano", tilesetId: ASH, width: 60, height: 56, seed: 8101,
    purpose: "마지막 던전 앞마당. 재 들판 윗단에 마왕성이 서고, 성 앞을 용암 강이 가른다. 강이 끊긴 현무암 둑길 하나로만 성문에 닿는다",
    note: "화산 재 절벽 윗단에 큰 성채가 서고 남쪽 정문이 아래를 내려다본다. 절벽 가운데 돌계단으로 성 앞뜰에 오르고, 계단 아래 재 들판을 용암 강이 동서로 가로지른다. 남쪽 재 길은 용암 강이 끊긴 현무암 둑길 하나로 건넌다. 둑길 목에 경고 표지와 마지막 야영 자리(모닥불·통나무)가 있고, 둘레엔 화산 봉우리와 잎 없는 고목 덩이뿐이다. 성문은 마왕성 정문 홀(던전)로 이어진다",
    leak: false,
    build(b) {
      b.cliffs([{ points: [[0, 36], [18, 36], [20, 37], [40, 37], [42, 36], [59, 36]], height: 5, left: "open", right: "open" }]);
      b.stairs([[29, 37, 5]]);
      const castle = b.landmark("castle", 9, 1);
      // The lava river runs east-west (a river() channel is only as wide as its x-span, so paint the band directly),
      // broken once by a basalt causeway below the stairs.
      b.waterWhere((x, y) => Math.abs(y - (47 + 1.3 * Math.sin(x / 5.5))) < 1.7 && (x < 27 || x > 33));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 30, meets: "잿빛 능선 용암 폭포길(필드) 북쪽 출구" }]);
      const gate = castle.doors[castle.doors.length >> 1];
      b.spine([["exit:0", [30, 50]], ["stairs-bottom:0", [30, 45]], ["stairs-top:0", [gate.x, gate.y + 1]]]);
      b.connect();
      b.paintRoads();
      b.props([["나무 이정표", 33, 52, "마왕성 경고 표지"], ["모닥불", 25, 52, "마지막 야영 모닥불"], ["통나무 더미", 24, 52, "모닥불 곁 통나무", "야영"], ["통나무 더미", 26, 53, "모닥불 곁 통나무", "야영"]]);
      b.peaks([[3, 43, true], [52, 42, true], [4, 51, true], [51, 51, true]]);
      return [30, 51];
    },
    extraTargets: [],
  },
  {
    id: "outdoor-forest-maze", gate: "field", name: "미혹의 숲 미로", category: "fields", tilesetId: F, width: 56, height: 48, seed: 8201,
    purpose: "초반 던전 대신 쓰는 숲 미로. 짙은 숲 사이 오솔길이 갈라지고 막다른 길마다 상자, 한가운데 빈터에 이끼 낀 석상",
    note: "남쪽 숲 어귀에서 들어가면 짙은 숲 사이로 흙 오솔길이 여러 갈래로 갈라진다. 막다른 길 넷에 나무 상자가 있고, 미로 한가운데 둥근 빈터에 이끼 낀 요정 석상과 돌등 둘이 선다. 제대로 된 길은 빈터를 지나 북쪽 출구로 빠진다. 길 밖은 모두 숲이라 가로질러 갈 수 없다",
    leak: false,
    build(b) {
      b.exits([{ side: "south", at: 10, meets: "숲 어귀 필드 북쪽 출구" }, { side: "north", at: 44, meets: "요정 샘 신성한 숲 남쪽 입구" }]);
      b.pave(b.ellipseCells(28, 24, 4.5, 3.2, 0.06), "dirt", { name: "숲 속 빈터" });
      // The true path (south → clearing → north) and the false branches that end in dead ends.
      b.spine([
        ["exit:0", [10, 40], [20, 40], [20, 32], [14, 32], [14, 24], [24, 24]],
        [[32, 24], [40, 24], [40, 14], [30, 14], [30, 8], [44, 8], "exit:1"],
        [[10, 40], [4, 40], [4, 30]],
        [[20, 36], [34, 36], [34, 42], [46, 42]],
        [[34, 36], [48, 36], [48, 28]],
        [[14, 28], [6, 28], [6, 16], [18, 16], [18, 6]],
        [[40, 18], [50, 18], [50, 6]],
        [[30, 11], [22, 11]],
      ]);
      b.paintRoads(undefined, { widen: false });
      b.props([["돌 석상", 28, 21, "이끼 낀 요정 석상", "숲 속 빈터"], ["돌등", 25, 26, "빈터 등불", "숲 속 빈터"], ["돌등", 31, 26, "빈터 등불", "숲 속 빈터"],
        ["나무 상자", 4, 29, "막다른 길 보물 상자", "미로"], ["나무 상자", 46, 41, "막다른 길 보물 상자", "미로"], ["나무 상자", 18, 5, "막다른 길 보물 상자", "미로"],
        ["나무 상자", 50, 5, "막다른 길 보물 상자", "미로"], ["나무 이정표", 13, 38, "헷갈리는 표지", "미로"]]);
      b.forest({ bands: { north: [30, 0], south: [30, 0], west: [30, 0], east: [30, 0] }, coverage: 1, noise: 0.3 });
    },
    extraTargets: [[4, 30], [46, 42], [18, 6], [50, 6], [48, 28], [22, 11]],
  },
  {
    id: "outdoor-dragon-peak", gate: "field", name: "용의 산 정상 · 눈 덮인 둥지", category: "snow", tilesetId: SNOW, width: 50, height: 60, seed: 8301,
    purpose: "용과 싸우는 보스 필드. 눈 절벽 세 단을 계단으로 올라 산꼭대기 돌 광장(둥지)에 닿는다. 둥지 둘레에 부서진 기둥과 바위 무더기",
    note: "남쪽 산기슭에서 눈 절벽 세 단을 돌계단 셋으로 갈지자로 오른다. 가운뎃단에 얼어붙은 산정 연못과 쉼터 모닥불이 있고, 윗단 한가운데 넓은 돌 광장이 용의 둥지다. 둥지 가장자리에 부서진 흰 돌기둥과 바위 무더기가 둥글게 흩어져 있고, 북쪽은 하늘로 트인 절벽 끝이다. 둘레는 눈 덮인 침엽 숲",
    leak: false,
    build(b) {
      b.cliffs([{ points: [[0, 46], [14, 46], [16, 47], [34, 47], [36, 46], [49, 46]], height: 5, left: "open", right: "open" },
        { points: [[0, 32], [12, 32], [14, 31], [34, 31], [36, 32], [49, 32]], height: 5, left: "open", right: "open" },
        { points: [[0, 17], [16, 17], [18, 18], [32, 18], [34, 17], [49, 17]], height: 5, left: "open", right: "open" }]);
      b.stairs([[36, 46, 5], [12, 32, 5], [30, 18, 5]]);
      b.pond(38, 39, 4.5, 2.4, 0.12); b.smoothWater(); b.paintWater(); b.freeze();
      b.pave(b.ellipseCells(24, 9, 5.6, 3.2, 0.08), "cobble", { name: "용의 둥지 돌 광장" });
      b.exits([{ side: "south", at: 24, meets: "눈보라 빙벽 고갯길 북쪽 출구" }]);
      b.spine([["exit:0", [24, 55], [37, 53], "stairs-bottom:0"], ["stairs-top:0", [30, 42], [13, 40], "stairs-bottom:1"], ["stairs-top:1", [22, 28], [31, 26], "stairs-bottom:2"], ["stairs-top:2", [26, 14]]]);
      b.connect();
      b.paintRoads();
      b.props([["흰 돌기둥", 17, 7, "부서진 둥지 기둥", "용의 둥지"], ["흰 돌기둥", 31, 7, "부서진 둥지 기둥", "용의 둥지"], ["흰 돌기둥", 18, 11, "부서진 둥지 기둥", "용의 둥지"], ["흰 돌기둥", 30, 11, "부서진 둥지 기둥", "용의 둥지"],
        ["흰 돌기둥", 21, 5, "부서진 둥지 기둥", "용의 둥지"], ["흰 돌기둥", 27, 5, "부서진 둥지 기둥", "용의 둥지"], ["큰 비석", 23, 1, "둥지 뒤 옛 용 비석", "용의 둥지"],
        ["모닥불", 30, 38, "쉼터 모닥불", "산정 쉼터"], ["통나무 더미", 29, 38, "쉼터 통나무", "산정 쉼터"], ["장작 더미", 31, 38, "쉼터 장작", "산정 쉼터"], ["나무 이정표", 26, 51, "용의 산 경고 표지"]]);
      b.forest({ bands: { west: [5, 2], east: [5, 2], south: [2, 1] }, blobs: [[2, 24, 5, 6, 12], [47, 24, 5, 6, 12], [3, 54, 5, 4, 10], [46, 54, 5, 4, 10]], clear: [[24, 9, 13, 8, 20]], noise: 0.7 });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.threes(537, 3, null, 1);
    },
    extraTargets: [[24, 9], [38, 39]],
  },
  {
    id: "outdoor-forest-camp", name: "숲 속 모닥불 야영지", category: "scenes", tilesetId: F, width: 38, height: 30, seed: 8401,
    purpose: "여행 중 하룻밤 쉬는 장면. 개울가 숲 빈터에 천막 셋과 큰 모닥불, 짐수레 짐과 장작, 물 긷는 개울",
    note: "숲길이 지나는 개울가 빈터에 천막 세 채가 모닥불을 둘러싸고 선다. 모닥불 둘레에 통나무 의자, 천막 옆에 짐 상자·술통·장작 더미가 붙어 있다. 동쪽으로 개울이 흐르고 물가에 징검돌과 낚시 바구니가 있다. 서쪽 숲길로 들어와 북쪽으로 빠진다",
    build(b) {
      b.river({ width: 2, points: [[31, 0], [31, 8], [29, 14], [30, 20], [32, 29]], pools: [[29.5, 15, 3, 2.2]] });
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 15, meets: "숲길(필드) 동쪽 출구" }, { side: "north", at: 16, meets: "숲길(필드) 남쪽 출구" }]);
      b.pave(b.ellipseCells(17, 16, 6.5, 4.2, 0.08), "dirt", { name: "야영 빈터" });
      b.spine([["exit:0", [11, 16]], ["exit:1", [16, 11]]]);
      b.paintRoads();
      b.plazaUnroad();
      b.props([["모닥불", 17, 16, "야영 모닥불", "야영"], ["통나무 더미", 16, 16, "모닥불 통나무 의자", "야영"], ["통나무 더미", 18, 16, "모닥불 통나무 의자", "야영"], ["통나무 더미", 17, 18, "모닥불 통나무 의자", "야영"],
        ["천막", 11, 11, "여행자 천막", "야영"], ["천막", 19, 10, "여행자 천막", "야영"], ["천막", 21, 17, "여행자 천막", "야영"],
        ["나무 상자", 15, 20, "짐수레 짐", "야영"], ["술통", 16, 20, "짐수레 짐", "야영"], ["장작 더미", 12, 19, "모닥불 장작", "야영"], ["장작", 13, 19, "모닥불 장작", "야영"],
        ["나무통", 26, 15, "물 긷는 통", "개울"], ["낚시 바구니", 27, 18, "개울 낚시", "개울"], ["징검돌", 27, 12]]);
      b.forest({ bands: { north: [3, 1.5], south: [4, 2], west: [3, 1.5], east: [3, 1.5] }, blobs: [[3, 3, 6, 5, 12], [3, 27, 6, 5, 12], [36, 27, 5, 4, 10]], clear: [[17, 15, 11, 8, 18]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 4);
    },
  },
  {
    id: "outdoor-farm-ranch", name: "들녘 농장과 목장", category: "towns", tilesetId: F, width: 50, height: 40, seed: 8501,
    purpose: "마을 밖 농가 한 집. 농가·헛간·일꾼 집 셋, 울타리 친 목장 둘, 연못가 채소밭과 허수아비, 우물 마당",
    note: "들판 가운데 농가와 헛간이 마당을 끼고 마주 서고 마당에 우물이 있다. 동쪽에 울타리 친 목장 둘(문이 하나씩), 남서쪽 연못가에 채소밭과 허수아비, 헛간 옆에 장작·통나무·짐 상자가 쌓였다. 북쪽 흙길이 마을로, 남쪽 흙길이 들판으로 이어진다",
    build(b) {
      b.pond(10, 30, 5, 3, 0.14); b.smoothWater(); b.paintWater();
      b.house(1, 8, 6, { role: "농가", yard: "farm", side: "left", window: 85 });
      b.house(7, 20, 7, { role: "헛간", yard: "woodwork", side: "right", window: 87 });
      b.house(3, 20, 24, { role: "일꾼 집", yard: "laundry", side: "right", window: 86 });
      b.fenceRing(34, 5, 12, 9, 5, 2, "목장 울타리");
      b.fenceRing(34, 20, 12, 9, 5, 2, "양 목장 울타리");
      b.exits([{ side: "north", at: 26, meets: "마을 남쪽 길" }, { side: "south", at: 30, meets: "들판(필드) 북쪽 출구" }]);
      b.put("낮은 돌 우물", 16, 16, { purpose: "농가 마당 우물" });
      b.spine([["exit:0", [26, 17], [30, 30], "exit:1"], [[26, 17], [14, 17]], [[30, 16], [39, 15]], [[30, 30], [39, 30]]]);
      b.connect();
      b.paintRoads();
      b.props([["허수아비", 38, 9, "목장 허수아비", "목장"], ["나무통", 36, 7, "여물통", "목장"], ["나무통", 36, 23, "여물통", "양 목장"], ["장작 더미", 40, 24, "목장 장작", "양 목장"]]);
      b.gardenPlots(2, { near: 6, owner: "연못가 채소밭" });
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [1, 0.5], south: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [48, 38, 5, 4, 10]], clear: [[26, 18, 18, 14, 16]] });
      b.edgeClumps(3);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "outdoor-lighthouse-cape", name: "갈매기 곶 등대", category: "towns", tilesetId: F, width: 44, height: 38, seed: 8601,
    purpose: "바다로 튀어나온 곶 끝의 등대. 등대지기 집, 부두와 나룻배, 바위 해안",
    note: "동·남·서 삼면이 바다인 곶. 곶 끝 둥근 돌마당에 원통형 등대가 서고, 그 곁에 등대지기 집과 장작·통 마당이 있다. 서쪽 물가에 부두와 나룻배, 북쪽 숲길로 들어온다. 등대 문은 등대 꼭대기 방(실내)으로 이어진다",
    leak: false,
    build(b) {
      b.waterWhere((x, y) => {
        const cx = 22 + 1.2 * Math.sin(y / 5), half = y < 10 ? 30 : 14.5 - (y - 10) * 0.2 + 1.2 * Math.sin(y / 3.1);
        return Math.abs(x - cx) > half || y > 33 + 1.5 * Math.sin(x / 4);
      });
      b.smoothWater(); b.paintWater();
      b.pave(b.ellipseCells(22, 23, 5, 3.5, 0.06), "cobble", { name: "등대 돌마당" });
      tower(b, 21, 14, "등대 · 성곽 원탑 모양 등대");
      b.access.push({ role: "landmark-door", x: 21, y: 22 });
      b.house(3, 12, 12, { role: "등대지기 집", yard: "storage", side: "left", window: 86 });
      b.exits([{ side: "north", at: 22, meets: "해안 필드 남쪽 출구" }]);
      b.spine([["exit:0", [22, 8], [22, 12], [18, 13], [21, 21]]]);
      b.connect();
      b.paintRoads();
      b.pier(13, 26, "west", 4);
      moorNear(b, "나룻배", 5, 23, { purpose: "등대지기 나룻배" });
      b.props([["돌등", 19, 22, "돌마당 등불", "등대"], ["돌등", 25, 22, "돌마당 등불", "등대"], ["장작 더미", 26, 25, "등불 땔감", "등대"], ["술통", 24, 26, "기름통", "등대"],
        ["낚시 바구니", 15, 25, "부두 낚시", "부두"], ["밧줄 뭉치", 14, 27, "부두 짐", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [4, 1.5] }, blobs: [[4, 2, 6, 4, 12], [40, 2, 6, 4, 12]], clear: [[22, 18, 10, 10, 16]] });
      b.edgeClumps(3, ["round-bush", "small-bush", "tree"]);
      b.threes(537, 3, null, 1);
      b.threes(348, 4);
    },
    extraTargets: [[21, 22]],
  },
];

// The second world map (lib/rpg-outdoor-world.mjs, `islands`): a sea of islands south of the continent — the pirate
// cove, the swamp temple, the lighthouse cape, the dragon peak and the demon castle each on its own island or coast,
// joined across the water by ship lanes (recorded in the map meta; no walking road crosses the sea).
export const ARCHIPELAGO_WORLD = {
  id: "outdoor-world-archipelago", world: true, name: "남쪽 바다 섬들 해도", category: "world", tilesetId: "oprn_world_keyed", width: 72, height: 56, seed: 7201,
  purpose: "두 번째 월드맵. 큰 섬 넷과 작은 섬들이 흩어진 바다. 섬마다 항구가 있고 배길로 건넌다 — 등대 곶·해적 소굴·늪 신전·용의 산·마왕성",
  note: "바다 위에 큰 섬 넷과 작은 섬 여럿이 흩어져 있다. 북서 초록 섬엔 항구 마을·농장·등대 곶과 숲 미로·투기장 도시, 북동 설산 섬엔 용의 산 정상, 남서 늪 섬엔 늪 신전과 해적 소굴, 남동 화산 섬엔 마왕성이 선다. 섬 안은 흙길로 잇고, 섬과 섬 사이는 항구에서 항구로 가는 배길이다",
  gate: { maxSq: 7, screen: 0.62 }, snowLine: 0, landAt: 0.62,
  islands: [[0.27, 0.3, 0.2, 0.22], [0.74, 0.25, 0.15, 0.17], [0.24, 0.76, 0.16, 0.15], [0.72, 0.72, 0.17, 0.19], [0.5, 0.52, 0.05, 0.06], [0.5, 0.12, 0.04, 0.05], [0.94, 0.5, 0.03, 0.05]],
  patches: [[0.74, 0.25, 7, 7, "snow"], [0.17, 0.72, 3.5, 2.5, "marsh"], [0.72, 0.72, 8, 7, "sand"]],
  ranges: [{ points: [[0.7, 0.2], [0.8, 0.28]], width: 1.6, kind: "snowmountain" }, { points: [[0.64, 0.74], [0.74, 0.82]], width: 1.5 }, { points: [[0.2, 0.2], [0.3, 0.16]], width: 1.4 }],
  places: [
    { id: "farm-ranch", placeId: "outdoor-farm-ranch", name: "들녘 농장과 목장", icon: "house", kind: "town", at: [0.22, 0.26] },
    { id: "lighthouse-cape", placeId: "outdoor-lighthouse-cape", name: "갈매기 곶 등대", icon: "smalltower", kind: "town", at: [0.4, 0.4], coast: true, port: true },
    { id: "forest-maze", placeId: "outdoor-forest-maze", name: "미혹의 숲 미로", kind: "field", at: [0.17, 0.38] },
    { id: "forest-camp", placeId: "outdoor-forest-camp", name: "숲 속 모닥불 야영지", icon: "hut", kind: "scene", at: [0.3, 0.2] },
    { id: "arena-city", placeId: "dungeon-arena-floor", name: "투기장 도시", icon: "fortress", kind: "town", at: [0.32, 0.34] },
    { id: "dragon-peak", placeId: "outdoor-dragon-peak", name: "용의 산 정상", icon: "cave", kind: "field", at: [0.76, 0.22] },
    { id: "snow-harbor", placeId: "outdoor-snow-fortress", name: "설산 섬 나루", icon: "snowhouse", kind: "town", at: [0.68, 0.32], coast: true, port: true },
    { id: "swamp-temple", placeId: "dungeon-swamp-temple", name: "늪 신전", icon: "temple", kind: "sacred", at: [0.22, 0.74] },
    { id: "pirate-cove", placeId: "dungeon-pirate-cove", name: "해적 소굴", icon: "cave", kind: "sacred", at: [0.3, 0.82], coast: true, port: true },
    { id: "demon-castle", placeId: "outdoor-demon-castle", name: "마왕성 · 재의 성채", icon: "castle", kind: "town", at: [0.74, 0.68] },
    { id: "ash-landing", placeId: "outdoor-volcano-lavafall-ridge", name: "잿빛 상륙지", icon: "volcano", kind: "field", at: [0.66, 0.8], coast: true, port: true },
  ],
  lanes: [["lighthouse-cape", "snow-harbor"], ["lighthouse-cape", "pirate-cove"], ["pirate-cove", "ash-landing"], ["snow-harbor", "ash-landing"]],
};
