/**
 * 『이상 없음』 연출 부품 — 이야기(nothingToReport.ts)는 여기 함수만으로 장면을 쓴다. 명령 형태는 엔진 Command 그대로다.
 * 공포 장면에는 초상을 띄우지 않는다(설계 §2). 인물 대사는 이름만, 순찰 혼잣말은 bark(이벤트 머리 위, 게임을 멈추지 않음).
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { canMove } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, Dir, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";

export type Cell = { x: number; y: number };

const CLEAR_FACE: Command = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false };

export function m2(title: string, fields: Record<string, unknown> = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((c) => c.title === title);
  if (!entry) throw new Error(`[nothing-to-report] m2 명령 없음: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields } as Command;
}

export const wait = (ms: number): Command => ({ kind: "wait", ms });
export const fadeOut = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeOut", value: "", durationMs: ms }), wait(ms)];
export const fadeIn = (ms = 600): Command[] => [m2("Screen Effect", { effect: "fadeIn", value: "", durationMs: ms }), wait(ms)];
export const blackNow = (): Command => m2("Tint Screen", { color: "neutral", value: "0,0,0,1", durationMs: 0 });
/** 화면 번쩍임 — Screen Effect flash 는 value 에 #hex 를 받는다(Flash Screen 의 color 는 이름 9개뿐). */
export const flash = (color = "white", ms = 200): Command => m2("Screen Effect", { effect: "flash", value: color, durationMs: ms });

/** 린의 속마음 — 얼굴·이름 없이. */
export function think(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom" }))];
}
/** 장면 자막(장소·시각). */
export function caption(...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", body, position: "bottom", context: "narration" } as Command))];
}
/** 이름 있는 목소리(방송·인물) — 초상 없이. */
export function voice(speaker: string, ...lines: string[]): Command[] {
  return [CLEAR_FACE, ...lines.map((body): Command => ({ kind: "text", speaker, body, position: "bottom" }))];
}
/** 종이에 적힌 글(일지·대출 카드) — 편지 맥락, 한 장에 3줄까지. */
export function note(...lines: string[]): Command[] {
  if (lines.length > 3) throw new Error(`[nothing-to-report] 종이 한 장은 3줄까지다: ${lines[0]}`);
  return [CLEAR_FACE, { kind: "text", body: lines.join("\n"), position: "center", context: "letter" } as Command];
}
/** 순찰 혼잣말 — 말하는 이벤트(인물 프로필 이름이 speaker 인 이벤트) 머리 위에 잠깐 뜨고 게임을 멈추지 않는다. */
export function bark(speaker: string, body: string): Command {
  return { kind: "text", speaker, body, container: "bark" } as Command;
}

export function playSe(resourceId: string, volume?: number): Command {
  return { kind: "playAudio", resourceId, loop: false, channel: "se", ...(volume !== undefined ? { volume } : {}) } as Command;
}
export function bgs(resourceId: string, volume = 0.35): Command {
  return { kind: "playAudio", resourceId, loop: true, channel: "bgs", volume, fadeInMs: 1500 } as Command;
}
export const stopBgs = (): Command => ({ kind: "stopAudio", channel: "bgs" } as Command);
export const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as Command);

export function transfer(mapId: string, x: number, y: number, direction: Dir = "down", fade: "black" | "none" = "black"): Command {
  return { kind: "transfer", mapId, x, y, direction, fade } as Command;
}
export const setVar = (variableId: string, op: "=" | "+=" | "-=", value: number): Command => ({ kind: "setVariable", variableId, op, value });
export const setSw = (switchId: string, value: boolean): Command => ({ kind: "setSwitch", switchId, value });
export const giveItem = (itemId: string): Command => ({ kind: "changeItem", itemId, op: "+=", amount: 1 } as Command);

export function ifCond(condition: EventPageCondition, then: Command[], otherwise: Command[] = []): Command {
  return { kind: "fork", condition, then, ...(otherwise.length ? { else: otherwise } : {}) } as Command;
}
export function choices(options: { text: string; then: Command[] }[]): Command {
  return { kind: "choices", options: options.map((o) => ({ text: o.text, branch: o.then })), cancelBehavior: "disallow" } as Command;
}

