/**
 * 「사냥꾼 계약」 장면 도구 — 인물표·대사·연출 명령 짓기.
 * 이세계 고딩 키트(isekaiGoddingKit.ts)를 옮겼다. 사람 그림은 EasyRPG 걷기 칩과 그 칩에 짝지은 공용 흉상만 쓴다(새 그림 없음).
 * 흉상 짝은 scripts/content/portraits/charset-map.json 의 원본 칸 대응을 따른다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { canMove, isPassable } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";

export type Expr =
  | "base" | "smile" | "happy" | "content" | "surprised" | "embarrassed" | "doubtful" | "serious"
  | "annoyed" | "angry" | "sad" | "crying" | "worried" | "determined" | "shy" | "wink";
export type Who =
  | "doran" | "risk" | "marta" | "boatman" | "widow" | "keeper" | "villager" | "fisher"
  | "brann" | "osben" | "girl" | "servant" | "pilgrim" | "guard";

interface CastMember {
  readonly name: string;
  /** 공용 흉상 줄기 shared-<stem>. 없으면 이름표만. */
  readonly stem?: string;
  readonly tex: string;
  readonly resource: string;
  readonly index: number;
  readonly side: "left" | "right";
}

const RTP = (sheet: string) => ({ tex: `tex_easyrpg_charset_${sheet}`, resource: `easyrpg-charset-${sheet}` });
/** 칩 ↔ 흉상: Actor2·People1·People3 은 charset-map.json 의 같은 칸 흉상. 아이 칩(People1 #0·#1)은 안 쓴다. */
export const CAST: Readonly<Record<Who, CastMember>> = {
  doran: { name: "도르반", stem: "bearded-bandana", ...RTP("actor2"), index: 4, side: "left" },
  risk: { name: "리스크", stem: "green-scholar", ...RTP("actor2"), index: 2, side: "right" },
  marta: { name: "하그네", stem: "people1-old-woman", ...RTP("people1"), index: 7, side: "right" },
  boatman: { name: "뱃사공 오그", stem: "people1-old-man", ...RTP("people1"), index: 6, side: "right" },
  widow: { name: "어부의 아내 세나", stem: "people1-village-woman", ...RTP("people1"), index: 5, side: "right" },
  keeper: { name: "여관 주인 베일", stem: "people1-mustache", ...RTP("people1"), index: 4, side: "right" },
  villager: { name: "늪 사람", stem: "people1-blue-man", ...RTP("people1"), index: 2, side: "right" },
  fisher: { name: "어부", stem: "people1-blonde-woman", ...RTP("people1"), index: 3, side: "right" },
  brann: { name: "경비대장 브란", stem: "people2-blue-guard", ...RTP("people3"), index: 7, side: "right" },
  osben: { name: "오스벤", stem: "people2-mustache", ...RTP("people3"), index: 6, side: "right" },
  girl: { name: "밀수꾼 소녀", stem: "pink-hat", ...RTP("actor2"), index: 5, side: "right" },
  servant: { name: "늙은 하인", stem: "people2-white-elder", ...RTP("people3"), index: 4, side: "right" },
  pilgrim: { name: "순례자", stem: "people1-nun", ...RTP("people2"), index: 1, side: "right" },
  guard: { name: "경비병", stem: "people2-blue-guard", ...RTP("people3"), index: 7, side: "right" },
};

export const bustId = (who: Who, expr: Expr): string => `shared-${CAST[who].stem}-expressions-bust-${expr}`;
export const CLEAR_FACE: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as Command;

function faceOf(who: Who, expr: Expr): Command {
  const c = CAST[who];
  if (c.stem) return { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: c.side, flipHorizontally: false } as Command;
  return CLEAR_FACE;
}

/** 인물 대사 — 흉상(표정)이나 얼굴 그림을 바꾸고 이름과 함께 말한다. */
export function say(who: Who, expr: Expr, ...lines: string[]): Command[] {
  const c = CAST[who];
  return [faceOf(who, expr), ...lines.map((body): Command => ({ kind: "text", speaker: c.name, body, position: "bottom" } as Command))];
}
/** 속마음 창이 이미 괄호를 씌우므로, 대사에 적은 바깥 괄호 한 쌍은 벗긴다. */
const unwrap = (body: string): string => (/^\(.*\)$/s.test(body) && !body.slice(1, -1).includes(")") ? body.slice(1, -1) : body);
export function thinkAs(name: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker: name, body: unwrap(body), position: "bottom", context: "thought" } as Command))];
}
export const think = (...lines: string[]): Command[] => thinkAs(CAST.doran.name, ...lines);
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" } as Command))];
}
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" } as Command))];
}
/** 종이 한 장 — 제목과 줄들을 한 화면에 함께 보인다(줄마다 넘기지 않는다). 편지 창은 한 장에 3줄이므로 3줄 이하로 쓴다. */
export function note(...lines: string[]): Command[] {
  if (lines.length > 3) throw new Error(`[hunter] 종이 한 장은 3줄까지다(넘으면 다음 장으로 갈린다): ${lines[0]}`);
  return [CLEAR_FACE, { kind: "text", body: lines.join("\n"), position: "center", context: "letter" } as Command];
}
/** 종이에 적힌 글(전단지·통장·편지) — 편지 맥락. */
export function letter(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "center", context: "letter" } as Command))];
}

