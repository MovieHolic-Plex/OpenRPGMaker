import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command, FaceGraphic, M2CommandFields, M2CommandValue, MoveCommand, MoveRoute } from "@/project/types";
import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";

export type CutsceneBeat =
  | CutsceneSayBeat
  | CutsceneMoveActorBeat
  | CutsceneCameraBeat
  | CutscenePictureBeat
  | CutsceneMusicBeat
  | CutsceneFadeBeat
  | CutsceneTintBeat
  | CutsceneFlashBeat
  | CutsceneShakeBeat
  | CutsceneWaitBeat
  | CutsceneParallelBeat
  | CutsceneLabelBeat
  | CutsceneJumpBeat
  | CutsceneSwitchBeat
  | CutsceneTransferBeat
  | CutsceneEndingBeat;

export type CutsceneSayBeat = {
  readonly kind: "say";
  readonly speaker?: string;
  readonly face?: Partial<FaceGraphic>;
  readonly text?: string;
  readonly lines?: readonly string[];
  readonly emotion?: string;
  readonly autoAdvance?: boolean;
};

export type CutsceneMoveActorBeat = {
  readonly kind: "moveActor";
  readonly target?: string;
  readonly eventId?: string;
  readonly actor?: string;
  readonly route?: Partial<MoveRoute>;
  readonly moves?: readonly MoveCommand[];
  readonly wait?: boolean;
};

export type CutsceneCameraBeat = {
  readonly kind: "camera";
  readonly mode: "pan" | "follow" | "fixed" | "return";
  readonly target?: string | { readonly eventId?: string; readonly x?: number; readonly y?: number };
  readonly eventId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly zoom?: number;
};

export type CutscenePictureBeat = {
  readonly kind: "picture";
  readonly action: "show" | "move" | "erase";
  readonly pictureId?: string;
  readonly id?: string;
  readonly resourceId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly opacity?: number;
  readonly rotation?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
  readonly waitForPicture?: boolean;
};

export type CutsceneMusicBeat = {
  readonly kind: "music";
  readonly action: "bgm" | "se" | "fade" | "stop";
  readonly resourceId?: string;
  readonly loop?: boolean;
  readonly durationMs?: number;
};

export type CutsceneFadeBeat = {
  readonly kind: "fade";
  readonly direction: "in" | "out";
  readonly durationMs?: number;
  readonly wait?: boolean;
};

export type CutsceneTintBeat = {
  readonly kind: "tint";
  readonly color?: string;
  readonly value?: string;
  readonly durationMs?: number;
  readonly wait?: boolean;
};

export type CutsceneFlashBeat = {
  readonly kind: "flash";
  readonly color?: string;
  readonly durationMs?: number;
};

export type CutsceneShakeBeat = {
  readonly kind: "shake";
  readonly intensity?: number;
  readonly durationMs?: number;
};

export type CutsceneWaitBeat = {
  readonly kind: "wait";
  readonly ms: number;
};

export type CutsceneParallelBeat = {
  readonly kind: "parallel";
  readonly beats: readonly CutsceneBeat[];
};

export type CutsceneLabelBeat = {
  readonly kind: "label";
  readonly name: string;
};

export type CutsceneJumpBeat = {
  readonly kind: "jump";
  readonly name: string;
};

/**
 * 진행 스위치를 켠다. `switchId` 면 전역 스위치, `key`(A~D) 면 이 이벤트의 셀프 스위치.
 * 컷신이 «다음 장면을 여는» 한 박자라서 비트로 둔다 — 없던 때는 기억 진입·문 열림 컷신을 script_cutscene 으로
 * 쓸 수 없어 조수가 upsert_event 에 대사만 늘어놓고 이동·카메라·페이드를 전부 버렸다(2026-09-24 회상 스토리 도그푸딩).
 */
export type CutsceneSwitchBeat = {
  readonly kind: "switch";
  readonly switchId?: string;
  readonly key?: string;
  readonly value?: boolean;
};

