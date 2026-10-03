import type { ReliefData } from "@/project/relief/types";
import type {
  AssetSet,
  ActorId,
  AudioDescriptionOverrides,
  MonsterMetadataOverrides,
  CharacterFootprint,
  Dir,
  FlagName,
  MapId,
  MonsterInstanceId,
  ResourceProfile,
  SCHEMA_VERSION,
  CharsetLabelOverride,
  SwitchDef,
  Terms,
  TilesetDef,
  TilesetId,
  TroopId,
  VariableDef,
} from "./base";
import type { ProjectDatabaseRecords, SystemRecords } from "./database";
import type { VillageHouseTemplateRecord, VillageLayoutPresetRecord } from "./village";
import type { AnyQuestDef } from "../quest/questDef";
import type { MapPlanningItem } from "../mapPlanningItems";
import type { WorldCanon } from "../world/canon";
import type { ProjectWorld } from "../world/types";
import type { WorldGraph } from "../worldGraph/types";
import type {
  CharacterProfile,
  CommandV1,
  CommonEvent,
  Condition,
  ConditionV1,
  EventPageGraphic,
  GameEvent,
  Trigger,
  LightingState,
} from "./events";
import type { Season, TimePhase } from "../gameTime";

/** 맵 성격 — 값 목록·라벨·판별은 `@/project/mapRole`(types 배럴은 타입만 내보낸다). */
export type MapRoleKind = "town" | "dungeon" | "field" | "interior";

