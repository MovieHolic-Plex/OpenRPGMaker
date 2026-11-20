import type { PrimitiveCovers } from "./types";

export const OWNERSHIP = {
  "01-cmd-dialogue": {
    commandKinds: [
      "text", "changeFace", "choices", "presentItem", "inputWait",
      "inputNumber", "enterHeroName", "displayTextSettings",
    ],
  },
  "02-cmd-flow": {
    commandKinds: [
      "fork", "wait", "label", "gotoLabel", "loop",
      "breakLoop", "callCommonEvent", "callMapEvent", "cutsceneControl", "script",
    ],
  },
  "03-cmd-switch-var": {
    commandKinds: [
      "setSwitch", "setVariable", "setSelfSwitch", "setFlag",
    ],
  },
  "04-cmd-items-shops": {
    commandKinds: [
      "changeGold", "changeItem", "craftRecipe", "applyItemUpgrade", "equipTool",
      "openCraftShop", "openChest", "shop", "inn",
    ],
  },
  "05-cmd-party-actor": {
    commandKinds: [
      "learnSkill", "changeExp", "changeLevel", "changeLifeSkillExp", "promoteActor",
      "changeEquipment", "changeActorHp", "changeActorMp", "recoverAll", "changeParty",
      "storeParty", "recallParty", "addFollower", "removeFollower",
    ],
  },
  "06-cmd-monster-battle": {
    commandKinds: [
      "giveMonster", "moveMonster", "evolveMonster", "spawnFieldEnemy", "despawnFieldEnemy",
      "removeMonster", "tradeMonster", "fuseMonsters", "battleProcessing", "tacticsBattle",
    ],
  },
  "07-cmd-staging": {
    commandKinds: [
      "showAnimation", "showEmote", "showPicture", "erasePicture", "playAudio",
      "stopAudio", "playMovie", "setLighting", "addLight", "removeLight",
      "setWeather",
    ],
  },
  "08-cmd-time-social": {
    commandKinds: [
      "timer", "advanceTime", "advanceCropGrowth", "setTime", "sleepUntilMorning",
      "planSchedule", "runSchedule", "changeFriendship", "setRelationship", "changeFactionStance",
      "getFriendship",
    ],
  },
  "09-cmd-move-system": {
    commandKinds: [
      "transfer", "moveEvent", "setEventGraphicPattern", "changeTile", "checkpointSave",
      "killPlayer", "triggerEnding", "gameOver", "ending", "returnToTitle",
      "openSaveMenu", "runControl", "setDifficulty",
    ],
  },
  "10-m2-actor-battle": {
    m2Ids: [
      "m2-014", "m2-019", "m2-021", "m2-022", "m2-023",
      "m2-024", "m2-025", "m2-091", "m2-092", "m2-098",
      "m2-099", "m2-100", "m2-101", "m2-102", "m2-103",
      "m2-104", "m2-105", "m2-106", "m2-107", "m2-108",
      "m2-218",
    ],
  },
  "11-m2-system-menu": {
    m2Ids: [
      "m2-027", "m2-028", "m2-029", "m2-072", "m2-073",
      "m2-074", "m2-075", "m2-077", "m2-078", "m2-079",
      "m2-088", "m2-093", "m2-094", "m2-095", "m2-096",
      "m2-097",
    ],
  },
  "12-m2-map-move": {
    m2Ids: [
      "m2-026", "m2-036", "m2-037", "m2-038", "m2-039",
      "m2-040", "m2-041", "m2-042", "m2-043", "m2-049",
      "m2-058", "m2-059", "m2-068", "m2-069", "m2-070",
      "m2-085", "m2-086", "m2-203", "m2-204", "m2-205",
      "m2-207",
    ],
  },
  "13-m2-screen-sound": {
    m2Ids: [
      "m2-030", "m2-044", "m2-045", "m2-046", "m2-047",
      "m2-048", "m2-050", "m2-052", "m2-054", "m2-055",
      "m2-056", "m2-063", "m2-064", "m2-066", "m2-201",
      "m2-202", "m2-210", "m2-212", "m2-224", "m2-225",
      "m2-226",
    ],
  },
  "14-m2-modern-logic": {
    m2Ids: [
      "m2-206", "m2-208", "m2-211", "m2-213", "m2-214",
      "m2-215", "m2-216", "m2-217", "m2-219", "m2-220",
      "m2-221", "m2-222", "m2-223", "m2-227",
    ],
  },
  "15-cond-state-party": {
    conditionKinds: [
      "switch", "variable", "selfSwitch", "stringVariable", "item",
      "itemUsed", "gold", "timer", "actor", "actorStat",
      "actorState", "partyLeader", "partyKnowsSkill", "partySize", "badgeCount",
      "monsterSpecies", "all", "any", "not",
    ],
  },
  "16-cond-world-social": {
    conditionKinds: [
      "timePhase", "season", "weekday", "npcActivity", "insideLocation",
      "friendshipAtLeast", "relationshipAtLeast", "battleResult", "run", "facing",
      "relativeFacing", "hiding", "pursuitActive", "eventSeesPlayer", "clearCount",
      "endingSeen", "newGamePlus", "difficulty",
    ],
  },
  "17-db-actors-classes": {
    collections: [
      "actors", "classes", "characterAppearances",
    ],
  },
  "18-db-skills-states": {
    collections: [
      "skills", "states", "skillChoreographies", "battleAnimations",
    ],
  },
  "19-db-items-equipment": {
    collections: [
      "items", "equipment", "equipmentSlots", "elements",
    ],
  },
  "20-db-enemies-troops": {
    collections: [
      "enemies", "troops", "terrains", "battleCommands",
    ],
  },
  "21-db-life-farm": {
    collections: [
      "monsterSpecies", "crops", "lifeSkills", "farmAnimalSpecies", "fishSpecies",
      "farmBuildingTypes", "homeDecorationTypes", "schedules",
    ],
  },
  "22-map-tiles": {
    tools: [
      "paint_tiles", "tile_erase", "fill_region", "stamp_object", "copy_map_region",
      "move_region", "mirror_region", "shift_map", "set_tile_passability",
    ],
  },
  "23-map-structure": {
    tools: [
      "create_map", "duplicate_map", "remove_map", "resize_map", "set_map_properties",
      "set_encounter_table", "set_start_position", "set_map_door", "upsert_map_connection", "create_map_location",
      "update_map_location", "delete_map_location",
    ],
  },
  "24-event-structure": {
    tools: [
      "upsert_event(create)", "add_event_page", "patch_event_page(graphic,trigger,priority,through,direction)", "remove_event_page", "reorder_event_page",
      "duplicate_event", "remove_event", "move_event", "rename_event",
    ],
  },
  "25-event-presets": {
    tools: [
      "place_npc", "place_chest", "set_shop_stock", "create_transfer_pair", "place_sign",
      "set_door_lock",
    ],
  },
  "26-npc-dialogue": {
    tools: [
      "dialogue.line.rewrite", "dialogue.line.insert", "dialogue.line.remove", "dialogue.choiceLabel.rewrite", "dialogue.tone.rewrite(batch within page)",
      "dialogue.firstTimeOnly", "npc.rename", "dialogue.speaker.set",
    ],
  },
  "27-quests": {
    tools: [
      "quest.create", "quest.rename", "quest.objective.add", "quest.objective.update", "quest.objective.remove",
      "quest.reward.set", "quest.remove", "quest.giver.link",
    ],
  },
  "28-project-data": {
    tools: [
      "switch.define", "switch.rename", "variable.define", "variable.rename", "ending.define",
      "ending.update", "ending.remove", "system.title", "system.startGold", "system.startParty",
    ],
  },
  "29-event-movement": {
    tools: [
      "move.route.set", "move.route.append", "move.type.set(random/approach/fixed)", "move.speed.set", "move.frequency.set",
      "npc.patrol.set", "npc.face.set",
    ],
  },
  "30-common-events": {
    tools: [
      "commonEvent.create", "commonEvent.rename", "commonEvent.trigger.set", "commonEvent.remove", "commonEvent.command.insert",
      "commonEvent.command.update", "commonEvent.command.delete",
    ],
  },
} as const satisfies Record<string, PrimitiveCovers>;

export type PrimitiveUnit = keyof typeof OWNERSHIP;
