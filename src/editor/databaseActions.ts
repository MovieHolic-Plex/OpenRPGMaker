import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { duplicateInto } from "@/editor/databaseCopy";
import { retroChoreographyIdForClone } from "@/assets/retroSkillCatalog";
import { databaseRecordPrefix, databaseReferenceMessage } from "@/editor/databaseReferences";
import { updateClassRecord, updateEnemyRecord, updateEquipmentRecord, updateItemRecord, updateSkillRecord, updateTroopRecord } from "@/editor/databaseRecordMutators";
import { createActorRecord, normalizeActorPatch, normalizeActorRecord } from "@/project/actorModel";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { GENERATED_EFFECT_RESOURCE_IDS, GENERATED_EFFECT_SHEETS, generatedEffectDatabaseAnimationId } from "@/assets/generatedEffectSheets";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import {
  GENERATED_BATTLE_EFFECT_CLASS_BINDINGS,
  GENERATED_BATTLE_EFFECT_ITEM_BINDINGS,
  GENERATED_BATTLE_EFFECT_SKILL_BINDINGS,
  applyGeneratedBattleEffectActorBindings,
  applyGeneratedBattleEffectClassBindings,
  applyGeneratedBattleEffectItemBindings,
  applyGeneratedBattleEffectSkillBindings,
  countGeneratedBattleEffectActorBindingChanges,
  countGeneratedBattleEffectBindingChanges,
} from "@/project/defaults/generatedBattleEffectBindings";
import {
  normalizeClassRecord,
  normalizeEnemyRecord,
  normalizeEquipmentRecord,
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeStateRecord,
  normalizeTroopRecord,
} from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { canWriteTeamProject, TEAM_READ_ONLY_WRITE_MESSAGE } from "@/project/teamAccess";
import { genId } from "@/util/id";
import type {
  ActorRecord,
  BattleAnimationRecord,
  BattleAnimationPosition,
  BattleAnimationScope,
  ClassRecord,
  DatabaseRecords,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  Project,
  SkillRecord,
  StateRecord,
  TroopRecord,
} from "@/project/types";

export type DatabaseCollection = keyof DatabaseRecords;
export type DeleteResult = { ok: true } | { ok: false; message: string };
export type GeneratedBattleEffectPackStatus = {
  readonly totalAnimations: number;
  readonly missingAnimations: number;
  readonly outdatedAnimations: number;
  readonly actorBindings: number;
  readonly classBindings: number;
  readonly skillBindings: number;
  readonly itemBindings: number;
};
export type GeneratedBattleEffectInstallResult = {
  readonly addedAnimations: number;
  readonly updatedAnimations: number;
  readonly updatedActors: number;
  readonly updatedClasses: number;
  readonly updatedSkills: number;
  readonly updatedItems: number;
  readonly firstAnimationId: string;
};

const LEGACY_GENERATED_EFFECT_RESOURCES: Readonly<Record<string, string>> = {
  anim_magic: "easyrpg-battle-blow",
  anim_heal: "easyrpg-battle-blow",
  anim_poison: "easyrpg-battle-arrow",
};
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
  recordProjectSnapshot();
  store.update((project) => {
    switch (collection) {
      case "actors": {
        let classId = project.database.classes[0]?.id;
        if (!classId) {
          classId = genId(databaseRecordPrefix("classes"));
          project.database.classes.push(normalizeClassRecord({ id: classId, name: "새 직업", skillIds: [] }));
        }
        project.database.actors.push(
          createActorRecord(id, classId, {
            characterResourceId: project.database.actors[0]?.characterResourceId,
            battleCharacterResourceId: project.database.actors[0]?.battleCharacterResourceId,
            defaultEquipmentId: project.database.equipment.find((entry) => entry.slot === "weapon")?.id,
            unarmedAnimationId: project.database.battleAnimations[0]?.id,
          })
        );
        return;
      }
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
        project.database.states.push(normalizeStateRecord({ id, name: "새 상태" }));
        return;
      case "battleAnimations":
        project.database.battleAnimations.push(normalizeBattleAnimationRecord({ id, name: "새 애니메이션" }));
        return;
    }
  }, { scope: "database", collection });
  return id;
}

