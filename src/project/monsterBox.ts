// 몬스터 보관함(PC 상자) 규칙. 정본 목록은 session.monsterBox(평평한 id 배열) 그대로이고,
// 상자·칸은 거기서 계산한다 — 저장 모양·옛 저장은 바뀌지 않는다.
//   - 상자 하나 = 30칸(6×5). 상자 수는 최소 8개, 보관 수가 넘치면 필요한 만큼 늘어난다(잡은 몬스터는 막지 않는다).
//   - 어느 칸에 있는지는 개체의 선택 필드 boxSlot(절대 칸 번호). 없거나 겹치면 먼저 빈 칸에 차례로 앉는다.
//   - 상자 이름은 저작 시스템 값 system.monsterBoxNames(없으면 「상자 N」).
import { ensureMonsterSessionFields, monsterDisplayName, moveMonster } from "@/project/monsterCollection";
import { removeMonster } from "@/project/monsterTrade";
import { transitionItemState } from "@/project/itemTransitions";
import type { MonsterInstance, PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export const MONSTER_BOX_COLUMNS = 6;
export const MONSTER_BOX_ROWS = 5;
export const MONSTER_BOX_SIZE = MONSTER_BOX_COLUMNS * MONSTER_BOX_ROWS;
export const MONSTER_BOX_MIN_COUNT = 8;
export const MONSTER_BOX_NAME_MAX = 8;

export function monsterBoxCount(session: Pick<PlaySession, "monsterBox">): number {
  return Math.max(MONSTER_BOX_MIN_COUNT, Math.ceil((session.monsterBox?.length ?? 0) / MONSTER_BOX_SIZE));
}

/** 상자 이름. 저작 이름이 비면 「상자 N」. */
export function monsterBoxName(project: Pick<Project, "system">, boxIndex: number): string {
  const authored = project.system.monsterBoxNames?.[boxIndex];
  const name = typeof authored === "string" ? authored.trim() : "";
  return name ? name.slice(0, MONSTER_BOX_NAME_MAX) : `상자 ${boxIndex + 1}`;
}

/** 저작 이름을 정리한다(최대 상자 수·글자 수). 모두 비면 undefined(필드 자체를 지운다). */
export function normalizeMonsterBoxNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names = value.slice(0, 32).map((entry) => (typeof entry === "string" ? entry.trim().slice(0, MONSTER_BOX_NAME_MAX) : ""));
  while (names.length > 0 && names[names.length - 1] === "") names.pop();
  return names.length > 0 ? names : undefined;
}

/** 칸마다 개체 id(빈 칸은 undefined). 길이 = 상자 수 × 30. 자기 boxSlot 을 먼저 인정하고, 나머지는 첫 빈 칸에 앉힌다. */
export function monsterBoxLayout(session: Pick<PlaySession, "monsterBox" | "monsterInstances">): (string | undefined)[] {
  const total = monsterBoxCount(session) * MONSTER_BOX_SIZE;
  const slots: (string | undefined)[] = new Array<string | undefined>(total).fill(undefined);
  const ids = (session.monsterBox ?? []).filter((id) => session.monsterInstances?.[id]);
  const unplaced: string[] = [];
  for (const id of ids) {
    const wanted = session.monsterInstances[id]?.boxSlot;
    if (Number.isInteger(wanted) && wanted! >= 0 && wanted! < total && slots[wanted!] === undefined) slots[wanted!] = id;
    else unplaced.push(id);
  }
  let cursor = 0;
  for (const id of unplaced) {
    while (cursor < total && slots[cursor] !== undefined) cursor += 1;
    if (cursor >= total) break;
    slots[cursor] = id;
  }
  return slots;
}

/** 한 상자의 30칸. */
export function monsterBoxCells(session: Pick<PlaySession, "monsterBox" | "monsterInstances">, boxIndex: number): (string | undefined)[] {
  return monsterBoxLayout(session).slice(boxIndex * MONSTER_BOX_SIZE, (boxIndex + 1) * MONSTER_BOX_SIZE);
}

export function monsterBoxOccupancy(session: Pick<PlaySession, "monsterBox" | "monsterInstances">, boxIndex: number): number {
  return monsterBoxCells(session, boxIndex).filter((id) => id !== undefined).length;
}

/** 칸 번호 → 그 칸이 속한 상자 번호. */
export const monsterBoxIndexOfSlot = (slot: number): number => Math.floor(slot / MONSTER_BOX_SIZE);

/** 보관함 몬스터가 앉아 있는 절대 칸. 보관함에 없으면 -1. */
export function monsterBoxSlotOf(session: Pick<PlaySession, "monsterBox" | "monsterInstances">, instanceId: string): number {
  return monsterBoxLayout(session).indexOf(instanceId);
}

