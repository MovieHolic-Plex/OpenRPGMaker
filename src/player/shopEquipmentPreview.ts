import { actorDerivedStats, type EquipmentRuntimeEffects } from "@/battle/battleBattlers";
import { clampLevel, normalizeActorRecord } from "@/project/actorModel";
import {
  effectiveActorEquipment, equipmentSlotAccepts, logicalEquipmentIds, transitionActorEquipment,
  type EquipmentTransitionFailureReason,
} from "@/project/equipmentRules";
import { equipmentSlots } from "@/project/equipmentSlots";
import { effectiveActorClassId } from "@/project/sessionClass";
import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, Project } from "@/project/types";
import type { ShopGoods } from "@/player/playSceneShopGoods";

export interface ShopEquipmentPreviewInput {
  readonly project: Project;
  readonly session: Readonly<Pick<PlaySession,
    "partyActorIds" | "actorNames" | "actorLevels" | "actorEquipment" | "inventory" |
    "classOverrides" | "growthProgress" | "promotionLineage" | "actorParamBonuses"
  >>;
  readonly goods: ShopGoods;
  readonly actorId?: string;
  readonly slot?: string;
}

export interface ShopEquipmentTarget {
  readonly actorId: string;
  readonly name: string;
  /** Slot compatibility only; restricted actors remain available for inspection. */
  readonly slots: readonly { readonly id: string; readonly label: string }[];
}

const STAT_KEYS = ["attack", "defense", "mind", "agility"] as const;
export type ShopEquipmentStatKey = typeof STAT_KEYS[number];
export interface ShopEquipmentCurrentStat {
  readonly key: ShopEquipmentStatKey;
  readonly current: number;
}
export interface ShopEquipmentStat extends ShopEquipmentCurrentStat {
  readonly next: number;
  readonly delta: number;
}

const BOOLEAN_EFFECT_KEYS = ["doubleAttack", "attackAll"] as const;
const SET_EFFECT_KEYS = ["attackElementIds", "elementalDefenseIds", "stateDefenseIds"] as const;
const NUMBER_EFFECT_KEYS = ["accuracy", "criticalRate", "stateResistanceChance"] as const;
export type ShopEquipmentEffect =
  | { readonly key: typeof BOOLEAN_EFFECT_KEYS[number] }
  | { readonly key: typeof SET_EFFECT_KEYS[number]; readonly id: string };
export type ShopEquipmentEffectChange =
  | { readonly key: typeof NUMBER_EFFECT_KEYS[number]; readonly current: number; readonly next: number; readonly delta: number }
  | { readonly key: "stateDefenseMode"; readonly current: EquipmentRuntimeEffects["stateDefenseMode"]; readonly next: EquipmentRuntimeEffects["stateDefenseMode"] };
export interface ShopEquipmentEffectDiff {
  readonly gained: readonly ShopEquipmentEffect[];
  readonly lost: readonly ShopEquipmentEffect[];
  readonly changed: readonly ShopEquipmentEffectChange[];
}

interface SelectedPreview {
  readonly targets: readonly ShopEquipmentTarget[];
  readonly actorId: string;
  readonly slot: string;
  readonly currentEquipment: Readonly<ActorInitialEquipment>;
}
export type ShopEquipmentPreview =
  | {
      readonly kind: "unavailable";
      readonly reason: "notEquipment" | "unsupportedItemEquipment" | "missingEquipment" | "noActor" | "missingActor";
      readonly targets: readonly ShopEquipmentTarget[];
    }
  | (SelectedPreview & {
      readonly kind: "blocked";
      readonly reason: EquipmentTransitionFailureReason;
      readonly stats: readonly ShopEquipmentCurrentStat[];
    })
  | (SelectedPreview & {
      readonly kind: "ready";
      readonly stats: readonly ShopEquipmentStat[];
      readonly nextEquipment: Readonly<ActorInitialEquipment>;
      readonly displaced: readonly { readonly id: string; readonly count: number }[];
      readonly sameEquipment: boolean;
      readonly effects: ShopEquipmentEffectDiff;
    });

