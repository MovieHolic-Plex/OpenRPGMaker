import type {
  ActorId,
  AssetRef,
  Dir,
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

export type Condition =
  | { kind: "switch"; switchId: string; value: boolean }
  | {
      kind: "variable";
      variableId: string;
      op: ">=" | "<=" | "==" | "!=";
      value: number;
    };

export type EventPageCondition =
  | Condition
  | { kind: "actor"; actorId: ActorId; present: boolean }
  | { kind: "item"; itemId: ItemId; present: boolean };

export interface ConditionV1 {
  kind: "flag";
  flag: FlagName;
  value: boolean;
}

export interface MoveRoute {
  moves: MoveCommand[];
  repeat: boolean;
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
  | { kind: "playSe"; resourceId: string }
  | { kind: "wait" };

export type VariableOperand = number | { kind: "var"; id: string };
export type M2CommandValue = string | number | boolean;
export type M2CommandFields = Record<string, M2CommandValue>;
export type ShopType = "normal" | "buyOnly" | "sellOnly";
export type ShopMessageType = "welcome" | "business" | "direct";
export type MessageWindowFormat = "normal" | "transparent";
export type MessageWindowPosition = "top" | "center" | "bottom";
export type ChoiceCancelBehavior = "disallow" | "choice1" | "choice2" | "choice3" | "choice4" | "branch";
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
  | { kind: "inputWait" }
  | { kind: "inputNumber"; variableId: string; digits: number }
  | { kind: "label"; name: string }
  | { kind: "gotoLabel"; name: string }
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | {
      kind: "setVariable";
      variableId: string;
      op: "=" | "+=" | "-=" | "*=" | "/=";
      value: VariableOperand;
    }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number }
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "moveEvent"; eventId: string; route: MoveRoute }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "callCommonEvent"; commonEventId: string }
  | { kind: "battleProcessing"; troopId: TroopId; canEscape: boolean; canLose: boolean }
  | { kind: "learnSkill"; actorId: ActorId; skillId: SkillId }
  | { kind: "changeGold"; op: "=" | "+=" | "-="; amount: number }
  | { kind: "changeItem"; itemId: ItemId; op: "=" | "+=" | "-="; amount: number }
  | { kind: "changeParty"; actorId: ActorId; action: "add" | "remove" }
  | { kind: "showPicture"; pictureId: string; resourceId: string; x: number; y: number }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
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
  | { kind: "gameOver" }
  | { kind: "ending"; title: string; message: string }
  | { kind: "returnToTitle" }
  | { kind: "setFlag"; flag: FlagName; value: boolean }
  | { kind: "m2Command"; commandId: string; fields: M2CommandFields };

export type EventPriority = "below" | "same" | "above";
export type AutonomousMovement = "fixed" | "random" | "approach" | "custom";
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

export interface EventPageMovement {
  type: AutonomousMovement;
  speed: number;
  frequency: number;
  route?: MoveRoute;
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
