/**
 * 『폴른 스타』 월드 정비(2026-11-04 사용자 플레이 메모) — 여러 파일이 같이 쓰는 명령 조각·이벤트 도우미.
 * 「마을 대장간 이런 데가 구체적으로 어딘지 모르겠네 … 재료 조합 상점 … 서브 퀘스트 … 중간에 상인 하나」.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";

export type Cell = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;

export const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } satisfies Command);
export const narrate = (body: string): Command => ({ kind: "text", body, context: "narration", position: "bottom" } satisfies Command);
export const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value });
export const has = (itemId: string): Condition => ({ kind: "item", itemId, present: true });
export const all = (...conditions: Condition[]): Condition => ({ kind: "all", conditions });
export const not = (condition: Condition): Condition => ({ kind: "not", condition });
export const varCond = (variableId: string, op: "==" | ">=" | "<", value: number): Condition => ({ kind: "variable", variableId, op, value });
export const fork = (condition: Condition, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise });
export const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } satisfies Command);
export const setVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "=", value } satisfies Command);
export const item = (itemId: string, amount: number): Command =>
  ({ kind: "changeItem", itemId, op: amount >= 0 ? "+=" : "-=", amount: Math.abs(amount) } satisfies Command);
export const gainGold = (amount: number): Command => ({ kind: "changeGold", op: "+=", amount } satisfies Command);
export const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" });
export const shop = (itemIds: readonly string[]): Command => ({ kind: "shop", shopType: "normal", itemIds: [...itemIds], allowSell: true } satisfies Command);
export const label = (name: string): Command => ({ kind: "label", name } satisfies Command);
export const gotoLabel = (name: string): Command => ({ kind: "gotoLabel", name } satisfies Command);
export type Option = { text: string; branch: Command[]; showWhen?: Condition; enableWhen?: Condition; disabledText?: string };
export const choices = (options: Option[], cancelBranch: Command[] = []): Command => ({ kind: "choices", options, cancelBehavior: "branch", cancelBranch });

export function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
export function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

export function chipGraphic(texture: string, index: number, direction: Dir = "down"): EventPage["graphic"] {
  return { sprite: { type: "bundled", id: texture }, direction, pattern: charsetFrameIndex({ characterIndex: index, direction, pattern: 1 }) } as EventPage["graphic"];
}

export function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Partial<EventPage> = {}): EventPage {
  return {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra,
  };
}

export function putEvent(map: GameMap, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  map.events = map.events.filter((e) => e.id !== id);
  const event: GameEvent = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages };
  map.events.push(event);
  return event;
}

export function mustMap(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-world] 맵 ${id} 이 없다`);
  return map;
}
