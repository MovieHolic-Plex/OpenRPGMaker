import type {
  ChoiceCancelBehavior,
  Command,
  FaceGraphic,
  FieldSpawnDef,
  MapId,
  MessageWindowSettings,
  MoveCommand,
  Project,
  ShowAnimationTarget,
  TransferFade,
  TransferTransition,
  TransferDirection,
  WeatherKind,
  ShopMessageType,
  ShopType,
} from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import type { RuntimeCameraTarget } from "@/player/types";

export type StepResult =
  | { kind: "done" }
  | { kind: "text"; speaker?: string; body: string; face?: FaceGraphic; settings?: MessageWindowSettings; autoAdvance?: boolean; emotion?: string }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string }[];
      settings: MessageWindowSettings;
      cancelBehavior?: ChoiceCancelBehavior;
    }
  | { kind: "transfer"; mapId: MapId; x: number; y: number; direction?: TransferDirection; fade?: TransferFade; transition?: TransferTransition }
  | { kind: "wait"; ms: number }
  | { kind: "eraseEvent"; eventId?: string }
  | { kind: "waitForAllMovement" }
  | { kind: "stopAllMovement" }
  | { kind: "inputWait"; variableId?: string }
  | {
      kind: "inputNumber";
      variableId: string;
      digits: number;
      prompt?: string;
      showPad?: boolean;
      settings: MessageWindowSettings;
    }
  | { kind: "enterHeroName"; actorId: string; maxLength: number; showInitialName: boolean; currentName: string }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number; timerId?: "timer1" | "timer2" }
  | { kind: "advanceTime"; minutes?: number; days?: number }
  | { kind: "setTime"; hour: number; minute?: number }
  | { kind: "sleepUntilMorning" }
  | {
      kind: "changeTile";
      mapId: MapId;
      layer: "lower" | "upper";
      x: number;
      y: number;
      tile: number;
    }
  | { kind: "moveEvent"; eventId: string; moves: MoveCommand[]; repeat: boolean; wait?: boolean }
  | { kind: "openChest"; chestId: string }
  | { kind: "openSaveMenu" }
  | { kind: "spawnFieldEnemy"; spawn: FieldSpawnDef }
  | { kind: "despawnFieldEnemy"; spawnId: string }
  | { kind: "setEventGraphicPattern"; eventId: string; pattern: number }
  | {
      kind: "battleProcessing";
      troopId: string;
      canEscape: boolean;
      canLose: boolean;
      battleFlow?: "gauge" | "strict";
      troopSource?: "fixed" | "variable";
      troopVariableId?: string;
      branchOnResult?: boolean;
    }
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
  | { kind: "setLighting"; ambient: number; color?: string; transitionMs: number }
  | { kind: "setWeather"; weather: WeatherKind; intensity: number; transitionMs: number }
  | { kind: "showAnimation"; target: ShowAnimationTarget; animationId: string; wait: boolean }
  | { kind: "flashScreen"; red: number; green: number; blue: number; durationMs: number }
  | { kind: "shakeScreen"; intensity: number; durationMs: number }
  | {
      kind: "scrollMap";
      direction: "down" | "left" | "right" | "up";
      distanceTiles: number;
      durationMs: number;
      wait: boolean;
      returnToPlayer: boolean;
      lock: boolean;
    }
  | {
      kind: "cameraControl";
      mode: "pan" | "follow" | "fixed" | "return";
      target: RuntimeCameraTarget;
      durationMs: number;
      wait: boolean;
      returnToPlayer: boolean;
      offsetX?: number;
      offsetY?: number;
      zoom?: number;
    }
  | { kind: "spawnEvent"; eventId: string }
  | { kind: "removeEvent"; eventId: string }
  | {
      kind: "shop";
      itemIds: string[];
      items?: readonly { readonly itemId: string; readonly price?: number }[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
      messageType?: ShopMessageType;
      /** 상인 소지금(플레이어 물품 매입 예산). 생략 시 기본 100G. */
      merchantGold?: number;
      branchOnTransaction?: boolean;
      branchOnFailedTransaction?: boolean;
    }
  | {
      kind: "inn";
      price: number;
      note?: string;
      question?: string;
      recoverMp?: boolean;
      advanceToMorning?: boolean;
      restDurationMs?: number;
      wakeDurationMs?: number;
      branchOnNotEnoughGold?: boolean;
    }
  | { kind: "gameOver"; message?: string }
  | { kind: "returnToTitle"; title?: string; message?: string };

export type ResumeValue = number | boolean | string | undefined | void | "failed";
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
  instructionsExecuted: number;
  maxInstructions: number;
}

export interface InterpreterOptions {
  readonly maxLoopIterations?: number;
  readonly maxInstructions?: number;
  readonly currentEventId?: string;
}

export interface Interpreter {
  start(): StepResult;
  resume(value: ResumeValue): StepResult;
  // 병렬 이벤트 등에서 현재 pending(블로킹) 단계를 건너뛰고 다음 명령으로 진행한다.
  // 메인 이벤트 흐름에서는 사용하지 않는다.
  skip(): StepResult;
  // 컷신 스킵처럼 외부 입력이 현재 큐를 특정 라벨로 보낼 때 사용한다.
  jumpToLabel(name: string): StepResult;
  isDone(): boolean;
}

export type CommandExecution =
  | { kind: "continue" }
  | { kind: "done" }
  | { kind: "pause"; pending: PendingStep; step: Exclude<StepResult, { kind: "done" }> };
