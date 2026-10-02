import { eventReferenceMatches } from "@/editor/databaseEventReferences";
import { commandsResourceReference } from "@/editor/databaseCommandReferences";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { store } from "@/project/store";
import { namedReferenceMessage, commandLocationMessage, projectDatabaseReferenceMessage, projectSwitchVariableReferenceMessage } from "./databaseRecordReferences";
import type { Command, ItemRecord, SkillRecord } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";

export function databaseReferenceMessage(collection: DatabaseCollection, id: string): string | null {
  return projectDatabaseReferenceMessage(store.getCurrent(), collection, id);
}

// 몬스터의 포획 species 참조(EnemyRecord.speciesId)를 검사한다.
// monsterSpecies는 DatabaseCollection(= keyof DatabaseRecords)에 편입돼 있지 않아
// databaseReferenceMessage()의 switch를 타지 않으므로 species 삭제 경로에서 직접 호출한다.
export function monsterSpeciesReferenceMessage(speciesId: string): string | null {
  const project = store.getCurrent();
  const enemies = project.database.enemies.filter((record) => record.speciesId === speciesId);
  if (enemies.length) return namedReferenceMessage("몬스터", enemies, "이 species를 포획 species로 사용 중입니다.");
  const referrers = (project.database.monsterSpecies ?? []).filter(
    (record) => record.id !== speciesId && (record.evolutions ?? []).some((evolution) => evolution.toSpeciesId === speciesId)
  );
  if (referrers.length) return namedReferenceMessage("종족", referrers, "이 종족으로 진화합니다.");
  const fusion = (project.system.monsterFusions ?? []).find((row) => row.speciesA === speciesId || row.speciesB === speciesId || row.resultSpeciesId === speciesId);
  if (fusion) return "몬스터 합성 표(시스템 → 몬스터 합성)가 이 종족을 사용 중입니다.";
  // giveMonster/evolveMonster/tradeMonster 이벤트 명령도 종족 id 를 들고 있다.
  return commandLocationMessage(project, "monsterSpecies", speciesId, "종족");
}

/** Farm-animal species are authored outside DatabaseCollection, so their delete route calls this guard directly. */
export function farmAnimalSpeciesReferenceMessage(speciesId: string): string | null {
  const project = store.getCurrent();
  const animals = (project.session.farmAnimals ?? []).filter((animal) => animal.speciesId === speciesId);
  if (animals.length) {
    return namedReferenceMessage("시작 동물", animals, "이 동물 종을 사용 중입니다.");
  }
  const buildings = (project.system.farmAnimalBuildings ?? []).filter((building) =>
    building.allowedSpeciesIds.includes(speciesId)
  );
  if (buildings.length) {
    return namedReferenceMessage("동물 축사", buildings, "이 동물 종을 허용하고 있습니다.");
  }
  const housingTypes = (project.database.farmBuildingTypes ?? []).filter((type) =>
    type.animalHousing?.allowedSpeciesIds.includes(speciesId)
  );
  if (housingTypes.length) {
    return namedReferenceMessage("농장 건물 유형", housingTypes, "동물 주거 허용 종으로 이 종을 사용 중입니다.");
  }
  return null;
}

/** Farm-animal buildings are system records, so their delete route calls this guard directly. */
export function farmAnimalBuildingReferenceMessage(buildingId: string): string | null {
  const project = store.getCurrent();
  const animals = (project.session.farmAnimals ?? []).filter((animal) => animal.buildingId === buildingId);
  if (animals.length) {
    return namedReferenceMessage("시작 동물", animals, "이 동물 축사에 배정되어 있습니다.");
  }
  return null;
}

export function farmBuildingTypeReferenceMessage(typeId: string): string | null {
  const placement = (store.getCurrent().session.farmBuildingPlacements ?? []).find((row) => row.typeId === typeId);
  return placement ? `시작 범용 농장 건물 '${placement.instanceId}'이 이 건물 유형을 사용 중입니다.` : null;
}

export function homeDecorationTypeReferenceMessage(typeId: string): string | null {
  const placement = (store.getCurrent().session.homeDecorationPlacements ?? []).find((row) => row.typeId === typeId);
  return placement ? `시작 집 장식 '${placement.instanceId}'이 이 장식 유형을 사용 중입니다.` : null;
}

