import type { ActorInitialEquipment, ActorRecord, EquipmentRecord, Project } from "@/project/types";

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

const EQUIPMENT_SLOTS = ["weapon", "shield", "armor", "helmet", "accessory"] as const satisfies readonly EquipmentSlot[];

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
  const dualWield = actor.options.dualWield
    || Boolean(project.database.classes.find((record) => record.id === classId)?.options.dualWield);

  for (const slot of EQUIPMENT_SLOTS) {
    const id = source[slot];
    const record = id ? records.get(id) : undefined;
    if (!record) continue;
    if (record.slot === slot || (slot === "shield" && dualWield && record.slot === "weapon" && !record.twoHanded)) {
      effective[slot] = record.id;
    }
  }

  const weapon = effective.weapon ? records.get(effective.weapon) : undefined;
  if (weapon?.twoHanded) effective.shield = weapon.id;
  return effective;
}

/** Pure, atomic equip/replace/unequip authority. Rejected transitions return no partial state. */
export function transitionActorEquipment(input: EquipmentTransitionInput): EquipmentTransitionResult {
  const { project } = input;
  const actor = project.database.actors.find((record) => record.id === input.actorId);
  if (!actor) return rejected("missingActor");

  const classId = input.classId ?? actor.classId;
  const classRecord = project.database.classes.find((record) => record.id === classId);
  if (actor.options.fixedEquipment || classRecord?.options.fixedEquipment) return rejected("fixedEquipment");

  const records = equipmentRecords(project);
  const current = strictActorEquipment(project, actor, input.equipment, classId);
  const requested = input.equipmentId ? records.get(input.equipmentId) : undefined;
  if (input.equipmentId && !requested) return rejected("missingEquipment");
  if (requested && !canEquip(project, actor, requested, classId)) return rejected("notEquippable");
  if (requested?.twoHanded && requested.slot !== "weapon") return rejected("invalidSlot");
  if (requested && !slotAccepts(actor, classRecord?.options.dualWield === true, input.slot, requested)) {
    return rejected("invalidSlot");
  }

  const next = { ...current };
  if (requested) equipInto(next, input.slot, requested, records);
  else unequipFrom(next, input.slot, records);

  const removedIds = removedLogicalEquipment(current, next, records);
  for (const id of removedIds) {
    const record = records.get(id);
    if (record?.cursed) return rejected("cursedEquipment");
    if (record?.effectFlags.fixedEquipment) return rejected("fixedEquipment");
  }

  const beforeCounts = logicalEquipmentCounts(current, records);
  const afterCounts = logicalEquipmentCounts(next, records);
  const inventory = normalizeInventory(input.inventory);
  const ids = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);
  for (const id of ids) {
    const delta = (afterCounts.get(id) ?? 0) - (beforeCounts.get(id) ?? 0);
    if (delta > (inventory[id] ?? 0)) return rejected("insufficientInventory");
  }
  for (const id of ids) {
    const delta = (afterCounts.get(id) ?? 0) - (beforeCounts.get(id) ?? 0);
    if (delta === 0) continue;
    inventory[id] = (inventory[id] ?? 0) - delta;
  }

  return { kind: "accepted", equipment: next, inventory };
}

function slotAccepts(actor: ActorRecord, classDualWield: boolean, slot: EquipmentSlot, record: EquipmentRecord): boolean {
  if (record.slot === slot) return true;
  return slot === "shield" && record.slot === "weapon" && !record.twoHanded
    && (actor.options.dualWield || classDualWield);
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
  before: ActorInitialEquipment,
  after: ActorInitialEquipment,
  records: ReadonlyMap<string, EquipmentRecord>
): readonly string[] {
  const beforeCounts = logicalEquipmentCounts(before, records);
  const afterCounts = logicalEquipmentCounts(after, records);
  return [...beforeCounts.keys()].filter((id) => (afterCounts.get(id) ?? 0) < (beforeCounts.get(id) ?? 0));
}

function logicalEquipmentCounts(
  equipment: ActorInitialEquipment,
  records: ReadonlyMap<string, EquipmentRecord>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of EQUIPMENT_SLOTS) {
    const id = equipment[slot];
    if (!id || !records.has(id)) continue;
    if (slot === "shield" && equipment.weapon === id && records.get(id)?.twoHanded) continue;
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
  const dualWield = actor.options.dualWield
    || Boolean(project.database.classes.find((record) => record.id === classId)?.options.dualWield);
  const current: ActorInitialEquipment = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const id = source[slot];
    const record = id ? records.get(id) : undefined;
    if (!record) continue;
    if (record.slot === slot || (slot === "shield" && dualWield && record.slot === "weapon" && !record.twoHanded)) {
      current[slot] = record.id;
    }
  }
  return current;
}
function equipmentRecords(project: Project): Map<string, EquipmentRecord> {
  return new Map(project.database.equipment.map((record) => [record.id, record]));
}

function normalizeInventory(inventory: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.entries(inventory).map(([id, count]) => [id, Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0]));
}

function rejected(reason: EquipmentTransitionFailureReason): EquipmentTransitionResult {
  return { kind: "rejected", reason };
}
