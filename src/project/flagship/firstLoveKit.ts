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

/**
 * 인물 대사 — 흉상(표정)을 바꾸고 이름과 함께 말한다. 흉상 좌우는 맵 위 자리로 정한다(bustSide "stage": 듣는 사람보다 왼쪽에 선
 * 화자는 왼쪽 흉상). 듣는 흉상은 듣는 인물이 화면에 있으면 늘 반대편에 — 기본 청자(주인공)면 서하 흉상(VQA r22: 좌우가 서 있는
 * 자리와 반대, 듣는 흉상이 장면마다 들쭉날쭉). NPC 끼리(sayTo)의 듣는 흉상은 fillListenerBusts 가 그 이벤트의 인물로 채운다.
 */
export function say(who: Who, expr: Expr, ...lines: string[]): Command[] {
  const c = CAST[who];
  const hero = who === "seoha" || who === "seohaYoung";
  return [
    { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: c.side, flipHorizontally: false },
    ...lines.map((body): Command => ({ kind: "text", speaker: c.name, body, position: "bottom", bustSide: "stage", ...(hero ? {} : { listenerBust: bustId("seoha", "base") }) } as Command)),
  ];
}

/** 페이지 그림의 인물 — fillListenerBusts 가 이벤트 id → 인물을 찾는다(페이지 객체에 필드를 더하지 않는다). */
const PAGE_WHO = new WeakMap<object, Who>();

/** sayTo 로 NPC 끼리 말하는 줄의 듣는 흉상을 듣는 이벤트의 인물 흉상으로 채운다(데모를 다 지은 뒤 한 번). */
export function fillListenerBusts(maps: Iterable<{ events?: GameEvent[] }>): void {
  const visit = (cmds: unknown, whoOf: Map<string, Who>): void => {
    if (!Array.isArray(cmds)) return;
    for (const c of cmds as Record<string, unknown>[]) {
      if (!c || typeof c !== "object") continue;
      if (c.kind === "text" && c.bustSide === "stage" && typeof c.addressee === "string" && c.addressee !== "@player") {
        const w = whoOf.get(c.addressee);
        if (w) c.listenerBust = bustId(w, "base"); else delete c.listenerBust;
      }
      for (const v of Object.values(c)) {
        if (Array.isArray(v)) visit(v, whoOf);
        else if (v && typeof v === "object") for (const vv of Object.values(v as Record<string, unknown>)) if (Array.isArray(vv)) visit(vv, whoOf);
      }
    }
  };
  for (const m of maps) {
    const whoOf = new Map<string, Who>();
    for (const e of m.events ?? []) for (const pg of (e as { pages?: object[] }).pages ?? []) { const w = PAGE_WHO.get(pg); if (w) { whoOf.set(e.id, w); break; } }
    for (const e of m.events ?? []) for (const pg of (e as { pages?: { commands?: unknown }[] }).pages ?? []) visit(pg.commands, whoOf);
  }
}

/** 자리를 바꿔 말한다 — NPC 끼리 마주 말하는 장면에서 한쪽을 왼쪽에 앉혀 두 흉상이 서로를 보게 한다(VQA r8: 둘 다 오른쪽).
 *  한 장면 안에서는 그 인물의 모든 대사에 같은 자리를 쓴다. */
export function sayAt(who: Who, side: "left" | "right", expr: Expr, ...lines: string[]): Command[] {
  const [face, ...rest] = say(who, expr, ...lines);
  return [{ ...(face as Extract<Command, { kind: "changeFace" }>), position: side } as Command, ...rest];
}

/** 듣는 사람 흉상만 바꾼다 — 말하는 쪽이 다른 상대에게 말을 돌릴 때 반대편에 앞 상대(예: 점원)가 남아 있지 않게(VQA r9). */
export function listenTo(who: Who, expr: Expr = "base", side: "left" | "right" = CAST[who].side): Command {
  return { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: side, flipHorizontally: false };
}

/** 듣는 사람을 못박은 대사 — 기본(NPC → 주인공)이 아닌 상대에게 말할 때. to: 이벤트 id 또는 "@player". */
export function sayTo(who: Who, expr: Expr, to: string, ...lines: string[]): Command[] {
  return say(who, expr, ...lines).map((c) => (c.kind === "text" ? { ...c, addressee: to } : c));
}

/** 멀리서 부르는 한마디(점원 인사·길 건너 부르기). 대화는 approach 로 붙인 뒤에 한다. */
export function call(who: Who, expr: Expr, ...lines: string[]): Command[] {
  return say(who, expr, ...lines).map((c) => (c.kind === "text" ? { ...c, calling: true } : c));
}

/** 멀리 있는 특정 인물을 부르는 한마디(「지후 씨, 잠깐 와 볼래요?」). */
export function callTo(who: Who, expr: Expr, to: string, ...lines: string[]): Command[] {
  return sayTo(who, expr, to, ...lines).map((c) => (c.kind === "text" ? { ...c, calling: true } : c));
}

/** 화면 가득 그림(CG·회상 그림) 위의 대사 — 이름만, 흉상 없이. 흉상이 그림 속 두 사람을 덮었다(첫사랑 VQA r23). */
export function sayOver(who: Who, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker: CAST[who].name, body, position: "bottom" }))];
}

/** 서하의 속마음 — 얼굴 없이 괄호 대신 흐린 독백으로. */
export function think(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom" }))];
}