/**
 * Existing project storage projects intentionally do not receive defaults during load. This explicit action is the
 * non-destructive upgrade path: missing generated records are added, the three legacy aliases are upgraded when
 * they still point at old art, and only the known starter actor/class/skill/item ids receive curated bindings.
 */
export function installGeneratedBattleEffectPack(): GeneratedBattleEffectInstallResult {
  const status = generatedBattleEffectPackStatus();
  const firstAnimationId = generatedEffectDatabaseAnimationId(GENERATED_EFFECT_SHEETS[0]?.slug ?? "slash-steel");
  if (generatedBattleEffectPackPendingChanges(status) === 0) {
    return {
      addedAnimations: 0,
      updatedAnimations: 0,
      updatedActors: 0,
      updatedClasses: 0,
      updatedSkills: 0,
      updatedItems: 0,
      firstAnimationId,
    };
  }

  const defaults = generatedBattleAnimationDefaults();
  let addedAnimations = 0;
  let updatedAnimations = 0;
  let updatedActors = 0;
  let updatedClasses = 0;
  let updatedSkills = 0;
  let updatedItems = 0;
  recordProjectSnapshot();
  store.update((project) => {
    for (const defaultRecord of defaults) {
      const index = project.database.battleAnimations.findIndex((record) => record.id === defaultRecord.id);
      if (index < 0) {
        project.database.battleAnimations.push(defaultRecord);
        addedAnimations += 1;
        continue;
      }
      const existing = project.database.battleAnimations[index];
      if (!existing || !shouldUpgradeLegacyGeneratedEffect(existing)) continue;
      project.database.battleAnimations[index] = defaultRecord;
      updatedAnimations += 1;
    }
    updatedActors = applyGeneratedBattleEffectActorBindings(project.database.actors);
    updatedClasses = applyGeneratedBattleEffectClassBindings(project.database.classes);
    updatedSkills = applyGeneratedBattleEffectSkillBindings(project.database.skills);
    updatedItems = applyGeneratedBattleEffectItemBindings(project.database.items);
  }, { scope: "database", collection: "battleAnimations" });

  return {
    addedAnimations,
    updatedAnimations,
    updatedActors,
    updatedClasses,
    updatedSkills,
    updatedItems,
    firstAnimationId,
  };
}

export function generatedBattleEffectPackStatus(): GeneratedBattleEffectPackStatus {
  const project = store.getCurrent();
  const defaults = generatedBattleAnimationDefaults();
  let missingAnimations = 0;
  let outdatedAnimations = 0;
  for (const defaultRecord of defaults) {
    const existing = project.database.battleAnimations.find((record) => record.id === defaultRecord.id);
    if (!existing) missingAnimations += 1;
    else if (shouldUpgradeLegacyGeneratedEffect(existing)) outdatedAnimations += 1;
  }
  return {
    totalAnimations: defaults.length,
    missingAnimations,
    outdatedAnimations,
    actorBindings: countGeneratedBattleEffectActorBindingChanges(project.database.actors),
    classBindings: countGeneratedBattleEffectBindingChanges(
      project.database.classes,
      GENERATED_BATTLE_EFFECT_CLASS_BINDINGS,
    ),
    skillBindings: countGeneratedBattleEffectBindingChanges(
      project.database.skills,
      GENERATED_BATTLE_EFFECT_SKILL_BINDINGS,
    ),
    itemBindings: countGeneratedBattleEffectBindingChanges(
      project.database.items,
      GENERATED_BATTLE_EFFECT_ITEM_BINDINGS,
    ),
  };
}

export function generatedBattleEffectPackPendingChanges(status = generatedBattleEffectPackStatus()): number {
  return status.missingAnimations
    + status.outdatedAnimations
    + status.actorBindings
    + status.classBindings
    + status.skillBindings
    + status.itemBindings;
}

function generatedBattleAnimationDefaults(): BattleAnimationRecord[] {
  const generatedResourceIds = new Set(GENERATED_EFFECT_RESOURCE_IDS);
  return defaultBattleAnimationRecords().filter((record) => generatedResourceIds.has(record.resourceId ?? ""));
}

