import { newCommand } from "@/editor/eventCommandFactory";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import type { ReferenceContext } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Command, Project } from "@/project/types";

export const AUTHORING_EVENT_ID = "event_authoring_matrix";
export const AUTHORING_TARGET_EVENT_ID = "event_authoring_target";

export type FixtureIds = {
  readonly actorId: string;
  readonly animationId: string;
  readonly classId: string;
  readonly commonEventId: string;
  readonly endingId: string;
  readonly equipmentId: string;
  readonly itemId: string;
  readonly mapId: string;
  readonly resourceId: string;
  readonly skillId: string;
  readonly speciesId: string;
  readonly switchId: string;
  readonly troopId: string;
  readonly variableId: string;
};

export type AuthoringReferenceFixture = {
  readonly project: Project;
  readonly ids: FixtureIds;
};

export function createAuthoringReferenceFixture(): AuthoringReferenceFixture {
  const project = createBlankProject();
  const commonEventId = "common_authoring_matrix";
  const endingId = "ending_authoring_matrix";
  project.commonEvents.push({ id: commonEventId, name: "작성 매트릭스", trigger: "none", commands: [] });
  project.endings = [{ id: endingId, name: "작성 매트릭스", conditions: [], priority: 1 }];
  project.maps[project.startMapId]?.events.push({
    id: AUTHORING_TARGET_EVENT_ID,
    characterId: "character_authoring_target",
    x: 2,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
  });
  const resourceId = requiredValue([...collectResourceIds(project)].sort()[0], "resource");
  return {
    project,
    ids: {
      actorId: requiredRecordId(project.database.actors, "actor"),
      animationId: requiredRecordId(project.database.battleAnimations, "animation"),
      classId: requiredRecordId(project.database.classes, "class"),
      commonEventId,
      endingId,
      equipmentId: requiredRecordId(project.database.equipment, "equipment"),
      itemId: requiredRecordId(project.database.items, "item"),
      mapId: project.startMapId,
      resourceId,
      skillId: requiredRecordId(project.database.skills, "skill"),
      speciesId: requiredRecordId(project.database.monsterSpecies ?? [], "monster species"),
      switchId: requiredRecordId(project.switches, "switch"),
      troopId: requiredRecordId(project.database.troops, "troop"),
      variableId: requiredRecordId(project.variables, "variable"),
    },
  };
}

export function buildHydratedAuthoringCommands(fixture: AuthoringReferenceFixture): readonly Command[] {
  return COMMAND_KINDS.map((kind) => hydrateCommand(newCommand(kind), fixture.ids));
}

export function buildReferenceContext(project: Project): ReferenceContext {
  return {
    actorIds: new Set(project.database.actors.map((record) => record.id)),
    classIds: new Set(project.database.classes.map((record) => record.id)),
    enemyIds: new Set(project.database.enemies.map((record) => record.id)),
    itemIds: new Set(project.database.items.map((record) => record.id)),
    equipmentIds: new Set(project.database.equipment.map((record) => record.id)),
    skillIds: new Set(project.database.skills.map((record) => record.id)),
    animationIds: new Set(project.database.battleAnimations.map((record) => record.id)),
    switchIds: new Set(project.switches.map((record) => record.id)),
    variableIds: new Set(project.variables.map((record) => record.id)),
    commonEventIds: new Set(project.commonEvents.map((record) => record.id)),
    endingIds: new Set((project.endings ?? []).map((record) => record.id)),
    mapIds: new Set(Object.keys(project.maps)),
    troopIds: new Set(project.database.troops.map((record) => record.id)),
    speciesIds: new Set((project.database.monsterSpecies ?? []).map((record) => record.id)),
    resourceIds: collectResourceIds(project),
  };
}

