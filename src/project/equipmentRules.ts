import type { ActorInitialEquipment, ActorRecord, EquipmentRecord, Project } from "@/project/types";

import { equipmentSlots, hasEquipmentSlot } from "@/project/equipmentSlots";

export type EquipmentSlot = keyof ActorInitialEquipment;

export type EquipmentTransitionFailureReason =
  | "missingActor"
  | "missingEquipment"
  | "invalidSlot"
  | "notEquippable"
  | "fixedEquipment"
  | "cursedEquipment"
  | "insufficientInventory";

export type EquipmentTransitionResult =
  | {
      readonly kind: "accepted";
      readonly equipment: ActorInitialEquipment;
      readonly inventory: Record<string, number>;
    }
  | {
      readonly kind: "rejected";
      readonly reason: EquipmentTransitionFailureReason;
    };

export interface EquipmentTransitionInput {
  readonly project: Project;
  readonly actorId: string;
  readonly classId?: string;
  readonly equipment: ActorInitialEquipment | undefined;
  readonly inventory: Readonly<Record<string, number>>;
  readonly slot: EquipmentSlot;
  readonly equipmentId?: string;
}

export function canEquip(project: Project, actor: ActorRecord, equipment: EquipmentRecord, classId = actor.classId): boolean {
  const classRecord = project.database.classes.find((record) => record.id === classId);
  return (
    equipment.equippableActorIds.includes(actor.id) ||
    equipment.equippableClassIds.includes(classId) ||
    Boolean(classRecord?.equipmentPermissions.actorIds.includes(actor.id)) ||
    Boolean(classRecord?.equipmentPermissions.classIds.includes(classId)) ||
    Boolean(classRecord?.equipmentPermissions.equipmentIds.includes(equipment.id))
  );
}

export function equipmentSlotAccepts(
  project: Project,
  actor: ActorRecord,
  slot: EquipmentSlot,
  equipment: EquipmentRecord,
  classId = actor.classId
): boolean {
  if (!hasEquipmentSlot(project, slot) || !hasEquipmentSlot(project, equipment.slot)) return false;
  if (equipment.twoHanded && equipment.slot !== "weapon") return false;
  if (equipment.slot === slot) return true;
  const classDualWield = project.database.classes.find((record) => record.id === classId)?.options.dualWield === true;
  return slot === "shield" && equipment.slot === "weapon" && !equipment.twoHanded
    && (actor.options.dualWield || classDualWield);
}

/**
 * Produces the equipment projection used by save/bootstrap and runtime readers.
 * It never adjusts inventory: malformed or legacy hand combinations are represented
 * canonically for calculations only.
 */
export function effectiveActorEquipment(
  project: Project,
  actor: ActorRecord,
  equipment: ActorInitialEquipment | undefined,
  classId = actor.classId
): ActorInitialEquipment {
  const records = equipmentRecords(project);
  const source = equipment ?? actor.initialEquipment;
  const effective: ActorInitialEquipment = {};

  for (const { id: slot } of equipmentSlots(project)) {
    const id = source[slot];
    const record = id ? records.get(id) : undefined;
    if (!record) continue;
    if (equipmentSlotAccepts(project, actor, slot, record, classId)) {
      effective[slot] = record.id;
    }
  }

  const weapon = effective.weapon ? records.get(effective.weapon) : undefined;
  if (weapon?.twoHanded) effective.shield = weapon.id;
  return effective;
}

/** Projects physical equipment slots into logical items, excluding only a two-handed weapon's shield mirror. */
export function logicalEquipmentIds(project: Project, equipment: ActorInitialEquipment): string[] {
  const ids: string[] = [];
  for (const [slot, equipmentId] of Object.entries(equipment)) {
    if (!equipmentId) continue;
    if (slot === "shield" && equipment.weapon === equipmentId) {
      const record = project.database.equipment.find((entry) => entry.id === equipmentId);
      if (record?.twoHanded) continue;
    }
    ids.push(equipmentId);
  }
  return ids;
}