function shouldUpgradeLegacyGeneratedEffect(record: BattleAnimationRecord): boolean {
  return record.resourceId === LEGACY_GENERATED_EFFECT_RESOURCES[record.id];
}

export function updateDatabaseRecord(collection: DatabaseCollection, id: string, patch: DatabasePatch): void {
  // 텍스트/숫자 필드는 keystroke 마다 호출되므로, 같은 레코드의 같은 필드 편집은
  // 커밋 단위(1 스냅샷)로 병합한다. 필드가 바뀌면 키가 달라져 새 스냅샷이 남는다.
  recordCoalescedSnapshot(`db-update:${collection}:${id}:${Object.keys(patch).sort().join(",")}`);
  // `store.update` 가 아니라 `store.updateDatabase` 다 — 이 본문은 `project.database` 만 만지므로
  // 프로젝트 전체를 복제할 이유가 없다. 실측(2026-09-25): 이름 한 글자당 778ms(최대 1,392ms).
  store.updateDatabase(collection, (database) => {
    const project = { database } as Pick<Project, "database">;
    switch (collection) {
      case "actors": {
        const record = project.database.actors.find((entry) => entry.id === id);
        if (!record) return;
        const actorPatch = normalizeActorPatch(patch as Partial<ActorRecord>);
        if ("name" in actorPatch && actorPatch.name !== undefined) record.name = actorPatch.name;
        if ("nickname" in actorPatch && actorPatch.nickname !== undefined) record.nickname = actorPatch.nickname;
        if ("classId" in actorPatch && actorPatch.classId !== undefined) record.classId = actorPatch.classId;
        if ("initialLevel" in actorPatch && actorPatch.initialLevel !== undefined) record.initialLevel = actorPatch.initialLevel;
        if ("maxLevel" in actorPatch && actorPatch.maxLevel !== undefined) {
          record.maxLevel = Math.max(record.initialLevel, actorPatch.maxLevel);
        }
        if ("faceResourceId" in actorPatch) record.faceResourceId = actorPatch.faceResourceId;
        if ("appearanceId" in actorPatch) {
          if (actorPatch.appearanceId === undefined) delete record.appearanceId;
          else record.appearanceId = actorPatch.appearanceId;
        }
        if ("characterResourceId" in actorPatch) record.characterResourceId = actorPatch.characterResourceId;
        if ("characterIndex" in actorPatch) {
          if (actorPatch.characterIndex === undefined) delete record.characterIndex;
          else record.characterIndex = actorPatch.characterIndex;
        }
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
        if ("loadoutSlots" in actorPatch) {
          if (actorPatch.loadoutSlots === undefined) delete record.loadoutSlots;
          else record.loadoutSlots = actorPatch.loadoutSlots;
        }
        if ("battleCommandIds" in actorPatch) {
          if (actorPatch.battleCommandIds === undefined) delete record.battleCommandIds;
          else record.battleCommandIds = actorPatch.battleCommandIds;
        }
        Object.assign(record, normalizeActorRecord(record));
        return;
      }
      case "classes": {
        updateClassRecord(project.database, id, patch as Partial<ClassRecord>);
        return;
      }
      case "skills": {
        updateSkillRecord(project.database, id, patch as Partial<SkillRecord>);
        return;
      }
      case "items": {
        updateItemRecord(project.database, id, patch as Partial<ItemRecord>);
        return;
      }
      case "equipment": {
        updateEquipmentRecord(project.database, id, patch as Partial<EquipmentRecord>);
        return;
      }
      case "enemies": {
        updateEnemyRecord(project.database, id, patch as Partial<EnemyRecord>);
        return;
      }
      case "troops": {
        updateTroopRecord(project.database, id, patch as Partial<TroopRecord>);
        return;
      }
      case "states": {
        const record = project.database.states.find((entry) => entry.id === id);
        if (!record) return;
        if ("name" in patch && patch.name !== undefined) record.name = patch.name;
        if ("gen1MajorStatus" in patch) record.gen1MajorStatus = patch.gen1MajorStatus;
        if ("removalCondition" in patch) record.removalCondition = patch.removalCondition;
        if ("restriction" in patch) record.restriction = patch.restriction;
        if ("priority" in patch && patch.priority !== undefined) record.priority = patch.priority;
        if ("accuracyModifier" in patch && patch.accuracyModifier !== undefined) record.accuracyModifier = patch.accuracyModifier;
        if ("animationIndex" in patch && patch.animationIndex !== undefined) record.animationIndex = patch.animationIndex;
        if ("recoverNaturallyFromTurn" in patch && patch.recoverNaturallyFromTurn !== undefined) record.recoverNaturallyFromTurn = patch.recoverNaturallyFromTurn;
        if ("recoverNaturallyChance" in patch && patch.recoverNaturallyChance !== undefined) record.recoverNaturallyChance = patch.recoverNaturallyChance;
        if ("recoverWhenHitChance" in patch && patch.recoverWhenHitChance !== undefined) record.recoverWhenHitChance = patch.recoverWhenHitChance;
        if ("hpReleaseTurn" in patch && patch.hpReleaseTurn !== undefined) record.hpReleaseTurn = patch.hpReleaseTurn;
        if ("hpReleaseStep" in patch && patch.hpReleaseStep !== undefined) record.hpReleaseStep = patch.hpReleaseStep;
        if ("mpReleaseTurn" in patch && patch.mpReleaseTurn !== undefined) record.mpReleaseTurn = patch.mpReleaseTurn;
        if ("mpReleaseStep" in patch && patch.mpReleaseStep !== undefined) record.mpReleaseStep = patch.mpReleaseStep;
        if ("fieldStepInterval" in patch && patch.fieldStepInterval !== undefined) record.fieldStepInterval = patch.fieldStepInterval;
        if ("releaseAfterSteps" in patch && patch.releaseAfterSteps !== undefined) record.releaseAfterSteps = patch.releaseAfterSteps;
        if ("fieldStepCanKill" in patch && patch.fieldStepCanKill !== undefined) record.fieldStepCanKill = patch.fieldStepCanKill;
        if ("specialFlags" in patch) record.specialFlags = patch.specialFlags;
        if ("lockedParameters" in patch) record.lockedParameters = patch.lockedParameters;
        if ("emotion" in patch) {
          if (patch.emotion === undefined) delete record.emotion;
          else record.emotion = patch.emotion;
        }
        // runtimeEffects(전투 규칙 knob 5개)는 이 줄이 없으면 폼 입력이 조용히 버려졌다 —
        // normalizeStateRecord 는 이미 보존하므로 구멍은 이 뮤테이터 하나였다.
        // 부분 패치를 병합한다: 건드리지 않은 knob 은 undefined 로 남겨 온톨로지 폴백을 유지한다.
        if ("runtimeEffects" in patch) {
          record.runtimeEffects = patch.runtimeEffects
            ? { ...record.runtimeEffects, ...patch.runtimeEffects }
            : undefined;
        }
        Object.assign(record, normalizeStateRecord(record));
        return;
      }
      case "battleAnimations": {
        const record = project.database.battleAnimations.find((entry) => entry.id === id);
        if (!record) return;
        if ("name" in patch && patch.name !== undefined) record.name = patch.name;
        if ("resourceId" in patch) record.resourceId = patch.resourceId;
        if ("sheet" in patch && patch.sheet !== undefined) record.sheet = patch.sheet;
        if ("scope" in patch && isBattleAnimationScope(patch.scope)) record.scope = patch.scope;
        if ("position" in patch && isBattleAnimationPosition(patch.position)) record.position = patch.position;
        if ("large" in patch && patch.large !== undefined) record.large = patch.large;
        if ("frames" in patch && patch.frames !== undefined) record.frames = patch.frames;
        if ("timings" in patch && patch.timings !== undefined) record.timings = patch.timings;
        Object.assign(record, normalizeBattleAnimationRecord(record));
        return;
      }
    }
  }, { scope: "database", collection });
}