export function walk(eventId: string, dirs: readonly Dir[], waitDone = true): Command {
  return { kind: "moveEvent", eventId, route: { moves: dirs.map((dir) => ({ kind: "move", dir })), repeat: false, wait: waitDone, skippable: true } } as Command;
}
export function walkTo(eventId: string, cell: Cell, waitDone = true): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "approach", x: cell.x, y: cell.y, distance: 0 }], repeat: false, wait: waitDone, skippable: true } } as Command;
}
export function approach(eventId: string, target: string, distance = 1): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "approach", target, ...(distance !== 1 ? { distance } : {}) }], repeat: false, wait: true, skippable: true } } as Command;
}
export function face(eventId: string, dir: Dir): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turn", dir }], repeat: false, wait: true, skippable: true } } as Command;
}
export function faceToward(eventId: string, target: string): Command {
  return { kind: "moveEvent", eventId, route: { moves: [{ kind: "turnToward", target }], repeat: false, wait: true, skippable: true } } as Command;
}
export const hidePlayer = (): Command => m2("Sprite Look", { target: "player", opacity: "0" });
export const showPlayer = (): Command => m2("Sprite Look", { target: "player", reset: true });

// ── 조건 ──
export const varIs = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "==", value: n } as EventPageCondition);
export const varAtLeast = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: ">=", value: n } as EventPageCondition);
export const varBelow = (v: string, n: number): EventPageCondition => ({ kind: "variable", variableId: v, op: "<", value: n } as EventPageCondition);
export const swOn = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: true } as EventPageCondition);
export const swOff = (id: string): EventPageCondition => ({ kind: "switch", switchId: id, value: false } as EventPageCondition);
export const hasItem = (itemId: string): EventPageCondition => ({ kind: "item", itemId, present: true } as EventPageCondition);
export const hiding = (value = true): EventPageCondition => ({ kind: "hiding", value } as EventPageCondition);

// ── 이벤트 페이지 ──
export interface Look { readonly tex: string; readonly index: number; readonly add?: boolean }
type PageOpts = {
  look?: Look;
  dir?: Dir;
  trigger?: "action" | "auto" | "playerTouch" | "parallel";
  priority?: "below" | "same" | "above";
};
export function page(id: string, conditions: EventPageCondition[], commands: Command[], opts: PageOpts = {}): EventPage {
  const look = opts.look;
  const dir = opts.dir ?? "down";
  return {
    id,
    name: id,
    conditions,
    graphic: look
      ? { sprite: { type: "bundled", id: look.tex }, direction: dir, pattern: charsetFrameIndex({ characterIndex: look.index, direction: dir, pattern: 1 }), transparent: false, ...(look.add ? { blendMode: "add" } : {}) }
      : { direction: dir, pattern: 0, transparent: true },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: opts.priority ?? (look ? "same" : "below"),
    overlapForbidden: !!look || opts.priority === "same",
    trigger: { kind: opts.trigger ?? "action" },
    commands,
  } as unknown as EventPage;
}
/** 그림 없는 «없음» 페이지 — 마지막에 맞는 페이지가 이긴다. */
export const gone = (id: string, conditions: EventPageCondition[]): EventPage => page(id, conditions, [], { priority: "below" });
export function event(id: string, name: string, at: Cell, pages: EventPage[], characterId?: string): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages, ...(characterId ? { characterId } : {}) } as GameEvent;
}

export function execTool(project: Project, name: string, args: Record<string, unknown>): { summary?: string; data?: unknown; warnings?: readonly string[] } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[nothing-to-report] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return { summary: res.summary, data: res.data, warnings: (res as { warnings?: readonly string[] }).warnings };
}

/** 이 칸에서 저 칸으로 걸어갈 수 있어야 한다(방 생성 결과가 바뀌면 크게 실패한다). */
export function mustReach(project: Project, map: GameMap, from: Cell, to: Cell, what: string): void {
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
      seen.add(k); queue.push(n);
    }
  }
  throw new Error(`[nothing-to-report] ${map.id} ${what}: (${from.x},${from.y}) → (${to.x},${to.y}) 길이 끊겼다`);
}
