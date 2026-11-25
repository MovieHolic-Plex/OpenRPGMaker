import { describe, expect, it, afterEach } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { enemyActionDirectorState, chargingDirectorState } from "@/player/battleDirectorDom";
import { deserialize, serialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { store } from "@/project/store";
import { normalizeBattleStaging, resolveBattleStaging } from "@/project/battleStaging";
import { createBattleSequencer, type DamageFeedback } from "@/player/battleSequencer";
import itemFixture from "./fixtures/projects/item-runtime-qa-v3.json";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import fixture from "./fixtures/projects/battle-v3.json";
import { isolateTimers } from "./mergedTeardown";

describe("battleComboFollowUpLine", () => {
  isolateTimers();
  // 2026-11-10 fs-combo-cancel: 불꽃 십자참(2연타) 둘째 타가 「카엘이 불꽃 십자참을 사용했다!」로 읽혀 혼자 쓴 기술처럼 보였다(6/6).
  describe("연계기 다단 타격의 후속 문장", () => {
    const before = createBattleRuntime({ project: deserialize(JSON.stringify(battleFixture)), troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot();
    const hero = before.actors[0]!;
    const target = before.enemies[0]!;
    const entry = { userRecordId: hero.recordId, userId: hero.id, targetId: target.id, hit: true, amount: 10, critical: false, skillName: "합동기" };

    it("연계 참가자가 있으면 참가자 이름으로 연계기를 부른다", () => {
      const line = enemyActionDirectorState({ ...entry, comboActorIds: [hero.recordId, "actor_partner"] }, before).lines.join(" ");
      expect(line).toContain("의 연계기 — 합동기!");
      expect(line).not.toContain("사용했다");
    });

    it("일반 기술은 그대로 「…을 사용했다!」", () => {
      expect(enemyActionDirectorState(entry, before).lines.join(" ")).toContain("합동기를 사용했다!");
    });
  });
});

describe("battleEffectivenessFeedbackSetting", () => {
  isolateTimers();
  type Project = ReturnType<typeof deserialize>;
  const MAGE = "actor_mage";
  const LIGHTNING = "skill_mage_chain_lightning";
  const previous = store.getCurrent();
  afterEach(() => store.replace(previous));
  function thunderWeakPair(hide: boolean): Project {
    const project = deserialize(JSON.stringify(itemFixture));
    project.system.battleModel = "rm2k3";
    project.system.battleUiStyle = "retro2003";
    const slime = project.database.enemies.find((e) => e.id === "enemy_meadow_slime")!;
    slime.elementRates = { ...slime.elementRates, thunder: "A" };
    const mage = project.database.actors.find((a) => a.id === MAGE)!;
    mage.learnedSkills = [...(mage.learnedSkills ?? []), { level: 1, skillId: LIGHTNING }];
    if (hide) project.system.battleStaging = { effectivenessFeedback: "hide" };
    return project;
  }
  function castLightning(project: Project) {
    store.replace(project);
    const runtime = createBattleRuntime({
      project, troopId: "troop_slime_pair", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
      party: { partyActorIds: [MAGE], levels: { [MAGE]: 20 }, experience: { [MAGE]: 0 }, vitals: { [MAGE]: { hp: 300, mp: 100 } }, stateIds: { [MAGE]: [] } },
      sessionState: { switches: {}, variables: {}, inventory: {} },
    });
    for (let i = 0; i < 40 && runtime.snapshot().phase !== "actorCommand"; i += 1) runtime.tick(1_000);
    const before = runtime.snapshot();
    const command = { kind: "skill" as const, skillId: LIGHTNING, targetEnemyId: before.enemies[0]!.id };
    runtime.performActorCommand(command);
    const after = runtime.snapshot();
    const hits = after.timeline.slice(before.timeline.length).filter((e) => e.kind === "damage" && (e.effectiveness ?? 1) > 1);

    const feedbacks: DamageFeedback[] = [];
    const lines: string[] = [];
    const queue: Array<() => void> = [];
    const sequencer = createBattleSequencer(runtime, {
      onDirectorState: (state) => lines.push(...state.lines),
      onSyncView: () => {},
      onDamageFeedback: (feedback) => { if (feedback) feedbacks.push(feedback); },
      onResultStage: () => {},
      onSequenceBusy: () => {},
      describeEffectiveness: true,
    }, (callback) => { queue.push(callback); return queue.length; }, () => {});
    sequencer.runAfterActorCommand(command, before, after);
    for (let i = 0; i < 200 && queue.length; i += 1) queue.shift()?.();
    sequencer.cancel();
    return { hits, feedbacks: feedbacks.filter((f) => !f.label && !f.healing && f.amount > 0), lines };
  }
  describe("battleStaging.effectivenessFeedback", () => {
    it("defaults to show and keeps today's behaviour when the field is absent", () => {
      expect(resolveBattleStaging(undefined).effectivenessFeedback).toBe("show");
      expect(normalizeBattleStaging({ effectivenessFeedback: "show" })).toBeUndefined();
      expect(normalizeBattleStaging({ effectivenessFeedback: "loud" })).toBeUndefined();
      const result = castLightning(thunderWeakPair(false));
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.feedbacks.some((f) => (f.effectiveness ?? 1) > 1)).toBe(true);
      expect(result.feedbacks.some((f) => f.weaknessDiscovered)).toBe(true);
      expect(result.lines.join(" ")).toContain("약점을 찔렀다!");
    });

    it("hide strips the damage tag data, the weakness-hit summary, and the sentence ending — the damage number stays", () => {
      const result = castLightning(thunderWeakPair(true));
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.feedbacks.length).toBeGreaterThan(0);
      for (const f of result.feedbacks) {
        expect(f.effectiveness).toBeUndefined();
        expect(f.weaknessDiscovered).toBeUndefined();
        expect(f.amount).toBeGreaterThan(0);
      }
      const text = result.lines.join(" ");
      expect(text).not.toContain("약점을 찔렀다!");
      expect(text).not.toContain("효과가 굉장했다!");
      expect(text).toMatch(/합계 \d+ 피해!/);
    });

    it("hide removes 「효과가 굉장했다!」 from single-hit sentences too", () => {
      const project = deserialize(JSON.stringify(strictFixture));
      const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: false, canLose: true, rng: () => 0.5 });
      const before = runtime.snapshot();
      const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0]!.id, hit: true, amount: 10, critical: false, effectiveness: 2 };
      store.replace(project);
      expect(enemyActionDirectorState(entry, before).lines.join(" ")).toContain("효과가 굉장했다!");
      const hidden = deserialize(JSON.stringify(strictFixture));
      hidden.system.battleStaging = { effectivenessFeedback: "hide" };
      store.replace(hidden);
      const line = enemyActionDirectorState(entry, before).lines.join(" ");
      expect(line).toContain("10 피해");
      expect(line).not.toContain("효과가");
    });

    it("the project schema keeps hide through save and load, and old saves load as show", () => {
      const project = deserialize(JSON.stringify(strictFixture));
      project.system.battleStaging = { effectivenessFeedback: "hide" };
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.battleStaging?.effectivenessFeedback).toBe("hide");
      expect(resolveBattleStaging(reloaded.system.battleStaging).effectivenessFeedback).toBe("hide");
      const old = deserialize(JSON.stringify(strictFixture));
      expect(old.system.battleStaging?.effectivenessFeedback).toBeUndefined();
      expect(resolveBattleStaging(old.system.battleStaging).effectivenessFeedback).toBe("show");
    });
  });
});

