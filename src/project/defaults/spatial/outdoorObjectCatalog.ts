import type { InteriorObjectCell } from "../interiorObjectCatalog";

/**
 * 배송되는 실외 오브젝트 정본(20종).
 *
 * 타일 번호의 근거는 이름이 아니라 저장소의 검증 자료다.
 *  - src/project/tilesetHarness/combinedTownGroups.ts — 그룹·통행성·배치 규칙
 *  - src/project/defaults/chipsetMapping.ts — CHIPSET_TILE_GROUPS 묶음
 *  - src/project/defaults/tileSemanticsCombinedTown.ts — 큐레이션 라벨
 * 칩셋은 easyrpg_chipset_combined_town(EasyRPG RTP, CC0) 한 장만 쓴다.
 *
 * 레이어는 칸별로 정한다. 실루엣 소품은 upper 라 지형이 남고, 데크·다리·잔교처럼
 * 사람이 올라서는 면은 wood-floor-deck 규약대로 lower 통행 가능 바닥으로 깐다.
 * "전부 upper" 로 뭉개면 다리 위를 걸을 수 없다.
 */

/** 실외 오브젝트 한 종. 실내 정본과 같은 셀 모델을 써서 킷 래스터로 그대로 번역된다. */
export interface OutdoorObjectDef {
  readonly id: string;
  readonly label: string;
  /** 이 칸 구성을 고른 이유. 카드 부제와 매니페스트에 그대로 실린다. */
  readonly description: string;
  /** 타일 근거가 되는 검증 그룹 id 또는 CHIPSET_TILE_GROUPS 키. */
  readonly authority: string;
  /** 밟고 지나갈 수 있는 면인지. 검증 그룹의 passage 를 그대로 따른다. */
  readonly passage: "passable" | "solid";
  readonly width: number;
  readonly height: number;
  readonly cells: readonly InteriorObjectCell[];
  /** 어울리는 공간 계열. 공간 설계가 이 값으로 후보를 고른다. */
  readonly families: readonly string[];
}

type Rows = readonly (readonly (number | null)[])[];

function cells(rows: Rows, layer: "lower" | "upper"): readonly InteriorObjectCell[] {
  const out: InteriorObjectCell[] = [];
  rows.forEach((row, dy) => {
    row.forEach((tile, dx) => {
      if (tile !== null) out.push({ dx, dy, layer, tile });
    });
  });
  return out;
}

function def(
  id: string,
  label: string,
  description: string,
  authority: string,
  passage: OutdoorObjectDef["passage"],
  rows: Rows,
): Omit<OutdoorObjectDef, "families"> {
  return {
    id,
    label,
    description,
    authority,
    passage,
    width: Math.max(...rows.map((row) => row.length)),
    height: rows.length,
    // 올라서는 면은 하위 통행 바닥, 실루엣은 상위 소품.
    cells: cells(rows, passage === "passable" ? "lower" : "upper"),
  };
}

function withFamilies(
  base: Omit<OutdoorObjectDef, "families">,
  families: readonly string[],
): OutdoorObjectDef {
  return { ...base, families };
}

const CONIFER = { top: 260, bottom: 290 } as const;
const DRY_TREE = { top: 261, bottom: 291 } as const;
const BROADLEAF = { topLeft: 262, topRight: 263, bottomLeft: 292, bottomRight: 293 } as const;
const DECK = { body: 222, alt: 192, plankA: 228, plankB: 229, plankC: 230 } as const;

