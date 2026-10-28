/**
 * 『전생한 마왕, 편의점 알바 시작하다』 전용 장면 도구 — 인물표·대사·연출 명령 짓기.
 * 시타마치(shitamachiFourthSeason.ts)와 첫사랑 키트(firstLoveKit.ts)의 같은 이름 도구를 이 이야기 인물에 맞춰 옮겼다.
 * 현대 인물은 공용 흉상(표정 다섯), 이세계 인물(마왕·용사 일행·사천왕)은 EasyRPG 얼굴 그림으로 말한다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { canMove, isPassable } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";

export type Expr = "base" | "happy" | "surprised" | "sad" | "embarrassed";
export type Who =
  | "maou" | "zervas" | "maouF" | "hina" | "manager" | "tanaka" | "leon" | "leonF" | "lily" | "lilyF"
  | "garet" | "mira" | "ol" | "student" | "teen" | "drunk" | "cat";

interface CastMember {
  readonly name: string;
  /** 공용 흉상 줄기(shared-modern-<stem>-expressions-bust-<표정>). 없으면 얼굴 그림(face) 또는 얼굴 없이. */
  readonly stem?: string;
  readonly face?: string;
  readonly tex: string;
  readonly resource: string;
  readonly index: number;
  readonly side: "left" | "right";
}

export const CAST: Readonly<Record<Who, CastMember>> = {
  // 주인공 — 면접 전에는 「제르바스」, 명찰을 받은 뒤로는 「마오」. 몸은 같은 올리브 재킷 청년.
  maou: { name: "마오", stem: "casual-boy-olive", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 3, side: "left" },
  zervas: { name: "제르바스", stem: "casual-boy-olive", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 3, side: "left" },
  maouF: { name: "마왕 제르바스", face: "easyrpg-faceset-monster-15", tex: "tex_easyrpg_charset_monster2", resource: "easyrpg-charset-monster2", index: 7, side: "left" },
  hina: { name: "히나", stem: "casual-girl-pink", tex: "tex_oprn_charset_modern2", resource: "oprn-charset-modern2", index: 5, side: "right" },
  manager: { name: "사토미 점장", stem: "teacher-cardigan", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 7, side: "right" },
  tanaka: { name: "다나카", stem: "suit-boy-charcoal", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 1, side: "right" },
  leon: { name: "레온", stem: "uni-boy-grey", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 1, side: "right" },
  leonF: { name: "용사 레온", face: "easyrpg-faceset-actor1-00", tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 0, side: "right" },
  lily: { name: "리리", stem: "apron-navy", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 4, side: "right" },
  lilyF: { name: "몽마 리리스", face: "easyrpg-faceset-monster-08", tex: "tex_easyrpg_charset_monster2", resource: "easyrpg-charset-monster2", index: 0, side: "right" },
  garet: { name: "성기사 가렛", face: "easyrpg-faceset-actor1-02", tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 2, side: "right" },
  mira: { name: "마법사 미라", face: "easyrpg-faceset-actor1-05", tex: "tex_easyrpg_charset_actor1", resource: "easyrpg-charset-actor1", index: 5, side: "right" },
  ol: { name: "회사원 손님", stem: "suit-girl-navy", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 2, side: "right" },
  student: { name: "학생 손님", stem: "uni-boy-summer", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 2, side: "right" },
  teen: { name: "고등학생 손님", stem: "uni-boy-sidetail", tex: "tex_oprn_charset_modern1", resource: "oprn-charset-modern1", index: 3, side: "right" },
  drunk: { name: "취한 회사원", stem: "suit-boy-navy", tex: "tex_oprn_charset_modern3", resource: "oprn-charset-modern3", index: 0, side: "right" },
  cat: { name: "길고양이", tex: "tex_easyrpg_charset_animal", resource: "easyrpg-charset-animal", index: 1, side: "right" },
};

export const bustId = (who: Who, expr: Expr): string => `shared-modern-${CAST[who].stem}-expressions-bust-${expr}`;
export const CLEAR_FACE: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as Command;

function faceOf(who: Who, expr: Expr): Command {
  const c = CAST[who];
  if (c.stem) return { kind: "changeFace", resourceId: bustId(who, expr), presentation: "bust", position: c.side, flipHorizontally: false } as Command;
  if (c.face) return { kind: "changeFace", resourceId: c.face, position: c.side, flipHorizontally: false } as Command;
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
export const think = (...lines: string[]): Command[] => thinkAs(CAST.maou.name, ...lines);
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" } as Command))];
}
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" } as Command))];
}
/** 종이에 적힌 글(전단지·통장·편지) — 편지 맥락. */
export function letter(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "center", context: "letter" } as Command))];
}

export function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[maou-konbini] m2 명령 없음: ${title}`);
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
  if (!res.ok) throw new Error(`[maou-konbini] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
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
  throw new Error(`[maou-konbini] ${map.id} 에 ${want.x},${want.y} 근처 빈 칸이 없다`);
}

/** 이 칸이 걸을 수 있어야 한다(레이아웃 바뀜 감지). */
export function mustWalk(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (!isPassable(project, map, c.x, c.y)) throw new Error(`[maou-konbini] ${map.id} ${what} (${c.x},${c.y}) 이 막혔다 — 방 생성 결과가 바뀌었다`);
  return c;
}
/** 이 칸이 막혀 있어야 한다(가구·카운터). */
export function mustBlock(project: Project, map: GameMap, c: Cell, what: string): Cell {
  if (isPassable(project, map, c.x, c.y)) throw new Error(`[maou-konbini] ${map.id} ${what} (${c.x},${c.y}) 이 뚫렸다 — 방 생성 결과가 바뀌었다`);
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
  throw new Error(`[maou-konbini] ${map.id} ${what}: (${from.x},${from.y}) → (${to.x},${to.y}) 길이 끊겼다`);
}
