import type { SpriteLook } from "@/project/eventCommands/cinematicStaging";
// player/types.ts
// 플레이어 쪽 공용 타입. 인터프리터가 요구하는 세션 인터페이스 등.
// v2: switches/variables/timers/commonEvents 포함.

import type { BlendModeName } from "@/project/blendMode";
import type { EasingName } from "@/project/easing";
import type { ActorId, ActorInitialEquipment, ActorParameterKey, Dir, EventPageGraphic, MapId, Command, LightingState, MessageWindowSettings, MonsterInstanceId, SkillId } from "@/project/types";
import type { RelationshipState } from "./relationshipState";
import type { FactionStanceOverrides } from "@/project/factionRuntime";
import type { AudioTrackState, FarmPlots, MonsterInstance } from "@/project/session";
import type { GameTime } from "@/project/gameTime";
import type { ActorVitals } from "@/project/sessionVitals";
import type { RngState } from "@/util/rng";
import type { RoguelikeRunState } from "@/project/roguelikeRun";
import type { BattleResult } from "@/project/gameTime";

export type RuntimeAudioState = AudioTrackState;
export type { SystemAudioOverrides } from "./systemAudioOverrides";

export type RuntimePictureState = {
  readonly pictureId: string;
  readonly resourceId: string;
  readonly x: number;
  readonly y: number;
  // Move Picture 트윈용 선택 필드(PictureState 와 동일 의미).
  readonly scale?: number;
  readonly opacity?: number;
  readonly rotation?: number;
  readonly durationMs?: number;
  readonly easing?: EasingName;
  readonly blendMode?: Exclude<BlendModeName, "normal">;
};

export type M2RecordedFallback = {
  readonly commandId: string;
  readonly label: string;
  readonly reason: string;
};

export type M2ScreenRuntimeState = {
  flash?: string;
  /** performance.now() 시각. 이 시각이 지나면 syncScreenEffects 가 플래시용으로 덮어쓴 색조를 되돌린다. */
  flashUntilMs?: number;
  hidden?: boolean;
  /**
   * 화면 숨기기/표시가 방금 건 페이드(ms). 세이브하지 않는다.
   * 첫 화면 동기화가 읽고 지운다 — 불러온 숨김 화면은 페이드를 다시 틀지 않고 검게 선다.
   */
  hideFadeMs?: number;
  shake?: number;
  tint?: string;
  // 색조 전환에 걸릴 시간(ms). 0/미지정이면 즉시 적용.
  tintDurationMs?: number;
  /** Tint Screen 의 색 필터(채도·흑백·세피아, %). 미지정 = 필터 없음. 전환은 tintDurationMs 를 따른다. */
  filter?: { saturation: number; grayscale: number; sepia: number };
  /** 화면 왜곡(물결·모자이크·기울기). 미지정 = 없음. `@/project/eventCommands/screenDistortion`. */
  distortion?: { wave: number; mosaic: number; rotate: number };
  /** 왜곡 전환 시간(ms). 0/미지정 = 즉시. */
  distortionDurationMs?: number;
  /** 레터박스 띠 두께(화면 높이 %, 띠 하나). 미지정 = 없음. `@/project/eventCommands/cinematicStaging`. */
  letterbox?: number;
  /** 레터박스 전환 시간(ms). */
  letterboxDurationMs?: number;
  /**
   * 정지 화면(프리즈 프레임). 켠 순간의 필드 그림을 한 장 찍어 그림 위·대사창 아래에 세운다(뒤의 맵·인물은 계속 돈다).
   * at = 켤 때마다 1 씩 늘어 「다시 찍기」를 구분한다. 세이브에는 색감·횟수·전환 시간만 남고,
   * 불러오기 뒤에는 그때 화면을 다시 찍는다(찍은 그림은 세이브에 넣지 않는다). `screenEffectPlan` freeze/unfreeze.
   */
  freeze?: { style: import("@/player/interpreter/screenEffectPlan").FreezeStyle; at: number };
  /** 정지 화면이 들어오고(하얗게 번쩍 → 멈춤) 걷히는 시간(ms). */
  freezeDurationMs?: number;
  /** 열려 있거나 막 닫히는 타일 그림 문(키 = `doorKey`). `@/project/eventCommands/doorAnimation`. 세이브에는 남기지 않는다. */
  doors?: Record<string, import("@/project/eventCommands/doorAnimation").RuntimeDoorState>;
  /**
   * 캐릭터 모습 효과(색·뒤집기·기울기·포즈·잔상). 키 = "player" 또는 "<mapId>/<eventId>"
   * (`spriteLookKey`). 화면에 보이는 지속 상태라 세이브에 함께 남는다.
   */
  spriteLooks?: Record<string, SpriteLook>;
  weather?: string;
};

export type M2AccessRuntimeState = Partial<Record<"escape" | "menu" | "save" | "teleportation", boolean>>;

export type M2SoundLayerState = {
  readonly fadeMs: number;
  readonly resourceId: string;
  readonly volume: number;
};

