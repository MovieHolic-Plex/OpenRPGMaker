import { commandsReferenceLocations, commandsResourceReference, switchVariableReferencedInProject, type DatabaseReferenceLocation } from "@/editor/databaseCommandReferences";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { Command, ItemRecord, Project, SkillRecord } from "@/project/types";

// 참조 거부 메시지는 "무엇이" 뿐 아니라 "어디서" 참조하는지도 밝힌다 — 그래야 사용자가
// 실제로 가서 참조를 끊을 수 있다. 레코드 참조는 첫 매치 레코드 이름을, 이벤트 명령
// 참조는 첫 매치의 맵/이벤트(또는 커먼 이벤트/전투 이벤트) 이름을 포함하고, 매치가
// 여럿이면 "외 N-1건"을 덧붙인다.
function namedReferenceMessage(sourceLabel: string, matches: readonly { readonly name: string }[], verbPhrase: string): string | null {
  if (matches.length === 0) return null;
  const name = matches[0]!.name || "(이름 없음)";
  return `${sourceLabel} '${name}'이 ${verbPhrase}${extraSuffix(matches.length)}`;
}

function commandLocationMessage(project: Project, collection: Parameters<typeof commandsReferenceLocations>[1], id: string, targetLabel: string): string | null {
  const locations = commandsReferenceLocations(project, collection, id);
  if (locations.length === 0) return null;
  return `${formatLocation(locations[0]!, targetLabel)}${extraSuffix(locations.length)}`;
}

function formatLocation(location: DatabaseReferenceLocation, targetLabel: string): string {
  const target = withObjectParticle(targetLabel);
  switch (location.kind) {
    case "mapEvent":
      return `'${location.mapName}' 맵의 이벤트 '${location.eventName}'(${location.eventId})이 이 ${target} 사용 중입니다.`;
    case "commonEvent":
      return `커먼 이벤트 '${location.eventName}'(${location.eventId})이 이 ${target} 사용 중입니다.`;
    case "troopBattleEvent":
      return `적 그룹 '${location.troopName}'의 전투 이벤트 '${location.pageName}'이 이 ${target} 사용 중입니다.`;
  }
}

function extraSuffix(matchCount: number): string {
  return matchCount > 1 ? ` (외 ${matchCount - 1}건)` : "";
}

