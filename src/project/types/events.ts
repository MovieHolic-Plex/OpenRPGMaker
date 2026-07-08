import type {
  ActorId,
  AssetRef,
  BattleAnimationId,
  Dir,
  EquipmentId,
  FlagName,
  ItemId,
  MapId,
  SkillId,
  TroopId,
} from "./base";

export type Trigger =
  | { kind: "action" }
  | { kind: "touch" }
  | { kind: "playerTouch" }
  | { kind: "eventTouch" }
  | { kind: "auto" }
  | { kind: "parallel" };

export type SelfSwitchKey = "A" | "B" | "C" | "D";

// 조건 분기(fork)에서 사용하는 조건. 페이지 출현 조건(EventPageCondition)의 상위 집합.
export type Condition =
  | { kind: "switch"; switchId: string; value: boolean }
  | {
      kind: "variable";
      variableId: string;
      op: "==" | ">=" | "<=" | ">" | "<" | "!=";
      value: number;
    }
  | { kind: "selfSwitch"; key: SelfSwitchKey; value: boolean }
  | { kind: "actor"; actorId: ActorId; present: boolean }
  | { kind: "item"; itemId: ItemId; present: boolean }
  | { kind: "gold"; op: ">=" | "<=" | ">" | "<" | "==" | "!="; amount: number }
  | { kind: "timer"; timerId: "timer1" | "timer2"; seconds: number };

export type EventPageCondition = Condition;

export interface ConditionV1 {
  kind: "flag";
  flag: FlagName;
  value: boolean;
}

export interface MoveRoute {
  moves: MoveCommand[];
  repeat: boolean;
  // 완료까지 인터프리터를 블로킹할지(기본 false: fire-and-forget).
  wait?: boolean;
  // 이동 불가 시 경로를 건너뛸지.
  skippable?: boolean;
}

export type MoveCommand =
  | { kind: "move"; dir: Dir }
  | { kind: "moveDiagonal"; horizontal: "left" | "right"; vertical: "up" | "down" }
  | { kind: "moveRandom" }
  | { kind: "moveTowardPlayer" }
  | { kind: "moveAwayFromPlayer" }
  | { kind: "stepForward" }
  | { kind: "jump"; dx: number; dy: number }
  | { kind: "land" }
  | { kind: "turn"; dir: Dir }
  | { kind: "turnRelative"; turn: "right90" | "left90" | "turn180" | "leftOrRight90" }
  | { kind: "turnRandom" }
  | { kind: "turnTowardPlayer" }
  | { kind: "turnAwayFromPlayer" }
  | { kind: "setDirectionFix"; enabled: boolean }
  | { kind: "setThrough"; enabled: boolean }
  | { kind: "setAnimation"; enabled: boolean }
  | { kind: "changeOpacity"; delta: number }
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | { kind: "changeSpeed"; delta: number }
  | { kind: "changeFrequency"; delta: number }
  | { kind: "changeGraphic"; spriteId: string }
  | { kind: "npcTransfer"; mapId: MapId; x: number; y: number; direction?: Dir }
  | { kind: "playSe"; resourceId: string }
  | { kind: "wait" };

export type VariableOperand = number | { kind: "var"; id: string };
export type M2CommandValue = string | number | boolean;
export type M2CommandFields = Record<string, M2CommandValue>;
export type ShopType = "normal" | "buyOnly" | "sellOnly";
export type ShopMessageType = "welcome" | "business" | "direct";
export type TransferDirection = "retain" | Dir;
export type TransferFade = "black" | "white" | "none";
// 전환 연출 종류. 기본 페이드 외에 모자이크(픽셀화)/블라인드 지원.
export type TransferTransition = "fade" | "mosaic" | "blinds";
export type ActorAmountOp = "=" | "+=" | "-=";
export type ActorEquipmentSlot = "weapon" | "shield" | "armor" | "helmet" | "accessory";
export type MessageWindowFormat = "normal" | "transparent";
export type MessageWindowPosition = "top" | "center" | "bottom";
export type ChoiceCancelBehavior = "disallow" | "choice1" | "choice2" | "choice3" | "choice4" | "choice5" | "branch";
export type MessageWindowSettings = {
  readonly format: MessageWindowFormat;
  readonly position: MessageWindowPosition;
  readonly preventObscuringPlayer: boolean;
  readonly allowEventMovementDuringWait: boolean;
};
export type FaceGraphic = {
  readonly resourceId: string;
  readonly faceIndex: number;
  readonly position: "left" | "right";
  readonly flipHorizontally: boolean;
};

