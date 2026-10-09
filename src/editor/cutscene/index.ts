import { normalizeEasing, type EasingName } from "@/project/easing";
import { normalizeBlendMode, type BlendModeName } from "@/project/blendMode";
import {
  isParticlePreset,
  LETTERBOX_DEFAULT_PERCENT,
  normalizeLetterboxPercent,
  normalizeParticleDurationMs,
  normalizeShakeDirection,
  PARTICLE_PRESETS,
  SHAKE_DIRECTIONS,
  SPRITE_POSES,
  SPRITE_TINT_NAMES,
  spriteTintHex,
  type ParticlePreset,
  type ShakeDirection,
  type SpritePose,
} from "@/project/eventCommands/cinematicStaging";
import { clampEmoteDurationMs, EMOTE_KINDS, type EmoteKind } from "@/project/emotes";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { MAP_BACKGROUND_FLOW_PERCENT_LIMIT } from "@/project/mapBackground";
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
  | CutsceneDistortBeat
  | CutsceneBackgroundBeat
  | CutsceneFlashBeat
  | CutsceneAnimationBeat
  | CutsceneShakeBeat
  | CutsceneWaitBeat
  | CutsceneParallelBeat
  | CutsceneLabelBeat
  | CutsceneJumpBeat
  | CutsceneSwitchBeat
  | CutsceneTransferBeat
  | CutsceneEndingBeat
  | CutsceneLetterboxBeat
  | CutsceneParticlesBeat
  | CutsceneLookBeat
  | CutsceneEmoteBeat
  | CutsceneWeatherBeat;