/** 다른 맵(다음 기억)으로 옮긴다. 컷신은 옮긴 맵에서 이어서 끝난다(잠금 해제·정리 포함). */
export type CutsceneTransferBeat = {
  readonly kind: "transfer";
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly facing?: "up" | "down" | "left" | "right" | "retain";
  readonly fade?: "black" | "white" | "none";
};

/** 엔딩을 부른다. endingId 생략 시 조건이 맞는 최우선 엔딩. */
export type CutsceneEndingBeat = {
  readonly kind: "ending";
  readonly endingId?: string;
};

export type CutsceneValidationContext = {
  readonly eventIds?: ReadonlySet<string>;
  readonly resourceIds?: ReadonlySet<string>;
  readonly mapIds?: ReadonlySet<string>;
  readonly switchIds?: ReadonlySet<string>;
  readonly endingIds?: ReadonlySet<string>;
};

export type CutsceneCompileOptions = {
  readonly skippable?: boolean;
  /**
   * 컷신 앞에서 이미 떠 있던 얼굴(부른 이벤트의 changeFace·페이지 외형)을 지우고 시작한다.
   * 엔딩 에필로그처럼 «다른 장면»으로 이어지는 컷신에 쓴다 — 안 지우면 에필로그 전 줄이
   * 엔딩을 부른 NPC 얼굴로 나왔다(2026-09-23 도그푸딩: 내레이션·루미아·카일 모두 할아버지 얼굴).
   */
  readonly resetFace?: boolean;
  readonly context?: CutsceneValidationContext;
};

export class CutsceneValidationError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(reasons.join("\n"));
    this.name = "CutsceneValidationError";
    this.reasons = reasons;
  }
}

type FinalPictureState = {
  readonly pictureId: string;
  readonly erased?: boolean;
  readonly resourceId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly opacity?: number;
  readonly rotation?: number;
};

type FinalCameraState = {
  readonly fields: M2CommandFields;
};

type FinalTintState = {
  readonly color?: string;
  readonly value?: string;
};

type ShownFace = { readonly key: string; readonly speaker?: string };

type CompileState = {
  readonly pictures: Map<string, FinalPictureState>;
  /** 화자별로 이 컷신에서 지정된 얼굴. */
  readonly faces: Map<string, Partial<FaceGraphic>>;
  /** 이 컷신이 마지막으로 띄운 얼굴. undefined 면 컷신 밖에서 물려받은 상태(모름). */
  shownFace?: ShownFace;
  camera?: FinalCameraState;
  tint?: FinalTintState;
};

/**
 * 엔딩 에필로그 안의 `ending` beat 를 뺀다. 에필로그는 이미 엔딩 안이다 — 같은 엔딩을 다시 부르면
 * 에필로그가 처음부터 다시 돌아 검은 화면에서 끝없이 반복됐다(추리 도그푸딩 gen: 에필로그 끝에 {kind:"ending"}).
 * 빠진 개수를 함께 돌려준다.
 */
export function withoutEndingBeats(beats: readonly CutsceneBeat[]): { beats: CutsceneBeat[]; removed: number } {
  let removed = 0;
  const strip = (list: readonly CutsceneBeat[]): CutsceneBeat[] => list.flatMap((beat): CutsceneBeat[] => {
    if (beat.kind === "ending") { removed += 1; return []; }
    if (beat.kind === "parallel") return [{ ...beat, beats: strip(beat.beats) }];
    return [beat];
  });
  const out = strip(beats);
  return { beats: out, removed };
}

