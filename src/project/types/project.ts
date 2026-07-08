import type {
  AssetSet,
  ActorId,
  Dir,
  FlagName,
  MapId,
  ResourceProfile,
  SCHEMA_VERSION,
  SwitchDef,
  Terms,
  TilesetDef,
  TilesetId,
  TroopId,
  VariableDef,
} from "./base";
import type { ProjectDatabaseRecords, SystemRecords } from "./database";
import type { QuestDef } from "../quest/questDef";
import type { ProjectWorld } from "../world/types";
import type {
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
  // 실시간 추격자가 진입하지 않는 안전지대. 좌표/크기는 타일 단위다.
  safeZones?: Rect[];
  // 경작 가능한 영역 선언. 경작/물/작물 상태는 PlaySession.farmPlots에만 저장한다.
  farmableArea?: Rect[];
  // 맵 진입 시 세션 lighting에 적용되는 기본 조명. 없는 맵은 이전 조명을 유지한다.
  defaultLighting?: LightingState;
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

export interface FieldSpawnDef {
  id: string;
  troopId: TroopId;
  area: Rect;
  maxAlive?: number;
  respawnSec?: number;
  graphic?: EventPageGraphic;
  chase?: boolean;
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
}

export interface ProjectSession {
  switches: Record<string, boolean>;
  selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  variables: Record<string, number>;
  timers?: Record<string, number>;
  inventory: Record<string, number>;
  partyActorIds: ActorId[];
  gold?: number;
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

// 테스트 상태 프리셋(Phase 4-1). 스위치/변수/인벤토리/골드/시작 좌표를 부분 저장해
// 테스트 플레이/헤드리스 러너에서 특정 진행 상황을 재현한다. optional이라 마이그레이션 불필요.
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
  world?: ProjectWorld;
  // 선언적 퀘스트 정의(Phase 3). questCompiler가 스위치/변수/이벤트로 컴파일하며,
  // 플레이어 퀘스트 로그가 이 메타 + 세션 상태로 단계를 표시한다. optional이라 마이그레이션 불필요.
  quests?: QuestDef[];
  // 테스트 상태 프리셋(Phase 4-1). 에디터 디버그 패널이 저장/적용한다. optional.
  testPresets?: TestPreset[];
  // 세션 상태와 분리된 authored 엔딩 정의. 체크포인트와 달리 프로젝트 JSON에 저장된다.
  endings?: EndingDef[];
  // 스위치/변수에 대한 서사 의미 레지스트리. 기존 상태 머신을 대체하지 않는다.
  storyFlags?: StoryFlagDef[];
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
