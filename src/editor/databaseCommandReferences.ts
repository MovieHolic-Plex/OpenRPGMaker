import type { DatabaseCollection } from "@/editor/databaseActions";
import type { BattleEventCondition, Command, Condition, GiftPrefs, MoveCommand, Project } from "@/project/types";

type CommandReferenceCollection = DatabaseCollection | "monsterSpecies";

export function commandsReference(project: Project, collection: CommandReferenceCollection, id: string): boolean {
  return (
    project.commonEvents.some((event) => commandListReferences(event.commands, collection, id)) ||
    Object.values(project.maps).some((map) =>
      map.events.some(
        (event) =>
          conditionReferencesDatabase(event.condition, collection, id) ||
          eventGiftPrefsReferences(event, collection, id) ||
          commandListReferences(event.commands, collection, id) ||
          (event.pages ?? []).some(
            (page) =>
              page.conditions.some((condition) => conditionReferencesDatabase(condition, collection, id)) ||
              commandListReferences(page.commands, collection, id)
          )
      )
    ) ||
    project.database.troops.some((troop) =>
      troop.battleEventPages.some(
        (page) =>
          page.conditions.some((condition) => conditionReferencesDatabase(condition, collection, id)) ||
          commandListReferences(page.commands, collection, id)
      )
    )
  );
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
    project.database.troops.some((troop) => troop.battleEventPages.some((page) => commandListResourceReferences(page.commands, resourceId)))
  );
}

export function switchVariableReferencedInProject(project: Project, kind: "switch" | "variable", id: string): boolean {
  return (
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
      )
    )
  );
}

function commandListReferences(commands: readonly Command[], collection: CommandReferenceCollection, id: string): boolean {
  return commands.some((command) => commandReferences(command, collection, id));
}

function commandReferences(command: Command, collection: CommandReferenceCollection, id: string): boolean {
  switch (command.kind) {
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
      ) || commandListReferences(command.transactionBranch ?? [], collection, id);
    case "promoteActor":
      return (collection === "actors" && command.actorId === id) ||
        (collection === "classes" && command.toClassId === id) ||
        commandListReferences(command.successBranch ?? [], collection, id) ||
        commandListReferences(command.failureBranch ?? [], collection, id);
    case "evolveMonster":
      return (collection === "monsterSpecies" && command.toSpeciesId === id) ||
        commandListReferences(command.successBranch ?? [], collection, id) ||
        commandListReferences(command.failureBranch ?? [], collection, id);
    case "learnSkill":
      return (collection === "actors" && command.actorId === id) || (collection === "skills" && command.skillId === id);
    case "battleProcessing":
      return collection === "troops" && command.troopId === id;
    case "changeExp":
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
    case "fork":
      return commandListResourceReferences(command.then, resourceId) || commandListResourceReferences(command.else ?? [], resourceId);
    case "loop":
      return commandListResourceReferences(command.body, resourceId);
    case "moveEvent":
      return moveRouteResourceReferences(command.route.moves, resourceId);
    case "shop":
      return commandListResourceReferences(command.transactionBranch ?? [], resourceId);
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
    case "fork":
      return conditionReferencesSwitchVariable(command.condition, kind, id) || commandListReferencesSwitchVariable(command.then, kind, id) || commandListReferencesSwitchVariable(command.else ?? [], kind, id);
    case "loop":
      return commandListReferencesSwitchVariable(command.body, kind, id);
    case "shop":
      return commandListReferencesSwitchVariable(command.transactionBranch ?? [], kind, id);
    case "getFriendship":
      return kind === "variable" && command.variableId === id;
    case "promoteActor":
      return commandListReferencesSwitchVariable(command.successBranch ?? [], kind, id) || commandListReferencesSwitchVariable(command.failureBranch ?? [], kind, id);
    case "evolveMonster":
      return commandListReferencesSwitchVariable(command.successBranch ?? [], kind, id) || commandListReferencesSwitchVariable(command.failureBranch ?? [], kind, id);
    case "inputWait":
    case "inputNumber":
      return kind === "variable" && command.variableId === id;
    case "setSwitch":
      return kind === "switch" && command.switchId === id;
    case "setVariable":
      return kind === "variable" && (command.variableId === id || (typeof command.value !== "number" && command.value.id === id));
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
    default:
      return false;
  }
}