describe("battleGaugePrediction", () => {
  isolateTimers();
  describe("gauge director prediction follows the runtime scheduler", () => {
    it("announces a faster enemy even when both gauges are zero", () => {
      const project = deserialize(JSON.stringify(fixture));
      const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
      hero.parameterCurves.agility = Array(99).fill(1);
      hero.initialEquipment = {};
      const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime")!;
      enemy.stats.agility = 999;
      enemy.stats.attack = 1;
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", battleFlow: "gauge", canEscape: true, canLose: true, rng: () => 0.5 });
      const before = runtime.snapshot();
      expect(before.nextReadyBattlerId).toBe("enemy-1");
      // 충전 중 예고 문구는 포켓몬 스킨에서만 나온다 — 측면 도트 전투는 게이지 동안 말이 없다(#3063).
      const previous = store.getCurrent();
      const pokemon = deserialize(JSON.stringify(fixture));
      pokemon.system.battleUiStyle = "pokemon";
      store.replace(pokemon);
      try {
        expect(chargingDirectorState(before).lines[1]).toContain(enemy.name);
      } finally {
        store.replace(previous);
      }
      expect(chargingDirectorState(before).lines).toEqual([]);
      runtime.tick(10_000);
      // actionLog 항목에는 side 가 없다 — 누가 쳤는지는 userRecordId(와 timeline 의 side)로 본다.
      expect(runtime.snapshot().actionLog[0]?.userRecordId).toBe(enemy.id);
      expect(runtime.snapshot().timeline[0]?.side).toBe("enemy");
      runtime.cancel();
    });

    it("does not invent a next actor when an old snapshot has no prediction", () => {
      const project = deserialize(JSON.stringify(fixture));
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", battleFlow: "gauge", canEscape: true, canLose: true });
      const previous = store.getCurrent();
      const pokemon = deserialize(JSON.stringify(fixture));
      pokemon.system.battleUiStyle = "pokemon";
      store.replace(pokemon);
      try {
        expect(chargingDirectorState({ ...runtime.snapshot(), nextReadyBattlerId: undefined }).lines[1]).toBe("전황이 전개되고 있습니다.");
      } finally {
        store.replace(previous);
      }
      runtime.cancel();
    });
  });
});
