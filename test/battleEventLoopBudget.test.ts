/**
 * 배틀 이벤트 루프 상한은 루프 본문마다 따로 센다.
 *
 * 회귀: `BattleInvocation.loopIterations` 가 호출 하나당 하나여서,
 * 상한(10,000)을 소진한 루프 다음의 루프는 본문을 한 번만 돌고 끊겼다.
 * 맵 인터프리터(`test/interpreterNestedLoopBudget.test.ts`)와 같은 계약이다.
 */
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Command, Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function runPage(commands: readonly Command[]) {
  const project = deserialize(JSON.stringify(battleFixture)) as Project;
  project.variables.push(
    { id: "var_first", name: "첫째" },
    { id: "var_second", name: "둘째" },
  );
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime");
  troop.battleEventPages = [{
    id: "page_loop_budget",
    name: "loop budget",
    conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
    span: "battle",
    commands: [...commands],
  }];
  const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
  runtime.tick(1_000);
  runtime.performActorCommand({ kind: "defend" });
  return runtime;
}

describe("battle event loop budget", () => {
  it("앞 루프가 상한을 써도 다음 루프는 자기 상한까지 돈다", () => {
    const endless = (variableId: string): Command => ({
      kind: "loop",
      body: [{ kind: "setVariable", variableId, op: "+=", value: 1 }],
    });
    const runtime = runPage([
      endless("var_first"),
      endless("var_second"),
      { kind: "setSwitch", switchId: "sw_after_loops", value: true },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.variables.var_first).toBe(10_000);
    expect(snapshot.eventState.variables.var_second).toBe(10_000);
    expect(snapshot.eventState.switches.sw_after_loops).toBe(true);
    const limitLogs = snapshot.eventLogs.filter(
      (log) => log.kind === "unsupported" && log.detail === "loop iteration limit reached",
    );
    expect(limitLogs).toHaveLength(2);
  });
});
