// 재배포 금지 서드파티 RPG Maker MV/MZ 팩을 **사용자가 올린 원본으로** OPRN 타일셋으로 만드는 프리셋 형식.
//
// 저장소에는 그림이 없다. 여기 있는 것은 시트 이름·해시·칸 좌표와 사람 말 이름뿐이다.
// 사용자가 원본 PNG 를 올리면 해시로 판본을 확인하고(layout.ts 가 칸 번호를 정하므로 판본이 다르면
// 번호가 어긋난다) bake.ts 로 아틀라스를 굽고 tilesetPreset.ts 가 조수가 읽을 지식을 붙인다.
// 배경: openwiki/teaching-assistant-tilesets.md 「재배포 금지 서드파티 팩」.

export interface MvPackSheet {
  /** 팩 안 파일 이름. 아틀라스 패널 순서 = 이 배열 순서. */
  readonly file: string;
  /** 팩 안에서 찾을 위치(안내용). */
  readonly folder: string;
  readonly sha256: string;
}

/**
 * 오토타일 한 종류의 쓰임새.
 * - ground: 걷는 바닥(보도·잔디·광장) · road: 차도 · water: 물(막힘)
 * - roof: 옥상·지붕 윗면(막힘) · wall: 건물 외벽(막힘)
 * - mark: 바닥 위에 겹치는 표시(주차선·균열·얼룩, 통행) · fence: 겹치는 울타리·난간(막힘)
 * - plant: 겹치는 풀·덤불(통행) · trim: 벽 위에 겹치는 창틀(벽 통행을 그대로 따른다)
 */
export type MvAutotileRole = "ground" | "road" | "water" | "roof" | "wall" | "mark" | "fence" | "plant" | "trim";

export interface MvPackAutotile {
  readonly sheet: string;
  readonly kind: number;
  readonly name: string;
  readonly role: MvAutotileRole;
  readonly description?: string;
}

/** A5 처럼 오토타일이 아닌 바닥 칸 하나. */
export interface MvPackFlat {
  readonly sheet: string;
  readonly cell: number;
  readonly name: string;
  readonly role: "ground" | "road" | "wall" | "roof";
  readonly description?: string;
}

/**
 * 물체 시트(B~E) 위 여러 칸짜리 물체 하나.
 * - decal: 바닥에 그려진 표시(화살표·횡단보도·맨홀). 통행, 캐릭터 아래.
 * - prop: 전부 막힌 물체(쓰레기통·벤치·분수). 캐릭터와 앞뒤 정렬.
 * - tall: 맨 아래 줄만 막히고 위는 캐릭터 위에 그려지는 키 큰 물체(가로등·나무·자판기).
 * - wallmount: 벽·옥상에 붙이는 것(창문·간판·실외기). 통행은 밑의 벽을 따른다.
 * - door: 벽에 붙이는 문. 그 칸을 걸을 수 있게 만든다(이동 이벤트 자리).
 * - overhead: 전부 캐릭터 위(차양·불빛).
 */
export type MvObjectKind = "decal" | "prop" | "tall" | "wallmount" | "door" | "overhead";

export interface MvPackObject {
  readonly id: string;
  readonly sheet: string;
  /** 시트 안 48px 칸 좌표·크기. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind: MvObjectKind;
  readonly name: string;
  readonly description?: string;
  /** 이어 찍어도 되는 축(차선·울타리·벤치). */
  readonly growth?: "horizontal" | "vertical" | "both";
  /** 차도 위에 세워도 되는 막힌 물체(교통 콘). 나머지는 차도 위에 찍으면 도구가 거부한다. */
  readonly onRoad?: boolean;
  /** tall 에서 막히는 칸(물체 원점 기준). 생략 = 맨 아래 줄 전부. */
  readonly solid?: readonly (readonly [number, number])[];
}

export interface MvPackPreset {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly pack: string;
  readonly author: string;
  readonly url: string;
  readonly credit: string;
  readonly license: string;
  readonly sheets: readonly MvPackSheet[];
  readonly autotiles: readonly MvPackAutotile[];
  readonly flats: readonly MvPackFlat[];
  readonly objects: readonly MvPackObject[];
  /**
   * 창이 그려진 외벽 → 같은 시트의 창 없는 외벽 종류. 문·창·간판·차양은 그림에 투명한 틈이 있어
   * 창 난 벽 위에 찍으면 밑 창이 비친다 — 찍는 칸의 벽을 창 없는 짝으로 바꾼다(작가 예시의 1층 상가처럼).
   */
  readonly plainWalls?: readonly { readonly sheet: string; readonly kind: number; readonly plainKind: number }[];
  /** 마을 짜임 도구(build_pack_town)가 쓰는 재료 이름·물체 id. 없으면 그 팩은 도구를 못 쓴다. */
  readonly town?: MvTownRecipe;
  /** 참고문서 첫 쪽에 들어갈 조립 지침(MD). 칸 번호는 굽는 시점에 채운다 — `{{object:id}}`, `{{auto:name}}`. */
  readonly guide: string;
}

