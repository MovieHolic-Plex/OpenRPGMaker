import { describe, expect, it } from "vitest";
import { actorFightsAutomatically, chooseAutoBattleCommand } from "@/battle/battleAuto";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeActorRecord } from "@/project/actorModel";
import { deserialize, serialize } from "@/project/io";
import type { ActorAutoTactic, Project, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function skill(id: string, name: string, patch: Partial<SkillRecord>): SkillRecord {
  return {
    id, name, scope: "enemy", power: 30, description: "", type: "normal",
    mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    ...patch,
  } as SkillRecord;
}

/** 배우: 비싼 광역기(MP 10), 공짜 단일기(MP 0), 회복기(MP 5). HP 는 60% 로 시작. */
function tacticsProject(tactic?: ActorAutoTactic, autoBattle = true): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  project.database.skills.push(
    skill("skill_blast", "폭발", { power: 200, mpCost: { flat: 10, percentMax: 0 } }),
    skill("skill_jab", "잽", { power: 5 }),
    skill("skill_heal", "치유", { scope: "ally", power: 50, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: "healing", statistic: "mind", affects: "hp" } }),
  );
  // 직업이 주는 화염도 MP 를 쓰게 해 "MP 0 기술" 은 잽 하나만 남긴다.
  project.database.skills.find((record) => record.id === "skill_fire")!.mpCost = { flat: 4, percentMax: 0 };
  const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
  hero.learnedSkills = [{ level: 1, skillId: "skill_blast" }, { level: 1, skillId: "skill_jab" }, { level: 1, skillId: "skill_heal" }];
  hero.options = { ...hero.options, autoBattle, ...(tactic ? { autoTactic: tactic } : {}) };
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
  slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
  return project;
}

function heroMaxHp(project: Project): number {
  return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot().actors[0]!.maxHp;
}

function firstStrictCommand(tactic: ActorAutoTactic | undefined, hpRatio: number) {
  const project = tacticsProject(tactic);
  const maxHp = heroMaxHp(project);
  const runtime = createBattleRuntime({
    project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5,
    party: { vitals: { actor_hero: { hp: Math.floor(maxHp * hpRatio), mp: 999 } } },
  });
  // 자동 배우는 명령 메뉴 없이 첫 라운드가 해결된다.
  return runtime.snapshot().roundLogs[0]?.actions.find((action) => action.side === "actor");
}

describe("mg-l2-bflow #11 배우별 자동 전투 작전", () => {
  it("autoBattle 배우는 strict 에서 명령 메뉴를 열지 않고 첫 라운드를 스스로 해결한다", () => {
    const action = firstStrictCommand(undefined, 1);
    expect(action).toBeDefined();
  });

  it("수동 배우(autoBattle 꺼짐)와 followOrders 는 명령 메뉴를 연다", () => {
    for (const project of [tacticsProject(undefined, false), tacticsProject("followOrders")]) {
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      expect(runtime.snapshot().phase).toBe("actorCommand");
      expect(runtime.snapshot().roundLogs).toHaveLength(0);
    }
    expect(actorFightsAutomatically(tacticsProject("followOrders"), "actor_hero", undefined)).toBe(false);
    expect(actorFightsAutomatically(tacticsProject("attackAll"), "actor_hero", undefined)).toBe(true);
  });

  it("HP 60% 에서 회복 우선은 치유, 전원 공격·균형은 공격한다", () => {
    expect(firstStrictCommand("healFirst", 0.6)?.skillName).toBe("치유");
    expect(firstStrictCommand("attackAll", 0.6)?.skillName).toBe("폭발");
    expect(firstStrictCommand(undefined, 0.6)?.skillName).toBe("폭발");
  });

  it("MP 아끼기는 MP 를 쓰는 폭발 대신 공짜 잽을 쓰고, 위급(HP 20%)할 때만 회복한다", () => {
    expect(firstStrictCommand("conserveMp", 1)?.skillName).toBe("잽");
    expect(firstStrictCommand("conserveMp", 0.2)?.skillName).toBe("치유");
    expect(firstStrictCommand("conserveMp", 0.3)?.skillName).toBe("잽");
  });

  it("gauge 에서도 자동 배우는 차례가 오자마자 행동하고 게이지를 비운다", () => {
    const runtime = createBattleRuntime({ project: tacticsProject("attackAll"), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5 });
    for (let index = 0; index < 40 && !runtime.snapshot().timeline.some((entry) => entry.side === "actor" && entry.kind === "damage"); index += 1) {
      runtime.tick(250);
      expect(runtime.snapshot().phase).not.toBe("actorCommand");
    }
    const hit = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");
    expect(hit?.skillName).toBe("폭발");
  });

  it("chooseAutoBattleCommand 에 작전을 직접 넘길 수 있다(자동 버튼 경로)", () => {
    const project = tacticsProject(undefined, false);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    expect(chooseAutoBattleCommand(project, runtime.snapshot(), () => 0.5, "conserveMp")).toMatchObject({ kind: "skill", skillId: "skill_jab" });
  });

  it("autoTactic 은 정규화·저장을 지나고 알 수 없는 값은 버린다", () => {
    const project = tacticsProject("healFirst");
    expect(deserialize(serialize(project)).database.actors.find((record) => record.id === "actor_hero")?.options.autoTactic).toBe("healFirst");
    const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
    const junk = normalizeActorRecord({ ...hero, options: { ...hero.options, autoTactic: "panic" as ActorAutoTactic } });
    expect(junk.options.autoTactic).toBeUndefined();
  });
});
