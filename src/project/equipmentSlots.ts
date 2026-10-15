import type { EquipmentSlotRecord, Project } from "@/project/types";
import { genId } from "@/util/id";

/** Built-in IDs are engine semantics; labels are project-authored presentation. */
export const BUILTIN_EQUIPMENT_SLOTS: readonly EquipmentSlotRecord[] = [
  { id: "weapon", label: "무기" },
  { id: "shield", label: "방패" },
  { id: "helmet", label: "머리" },
  { id: "armor", label: "몸" },
  { id: "accessory", label: "장신구" },
];

export function isEquipmentSlotId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value)
    && value !== "__proto__" && value !== "constructor" && value !== "prototype";
}

/** Missing catalog means the legacy five slots. Authored built-ins override labels, never semantics. */
export function equipmentSlots(project: Project): readonly EquipmentSlotRecord[] {
  const authored = project.database.equipmentSlots ?? [];
  return [
    ...BUILTIN_EQUIPMENT_SLOTS.map((slot) => authored.find((entry) => entry.id === slot.id) ?? slot),
    ...authored.filter((slot) => !BUILTIN_EQUIPMENT_SLOTS.some((entry) => entry.id === slot.id)),
  ];
}

export function equipmentSlotLabel(project: Project, id: string): string {
  return equipmentSlots(project).find((slot) => slot.id === id)?.label ?? id;
}

export function hasEquipmentSlot(project: Project, id: string): boolean {
  return equipmentSlots(project).some((slot) => slot.id === id);
}

/** 이 칸이 대신 받아 주는 장비 부위(EquipmentSlotRecord.equipsAs). 없는 칸·자기 자신을 가리키는 값은 undefined. */
export function equipsAsSlot(project: Project, id: string): string | undefined {
  const target = equipmentSlots(project).find((slot) => slot.id === id)?.equipsAs;
  return target && target !== id && hasEquipmentSlot(project, target) ? target : undefined;
}

/**
 * 도구·스크립트용: id 를 지정해 칸을 만들거나(없으면) 이름·equipsAs 를 고친다. 기본 5칸의 id 는 의미가 고정이라
 * 이름만 바꿀 수 있다. equipsAs 를 비우려면 `null`. 반환 값은 "added" | "updated". 잘못된 입력은 Error.
 */
export function upsertEquipmentSlot(project: Project, input: { id: string; label: string; equipsAs?: string | null }): "added" | "updated" {
  if (!isEquipmentSlotId(input.id)) throw new Error(`Invalid equipment slot id: ${input.id}`);
  const label = requireLabel(input.label);
  const builtin = BUILTIN_EQUIPMENT_SLOTS.some((slot) => slot.id === input.id);
  const existed = hasEquipmentSlot(project, input.id);
  const equipsAs = input.equipsAs ?? undefined;
  if (equipsAs !== undefined) {
    if (builtin) throw new Error(`기본 부위(${input.id})는 equipsAs 를 가질 수 없습니다`);
    if (equipsAs === input.id) throw new Error(`equipsAs 는 자기 자신이 될 수 없습니다: ${input.id}`);
    if (!hasEquipmentSlot(project, equipsAs)) throw new Error(`Unknown equipment slot: ${equipsAs}`);
  }
  const slots = project.database.equipmentSlots ?? [];
  const current = slots.find((slot) => slot.id === input.id);
  const keepEquipsAs = input.equipsAs === undefined ? current?.equipsAs : equipsAs;
  const record: EquipmentSlotRecord = { id: input.id, label, ...(keepEquipsAs ? { equipsAs: keepEquipsAs } : {}) };
  project.database.equipmentSlots = current ? slots.map((slot) => slot.id === input.id ? record : slot) : [...slots, record];
  return existed ? "updated" : "added";
}

/** Mutators operate on an editor draft. Call inside store.update with an activity label. */
export function addEquipmentSlot(project: Project, label: string): EquipmentSlotRecord {
  const slot = { id: genId("slot"), label: requireLabel(label) };
  project.database.equipmentSlots = [...(project.database.equipmentSlots ?? []), slot];
  return slot;
}

export function renameEquipmentSlot(project: Project, id: string, label: string): void {
  if (!hasEquipmentSlot(project, id)) throw new Error(`Unknown equipment slot: ${id}`);
  const renamed = { id, label: requireLabel(label) };
  const slots = project.database.equipmentSlots ?? [];
  project.database.equipmentSlots = slots.some((slot) => slot.id === id)
    ? slots.map((slot) => slot.id === id ? renamed : slot)
    : [...slots, renamed];
}

export function equipmentSlotRemovalBlocker(project: Project, id: string): "builtin" | "referenced" | "missing" | undefined {
  if (BUILTIN_EQUIPMENT_SLOTS.some((slot) => slot.id === id)) return "builtin";
  if (!hasEquipmentSlot(project, id)) return "missing";
  if (project.database.equipment.some((record) => record.slot === id)
    || project.database.actors.some((actor) => actor.initialEquipment[id] !== undefined)
    || referencesSlotCommand(project.maps, id)
    || referencesSlotCommand(project.commonEvents, id)
    || referencesSlotCommand(project.database.troops, id)) return "referenced";
  return undefined;
}

export function removeEquipmentSlot(project: Project, id: string): boolean {
  if (equipmentSlotRemovalBlocker(project, id)) return false;
  project.database.equipmentSlots = (project.database.equipmentSlots ?? []).filter((slot) => slot.id !== id);
  return true;
}

// Include nested branches and editor drafts: neither may be left with a dangling slot.
function referencesSlotCommand(value: unknown, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (record.kind === "changeEquipment" && record.slot === id)
    || Object.values(record).some((entry) => referencesSlotCommand(entry, id));
}

function requireLabel(label: string): string {
  if (!label.trim()) throw new Error("Equipment slot label must not be blank");
  return label.trim();
}
