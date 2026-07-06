// player/types.ts
// 플레이어 쪽 공용 타입. 인터프리터가 요구하는 세션 인터페이스 등.
// v2: switches/variables/timers/commonEvents 포함.

import type { ActorId, ActorInitialEquipment, Dir, MapId, Command, MessageWindowSettings, SkillId } from "@/project/types";
import type { ActorVitals } from "@/project/sessionVitals";

export type RuntimeAudioState = {
  readonly resourceId: string;
  readonly loop: boolean;
};

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
};

export type M2RecordedFallback = {
  readonly commandId: string;
  readonly label: string;
  readonly reason: string;
};

export type M2ScreenRuntimeState = {
  flash?: string;
  hidden?: boolean;
  shake?: number;
  tint?: string;
  // 색조 전환에 걸릴 시간(ms). 0/미지정이면 즉시 적용.
  tintDurationMs?: number;
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
} & Record<string, M2SoundLayerState | string | undefined>;

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

export type RuntimeNpcTravelState = {
  readonly destinationIndex: number;
};

// 인터프리터가 요구하는 세션 인터페이스.
// project/session.ts의 PlaySession이 이를 만족.
export interface PlaySessionLike {
  flags: Record<string, boolean>; // 레거시 호환
  switches: Record<string, boolean>;
  selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  variables: Record<string, number>;
  timers: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  partyActorIds: string[];
  audio?: Record<string, RuntimeAudioState>;
  pictures?: Record<string, RuntimePictureState>;
  actorSkillIds?: Record<ActorId, SkillId[]>;
  actorExperience?: Record<string, number>;
  actorLevels?: Record<string, number>;
  actorEquipment?: Record<string, ActorInitialEquipment>;
  actorNames?: Record<ActorId, string>;
  actorVitals: Record<string, ActorVitals>;
  eventLocations?: Record<string, RuntimeEventLocation>;
  erasedEventIds?: readonly string[];
  npcTravelStates?: Record<string, RuntimeNpcTravelState>;
  playTimeSeconds?: number;
  currentMapId: MapId;
  x: number;
  y: number;
  messageWindowSettings?: MessageWindowSettings;
  // 공통 이벤트(callCommonEvent용). Project.commonEvents 참조를 세션에 복사.
  commonEvents?: { id: string; commands: Command[] }[];
  m2Runtime?: M2RuntimeState;
}
