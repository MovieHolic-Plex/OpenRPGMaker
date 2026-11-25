import { describe, expect, it } from "vitest";
import { interactWithFarmPlot } from "@/player/farming";
import { normalizeItemRecord, normalizeStateRecord, normalizeSystemRecords, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { attemptFishingCatch, resolveFishingAvailability } from "@/project/fishing";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { awardLifeSkillXp, changeLifeSkillXp } from "@/project/lifeSkillProgress";
import { placeableKey } from "@/project/placeables";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { startSession } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { createBattleRuntime, damageToMpRateForStates, escapeChance } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import type { Project, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { battleFormationChances, contactFormation, formationStartRow, rollBattleFormation } from "@/battle/battleFormation";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { battleSkillMpCost, battleSkillUseFailure } from "@/battle/battleSkillUse";
import { applyItemUpgrade } from "@/project/upgrades";
import { isolateTimers } from "./mergedTeardown";

describe("lifeSkillDisabledHarvest", () => {
  isolateTimers();
  const harvests = ["crop", "rock", "tree", "fish", "forage"] as const;
  type Harvest = typeof harvests[number];
  type Mode = "enabled" | "disabled" | "omitted";
  function harvestFixture(kind: Harvest, mode: Mode) {
    const project = p2LifeProject();
    project.database.items.push(
      normalizeItemRecord({ id: "pick", name: "Pick", farmTool: "pickaxe", scope: "none" }),
      normalizeItemRecord({ id: "axe", name: "Axe", farmTool: "axe", scope: "none" }),
      normalizeItemRecord({ id: "seed", name: "Seed", type: "seed", scope: "none" }),
    );
    const skillType = { crop: "farming", rock: "mining", tree: "foraging", fish: "fishing", forage: "foraging" } as const;
    const skill = { id: "harvest-skill", name: "Harvest", skillType: skillType[kind], maxLevel: 10, levelUpRewards: [] };
    project.database.lifeSkills = [skill];
    project.database.crops = [{ id: "crop", name: "Crop", seedItemId: "seed", harvestItemId: "item_berry", harvestCount: 1, stages: [{ days: 1 }], seasons: ["spring"] }];
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    map.farmableArea = [{ x: 0, y: 0, w: 4, h: 4 }];
    if (mode === "omitted") delete project.system.skillSystem;
    else project.system.skillSystem = { enabled: mode === "enabled" };
    const session = startSession(project, 606);
    // Retained progress must not be erased or advanced by disabled automatic XP.
    session.lifeSkills = { [skill.id]: { xp: 99, level: 1 } };
    session.inventory.pick = 1;
    session.inventory.axe = 1;
    let x = 1;
    let y = 1;
    if (kind === "crop") {
      session.farmPlots = { [map.id]: { "1,1": { tilled: true, watered: false, cropId: "crop", growthDays: 1, stage: 1 } } };
    } else if (kind === "rock" || kind === "tree") {
      session.equippedToolItemId = kind === "rock" ? "pick" : "axe";
      session.placeables = { [placeableKey(map.id, x, y)]: { id: kind, kind, mapId: map.id, x, y, itemId: "item_berry" } };
    } else if (kind === "forage") {
      const date = session.gameTime;
      if (!date) throw new Error("Missing fixture date");
      expect(advanceSeasonalForage(project, session, date)).toMatchObject({ ok: true, spawned: 2 });
      const target = Object.values(session.placeables ?? {}).find((entry) => entry.forageSpawn);
      if (!target) throw new Error("Missing generated forage owner");
      x = target.x;
      y = target.y;
    }
    const itemId = kind === "fish" ? "item_trout" : "item_berry";
    const xp = kind === "fish" ? 12 : kind === "forage" ? 1 : 10;
    const energy = kind === "fish" ? 3 : kind === "forage" ? 0 : 1;
    const key = placeableKey(map.id, x, y);
    const owner = kind === "crop" ? session.farmPlots?.[map.id]?.["1,1"]
      : kind === "fish" ? project.system.fishing?.spots[0] : session.placeables?.[key];
    expect(owner).toBeDefined();
    const perform = () => {
      if (kind === "fish") return attemptFishingCatch(project, session, { mapId: map.id, x, y });
      if (kind === "forage") return collectForageAt(project, session, map.id, x, y);
      return interactWithFarmPlot(project, session, map, x, y);
    };
    const success = kind === "fish" || kind === "forage" ? { ok: true, itemId } : { kind: "harvested", source: kind, itemId, count: 1 };
    const failure = (reason: "xp" | "energy" | "inventory") => kind === "fish" || kind === "forage"
      ? { ok: false, reason }
      : { kind: "ignored", reason: { xp: "invalid-life-skill", energy: "insufficient-energy", inventory: "inventory-full" }[reason] };
    return { project, session, skill, itemId, xp, energy, key, map, perform, success, failure };
  }
  describe.each(harvests)("%s automatic harvest XP", (kind) => {
    it.each(["disabled", "omitted", "enabled"] as const)("keeps the real reward when skillSystem is %s", (mode) => {
      const f = harvestFixture(kind, mode);
      const before = structuredClone(f.session);
      const result = f.perform();
      expect(result).toMatchObject(f.success);
      expect(f.session.inventory[f.itemId]).toBe((before.inventory[f.itemId] ?? 0) + 1);
      expect(f.session.energy).toBe(Number(before.energy) - f.energy);
      expect(f.session.collections?.[f.itemId]?.discovered).toBe(true);
      expect(f.session.switches).toEqual(before.switches);
      expect(f.session.unlockedRecipeIds).toEqual(before.unlockedRecipeIds);
      if (mode === "enabled") expect(f.session.lifeSkills?.[f.skill.id]).toEqual({ xp: 99 + f.xp, level: 2 });
      else expect(f.session.lifeSkills).toEqual(before.lifeSkills);
      if (kind === "fish") {
        expect(f.session.collections?.[f.itemId]?.caughtCount).toBe(1);
        expect(f.session.rng).not.toEqual(before.rng);
      } else {
        expect(f.session.rng).toEqual(before.rng);
        if (kind === "crop") expect(f.session.farmPlots?.[f.map.id]?.["1,1"]?.cropId).toBeUndefined();
        else expect(f.session.placeables?.[f.key]).toBeUndefined();
        if (kind !== "forage") expect(result).toMatchObject({ xpAwarded: mode === "enabled" ? { [f.skill.skillType]: 10 } : {} });
      }
    });

    it.each(["switch", "recipe"] as const)("rolls back the entire active transaction for an invalid %s reward", (reward) => {
      const f = harvestFixture(kind, "enabled");
      f.project.database.lifeSkills = [{ ...f.skill, levelUpRewards: [reward === "switch"
        ? { level: 2, switchId: "missing-switch" } : { level: 2, recipeId: "missing-recipe" }] }];
      const before = structuredClone(f.session);
      expect(f.perform()).toMatchObject(f.failure("xp"));
      expect(f.session).toEqual(before);
      expect(f.session.rng).toEqual(before.rng);
    });

    it.each(["enabled", "disabled"] as const)("preserves complete state at inventory capacity with XP %s", (mode) => {
      const f = harvestFixture(kind, mode);
      f.session.inventory[f.itemId] = ITEM_QUANTITY_MAX;
      const before = structuredClone(f.session);
      expect(f.perform()).toMatchObject(f.failure("inventory"));
      expect(f.session).toEqual(before);
      expect(f.session.rng).toEqual(before.rng);
    });
  });
  describe.each(["crop", "rock", "tree", "fish"] as const)("%s energy refusal", (kind) => {
    it.each(["enabled", "disabled"] as const)("preserves all state with XP %s", (mode) => {
      const f = harvestFixture(kind, mode);
      f.session.energy = 0;
      const before = structuredClone(f.session);
      expect(f.perform()).toMatchObject(f.failure("energy"));
      expect(f.session).toEqual(before);
      expect(f.session.rng).toEqual(before.rng);
    });
  });
  describe("explicit XP and fishing qualification stay independent", () => {
    it.each(["disabled", "omitted"] as const)("keeps explicit APIs disabled when skillSystem is %s", (mode) => {
      const f = harvestFixture("fish", mode);
      const before = structuredClone(f.session);
      expect(awardLifeSkillXp(f.project, f.session, f.skill.id, 12)).toEqual({ ok: false, reason: "disabled", skillId: f.skill.id });
      for (const op of ["=", "+=", "-="] as const) {
        expect(changeLifeSkillXp(f.project, f.session, f.skill.id, op, 12)).toEqual({ ok: false, reason: "disabled", skillId: f.skill.id });
      }
      expect(awardLifeSkillXp(f.project, f.session, f.skill.id, 0)).toEqual({ ok: false, reason: "invalid-amount", skillId: f.skill.id });
      expect(f.session).toEqual(before);
    });

    it.each(["disabled", "omitted"] as const)("still rejects insufficient fishing skill with XP %s", (mode) => {
      const f = harvestFixture("fish", mode);
      const fishing = f.project.system.fishing;
      if (!fishing) throw new Error("Missing fishing configuration owner");
      f.project.system.fishing = { ...fishing, spots: fishing.spots.map(spot => ({
        ...spot, catches: spot.catches.map(rule => ({ ...rule, minSkillLevel: 2 })),
      })) };
      const before = structuredClone(f.session);
      expect(resolveFishingAvailability(f.project, f.session, { mapId: f.map.id, x: 1, y: 1 })).toEqual({ ok: false, reason: "unavailable" });
      expect(f.perform()).toEqual({ ok: false, reason: "unavailable" });
      expect(f.session).toEqual(before);
    });

    it.each(["disabled", "omitted"] as const)("allows earned fishing qualification without adding XP when %s", (mode) => {
      const f = harvestFixture("fish", mode);
      const fishing = f.project.system.fishing;
      if (!fishing) throw new Error("Missing fishing configuration owner");
      f.project.system.fishing = { ...fishing, spots: fishing.spots.map(spot => ({
        ...spot, catches: spot.catches.map(rule => ({ ...rule, minSkillLevel: 2 })),
      })) };
      f.session.lifeSkills = { [f.skill.id]: { xp: 100, level: 2 } };
      const before = structuredClone(f.session.lifeSkills);
      expect(f.perform()).toMatchObject(f.success);
      expect(f.session.lifeSkills).toEqual(before);
      expect(f.session.inventory.item_trout).toBe(1);
    });
  });
});

describe("mgL2BflowDamageToMp", () => {
  isolateTimers();
  function battleProject(rate?: number): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 9999, maxMp: 999, defense: 0 };
    if (rate !== undefined) {
      project.database.states.push(normalizeStateRecord({ id: "state_mana_shield", name: "마나 실드", runtimeEffects: { damageToMpRate: rate, removeOnBattleEnd: true } }));
    }
    return project;
  }
  /** 아군 통상 공격 한 번으로 적 HP/MP 가 얼마나 줄었는지. rng 0.5 = 분산 1.0·크리티컬 없음. */
  function hitSlime(project: Project): { hpLoss: number; mpLoss: number; reported: number } {
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    const enemy = runtime.snapshot().enemies[0]!;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot().enemies[0]!;
    const entry = runtime.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "actor")!;
    return { hpLoss: enemy.hp - after.hp, mpLoss: enemy.mp - after.mp, reported: entry.amount ?? 0 };
  }
  describe("mg-l2-bflow #33 피해 MP 전환 상태", () => {
    it("비율을 합산해 1 로 자른다", () => {
      const project = battleProject(0.6);
      project.database.states.push(normalizeStateRecord({ id: "state_extra", name: "추가", runtimeEffects: { damageToMpRate: 0.7 } }));
      expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield"] })).toBe(0.6);
      expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield", "state_extra"] })).toBe(1);
      expect(damageToMpRateForStates(project, { stateIds: [] })).toBe(0);
    });

    it("damageToMpRate 0.5 상태의 배우는 적 통상 공격 피해의 절반을 MP 로 받는다", () => {
      const project = battleProject(0.5);
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, attack: 200, agility: 999 };
      const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { stateIds: { actor_hero: ["state_mana_shield"] } } });
      const plainBefore = plain.snapshot().actors[0]!;
      const shieldBefore = shielded.snapshot().actors[0]!;
      plain.performActorCommand({ kind: "defend" });
      shielded.performActorCommand({ kind: "defend" });
      const plainAfter = plain.snapshot().actors[0]!;
      const shieldAfter = shielded.snapshot().actors[0]!;
      const total = plainBefore.hp - plainAfter.hp;
      expect(total).toBeGreaterThan(1);
      const hpLoss = shieldBefore.hp - shieldAfter.hp;
      const mpLoss = shieldBefore.mp - shieldAfter.mp;
      const expectedMp = Math.min(shieldBefore.mp, Math.floor(total * 0.5));
      expect(mpLoss).toBe(expectedMp);
      expect(hpLoss).toBe(total - expectedMp);
      // 타임라인 피해량은 실제 HP 감소와 같다.
      const entry = shielded.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "enemy")!;
      expect(entry.amount).toBe(hpLoss);
    });

    it("MP 가 모자라면 남은 MP 만큼만 돌리고 나머지는 HP 로 받는다", () => {
      const project = battleProject(1);
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, attack: 200, agility: 999 };
      const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 0 } } } });
      const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 3 } }, stateIds: { actor_hero: ["state_mana_shield"] } } });
      const plainHp = plain.snapshot().actors[0]!.hp;
      const shieldHp = shielded.snapshot().actors[0]!.hp;
      expect(shieldHp).toBe(plainHp);
      expect(shielded.snapshot().actors[0]!.mp).toBe(3);
      plain.performActorCommand({ kind: "defend" });
      shielded.performActorCommand({ kind: "defend" });
      const total = plainHp - plain.snapshot().actors[0]!.hp;
      expect(shielded.snapshot().actors[0]!.mp).toBe(0);
      expect(shieldHp - shielded.snapshot().actors[0]!.hp).toBe(total - 3);
    });

    it("상태가 없으면 피해는 예전처럼 전부 HP 로 간다", () => {
      const project = battleProject();
      const result = hitSlime(project);
      expect(result.mpLoss).toBe(0);
      expect(result.hpLoss).toBe(result.reported);
    });

    it("damageToMpRate 는 저장·불러오기를 지난다", () => {
      const reloaded = deserialize(serialize(battleProject(0.25)));
      expect(reloaded.database.states.find((state) => state.id === "state_mana_shield")?.runtimeEffects?.damageToMpRate).toBe(0.25);
    });
  });
});

