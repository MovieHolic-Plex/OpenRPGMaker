// test/fixtures/minimalCommands.ts
//
// kind별 최소 유효 커맨드 인스턴스 — 단일 소스.
// Record<CommandKind, Command> 이므로 COMMAND_KINDS 에 kind 가 추가되면 여기 항목이 없으면
// 컴파일 에러가 난다. test/commandKindCoverage.test.ts 와 폼 렌더 스냅샷 게이트가 공유한다.
import { createDefaultM2Fields, m2CommandById } from "@/project/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import type { CommandKind } from "@/project/commandKindRegistry";

/**
 * m2Command 픽스처가 가리키는 카탈로그 항목.
 *
 * 이전 값은 `commandId: "m2_test"` 였고 이건 카탈로그에 없는 id 였다. 그래서 kind 축 폼 표면이
 * m2Command 를 "컨트롤 0개"(= 카탈로그 조회 실패 폴백)로 기록했고, M2 폼 리팩터에 대해
 * kind 축이 사실상 무보증이었다.
 *
 * 실재하는 `bodyStrategy: "generic"` + 다필드 항목으로 바꾼다. m2-014 는 필드 6개
 * (text / select / select / number / select / text)라 select·number·text 세 렌더 경로를 한 번에 탄다.
 * 없어지면 즉시 터진다 — 조용히 폴백으로 되돌아가지 않게 한다.
 */
const M2_FIXTURE_COMMAND_ID = "m2-014-change-parameters";
const m2FixtureEntry = m2CommandById(M2_FIXTURE_COMMAND_ID);
if (!m2FixtureEntry) {
  throw new Error(
    `minimalCommands: M2 픽스처 id 가 카탈로그에 없다: ${M2_FIXTURE_COMMAND_ID} — ` +
      `M2_COMMAND_CATALOG 에서 bodyStrategy === "generic" 이고 필드가 여러 개인 항목으로 교체하라.`
  );
}

