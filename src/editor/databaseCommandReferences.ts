import type { DatabaseCollection } from "@/editor/databaseActions";
import { eventDisplayName } from "@/project/eventDisplayName";
import type { BattleEventCondition, Command, Condition, GiftPrefs, MoveCommand, Project } from "@/project/types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";
import { TROOP_AFTER_BATTLE_LABELS, troopAfterBattleLists } from "@/project/troopAfterBattle";

type CommandReferenceCollection = DatabaseCollection | "monsterSpecies" | "lifeSkills" | "craftRecipes" | "itemUpgrades";

export function commandsReference(project: Project, collection: CommandReferenceCollection, id: string): boolean {
  return commandsReferenceLocations(project, collection, id).length > 0;
}

// 삭제 거부 메시지에 "무엇이 어디서 참조하는지" 위치 정보를 채우기 위한 참조 위치 목록.
// commandsReference()와 같은 구조를 순회하지만 첫 매치에서 멈추지 않고 전부 모은다
// (호출부가 첫 건 + "외 N-1건" 요약을 만들 수 있도록).
export type DatabaseReferenceLocation =
  | { readonly kind: "mapEvent"; readonly mapName: string; readonly eventName: string; readonly eventId: string }
  | { readonly kind: "commonEvent"; readonly eventName: string; readonly eventId: string }
  | { readonly kind: "troopBattleEvent"; readonly troopName: string; readonly pageName: string };

export function commandsReferenceLocations(project: Project, collection: CommandReferenceCollection, id: string): DatabaseReferenceLocation[] {
  const locations: DatabaseReferenceLocation[] = [];

  for (const event of project.commonEvents) {
    if (commandListReferences(event.commands, collection, id)) {
      locations.push({ kind: "commonEvent", eventName: event.name, eventId: event.id });
    }
  }

  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const matches =
        conditionReferencesDatabase(event.condition, collection, id) ||
        eventGiftPrefsReferences(event, collection, id) ||
        commandListReferences(event.commands, collection, id) ||
        (event.pages ?? []).some(
          (page) =>
            page.conditions.some((condition) => conditionReferencesDatabase(condition, collection, id)) ||
            commandListReferences(page.commands, collection, id)
        );
      if (matches) locations.push({ kind: "mapEvent", mapName: map.name, eventName: eventDisplayName(event), eventId: event.id });
    }
  }

  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) {
      const matches =
        page.conditions.some((condition) => conditionReferencesDatabase(condition, collection, id)) ||
        commandListReferences(page.commands, collection, id);
      if (matches) locations.push({ kind: "troopBattleEvent", troopName: troop.name, pageName: page.name });
    }
    for (const list of troopAfterBattleLists(troop)) {
      if (commandListReferences(list.commands, collection, id)) locations.push({ kind: "troopBattleEvent", troopName: troop.name, pageName: afterBattlePageName(list.outcome) });
    }
  }

  return locations;
}

export function commandsResourceReference(project: Project, resourceId: string): boolean {
  return (
    project.commonEvents.some((event) => commandListResourceReferences(event.commands, resourceId)) ||
    Object.values(project.maps).some((map) =>
      map.events.some(
        (event) =>
          event.sprite?.id === resourceId ||
          commandListResourceReferences(event.commands, resourceId) ||
          (event.pages ?? []).some(
            (page) => page.graphic.sprite?.id === resourceId || commandListResourceReferences(page.commands, resourceId)
          )
      )
    ) ||
    project.database.troops.some((troop) => troop.battleEventPages.some((page) => commandListResourceReferences(page.commands, resourceId))
      || troopAfterBattleLists(troop).some((list) => commandListResourceReferences(list.commands, resourceId)))
  );
}

/**
 * 스위치/변수를 **어디서** 쓰는지 전부 모은다. 기존 `switchVariableReferencedInProject`
 * 는 boolean 만 돌려줘서 스위치 탭이 "이벤트/조건이 이 스위치를 사용 중입니다" 한 줄밖에
 * 보여줄 수 없었다 — 어느 맵의 어느 이벤트인지 알 수 없으니 실제로 찾아갈 수가 없었다.
 * 판정 로직은 그 함수와 같은 술어를 그대로 쓰고, 참/거짓 대신 위치를 쌓는다.
 */
