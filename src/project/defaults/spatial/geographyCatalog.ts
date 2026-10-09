// project/defaults/spatial/geographyCatalog.ts
// 지역 6종·세계 2종 카탈로그 — 배송되는 정본 지리 데이터.
//
// 계획서 tile-to-world-authoring.md 100~109행의 표가 정본이다. 지역이 어느 세계에
// 속하는지, 어느 장소를 품는지, 세계가 어디서 시작하는지를 그 표에서 그대로 옮긴다.
//
// 좌표 규약(컴파일러가 실측으로 요구하는 것):
//  · 지역/세계 지형은 128×96 이고 자식 마커는 그 안에 있어야 한다(경계를 넘으면 clipped).
//  · 자식은 전부 level 0 이다. 개요 지도는 한 평면이다.
//  · 경로(route)의 폴리라인은 **첫 점이 from 마커, 끝 점이 to 마커**와 정확히 같아야 한다.
//    어긋나면 컴파일러가 "polyline endpoints do not match overview markers" 로 거절한다.
//
// 세계는 계획서대로 세 지역을 사슬로 잇고, 개요에서 나머지 두 지역 입구도 함께 노출한다.

/** 지역·세계가 품는 자식 한 자리. 개요 지도 위의 마커 좌표다. */
export interface GeographyChildSpec {
  readonly id: string;
  readonly designId: string;
  readonly x: number;
  readonly y: number;
}