// 작물(CropRecord) 참조 검사. 농사 플롯(FarmPlotState.cropId)은 PlaySession(런타임 세이브)
// 전용 필드이고 에디터가 들고 있는 Project(session: ProjectSession)에는 애초에 존재하지
// 않는다(session.ts:96 vs project.ts:99-107) — 즉 편집 시점에 검사 가능한 정적 DB 참조가
// 없다. 따라서 삭제 차단 대상이 아니며 항상 null 을 반환한다. crop 자신의 FK(seedItemId/
// harvestItemId) 무결성은 단일 권위자인 collectProjectReferenceIssues(validateCropRecords)가
// 소관한다. 향후 다른 레코드(퀘스트 등)가 cropId 를 정적으로 참조하게 되면 이 자리에 검사를 추가한다.
export function cropReferenceMessage(_cropId: string): string | null {
  return null;
}

export function commonEventReferenceMessage(id: string): string | null {
  const project = store.getCurrent();
  if (project.system.timeSystem?.onDayEnd === id) {
    return "시간 시스템(하루 끝)이 이 이벤트를 사용합니다.";
  }
  if (
    project.commonEvents.some((event) => event.id !== id && commandListReferencesCommonEvent(event.commands, id)) ||
    Object.values(project.maps).some((map) =>
      map.events.some((event) => eventReferenceMatches(event, (body) =>
        commandListReferencesCommonEvent(body.commands, id) || (body.pages ?? []).some((page) => commandListReferencesCommonEvent(page.commands, id))
      ))
    ) ||
    project.database.troops.some((troop) => troop.battleEventPages.some((page) => commandListReferencesCommonEvent(page.commands, id))
      || troopAfterBattleLists(troop).some((list) => commandListReferencesCommonEvent(list.commands, id)))
  ) return "이벤트 명령이 이 커먼 이벤트를 호출 중입니다.";
  return null;
}

function commandListReferencesCommonEvent(commands: readonly Command[], id: string): boolean {
  return commands.some((command) => commandReferencesCommonEvent(command, id));
}

function commandReferencesCommonEvent(command: Command, id: string): boolean {
  return (command.kind === "callCommonEvent" && command.commonEventId === id)
    || eventCommandBranches(command).some((branch) => commandListReferencesCommonEvent(branch.commands, id));
}

export function resourceReferenceMessage(resourceId: string): string | null {
  const project = store.getCurrent();
  if (project.resourceProfiles.some((profile) => profile.characterSlots?.some((slot) => slot.status === "mapped" && slot.faceResourceId === resourceId))) return "캐릭터·얼굴 수동 연결이 이 리소스를 사용 중입니다.";
  if (project.database.actors.some((record) => record.faceResourceId === resourceId || record.characterResourceId === resourceId || record.battleCharacterResourceId === resourceId)) return "주인공이 이 리소스를 사용 중입니다.";
  if (project.database.items.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) return "아이템이 이 리소스를 사용 중입니다.";
  if (project.database.equipment.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) return "장비가 이 리소스를 사용 중입니다.";
  if (project.database.enemies.some((record) => record.monsterResourceId === resourceId)) return "몬스터가 이 리소스를 사용 중입니다.";
  if (project.database.troops.some((record) => record.previewBackgroundResourceId === resourceId)) return "적 그룹이 이 리소스를 사용 중입니다.";
  if (project.database.battleAnimations.some((record) => record.resourceId === resourceId)) return "전투 애니메이션이 이 리소스를 사용 중입니다.";
  // battleSystemResourceId(System2)는 전투가 그림으로 쓰지 않고 고칠 화면도 없다(2026-10-02) — 삭제를 막지 않는다.
  // 지울 때 그 칸을 비우는 쪽은 resourceManager 의 삭제다.
  if (project.system.titleResourceId === resourceId || project.system.systemResourceId === resourceId) return "시스템 설정이 이 리소스를 사용 중입니다.";
  if (commandsResourceReference(project, resourceId)) return "이벤트 명령이 이 리소스를 사용 중입니다.";
  return null;
}

export function switchVariableReferenceMessage(kind: "switch" | "variable", id: string): string | null {
  return projectSwitchVariableReferenceMessage(store.getCurrent(), kind, id);
}

export function databaseRecordPrefix(collection: DatabaseCollection): string {
  switch (collection) {
    case "actors": return "actor";
    case "classes": return "class";
    case "skills": return "skill";
    case "items": return "item";
    case "equipment": return "equip";
    case "enemies": return "enemy";
    case "troops": return "troop";
    case "states": return "state";
    case "battleAnimations": return "anim";
  }
}

export function isSkillScope(value: unknown): value is SkillRecord["scope"] {
  return value === "self" || value === "ally" || value === "allAllies" || value === "enemy" || value === "allEnemies";
}

export function isItemScope(value: unknown): value is ItemRecord["scope"] {
  return value === "none" || value === "ally" || value === "allAllies" || value === "enemy";
}