export interface GameMap {
  /** Unset inherits global weather; indoor suppresses presentation only. */
  climate?: import("../mapClimate").MapClimate;
  id: MapId;
  name: string;
  width: number;
  height: number;
  tilesetId: TilesetId;
  tileSize: number;
  lowerTiles: number[];
  upperTiles: number[];
  /** 2층(바닥 장식). 선택 — 없으면 빈칸. 길이 width*height, -1 = 빈칸. `src/project/mapLayers.ts` 로만 읽고 쓴다. */
  lowerOverlayTiles?: number[];
  /** 4층(물체 하나 더). 선택 — 없으면 빈칸. */
  upperOverlayTiles?: number[];
  /** 그림자 비트 0..15(bit0 왼위·bit1 오른위·bit2 왼아래·bit3 오른아래, MZ 와 같음). 선택 — 없으면 0. */
  shadowBits?: number[];
  /**
   * 높이 지형(칸마다 0~14단). 선택 — 없으면 평지. 렌더러가 절벽을 그려 1층과 3층 사이에 깐다.
   * 크기는 맵과 같다(불러오기 `normalizeProjectRelief` 가 맞춘다). 크기 바꾸기·밀기·잘라내기는
   * `src/project/mapLayers.ts` 의 remap/crop 이 같이 옮긴다. 권위: `src/project/relief/`.
   */
  relief?: ReliefData;
  /** Terrain prop clusters with underlying upper tiles for move/delete restoration. */
  doodadGroups?: import("../doodadGroups").DoodadGroup[];
  terrainDesign?: import("../terrainDesign").TerrainDesignData;
  lowerTileStacks?: Record<number, number[]>;
  upperTileStacks?: Record<number, number[]>;
  events: GameEvent[];
  // 랜덤 인카운트율. 0=발생 안 함. 클수록 자주(스텝당 발생 확률 가중치).
  encounterRate?: number;
  // 인카운트로 등장할 적 그룹 목록. encounterRate > 0 일 때만 사용.
  troopIds?: TroopId[];
  // 조건/가중치 기반 인카운트 테이블. 있으면 troopIds보다 우선한다.
  encounterTable?: EncounterTableEntry[];
  // 필드 몬스터 스폰 정의. 런타임 생존/리스폰 상태는 세이브하지 않고 맵 로드 때 초기화한다.
  fieldSpawns?: FieldSpawnDef[];
  // 활성 로그라이크 런에서 fieldSpawns 후보를 방/층/리셋 세대별로 결정적으로 선택한다.
  roguelikeRoom?: RoguelikeRoomDef;
  // 실시간 추격자가 진입하지 않는 안전지대. 좌표/크기는 타일 단위다.
  safeZones?: Rect[];
  // system.actionCombat.enabled 일 때 이 맵의 필드 스폰 접촉을 턴제 대신 실시간 액션으로 라우팅.
  actionCombat?: boolean;
  /**
   * 옆에서 보는 필드(횡스크롤). 켜면 주인공이 매 걸음 중력으로 떨어지고, 위 키는 점프,
   * 지형 기록 climbable 칸(사다리·밧줄)은 위아래로 오른다. 없으면 기존 탑다운 이동 그대로. player/sideViewPhysics.ts.
   */
  sideView?: boolean;
  /** 옆보기 점프 높이(칸). 없으면 2. */
  sideViewJumpTiles?: number;
  /** 이 칸 수를 넘게 떨어지면 낙하 피해. 없으면 4. */
  sideViewFallTiles?: number;
  /** 넘은 한 칸마다 파티 전원이 받는 낙하 피해. 없으면 10. */
  sideViewFallDamage?: number;
  // 경작 가능한 영역 선언. 경작/물/작물 상태는 PlaySession.farmPlots에만 저장한다.
  farmableArea?: Rect[];
  // 맵 진입 시 세션 lighting에 적용되는 기본 조명. 없는 맵은 이전 조명을 유지한다.
  defaultLighting?: LightingState;
  // RM2003 스타일 맵 속성
  /** 배경(패럴랙스) 이미지 설정. 없으면 타일셋 기본 배경. */
  background?: MapBackground;
  /** 맵 전용 BGM. 없으면 프로젝트 기본 BGM. */
  bgm?: MapBgmSetting;
  /** 전투 배경 이미지 리소스 ID. 없으면 타일셋 기본. */
  battleBackground?: string;
  /** 가장자리가 반대편으로 이어지는 반복 맵(RM 「맵 루프」). 없으면 반복 없음. project/mapLoop.ts. */
  loop?: import("../mapLoop").MapLoop;
  /** 세이브 금지 맵 (RM2003 "Save" 체크 해제). */
  disableSave?: boolean;
  /** 텔레포트(이동) 금지 맵. */
  disableTeleport?: boolean;
  /** 도주(이스케이프) 금지 맵. */
  disableEscape?: boolean;
  /**
   * 맵 성격(마을·던전·필드·실내). 저작자가 고른 정본 — 바로 깔기·배치 조수가 이 값을 먼저 믿고,
   * 없을 때만 조우·이름·레이아웃으로 추정한다(`guessMapRole`). 런타임 동작은 바꾸지 않는다.
   */
  mapRole?: MapRoleKind;
  /**
   * 생성·시공 시 bbox 설계도. 타일 시공 후에도 남겨 두어
   * "가운데 파란 집 옮겨줘" 같은 영역 쿼리에 쓴다. 선택 필드 — 옛 맵 호환.
   *
   * **사람이 편집하는 층이 아니다.** `setMapLayoutPlan` 이 통째로 갈아치우는 빌더 기록이라
   * 손으로 고친 값이 재시공에서 조용히 사라진다. 사람·이벤트·인카운터가 이름으로 가리키는
   * 층은 `locations` 이고, 둘 사이 이동은 `adoptLayoutRegionsAsLocations` 한 방향뿐이다
   * (layoutPlan 은 절대 역으로 바뀌지 않는다). `openwiki/runtime-project-schema.md` 의
   * 「명명 로케이션 레이어」 절 참조.
   */
  layoutPlan?: MapLayoutPlan;
  /**
   * 사람이 저작하는 명명 로케이션 층. 안정 ID(`id`) + 사용자 표시명(`name`) 이 분리돼
   * 이름을 바꿔도 이벤트 조건·인카운터 참조가 살아 있다.
   * optional 이라 옛 맵은 필드 자체가 없다(마이그레이션 불필요, 옛 빌더 맵도 불변).
   */
  locations?: MapNamedLocation[];
  /**
   * 역할(안전지대·경작지) 투영의 마지막 결과. 로케이션 ID → 그때 넣은 사각형.
   * optional 이라 옛 맵은 없다 — 없으면 «우리가 넣은 사각형이 없다» 는 뜻이고,
   * `safeZones`/`farmableArea` 의 모든 항목을 손 저작으로 보존한다.
   */
  locationRoleProjection?: LocationRoleProjection;
  /** 시공 당시 설계서와 시드. 원본 변경이 기존 맵을 바꾸지 않는다. */
  villageDesignSource?: {
    preset: VillageLayoutPresetRecord;
    seed: number;
    houseCount: number;
    /** 시공 시 확정된 재료·형태·자연 규칙. 원본 자산 수정과 독립된 기록. */
    resolvedSettings?: Record<string, unknown>;
  };
  /**
   * 방 하네스(실내 villager-room-v1 / 던전 dungeon-room-v1)가 이 맵을 시공할 때 쓴 플랜 원본.
   *
   * 세션(RoomSession)은 에디터 메모리(WeakMap)에만 살고 Project JSON 에 직렬화되지 않는다. 그래서
   * 프로젝트를 다시 열면 `furnish_interior_space` 처럼 sessionId 를 요구하는 in-place 툴의 진입로가
   * 사라졌다(2026-08-29 modify 진단 근본원인 8). 플랜을 맵에 남겨 mapId 만으로 세션을 재수립한다.
   * `plan` 은 킷별 플랜 타입이라 여기서는 JSON 값으로만 다룬다(project → editor 역참조 금지).
   */
  roomHarnessPlan?: { kitId: string; plan: unknown };
  /**
   * 제작자가 맵마다 켜고 끄는 미니맵 설정. optional — 없으면 미니맵 off(기존 맵 호환).
   * v1은 1회 정적 썸네일 + 플레이어 점만 갱신; fogOfWar는 자리만 두고 추후 확장.
   */
  minimap?: MapMinimapSetting;
  /**
   * 이 맵 위를 흘러가는 구름 그림자. optional — 없으면 그림자 없음(기존 맵 호환).
   * 수치는 저작 설정이고, 시간에 따른 위치 계산은 `src/player/cloudShadows.ts` 의
   * 순수 함수가 맡는다(같은 시간 입력은 언제나 같은 그림자).
   */
  cloudShadows?: MapCloudShadowSetting;
  /** Optional map-wide decorative layers; independent of gameplay weather. */
  atmosphereEffects?: import("../atmosphere").AtmosphereEffect[];
  /**
   * 맵에 찍힌 구조물 킷 배치 기록. "여기에 이 집이 있다"를 남겨 다시 고르고·고치고·지울 수 있게 한다.
   * 기록 범위는 구조물 킷 스탬프만 — 사람이 팔레트로 찍은 것.
   * 마을 자동 생성(빌더)의 집 시공은 layoutPlan.regions 가 담당하며 여기에 들어오지 않는다.
   * 배열 순서가 곧 시간 순서다 — 겹칠 때는 뒤(나중)가 이긴다. optional 이라 마이그레이션 불필요.
   */
  structurePlacements?: StructurePlacement[];
  /**
   * 사용자가 이 맵에 보존해 둔 기획 항목(사람이 읽는 한 줄). 조수 세션이 죽어도 남고,
   * 새 대화·프로젝트 재열기에도 사라지지 않는다. optional — 없는 맵은 옛 저장본과 동일하다.
   *
   * 이것은 자동 프롬프트 기억이 아니다. 재사용(없음/전체/선택)은 매 턴 사용자가 컴포저에서
   * 고르고, 고르지 않으면 어떤 문장도 조수에게 가지 않는다. 시공 게이트·검증기는 읽지 않는다.
   * 권위: `src/project/mapPlanningItems.ts`.
   */
  planningItems?: MapPlanningItem[];
}

