import type {
  ChoiceCancelBehavior,
  Command,
  FaceGraphic,
  MapId,
  MessageWindowSettings,
  MoveCommand,
  Project,
  ShopMessageType,
  ShopType,
} from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

export type StepResult =
  | { kind: "done" }
  | { kind: "text"; speaker?: string; body: string; face?: FaceGraphic; settings?: MessageWindowSettings }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string }[];
      settings: MessageWindowSettings;
      cancelBehavior?: ChoiceCancelBehavior;
    }
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "wait"; ms: number }
  | { kind: "inputWait" }
  | { kind: "inputNumber"; variableId: string; digits: number; settings: MessageWindowSettings }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "moveEvent"; eventId: string; moves: MoveCommand[]; repeat: boolean }
  | { kind: "battleProcessing"; troopId: string; canEscape: boolean; canLose: boolean }
  | { kind: "showPicture"; pictureId: string; resourceId: string; x: number; y: number }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
  | {
      kind: "shop";
      itemIds: string[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
      messageType?: ShopMessageType;
      branchOnTransaction?: boolean;
    }
  | { kind: "inn"; price: number }
  | { kind: "gameOver" }
  | { kind: "returnToTitle"; title?: string; message?: string };

export type ResumeValue = number | boolean | undefined | void;
export type PendingStep = Exclude<StepResult["kind"], "done">;
export type ResumeAdvance = "continue" | "done";

export interface Frame {
  commands: Command[];
  pc: number;
}

export interface InterpreterState {
  stack: Frame[];
  session: PlaySessionLike;
  maxStackDepth: number;
  project?: Project;
  currentFace?: FaceGraphic;
}

export interface Interpreter {
  start(): StepResult;
  resume(value: ResumeValue): StepResult;
  isDone(): boolean;
}

export type CommandExecution =
  | { kind: "continue" }
  | { kind: "done" }
  | { kind: "pause"; pending: PendingStep; step: Exclude<StepResult, { kind: "done" }> };