export function switchVariableReferenceLocations(
  project: Project,
  kind: "switch" | "variable",
  id: string,
): DatabaseReferenceLocation[] {
  const locations: DatabaseReferenceLocation[] = [];

  for (const event of project.commonEvents) {
    const matches =
      (kind === "switch" && event.conditionSwitchId === id) ||
      commandListReferencesSwitchVariable(event.commands, kind, id);
    if (matches) locations.push({ kind: "commonEvent", eventName: event.name, eventId: event.id });
  }

  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const matches =
        conditionReferencesSwitchVariable(event.condition, kind, id) ||
        commandListReferencesSwitchVariable(event.commands, kind, id) ||
        (event.pages ?? []).some(
          (page) =>
            (kind === "switch" && page.movement.living?.destinations.some((destination) => destination.switchId === id)) ||
            page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
            commandListReferencesSwitchVariable(page.commands, kind, id)
        );
      if (matches) locations.push({ kind: "mapEvent", mapName: map.name, eventName: eventDisplayName(event), eventId: event.id });
    }
  }

  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) {
      const matches =
        page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
        commandListReferencesSwitchVariable(page.commands, kind, id);
      if (matches) locations.push({ kind: "troopBattleEvent", troopName: troop.name, pageName: page.name });
    }
    for (const list of troopAfterBattleLists(troop)) {
      if (commandListReferencesSwitchVariable(list.commands, kind, id)) locations.push({ kind: "troopBattleEvent", troopName: troop.name, pageName: afterBattlePageName(list.outcome) });
    }
  }

  return locations;
}

export function switchVariableReferencedInProject(project: Project, kind: "switch" | "variable", id: string): boolean {
  return (
    (kind === "variable" && project.growth?.bonusVariableId === id) ||
    project.commonEvents.some(
      (event) => (kind === "switch" && event.conditionSwitchId === id) || commandListReferencesSwitchVariable(event.commands, kind, id)
    ) ||
    Object.values(project.maps).some((map) =>
      map.events.some(
        (event) =>
          conditionReferencesSwitchVariable(event.condition, kind, id) ||
          commandListReferencesSwitchVariable(event.commands, kind, id) ||
          (event.pages ?? []).some(
            (page) =>
              (kind === "switch" && page.movement.living?.destinations.some((destination) => destination.switchId === id)) ||
              page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
              commandListReferencesSwitchVariable(page.commands, kind, id)
          )
      )
    ) ||
    project.database.troops.some((troop) =>
      troop.battleEventPages.some(
        (page) =>
          page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
          commandListReferencesSwitchVariable(page.commands, kind, id)
      ) || troopAfterBattleLists(troop).some((list) => commandListReferencesSwitchVariable(list.commands, kind, id))
    )
  );
}

function commandListReferences(commands: readonly Command[], collection: CommandReferenceCollection, id: string): boolean {
  return commands.some((command) => commandReferences(command, collection, id));
}

function afterBattlePageName(outcome: keyof typeof TROOP_AFTER_BATTLE_LABELS): string {
  return `전투 뒤 · ${TROOP_AFTER_BATTLE_LABELS[outcome]}`;
}