/** 맵에 찍힌 구조물 킷 한 채. 좌상단(x,y) + 크기(w,h)는 찍은 순간의 킷 크기다. */
export interface StructurePlacement {
  id: string;
  /** tileset.structureKits[].id. */
  kitId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stampedAt?: string;
  /** 찍기 직전 그 자리의 타일 (길이 w*h) — 지우기 복원용. 행 우선(y*w+x). */
  before: { lower: number[]; upper: number[] };
  /** 찍은 직후 맵에서 되읽은 타일의 해시 — 이후 덧칠 감지용(soft hint). */
  afterHash: string;
}

/**
 * 맵 배경(패럴랙스) 설정 — RM2003 Background 탭 대응.
 *
 * 순서: 하층 타일 **아래**에 깔리고, 비어 있는 칸이 그 그림을 보이는 창이 된다.
 * 위치: 화면 고정(카메라를 따라 흐르지 않는다) — RM 계열 파노라마와 같다.
 * 속도: **60Hz 논리 프레임당 px** (`@/project/mapBackground` 의 상한 참조).
 */
export interface MapBackground {
  /** 배경 배경 그림 리소스 ID(예: `easyrpg-backdrop-sky1`). 외부 URL 은 해석되지 않는다. */
  imageId: string;
  /** 수평 스크롤 속도 (px/프레임, 0=고정). */
  scrollX?: number;
  /** 수직 스크롤 속도 (px/프레임, 0=고정). */
  scrollY?: number;
  /** 수평 반복(기본 true). 끄면 그림이 한 번만 그려지고 그 밖은 배경색이 비친다. */
  loopX?: boolean;
  /** 수직 반복(기본 true). */
  loopY?: boolean;
  /**
   * 그림을 뷰포트에 맞추는 방식.
   * - native(기본): 원본 픽셀 그대로(1:1). RPG Maker 파노라마처럼 게임 해상도에 맞춰
   *   제작된 그림용이다.
   * - cover: 그림이 화면을 덮을 때까지 확대·축소해 보여준다. 1920x1080 등 더 높은
   *   배경 아트를 320x240 게임에 그대로 쓰면 좌상단 구석만 보이고 지면·나무가 화면
   *   밖으로 나간다.
   */
  fit?: MapBackgroundFit;
  /**
   * 카메라를 얼마나 따라 움직이는가(깊이). 0(기본) = 화면 고정 — 카메라가 움직여도 제자리,
   * 1 = 타일과 똑같이 움직인다, 1 초과 = 타일보다 빨리 지나간다(앞 전경).
   * 층마다 값을 다르게 주면 시차(패럴랙스) 스크롤이 된다 — 먼 산 0.1, 가까운 숲 0.6 처럼.
   * 자동 흐름(scrollX/Y)과 더해진다. `@/project/mapBackground` 의 상한을 따른다.
   */
  cameraFollow?: number;
  /**
   * 빈 칸(하층 타일 없음)에서도 배경을 보인다. 기본(생략)은 RM2K 규칙 — 빈 칸은 검게 가리고
   * 파노라마 창 타일(합본 마을 #233·#258)을 깐 칸에서만 비친다. 창 타일은 합본 마을 칩셋에만 있어서
   * 다른 칩셋 맵(숲마을·기후 시트 등)은 이 값을 켜야 하늘 자리를 비워 배경을 보일 수 있다.
   */
  showInEmptyCells?: boolean;
  /**
   * 배경 위에 얹는 추가 레이어(최대 8장). 첫 장은 이 객체의 imageId 다 — 레이어
   * 배열(앞이 아래)과 함께 그려진다. CraftPix 레이어 팩 같은 다중 배경용이고,
   * 생략하면 단일 그림 저작(레거시 JSON)과 같다.
   */
  layers?: MapBackgroundLayer[];
}

/** 배경 그림을 뷰포트에 맞추는 방식. 자세한 뜻은 MapBackground.fit 참고. */
export type MapBackgroundFit = "native" | "cover";

