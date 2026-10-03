import type { BlendModeName } from "@/project/blendMode";
import type { ParticlePreset, ShakeDirection } from "@/project/eventCommands/cinematicStaging";
import type { EasingName } from "@/project/easing";
import type { EmoteKind } from "@/project/emotes";
import type { AudioChannel, AudioTrackState } from "@/project/session";
import type {
  AudioCommandChannel,
  ChoiceCancelBehavior,
  Command,
  FaceGraphic,
  FieldSpawnDef,
  MapId,
  MessageWindowSettings,
  MoveCommand,
  Project,
  EmoteTarget,
  ShowAnimationTarget,
  TransferFade,
  TransferTransition,
  TransferDirection,
  WeatherKind,
  ShopMessageType,
  ShopType,
} from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type { RuntimeCameraTarget } from "@/project/sessionRuntimeTypes"

/** 연출이 붙을 대상 — 주인공·이벤트·맵 칸. */
export type StagingTarget =
  | { readonly kind: "player" }
  | { readonly kind: "event"; readonly eventId: string }
  | { readonly kind: "tile"; readonly x: number; readonly y: number };

export type StepResult =
  | { kind: "done" }
  | import("./minigameCommands").TimedChoiceStep
  | import("./minigameCommands").QuickTimeStep
  | import("./minigameCommands").TeleportMenuStep
  | { kind: "text"; speaker?: string; body: string; face?: FaceGraphic; settings?: MessageWindowSettings; autoAdvance?: boolean; emotion?: string; style?: string; context?: string; container?: string; position?: "auto" | "top" | "center" | "bottom"; voiceResourceId?: string }
  | {
      kind: "choices";
      prompt?: string;
      options: { text: string }[];
      settings: MessageWindowSettings;
      cancelBehavior?: ChoiceCancelBehavior;
    }
  | {
      kind: "presentItem";
      prompt?: string;
      /** 소지한 후보. 비어 있으면 UI 는 prompt 뒤 닫힘(취소)으로 재개한다. */
      items: readonly { readonly itemId: string; readonly count: number }[];
      settings: MessageWindowSettings;
    }
  | { kind: "transfer"; mapId: MapId; x: number; y: number; direction?: TransferDirection; fade?: TransferFade; transition?: TransferTransition }
  | { kind: "wait"; ms: number; allowParallelEvents?: boolean }
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
  | { kind: "enterHeroName"; actorId: string; maxLength: number; showInitialName: boolean; currentName: string; prompt?: string }
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
  | { kind: "openChest"; chestId: string } & import("@/project/storageChest").OpenChestFields
  | { kind: "openSaveMenu" }
  | { kind: "openMenuScreen" }
  | { kind: "openLoadMenu" }
  | {
      kind: "pathfindMove";
      target: string;
      x: number;
      y: number;
      speed: number;
      wait: boolean;
      /**
       * OPRN-OUT-013 결과 계약. 없으면 예전과 같이 `session.flags.pathfindSucceeded`
       * 만 남긴다. 있으면 **명령별** 변수/스위치에도 쓰므로 병렬 이벤트가
       * 공유 플래그를 두고 경쟁하지 않는다.
       */
      resultVariableId?: string;
      resultSwitchId?: string;
      /** 실패 시 명령열을 끝낼지(stop) 그대로 진행할지(continue, 기본). */
      onFailure?: "continue" | "stop";
      /** 저작자가 명시적으로 켜야 쓰는 대체 목적지. 기본은 없음. */
      fallback?: "none" | "nearest";
    }
  | { kind: "spawnFieldEnemy"; spawn: FieldSpawnDef }
  | { kind: "despawnFieldEnemy"; spawnId: string }
  | { kind: "tacticsBattle"; troopId: string; width?: number; height?: number; canLose: boolean }
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
      /** 전투 개시 진형 강제(명령) 또는 접촉 방향(심볼 인카운트). 생략 = 시스템 설정. */
      formation?: import("@/battle/battleFormation").BattleStartFormation;
      // 이 전투를 기동한 맵 이벤트 id(트룹 배틀 이벤트 selfSwitch 의 소유 이벤트).
      // 랜덤 인카운터/필드 스폰 전투는 undefined.
      ownerEventId?: string;
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
      easing?: EasingName;
      blendMode?: Exclude<BlendModeName, "normal">;
      waitForPicture?: boolean;
    }
  | { kind: "erasePicture"; pictureId: string }
  | ({ kind: "playAudio"; channel?: AudioChannel } & AudioTrackState)
  | { kind: "stopAudio"; channel?: AudioCommandChannel }
  | { kind: "setLighting"; ambient: number; color?: string; transitionMs: number }
  | { kind: "setWeather"; weather: WeatherKind; intensity: number; transitionMs: number }
  | { kind: "showAnimation"; target: ShowAnimationTarget; animationId: string; wait: boolean }
  | { kind: "showEmote"; target: EmoteTarget; emote: EmoteKind; durationMs: number }
  | { kind: "playMovie"; resourceId: string; wait: boolean; skippable: boolean }
  | { kind: "flashScreen"; red: number; green: number; blue: number; durationMs: number }
  | { kind: "shakeScreen"; intensity: number; durationMs: number; direction?: ShakeDirection }
  /** 한 자리·한 인물에 터지는 파티클. wait 가 아니면 흐름을 막지 않는다. */
  | { kind: "particleEffect"; preset: ParticlePreset; target: StagingTarget; durationMs: number; wait: boolean }
  /** 캐릭터 모습 효과. 장면이 세션(m2Runtime.screen.spriteLooks)에 써서 매 프레임 그린다. */
  | { kind: "spriteLook"; target: Exclude<StagingTarget, { kind: "tile" }>; fields: Readonly<Record<string, unknown>> }
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
      easing?: EasingName;
    }
  | { kind: "relocateEvents"; eventIds: readonly string[] }
  /** Get On/Off Vehicle — 씬이 정면·발밑의 탈것에 타거나 내린다(안 되면 아무 일도 없다). */
  | { kind: "vehicle"; boarded: boolean }
  | { kind: "spawnEvent"; eventId: string }
  | { kind: "removeEvent"; eventId: string }
  | {
      kind: "shop";
      itemIds: string[];
      items?: readonly { readonly itemId: string; readonly price?: number }[];
      allowSell?: boolean;
      quantityMode?: "single" | "select";
      shopType?: ShopType;
      shopUiPreset?: import("@/project/types").ShopUiPreset;
      messageType?: ShopMessageType;
      /** 상인 소지금(플레이어 물품 매입 예산). 생략 시 기본 100G. */
      merchantGold?: number;
      branchOnTransaction?: boolean;
      branchOnFailedTransaction?: boolean;
      /** 추가 서비스. 예전에는 pause 페이로드에서 빠져 에디터 설정이 런타임에 도달하지 않았다. */
      shopServiceKind?: "repair" | "appraisal" | "pawn";
      /** 감정 대상 풀 — 비면 "해 드릴 일이 없습니다". */
      appraisalUnidentifiedPool?: readonly string[];
      /** 누적 지출 집계 키. 생략 시 "global". */
      loyaltyTierId?: string;
      /** 구매액 대비 마일리지 적립률(0..0.1). */
      mileageRate?: number;
      /** 가게 투자 레벨 0..5 — 상인 매입 예산 배수. */
      investmentLevel?: number;
      restockPolicy?: import("@/project/types").ShopRestockPolicy;
      economy?: import("@/project/types").ShopEconomyConfig;
      blackMarketFlag?: string;
      festivalFlag?: string;
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
  | { kind: "gameOver"; message?: string; gameOverId?: string }
  | { kind: "returnToTitle"; title?: string; message?: string; presentation?: import("@/project/cinematicSettings").EndingPresentation; clear?: { readonly endingId: string } };

export type ResumeValue = number | boolean | string | undefined | void | "failed";
export type PendingStep = Exclude<StepResult["kind"], "done"> | "waitUntil";
export type ResumeAdvance = "continue" | "done";

export interface Frame {
  commands: Command[];
  pc: number;
  // 루프 본문 프레임인 경우, 이 프레임이 끝나면 부모 루프 명령으로 돌아가
  // body를 다시 실행한다. breakLoop 는 이 프레임을 제거하고 루프를 탈출한다.
  // undefined 이면 일반 프레임(끝나면 부모 pc += 1).
  //
  // `iterations` 는 **이 루프의** 완료 반복 수다. 반복마다 프레임을 새로 push 하므로
  // loopOwner 에 실어 넘긴다. 인터프리터 전역 카운터로 두면 안쪽 루프가 진입할 때마다
  // 바깥 루프의 수를 지워서 바깥 루프의 가드가 영원히 울리지 않는다.
  loopOwner?: { commands: Command[]; pc: number; iterations: number };
}

export interface InterpreterState {
  /** Host-owned proof hooks. Absent in ordinary game execution. */
  beforeCommand?: (command: Command) => void;
  onUnverified?: (reason: string) => never;
  continueAfterTransfer?: boolean;
  stack: Frame[];
  waitUntil?: { elapsedMs: number; intervalMs: number };
  isEventIdle?: (target: string) => boolean;
  eventPositions?: import("@/project/runtimeEventState").RuntimeEventPositions;
  session: PlaySessionLike;
  maxStackDepth: number;
  project?: Project;
  currentFace?: FaceGraphic;
  // 현재 실행 중인 이벤트 id. 셀프 스위치 조작/평가 기준.
  currentEventId?: string;
  onFactionStanceChanged?: () => void;
  // 루프 무한 반복 가드의 상한. 실제 카운트는 루프 프레임마다 따로 센다(Frame.loopOwner.iterations).
  maxLoopIterations: number;
  instructionsExecuted: number;
  maxInstructions: number;
}

export interface InterpreterOptions {
  readonly beforeCommand?: (command: Command) => void;
  readonly onUnverified?: (reason: string) => never;
  /** An admitted detection command list may continue after its own transfer; legacy callers still terminate. */
  readonly continueAfterTransfer?: boolean;
  readonly getEventPositions?: () => import("@/project/runtimeEventState").RuntimeEventPositions;
  readonly isEventIdle?: (target: string) => boolean;
  readonly eventPositions?: import("@/project/runtimeEventState").RuntimeEventPositions;
  readonly maxLoopIterations?: number;
  readonly maxInstructions?: number;
  readonly currentEventId?: string;
  /** 진영 태도가 바뀐 프레임에 액션 전투의 타깃 캐시를 비우는 런타임 훅. */
  readonly onFactionStanceChanged?: () => void;
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