/** 장면 자막(시간·장소) — 대사와 같은 아래 자리, 모양만 다르다(테두리 없는 짙은 띠·가운데 기울임, 내레이션 맥락).
 *  창이 위아래로 뛰지 않게 모든 글은 아래다(사용자 지적 r2). 한 번에 표시하는 맥락(system 등)은 쓰지 않는다 —
 *  앞 대사를 넘기던 Enter 가 나타나는 순간의 자막을 바로 닫아 버린다. narration 은 타자기로 나온다. */
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" }))];
}

/** 이름 없는 목소리(방송·안내). */
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" }))];
}

/** 창 자리 고정 — 선택지 창도 세션 설정을 따르므로, 주인공이 화면 아래에 있어도 위로 뛰지 않게 끈다. */
export const textAtBottom = (): Command => ({ kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command);

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
/** 검게 덮인(fadeOut) 화면에서 회상 세피아만 걷는다. 「Tint Screen」은 페이드와 같은 색조 칸을 쓰므로 neutral 로 걷으면
 *  검은 덮개까지 걷혀 옮기기 전 한 장면이 원색으로 드러난다(VQA r6: 10년 전 복도에 어른 서하). 검정을 그대로 다시 칠한다. */
export const clearTintKeepBlack = (): Command => m2("Tint Screen", { color: "neutral", value: "0,0,0,1", durationMs: 0 });
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

/** 머리 위 말풍선 아이콘(! ♥ … 땀) — 이 데모는 쓰지 않는다(사용자 r2: 「말풍선을 전부 대화창으로」). 감정은 대사·표정 흉상이 맡는다.
 *  장면 글에 남은 호출은 반 박자 쉼으로만 남긴다(대사 사이 호흡). 탐침이 showEmote 0 을 검사한다. */
export function emote(_target: "player" | string, _kind: EmoteKind, ms = 1100): Command[] {
  return [wait(Math.min(ms, 400))];
}

/** 이벤트(또는 주인공 "@player")를 한 칸씩 걷게 한다. */
export function walk(eventId: string, dirs: readonly Dir[], waitDone = true): Command {
  return { kind: "moveEvent", eventId, route: { moves: dirs.map((dir) => ({ kind: "move", dir })), repeat: false, wait: waitDone, skippable: true } } as Command;
}

/**
 * 대상 곁으로 걸어가 대상을 본다(인물 연출 기본기). 실행 순간의 실제 위치로 길을 찾고 다른 인물을 피한다 — 걸음을 늘어놓지 않는다.
 * eventId·target: 이벤트 id 또는 "@player". distance: 말 거리(1 = 바로 옆), 0 이면 칸 대상 그 자리로.
 */
export function approach(eventId: string, target: string | { x: number; y: number }, distance = 1, waitDone = true): Command {
  const to = typeof target === "string" ? { target } : { x: target.x, y: target.y };
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "approach", ...to, ...(distance !== 1 ? { distance } : {}) }], repeat: false, wait: waitDone, skippable: true } } as Command;
}

/** 칸으로 걸어간다(길 찾기). 막혔으면 가장 가까운 칸. */
export function walkTo(eventId: string, cell: { x: number; y: number }, waitDone = true): Command {
  return approach(eventId, cell, 0, waitDone);
}

/**
 * 문·출구로 나간다: 문 칸까지 걸어가 문 소리와 함께 그 칸 «위에서» 사라진다(한 칸 앞에서 사라지지 않는다).
 * door 를 비우면 가장 가까운 문(이동 이벤트). 문 이벤트 페이지가 꺼져 있으면 칸 좌표로 준다.
 */
export function exitVia(eventId: string, door?: string | { x: number; y: number }, waitDone = true): Command {
  const to = door === undefined ? {} : typeof door === "string" ? { target: door } : { x: door.x, y: door.y };
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "exitVia", ...to }], repeat: false, wait: waitDone, skippable: true } } as Command;
}

/** 대상 쪽으로 돈다. */
export function faceToward(eventId: string, target: string): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turnToward", target }], repeat: false, wait: true, skippable: true } } as Command;
}

/** 두 인물이 서로 본다. */
export function faceEachOther(a: string, b: string): Command[] {
  return [
    { kind: "moveEvent", eventId: a, route: { moves: [{ kind: "turnToward", target: b }], repeat: false, wait: false, skippable: true } } as Command,
    faceToward(b, a),
  ];
}

export function face(eventId: string, dir: Dir): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: true, skippable: true } } as Command;
}

/** 그 인물이 주인공을 보게 돌린다(주인공이 어느 칸에서 말을 걸었든). */
export function faceHero(eventId: string): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turnTowardPlayer" }], repeat: false, wait: true, skippable: true } } as Command;
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
  const built = {
    id,
    name: id,
    conditions,
    graphic: who
      ? { sprite: { type: "bundled", id: who.tex }, direction: dir, pattern: charsetFrameIndex({ characterIndex: who.index, direction: dir, pattern: 1 }), transparent: false }
      : { direction: dir, pattern: 0, transparent: true },
    // 사용자 r2: 「팀장이 너무 느리게 걷는다」 — 걷는 사람은 주인공과 같은 보통 속도(4)로 걷는다.
    movement: { type: "fixed", speed: who ? 4 : 3, frequency: 3 },
    priority: opts.priority ?? (who ? "same" : "below"),
    // 「같은 층」을 명시한 빈 그림 이벤트(문)는 몸이 있다 — 막고, 부딪히면 발동한다.
    overlapForbidden: !!who || opts.priority === "same",
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
  if (opts.who) PAGE_WHO.set(built, opts.who);
  return built;
}

export function event(id: string, name: string, at: { x: number; y: number }, pages: EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages } as GameEvent;
}