export const MINIMAL_COMMANDS: Record<CommandKind, Command> = {
  text: { kind: "text", body: "hello" },
  changeFace: { kind: "changeFace", resourceId: "res1", position: "left", flipHorizontally: false },
  choices: { kind: "choices", options: [{ text: "a", branch: [] }] },
  presentItem: { kind: "presentItem", options: [{ itemId: "item1", branch: [] }] },
  fork: { kind: "fork", condition: { kind: "switch", switchId: "sw1", value: true }, then: [], else: [] },
  wait: { kind: "wait", ms: 100 },
  inputWait: { kind: "inputWait" },
  inputNumber: { kind: "inputNumber", variableId: "var1", digits: 1 },
  label: { kind: "label", name: "L1" },
  gotoLabel: { kind: "gotoLabel", name: "L1" },
  loop: { kind: "loop", body: [{ kind: "breakLoop" }] },
  breakLoop: { kind: "breakLoop" },
  setSwitch: { kind: "setSwitch", switchId: "sw1", value: true },
  setVariable: { kind: "setVariable", variableId: "var1", op: "=", value: 1 },
  timer: { kind: "timer", action: "set", seconds: 5, timerId: "timer1" },
  advanceTime: { kind: "advanceTime", minutes: 10 },
  advanceCropGrowth: { kind: "advanceCropGrowth", days: 1 },
  setTime: { kind: "setTime", hour: 6, minute: 0 },
  sleepUntilMorning: { kind: "sleepUntilMorning" },
  transfer: { kind: "transfer", mapId: "map1", x: 0, y: 0 },
  moveEvent: { kind: "moveEvent", eventId: "ev1", route: { moves: [], repeat: false } },
  setEventGraphicPattern: { kind: "setEventGraphicPattern", eventId: "ev1", pattern: 0 },
  changeTile: { kind: "changeTile", mapId: "map1", layer: "lower", x: 0, y: 0, tile: 1 },
  callCommonEvent: { kind: "callCommonEvent", commonEventId: "ce1" },
  callMapEvent: { kind: "callMapEvent", eventId: "ev1" },
  battleProcessing: { kind: "battleProcessing", troopId: "troop1", canEscape: true, canLose: false },
  learnSkill: { kind: "learnSkill", actorId: "actor1", skillId: "skill1" },
  changeExp: { kind: "changeExp", actorId: "actor1", op: "+=", amount: 10 },
  changeLevel: { kind: "changeLevel", actorId: "actor1", op: "+=", amount: 1 },
  changeLifeSkillExp: { kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount: 10 },
  openSaveMenu: { kind: "openSaveMenu" },
  spawnFieldEnemy: {
    kind: "spawnFieldEnemy",
    spawn: { id: "spawn1", troopId: "troop1", area: { x: 0, y: 0, w: 4, h: 4 } },
  },
  despawnFieldEnemy: { kind: "despawnFieldEnemy", spawnId: "spawn1" },
  tacticsBattle: { kind: "tacticsBattle", troopId: "troop1" },
  runControl: { kind: "runControl", action: "start", seed: 1 },
  promoteActor: {
    kind: "promoteActor",
    actorId: "actor1",
    toClassId: "class1",
    successBranch: [],
    failureBranch: [],
  },
  evolveMonster: {
    kind: "evolveMonster",
    instanceId: "monster_1",
    toSpeciesId: "species1",
    successBranch: [],
    failureBranch: [],
  },
  changeEquipment: { kind: "changeEquipment", actorId: "actor1", slot: "weapon", equipmentId: "eq1" },
  changeActorHp: { kind: "changeActorHp", actorId: "actor1", op: "+=", amount: 10 },
  changeActorMp: { kind: "changeActorMp", actorId: "actor1", op: "+=", amount: 10 },
  recoverAll: { kind: "recoverAll" },
  enterHeroName: { kind: "enterHeroName", actorId: "actor1", maxLength: 6, showInitialName: false },
  changeGold: { kind: "changeGold", op: "+=", amount: 10 },
  changeItem: { kind: "changeItem", itemId: "item1", op: "+=", amount: 1 },
  craftRecipe: { kind: "craftRecipe", recipeId: "recipe1" },
  applyItemUpgrade: { kind: "applyItemUpgrade", upgradeId: "upgrade1" },
  equipTool: { kind: "equipTool", itemId: "item1" },
  openChest: { kind: "openChest", chestId: "chest1" },
  changeFriendship: { kind: "changeFriendship", npcKey: "ev1", delta: 10 },
  changeFactionStance: { kind: "changeFactionStance", a: "player", b: "enemy", op: "+=", value: 1 },
  getFriendship: { kind: "getFriendship", npcKey: "ev1", variableId: "var1" },
  // COMMAND_KINDS 에 setRelationship 이 들어왔는데 픽스처가 없어 undefined 가 렌더로 들어갔다
  // — commandBody.ts:29 에서 TypeError 로 죽었다(표면 게이트가 잡은 실측 결함).
  setRelationship: { kind: "setRelationship", npcKey: "ev1", state: "dating" },
  changeParty: { kind: "changeParty", actorId: "actor1", action: "add" },
  giveMonster: { kind: "giveMonster", speciesId: "species1", level: 5 },
  moveMonster: { kind: "moveMonster", instanceId: "monster_1", to: "party" },
  addFollower: { kind: "addFollower", actorId: "actor1", name: "동행자" },
  removeFollower: { kind: "removeFollower", all: true },
  setLighting: { kind: "setLighting", ambient: 0.8, color: "#000000", transitionMs: 0 },
  addLight: {
    kind: "addLight",
    source: { id: "light1", at: "player", radius: 4, intensity: 1, flicker: true },
  },
  removeLight: { kind: "removeLight", all: true },
  setWeather: { kind: "setWeather", weather: "storm", intensity: 0.8, transitionMs: 120 },
  showEmote: { kind: "showEmote", target: { eventId: "" }, emote: "heart", durationMs: 1200 },
  showAnimation: { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: true },
  showPicture: { kind: "showPicture", pictureId: "pic1", resourceId: "res1", x: 0, y: 0 },
  erasePicture: { kind: "erasePicture", pictureId: "pic1" },
  playAudio: { kind: "playAudio", resourceId: "res1", loop: false },
  playMovie: { kind: "playMovie", resourceId: "res1", wait: true, skippable: true },
  stopAudio: { kind: "stopAudio" },
  cutsceneControl: { kind: "cutsceneControl", mode: "begin", skippable: true },
  displayTextSettings: {
    kind: "displayTextSettings",
    format: "normal",
    position: "bottom",
    preventObscuringPlayer: true,
    allowEventMovementDuringWait: false,
  },
  shop: { kind: "shop", itemIds: ["item_potion"] },
  inn: { kind: "inn", price: 10 },
  checkpointSave: { kind: "checkpointSave" },
  killPlayer: { kind: "killPlayer", message: "trap" },
  triggerEnding: { kind: "triggerEnding", endingId: "ending_true" },
  gameOver: { kind: "gameOver" },
  ending: { kind: "ending", title: "t", message: "m" },
  returnToTitle: { kind: "returnToTitle" },
  setFlag: { kind: "setFlag", flag: "flag1", value: true },
  setSelfSwitch: { kind: "setSelfSwitch", key: "A", value: true },
  m2Command: {
    kind: "m2Command",
    commandId: M2_FIXTURE_COMMAND_ID,
    fields: createDefaultM2Fields(m2FixtureEntry),
  },
  setDifficulty: { kind: "setDifficulty", difficultyId: "normal" },
  storeParty: { kind: "storeParty", partySetId: "party_a" },
  recallParty: { kind: "recallParty", partySetId: "party_a" },
  removeMonster: { kind: "removeMonster", instanceId: "monster_1" },
  tradeMonster: { kind: "tradeMonster", fromSpeciesId: "species1", toSpeciesId: "species2" },
  fuseMonsters: { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" },
};
