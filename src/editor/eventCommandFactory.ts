import type { Command } from "@/project/types";
import { createDefaultM2Fields, M2_COMMAND_CATALOG, m2CommandById } from "@/editor/eventCommands/m2Catalog";

export function newCommand(kind: Command["kind"]): Command {
  switch (kind) {
    case "text":
      return { kind: "text", speaker: "", body: "" };
    case "changeFace":
      return { kind: "changeFace", resourceId: "easyrpg-faceset-actor1", faceIndex: 0, position: "left", flipHorizontally: false };
    case "choices":
      return { kind: "choices", prompt: "", options: [{ text: "Yes", branch: [] }, { text: "No", branch: [] }], cancelBehavior: "choice2" };
    case "fork":
      return { kind: "fork", condition: { kind: "switch", switchId: "", value: true }, then: [{ kind: "text", body: "" }] };
    case "wait":
      return { kind: "wait", ms: 500 };
    case "inputWait":
      return { kind: "inputWait" };
    case "inputNumber":
      return { kind: "inputNumber", variableId: "", digits: 1 };
    case "label":
      return { kind: "label", name: "L1" };
    case "gotoLabel":
      return { kind: "gotoLabel", name: "L1" };
    case "setSwitch":
      return { kind: "setSwitch", switchId: "", value: true };
    case "setVariable":
      return { kind: "setVariable", variableId: "", op: "=", value: 0 };
    case "timer":
      return { kind: "timer", action: "set", seconds: 60 };
    case "transfer":
      return { kind: "transfer", mapId: "", x: 0, y: 0 };
    case "moveEvent":
      return { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } };
    case "changeTile":
      return { kind: "changeTile", mapId: "", layer: "lower", x: 0, y: 0, tile: 0 };
    case "callCommonEvent":
      return { kind: "callCommonEvent", commonEventId: "" };
    case "battleProcessing":
      return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
    case "learnSkill":
      return { kind: "learnSkill", actorId: "", skillId: "" };
    case "changeGold":
      return { kind: "changeGold", op: "+=", amount: 10 };
    case "changeItem":
      return { kind: "changeItem", itemId: "", op: "+=", amount: 1 };
    case "changeParty":
      return { kind: "changeParty", actorId: "", action: "add" };
    case "showPicture":
      return { kind: "showPicture", pictureId: "pic1", resourceId: "tex_tiles_default", x: 0, y: 0 };
    case "erasePicture":
      return { kind: "erasePicture", pictureId: "pic1" };
    case "playAudio":
      return { kind: "playAudio", resourceId: "", loop: false };
    case "stopAudio":
      return { kind: "stopAudio" };
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
        branchOnTransaction: false,
        transactionBranch: [],
      };
    case "inn":
      return { kind: "inn", price: 0 };
    case "gameOver":
      return { kind: "gameOver" };
    case "ending":
      return { kind: "ending", title: "The End", message: "Thank you for playing." };
    case "returnToTitle":
      return { kind: "returnToTitle" };
    case "setFlag":
      return { kind: "setFlag", flag: "flag1", value: true };
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