// 한글 받침 유무에 따라 "을/를" 조사를 붙인다(예: "스킬을" vs "몬스터를"). targetLabel이
// 호출부마다 다른 콜렉션 이름이라 하드코딩 대신 마지막 음절의 받침 여부로 판별한다.
function withObjectParticle(word: string): string {
  const lastChar = word.at(-1) ?? "";
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word}를`;
  const hasBatchim = (code - 0xac00) % 28 !== 0;
  return hasBatchim ? `${word}을` : `${word}를`;
}

export function databaseReferenceMessage(collection: DatabaseCollection, id: string): string | null {
  // 삭제 차단 UX 계층 — orphan-FK '검출' 권위자는 src/project/io/references.ts 의 collectProjectReferenceIssues(validate*Records) 이고,
  // 이 함수는 삭제 시점에 사용자에게 보여 줄 차단 메시지를 만드는 보조 계층이다. 두 시스템을 중복 검출기로 분리하지 말 것.
  const project = store.getCurrent();
  const tree = project.growth?.skillTrees.find(t => collection === "classes" ? t.classIds.includes(id) : collection === "skills" && t.nodes.some(n => n.effect.kind === "skill" && n.effect.skillId === id));
  if (tree) return `스킬 트리 '${tree.name}'에서 사용 중입니다. 먼저 연결을 해제하세요.`;
  if (collection === 'skills') {
    const owner = project.database.classes.find(c => c.promotions?.some(p => p.requires.requiredSkillIds?.includes(id)));
    if (owner) return `직업 '${owner.name}'의 승급 조건에서 사용 중입니다. 먼저 연결을 해제하세요.`;
  }
  switch (collection) {
    case "skills": {
      const actors = project.database.actors.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id));
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 스킬을 사용 중입니다.");
      const classes = project.database.classes.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id));
      if (classes.length) return namedReferenceMessage("직업", classes, "이 스킬을 배웁니다.");
      const items = project.database.items.filter((record) => record.skillId === id);
      if (items.length) return namedReferenceMessage("아이템", items, "이 스킬을 사용 중입니다.");
      const equipment = project.database.equipment.filter((record) => record.skillId === id || record.usableAsItemSkillId === id);
      if (equipment.length) return namedReferenceMessage("장비", equipment, "이 스킬을 사용 중입니다.");
      const enemies = project.database.enemies.filter((record) => record.actions.some((action) => action.skillId === id));
      if (enemies.length) return namedReferenceMessage("몬스터", enemies, "이 스킬을 사용 중입니다.");
      return commandLocationMessage(project, "skills", id, "스킬");
    }
    case "enemies": {
      const troops = project.database.troops.filter((record) => record.enemyIds.includes(id) || record.members?.some((member) => member.enemyId === id));
      if (troops.length) return namedReferenceMessage("적 그룹", troops, "이 몬스터를 사용 중입니다.");
      return commandLocationMessage(project, "enemies", id, "몬스터");
    }
    case "actors":
      if (project.system.startActorIds.includes(id)) return "시스템 시작 파티가 이 주인공을 사용 중입니다.";
      if (project.session.partyActorIds.includes(id)) return "현재 파티가 이 주인공을 사용 중입니다.";
      return commandLocationMessage(project, "actors", id, "주인공");
    case "classes": {
      const actors = project.database.actors.filter((record) => record.classId === id);
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 직업을 사용 중입니다.");
      const equipment = project.database.equipment.filter((record) => record.equippableClassIds.includes(id));
      if (equipment.length) return namedReferenceMessage("장비", equipment, "이 직업을 사용 중입니다.");
      const items = project.database.items.filter((record) => record.usableClassIds.includes(id) || record.equipmentProfile.equippableClassIds.includes(id));
      if (items.length) return namedReferenceMessage("아이템/장비 효과", items, "이 직업을 사용 중입니다.");
      return null;
    }
    case "equipment": {
      const actors = project.database.actors.filter((record) => Object.values(record.initialEquipment).includes(id));
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 장비를 사용 중입니다.");
      const classes = project.database.classes.filter((record) => record.equipmentPermissions.equipmentIds.includes(id));
      if (classes.length) return namedReferenceMessage("직업", classes, "이 장비를 사용 중입니다.");
      return commandLocationMessage(project, "equipment", id, "장비");
    }
    case "battleAnimations": {
      const actors = project.database.actors.filter((record) => record.unarmedAnimationId === id);
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 전투 애니메이션을 사용 중입니다.");
      const classes = project.database.classes.filter((record) => record.animationId === id);
      if (classes.length) return namedReferenceMessage("직업", classes, "이 전투 애니메이션을 사용 중입니다.");
      const skills = project.database.skills.filter((record) => record.animationId === id);
      if (skills.length) return namedReferenceMessage("스킬", skills, "이 전투 애니메이션을 사용 중입니다.");
      const items = project.database.items.filter((record) => record.animationId === id);
      if (items.length) return namedReferenceMessage("아이템", items, "이 전투 애니메이션을 사용 중입니다.");
      return null;
    }
    case "troops":
      if (project.system.initialTroopId === id) return "시스템 기본 전투가 이 적 그룹을 사용 중입니다.";
      return commandLocationMessage(project, "troops", id, "적 그룹");
    case "items": {
      const spatialBuildings = (project.database.farmBuildingTypes ?? []).filter((record) =>
        record.levels.some((level) => level.cost?.items?.some((entry) => entry.itemId === id))
      );
      if (spatialBuildings.length) return `범용 농장 건물 '${spatialBuildings[0]!.name || spatialBuildings[0]!.id}'의 건설·업그레이드 재료로 사용 중입니다.`;
      const spatialDecorations = (project.database.homeDecorationTypes ?? []).filter((record) => record.placementItemId === id);
      if (spatialDecorations.length) return `집 장식 '${spatialDecorations[0]!.name || spatialDecorations[0]!.id}'의 배치 아이템으로 사용 중입니다.`;
      const feedSpecies = (project.database.farmAnimalSpecies ?? []).filter((record) => record.feedItemId === id);
      if (feedSpecies.length) {
        return namedReferenceMessage("동물 종", feedSpecies, "이 아이템을 먹이로 사용 중입니다.");
      }
      const productSpecies = (project.database.farmAnimalSpecies ?? []).filter((record) => record.productItemId === id);
      if (productSpecies.length) {
        return namedReferenceMessage("동물 종", productSpecies, "이 아이템을 생산물로 사용 중입니다.");
      }
      const recipes = project.system.craftRecipes?.filter((record) =>
        record.outputItemId === id || record.ingredients.some((ingredient) => ingredient.itemId === id)
      ) ?? [];
      if (recipes.length) return namedReferenceMessage("제작법", recipes.map((record) => ({ name: record.name ?? record.id })), "이 아이템을 제작 재료나 결과로 사용 중입니다.");
      const upgrades = project.system.itemUpgrades?.filter((record) =>
        record.fromItemId === id || record.toItemId === id || record.ingredients?.some((ingredient) => ingredient.itemId === id)
      ) ?? [];
      if (upgrades.length) return namedReferenceMessage("도구 강화", upgrades.map((record) => ({ name: record.id })), "이 아이템을 강화 재료나 결과로 사용 중입니다.");
      if (project.system.sellPrices?.some((record) => record.itemId === id)) return "판매 가격 규칙이 이 아이템을 사용 중입니다.";
      const toolActions = project.system.toolActions?.filter((record) => record.itemId === id) ?? [];
      if (toolActions.length) return namedReferenceMessage("도구 행동", toolActions.map((record) => ({ name: record.id })), "이 아이템을 사용 중입니다.");
      if (project.system.shipping?.allowedItemIds?.includes(id)) return "출하 허용 목록이 이 아이템을 사용 중입니다.";
      const bundles = (project.system.bundles ?? []).filter((record) =>
        record.requirements.some((entry) => entry.itemId === id)
        || record.reward?.itemRewards?.some((entry) => entry.itemId === id)
      );
      if (bundles.length) return namedReferenceMessage("꾸러미", bundles.map((record) => ({ name: record.name ?? record.id })), "이 아이템을 요구하거나 보상으로 사용 중입니다.");
      const makers = (project.system.makers ?? []).filter((record) =>
        record.inputs.some((entry) => entry.itemId === id) || record.outputs.some((entry) => entry.itemId === id)
      );
      if (makers.length) return namedReferenceMessage("가공 설비", makers.map((record) => ({ name: record.name ?? record.id })), "이 아이템을 투입하거나 생산합니다.");
      const fishSpecies = (project.database.fishSpecies ?? []).filter((record) => record.itemId === id);
      if (fishSpecies.length) return namedReferenceMessage("물고기 종", fishSpecies, "이 아이템으로 포획됩니다.");
      const forageAreas = (project.system.seasonalForage?.areas ?? []).filter((area) => area.entries.some((entry) =>
        entry.itemId === id || Object.values(entry.seasonalDrops ?? {}).includes(id)
      ));
      if (forageAreas.length) return namedReferenceMessage("채집 구역", forageAreas.map((record) => ({ name: record.name ?? record.id })), "이 아이템을 채집물로 사용 중입니다.");
      if (project.system.collections?.trackedItemIds?.includes(id)) return "수집 도감이 이 아이템을 추적 중입니다.";
      if (project.system.museum?.eligibleItemIds.includes(id)) return "박물관 기부 목록이 이 아이템을 사용 중입니다.";
      const museumRewards = (project.system.museum?.rewards ?? []).filter((record) =>
        record.requiredItemIds?.includes(id) || record.reward?.itemRewards?.some((entry) => entry.itemId === id)
      );
      if (museumRewards.length) return namedReferenceMessage("박물관 보상", museumRewards.map((record) => ({ name: record.name ?? record.id })), "이 아이템을 조건이나 보상으로 사용 중입니다.");
      const enemies = project.database.enemies.filter((record) => record.rewards.dropItemId === id);
      if (enemies.length) return namedReferenceMessage("몬스터", enemies, "이 아이템을 보상으로 사용 중입니다.");
      return commandLocationMessage(project, "items", id, "아이템");
    }
    case "states": {
      const skills = project.database.skills.filter((record) => record.stateEffects?.some((effect) => effect.stateId === id));
      if (skills.length) return namedReferenceMessage("스킬", skills, "이 상태를 사용 중입니다.");
      const items = project.database.items.filter(
        (record) =>
          record.stateEffects.some((effect) => effect.stateId === id) ||
          record.healStateIds.includes(id) ||
          record.equipmentProfile.stateInflictIds.includes(id) ||
          record.equipmentProfile.stateDefenseIds.includes(id)
      );
      if (items.length) return namedReferenceMessage("아이템", items, "이 상태를 사용 중입니다.");
      const equipment = project.database.equipment.filter((record) => record.stateInflictIds.includes(id) || record.stateDefenseIds.includes(id));
      if (equipment.length) return namedReferenceMessage("장비", equipment, "이 상태를 사용 중입니다.");
      return null;
    }
  }
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
  // giveMonster/evolveMonster 이벤트 명령도 종족 id 를 들고 있다.
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
      map.events.some((event) => commandListReferencesCommonEvent(event.commands, id) || (event.pages ?? []).some((page) => commandListReferencesCommonEvent(page.commands, id)))
    ) ||
    project.database.troops.some((troop) => troop.battleEventPages.some((page) => commandListReferencesCommonEvent(page.commands, id)))
  ) return "이벤트 명령이 이 커먼 이벤트를 호출 중입니다.";
  return null;
}

function commandListReferencesCommonEvent(commands: readonly Command[], id: string): boolean {
  return commands.some((command) => commandReferencesCommonEvent(command, id));
}

function commandReferencesCommonEvent(command: Command, id: string): boolean {
  switch (command.kind) {
    case "callCommonEvent":
      return command.commonEventId === id;
    case "choices":
      return command.options.some((option) => commandListReferencesCommonEvent(option.branch, id)) || commandListReferencesCommonEvent(command.cancelBranch ?? [], id);
    case "fork":
      return commandListReferencesCommonEvent(command.then, id) || commandListReferencesCommonEvent(command.else ?? [], id);
    case "loop":
      return commandListReferencesCommonEvent(command.body, id);
    case "shop":
      return commandListReferencesCommonEvent(command.transactionBranch ?? [], id);
    case "inn":
      return commandListReferencesCommonEvent(command.notEnoughBranch ?? [], id);
    default:
      return false;
  }
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
  if (project.system.titleResourceId === resourceId || project.system.systemResourceId === resourceId || project.system.battleSystemResourceId === resourceId) return "시스템 설정이 이 리소스를 사용 중입니다.";
  if (commandsResourceReference(project, resourceId)) return "이벤트 명령이 이 리소스를 사용 중입니다.";
  return null;
}

export function switchVariableReferenceMessage(kind: "switch" | "variable", id: string): string | null {
  const project = store.getCurrent();
  if (kind === "variable" && project.growth?.bonusVariableId === id) return "스킬 트리의 성장 포인트 보너스가 이 변수를 사용 중입니다.";
  if (kind === "switch" && (project.database.lifeSkills ?? []).some((skill) =>
    skill.levelUpRewards.some((reward) => reward.switchId === id)
  )) return "생활 기술의 레벨 보상이 이 스위치를 사용 중입니다.";
  if (kind === "switch" && (project.system.worldUnlocks ?? []).some((unlock) => unlock.switchId === id)) {
    return "지역 해금 규칙이 이 스위치를 사용 중입니다.";
  }
  if (kind === "switch" && (project.system.bundles ?? []).some((bundle) => bundle.reward?.switchId === id)) {
    return "꾸러미 완료 보상이 이 스위치를 사용 중입니다.";
  }
  if (kind === "switch" && project.database.items.some((item) => item.switchId === id)) {
    return "아이템이 이 스위치를 사용 중입니다.";
  }
  if (kind === "switch" && project.database.skills.some((skill) => skill.effect.kind === "switch" && skill.effect.switchId === id)) {
    return "스킬 효과가 이 스위치를 사용 중입니다.";
  }
  if (!switchVariableReferencedInProject(project, kind, id)) return null;
  return kind === "switch" ? "이벤트/조건이 이 스위치를 사용 중입니다." : "이벤트/조건이 이 변수를 사용 중입니다.";
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