export type LightSourceAnchor =
  | { readonly x: number; readonly y: number }
  | { readonly eventId: string }
  | "player";

export type LightSource = {
  readonly id: string;
  readonly at: LightSourceAnchor;
  readonly radius: number;
  readonly intensity?: number;
  readonly color?: string;
  readonly flicker?: boolean;
};

export type LightingState = {
  readonly ambient: number;
  readonly color?: string;
  readonly sources: readonly LightSource[];
};

export type WeatherKind = "none" | "rain" | "storm" | "snow" | "fog";

export type ShowAnimationTarget =
  | "player"
  | { readonly eventId: string }
  | { readonly x: number; readonly y: number };

export type Command =
  | { kind: "text"; speaker?: string; body: string }
  | ({ kind: "changeFace" } & FaceGraphic)
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: Command[] }[];
      cancelBehavior?: ChoiceCancelBehavior;
      cancelBranch?: Command[];
    }
  | { kind: "fork"; condition: Condition; then: Command[]; else?: Command[] }
  | { kind: "wait"; ms: number }
  | { kind: "inputWait"; variableId?: string }
  | { kind: "inputNumber"; variableId: string; digits: number }
  | { kind: "label"; name: string }
  | { kind: "gotoLabel"; name: string }
  | { kind: "loop"; body: Command[] }
  | { kind: "breakLoop" }
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | {
      kind: "setVariable";
      variableId: string;
      op: "=" | "+=" | "-=" | "*=" | "/=";
      value: VariableOperand;
    }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number; timerId?: "timer1" | "timer2" }
  | { kind: "transfer"; mapId: MapId; x: number; y: number; direction?: TransferDirection; fade?: TransferFade; transition?: TransferTransition }
  | { kind: "moveEvent"; eventId: string; route: MoveRoute }
  | { kind: "setEventGraphicPattern"; eventId: string; pattern: number }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "callCommonEvent"; commonEventId: string }
  | { kind: "callMapEvent"; eventId: string }
  | { kind: "battleProcessing"; troopId: TroopId; canEscape: boolean; canLose: boolean; battleFlow?: "gauge" | "strict" }
  | { kind: "learnSkill"; actorId: ActorId; skillId: SkillId }
  | { kind: "changeExp"; actorId: ActorId; op: ActorAmountOp; amount: number }
  | { kind: "changeLevel"; actorId: ActorId; op: ActorAmountOp; amount: number }
  | { kind: "promoteActor"; actorId: ActorId; toClassId?: string; successBranch?: Command[]; failureBranch?: Command[] }
  | { kind: "changeEquipment"; actorId: ActorId; slot: ActorEquipmentSlot; equipmentId: EquipmentId }
  | { kind: "changeActorHp"; actorId: ActorId; op: ActorAmountOp; amount: number }
  | { kind: "changeActorMp"; actorId: ActorId; op: ActorAmountOp; amount: number }
  | { kind: "recoverAll"; actorId?: ActorId }
  | { kind: "enterHeroName"; actorId: ActorId; maxLength: number; showInitialName: boolean }
  | { kind: "changeGold"; op: "=" | "+=" | "-="; amount: number }
  | { kind: "changeItem"; itemId: ItemId; op: "=" | "+=" | "-="; amount: number }
  | { kind: "changeParty"; actorId: ActorId; action: "add" | "remove" }
  | { kind: "addFollower"; actorId?: ActorId; graphic?: EventPageGraphic; name?: string }
  | { kind: "removeFollower"; name?: string; all?: boolean }
  | { kind: "setLighting"; ambient: number; color?: string; transitionMs?: number }
  | { kind: "addLight"; source: LightSource }
  | { kind: "removeLight"; id?: string; all?: boolean }
  | { kind: "setWeather"; weather: WeatherKind; intensity?: number; transitionMs?: number }
  | { kind: "showAnimation"; target: ShowAnimationTarget; animationId: BattleAnimationId; wait?: boolean }
  | {
      kind: "showPicture";
      pictureId: string;
      resourceId: string;
      x: number;
      y: number;
      scale?: number;
      opacity?: number;
      rotation?: number;
      durationMs?: number;
      waitForPicture?: boolean;
    }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
  | { kind: "cutsceneControl"; mode: "begin" | "end"; skippable?: boolean }
  | ({ kind: "displayTextSettings" } & MessageWindowSettings)
  | {
      kind: "shop";
      itemIds: ItemId[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
      messageType?: ShopMessageType;
      branchOnTransaction?: boolean;
      transactionBranch?: Command[];
    }
  | { kind: "inn"; price: number }
  | { kind: "checkpointSave"; label?: string }
  | { kind: "killPlayer"; message?: string }
  | { kind: "triggerEnding"; endingId?: string }
  | { kind: "gameOver" }
  | { kind: "ending"; title: string; message: string }
  | { kind: "returnToTitle" }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "setSelfSwitch"; key: SelfSwitchKey; value: boolean }
  | { kind: "m2Command"; commandId: string; fields: M2CommandFields };