export function duplicateDatabaseRecord(collection: DatabaseCollection, id: string): string {
  const copyId = genId(databaseRecordPrefix(collection));
  recordProjectSnapshot();
  store.update((project) => {
    switch (collection) {
      case "actors":
        duplicateInto(project.database.actors, id, copyId);
        return;
      case "classes":
        duplicateInto(project.database.classes, id, copyId);
        return;
      case "skills": {
        duplicateInto(project.database.skills, id, copyId);
        // 계약 연출(id 로만 찾는다)을 사본이 이어받도록 원본의 계약 id 를 적어 둔다.
        const source = project.database.skills.find((entry) => entry.id === id);
        const copy = project.database.skills.find((entry) => entry.id === copyId);
        const borrowed = source ? retroChoreographyIdForClone(source) : undefined;
        if (copy && borrowed) copy.retroChoreographyId = borrowed;
        return;
      }
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
  }, { scope: "database", collection });
  return copyId;
}

export function deleteDatabaseRecord(collection: DatabaseCollection, id: string): DeleteResult {
  if (!canWriteTeamProject()) return { ok: false, message: TEAM_READ_ONLY_WRITE_MESSAGE };
  const message = databaseReferenceMessage(collection, id);
  if (message) return { ok: false, message };
  recordProjectSnapshot();
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
  }, { scope: "database", collection });
  return { ok: true };
}

