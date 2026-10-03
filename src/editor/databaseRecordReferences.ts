import { enemyCombatConditions } from "@/project/combatReferences";
import { commandsReferenceLocations, switchVariableReferencedInProject, type DatabaseReferenceLocation } from "./databaseCommandReferences";
import type { DatabaseCollection } from "./databaseActions";
import { collectProjectItemReferenceIds } from "@/project/io/references";
import type { Project } from "@/project/types";

// Pure reference checks: editor wrappers supply the store; tools supply their draft.
// 참조 거부 메시지는 "무엇이" 뿐 아니라 "어디서" 참조하는지도 밝힌다 — 그래야 사용자가
// 실제로 가서 참조를 끊을 수 있다. 레코드 참조는 첫 매치 레코드 이름을, 이벤트 명령
// 참조는 첫 매치의 맵/이벤트(또는 커먼 이벤트/전투 이벤트) 이름을 포함하고, 매치가
// 여럿이면 "외 N-1건"을 덧붙인다.
export function namedReferenceMessage(sourceLabel: string, matches: readonly { readonly name: string }[], verbPhrase: string): string | null {
  if (matches.length === 0) return null;
  const name = matches[0]!.name || "(이름 없음)";
  return `${sourceLabel} '${name}'이 ${verbPhrase}${extraSuffix(matches.length)}`;
}