function commandReferences(command: Command, collection: CommandReferenceCollection, id: string): boolean {
  switch (command.kind) {
    case "presentItem":
      return (collection === "items" && ((command.itemIds ?? []).includes(id) || command.options.some((option) => option.itemId === id)))
        || presentItemBranchLists(command).some((branch) => commandListReferences(branch, collection, id));
    case "choices":
      return command.options.some((option) => commandListReferences(option.branch, collection, id)) || commandListReferences(command.cancelBranch ?? [], collection, id);
    case "fork":
      return conditionReferencesDatabase(command.condition, collection, id) || commandListReferences(command.then, collection, id) || commandListReferences(command.else ?? [], collection, id);
    case "loop":
      return commandListReferences(command.body, collection, id);
    case "shop":
      return (
        collection === "items" &&
          (command.itemIds.includes(id) || (command.stock ?? []).some((entry) => entry.itemId === id))
      ) || commandListReferences(command.transactionBranch ?? [], collection, id)
        || commandListReferences(command.failedTransactionBranch ?? [], collection, id);
    case "inn":
      return commandListReferences(command.notEnoughBranch ?? [], collection, id);
    case "promoteActor":
      return (collection === "actors" && command.actorId === id) ||
        (collection === "classes" && command.toClassId === id) ||
        commandListReferences(command.successBranch ?? [], collection, id) ||
        commandListReferences(command.failureBranch ?? [], collection, id);
    case "giveMonster":
      return collection === "monsterSpecies" && command.speciesId === id;
    case "tradeMonster":
      return collection === "monsterSpecies" && (command.fromSpeciesId === id || command.toSpeciesId === id);
    case "evolveMonster":
      return (collection === "monsterSpecies" && command.toSpeciesId === id) ||
        commandListReferences(command.successBranch ?? [], collection, id) ||
        commandListReferences(command.failureBranch ?? [], collection, id);
    case "learnSkill":
      return (collection === "actors" && Boolean(command.actorId) && command.actorId === id)
        || (collection === "skills" && command.skillId === id);
    case "battleProcessing":
      return (collection === "troops" && command.troopId === id)
        || commandListReferences(command.victoryBranch ?? [], collection, id)
        || commandListReferences(command.defeatBranch ?? [], collection, id)
        || commandListReferences(command.escapeBranch ?? [], collection, id);
    case "spawnFieldEnemy":
      return collection === "troops" && command.spawn.troopId === id;
    case "tacticsBattle":
      return (collection === "troops" && command.troopId === id)
        || commandListReferences(command.victoryBranch ?? [], collection, id)
        || commandListReferences(command.defeatBranch ?? [], collection, id);
    case "changeExp":
      return collection === "actors" && Boolean(command.actorId) && command.actorId === id;
    case "changeLevel":
    case "changeActorHp":
    case "changeActorMp":
    case "changeParty":
      return collection === "actors" && command.actorId === id;
    case "changeEquipment":
      return (collection === "actors" && command.actorId === id) || (collection === "equipment" && command.equipmentId === id);
    case "recoverAll":
      return collection === "actors" && command.actorId === id;
    case "changeItem":
      return collection === "items" && command.itemId === id;
    case "changeLifeSkillExp":
      return collection === "lifeSkills" && command.skillId === id;
    case "craftRecipe":
      return collection === "craftRecipes" && command.recipeId === id;
    case "applyItemUpgrade":
      return collection === "itemUpgrades" && command.upgradeId === id;
    // ── 아래 넷은 로드 검증기(commandReferenceValidation)가 이미 하드 참조로 다루는데
    //    삭제 가드에는 빠져 있었다. 커버리지가 어긋나면 "경고 없이 삭제 → 다음 로드에서
    //    프로젝트가 안 열림"이 된다(2026-09-19 리뷰 P0-6). 검증기에 케이스를 더할 때
    //    여기에도 같이 더할 것. ──
    case "showAnimation":
      return collection === "battleAnimations" && command.animationId === id;
    case "enterHeroName":
      return collection === "actors" && command.actorId === id;
    case "addFollower":
      return collection === "actors" && Boolean(command.actorId) && command.actorId === id;
    case "equipTool":
      return collection === "items" && Boolean(command.itemId) && command.itemId === id;
    default:
      return false;
  }
}

function eventGiftPrefsReferences(event: { readonly giftPrefs?: GiftPrefs }, collection: CommandReferenceCollection, id: string): boolean {
  if (collection !== "items") return false;
  const prefs = event.giftPrefs;
  return Boolean(prefs && [...(prefs.loved ?? []), ...(prefs.liked ?? []), ...(prefs.disliked ?? [])].includes(id));
}

function conditionReferencesDatabase(condition: Condition | BattleEventCondition | undefined, collection: CommandReferenceCollection, id: string): boolean {
  if (!condition) return false;
  switch (condition.kind) {
    case "monsterSpecies":
      return collection === "monsterSpecies" && condition.speciesId === id;
    case "actor":
    case "actorHp":
    case "actorTurn":
    case "actorCommand":
      return collection === "actors" && condition.actorId === id;
    case "item":
      return collection === "items" && condition.itemId === id;
    case "enemyHp":
    case "enemyTurn":
      return collection === "enemies" && condition.enemyId === id;
    case "enemyHpBelow":
      return collection === "enemies" && condition.enemyId === id;
    // fix(db): all/any/not 안에 숨은 참조도 봐야 한다. 여기서 멈추면 AND 그룹 안에서만
    // 쓰이는 레코드가 경고 없이 삭제되고, 남은 조건이 사라진 id를 읽어 조용히 죽는다.
    case "all":
    case "any":
      return condition.conditions.some((child) => conditionReferencesDatabase(child, collection, id));
    case "not":
      return conditionReferencesDatabase(condition.condition, collection, id);
    default:
      return false;
  }
}

function commandListResourceReferences(commands: readonly Command[], resourceId: string): boolean {
  return commands.some((command) => commandResourceReferences(command, resourceId));
}

function commandResourceReferences(command: Command, resourceId: string): boolean {
  switch (command.kind) {
    case "changeFace":
      return command.resourceId === resourceId;
    case "choices":
      return command.options.some((option) => commandListResourceReferences(option.branch, resourceId)) || commandListResourceReferences(command.cancelBranch ?? [], resourceId);
    case "presentItem":
      return presentItemBranchLists(command).some((branch) => commandListResourceReferences(branch, resourceId));
    case "fork":
      return commandListResourceReferences(command.then, resourceId) || commandListResourceReferences(command.else ?? [], resourceId);
    case "loop":
      return commandListResourceReferences(command.body, resourceId);
    case "moveEvent":
      return moveRouteResourceReferences(command.route.moves, resourceId);
    case "shop":
      return commandListResourceReferences(command.transactionBranch ?? [], resourceId);
    case "inn":
      return commandListResourceReferences(command.notEnoughBranch ?? [], resourceId);
    case "promoteActor":
      return commandListResourceReferences(command.successBranch ?? [], resourceId) || commandListResourceReferences(command.failureBranch ?? [], resourceId);
    case "evolveMonster":
      return commandListResourceReferences(command.successBranch ?? [], resourceId) || commandListResourceReferences(command.failureBranch ?? [], resourceId);
    case "showPicture":
    case "playAudio":
      return command.resourceId === resourceId;
    default:
      return false;
  }
}

