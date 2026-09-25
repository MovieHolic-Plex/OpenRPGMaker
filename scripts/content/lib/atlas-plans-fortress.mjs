// Atlas towns · fortress towns and a few more ordinary towns: castle town under a keep, double-walled fortress city,
// border river fort, walled hill town, mountain pass gate village; island harbour, bridge market town, graveyard
// hamlet, winter market (snow), desert caravan post.
import { CITY_FILL } from "./atlas-plans-capital.mjs";
const F = "forest_harmony", SNOW = "forest_harmony_snow", SAND = "forest_harmony_desert";

export const FORTRESS_PLANS = [
  {
    id: "city-castle-town", name: "사자문 성 아래 성하 마을", category: "fortress", tilesetId: F, width: 64, height: 64, seed: 21101, fill: CITY_FILL, plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단"]]], plazaSq: 3,
    purpose: "언덕 위 작은 성과 그 발치의 성하 마을. 성문 앞 광장, 성으로 오르는 큰길, 기사 숙소·대장간·여관이 늘어선 거리",
    note: "맵 북쪽을 작은 성이 차지하고, 성문 앞 돌 광장에서 남쪽으로 큰길이 곧게 내려간다. 큰길 양옆엔 기사 숙소·무기 공방·여관·잡화점이, 동서 골목엔 민가가 늘어선다. 남쪽 가도로 들어온다",
    build(b) {
      const castle = b.landmark("castle", 11, 1);
      b.exits([{ side: "south", at: 32, meets: "성하 가도(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(32, 38, 7, 2.6, 0.04), "cobble", { name: "성문 앞 광장" });
      b.put("광장 분수", 31, 37, { purpose: "성문 앞 분수" });
      b.spine([["exit:0", [32, 41]], [[32, 36], "landmark-door:0"], [[3, 47], [61, 47]], [[3, 57], [61, 57]], [[32, 41], [32, 57]], [[3, 36], [24, 36]], [[40, 36], [61, 36]]]);
      b.rowAbove(47, 3, 30, [["gable-hall", "slate-brick", "기사 숙소", "guard", "right"], ["gable-long-low", "amber-brick", "무기 공방", "smith", "right"], ["gable-2f-narrow", "slate-brick", "잡화점", "shop", "right"]], { gap: 1 });
      b.rowAbove(47, 34, 61, [["gable-cross", "amber-wood", "여관", "tavern", "right"], ["gable-twin-step", "bright-plaster", "빵집", "shop", "right"], ["gable-2f-lean", "slate-brick", "갑옷 가게", "shop", "right"]], { gap: 1 });
      b.rowAbove(57, 3, 30, [["gable-house", "thatch-plaster", "민가", "laundry", "right"], ["gable-long", "amber-wood", "민가", "garden", "right"], ["gable-steep", "moss-plaster", "민가", "herbs", "right"]], { gap: 2 });
      b.rowAbove(57, 34, 61, [["gable-twin", "bright-plaster", "민가", "laundry", "right"], ["gable-house", "amber-wood", "민가", "garden", "right"], ["gable-long-low", "thatch-log", "마구간", "storage", "right"]], { gap: 2 });
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["성 깃발", 27, 35, "성문 앞 깃발", "성문 앞 광장"], ["성 깃발", 37, 35, "성문 앞 깃발", "성문 앞 광장"], ["게시판", 36, 39, "성 포고문", "성문 앞 광장"]]);
      b.yards();
      b.forest({ bands: { south: [1, 1] }, blobs: [[2, 2, 6, 6, 12], [62, 2, 6, 6, 12]], noise: 0.5 });
      b.edgeClumps(4, ["round-bush", "tree"]);
      b.threes(348, 6);
      void castle;
    },
  },
  {
    id: "city-fortress-double", name: "두겹성벽 철벽 요새 도시", category: "fortress", tilesetId: F, width: 80, height: 76, seed: 21201, fill: CITY_FILL,
    purpose: "바깥 성벽과 안쪽 성벽 두 겹으로 두른 요새 도시. 두 성문, 바깥 고리의 병영·마구간, 안쪽의 사령부와 곡물 창고",
    note: "성벽이 두 겹으로 도시를 두른다. 남쪽 바깥 성문을 들어서면 바깥 고리에 병영·마구간·대장간과 병사 천막이 늘어서고, 안쪽 성문을 지나면 사령부·곡물 창고·교회가 모인 안뜰. 성벽 모퉁이마다 원탑이 선다",
    build(b) {
      const outer = b.wallRing(0, 0, 80, 76, { name: "바깥 성벽" });
      const inner = b.wallRing(20, 12, 40, 36, { name: "안쪽 성벽" });
      b.exits([{ side: "south", at: outer.gx, meets: "요새 가도(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [outer.gx, 56]], [[inner.gx, 56], [inner.gx, 47]], [[inner.gx, 42], [inner.gx, 30]], [[27, 30], [52, 30]], [[10, 56], [70, 56]], [[10, 10], [10, 56]], [[70, 10], [70, 56]]]);
      b.landmark("church", inner.gx + 6, 20);
      b.homes([["gable-hall", "slate-brick", 28, 20, "사령부", "guard", "right"], ["gable-long", "slate-wood", 28, 32, "곡물 창고", "storage", "right"], ["gable-long-low", "blue-stone", 44, 33, "무기고", "guard", "left"]], 3);
      b.rowAbove(56, 8, 34, [["gable-hall", "slate-brick", "병영", "guard", "right"], ["gable-barn", "timber-hall", "마구간", "storage", "right"]], { gap: 2 });
      b.rowAbove(56, 46, 72, [["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-cross", "amber-wood", "병사 주점", "tavern", "right"]], { gap: 2 });
      b.connect(); b.paintRoads();
      for (const [x, y] of [[11, 14], [11, 22], [11, 30], [66, 14], [66, 22], [66, 30]]) b.props([["천막", x, y, "병사 천막", "병영 천막"]]);
      b.props([["허수아비", 14, 44, "베기 과녁", "연병장"], ["허수아비", 17, 44, "베기 과녁", "연병장"], ["무기 거치대", 15, 41, "연병장 무기", "연병장"], ["무기 거치대", 62, 41, "연병장 무기", "연병장"], ["허수아비", 63, 44, "베기 과녁", "연병장"],
        ["나무 상자", 13, 39, "병참 상자", "병영 천막"], ["술통", 64, 39, "병참 술통", "병영 천막"], ["성 깃발", inner.gx - 4, 47, "안쪽 성문 깃발", "안쪽 성벽"], ["성 깃발", inner.gx + 4, 47, "안쪽 성문 깃발", "안쪽 성벽"]]);
      b.yards();
      b.edgeClumps(4, ["round-bush", "small-bush"]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-border-fort", name: "갈림강 국경 요새 마을", category: "fortress", tilesetId: F, width: 60, height: 50, seed: 21301,
    purpose: "국경 강을 지키는 요새 마을. 강을 따라 선 성벽과 문루, 다리 검문소, 강 이쪽 병영과 마을",
    note: "동서로 흐르는 국경 강 북쪽 기슭을 따라 성벽이 막고 가운데 문루 아래로만 강을 건너는 나무다리가 난다. 성벽 안쪽엔 병영·검문소·장교 숙소와 마을 집들, 강 건너 남쪽엔 초소 하나. 북쪽 가도로 들어와 다리를 건너 남쪽 국경 너머로 나간다",
    build(b) {
      b.waterWhere((x, y) => Math.abs(y - (40 + 1.2 * Math.sin(x / 6))) < 2.4);
      b.smoothWater(); b.paintWater();
      const wall = b.wallLine(0, 28, 60, { name: "국경 성벽" });
      const pl = b.planks(wall.gx, 37, "south");
      b.exits([{ side: "north", at: 30, meets: "국경 가도(필드) 남쪽 출구" }, { side: "south", at: wall.gx, meets: "국경 너머 들길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [30, 18]], [[4, 18], [56, 18]], [[wall.gx, 18], [wall.gx, 36], pl.from], [pl.to, "exit:1"]]);
      b.rowAbove(18, 3, 57, [["gable-hall", "slate-brick", "병영", "guard", "right"], ["gable-2f-narrow", "slate-brick", "장교 숙소", "garden", "right"], ["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-cross-l", "amber-wood", "여관", "tavern", "right"], ["gable-house", "thatch-plaster", "민가", "laundry", "right"]], { gap: 2 });
      b.homes([["gable-long-low", "slate-wood", 10, 21, "검문소", "guard", "right"], ["gable-house", "amber-wood", 44, 21, "민가", "farm", "left"]], 3);
      b.connect(); b.paintRoads();
      b.props([["성 깃발", wall.gx - 4, 36, "국경 깃발", "국경 성벽"], ["무기 거치대", wall.gx + 3, 25, "검문 무기", "검문소"], ["나무 상자", wall.gx - 3, 24, "압수 짐", "검문소"], ["게시판", wall.gx + 2, 21, "통행 포고문", "검문소"]]);
      b.props([["천막", wall.gx + 4, 45, "강 건너 초소 천막", "강 건너 초소"], ["모닥불", wall.gx - 3, 46, "초소 모닥불", "강 건너 초소"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], south: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [58, 2, 5, 4, 10], [2, 48, 4, 3, 8], [58, 48, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(4);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-walled-hill", name: "매봉 성곽 언덕 마을", category: "fortress", tilesetId: F, width: 56, height: 58, seed: 21401, plaza: [["cobble", ["벤치", "돌등", "화분"]]],
    purpose: "절벽 언덕 위를 성벽으로 두른 마을. 돌계단 두 번을 올라 성문으로, 성벽 안 광장과 촌장 저택, 아랫단 밭과 방앗간",
    note: "아랫단 들판엔 밭과 방앗간, 농가가 있고 돌계단 둘을 올라 언덕 위 성문에 닿는다. 성벽 안엔 우물 광장을 두른 촌장 저택·여관·교회·가게. 남쪽 들길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 40], [55, 40]], height: 4, left: "open", right: "open" }]);
      b.stairs([[27, 40, 4]]);
      const ring = b.wallRing(6, 2, 44, 36, { name: "언덕 성벽" });
      b.exits([{ side: "south", at: 27, meets: "언덕 아래 들길(필드) 북쪽 출구" }]);
      b.put("낮은 돌 우물", ring.gx - 1, 22, { purpose: "광장 우물" });
      b.pave(b.ellipseCells(ring.gx, 23, 5, 2.4, 0.04), "cobble", { name: "우물 광장" });
      b.spine([["exit:0", [27, 50], "stairs-bottom:0"], ["stairs-top:0", [ring.gx, 38]], [[ring.gx, 30], [ring.gx, 26]], [[14, 27], [42, 27]], [[4, 50], [52, 50]]]);
      b.landmark("church", 34, 9);
      b.homes([["gable-2f-porch", "slate-brick", 14, 9, "촌장 저택", "garden", "right"], ["gable-cross-r", "amber-wood", 14, 29, "여관", "tavern", "right"], ["gable-twin", "bright-plaster", 36, 29, "가게", "shop", "left"]], 3);
      b.rowAbove(50, 3, 24, [["gable-2f-lean", "timber-hall", "방앗간", "storage", "right"], ["gable-house", "thatch-plaster", "농가", "farm", "right"]], { gap: 2 });
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.crops(33, 44, 18, 5, { owner: "언덕 아래 밀밭" });
      b.yards();
      b.forest({ bands: { south: [1, 1] }, blobs: [[2, 2, 3, 5, 8], [54, 2, 3, 5, 8], [2, 55, 4, 3, 8], [54, 55, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3);
      b.threes(348, 5);
    },
  },
  {
    id: "town-pass-gate", name: "칼바람 고개 관문 마을", category: "fortress", tilesetId: F, width: 50, height: 52, seed: 21501,
    purpose: "두 절벽 사이 좁은 고갯길을 성벽 관문으로 막은 마을. 문루와 초소, 관문 아래 역참과 여관, 짐수레 마당",
    note: "동서 양쪽 높은 절벽 사이 좁은 고갯길을 성벽이 가로막고 가운데 문루로만 지난다. 관문 남쪽엔 역참·여관·마구간과 짐수레 마당, 북쪽엔 초소와 파수꾼 집. 남쪽 길로 들어와 북쪽 고갯길로 나간다",
    build(b) {
      b.cliffs([{ points: [[0, 0], [0, 51]], height: 1, left: "open", right: "open" }].slice(0, 0));
      const wall = b.wallLine(0, 20, 50, { name: "고개 관문 성벽" });
      b.exits([{ side: "south", at: wall.gx, meets: "고개 아래 길(필드) 북쪽 출구" }, { side: "north", at: wall.gx, meets: "고갯길(필드) 남쪽 출구" }]);
      b.pave(b.rectCells(wall.gx - 5, 32, 10, 5), "dirt", { name: "짐수레 마당" });
      b.spine([["exit:0", [wall.gx, 40], [wall.gx, 28]], [[wall.gx, 20], "exit:1"], [[4, 40], [46, 40]], [[4, 14], [46, 14]]]);
      b.rowAbove(40, 3, 47, [["gable-hall", "timber-hall", "역참", "storage", "right"], ["gable-cross", "amber-wood", "여관", "tavern", "right"], ["gable-barn", "thatch-log", "마구간", "storage", "left"], ["gable-long-low", "amber-brick", "수레 수리간", "woodwork", "right"]], { gap: 2 });
      b.rowAbove(14, 3, 47, [["gable-long-low", "slate-wood", "초소", "guard", "right"], ["gable-house", "slate-brick", "파수꾼 집", "laundry", "right"]], { gap: 4 });
      b.connect(); b.paintRoads();
      b.props([["나무 상자", wall.gx - 4, 33, "짐수레 짐", "짐수레 마당"], ["술통", wall.gx - 3, 33, "짐수레 짐", "짐수레 마당"], ["씨앗 자루", wall.gx + 3, 33, "곡물 자루", "짐수레 마당"], ["과일 상자", wall.gx + 3, 35, "짐수레 짐", "짐수레 마당"], ["게시판", wall.gx + 3, 29, "통행 포고문", "짐수레 마당"]]);
      b.yards();
      b.forest({ bands: { west: [5, 2], east: [5, 2], south: [2, 1], north: [2, 1] }, blobs: [[2, 2, 7, 6, 14], [48, 2, 7, 6, 14], [2, 50, 6, 4, 12], [48, 50, 6, 4, 12]], noise: 0.6 });
      b.edgeClumps(4, ["tree", "big-oak"]);
      b.threes(537, 6);
    },
  },
  {
    id: "town-island-harbor", name: "외딴섬 등대 포구", category: "port", tilesetId: F, width: 56, height: 48, seed: 21601,
    purpose: "바다 한가운데 작은 섬의 포구 마을. 섬 둘레 선착장 셋과 나룻배, 등대 원탑, 어부 집과 그물 창고",
    note: "사방이 바다인 작은 섬. 남쪽 포구에 선착장 둘과 나룻배, 섬 가운데 우물 마당을 어부 집·그물 창고·여관이 두르고, 북동쪽 곶에 등대 원탑이 선다. 배로만 드나든다(남쪽 선착장이 입구)",
    build(b) {
      b.waterWhere((x, y) => ((x - 28) / 22) ** 2 + ((y - 23) / 17) ** 2 > 1 + 0.08 * Math.sin(x * 0.7 + y * 0.5));
      b.smoothWater(); b.paintWater();
      b.put("낮은 돌 우물", 27, 21, { purpose: "섬 우물" });
      b.spine([[[16, 25], [40, 25]], [[28, 25], [28, 36]], [[20, 25], [20, 34]], [[36, 25], [36, 34]]]);
      b.pier(20, 35, "south", 4); b.pier(36, 35, "south", 4);
      b.moorNear("나룻배", 22, 41, { purpose: "섬 나룻배" }); b.moorNear("나룻배", 38, 41, { purpose: "고깃배" });
      b.homes([["gable-house", "thatch-plaster", 14, 13, "어부 집", "fishing", "right"], ["gable-long", "slate-wood", 22, 10, "그물 창고", "storage", "right"], ["gable-cross-l", "amber-wood", 32, 13, "여관", "tavern", "left"], ["gable-long-low", "moss-plaster", 12, 27, "어부 집", "laundry", "right"], ["gable-house", "thatch-log", 39, 27, "어부 집", "fishing", "left"]], 4);
      b.connect(); b.paintRoads();
      b.tower(43, 12, "섬 등대");
      b.props([["부두 술통", 19, 34, "부두 짐", "포구"], ["밧줄 뭉치", 22, 34, "부두 짐", "포구"], ["닻", 35, 34, "여벌 닻", "포구"], ["낚시 바구니", 38, 34, "낚시 바구니", "포구"], ["빨랫줄", 26, 30, "그물 말리기", "포구"]]);
      b.yards();
      b.edgeClumps(4, ["tree", "round-bush"]);
      b.threes(348, 5);
      return { x: 20, y: 34 };
    },
  },
  {
    id: "town-bridge-market", name: "돌다리 장터 강마을", category: "water", tilesetId: F, width: 60, height: 46, seed: 21701, plaza: [["cobble", ["벤치", "화분", "과일 좌판"]]], plazaSq: 3,
    purpose: "넓은 강을 건너는 두 다리목에 장이 서는 강마을. 다리목 돌 광장 둘, 강둑 노점 줄, 양 기슭의 가게와 창고",
    note: "넓은 강이 마을 가운데를 남북으로 흐르고 나무다리 둘이 건넌다. 다리목마다 돌 광장이 있어 노점이 서고, 양 기슭 강둑을 따라 가게·창고·여관이 늘어선다. 강에는 선착장과 나룻배. 서쪽과 동쪽 가도로 드나든다",
    build(b) {
      b.river({ width: 6, points: [[30, 0], [29, 14], [31, 30], [30, 45]] });
      b.smoothWater(); b.paintWater();
      const y1 = b.bridgeNear(30, 12), y2 = b.bridgeNear(30, 32);
      b.exits([{ side: "west", at: y1, meets: "서쪽 가도(필드) 동쪽 출구" }, { side: "east", at: y2, meets: "동쪽 가도(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(20, y1 + 0.5, 4, 2.6, 0.04), "cobble", { name: "서쪽 다리목 광장" });
      b.pave(b.ellipseCells(41, y2 + 0.5, 4, 2.6, 0.04), "cobble", { name: "동쪽 다리목 광장" });
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", [45, y1], [45, y2]], ["bridge-east:1", "exit:1"], ["bridge-west:1", [15, y2], [15, y1]]]);
      b.homes([["gable-twin-step", "bright-plaster", 4, 2, "잡화점", "shop", "right"], ["gable-cross-l", "amber-wood", 15, 2, "여관", "tavern", "right"], ["gable-long", "slate-wood", 38, 2, "강 창고", "storage", "right"], ["gable-2f-narrow", "amber-brick", 50, 2, "빵집", "shop", "left"],
        ["gable-long-low", "amber-brick", 4, 36, "대장간", "smith", "right"], ["gable-house", "thatch-plaster", 18, 37, "뱃사공 집", "fishing", "right"], ["gable-hall", "slate-brick", 38, 36, "상인 조합", "storage", "right"], ["gable-house", "moss-plaster", 50, 18, "민가", "laundry", "left"]], 4);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["줄무늬 노점 빨강", 17, y1 - 3, "다리목 노점", "서쪽 다리목 광장"], ["줄무늬 노점 파랑", 38, y2 + 2, "다리목 노점", "동쪽 다리목 광장"]]);
      b.pier(26, 22, "east", 2);
      b.yards();
      b.forest({ bands: { south: [1, 1] }, blobs: [[2, 44, 4, 3, 8], [58, 44, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(4);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-graveyard-hamlet", name: "까마귀 언덕 묘지기 마을", category: "special", tilesetId: F, theme: "graves", width: 50, height: 42, seed: 21801,
    purpose: "큰 옛 묘지를 지키는 작은 마을. 울타리 친 묘지 둘과 교회, 묘지기 집, 장의사, 까마귀 앉은 마른나무",
    note: "언덕 위 돌벽 교회 양옆에 울타리 친 옛 묘지 둘이 펼쳐지고, 마른나무에 까마귀가 앉았다. 언덕 아래엔 묘지기 집·장의사·꽃 가게와 작은 여관. 남쪽 길로 들어온다",
    build(b) {
      b.landmark("church", 21, 3); b.landmark("graveyard", 8, 6); b.landmark("graveyard", 33, 6);
      b.exits([{ side: "south", at: 25, meets: "묘지 길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [25, 28]], [[5, 22], [45, 22]], [[25, 22], "landmark-door:0"]]);
      b.rowAbove(34, 3, 47, [["gable-steep", "charcoal-timber", "장의사", "storage", "right"], ["gable-house", "moss-plaster", "꽃 가게", "garden", "right"], ["gable-long-low", "slate-brick", "작은 여관", "tavern", "right"], ["gable-house", "thatch-log", "묘지기 집", "herbs", "right"]], { gap: 3 });
      b.spine([[[3, 34], [47, 34]], [[25, 28], [25, 34]]]);
      b.connect(); b.paintRoads();
      b.props([["마른나무", 5, 16, "까마귀 앉은 마른나무", "묘지"], ["마른나무", 44, 16, "까마귀 앉은 마른나무", "묘지"], ["돌 십자가", 18, 24, "길가 십자가", "묘지 길"], ["돌 십자가", 31, 24, "길가 십자가", "묘지 길"], ["돌등", 22, 20, "교회 앞 등불", "교회"], ["돌등", 28, 20, "교회 앞 등불", "교회"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 40, 4, 3, 8], [48, 40, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(4, ["dark-tree", "tree", "round-bush"]);
      b.threes(537, 5);
    },
  },
  {
    id: "town-winter-market", name: "서리장 겨울 장터 마을", category: "climate", tilesetId: SNOW, width: 54, height: 42, seed: 21901, plaza: [["cobble", ["장작 더미", "나무통", "벤치"]]], plazaSq: 3,
    purpose: "눈 내린 마을 광장에 선 겨울 장. 노점과 과일 좌판, 큰 모닥불, 광장을 두른 가게와 여관",
    note: "눈 덮인 마을 한가운데 돌 광장에 겨울 장이 선다. 노점 넷과 과일 좌판 사이로 큰 모닥불 둘이 타고, 광장 둘레엔 모피 가게·여관·빵집·대장간. 서쪽과 동쪽 눈길로 드나든다",
    build(b) {
      b.exits([{ side: "west", at: 24, meets: "서쪽 눈길(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "동쪽 눈길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(17, 17, 20, 11), "cobble", { name: "겨울 장터" });
      b.spine([["exit:0", [17, 24]], [[36, 24], "exit:1"], [[4, 34], [50, 34]], [[26, 27], [26, 34]], [[4, 13], [50, 13]], [[26, 13], [26, 17]]]);
      b.rowAbove(13, 3, 51, [["gable-long", "slate-wood", "모피 가게", "shop", "right"], ["gable-2f-lean", "timber-hall", "여관", "tavern", "right"], ["gable-house", "blue-stone", "빵집", "shop", "right"], ["gable-long-low", "amber-wood", "대장간", "smith", "right"]], { gap: 3 });
      b.rowAbove(34, 3, 51, [["gable-house", "slate-wood", "민가", "laundry", "right"], ["gable-twin", "bright-plaster", "민가", "garden", "right"], ["gable-long-low", "blue-stone", "창고", "storage", "right"], ["gable-house", "amber-wood", "민가", "woodwork", "right"]], { gap: 3 });
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["장터 노점", 18, 18, "겨울 장 노점", "겨울 장터"], ["장터 노점", 22, 18, "겨울 장 노점", "겨울 장터"], ["장터 노점", 30, 18, "겨울 장 노점", "겨울 장터"], ["장터 노점", 33, 18, "겨울 장 노점", "겨울 장터"],
        ["과일 좌판", 18, 25, "겨울 장 좌판", "겨울 장터"], ["과일 좌판", 33, 25, "겨울 장 좌판", "겨울 장터"], ["모닥불", 22, 22, "장터 모닥불", "겨울 장터"], ["모닥불", 31, 22, "장터 모닥불", "겨울 장터"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1] }, blobs: [[2, 2, 4, 3, 8], [52, 2, 4, 3, 8], [2, 40, 4, 3, 8], [52, 40, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-caravan-post", name: "낙타방울 사막 역참", category: "climate", tilesetId: SAND, width: 50, height: 40, seed: 22001,
    fill: { flowerCap: 0, spotCap: 4, palette: { stands: 2.6 } },
    purpose: "사막 대상로의 역참. 울타리 친 낙타 우리 둘, 대상 숙소와 물 긷는 우물, 짐 상자 마당, 천막",
    note: "모래 사막을 가로지르는 대상로 한가운데 역참이 있다. 대상 숙소와 창고가 우물 마당을 두르고, 울타리 친 낙타 우리 둘, 짐 상자와 물 항아리가 쌓인 마당, 대상들의 천막. 서쪽과 동쪽 대상로로 드나든다",
    build(b) {
      b.exits([{ side: "west", at: 22, meets: "서쪽 대상로(필드) 동쪽 출구" }, { side: "east", at: 22, meets: "동쪽 대상로(필드) 서쪽 출구" }]);
      b.fenceRing(4, 26, 12, 8, 5, 2, "서쪽 낙타 우리"); b.fenceRing(34, 26, 12, 8, 5, 2, "동쪽 낙타 우리");
      b.pave(b.ellipseCells(25, 23, 5, 2.4, 0.05), "sand", { name: "우물 마당" });
      b.put("낮은 돌 우물", 24, 22, { purpose: "역참 우물" });
      b.spine([["exit:0", [20, 22]], [[30, 22], "exit:1"], [[9, 22], [9, 26]], [[39, 22], [39, 26]]]);
      b.rowAbove(22, 3, 47, [["gable-long", "bright-plaster", "대상 숙소", "tavern", "right"], ["gable-house", "amber-wood", "역참지기 집", "desert", "right"], ["gable-long-low", "bright-plaster", "창고", "storage", "right"], ["gable-twin", "amber-wood", "물 파는 집", "shop", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.props([["천막", 19, 27, "대상 천막", "대상 야영"], ["천막", 27, 28, "대상 천막", "대상 야영"], ["모닥불", 24, 31, "대상 모닥불", "대상 야영"], ["나무 상자", 21, 25, "대상 짐", "우물 마당"], ["항아리", 29, 25, "물 항아리", "우물 마당"], ["항아리", 20, 25, "물 항아리", "우물 마당"],
        ["나무통", 7, 29, "낙타 물통", "서쪽 낙타 우리"], ["씨앗 자루", 12, 29, "여물 자루", "서쪽 낙타 우리"], ["나무통", 37, 29, "낙타 물통", "동쪽 낙타 우리"], ["씨앗 자루", 42, 29, "여물 자루", "동쪽 낙타 우리"]]);
      b.yards();
    },
  },
];
