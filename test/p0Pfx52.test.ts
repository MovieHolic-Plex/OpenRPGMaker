import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords, normalizeItemRecord, normalizeSkillRecord, normalizeEquipmentRecord, normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { activeDifficultyId, difficultyRate, normalizeDifficulties } from "@/project/difficulty";
import { evalCondition, startSession, GOLD_MAX, changeItem, type MonsterInstance } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, type SaveSnapshot, readAutosave } from "@/player/saveSlots";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, GameMap, Project, MonsterSpeciesRecord, SkillRecord } from "@/project/types";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { applyCareItem, applyWalkCareTicks, resolveMonsterCare } from "@/project/monsterCare";
import { evolveMonster, giveMonster, moveMonster, applyMonsterExperienceAndEvolution, previewMonsterExperience, splitLearnedMonsterSkills, monsterBattleStats, monsterBattleStatsForSpecies, normalizeMonsterSpeciesRecord, monsterSpeciesById } from "@/project/monsterCollection";
import { useItemFromMenu } from "@/player/playerItemUse";
import { totalExpForLevel } from "@/project/actorModel";
import { MONSTER_NATURES, addMonsterEvs, clampMonsterEvs, monsterEvYieldOf, monsterNatureEffectText, natureIdFromSeed } from "@/project/monsterStatRules";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import { contributeBundle } from "@/project/bundles";
import { isolateTimers } from "./mergedTeardown";
import { handleShopTransaction } from "@/player/playSceneShop";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { depositToChest, ensureChest, withdrawFromChest } from "@/project/placeables";
import { awardLifeSkillXp } from "@/project/lifeSkillProgress";
import { absoluteGameMinutes, advanceMakers, collectMaker, startMaker } from "@/project/makers";
import { depositShipping, settleShipping, withdrawShipping } from "@/project/shipping";
import { applyItemUpgrade, resolveToolCapability } from "@/project/upgrades";
import { performAutosave } from "@/player/autosave";
import { restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import { calendarDayKey } from "@/project/gameTime";
import { transitionToNextDay } from "@/player/dayTransition";
import { simulateBattle } from "@/battle/simulate";

describe("p0Bundles", () => {
  isolateTimers();
  describe("mgL7sysDifficulty", () => {
    isolateTimers();
    function difficultyProject(): Project {
      const project = createBlankProject();
      project.system.difficulties = [
        { id: "easy", name: "쉬움", enemyHpRate: 0.5, expRate: 2, goldRate: 3 },
        { id: "hard", name: "어려움", enemyHpRate: 2, enemyAttackRate: 1.5, encounterRate: 2 },
      ];
      project.system.defaultDifficultyId = "hard";
      return project;
    }
    function runAll(commands: Command[], project: Project, session = startSession(project, 1)) {
      const interpreter = createInterpreter(commands, session, project);
      let step = interpreter.start();
      while (step.kind !== "done") step = interpreter.resume();
      return session;
    }
    function slimeBattle(project: Project, difficultyId: string | undefined) {
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, maxHp: 2 };
      return createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        sessionState: { switches: {}, variables: {}, inventory: {}, ...(difficultyId ? { difficultyId } : {}) },
      });
    }
    function winBattle(runtime: ReturnType<typeof createBattleRuntime>): void {
      for (let i = 0; i < 200 && !runtime.snapshot().result; i += 1) {
        if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        runtime.tick(1_000);
      }
    }
    describe("difficulty modes (#19)", () => {
      it("seeds new sessions with the authored default difficulty and legacy projects with none", () => {
        expect(startSession(difficultyProject(), 1).difficultyId).toBe("hard");
        expect(startSession(createBlankProject(), 1).difficultyId).toBeUndefined();
      });

      it("scales enemy HP/attack by the active difficulty and leaves the default untouched", () => {
        const base = slimeBattle(difficultyProject(), undefined).snapshot().enemies[0]!;
        // 세션 난이도 없음 → 기본 난이도(hard) 배율.
        const hard = slimeBattle(difficultyProject(), "hard").snapshot().enemies[0]!;
        const easy = slimeBattle(difficultyProject(), "easy").snapshot().enemies[0]!;
        const legacy = slimeBattle(createBlankProject(), undefined).snapshot().enemies[0]!;
        expect(legacy.maxHp).toBe(2);
        expect(hard.maxHp).toBe(4);
        expect(base.maxHp).toBe(4);
        expect(easy.maxHp).toBe(1);
        expect(hard.effectiveStats?.attack ?? 0).toBeGreaterThan(legacy.effectiveStats?.attack ?? 0);
      });

      it("multiplies victory exp and gold by the difficulty rates", () => {
        const legacyProject = createBlankProject();
        const legacy = slimeBattle(legacyProject, undefined);
        winBattle(legacy);
        const easy = slimeBattle(difficultyProject(), "easy");
        winBattle(easy);
        expect(legacy.snapshot().result).toBe("victory");
        expect(easy.snapshot().result).toBe("victory");
        expect(easy.snapshot().rewards.exp).toBe(legacy.snapshot().rewards.exp * 2);
        expect(easy.snapshot().rewards.gold).toBe(legacy.snapshot().rewards.gold * 3);
      });

      it("setDifficulty changes the session difficulty and the difficulty condition reads it", () => {
        const project = difficultyProject();
        const session = runAll([{ kind: "setDifficulty", difficultyId: "easy" }], project);
        expect(session.difficultyId).toBe("easy");
        expect(evalCondition(session, { kind: "difficulty", difficultyId: "easy" })).toBe(true);
        expect(evalCondition(session, { kind: "difficulty", difficultyId: "hard" })).toBe(false);
        // 없는 id 는 무시한다.
        runAll([{ kind: "setDifficulty", difficultyId: "nope" }], project, session);
        expect(session.difficultyId).toBe("easy");
      });

      it("scales the random-encounter accumulator by encounterRate", () => {
        // 세션 시드 1 의 첫 인카운트 난수는 0.789 — 누적 500 은 발동하지 않고, ×2(hard) = 1000 은 반드시 발동한다.
        const encounterCalls = (difficultyId: string | undefined): string[] => {
          const project = difficultyProject();
          project.system.actionCombat = { enabled: false };
          const map = project.maps[project.startMapId]!;
          map.encounterRate = 500;
          map.troopIds = ["troop_slime"];
          map.encounterTable = undefined;
          store.replaceProject(project);
          const calls: string[] = [];
          const session = startSession(project, 1);
          if (difficultyId) session.difficultyId = difficultyId;
          const scene = {
            running: false,
            inputEnabled: true,
            map: store.getCurrent().maps[project.startMapId] as GameMap,
            tileX: project.startPos.x,
            tileY: project.startPos.y,
            session,
            playBattle: async () => { calls.push("battle"); return "escape" as const; },
            setInputEnabled: (enabled: boolean) => { scene.inputEnabled = enabled; },
          } as unknown as PlaySceneContext & { inputEnabled: boolean };
          resetEncounterCounter();
          maybeTriggerRandomEncounter(scene);
          return calls;
        };
        expect(encounterCalls("easy")).toEqual([]);
        expect(encounterCalls("hard")).toEqual(["battle"]);
      });

      it("survives normalize, project shape validation and save/load", () => {
        const project = difficultyProject();
        const normalized = normalizeSystemRecords(project.system);
        expect(normalized.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
        expect(normalized.defaultDifficultyId).toBe("hard");
        expect(normalizeSystemRecords(createBlankProject().system).difficulties).toBeUndefined();
        const reloaded = deserialize(serialize(project));
        expect(reloaded.system.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
        expect(reloaded.system.defaultDifficultyId).toBe("hard");

        const session = startSession(project, 1);
        session.difficultyId = "easy";
        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.difficultyId).toBe("easy");
      });

      it("normalizes rates, drops blank ids and falls back when the session difficulty was deleted", () => {
        const rows = normalizeDifficulties([
          { id: " a ", name: "", enemyHpRate: 99, expRate: 1 },
          { id: "", name: "빈 id" },
          { id: "a", name: "중복" },
        ]);
        expect(rows).toEqual([{ id: "a", name: "a", enemyHpRate: 10 }]);
        const system = { difficulties: rows, defaultDifficultyId: undefined };
        expect(activeDifficultyId(system, { difficultyId: "deleted" })).toBe("a");
        expect(difficultyRate(system, { difficultyId: "deleted" }, "enemyHpRate")).toBe(10);
      });
    });
  });
  describe("monsterCare", () => {
    isolateTimers();
    function careProject(): Project {
      const project = createBlankProject();
      project.system.monsterCollection = true;
      project.database.items.push(
        normalizeItemRecord({
          id: "item_monster_berry",
          name: "몬스터 열매",
          scope: "none",
          price: 10,
          type: "special",
          occasion: "field",
          consumable: true,
          careProfile: { kind: "feed", friendshipDelta: 20, expDelta: 0 },
        }),
        normalizeItemRecord({
          id: "item_monster_toy",
          name: "장난감",
          scope: "none",
          price: 15,
          type: "special",
          occasion: "field",
          consumable: true,
          careProfile: { kind: "toy", friendshipDelta: 15 },
        })
      );
      return project;
    }
    describe("monster out-of-battle care", () => {
      it("resolves monsterCare defaults", () => {
        const project = createBlankProject();
        expect(resolveMonsterCare(project)).toEqual({
          stepsPerTick: 50,
          walkFriendship: 1,
          walkExp: 1,
          dailyCareCap: 30,
        });

        project.system.monsterCare = {
          stepsPerTick: 10,
          walkFriendship: 2,
          walkExp: 3,
          dailyCareCap: 5,
        };
        expect(resolveMonsterCare(project)).toEqual({
          stepsPerTick: 10,
          walkFriendship: 2,
          walkExp: 3,
          dailyCareCap: 5,
        });

        const normalized = normalizeSystemRecords({
          startActorIds: project.system.startActorIds,
          monsterCare: { stepsPerTick: 0, walkFriendship: -1, walkExp: 4, dailyCareCap: 9 },
        });
        expect(normalized.monsterCare).toEqual({
          stepsPerTick: 50,
          walkFriendship: 0,
          walkExp: 4,
          dailyCareCap: 9,
        });
      });

      it("care item on party monster increases friendship and consumes item", () => {
        const project = careProject();
        const session = startSession(project, 1);
        session.inventory.item_monster_berry = 2;
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;

        const result = applyCareItem(project, session, {
          itemId: "item_monster_berry",
          instanceId: gift.instance.instanceId,
        });
        expect(result).toMatchObject({
          ok: true,
          friendship: 90,
          friendshipDelta: 20,
          kind: "feed",
        });
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(90);
        expect(session.inventory.item_monster_berry).toBe(1);

        const menu = useItemFromMenu(project, session, "item_monster_berry", undefined, gift.instance.instanceId);
        expect(menu.kind).toBe("used");
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(110);
        expect(session.inventory.item_monster_berry ?? 0).toBe(0);
      });

      it.each([
        ["astronomical", 1e300],
        ["over cap", ITEM_QUANTITY_MAX + 1],
        ["infinite", Number.POSITIVE_INFINITY],
        ["zero", 0],
        ["missing", undefined],
      ])("rejects %s care-item inventory without mutating any session state", (_label, quantity) => {
        const project = careProject();
        const careItem = project.database.items.find((item) => item.id === "item_monster_berry");
        if (!careItem) throw new Error("missing care item");
        careItem.careProfile = { kind: "feed", friendshipDelta: 20, expDelta: 500 };
        const session = startSession(project, 11);
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;
        if (quantity === undefined) delete session.inventory.item_monster_berry;
        else session.inventory.item_monster_berry = quantity;
        const before = structuredClone(session);

        expect(applyCareItem(project, session, {
          itemId: "item_monster_berry",
          instanceId: gift.instance.instanceId,
        })).toEqual({ ok: false, reason: "noInventory" });
        expect(session).toEqual(before);
      });

      it("care item on box monster fails", () => {
        const project = careProject();
        const session = startSession(project, 2);
        session.inventory.item_monster_toy = 1;
        for (let index = 0; index < 6; index += 1) {
          giveMonster(project, session, { speciesId: "species_wild_slime", level: 2 });
        }
        const boxed = giveMonster(project, session, { speciesId: "species_wild_slime", level: 2, friendship: 40 });
        expect(boxed.ok && boxed.location).toBe("box");
        if (!boxed.ok) return;

        const result = applyCareItem(project, session, {
          itemId: "item_monster_toy",
          instanceId: boxed.instance.instanceId,
        });
        expect(result).toEqual({ ok: false, reason: "notInParty" });
        expect(session.inventory.item_monster_toy).toBe(1);
        expect(session.monsterInstances[boxed.instance.instanceId]?.friendship).toBe(40);

        const moved = moveMonster(session, boxed.instance.instanceId, "box", project);
        expect(moved.ok).toBe(true);
        const menu = useItemFromMenu(project, session, "item_monster_toy", undefined, boxed.instance.instanceId);
        expect(menu.kind).toBe("unusable");
        expect(session.inventory.item_monster_toy).toBe(1);
      });

      it("walk ticks at 50 steps apply +1 friendship under cap", () => {
        const project = careProject();
        const session = startSession(project, 3);
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 10 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;

        const partial = applyWalkCareTicks(project, session, 49);
        expect(partial.ticksApplied).toBe(0);
        expect(session.monsterCareSteps).toBe(49);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(10);

        const tick = applyWalkCareTicks(project, session, 1);
        expect(tick.ticksApplied).toBe(1);
        expect(tick.friendshipGranted).toBe(1);
        expect(session.monsterCareSteps).toBe(0);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(11);
        expect(session.monsterCareDaily?.["no-time"]).toBe(1);
      });

      it("dailyCareCap blocks further walk friendship", () => {
        const project = careProject();
        project.system.monsterCare = {
          stepsPerTick: 1,
          walkFriendship: 5,
          walkExp: 0,
          dailyCareCap: 12,
        };
        const session = startSession(project, 4);
        session.gameTime = { minute: 0, hour: 8, day: 1, season: "spring", year: 1 };
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 0 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;

        applyWalkCareTicks(project, session, 3);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
        expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

        applyWalkCareTicks(project, session, 10);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(12);
        expect(session.monsterCareDaily?.["1:spring:1"]).toBe(12);

        session.gameTime = { minute: 0, hour: 8, day: 2, season: "spring", year: 1 };
        applyWalkCareTicks(project, session, 1);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(17);
        expect(session.monsterCareDaily?.["1:spring:2"]).toBe(5);
      });

      it("save/load preserves care counters and friendship", () => {
        const project = careProject();
        const session = startSession(project, 5);
        session.inventory.item_monster_berry = 1;
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 50 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;

        applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
        applyWalkCareTicks(project, session, 75);
        expect(session.monsterCareSteps).toBe(25);
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);

        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.monsterCareSteps).toBe(25);
        expect(restored.monsterCareDaily).toEqual(session.monsterCareDaily);
        expect(restored.monsterInstances[gift.instance.instanceId]?.friendship).toBe(71);
        expect(restored.inventory.item_monster_berry ?? 0).toBe(0);
      });

      it("care item friendship can unlock friendship evolution", () => {
        const project = careProject();
        const species = project.database.monsterSpecies?.find((entry) => entry.id === "species_wild_slime");
        if (!species) throw new Error("missing slime");
        species.evolutions = [{ toSpeciesId: "species_king_slime", requires: { friendshipAtLeast: 200 } }];

        const session = startSession(project, 6);
        session.inventory.item_monster_berry = 7;
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, friendship: 70 });
        expect(gift.ok).toBe(true);
        if (!gift.ok) return;

        for (let index = 0; index < 6; index += 1) {
          const care = applyCareItem(project, session, {
            itemId: "item_monster_berry",
            instanceId: gift.instance.instanceId,
          });
          expect(care.ok).toBe(true);
        }
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(190);

        const blocked = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
        expect(blocked.ok).toBe(false);

        applyCareItem(project, session, { itemId: "item_monster_berry", instanceId: gift.instance.instanceId });
        expect(session.monsterInstances[gift.instance.instanceId]?.friendship).toBe(210);

        const evolved = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
        expect(evolved.ok && evolved.toSpeciesId).toBe("species_king_slime");
        expect(session.monsterInstances[gift.instance.instanceId]?.speciesId).toBe("species_king_slime");
      });
    });
  });
  // 레벨업 기술 배우기 — 칸이 모자라 보류로 가는 기술은 미리보기에서 overflowSkillIds 로 가려야 한다.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
  describe("monsterLearnOverflowPreview", () => {
    isolateTimers();
    const IDS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;
    function move(id: string): SkillRecord {
      return normalizeSkillRecord({
        id, name: id, scope: "enemy", power: 10, description: "", type: "normal",
        mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
        effect: { kind: "damage", statistic: "attack", affects: "hp" }, maxPp: 10,
      });
    }
    function fixture(skillLevels: readonly number[]): Project {
      const project = createBlankProject();
      project.database.skills = [...project.database.skills, ...IDS.map(move)];
      const species: MonsterSpeciesRecord = {
        id: "sp",
        name: "Sp",
        graphic: { graphicHue: 0, transparent: false, flying: false },
        baseStats: { maxHp: 30, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
        expCurve: { base: 30, extra: 20, acceleration: 30 },
        captureRate: 0.5,
        skillsByLevel: skillLevels.map((level, index) => ({ level, skillId: IDS[index]! })),
      };
      project.database.monsterSpecies = [species];
      project.system.monsterCollection = true;
      return project;
    }
    describe("splitLearnedMonsterSkills", () => {
      it("fills the free slots first and overflows the rest in learn order", () => {
        expect(splitLearnedMonsterSkills(["a", "b", "c"], ["x", "y"])).toEqual({ learned: ["x"], overflow: ["y"] });
        expect(splitLearnedMonsterSkills(["a"], ["x", "y"])).toEqual({ learned: ["x", "y"], overflow: [] });
        expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["x"])).toEqual({ learned: [], overflow: ["x"] });
      });

      it("ignores moves that are already active and de-duplicates", () => {
        expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["a", "x", "x"])).toEqual({ learned: [], overflow: ["x"] });
      });
    });
    describe("previewMonsterExperience overflowSkillIds", () => {
      it("marks the fifth move as overflow and leaves the field out when nothing overflows", () => {
        // Break: the result narration said 「배웠다!」 for a move that only went to pendingSkillIds.
        const project = fixture([1, 2, 3, 4, 5]);
        const species = project.database.monsterSpecies![0]!;
        const session = startSession(project, 7);
        const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
        if (!given.ok) throw new Error("fixture monster was not created");
        const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };

        const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
        expect(preview!.learnedSkillIds).toEqual(["m5"]);
        expect(preview!.overflowSkillIds).toEqual(["m5"]);

        // 같은 입력으로 실제 적립하면 보류로 간다 — 미리보기와 일치해야 한다.
        session.monsterInstances[instance.instanceId] = instance;
        applyMonsterExperienceAndEvolution(project, session, 1, [instance.instanceId]);
        expect(session.monsterInstances[instance.instanceId]!.pendingSkillIds).toEqual(["m5"]);
      });

      it("has no overflow field while a slot is free", () => {
        const project = fixture([1, 2, 5]);
        const species = project.database.monsterSpecies![0]!;
        const session = startSession(project, 7);
        const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
        if (!given.ok) throw new Error("fixture monster was not created");
        const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };
        const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
        expect(preview!.learnedSkillIds).toEqual(["m3"]);
        expect(preview!.overflowSkillIds).toBeUndefined();
      });
    });
  });
  // 몬스터 성격·노력치(옵트인) — 공식, 저장 바이트, 노력치 상한·합산, evYield 정규화, giveMonster 의 성격 부여.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
  describe("monsterStatRules", () => {
    isolateTimers();
    function speciesRecord(extra: Partial<MonsterSpeciesRecord> = {}): MonsterSpeciesRecord {
      return normalizeMonsterSpeciesRecord({
        id: "sp", name: "Sp", graphic: { graphicHue: 0, transparent: false, flying: false },
        baseStats: { maxHp: 40, maxMp: 0, attack: 50, defense: 50, mind: 50, agility: 50 },
        captureRate: 0.5, ...extra,
      });
    }
    function fixture(rules?: { natures?: boolean; evs?: boolean }): Project {
      const project = createBlankProject();
      project.database.monsterSpecies = [speciesRecord()];
      project.system.monsterCollection = true;
      if (rules) project.system.monsterStatRules = rules;
      return project;
    }
    const IVS = { hp: 10, atk: 10, def: 10, spd: 10 };
    describe("monsterBattleStatsForSpecies extras", () => {
      const species = speciesRecord();

      it("is byte-identical to the old formula without extras", () => {
        // 50 level: floor((100+10)*50/100)+5 = 60, HP floor((80+10)*50/100)+60 = 105
        expect(monsterBattleStatsForSpecies(species, 50, IVS)).toMatchObject({ maxHp: 105, attack: 60, defense: 60, agility: 60 });
        expect(monsterBattleStatsForSpecies(species, 50, IVS, {})).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
      });

      it("applies +10% / -10% after the base formula and leaves HP and the other stats alone", () => {
        const stats = monsterBattleStatsForSpecies(species, 50, IVS, { nature: "brave" });
        expect(stats.attack).toBe(66);
        expect(stats.agility).toBe(54);
        expect(stats.defense).toBe(60);
        expect(stats.maxHp).toBe(105);
      });

      it("still moves a single-digit stat by at least 1 (small-stat games)", () => {
        const tiny = speciesRecord({ baseStats: { maxHp: 5, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 } });
        const plain = monsterBattleStatsForSpecies(tiny, 5, IVS);
        const brave = monsterBattleStatsForSpecies(tiny, 5, IVS, { nature: "brave" });
        expect(brave.attack).toBe(plain.attack + 1);
        expect(brave.agility).toBe(Math.max(1, plain.agility - 1));
      });

      it("a neutral nature changes nothing", () => {
        expect(monsterBattleStatsForSpecies(species, 50, IVS, { nature: "steady" })).toEqual(monsterBattleStatsForSpecies(species, 50, IVS));
      });

      it("adds floor(ev/4) to the stat before the level scale", () => {
        // Levels clamp to ACTOR_LEVEL_MAX (99), so the requested Lv100 is scaled by 99/100: the +63 lands before the scale.
        const base = monsterBattleStatsForSpecies(species, 100, IVS);
        const withEv = monsterBattleStatsForSpecies(species, 100, IVS, { evs: { atk: 252, hp: 252 } });
        const scaled = (raw: number): number => Math.floor(raw * 99 / 100);
        expect(withEv.attack - base.attack).toBe(scaled(2 * 50 + 10 + 63) - scaled(2 * 50 + 10));
        expect(withEv.maxHp - base.maxHp).toBe(scaled(2 * 40 + 10 + 63) - scaled(2 * 40 + 10));
        expect(withEv.maxHp - base.maxHp).toBe(62);
      });
    });
    describe("rules gate", () => {
      it("ignores nature and evs on the instance while the project rules are off", () => {
        const project = fixture();
        const session = startSession(project, 1);
        const given = giveMonster(project, session, { speciesId: "sp", level: 50, nature: "brave" });
        if (!given.ok) throw new Error("fixture");
        expect(given.instance.nature).toBeUndefined();
        expect(monsterBattleStats(project, { ...given.instance, nature: "brave", evs: { hp: 0, atk: 252, def: 0, spd: 0 } })).toEqual(monsterBattleStats(project, given.instance));
      });

      it("gives a deterministic nature when natures is on, and honours an authored one", () => {
        const project = fixture({ natures: true });
        const session = startSession(project, 1);
        const first = giveMonster(project, session, { speciesId: "sp", level: 5 });
        const authored = giveMonster(project, session, { speciesId: "sp", level: 5, nature: "timid" });
        if (!first.ok || !authored.ok) throw new Error("fixture");
        expect(MONSTER_NATURES.some((nature) => nature.id === first.instance.nature)).toBe(true);
        expect(authored.instance.nature).toBe("timid");
        expect(natureIdFromSeed("a")).toBe(natureIdFromSeed("a"));
      });
    });
    describe("evs helpers", () => {
      it("clamps per stat 255 and total 510", () => {
        // Over the 510 total, clampMonsterEvs trims from the last stat backwards (spd → def → atk → hp).
        expect(clampMonsterEvs({ hp: 300, atk: 300, def: 300, spd: 0 })).toEqual({ hp: 255, atk: 255, def: 0, spd: 0 });
        expect(clampMonsterEvs({ hp: 200, atk: 200, def: 200, spd: 200 })).toEqual({ hp: 200, atk: 200, def: 110, spd: 0 });
        expect(clampMonsterEvs(undefined)).toEqual({ hp: 0, atk: 0, def: 0, spd: 0 });
      });

      it("adds a gain without exceeding the caps and returns the base when nothing is gained", () => {
        expect(addMonsterEvs({ hp: 0, atk: 254, def: 0, spd: 0 }, { atk: 3 }).atk).toBe(255);
        expect(addMonsterEvs({ hp: 1, atk: 2, def: 3, spd: 4 }, undefined)).toEqual({ hp: 1, atk: 2, def: 3, spd: 4 });
      });

      it("sums evYield over defeated species and is undefined when there is none", () => {
        const a = speciesRecord({ evYield: { atk: 2 } });
        const b = speciesRecord({ evYield: { atk: 1, spd: 1 } });
        expect(monsterEvYieldOf([a, b, undefined])).toEqual({ atk: 3, spd: 1 });
        expect(monsterEvYieldOf([speciesRecord()])).toBeUndefined();
      });
    });
    describe("normalization", () => {
      it("cuts evYield to 0-3 per stat, total 3, and drops it when empty", () => {
        expect(speciesRecord({ evYield: { hp: 9, atk: 9 } }).evYield).toEqual({ hp: 3 });
        expect(speciesRecord({ evYield: { hp: 0 } }).evYield).toBeUndefined();
        expect(speciesRecord().evYield).toBeUndefined();
      });

      it("keeps monsterStatRules only for the axes that are on", () => {
        // Break: the system normalizer is a whitelist; a field it forgets vanishes on one save/load round trip.
        expect(normalizeSystemRecords({ startActorIds: [] }).monsterStatRules).toBeUndefined();
        expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: false, evs: false } }).monsterStatRules).toBeUndefined();
        expect(normalizeSystemRecords({ startActorIds: [], monsterStatRules: { natures: true, evs: false } }).monsterStatRules).toEqual({ natures: true });
      });

      it("describes a nature in a few characters", () => {
        expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "brave"))).toBe("공격↑ 속도↓");
        expect(monsterNatureEffectText(MONSTER_NATURES.find((nature) => nature.id === "steady"))).toBe("능력 보정 없음");
      });
    });
  });
  describe("normalAttackEquipmentStateOrder", () => {
    isolateTimers();
    // 상태를 피해보다 먼저 기록하면 「방어 하락」이 타격 전에 뜨고 그 타격에 쓰러진 적에게도 뜬다(2026-11-04 ultrabrain #4202).

    const HERO_ID = "actor_hero";
    const ENEMY_ID = "enemy_slime";
    const TROOP_ID = "troop_slime";
    const WEAPON_ID = "equip_order_probe";
    function project(enemyHp: number, { startAsleep = false } = {}): Project {
      const p = createBlankProject();
      p.system.battleFlow = "strict";
      p.session.partyActorIds = [HERO_ID];
      p.system.startActorIds = [HERO_ID];
      const actor = p.database.actors.find((record) => record.id === HERO_ID)!;
      actor.critical = { enabled: false, chanceDenominator: 20 };
      actor.parameterCurves.attack = actor.parameterCurves.attack.map(() => 60);
      const enemy = p.database.enemies.find((record) => record.id === ENEMY_ID)!;
      enemy.stats = { maxHp: enemyHp, maxMp: 999, attack: 40, defense: 10, mind: 10, agility: 1 };
      enemy.actions = [];
      p.database.states.find((record) => record.id === "state_sleep")!.recoverWhenHitChance = 100;
      p.database.equipment.push(normalizeEquipmentRecord({
        id: WEAPON_ID,
        name: WEAPON_ID,
        slot: "weapon",
        description: "평타 상태 순서 검증용 무기",
        statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
        equippableActorIds: [HERO_ID],
        stateInflictIds: ["state_defense_down"],
        stateInflictionChance: 100,
      }));
      if (startAsleep) {
        const sleepCommand = { kind: "m2Command", commandId: "m2-100-change-enemy-state", fields: { target: "enemy-1", operation: "add", value: "state_sleep" } } as unknown as Command;
        p.database.troops.find((record) => record.id === TROOP_ID)!.battleEventPages = [
          { id: "page_sleep", name: "잠든 채 시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }], commands: [sleepCommand] },
        ];
      }
      return p;
    }
    function heroAttack(p: Project, { warmUpRounds = 0 } = {}): BattleTimelineEntrySnapshot[] {
      const runtime = createBattleRuntime({
        project: p,
        troopId: TROOP_ID,
        battleFlow: "strict",
        canEscape: false,
        canLose: true,
        party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 1 }, experience: {}, equipment: { [HERO_ID]: { weapon: WEAPON_ID } } },
        rng: () => 0,
      });
      for (let i = 0; i < warmUpRounds; i += 1) runtime.performActorCommand({ kind: "defend" });
      if (warmUpRounds > 0) expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_sleep");
      const before = runtime.snapshot().timeline.length;
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      return runtime.snapshot().timeline.slice(before).filter((entry) => entry.targetId === "enemy-1");
    }
    const order = (entries: readonly BattleTimelineEntrySnapshot[]): string[] =>
      entries
        .filter((entry) => entry.kind === "damage" || entry.kind === "stateAdded" || entry.kind === "stateRemoved")
        .map((entry) => (entry.kind === "damage" ? "damage" : `${entry.kind}:${entry.stateId}`));
    describe("장비 평타 상태 부여 순서", () => {
      it("100% 상태 무기는 피해 다음에 상태를 기록한다", () => {
        expect(order(heroAttack(project(9999)))).toEqual(["damage", "stateAdded:state_defense_down"]);
      });

      it("그 타격에 쓰러진 적에게는 상태를 기록하지 않는다", () => {
        const entries = heroAttack(project(1));
        expect(entries.some((entry) => entry.kind === "damage")).toBe(true);
        expect(entries.some((entry) => entry.kind === "stateAdded")).toBe(false);
      });

      it("잠든 적은 피해 → 깸 → 상태 순서다", () => {
        const entries = heroAttack(project(9999, { startAsleep: true }), { warmUpRounds: 1 });
        expect(order(entries)).toEqual(["damage", "stateRemoved:state_sleep", "stateAdded:state_defense_down"]);
      });
    });
  });
  describe("p0Bundles", () => {
    isolateTimers();
    function bundleProject() {
      const project = createBlankProject();
      for (const id of ["item_turnip", "item_reward"]) {
        const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
        const index = project.database.items.findIndex((item) => item.id === id);
        if (index >= 0) project.database.items[index] = record;
        else project.database.items.push(record);
      }
      project.switches.push(
        { id: "sw_bundle", name: "Bundle" },
        { id: "sw_bridge", name: "Bridge" },
      );
      project.system.craftRecipes = [{ id: "recipe_preserves", ingredients: [], outputItemId: "item_reward" }];
      project.system.worldUnlocks = [{ id: "region_bridge", switchId: "sw_bridge" }];
      project.system.bundles = [{
        id: "bundle_spring",
        requirements: [{ itemId: "item_turnip", count: 3 }],
        reward: {
          gold: 50,
          itemRewards: [{ itemId: "item_reward", count: 2 }],
          switchId: "sw_bundle",
          worldUnlockIds: ["region_bridge"],
          recipeIds: ["recipe_preserves"],
        },
      }];
      return project;
    }
    describe("P0 bundle contribution rules", () => {
      it("tracks partial progress, then applies completion rewards exactly once", () => {
        // Break caught: partial donation completes early or a repeated completion re-grants rewards.
        const project = bundleProject();
        const session = startSession(project, 1);
        session.inventory = { item_turnip: 3 };
        session.gold = GOLD_MAX - 25;

        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 2)).toMatchObject({
          ok: true,
          contributed: 2,
          required: 3,
          completed: false,
          rewardApplied: false,
        });
        expect(session.inventory.item_turnip).toBe(1);
        expect(session.bundleContributions?.bundle_spring?.item_turnip).toBe(2);

        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
          ok: true,
          contributed: 3,
          completed: true,
          rewardApplied: true,
        });
        expect(session.inventory.item_turnip).toBeUndefined();
        expect(session.inventory.item_reward).toBe(2);
        expect(session.gold).toBe(GOLD_MAX);
        expect(session.switches.sw_bundle).toBe(true);
        expect(session.switches.sw_bridge).toBe(true);
        expect(session.completedBundleIds).toEqual(["bundle_spring"]);
        expect(session.bundleRewardAppliedIds).toEqual(["bundle_spring"]);
        expect(session.unlockedRegionIds).toEqual(["region_bridge"]);
        expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);

        const frozen = structuredClone(session);
        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 1)).toMatchObject({
          ok: false,
          reason: "already-complete",
        });
        expect(session).toEqual(frozen);
      });

      it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
        "rejects malformed contribution count %s without mutation",
        (count) => {
          // Break caught: malformed contributions mutate inventory or progress.
          const project = bundleProject();
          const session = startSession(project, 2);
          session.inventory = { item_turnip: 3 };
          expect(contributeBundle(project, session, "bundle_spring", "item_turnip", count)).toMatchObject({
            ok: false,
            reason: "invalid-count",
          });
          expect(session.inventory).toEqual({ item_turnip: 3 });
          expect(session.bundleContributions).toEqual({});
        },
      );

      it("rejects over-donation, insufficient inventory, and unknown targets without item loss", () => {
        // Break caught: an invalid contribution consumes the offered stack before checking the requirement.
        const project = bundleProject();
        const session = startSession(project, 3);
        session.inventory = { item_turnip: 2 };
        const before = structuredClone(session);

        expect(contributeBundle(project, session, "bundle_missing", "item_turnip", 1)).toMatchObject({ ok: false, reason: "missing-bundle" });
        expect(contributeBundle(project, session, "bundle_spring", "item_missing", 1)).toMatchObject({ ok: false, reason: "item-not-required" });
        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 4)).toMatchObject({ ok: false, reason: "exceeds-requirement" });
        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
        expect(session).toEqual(before);
      });

      it("validates every completion reward before consuming the final contribution", () => {
        // Break caught: a missing reward reference is discovered after the donated item is gone.
        const project = bundleProject();
        project.system.bundles![0] = {
          ...project.system.bundles![0]!,
          reward: {
            itemRewards: [{ itemId: "item_missing_reward", count: 1 }],
            switchId: "sw_missing",
            worldUnlockIds: ["region_missing"],
            recipeIds: ["recipe_missing"],
          },
        };
        const session = startSession(project, 4);
        session.inventory = { item_turnip: 3 };
        const before = structuredClone(session);

        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
          ok: false,
          reason: "invalid-reward",
        });
        expect(session).toEqual(before);
      });

      it("rejects duplicate reward item rows before their combined count can overflow", () => {
        // Break caught: duplicate rows each pass an isolated overflow check, then both mutate inventory.
        const project = bundleProject();
        project.system.bundles![0] = {
          ...project.system.bundles![0]!,
          reward: {
            itemRewards: [
              { itemId: "item_reward", count: 1 },
              { itemId: "item_reward", count: 1 },
            ],
          },
        };
        const session = startSession(project, 6);
        session.inventory = { item_turnip: 3, item_reward: 9_999_998 };
        const before = structuredClone(session);
        expect(contributeBundle(project, session, "bundle_spring", "item_turnip", 3)).toMatchObject({
          ok: false,
          reason: "invalid-reward",
        });
        expect(session).toEqual(before);
      });
    });
  });
});