describe("mgL2BflowEscape", () => {
  isolateTimers();
  function battleProject(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    // 민첩이 같으면 기본 도주 확률은 정확히 50%.
    slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
    return project;
  }
  function heroAgility(project: Project): number {
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.99 });
    return runtime.snapshot().actors[0]!.effectiveStats!.agility;
  }
  describe("mg-l2-bflow #34 도주 실패 가산", () => {
    it("필드가 없으면 예전 식 그대로, 가산을 켜면 실패마다 붙고 100% 에서 멈춘다", () => {
      expect(escapeChance(10, 10, 0, undefined)).toBe(0.5);
      expect(escapeChance(10, 10, 3, undefined)).toBe(0.5);
      expect(escapeChance(10, 10, 1, 10)).toBeCloseTo(0.6);
      expect(escapeChance(10, 10, 3, 20)).toBe(1);
      expect(escapeChance(10, 10, 4, 0)).toBe(0.5);
    });

    it("같은 rng 값이 첫 시도는 실패, 한 번 실패한 뒤에는 성공한다(strict)", () => {
      const project = battleProject();
      project.system.escapeBonusPercent = 10;
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, agility: heroAgility(project) };
      // 0.55: 기본 50% 에서는 실패, +10%p(60%) 에서는 성공.
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(runtime.snapshot().failedEscapeAttempts).toBe(1);
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBe("escape");
    });

    it("escapeBonusPercent 가 없는 옛 프로젝트는 가산이 없어 같은 값으로 계속 실패한다", () => {
      const project = battleProject();
      expect(project.system.escapeBonusPercent).toBeUndefined();
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, agility: heroAgility(project) };
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
      runtime.performActorCommand({ kind: "escape" });
      runtime.performActorCommand({ kind: "escape" });
      runtime.performActorCommand({ kind: "escape" });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(runtime.snapshot().failedEscapeAttempts).toBe(3);
    });

    it("시스템 정규화는 기본값 0 을 저장하지 않고 다른 값은 0~100 으로 자른다", () => {
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 0 }).escapeBonusPercent).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 10 }).escapeBonusPercent).toBe(10);
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 25 }).escapeBonusPercent).toBe(25);
      expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 250 }).escapeBonusPercent).toBe(100);
      expect(normalizeSystemRecords({ startActorIds: [], battleFormationRoll: true }).battleFormationRoll).toBe(true);
    });
  });
});