function moveRouteResourceReferences(commands: readonly MoveCommand[], resourceId: string): boolean {
  return commands.some((command) => (command.kind === "changeGraphic" && command.spriteId === resourceId) || (command.kind === "playSe" && command.resourceId === resourceId));
}

function commandListReferencesSwitchVariable(commands: readonly Command[], kind: "switch" | "variable", id: string): boolean {
  return commands.some((command) => commandReferencesSwitchVariable(command, kind, id));
}

function commandReferencesSwitchVariable(command: Command, kind: "switch" | "variable", id: string): boolean {
  switch (command.kind) {
    case "choices":
      return command.options.some((option) => commandListReferencesSwitchVariable(option.branch, kind, id)) || commandListReferencesSwitchVariable(command.cancelBranch ?? [], kind, id);
    case "presentItem":
      return presentItemBranchLists(command).some((branch) => commandListReferencesSwitchVariable(branch, kind, id));
    case "fork":
      return conditionReferencesSwitchVariable(command.condition, kind, id) || commandListReferencesSwitchVariable(command.then, kind, id) || commandListReferencesSwitchVariable(command.else ?? [], kind, id);
    case "loop":
      return commandListReferencesSwitchVariable(command.body, kind, id);
    case "shop":
      return commandListReferencesSwitchVariable(command.transactionBranch ?? [], kind, id)
        || commandListReferencesSwitchVariable(command.failedTransactionBranch ?? [], kind, id);
    case "tacticsBattle":
      return commandListReferencesSwitchVariable(command.victoryBranch ?? [], kind, id)
        || commandListReferencesSwitchVariable(command.defeatBranch ?? [], kind, id);
    case "battleProcessing":
      return commandListReferencesSwitchVariable(command.victoryBranch ?? [], kind, id)
        || commandListReferencesSwitchVariable(command.defeatBranch ?? [], kind, id)
        || commandListReferencesSwitchVariable(command.escapeBranch ?? [], kind, id);
    case "inn":
      return commandListReferencesSwitchVariable(command.notEnoughBranch ?? [], kind, id);
    case "getFriendship":
      return kind === "variable" && command.variableId === id;
    case "craftRecipe":
    case "applyItemUpgrade":
      return kind === "variable" && command.resultVariableId === id;
    case "promoteActor":
      return commandListReferencesSwitchVariable(command.successBranch ?? [], kind, id) || commandListReferencesSwitchVariable(command.failureBranch ?? [], kind, id);
    case "evolveMonster":
      return commandListReferencesSwitchVariable(command.successBranch ?? [], kind, id) || commandListReferencesSwitchVariable(command.failureBranch ?? [], kind, id);
    case "inputWait":
    case "wait":
    case "inputNumber":
      return kind === "variable" && command.variableId === id;
    case "setSwitch":
      return (kind === "switch" && command.switchId === id)
        || (kind === "variable" && typeof command.value === "object" && command.value !== null && command.value.kind === "var" && command.value.id === id);
    case "setVariable":
      return kind === "variable" && (command.variableId === id || (typeof command.value !== "number" && command.value.id === id));
    case "changeGold":
    case "changeItem":
    case "changeExp":
      return kind === "variable" && typeof command.amount !== "number" && command.amount.id === id;
    case "moveEvent":
      return command.route.moves.some((move) => move.kind === "setSwitch" && kind === "switch" && move.switchId === id);
    default:
      return false;
  }
}

function conditionReferencesSwitchVariable(condition: Condition | BattleEventCondition | undefined, kind: "switch" | "variable", id: string): boolean {
  if (!condition) return false;
  switch (condition.kind) {
    case "switch":
      return kind === "switch" && condition.switchId === id;
    case "variable":
      return kind === "variable" && condition.variableId === id;
    // fix(db): 복합 조건으로 내려가지 않으면 그 안에서만 쓰이는 스위치/변수가 참조 없음으로
    // 판정되어 deleteSwitch/deleteVariable이 경고 없이 지워버린다.
    case "all":
    case "any":
      return condition.conditions.some((child) => conditionReferencesSwitchVariable(child, kind, id));
    case "not":
      return conditionReferencesSwitchVariable(condition.condition, kind, id);
    default:
      return false;
  }
}