function hydrateCommand(command: Command, ids: FixtureIds): Command {
  switch (command.kind) {
    case "changeFace":
      return { ...command, resourceId: ids.resourceId };
    case "fork":
      return { ...command, condition: { kind: "switch", switchId: ids.switchId, value: true } };
    case "inputWait":
      return { ...command, variableId: ids.variableId };
    case "inputNumber":
      return { ...command, variableId: ids.variableId };
    case "setSwitch":
      return { ...command, switchId: ids.switchId };
    case "setVariable":
      return { ...command, variableId: ids.variableId };
    case "transfer":
      return { ...command, mapId: ids.mapId };
    case "moveEvent":
      return { ...command, eventId: AUTHORING_TARGET_EVENT_ID };
    case "setEventGraphicPattern":
      return { ...command, eventId: AUTHORING_TARGET_EVENT_ID };
    case "changeTile":
      return { ...command, mapId: ids.mapId };
    case "callCommonEvent":
      return { ...command, commonEventId: ids.commonEventId };
    case "callMapEvent":
      return { ...command, eventId: AUTHORING_TARGET_EVENT_ID };
    case "battleProcessing":
      return { ...command, troopId: ids.troopId };
    case "learnSkill":
      return { ...command, actorId: ids.actorId, skillId: ids.skillId };
    case "changeExp":
    case "changeLevel":
    case "changeActorHp":
    case "changeActorMp":
      return { ...command, actorId: ids.actorId };
    case "promoteActor":
      return { ...command, actorId: ids.actorId, toClassId: ids.classId };
    case "changeEquipment":
      return { ...command, actorId: ids.actorId, equipmentId: ids.equipmentId };
    case "recoverAll":
      return { ...command, actorId: ids.actorId };
    case "enterHeroName":
      return { ...command, actorId: ids.actorId };
    case "changeItem":
      return { ...command, itemId: ids.itemId };
    case "craftRecipe":
      return { ...command, recipeId: "recipe_authoring_matrix" };
    case "applyItemUpgrade":
      return { ...command, upgradeId: "upgrade_authoring_matrix" };
    case "equipTool":
      return { ...command, itemId: ids.itemId };
    case "openChest":
      return { ...command, chestId: "chest_authoring_matrix" };
    case "changeFriendship":
      return { ...command, npcKey: "character_authoring_matrix" };
    case "getFriendship":
      return { ...command, npcKey: "character_authoring_matrix", variableId: ids.variableId };
    case "changeParty":
      return { ...command, actorId: ids.actorId };
    case "giveMonster":
      return { ...command, speciesId: ids.speciesId };
    case "moveMonster":
      return { ...command, instanceId: "monster_authoring_matrix" };
    case "evolveMonster":
      return { ...command, instanceId: "monster_authoring_matrix", toSpeciesId: ids.speciesId };
    case "addFollower":
      return { ...command, actorId: ids.actorId };
    case "showAnimation":
      return { ...command, animationId: ids.animationId };
    case "showPicture":
    case "playAudio":
      return { ...command, resourceId: ids.resourceId };
    case "shop":
      return { ...command, itemIds: [ids.itemId] };
    case "triggerEnding":
      return { ...command, endingId: ids.endingId };
    case "m2Command":
      return {
        kind: "m2Command",
        commandId: "m2-088-comment",
        fields: { comment: "authoring fixture", color: "green" },
      };
    case "text":
    case "choices":
    case "wait":
    case "label":
    case "gotoLabel":
    case "loop":
    case "breakLoop":
    case "timer":
    case "advanceTime":
    case "advanceCropGrowth":
    case "setTime":
    case "sleepUntilMorning":
    case "changeGold":
    case "removeFollower":
    case "setLighting":
    case "addLight":
    case "removeLight":
    case "setWeather":
    case "erasePicture":
    case "stopAudio":
    case "cutsceneControl":
    case "displayTextSettings":
    case "inn":
    case "checkpointSave":
    case "killPlayer":
    case "gameOver":
    case "ending":
    case "returnToTitle":
    case "setFlag":
    case "setSelfSwitch":
      return command;
    default:
      return assertUnhandledCommand(command);
  }
}

function requiredRecordId(records: readonly { readonly id: string }[], label: string): string {
  return requiredValue(records[0]?.id, label);
}

function requiredValue(value: string | undefined, label: string): string {
  if (value) return value;
  throw new Error(`blank project is missing ${label}`);
}

function assertUnhandledCommand(command: never): never {
  throw new Error(`unhandled command fixture: ${JSON.stringify(command)}`);
}

export function commandByKind(commands: readonly Command[], kind: CommandKind): Command {
  const command = commands.find((candidate) => candidate.kind === kind);
  if (command) return command;
  throw new Error(`missing hydrated authoring command: ${kind}`);
}