describe("mgL2BflowFormation", () => {
  isolateTimers();
  function battleProject(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 9999 };
    return project;
  }
  const fixed = (value: number) => () => value;
  describe("mg-l2-bflow #3 전투 개시 진형", () => {
    it("민첩 우위와 장비 선제 플래그가 선제 확률을 올리고 기습을 없앤다", () => {
      const even = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false });
      const fast = battleFormationChances({ partyAgility: 30, enemyAgility: 10, preemptiveEquipment: false });
      const gear = battleFormationChances({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: true });
      expect(fast.preemptive).toBeGreaterThan(even.preemptive);
      expect(gear.preemptive).toBe(even.preemptive + 25);
      expect(gear.surprise).toBe(0);
      // rng 0 은 첫 구간(선제), 0.999 는 보통.
      expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0))).toBe("preemptive");
      expect(rollBattleFormation({ partyAgility: 10, enemyAgility: 10, preemptiveEquipment: false }, fixed(0.999))).toBe("normal");
    });

    it("심볼 접촉: 같은 쪽을 볼 때 적 등 뒤에서 닿으면 선제, 등을 잡히면 기습, 정면은 굴림에 맡긴다", () => {
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "right" })).toBe("preemptive");
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 4, y: 5, facing: "right" })).toBe("surprise");
      expect(contactFormation({ x: 5, y: 5, facing: "right" }, { x: 6, y: 5, facing: "left" })).toBeUndefined();
      expect(contactFormation({ x: 5, y: 5, facing: "down" }, { x: 5, y: 6, facing: undefined })).toBeUndefined();
    });

    it("선제(gauge): 아군 게이지가 가득 차 첫 틱에 명령 차례가 온다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "preemptive", rng: fixed(0.5) });
      expect(runtime.snapshot().formation).toBe("preemptive");
      expect(runtime.snapshot().actors[0]?.gauge).toBe(100);
      runtime.tick(1);
      expect(runtime.snapshot().phase).toBe("actorCommand");
    });

    it("기습(gauge): 적 게이지가 가득 차 적이 먼저 행동한다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", formation: "surprise", rng: fixed(0.5) });
      expect(runtime.snapshot().enemies[0]?.gauge).toBe(100);
      expect(runtime.snapshot().actors[0]?.gauge).toBe(0);
      runtime.tick(1);
      expect(runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && entry.commandKind === "enemyAttack")).toBe(true);
    });

    it("선제(strict): 첫 라운드에 적이 행동하지 않고, 둘째 라운드부터 행동한다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "preemptive", rng: fixed(0.5) });
      runtime.performActorCommand({ kind: "defend" });
      const first = runtime.snapshot().roundLogs[0]!;
      expect(first.actions.some((action) => action.side === "enemy")).toBe(false);
      runtime.performActorCommand({ kind: "defend" });
      expect(runtime.snapshot().roundLogs[1]!.actions.some((action) => action.side === "enemy")).toBe(true);
    });

    it("기습(strict): 첫 라운드는 명령 없이 적만 행동하고 둘째 라운드에 명령 차례가 온다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", formation: "surprise", rng: fixed(0.5) });
      const first = runtime.snapshot().roundLogs[0]!;
      expect(first.actions.every((action) => action.side === "enemy")).toBe(true);
      expect(first.actions.length).toBeGreaterThan(0);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      expect(runtime.snapshot().strictRound).toBe(2);
    });

    it("백어택은 대열을 뒤집는다(전열 → 후열)", () => {
      expect(formationStartRow("front", "backAttack")).toBe("back");
      expect(formationStartRow("back", "pincer")).toBe("front");
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, formation: "backAttack", party: { rows: { actor_hero: "front" } }, rng: fixed(0.5) });
      expect(runtime.snapshot().actors[0]?.row).toBe("back");
    });

    it("battleFormationRoll 이 꺼진 레거시 프로젝트는 항상 보통 개시다(rng 를 쓰지 않는다)", () => {
      let calls = 0;
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => { calls += 1; return 0; } });
      expect(runtime.snapshot().formation).toBe("normal");
      expect(calls).toBe(0);
    });

    it("battleFormationRoll + 장비 선제 플래그가 굴림을 선제로 만든다", () => {
      const project = battleProject();
      project.system.battleFormationRoll = true;
      project.database.equipment.push(normalizeEquipmentRecord({ id: "equip_scout", name: "척후 장화", slot: "accessory" }));
      project.database.equipment.find((record) => record.id === "equip_scout")!.effectFlags.preemptive = true;
      // 선제 확률(5 + 25 = 30%) 안쪽 값.
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), party: { equipment: { actor_hero: { accessory: "equip_scout" } } } });
      expect(runtime.snapshot().formation).toBe("preemptive");
      const bare = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true, rng: fixed(0.2), formation: undefined });
      expect(bare.snapshot().formation).toBe("normal");
    });

    it("battleProcessing.formation 과 system.battleFormationRoll 이 저장·불러오기를 지난다", () => {
      const project = battleProject();
      project.system.battleFormationRoll = true;
      const map = Object.values(project.maps)[0]!;
      const event = map.events.find((entry) => entry.id === "battle-start")!;
      const battle = event.commands[0] as Extract<(typeof event.commands)[number], { kind: "battleProcessing" }>;
      battle.formation = "surprise";
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.battleFormationRoll).toBe(true);
      const command = Object.values(reloaded.maps)[0]!.events.find((entry) => entry.id === "battle-start")!.commands[0]!;
      expect(command).toMatchObject({ kind: "battleProcessing", formation: "surprise" });
    });
  });
});

