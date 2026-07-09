import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

describe("battle runtime switch skills", () => {
  it("turns on the configured battle switch on hit and re-evaluates troop events after the action", () => {
    const project = battleProject();
    project.switches = [
      { id: "sw_0001", name: "스킬 스위치" },
      { id: "sw_0002", name: "후속 이벤트" },
    ];
    project.session.switches = { sw_0001: false, sw_0002: false };
    project.database.skills.push({
      ...project.database.skills[0],
      id: "skill_switch_test",
      name: "스위치 스킬",
      scope: "enemy",
      power: 0,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      variance: 0,
      hitRate: 100,
      effect: { kind: "switch", switchId: "sw_0001" },
      stateEffects: [],
    });
    project.database.actors[0].learnedSkills = [{ level: 1, skillId: "skill_switch_test" }];
    project.database.troops[0].battleEventPages = [
      {
        id: "battle_event_switch_skill",
        name: "Switch Skill Follow-up",
        conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
        span: "moment",
        commands: [{ kind: "setSwitch", switchId: "sw_0002", value: true }],
      },
    ];

    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0].id, canEscape: true, canLose: true });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_switch_test", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().eventState.switches.sw_0001).toBe(true);
    expect(runtime.snapshot().eventState.switches.sw_0002).toBe(true);
  });
});