export function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[hunter] m2 명령 없음: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields } as Command;
}
export const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
export const fadeOut = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: ms }), wait(ms)];
export const fadeIn = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeIn", value: "", durationMs: ms }), wait(ms)];
export const shake = (ms = 400, power = "1"): Command => m2("Shake Screen", { value: 1, intensity: power, durationMs: ms, direction: "horizontal" });
export const flash = (color = "white", ms = 300): Command => m2("Flash Screen", { color, durationMs: ms, value: "flash" });
export const playSe = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as Command);
export const bgm = (resourceId: string, fadeInMs = 800): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm", fadeInMs } as Command);
export const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as Command);
export const setVar = (variableId: string, op: "=" | "+=" | "-=", value: number): Command => ({ kind: "setVariable", variableId, op, value } as Command);
export const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
export type Cell = { x: number; y: number };
export const transfer = (mapId: string, at: Cell, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x: at.x, y: at.y, direction, fade: "black" } as Command);
export const ifCond = (condition: EventPageCondition, then: Command[], otherwise: Command[] = []): Command =>
  ({ kind: "fork", condition, then, ...(otherwise.length ? { else: otherwise } : {}) } as Command);
/** 선택지. enableWhen 이 거짓이면 흐린 줄로 보이고 고를 수 없다(disabledText 가 이유, #4001). */
export const choices = (options: { text: string; then: Command[]; enableWhen?: EventPageCondition; disabledText?: string; showWhen?: EventPageCondition }[]): Command =>
  ({ kind: "choices", options: options.map((o) => ({ text: o.text, branch: o.then,
    ...(o.enableWhen ? { enableWhen: o.enableWhen } : {}), ...(o.disabledText ? { disabledText: o.disabledText } : {}), ...(o.showWhen ? { showWhen: o.showWhen } : {}) })),
    cancelBehavior: "disallow" } as Command);
export const varIs = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "==", value: n } as EventPageCondition);
export const varAtLeast = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: ">=", value: n } as EventPageCondition);
export const swOn = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: true } as EventPageCondition);
export const swOff = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: false } as EventPageCondition);
const routeOf = (eventId: string, moves: Record<string, unknown>[], waitDone = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitDone, skippable: true } } as Command);
export const walk = (eventId: string, dirs: readonly Dir[], waitDone = true): Command => routeOf(eventId, dirs.map((dir) => ({ kind: "move", dir })), waitDone);
/** 칸으로 걸어간다(길 찾기, 막히면 가장 가까운 칸). */
export const walkTo = (eventId: string, cell: Cell, waitDone = true): Command => routeOf(eventId, [{ kind: "approach", x: cell.x, y: cell.y, distance: 0 }], waitDone);
export const approach = (eventId: string, target: string, distance = 1): Command => routeOf(eventId, [{ kind: "approach", target, ...(distance !== 1 ? { distance } : {}) }]);
/** 문 칸까지 걸어가 그 칸 위에서 사라진다. */
export const exitVia = (eventId: string, door: Cell, waitDone = true): Command => routeOf(eventId, [{ kind: "exitVia", x: door.x, y: door.y }], waitDone);
export const faceHero = (eventId: string): Command => routeOf(eventId, [{ kind: "turnTowardPlayer" }]);
export const face = (eventId: string, dir: Dir): Command => routeOf(eventId, [{ kind: "turn", dir }]);
export const faceToward = (eventId: string, target: string): Command => routeOf(eventId, [{ kind: "turnToward", target }]);
export const emote = (target: "player" | string, kind: string, durationMs = 1000): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as Command);
/** 카메라를 칸으로 옮긴다(흉상 대화창이 화면 아래 ⅓을 덮으니, 보여야 할 인물을 화면 위쪽으로 올린다). */
export const panTo = (x: number, y: number, ms = 600): Command => m2("Camera Control", { mode: "panTo", target: "screen", x, y, durationMs: ms, wait: true, easing: "easeInOut" });
export const panBack = (ms = 600): Command => m2("Camera Control", { mode: "return", target: "player", x: 0, y: 0, durationMs: ms, wait: true, easing: "easeInOut" });
/** 제한시간 선택지 — 고른 번호(1부터, 시간 초과 0)를 변수에 쓴다. */
export const timedChoice = (prompt: string, options: string[], timeLimitMs: number, resultVariableId: string): Command =>
  m2("Timed Choice", { prompt, options: options.join("\n"), timeLimitMs, resultVariableId });
