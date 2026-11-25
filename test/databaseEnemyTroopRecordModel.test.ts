import { describe, expect, it } from "vitest";
import { resolveBattleBackdrop, terrainBattleBackgroundAt } from "@/battle/battleBackdrop";
import { hitFeelFromActionResult, resolveBattlerPose } from "@/battle/battlePose";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { createBattleRuntime, isBattlerIncapacitated } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID, normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { type MutableBattler, enemyBattlers } from "@/battle/battleBattlers";
import type { TroopRecord } from "@/project/types/database";
import { deserialize, serialize } from "@/project/io";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { updateEnemyRecord, updateSkillRecord } from "@/editor/databaseRecordMutators";
import { evaluateDamageFormula, FORMULA_PREVIEW_CONTEXT } from "@/battle/damageFormula";
import fixture from "./fixtures/projects/battle-v3.json";
import type { Project, BattleEventPageRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { isolateTimers } from "./mergedTeardown";

describe("battlePoseHitFeelBackdropEvents", () => {
  isolateTimers();
  describe("battle poses", () => {
    it("maps idle, attack, hit, defend, and dead from action result", () => {
      const idle = resolveBattlerPose({
        battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
      });
      expect(idle).toBe("idle");

      const attack = resolveBattlerPose({
        battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: false },
        lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
      });
      expect(attack).toBe("attack");

      const hit = resolveBattlerPose({
        battler: { id: "e1", recordId: "enemy_slime", defeated: false, defending: false },
        lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 5, critical: false },
      });
      expect(hit).toBe("hit");

      const defend = resolveBattlerPose({
        battler: { id: "a1", recordId: "actor_hero", defeated: false, defending: true },
      });
      expect(defend).toBe("defend");

      const dead = resolveBattlerPose({
        battler: { id: "e1", recordId: "enemy_slime", defeated: true, defending: false },
        lastActionResult: { userRecordId: "actor_hero", targetId: "e1", hit: true, amount: 99, critical: true },
      });
      expect(dead).toBe("dead");
    });

    it("surfaces attack/hit poses on a real runtime snapshot after an attack", () => {
      const project = createBlankProject();
      const troopId = project.database.troops[0]?.id;
      if (!troopId) throw new Error("missing default troop");
      for (const enemy of project.database.enemies) {
        enemy.stats.maxHp = 9999;
        enemy.stats.defense = 1;
        enemy.stats.agility = 1;
      }
      // Gauge mode: after actor acts, phase is charging and lastActionResult is still the actor's blow
      // (enemy has not ticked yet).
      const rt = createBattleRuntime({ project, troopId, canEscape: true, canLose: true, battleFlow: "gauge" });
      for (let i = 0; i < 20_000; i += 1) {
        rt.tick(50);
        if (rt.snapshot().phase === "actorCommand") break;
      }
      let snap = rt.snapshot();
      expect(snap.phase).toBe("actorCommand");
      const eid = snap.enemies[0]?.id;
      const aid = snap.activeActorId;
      if (!eid || !aid) throw new Error("missing combatants");
      rt.performActorCommand({ kind: "attack", targetEnemyId: eid });
      snap = rt.snapshot();
      const actor = snap.actors.find((entry) => entry.recordId === aid);
      const enemy = snap.enemies.find((entry) => entry.id === eid);
      expect(snap.lastActionResult?.userRecordId).toBe(aid);
      expect(actor?.pose).toBe("attack");
      expect(enemy?.defeated).toBe(false);
      if (snap.lastActionResult?.hit) {
        expect(enemy?.pose).toBe("hit");
        expect(snap.hitFeel?.targetId).toBe(eid);
      }
    });
  });
  describe("hit-feel helper", () => {
    it("builds hit-feel only for damaging hits", () => {
      expect(hitFeelFromActionResult(undefined)).toBeUndefined();
      expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: false, amount: 0, critical: false })).toBeUndefined();
      expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 0, critical: false })).toBeUndefined();
      expect(hitFeelFromActionResult({ userRecordId: "a", targetId: "e", hit: true, amount: 12, critical: true })).toEqual({
        targetId: "e",
        amount: 12,
        critical: true,
        healing: false,
      });
    });
  });
  describe("battle backdrop resolution", () => {
    it("uses troop preview when set, otherwise terrain at location, else forest", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("missing start map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");

      // Author terrain tag 1 on the start tile → grassland dawn backdrop.
      const x = project.startPos.x;
      const y = project.startPos.y;
      const tile = map.lowerTiles[y * map.width + x] ?? 0;
      if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
      while (tileset.terrain.length <= tile) tileset.terrain.push(0);
      tileset.terrain[tile] = 1;
      tileset.tileMeta = { ...(tileset.tileMeta ?? {}), [tile]: { ...(tileset.tileMeta?.[tile] ?? {}), terrainTag: 1 } };
      project.database.terrains = [
        {
          id: "terrain_grassland",
          name: "초원",
          damage: 0,
          encounterRatePercent: 100,
          battleBackgroundResourceId: "easyrpg-backdrop-dawn1",
          characterDisplay: "normal",
          vehiclePassage: { boat: false, ship: false, airshipLand: true },
        },
      ];

      const troop = project.database.troops[0];
      if (!troop) throw new Error("missing troop");
      delete troop.previewBackgroundResourceId;

      expect(terrainBattleBackgroundAt(project, { mapId, x, y })).toBe("easyrpg-backdrop-dawn1");
      const fromTerrain = resolveBattleBackdrop({
        project,
        troopId: troop.id,
        location: { mapId, x, y },
      });
      // EasyRPG 하늘 배경은 도트 풀밭 겹 배경 id 로 풀린다(2026-10-03).
      expect(fromTerrain).toBe("battle-scenery-plains");

      troop.previewBackgroundResourceId = "generated-battle-reference-forest";
      // 적 그룹의 숲 값은 도구가 찍는 기본값인 경우가 많아, 지형·맵이 더 구체적으로 말하면 물러난다(battleBackdrop.ts, jrpg-real-1 J08).
      expect(resolveBattleBackdrop({ project, troopId: troop.id, location: { mapId, x: project.startPos.x, y: project.startPos.y } })).toBe(
        "battle-scenery-plains"
      );
      // 다른 단서가 없으면 그 숲 값이 그대로 쓰인다.
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-scenery-forest");

      troop.previewBackgroundResourceId = undefined;
      // Off-map / no tag → forest fallback
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
    });

    it("uses the monster skin fallback without overriding authored battle backgrounds", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "pokemon";
      const troop = project.database.troops[0]!;
      delete troop.previewBackgroundResourceId;
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-skin-pokemon-backdrop");
      // 옛 숲 그림·도트 겹 배경은 포켓몬에서 줄무늬 바닥 표지로, Scarloxy 그림은 그대로 둔다.
      troop.previewBackgroundResourceId = "generated-battle-reference-forest";
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("battle-skin-pokemon-backdrop");
      troop.previewBackgroundResourceId = "scarloxy-backdrop-sand";
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe("scarloxy-backdrop-sand");
      project.system.battleUiStyle = "retro2003";
      delete troop.previewBackgroundResourceId;
      expect(resolveBattleBackdrop({ project, troopId: troop.id })).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
    });

    it("rewrites night-sky troop previews to forest via runtime create", () => {
      const project = createBlankProject();
      const troop = project.database.troops[0];
      if (!troop) throw new Error("missing troop");
      troop.previewBackgroundResourceId = "easyrpg-backdrop-night-sky1";
      // normalizeTroop on blank already rewrote; force raw id and resolve helper
      expect(
        resolveBattleBackdrop({
          project: {
            ...project,
            database: {
              ...project.database,
              troops: [{ ...troop, previewBackgroundResourceId: "easyrpg-backdrop-night-sky1" }],
            },
          },
          troopId: troop.id,
        })
      ).toBe(DEFAULT_BATTLE_FIELD_BACKGROUND_ID);
    });
  });
  describe("battle event command expansion", () => {
    function stubBattler(recordId: string): MutableBattler {
      return {
        id: recordId,
        recordId,
        name: recordId,
        maxHp: 50,
        maxMp: 10,
        attackPower: 10,
        defense: 5,
        mind: 5,
        agility: 10,
        chargeRate: 0.1,
        skillIds: [],
        hidden: false,
        hp: 50,
        mp: 10,
        gauge: 0,
        stateIds: [],
        stateTurns: {},
        defending: false,
      };
    }

    it("executes changeGold, changeExp, learnSkill, and changeParty for real", () => {
      const project = createBlankProject();
      const actorId = project.system.startActorIds[0] ?? "actor_hero";
      const troop: TroopRecord = {
        id: "troop_event_test",
        name: "event test",
        enemyIds: [],
        members: [],
        autoAlign: true,
        battleEventPages: [
          {
            id: "page1",
            name: "on start",
            conditions: [{ kind: "onRound", round: 0 }],
            span: "battle",
            runOnce: true,
            commands: [
              { kind: "changeGold", op: "+=", amount: 25 },
              { kind: "changeExp", actorId, op: "+=", amount: 40 },
              { kind: "learnSkill", actorId, skillId: project.database.skills[0]?.id ?? "skill_attack" },
              { kind: "changeParty", actorId: "actor_extra", action: "add" },
              { kind: "transfer", mapId: "nope", x: 0, y: 0 },
            ],
          },
        ],
      };
      const state = {
        switches: {} as Record<string, boolean>,
        variables: {} as Record<string, number>,
        inventory: {} as Record<string, number>,
        gold: 10,
        partyActorIds: [actorId],
        actorSkillIds: { [actorId]: [] as string[] },
        actorExperience: { [actorId]: 0 },
        actorLevels: { [actorId]: 1 },
      };
      const actors = [stubBattler(actorId)];
      const runtime = createBattleEventRuntime({
        project,
        troopRecord: troop,
        actors,
        enemies: [],
        stateIds: [],
        state,
      });
      runtime.applyTroopEvents({ turn: 0 });
      const snap = runtime.snapshot();
      expect(snap.gold).toBe(35);
      expect(snap.actorExperience?.[actorId]).toBe(40);
      expect(snap.actorSkillIds?.[actorId]).toContain(project.database.skills[0]?.id ?? "skill_attack");
      expect(snap.partyActorIds).toContain("actor_extra");
      const logs = runtime.logs();
      expect(logs.some((entry) => entry.kind === "unsupported" && entry.detail === "transfer")).toBe(true);
      expect(logs.some((entry) => entry.kind === "message" && entry.detail?.startsWith("gold→"))).toBe(true);
    });
  });
});