/** 맵 배경의 한 레이어. 스크롤 단위·반복 규칙은 MapBackground 와 같다. */
export interface MapBackgroundLayer {
  /** 배경 그림 리소스 ID. */
  imageId: string;
  /** 수평 스크롤 속도 (px/프레임, 0=고정). */
  scrollX?: number;
  /** 수직 스크롤 속도 (px/프레임, 0=고정). */
  scrollY?: number;
  /** 수평 반복(기본 true). */
  loopX?: boolean;
  /** 수직 반복(기본 true). */
  loopY?: boolean;
  /** 그림 맞추기 방식(기본 native). */
  fit?: MapBackgroundFit;
  /** 카메라 따라가기 비율(깊이). 뜻은 MapBackground.cameraFollow 와 같다. */
  cameraFollow?: number;
}

/** 맵 BGM 설정 — RM2003 BGM 탭 대응. */
export interface MapBgmSetting {
  /** "parent" = 상위 맵/프로젝트 기본, "none" = 무음, "custom" = 지정 곡. */
  mode: "parent" | "none" | "custom";
  /** mode="custom"일 때 리소스 ID. */
  resourceId?: string;
  /** 페이드인 시간(ms). */
  fadeInMs?: number;
}

/**
 * 맵별 구름 그림자 설정 — 제작자가 맵마다 켜고 끈다. optional이므로 기존 맵은 그대로 off.
 *
 * 값은 «의도» 만 담는다: 얼마나 짙은가(opacity), 어느 방향으로 얼마나 빨리 흐르는가
 * (angleDeg·speed), 덩어리가 얼마나 큰가(scale). 프레임마다의 그림자 위치는 저장하지 않는다 —
 * 순수 함수가 시간에서 계산하므로 세이브·재현이 자동으로 맞는다.
 */
export interface MapCloudShadowSetting {
  /** 이 맵에서 구름 그림자를 그리는가. 기본 false. */
  enabled: boolean;
  /** 구름량(0~6). 0=없음, 3=보통(기본), 6=많음. 크기·진하기와 독립. */
  amount?: number;
  /** 그림자 진하기(0.05~0.6). 기본 0.26. */
  opacity?: number;
  /** 흐르는 속도 — 월드 px/초(0~160). 기본 8. 0이면 제자리에 머문다. */
  speed?: number;
  /** 흐르는 방향(도). 0=오른쪽, 90=아래. 기본 28. */
  angleDeg?: number;
  /** 구름 덩어리 크기 배율(0.5~2.5). 기본 1. */
  scale?: number;
}

/** 맵별 미니맵 설정 — 제작자가 맵마다 켜고 끈다. optional이므로 기존 맵은 그대로 off. */
export interface MapMinimapSetting {
  /** 미니맵을 이 맵에서 노출하는가. 기본 false. */
  enabled: boolean;
  /** 모서리 위치. 기본 topRight. */
  corner?: "topRight" | "topLeft" | "bottomRight" | "bottomLeft";
  /** 표시 배율(0.08~0.5). 기본 auto(= 96 / max(W*16, H*16) 클램프). */
  scale?: number;
  /** 이벤트 마커를 미니맵에 표시하는가. 기본 true. */
  showEvents?: boolean;
  /** 안개(미방문 어둡게). v1은 자리만 두고 false 고정. */
  fogOfWar?: boolean;
}

/** 맵 기물 영역 (집 롯·시장·숲·강 등). 시공 후에도 좌표·역할 유지. */
export interface MapLayoutRegion {
  id: string;
  /** river | lake | plaza | market | house | forest | custom… */
  role: string;
  /** 사용자/에이전트 질의용 표시명 (예: "파랑 지붕 집", "중앙 상점") */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 집 키트 등 부가 속성 */
  kitId?: string;
  shape?: string;
  yardTheme?: string;
  tags?: string[];
  doorAt?: { x: number; y: number };
  front?: { x: number; y: number };
  /** Saved exterior provenance; facade floors do not imply interior maps or occurrences. */
  objectExterior?: {
    objectId: string;
    revision: number;
    doorApproaches: { x: number; y: number }[];
    privateAccess: { x: number; y: number }[];
  };
  hasFence?: boolean;
}

export interface MapLayoutPlan {
  version: 1;
  kind: string;
  seed?: number;
  generatedAt?: string;
  regions: MapLayoutRegion[];
  roadAnchors?: { id: string; x: number; y: number }[];
  notes?: string;
}

export interface EncounterTableEntry {
  troopId: TroopId;
  weight: number;
  conditions?: EncounterConditions;
}

export interface EncounterConditions {
  switchId?: string;
  variableId?: string;
  atLeast?: number;
  minPartyLevel?: number;
  maxPartyLevel?: number;
  /**
   * 레거시 생좌표 사각형. 계속 지원한다 — 옛 저작물은 그대로 동작하고,
   * 새 저작은 `locationId` 를 권장한다. 둘이 함께 있으면 `locationId` 가 이긴다.
   */
  region?: Rect;
  /**
   * 같은 맵의 `locations[].id`. 사각형을 베끼지 않고 이름 붙은 로케이션을 가리킨다.
   * 로케이션을 넓히면 이 조건도 함께 넓어진다(복사본이 없으므로 어긋날 수 없다).
   */
  locationId?: string;
  timePhase?: TimePhase;
  season?: Season;
}

