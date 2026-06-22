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
  | { kind: "turn"; dir: Dir }
  | { kind: "wait" };

export type VariableOperand = number | { kind: "var"; id: string };

export type Command =
  | { kind: "text"; speaker?: string; body: string }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string; branch: Command[] }[];
    }
  | { kind: "fork"; condition: Condition; then: Command[]; else?: Command[] }
  | { kind: "wait"; ms: number }
  | { kind: "inputWait" }
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
  | { kind: "showPicture"; pictureId: string; resourceId: string; x: number; y: number }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
  | { kind: "shop"; itemIds: ItemId[] }
  | { kind: "inn"; price: number }
  | { kind: "gameOver" }
  | { kind: "ending"; title: string; message: string }
  | { kind: "returnToTitle" }
  | { kind: "setFlag"; flag: FlagName; value: boolean };

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
}

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
