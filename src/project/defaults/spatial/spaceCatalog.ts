// project/defaults/spatial/spaceCatalog.ts
// 공간 카탈로그 — 배송되는 정본 공간 설계 12종의 선언형 데이터.
//
// 각 공간은 지형(floor + 겹치는 재료 영역), 이름 있는 출입 포트, 최소 두 계열의 오브젝트를
// 갖는다. 좌표는 전부 공간 로컬이며, 컴파일러가 이 값을 그대로 래스터로 옮긴다.
//
// 재료 이름은 materialSlots.ts 가 칩셋에서 **유도한** 슬롯 id 다(하드코딩된 타일 번호가 아니다).
// combined_town 에서 실제로 채워지는 슬롯: ground · groundAlt · path · water · shore · cliff · fence.
// 실내(interior)는 conceptBundle 의 floor(wood|stone|plank|mat) / wall(cream|gold-brick|stone-brick) 을 쓴다.
//
// 배치 규칙: 통로를 막지 않는다. 고정 배치는 가장자리·모서리로 밀고, 가운데 열은 걷는 길로 비운다.

/** 공간 하나의 재료 영역. SpatialFloorArea 와 같은 모양이지만 배송 데이터라 좁게 쓴다. */
export type SpaceAreaSpec =
  | { readonly kind: "rect"; readonly material: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: "polygon"; readonly material: string; readonly points: readonly { readonly x: number; readonly y: number }[] };

