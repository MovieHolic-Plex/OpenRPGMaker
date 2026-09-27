// 감정 계열·단계(#23)와 약점 추가 행동 — 실제 전투 런타임을 통과해 확인한다.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { addEmotionState, emotionDamageMultiplier } from "@/battle/battleEmotion";
import { enemyBattlers } from "@/battle/battleBattlers";
import { deserialize, serialize } from "@/project/io";
import type { Project, SkillRecord, StateRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function project(): Project {
  const p = deserialize(JSON.stringify(battleFixture));
  const emotion = (id: string, name: string, family: string, tier: number): StateRecord => ({ id, name, emotion: { family, tier } });
  p.database.states.push(
    emotion("state_happy", "기쁨", "joy", 1),
    emotion("state_ecstatic", "환희", "joy", 2),
    emotion("state_manic", "광희", "joy", 3),
    emotion("state_angry", "분노", "anger", 1),
  );
  return p;
}

function skill(p: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
  return {
    ...p.database.skills[0]!,
    name: patch.id,
    scope: "enemy",
    power: 20,
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    hitRate: 100,
    variance: 0,
    criticalRate: 0,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    stateEffects: [],
    ...patch,
  };
}

function learn(p: Project, ...skillIds: string[]): void {
  p.database.actors[0]!.learnedSkills = skillIds.map((skillId) => ({ level: 1, skillId }));
}

function battle(p: Project, battleFlow: "gauge" | "strict" = "gauge") {
  return createBattleRuntime({ project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow, rng: () => 0.5 });
}

function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
  for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand" && !runtime.snapshot().result; guard += 1) runtime.tick(100);
  expect(runtime.snapshot().phase).toBe("actorCommand");
}

describe("emotion states stack into tiers within a family", () => {
  it("re-applying the same family climbs one tier and caps at the highest", () => {
    const p = project();
    const slime = enemyBattlers(p, p.database.troops[0]!)[0]!;
    expect(addEmotionState(p, slime, "state_happy").added).toEqual(["state_happy"]);
    expect(addEmotionState(p, slime, "state_happy").added).toEqual(["state_ecstatic"]);
    expect(slime.stateIds).toEqual(["state_ecstatic"]);
    addEmotionState(p, slime, "state_happy");
    expect(slime.stateIds).toEqual(["state_manic"]);
    // 최고 단계에서 멈춘다 — 바뀐 것이 없으면 added 도 비어 있다.
    expect(addEmotionState(p, slime, "state_happy")).toEqual({ added: [], removed: [] });
    expect(slime.stateIds).toEqual(["state_manic"]);
  });

  it("a different family replaces the current emotion and keeps non-emotion states", () => {
    const p = project();
    const slime = enemyBattlers(p, p.database.troops[0]!)[0]!;
    slime.stateIds = ["state_burn"];
    addEmotionState(p, slime, "state_ecstatic");
    const result = addEmotionState(p, slime, "state_angry");
    expect(result).toEqual({ added: ["state_angry"], removed: ["state_ecstatic"] });
    expect(slime.stateIds).toEqual(["state_burn", "state_angry"]);
  });

  it("skill state effects go through tier stacking in battle and record the new tier on the timeline", () => {
    const p = project();
    p.database.skills.push(skill(p, { id: "skill_tease", power: 0, stateEffects: [{ stateId: "state_happy", chance: 100, operation: "add" }] }));
    learn(p, "skill_tease");
    const runtime = battle(p);
    actorTurn(runtime);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_tease", targetEnemyId: "enemy-1" });
    actorTurn(runtime);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_tease", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().enemies[0]!.stateIds).toEqual(["state_ecstatic"]);
    const added = runtime.snapshot().timeline.filter((entry) => entry.kind === "stateAdded").map((entry) => entry.stateId);
    expect(added).toEqual(["state_happy", "state_ecstatic"]);
  });
});

