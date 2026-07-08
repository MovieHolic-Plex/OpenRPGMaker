import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { COMMAND_KIND_OPTIONS, PAGE_COMMAND_BUTTONS, commandKindLabel } from "@/editor/panels/eventEditor/options";

const EXPECTED_COMMAND_KINDS = [
  "text",
  "displayTextSettings",
  "changeFace",
  "choices",
  "fork",
  "setSwitch",
  "setVariable",
  "timer",
  "inputNumber",
  "inputWait",
  "label",
  "gotoLabel",
  "loop",
  "breakLoop",
  "transfer",
  "moveEvent",
  "setEventGraphicPattern",
  "changeTile",
  "callCommonEvent",
  "callMapEvent",
  "battleProcessing",
  "learnSkill",
  "changeExp",
  "changeLevel",
  "promoteActor",
  "changeEquipment",
  "changeActorHp",
  "changeActorMp",
  "recoverAll",
  "enterHeroName",
  "changeGold",
  "changeItem",
  "changeParty",
  "giveMonster",
  "moveMonster",
  "evolveMonster",
  "addFollower",
  "removeFollower",
  "setLighting",
  "addLight",
  "removeLight",
  "setWeather",
  "showAnimation",
  "showPicture",
  "erasePicture",
  "playAudio",
  "stopAudio",
  "cutsceneControl",
  "shop",
  "inn",
  "checkpointSave",
  "killPlayer",
  "triggerEnding",
  "gameOver",
  "ending",
  "returnToTitle",
  "wait",
  "setFlag",
  "setSelfSwitch",
  "m2Command",
] as const satisfies readonly Command["kind"][];

type MissingCommandKind = Exclude<Command["kind"], (typeof EXPECTED_COMMAND_KINDS)[number]>;
const allCommandKindsCovered: MissingCommandKind extends never ? true : never = true;
void allCommandKindsCovered;

describe("event editor command labels", () => {
  it("uses Korean labels for shop and inn commands", () => {
    expect(commandKindLabel("shop")).toBe("상점 처리");
    expect(commandKindLabel("inn")).toBe("여관 처리");
  });

  it("has one display option for every command kind", () => {
    expect(COMMAND_KIND_OPTIONS.map((option) => option.value)).toEqual(EXPECTED_COMMAND_KINDS);
  });

  it("uses each command kind option label instead of the fallback value", () => {
    for (const option of COMMAND_KIND_OPTIONS) {
      expect(commandKindLabel(option.value)).toBe(option.label);
      expect(commandKindLabel(option.value)).not.toBe(option.value);
    }
  });

  it("exposes transfer as an event page quick command", () => {
    expect(PAGE_COMMAND_BUTTONS).toContainEqual({
      kind: "transfer",
      testId: "command-add-transfer",
      label: "장소 이동",
    });
  });

});
