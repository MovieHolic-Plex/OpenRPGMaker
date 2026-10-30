/**
 * 『이세계로 떠난 한국 고딩, 깽판치다』 전용 장면 도구 — 인물표·대사·연출 명령 짓기.
 * 마왕 편의점 키트(maouKonbiniKit.ts)를 이 이야기 인물에 맞춰 옮겼다.
 * 현대 인물(민재·수아·담임)은 현대 흉상(표정 다섯), 이세계 인물은 공용 판타지 흉상(표정 열여섯)으로 말한다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { canMove, isPassable } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";

/** 공용 흉상 표정. 현대 흉상(modern)은 다섯 표정뿐이라 나머지는 가까운 표정으로 바꿔 찾는다. */
export type Expr =
  | "base" | "smile" | "happy" | "content" | "surprised" | "embarrassed" | "doubtful" | "serious"
  | "annoyed" | "angry" | "sad" | "crying" | "worried" | "determined" | "shy" | "wink";
export type Who =
  | "minjae" | "suah" | "teacher" | "king" | "priest" | "edel" | "fio" | "kkur" | "clerk" | "goblin" | "maou"
  | "guard" | "cook" | "merchant" | "villager" | "kid" | "adventurer" | "chief"
  | "examiner" | "dean" | "slime" | "adventurer2" | "adventurer3" | "adventurer4" | "adventurer5" | "adventurer6";

interface CastMember {
  readonly name: string;
  /** 공용 흉상 줄기. modern 이면 shared-modern-<stem>, 아니면 shared-<stem>. */
  readonly stem?: string;
  readonly modern?: boolean;
  readonly tex: string;
  readonly resource: string;
  readonly index: number;
  readonly side: "left" | "right";
}

/** 걷기 칩과 흉상은 같은 사람으로 보이게 짝지었다(칩 시트와 흉상 대조, 2026-10-30). 새 사람 그림은 없다. */
export const CAST: Readonly<Record<Who, CastMember>> = {
  minjae: { name: "민재", stem: "uni-boy-navy", modern: true, tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 0, side: "left" },
  suah: { name: "수아", stem: "uni-girl-navy", modern: true, tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 4, side: "right" },
  teacher: { name: "담임", stem: "teacher-tweed", modern: true, tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 6, side: "right" },
  king: { name: "국왕 루드릭", stem: "people2-king", tex: "tex_easyrpg_charset_people3", resource: "easyrpg-charset-people3", index: 0, side: "right" },
  priest: { name: "대신관 오르반", stem: "people2-white-elder", tex: "tex_easyrpg_charset_people5", resource: "easyrpg-charset-people5", index: 7, side: "right" },
  edel: { name: "에델", stem: "helmet-blonde", tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 3, side: "right" },
  fio: { name: "피오", stem: "green-cap-blonde", tex: "tex_easyrpg_charset_actor2", resource: "easyrpg-charset-actor2", index: 7, side: "right" },
  kkur: { name: "꾸르", stem: "monster-green-scar", tex: "tex_easyrpg_charset_monster1", resource: "easyrpg-charset-monster1", index: 5, side: "right" },
  clerk: { name: "접수원 리나", stem: "people1-blonde-woman", tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 3, side: "right" },
  goblin: { name: "고블린", stem: "monster-pig", tex: "tex_easyrpg_charset_monster1", resource: "easyrpg-charset-monster1", index: 2, side: "right" },
  maou: { name: "마왕 벨제", stem: "monster-white-hair", tex: "tex_easyrpg_charset_monster2", resource: "easyrpg-charset-monster2", index: 2, side: "right" },
  guard: { name: "근위병", stem: "people2-blue-guard", tex: "tex_easyrpg_charset_people3", resource: "easyrpg-charset-people3", index: 7, side: "right" },
  cook: { name: "여관 주인", stem: "people1-bald-man", tex: "tex_easyrpg_charset_people5", resource: "easyrpg-charset-people5", index: 6, side: "right" },
  merchant: { name: "상인", stem: "people1-mustache", tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 2, side: "right" },
  villager: { name: "주민", stem: "people1-village-woman", tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 5, side: "right" },
  kid: { name: "꼬마", stem: "people1-boy", tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 0, side: "right" },
  adventurer: { name: "모험가", stem: "bearded-bandana", tex: "tex_easyrpg_charset_actor2", resource: "easyrpg-charset-actor2", index: 4, side: "right" },
  chief: { name: "촌장", stem: "people1-old-man", tex: "tex_easyrpg_charset_people1", resource: "easyrpg-charset-people1", index: 6, side: "right" },
  // 흉상 없는 마물 — 걷기 칩만 있고 대사는 이름표만 붙는다.
  examiner: { name: "출제 위원 해골", tex: "tex_easyrpg_charset_monster1", resource: "easyrpg-charset-monster1", index: 4, side: "right" },
  dean: { name: "교무부장", tex: "tex_easyrpg_charset_monster1", resource: "easyrpg-charset-monster1", index: 6, side: "right" },
  adventurer2: { name: "모험가", tex: "tex_easyrpg_charset_actor4", resource: "easyrpg-charset-actor4", index: 0, side: "right" },
  adventurer3: { name: "모험가", tex: "tex_easyrpg_charset_actor4", resource: "easyrpg-charset-actor4", index: 2, side: "right" },
  // 길드 줄 세우기 장면의 군중(처음 하는 사람 검수 v6: 셋으로는 「인파」가 안 보였다).
  adventurer4: { name: "모험가", tex: "tex_easyrpg_charset_actor4", resource: "easyrpg-charset-actor4", index: 4, side: "right" },
  adventurer5: { name: "모험가", tex: "tex_easyrpg_charset_actor2", resource: "easyrpg-charset-actor2", index: 1, side: "right" },
  adventurer6: { name: "모험가", tex: "tex_easyrpg_charset_actor4", resource: "easyrpg-charset-actor4", index: 6, side: "right" },
  slime: { name: "슬라임", tex: "tex_easyrpg_charset_monster1", resource: "easyrpg-charset-monster1", index: 0, side: "right" },
};

