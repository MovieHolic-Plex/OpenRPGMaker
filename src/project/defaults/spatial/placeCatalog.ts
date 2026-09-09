// project/defaults/spatial/placeCatalog.ts
// 장소 카탈로그 — 배송되는 정본 장소 8종의 선언형 데이터.
//
// 장소는 **자기 래스터를 갖지 않는다.** 자식 공간들을 평면(level)과 좌표로 배치하고,
// 자식들의 이름 있는 포트를 서로 잇는 것이 전부다. 실외 자식들은 level 0 의 한 평면에
// 나란히 놓여 하나의 마을 지도가 되고, 실내 시설은 level 1 이상으로 올려 별도 맵이 된다.
//
// 같은 설계를 두 번 쓰면 **서로 다른 occurrence 두 개**가 된다(working-mine 의 갱실 두 칸,
// lake-country/high-pass 가 공유하는 광산). 설계를 복제하지 않고 자리만 늘린다.

/** 장소가 품는 자식 한 자리. level 이 다르면 다른 평면(별도 맵)이다. */
export interface PlaceChildSpec {
  readonly id: string;
  /** 자식의 종류와 설계 id. space 는 공간 카탈로그/실내 방, place 는 다른 장소다. */
  readonly kind: "space" | "place";
  readonly designId: string;
  readonly x: number;
  readonly y: number;
  readonly level: number;
}

/**
 * 시설 자식의 진입 포트 이름. 배송 데이터와 씨앗 빌더 사이의 계약이다.
 *
 * 시설 템플릿(CONCEPT_FACILITY_TEMPLATES)은 포트 목록을 갖지 않고 role==="entrance" 인
 * 방을 갖는다(inn=reception, house=living, shop=salesfloor, tavern/warehouse=hall,
 * clinic=reception, barracks=mess, church=chapel, hunter=lodge). 빌더는 그 진입 방에서
 * 포트를 하나 만들고 반드시 이 이름을 붙인다. 여기 적힌 이름과 빌더가 만드는 포트가
 * 어긋나면 장소 컴파일이 끊어지므로, 검사(verify-places)가 양쪽을 함께 본다.
 */
export const FACILITY_ENTRY_PORT_ID = "entrance";

/** 자식 포트끼리 잇는 통로. childId 가 null 이면 장소 자신의 포트다. */
export interface PlaceLinkSpec {
  readonly id: string;
  readonly from: { readonly childId: string | null; readonly portId: string };
  readonly to: { readonly childId: string | null; readonly portId: string };
}

export interface PlaceDef {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: "facility" | "settlement" | "natural";
  readonly children: readonly PlaceChildSpec[];
  /** 바깥(지역 개요)에서 이 장소로 들어오는 문. */
  readonly ports: readonly { readonly id: string; readonly name: string; readonly x: number; readonly y: number }[];
  readonly links: readonly PlaceLinkSpec[];
}

/**
 * 배송 정본 8종. 계획서가 지정한 구성원을 정확히 따른다.
 *   lake-village(광장·여관·상점·민가) / forest-hamlet(빈터·민가·사냥꾼 오두막) /
 *   harbor-town(잔교·창고·주점) / snow-outpost(야영지·막사·진료소) /
 *   mountain-pass(관문·건널목·쉼터=inn) / old-ruins(폐허 안뜰·사당=church·동굴 어귀) /
 *   working-mine(동굴 어귀·갱실 둘) / forest-sanctuary(빈터·안뜰·사당=church)
 *
 * 사당과 쉼터는 배송 시설 19종에 전용 항목이 없다. 새 시설을 만들지 않고
 * 실제로 있는 church / inn 을 그 역할로 쓴다 — 없는 id 를 적으면 컴파일이 깨진다.
 *
 * 실내 시설 id 는 CONCEPT_FACILITY_TEMPLATES(19종)에서 그대로 가져온다 — 새로 만들지 않는다.
 */
