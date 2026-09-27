// Opt-in upgrade rows + simple sell price table helpers.
import { changeGold, changeItemsAtomically, type PlaySession } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, type ItemQuantityOperation } from "@/project/itemQuantities";
import type { ItemId, Project } from "@/project/types";
import { equipmentSlotAccepts } from "@/project/equipmentRules";
import { effectiveActorClassId } from "@/project/growth/lineage";

export type ItemUpgradeRule = {
  readonly id: string;
  readonly fromItemId: ItemId;
  readonly toItemId: ItemId;
  readonly goldCost?: number;
  readonly ingredients?: readonly { readonly itemId: ItemId; readonly count: number }[];
  readonly capability?: ToolCapability;
  /**
   * "equipment" 면 fromItemId/toItemId 는 장비(database.equipment) id 다. 누군가 장착 중이면
   * 그 슬롯의 장비를 제자리에서 바꾸고(장착 해제·재장착 없음), 아무도 안 끼고 있으면 가방 속 한 개를 바꾼다.
   * 생략 = 기존 아이템 강화.
   */
  readonly target?: "equipment";
};

export type ToolCapability = {
  readonly areaWidth: number;
  readonly areaHeight: number;
  readonly energyMultiplier: number;
};

export const TOOL_CAPABILITY_AXIS_MAX = 9;
export const TOOL_CAPABILITY_TILE_MAX = 81;

const DEFAULT_TOOL_CAPABILITY: ToolCapability = {
  areaWidth: 1,
  areaHeight: 1,
  energyMultiplier: 1,
};

export type SellPriceEntry = {
  readonly itemId: ItemId;
  readonly price: number;
};

export type UpgradeResult =
  | { readonly ok: true; readonly ruleId: string; readonly toItemId: ItemId; readonly equippedActorId?: string }
  | { readonly ok: false; readonly reason: "disabled" | "missing-rule" | "missing-item" | "missing-gold" | "missing-ingredients" | "invalid-state" };

export function upgradeRulesOf(project: Project): readonly ItemUpgradeRule[] {
  return project.system.itemUpgrades ?? [];
}

export function sellPriceTableOf(project: Project): readonly SellPriceEntry[] {
  return project.system.sellPrices ?? [];
}

export function resolveSellPrice(project: Project, itemId: ItemId): number | undefined {
  const row = sellPriceTableOf(project).find((entry) => entry.itemId === itemId);
  if (row) return Math.max(0, Math.trunc(row.price));
  const item = project.database.items.find((entry) => entry.id === itemId);
  if (!item) return undefined;
  // Default sell = half buy price when no table row (common shop convention).
  return Math.max(0, Math.floor((item.price ?? 0) / 2));
}

export function resolveToolCapability(project: Project, itemId: ItemId | undefined): ToolCapability {
  if (!itemId) return DEFAULT_TOOL_CAPABILITY;
  const capability = upgradeRulesOf(project).find((rule) => rule.toItemId === itemId)?.capability;
  if (!isValidToolCapability(capability)) {
    return DEFAULT_TOOL_CAPABILITY;
  }
  return capability;
}

export function isValidToolCapability(capability: ToolCapability | undefined): capability is ToolCapability {
  return capability !== undefined
    && Number.isSafeInteger(capability.areaWidth)
    && capability.areaWidth > 0
    && capability.areaWidth <= TOOL_CAPABILITY_AXIS_MAX
    && Number.isSafeInteger(capability.areaHeight)
    && capability.areaHeight > 0
    && capability.areaHeight <= TOOL_CAPABILITY_AXIS_MAX
    && capability.areaWidth * capability.areaHeight <= TOOL_CAPABILITY_TILE_MAX
    && Number.isFinite(capability.energyMultiplier)
    && capability.energyMultiplier > 0;
}

