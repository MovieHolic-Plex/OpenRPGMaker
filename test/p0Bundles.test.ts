import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords, normalizeItemRecord, normalizeSkillRecord, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { activeDifficultyId, difficultyRate, normalizeDifficulties } from "@/project/difficulty";
import { evalCondition, startSession, GOLD_MAX } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, GameMap, Project, MonsterSpeciesRecord, SkillRecord } from "@/project/types";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { applyCareItem, applyWalkCareTicks, resolveMonsterCare } from "@/project/monsterCare";
import { evolveMonster, giveMonster, moveMonster, applyMonsterExperienceAndEvolution, previewMonsterExperience, splitLearnedMonsterSkills, monsterBattleStats, monsterBattleStatsForSpecies, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { useItemFromMenu } from "@/player/playerItemUse";
import { totalExpForLevel } from "@/project/actorModel";
import { MONSTER_NATURES, addMonsterEvs, clampMonsterEvs, monsterEvYieldOf, monsterNatureEffectText, natureIdFromSeed } from "@/project/monsterStatRules";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import { contributeBundle } from "@/project/bundles";
import { isolateTimers } from "./mergedTeardown";

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