export function bulkRenameSwitches(start: number, count: number, prefix: string): void {
  bulkRename(start, count, prefix, "switch");
}

export function bulkRenameVariables(start: number, count: number, prefix: string): void {
  bulkRename(start, count, prefix, "variable");
}

// 범위 일괄 이름 변경은 사용자에게 "한 번의 동작"이다 — 이전에는 개수만큼 루프를 돌며
// renameSwitch/addSwitch(각각 자체 recordProjectSnapshot 호출)를 호출해 Ctrl+Z를 N번
// 눌러야 되돌려졌다(qa-system-report.md). 여기서는 루프 전체를 감싸는 스냅샷 1개만
// 남기고, 실제 이름 변경/슬롯 추가는 actions.ts의 헬퍼를 거치지 않고 직접 수행한다.
function bulkRename(start: number, count: number, prefix: string, kind: "switch" | "variable"): void {
  const firstNumber = positiveInteger(start);
  const rangeCount = positiveInteger(count);
  const requiredSlotCount = firstNumber + rangeCount - 1;
  if (firstNumber === 0 || rangeCount === 0 || !Number.isSafeInteger(requiredSlotCount)) return;

  recordProjectSnapshot();
  if (kind === "switch") {
    store.update((project) => {
      ensureNumberedSlotCount(project.switches, requiredSlotCount, "sw");
      for (let offset = 0; offset < rangeCount; offset++) {
        const number = firstNumber + offset;
        const label = `${prefix} ${number.toString().padStart(4, "0")}`;
        project.switches[number - 1]!.name = label;
      }
    }, { scope: "database", collection: "switches" });
    return;
  }
  store.update((project) => {
    ensureNumberedSlotCount(project.variables, requiredSlotCount, "var");
    for (let offset = 0; offset < rangeCount; offset++) {
      const number = firstNumber + offset;
      const label = `${prefix} ${number.toString().padStart(4, "0")}`;
      project.variables[number - 1]!.name = label;
    }
  }, { scope: "database", collection: "variables" });
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

// 범위 편집이 실제로 요청한 마지막 번호까지만 동적으로 확장한다. 고정 상한이나
// 1,000개 선할당은 없으며, 이미 존재하는 사용자/레거시 id는 그대로 보존한다.
function ensureNumberedSlotCount(
  records: { id: string; name: string }[],
  requiredCount: number,
  prefix: "sw" | "var",
): void {
  const existingIds = new Set(records.map((record) => record.id));
  let index = 1;
  while (records.length < requiredCount) {
    const id = `${prefix}_${String(index).padStart(4, "0")}`;
    index += 1;
    if (existingIds.has(id)) continue;
    records.push({ id, name: "" });
    existingIds.add(id);
  }
}

function isBattleAnimationScope(value: unknown): value is BattleAnimationScope {
  return value === "singleTarget" || value === "allTargets" || value === "screen";
}

function isBattleAnimationPosition(value: unknown): value is BattleAnimationPosition {
  return value === "head" || value === "center" || value === "feet" || value === "screen";
}
