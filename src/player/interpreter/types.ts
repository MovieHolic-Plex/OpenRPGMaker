import type {
  ChoiceCancelBehavior,
  Command,
  FaceGraphic,
  MapId,
  MessageWindowSettings,
  MoveCommand,
  Project,
  TransferFade,
  TransferTransition,
  TransferDirection,
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
  | { kind: "transfer"; mapId: MapId; x: number; y: number; direction?: TransferDirection; fade?: TransferFade; transition?: TransferTransition }
  | { kind: "wait"; ms: number }
  | { kind: "inputWait"; variableId?: string }
  | { kind: "inputNumber"; variableId: string; digits: number; settings: MessageWindowSettings }
  | { kind: "enterHeroName"; actorId: string; maxLength: number; showInitialName: boolean; currentName: string }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number; timerId?: "timer1" | "timer2" }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "moveEvent"; eventId: string; moves: MoveCommand[]; repeat: boolean; wait?: boolean }
  | { kind: "battleProcessing"; troopId: string; canEscape: boolean; canLose: boolean }
  | { kind: "showPicture"; pictureId: string; resourceId: string; x: number; y: number }
  | { kind: "erasePicture"; pictureId: string }
  | { kind: "playAudio"; resourceId: string; loop: boolean }
  | { kind: "stopAudio" }
  | { kind: "flashScreen"; red: number; green: number; blue: number; durationMs: number }
  | { kind: "shakeScreen"; intensity: number; durationMs: number }
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

export type ResumeValue = number | boolean | string | undefined | void;
export type PendingStep = Exclude<StepResult["kind"], "done">;
export type ResumeAdvance = "continue" | "done";

export interface Frame {
  commands: Command[];
  pc: number;
  // 루프 본문 프레임인 경우, 이 프레임이 끝나면 부모 루프 명령으로 돌아가
  // body를 다시 실행한다. breakLoop 는 이 프레임을 제거하고 루프를 탈출한다.
  // undefined 이면 일반 프레임(끝나면 부모 pc += 1).
  loopOwner?: { commands: Command[]; pc: number };
}

export interface InterpreterState {
  stack: Frame[];
  session: PlaySessionLike;
  maxStackDepth: number;
  project?: Project;
  currentFace?: FaceGraphic;
  // 현재 실행 중인 이벤트 id. 셀프 스위치 조작/평가 기준.
  currentEventId?: string;
  // 루프 무한 반복 가드. 루프 본문이 한 번 완료될 때마다 증가.
  loopIterations?: number;
  maxLoopIterations: number;
}

export interface Interpreter {
  start(): StepResult;
  resume(value: ResumeValue): StepResult;
  // 병렬 이벤트 등에서 현재 pending(블로킹) 단계를 건너뛰고 다음 명령으로 진행한다.
  // 메인 이벤트 흐름에서는 사용하지 않는다.
  skip(): StepResult;
  isDone(): boolean;
}

export type CommandExecution =
  | { kind: "continue" }
  | { kind: "done" }
  | { kind: "pause"; pending: PendingStep; step: Exclude<StepResult, { kind: "done" }> };
