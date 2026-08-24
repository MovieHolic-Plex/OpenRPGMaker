import { actorDerivedStats, learnedSkillIds } from "@/battle/battleBattlers";
import { ACTOR_PARAMETER_KEYS, clampLevel, normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { canEquip, effectiveActorEquipment, equipmentSlotAccepts } from "@/project/equipmentRules";
import type {
  ActorInitialEquipment,
  ActorParameterKey,
  ClassId,
  EquipmentRecord,
  Project,
} from "@/project/types";

export type ActorBuildGrowthSource = "actor-base" | "class-override";

export type ActorBuildPreview = {
  readonly actorId: string;
  readonly level: number;
  readonly naturalMaxLevel: number;
  readonly assignedClass?: { readonly id: string; readonly name: string };
  readonly effectiveClass?: { readonly id: string; readonly name: string };
  readonly growth: {
    readonly source: ActorBuildGrowthSource;
    readonly id: string;
    readonly name: string;
  };
  readonly stats: Readonly<Record<ActorParameterKey, { readonly value: number; readonly equipmentBonus: number }>>;
  readonly equipment: readonly {
    readonly slot: keyof ActorInitialEquipment;
    readonly id: string;
    readonly name: string;
  }[];
  readonly skills: readonly { readonly id: string; readonly name: string }[];
  readonly referenceWarnings: readonly ActorBuildReferenceWarning[];
};

export type ActorBuildReferenceWarning =
  | {
      readonly kind: "equipment";
      readonly id: string;
      readonly slot: keyof ActorInitialEquipment;
      readonly reason: "missing" | "invalid-slot" | "not-effective";
    }
  | {
      readonly kind: "skill";
      readonly id: string;
      readonly reason: "missing";
    };

export type ClassBuildRole = "balanced" | "striker" | "guardian" | "caster" | "agile";

export type ClassBuildSummary = {
  readonly classId: ClassId;
  readonly role: ClassBuildRole;
  readonly actorIds: readonly string[];
  readonly skillCount: number;
  readonly commandCount: number;
  readonly equipmentCount: number;
  readonly promotionCount: number;
};

const CLASS_ROLE_LEVEL = 20;
const EQUIPMENT_SLOTS = ["weapon", "shield", "armor", "helmet", "accessory"] as const satisfies readonly (keyof ActorInitialEquipment)[];

/**
 * Builds the editor preview through the same derived-stat and learned-skill
 * authorities used when an actor battler is created. No combat formula lives here.
 */
export function actorBuildPreview(
  project: Project,
  actorId: string,
  requestedLevel: number,
  options: { readonly classOverrideId?: ClassId } = {},
): ActorBuildPreview | null {
  const sourceActor = project.database.actors.find((entry) => entry.id === actorId);
  if (!sourceActor) return null;
  const actor = normalizeActorRecord(sourceActor);
  const level = clampLevel(requestedLevel);
  const classOverrides = options.classOverrideId ? { [actor.id]: options.classOverrideId } : undefined;
  const withoutEquipment = actorDerivedStats(project, actor, {
    level,
    classOverrides,
    equipment: {},
  });
  const equipment = effectiveActorEquipment(
    project,
    actor,
    actor.initialEquipment,
    withoutEquipment.effectiveClassId ?? actor.classId,
  );
  const derived = actorDerivedStats(project, actor, {
    level,
    classOverrides,
    equipment,
  });
  const assignedClass = project.database.classes.find((entry) => entry.id === actor.classId);
  const effectiveClass = project.database.classes.find((entry) => entry.id === derived.effectiveClassId);
  const skillIds = learnedSkillIds(
    project,
    actor,
    level,
    undefined,
    derived.effectiveClassId,
    derived.usesOverrideCurves,
  );
  const growthSource = derived.usesOverrideCurves && effectiveClass
    ? { source: "class-override" as const, id: effectiveClass.id, name: effectiveClass.name }
    : { source: "actor-base" as const, id: actor.id, name: actor.name };

  const skills = skillIds.flatMap((skillId) => {
    const skill = project.database.skills.find((entry) => entry.id === skillId);
    return skill ? [{ id: skill.id, name: skill.name }] : [];
  });

  return {
    actorId: actor.id,
    level,
    naturalMaxLevel: actor.maxLevel,
    assignedClass: assignedClass ? { id: assignedClass.id, name: assignedClass.name } : undefined,
    effectiveClass: effectiveClass ? { id: effectiveClass.id, name: effectiveClass.name } : undefined,
    growth: growthSource,
    stats: statPreview(derived, withoutEquipment),
    equipment: equipmentPreview(project, equipment),
    skills,
    referenceWarnings: [
      ...equipmentReferenceWarnings(project, actor, actor.initialEquipment, equipment, withoutEquipment.effectiveClassId ?? actor.classId),
      ...skillIds.filter((skillId) => !project.database.skills.some((entry) => entry.id === skillId)).map((id) => ({
        kind: "skill" as const,
        id,
        reason: "missing" as const,
      })),
    ],
  };
}

export function classBuildSummary(project: Project, classId: ClassId): ClassBuildSummary | null {
  const record = project.database.classes.find((entry) => entry.id === classId);
  if (!record) return null;
  const actors = project.database.actors.filter((actor) => actor.classId === classId);
  return {
    classId,
    role: classRoleAtLevel(record.parameterCurves, CLASS_ROLE_LEVEL),
    actorIds: actors.map((actor) => actor.id),
    skillCount: record.learnedSkills.length,
    commandCount: record.battleCommands.length,
    equipmentCount: project.database.equipment.filter((equipment) =>
      classAllowsEquipment(record, equipment, classId)
      || actors.some((actor) => canEquip(project, actor, equipment, classId))
    ).length,
    promotionCount: record.promotions?.length ?? 0,
  };
}

function classAllowsEquipment(
  record: Project["database"]["classes"][number],
  equipment: EquipmentRecord,
  classId: ClassId,
): boolean {
  return equipment.equippableClassIds.includes(classId)
    || record.equipmentPermissions.classIds.includes(classId)
    || record.equipmentPermissions.equipmentIds.includes(equipment.id);
}

function statPreview(
  derived: ReturnType<typeof actorDerivedStats>,
  withoutEquipment: ReturnType<typeof actorDerivedStats>,
): ActorBuildPreview["stats"] {
  return Object.fromEntries(ACTOR_PARAMETER_KEYS.map((key) => [
    key,
    { value: derived[key], equipmentBonus: derived[key] - withoutEquipment[key] },
  ])) as ActorBuildPreview["stats"];
}

function equipmentPreview(project: Project, equipment: ActorInitialEquipment): ActorBuildPreview["equipment"] {
  const byId = new Map<string, EquipmentRecord>(project.database.equipment.map((record) => [record.id, record]));
  return EQUIPMENT_SLOTS.flatMap((slot) => {
    const id = equipment[slot];
    if (!id) return [];
    return [{ slot, id, name: byId.get(id)?.name ?? id }];
  });
}

function equipmentReferenceWarnings(
  project: Project,
  actor: ReturnType<typeof normalizeActorRecord>,
  requested: ActorInitialEquipment,
  effective: ActorInitialEquipment,
  classId: string,
): ActorBuildReferenceWarning[] {
  const byId = new Map(project.database.equipment.map((record) => [record.id, record]));
  const warnings: ActorBuildReferenceWarning[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const id = requested[slot];
    if (!id) continue;
    const record = byId.get(id);
    if (!record) {
      warnings.push({ kind: "equipment", id, slot, reason: "missing" });
      continue;
    }
    if (!equipmentSlotAccepts(project, actor, slot, record, classId)) {
      warnings.push({ kind: "equipment", id, slot, reason: "invalid-slot" });
      continue;
    }
    if (effective[slot] !== id) {
      warnings.push({ kind: "equipment", id, slot, reason: "not-effective" });
    }
  }
  return warnings;
}

function classRoleAtLevel(
  curves: Project["database"]["classes"][number]["parameterCurves"],
  level: number,
): ClassBuildRole {
  const candidates: readonly { readonly role: Exclude<ClassBuildRole, "balanced">; readonly value: number }[] = [
    { role: "striker", value: parameterValueAtLevel(curves.attack, level) },
    { role: "guardian", value: parameterValueAtLevel(curves.defense, level) },
    { role: "caster", value: parameterValueAtLevel(curves.mind, level) },
    { role: "agile", value: parameterValueAtLevel(curves.agility, level) },
  ];
  const sorted = [...candidates].sort((left, right) => right.value - left.value);
  if (!sorted[0] || sorted[0].value === sorted[1]?.value) return "balanced";
  return sorted[0].role;
}