export type CutsceneSayBeat = {
  readonly kind: "say";
  readonly speaker?: string;
  readonly face?: Partial<FaceGraphic>;
  readonly text?: string;
  readonly lines?: readonly string[];
  readonly emotion?: string;
  readonly autoAdvance?: boolean;
  /** 대사 종류(narration·thought·sign…) — src/project/dialogueStyles.ts DIALOGUE_CONTEXTS. */
  readonly context?: string;
  /** 이 대사만 다른 대화창 스타일. 보통은 비워 두고 화자 프로필·프로젝트 기본을 따른다. */
  readonly style?: string;
  /** 대사 그릇(box·balloon·bark·corner). 흘림·코너는 게임을 멈추지 않는다. */
  readonly container?: string;
  /** 대화창 위치 — auto(주인공을 가리지 않게 자동)·top·center·bottom. 인물이 화면 아래쪽에 있으면 top. */
  readonly position?: "auto" | "top" | "center" | "bottom";
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
  /** 팬 곡선(생략 = 일정하게). */
  readonly easing?: EasingName;
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
  /** 이동 곡선(생략 = 일정하게). */
  readonly easing?: EasingName;
  /** 겹치기(생략 = 보통). 빛기둥·유령은 add, 그림자는 multiply. */
  readonly blendMode?: BlendModeName;
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

/**
 * 화면 왜곡 비트 — 이벤트 명령 「화면 효과」 의 물결·모자이크·기울기(지속형)로 컴파일된다.
 * 수중·꿈·시간 왜곡·회상 진입. 컷신이 끝나도(건너뛰어도) 마지막 상태가 남는다 — 끄려면 effect "clear".
 */
export type CutsceneDistortBeat = {
  readonly kind: "distort";
  readonly effect: "wave" | "mosaic" | "rotate" | "clear";
  /** 세기 — 물결 px(0~16)·모자이크 블록 px(0~32)·기울기 도(-180~180). 생략하면 기본 세기, 0 은 그 효과만 끄기. */
  readonly amount?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
};

/**
 * 먼 배경(파노라마) 비트 — 이벤트 명령 「먼 배경 변경」(m2-069)으로 컴파일된다.
 * 회상·꿈 장면에서 구름을 서서히 멈추거나(flowPercent 0) 빠르게(200) 하고, imageId 를 주면 그림도 바꾼다.
 * 비우면 그림은 그대로 두고 흐름만 바꾼다. 컷신이 끝나면(건너뛰어도) 마지막 흐름 상태가 즉시 다시 걸린다.
 */
export type CutsceneBackgroundBeat = {
  readonly kind: "background";
  readonly imageId?: string;
  /** 0~400, 100 = 맵에 저작한 흐름 속도. 생략하면 100. */
  readonly flowPercent?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
};

/** 게임에 등록된 전투 애니메이션(화염·폭발·할퀴기…)을 맵 위 인물·이벤트 위에서 재생한다. 그림을 새로 만들지 않고 게임 소재로 공격을 보여 줄 때. */
export type CutsceneAnimationBeat = {
  readonly kind: "animation";
  readonly animationId: string;
  /** "player"(기본) 또는 이벤트 id. */
  readonly target?: string;
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
  /** 흔들 축 — horizontal(부딪힘)·vertical(지진·쿵)·both(기본). */
  readonly axis?: ShakeDirection;
};

/**
 * 레터박스 — 영화식 위아래 검은 띠(「화면 효과」 letterbox). 컷신이 끝나면(건너뛰어도) 자동으로 걷힌다.
 * 다음 장면까지 띠를 남기려면 keep:true.
 */
export type CutsceneLetterboxBeat = {
  readonly kind: "letterbox";
  /** false 면 띠를 걷는다. 기본 true. */
  readonly show?: boolean;
  /** 띠 하나의 두께(화면 높이 %, 0~25). 기본 12. */
  readonly size?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
  readonly keep?: boolean;
};

/** 파티클 — 한 인물이나 한 칸에서 터지는 반짝임·불티·연기·폭발(「파티클 효과」). 흐름을 막지 않는다(wait 면 끝까지 기다림). */
export type CutsceneParticlesBeat = {
  readonly kind: "particles";
  readonly preset: ParticlePreset;
  /** "player" · 이벤트 id · "this-event". 생략하면 x,y 칸, 그것도 없으면 이 이벤트. */
  readonly target?: string;
  readonly eventId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
};

/**
 * 캐릭터 모습 효과(「모습 효과」) — 포즈(쓰러짐·웅크림·둥실)·색·뒤집기·기울기·잔상·불투명도.
 * 준 칸만 바꾸고 나머지는 앞 모습을 잇는다. reset:true 면 원래 모습에서 시작한다. 컷신이 끝나도 남는다.
 */
export type CutsceneLookBeat = {
  readonly kind: "look";
  readonly target?: string;
  readonly eventId?: string;
  readonly reset?: boolean;
  readonly pose?: SpritePose;
  /** red·blue·green·yellow·purple·gray·black·white 또는 #rrggbb, "none" = 원래 색. */
  readonly tint?: string;
  readonly tintFill?: boolean;
  readonly flip?: boolean;
  readonly angle?: number;
  readonly afterimage?: boolean;
  /** 0~1. */
  readonly alpha?: number;
};

/** 머리 위 감정 말풍선(! ? 하트 …) — 이벤트 명령 showEmote. */
export type CutsceneEmoteBeat = {
  readonly kind: "emote";
  readonly target?: string;
  readonly eventId?: string;
  readonly emote: EmoteKind;
  readonly durationMs?: number;
  readonly wait?: boolean;
};

/** 날씨 — 이벤트 명령 setWeather. 컷신이 끝나도 남는다. */
export type CutsceneWeatherBeat = {
  readonly kind: "weather";
  readonly weather: "none" | "rain" | "storm" | "snow" | "fog";
  /** 0~1. 기본 0.5. */
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
  readonly blendMode?: BlendModeName;
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
  background?: { readonly resourceId: string; readonly flowPercent: number };
  /** 왜곡 비트의 끝 상태. clear 뒤에 다시 건 축만 axes 에 남는다. */
  distort?: { readonly clear: boolean; readonly axes: Partial<Record<"wave" | "mosaic" | "rotate", number | undefined>> };
  /** 레터박스 끝 상태. keep 이 아니면 정리 단계가 걷는다. */
  letterbox?: { readonly percent: number; readonly keep: boolean };
  /** 모습 효과 명령들 — 정리 단계가 순서대로 다시 걸어 건너뛰어도 끝 모습이 같다. */
  readonly looks: M2CommandFields[];
  /** 마지막 날씨 — 정리 단계가 전환 없이 다시 건다. */
  weather?: { readonly weather: CutsceneWeatherBeat["weather"]; readonly intensity: number };
};

/**
 * 엔딩 에필로그 안의 `ending` beat 를 뺀다. 에필로그는 이미 엔딩 안이다 — 같은 엔딩을 다시 부르면
 * 에필로그가 처음부터 다시 돌아 검은 화면에서 끝없이 반복됐다(추리 도그푸딩 gen: 에필로그 끝에 {kind:"ending"}).
 * 빠진 개수를 함께 돌려준다.
 */
// Shake Screen 의 intensity 는 select(문자열 "1"/"3"/"6"/"10") 라 숫자를 그대로 넣으면 명령 형식 검사가
// 「문자열이 아닙니다」로 script_cutscene 전체를 거절한다(추리 도그푸딩 5회차). 가까운 선택지로 맞추고,
// 런타임이 읽는 value 도 같이 채운다.
const SHAKE_INTENSITY_STEPS = [1, 3, 6, 10] as const;
function shakeFields(beat: CutsceneShakeBeat): Record<string, string | number> {
  const raw = typeof beat.intensity === "number" && Number.isFinite(beat.intensity) ? beat.intensity : 3;
  const step = SHAKE_INTENSITY_STEPS.reduce((best, value) => (Math.abs(value - raw) < Math.abs(best - raw) ? value : best), 3);
  const axis = normalizeShakeDirection(beat.axis);
  return { value: step, intensity: String(step), durationMs: durationMs(beat.durationMs, 400), ...(axis !== "both" ? { direction: axis } : {}) };
}

/** 대상 문자열 → 「어디에/누구」 필드. player · this-event · 이벤트 id. */
function stagingTargetFields(target: string | undefined, eventId: string | undefined): M2CommandFields {
  const id = (eventId ?? target ?? "").trim();
  if (id === "player") return { target: "player" };
  if (!id || id === "this-event") return { target: "this-event" };
  return { target: "event", eventId: id };
}

function compileLetterboxBeat(beat: CutsceneLetterboxBeat, state: CompileState, forceNonBlocking: boolean): Command[] {
  const show = beat.show !== false;
  const percent = show ? normalizeLetterboxPercent(beat.size, LETTERBOX_DEFAULT_PERCENT) : 0;
  const ms = durationMs(beat.durationMs, 400);
  state.letterbox = { percent, keep: beat.keep === true };
  const commands: Command[] = [
    m2Command("Screen Effect", percent > 0
      ? { effect: "letterbox", value: String(percent), durationMs: ms }
      : { effect: "clearLetterbox", value: "", durationMs: ms }),
  ];
  if (!forceNonBlocking && beat.wait === true && ms > 0) commands.push({ kind: "wait", ms });
  return commands;
}

function particleFields(beat: CutsceneParticlesBeat, forceNonBlocking: boolean): M2CommandFields {
  const onTile = beat.target === undefined && beat.eventId === undefined && beat.x !== undefined && beat.y !== undefined;
  return m2Fields({
    preset: isParticlePreset(beat.preset) ? beat.preset : "sparkle",
    ...(onTile ? { target: "tile", x: Math.round(beat.x ?? 0), y: Math.round(beat.y ?? 0) } : stagingTargetFields(beat.target, beat.eventId)),
    durationMs: normalizeParticleDurationMs(beat.durationMs),
    wait: forceNonBlocking ? false : beat.wait === true,
  });
}

function onOff(value: boolean | undefined): string | undefined {
  return value === undefined ? undefined : value ? "on" : "off";
}

function lookFields(beat: CutsceneLookBeat): M2CommandFields {
  return m2Fields({
    ...stagingTargetFields(beat.target, beat.eventId),
    reset: beat.reset === true ? true : undefined,
    pose: beat.pose,
    // 명령의 색 선택지는 이름 있는 색뿐이라 #rrggbb 는 직접 색 칸으로 보낸다.
    ...(beat.tint !== undefined && beat.tint.trim().startsWith("#") ? { tintHex: beat.tint.trim() } : { tint: beat.tint?.trim().toLowerCase() }),
    tintFill: onOff(beat.tintFill),
    flip: onOff(beat.flip),
    afterimage: onOff(beat.afterimage),
    angle: beat.angle !== undefined && Number.isFinite(beat.angle) ? String(beat.angle) : undefined,
    // 명령 폼은 불투명도를 % 로 받는다.
    opacity: beat.alpha !== undefined && Number.isFinite(beat.alpha) ? String(Math.round(Math.max(0, Math.min(1, beat.alpha)) * 100)) : undefined,
  });
}

function compileEmoteBeat(beat: CutsceneEmoteBeat, forceNonBlocking: boolean): Command[] {
  const id = (beat.eventId ?? beat.target ?? "").trim();
  const ms = clampEmoteDurationMs(beat.durationMs);
  const command: Command = {
    kind: "showEmote",
    target: !id || id === "player" ? "player" : { eventId: id === "this-event" ? "" : id },
    emote: (EMOTE_KINDS as readonly string[]).includes(beat.emote) ? beat.emote : "exclamation",
    durationMs: ms,
  };
  return !forceNonBlocking && beat.wait === true ? [command, { kind: "wait", ms }] : [command];
}

/**
 * 이벤트 명령 모양으로 쓴 대사 비트를 say 로 옮긴다 — `{kind:"text",body:"…"}`(문장 표시 명령의 모양).
 * 2026-09-24 갤러리 호러 r5: define_ending 세 번이 에필로그 전부를 이 모양으로 보내 스키마 enum 에서 통째로 튕겼고,
 * 패배 엔딩이 없어 set_life_flower 까지 연쇄로 실패했다. 문장 비트는 say 하나라 뜻이 겹치지 않는다.
 */
const SAY_KIND_ALIASES: ReadonlySet<string> = new Set(["text", "narrate", "narration", "dialogue", "message"]);
const SAY_TEXT_ALIASES = ["body", "message", "content", "line"] as const;
/**
 * kind 를 빠뜨린 비트의 kind 를 그 비트만 쓰는 칸으로 짐작한다. 2026-10-02 연출 기획 gen: 조수가
 * 대사·이동·모습 비트 10개에서 kind 를 빼고 보내(`{speaker,text}`, `{target,moves}`, `{look:"ev_orvan",pose}`)
 * script_cutscene 한 번이 통째로 거절됐다. 짐작할 칸이 없으면 그대로 두어 검증이 거절하게 한다.
 */
function inferBeatKind(entry: Record<string, unknown>): Record<string, unknown> | undefined {
  if (Array.isArray(entry.moves) || isRecord(entry.route)) return { ...entry, kind: "moveActor" };
  if (typeof entry.preset === "string") return { ...entry, kind: "particles" };
  if (typeof entry.emote === "string") return { ...entry, kind: "emote" };
  if (typeof entry.weather === "string") return { ...entry, kind: "weather" };
  const lookKeys = ["pose", "tint", "tintFill", "flip", "afterimage", "alpha", "reset", "look"];
  if (lookKeys.some((key) => entry[key] !== undefined)) {
    // `look:"<대상>"` 을 대상 칸으로 쓴 모양도 받는다.
    const { look, ...rest } = entry;
    return { ...rest, kind: "look", ...(typeof look === "string" && rest.target === undefined ? { target: look } : {}) };
  }
  if (typeof entry.text === "string" || Array.isArray(entry.lines) || typeof entry.speaker === "string") return { ...entry, kind: "say" };
  if (typeof entry.ms === "number") return { ...entry, kind: "wait" };
  return undefined;
}

export function canonicalizeSayBeatAliases(beats: unknown): { beats: unknown; moved: number; inferred: number } {
  let moved = 0;
  let inferred = 0;
  const visit = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    return list.map((raw) => {
      if (!isRecord(raw)) return raw;
      let entry = raw;
      if (entry.kind === undefined || entry.kind === "") {
        const guessed = inferBeatKind(entry);
        if (!guessed) return entry;
        inferred += 1;
        entry = guessed;
      }
      if (entry.kind === "parallel" && Array.isArray(entry.beats)) return { ...entry, beats: visit(entry.beats) };
      if (typeof entry.kind !== "string" || !SAY_KIND_ALIASES.has(entry.kind)) return entry;
      const next: Record<string, unknown> = { ...entry, kind: "say" };
      if (typeof next.text !== "string" && !Array.isArray(next.lines)) {
        const alias = SAY_TEXT_ALIASES.find((key) => typeof next[key] === "string");
        if (alias) { next.text = next[alias]; delete next[alias]; }
      }
      moved += 1;
      return next;
    });
  };
  const out = visit(beats);
  return { beats: out, moved, inferred };
}