export function compileCutscene(beats: readonly CutsceneBeat[], options: CutsceneCompileOptions = {}): Command[] {
  const validation = validateCutscene(beats, options.context);
  if (!validation.ok) throw new CutsceneValidationError(validation.errors);
  const state: CompileState = { pictures: new Map(), faces: new Map(), ...(options.resetFace ? { shownFace: { key: "" } } : {}) };
  // 진행 비트(스위치·맵 이동·엔딩)는 건너뛰기(Esc)로도 빠지면 안 된다 — 건너뛴 플레이어가 다음 기억으로 못 가고
  // 문이 안 열린다. 그래서 마지막 맵 이동부터 끝까지와 엔딩은 건너뛰기 착지 라벨 **뒤**에 두고,
  // 그 앞에서 켠 스위치는 라벨 뒤에서 한 번 더 켠다(같은 값이라 정상 재생에서는 변화 없음).
  const lastTransfer = beats.map((beat) => beat.kind).lastIndexOf("transfer");
  const head = lastTransfer >= 0 ? beats.slice(0, lastTransfer) : beats;
  const tail = lastTransfer >= 0 ? beats.slice(lastTransfer) : [];
  const headBody = compileBeats(head.filter((beat) => beat.kind !== "ending"), state, { forceNonBlocking: false });
  const committedSwitches = head.filter((beat): beat is CutsceneSwitchBeat => beat.kind === "switch").map(compileSwitchBeat);
  const cleanup = cleanupCommands(state);
  // 옮긴 맵에서는 앞 맵의 카메라·색조·그림을 되돌릴 것이 없다 — 꼬리는 제 상태로 따로 모은다(얼굴 흐름만 이어받는다).
  const tailState: CompileState = { pictures: new Map(), faces: state.faces, ...(state.shownFace ? { shownFace: state.shownFace } : {}) };
  const tailBody = compileBeats(tail.filter((beat) => beat.kind !== "ending"), tailState, { forceNonBlocking: false });
  const endings = beats.filter((beat): beat is CutsceneEndingBeat => beat.kind === "ending").slice(-1).flatMap((beat) => compileBeat(beat, state, { forceNonBlocking: false }));
  return [
    { kind: "cutsceneControl", mode: "begin", skippable: options.skippable === true },
    ...(options.resetFace ? [clearFaceCommand()] : []),
    ...headBody,
    { kind: "label", name: CUTSCENE_END_LABEL },
    ...cleanup,
    ...committedSwitches,
    ...tailBody,
    // 맵을 옮긴 뒤 새로 잡힌 카메라·색조만 정리한다(옛 맵 좌표로 되돌리지 않는다).
    ...cleanupCommands(tailState),
    { kind: "cutsceneControl", mode: "end" },
    ...endings,
  ];
}

