import { changeItem, type PlaySession } from "@/project/session";
import type { ItemRecord, Project } from "@/project/types";

export type MenuItemUseResult =
  | { readonly kind: "used"; readonly message: string }
  | { readonly kind: "unusable"; readonly message: string };

export function useItemFromMenu(
  project: Project,
  session: PlaySession,
  itemId: string,
  targetActorId?: string
): MenuItemUseResult {
  const item = project.database.items.find((record) => record.id === itemId);
  if (!item || (session.inventory[item.id] ?? 0) <= 0) return { kind: "unusable", message: "사용할 수 없습니다" };
  if (!canUseItemInMenu(item)) return { kind: "unusable", message: `${item.name}은(는) 지금 사용할 수 없습니다` };

  const targets = item.scope === "allAllies"
    ? session.partyActorIds
    : [targetActorId].filter((actorId): actorId is string => Boolean(actorId));
  if (targets.length === 0) return { kind: "unusable", message: "대상을 선택하세요" };
  let changed = false;
  for (const actorId of targets) {
    if (!canApplyRecovery(item, session, actorId)) continue;
    changed = applyRecovery(item, session, actorId) || changed;
  }
  if (!changed) return { kind: "unusable", message: `${item.name}의 효과가 없습니다` };

  if (item.consumable) changeItem(session, item.id, "-=", 1);
  return { kind: "used", message: `${item.name}을 사용했습니다` };
}

function canApplyRecovery(item: ItemRecord, session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;
  const dead = vitals.hp <= 0;
  if (item.onlyEffectiveOnDeadActors) return dead;
  if (dead) return false;
  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  return (hp > 0 && vitals.hp < vitals.maxHp) || (mp > 0 && vitals.mp < vitals.maxMp);
}

function canUseItemInMenu(item: ItemRecord): boolean {
  return item.occasion === "always" || item.occasion === "field" || item.onlyUsableInMenu;
}

function applyRecovery(item: ItemRecord, session: PlaySession, actorId: string): boolean {
  const vitals = session.actorVitals[actorId];
  if (!vitals) return false;
  const hp = recoveryAmount(item.hpRecovery, vitals.maxHp);
  const mp = recoveryAmount(item.mpRecovery, vitals.maxMp);
  const beforeHp = vitals.hp;
  const beforeMp = vitals.mp;
  if (hp > 0) vitals.hp = Math.min(vitals.maxHp, vitals.hp + hp);
  if (mp > 0) vitals.mp = Math.min(vitals.maxMp, vitals.mp + mp);
  return vitals.hp !== beforeHp || vitals.mp !== beforeMp;
}

function recoveryAmount(recovery: ItemRecord["hpRecovery"], maxValue: number): number {
  return Math.max(0, Math.floor(maxValue * recovery.percentMax / 100) + recovery.flat);
}