export type PlaceBoxMonsterResult =
  | { readonly ok: true; readonly swappedWith?: string }
  | { readonly ok: false; readonly reason: "notInBox" | "badSlot" | "same" };

/** 보관함 몬스터를 다른 칸(다른 상자 포함)으로 옮긴다. 그 칸에 다른 몬스터가 있으면 서로 자리를 바꾼다. */
export function placeBoxMonster(session: PlaySession, instanceId: string, targetSlot: number): PlaceBoxMonsterResult {
  ensureMonsterSessionFields(session);
  const layout = monsterBoxLayout(session);
  const from = layout.indexOf(instanceId);
  if (from < 0) return { ok: false, reason: "notInBox" };
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= layout.length) return { ok: false, reason: "badSlot" };
  if (from === targetSlot) return { ok: false, reason: "same" };
  const occupant = layout[targetSlot];
  // 배치가 계산으로만 있던 개체도 이때 모두 굳힌다 — 한 칸만 옮겼는데 나머지가 다시 앉지 않게.
  const next: Record<string, MonsterInstance> = { ...session.monsterInstances };
  layout.forEach((id, slot) => { if (id && next[id]) next[id] = { ...next[id]!, boxSlot: slot }; });
  next[instanceId] = { ...next[instanceId]!, boxSlot: targetSlot };
  if (occupant) next[occupant] = { ...next[occupant]!, boxSlot: from };
  session.monsterInstances = next;
  return { ok: true, ...(occupant ? { swappedWith: occupant } : {}) };
}

export type BoxDepositResult =
  | { readonly ok: true; readonly slot: number }
  | { readonly ok: false; readonly reason: "missingInstance" | "lastPartyMonster" | "boxFull" };

/** 파티 → 보관함. 파티의 마지막 한 마리는 맡기지 않는다. targetBox 를 주면 그 상자의 첫 빈 칸에 둔다. */
export function depositMonsterToBox(project: Project, session: PlaySession, instanceId: string, targetBox?: number): BoxDepositResult {
  ensureMonsterSessionFields(session);
  if (!session.monsterInstances[instanceId]) return { ok: false, reason: "missingInstance" };
  if (session.monsterParty.includes(instanceId) && session.monsterParty.length <= 1) return { ok: false, reason: "lastPartyMonster" };
  const moved = moveMonster(session, instanceId, "box", project);
  if (!moved.ok) return { ok: false, reason: "missingInstance" };
  if (targetBox !== undefined) {
    const layout = monsterBoxLayout(session);
    const start = targetBox * MONSTER_BOX_SIZE;
    const free = layout.slice(start, start + MONSTER_BOX_SIZE).findIndex((id) => id === undefined);
    if (free >= 0) placeBoxMonster(session, instanceId, start + free);
  }
  return { ok: true, slot: monsterBoxSlotOf(session, instanceId) };
}

export type BoxReleaseResult =
  | { readonly ok: true; readonly name: string; readonly returnedItemId?: string }
  | { readonly ok: false; readonly reason: "missingInstance" | "lastPartyMonster" };

/** 놓아주기. 지니고 있던 도구는 가방으로 돌려준다. 도감 기록(포획)은 남는다. */
export function releaseMonsterFromBox(project: Project, session: PlaySession, instanceId: string): BoxReleaseResult {
  ensureMonsterSessionFields(session);
  const instance = session.monsterInstances[instanceId];
  if (!instance) return { ok: false, reason: "missingInstance" };
  const name = monsterDisplayName(project, instance);
  const heldItemId = instance.heldItemId;
  const removed = removeMonster(project, session, instanceId);
  if (!removed.ok) return { ok: false, reason: removed.reason };
  if (heldItemId) {
    const next = transitionItemState({ inventory: session.inventory, itemUseCharges: session.itemUseCharges }, project.database.items, { kind: "grant", itemId: heldItemId, amount: 1 });
    session.inventory = next.inventory;
    session.itemUseCharges = next.itemUseCharges;
  }
  return { ok: true, name, ...(heldItemId ? { returnedItemId: heldItemId } : {}) };
}

/** 파티가 가득 차 보관함으로 간 몬스터 이름들(포획 알림용). before = 반영 직전 보관함 id 목록. */
export function monstersSentToBox(project: Project, session: Pick<PlaySession, "monsterBox" | "monsterInstances">, before: readonly string[]): string[] {
  const known = new Set(before);
  return (session.monsterBox ?? []).filter((id) => !known.has(id)).map((id) => monsterDisplayName(project, session.monsterInstances[id]));
}