export const BEAT_KIND_INFERRED_WARNING = (count: number): string =>
  `kind 가 빠진 비트 ${count}개의 종류를 칸으로 짐작해 채웠습니다 — 비트마다 kind 를 꼭 쓰세요(say·moveActor·look·particles·emote …).`;

export const SAY_BEAT_ALIAS_WARNING = (moved: number): string =>
  `대사 비트 ${moved}개를 say 로 옮겼습니다 — 컷신·에필로그의 대사는 {kind:"say",speaker?,text} 입니다({kind:"text",body} 는 이벤트 명령 모양).`;

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
  const state: CompileState = { pictures: new Map(), faces: new Map(), looks: [], ...(options.resetFace ? { shownFace: { key: "" } } : {}) };
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
  const tailState: CompileState = { pictures: new Map(), faces: state.faces, looks: [], ...(state.shownFace ? { shownFace: state.shownFace } : {}) };
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
    validateStagingBeat(beat, path, errors);
  });
  // 암전(fade out)으로 끝나고 화면을 되돌리지 않으면 컷신이 끝난 뒤에도 검은 화면에 조작만 돌아온다(2026-10-02 조수 시험:
  // 불 몬스터 컷신이 어두워진 채 끝나 게임이 «멈춘 것처럼» 보였다). 맵 이동·엔딩이 뒤따르거나 fade in 이 있으면 통과.
  const topKinds = beats.map((beat) => (isRecord(beat) ? beat.kind : undefined));
  const lastFade = topKinds.lastIndexOf("fade");
  if (lastFade >= 0 && (beats[lastFade] as { direction?: unknown }).direction === "out"
    && !topKinds.slice(lastFade + 1).some((kind) => kind === "transfer" || kind === "ending")) {
    errors.push(`beats[${lastFade}]: 컷신이 암전(fade out)으로 끝나 화면이 검게 남습니다 — 끝에 {kind:'fade',direction:'in'} 를 넣어 되돌리거나, 맵 이동(transfer)·엔딩으로 이어 가세요.`);
  }
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
    case "distort":
      return compileDistortBeat(beat, state, options.forceNonBlocking);
    case "background":
      return compileBackgroundBeat(beat, state, options.forceNonBlocking);
    case "animation":
      return [{ kind: "showAnimation", target: !beat.target || beat.target === "player" ? "player" : { eventId: beat.target }, animationId: beat.animationId, wait: options.forceNonBlocking ? false : beat.wait ?? true } as Command];
    case "flash":
      return [m2Command("Flash Screen", { color: beat.color ?? "white", durationMs: durationMs(beat.durationMs, 300) })];
    case "shake":
      return [m2Command("Shake Screen", shakeFields(beat))];
    case "letterbox":
      return compileLetterboxBeat(beat, state, options.forceNonBlocking);
    case "particles":
      return [m2Command("Particle Effect", particleFields(beat, options.forceNonBlocking))];
    case "look": {
      const fields = lookFields(beat);
      state.looks.push(fields);
      return [m2Command("Sprite Look", fields)];
    }
    case "emote":
      return compileEmoteBeat(beat, options.forceNonBlocking);
    case "weather": {
      const intensity = beat.intensity !== undefined && Number.isFinite(beat.intensity) ? Math.max(0, Math.min(1, beat.intensity)) : 0.5;
      state.weather = { weather: beat.weather, intensity };
      return [{ kind: "setWeather", weather: beat.weather, intensity, transitionMs: durationMs(beat.durationMs, 1000) }];
    }
    case "wait":
      return [{ kind: "wait", ms: waitBeatMs(beat) }];
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
      ...(beat.context ? { context: beat.context } : {}),
      ...(beat.style ? { style: beat.style } : {}),
      ...(beat.container ? { container: beat.container } : {}),
      ...(beat.position ? { position: beat.position } : {}),
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
    easing: normalizeEasing(beat.easing),
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
      easing: normalizeEasing(beat.easing),
      blendMode: normalizeBlendMode(beat.blendMode),
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
    easing: normalizeEasing(beat.easing),
    blendMode: beat.blendMode,
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
    // 표시(show)는 그림을 새로 거는 것이라 생략 = 보통. 이동(move)은 생략하면 앞의 겹치기를 잇는다.
    blendMode: beat.action === "show" ? normalizeBlendMode(beat.blendMode) : beat.blendMode ?? previous?.blendMode,
  });
}