describe("p0LifeSkillProgress", () => {
  isolateTimers();
  describe("p0CommerceFinalSafety", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();
      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    function fakeScene(session: ReturnType<typeof startSession>): PlaySceneContext {
      return { session, syncRuntimeState: () => {} } as unknown as PlaySceneContext;
    }
    function shopItem() {
      return normalizeItemRecord({ id: "item_shop_safe", name: "Safe shop item", scope: "none", price: 40 });
    }
    function hostileSnapshot(): { project: ReturnType<typeof createBlankProject>; snapshot: SaveSnapshot } {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, startSession(project, 301));
      const session = snapshot.session as unknown as Record<string, unknown>;
      session.gold = "forged";
      session.shopLoyaltySpend = {
        safe: 12,
        max: GOLD_MAX,
        over: GOLD_MAX + 1,
        huge: 1e300,
        fractional: 1.5,
        negative: -1,
      };
      session.shopTradeCounts = {
        safe: { sold: 2, bought: 3 },
        max: { sold: GOLD_MAX, bought: GOLD_MAX },
        soldOver: { sold: GOLD_MAX + 1, bought: 0 },
        boughtHuge: { sold: 0, bought: 1e300 },
        fractional: { sold: 0.5, bought: 1 },
      };
      session.shopMileagePoints = GOLD_MAX + 1;
      return { project, snapshot };
    }
    const EXPECTED_LOYALTY = { safe: 12, max: GOLD_MAX };
    const EXPECTED_TRADES = {
      safe: { sold: 2, bought: 3 },
      max: { sold: GOLD_MAX, bought: GOLD_MAX },
    };
    describe("P0 shop sell atomic safety", () => {
      it.each([1e300, ITEM_QUANTITY_MAX + 1, Number.POSITIVE_INFINITY])(
        "does not mutate any economy state when the sold stack is %s",
        (owned) => {
          // Break caught: sell ignored changeItemsAtomically's false result, then
          // still credited gold, advanced sold counts, and returned merchant gold.
          const project = createBlankProject();
          const item = shopItem();
          const session = startSession(project, 201);
          session.inventory = { [item.id]: owned };
          session.gold = 100;
          session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
          session.shopLoyaltySpend = { global: 4 };
          session.shopMileagePoints = 5;
          const before = structuredClone(session);

          const result = handleShopTransaction(fakeScene(session), item, "sell", 1, 100);

          expect(result.ok).toBe(false);
          expect("merchantGold" in result).toBe(false);
          expect(session).toEqual(before);
        },
      );

      it.each([
        {
          label: "a full player gold destination",
          configure: (session: ReturnType<typeof startSession>, itemId: string) => { session.gold = GOLD_MAX; },
          merchantGold: 100,
        },
        {
          label: "a full sold counter",
          configure: (session: ReturnType<typeof startSession>, itemId: string) => {
            session.shopTradeCounts = { [itemId]: { sold: GOLD_MAX, bought: 0 } };
          },
          merchantGold: 100,
        },
        {
          label: "a poisoned sold counter",
          configure: (session: ReturnType<typeof startSession>, itemId: string) => {
            session.shopTradeCounts = { [itemId]: { sold: 1e300, bought: 0 } };
          },
          merchantGold: 100,
        },
        {
          label: "a poisoned bought counter",
          configure: (session: ReturnType<typeof startSession>, itemId: string) => {
            session.shopTradeCounts = { [itemId]: { sold: 0, bought: Number.POSITIVE_INFINITY } };
          },
          merchantGold: 100,
        },
        {
          label: "poisoned mileage",
          configure: (session: ReturnType<typeof startSession>) => { session.shopMileagePoints = GOLD_MAX + 1; },
          merchantGold: 100,
        },
        {
          label: "poisoned loyalty",
          configure: (session: ReturnType<typeof startSession>) => { session.shopLoyaltySpend = { global: 1e300 }; },
          merchantGold: 100,
        },
        {
          label: "poisoned merchant gold",
          configure: () => {},
          merchantGold: Number.POSITIVE_INFINITY,
        },
        {
          label: "over-cap merchant gold",
          configure: () => {},
          merchantGold: GOLD_MAX + 1,
        },
      ])("leaves inventory, gold, ledgers, and merchant unchanged for $label", ({ configure, merchantGold }) => {
        const project = createBlankProject();
        const item = shopItem();
        const session = startSession(project, 202);
        session.inventory = { [item.id]: 1 };
        session.gold = 100;
        session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
        session.shopLoyaltySpend = { global: 4 };
        session.shopMileagePoints = 5;
        configure(session, item.id);
        const before = structuredClone(session);

        const result = handleShopTransaction(fakeScene(session), item, "sell", 1, merchantGold);

        expect(result.ok).toBe(false);
        expect("merchantGold" in result).toBe(false);
        expect(session).toEqual(before);
      });

      it("commits a normal sale only after the atomic item removal succeeds", () => {
        const project = createBlankProject();
        const item = shopItem();
        const session = startSession(project, 203);
        session.inventory = { [item.id]: 2 };
        session.gold = 100;
        session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
        session.shopLoyaltySpend = { global: 4 };
        session.shopMileagePoints = 5;

        const result = handleShopTransaction(fakeScene(session), item, "sell", 1, 100);

        expect(result).toMatchObject({ ok: true, merchantGold: 80 });
        expect(session.inventory[item.id]).toBe(1);
        expect(session.gold).toBe(120);
        expect(session.shopTradeCounts).toEqual({ [item.id]: { sold: 3, bought: 3 } });
        expect(session.shopLoyaltySpend).toEqual({ global: 4 });
        expect(session.shopMileagePoints).toBe(5);
      });
    });
    describe("P0 economy save sanitization", () => {
      it("sanitizes hostile writer state while preserving bounded entries", () => {
        const project = createBlankProject();
        const session = startSession(project, 302);
        session.gold = 1e300;
        session.shopLoyaltySpend = {
          safe: 12,
          max: GOLD_MAX,
          over: GOLD_MAX + 1,
          huge: 1e300,
          fractional: 1.5,
        };
        session.shopTradeCounts = {
          safe: { sold: 2, bought: 3 },
          max: { sold: GOLD_MAX, bought: GOLD_MAX },
          invalid: { sold: 1e300, bought: 0 },
        };
        session.shopMileagePoints = Number.POSITIVE_INFINITY;

        const snapshot = createSaveSnapshot(project, session);

        expect(snapshot.session.gold).toBe(0);
        expect(snapshot.session.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
        expect(snapshot.session.shopTradeCounts).toEqual(EXPECTED_TRADES);
        expect(snapshot.session.shopMileagePoints).toBeUndefined();
      });

      it("sanitizes hostile wire values without corrupting the whole save slot", () => {
        const { snapshot } = hostileSnapshot();
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, snapshot);

        const read = readSaveSlot(storage, 1);

        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected sanitized save");
        expect(read.snapshot.session.gold).toBe(0);
        expect(read.snapshot.session.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
        expect(read.snapshot.session.shopTradeCounts).toEqual(EXPECTED_TRADES);
        expect(read.snapshot.session.shopMileagePoints).toBeUndefined();
      });

      it("sanitizes direct snapshot application through the same contract", () => {
        const { project, snapshot } = hostileSnapshot();

        const restored = applySaveSnapshot(project, snapshot);

        expect(restored.gold).toBe(0);
        expect(restored.shopLoyaltySpend).toEqual(EXPECTED_LOYALTY);
        expect(restored.shopTradeCounts).toEqual(EXPECTED_TRADES);
        expect(restored.shopMileagePoints).toBeUndefined();
      });

      it("preserves inclusive GOLD_MAX values through writer, parser, and apply", () => {
        const project = createBlankProject();
        const session = startSession(project, 303);
        session.gold = GOLD_MAX;
        session.shopLoyaltySpend = { max: GOLD_MAX };
        session.shopTradeCounts = { max: { sold: GOLD_MAX, bought: GOLD_MAX } };
        session.shopMileagePoints = GOLD_MAX;
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, createSaveSnapshot(project, session));

        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected bounded save");
        const restored = applySaveSnapshot(project, read.snapshot);

        expect(restored.gold).toBe(GOLD_MAX);
        expect(restored.shopLoyaltySpend).toEqual({ max: GOLD_MAX });
        expect(restored.shopTradeCounts).toEqual({ max: { sold: GOLD_MAX, bought: GOLD_MAX } });
        expect(restored.shopMileagePoints).toBe(GOLD_MAX);
      });
    });
  });
  describe("p0EconomySafetyFollowup", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();
      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    function fakeScene(session: ReturnType<typeof startSession>): PlaySceneContext {
      return { session, syncRuntimeState: () => {} } as unknown as PlaySceneContext;
    }
    function hostileChest(project: ReturnType<typeof createBlankProject>) {
      return {
        id: "chest_hostile",
        mapId: project.startMapId,
        x: 1,
        y: 2,
        inventory: {
          item_safe: 3,
          item_max: ITEM_QUANTITY_MAX,
          item_huge: 1e300,
          item_over: ITEM_QUANTITY_MAX + 1,
        },
      };
    }
    describe("P0 chest quantity safety", () => {
      it("sanitizes hostile chest inventories while parsing a save slot", () => {
        // Break caught: parseSessionRecord clones arbitrary chest objects, so
        // 1e300 and above-cap stacks reach runtime unchanged.
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, startSession(project, 1));
        (snapshot.session as { chests?: unknown }).chests = { chest_hostile: hostileChest(project) };
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, snapshot);

        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected parsed save");
        expect(read.snapshot.session.chests?.chest_hostile?.inventory).toEqual({
          item_safe: 3,
          item_max: ITEM_QUANTITY_MAX,
        });
      });

      it("sanitizes hostile chest inventories when a snapshot is applied directly", () => {
        // Break caught: checkpoints/direct callers can bypass the wire parser and
        // apply unsafe chest quantities straight into a live session.
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, startSession(project, 2));
        (snapshot.session as { chests?: unknown }).chests = { chest_hostile: hostileChest(project) };

        expect(applySaveSnapshot(project, snapshot).chests?.chest_hostile?.inventory).toEqual({
          item_safe: 3,
          item_max: ITEM_QUANTITY_MAX,
        });
      });

      it.each([
        { direction: "deposit" as const, player: 1, chest: ITEM_QUANTITY_MAX },
        { direction: "deposit" as const, player: 1e300, chest: 0 },
        { direction: "deposit" as const, player: ITEM_QUANTITY_MAX + 1, chest: 0 },
        { direction: "deposit" as const, player: 1, chest: 1e300 },
        { direction: "deposit" as const, player: 1, chest: ITEM_QUANTITY_MAX + 1 },
        { direction: "withdraw" as const, player: ITEM_QUANTITY_MAX, chest: 1 },
        { direction: "withdraw" as const, player: 0, chest: 1e300 },
        { direction: "withdraw" as const, player: 0, chest: ITEM_QUANTITY_MAX + 1 },
        { direction: "withdraw" as const, player: 1e300, chest: 1 },
        { direction: "withdraw" as const, player: ITEM_QUANTITY_MAX + 1, chest: 1 },
      ])("leaves both containers unchanged for rejected $direction values ($player/$chest)", ({ direction, player, chest }) => {
        // Break caught: one container mutates before the second container rejects
        // an unsafe source or full/overflow destination.
        const session = startSession(createBlankProject(), 3);
        session.inventory = { item_target: player };
        ensureChest(session, { id: "chest", mapId: session.currentMapId, x: 0, y: 0 }).inventory = { item_target: chest };
        const before = structuredClone({ inventory: session.inventory, chests: session.chests, itemUseCharges: session.itemUseCharges });

        const ok = direction === "deposit"
          ? depositToChest(session, "chest", "item_target", 1)
          : withdrawFromChest(session, "chest", "item_target", 1);

        expect(ok).toBe(false);
        expect({ inventory: session.inventory, chests: session.chests, itemUseCharges: session.itemUseCharges }).toEqual(before);
      });
    });
    describe("P0 crafting quantity safety", () => {
      it("sums duplicate ingredient rows before deciding whether crafting is possible", () => {
        // Break caught: two rows for the same item each pass against the same
        // current count, then sequential clamped removals mint the output.
        const project = createBlankProject();
        project.system.craftRecipes = [{
          id: "recipe_duplicate",
          ingredients: [{ itemId: "item_input", count: 2 }, { itemId: "item_input", count: 2 }],
          outputItemId: "item_output",
          outputCount: 1,
          goldCost: 10,
        }];
        const session = startSession(project, 4);
        session.inventory = { item_input: 3 };
        session.gold = 100;
        const before = structuredClone(session);

        expect(canCraft(project, session, "recipe_duplicate")).toEqual({ ok: false, reason: "missing-ingredients" });
        expect(craftRecipe(project, session, "recipe_duplicate")).toEqual({ ok: false, reason: "missing-ingredients" });
        expect(session).toEqual(before);
      });

      it("consumes the summed duplicate requirement exactly once when enough exists", () => {
        const project = createBlankProject();
        project.system.craftRecipes = [{
          id: "recipe_duplicate",
          ingredients: [{ itemId: "item_input", count: 2 }, { itemId: "item_input", count: 2 }],
          outputItemId: "item_output",
          outputCount: 1,
        }];
        const session = startSession(project, 5);
        session.inventory = { item_input: 4 };

        expect(craftRecipe(project, session, "recipe_duplicate")).toMatchObject({ ok: true });
        expect(session.inventory).toEqual({ item_output: 1 });
      });

      it("does not remove ingredients or gold when the output stack would overflow", () => {
        // Break caught: crafting debits gold and ingredients before its unchecked
        // output grant rejects ITEM_QUANTITY_MAX + 1.
        const project = createBlankProject();
        project.system.craftRecipes = [{
          id: "recipe_overflow",
          ingredients: [{ itemId: "item_input", count: 1 }],
          outputItemId: "item_output",
          outputCount: 1,
          goldCost: 10,
        }];
        const session = startSession(project, 6);
        session.inventory = { item_input: 1, item_output: ITEM_QUANTITY_MAX };
        session.gold = 100;
        const before = structuredClone(session);

        expect(craftRecipe(project, session, "recipe_overflow")).toMatchObject({ ok: false });
        expect(session).toEqual(before);
      });
    });
    describe("P0 shop purchase quantity safety", () => {
      it.each([ITEM_QUANTITY_MAX, ITEM_QUANTITY_MAX + 1, 1e300])(
        "does not debit a purchase or advance trade state when the item stack is %s",
        (current) => {
          // Break caught: buy debits gold before an unchecked item grant, then
          // increments trade counts and returns increased merchant gold anyway.
          const project = createBlankProject();
          const item = normalizeItemRecord({ id: "item_shop", name: "Shop item", scope: "none", price: 40 });
          const session = startSession(project, 7);
          session.inventory = { [item.id]: current };
          session.gold = 500;
          session.shopTradeCounts = { [item.id]: { sold: 2, bought: 3 } };
          const before = structuredClone(session);

          const result = handleShopTransaction(fakeScene(session), item, "buy", 1, 100);

          expect(result.ok).toBe(false);
          expect(session).toEqual(before);
          expect("merchantGold" in result).toBe(false);
        },
      );
    });
  });
  describe("p0LifeSkillProgress", () => {
    isolateTimers();
    function skillProject() {
      const project = createBlankProject();
      const output = normalizeItemRecord({ id: "item_preserves", name: "Preserves", scope: "none", price: 100 });
      const index = project.database.items.findIndex((item) => item.id === output.id);
      if (index >= 0) project.database.items[index] = output;
      else project.database.items.push(output);
      project.switches.push({ id: "sw_farming_2", name: "Farming 2" });
      project.system.skillSystem = { enabled: true };
      project.system.craftRecipes = [{
        id: "recipe_preserves",
        ingredients: [],
        outputItemId: "item_preserves",
        requiresUnlock: true,
      }];
      project.database.lifeSkills = [{
        id: "skill_farming",
        name: "Farming",
        skillType: "farming",
        maxLevel: 5,
        levelUpRewards: [
          { level: 2, switchId: "sw_farming_2" },
          { level: 3, recipeId: "recipe_preserves" },
          { level: 4, switchId: "sw_farming_2", recipeId: "recipe_preserves" },
        ],
      }];
      return project;
    }
    describe("P0 life-skill progression", () => {
      it("applies every crossed level reward once and unlocks real crafting", () => {
        // Break caught: a multi-level XP award skips intermediate rewards or duplicates recipe ids.
        const project = skillProject();
        const session = startSession(project, 1);
        expect(canCraft(project, session, "recipe_preserves")).toMatchObject({ ok: false, reason: "locked" });

        expect(awardLifeSkillXp(project, session, "skill_farming", 500)).toMatchObject({
          ok: true,
          previousLevel: 1,
          level: 4,
          levelsGained: [2, 3, 4],
        });
        expect(session.lifeSkills?.skill_farming).toEqual({ xp: 500, level: 4 });
        expect(session.switches.sw_farming_2).toBe(true);
        expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
        expect(canCraft(project, session, "recipe_preserves").ok).toBe(true);

        expect(awardLifeSkillXp(project, session, "skill_farming", 1)).toMatchObject({ ok: true, levelsGained: [] });
        expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
      });

      it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        "rejects invalid XP award %s without mutation",
        (amount) => {
          // Break caught: malformed or unsafe XP mutates progress before validation.
          const project = skillProject();
          const session = startSession(project, 2);
          expect(awardLifeSkillXp(project, session, "skill_farming", amount)).toMatchObject({ ok: false, reason: "invalid-amount" });
          expect(session.lifeSkills).toEqual({});
          expect(session.unlockedRecipeIds).toEqual([]);
          expect(session.switches.sw_farming_2).toBe(false);
        },
      );

      it("fails closed for disabled, unknown-skill, and malformed current progress", () => {
        // Break caught: an invalid state is normalized in-place and hides save corruption.
        const project = skillProject();
        const disabled = structuredClone(project);
        delete disabled.system.skillSystem;
        const disabledSession = startSession(disabled, 3);
        expect(awardLifeSkillXp(disabled, disabledSession, "skill_farming", 100)).toMatchObject({ ok: false, reason: "disabled" });

        const session = startSession(project, 4);
        expect(awardLifeSkillXp(project, session, "skill_missing", 100)).toMatchObject({ ok: false, reason: "missing-skill" });
        session.lifeSkills = { skill_farming: { xp: Number.NaN, level: 1 } };
        const before = structuredClone(session);
        expect(awardLifeSkillXp(project, session, "skill_farming", 100)).toMatchObject({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });

      it("validates crossed reward references before changing XP", () => {
        // Break caught: XP advances even though its switch/recipe reward cannot be applied.
        const project = skillProject();
        project.database.lifeSkills![0] = {
          ...project.database.lifeSkills![0]!,
          levelUpRewards: [{ level: 2, switchId: "sw_missing", recipeId: "recipe_missing" }],
        };
        const session = startSession(project, 5);
        const before = structuredClone(session);
        expect(awardLifeSkillXp(project, session, "skill_farming", 100)).toMatchObject({ ok: false, reason: "invalid-reward" });
        expect(session).toEqual(before);
      });

      it("routes the existing event command through recipe unlock rewards", () => {
        // Break caught: commandCatalog applies switchId but silently ignores recipeId.
        const project = skillProject();
        const session = startSession(project, 6);
        const interpreter = createInterpreter(
          [{ kind: "changeLifeSkillExp", skillId: "skill_farming", op: "+=", amount: 250 }],
          session,
          project,
        );
        interpreter.start();
        expect(session.lifeSkills?.skill_farming).toEqual({ xp: 250, level: 3 });
        expect(session.unlockedRecipeIds).toEqual(["recipe_preserves"]);
      });
    });
  });
});