export function validateCutscene(
  beats: readonly CutsceneBeat[],
  context: CutsceneValidationContext = {}
): { readonly ok: true; readonly errors: readonly [] } | { readonly ok: false; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const livePictures = new Set<string>();
  visitBeats(beats, "beats", (beat, path) => {
    validateKnownBeat(beat, path, errors);
    if (!isRecord(beat) || typeof beat.kind !== "string" || !KNOWN_BEAT_KINDS.has(beat.kind)) return;
    validateDurations(beat, path, errors);
    validateReservedLabels(beat, path, errors);
    validateEventReferences(beat, path, context, errors);
    validateResourceReferences(beat, path, context, errors);
    validatePictureLifecycle(beat, path, livePictures, errors);
    validateFlowBeat(beat, path, context, errors);
  });
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function compileBeats(
  beats: readonly CutsceneBeat[],
  state: CompileState,
  options: { readonly forceNonBlocking: boolean }
): Command[] {
  return beats.flatMap((beat) => compileBeat(beat, state, options));
}

function compileBeat(
  beat: CutsceneBeat,
  state: CompileState,
  options: { readonly forceNonBlocking: boolean }
): Command[] {
  switch (beat.kind) {
    case "say":
      return compileSayBeat(beat, state);
    case "moveActor":
      return [compileMoveActorBeat(beat, options.forceNonBlocking)];
    case "camera":
      return [compileCameraBeat(beat, state, options.forceNonBlocking)];
    case "picture":
      return compilePictureBeat(beat, state, options.forceNonBlocking);
    case "music":
      return compileMusicBeat(beat);
    case "fade":
      return compileFadeBeat(beat, options.forceNonBlocking);
    case "tint":
      return compileTintBeat(beat, state, options.forceNonBlocking);
    case "flash":
      return [m2Command("Flash Screen", { color: beat.color ?? "white", durationMs: durationMs(beat.durationMs, 300) })];
    case "shake":
      return [m2Command("Shake Screen", { intensity: beat.intensity ?? 3, durationMs: durationMs(beat.durationMs, 400) })];
    case "wait":
      return [{ kind: "wait", ms: Math.max(0, Math.round(beat.ms)) }];
    case "parallel":
      return compileParallelBeat(beat, state);
    case "label":
      return [{ kind: "label", name: beat.name }];
    case "jump":
      return [{ kind: "gotoLabel", name: beat.name }];
    case "switch":
      return [compileSwitchBeat(beat)];
    case "transfer":
      return [stripUndefinedFields({
        kind: "transfer",
        mapId: beat.mapId,
        x: Math.round(beat.x),
        y: Math.round(beat.y),
        direction: beat.facing,
        fade: beat.fade ?? "black",
      }) as Command];
    case "ending":
      return [beat.endingId ? { kind: "triggerEnding", endingId: beat.endingId } : { kind: "triggerEnding" }];
  }
}

function compileSwitchBeat(beat: CutsceneSwitchBeat): Command {
  const value = beat.value !== false;
  if (beat.switchId) return { kind: "setSwitch", switchId: beat.switchId, value };
  return { kind: "setSelfSwitch", key: (beat.key ?? "A").toUpperCase() as "A" | "B" | "C" | "D", value };
}

function faceCommand(face: Partial<FaceGraphic> & { resourceId: string }): Command {
  return {
    kind: "changeFace",
    resourceId: face.resourceId,
    position: face.position ?? "left",
    flipHorizontally: face.flipHorizontally ?? false,
  };
}

function clearFaceCommand(): Command {
  return { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false };
}

function faceKey(face: Partial<FaceGraphic>): string {
  return `${face.resourceId ?? ""}:${face.position ?? "left"}:${face.flipHorizontally === true}`;
}

/**
 * 얼굴은 화자를 따라간다. 얼굴 없는 say 가 **다른 화자**면 앞 사람 얼굴을 지우고, 같은 컷신에서
 * 그 화자에게 준 얼굴이 있으면 다시 띄운다. 컷신이 스스로 띄운 적 없는 물려받은 얼굴은 건드리지 않는다
 * (페이지 외형 얼굴로 말하는 NPC 컷신) — 그건 resetFace 가 맡는다.
 */
function compileSayBeat(beat: CutsceneSayBeat, state: CompileState): Command[] {
  const commands: Command[] = [];
  const speaker = beat.speaker?.trim() || undefined;
  if (beat.face?.resourceId) {
    commands.push(faceCommand(beat.face as Partial<FaceGraphic> & { resourceId: string }));
    if (speaker) state.faces.set(speaker, beat.face);
    state.shownFace = { key: faceKey(beat.face), ...(speaker ? { speaker } : {}) };
  } else {
    const known = speaker ? state.faces.get(speaker) : undefined;
    if (known?.resourceId) {
      if (state.shownFace?.key !== faceKey(known)) {
        commands.push(faceCommand(known as Partial<FaceGraphic> & { resourceId: string }));
        state.shownFace = { key: faceKey(known), ...(speaker ? { speaker } : {}) };
      }
    } else if (state.shownFace && state.shownFace.key !== "" && state.shownFace.speaker !== speaker) {
      commands.push(clearFaceCommand());
      state.shownFace = { key: "" };
    }
  }
  const lines = beat.lines?.length ? beat.lines : beat.text ? [beat.text] : [];
  for (const body of lines) {
    commands.push({
      kind: "text",
      speaker: beat.speaker,
      body,
      ...(beat.emotion !== undefined ? { emotion: beat.emotion } : {}),
      ...(beat.autoAdvance !== undefined ? { autoAdvance: beat.autoAdvance } : {}),
    });
  }
  return commands;
}

function compileMoveActorBeat(beat: CutsceneMoveActorBeat, forceNonBlocking: boolean): Command {
  const target = beat.target ?? beat.eventId ?? beat.actor ?? "player";
  const moves = [...(beat.route?.moves ?? beat.moves ?? [])];
  return {
    kind: "moveEvent",
    eventId: target === "player" ? PLAYER_MOVE_TARGET : target === "this-event" ? "" : target,
    route: {
      moves,
      repeat: beat.route?.repeat ?? false,
      wait: forceNonBlocking ? false : beat.wait ?? beat.route?.wait ?? true,
      skippable: beat.route?.skippable,
    },
  };
}

function compileCameraBeat(beat: CutsceneCameraBeat, state: CompileState, forceNonBlocking: boolean): Command {
  const fields = cameraFields(beat, forceNonBlocking);
  state.camera = { fields };
  return m2Command("Camera Control", fields);
}

function cameraFields(beat: CutsceneCameraBeat, forceNonBlocking: boolean): M2CommandFields {
  const target = beat.target;
  const objectTarget = isCameraObjectTarget(target) ? target : undefined;
  const eventId = beat.eventId ?? objectTarget?.eventId;
  const x = beat.x ?? objectTarget?.x;
  const y = beat.y ?? objectTarget?.y;
  const targetText = typeof target === "string" ? target : eventId ? eventId : x !== undefined || y !== undefined ? "screen" : "player";
  // 카탈로그 선택지 값으로 옮긴다(panTo·follow·lock·return) — 「fixed」는 카탈로그에서 lock 이다.
  const mode = beat.mode === "return" ? "return" : beat.mode === "pan" ? "panTo" : beat.mode === "fixed" ? "lock" : beat.mode;
  return m2Fields({
    mode,
    target: targetText,
    eventId,
    x: x ?? 0,
    y: y ?? 0,
    durationMs: durationMs(beat.durationMs, 300),
    wait: forceNonBlocking ? false : beat.wait ?? true,
    offsetX: beat.offsetX,
    offsetY: beat.offsetY,
    zoom: beat.zoom,
  });
}

function compilePictureBeat(beat: CutscenePictureBeat, state: CompileState, forceNonBlocking: boolean): Command[] {
  const pictureId = pictureIdOf(beat);
  if (beat.action === "erase") {
    state.pictures.set(pictureId, { pictureId, erased: true });
    return [{ kind: "erasePicture", pictureId }];
  }
  if (beat.action === "show") {
    const command: Command = stripUndefinedFields({
      kind: "showPicture",
      pictureId,
      resourceId: beat.resourceId ?? "",
      x: beat.x ?? 0,
      y: beat.y ?? 0,
      scale: beat.scale,
      opacity: beat.opacity,
      rotation: beat.rotation,
      durationMs: beat.durationMs,
      waitForPicture: forceNonBlocking ? false : beat.waitForPicture ?? beat.wait,
    }) as Command;
    updateFinalPicture(state, pictureId, beat);
    return [command];
  }
  const wait = forceNonBlocking ? false : beat.waitForPicture ?? beat.wait ?? false;
  const fields = m2Fields({
    pictureId,
    resourceId: beat.resourceId,
    x: beat.x,
    y: beat.y,
    scale: beat.scale,
    opacity: beat.opacity,
    rotation: beat.rotation,
    durationMs: beat.durationMs,
    wait,
    waitForPicture: wait,
  });
  updateFinalPicture(state, pictureId, beat);
  return [m2Command("Move Picture", fields)];
}

function updateFinalPicture(state: CompileState, pictureId: string, beat: CutscenePictureBeat): void {
  const previous = state.pictures.get(pictureId);
  state.pictures.set(pictureId, {
    pictureId,
    resourceId: beat.resourceId ?? previous?.resourceId,
    x: beat.x ?? previous?.x ?? 0,
    y: beat.y ?? previous?.y ?? 0,
    scale: beat.scale ?? previous?.scale,
    opacity: beat.opacity ?? previous?.opacity,
    rotation: beat.rotation ?? previous?.rotation,
  });
}

function compileMusicBeat(beat: CutsceneMusicBeat): Command[] {
  if (beat.action === "stop" || beat.action === "fade") return [{ kind: "stopAudio" }];
  return [{ kind: "playAudio", resourceId: beat.resourceId ?? "", loop: beat.action === "bgm" ? true : beat.loop ?? false }];
}

function compileFadeBeat(beat: CutsceneFadeBeat, forceNonBlocking: boolean): Command[] {
  const ms = durationMs(beat.durationMs, 300);
  return [
    m2Command("Screen Effect", {
      effect: beat.direction === "out" ? "fadeOut" : "fadeIn",
      value: "",
      durationMs: ms,
    }),
    ...(!forceNonBlocking && beat.wait === true && ms > 0 ? [{ kind: "wait", ms } satisfies Command] : []),
  ];
}

/** 화면 색조 select 가 받는 이름. hex·rgb 는 value 칸으로 간다(카탈로그 계약). */
const SCREEN_TINT_COLOR_NAMES: ReadonlySet<string> = new Set(["neutral", "white", "red", "green", "blue", "yellow", "purple", "black"]);

/**
 * `color:"#c4a070"` 처럼 색 값을 color 에 넣으면 카탈로그 검증이 「값이 카탈로그 옵션에 없습니다」로 컷신 전체를 거부했다 —
 * 회상 프리셋(memory_opening·bedside_monologue·ending_fade)이 전부 그렇게 써서 한 번도 배치되지 못했다(2026-09-24).
 */
function normalizeTint(beat: { readonly color?: string; readonly value?: string }): { readonly color: string; readonly value: string } {
  const color = beat.color?.trim();
  if (color && !SCREEN_TINT_COLOR_NAMES.has(color)) return { color: "neutral", value: beat.value ?? color };
  return { color: color || "neutral", value: beat.value ?? "" };
}

function compileTintBeat(beat: CutsceneTintBeat, state: CompileState, forceNonBlocking: boolean): Command[] {
  const tint = normalizeTint(beat);
  state.tint = tint;
  const commands: Command[] = [
    m2Command("Tint Screen", {
      color: tint.color,
      value: tint.value,
      durationMs: durationMs(beat.durationMs, 0),
    }),
  ];
  if (!forceNonBlocking && beat.wait === true && durationMs(beat.durationMs, 0) > 0) {
    commands.push({ kind: "wait", ms: durationMs(beat.durationMs, 0) });
  }
  return commands;
}

function compileParallelBeat(beat: CutsceneParallelBeat, state: CompileState): Command[] {
  const commands = compileBeats(beat.beats, state, { forceNonBlocking: true });
  const waitAllMovement = beat.beats.some(needsWaitAllMovement);
  const waitMs = Math.max(0, ...beat.beats.map(parallelWaitMs));
  return [
    ...commands,
    ...(waitAllMovement ? [m2Command("Wait for All Movement")] : []),
    ...(waitMs > 0 ? [{ kind: "wait", ms: waitMs } satisfies Command] : []),
  ];
}

function needsWaitAllMovement(beat: CutsceneBeat): boolean {
  if (beat.kind === "moveActor") return beat.wait ?? beat.route?.wait ?? true;
  if (beat.kind === "parallel") return beat.beats.some(needsWaitAllMovement);
  return false;
}

function parallelWaitMs(beat: CutsceneBeat): number {
  if (beat.kind === "picture" && (beat.wait === true || beat.waitForPicture === true)) return durationMs(beat.durationMs, 0);
  if (beat.kind === "camera" && beat.wait === true) return durationMs(beat.durationMs, 300);
  if (beat.kind === "fade" && beat.wait === true) return durationMs(beat.durationMs, 300);
  if (beat.kind === "tint" && beat.wait === true) return durationMs(beat.durationMs, 0);
  if (beat.kind === "wait") return Math.max(0, Math.round(beat.ms));
  if (beat.kind === "parallel") return Math.max(0, ...beat.beats.map(parallelWaitMs));
  return 0;
}

function cleanupCommands(state: CompileState): Command[] {
  const commands: Command[] = [];
  if (state.camera) {
    // pan 으로 끝난 카메라는 화면 좌표에 고정된 채 남는다(런타임은 stopFollow). 컷신이 끝나 조작이 돌아왔는데
    // 카메라가 따라오지 않아 주인공이 화면 밖으로 걸어 나갔다(2026-09-24 회상 스토리: 기억 진입 컷신 넷이 전부
    // 마지막에 pan 만 하고 return 을 안 했다). pan 이면 주인공에게 되돌리고, 명시적 fixed·follow 는 그대로 둔다.
    commands.push(state.camera.fields.mode === "panTo"
      ? m2Command("Camera Control", { mode: "return", target: "player", durationMs: 300, wait: true })
      : m2Command("Camera Control", { ...state.camera.fields, durationMs: 0, wait: true }));
  }
  if (state.tint) {
    commands.push(m2Command("Tint Screen", { color: state.tint.color ?? "neutral", value: state.tint.value ?? "", durationMs: 0 }));
  }
  for (const picture of state.pictures.values()) {
    if (picture.erased) {
      commands.push({ kind: "erasePicture", pictureId: picture.pictureId });
      continue;
    }
    commands.push(stripUndefinedFields({
      kind: "showPicture",
      pictureId: picture.pictureId,
      resourceId: picture.resourceId ?? "",
      x: picture.x ?? 0,
      y: picture.y ?? 0,
      scale: picture.scale,
      opacity: picture.opacity,
      rotation: picture.rotation,
      durationMs: 0,
      waitForPicture: false,
    }) as Command);
  }
  return commands;
}

function validateDurations(beat: CutsceneBeat, path: string, errors: string[]): void {
  for (const key of ["durationMs", "ms"] as const) {
    const value = (beat as Record<string, unknown>)[key];
    if (typeof value === "number" && value < 0) errors.push(`${path}.${key}: duration은 음수일 수 없습니다.`);
  }
}

function validateKnownBeat(beat: CutsceneBeat, path: string, errors: string[]): void {
  if (!isRecord(beat) || typeof beat.kind !== "string") {
    errors.push(`${path}: beat.kind 문자열이 필요합니다.`);
    return;
  }
  if (!KNOWN_BEAT_KINDS.has(beat.kind)) {
    errors.push(`${path}.kind: 알 수 없는 컷신 beat 종류 '${beat.kind}'입니다.`);
  }
}

function validateReservedLabels(beat: CutsceneBeat, path: string, errors: string[]): void {
  if ((beat.kind === "label" || beat.kind === "jump") && beat.name === CUTSCENE_END_LABEL) {
    errors.push(`${path}.name: '${CUTSCENE_END_LABEL}' 라벨은 컷신 컴파일러가 자동으로 사용합니다.`);
  }
}

function validateFlowBeat(beat: CutsceneBeat, path: string, context: CutsceneValidationContext, errors: string[]): void {
  if ((beat.kind === "transfer" || beat.kind === "ending") && /\]\.beats\[/u.test(path)) {
    errors.push(`${path}: ${beat.kind} 비트는 parallel 안에 둘 수 없습니다 — 최상위 beats 에 두세요.`);
  }
  if (beat.kind === "switch") {
    if (beat.switchId !== undefined && beat.key !== undefined) errors.push(`${path}: switchId(전역 스위치)와 key(셀프 스위치) 중 하나만 쓰세요.`);
    if (beat.switchId === undefined && beat.key !== undefined && !/^[A-Da-d]$/u.test(beat.key)) errors.push(`${path}.key: 셀프 스위치는 A~D 입니다.`);
    if (beat.switchId !== undefined && context.switchIds && !context.switchIds.has(beat.switchId)) {
      errors.push(`${path}.switchId: 존재하지 않는 스위치 '${beat.switchId}' — get_database_records(collection:"switches") 로 조회하거나 rename_switch 로 먼저 만드세요.`);
    }
  }
  if (beat.kind === "transfer") {
    if (typeof beat.mapId !== "string" || !beat.mapId) errors.push(`${path}.mapId: 옮길 맵 id 가 필요합니다.`);
    else if (context.mapIds && !context.mapIds.has(beat.mapId)) errors.push(`${path}.mapId: 존재하지 않는 맵 '${beat.mapId}'.`);
    if (typeof beat.x !== "number" || typeof beat.y !== "number") errors.push(`${path}: transfer 에는 도착 칸 x,y 가 필요합니다.`);
  }
  if (beat.kind === "ending" && beat.endingId && context.endingIds && !context.endingIds.has(beat.endingId)) {
    errors.push(`${path}.endingId: 정의되지 않은 엔딩 '${beat.endingId}' — define_ending 으로 먼저 정의하세요.`);
  }
}

function validateEventReferences(
  beat: CutsceneBeat,
  path: string,
  context: CutsceneValidationContext,
  errors: string[]
): void {
  if (!context.eventIds) return;
  const eventIds = referencedEventIds(beat);
  for (const eventId of eventIds) {
    if (eventId && eventId !== "player" && eventId !== "this-event" && !context.eventIds.has(eventId)) {
      errors.push(`${path}: 존재하지 않는 이벤트 '${eventId}'를 참조했습니다.`);
    }
  }
}

function referencedEventIds(beat: CutsceneBeat): readonly string[] {
  if (beat.kind === "moveActor") {
    const target = beat.target ?? beat.eventId ?? beat.actor;
    return target && target !== "player" && target !== "this-event" ? [target] : [];
  }
  if (beat.kind === "camera") {
    if (beat.eventId) return [beat.eventId];
    if (typeof beat.target === "string" && beat.target !== "player" && beat.target !== "this-event" && beat.target !== "screen" && beat.target !== "position") return [beat.target];
    if (isCameraObjectTarget(beat.target) && typeof beat.target.eventId === "string") return [beat.target.eventId];
  }
  return [];
}

function validateResourceReferences(
  beat: CutsceneBeat,
  path: string,
  context: CutsceneValidationContext,
  errors: string[]
): void {
  if (!context.resourceIds) return;
  const resources: string[] = [];
  if (beat.kind === "picture" && beat.resourceId) resources.push(beat.resourceId);
  if (beat.kind === "music" && beat.resourceId) resources.push(beat.resourceId);
  if (beat.kind === "say" && beat.face?.resourceId) resources.push(beat.face.resourceId);
  for (const resourceId of resources) {
    if (!context.resourceIds.has(resourceId)) errors.push(`${path}: 존재하지 않는 리소스 '${resourceId}'를 참조했습니다.`);
  }
}

function validatePictureLifecycle(
  beat: CutsceneBeat,
  path: string,
  livePictures: Set<string>,
  errors: string[]
): void {
  if (beat.kind !== "picture") return;
  const pictureId = pictureIdOf(beat);
  if (beat.action === "show") {
    if (livePictures.has(pictureId)) errors.push(`${path}: 픽처 id '${pictureId}'가 지워지기 전에 다시 표시되어 충돌합니다.`);
    livePictures.add(pictureId);
  }
  if (beat.action === "erase") livePictures.delete(pictureId);
}

function visitBeats(beats: readonly CutsceneBeat[], path: string, visit: (beat: CutsceneBeat, path: string) => void): void {
  beats.forEach((beat, index) => {
    const beatPath = `${path}[${index}]`;
    visit(beat, beatPath);
    if (isRecord(beat) && beat.kind === "parallel" && Array.isArray(beat.beats)) {
      visitBeats(beat.beats as CutsceneBeat[], `${beatPath}.beats`, visit);
    }
  });
}

function pictureIdOf(beat: CutscenePictureBeat): string {
  return beat.pictureId ?? beat.id ?? "pic1";
}

function m2Command(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`M2 command not found: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function durationMs(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function stripUndefinedFields<T extends Record<string, unknown>>(fields: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) next[key] = value;
  }
  return next as T;
}

function m2Fields(fields: Record<string, M2CommandValue | undefined>): M2CommandFields {
  const next: M2CommandFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KNOWN_BEAT_KINDS: ReadonlySet<string> = new Set([
  "say",
  "moveActor",
  "camera",
  "picture",
  "music",
  "fade",
  "tint",
  "flash",
  "shake",
  "wait",
  "parallel",
  "label",
  "jump",
  "switch",
  "transfer",
  "ending",
]);

function isCameraObjectTarget(value: unknown): value is { readonly eventId?: string; readonly x?: number; readonly y?: number } {
  if (!isRecord(value)) return false;
  return (
    (value.eventId === undefined || typeof value.eventId === "string") &&
    (value.x === undefined || typeof value.x === "number") &&
    (value.y === undefined || typeof value.y === "number")
  );
}