export function commandLocationMessage(project: Project, collection: Parameters<typeof commandsReferenceLocations>[1], id: string, targetLabel: string): string | null {
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

export function projectDatabaseReferenceMessage(project: Project, collection: DatabaseCollection, id: string): string | null {
  // 삭제 차단 UX 계층 — orphan-FK '검출' 권위자는 src/project/io/references.ts 의 collectProjectReferenceIssues(validate*Records) 이고,
  // 이 함수는 삭제 시점에 사용자에게 보여 줄 차단 메시지를 만드는 보조 계층이다. 두 시스템을 중복 검출기로 분리하지 말 것.
  const tree = project.growth?.skillTrees.find(t => collection === "classes" ? t.classIds.includes(id) : collection === "skills" && t.nodes.some(n => n.effect.kind === "skill" && n.effect.skillId === id));
  if (tree) return `스킬 트리 '${tree.name}'에서 사용 중입니다. 먼저 연결을 해제하세요.`;
  if (collection === 'skills') {
    const owner = project.database.classes.find(c => c.promotions?.some(p => p.requires.requiredSkillIds?.includes(id)));
    if (owner) return `직업 '${owner.name}'의 승급 조건에서 사용 중입니다. 먼저 연결을 해제하세요.`;
  }
  switch (collection) {
    case "skills": {
      const species = (project.database.monsterSpecies ?? []).filter((record) => record.skillsByLevel?.some((skill) => skill.skillId === id));
      if (species.length) return namedReferenceMessage("몬스터 종족", species, "이 스킬을 배웁니다.");
      const actors = project.database.actors.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id));
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 스킬을 사용 중입니다.");
      const classes = project.database.classes.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id));
      if (classes.length) return namedReferenceMessage("직업", classes, "이 스킬을 배웁니다.");
      const commandClasses = project.database.classes.filter((record) => record.battleCommands.some((command) => command.skillId === id));
      if (commandClasses.length) return namedReferenceMessage("직업 전투 명령", commandClasses, "이 스킬을 사용 중입니다.");
      const items = project.database.items.filter((record) => record.skillId === id || record.learnedSkillId === id || record.activateSkillId === id);
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
    case "actors": {
      if (project.system.startActorIds.includes(id)) return "시스템 시작 파티가 이 주인공을 사용 중입니다.";
      if (project.session.partyActorIds.includes(id)) return "현재 파티가 이 주인공을 사용 중입니다.";
      const classes = project.database.classes.filter((record) => record.equipmentPermissions.actorIds.includes(id));
      if (classes.length) return namedReferenceMessage("직업 장비 권한", classes, "이 주인공을 사용 중입니다.");
      const equipment = project.database.equipment.filter((record) => record.equippableActorIds.includes(id));
      if (equipment.length) return namedReferenceMessage("장비", equipment, "이 주인공을 착용 허용 대상으로 사용 중입니다.");
      const items = project.database.items.filter((record) => record.usableActorIds.includes(id) || record.equipmentProfile.equippableActorIds.includes(id));
      if (items.length) return namedReferenceMessage("아이템/장비 효과", items, "이 주인공을 사용 허용 대상으로 사용 중입니다.");
      return commandLocationMessage(project, "actors", id, "주인공");
    }
    case "classes": {
      const referrers = project.database.classes.filter((record) => record.id !== id &&
        (record.promotions?.some((promotion) => promotion.toClassId === id) || record.equipmentPermissions.classIds.includes(id)));
      if (referrers.length) return namedReferenceMessage("직업", referrers, "이 직업을 승급 대상이나 장비 권한으로 사용 중입니다.");
      const actors = project.database.actors.filter((record) => record.classId === id);
      if (actors.length) return namedReferenceMessage("주인공", actors, "이 직업을 사용 중입니다.");
      const equipment = project.database.equipment.filter((record) => record.equippableClassIds.includes(id));
      if (equipment.length) return namedReferenceMessage("장비", equipment, "이 직업을 사용 중입니다.");
      const items = project.database.items.filter((record) => record.usableClassIds.includes(id) || record.equipmentProfile.equippableClassIds.includes(id));
      if (items.length) return namedReferenceMessage("아이템/장비 효과", items, "이 직업을 사용 중입니다.");
      // promoteActor.toClassId 는 로드 검증기가 하드 assert 한다(commandReferenceValidation:264-266).
      // 여기서 빠지면 battleAnimations 와 같은 "경고 없는 삭제 → 로드 불가" 경로가 된다.
      return commandLocationMessage(project, "classes", id, "직업");
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
      // 이벤트 명령(showAnimation)이 남은 유일한 참조일 수 있다. 여기서 놓치면 삭제가
      // 경고 없이 통과하고, 다음 로드에서 commandReferenceValidation 의 showAnimation
      // assert 가 프로젝트 전체를 열지 못하게 만든다(2026-09-19 리뷰 P0-6).
      return commandLocationMessage(project, "battleAnimations", id, "전투 애니메이션");
    }
    case "troops": {
      if (project.system.initialTroopId === id) return "시스템 기본 전투가 이 적 그룹을 사용 중입니다.";
      const maps = Object.values(project.maps).filter((map) => map.troopIds?.includes(id)
        || map.encounterTable?.some((entry) => entry.troopId === id)
        || map.fieldSpawns?.some((entry) => entry.troopId === id));
      if (maps.length) return namedReferenceMessage("맵", maps, "이 적 그룹을 인카운터나 필드 스폰으로 사용 중입니다.");
      return commandLocationMessage(project, "troops", id, "적 그룹");
    }
    case "items": {
      const crops = (project.database.crops ?? []).filter((record) => record.seedItemId === id || record.harvestItemId === id);
      if (crops.length) return namedReferenceMessage("작물", crops, "이 아이템을 씨앗이나 수확물로 사용 중입니다.");
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
      const enemies = project.database.enemies.filter((record) => record.rewards.dropItemId === id || record.rewards.drops?.some(drop => drop.itemId === id));
      if (enemies.length) return namedReferenceMessage("몬스터", enemies, "이 아이템을 보상으로 사용 중입니다.");
      return commandLocationMessage(project, "items", id, "아이템")
        ?? (collectProjectItemReferenceIds(project).has(id) ? "프로젝트 데이터가 이 아이템을 사용 중입니다. 먼저 연결을 해제하세요." : null);
    }
    case "states": {
      const conditionEnemies = project.database.enemies.filter(enemy => enemyCombatConditions(enemy).some(condition => condition.kind === "status" && condition.stateId === id));
      if (conditionEnemies.length) return namedReferenceMessage("몬스터 조건", conditionEnemies, "이 상태를 행동/드롭 조건으로 사용 중입니다.");
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
      // stateRates 는 실제 등급 데이터다(types/database.ts:53,106,430). 여기서 안 보면
      // 삭제된 상태 id 가 actors/classes/enemies 의 키로 저장본에 영구 잔류한다.
      const rateActors = project.database.actors.filter((record) => record.stateRates?.[id] !== undefined);
      if (rateActors.length) return namedReferenceMessage("주인공", rateActors, "이 상태의 등급을 지정하고 있습니다.");
      const rateClasses = project.database.classes.filter((record) => record.stateRates?.[id] !== undefined);
      if (rateClasses.length) return namedReferenceMessage("직업", rateClasses, "이 상태의 등급을 지정하고 있습니다.");
      const rateEnemies = project.database.enemies.filter((record) => record.stateRates?.[id] !== undefined);
      if (rateEnemies.length) return namedReferenceMessage("몬스터", rateEnemies, "이 상태의 등급을 지정하고 있습니다.");
      return commandLocationMessage(project, "states", id, "상태");
    }
  }
}

export function projectSwitchVariableReferenceMessage(project: Project, kind: "switch" | "variable", id: string): string | null {
  if (kind === "switch" && project.database.enemies.some(enemy => enemyCombatConditions(enemy).some(condition => condition.kind === "switch" && condition.switchId === id))) return "몬스터 행동/드롭 조건이 이 스위치를 사용 중입니다.";
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