/**
 * action 을 빼고 resourceId 만 준 music beat 는 효과음 채널의 비반복 재생이 됐다 — 조수가 고른 BGM(cc0-bgm-…)이
 * 한 번 울리고 끝났다(2026-10-02 도그푸딩). 리소스 id 에 bgm/music 이 있으면 BGM 으로 본다.
 */
function musicActionOf(beat: CutsceneMusicBeat): CutsceneMusicBeat["action"] {
  if (beat.action) return beat.action;
  return /(^|[-_:])(bgm|music)([-_:]|$)/iu.test(beat.resourceId ?? "") ? "bgm" : "se";
}

function compileMusicBeat(beat: CutsceneMusicBeat): Command[] {
  const action = musicActionOf(beat);
  if (action === "stop" || action === "fade") return [{ kind: "stopAudio" }];
  return [{ kind: "playAudio", resourceId: beat.resourceId ?? "", loop: action === "bgm" ? true : beat.loop ?? false }];
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

function distortFields(effect: CutsceneDistortBeat["effect"], amount: number | undefined, ms: number): M2CommandFields {
  return m2Fields({
    effect: effect === "clear" ? "clearDistortion" : effect,
    value: effect === "clear" || amount === undefined || !Number.isFinite(amount) ? "" : String(amount),
    durationMs: ms,
  });
}

function compileDistortBeat(beat: CutsceneDistortBeat, state: CompileState, forceNonBlocking: boolean): Command[] {
  const ms = durationMs(beat.durationMs, 0);
  const effect = beat.effect;
  // 정리 단계가 다시 걸 수 있게 축별 마지막 값을 적어 둔다(clear 는 전부 지운다).
  if (effect === "clear") state.distort = { clear: true, axes: {} };
  else state.distort = { clear: state.distort?.clear ?? false, axes: { ...state.distort?.axes, [effect]: beat.amount } };
  const commands: Command[] = [m2Command("Screen Effect", distortFields(effect, beat.amount, ms))];
  if (!forceNonBlocking && beat.wait === true && ms > 0) commands.push({ kind: "wait", ms });
  return commands;
}

function backgroundFlowPercent(beat: CutsceneBackgroundBeat): number {
  const value = Number(beat.flowPercent ?? 100);
  return Number.isFinite(value) ? Math.min(MAP_BACKGROUND_FLOW_PERCENT_LIMIT, Math.max(0, Math.round(value))) : 100;
}

function compileBackgroundBeat(beat: CutsceneBackgroundBeat, state: CompileState, forceNonBlocking: boolean): Command[] {
  const resourceId = (beat.imageId ?? "").trim();
  const flowPercent = backgroundFlowPercent(beat);
  const ms = durationMs(beat.durationMs, 0);
  // 그림을 비운 비트는 앞 비트가 바꾼 그림을 이어받는다(정리 단계가 그 그림을 다시 건다).
  state.background = { resourceId: resourceId || state.background?.resourceId || "", flowPercent };
  const commands: Command[] = [
    m2Command("Change Parallax Back", { resourceId, flowPercent, flowDurationMs: ms }),
  ];
  if (!forceNonBlocking && beat.wait === true && ms > 0) commands.push({ kind: "wait", ms });
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

// wait 비트는 ms 가 정본이지만 다른 비트처럼 durationMs 로 쓰는 모델이 있다. 없으면 NaN 이 되어
// 기다리기가 사라졌다(2026-09-24 꿈 세계 도그푸딩).
function waitBeatMs(beat: Extract<CutsceneBeat, { kind: "wait" }>): number {
  const alias = (beat as { readonly durationMs?: unknown }).durationMs;
  const raw = Number.isFinite(beat.ms) ? beat.ms : typeof alias === "number" && Number.isFinite(alias) ? alias : 0;
  return Math.max(0, Math.round(raw));
}

function parallelWaitMs(beat: CutsceneBeat): number {
  if (beat.kind === "picture" && (beat.wait === true || beat.waitForPicture === true)) return durationMs(beat.durationMs, 0);
  if (beat.kind === "camera" && beat.wait === true) return durationMs(beat.durationMs, 300);
  if (beat.kind === "fade" && beat.wait === true) return durationMs(beat.durationMs, 300);
  if (beat.kind === "tint" && beat.wait === true) return durationMs(beat.durationMs, 0);
  if (beat.kind === "distort" && beat.wait === true) return durationMs(beat.durationMs, 0);
  if (beat.kind === "letterbox" && beat.wait === true) return durationMs(beat.durationMs, 400);
  if (beat.kind === "particles" && beat.wait === true) return normalizeParticleDurationMs(beat.durationMs);
  if (beat.kind === "emote" && beat.wait === true) return clampEmoteDurationMs(beat.durationMs);
  if (beat.kind === "background" && beat.wait === true) return durationMs(beat.durationMs, 0);
  if (beat.kind === "wait") return waitBeatMs(beat);
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
  if (state.distort) {
    // 건너뛰어도 끝 상태가 같아야 한다 — 전환 없이 마지막 왜곡을 다시 건다.
    if (state.distort.clear) commands.push(m2Command("Screen Effect", distortFields("clear", undefined, 0)));
    for (const [axis, amount] of Object.entries(state.distort.axes)) {
      commands.push(m2Command("Screen Effect", distortFields(axis as "wave" | "mosaic" | "rotate", amount, 0)));
    }
  }
  if (state.letterbox) {
    // 컷신용 띠는 컷신과 함께 걷힌다. keep 이면 끝 두께를 전환 없이 다시 건다.
    const percent = state.letterbox.keep ? state.letterbox.percent : 0;
    commands.push(m2Command("Screen Effect", percent > 0
      ? { effect: "letterbox", value: String(percent), durationMs: state.letterbox.keep ? 0 : 400 }
      : { effect: "clearLetterbox", value: "", durationMs: 400 }));
  }
  for (const fields of state.looks) commands.push(m2Command("Sprite Look", fields));
  if (state.weather) {
    commands.push({ kind: "setWeather", weather: state.weather.weather, intensity: state.weather.intensity, transitionMs: 0 });
  }
  if (state.background) {
    // 건너뛰어도 끝 상태는 같아야 한다 — 전환 없이 마지막 흐름·그림을 다시 건다.
    commands.push(m2Command("Change Parallax Back", {
      resourceId: state.background.resourceId,
      flowPercent: state.background.flowPercent,
      flowDurationMs: 0,
    }));
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
      blendMode: normalizeBlendMode(picture.blendMode),
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
  // beats 없는 parallel 은 검증을 통과한 뒤 compileBeats 에서 TypeError 로 죽었다(2026-10-02 도그푸딩: 조수의 첫 script_cutscene 호출).
  if (beat.kind === "parallel" && (!Array.isArray(beat.beats) || beat.beats.length === 0)) {
    errors.push(`${path}.beats: parallel 비트에는 함께 실행할 beat 배열이 필요합니다(예: {kind:'parallel',beats:[{kind:'picture',action:'move',…},{kind:'shake'}]}). 함께 할 일이 없으면 parallel 을 빼세요.`);
  }
  // fade 는 색을 못 고른다(검정뿐). 모델이 tint/fade/color 로 흰색을 요청하면 조용히 검정이 됐다.
  if (beat.kind === "fade") {
    const stray = (["color", "tint", "fade"] as const).filter((key) => (beat as Record<string, unknown>)[key] !== undefined);
    if (stray.length > 0) {
      errors.push(`${path}: fade 비트는 색을 지정할 수 없습니다(${stray.join("/")} 무시됨 — 항상 검정으로 어두워집니다). 흰 화면은 flash 비트나 script_cutscene_impact 를 쓰세요.`);
    }
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
  if (beat.kind === "background" && beat.flowPercent !== undefined) {
    const value = Number(beat.flowPercent);
    if (!Number.isFinite(value) || value < 0 || value > MAP_BACKGROUND_FLOW_PERCENT_LIMIT) {
      errors.push(`${path}.flowPercent: 0~${MAP_BACKGROUND_FLOW_PERCENT_LIMIT} 사이여야 합니다(100 = 저작 속도, 0 = 멈춤).`);
    }
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
  if (beat.kind === "particles" || beat.kind === "look" || beat.kind === "emote") {
    const target = beat.eventId ?? beat.target;
    return typeof target === "string" && target && target !== "player" && target !== "this-event" ? [target] : [];
  }
  return [];
}

const WEATHER_BEAT_KINDS: ReadonlySet<string> = new Set(["none", "rain", "storm", "snow", "fog"]);

/** 연출 비트의 고정 어휘 — 틀린 이름을 컴파일러가 조용히 기본값으로 바꾸면 조수는 실패를 모른다. */
function validateStagingBeat(beat: CutsceneBeat, path: string, errors: string[]): void {
  if (beat.kind === "particles" && !isParticlePreset(beat.preset)) {
    errors.push(`${path}.preset: 파티클 종류는 ${PARTICLE_PRESETS.join("·")} 중 하나입니다(받은 값 '${String(beat.preset)}').`);
  }
  if (beat.kind === "look" && beat.pose !== undefined && !(SPRITE_POSES as readonly string[]).includes(beat.pose)) {
    errors.push(`${path}.pose: 자세는 ${SPRITE_POSES.join("·")} 중 하나입니다(받은 값 '${String(beat.pose)}').`);
  }
  if (beat.kind === "look" && beat.tint !== undefined && beat.tint !== "none" && !spriteTintHex(beat.tint)) {
    errors.push(`${path}.tint: 색은 ${Object.keys(SPRITE_TINT_NAMES).join("·")}·none 또는 #rrggbb 입니다(받은 값 '${beat.tint}').`);
  }
  if (beat.kind === "emote" && !(EMOTE_KINDS as readonly string[]).includes(beat.emote)) {
    errors.push(`${path}.emote: 감정 말풍선은 ${EMOTE_KINDS.join("·")} 중 하나입니다(받은 값 '${String(beat.emote)}').`);
  }
  if (beat.kind === "weather" && !WEATHER_BEAT_KINDS.has(beat.weather)) {
    errors.push(`${path}.weather: 날씨는 none·rain·storm·snow·fog 중 하나입니다(받은 값 '${String(beat.weather)}').`);
  }
  if (beat.kind === "shake" && beat.axis !== undefined && !(SHAKE_DIRECTIONS as readonly string[]).includes(beat.axis)) {
    errors.push(`${path}.axis: 흔들 축은 both·horizontal·vertical 중 하나입니다(받은 값 '${String(beat.axis)}').`);
  }
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
  "distort",
  "background",
  "flash",
  "animation",
  "shake",
  "wait",
  "parallel",
  "label",
  "jump",
  "switch",
  "transfer",
  "ending",
  "letterbox",
  "particles",
  "look",
  "emote",
  "weather",
]);

function isCameraObjectTarget(value: unknown): value is { readonly eventId?: string; readonly x?: number; readonly y?: number } {
  if (!isRecord(value)) return false;
  return (
    (value.eventId === undefined || typeof value.eventId === "string") &&
    (value.x === undefined || typeof value.x === "number") &&
    (value.y === undefined || typeof value.y === "number")
  );
}