export type M2AudioRuntimeState = {
  memorizedBgm?: string;
  playedMemorizedBgm?: string;
  /** Authored track volume (0..100) captured with Memorize BGM. Absent = default full volume. */
  memorizedBgmVolume?: number;
  /** Fade-in (ms) captured with Memorize BGM. Absent = no authored fade. 0 is an instant start. */
  memorizedBgmFadeInMs?: number;
} & Record<string, M2SoundLayerState | string | number | undefined>;

export type M2ActorRuntimeState = {
  battleCommands?: string;
  characterGraphic?: string;
  classId?: string;
  damage?: number;
  faceset?: string;
  name?: string;
  nickname?: string;
  parameters?: number;
  states?: readonly string[];
};

export type M2EventRuntimeState = {
  readonly mapId?: string;
  readonly prefabId?: string;
  readonly removed?: boolean;
  readonly value?: string;
  readonly x?: number;
  readonly y?: number;
};

export type M2MapRuntimeState = {
  readonly mapId?: string;
  readonly target?: string;
  readonly value?: string;
  readonly x?: number;
  readonly y?: number;
};

export type M2SessionRuntimeState = {
  endedEventProcessing?: boolean;
  eraseEventRequested?: boolean;
  shellAction?: string;
  stopAllMovementRequested?: boolean;
  waitForAllMovementRequested?: boolean;
  weightedBranch?: { readonly resultVariableId: string; readonly table: string };
};

export type M2CameraRuntimeState = {
  durationMs?: number;
  mode?: string;
  target?: string;
  x?: number;
  y?: number;
  zoom?: number;
};

export type M2ScreenEffectState = {
  readonly durationMs: number;
  readonly effect: string;
  readonly value: string;
};

export type M2PathfindingState = {
  readonly speed: number;
  readonly target: string;
  readonly wait: boolean;
  readonly x: number;
  readonly y: number;
};

export type M2WaitConditionState = {
  readonly condition: string;
  readonly target: string;
  readonly timeoutMs: number;
  readonly value: string;
};

export type M2RegionTriggerState = {
  readonly action: string;
  readonly eventId: string;
  readonly regionId: string;
  readonly switchId: string;
};

export type M2QuestObjectiveState = {
  readonly state: string;
  readonly text: string;
};

export type M2DialogueState = {
  readonly autoAdvance: boolean;
  readonly body: string;
  readonly emotion: string;
  readonly portraitId: string;
  readonly speaker: string;
};

export type M2CheckpointState = {
  readonly label: string;
  readonly restoreOnGameOver: boolean;
  readonly slotId: string;
};

export type M2UiCommandState = {
  readonly durationMs: number;
  readonly message: string;
  readonly surface: string;
};

export type M2DebugLogState = {
  readonly level: string;
  readonly message: string;
};

export type M2ExpressionState = {
  readonly evaluated: boolean;
  readonly expression: string;
  readonly resultVariableId: string;
};

export type M2RuntimeState = {
  screen: M2ScreenRuntimeState;
  access: M2AccessRuntimeState;
  audio: M2AudioRuntimeState;
  actors: Record<string, M2ActorRuntimeState>;
  events: Record<string, M2EventRuntimeState>;
  map: Record<string, M2MapRuntimeState>;
  system: Record<string, string | number | boolean>;
  session: M2SessionRuntimeState;
  camera: M2CameraRuntimeState;
  screenEffects: M2ScreenEffectState[];
  pathfinding: M2PathfindingState[];
  waits: M2WaitConditionState[];
  regions: M2RegionTriggerState[];
  quests: Record<string, Record<string, M2QuestObjectiveState>>;
  dialogue: M2DialogueState[];
  cutscene: Record<string, boolean>;
  checkpoints: M2CheckpointState[];
  ui: M2UiCommandState[];
  debug: M2DebugLogState[];
  expressions: M2ExpressionState[];
  fallbacks: M2RecordedFallback[];
};

export type RuntimeEventLocation = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
};

export type RuntimeCameraTarget =
  | { readonly kind: "player" }
  | { readonly kind: "event"; readonly eventId: string }
  | { readonly kind: "position"; readonly x: number; readonly y: number };

export type RuntimeCameraSessionState = {
  readonly mode: "follow" | "fixed";
  readonly target: RuntimeCameraTarget;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly zoom?: number;
};

export type RuntimeSpawnedEventState = {
  readonly templateMapId: MapId;
  readonly templateEventId: string;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
};

export type RuntimeRemovedEventIds = Record<MapId, readonly string[]>;

export type RuntimeNpcTravelState = {
  readonly destinationIndex: number;
};

export type RuntimeNpcScheduleState = {
  readonly routeKey?: string;
  readonly exitTarget?: RuntimeEventLocation;
};

export type RuntimeFollowerLike = {
  readonly eventId?: string;
  readonly graphic: EventPageGraphic;
  readonly name: string;
  readonly kind?: "actor" | "monster";
  readonly monsterInstanceId?: string;
};

