import type { ActorRecord, EquipmentRecord, Project } from "@/project/types";

export function canEquip(project: Project, actor: ActorRecord, equipment: EquipmentRecord): boolean {
  const classRecord = project.database.classes.find((record) => record.id === actor.classId);
  return (
    equipment.equippableActorIds.includes(actor.id) ||
    equipment.equippableClassIds.includes(actor.classId) ||
    Boolean(classRecord?.equipmentPermissions.actorIds.includes(actor.id)) ||
    Boolean(classRecord?.equipmentPermissions.classIds.includes(actor.classId)) ||
    Boolean(classRecord?.equipmentPermissions.equipmentIds.includes(equipment.id))
  );
}
