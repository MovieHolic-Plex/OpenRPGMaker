import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { COMMAND_KIND_OPTIONS, PAGE_COMMAND_BUTTONS, commandKindLabel } from "@/editor/panels/eventEditor/options";
import { EVENT_COMMAND_PICKER_NATIVE_KINDS } from "@/editor/panels/eventEditor/commandPicker";

const EXPECTED_COMMAND_KINDS = [
  "text",
  "displayTextSettings",
  "changeFace",
  "choices",
  "fork",
  "setSwitch",
  "setVariable",
  "timer",
  "advanceTime",
  "advanceCropGrowth",
  "setTime",
  "sleepUntilMorning",
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
  "craftRecipe",
  "applyItemUpgrade",
  "equipTool",
  "openChest",
  "changeFriendship",
  "getFriendship",
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

  it("does not surface internal M2 jargon as the m2Command display label", () => {
    expect(commandKindLabel("m2Command")).toBe("이벤트 명령");
    expect(commandKindLabel("m2Command")).not.toMatch(/M2|현대/);
  });

  it("exposes transfer as an event page quick command", () => {
    expect(PAGE_COMMAND_BUTTONS).toContainEqual({
      kind: "transfer",
      testId: "command-add-transfer",
      label: "장소 이동",
    });
  });

  it.each([
    ["craftRecipe", "command-add-craft", "제작"],
    ["applyItemUpgrade", "command-add-upgrade", "업그레이드"],
    ["equipTool", "command-add-equip-tool", "도구 장착"],
    ["openChest", "command-add-open-chest", "보관 상자"],
  ] as const)("exposes %s through the page quick-authoring route", (kind, testId, label) => {
    expect(PAGE_COMMAND_BUTTONS).toContainEqual({ kind, testId, label });
    expect(commandKindLabel(kind)).toBe(label);
    expect(EVENT_COMMAND_PICKER_NATIVE_KINDS).toContain(kind);
  });

});
