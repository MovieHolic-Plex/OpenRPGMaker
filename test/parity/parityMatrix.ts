// test/parity/parityMatrix.ts
export type ParityHarness = "simulateBattle" | "runSceneTest" | "roundTrip" | "none";
export type ParityStatus = "covered" | "planned-T4" | "planned-T5" | "planned-T6" | "planned-T7" | "gap";

export interface ParityRow {
  readonly contentType: string;
  readonly field: string;
  readonly playerConsumer: string;
  readonly harness: ParityHarness;
  readonly status: ParityStatus;
}

export const DATABASE_COLLECTIONS = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
  "crops",
  "monsterSpecies",
] as const;

export const REQUIRED_CONTENT_TYPES = [...DATABASE_COLLECTIONS, "maps", "events", "system"] as const;

export const PARITY_MATRIX: readonly ParityRow[] = [
  { contentType: "actors", field: "initialLevel/maxLevel", playerConsumer: "src/battle/battleBattlers.ts#effectiveClass", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "actors", field: "learnedSkills", playerConsumer: "src/battle/battleBattlers.ts#learnedSkillIds", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "actors", field: "classId", playerConsumer: "src/battle/battleBattlers.ts#classId", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "actors", field: "options.dualWield", playerConsumer: "src/battle/battleBattlers.ts#statBonuses", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "actors", field: "faceIndex/characterIndex", playerConsumer: "src/player/PlayScene.ts#PlayScene", harness: "runSceneTest", status: "gap" },

  { contentType: "classes", field: "battleCommands", playerConsumer: "src/battle/battleCommands.ts#battleCommandsForActor", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "classes", field: "learnedSkills", playerConsumer: "src/battle/battleBattlers.ts#learnedSkillIds", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "classes", field: "parameterCurves", playerConsumer: "src/battle/battleBattlers.ts#statBonuses", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "classes", field: "stateRates", playerConsumer: "src/battle/runtime.ts#stateEffects", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "classes", field: "elementRates", playerConsumer: "src/battle/runtime.ts#typeChart", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "classes", field: "promotions", playerConsumer: "src/battle/battleBattlers.ts#effectiveClass", harness: "simulateBattle", status: "gap" },

  { contentType: "skills", field: "power", playerConsumer: "src/battle/battleDamage.ts#damage", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "skills", field: "scope", playerConsumer: "src/battle/runtime.ts#applyItem", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "skills", field: "elementId", playerConsumer: "src/battle/runtime.ts#typeChart", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "skills", field: "stateEffects", playerConsumer: "src/battle/runtime.ts#stateEffects", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "skills", field: "mpCost", playerConsumer: "src/battle/runtime.ts#applyItem", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "skills", field: "animationId", playerConsumer: "src/player/playSceneMapAnimations.ts#showAnimation", harness: "runSceneTest", status: "gap" },

  { contentType: "items", field: "hpRecovery/mpRecovery", playerConsumer: "src/player/playerItemUse.ts#useItem", harness: "runSceneTest", status: "planned-T4" },
  { contentType: "items", field: "skillId/activateSkillId", playerConsumer: "src/battle/runtime.ts#applyItem", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "items", field: "type", playerConsumer: "src/battle/runtime.ts#applyItem", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "items", field: "captureProfile", playerConsumer: "src/battle/runtime.ts#captureProfile", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "items", field: "learnedSkillId", playerConsumer: "src/player/playerItemUse.ts#useItem", harness: "runSceneTest", status: "gap" },

  { contentType: "equipment", field: "effectFlags.doubleAttack", playerConsumer: "src/battle/runtime.ts#doubleAttack", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "equipment", field: "elementalDefenseIds", playerConsumer: "src/battle/runtime.ts#elementalDefenseIds", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "equipment", field: "stateDefenseIds", playerConsumer: "src/battle/runtime.ts#stateEffects", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "equipment", field: "statBonuses", playerConsumer: "src/battle/battleBattlers.ts#statBonuses", harness: "simulateBattle", status: "planned-T5" },
  { contentType: "equipment", field: "slot", playerConsumer: "src/battle/battleBattlers.ts#classId", harness: "roundTrip", status: "planned-T6" },

  { contentType: "enemies", field: "actions", playerConsumer: "src/battle/runtime.ts#actions", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "enemies", field: "stats", playerConsumer: "src/battle/runtime.ts#applyItem", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "enemies", field: "speciesId", playerConsumer: "src/battle/runtime.ts#speciesId", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "enemies", field: "monsterResourceId", playerConsumer: "src/battle/battleBattlers.ts#classId", harness: "roundTrip", status: "gap" },

  { contentType: "troops", field: "members", playerConsumer: "src/battle/simulate.ts#simulateBattle", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "troops", field: "battleEventPages", playerConsumer: "src/battle/battleEvents.ts#battleEvent", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "troops", field: "battleFlow", playerConsumer: "src/battle/runtime.ts#battleFlow", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "troops", field: "previewBackgroundResourceId", playerConsumer: "src/battle/battleBackdrop.ts#resolveBattleBackdrop", harness: "simulateBattle", status: "planned-T4" },

  { contentType: "states", field: "runtimeEffects", playerConsumer: "src/battle/runtime.ts#stateEffects", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "states", field: "runtimeEffects(schema)", playerConsumer: "src/project/types/database.ts#runtimeEffects", harness: "roundTrip", status: "planned-T6" },

  { contentType: "battleAnimations", field: "frames/timings", playerConsumer: "src/player/playSceneMapAnimations.ts#showAnimation", harness: "runSceneTest", status: "gap" },
  { contentType: "battleAnimations", field: "resourceId", playerConsumer: "src/player/playSceneMapAnimations.ts#showAnimation", harness: "roundTrip", status: "gap" },

  { contentType: "crops", field: "stages/seasons/regrow", playerConsumer: "src/player#advanceCropGrowth", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "crops", field: "seedItemId/harvestItemId", playerConsumer: "src/player#farmPlots", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "crops", field: "schema", playerConsumer: "src/project/types/database.ts#CropRecord", harness: "roundTrip", status: "planned-T6" },

  { contentType: "monsterSpecies", field: "types", playerConsumer: "src/battle/runtime.ts#typeChart", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "monsterSpecies", field: "captureRate", playerConsumer: "src/battle/runtime.ts#captureProfile", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "monsterSpecies", field: "speciesLink", playerConsumer: "src/battle/runtime.ts#speciesId", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "monsterSpecies", field: "evolutions", playerConsumer: "src/battle/runtime.ts#speciesId", harness: "simulateBattle", status: "gap" },
  { contentType: "monsterSpecies", field: "schema", playerConsumer: "src/project/types/database.ts#MonsterSpeciesRecord", harness: "roundTrip", status: "planned-T6" },

  { contentType: "maps", field: "lowerTiles/upperTiles", playerConsumer: "src/player/playSceneMapRuntime.ts#renderTile", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "maps", field: "encounterTable", playerConsumer: "src/player#encounterTable", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "maps", field: "fieldSpawns", playerConsumer: "src/player/fieldSpawns.ts#fieldSpawn", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "maps", field: "farmableArea", playerConsumer: "src/player#farmableArea", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "maps", field: "defaultLighting", playerConsumer: "src/player/playSceneLighting.ts#lighting", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "maps", field: "layoutPlan", playerConsumer: "src/project/mapLayoutPlan.ts#findLayoutRegions", harness: "roundTrip", status: "gap" },

  { contentType: "events", field: "pages/commands", playerConsumer: "src/player/interpreter#Interpreter", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "events", field: "trigger", playerConsumer: "src/player/PlayScene.ts#PlayScene", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "events", field: "schedule", playerConsumer: "src/player/npcSchedules.ts#npcSchedule", harness: "runSceneTest", status: "planned-T7" },
  { contentType: "events", field: "socialKey", playerConsumer: "src/project/socialKey.ts#resolveSocialKey", harness: "runSceneTest", status: "gap" },
  { contentType: "events", field: "giftPrefs", playerConsumer: "src/project/characterProfiles.ts#resolveGiftPrefs", harness: "runSceneTest", status: "gap" },

  { contentType: "system", field: "battleFlow", playerConsumer: "src/battle/runtime.ts#battleFlow", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "system", field: "typeChart", playerConsumer: "src/battle/runtime.ts#typeChart", harness: "simulateBattle", status: "planned-T4" },
  { contentType: "system", field: "startActorIds", playerConsumer: "src/battle/battleBattlers.ts#classId", harness: "roundTrip", status: "planned-T6" },
  { contentType: "system", field: "titleScreen", playerConsumer: "src/player/titleScreen.ts#titleScreen", harness: "runSceneTest", status: "gap" },
  { contentType: "system", field: "titleScreen.backgroundLayers", playerConsumer: "src/player/titleScreen.ts#renderTitleBackgroundLayers", harness: "roundTrip", status: "covered" },
  { contentType: "system", field: "titleScreen.particles", playerConsumer: "src/player/titleParticles.ts#titleParticlePositions", harness: "roundTrip", status: "covered" },
  { contentType: "system", field: "titleScreen.intro", playerConsumer: "src/player/titleScreen.ts#titleIntroClass", harness: "roundTrip", status: "covered" },
  { contentType: "system", field: "timeSystem", playerConsumer: "src/player/playSceneTime.ts#advanceGameTime", harness: "runSceneTest", status: "gap" },
  { contentType: "system", field: "giftSystem", playerConsumer: "src/player#giftSystem", harness: "runSceneTest", status: "gap" },
  { contentType: "system", field: "monsterCollection", playerConsumer: "src/player#monsterCollection", harness: "simulateBattle", status: "gap" },
  { contentType: "system", field: "actionCombat", playerConsumer: "src/project/actionCombat.ts#isActionCombatMap", harness: "runSceneTest", status: "gap" },
  { contentType: "system", field: "saveSlots", playerConsumer: "src/player/saveSlots.ts#saveSlot", harness: "roundTrip", status: "planned-T6" },
  { contentType: "system", field: "autosave", playerConsumer: "src/player/autosave.ts#performAutosave", harness: "roundTrip", status: "covered" },
];