/** Pure, atomic equip/replace/unequip authority. Rejected transitions return no partial state. */
export function transitionActorEquipment(input: EquipmentTransitionInput): EquipmentTransitionResult {
  const { project } = input;
  if (!hasEquipmentSlot(project, input.slot)) return rejected("invalidSlot");
  const actor = project.database.actors.find((record) => record.id === input.actorId);
  if (!actor) return rejected("missingActor");

  const classId = input.classId && project.database.classes.some(c => c.id === input.classId) ? input.classId : actor.classId;
  const classRecord = project.database.classes.find((record) => record.id === classId);
  if (actor.options.fixedEquipment || classRecord?.options.fixedEquipment) return rejected("fixedEquipment");

  const records = equipmentRecords(project);
  const current = strictActorEquipment(project, actor, input.equipment, classId);
  const requested = input.equipmentId ? records.get(input.equipmentId) : undefined;
  if (input.equipmentId && !requested) return rejected("missingEquipment");
  if (requested && !canEquip(project, actor, requested, classId)) return rejected("notEquippable");
  if (requested?.twoHanded && requested.slot !== "weapon") return rejected("invalidSlot");
  if (requested && !equipmentSlotAccepts(project, actor, input.slot, requested, classId)) {
    return rejected("invalidSlot");
  }

  const next = { ...current };
  if (requested) equipInto(next, input.slot, requested, records);
  else unequipFrom(next, input.slot, records);

  const removedIds = removedLogicalEquipment(project, current, next);
  for (const id of removedIds) {
    const record = records.get(id);
    if (record?.cursed) return rejected("cursedEquipment");
    if (record?.effectFlags.fixedEquipment) return rejected("fixedEquipment");
  }

  const beforeCounts = logicalEquipmentCounts(project, current);
  const afterCounts = logicalEquipmentCounts(project, next);
  const inventory = normalizeInventory(input.inventory);
  const ids = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);
  for (const id of ids) {
    const delta = (afterCounts.get(id) ?? 0) - (beforeCounts.get(id) ?? 0);
    if (delta > (inventory[id] ?? 0)) return rejected("insufficientInventory");
  }
  for (const id of ids) {
    const delta = (afterCounts.get(id) ?? 0) - (beforeCounts.get(id) ?? 0);
    if (delta === 0) continue;
    const count = (inventory[id] ?? 0) - delta;
    if (count > 0) inventory[id] = count;
    else delete inventory[id];
  }

  return { kind: "accepted", equipment: next, inventory };
}


function equipInto(
  next: ActorInitialEquipment,
  requestedSlot: EquipmentSlot,
  record: EquipmentRecord,
  records: ReadonlyMap<string, EquipmentRecord>
): void {
  if (record.twoHanded) {
    next.weapon = record.id;
    next.shield = record.id;
    return;
  }

  if (requestedSlot === "weapon" || requestedSlot === "shield") {
    const occupyingWeapon = next.weapon ? records.get(next.weapon) : undefined;
    if (occupyingWeapon?.twoHanded) {
      delete next.weapon;
      delete next.shield;
    }
  }
  next[requestedSlot] = record.id;
}

function unequipFrom(
  next: ActorInitialEquipment,
  slot: EquipmentSlot,
  records: ReadonlyMap<string, EquipmentRecord>
): void {
  const id = next[slot];
  if (!id) return;
  const record = records.get(id);
  if (record?.twoHanded && (slot === "weapon" || slot === "shield")) {
    delete next.weapon;
    delete next.shield;
    return;
  }
  delete next[slot];
}

function removedLogicalEquipment(
  project: Project,
  before: ActorInitialEquipment,
  after: ActorInitialEquipment
): readonly string[] {
  const beforeCounts = logicalEquipmentCounts(project, before);
  const afterCounts = logicalEquipmentCounts(project, after);
  return [...beforeCounts.keys()].filter((id) => (afterCounts.get(id) ?? 0) < (beforeCounts.get(id) ?? 0));
}

function logicalEquipmentCounts(project: Project, equipment: ActorInitialEquipment): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of logicalEquipmentIds(project, equipment)) {
    if (!project.database.equipment.some((record) => record.id === id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function strictActorEquipment(
  project: Project,
  actor: ActorRecord,
  equipment: ActorInitialEquipment | undefined,
  classId: string
): ActorInitialEquipment {
  const records = equipmentRecords(project);
  const source = equipment ?? actor.initialEquipment;
  const current: ActorInitialEquipment = {};
  for (const { id: slot } of equipmentSlots(project)) {
    const id = source[slot];
    const record = id ? records.get(id) : undefined;
    if (!record) continue;
    if (equipmentSlotAccepts(project, actor, slot, record, classId)) {
      current[slot] = record.id;
    }
  }
  return current;
}
function equipmentRecords(project: Project): Map<string, EquipmentRecord> {
  return new Map(project.database.equipment.map((record) => [record.id, record]));
}

function normalizeInventory(inventory: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(inventory)
      .map(([id, count]) => [id, Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0] as const)
      .filter(([, count]) => count > 0)
  );
}

function rejected(reason: EquipmentTransitionFailureReason): EquipmentTransitionResult {
  return { kind: "rejected", reason };
}
