import type {
  AssetSet,
  ActorId,
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

export interface GameMap {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tilesetId: TilesetId;
  tileSize: number;
  lowerTiles: number[];
  upperTiles: number[];
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
  /** 세이브 금지 맵 (RM2003 "Save" 체크 해제). */
  disableSave?: boolean;
  /** 텔레포트(이동) 금지 맵. */
  disableTeleport?: boolean;
  /** 도주(이스케이프) 금지 맵. */
  disableEscape?: boolean;
  /**
   * 생성·시공 시 bbox 설계도. 타일 시공 후에도 남겨 두어
   * "가운데 파란 집 옮겨줘" 같은 영역 쿼리에 쓴다. 선택 필드 — 옛 맵 호환.
   */
  layoutPlan?: MapLayoutPlan;
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
   * 맵에 찍힌 구조물 킷 배치 기록. "여기에 이 집이 있다"를 남겨 다시 고르고·고치고·지울 수 있게 한다.
   * 기록 범위는 구조물 킷 스탬프만 — 사람이 팔레트로 찍은 것.
   * 마을 자동 생성(빌더)의 집 시공은 layoutPlan.regions 가 담당하며 여기에 들어오지 않는다.
   * 배열 순서가 곧 시간 순서다 — 겹칠 때는 뒤(나중)가 이긴다. optional 이라 마이그레이션 불필요.
   */
  structurePlacements?: StructurePlacement[];
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

/** 맵 배경(패럴랙스) 설정 — RM2003 Background 탭 대응. */
export interface MapBackground {
  /** 배경 이미지 리소스 ID 또는 URL. */
  imageId: string;
  /** 수평 스크롤 속도 (px/frame, 0=고정). */
  scrollX?: number;
  /** 수직 스크롤 속도 (px/frame, 0=고정). */
  scrollY?: number;
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
  region?: Rect;
  timePhase?: TimePhase;
  season?: Season;
}

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

export type EndingCondition = Extract<Condition, { kind: "switch" | "variable" }>;

// 선언형 엔딩 레지스트리. switch/variable conditions가 모두 참인 엔딩 중 priority가
// 가장 높은 항목을 triggerEnding이 선택한다. epilogue는 script_cutscene과 같은 beat 배열이다.
export interface EndingDef {
  id: string;
  name: string;
  conditions: EndingCondition[];
  priority: number;
  epilogue?: Record<string, unknown>[];
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
  version: number;
  meta: { title: string; author: string; terms: Terms };
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