/** Purchase-independent simulation: one virtual copy, no auto-equip or session writes. */
export function previewShopEquipment(input: ShopEquipmentPreviewInput): ShopEquipmentPreview {
  const { project, session, goods } = input;
  const candidate = goods.source === "equipment"
    ? project.database.equipment.find(record => record.id === goods.id)
    : undefined;
  const actors = session.partyActorIds.flatMap(id => {
    const actor = project.database.actors.find(record => record.id === id);
    return actor ? [actor] : [];
  });
  const targets: readonly ShopEquipmentTarget[] = actors.map(actor => ({
    actorId: actor.id,
    name: session.actorNames?.[actor.id] ?? actor.name,
    slots: candidate ? equipmentSlots(project).filter(({ id }) =>
      equipmentSlotAccepts(project, actor, id, candidate, effectiveActorClassId(project, session, actor.id))
    ).map(({ id, label }) => ({ id, label })) : [],
  }));
  if (goods.source !== "equipment") {
    return { kind: "unavailable", reason: goods.category === "equipment" ? "unsupportedItemEquipment" : "notEquipment", targets };
  }
  if (!candidate) return { kind: "unavailable", reason: "missingEquipment", targets };
  if (!targets.length) return { kind: "unavailable", reason: "noActor", targets };

  // Explicit actors (even restricted ones) stay selected. Defaults prefer compatible slots.
  const selected = input.actorId !== undefined
    ? targets.find(target => target.actorId === input.actorId)
    : targets.find(target => target.slots.some(slot => slot.id === input.slot))
      ?? targets.find(target => target.slots.length > 0) ?? targets[0];
  const actor = actors.find(record => record.id === selected?.actorId);
  if (!selected || !actor) return { kind: "unavailable", reason: "missingActor", targets };
  const slot = selected.slots.find(slot => slot.id === input.slot)?.id
    ?? selected.slots[0]?.id ?? candidate.slot;
  const classId = effectiveActorClassId(project, session, actor.id);
  const rawEquipment = session.actorEquipment[actor.id];
  const currentEquipment = effectiveActorEquipment(project, actor, rawEquipment, classId);
  const normalizedActor = normalizeActorRecord(actor);
  const statInput = {
    level: clampLevel(session.actorLevels[actor.id] ?? normalizedActor.initialLevel),
    classOverrides: session.classOverrides,
    growthProgress: session.growthProgress,
    promotionLineage: session.promotionLineage,
    paramBonuses: session.actorParamBonuses?.[actor.id],
  };
  const current = actorDerivedStats(project, normalizedActor, { ...statInput, equipment: currentEquipment });
  const selection: SelectedPreview = { targets, actorId: actor.id, slot, currentEquipment };
  const inventory = { ...session.inventory, [candidate.id]: (session.inventory[candidate.id] ?? 0) + 1 };
  const transition = transitionActorEquipment({
    project, actorId: actor.id, classId, slot, equipmentId: candidate.id,
    // Do not pass the effective projection: it can hide a displaced cursed shield.
    equipment: rawEquipment, inventory,
  });
  if (transition.kind === "rejected") {
    return { ...selection, kind: "blocked", reason: transition.reason,
      stats: STAT_KEYS.map(key => ({ key, current: current[key] })) };
  }
  const nextEquipment = effectiveActorEquipment(project, actor, transition.equipment, classId);
  const next = actorDerivedStats(project, normalizedActor, { ...statInput, equipment: nextEquipment });
  // Returned inventory is the authority for actual displacement, including raw hand
  // combinations hidden by the stat projection. Logical IDs exclude two-hand mirrors.
  const displaced = [...new Set(logicalEquipmentIds(project, rawEquipment ?? actor.initialEquipment))].flatMap(id => {
    const count = (transition.inventory[id] ?? 0) - (inventory[id] ?? 0);
    return count > 0 ? [{ id, count }] : [];
  });
  return {
    ...selection, kind: "ready", nextEquipment, displaced,
    stats: STAT_KEYS.map(key => ({ key, current: current[key], next: next[key], delta: next[key] - current[key] })),
    sameEquipment: displaced.length === 0
      && Object.keys(currentEquipment).length === Object.keys(nextEquipment).length
      && Object.entries(currentEquipment).every(([slot, id]) => nextEquipment[slot] === id),
    effects: compareEffects(current.equipmentEffects, next.equipmentEffects),
  };
}

function compareEffects(current: EquipmentRuntimeEffects, next: EquipmentRuntimeEffects): ShopEquipmentEffectDiff {
  const gained: ShopEquipmentEffect[] = [];
  const lost: ShopEquipmentEffect[] = [];
  const changed: ShopEquipmentEffectChange[] = [];
  for (const key of BOOLEAN_EFFECT_KEYS) {
    if (Boolean(current[key]) === Boolean(next[key])) continue;
    (next[key] ? gained : lost).push({ key });
  }
  for (const key of SET_EFFECT_KEYS) {
    const before = new Set(current[key] ?? []);
    const after = new Set(next[key] ?? []);
    for (const id of after) if (!before.has(id)) gained.push({ key, id });
    for (const id of before) if (!after.has(id)) lost.push({ key, id });
  }
  for (const key of NUMBER_EFFECT_KEYS) {
    const before = current[key] ?? (key === "accuracy" ? 100 : 0);
    const after = next[key] ?? (key === "accuracy" ? 100 : 0);
    if (before !== after) changed.push({ key, current: before, next: after, delta: after - before });
  }
  if (current.stateDefenseMode !== next.stateDefenseMode) {
    changed.push({ key: "stateDefenseMode", current: current.stateDefenseMode, next: next.stateDefenseMode });
  }
  return { gained, lost, changed };
}
