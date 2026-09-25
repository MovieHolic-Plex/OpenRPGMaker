// Atlas towns · home villages (고향 마을) and the state pair of the first one: burning (습격당한 밤) and rebuilt (재건).
// One layout function drives all three states so the burnt and rebuilt maps are the same village, not a lookalike.
const F = "forest_harmony";

// 들꽃 언덕 고향 마을 — the first village: a lane from the south meets a small fountain green, the chief's two-storey house
// north of it, the inn and smithy on the lane, farmhouses round the edge, a mill pond in the north-west.
function meadowHome(b, state = "peace") {
  b.pond(9, 8, 6, 3.6, 0.1); b.smoothWater(); b.paintWater();
  b.exits([{ side: "south", at: 25, meets: "마을 앞 들판(필드) 북쪽 출구" }, { side: "east", at: 20, meets: "동쪽 숲길(필드) 서쪽 출구" }]);
  const green = b.pave(b.ellipseCells(25, 20, 6.5, 3.6, 0.08), "cobble", { name: "분수 마당" });
  b.put("광장 분수", 24, 19, { purpose: "마을 한가운데 분수" });
  b.spine([["exit:0", [25, 30], [25, 24]], [[31, 20], [40, 20], "exit:1"]]);
  const rebuilt = state === "rebuilt", burnt = state === "burning";
  const H = b.homes([
    ["gable-2f-porch", rebuilt ? "charcoal-timber" : "slate-brick", 21, 5, "촌장 집", "garden", "right"],
    ["gable-house", "thatch-plaster", 12, 13, "주인공 집", "laundry", "left"],
    ["gable-cross-r", "amber-wood", 33, 8, "여관", "tavern", "left"],
    ["gable-long-low", rebuilt ? "timber-hall" : "amber-brick", 35, 25, "대장간", "smith", "right"],
    ["gable-steep", "moss-plaster", 5, 25, "약초 할멈 집", "herbs", "right"],
    ["gable-twin", rebuilt ? "thatch-log" : "bright-plaster", 15, 31, "잡화점", "shop", "right"],
    ["gable-barn", "thatch-log", 42, 11, "헛간", "storage", "front"],
  ]);
  b.connect();
  b.paintRoads();
  b.plazaUnroad();
  b.props([["벤치", 20, 23, "분수 곁 벤치", "분수 마당"], ["돌등", 30, 18, "분수 마당 등불", "분수 마당"], ["게시판", 28, 24, "마을 게시판", "분수 마당"], ["꽃 화단", 20, 17, "분수 화단", "분수 마당"]]);
  b.pier(9, 13, "north", 2);
  b.props([["낚시 바구니", 11, 12, "못가 낚시 자리", "못"]]);
  b.yards();
  if (burnt) {
    // The raid night: roofs on fire, two houses already fallen in, ash and charred beams round them, smoke.
    const fallen = [H[3], H[5]];
    for (const h of fallen) { b.burnDown(h); b.ashOver(h.x - 1, h.y + h.h - 2, h.w + 2, 3, 0.5); }
    for (const h of H) if (!fallen.includes(h) && h !== H[1]) b.burn(h, { blazes: h.w > 6 ? 2 : 1, size: 6 });
    b.night(0.5, "#3a1c1c");
  }
  if (rebuilt) {
    // A year later: the fallen houses stand again under scaffolding, lumber stacked by them, a work tent on the green.
    for (const h of [H[3], H[5]]) b.scaffold(h, h.door.x - h.x > 2 ? 0 : h.w - 3);
    b.props([["통나무 더미", H[3].x - 2, H[3].y + H[3].h - 2, "재건용 목재", H[3].id], ["장작 더미", H[3].x - 2, H[3].y + H[3].h - 3, "재건용 목재", H[3].id],
      ["통나무 더미", H[5].x + H[5].w + 1, H[5].y + H[5].h - 2, "재건용 목재", H[5].id], ["나무 상자", H[5].x + H[5].w + 1, H[5].y + H[5].h - 3, "연장 상자", H[5].id],
      ["가죽 천막", 40, 31, "일꾼 천막"], ["모닥불", 44, 33, "일꾼 모닥불"]]);
  }
  b.forest({ bands: { north: [2, 1.5], west: [3, 1.5], east: [2, 1] }, blobs: [[2, 37, 6, 4, 12], [48, 37, 5, 4, 10]], clear: [[25, 19, 16, 11, 14]] });
  b.edgeClumps(4);
  b.tallGrass(burnt ? 2 : 5, [5, 9]);
  b.threes(348, burnt ? 2 : 6);
}

export const HOME_PLANS = [
  {
    id: "town-home-meadow", name: "들꽃 언덕 고향 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "평화", plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단"]]],
    purpose: "주인공이 태어난 첫 마을. 분수 마당을 가운데 두고 촌장 집·여관·대장간·잡화점·약초 할멈 집이 모인다",
    note: "남쪽 들판 길로 들어오면 작은 분수 마당이 나오고, 그 북쪽에 촌장의 2층 집, 서쪽에 주인공 집, 동쪽에 여관과 헛간, 남동쪽에 대장간, 남서쪽에 잡화점과 약초 할멈 집이 선다. 북서쪽 물레방아 못에 낚시 판자가 나 있고 동쪽 숲길로 다음 필드가 이어진다",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "peace"),
  },
  {
    id: "town-home-meadow-burning", name: "불타는 들꽃 언덕 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "불탐", plaza: [["cobble", ["그을린 들보 1", "그을린 들보 2", "잿자리 1", "잿자리 2", "돌 무더기", "부서진 울타리"]]],
    purpose: "고향이 습격당한 밤. 지붕마다 불길이 오르고 대장간과 잡화점은 이미 무너졌다. 주인공 집만 불이 붙지 않았다",
    note: "「들꽃 언덕 고향 마을」과 같은 배치. 밤(붉은 어둠 조명). 촌장 집·여관·헛간·약초 할멈 집 지붕에 불길, 대장간·잡화점은 무너져 잔해 위로 큰 불길과 그을린 들보, 집 둘레마다 잿자리. 분수 마당에서 남쪽 길로 달아난다",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "burning"),
  },
  {
    id: "town-home-meadow-rebuilt", name: "다시 세운 들꽃 언덕 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "재건", plaza: [["cobble", ["통나무 더미", "나무 상자", "돌등", "꽃 화단"]]],
    purpose: "습격 뒤 다시 세우는 고향. 무너졌던 대장간과 잡화점이 비계를 두른 채 새로 서고, 목재 더미와 일꾼 천막이 곁에 있다",
    note: "「들꽃 언덕 고향 마을」과 같은 배치. 촌장 집은 검은 목조로 새로 지었고, 대장간·잡화점 벽에 비계가 서 있으며 곁에 통나무·장작·연장 상자가 쌓였다. 남동쪽 공터에 일꾼 천막과 모닥불",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "rebuilt"),
  },
];