/**
 * 사람이 이름 붙인 맵 영역 한 개. 맵 안에서만 유효한 ID 다(맵 복사는 ID 를 그대로 옮긴다 —
 * 참조도 같은 맵 안에서만 걸리므로 복사본은 자기 로케이션을 가리킨다).
 */
export interface MapNamedLocation {
  /** 맵 안에서 유일한 안정 ID. 이름을 바꿔도 변하지 않는다. */
  id: string;
  /** 사용자·조수 대화에 쓰는 표시명. 중복이 허용되지만 편집기가 경고한다. */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 저작 의도 메모. 조수 프롬프트에 그대로 실린다. */
  note?: string;
  /** 검색·조수 질의 보조 낱말. */
  tags?: string[];
  /** 편집기 레이어 표시색(#RRGGBB). 없으면 ID 해시로 결정론적 배정. */
  color?: string;
  /** layoutPlan.regions 에서 승격돼 왔다면 그 출처. 되돌림/추적용이며 역방향 동기화는 없다. */
  origin?: MapNamedLocationOrigin;
}

export interface MapNamedLocationOrigin {
  kind: "layoutRegion";
  /** 원본 MapLayoutRegion.id. 원본이 사라져도 로케이션은 남는다(스냅샷). */
  regionId: string;
  /** 승격 당시 layoutPlan.kind. */
  planKind?: string;
}

/** 로케이션이 투영하는 맵 시스템. 정의는 `src/project/locationRoles.ts`. */
export type LocationRole = "safeZone" | "farmable";

/**
 * 역할 투영의 **마지막 결과** (2026-09-12). `safeZones`/`farmableArea` 안에서 «우리가 넣은
 * 사각형» 을 로케이션 ID 로 기억한다.
 *
 * 왜 로케이션 쪽(`origin`)이 아니라 맵에 두는가: 구역을 **지우면** 그 로케이션의 표시도
 * 함께 사라져 옛 사각형을 식별할 수 없다 — 유령이 남는다. 기록이 맵에 있으면 삭제·이동 모두
 * «지난번에 내가 넣은 것» 을 정확히 걷어낼 수 있다.
 */
export type LocationRoleProjection = {
  readonly [role in LocationRole]?: Record<string, Rect>;
};

/**
 * 진영 간 태도. -2 최악의 적 / -1 적 / 0 중립 / 1 우호 / 2 동맹.
 * 태도는 "싸워도 되는가"만 정한다. 실제 선공은 FactionAggression 이 정한다.
 */
export type FactionStance = -2 | -1 | 0 | 1 | 2;

/** 적대를 실제 선공으로 바꾸는 성향. 0 비공격 / 1 공격적 / 2 매우 공격적 / 3 광폭. */
export type FactionAggression = 0 | 1 | 2 | 3;

export interface FactionDef {
  id: string;
  name: string;
  /** 세계관에서 구체화된 진영이면 원본 WorldEntity.id. 전투 ID를 바꿔도 출처 정체성을 유지한다. */
  worldEntityId?: string;
  /** 진영 식별 색(#RRGGBB). 난전에서 누가 어느 편인지 읽히게 하는 유일한 UI 수단이다. */
  color?: string;
  /** 생략 시 1(공격적) — 적(-1 이하) 에게만 선공한다. */
  aggression?: FactionAggression;
  /** 이 진영 멤버는 다른 NPC 에게 죽지 않는다(HP 1 에서 버틴다). 플레이어는 죽일 수 있다. */
  protectedFromNpcs?: boolean;
}

export interface FactionRelationDef {
  a: string;
  b: string;
  stance: FactionStance;
}

/**
 * 저작된 진영 레지스트리. optional 이라 마이그레이션 불필요.
 * 생략하면 예약 진영(player/enemy)만 존재해 기존 프로젝트 동작이 그대로 유지된다.
 */
export interface PlayerKillReputationConfig {
  /** 처치 1회가 각 관련 진영의 플레이어 태도에 더해지는 양. 생략 시 0.25. */
  readonly weight?: number;
}

export interface ProjectFactions {
  defs: FactionDef[];
  relations: FactionRelationDef[];
  /** 플레이어의 NPC 처치가 평판에 번지는 규칙. 필드가 없으면 기존처럼 자동 변화가 전혀 없다. */
  playerKillReputation?: PlayerKillReputationConfig;
}

export interface FieldSpawnDef {
  id: string;
  troopId: TroopId;
  area: Rect;
  /**
   * 같은 맵의 `locations[].id`. 있으면 **사각형 대신** 이 구역을 스폰 영역으로 쓴다 —
   * 구역을 옮기면 스폰도 따라간다(2026-09-12). `area` 는 그대로 남는다:
   * 옛 저장본 호환 + 구역이 지워졌을 때의 폴백.
   */
  locationId?: string;
  maxAlive?: number;
  respawnSec?: number;
  graphic?: EventPageGraphic;
  /** 스폰되는 몸 크기(타일). 생략하면 1x1 — 기존 스폰과 같다. */
  footprint?: CharacterFootprint;
  /** 몸 사각 하단 몇 행이 길을 막는가. 생략하면 몸 높이 전체(항등). */
  passRows?: number;
  chase?: boolean;
  /** 이 스폰 인스턴스의 진영. 생략 시 EnemyRecord.factionId, 그것도 없으면 예약 진영 enemy. */
  factionId?: string;
  /** 처치 수를 세이브에 영속한다. 로드/맵 재진입 시 처치 수만큼 배치 상한이 줄어, 전부 처치한 방은 계속 비어 있다(생존 호러용). */
  persistKill?: boolean;
  /** 인스턴스 처치 시 켜는 스위치(킬 리액션 이벤트용). */
  onKillSwitchId?: string;
}

