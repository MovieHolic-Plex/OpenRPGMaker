// More climate fields (2026-09-25): two more fields per climate sheet so each climate has three, each a different
// layout (not a recolour): snow ford and ice-wall pass, lava-fall ridge and lava-lake causeway, sandstone canyon pass
// and dune-sea caravan road, orchard hill road and maple valley. Same OutdoorMap builder as the other outdoor plans;
// exits only say which climate village or field they meet (tiledata/climate-villages, tiledata/field-routes).
// Desert and ash follow the user's taste (2026-09-25): no leafy trees, few leafless groves, no mesas or bones, no lone
// campfires, the open ground closed by calm climate ground (ridge dunes, thin lava cracks, dark flow plates).
const SNOW = "forest_harmony_snow", ASH = "forest_harmony_volcano", SAND = "forest_harmony_desert", AUTUMN = "forest_harmony_autumn";

export const CLIMATE_FIELD_PLANS = [
  // ── snow ──
  {
    id: "outdoor-snow-frozen-ford", gate: "field", name: "얼음강 나루 설원", category: "snow", tilesetId: SNOW, width: 64, height: 44, seed: 5311,
    purpose: "눈 절벽에서 폭포로 떨어진 강이 설원을 세로로 가르는 필드. 강 가운데가 얼어붙어 걸어서 건너는 얼음 여울이 되고, 하류는 흐르는 물이라 나무다리로 건넌다",
    note: "북쪽 눈 절벽을 넘은 강물이 폭포로 떨어져 설원을 남북으로 가른다. 강 허리의 넓은 여울은 꽁꽁 얼어 걸어서 건너는 얼음 나루가 되고, 하류는 다시 흐르는 물이라 나무다리가 놓였다. 서쪽 눈길은 얼음 나루와 다리 두 갈래로 동쪽에 닿고, 서쪽 돌계단으로 절벽 윗단 산촌 길에 오른다. 얼음 나루 서쪽 기슭엔 쉼터 통나무와 장작 더미, 둘레엔 눈 덮인 침엽 숲",
    build(b) {
      b.cliffs([{ points: [[0, 8], [14, 8], [16, 9], [44, 9], [46, 8], [63, 8]], height: 4, left: "open", right: "open" }]);
      b.stairs([[10, 8, 4]]);
      b.river({ width: 4, points: [[34, 0], [34, 6], [33, 10], [33, 14], [35, 19], [35, 25], [33, 30], [32, 34], [32, 40], [33, 43]], pools: [[34.5, 22, 5.2, 3.6]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[32, 36]]);
      // The wide ford is frozen (walkable ice); the channel above and below keeps flowing.
      b.freeze((x, y) => y >= 17 && y <= 27);
      b.exits([{ side: "west", at: 22, meets: "푸른 빙하 설원 동쪽 출구" }, { side: "north", at: 11, meets: "솔바람 산촌 · 설원 남쪽 입구" }, { side: "east", at: 22, meets: "다음 설원 필드" }, { side: "south", at: 20, meets: "눈 덮인 두 단 고갯길 북쪽 출구" }]);
      b.spine([["exit:0", [16, 22], [27, 21]], [[42, 21], [52, 22], "exit:2"], [[16, 22], [11, 18], "stairs-bottom:0"], ["stairs-top:0", "exit:1"],
        [[16, 22], [20, 32], [26, 37], "bridge-west:0"], ["bridge-east:0", [44, 36], [46, 28], [42, 21]], [[20, 32], "exit:3"]]);
      b.connect();
      b.paintRoads();
      b.props([["나무 이정표", 18, 25, "갈림길 표지 · 얼음 나루 / 다리"], ["돌 석상", 14, 3, "절벽 위 눈 수호상"], ["통나무 더미", 25, 24, "나루터 쉼터 통나무", "얼음 나루"], ["장작 더미", 25, 18, "나루터 모닥불 장작", "얼음 나루"]]);
      b.forest({ bands: { north: [2, 1], south: [3, 1.5], west: [2, 1], east: [3, 1.5] }, blobs: [[58, 38, 7, 5, 12], [4, 40, 5, 4, 10], [56, 14, 5, 4, 10], [4, 2, 5, 3, 10], [60, 2, 4, 3, 10]], noise: 0.7, clear: [[11, 4, 4, 3, 10]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.threes(537, 4, null, 1);
    },
    extraTargets: [[35, 22], [33, 19]],
  },
  {
    id: "outdoor-snow-icewall-pass", gate: "field", name: "눈보라 빙벽 고갯길", category: "snow", tilesetId: SNOW, width: 48, height: 60, seed: 5321,
    purpose: "눈 절벽 두 단을 계단으로 갈지자로 올라 북쪽 교구 마을에 닿는 고갯길. 가운뎃단에 얼어붙은 산정 호수와 사냥꾼 야영지, 윗단 빙벽에 얼음 동굴",
    note: "남쪽 기슭에서 눈 절벽 두 단을 돌계단 둘로 갈지자로 오른다. 가운뎃단 동쪽에 얼어붙은 산정 호수(걸어서 건넘)가 있고 호숫가에 사냥꾼 천막과 장작 더미가 붙어 있다. 윗단 빙벽 면엔 얼음 동굴 입구가 하나 뚫렸고, 고갯마루에서 북쪽으로 종탑 언덕 교구 가는 눈길이 난다. 양옆은 눈 덮인 침엽 숲",
    build(b) {
      b.cliffs([{ points: [[0, 42], [12, 42], [14, 43], [30, 43], [32, 42], [47, 42]], height: 5, left: "open", right: "open" },
        { points: [[0, 18], [10, 18], [12, 17], [28, 17], [30, 18], [47, 18]], height: 5, left: "open", right: "open" }]);
      b.stairs([[9, 42, 5], [34, 18, 5]]);
      const cave = b.shaft(19, 19);
      b.pond(33, 31, 7.5, 4.2, 0.16); b.smoothWater(); b.paintWater(); b.freeze();
      b.exits([{ side: "south", at: 24, meets: "얼음강 나루 설원 북쪽 길(필드)" }, { side: "north", at: 22, meets: "종탑 언덕 교구 · 설원 남쪽 입구" }]);
      b.spine([["exit:0", [22, 52], [12, 50], "stairs-bottom:0"], ["stairs-top:0", [14, 34], [22, 28], [30, 25], "stairs-bottom:1"], ["stairs-top:1", [30, 10], [22, 6], "exit:1"]]);
      b.connect();
      b.route([cave.x, cave.y], [22, 28]);
      b.paintRoads();
      b.props([["천막", 18, 33, "사냥꾼 천막"], ["장작 더미", 21, 35, "천막 장작", "사냥꾼 야영지"], ["통나무 더미", 17, 37, "천막 곁 통나무", "사냥꾼 야영지"],
        ["나무 이정표", 32, 12, "고갯마루 표지"], ["돌 석상", 26, 9, "고갯마루 수호석"]]);
      b.forest({ bands: { west: [4, 1.5], east: [4, 1.5], south: [2, 1] }, blobs: [[44, 52, 5, 5, 12], [3, 53, 5, 4, 10], [44, 5, 5, 5, 12], [4, 28, 4, 5, 10], [44, 36, 3, 3, 8]], noise: 0.7 });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.threes(537, 3, null, 1);
    },
    extraTargets: [[33, 31]],
  },
  // ── volcano ──
  {
    id: "outdoor-volcano-lavafall-ridge", gate: "field", fill: { spotCap: 12 }, name: "잿빛 능선 용암 폭포길", category: "volcano", tilesetId: ASH, width: 60, height: 50, seed: 5411,
    purpose: "재 덮인 절벽 두 단을 용암 강이 폭포로 두 번 넘는 능선 필드. 계단 둘로 능선을 오르고 아랫단 현무암 다리로 용암 강을 건넌다",
    note: "재 능선 두 단을 동쪽 용암 강이 두 번 폭포로 넘어 단마다 용암 소를 이룬다. 남쪽 기슭 길은 현무암 다리로 용암 강을 건너 동쪽으로 빠지고, 서쪽 돌계단 둘로 능선을 올라 북쪽 용암 강마을로 간다. 재 들판은 가는 용암 균열과 굳은 흐름 판이 덮고, 화산 봉우리 셋과 그을린 잎 없는 나무가 몇 덩이 선다",
    build(b) {
      b.cliffs([{ points: [[0, 30], [14, 30], [16, 31], [34, 31], [36, 30], [59, 30]], height: 5, left: "open", right: "open" },
        { points: [[0, 12], [18, 12], [20, 13], [30, 13], [32, 12], [59, 12]], height: 5, left: "open", right: "open" }]);
      b.stairs([[10, 30, 5], [22, 13, 5]]);
      b.river({ width: 3, points: [[44, 0], [44, 8], [43, 12], [43, 20], [45, 26], [45, 30], [44, 36], [42, 40], [42, 49]], pools: [[46.6, 22.5, 3.8, 2.6], [45.4, 40, 3.6, 2.4]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[42, 44]]);
      b.exits([{ side: "south", at: 18, meets: "용암 강 벼랑길 북쪽 출구(필드)" }, { side: "north", at: 26, meets: "두 폭포 · 용암 강마을 남쪽 입구" }, { side: "east", at: 45, meets: "다음 화산 필드" }]);
      b.spine([["exit:0", [18, 42], [12, 38], "stairs-bottom:0"], [[18, 42], [34, 45], "bridge-west:0"], ["bridge-east:0", "exit:2"], ["stairs-top:0", [16, 25], [22, 21], "stairs-bottom:1"], ["stairs-top:1", [26, 6], "exit:1"]]);
      b.connect();
      b.paintRoads();
      b.peaks([[6, 4], [50, 4, true], [52, 34, true]]);
      b.props([["나무 이정표", 20, 40, "갈림길 표지 · 다리 / 능선"], ["돌 석상", 32, 24, "용암 폭포를 보는 수호석"]]);
    },
  },
  {
    id: "outdoor-volcano-lava-lake", gate: "field", fill: { spotCap: 12 }, groundOpts: { pools: 0 }, name: "흑요석 용암호 둑길", category: "volcano", tilesetId: ASH, width: 64, height: 44, seed: 5421,
    purpose: "끓는 용암 호수 북쪽 기슭을 따라 도는 재 둑길 필드. 호수에서 흘러나간 용암 개울을 현무암 다리로 건너고, 북쪽 기슭에 옛 불의 제단 석주 한 쌍이 선다",
    note: "맵 가운데를 넓은 용암 호수가 차지하고, 서쪽 입구에서 들어온 둑길이 호수 북쪽 기슭을 따라 동쪽으로 돈다. 호수 동쪽에서 남쪽으로 흘러나가는 용암 개울 위에 현무암 다리가 놓이고, 다리 건너 남쪽 길이 잿빛 여울성 쪽으로 이어진다. 둑길 가운데 호숫가엔 옛 불의 제단 석주 한 쌍이 호수를 마주 보고 서 있다. 기슭엔 화산 봉우리와 그을린 잎 없는 나무 덩이, 재 들판엔 가는 균열과 굳은 흐름 판",
    build(b) {
      b.pond(30, 25, 15, 7.5, 0.2);
      b.river({ width: 3, points: [[43, 28], [47, 32], [48, 38], [49, 43]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[48, 36]]);
      b.exits([{ side: "west", at: 14, meets: "용암못 폐촌 동쪽 들길(필드)" }, { side: "east", at: 12, meets: "다음 화산 필드" }, { side: "south", at: 38, meets: "잿빛 여울성 남쪽 입구 쪽 필드" }]);
      b.spine([["exit:0", [12, 14], [20, 12], [36, 11], [50, 12], "exit:1"], [[50, 12], [55, 22], [54, 34], "bridge-east:0"], ["bridge-west:0", [40, 38], "exit:2"]]);
      b.connect();
      b.paintRoads();
      b.props([["흰 돌기둥", 26, 14, "호숫가 불의 제단 석주"], ["흰 돌기둥", 32, 14, "호숫가 불의 제단 석주"], ["나무 이정표", 52, 14, "갈림길 표지 · 여울성 / 동쪽"], ["돌 석상", 10, 10, "둑길 어귀 수호석"]]);
      b.peaks([[4, 32], [18, 38, true], [58, 4, true], [26, 3, true]]);
    },
  },
  // ── desert ──
  {
    id: "outdoor-desert-canyon-pass", gate: "field", fill: { spotCap: 16, palette: { stands: 2.6 } }, name: "사암 협곡 고갯길", category: "desert", tilesetId: SAND, width: 52, height: 60, seed: 5511,
    purpose: "사암 절벽 세 단이 비스듬히 엇갈린 협곡을 돌계단 셋으로 오르는 고갯길. 가운뎃단 절벽 밑 작은 샘과 야자 그늘, 윗단에서 북쪽 층바위 협곡마을로 이어진다",
    note: "남쪽 모래 기슭에서 사암 절벽 세 단을 돌계단 셋으로 갈지자로 오른다. 절벽선이 동서로 비스듬히 엇갈려 협곡처럼 좁아졌다 넓어진다. 둘째 단 절벽 밑에 야자 두어 그루가 둘러선 작은 샘이 있고, 셋째 단 절벽 면에 바람굴 하나가 뚫렸다. 모래 바닥은 능선 사구와 모래 물결, 바랜 잎 없는 나무가 드문드문 선다",
    build(b) {
      b.cliffs([{ points: [[0, 46], [16, 46], [18, 45], [36, 45], [38, 44], [51, 44]], height: 4, left: "open", right: "open" },
        { points: [[0, 28], [10, 28], [12, 29], [30, 29], [32, 30], [51, 30]], height: 5, left: "open", right: "open" },
        { points: [[0, 12], [22, 12], [24, 11], [40, 11], [42, 12], [51, 12]], height: 5, left: "open", right: "open" }]);
      b.stairs([[40, 44, 4], [8, 28, 5], [30, 11, 5]]);
      const cave = b.shaft(14, 13);
      b.pond(38, 39, 4.2, 2.4, 0.2); b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 26, meets: "오아시스 세 갈래길 북쪽 출구(필드)" }, { side: "north", at: 34, meets: "사암 층바위 협곡마을 남쪽 입구" }]);
      b.spine([["exit:0", [30, 52], [40, 52], "stairs-bottom:0"], ["stairs-top:0", [30, 40], [18, 38], [10, 36], "stairs-bottom:1"], ["stairs-top:1", [16, 22], [26, 20], "stairs-bottom:2"], ["stairs-top:2", [34, 6], "exit:1"]]);
      b.connect();
      b.route([cave.x, cave.y], [16, 22]);
      b.paintRoads();
      b.singlesWhere(770, 3, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 2, { shore: true });
      b.props([["나무 이정표", 32, 38, "샘 갈림길 표지"], ["돌 오벨리스크", 44, 6, "고갯마루 옛 표석"]]);
    },
  },
  {
    id: "outdoor-desert-dune-sea", gate: "field", fill: { spotCap: 14, palette: { stands: 2.6 } }, groundOpts: { duneSeas: 3, duneShare: 0.65 }, name: "모래바다 대상로", category: "desert", tilesetId: SAND, width: 72, height: 42, seed: 5521,
    purpose: "끝없는 사구 바다를 서쪽 포구에서 동쪽 오아시스 도시까지 가로지르는 대상 길. 길 한가운데 작은 오아시스 샘에 대상 천막이 쉬어 간다",
    note: "맵 전체가 능선 사구와 모래 물결로 덮인 모래 바다다. 서쪽 포구에서 들어온 대상 길이 사구 사이를 굽이치며 동쪽 오아시스 도시로 가고, 길 가운데쯤 야자에 둘러싸인 작은 오아시스 샘 곁에 대상 천막 둘과 짐 상자·물통이 있다. 샘 앞 갈림길에서 북쪽 사암 협곡 쪽으로 샛길이 갈라진다. 바랜 잎 없는 나무는 몇 덩이뿐이다",
    build(b) {
      b.pond(36, 25.5, 4.4, 3, 0.08); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 20, meets: "모래 물굽이 포구 서쪽 입구 쪽 필드" }, { side: "east", at: 22, meets: "모래바람 오아시스 도시 서쪽 길" }, { side: "north", at: 40, meets: "사암 층바위 협곡마을 쪽 필드" }]);
      b.spine([["exit:0", [14, 20], [24, 23], [30, 21], [40, 20], [50, 23], [60, 21], "exit:1"], [[40, 20], [40, 10], "exit:2"]]);
      b.paintRoads();
      b.props([["천막", 29, 26, "대상 천막"], ["천막", 42, 27, "대상 천막"], ["나무 상자", 33, 28, "대상 짐 상자", "대상 천막"], ["나무통", 40, 29, "샘물 통", "오아시스 샘"],
        ["나무 이정표", 42, 18, "갈림길 표지 · 협곡 / 오아시스 도시"]]);
      b.singlesWhere(770, 4, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 2, { shore: true });
    },
  },
  // ── autumn ──
  {
    id: "outdoor-autumn-orchard-road", gate: "field", name: "단풍 과수원 언덕길", category: "autumn", tilesetId: AUTUMN, width: 60, height: 44, seed: 5711,
    purpose: "울타리 친 과수원 사이로 난 가을 들길. 개울가 밭과 허수아비, 과수원마다 과일 상자, 낮은 언덕 위로 계단 하나",
    note: "금빛 들판 가운데로 흙길이 서쪽에서 동쪽으로 지나고, 길 양옆에 나무 울타리를 두른 과수원 셋이 붙어 있다. 과수원 안엔 과실나무가 서고 문 앞에 과일 상자·궤짝이 쌓였다. 남쪽 개울가엔 채소밭과 허수아비, 개울엔 작은 나무다리. 북쪽 낮은 언덕으로 돌계단 하나가 오르고, 그 위로 가을 종탑 언덕 교구 가는 길이 이어진다",
    build(b) {
      b.cliffs([{ points: [[0, 7], [20, 7], [22, 8], [40, 8], [42, 7], [59, 7]], height: 3, left: "open", right: "open" }]);
      b.stairs([[30, 8, 3]]);
      b.river({ width: 2, points: [[0, 36], [10, 36], [18, 34], [26, 35], [36, 36], [46, 35], [59, 36]] });
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 22, meets: "가을 두 폭포 강마을 쪽 필드" }, { side: "east", at: 22, meets: "단풍 여울 벼랑길 서쪽 필드" }, { side: "north", at: 31, meets: "가을 종탑 언덕 교구 남쪽 입구" }]);
      const orchards = [b.fenceRing(6, 13, 10, 6, 4, 2, "과수원"), b.fenceRing(38, 13, 11, 6, 5, 2, "과수원"), b.fenceRing(20, 26, 12, 6, 5, 2, "과수원")];
      b.spine([["exit:0", [12, 22], [30, 21], [48, 22], "exit:1"], [[30, 21], "stairs-bottom:0"], ["stairs-top:0", "exit:2"]]);
      b.connect();
      b.paintRoads();
      // Fruit trees in two staggered rows; the lower row leaves the gate lane (gate column ±1) open.
      for (const [n, { inside: [x, y, w] }] of orchards.entries()) {
        const gx = b.placements.filter((o) => o.kind === "fence")[n].gate.x;
        for (const [row, shift] of [[0, 0], [2, 1]]) for (let tx = x + shift; tx + 2 <= x + w; tx += 3)
          if (row === 0 || tx + 1 < gx - 1 || tx > gx + 2) b.put("활엽수 작은", tx, y + row, { purpose: "과실나무", owner: "과수원" });
      }
      b.props([["과일 상자", 11, 20, "과수원 문 앞 과일 상자", "과수원"], ["과일 상자", 45, 20, "과수원 문 앞 과일 상자", "과수원"], ["나무 상자", 27, 33, "과수원 문 앞 과일 궤짝", "과수원"],
        ["나무 이정표", 32, 19, "갈림길 표지 · 교구 / 강마을"]]);
      b.gardenPlots(2, { near: 3, owner: "개울가 밭" });
      b.forest({ bands: { north: [2, 1], south: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[56, 40, 6, 4, 10], [3, 40, 5, 4, 10]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  },
  {
    id: "outdoor-autumn-maple-valley", gate: "field", name: "붉은 단풍 골짜기", category: "autumn", tilesetId: AUTUMN, width: 60, height: 52, seed: 5721,
    purpose: "단풍 숲 사이 골짜기 필드. 북쪽 절벽을 한 줄기 큰 폭포가 넘어 단풍 못을 이루고, 못물이 동쪽으로 흘러 나간다. 계단으로 절벽 위 고개에 오른다",
    note: "양옆을 붉은 단풍 숲이 두른 골짜기다. 북쪽 절벽을 한 줄기 큰 폭포가 넘어 골짜기 가운데 단풍 못에 떨어지고, 못물은 남동쪽 개울로 흘러 맵 밖으로 나간다. 남쪽 입구 길은 개울을 나무다리로 건너 못 서쪽 기슭을 따라 올라가 돌계단으로 절벽 위에 오르고, 절벽 위 길은 북쪽 고개로 이어진다. 못가엔 낚시 선착장, 절벽 위엔 폭포를 내려다보는 쉼터 벤치",
    build(b) {
      b.cliffs([{ points: [[0, 14], [16, 14], [18, 15], [42, 15], [44, 14], [59, 14]], height: 5, left: "open", right: "open" }]);
      b.stairs([[14, 14, 5]]);
      b.river({ width: 3, points: [[31, 0], [31, 8], [30, 14], [30, 22]] });
      b.pond(31, 28, 9.5, 5.2, 0.07);
      b.river({ width: 3, points: [[39, 31], [44, 35], [47, 40], [47, 46], [49, 51]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[47, 42]]);
      b.pier(27, 36, "north", 3);
      b.exits([{ side: "south", at: 34, meets: "단풍 과수원 언덕길 북쪽 필드" }, { side: "north", at: 22, meets: "가을 종탑 언덕 교구 쪽 고개(필드)" }, { side: "east", at: 26, meets: "다음 가을 필드" }]);
      b.spine([["exit:0", [34, 46], [40, 44], "bridge-west:0"], ["bridge-east:0", [54, 40], [54, 30], "exit:2"], [[34, 46], [20, 42], [18, 30], [15, 22], "stairs-bottom:0"], ["stairs-top:0", [18, 8], [22, 4], "exit:1"], [[26, 38], [20, 42]]]);
      b.connect();
      b.paintRoads();
      b.props([["낚시 바구니", 25, 38, "선착장 낚시꾼 자리", "선착장"], ["나무통", 29, 39, "미끼 통", "선착장"], ["벤치", 24, 9, "폭포를 내려다보는 쉼터 벤치", "절벽 위 길"], ["나무 이정표", 36, 46, "갈림길 표지 · 못 / 동쪽"]]);
      b.forest({ bands: { west: [4, 1.5], east: [3, 1.5], south: [2, 1], north: [2, 1] }, blobs: [[4, 50, 7, 5, 12], [56, 50, 5, 4, 10], [54, 6, 6, 4, 12], [6, 4, 5, 4, 10]], noise: 0.7, clear: [[22, 6, 6, 4, 8]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
    },
  },
];