describe("p0Makers", () => {
  isolateTimers();
  describe("p0Makers", () => {
    isolateTimers();
    function makerProject() {
      const project = createBlankProject();
      for (const id of ["item_milk", "item_cheese"]) {
        const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
        const index = project.database.items.findIndex((item) => item.id === id);
        if (index >= 0) project.database.items[index] = record;
        else project.database.items.push(record);
      }
      project.system.timeSystem = {
        enabled: true,
        dayStartHour: 6,
        dayEndHour: 26,
        daysPerSeason: 28,
      };
      project.system.makers = [{
        id: "maker_cheese",
        inputs: [{ itemId: "item_milk", count: 1 }],
        outputs: [{ itemId: "item_cheese", count: 2 }],
        durationMinutes: 30,
      }];
      return project;
    }
    describe("P0 timed makers", () => {
      it("uses a monotonic absolute game-minute clock across a season/day boundary", () => {
        // Break caught: spring 28 late-night → summer 1 morning makes the timer move backwards.
        const project = makerProject();
        const before = absoluteGameMinutes(
          { year: 1, season: "spring", day: 28, hour: 25, minute: 30 },
          project.system.timeSystem,
        );
        const after = absoluteGameMinutes(
          { year: 1, season: "summer", day: 1, hour: 6, minute: 0 },
          project.system.timeSystem,
        );
        expect(after - before).toBe(30);

        const session = startSession(project, 1);
        session.inventory = { item_milk: 1 };
        expect(startMaker(project, session, "farm:4,5", "maker_cheese", before)).toMatchObject({
          ok: true,
          readyAtMinute: after,
        });
        expect(session.inventory.item_milk).toBeUndefined();
        expect(advanceMakers(project, session, after - 1)).toEqual({ ok: true, readyInstanceIds: [] });
        expect(session.makerInstances?.["farm:4,5"]?.status).toBe("processing");
        expect(advanceMakers(project, session, after)).toEqual({ ok: true, readyInstanceIds: ["farm:4,5"] });
        expect(session.makerInstances?.["farm:4,5"]?.status).toBe("ready");
      });

      it("preserves a processing timer through the shared save snapshot path", () => {
        // Break caught: a save/load recreates a processing maker as idle or shifts its deadline.
        const project = makerProject();
        const session = startSession(project, 2);
        session.inventory = { item_milk: 1 };
        expect(startMaker(project, session, "farm:1,1", "maker_cheese", 1_000).ok).toBe(true);

        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.makerInstances).toEqual(session.makerInstances);
        expect(advanceMakers(project, restored, 1_030)).toEqual({ ok: true, readyInstanceIds: ["farm:1,1"] });
        expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({
          ok: true,
          outputs: [{ itemId: "item_cheese", count: 2 }],
        });
        expect(restored.inventory.item_cheese).toBe(2);
        expect(restored.makerInstances?.["farm:1,1"]).toEqual({
          instanceId: "farm:1,1",
          makerId: "maker_cheese",
          status: "idle",
        });
        const frozen = structuredClone(restored);
        expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({ ok: false, reason: "not-ready" });
        expect(restored).toEqual(frozen);
      });

      it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        "rejects invalid absolute minute %s before consuming inputs",
        (minute) => {
          // Break caught: invalid/overflow deadlines consume inputs and leave an unusable instance.
          const project = makerProject();
          const session = startSession(project, 3);
          session.inventory = { item_milk: 1 };
          expect(startMaker(project, session, "farm:2,2", "maker_cheese", minute)).toMatchObject({ ok: false, reason: "invalid-time" });
          expect(session.inventory).toEqual({ item_milk: 1 });
          expect(session.makerInstances).toEqual({});
        },
      );

      it("rejects missing inventory, busy instances, and invalid definitions atomically", () => {
        // Break caught: maker input is consumed before busy/definition validation completes.
        const project = makerProject();
        const session = startSession(project, 4);
        session.inventory = {};
        expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "insufficient-input" });
        expect(session.makerInstances).toEqual({});

        session.inventory = { item_milk: 2 };
        expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100).ok).toBe(true);
        const busy = structuredClone(session);
        expect(startMaker(project, session, "farm:3,3", "maker_cheese", 110)).toMatchObject({ ok: false, reason: "busy" });
        expect(session).toEqual(busy);

        const broken = makerProject();
        broken.system.makers![0] = {
          ...broken.system.makers![0]!,
          outputs: [{ itemId: "item_missing", count: 1 }],
        };
        const brokenSession = startSession(broken, 5);
        brokenSession.inventory = { item_milk: 1 };
        const before = structuredClone(brokenSession);
        expect(startMaker(broken, brokenSession, "farm:4,4", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "invalid-definition" });
        expect(brokenSession).toEqual(before);
      });
    });
  });
  describe("p0SafetyHardening", () => {
    isolateTimers();
    const ITEM_MAX = 9_999_999;
    function addItem(project: ReturnType<typeof createBlankProject>, id: string, farmTool?: "axe"): void {
      const item = normalizeItemRecord({ id, name: id, scope: "none", price: 20, farmTool });
      const index = project.database.items.findIndex((entry) => entry.id === id);
      if (index >= 0) project.database.items[index] = item;
      else project.database.items.push(item);
    }
    describe("P0 hostile item quantity hardening", () => {
      it.each([
        { current: 1e300, op: "+=" as const, amount: 1 },
        { current: ITEM_MAX, op: "+=" as const, amount: 1 },
        { current: 1, op: "+=" as const, amount: Number.MAX_SAFE_INTEGER },
        { current: 1, op: "=" as const, amount: 1e300 },
      ])("rejects unsafe current/delta/result without touching inventory or charge cursors: $current $op $amount", ({ current, op, amount }) => {
        // Break caught: changeItem forwards unsafe arithmetic to itemTransitions,
        // silently sanitizing or overflowing state instead of failing atomically.
        const project = createBlankProject();
        const session = startSession(project, 1);
        session.inventory = { item_target: current, item_other: 2 };
        session.itemUseCharges = { item_target: 1, item_other: 1 };
        const before = structuredClone({ inventory: session.inventory, itemUseCharges: session.itemUseCharges });

        expect(changeItem(session, "item_target", op, amount)).toBe(false);
        expect({ inventory: session.inventory, itemUseCharges: session.itemUseCharges }).toEqual(before);
      });

      it("keeps shipping, bundle, and upgrade transactions unchanged for forged 1e300 stacks", () => {
        // Break caught: domain prechecks accept a finite integer like 1e300, then
        // subtraction loses precision and the same forged stack buys multiple outputs.
        const project = createBlankProject();
        for (const id of ["item_input", "item_reward", "item_tool"]) addItem(project, id);
        project.system.shipping = { enabled: true };
        project.system.sellPrices = [{ itemId: "item_input", price: 10 }];
        project.system.bundles = [{
          id: "bundle",
          requirements: [{ itemId: "item_input", count: 1 }],
          reward: { itemRewards: [{ itemId: "item_reward", count: 1 }] },
        }];
        project.system.itemUpgrades = [{
          id: "upgrade",
          fromItemId: "item_input",
          toItemId: "item_tool",
        }];
        const session = startSession(project, 2);
        session.inventory = { item_input: 1e300 };

        for (const action of [
          () => depositShipping(project, session, "item_input", 1),
          () => contributeBundle(project, session, "bundle", "item_input", 1),
          () => applyItemUpgrade(project, session, "upgrade"),
        ]) {
          const before = structuredClone(session);
          expect(action()).toMatchObject({ ok: false });
          expect(session).toEqual(before);
        }
      });

      it("does not start a maker from a safe-integer stack above the shared item cap", () => {
        const project = createBlankProject();
        addItem(project, "item_input");
        addItem(project, "item_output");
        project.system.makers = [{
          id: "maker",
          inputs: [{ itemId: "item_input", count: 1 }],
          outputs: [{ itemId: "item_output", count: 1 }],
          durationMinutes: 10,
        }];
        const session = startSession(project, 5);
        session.inventory = { item_input: ITEM_MAX + 1 };
        const before = structuredClone(session);

        expect(startMaker(project, session, "farm:0,0", "maker", 100)).toMatchObject({ ok: false });
        expect(session).toEqual(before);
      });
    });
  });
  describe("p0SessionPersistence", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number { return this.values.size; }
      clear(): void { this.values.clear(); }
      getItem(key: string): string | null { return this.values.get(key) ?? null; }
      key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string): void { this.values.delete(key); }
      setItem(key: string, value: string): void { this.values.set(key, value); }
    }
    function configureP0PersistenceProject(project: ReturnType<typeof createBlankProject>): void {
      const turnip = normalizeItemRecord({ id: "item_turnip", name: "Turnip", scope: "none", price: 20 });
      const index = project.database.items.findIndex((item) => item.id === turnip.id);
      if (index >= 0) project.database.items[index] = turnip;
      else project.database.items.push(turnip);
      project.system.energy = { max: 100, initial: 80 };
      project.system.shipping = { enabled: true, historyLimit: 28, allowedItemIds: ["item_turnip"] };
      project.system.bundles = [
        { id: "bundle_spring", requirements: [{ itemId: "item_turnip", count: 2 }] },
        { id: "bundle_mine", requirements: [{ itemId: "item_turnip", count: 1 }] },
      ];
      project.system.worldUnlocks = [{ id: "region_bridge" }];
      project.system.craftRecipes = [{ id: "recipe_preserves", ingredients: [], outputItemId: "item_turnip" }];
      project.system.makers = [{
        id: "maker_preserves",
        inputs: [],
        outputs: [{ itemId: "item_turnip", count: 1 }],
        durationMinutes: 1_440,
      }];
      project.system.skillSystem = { enabled: true };
      project.database.lifeSkills = [
        { id: "skill_farming", name: "Farming", skillType: "farming", maxLevel: 5, levelUpRewards: [] },
        { id: "skill_mining", name: "Mining", skillType: "mining", maxLevel: 5, levelUpRewards: [] },
      ];
    }
    describe("P0 save snapshot regression", () => {
      it("preserves life skills and shop economy through writer, parser, and apply", () => {
        // Break caught: createSaveSnapshot/parse/apply silently omits live progression fields.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        project.system.timeSystem = { enabled: true };
        const session = startSession(project, 17);
        session.lifeSkills = { skill_farming: { xp: 275, level: 3 } };
        session.shopLoyaltySpend = { shop_seed: 450 };
        session.shopTradeCounts = { shop_seed: { sold: 7, bought: 4 } };
        session.shopMileagePoints = 39;
        session.shopPawnTickets = {
          ticket_1: { itemId: "item_hoe", pawnPrice: 120, dueDayKey: "1:spring:12" },
        };
        session.shopLastRestockDayKey = { shop_seed: "1:spring:12" };
        session.energy = 72;
        session.gameTime = { year: 1, season: "spring", day: 12, hour: 9, minute: 30 };
        session.shippingQueue = { item_turnip: 4 };
        session.shippingLastSettledDayKey = "1:spring:11";
        session.dayTransitionLastDayKey = "1:spring:11";
        session.shippingHistory = [{
          dayKey: "1:spring:11",
          entries: [{ itemId: "item_turnip", count: 2, unitPrice: 10, subtotal: 20 }],
          total: 20,
          credited: 20,
        }];
        session.bundleContributions = { bundle_spring: { item_turnip: 2 } };
        session.completedBundleIds = ["bundle_mine"];
        session.bundleRewardAppliedIds = ["bundle_mine"];
        session.unlockedRegionIds = ["region_bridge"];
        session.unlockedRecipeIds = ["recipe_preserves"];
        session.makerInstances = {
          "farm:2,3": {
            instanceId: "farm:2,3",
            makerId: "maker_preserves",
            status: "processing",
            startedAtMinute: 500,
            readyAtMinute: 1_940,
          },
        };

        const storage = new MemoryStorage();
        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a parsed save slot");

        const restored = applySaveSnapshot(project, read.snapshot);
        expect(restored.lifeSkills).toEqual(session.lifeSkills);
        expect(restored.shopLoyaltySpend).toEqual(session.shopLoyaltySpend);
        expect(restored.shopTradeCounts).toEqual(session.shopTradeCounts);
        expect(restored.shopMileagePoints).toBe(39);
        expect(restored.shopPawnTickets).toEqual(session.shopPawnTickets);
        expect(restored.shopLastRestockDayKey).toEqual(session.shopLastRestockDayKey);
        expect(restored.energy).toBe(72);
        expect(restored.shippingQueue).toEqual(session.shippingQueue);
        expect(restored.shippingLastSettledDayKey).toBe("1:spring:11");
        expect(restored.dayTransitionLastDayKey).toBe("1:spring:11");
        expect(restored.shippingHistory).toEqual(session.shippingHistory);
        expect(restored.bundleContributions).toEqual(session.bundleContributions);
        expect(restored.completedBundleIds).toEqual(["bundle_mine"]);
        expect(restored.bundleRewardAppliedIds).toEqual(["bundle_mine"]);
        expect(restored.unlockedRegionIds).toEqual(["region_bridge"]);
        expect(restored.unlockedRecipeIds).toEqual(["recipe_preserves"]);
        expect(restored.makerInstances).toEqual({ "farm:2,3": { ...session.makerInstances["farm:2,3"], status: "ready" } });
      });

      it("loads a legacy snapshot with the optional progression fields omitted", () => {
        // Break caught: adding P0 fields turns old schema-version-3 saves into corrupt slots.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        const snapshot = createSaveSnapshot(project, startSession(project, 18));
        const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
        const legacySession = legacy.session as unknown as Record<string, unknown>;
        for (const key of [
          "lifeSkills",
          "shopLoyaltySpend",
          "shopTradeCounts",
          "shopMileagePoints",
          "shopPawnTickets",
          "shopLastRestockDayKey",
          "energy",
          "shippingQueue",
          "shippingLastSettledDayKey",
          "dayTransitionLastDayKey",
          "shippingHistory",
          "bundleContributions",
          "completedBundleIds",
          "bundleRewardAppliedIds",
          "unlockedRegionIds",
          "unlockedRecipeIds",
          "makerInstances",
        ]) delete legacySession[key];
        const storage = new MemoryStorage();
        saveToSlot(storage, 2, legacy);

        const read = readSaveSlot(storage, 2);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a legacy save slot");
        const restored = applySaveSnapshot(project, read.snapshot);
        expect(restored.lifeSkills).toEqual({});
        expect(restored.shopLoyaltySpend).toBeUndefined();
        expect(restored.shopMileagePoints).toBeUndefined();
        expect(restored.shippingQueue).toEqual({});
        expect(restored.shippingHistory).toEqual([]);
        expect(restored.dayTransitionLastDayKey).toBeUndefined();
        expect(restored.bundleContributions).toEqual({});
        expect(restored.completedBundleIds).toEqual([]);
        expect(restored.bundleRewardAppliedIds).toEqual([]);
        expect(restored.unlockedRegionIds).toEqual([]);
        expect(restored.unlockedRecipeIds).toEqual([]);
        expect(restored.makerInstances).toEqual({});
      });

      it("removes a cursor that does not match the canonical day-key grammar at parse time", () => {
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        const session = startSession(project, 181);
        session.gameTime = { year: 1, season: "spring", day: 2, hour: 6, minute: 0 };
        const snapshot = createSaveSnapshot(project, session);
        const wireSession = snapshot.session as unknown as Record<string, unknown>;
        wireSession.dayTransitionLastDayKey = "1:spring:1:forged";
        const storage = new MemoryStorage();
        saveToSlot(storage, 2, snapshot);

        const read = readSaveSlot(storage, 2);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a parsed save slot");
        expect(read.snapshot.session.dayTransitionLastDayKey).toBeUndefined();
      });

      it("drops a non-safe saved year before it can poison a loaded day transition", () => {
        // Break caught: 1e300 passes finite-integer validation, loads verbatim, then absoluteGameMinutes throws.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        project.system.timeSystem = { enabled: true };
        const snapshot = createSaveSnapshot(project, startSession(project, 182));
        const wireSession = snapshot.session as unknown as Record<string, unknown>;
        wireSession.gameTime = { year: 1e300, season: "spring", day: 1, hour: 6, minute: 0 };
        const storage = new MemoryStorage();
        saveToSlot(storage, 2, snapshot);

        const read = readSaveSlot(storage, 2);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a parsed save slot");
        expect(read.snapshot.session.gameTime).toBeUndefined();
        const restored = applySaveSnapshot(project, read.snapshot);
        expect(restored.gameTime).toEqual({ year: 1, season: "spring", day: 1, hour: 6, minute: 0 });
        expect(() => transitionToNextDay(project, restored, calendarDayKey(restored.gameTime))).not.toThrow();
      });

      it("normalizes a safe-integer year that still exceeds the absolute-minute range", () => {
        // Break caught: Number.MAX_SAFE_INTEGER is field-safe but maker absolute-minute arithmetic is not.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        project.system.timeSystem = { enabled: true };
        const snapshot = createSaveSnapshot(project, startSession(project, 183));
        const poisoned = {
          ...snapshot,
          session: {
            ...snapshot.session,
            gameTime: {
              year: Number.MAX_SAFE_INTEGER,
              season: "spring" as const,
              day: 1,
              hour: 6,
              minute: 0,
            },
          },
        };

        const restored = applySaveSnapshot(project, poisoned);

        expect(restored.gameTime).toEqual({ year: 1, season: "spring", day: 1, hour: 6, minute: 0 });
      });

      it("uses the same P0 snapshot state for autosave and checkpoints", () => {
        // Break caught: a second save writer preserves manual slots but drops new state in auto/checkpoint flows.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        project.system.timeSystem = { enabled: true };
        const session = startSession(project, 19);
        session.lifeSkills = { skill_farming: { xp: 500, level: 4 } };
        session.energy = 48;
        session.gameTime = { year: 1, season: "spring", day: 5, hour: 8, minute: 0 };
        session.shippingQueue = { item_turnip: 3 };
        session.dayTransitionLastDayKey = "1:spring:4";
        session.completedBundleIds = ["bundle_spring"];
        session.unlockedRecipeIds = ["recipe_preserves"];
        session.makerInstances = {
          "farm:4,5": {
            instanceId: "farm:4,5",
            makerId: "maker_preserves",
            status: "processing",
            startedAtMinute: 800,
            readyAtMinute: 1_100,
          },
        };

        const storage = new MemoryStorage();
        expect(performAutosave(project, session, storage, "transfer")).not.toBeNull();
        const autosave = readAutosave(storage);
        expect(autosave.kind).toBe("present");
        if (autosave.kind !== "present") throw new Error("expected a parsed autosave");
        const autoRestored = applySaveSnapshot(project, autosave.snapshot);
        expect(autoRestored).toMatchObject({
          lifeSkills: session.lifeSkills,
          energy: 48,
          shippingQueue: { item_turnip: 3 },
          dayTransitionLastDayKey: "1:spring:4",
          completedBundleIds: ["bundle_spring"],
          unlockedRecipeIds: ["recipe_preserves"],
          makerInstances: { "farm:4,5": { ...session.makerInstances["farm:4,5"], status: "ready" } },
        });

        saveSessionCheckpoint(project, session);
        session.energy = 0;
        session.shippingQueue = {};
        session.dayTransitionLastDayKey = undefined;
        session.completedBundleIds = [];
        session.unlockedRecipeIds = [];
        session.makerInstances = {};
        const checkpointRestored = restoreSessionCheckpoint(project, session);
        expect(checkpointRestored).toMatchObject({
          lifeSkills: { skill_farming: { xp: 500, level: 4 } },
          energy: 48,
          shippingQueue: { item_turnip: 3 },
          dayTransitionLastDayKey: "1:spring:4",
          completedBundleIds: ["bundle_spring"],
          unlockedRecipeIds: ["recipe_preserves"],
          makerInstances: {
            "farm:4,5": expect.objectContaining({ readyAtMinute: 1_100 }),
          },
        });
      });

      it("removes zero shipping rows and drops arithmetically forged settlement history", () => {
        // Break caught: a parsed zero row later blocks settlement, while forged totals are displayed as trusted history.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        const snapshot = createSaveSnapshot(project, startSession(project, 20));
        const wireSession = snapshot.session as unknown as Record<string, unknown>;
        wireSession.shippingQueue = { item_turnip: 2, item_zero: 0 };
        wireSession.shippingHistory = [{
          dayKey: "1:spring:1",
          entries: [{ itemId: "item_turnip", count: 2, unitPrice: 10, subtotal: 999 }],
          total: 999,
          credited: 999,
        }];
        const storage = new MemoryStorage();
        saveToSlot(storage, 3, snapshot);

        const read = readSaveSlot(storage, 3);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a parsed save slot");
        expect(read.snapshot.session.shippingQueue).toEqual({ item_turnip: 2 });
        expect(read.snapshot.session.shippingHistory).toBeUndefined();
        const restored = applySaveSnapshot(project, read.snapshot);
        expect(restored.shippingQueue).toEqual({ item_turnip: 2 });
        expect(restored.shippingHistory).toEqual([]);
      });

      it("quarantines removed P0 assets and retains completed rights without paying them", () => {
        // Deleted content cannot mint items; the recovery owner and completed rights must survive.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        const session = startSession(project, 21);
        session.shippingQueue = { item_turnip: 2 };
        session.shippingLastSettledDayKey = "1:spring:1";
        session.shippingHistory = [{ dayKey: "1:spring:1", entries: [], total: 0, credited: 0 }];
        session.bundleContributions = { bundle_spring: { item_turnip: 1 } };
        session.completedBundleIds = ["bundle_mine"];
        session.bundleRewardAppliedIds = ["bundle_mine"];
        session.unlockedRegionIds = ["region_bridge"];
        session.unlockedRecipeIds = ["recipe_preserves"];
        session.makerInstances = {
          "farm:1,1": {
            instanceId: "farm:1,1",
            makerId: "maker_preserves",
            status: "processing",
            startedAtMinute: 100,
            readyAtMinute: 1_540,
          },
        };
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const read = readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind !== "present") throw new Error("expected a parsed save slot");

        delete project.system.shipping;
        delete project.system.bundles;
        delete project.system.worldUnlocks;
        delete project.system.craftRecipes;
        delete project.system.makers;
        const restored = applySaveSnapshot(project, read.snapshot);
        expect(restored.shippingQueue).toEqual({});
        expect(restored.shippingLastSettledDayKey).toBeUndefined();
        expect(restored.shippingHistory).toEqual([]);
        expect(restored.bundleContributions).toEqual({});
        expect(restored.completedBundleIds).toEqual(["bundle_mine"]);
        expect(restored.bundleRewardAppliedIds).toEqual(["bundle_mine"]);
        expect(restored.unlockedRegionIds).toEqual(["region_bridge"]);
        expect(restored.unlockedRecipeIds).toEqual(["recipe_preserves"]);
        expect(restored.makerInstances).toEqual({});
        expect(Object.values(restored.lifeRecovery?.claims ?? {})).toMatchObject([
          { sourceKind: "shippingQueue", items: [{ itemId: "item_turnip", count: 2 }] },
          { sourceKind: "bundleContributions", items: [{ itemId: "item_turnip", count: 1 }] },
          { sourceKind: "makerInstances", items: [], unresolved: { record: session.makerInstances["farm:1,1"] } },
        ]);
        expect(restored.inventory).toEqual(session.inventory);
      });

      it("normalizes hostile skill, maker, and bundle receipt state against the current project", () => {
        // Break caught: direct snapshot apply trusts stale skill ids, inconsistent
        // levels, unsafe maker deadlines, and one-sided completion receipts.
        const project = createBlankProject();
        configureP0PersistenceProject(project);
        const snapshot = createSaveSnapshot(project, startSession(project, 22));
        const hostile = snapshot.session as unknown as Record<string, unknown>;
        hostile.lifeSkills = {
          skill_farming: { xp: 275, level: 99 },
          skill_mining: { xp: 1e300, level: 2 },
          skill_deleted: { xp: 100, level: 2 },
        };
        hostile.bundleContributions = { bundle_spring: { item_turnip: 2 } };
        hostile.completedBundleIds = ["bundle_spring"];
        hostile.bundleRewardAppliedIds = [];
        hostile.makerInstances = {
          "farm:unsafe": {
            instanceId: "farm:unsafe",
            makerId: "maker_preserves",
            status: "processing",
            startedAtMinute: 100,
            readyAtMinute: 1e300,
          },
        };

        const restored = applySaveSnapshot(project, snapshot);

        expect(restored.lifeSkills).toEqual({ skill_farming: { xp: 275, level: 3 } });
        expect(restored.makerInstances).toEqual({});
        expect(restored.completedBundleIds).toEqual(["bundle_spring"]);
        expect(restored.bundleRewardAppliedIds).toEqual(["bundle_spring"]);
      });
    });
  });
  describe("p0Shipping", () => {
    isolateTimers();
    function projectWithShipping(historyLimit = 2) {
      const project = createBlankProject();
      for (const [id, price] of [["item_turnip", 20], ["item_milk", 40]] as const) {
        const record = normalizeItemRecord({ id, name: id, scope: "none", price });
        const index = project.database.items.findIndex((item) => item.id === id);
        if (index >= 0) project.database.items[index] = record;
        else project.database.items.push(record);
      }
      project.system.shipping = { enabled: true, historyLimit };
      project.system.sellPrices = [
        { itemId: "item_turnip", price: 10 },
        { itemId: "item_milk", price: 25 },
      ];
      return project;
    }
    describe("P0 shipping rules", () => {
      it("deposits and withdraws inventory atomically", () => {
        // Break caught: queue changes without the inverse inventory movement.
        const project = projectWithShipping();
        const session = startSession(project, 1);
        session.inventory = { item_turnip: 5 };

        expect(depositShipping(project, session, "item_turnip", 3)).toEqual({
          ok: true,
          itemId: "item_turnip",
          queued: 3,
        });
        expect(session.inventory.item_turnip).toBe(2);
        expect(session.shippingQueue?.item_turnip).toBe(3);

        expect(withdrawShipping(project, session, "item_turnip", 2)).toEqual({
          ok: true,
          itemId: "item_turnip",
          queued: 1,
        });
        expect(session.inventory.item_turnip).toBe(4);
        expect(session.shippingQueue?.item_turnip).toBe(1);
      });

      it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
        "rejects malformed deposit count %s without mutation",
        (count) => {
          // Break caught: invalid counts remove or mint inventory entries.
          const project = projectWithShipping();
          const session = startSession(project, 2);
          session.inventory = { item_turnip: 5 };
          expect(depositShipping(project, session, "item_turnip", count)).toMatchObject({ ok: false, reason: "invalid-count" });
          expect(session.inventory).toEqual({ item_turnip: 5 });
          expect(session.shippingQueue).toEqual({});
        },
      );

      it("rejects unknown, disallowed, insufficient, and over-withdraw operations without partial mutation", () => {
        // Break caught: an error branch mutates one side of the inventory/queue transaction.
        const project = projectWithShipping();
        project.system.shipping = { enabled: true, allowedItemIds: ["item_turnip"] };
        const session = startSession(project, 3);
        session.inventory = { item_turnip: 1, item_milk: 2 };

        expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
        project.system.sellPrices!.push({ itemId: "item_missing", price: 99 });
        session.inventory.item_missing = 1;
        expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
        delete session.inventory.item_missing;
        expect(depositShipping(project, session, "item_milk", 1)).toMatchObject({ ok: false, reason: "item-not-allowed" });
        expect(depositShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
        expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });
        expect(session.shippingQueue).toEqual({});

        session.shippingQueue = { item_turnip: 1 };
        expect(withdrawShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-queue" });
        expect(session.shippingQueue).toEqual({ item_turnip: 1 });
        expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });

        session.shippingQueue = { item_missing: 1 };
        const staleQueue = structuredClone(session);
        expect(withdrawShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
        expect(session).toEqual(staleQueue);
      });

      it("settles one day exactly once, caps gold, and bounds immutable history", () => {
        // Break caught: replaying a day-end credits gold twice or grows history without bound.
        const project = projectWithShipping(2);
        const session = startSession(project, 4);
        session.gold = GOLD_MAX - 6;
        session.shippingQueue = { item_turnip: 2 };

        const first = settleShipping(project, session, "1:spring:1");
        expect(first).toMatchObject({ ok: true, total: 20, credited: 6 });
        expect(session.gold).toBe(GOLD_MAX);
        expect(session.shippingQueue).toEqual({});
        expect(session.shippingLastSettledDayKey).toBe("1:spring:1");
        expect(session.shippingHistory?.[0]).toMatchObject({ dayKey: "1:spring:1", total: 20, credited: 6 });

        const frozen = structuredClone(session);
        expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: false, reason: "already-settled" });
        expect(session).toEqual(frozen);

        session.shippingQueue = { item_milk: 1 };
        expect(settleShipping(project, session, "1:spring:2").ok).toBe(true);
        session.shippingQueue = {};
        expect(settleShipping(project, session, "1:spring:3").ok).toBe(true);
        const afterEmptySettlement = structuredClone(session);
        expect(settleShipping(project, session, "1:spring:3")).toMatchObject({ ok: false, reason: "already-settled" });
        expect(session).toEqual(afterEmptySettlement);
        expect(session.shippingHistory?.map((entry) => entry.dayKey)).toEqual(["1:spring:2", "1:spring:3"]);
      });

      it("does not settle a malformed queue or blank day key", () => {
        // Break caught: settlement clears valid rows before discovering an invalid row.
        const project = projectWithShipping();
        const session = startSession(project, 5);
        session.shippingQueue = { item_turnip: 1, item_missing: 1 };
        const before = structuredClone(session);
        expect(settleShipping(project, session, "1:spring:4")).toMatchObject({ ok: false, reason: "unknown-item" });
        expect(session).toEqual(before);
        expect(settleShipping(project, session, "   ")).toMatchObject({ ok: false, reason: "invalid-day-key" });
        expect(session).toEqual(before);
      });
    });
  });
  describe("p0ToolCapability", () => {
    isolateTimers();
    describe("P0 upgraded tool capabilities", () => {
      it("resolves the upgraded item area and energy multiplier after replacement", () => {
        // Break caught: upgrade swaps item ids but runtime queries still see base 1x1/1.0 behavior.
        const project = createBlankProject();
        for (const id of ["item_hoe", "item_hoe_iron"]) {
          const record = normalizeItemRecord({ id, name: id, scope: "none", price: 50, farmTool: "hoe" });
          const index = project.database.items.findIndex((item) => item.id === id);
          if (index >= 0) project.database.items[index] = record;
          else project.database.items.push(record);
        }
        project.system.itemUpgrades = [{
          id: "upgrade_hoe_iron",
          fromItemId: "item_hoe",
          toItemId: "item_hoe_iron",
          capability: { areaWidth: 3, areaHeight: 3, energyMultiplier: 0.75 },
        }];
        const session = startSession(project, 1);
        session.inventory = { item_hoe: 1 };
        session.equippedToolItemId = "item_hoe";

        expect(resolveToolCapability(project, "item_hoe")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
        expect(applyItemUpgrade(project, session, "upgrade_hoe_iron").ok).toBe(true);
        expect(session.equippedToolItemId).toBe("item_hoe_iron");
        expect(resolveToolCapability(project, session.equippedToolItemId)).toEqual({
          areaWidth: 3,
          areaHeight: 3,
          energyMultiplier: 0.75,
        });
      });

      it("keeps legacy upgrade rows at safe default behavior and ignores malformed capability values", () => {
        // Break caught: omitted/invalid additive fields change legacy tools or emit NaN costs.
        const project = createBlankProject();
        project.system.itemUpgrades = [{ id: "legacy", fromItemId: "a", toItemId: "b" }];
        expect(resolveToolCapability(project, "b")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
        project.system.itemUpgrades = [{
          id: "bad",
          fromItemId: "a",
          toItemId: "c",
          capability: { areaWidth: 0, areaHeight: Number.NaN, energyMultiplier: -1 },
        }];
        expect(resolveToolCapability(project, "c")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });

        project.system.itemUpgrades = [{
          id: "oversized",
          fromItemId: "a",
          toItemId: "d",
          capability: { areaWidth: 10, areaHeight: 9, energyMultiplier: 1 },
        }];
        expect(resolveToolCapability(project, "d")).toEqual({ areaWidth: 1, areaHeight: 1, energyMultiplier: 1 });
      });
    });
  });
  // B6's six July gauge calibrations predate Pokemon stats and the actor-party enemy rebalance.
  // Preserve the seven tracked coverage slots and the existing type-effectiveness check,
  // using explicit Gen1 fixtures and independent known answers rather than retuning shipped data.
  describe("pkmnBalanceB6", () => {
    isolateTimers();
    const STARTERS = ["species_aqualing", "species_leafling", "species_sparkit"] as const;
    function mon(project: Project, speciesId: string, level: number, id = "mon_1"): MonsterInstance {
      return {
        instanceId: id, speciesId, level, exp: 0,
        ivs: { hp: 0, atk: 0, def: 0, spd: 0 }, friendship: 70,
        caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
      };
    }
    function gen1Fixture() {
      const project = createBlankProject();
      project.system = {
        ...project.system, battleModel: "gen1", battleFlow: "strict", battleUiStyle: "pokemon",
        battleParty: "monsters", monsterCollection: true, activeSlots: undefined,
        typeChart: { types: ["normal", "water"], multipliers: { normal: { water: 1 } } },
      };
      const species = normalizeMonsterSpeciesRecord({
        id: "species_b6", name: "B6 specimen", types: ["water"],
        baseStats: { maxHp: 100, maxMp: 0, attack: 95, defense: 95, mind: 95, agility: 40 },
        skillsByLevel: [{ level: 1, skillId: "skill_b6" }],
      });
      const skill = normalizeSkillRecord({
        id: "skill_b6", name: "B6 strike", type: "normal", scope: "enemy",
        mpCost: { flat: 0, percentMax: 0 }, power: 40, hitRate: 100, successRate: 100, variance: 0,
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
        elementId: "normal", maxPp: 5, movePriority: 1,
      });
      const enemy = normalizeEnemyRecord({
        id: "enemy_b6", name: "B6 opponent", speciesId: species.id, level: 50,
        stats: { maxHp: 100, maxMp: 0, attack: 1, defense: 100, mind: 100, agility: 1 },
        actions: [{ skillId: "skill_b6_enemy", priority: 5, condition: { kind: "always" } }],
        stateRates: {}, elementRates: {},
      });
      project.database.monsterSpecies = [species];
      project.database.skills = [skill, { ...skill, id: "skill_b6_enemy", name: "B6 reply", movePriority: 0 }];
      project.database.enemies = [enemy];
      project.database.troops = [normalizeTroopRecord({ id: "troop_b6", name: "B6 duel", enemyIds: [enemy.id] })];
      project.database.states = [];
      project.database.elements = [{
        id: "normal", name: "Normal", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"],
        damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
      }];
      return { project, species, skill, enemy };
    }
    function duel(project: Project, party: readonly MonsterInstance[]) {
      // Each move gets noncritical byte 255, maximum damage byte 255, and hit byte 0.
      // One target/action and unequal priority/Speed avoid unrelated RNG draws.
      let byteIndex = 0;
      return createBattleRuntime({
        project, troopId: "troop_b6", partyMonsters: party, canEscape: false, canLose: true,
        rng: () => (byteIndex++ % 3 === 2 ? 0 : 255 / 256),
      });
    }
    const strike = { kind: "skill", skillId: "skill_b6", targetEnemyId: "enemy-1" } as const;
    describe("batch 6 · explicit Gen1 combat contracts", () => {
      it("uses Pokemon stat known answers at L5 and L50 with explicit IVs", () => {
        const { project, species } = gen1Fixture();
        const starter = mon(project, species.id, 5);
        const trained = { ...starter, level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } };

        // HP=floor((200+IV)*L/100)+L+10; other stats=floor((190+IV)*L/100)+5.
        expect(monsterBattleStats(project, starter)).toEqual({ maxHp: 25, maxMp: 0, attack: 14, defense: 14, mind: 14, agility: 9 });
        expect(monsterBattleStats(project, trained)).toEqual({ maxHp: 167, maxMp: 0, attack: 107, defense: 107, mind: 100, agility: 52 });
      });

      it("deals the cartridge L50 P40 A100 D100 known answer and spends one PP", () => {
        const { project, species } = gen1Fixture();
        const runtime = duel(project, [mon(project, species.id, 50)]);
        const before = runtime.snapshot();
        expect(before.actors[0]?.skillPp?.skill_b6).toBe(5);

        runtime.performActorCommand(strike);

        // floor(floor((floor(2*50/5)+2)*40*100/100)/50)+2 = 19; no STAB.
        const after = runtime.snapshot();
        expect(after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
          .toMatchObject({ hit: true, critical: false, amount: 19 });
        expect(after.enemies[0]?.hp).toBe(81);
        expect(after.actors[0]?.skillPp?.skill_b6).toBe(4);
      });

      it("orders a slow priority move before a fast opponent and Speed breaks equal priority", () => {
        for (const priority of [1, 0]) {
          const { project, species, skill, enemy } = gen1Fixture();
          skill.movePriority = priority;
          enemy.stats.agility = 100;
          const runtime = duel(project, [mon(project, species.id, 50)]);

          runtime.performActorCommand(strike);

          const sides = runtime.snapshot().roundLogs.flatMap((round) => round.actions.map((action) => action.side));
          expect(sides).toEqual(priority === 1 ? ["actor", "enemy"] : ["enemy", "actor"]);
        }
      });

      it("matches both combatants at L26 and uses that level in the damage formula", () => {
        const { project, species, enemy } = gen1Fixture();
        enemy.level = 26;
        enemy.stats = { maxHp: 88, maxMp: 0, attack: 54, defense: 54, mind: 54, agility: 25 };
        const runtime = duel(project, [mon(project, species.id, 26)]);
        const before = runtime.snapshot();
        expect(before.actors[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });
        expect(before.enemies[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });

        runtime.performActorCommand(strike);

        // L26's level term is 12: floor(12*40/50)+2 = 11, not the L50 answer 19.
        expect(runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
          .toMatchObject({ hit: true, critical: false, amount: 11 });
      });

      it("counts two usable-move decisions and two resolved attacks in a seeded Gen1 simulation", () => {
        const { project, species, enemy } = gen1Fixture();
        species.baseStats.agility = 1; // Critical threshold floor(base Speed / 2) = 0.
        enemy.stats.maxHp = 20; // Two neutral hits of 16..19, never a one-hit victory.
        const actor = { ...mon(project, species.id, 50), skillPp: { skill_b6: 2 } };

        const result = simulateBattle({ project, troopId: "troop_b6", heroLevel: 1, monsterParty: [actor], n: 1, seed: 42, maxSteps: 4 });

        expect(result.battleFlow).toBe("strict");
        expect(result.samples).toBe(1);
        expect(result.winRate).toBe(1);
        expect(result.avgTurns).toBe(2);
        const actions = result.roundLogs.flatMap((round) => round.actions).filter((action) => action.side === "actor");
        expect(actions.map((action) => ({ kind: action.commandKind, hit: action.hit })))
          .toEqual([{ kind: "skill", hit: true }, { kind: "skill", hit: true }]);
        expect(result.participatingActorIds).toEqual(["mon_1"]);
        expect(actor.skillPp).toEqual({ skill_b6: 2 }); // Simulation consumes battle state, not its input.
      });

      it("defaults a Gen1 trio to one active monster and admits reserves only by switching", () => {
        const { project, species } = gen1Fixture();
        const party = ["mon_1", "mon_2", "mon_3"].map((id) => mon(project, species.id, 50, id));
        const runtime = duel(project, party);
        expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_1"]);
        expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_2", "mon_3"]);
        expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1"]);

        runtime.performActorCommand({ kind: "switch", targetActorId: "mon_2" });

        expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_2"]);
        expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_1", "mon_3"]);
        expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1", "mon_2"]);
        expect(runtime.snapshot().reserveActors.find((actor) => actor.recordId === "mon_3")?.hp).toBe(160);
      });
    });
    describe("batch 6 · type weakness is clearly felt (>=3x vs resist)", () => {
      function skillDamageVs(targetSpecies: string, level: number): number {
        const project = createBlankProject();
        const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
        if (!enemy) throw new Error("missing enemy_slime");
        enemy.speciesId = targetSpecies;
        // 적은 과녁일 뿐이다: 먼저 움직이거나(민첩) 정신력 기술(독침)로 몬스터를 쓰러뜨리지 않게 한다.
        enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1, mind: 1, agility: 1 };
        const result = simulateBattle({
          project,
          troopId: "troop_slime",
          heroLevel: 1,
          battleFlow: "strict",
          n: 1,
          seed: 3,
          monsterParty: [mon(project, "species_aqualing", level, "mon_w")],
          strictScript: [[{ actorId: "mon_w", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
          maxSteps: 6,
        });
        return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
      }

      it("water skill on fire target deals >=3x the damage of water target, at L5 and L35", () => {
        for (const level of [5, 35]) {
          const weak = skillDamageVs("species_cave_bat", level); // fire → 2× (+STAB)
          const resist = skillDamageVs("species_aqualing", level); // water → 0.5× (+STAB)
          expect(weak).toBeGreaterThan(0);
          expect(resist).toBeGreaterThan(0);
          expect(weak / resist).toBeGreaterThanOrEqual(3);
        }
      });
    });
    describe("batch 6 · progression ladder sanity", () => {
      it("L1 stats use the Pokemon formula through the instance API", () => {
        const project = createBlankProject();
        for (const speciesId of STARTERS) {
          const species = monsterSpeciesById(project, speciesId);
          if (!species) throw new Error(`missing ${speciesId}`);
          const stats = monsterBattleStats(project, mon(project, speciesId, 1));
          expect(stats.maxHp).toBe(Math.floor(2 * species.baseStats.maxHp / 100) + 11);
          expect(stats.attack).toBe(Math.floor(2 * species.baseStats.attack / 100) + 5);
          expect(stats.defense).toBe(Math.floor(2 * species.baseStats.defense / 100) + 5);
          expect(stats.mind).toBe(Math.floor(2 * species.baseStats.mind / 100) + 5);
          expect(stats.agility).toBe(Math.floor(2 * species.baseStats.agility / 100) + 5);
        }
      });
    });
  });
});