/** 이름 있는 출입구. id 는 포트 식별자, name 은 사람이 읽는 이름이다. */
export interface SpacePortSpec {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/** 공간이 품는 오브젝트 한 자리. quantity>1 이면 그만큼의 개별 occurrence 가 생긴다. */
export interface SpaceSlotSpec {
  readonly id: string;
  readonly objectId: string;
  readonly quantity: number;
  readonly required: boolean;
  /** 고정 좌표. 생략하면 자동 배치기가 빈 바닥에 앉힌다. */
  readonly at?: { readonly x: number; readonly y: number };
}

export interface SpaceDefBase {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly shape: "rect" | "l" | "alcove" | "l-right" | "bay" | "notch" | "cross";
  readonly ports: readonly SpacePortSpec[];
  readonly slots: readonly SpaceSlotSpec[];
}

export type SpaceDef = SpaceDefBase & (
  | { readonly environment: "outdoor"; readonly tilesetId: "easyrpg_chipset_combined_town"; readonly floor: string; readonly areas: readonly SpaceAreaSpec[] }
  | { readonly environment: "interior"; readonly tilesetId: "easyrpg_chipset_interior"; readonly floor: string; readonly wall: string; readonly role: "entrance" | "walkway" | "room" }
);

/**
 * 배송 정본 12종. 계획서의 id 순서를 지킨다.
 * 전부 실외다 — 실내 방 규칙은 이미 BUILTIN_INTERIOR_ROOM_KINDS(7종)와
 * CONCEPT_FACILITY_TEMPLATES(19종)가 갖고 있고, 이 표는 그 바깥을 채운다.
 */
export const SPACE_CATALOG: readonly SpaceDef[] = [
  {
    id: "market-square", label: "장터 광장", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "우물을 중심에 둔 포장 광장. 네 방향 진입로가 모두 열려 있고 가판은 가장자리에만 선다.",
    width: 22, height: 18, shape: "rect", floor: "ground",
    areas: [{ kind: "rect", material: "path", x: 3, y: 3, width: 16, height: 12 }],
    ports: [
      { id: "south-road", name: "남쪽 큰길", x: 11, y: 17 },
      { id: "north-lane", name: "북쪽 골목", x: 11, y: 0 },
      { id: "inn-door", name: "여관 문", x: 4, y: 3 },
      { id: "shop-door", name: "상점 문", x: 18, y: 3 },
    ],
    slots: [
      { id: "well", objectId: "outdoor-well", quantity: 1, required: true, at: { x: 11, y: 9 } },
      { id: "bench-west", objectId: "outdoor-bench", quantity: 1, required: false, at: { x: 5, y: 12 } },
      { id: "bench-east", objectId: "outdoor-bench", quantity: 1, required: false, at: { x: 15, y: 12 } },
      { id: "lamp", objectId: "outdoor-lamp", quantity: 2, required: false },
      { id: "crates", objectId: "outdoor-crate", quantity: 2, required: false },
      { id: "signpost", objectId: "outdoor-sign", quantity: 1, required: false, at: { x: 10, y: 15 } },
    ],
  },
  {
    id: "quiet-courtyard", label: "조용한 안뜰", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "건물 사이에 낀 작은 안뜰. 가운데 꽃밭을 두고 벽을 따라 벤치가 돈다.",
    width: 16, height: 14, shape: "rect", floor: "ground",
    areas: [{ kind: "rect", material: "path", x: 2, y: 2, width: 12, height: 10 }],
    ports: [
      { id: "cloister-gate", name: "회랑 문", x: 8, y: 13 },
      { id: "garden-arch", name: "정원 아치", x: 0, y: 7 },
    ],
    slots: [
      { id: "flowerbeds", objectId: "outdoor-flowers", quantity: 3, required: true },
      { id: "bench-north", objectId: "outdoor-bench", quantity: 1, required: false, at: { x: 4, y: 3 } },
      { id: "bench-south", objectId: "outdoor-bench", quantity: 1, required: false, at: { x: 10, y: 11 } },
      { id: "lamp", objectId: "outdoor-lamp", quantity: 1, required: false, at: { x: 13, y: 6 } },
      { id: "bushes", objectId: "outdoor-bush", quantity: 2, required: false },
    ],
  },
  {
    id: "kitchen-garden", label: "텃밭", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "울타리로 두른 채마밭. 이랑 사이 좁은 길이 남쪽 사립문까지 이어진다.",
    width: 18, height: 14, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "groundAlt", x: 2, y: 2, width: 6, height: 8 },
      { kind: "rect", material: "groundAlt", x: 10, y: 2, width: 6, height: 8 },
      { kind: "rect", material: "path", x: 8, y: 2, width: 2, height: 11 },
    ],
    ports: [
      { id: "wicket-gate", name: "사립문", x: 9, y: 13 },
      { id: "shed-door", name: "헛간 문", x: 16, y: 6 },
    ],
    slots: [
      { id: "fence-north", objectId: "outdoor-fence", quantity: 1, required: true, at: { x: 2, y: 0 } },
      { id: "fence-south", objectId: "outdoor-fence", quantity: 1, required: false, at: { x: 13, y: 12 } },
      { id: "flowers", objectId: "outdoor-flowers", quantity: 2, required: false },
      { id: "crates", objectId: "outdoor-crate", quantity: 1, required: false, at: { x: 14, y: 11 } },
      { id: "barrel", objectId: "outdoor-barrel", quantity: 1, required: false, at: { x: 1, y: 11 } },
    ],
  },
  {
    id: "forest-clearing", label: "숲속 빈터", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "나무가 열린 원형 빈터. 가장자리를 활엽수가 두르고 중앙은 야영이 가능하게 비어 있다.",
    width: 20, height: 18, shape: "rect", floor: "ground",
    areas: [{ kind: "polygon", material: "groundAlt", points: [{ x: 6, y: 4 }, { x: 14, y: 4 }, { x: 16, y: 9 }, { x: 14, y: 14 }, { x: 6, y: 14 }, { x: 4, y: 9 }] }],
    ports: [
      { id: "south-trail", name: "남쪽 오솔길", x: 10, y: 17 },
      { id: "west-trail", name: "서쪽 오솔길", x: 0, y: 9 },
      { id: "hollow-mouth", name: "굴 어귀", x: 10, y: 0 },
    ],
    slots: [
      { id: "tree-nw", objectId: "outdoor-tree", quantity: 1, required: true, at: { x: 3, y: 3 } },
      { id: "tree-ne", objectId: "outdoor-tree", quantity: 1, required: true, at: { x: 15, y: 3 } },
      { id: "tree-sw", objectId: "outdoor-tree", quantity: 1, required: true, at: { x: 3, y: 13 } },
      { id: "tree-se", objectId: "outdoor-tree", quantity: 1, required: true, at: { x: 15, y: 13 } },
      { id: "stumps", objectId: "outdoor-stump", quantity: 2, required: false },
      { id: "bush-west", objectId: "outdoor-bush", quantity: 1, required: false, at: { x: 2, y: 8 } },
      { id: "bush-east", objectId: "outdoor-bush", quantity: 1, required: false, at: { x: 17, y: 8 } },
      { id: "bushes", objectId: "outdoor-bush", quantity: 1, required: false },
      { id: "flowers", objectId: "outdoor-flowers", quantity: 1, required: false, at: { x: 12, y: 8 } },
    ],
  },
  {
    id: "lakeshore", label: "호숫가", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "남쪽이 물에 잠긴 완만한 물가. 모래톱을 따라 걷다가 잔교로 나갈 수 있다.",
    width: 22, height: 16, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "water", x: 0, y: 12, width: 22, height: 4 },
      { kind: "rect", material: "shore", x: 0, y: 9, width: 22, height: 3 },
    ],
    ports: [
      { id: "north-path", name: "북쪽 길", x: 11, y: 0 },
      { id: "pier-head", name: "잔교 어귀", x: 11, y: 10 },
    ],
    slots: [
      { id: "dock", objectId: "outdoor-dock", quantity: 1, required: true, at: { x: 11, y: 9 } },
      { id: "trees", objectId: "outdoor-tree", quantity: 3, required: false },
      { id: "boulders", objectId: "outdoor-boulder", quantity: 1, required: false, at: { x: 3, y: 10 } },
      { id: "barrel", objectId: "outdoor-barrel", quantity: 1, required: false, at: { x: 18, y: 7 } },
    ],
  },
  {
    id: "river-crossing", label: "강 건널목", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "남북을 가르는 개울과 그 위의 목교. 다리 양끝에 길이 정확히 붙어 있다.",
    width: 20, height: 16, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "water", x: 0, y: 7, width: 20, height: 2 },
      { kind: "rect", material: "path", x: 8, y: 0, width: 3, height: 16 },
    ],
    ports: [
      { id: "north-bank", name: "북안", x: 9, y: 0 },
      { id: "south-bank", name: "남안", x: 9, y: 15 },
    ],
    slots: [
      { id: "bridge", objectId: "outdoor-wood-bridge", quantity: 1, required: true, at: { x: 8, y: 5 } },
      { id: "signpost", objectId: "outdoor-sign", quantity: 1, required: false, at: { x: 12, y: 11 } },
      { id: "trees", objectId: "outdoor-tree", quantity: 3, required: false },
      { id: "bushes", objectId: "outdoor-bush", quantity: 2, required: false },
    ],
  },
  {
    id: "harbor-pier", label: "항구 잔교", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "화물이 쌓인 부두. 물은 동쪽에 있고 잔교가 그리로 뻗는다.",
    width: 22, height: 16, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "water", x: 17, y: 0, width: 5, height: 16 },
      { kind: "rect", material: "shore", x: 14, y: 0, width: 3, height: 16 },
      { kind: "rect", material: "path", x: 0, y: 6, width: 14, height: 4 },
    ],
    ports: [
      { id: "town-gate", name: "시내 방향", x: 0, y: 7 },
      { id: "warehouse-door", name: "창고 문", x: 6, y: 2 },
      { id: "gangway", name: "승선구", x: 15, y: 8 },
    ],
    slots: [
      { id: "dock", objectId: "outdoor-dock", quantity: 1, required: true, at: { x: 15, y: 5 } },
      { id: "crates", objectId: "outdoor-crate", quantity: 3, required: true },
      { id: "barrels", objectId: "outdoor-barrel", quantity: 2, required: false },
      { id: "lamp", objectId: "outdoor-lamp", quantity: 2, required: false },
      { id: "bench", objectId: "outdoor-bench", quantity: 1, required: false, at: { x: 3, y: 11 } },
    ],
  },
  {
    id: "snow-camp", label: "설원 야영지", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "침엽수 그늘에 세운 겨울 야영지. 바람막이 울타리가 북쪽을 막고 남쪽만 열린다.",
    width: 20, height: 16, shape: "rect", floor: "ground",
    areas: [{ kind: "rect", material: "groundAlt", x: 4, y: 4, width: 12, height: 8 }],
    ports: [
      { id: "camp-gate", name: "야영 어귀", x: 10, y: 15 },
      { id: "tent-flap", name: "막사 입구", x: 5, y: 4 },
    ],
    slots: [
      { id: "windbreak", objectId: "outdoor-fence", quantity: 2, required: true },
      { id: "pines", objectId: "outdoor-pine", quantity: 4, required: true },
      { id: "stumps", objectId: "outdoor-stump", quantity: 2, required: false },
      { id: "barrels", objectId: "outdoor-barrel", quantity: 1, required: false, at: { x: 14, y: 10 } },
      { id: "crates", objectId: "outdoor-crate", quantity: 1, required: false, at: { x: 5, y: 10 } },
    ],
  },
  {
    id: "mountain-gate", label: "고개 관문", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "고개 목을 막은 석축 관문. 문을 통과하는 한 줄 길만 남기고 양옆은 절벽이다.",
    width: 18, height: 16, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "cliff", x: 0, y: 4, width: 6, height: 8 },
      { kind: "rect", material: "cliff", x: 12, y: 4, width: 6, height: 8 },
      { kind: "rect", material: "path", x: 7, y: 0, width: 4, height: 16 },
    ],
    ports: [
      { id: "lowland-side", name: "저지대 쪽", x: 8, y: 15 },
      { id: "pass-side", name: "고개 쪽", x: 8, y: 0 },
    ],
    slots: [
      { id: "gate", objectId: "outdoor-gate", quantity: 1, required: true, at: { x: 7, y: 6 } },
      { id: "stairs", objectId: "outdoor-stairs", quantity: 1, required: false, at: { x: 7, y: 11 } },
      { id: "signpost", objectId: "outdoor-sign", quantity: 1, required: false, at: { x: 11, y: 13 } },
      { id: "rocks", objectId: "outdoor-rock", quantity: 2, required: false },
    ],
  },
  {
    id: "cave-mouth", label: "동굴 어귀", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "바위 사면에 뚫린 갱구 앞마당. 돌무더기가 흩어져 있고 갱도로 들어가는 길이 하나다.",
    width: 18, height: 14, shape: "rect", floor: "ground",
    areas: [
      { kind: "rect", material: "cliff", x: 0, y: 0, width: 18, height: 4 },
      { kind: "rect", material: "path", x: 7, y: 3, width: 4, height: 11 },
    ],
    ports: [
      { id: "adit", name: "갱구", x: 8, y: 3 },
      { id: "trailhead", name: "산길 어귀", x: 8, y: 13 },
    ],
    slots: [
      { id: "rocks", objectId: "outdoor-rock", quantity: 3, required: true },
      { id: "boulders", objectId: "outdoor-boulder", quantity: 2, required: false },
      { id: "crates", objectId: "outdoor-crate", quantity: 1, required: false, at: { x: 12, y: 8 } },
      { id: "lamp", objectId: "outdoor-lamp", quantity: 1, required: false, at: { x: 5, y: 6 } },
      { id: "dead-trees", objectId: "outdoor-dead-tree", quantity: 1, required: false, at: { x: 15, y: 10 } },
    ],
  },
  {
    id: "mine-chamber", label: "갱도 방", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "채굴이 끝난 넓은 갱실. 사방이 암반이고 중앙 작업면에 광차 화물이 남아 있다.",
    width: 16, height: 14, shape: "rect", floor: "cliff",
    areas: [{ kind: "rect", material: "path", x: 2, y: 2, width: 12, height: 10 }],
    ports: [
      { id: "gallery-south", name: "남쪽 갱도", x: 8, y: 12 },
      { id: "gallery-north", name: "북쪽 갱도", x: 8, y: 2 },
    ],
    slots: [
      { id: "rocks", objectId: "outdoor-rock", quantity: 3, required: true },
      { id: "boulders", objectId: "outdoor-boulder", quantity: 1, required: false, at: { x: 3, y: 9 } },
      { id: "crates", objectId: "outdoor-crate", quantity: 2, required: false },
      { id: "lamp", objectId: "outdoor-lamp", quantity: 2, required: false },
    ],
  },
  {
    id: "ruined-court", label: "폐허 안뜰", environment: "outdoor", tilesetId: "easyrpg_chipset_combined_town",
    description: "무너진 주랑이 남은 옛 안뜰. 깨진 포석 사이로 고사목이 자라 올랐다.",
    width: 20, height: 16, shape: "alcove", floor: "ground",
    areas: [{ kind: "rect", material: "path", x: 3, y: 3, width: 14, height: 10 }],
    ports: [
      { id: "broken-arch", name: "무너진 아치", x: 10, y: 15 },
      { id: "vault-stair", name: "지하 계단", x: 4, y: 4 },
    ],
    slots: [
      { id: "stairs", objectId: "outdoor-stairs", quantity: 1, required: true, at: { x: 3, y: 6 } },
      { id: "dead-trees", objectId: "outdoor-dead-tree", quantity: 2, required: true },
      { id: "boulders", objectId: "outdoor-boulder", quantity: 2, required: false },
      { id: "stone-bridge", objectId: "outdoor-stone-bridge", quantity: 1, required: false, at: { x: 12, y: 11 } },
      { id: "bushes", objectId: "outdoor-bush", quantity: 2, required: false },
    ],
  },
] as const;

const BY_ID = new Map<string, SpaceDef>(SPACE_CATALOG.map((entry) => [entry.id, entry]));

/** id로 공간 정의를 찾는다. 없으면 undefined. */
export function spaceDefById(id: string): SpaceDef | undefined {
  return BY_ID.get(id);
}