describe("emotion cycle multiplier", () => {
  it("scales damage by the attacker→target family rule and leaves unmatched pairs at 1", () => {
    const p = project();
    p.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }];
    const hero = { stateIds: ["state_happy"] };
    expect(emotionDamageMultiplier(p, hero, { stateIds: ["state_angry"] })).toBe(2);
    expect(emotionDamageMultiplier(p, hero, { stateIds: ["state_happy"] })).toBe(1);
    expect(emotionDamageMultiplier(p, { stateIds: [] }, { stateIds: ["state_angry"] })).toBe(1);

  });

  it("multiplies real battle damage in the same slot as an element weakness", () => {
    const run = (cycle: Project["system"]["emotionCycle"], weakElement = false): number => {
      const p = project();
      p.system.emotionCycle = cycle;
      p.database.elements = [
        { id: "fire", name: "불", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      ];
      if (weakElement) p.database.enemies[0]!.elementRates = { fire: "A" };
      p.database.skills.push(
        skill(p, { id: "skill_anger", power: 0, stateEffects: [{ stateId: "state_angry", chance: 100, operation: "add" }] }),
        skill(p, { id: "skill_hit", power: 40, elementId: "fire" }),
      );
      learn(p, "skill_anger", "skill_hit");
      const runtime = createBattleRuntime({
        project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
        party: { levels: {}, experience: {}, stateIds: { actor_hero: ["state_happy"] } },
      });
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_anger", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().enemies[0]!.stateIds).toEqual(["state_angry"]);
      actorTurn(runtime);
      const before = runtime.snapshot().enemies[0]!.hp;
      runtime.performActorCommand({ kind: "skill", skillId: "skill_hit", targetEnemyId: "enemy-1" });
      return before - runtime.snapshot().enemies[0]!.hp;
    };
    const neutral = run(undefined);
    const boosted = run([{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }]);
    const reversed = run([{ attackerFamily: "anger", targetFamily: "joy", multiplier: 2 }]);
    expect(neutral).toBeGreaterThan(0);
    expect(boosted).toBeGreaterThan(neutral);
    expect(boosted).toBe(run(undefined, true));
    // 방향이 반대인 규칙은 이 공격(기쁨→분노)에 적용되지 않는다.
    expect(reversed).toBe(neutral);
  });

  it("survives save/load for both the state emotion and the cycle table", () => {
    const p = project();
    p.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 1.5 }];
    const reloaded = deserialize(serialize(p));
    expect(reloaded.system.emotionCycle).toEqual([{ attackerFamily: "joy", targetFamily: "anger", multiplier: 1.5 }]);
    expect(reloaded.database.states.find((state) => state.id === "state_ecstatic")?.emotion).toEqual({ family: "joy", tier: 2 });
  });
});

describe("weakness hit grants an extra action", () => {
  function weaknessProject(enabled: boolean): Project {
    const p = project();
    p.database.elements = [
      { id: "fire", name: "불", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    p.database.enemies[0]!.elementRates = { fire: "A" };
    p.database.enemies[0]!.stats.maxHp = 5000;
    p.database.skills.push(skill(p, { id: "skill_blaze", elementId: "fire", power: 10 }), skill(p, { id: "skill_plain", power: 10 }));
    learn(p, "skill_blaze", "skill_plain");
    if (enabled) p.system.weaknessExtraAction = true;
    return p;
  }

  it("gauge flow: hitting a weakness reopens the same actor's command immediately", () => {
    const runtime = battle(weaknessProject(true));
    actorTurn(runtime);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().activeActorId).toBe("actor_hero");
    // 쓰러진 적은 제 차례 전까지 다시 약점을 맞아도 행동을 더 주지 않는다.
    runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().phase).not.toBe("actorCommand");
  });

  it("no extra action without the option or for a non-weakness hit", () => {
    const off = battle(weaknessProject(false));
    actorTurn(off);
    off.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
    expect(off.snapshot().phase).not.toBe("actorCommand");

    const plain = battle(weaknessProject(true));
    actorTurn(plain);
    plain.performActorCommand({ kind: "skill", skillId: "skill_plain", targetEnemyId: "enemy-1" });
    expect(plain.snapshot().phase).not.toBe("actorCommand");
  });

  it("strict flow: the actor acts twice in the same round", () => {
    const runtime = battle(weaknessProject(true), "strict");
    expect(runtime.snapshot().phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "skill", skillId: "skill_blaze", targetEnemyId: "enemy-1" });
    const round = runtime.snapshot().roundLogs[0]!;
    const heroActions = round.actions.filter((action) => action.side === "actor");
    expect(heroActions).toHaveLength(2);
    expect(heroActions.every((action) => action.skillName === "skill_blaze")).toBe(true);
  });

  it("weaknessExtraAction survives save/load", () => {
    expect(deserialize(serialize(weaknessProject(true))).system.weaknessExtraAction).toBe(true);
    expect(deserialize(serialize(weaknessProject(false))).system.weaknessExtraAction).toBeUndefined();
  });
});