export function applyItemUpgrade(project: Project, session: PlaySession, ruleId: string): UpgradeResult {
  const rules = upgradeRulesOf(project);
  if (rules.length === 0) return { ok: false, reason: "disabled" };
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule) return { ok: false, reason: "missing-rule" };
  if (rule.target === "equipment") return applyEquipmentUpgrade(project, session, rule);
  if (!isItemQuantity(session.inventory[rule.fromItemId] ?? 0)) return { ok: false, reason: "invalid-state" };
  if ((session.inventory[rule.fromItemId] ?? 0) < 1) return { ok: false, reason: "missing-item" };
  if ((rule.goldCost ?? 0) > 0 && session.gold < (rule.goldCost ?? 0)) {
    return { ok: false, reason: "missing-gold" };
  }
  const required = new Map<string, number>();
  required.set(rule.fromItemId, 1);
  for (const ing of rule.ingredients ?? []) {
    if (!isPositiveItemQuantity(ing.count)) return { ok: false, reason: "invalid-state" };
    const total = (required.get(ing.itemId) ?? 0) + ing.count;
    if (!isItemQuantity(total)) return { ok: false, reason: "invalid-state" };
    required.set(ing.itemId, total);
  }
  for (const [itemId, need] of required) {
    const current = session.inventory[itemId] ?? 0;
    if (!isItemQuantity(current)) return { ok: false, reason: "invalid-state" };
    if (current < need) return { ok: false, reason: itemId === rule.fromItemId ? "missing-item" : "missing-ingredients" };
  }
  const operations: ItemQuantityOperation[] = [...required].map(([itemId, amount]) => ({ itemId, op: "-=", amount }));
  operations.push({ itemId: rule.toItemId, op: "+=", amount: 1 });
  if (!changeItemsAtomically(session, operations)) return { ok: false, reason: "invalid-state" };
  if ((rule.goldCost ?? 0) > 0) changeGold(session, "-=", rule.goldCost ?? 0);
  if (session.equippedToolItemId === rule.fromItemId) {
    session.equippedToolItemId = rule.toItemId;
  }
  return { ok: true, ruleId: rule.id, toItemId: rule.toItemId };
}

/** 장착 중인 첫 배우·슬롯(파티 순서 우선). 없으면 undefined. */
function equippedHolder(session: PlaySession, equipmentId: string): { readonly actorId: string; readonly slot: string } | undefined {
  const equipment = session.actorEquipment ?? {};
  const order = [...session.partyActorIds.filter((id): id is string => typeof id === "string"), ...Object.keys(equipment)];
  for (const actorId of new Set(order)) {
    for (const [slot, id] of Object.entries(equipment[actorId] ?? {})) {
      if (id === equipmentId) return { actorId, slot };
    }
  }
  return undefined;
}

function applyEquipmentUpgrade(project: Project, session: PlaySession, rule: ItemUpgradeRule): UpgradeResult {
  const from = project.database.equipment.find((entry) => entry.id === rule.fromItemId);
  const to = project.database.equipment.find((entry) => entry.id === rule.toItemId);
  // 같은 슬롯끼리만 — 무기가 투구로 바뀌면 제자리 교체가 장착 규칙을 깨뜨린다.
  if (!from || !to || from.slot !== to.slot) return { ok: false, reason: "invalid-state" };
  if ((rule.goldCost ?? 0) > 0 && session.gold < (rule.goldCost ?? 0)) return { ok: false, reason: "missing-gold" };
  const holder = equippedHolder(session, from.id);
  if (holder) {
    // 강화 결과가 그 슬롯에 들어갈 수 없으면 전투 투영(effectiveActorEquipment)이 조용히 빼 버린다 — 막는다.
    // 같은 투영 규칙(equipmentSlotAccepts)만 본다: 이미 끼고 있던 장비의 강화라 착용 허용 목록은 다시 묻지 않는다.
    const actor = project.database.actors.find((entry) => entry.id === holder.actorId);
    const classId = effectiveActorClassId(project, session, holder.actorId);
    if (!actor || !equipmentSlotAccepts(project, actor, holder.slot, to, classId)) {
      return { ok: false, reason: "invalid-state" };
    }
  }
  const required = new Map<string, number>();
  if (!holder) required.set(from.id, 1);
  for (const ing of rule.ingredients ?? []) {
    if (!isPositiveItemQuantity(ing.count)) return { ok: false, reason: "invalid-state" };
    const total = (required.get(ing.itemId) ?? 0) + ing.count;
    if (!isItemQuantity(total)) return { ok: false, reason: "invalid-state" };
    required.set(ing.itemId, total);
  }
  for (const [itemId, need] of required) {
    const current = session.inventory[itemId] ?? 0;
    if (!isItemQuantity(current)) return { ok: false, reason: "invalid-state" };
    if (current < need) return { ok: false, reason: itemId === from.id ? "missing-item" : "missing-ingredients" };
  }
  const operations: ItemQuantityOperation[] = [...required].map(([itemId, amount]) => ({ itemId, op: "-=", amount }));
  if (!holder) operations.push({ itemId: to.id, op: "+=", amount: 1 });
  if (operations.length > 0 && !changeItemsAtomically(session, operations)) return { ok: false, reason: "invalid-state" };
  if ((rule.goldCost ?? 0) > 0) changeGold(session, "-=", rule.goldCost ?? 0);
  if (holder) {
    session.actorEquipment[holder.actorId] = { ...session.actorEquipment[holder.actorId], [holder.slot]: to.id };
    return { ok: true, ruleId: rule.id, toItemId: to.id, equippedActorId: holder.actorId };
  }
  return { ok: true, ruleId: rule.id, toItemId: to.id };
}