export const PLACE_CATALOG: readonly PlaceDef[] = [
  {
    id: "lake-village", label: "호숫가 마을", kind: "settlement",
    description: "장터 광장을 중심에 두고 여관·상점·민가가 둘러선 호반 마을. 광장에서 세 시설로 바로 들어간다.",
    children: [
      { id: "square", kind: "space", designId: "market-square", x: 0, y: 0, level: 0 },
      { id: "shore", kind: "space", designId: "lakeshore", x: 0, y: 18, level: 0 },
      { id: "inn", kind: "place", designId: "inn", x: 0, y: 0, level: 1 },
      { id: "shop", kind: "place", designId: "shop", x: 0, y: 0, level: 2 },
      { id: "house", kind: "place", designId: "house", x: 0, y: 0, level: 3 },
    ],
    ports: [{ id: "village-road", name: "마을 어귀", x: 11, y: 17 }],
    links: [
      { id: "square-to-inn", from: { childId: "square", portId: "inn-door" }, to: { childId: "inn", portId: "entrance" } },
      { id: "square-to-shop", from: { childId: "square", portId: "shop-door" }, to: { childId: "shop", portId: "entrance" } },
      { id: "square-to-house", from: { childId: "square", portId: "north-lane" }, to: { childId: "house", portId: "entrance" } },
    ],
  },
  {
    id: "forest-hamlet", label: "숲속 작은 마을", kind: "settlement",
    description: "빈터 하나에 민가와 사냥꾼 오두막만 붙은 작은 정착지. 오솔길 두 갈래가 바깥으로 난다.",
    children: [
      { id: "clearing", kind: "space", designId: "forest-clearing", x: 0, y: 0, level: 0 },
      { id: "house", kind: "place", designId: "house", x: 0, y: 0, level: 1 },
      { id: "hunter-cabin", kind: "place", designId: "hunter", x: 0, y: 0, level: 2 },
    ],
    ports: [{ id: "hamlet-trail", name: "마을 오솔길", x: 10, y: 17 }],
    links: [
      { id: "clearing-to-house", from: { childId: "clearing", portId: "west-trail" }, to: { childId: "house", portId: "entrance" } },
      { id: "clearing-to-cabin", from: { childId: "clearing", portId: "hollow-mouth" }, to: { childId: "hunter-cabin", portId: "entrance" } },
    ],
  },
  {
    id: "harbor-town", label: "항구 마을", kind: "settlement",
    description: "부두 잔교에 창고와 주점이 붙은 항구. 화물길이 창고 문 앞을 지난다.",
    children: [
      { id: "pier", kind: "space", designId: "harbor-pier", x: 0, y: 0, level: 0 },
      { id: "warehouse", kind: "place", designId: "warehouse", x: 0, y: 0, level: 1 },
      { id: "tavern", kind: "place", designId: "tavern", x: 0, y: 0, level: 2 },
    ],
    ports: [{ id: "harbor-road", name: "항구 큰길", x: 0, y: 7 }],
    links: [
      { id: "pier-to-warehouse", from: { childId: "pier", portId: "warehouse-door" }, to: { childId: "warehouse", portId: "entrance" } },
      { id: "pier-to-tavern", from: { childId: "pier", portId: "gangway" }, to: { childId: "tavern", portId: "entrance" } },
    ],
  },
  {
    id: "snow-outpost", label: "설원 초소", kind: "settlement",
    description: "야영지에 막사와 진료소를 붙인 변경 초소. 바람막이 안쪽에서만 이동한다.",
    children: [
      { id: "camp", kind: "space", designId: "snow-camp", x: 0, y: 0, level: 0 },
      { id: "barracks", kind: "place", designId: "barracks", x: 0, y: 0, level: 1 },
      { id: "clinic", kind: "place", designId: "clinic", x: 0, y: 0, level: 2 },
    ],
    ports: [{ id: "outpost-gate", name: "초소 어귀", x: 10, y: 15 }],
    links: [
      { id: "camp-to-barracks", from: { childId: "camp", portId: "tent-flap" }, to: { childId: "barracks", portId: "entrance" } },
      { id: "camp-to-clinic", from: { childId: "camp", portId: "camp-gate" }, to: { childId: "clinic", portId: "entrance" } },
    ],
  },
  {
    id: "mountain-pass", label: "산 고개", kind: "natural",
    description: "관문과 강 건널목을 잇고 그 옆에 쉼터를 둔 고갯길. 관문을 지나야 고개 너머로 간다.",
    children: [
      { id: "gate", kind: "space", designId: "mountain-gate", x: 0, y: 0, level: 0 },
      { id: "crossing", kind: "space", designId: "river-crossing", x: 0, y: 16, level: 0 },
      { id: "rest-house", kind: "place", designId: "inn", x: 0, y: 0, level: 1 },
    ],
    ports: [{ id: "pass-summit", name: "고개 마루", x: 8, y: 0 }],
    links: [
      { id: "gate-to-crossing", from: { childId: "gate", portId: "lowland-side" }, to: { childId: "crossing", portId: "north-bank" } },
      { id: "crossing-to-rest", from: { childId: "crossing", portId: "south-bank" }, to: { childId: "rest-house", portId: "entrance" } },
    ],
  },
  {
    id: "old-ruins", label: "옛 폐허", kind: "natural",
    description: "무너진 안뜰에서 사당과 지하 동굴로 갈라지는 유적. 안뜰이 유일한 분기점이다.",
    children: [
      { id: "court", kind: "space", designId: "ruined-court", x: 0, y: 0, level: 0 },
      { id: "cave", kind: "space", designId: "cave-mouth", x: 0, y: 16, level: 0 },
      { id: "shrine", kind: "place", designId: "church", x: 0, y: 0, level: 1 },
    ],
    ports: [{ id: "ruins-approach", name: "유적 진입로", x: 8, y: 29 }],
    links: [
      { id: "court-to-cave", from: { childId: "court", portId: "broken-arch" }, to: { childId: "cave", portId: "trailhead" } },
      { id: "court-to-shrine", from: { childId: "court", portId: "vault-stair" }, to: { childId: "shrine", portId: "entrance" } },
    ],
  },
  {
    id: "working-mine", label: "가동 광산", kind: "natural",
    description: "갱구에서 갱실 두 칸이 이어지는 채굴장. 같은 갱실 설계가 서로 다른 두 자리에 놓인다.",
    children: [
      { id: "mouth", kind: "space", designId: "cave-mouth", x: 0, y: 0, level: 0 },
      { id: "chamber-upper", kind: "space", designId: "mine-chamber", x: 20, y: 0, level: 0 },
      { id: "chamber-lower", kind: "space", designId: "mine-chamber", x: 20, y: 16, level: 0 },
    ],
    ports: [{ id: "mine-road", name: "광산 길", x: 8, y: 13 }],
    links: [
      { id: "mouth-to-upper", from: { childId: "mouth", portId: "adit" }, to: { childId: "chamber-upper", portId: "gallery-north" } },
      { id: "upper-to-lower", from: { childId: "chamber-upper", portId: "gallery-south" }, to: { childId: "chamber-lower", portId: "gallery-north" } },
    ],
  },
  {
    id: "forest-sanctuary", label: "숲의 성소", kind: "natural",
    description: "빈터 안쪽 안뜰을 지나 사당에 이르는 성역. 안뜰이 빈터와 사당 사이의 전실이다.",
    children: [
      { id: "clearing", kind: "space", designId: "forest-clearing", x: 0, y: 0, level: 0 },
      { id: "courtyard", kind: "space", designId: "quiet-courtyard", x: 20, y: 0, level: 0 },
      { id: "shrine", kind: "place", designId: "church", x: 0, y: 0, level: 1 },
    ],
    ports: [{ id: "sanctuary-path", name: "성소 진입로", x: 10, y: 17 }],
    links: [
      { id: "clearing-to-courtyard", from: { childId: "clearing", portId: "hollow-mouth" }, to: { childId: "courtyard", portId: "garden-arch" } },
      { id: "courtyard-to-shrine", from: { childId: "courtyard", portId: "cloister-gate" }, to: { childId: "shrine", portId: "entrance" } },
    ],
  },
] as const;

const BY_ID = new Map<string, PlaceDef>(PLACE_CATALOG.map((entry) => [entry.id, entry]));

/** id로 장소 정의를 찾는다. 없으면 undefined. */
export function placeDefById(id: string): PlaceDef | undefined {
  return BY_ID.get(id);
}
