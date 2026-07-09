import type { ActorRecord, EquipmentRecord, Project } from "@/project/types";

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