export const tint = (color: string, ms = 0): Command => m2("Tint Screen", { color, value: "", durationMs: ms });
export const clearTint = (ms = 0): Command => m2("Tint Screen", { color: "neutral", value: "", durationMs: ms });

type PageOpts = { who?: Who; dir?: Dir; trigger?: "action" | "auto" | "playerTouch" | "parallel"; priority?: "below" | "same" | "above"; walkAnim?: boolean };
export function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: PageOpts = {}): EventPage {
  const who = opts.who ? CAST[opts.who] : undefined;
  const dir = opts.dir ?? "down";
  return {
    id, name: id, conditions,
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
/** 그림 없는 «없음» 페이지 — 마지막에 맞는 페이지가 이긴다. */
export const gone = (id: string, conditions: EventPageCondition[]): EventPage => page(id, conditions, [], { priority: "below" });
export function event(id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages } as GameEvent;
}

export function execTool(project: Project, name: string, args: Record<string, unknown>): { summary?: string; data?: unknown } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[hunter] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  const warnings = (res as { warnings?: unknown }).warnings;
  if (Array.isArray(warnings) && warnings.length > 0 && process.env.IG_WARN) console.warn(`[hunter] ${name} 경고: ${warnings.join(" | ")}`);
  return { summary: res.summary, data: res.data };
}

/** want 에서 가장 가까운 걸을 수 있는 빈 칸. 없으면 던진다 — 방 생성이 바뀌어 인물이 벽에 서는 일을 막는다. */
export function nearestFree(project: Project, map: GameMap, want: Cell, avoid: readonly Cell[] = [], maxR = 6): Cell {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: want.x + dx, y: want.y + dy };
      if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
      if (!isPassable(project, map, c.x, c.y)) continue;
      if (map.events.some((e) => e.x === c.x && e.y === c.y) || avoid.some((a) => a.x === c.x && a.y === c.y)) continue;
      return c;
    }
  }
  throw new Error(`[hunter] ${map.id} 에 ${want.x},${want.y} 근처 빈 칸이 없다`);
}

/** 이 칸이 걸을 수 있어야 한다(레이아웃 바뀜 감지). */
export function mustWalk(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (!isPassable(project, map, c.x, c.y)) throw new Error(`[hunter] ${map.id} ${what} (${c.x},${c.y}) 이 막혔다 — 방 생성 결과가 바뀌었다`);
  return c;
}
/** 이 칸이 막혀 있어야 한다(가구·카운터). */
export function mustBlock(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (isPassable(project, map, c.x, c.y)) throw new Error(`[hunter] ${map.id} ${what} (${c.x},${c.y}) 이 뚫렸다 — 방 생성 결과가 바뀌었다`);
  return c;
}

/**
 * from 에서 to 까지 걸어갈 수 있어야 한다 — 서 있는 인물(같은 층 이벤트) 칸은 막힌 것으로 본다.
 * 인도 폭이 두 칸뿐인 곳에 인물을 세우면 길이 끊긴다(실플레이 2026-10-29: 찻집 앞 리리가 신사·공원 길을 막았다).
 */
export function mustReach(project: Project, map: GameMap, from: Cell, to: Cell, what: string): void {
  const standing = new Set(map.events.filter((e) => (e.pages ?? []).some((p) => p.priority === "same" && !!p.graphic?.sprite)).map((e) => `${e.x},${e.y}`));
  const key = (x: number, y: number) => `${x},${y}`;
  const seen = new Set([key(from.x, from.y)]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.x === to.x && c.y === to.y) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (seen.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (!canMove(project, map, c.x, c.y, n.x, n.y)) continue;
      if (standing.has(k) && !(n.x === to.x && n.y === to.y)) continue;
      seen.add(k); queue.push(n);
    }
  }
  throw new Error(`[hunter] ${map.id} ${what}: (${from.x},${from.y}) → (${to.x},${to.y}) 길이 끊겼다`);
}

/** from 에서 걸어서 닿는 칸 전부(BFS, canMove). 맵 생성 결과에서 「가장 위쪽 빈터」 같은 자리를 고를 때 쓴다. */
export function reachableCells(project: Project, map: GameMap, from: Cell): Cell[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const seen = new Set([key(from.x, from.y)]);
  const out: Cell[] = [from];
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (seen.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (!canMove(project, map, c.x, c.y, n.x, n.y)) continue;
      seen.add(k); queue.push(n); out.push(n);
    }
  }
  return out;
}