/** 자식 사이를 잇는 길. points 의 양끝은 두 자식 마커와 같아야 한다. */
export interface GeographyRouteSpec {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export interface GeographyPortSpec {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export interface RegionDefSpec {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** 지형 바탕 재료와 겹치는 영역. 공간 카탈로그와 같은 재료 슬롯 이름을 쓴다. */
  readonly floor: string;
  readonly areas: readonly {
    readonly kind: "rect";
    readonly material: string;
    readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  }[];
  /** 계획서 표가 지정한 장소들. 반복 설계는 서로 다른 자리 두 개가 된다. */
  readonly places: readonly GeographyChildSpec[];
  readonly ports: readonly GeographyPortSpec[];
  readonly routes: readonly GeographyRouteSpec[];
  /** 소속 세계. 계획서 표의 마지막 열이다. */
  readonly world: string;
}

export interface WorldDefSpec {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly floor: string;
  readonly regions: readonly GeographyChildSpec[];
  readonly ports: readonly GeographyPortSpec[];
  /** 지역 사이 왕래. 계획서가 지정한 사슬 순서를 지킨다. */
  readonly connections: readonly { readonly id: string; readonly from: string; readonly to: string }[];
  /** 시작 지역. 계획서 109행이 지정한다. */
  readonly entryRegion: string;
}

export const GEOGRAPHY_TERRAIN = {
  tilesetId: "easyrpg_chipset_world",
  width: 128,
  height: 96,
} as const;

/** 마커를 잇는 ㄱ자 경로. 세로로 먼저 꺾어 두 마커를 정확히 물린다. */
function elbow(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): readonly { readonly x: number; readonly y: number }[] {
  if (from.x === to.x || from.y === to.y) return [from, to];
  return [from, { x: to.x, y: from.y }, to];
}

function route(id: string, a: GeographyChildSpec, b: GeographyChildSpec): GeographyRouteSpec {
  return { id, from: a.id, to: b.id, points: elbow({ x: a.x, y: a.y }, { x: b.x, y: b.y }) };
}

const lakeVillage: GeographyChildSpec = { id: "lake-village", designId: "lake-village", x: 30, y: 40 };
const lakeMine: GeographyChildSpec = { id: "working-mine", designId: "working-mine", x: 92, y: 30 };
const forestHamlet: GeographyChildSpec = { id: "forest-hamlet", designId: "forest-hamlet", x: 34, y: 34 };
const forestSanctuary: GeographyChildSpec = { id: "forest-sanctuary", designId: "forest-sanctuary", x: 88, y: 58 };
const harborTown: GeographyChildSpec = { id: "harbor-town", designId: "harbor-town", x: 28, y: 66 };
// 계획서: harbor-coast 는 항구 마을과 **독립된 두 번째 창고 장소**를 품는다.
const harborWarehouse: GeographyChildSpec = { id: "coast-warehouse", designId: "harbor-town", x: 96, y: 70 };
const snowOutpost: GeographyChildSpec = { id: "snow-outpost", designId: "snow-outpost", x: 36, y: 26 };
// 계획서: snow-frontier 는 초소와 사냥꾼 오두막을 품는다. 오두막은 forest-hamlet 안에 있으므로
// 변경에서는 같은 정착지 설계를 독립된 자리로 한 번 더 놓는다.
const snowCabin: GeographyChildSpec = { id: "hunter-cabin", designId: "forest-hamlet", x: 94, y: 44 };
const mountainPass: GeographyChildSpec = { id: "mountain-pass", designId: "mountain-pass", x: 32, y: 52 };
const passMine: GeographyChildSpec = { id: "working-mine", designId: "working-mine", x: 90, y: 62 };
const oldRuins: GeographyChildSpec = { id: "old-ruins", designId: "old-ruins", x: 30, y: 30 };
const ruinsSanctuary: GeographyChildSpec = { id: "forest-sanctuary", designId: "forest-sanctuary", x: 86, y: 68 };

/** 계획서 100~107행 표 그대로. */
export const REGION_CATALOG: readonly RegionDefSpec[] = [
  {
    id: "lake-country", label: "호수 지방", world: "lake-kingdom",
    description: "호수를 끼고 마을과 광산이 마주 보는 지방. 물줄기가 남북을 가른다.",
    floor: "ground",
    areas: [{ kind: "rect", material: "water", x: 55, y: 0, width: 10, height: 96 }],
    places: [lakeVillage, lakeMine],
    ports: [
      { id: "kingdom-gate", name: "왕국 관문", x: 4, y: 48 },
      { id: "forest-side", name: "숲 방면", x: 124, y: 48 },
    ],
    routes: [route("village-to-mine", lakeVillage, lakeMine)],
  },
  {
    id: "deep-forest", label: "깊은 숲", world: "lake-kingdom",
    description: "숲 한가운데 작은 마을과 성소가 숨어 있는 지방.",
    floor: "ground",
    areas: [{ kind: "rect", material: "groundAlt", x: 40, y: 24, width: 40, height: 40 }],
    places: [forestHamlet, forestSanctuary],
    ports: [
      { id: "lake-side", name: "호수 방면", x: 4, y: 48 },
      { id: "coast-side", name: "해안 방면", x: 124, y: 48 },
    ],
    routes: [route("hamlet-to-sanctuary", forestHamlet, forestSanctuary)],
  },
  {
    id: "harbor-coast", label: "항구 해안", world: "lake-kingdom",
    description: "항구 마을과 독립된 창고 부지가 해안선을 따라 늘어선 지방.",
    floor: "sand",
    areas: [{ kind: "rect", material: "water", x: 0, y: 78, width: 128, height: 18 }],
    places: [harborTown, harborWarehouse],
    ports: [
      { id: "forest-side", name: "숲 방면", x: 4, y: 48 },
      { id: "open-sea", name: "바다 방면", x: 124, y: 48 },
    ],
    routes: [route("town-to-warehouse", harborTown, harborWarehouse)],
  },
  {
    id: "snow-frontier", label: "설원 변경", world: "northern-frontier",
    description: "눈 덮인 변경. 초소와 외딴 사냥꾼 오두막만이 사람의 자취다.",
    floor: "snow",
    areas: [{ kind: "rect", material: "groundAlt", x: 30, y: 55, width: 70, height: 25 }],
    places: [snowOutpost, snowCabin],
    ports: [
      { id: "frontier-gate", name: "변경 관문", x: 4, y: 48 },
      { id: "pass-side", name: "고개 방면", x: 124, y: 48 },
    ],
    routes: [route("outpost-to-cabin", snowOutpost, snowCabin)],
  },
  {
    id: "high-pass", label: "고산 고개", world: "northern-frontier",
    description: "고개를 넘는 길과 그 아래 광산이 이어진 산악 지방.",
    floor: "ground",
    areas: [{ kind: "rect", material: "cliff", x: 40, y: 15, width: 31, height: 20 }],
    places: [mountainPass, passMine],
    ports: [
      { id: "snow-side", name: "설원 방면", x: 4, y: 48 },
      { id: "ruins-side", name: "유적 방면", x: 124, y: 48 },
    ],
    routes: [route("pass-to-mine", mountainPass, passMine)],
  },
  {
    id: "ancient-ruins", label: "옛 유적", world: "northern-frontier",
    description: "무너진 유적과 숲의 성소가 함께 남은 지방.",
    floor: "dirt",
    areas: [{ kind: "rect", material: "path", x: 40, y: 24, width: 40, height: 40 }],
    places: [oldRuins, ruinsSanctuary],
    ports: [
      { id: "pass-side", name: "고개 방면", x: 4, y: 48 },
      { id: "deep-side", name: "심부 방면", x: 124, y: 48 },
    ],
    routes: [route("ruins-to-sanctuary", oldRuins, ruinsSanctuary)],
  },
] as const;

const lakeCountry: GeographyChildSpec = { id: "lake-country", designId: "lake-country", x: 24, y: 48 };
const deepForest: GeographyChildSpec = { id: "deep-forest", designId: "deep-forest", x: 64, y: 40 };
const harborCoast: GeographyChildSpec = { id: "harbor-coast", designId: "harbor-coast", x: 100, y: 60 };
const snowFrontier: GeographyChildSpec = { id: "snow-frontier", designId: "snow-frontier", x: 24, y: 30 };
const highPass: GeographyChildSpec = { id: "high-pass", designId: "high-pass", x: 64, y: 50 };
const ancientRuins: GeographyChildSpec = { id: "ancient-ruins", designId: "ancient-ruins", x: 102, y: 66 };

/** 계획서 109행 그대로. 사슬 순서와 시작 지역을 지킨다. */
export const WORLD_CATALOG: readonly WorldDefSpec[] = [
  {
    id: "lake-kingdom", label: "호수 왕국",
    description: "호수 지방에서 시작해 깊은 숲을 거쳐 항구 해안에 이르는 왕국.",
    floor: "ground",
    regions: [lakeCountry, deepForest, harborCoast],
    // 개요는 세 지역 입구를 모두 드러낸다 — 시작 지역만 노출하면 나머지로 들어갈 수 없다.
    ports: [
      { id: "lake-entrance", name: "호수 지방 입구", x: 24, y: 52 },
      { id: "forest-entrance", name: "깊은 숲 입구", x: 64, y: 44 },
      { id: "coast-entrance", name: "항구 해안 입구", x: 100, y: 64 },
    ],
    connections: [
      { id: "lake-forest", from: "lake-country", to: "deep-forest" },
      { id: "forest-coast", from: "deep-forest", to: "harbor-coast" },
    ],
    entryRegion: "lake-country",
  },
  {
    id: "northern-frontier", label: "북부 변경",
    description: "설원 변경에서 고산 고개를 넘어 옛 유적으로 이어지는 변경 세계.",
    floor: "snow",
    regions: [snowFrontier, highPass, ancientRuins],
    ports: [
      { id: "snow-entrance", name: "설원 변경 입구", x: 24, y: 34 },
      { id: "pass-entrance", name: "고산 고개 입구", x: 64, y: 54 },
      { id: "ruins-entrance", name: "옛 유적 입구", x: 102, y: 70 },
    ],
    connections: [
      { id: "snow-pass", from: "snow-frontier", to: "high-pass" },
      { id: "pass-ruins", from: "high-pass", to: "ancient-ruins" },
    ],
    entryRegion: "snow-frontier",
  },
] as const;

const REGION_BY_ID = new Map<string, RegionDefSpec>(REGION_CATALOG.map((entry) => [entry.id, entry]));
const WORLD_BY_ID = new Map<string, WorldDefSpec>(WORLD_CATALOG.map((entry) => [entry.id, entry]));

/** id로 지역 정의를 찾는다. 없으면 undefined. */
export function regionDefById(id: string): RegionDefSpec | undefined {
  return REGION_BY_ID.get(id);
}

/** id로 세계 정의를 찾는다. 없으면 undefined. */
export function worldDefById(id: string): WorldDefSpec | undefined {
  return WORLD_BY_ID.get(id);
}

/** 세계에 속한 지역들(계획서 표 순서 유지). */
export function regionsOfWorld(worldId: string): readonly RegionDefSpec[] {
  return REGION_CATALOG.filter((entry) => entry.world === worldId);
}