describe("feature16CombatSchema", () => {
  isolateTimers();
  describe('feature16 combat authoring persistence', () => {
    it('roundtrips authored rules through the editor mutator and project wire load/save', () => {
      const project = deserialize(JSON.stringify(fixture));
      project.switches.push({ id: 'bonus', name: '추가 보상' });
      project.database.states.push({ ...project.database.states[0], id: 'poison', name: '독' });
      const id = project.database.skills[0].id;
      const patch = { damageFormula: 'power + a.atk * 2 - b.def', criticalRate: 0, criticalMultiplier: 2.5, cooldownTurns: 2, hitSequence: [1, 0.5, 2], hitRate: 74 };
      updateSkillRecord(project.database, id, patch);
      project.database.enemies[0] = normalizeEnemyRecord({ ...project.database.enemies[0], actions: [
        { ...project.database.enemies[0].actions[0], skillId: id, condition: { kind: 'mp', minPercent: 10, maxPercent: 80 } },
      ], rewards: { ...project.database.enemies[0].rewards, drops: [
        { itemId: project.database.items[0].id, ratePercent: 45, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } },
        { itemId: project.database.items[0].id, ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'poison', present: false } },
      ] } });
      const loaded = deserialize(serialize(project));
      expect(loaded.database.skills.find(skill => skill.id === id)).toMatchObject(patch);
      expect(loaded.database.enemies[0].actions[0].condition).toEqual({ kind: 'mp', minPercent: 10, maxPercent: 80 });
      expect(loaded.database.enemies[0].rewards.drops).toEqual(project.database.enemies[0].rewards.drops);
      expect(deserialize(serialize(loaded)).database.skills.find(skill => skill.id === id)).toMatchObject(patch);
    });
    it('keeps omitted defaults and clamps malformed optional numbers', () => {
      const legacy = normalizeSkillRecord({ id: 'legacy', name: 'Legacy' });
      expect(legacy.damageFormula).toBeUndefined();
      expect(legacy.criticalRate).toBeUndefined();
      expect(legacy.hitSequence).toBeUndefined();
      expect(legacy.cooldownTurns).toBeUndefined();
      expect(normalizeSkillRecord({ ...legacy, criticalRate: 300, cooldownTurns: -5, hitSequence: [NaN, -2, 50] })).toMatchObject({ criticalRate: 100, cooldownTurns: 0, hitSequence: [1, 0, 10] });
      expect(normalizeEnemyRecord({ id: 'e', name: 'E' }).rewards.drops).toBeUndefined();
      expect(normalizeEnemyRecord({ id: 'e', name: 'E', rewards: { exp: 0, gold: 0, dropRatePercent: 100, drops: [] } }).rewards.drops).toEqual([]);
    });
  });
  describe('database form combat fields', () => {
    it('keeps the skill and enemy fields the database forms write', () => {
      const project = deserialize(JSON.stringify(fixture));
      const id = project.database.skills[0].id;
      const name = project.database.skills[0].name;
      updateSkillRecord(project.database, id, {
        gaugeShift: -20,
        chargeTurns: 2,
        summonResourceId: 'party-pixel-animal-0',
        learnable: true,
        inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
        battleGimmick: { pattern: 'dash', durationTurns: 3 },
      });
      const saved = project.database.skills.find((skill) => skill.id === id);
      expect(saved?.name).toBe(name);
      expect(saved).toMatchObject({
        gaugeShift: -20,
        chargeTurns: 2,
        summonResourceId: 'party-pixel-animal-0',
        learnable: true,
        inputSequence: { keys: ['up', 'confirm'], timeLimitMs: 2500, successMultiplier: 2, failMultiplier: 0.25 },
        battleGimmick: { pattern: 'dash', durationTurns: 3 },
      });
      updateSkillRecord(project.database, id, {
        gaugeShift: undefined,
        chargeTurns: undefined,
        summonResourceId: undefined,
        learnable: undefined,
        inputSequence: undefined,
        battleGimmick: undefined,
      });
      const cleared = project.database.skills.find((skill) => skill.id === id);
      expect(cleared?.gaugeShift).toBeUndefined();
      expect(cleared?.chargeTurns).toBeUndefined();
      expect(cleared?.summonResourceId).toBeUndefined();
      expect(cleared?.learnable).toBeUndefined();
      expect(cleared?.inputSequence).toBeUndefined();
      expect(cleared?.battleGimmick).toBeUndefined();

      const enemy = project.database.enemies[0];
      const itemId = project.database.items[0].id;
      updateEnemyRecord(project.database, enemy.id, { stealItems: [{ itemId, rate: 40 }] });
      expect(project.database.enemies[0].stealItems).toEqual([{ itemId, rate: 40 }]);
      updateEnemyRecord(project.database, enemy.id, { stealItems: undefined });
      expect(project.database.enemies[0].stealItems).toBeUndefined();
      expect(project.database.enemies[0].name).toBe(enemy.name);
    });
  });
  describe('feature16 bounded damage formula language', () => {
    it('supports precedence, unary signs, parentheses and deterministic values', () => {
      expect(evaluateDamageFormula('power + (a.atk * 2 - b.def) / 2', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 20 });
      expect(evaluateDamageFormula('-10 + 2 * 3', FORMULA_PREVIEW_CONTEXT)).toEqual({ ok: true, value: 0 });
    });
    it.each(['globalThis.alert(1)', 'a.constructor', '1;2', 'a.atk=99', '1/0', '1e99', '2 ** 999', '('.repeat(40) + '1' + ')'.repeat(40), '1'.repeat(513)])('rejects unsafe or invalid input %s', expression => {
      expect(evaluateDamageFormula(expression, FORMULA_PREVIEW_CONTEXT).ok).toBe(false);
    });
  });
});