const MODERN_EXPR: Readonly<Record<Expr, "base" | "happy" | "surprised" | "sad" | "embarrassed">> = {
  base: "base", smile: "happy", happy: "happy", content: "happy", surprised: "surprised", embarrassed: "embarrassed", doubtful: "base", serious: "base",
  annoyed: "embarrassed", angry: "surprised", sad: "sad", crying: "sad", worried: "sad", determined: "base", shy: "embarrassed", wink: "happy",
};
export const bustId = (who: Who, expr: Expr): string => {
  const c = CAST[who];
  return c.modern ? `shared-modern-${c.stem}-expressions-bust-${MODERN_EXPR[expr]}` : `shared-${c.stem}-expressions-bust-${expr}`;
};
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
/** 주인공 속마음 — 얼굴 없이 흐린 독백. name 은 그 시점의 이름(제르바스/마오). */
/** 속마음 창이 이미 괄호를 씌우므로, 대사에 적은 바깥 괄호 한 쌍은 벗긴다. */
const unwrap = (body: string): string => (/^\(.*\)$/s.test(body) && !body.slice(1, -1).includes(")") ? body.slice(1, -1) : body);
export function thinkAs(name: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker: name, body: unwrap(body), position: "bottom", context: "thought" } as Command))];
}
export const think = (...lines: string[]): Command[] => thinkAs(CAST.minjae.name, ...lines);
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" } as Command))];
}
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" } as Command))];
}
/** 종이 한 장 — 제목과 줄들을 한 화면에 함께 보인다(줄마다 넘기지 않는다). 편지 창은 한 장에 3줄이므로 3줄 이하로 쓴다. */
export function note(...lines: string[]): Command[] {
  if (lines.length > 3) throw new Error(`[isekai-godding] 종이 한 장은 3줄까지다(넘으면 다음 장으로 갈린다): ${lines[0]}`);
  return [CLEAR_FACE, { kind: "text", body: lines.join("\n"), position: "center", context: "letter" } as Command];
}
/** 종이에 적힌 글(전단지·통장·편지) — 편지 맥락. */
export function letter(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "center", context: "letter" } as Command))];
}

export function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[isekai-godding] m2 명령 없음: ${title}`);
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
export const choices = (options: { text: string; then: Command[] }[]): Command =>
  ({ kind: "choices", options: options.map((o) => ({ text: o.text, branch: o.then })), cancelBehavior: "disallow" } as Command);
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
  if (!res.ok) throw new Error(`[isekai-godding] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  const warnings = (res as { warnings?: unknown }).warnings;
  if (Array.isArray(warnings) && warnings.length > 0 && process.env.IG_WARN) console.warn(`[isekai-godding] ${name} 경고: ${warnings.join(" | ")}`);
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
  throw new Error(`[isekai-godding] ${map.id} 에 ${want.x},${want.y} 근처 빈 칸이 없다`);
}

/** 이 칸이 걸을 수 있어야 한다(레이아웃 바뀜 감지). */
export function mustWalk(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (!isPassable(project, map, c.x, c.y)) throw new Error(`[isekai-godding] ${map.id} ${what} (${c.x},${c.y}) 이 막혔다 — 방 생성 결과가 바뀌었다`);
  return c;
}
/** 이 칸이 막혀 있어야 한다(가구·카운터). */
export function mustBlock(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (isPassable(project, map, c.x, c.y)) throw new Error(`[isekai-godding] ${map.id} ${what} (${c.x},${c.y}) 이 뚫렸다 — 방 생성 결과가 바뀌었다`);
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
  throw new Error(`[isekai-godding] ${map.id} ${what}: (${from.x},${from.y}) → (${to.x},${to.y}) 길이 끊겼다`);
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