/** 계획서 tile-to-world-authoring.md 94행의 id 순서를 그대로 지킨다. */
export const OUTDOOR_OBJECT_CATALOG: readonly OutdoorObjectDef[] = [
  withFamilies(def("outdoor-tree", "활엽수",
    "활엽수는 262·263 위 292·293 의 2×2 원자다. harness 의 hardPairRule 이 이 네 칸 배치를 강제한다.",
    "harness-combined-town-broadleaf-tree-2x2", "solid",
    [[BROADLEAF.topLeft, BROADLEAF.topRight], [BROADLEAF.bottomLeft, BROADLEAF.bottomRight]]),
    ["forest", "village", "garden"]),
  withFamilies(def("outdoor-pine", "침엽수",
    "침엽수는 상단 260 / 하단 290 의 세로 2칸 원자(verticalTreeGroup conifer-tree).",
    "harness-combined-town-conifer-tree", "solid",
    [[CONIFER.top], [CONIFER.bottom]]),
    ["forest", "snow", "mountain"]),
  withFamilies(def("outdoor-dead-tree", "마른나무",
    "마른나무는 상단 261 을 쌓아 키를 키우고 맨 아래를 291 로 닫는다(dry-tree, stackableTop).",
    "harness-combined-town-dry-tree", "solid",
    [[DRY_TREE.top], [DRY_TREE.top], [DRY_TREE.bottom]]),
    ["ruins", "snow", "mountain"]),
  withFamilies(def("outdoor-stump", "그루터기",
    "벌목 자리에 남은 나무 밑동 한 칸(290). 벌목장·야영지의 흔적.",
    "CHIPSET_TILE_GROUPS.treeObjects", "solid",
    [[290]]),
    ["forest", "snow", "camp"]),
  withFamilies(def("outdoor-rock", "돌무더기",
    "캐기 전 돌무더기 한 칸(29). 광산·동굴 입구의 채굴 대상.",
    "tileSemanticsCombinedTown:29", "solid",
    [[29]]),
    ["mountain", "mine", "cave"]),
  withFamilies(def("outdoor-boulder", "바위와 파편",
    "돌무더기(29) 옆에 깨진 돌(59)을 둔 가로 2칸. 무너진 사면의 큰 덩어리.",
    "tileSemanticsCombinedTown:29,59", "solid",
    [[29, 59]]),
    ["mountain", "mine", "ruins"]),
  withFamilies(def("outdoor-bush", "덤불",
    "낮은 덤불 한 칸(289). harness 의 soft 규칙대로 2칸 이상 띄워 쓴다.",
    "harness-combined-town-bush-props", "solid",
    [[289]]),
    ["forest", "garden", "village"]),
  withFamilies(def("outdoor-flowers", "꽃밭",
    "꽃 덤불(288)과 꽃잎(348). flowerObjects 는 통행 가능해 기존 지면을 보존한다.",
    "CHIPSET_TILE_GROUPS.flowerObjects", "passable",
    [[288, 348]]),
    ["garden", "village", "shrine"]),
  withFamilies(def("outdoor-well", "우물",
    "돌 우물 한 칸(382). 마을 광장의 중심점.",
    "CHIPSET_TILE_GROUPS.wellObjects", "solid",
    [[382]]),
    ["village", "garden", "camp"]),
  withFamilies(def("outdoor-sign", "표지판",
    "표지판 기둥(319)과 벽보(320). signObjects 정본이며, 440 은 별개의 팻말 타일이다.",
    "CHIPSET_TILE_GROUPS.signObjects", "solid",
    [[319, 320]]),
    ["village", "mountain", "harbor"]),
  withFamilies(def("outdoor-bench", "벤치",
    "가로 벤치는 좌 327 + 우 328 의 1×2 다. 세로 의자(358·388)와 섞지 않는다.",
    "harness-combined-town-bench-horizontal", "solid",
    [[327, 328]]),
    ["village", "garden", "harbor"]),
  withFamilies(def("outdoor-lamp", "석등",
    "돌기둥 상단(267)·하단(297) 위에 횃불(318)을 올린 세로 3칸 조명.",
    "tileSemanticsCombinedTown:267,297,318", "solid",
    [[318], [267], [297]]),
    ["village", "harbor", "shrine"]),
  withFamilies(def("outdoor-crate", "나무 상자",
    "나무 상자(237) 두 칸을 나란히 둔 화물 더미. 과일박스(202·203)는 별 그룹이라 섞지 않는다.",
    "CHIPSET_TILE_GROUPS.woodBoxObjects", "solid",
    [[237, 237]]),
    ["harbor", "market", "mine"]),
  withFamilies(def("outdoor-barrel", "통 더미",
    "술통(177)과 오크통(207)의 세로 2칸. 부두·창고의 적재.",
    "CHIPSET_TILE_GROUPS.barrelObjects", "solid",
    [[177], [207]]),
    ["harbor", "market", "camp"]),
  withFamilies(def("outdoor-fence", "울타리",
    "가로 울타리 3칸(378·379·380). fenceObjects 정본, 통행 불가 경계.",
    "CHIPSET_TILE_GROUPS.fenceObjects", "solid",
    [[378, 379, 380]]),
    ["garden", "village", "snow"]),
  withFamilies(def("outdoor-gate", "성문",
    "나무 문 상단(116)·하단(146)의 세로 2칸 관문(woodDoorPairObjects).",
    "CHIPSET_TILE_GROUPS.woodDoorPairObjects", "solid",
    [[116], [146]]),
    ["mountain", "village", "ruins"]),
  withFamilies(def("outdoor-wood-bridge", "나무 다리",
    "나무 바닥 데크(228·222·229)를 가로 3칸으로 깐 목교 상판. 하위 통행 가능이라 건널 수 있다.",
    "harness-combined-town-wood-floor-deck", "passable",
    [[DECK.plankA, DECK.body, DECK.plankB]]),
    ["river", "forest", "harbor"]),
  withFamilies(def("outdoor-stone-bridge", "돌다리",
    "돌바닥(342)을 가로 3칸으로 깐 석교 상판. 수로 타일(63~65)은 물이라 다리로 쓰지 않는다.",
    "CHIPSET_TILE_GROUPS.stoneFloorBody", "passable",
    [[342, 342, 342]]),
    ["river", "ruins", "mountain"]),
  withFamilies(def("outdoor-stairs", "돌계단",
    "돌계단 좌(111)·중(112)·우(113) 가로 3칸(stoneStairObjects).",
    "CHIPSET_TILE_GROUPS.stoneStairObjects", "solid",
    [[111, 112, 113]]),
    ["mountain", "ruins", "harbor"]),
  withFamilies(def("outdoor-dock", "선착장",
    "나무 바닥 데크를 세로 3칸으로 깐 잔교(230·222·192). 물가로 걸어 나가는 면이다.",
    "harness-combined-town-wood-floor-deck", "passable",
    [[DECK.plankC], [DECK.body], [DECK.alt]]),
    ["harbor", "river", "lake"]),
] as const;

const BY_ID = new Map<string, OutdoorObjectDef>(OUTDOOR_OBJECT_CATALOG.map((entry) => [entry.id, entry]));

/** id로 실외 오브젝트 정의를 찾는다. 없으면 undefined. */
export function outdoorObjectById(id: string): OutdoorObjectDef | undefined {
  return BY_ID.get(id);
}

/** 계열에 속하는 실외 오브젝트(선언 순서 유지). */
export function outdoorObjectsForFamily(family: string): readonly OutdoorObjectDef[] {
  return OUTDOOR_OBJECT_CATALOG.filter((entry) => entry.families.includes(family));
}
