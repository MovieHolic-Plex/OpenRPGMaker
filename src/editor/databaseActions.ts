import { addSwitch, addVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { duplicateInto } from "@/editor/databaseCopy";
import { databaseRecordPrefix, databaseReferenceMessage } from "@/editor/databaseReferences";
import { updateClassRecord, updateEnemyRecord, updateEquipmentRecord, updateItemRecord, updateSkillRecord, updateTroopRecord } from "@/editor/databaseRecordMutators";
import { createActorRecord, normalizeActorPatch } from "@/project/actorModel";
import {
  normalizeClassRecord,
  normalizeEnemyRecord,
  normalizeEquipmentRecord,
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeTroopRecord,
} from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { genId } from "@/util/id";
import type {
  ActorRecord,
  BattleAnimationRecord,
  ClassRecord,
  DatabaseRecords,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  SkillRecord,
  StateRecord,
  TroopRecord,
} from "@/project/types";

export type DatabaseCollection = keyof DatabaseRecords;
export type DeleteResult = { ok: true } | { ok: false; message: string };
export type DatabasePatch =
  | Partial<ActorRecord>
  | Partial<ClassRecord>
  | Partial<SkillRecord>
  | Partial<ItemRecord>
  | Partial<EquipmentRecord>
  | Partial<EnemyRecord>
  | Partial<TroopRecord>
  | Partial<StateRecord>
  | Partial<BattleAnimationRecord>;

export function addDatabaseRecord(collection: DatabaseCollection): string {
  const id = genId(databaseRecordPrefix(collection));
  store.update((project) => {
    switch (collection) {
      case "actors":
        project.database.actors.push(
          createActorRecord(id, project.database.classes[0]?.id ?? "", {
            characterResourceId: project.database.actors[0]?.characterResourceId,
            battleCharacterResourceId: project.database.actors[0]?.battleCharacterResourceId,
            defaultEquipmentId: project.database.equipment.find((entry) => entry.slot === "weapon")?.id,
            unarmedAnimationId: project.database.battleAnimations[0]?.id,
          })
        );
        return;
      case "classes":
        project.database.classes.push(normalizeClassRecord({ id, name: "새 직업", skillIds: [] }));
        return;
      case "skills":
        project.database.skills.push(normalizeSkillRecord({ id, name: "새 스킬", scope: "enemy", power: 10 }));
        return;
      case "items":
        project.database.items.push(normalizeItemRecord({ id, name: "새 아이템", scope: "ally", price: 0 }));
        return;
      case "equipment":
        project.database.equipment.push(normalizeEquipmentRecord({ id, name: "새 장비", slot: "weapon", price: 0 }));
        return;
      case "enemies":
        project.database.enemies.push(normalizeEnemyRecord({ id, name: "새 몬스터", skillIds: [] }));
        return;
      case "troops":
        project.database.troops.push(normalizeTroopRecord({ id, name: "새 적 그룹", enemyIds: [], battleEventPages: [] }));
        return;
      case "states":
        project.database.states.push({ id, name: "새 상태" });
        return;
      case "battleAnimations":
        project.database.battleAnimations.push({ id, name: "새 애니메이션" });
        return;
    }
  });
  return id;
}

export function updateDatabaseRecord(collection: DatabaseCollection, id: string, patch: DatabasePatch): void {
  store.update((project) => {
    switch (collection) {
      case "actors": {
        const record = project.database.actors.find((entry) => entry.id === id);
        if (!record) return;
        const actorPatch = normalizeActorPatch(patch);
        if ("name" in actorPatch && actorPatch.name !== undefined) record.name = actorPatch.name;
        if ("nickname" in actorPatch && actorPatch.nickname !== undefined) record.nickname = actorPatch.nickname;
        if ("classId" in actorPatch && actorPatch.classId !== undefined) record.classId = actorPatch.classId;
        if ("initialLevel" in actorPatch && actorPatch.initialLevel !== undefined) record.initialLevel = actorPatch.initialLevel;
        if ("maxLevel" in actorPatch && actorPatch.maxLevel !== undefined) {
          record.maxLevel = Math.max(record.initialLevel, actorPatch.maxLevel);
        }
        if ("faceResourceId" in actorPatch) record.faceResourceId = actorPatch.faceResourceId;
        if ("characterResourceId" in actorPatch) record.characterResourceId = actorPatch.characterResourceId;
        if ("characterTransparent" in actorPatch && actorPatch.characterTransparent !== undefined) {
          record.characterTransparent = actorPatch.characterTransparent;
        }
        if ("battleCharacterResourceId" in actorPatch) record.battleCharacterResourceId = actorPatch.battleCharacterResourceId;
        if ("critical" in actorPatch && actorPatch.critical !== undefined) record.critical = actorPatch.critical;
        if ("parameterCurves" in actorPatch && actorPatch.parameterCurves !== undefined) record.parameterCurves = actorPatch.parameterCurves;
        if ("expCurve" in actorPatch && actorPatch.expCurve !== undefined) record.expCurve = actorPatch.expCurve;
        if ("initialEquipment" in actorPatch && actorPatch.initialEquipment !== undefined) record.initialEquipment = actorPatch.initialEquipment;
        if ("unarmedAnimationId" in actorPatch) record.unarmedAnimationId = actorPatch.unarmedAnimationId;
        if ("options" in actorPatch && actorPatch.options !== undefined) record.options = actorPatch.options;
        if ("learnedSkills" in actorPatch && actorPatch.learnedSkills !== undefined) record.learnedSkills = actorPatch.learnedSkills;
        if ("stateRates" in actorPatch && actorPatch.stateRates !== undefined) record.stateRates = actorPatch.stateRates;
        if ("elementRates" in actorPatch && actorPatch.elementRates !== undefined) record.elementRates = actorPatch.elementRates;
        return;
      }
      case "classes": {
        updateClassRecord(project.database, id, patch);
        return;
      }
      case "skills": {
        updateSkillRecord(project.database, id, patch);
        return;
      }
      case "items": {
        updateItemRecord(project.database, id, patch);
        return;
      }
      case "equipment": {
        updateEquipmentRecord(project.database, id, patch);
        return;
      }
      case "enemies": {
        updateEnemyRecord(project.database, id, patch);
        return;
      }
      case "troops": {
        updateTroopRecord(project.database, id, patch);
        return;
      }
      case "states": {
        const record = project.database.states.find((entry) => entry.id === id);
        if (record && "name" in patch && patch.name !== undefined) record.name = patch.name;
        return;
      }
      case "battleAnimations": {
        const record = project.database.battleAnimations.find((entry) => entry.id === id);
        if (!record) return;
        if ("name" in patch && patch.name !== undefined) record.name = patch.name;
        if ("resourceId" in patch) record.resourceId = patch.resourceId;
        return;
      }
    }
  });
}

export function duplicateDatabaseRecord(collection: DatabaseCollection, id: string): string {
  const copyId = genId(databaseRecordPrefix(collection));
  store.update((project) => {
    switch (collection) {
      case "actors":
        duplicateInto(project.database.actors, id, copyId);
        return;
      case "classes":
        duplicateInto(project.database.classes, id, copyId);
        return;
      case "skills":
        duplicateInto(project.database.skills, id, copyId);
        return;
      case "items":
        duplicateInto(project.database.items, id, copyId);
        return;
      case "equipment":
        duplicateInto(project.database.equipment, id, copyId);
        return;
      case "enemies":
        duplicateInto(project.database.enemies, id, copyId);
        return;
      case "troops":
        duplicateInto(project.database.troops, id, copyId);
        return;
      case "states":
        duplicateInto(project.database.states, id, copyId);
        return;
      case "battleAnimations":
        duplicateInto(project.database.battleAnimations, id, copyId);
        return;
    }
  });
  return copyId;
}

export function deleteDatabaseRecord(collection: DatabaseCollection, id: string): DeleteResult {
  const message = databaseReferenceMessage(collection, id);
  if (message) return { ok: false, message };
  store.update((project) => {
    switch (collection) {
      case "actors":
        project.database.actors = project.database.actors.filter((entry) => entry.id !== id);
        return;
      case "classes":
        project.database.classes = project.database.classes.filter((entry) => entry.id !== id);
        return;
      case "skills":
        project.database.skills = project.database.skills.filter((entry) => entry.id !== id);
        return;
      case "items":
        project.database.items = project.database.items.filter((entry) => entry.id !== id);
        return;
      case "equipment":
        project.database.equipment = project.database.equipment.filter((entry) => entry.id !== id);
        return;
      case "enemies":
        project.database.enemies = project.database.enemies.filter((entry) => entry.id !== id);
        return;
      case "troops":
        project.database.troops = project.database.troops.filter((entry) => entry.id !== id);
        return;
      case "states":
        project.database.states = project.database.states.filter((entry) => entry.id !== id);
        return;
      case "battleAnimations":
        project.database.battleAnimations = project.database.battleAnimations.filter((entry) => entry.id !== id);
        return;
    }
  });
  return { ok: true };
}

export function bulkRenameSwitches(start: number, count: number, prefix: string): void {
  bulkRename(start, count, prefix, "switch");
}

export function bulkRenameVariables(start: number, count: number, prefix: string): void {
  bulkRename(start, count, prefix, "variable");
}

function bulkRename(start: number, count: number, prefix: string, kind: "switch" | "variable"): void {
  for (let offset = 0; offset < count; offset++) {
    const number = start + offset;
    const label = `${prefix} ${number.toString().padStart(4, "0")}`;
    const list = kind === "switch" ? store.getCurrent().switches : store.getCurrent().variables;
    const existing = list[number - 1];
    if (existing) {
      if (kind === "switch") renameSwitch(existing.id, label);
      else renameVariable(existing.id, label);
    } else if (kind === "switch") {
      addSwitch(label);
    } else {
      addVariable(label);
    }
  }
}
