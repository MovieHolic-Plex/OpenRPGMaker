/**
 * 『첫사랑』 연출 부품 — 인물표, 대사(흉상 표정 전환), 화면 효과, 이벤트 페이지.
 * 이야기(firstLove.ts)는 여기 함수만으로 장면을 쓴다. 명령 형태는 엔진 Command 그대로다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { EmoteKind } from "@/project/emotes";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent } from "@/project/types";

export type Who = "seoha" | "jihu" | "minho" | "lead" | "client" | "clerk" | "seohaYoung" | "jihuYoung" | "commuterA" | "commuterB";
export type Expr = "base" | "happy" | "surprised" | "sad" | "embarrassed";

interface CastMember {
  readonly name: string;
  /** 공용 흉상 줄기(shared-modern-<stem>-expressions-bust-<표정>). */
  readonly stem: string;
  /** 걷기 칩: 번들 텍스처 키 · 칸 번호. */
  readonly tex: string;
  readonly resource: string;
  readonly index: number;
  /** 흉상 자리 — 주인공은 왼쪽, 나머지는 오른쪽. */
  readonly side: "left" | "right";
}

export const CAST: Readonly<Record<Who, CastMember>> = {
  seoha: { name: "서하", stem: "casual-girl-lavender", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 6, side: "left" },
  jihu: { name: "지후", stem: "casual-boy-hoodie", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 2, side: "right" },
  minho: { name: "민호", stem: "casual-boy-mustard", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 1, side: "right" },
  // 팀장은 버건디 카디건 — 정장 차림 본부장·출근길 회사원과 칩에서 바로 갈린다(VQA 7차).
  lead: { name: "오 팀장", stem: "teacher-cardigan", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 7, side: "right" },
  client: { name: "박 본부장", stem: "suit-boy-charcoal", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 1, side: "right" },
  clerk: { name: "점원", stem: "apron-brown", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 3, side: "right" },
  seohaYoung: { name: "열일곱의 서하", stem: "uni-girl-long", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 0, side: "left" },
  jihuYoung: { name: "열아홉의 지후", stem: "uni-boy-navy", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 0, side: "right" },
  // 엑스트라 — 주요 인물과 겹치지 않는 칩(승강장에서 팀장·본부장 칩을 미리 보이면 같은 사람으로 읽힌다).
  commuterA: { name: "회사원", stem: "suit-boy-navy", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 0, side: "right" },
  commuterB: { name: "회사원", stem: "casual-girl-stripe", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 7, side: "right" },
};

export function bustId(who: Who, expr: Expr): string {
  return `shared-modern-${CAST[who].stem}-expressions-bust-${expr}`;
}

const CLEAR_FACE: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false };

/** 인물 대사 — 흉상(표정)을 바꾸고 이름과 함께 말한다. */
export function say(who: Who, expr: Expr, ...lines: string[]): Command[] {
  const c = CAST[who];
  return [
    { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: c.side, flipHorizontally: false },
    ...lines.map((body): Command => ({ kind: "text", speaker: c.name, body })),
  ];
}

/** 서하의 속마음 — 얼굴 없이 괄호 대신 흐린 독백으로. */
export function think(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body }))];
}

/** 장면 자막(시간·장소) — 위. 가운데 자막은 인물을 가린다(VQA 5차). 이름·얼굴 없는 위 상자는 내용 높이만 쓴다(playSurface.css, VQA 8차).
 *  한 번에 표시하는 맥락(system 등)은 쓰지 않는다 — 앞 대사를 넘기던 Enter 가 나타나는 순간의 자막을 바로 닫아 버린다. */
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "top" }))];
}

/** 이름 없는 목소리(방송·안내). */
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body }))];
}

export function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[first-love] m2 명령 없음: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields } as Command;
}

