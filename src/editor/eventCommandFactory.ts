import type { Command } from "@/project/types";
import { createDefaultM2Fields, M2_COMMAND_CATALOG, m2CommandById } from "@/project/eventCommands/m2Catalog";

export function newCommand(kind: Command["kind"]): Command {
  switch (kind) {
    case "text":
      return { kind: "text", speaker: "", body: "" };
    case "changeFace":
      return { kind: "changeFace", resourceId: "easyrpg-faceset-actor1", faceIndex: 0, position: "left", flipHorizontally: false };
    case "choices":
      return { kind: "choices", prompt: "", options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }], cancelBehavior: "choice2" };
    case "fork":
      return { kind: "fork", condition: { kind: "switch", switchId: "", value: true }, then: [{ kind: "text", body: "" }] };
    case "wait":
      return { kind: "wait", ms: 500 };
    case "inputWait":
      return { kind: "inputWait", variableId: "" };
    case "inputNumber":
      return { kind: "inputNumber", variableId: "", digits: 1 };
    case "label":
      return { kind: "label", name: "L1" };
    case "gotoLabel":
      return { kind: "gotoLabel", name: "L1" };
    case "loop":
      return { kind: "loop", body: [{ kind: "text", body: "" }] };
    case "breakLoop":
      return { kind: "breakLoop" };
    case "setSwitch":
      return { kind: "setSwitch", switchId: "", value: true };
    case "setVariable":
      return { kind: "setVariable", variableId: "", op: "=", value: 0 };
    case "timer":
      return { kind: "timer", action: "set", seconds: 60, timerId: "timer1" };
    case "advanceTime":
      return { kind: "advanceTime", minutes: 10 };
    case "advanceCropGrowth":
      return { kind: "advanceCropGrowth", days: 1 };
    case "setTime":
      return { kind: "setTime", hour: 6, minute: 0 };
    case "sleepUntilMorning":
      return { kind: "sleepUntilMorning" };
    case "transfer":
      return { kind: "transfer", mapId: "", x: 0, y: 0, direction: "retain", fade: "black" };
    case "moveEvent":
      return { kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "down" }], repeat: false } };
    case "setEventGraphicPattern":
      return { kind: "setEventGraphicPattern", eventId: "", pattern: 0 };
    case "changeTile":
      return { kind: "changeTile", mapId: "", layer: "lower", x: 0, y: 0, tile: 0 };
    case "callCommonEvent":
      return { kind: "callCommonEvent", commonEventId: "" };
    case "callMapEvent":
      return { kind: "callMapEvent", eventId: "" };
    case "battleProcessing":
      return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
    case "learnSkill":
      return { kind: "learnSkill", actorId: "", skillId: "" };
    case "changeExp":
      return { kind: "changeExp", actorId: "", op: "+=", amount: 10 };
    case "changeLevel":
      return { kind: "changeLevel", actorId: "", op: "+=", amount: 1 };
    case "changeLifeSkillExp":
      return { kind: "changeLifeSkillExp", skillId: "", op: "+=", amount: 10 };
    case "promoteActor":
      return { kind: "promoteActor", actorId: "", toClassId: "", successBranch: [], failureBranch: [] };
    case "changeEquipment":
      return { kind: "changeEquipment", actorId: "", slot: "weapon", equipmentId: "" };
    case "changeActorHp":
      return { kind: "changeActorHp", actorId: "", op: "-=", amount: 10 };
    case "changeActorMp":
      return { kind: "changeActorMp", actorId: "", op: "-=", amount: 5 };
    case "recoverAll":
      return { kind: "recoverAll", actorId: "" };
    case "enterHeroName":
      return { kind: "enterHeroName", actorId: "", maxLength: 6, showInitialName: true };
    case "changeGold":
      return { kind: "changeGold", op: "+=", amount: 10 };
    case "changeItem":
      return { kind: "changeItem", itemId: "", op: "+=", amount: 1 };
    case "craftRecipe":
      return { kind: "craftRecipe", recipeId: "" };
    case "applyItemUpgrade":
      return { kind: "applyItemUpgrade", upgradeId: "" };
    case "equipTool":
      return { kind: "equipTool", itemId: "" };
    case "openChest":
      return { kind: "openChest", chestId: "" };
    case "changeFriendship":
      return { kind: "changeFriendship", npcKey: "", delta: 20 };
    case "getFriendship":
      return { kind: "getFriendship", npcKey: "", variableId: "" };
    case "changeParty":
      return { kind: "changeParty", actorId: "", action: "add" };
    case "giveMonster":
      return { kind: "giveMonster", speciesId: "species_wild_slime", level: 5 };
    case "moveMonster":
      return { kind: "moveMonster", instanceId: "", to: "party" };
    case "evolveMonster":
      return { kind: "evolveMonster", instanceId: "", toSpeciesId: "", successBranch: [], failureBranch: [] };
    case "addFollower":
      return { kind: "addFollower", actorId: "", name: "" };
    case "removeFollower":
      return { kind: "removeFollower", all: true };
    case "setLighting":
      return { kind: "setLighting", ambient: 0.85, color: "#000000", transitionMs: 0 };
    case "addLight":
      return { kind: "addLight", source: { id: "light_1", at: "player", radius: 4, intensity: 1 } };
    case "removeLight":
      return { kind: "removeLight", all: true };
    case "setWeather":
      return { kind: "setWeather", weather: "rain", intensity: 0.5, transitionMs: 0 };
    case "showAnimation":
      return { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: false };
    case "showPicture":
      return { kind: "showPicture", pictureId: "pic1", resourceId: "tex_tiles_default", x: 0, y: 0 };
    case "erasePicture":
      return { kind: "erasePicture", pictureId: "pic1" };
    case "playAudio":
      return { kind: "playAudio", resourceId: "", loop: false };
    case "stopAudio":
      return { kind: "stopAudio" };
    case "cutsceneControl":
      return { kind: "cutsceneControl", mode: "begin", skippable: false };
    case "displayTextSettings":
      return {
        kind: "displayTextSettings",
        format: "normal",
        position: "bottom",
        preventObscuringPlayer: true,
        allowEventMovementDuringWait: false,
      };
    case "shop":
      return {
        kind: "shop",
        itemIds: [],
        allowSell: true,
        quantityMode: "single",
        shopType: "normal",
        messageType: "welcome",
        merchantGold: 100,
        branchOnTransaction: false,
        transactionBranch: [],
        branchOnFailedTransaction: false,
        failedTransactionBranch: [],
      };
    case "inn":
      return { kind: "inn", price: 20 };
    case "checkpointSave":
      return { kind: "checkpointSave" };
    case "openSaveMenu":
      return { kind: "openSaveMenu" };
    case "spawnFieldEnemy":
      return { kind: "spawnFieldEnemy", spawn: { id: "spawn_new", troopId: "", area: { x: 0, y: 0, w: 3, h: 3 }, chase: true } };
    case "despawnFieldEnemy":
      return { kind: "despawnFieldEnemy", spawnId: "" };
    case "runControl":
      return { kind: "runControl", action: "start" };
    case "killPlayer":
      return { kind: "killPlayer", message: "" };
    case "triggerEnding":
      return { kind: "triggerEnding" };
    case "gameOver":
      return { kind: "gameOver" };
    case "ending":
      return { kind: "ending", title: "The End", message: "Thank you for playing." };
    case "returnToTitle":
      return { kind: "returnToTitle" };
    case "setFlag":
      return { kind: "setFlag", flag: "flag1", value: true };
    case "setSelfSwitch":
      return { kind: "setSelfSwitch", key: "A", value: true };
    case "m2Command":
      return newM2Command(M2_COMMAND_CATALOG[0]?.id ?? "m2-unknown");
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return { kind: "text", body: "" };
    }
  }
}

export function newM2Command(commandId: string): Extract<Command, { kind: "m2Command" }> {
  const entry = m2CommandById(commandId);
  return {
    kind: "m2Command",
    commandId,
    fields: entry ? createDefaultM2Fields(entry) : {},
  };
}