// 장비가 주는 전투 명령·스킬, MP 소모 절반, 장착 중 장비의 제자리 강화(#7).
describe("mgL3EquipmentGrants", () => {
  isolateTimers();
  function project(): Project {
    const p = deserialize(JSON.stringify(battleFixture));
    p.database.skills.push(skill(p, { id: "skill_blade", name: "칼바람", mpCost: { flat: 9, percentMax: 0 } }));
    p.database.equipment.push(
      normalizeEquipmentRecord({
        id: "equip_runeblade", name: "룬 검", slot: "weapon", equippableActorIds: ["actor_hero"],
        grantsSkillIds: ["skill_blade"],
        grantsCommand: { id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" },
      }),
      normalizeEquipmentRecord({
        id: "equip_ring", name: "절약 반지", slot: "accessory", equippableActorIds: ["actor_hero"],
        effectFlags: { preemptive: false, doubleAttack: false, attackAll: false, ignoreDodge: false, preventCriticalHits: false, increasePhysicalDodge: false, halfMpCost: true, negateTerrainDamage: false, fixedEquipment: false },
      }),
    );
    return p;
  }
  function skill(p: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
    return {
      ...p.database.skills[0]!,
      name: patch.id,
      scope: "enemy",
      power: 10,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      stateEffects: [],
      ...patch,
    };
  }
  function battle(p: Project, equipment: Record<string, string>) {
    return createBattleRuntime({
      project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
      party: { levels: {}, experience: {}, equipment: { actor_hero: equipment } },
    });
  }
  function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
    for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand"; guard += 1) runtime.tick(100);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  }
  describe("equipment grants battle skills and commands", () => {
    it("an equipped weapon makes its granted skill usable without learning it", () => {
      const p = project();
      const bare = battle(p, {});
      actorTurn(bare);
      expect(battleSkillUseFailure(p, bare.snapshot().actors[0]!, "skill_blade")).toBe("notLearned");

      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const hero = armed.snapshot().actors[0]!;
      expect(hero.skillIds).not.toContain("skill_blade");
      expect(hero.equipmentEffects?.grantedSkillIds).toEqual(["skill_blade"]);
      expect(battleSkillUseFailure(p, hero, "skill_blade")).toBeUndefined();
      armed.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(armed.snapshot().timeline.some((entry) => entry.skillName === "칼바람" && entry.hit)).toBe(true);
    });

    it("adds the granted command to the actor's menu only while equipped", () => {
      const p = project();
      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const hero = armed.snapshot().actors[0]!;
      const withGrant = battleCommandsForActor(p, hero.recordId, { classId: hero.classId, grantedCommands: hero.equipmentEffects?.grantedCommands });
      expect(withGrant.find((command) => command.id === "cmd_rune")).toMatchObject({ name: "룬 베기", kind: "skill", skillId: "skill_blade" });
      const without = battleCommandsForActor(p, hero.recordId, { classId: hero.classId });
      expect(without.some((command) => command.id === "cmd_rune")).toBe(false);
    });

    it("auto-battle can pick a granted skill", () => {
      const p = project();
      // 배운 기술을 비워 장비 기술만 후보로 남긴다(클래스 기술도 뺀다).
      p.database.actors[0]!.learnedSkills = [];
      p.database.classes[0]!.learnedSkills = [];
      p.database.classes[0]!.skillIds = [];
      const armed = battle(p, { weapon: "equip_runeblade" });
      actorTurn(armed);
      const command = chooseAutoBattleCommand(p, armed.snapshot(), () => 0);
      expect(command).toMatchObject({ kind: "skill", skillId: "skill_blade" });
    });

    it("grant fields survive save/load", () => {
      const reloaded = deserialize(serialize(project()));
      const blade = reloaded.database.equipment.find((entry) => entry.id === "equip_runeblade");
      expect(blade?.grantsSkillIds).toEqual(["skill_blade"]);
      expect(blade?.grantsCommand).toEqual({ id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" });
    });
  });
  describe("halfMpCost equipment flag", () => {
    it("halves MP cost with round-up (9 → 5) in legality and consumption", () => {
      expect(battleSkillMpCost({ mpCost: { flat: 9, percentMax: 0 } }, 0, true)).toBe(5);
      expect(battleSkillMpCost({ mpCost: { flat: 1, percentMax: 0 } }, 0, true)).toBe(1);
      const p = project();
      const runtime = battle(p, { weapon: "equip_runeblade", accessory: "equip_ring" });
      actorTurn(runtime);
      const before = runtime.snapshot().actors[0]!;
      expect(before.equipmentEffects?.halfMpCost).toBe(true);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.mp).toBe(before.mp - 5);
    });

    it("without the ring the full cost is paid", () => {
      const p = project();
      const runtime = battle(p, { weapon: "equip_runeblade" });
      actorTurn(runtime);
      const before = runtime.snapshot().actors[0]!.mp;
      runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.mp).toBe(before - 9);
    });
  });
  describe("in-place upgrade of equipped gear", () => {
    function upgradeProject(): Project {
      const p = project();
      p.database.equipment.push(normalizeEquipmentRecord({ id: "equip_runeblade_plus", name: "룬 검+", slot: "weapon", equippableActorIds: ["actor_hero"], statBonuses: { attack: 20, defense: 0, mind: 0, agility: 0 } }));
      p.database.items.push({ ...p.database.items[0]!, id: "item_ore", name: "광석" });
      p.system.itemUpgrades = [{ id: "up_rune", fromItemId: "equip_runeblade", toItemId: "equip_runeblade_plus", target: "equipment", goldCost: 50, ingredients: [{ itemId: "item_ore", count: 1 }] }];
      return p;
    }

    it("replaces the equipped weapon in its slot and pays gold and materials", () => {
      const p = upgradeProject();
      const session = startSession(p);
      session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
      session.inventory = { item_ore: 2 };
      session.gold = 80;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus", equippedActorId: "actor_hero" });
      expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade_plus");
      expect(session.inventory.item_ore).toBe(1);
      expect(session.inventory.equip_runeblade_plus).toBeUndefined();
      expect(session.gold).toBe(30);

      const runtime = createBattleRuntime({ project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5, sessionState: session });
      expect(runtime.snapshot().actors[0]!.effectiveStats?.attack).toBeGreaterThanOrEqual(20);
    });

    it("upgrades a bag copy when nobody wears it, and rejects without the item or gold", () => {
      const p = upgradeProject();
      const session = startSession(p);
      session.actorEquipment = {};
      session.inventory = { item_ore: 1 };
      session.gold = 80;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-item" });
      session.inventory.equip_runeblade = 1;
      session.gold = 10;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-gold" });
      session.gold = 50;
      expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus" });
      expect(session.inventory.equip_runeblade ?? 0).toBe(0);
      expect(session.inventory.equip_runeblade_plus).toBe(1);
    });

    it("rejects a cross-slot upgrade and keeps the equipped item untouched", () => {
      const p = upgradeProject();
      p.system.itemUpgrades = [{ id: "up_bad", fromItemId: "equip_runeblade", toItemId: "equip_ring", target: "equipment" }];
      const session = startSession(p);
      session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
      expect(applyItemUpgrade(p, session, "up_bad")).toEqual({ ok: false, reason: "invalid-state" });
      expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade");
    });

    it("equipment-target rules pass reference validation and survive save/load", () => {
      const reloaded = deserialize(serialize(upgradeProject()));
      expect(reloaded.system.itemUpgrades?.[0]?.target).toBe("equipment");
    });
  });
});