export interface RoguelikeRoomDef {
  /** 런 상태에서 방을 식별하는 안정 ID. 생략하면 map.id를 쓴다. */
  roomId?: string;
  /** 방 세대가 바뀔 때 이 맵 이벤트의 셀프 스위치와 Erase Event 상태를 초기화한다. 기본 true. */
  resetEventState?: boolean;
  /** 슬롯마다 eligible choice 하나를 뽑는다. 어떤 슬롯에도 언급되지 않은 fieldSpawn은 항상 활성이다. */
  encounterSlots?: RoguelikeEncounterSlot[];
}

export interface RoguelikeEncounterSlot {
  id: string;
  choices: RoguelikeEncounterChoice[];
}

export interface RoguelikeEncounterChoice {
  fieldSpawnId: string;
  weight?: number;
  minFloor?: number;
  maxFloor?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapTreeNode {
  mapId: MapId;
  children: MapTreeNode[];
  /** 플레이 맵이 아닌 트리 분류. `maps`에 행이 없다. */
  kind?: "map" | "folder";
  /** 분류 표시 이름. 맵 노드는 `maps[id].name`을 쓴다. */
  name?: string;
}

export interface ProjectSession {
  switches: Record<string, boolean>;
  selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  variables: Record<string, number>;
  timers?: Record<string, number>;
  inventory: Record<string, number>;
  partyActorIds: ActorId[];
  /** Optional authored monster collection seed for new games. */
  monsterInstances?: Record<MonsterInstanceId, import("@/project/session").MonsterInstance>;
  monsterParty?: MonsterInstanceId[];
  monsterBox?: MonsterInstanceId[];
  gold?: number;
  /**
   * 시작 시 세계에 놓인 설치물(바위·나무 등), `mapId:x,y` 키.
   * 밭 상태와 달리 저작 표면이 필요하다 — 광산의 돌은 맵 타일이 아니라 세션 상태이고,
   * 캐면 사라지므로 새 세션마다 다시 놓여야 한다.
   */
  placeables?: Record<string, import("@/project/placeables").PlaceableObjectState>;
  /** Editor-authored farm animals instantiated by startSession; runtime progress is not written here. */
  farmAnimals?: FarmAnimalStartInstance[];
  /** Editor-authored general structures, independent from P1 animal homes. */
  farmBuildingPlacements?: FarmBuildingPlacement[];
  /** Editor-authored home objects. */
  homeDecorationPlacements?: HomeDecorationPlacement[];
}

export interface FarmAnimalStartInstance {
  readonly instanceId: string;
  readonly speciesId: string;
  readonly name: string;
  readonly eventId?: string;
  readonly buildingId?: string;
  /** Actual farm-building placement instance; mutually exclusive with buildingId. */
  readonly housingPlacementId?: string;
}

export interface FarmBuildingPlacement {
  readonly instanceId: string;
  readonly typeId: string;
  readonly level: number;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly orientation: Dir;
}

export interface HomeDecorationPlacement {
  readonly instanceId: string;
  readonly typeId: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly orientation: Dir;
}

/**
 * 프로젝트의 "시작 상태"(에디터가 정의하는 초기 스위치/변수/골드/인벤토리/파티).
 * 런타임 상태(PlaySession)와는 다른 개념이며, 새 세션의 시드로만 쓰인다.
 *
 * @deprecated 의미를 드러내기 위한 alias. 새 코드는 이 타입과 `startStateOf(project)`
 *   헬퍼를 함께 사용해 "런타임이 아니라 시작 상태를 읽는다"는 의도를 명시할 것.
 *   직렬화 키는 마이그레이션 없이 `session` 그대로 유지한다.
 */
export type ProjectStartState = ProjectSession;

export interface SaveSlot {
  schemaVersion: typeof SCHEMA_VERSION;
  projectTitle: string;
  session: ProjectSession;
  mapId: MapId;
  player: { x: number; y: number; direction: Dir };
}

export interface MapConnectionEndpoint {
  mapId: MapId;
  x: number;
  y: number;
  direction?: Dir;
}

export interface MapConnection {
  id: string;
  name?: string;
  from: MapConnectionEndpoint;
  to: MapConnectionEndpoint;
  playerEnabled: boolean;
  npcEnabled: boolean;
}

export interface VillageInfoDocument {
  id: string;
  mapId: MapId;
  title: string;
  markdown: string;
}

// AI 문서(하이브리드 블록) — AI가 present_doc 툴로 만드는 리치 설명 문서.
// 구조화 블록은 프로젝트의 살아있는 데이터(타일셋)를 참조해 렌더되고,
// html 블록은 샌드박스 iframe 탈출구다. optional이라 마이그레이션 불필요.
export type AiDocBlock =
  | { kind: "markdown"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | {
      kind: "sheetMap";
      tilesetId: string;
      zones: { col: number; row: number; w: number; h: number; label: string; color?: string }[];
    }
  | {
      kind: "tileBlockCard";
      tilesetId: string;
      col: number;
      row: number;
      w: number;
      h: number;
      title: string;
      caption?: string;
      badge?: string;
    }
  | { kind: "paintDemo"; tilesetId: string; blockCol: number; blockRow: number; title?: string }
  | { kind: "html"; src: string };

export interface AiDocument {
  id: string;
  title: string;
  createdAt: string;
  blocks: AiDocBlock[];
  pinned?: boolean;
}

// 테스트 상태 프리셋(Phase 4-1). 스위치/변수/인벤토리/골드/시작 좌표를 부분 저장해
// 시연 실행/헤드리스 러너에서 특정 진행 상황을 재현한다. optional이라 마이그레이션 불필요.
export interface TestPreset {
  id: string;
  name: string;
  switches?: Record<string, boolean>;
  variables?: Record<string, number>;
  inventory?: Record<string, number>;
  gold?: number;
  startMapId?: MapId;
  startPos?: { x: number; y: number };
}

/** 강하게 다시 하기(New Game+) 판정의 엔딩 전용 조건. 트리거 시점의 session.flags.ngplus 를 본다. */
export type EndingNewGamePlusCondition = { kind: "newGamePlus"; value: boolean };

export type EndingCondition = Extract<Condition, { kind: "switch" | "variable" }> | EndingNewGamePlusCondition;

// 선언형 엔딩 레지스트리. switch/variable conditions가 모두 참인 엔딩 중 priority가
// 가장 높은 항목을 triggerEnding이 선택한다. epilogue는 script_cutscene과 같은 beat 배열이다.
export interface EndingDef {
  id: string;
  name: string;
  conditions: EndingCondition[];
  priority: number;
  epilogue?: Record<string, unknown>[];
  presentation?: import("../cinematicSettings").EndingPresentation;
}

export type StoryFlagKind = "switch" | "variable";

// 스위치/변수 번호에 붙는 서사 의미 레지스트리. 런타임 상태는 여전히 기존
// Project.session/PlaySession.switches·variables가 소유하며, 이 구조는 메타데이터만 저장한다.
export interface StoryFlagDef {
  id: string;
  kind: StoryFlagKind;
  targetId: string;
  description: string;
  questId?: string;
  tags?: string[];
  retired?: boolean;
}

export interface Project {
  terrainStamps?: import("../terrainDesign").TerrainStamp[];
  /** Confirmed new-project interview; travels with SQLite, export, and later AI turns. */
  gameDesignBrief?: import("../gameDesignBrief").GameDesignBrief;
  /** Prompt library and dialogue review preferences, saved with this project. */
  aiAuthoring?: import("../aiAuthoring").AiAuthoring;
  /** Optional spatial authoring authority, separate from lore, worldGraph and runtime saves. */
  spatialAuthoring?: import("../spatial/types").SpatialAuthoringDocument;
  /** Independent skill graphs; promotion edges remain ClassRecord.promotions. */
  growth?: import("../growth/types").GrowthDefinition;
  version: number;
  meta: {
    oprnFieldMenu?: import('../fieldMenu').AuthoredFieldMenu;
    oprnMenuSounds?: Partial<Record<'cursor'|'confirm'|'cancel',string>>;
    oprnMusicScores?: Record<string,{sha256:string;score:import('../musicScore').MusicScore;measurements:ReturnType<typeof import('../musicScore').renderMusicScore>['measurements']}>;
    title: string;
    author: string;
    terms: Terms;
    publication?: import("../publication").Publication;
    /** 부팅 정규화를 마친 «빌드·공용 판본» 짝. 짝이 맞으면 다음 로드가 정규화기를 건너뛴다(bootNormalization.ts). */
    /** Full timelines preserved through older host schema validators. */
    oprnCinematicTimelines?: import("../cinematicWire").CinematicWireCapsule;
    bootNormalization?: { v: number; lib: string };
  };
  assets: AssetSet;
  resourceProfiles: ResourceProfile[];
  tilesets: Record<TilesetId, TilesetDef>;
  switches: SwitchDef[];
  variables: VariableDef[];
  commonEvents: CommonEvent[];
  database: ProjectDatabaseRecords;
  system: SystemRecords;
  session: ProjectSession;
  maps: Record<MapId, GameMap>;
  mapConnections?: MapConnection[];
  villageInfoDocuments?: VillageInfoDocument[];
  // 데이터베이스 「마을」탭 레코드 — 사용자가 만든 집 형태와 배치 프리셋.
  // 마을 하네스(author_village)가 시공 전에 읽고, AI 컨텍스트에도 실린다.
  // 프로젝트에 있으면 전부 사용자 저작이다(내장 34종은 코드 카탈로그가 정본).
  // optional이라 마이그레이션 불필요.
  villageTemplates?: VillageHouseTemplateRecord[];
  villagePresets?: VillageLayoutPresetRecord[];
  /** AI가 설계서를 생략할 때 사용하는 사용자 지정 기본 설계서. */
  defaultVillagePresetId?: string;
  // AI 리치 설명 문서(채팅 present_doc 툴 산출물). optional이라 마이그레이션 불필요.
  aiDocuments?: AiDocument[];
  // 조수에게 항상 주는 사용자 고정 지침(ai/projectInstructions.ts). 시스템 프롬프트의 예산 밖
  // 고정분으로 들어가 압축·새 대화·복원에도 살아남는다. optional이라 마이그레이션 불필요.
  aiInstructions?: string;
  /** 세계 허리 — 이름·전제·톤·없는 것·법칙·이 세계 본문. 목록이 아니라 싱글톤. */
  worldCanon?: WorldCanon;
  world?: ProjectWorld;
  worldGraph?: WorldGraph;
  // 런타임 진영 레지스트리 + 태도 행렬. world(세계관 lore 그래프)와 달리 전투 런타임이 직접 읽는다.
  // optional이라 마이그레이션 불필요.
  factions?: ProjectFactions;
  // 선언적 퀘스트 정의(Phase 3). questCompiler가 스위치/변수/이벤트로 컴파일하며,
  // 플레이어 퀘스트 로그가 이 메타 + 세션 상태로 단계를 표시한다. optional이라 마이그레이션 불필요.
  quests?: AnyQuestDef[];
  // 테스트 상태 프리셋(Phase 4-1). 에디터 디버그 패널이 저장/적용한다. optional.
  testPresets?: TestPreset[];
  // 세션 상태와 분리된 authored 엔딩 정의. 체크포인트와 달리 프로젝트 JSON에 저장된다.
  endings?: EndingDef[];
  // 스위치/변수에 대한 서사 의미 레지스트리. 기존 상태 머신을 대체하지 않는다.
  storyFlags?: StoryFlagDef[];
  // Optional identity package keyed by GameEvent.characterId. Opt-in; no migration.
  // Gift/birthday resolution: event-local fields override profile defaults (see characterProfiles.ts).
  characters?: Record<string, CharacterProfile>;
  // 사용자가 에디터에서 고친 캐릭터 칩 라벨. 번들 CHARSET_SEMANTICS 위에 덮어
  // 검색·AI 질의·피커 표시가 전부 이 값을 우선으로 읽는다. optional이라 마이그레이션 불필요.
  charsetLabels?: CharsetLabelOverride[];
  /** Project-authored audio overrides only; catalog defaults are never stored here. */
  audioDescriptions?: AudioDescriptionOverrides;
  /** Editor-only monster overrides, keyed by raw resource ID. */
  monsterMetadata?: MonsterMetadataOverrides;
  mapTree: MapTreeNode;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}

export interface ProjectV2 {
  version: number;
  meta: { title: string; author: string; terms: Terms };
  assets: AssetSet;
  tilesets: Record<TilesetId, TilesetDef>;
  switches: SwitchDef[];
  variables: VariableDef[];
  commonEvents: CommonEvent[];
  maps: Record<MapId, GameMap>;
  mapTree: MapTreeNode;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}

export interface AssetRefV1 {
  type: "bundled";
  id: string;
}

export interface TilesetDefV1 {
  id: string;
  image: AssetRefV1;
  tileSize: number;
  tilesPerRow: number;
  count: number;
}

export interface SpriteDefV1 {
  id: string;
  image: AssetRefV1;
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

export interface AssetSetV1 {
  tilesets: Record<string, TilesetDefV1>;
  sprites: Record<string, SpriteDefV1>;
}

export interface GameEventV1 {
  id: string;
  x: number;
  y: number;
  sprite?: AssetRefV1;
  trigger: Trigger;
  condition?: ConditionV1;
  commands: CommandV1[];
}

export interface GameMapV1 {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tileset: AssetRefV1;
  tileSize: number;
  tiles: number[];
  collisions: boolean[];
  events: GameEventV1[];
}

export interface ProjectV1 {
  version: number;
  meta: { title: string; author: string };
  assets: AssetSetV1;
  maps: Record<MapId, GameMapV1>;
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<FlagName, boolean>;
}

/** 변경 요약(모델이 다음 턴에 결과를 읽는다). */
export interface ChangeSummary {
  tilesChanged: number;
  /** 이름·크기·타일셋·BGM 등 타일/이벤트 외 맵 속성이 바뀐 기존 맵 수. */
  mapPropertiesChanged?: number;
  /** 설명 override 상태가 바뀐 오디오 kind/raw ID 키 수. 구 저장본의 부재는 0. */
  audioDescriptionsChanged?: number;
  monsterMetadataChanged?: number;
  eventsAdded: number;
  eventsModified: number;
  eventsRemoved: number;
  mapsAdded: number;
  mapsRemoved: number;
  dbRecordsChanged: number;
  /** 타일셋 정의 변경(메타데이터/그룹/통행성 등) 개수. */
  tilesetsChanged: number;
  switchesAdded: number;
  variablesAdded: number;
  worldEntitiesAdded: number;
  worldEntitiesModified: number;
  palettePresetsAdded: number;
  palettePresetsModified: number;
  endingsChanged: number;
  sessionChanged: boolean;
  systemChanged: boolean;
  warnings: string[];
}