/** 건물 한 벌: 위→아래 옥상 · 창 난 위층(한 줄 = 한 층) · 창 없는 1층 띠. 이름은 autotiles 의 name. */
export interface MvTownFacade {
  readonly roof: string;
  readonly upper: string;
  readonly ground: string;
  readonly door: string;
  /** 가게면 문 위 차양(3칸 overhead). 없으면 사무실·아파트. */
  readonly awning?: string;
  /** 문 옆에 잇는 쇼윈도(wallmount). 1×2 는 1층 띠 두 줄을, 1×1 은 맨 아래 줄만 채운다(윗줄은 차양 그늘). */
  readonly shopfront?: string;
  /** 1×1 쇼윈도 줄의 양끝 조각 [왼끝, 오른끝]. 이어진 쇼윈도 한 덩어리의 첫 칸·끝 칸을 이것으로 바꾼다. */
  readonly shopfrontEnds?: readonly [left: string, right: string];
}

/**
 * 마을 짜임 재료. 작가·사용자 맵과 미국 소도시 짜임(가게 줄은 벽을 맞대고, 주택은 앞마당·진입로,
 * 연석과 보도 사이 잔디 띠, 횡단보도는 교차로에만)을 이 팩의 재료로 옮긴다 — townLayout.ts.
 */
export interface MvTownRecipe {
  readonly road: string;
  /** 교차로 한가운데 — 가장자리에 횡단보도 줄이 저절로 그려지는 차도 재료. */
  readonly intersection: string;
  readonly sidewalk: string;
  /** 연석과 보도 사이 잔디 띠·마당 잔디. */
  readonly lawn: string;
  /** 가게 뒤 골목·뒷마당 주차. */
  readonly alley: string;
  readonly driveway: string;
  readonly path: string;
  /** 공원 바닥 잔디(가로 잔디 띠와 다른 결). 없으면 lawn. */
  readonly parkLawn?: string;
  /** 공원 꽃밭 덩어리(바닥 재료). 없으면 안 칠한다. */
  readonly meadow?: string;
  /** 산책로 가장자리·벤치 밑 닳은 흙 자갈(바닥 재료). 없으면 안 칠한다. */
  readonly worn?: string;
  /** 나무 무리 밑 긴 풀(잔디 위에 겹쳐 까는 재료). 없으면 안 칠한다. */
  readonly tallGrass?: string;
  /** 큰 공원 산책로 가운데 작은 광장 바닥. 없으면 path. */
  readonly plaza?: string;
  /** 겹침 울타리(위층 선). */
  readonly fence: string;
  /** 뒷마당 텃밭(흙·밭). 없으면 안 만든다. */
  readonly garden?: string;
  /** 뒷마당 주차 칸 선(겹침). 없으면 안 긋는다. */
  readonly parkingLine?: string;
  readonly shops: readonly MvTownFacade[];
  readonly offices: readonly MvTownFacade[];
  /** 주택가 블록의 벽 맞댄 중층 주거(1층은 문 + 세로창, 쇼윈도 없음). 없으면 shops 를 쓴다. */
  readonly apartments?: readonly MvTownFacade[];
  readonly houses: readonly { readonly roof: string; readonly wall: string }[];
  readonly objects: {
    readonly lamp: string;
    readonly lampAlt?: string;
    readonly planterTree: string;
    readonly streetTree: string;
    /** 가로수 수종 여럿(없으면 streetTree 하나). 잔디 띠 1칸 폭에 맞는 1칸 폭 나무만. */
    readonly streetTrees?: readonly string[];
    readonly yardTrees: readonly string[];
    /** 공원 나무(없으면 yardTrees). 2칸 폭 큰 나무를 섞어도 된다. */
    readonly parkTrees?: readonly string[];
    readonly hydrant: string;
    readonly trash: string;
    readonly bench: string;
    readonly benchLong?: string;
    readonly fountain?: string;
    readonly bushes: readonly string[];
    readonly flowerBeds: readonly string[];
    readonly vending: readonly string[];
    /** 골목·뒷마당에 두는 것(분리수거함·배전함·상자). */
    readonly backProps: readonly string[];
    readonly houseDoor: string;
    /** 주택 현관문 여러 종(없으면 houseDoor 하나). 이웃 집끼리 다르게 고른다. */
    readonly houseDoors?: readonly string[];
    /** 마당 경계 생울타리(3칸 폭, 가로로 잇는다). 없으면 덤불로. */
    readonly hedge?: string;
    /** 가게 1층 부품: 1줄 문·1줄 쇼윈도(+양끝)·2줄 문·2줄 통유리·1칸 차양. 파사드가 자기 부품이 없을 때 빌려 쓴다. */
    readonly doorRow?: string;
    readonly doorTall?: string;
    readonly shopfrontRow?: string;
    readonly shopfrontRowEnds?: readonly [left: string, right: string];
    readonly shopfrontTall?: string;
    readonly awningSmall?: string;
    readonly houseWindows: readonly string[];
    readonly roofProps: readonly string[];
    /** 옥상 설비(환기구·실외기, 1칸 높이). 옥상 줄 위에 건물마다 0~2개. 없으면 안 둔다. */
    readonly roofGear?: readonly string[];
    /** 가게 앞 보도에 가끔 세우는 것(노점·광고탑). 맨 아래 줄 = 보도 가운데 줄. 없으면 안 둔다. */
    readonly streetProps?: readonly string[];
    /** 큰길 남쪽 보도의 버스 정류장(한 곳). 없으면 안 둔다. */
    readonly busStop?: string;
    /** 가로 승용차 [왼쪽 보기, 오른쪽 보기] 색마다 한 쌍(4×3, onRoad). 뒷마당 주차·길가 주차·차선. 없으면 차를 두지 않는다. */
    readonly carsHorizontal?: readonly (readonly [left: string, right: string])[];
    /** 세로 승용차 [아래 보기, 위 보기] 색마다 한 쌍(2×3, onRoad). 주차 칸 줄·세로 차선. */
    readonly carsVertical?: readonly (readonly [down: string, up: string])[];
    readonly laneHorizontal: string;
    /** 세로 차도를 건너는 횡단보도(1칸, 가로로 이어 찍기) — T 교차로 입구. */
    readonly crosswalkVertical: string;
    readonly arrowLeft: string;
    readonly arrowRight: string;
    /** 세로 차도 화살표(우측통행: 위 = 동쪽 차로, 아래 = 서쪽 차로). 없으면 세로 길엔 화살표를 안 둔다. */
    readonly arrowUp?: string;
    readonly arrowDown?: string;
  };
  /** 꾸밈 재료(간판·카페 가구·신호등·옥상·놀이터 등). 없으면 뼈대만 깐다. 물체 id 는 objects, 나머지는 재료 이름. */
  readonly decor?: MvTownDecor;
}