export type RuntimeFollowerTrailPointLike = {
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
};

// 인터프리터가 요구하는 세션 인터페이스.
// project/session.ts의 PlaySession이 이를 만족.
export interface PlaySessionLike {
  mapOverrides?: Record<string, { lower: Record<number, number>; upper: Record<number, number>; lower2?: Record<number, number>; upper2?: Record<number, number> }>;
  flags: Record<string, boolean>; // 레거시 호환
  switches: Record<string, boolean>;
  selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  variables: Record<string, number>;
  timers: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  collections?: Record<string, import("@/project/collections").CollectionProgress>;
  itemUseCharges?: Record<string, number>;
  partyActorIds: string[];
  monsterInstances?: Record<MonsterInstanceId, MonsterInstance>;
  monsterParty?: MonsterInstanceId[];
  monsterBox?: MonsterInstanceId[];
  audio?: Record<string, RuntimeAudioState>;
  systemAudioOverrides?: import("./systemAudioOverrides").SystemAudioOverrides;
  pictures?: Record<string, RuntimePictureState>;
  actorSkillIds?: Record<ActorId, SkillId[]>;
  actorBattleCommands?: Record<ActorId, string[]>;
  actorExperience?: Record<string, number>;
  actorLevels?: Record<string, number>;
  actorEquipment?: Record<string, ActorInitialEquipment>;
  actorNames?: Record<ActorId, string>;
  actorNicknames?: Record<ActorId, string>;
  actorFaceResourceIds?: Record<ActorId, string>;
  actorCharacterResourceIds?: Record<ActorId, string>;
  classOverrides?: Record<ActorId, string>;
  actorParamBonuses?: Record<ActorId, Partial<Record<ActorParameterKey, number>>>;
  actorStateIds?: Record<ActorId, string[]>;
  actorVitals: Record<string, ActorVitals>;
  eventLocations?: Record<string, RuntimeEventLocation>;
  horror?: import("./horrorState").HorrorState;
  erasedEventIds?: readonly string[];
  removedEventIds?: RuntimeRemovedEventIds;
  spawnedEvents?: Record<string, RuntimeSpawnedEventState>;
  camera?: RuntimeCameraSessionState;
  lighting?: LightingState;
  npcTravelStates?: Record<string, RuntimeNpcTravelState>;
  npcActivities?: Record<string, string>;
  npcScheduleStates?: Record<string, RuntimeNpcScheduleState>;
  farmPlots?: FarmPlots;
  factionStanceOverrides?: FactionStanceOverrides;
  friendship?: Record<string, number>;
  relationships?: Record<string, RelationshipState>;
  galleryUnlocks?: string[];
  /** 지난 대사 기록(백로그) — 최근 N건 링 버퍼. meta.oprnDialogueSystem.backlog 가 켜진 게임만 쌓인다. 세이브에 실린다. project/dialogueSystem.ts */
  dialogueBacklog?: import("@/project/dialogueSystem").BacklogEntry[];
  /** 읽은 글 표시(화자+본문 해시). 「읽은 글만 스킵」 판정에 쓴다. 상한 READ_FLAG_LIMIT. */
  dialogueRead?: string[];
  dailyGifts?: Record<string, string>;
  followers?: RuntimeFollowerLike[];
  followerTrail?: RuntimeFollowerTrailPointLike[];
  vehicle?: import("@/project/vehicles").VehicleSessionState;
  playTimeSeconds?: number;
  playerFacing?: import("./types").Dir;
  stringVariables?: Record<string, string>;
  stepCount?: number;
  teleportPoints?: import("./teleportPoints").TeleportPoint[];
  highScores?: Record<string, number>;
  storyJournal?: import("./storyJournal").JournalLine[];
  /** 키 폴링(Key Poll) 이 매 프레임 쓰는 현재 입력. 세이브에 넣지 않는다. */
  heldInput?: { readonly dir: number; readonly confirm: boolean; readonly cancel: boolean; readonly dash: boolean };
  clearHistory?: { count: number; endingIds: string[] };
  gameTime?: GameTime;
  currentMapId: MapId;
  x: number;
  y: number;
  messageWindowSettings?: MessageWindowSettings;
  // 공통 이벤트(callCommonEvent용). Project.commonEvents 참조를 세션에 복사.
  commonEvents?: { id: string; commands: Command[] }[];
  m2Runtime?: M2RuntimeState;
  rng?: RngState;
  roguelikeRun?: RoguelikeRunState;
  // 직전 전투 처리 결과. battleProcessing 이 종료된 뒤 인터프리터/필드 스폰/페이지 조건에서 사용.
  battleResult?: BattleResult;
  difficultyId?: string;
  /** 메뉴 «바라보는 대상에 사용»이 발동 중인 아이템 id. 그 한 번의 페이지 판정 동안만 있다. */
  itemUsedId?: string;
}