export type EventPriority = "below" | "same" | "above";
export type AutonomousMovement = "fixed" | "random" | "approach" | "custom" | "living" | "chase";
export type EventAnimationType =
  | "normal"
  | "step"
  | "fixedDirection"
  | "fixedDirectionStep"
  | "fixedGraphic"
  | "fourFrame";

export interface EventPageGraphic {
  sprite?: AssetRef;
  direction?: Dir;
  pattern?: number;
  transparent?: boolean;
}

export interface NpcLivingDestination {
  mapId: MapId;
  x: number;
  y: number;
  direction?: Dir;
  switchId?: string;
}

export interface NpcLivingMovement {
  destinations: NpcLivingDestination[];
  repeat: boolean;
}

export interface EventPageMovement {
  type: AutonomousMovement;
  speed: number;
  frequency: number;
  route?: MoveRoute;
  living?: NpcLivingMovement;
  sightRange?: number;
  giveUpRange?: number;
  pathfind?: boolean;
}

export interface EventPage {
  id: string;
  name: string;
  conditions: EventPageCondition[];
  graphic: EventPageGraphic;
  trigger: Trigger;
  priority: EventPriority;
  overlapForbidden?: boolean;
  animationType?: EventAnimationType;
  movement: EventPageMovement;
  commands: Command[];
}

export interface EventDraftMeta {
  kind: "new" | "edit";
  original?: PersistedGameEvent;
}

export interface GameEvent {
  id: string;
  x: number;
  y: number;
  sprite?: AssetRef;
  trigger: Trigger;
  condition?: Condition;
  moveRoute?: MoveRoute;
  commands: Command[];
  pages?: EventPage[];
  draft?: EventDraftMeta;
}

export type PersistedGameEvent = Omit<GameEvent, "draft">;

export interface CommonEvent {
  id: string;
  name: string;
  trigger: "none" | "auto" | "parallel";
  conditionSwitchId?: string;
  commands: Command[];
}

export type CommandV1 =
  | { kind: "text"; speaker?: string; body: string }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: CommandV1[] }[];
    }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "wait"; ms: number };