describe("mgL2BflowDefeat", () => {
  isolateTimers();
  function battleProject(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function addPetrify(project: Project): void {
    project.database.states.push(normalizeStateRecord({
      id: "state_stone",
      name: "석화",
      runtimeEffects: { incapacitates: true, removeOnBattleEnd: false },
    }));
  }
  describe("mg-l2-bflow #20 전원 행동 불능 패배", () => {
    it("아군 전원이 incapacitates 상태면 HP 가 남아도 패배한다", () => {
      const project = battleProject();
      addPetrify(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_stone"] } }, rng: () => 0.5 });
      const snapshot = runtime.snapshot();
      expect(snapshot.actors[0]!.hp).toBeGreaterThan(0);
      expect(snapshot.result).toBe("defeat");
    });

    it("incapacitates 가 아닌 상태(표시만 있는 상태)로는 패배하지 않는다", () => {
      const project = battleProject();
      project.database.states.push(normalizeStateRecord({ id: "state_mark", name: "표식", runtimeEffects: { removeOnBattleEnd: false } }));
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", party: { stateIds: { actor_hero: ["state_mark"] } }, rng: () => 0.5 });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(isBattlerIncapacitated(project, { stateIds: ["state_mark"] })).toBe(false);
      expect(isBattlerIncapacitated((addPetrify(project), project), { stateIds: ["state_stone"] })).toBe(true);
    });

    it("incapacitates 는 저장·불러오기를 지난다", () => {
      const project = battleProject();
      addPetrify(project);
      const reloaded = deserialize(serialize(project));
      expect(reloaded.database.states.find((state) => state.id === "state_stone")?.runtimeEffects?.incapacitates).toBe(true);
    });
  });
  describe("mg-l2-bflow #36 적 최후의 일격(onDeath)", () => {
    function lastStandProject(chance = 100): Project {
      const project = battleProject();
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      slime.stats = { ...slime.stats, maxHp: 1, defense: 0 };
      slime.reactions = [{ trigger: "onDeath", skillId: "skill_claw", chance }];
      const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
      claw.mpCost = { flat: 0, percentMax: 0 };
      return project;
    }

    it("쓰러지는 적이 한 번 스킬을 쓰고, 그 뒤 승리한다", () => {
      const runtime = createBattleRuntime({ project: lastStandProject(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      const heroHp = runtime.snapshot().actors[0]!.hp;
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const snapshot = runtime.snapshot();
      const counters = snapshot.timeline.filter((entry) => entry.kind === "counter");
      expect(counters).toHaveLength(1);
      expect(counters[0]!.skillName).toBe("할퀴기");
      expect(snapshot.actors[0]!.hp).toBeLessThan(heroHp);
      expect(snapshot.enemies[0]!.hp).toBe(0);
      expect(snapshot.result).toBe("victory");
    });

    it("최후의 일격으로 아군을 전멸시키면 승리가 아니라 패배다", () => {
      const project = lastStandProject();
      const claw = project.database.skills.find((skill) => skill.id === "skill_claw")!;
      claw.power = 99999;
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().result).toBe("defeat");
    });

    it("onDeath 가 없는 적은 쓰러질 때 아무것도 하지 않는다(기존 반격 계약 그대로)", () => {
      const project = lastStandProject();
      project.database.enemies.find((record) => record.id === "enemy_slime")!.reactions = [{ trigger: "physical", skillId: "skill_claw", chance: 100 }];
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().timeline.some((entry) => entry.kind === "counter")).toBe(false);
      expect(runtime.snapshot().result).toBe("victory");
    });

    it("onDeath 반응은 정규화와 저장을 지난다", () => {
      const normalized = normalizeEnemyRecord({ id: "enemy_x", name: "X", reactions: [{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }] } as Parameters<typeof normalizeEnemyRecord>[0]);
      expect(normalized.reactions).toEqual([{ trigger: "onDeath", skillId: "skill_claw", chance: 40 }]);
      const reloaded = deserialize(serialize(lastStandProject(40)));
      expect(reloaded.database.enemies.find((record) => record.id === "enemy_slime")?.reactions?.[0]).toMatchObject({ trigger: "onDeath", chance: 40 });
    });
  });
});

describe("monsterBattleAuthoringContract", () => {
  isolateTimers();
  const page = (patch: Partial<BattleEventPageRecord> = {}): BattleEventPageRecord => ({
    id: "page", span: "turn", conditions: [], commands: [{ kind: "changeGold", op: "+=", amount: 1 }], ...patch,
  });
  function setup(pages: BattleEventPageRecord[]) {
    const project = deserialize(JSON.stringify(battleFixture));
    const troop = project.database.troops[0]!;
    troop.battleEventPages = pages;
    const enemies = enemyBattlers(project, troop);
    const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
    const runtime = createBattleEventRuntime({ project, troopRecord: troop, actors: [], enemies, stateIds: project.database.states.map((s) => s.id), state });
    return { project, troop, enemies, state, runtime };
  }
  describe("monster battle authoring contracts", () => {
    it("empty authored pages have no implicit state or reward effects", () => {
      const { enemies, state, runtime } = setup([page({ commands: [], span: "battle" })]);
      const before = structuredClone(enemies);
      runtime.applyTroopEvents({ turn: 1 });
      expect(enemies).toEqual(before);
      expect(state.gold).toBe(0);
    });

    it.each([
      ["turn", undefined, 2], ["moment", undefined, 3], ["battle", undefined, 1],
      ["battle", false, 3], ["moment", true, 1], ["turn", true, 1],
    ] as const)("%s span with runOnce=%s fires %s times", (span, runOnce, expected) => {
      const { runtime, state } = setup([page({ span, runOnce })]);
      runtime.applyTroopEvents({ turn: 1 });
      runtime.applyTroopEvents({ turn: 1 });
      runtime.applyTroopEvents({ turn: 2 });
      expect(state.gold).toBe(expected);
    });

    it("round conditions still deduplicate even with moment span", () => {
      const { runtime, state } = setup([page({ span: "moment", conditions: [{ kind: "everyRound", start: 1, interval: 1 }] })]);
      runtime.applyTroopEvents({ turn: 1 });
      runtime.applyTroopEvents({ turn: 1 });
      runtime.applyTroopEvents({ turn: 2 });
      expect(state.gold).toBe(2);
    });

    it("repairs duplicate page IDs deterministically without stealing another existing ID", () => {
      const { project, troop } = setup([page({ id: "p" }), page({ id: "p" }), page({ id: "p_2" }), page({ id: "p" })]);
      const normalized = normalizeTroopRecord(troop);
      expect(normalized.battleEventPages.map((p) => p.id)).toEqual(["p", "p_3", "p_2", "p_4"]);
      expect(normalizeTroopRecord(normalized)).toEqual(normalized);
      const loaded = deserialize(serialize(project));
      expect(loaded.database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
      expect(deserialize(serialize(loaded)).database.troops[0]!.battleEventPages).toEqual(normalized.battleEventPages);
    });

    it("saves, loads and evaluates the second slot independently of a duplicate enemy", () => {
      const { project, troop } = setup([page({ conditions: [{ kind: "enemyHp", enemyId: "enemy-2", minPercent: 0, maxPercent: 50 }] })]);
      const enemyId = troop.enemyIds[0]!;
      troop.members = [{ enemyId, x: 80, y: 100 }, { enemyId, x: 160, y: 100 }];
      troop.enemyIds = [enemyId, enemyId];
      const loaded = deserialize(serialize(project));
      const loadedTroop = loaded.database.troops[0]!;
      const enemies = enemyBattlers(loaded, loadedTroop);
      const state = { gold: 0, switches: {}, variables: {}, inventory: {} };
      const runtime = createBattleEventRuntime({ project: loaded, troopRecord: loadedTroop, actors: [], enemies, stateIds: [], state });
      enemies[0]!.hp = 1;
      runtime.applyTroopEvents({ turn: 1 });
      expect(state.gold).toBe(0);
      enemies[1]!.hp = 1;
      runtime.applyTroopEvents({ turn: 1 });
      expect(state.gold).toBe(1);
    });
  });
});
