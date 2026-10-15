// 파티 몬스터에게 지닌 도구를 쥐여 주고 되돌려 받는 필드 메뉴 규칙. 인벤토리 수량은 itemTransitions 가 정본이다.
import { transitionItemState } from "@/project/itemTransitions";
import { monsterDisplayName } from "@/project/monsterCollection";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type HeldItemChangeResult =
  | { readonly kind: "done"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

function itemNameOf(project: Project, itemId: string): string {
  return project.database.items.find((item) => item.id === itemId)?.name ?? itemId;
}

/** 가방의 도구를 몬스터에게 쥐여 준다. 이미 다른 도구를 지니고 있으면 바꿔서 가방으로 돌려받는다. */
export function giveHeldItem(project: Project, session: PlaySession, itemId: string, instanceId: string | undefined): HeldItemChangeResult {
  const item = project.database.items.find((record) => record.id === itemId);
  if (!item?.heldEffect) return { kind: "unusable", message: "지닐 수 없는 도구입니다" };
  const instance = instanceId ? session.monsterInstances?.[instanceId] : undefined;
  if (!instance || !instanceId) return { kind: "unusable", message: "도구를 쥐여 줄 파티 몬스터를 선택하세요" };
  if ((session.inventory[itemId] ?? 0) <= 0) return { kind: "unusable", message: "가방에 도구가 없습니다" };
  if (instance.heldItemId === itemId) return { kind: "unusable", message: `${monsterDisplayName(project, instance)}은(는) 이미 ${item.name}을(를) 지니고 있습니다` };
  const previous = instance.heldItemId;
  const actions = [
    { kind: "remove", itemId, amount: 1 } as const,
    ...(previous ? [{ kind: "grant", itemId: previous, amount: 1 } as const] : []),
  ];
  let next = { inventory: session.inventory, itemUseCharges: session.itemUseCharges };
  for (const action of actions) next = transitionItemState(next, project.database.items, action);
  session.inventory = next.inventory;
  session.itemUseCharges = next.itemUseCharges;
  session.monsterInstances[instanceId] = { ...instance, heldItemId: itemId };
  const name = monsterDisplayName(project, instance);
  return { kind: "done", message: previous ? `${name}의 ${itemNameOf(project, previous)}을(를) 가방에 넣고 ${item.name}을(를) 쥐여 주었습니다` : `${name}에게 ${item.name}을(를) 쥐여 주었습니다` };
}

/** 몬스터가 지닌 도구를 가방으로 되돌린다. */
export function takeHeldItem(project: Project, session: PlaySession, instanceId: string): HeldItemChangeResult {
  const instance = session.monsterInstances?.[instanceId];
  if (!instance) return { kind: "unusable", message: "몬스터를 찾을 수 없습니다" };
  const itemId = instance.heldItemId;
  if (!itemId) return { kind: "unusable", message: "지닌 도구가 없습니다" };
  const next = transitionItemState({ inventory: session.inventory, itemUseCharges: session.itemUseCharges }, project.database.items, { kind: "grant", itemId, amount: 1 });
  session.inventory = next.inventory;
  session.itemUseCharges = next.itemUseCharges;
  const { heldItemId: _removed, ...rest } = instance;
  session.monsterInstances[instanceId] = rest;
  return { kind: "done", message: `${monsterDisplayName(project, instance)}의 ${itemNameOf(project, itemId)}을(를) 가방에 넣었습니다` };
}
