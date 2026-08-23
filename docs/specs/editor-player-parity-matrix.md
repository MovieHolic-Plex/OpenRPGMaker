# Editor -> Player Parity Matrix

Extends `docs/specs/oprn-database-field-matrix.md`. Machine-readable source of truth: `test/parity/parityMatrix.ts` (the resolver test `test/parity/parityMatrix.test.ts` asserts every `playerConsumer` resolves in the source, so this matrix cannot rot silently).

Each row maps an authored field to the player module that consumes it, the headless harness that verifies it (`simulateBattle` / `runSceneTest` / `roundTrip`), and parity coverage status (`covered` = editor->player parity test exists; `planned-Tn` = added by this plan; `gap` = not yet parity-tested).

Summary: 67 rows — covered 0, planned 51, gap 16.

Since 2026-08-20 this distribution is ratchet-gated by `test/parity/parityMatrix.test.ts` (`RATCHET` constant): gap may only shrink and covered may only grow; new rows must land as `planned-*`, not `gap`.

## actors

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| initialLevel/maxLevel | `src/battle/battleBattlers.ts#effectiveClass` | simulateBattle | planned-T5 |
| learnedSkills | `src/battle/battleBattlers.ts#learnedSkillIds` | simulateBattle | planned-T5 |
| classId | `src/battle/battleBattlers.ts#classId` | simulateBattle | planned-T5 |
| options.dualWield | `src/battle/battleBattlers.ts#statBonuses` | simulateBattle | planned-T5 |
| faceIndex/characterIndex | `src/player/PlayScene.ts#PlayScene` | runSceneTest | gap |

## classes

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| battleCommands | `src/battle/battleCommands.ts#battleCommandsForActor` | simulateBattle | planned-T5 |
| learnedSkills | `src/battle/battleBattlers.ts#learnedSkillIds` | simulateBattle | planned-T5 |
| parameterCurves | `src/battle/battleBattlers.ts#statBonuses` | simulateBattle | planned-T5 |
| stateRates | `src/battle/runtime.ts#stateEffects` | simulateBattle | planned-T5 |
| elementRates | `src/battle/runtime.ts#typeChart` | simulateBattle | planned-T5 |
| promotions | `src/battle/battleBattlers.ts#effectiveClass` | simulateBattle | gap |

## skills

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| power | `src/battle/battleDamage.ts#damage` | simulateBattle | planned-T4 |
| scope | `src/battle/runtime.ts#applyItem` | simulateBattle | planned-T4 |
| elementId | `src/battle/runtime.ts#typeChart` | simulateBattle | planned-T4 |
| stateEffects | `src/battle/runtime.ts#stateEffects` | simulateBattle | planned-T4 |
| mpCost | `src/battle/runtime.ts#applyItem` | simulateBattle | planned-T4 |
| animationId | `src/player/playSceneMapAnimations.ts#showAnimation` | runSceneTest | gap |

## items

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| hpRecovery/mpRecovery | `src/player/playerItemUse.ts#useItem` | runSceneTest | planned-T4 |
| skillId/activateSkillId | `src/battle/runtime.ts#applyItem` | simulateBattle | planned-T4 |
| type | `src/battle/runtime.ts#applyItem` | simulateBattle | planned-T4 |
| captureProfile | `src/battle/runtime.ts#captureProfile` | simulateBattle | planned-T4 |
| learnedSkillId | `src/player/playerItemUse.ts#useItem` | runSceneTest | gap |

## equipment

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| effectFlags.doubleAttack | `src/battle/runtime.ts#doubleAttack` | simulateBattle | planned-T4 |
| elementalDefenseIds | `src/battle/runtime.ts#elementalDefenseIds` | simulateBattle | planned-T4 |
| stateDefenseIds | `src/battle/runtime.ts#stateEffects` | simulateBattle | planned-T4 |
| statBonuses | `src/battle/battleBattlers.ts#statBonuses` | simulateBattle | planned-T5 |
| slot | `src/battle/battleBattlers.ts#classId` | roundTrip | planned-T6 |