export const wait = (ms: number): Command => ({ kind: "wait", ms });
export const fadeOut = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: ms }), wait(ms)];
export const fadeIn = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeIn", value: "", durationMs: ms }), wait(ms)];
export const letterbox = (on: boolean, ms = 500): Command[] => [
  m2("Screen Effect", on ? { effect: "letterbox", value: "12", durationMs: ms } : { effect: "clearLetterbox", value: "", durationMs: ms }),
  wait(ms),
];
export const tint = (value: string, ms = 0): Command => m2("Tint Screen", { color: "neutral", value, durationMs: ms });
/** 회상 색 — 화면 색 필터(세피아·채도 낮춤). 색 덮개가 아니라 아래 그림의 색을 바꾼다. */
export const memoryTint = (ms = 0): Command => m2("Tint Screen", { color: "neutral", value: "", sepia: 70, saturation: 70, durationMs: ms });
export const clearTint = (ms = 0): Command => m2("Tint Screen", { color: "neutral", value: "", durationMs: ms });
export const shake = (ms = 300): Command => m2("Shake Screen", { value: 1, intensity: "1", durationMs: ms, direction: "horizontal" });
export const flash = (color = "white", ms = 300): Command => m2("Flash Screen", { color, durationMs: ms, value: "flash" });
/** 회상 그림 겹침 — 10년 전 교복의 두 사람을 화면 가득 반투명으로 띄웠다 거둔다(고백 정점). 그림은 앱에 든 연애 타이틀 그림. */
const MEMORY_PICTURE = "fl_memory";
const MEMORY_ART = { resourceId: "oprn-title-romance-school", x: -4, y: -3, scale: 29 } as const;
// 기다리지 않는다 — 그림이 번지는 동안 대사가 바로 뜬다. 기다리는 동안 눌린 Enter 가 다음 대사를 삼키지 않게(첫사랑 VQA 3차).
export function memoryPictureIn(opacity = 140, ms = 1600): Command[] {
  return [
    { kind: "showPicture", pictureId: MEMORY_PICTURE, ...MEMORY_ART, opacity: 0, waitForPicture: false } as Command,
    { kind: "showPicture", pictureId: MEMORY_PICTURE, ...MEMORY_ART, opacity, durationMs: ms, easing: "easeOut", waitForPicture: false } as Command,
  ];
}
/** 거두기 시작만 한다 — 지우기는 다음 장면 전환 앞의 memoryPictureErase 가 한다. */
export function memoryPictureOut(ms = 1400): Command[] {
  return [{ kind: "showPicture", pictureId: MEMORY_PICTURE, ...MEMORY_ART, opacity: 0, durationMs: ms, easing: "easeInOut", waitForPicture: false } as Command];
}
export const memoryPictureErase = (): Command => ({ kind: "erasePicture", pictureId: MEMORY_PICTURE } as Command);
export const hidePlayer = (): Command => m2("Sprite Look", { target: "player", opacity: "0" });
export const showPlayer = (): Command => m2("Sprite Look", { target: "player", reset: true });

export function emote(target: "player" | string, kind: EmoteKind, ms = 1100): Command[] {
  return [{ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs: ms }, wait(Math.min(ms, 900))];
}

/** 이벤트(또는 주인공 "@player")를 한 칸씩 걷게 한다. */
export function walk(eventId: string, dirs: readonly Dir[], waitDone = true): Command {
  return { kind: "moveEvent", eventId, route: { moves: dirs.map((dir) => ({ kind: "move", dir })), repeat: false, wait: waitDone, skippable: true } } as Command;
}

export function face(eventId: string, dir: Dir): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: true, skippable: true } } as Command;
}

export function playSe(resourceId: string): Command {
  return { kind: "playAudio", resourceId, loop: false, channel: "se" } as Command;
}

export function bgm(resourceId: string, fadeInMs = 800): Command {
  return { kind: "playAudio", resourceId, loop: true, channel: "bgm", fadeInMs } as Command;
}

export const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as Command);

export function transfer(mapId: string, x: number, y: number, direction: Dir = "down", fade: "black" | "none" = "black"): Command {
  return { kind: "transfer", mapId, x, y, direction, fade } as Command;
}

export const setVar = (variableId: string, op: "=" | "+=" | "-=", value: number): Command => ({ kind: "setVariable", variableId, op, value });
export const setSw = (switchId: string, value: boolean): Command => ({ kind: "setSwitch", switchId, value });

export function ifCond(condition: EventPageCondition, then: Command[], otherwise: Command[] = []): Command {
  return { kind: "fork", condition, then, ...(otherwise.length ? { else: otherwise } : {}) } as Command;
}

export function choices(options: { text: string; then: Command[] }[]): Command {
  return { kind: "choices", options: options.map((o) => ({ text: o.text, branch: o.then })), cancelBehavior: "disallow" } as Command;
}

// ── 조건 ──
export const stageIs = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "==", value: n } as EventPageCondition);
export const stageAtLeast = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: ">=", value: n } as EventPageCondition);
export const stageBelow = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "<", value: n } as EventPageCondition);
export const swOn = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: true } as EventPageCondition);
export const swOff = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: false } as EventPageCondition);

// ── 이벤트 페이지 ──
type PageOpts = {
  who?: Who;
  dir?: Dir;
  trigger?: "action" | "auto" | "playerTouch" | "parallel";
  priority?: "below" | "same" | "above";
  through?: boolean;
};

export function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: PageOpts = {}): EventPage {
  const who = opts.who ? CAST[opts.who] : undefined;
  const dir = opts.dir ?? "down";
  return {
    id,
    name: id,
    conditions,
    graphic: who
      ? { sprite: { type: "bundled", id: who.tex }, direction: dir, pattern: charsetFrameIndex({ characterIndex: who.index, direction: dir, pattern: 1 }), transparent: false }
      : { direction: dir, pattern: 0, transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: opts.priority ?? (who ? "same" : "below"),
    overlapForbidden: !!who,
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
}

export function event(id: string, name: string, at: { x: number; y: number }, pages: EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages } as GameEvent;
}
