// Command/Condition kind 유니온의 단일 진실 소스.
//
// 배경: types/events.ts(타입), io/guards.ts(화이트리스트), io/shapeCommandFields.ts(shape 검증),
// io/commandReferenceValidation.ts(참조 검증), player/interpreter/commandCatalog.ts(런타임)
// 5곳에 kind 유니온이 수동 중복되어 드리프트가 반복 발생했다(loop/breakLoop/setSelfSwitch 등).
// 이 파일의 배열이 유일한 소스이며, 아래 타입 레벨 검증이 유니온과의 불일치를 컴파일 에러로 잡는다.
//
// - COMMAND_KINDS가 Command["kind"]에 없는 값을 담으면: `satisfies` 가 즉시 컴파일 에러.
// - Command["kind"]에 COMMAND_KINDS가 놓친 값이 있으면: AssertNoMissingCommandKind가 컴파일 에러.
// (Condition도 동일한 두 방향 검증을 CONDITION_KINDS로 수행한다.)
import type { Command, Condition } from "./types";

export const COMMAND_KINDS = [
  "text",
  "changeFace",
  "choices",
  "fork",
  "wait",
  "inputWait",
  "inputNumber",
  "label",
  "gotoLabel",
  "loop",
  "breakLoop",
  "setSwitch",
  "setVariable",
  "timer",
  "advanceTime",
  "advanceCropGrowth",
  "setTime",
  "sleepUntilMorning",
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
  "changeLifeSkillExp",
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
  "setRelationship",
  "changeFactionStance",
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
  "showEmote",
  "showPicture",
  "erasePicture",
  "playAudio",
  "stopAudio",
  "playMovie",
  "cutsceneControl",
  "displayTextSettings",
  "shop",
  "inn",
  "checkpointSave",
  "openSaveMenu",
  "spawnFieldEnemy",
  "despawnFieldEnemy",
  "runControl",
  "killPlayer",
  "triggerEnding",
  "gameOver",
  "ending",
  "returnToTitle",
  "setFlag",
  "setSelfSwitch",
  "m2Command",
] as const satisfies readonly Command["kind"][];

export type CommandKind = (typeof COMMAND_KINDS)[number];

// Command["kind"] 유니온에는 있지만 COMMAND_KINDS에는 없는 값이 생기면 MissingCommandKind가
// never가 아니게 되어, 아래 대입이 컴파일 에러를 낸다(신규 kind 추가 시 이 파일 수정을 강제).
type MissingCommandKind = Exclude<Command["kind"], CommandKind>;
type AssertNoMissingCommandKind = MissingCommandKind extends never
  ? true
  : ["commandKindRegistry.ts: COMMAND_KINDS에 누락된 command kind가 있습니다", MissingCommandKind];
export const ASSERT_NO_MISSING_COMMAND_KIND: AssertNoMissingCommandKind = true;

export const CONDITION_KINDS = [
  "switch",
  "variable",
  "selfSwitch",
  "actor",
  "item",
  "gold",
  "timer",
  "timePhase",
  "season",
  "npcActivity",
  "insideLocation",
  "friendshipAtLeast",
  "relationshipAtLeast",
  "battleResult",
  "run",
  "all",
  "any",
  "not",
] as const satisfies readonly Condition["kind"][];

export type ConditionKind = (typeof CONDITION_KINDS)[number];

type MissingConditionKind = Exclude<Condition["kind"], ConditionKind>;
type AssertNoMissingConditionKind = MissingConditionKind extends never
  ? true
  : ["commandKindRegistry.ts: CONDITION_KINDS에 누락된 condition kind가 있습니다", MissingConditionKind];
export const ASSERT_NO_MISSING_CONDITION_KIND: AssertNoMissingConditionKind = true;