/** 마을 꾸밈 — 실제 거리 규칙대로 둘 자리가 정해진 부품 목록(townLayout 「꾸밈」 절). */
export interface MvTownDecor {
  /** 가게 간판(위층 벽 맨 아랫줄, 가게마다 하나). */
  readonly signs: readonly string[];
  /** 세로 깃발 간판(위층 벽 가장자리). */
  readonly banners: readonly string[];
  readonly civicSigns: readonly string[];
  readonly shopWindowLarge?: string;
  /** 닫힌 가게 1층 셔터(평타일 재료 이름). */
  readonly shutter?: string;
  /** 창 없는 위층 벽에 다는 넓은 창(3×2)·세로로 긴 창(1×3). */
  readonly upperWindows: readonly string[];
  readonly upperWindowsTall: readonly string[];
  readonly fireEscape?: string;
  readonly wallLadder?: string;
  readonly backDoor?: string;
  /** 옥상 윗면 설비(건물마다 1~3종). */
  readonly roofTop: readonly string[];
  readonly helipad?: string;
  /** 사무실 옥상 앞 가장자리 난간(겹침 재료). */
  readonly roofRailing?: string;
  readonly cafeTables: readonly string[];
  readonly vending: readonly string[];
  readonly atm?: string;
  readonly carts: readonly string[];
  readonly kiosk?: string;
  readonly trafficLights: readonly string[];
  readonly stopSign?: string;
  readonly manholes: readonly string[];
  readonly drainVertical?: string;
  /** 점자 보도블록(겹침 재료) — 횡단보도 끝 보도 칸. */
  readonly tactile?: string;
  readonly cones: readonly string[];
  readonly bollard?: string;
  readonly guardrail?: string;
  /** 세로 골목길·공원의 높은 가로등. */
  readonly tallLamps: readonly string[];
  /** 가게 앞 보도 재료 변주. */
  readonly walkways: readonly string[];
  readonly cobbles: readonly string[];
  /** 카페 테라스 바닥(타일 평타일). */
  readonly terraces?: readonly string[];
  /** 불 켜진 가로등(2칸, 큰길 보도에 한두 개). */
  readonly litLamps?: readonly string[];
  /** 세로 골목길 가운데 차선. */
  readonly laneVertical?: string;
  /** 뒷골목 바닥 얼룩·균열(겹침 재료). */
  readonly stains: readonly string[];
  readonly planterBed?: string;
  readonly planterTrees: readonly string[];
  readonly yardShrubs: readonly string[];
  /** 앞마당 텃밭(바닥 재료). */
  readonly plowed?: string;
  readonly dirt?: string;
  /** 공원 연못 물(바닥)·수련(겹침). */
  readonly pond?: string;
  readonly lily?: string;
  readonly play: readonly string[];
  readonly longBenches: readonly string[];
  readonly picnic?: string;
}