## enemies

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| actions | `src/battle/runtime.ts#actions` | simulateBattle | planned-T4 |
| stats | `src/battle/runtime.ts#applyItem` | simulateBattle | planned-T4 |
| speciesId | `src/battle/runtime.ts#speciesId` | simulateBattle | planned-T4 |
| monsterResourceId | `src/battle/battleBattlers.ts#classId` | roundTrip | gap |

## troops

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| members | `src/battle/simulate.ts#simulateBattle` | simulateBattle | planned-T4 |
| battleEventPages | `src/battle/battleEvents.ts#battleEvent` | simulateBattle | planned-T4 |
| battleFlow | `src/battle/runtime.ts#battleFlow` | simulateBattle | planned-T4 |
| previewBackgroundResourceId | `src/battle/battleBackdrop.ts#resolveBattleBackdrop` | simulateBattle | planned-T4 |

## states

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| runtimeEffects | `src/battle/runtime.ts#stateEffects` | simulateBattle | planned-T4 |
| runtimeEffects(schema) | `src/project/types/database.ts#runtimeEffects` | roundTrip | planned-T6 |

## battleAnimations

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| frames/timings | `src/player/playSceneMapAnimations.ts#showAnimation` | runSceneTest | gap |
| resourceId | `src/player/playSceneMapAnimations.ts#showAnimation` | roundTrip | gap |

## crops

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| stages/seasons/regrow | `src/player#advanceCropGrowth` | runSceneTest | planned-T7 |
| seedItemId/harvestItemId | `src/player#farmPlots` | runSceneTest | planned-T7 |
| schema | `src/project/types/database.ts#CropRecord` | roundTrip | planned-T6 |

## monsterSpecies

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| types | `src/battle/runtime.ts#typeChart` | simulateBattle | planned-T4 |
| captureRate | `src/battle/runtime.ts#captureProfile` | simulateBattle | planned-T4 |
| speciesLink | `src/battle/runtime.ts#speciesId` | simulateBattle | planned-T4 |
| evolutions | `src/battle/runtime.ts#speciesId` | simulateBattle | gap |
| schema | `src/project/types/database.ts#MonsterSpeciesRecord` | roundTrip | planned-T6 |

## maps

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| lowerTiles/upperTiles | `src/player/playSceneMapRuntime.ts#renderTile` | runSceneTest | planned-T7 |
| encounterTable | `src/player#encounterTable` | runSceneTest | planned-T7 |
| fieldSpawns | `src/player/fieldSpawns.ts#fieldSpawn` | runSceneTest | planned-T7 |
| farmableArea | `src/player#farmableArea` | runSceneTest | planned-T7 |
| defaultLighting | `src/player/playSceneLighting.ts#lighting` | runSceneTest | planned-T7 |
| layoutPlan | `src/project/mapLayoutPlan.ts#findLayoutRegions` | roundTrip | gap |

## events

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| pages/commands | `src/player/interpreter#Interpreter` | runSceneTest | planned-T7 |
| trigger | `src/player/PlayScene.ts#PlayScene` | runSceneTest | planned-T7 |
| schedule | `src/player/npcSchedules.ts#npcSchedule` | runSceneTest | planned-T7 |
| socialKey | `src/project/socialKey.ts#resolveSocialKey` | runSceneTest | gap |
| giftPrefs | `src/project/characterProfiles.ts#resolveGiftPrefs` | runSceneTest | gap |

## system

| field | playerConsumer | harness | status |
| --- | --- | --- | --- |
| battleFlow | `src/battle/runtime.ts#battleFlow` | simulateBattle | planned-T4 |
| typeChart | `src/battle/runtime.ts#typeChart` | simulateBattle | planned-T4 |
| startActorIds | `src/battle/battleBattlers.ts#classId` | roundTrip | planned-T6 |
| titleScreen | `src/player/titleScreen.ts#titleScreen` | runSceneTest | gap |
| timeSystem | `src/player/playSceneTime.ts#advanceGameTime` | runSceneTest | gap |
| giftSystem | `src/player#giftSystem` | runSceneTest | gap |
| monsterCollection | `src/player#monsterCollection` | simulateBattle | gap |
| actionCombat | `src/project/actionCombat.ts#isActionCombatMap` | runSceneTest | gap |
| saveSlots | `src/player/saveSlots.ts#saveSlot` | roundTrip | planned-T6 |

