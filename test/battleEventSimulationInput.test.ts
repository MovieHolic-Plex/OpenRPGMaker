import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/battle/simulate";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import { ACTOR, TROOP, battleCase, choice } from "./battleEventRepairFlow.fixture";

for (const flow of ["gauge", "strict"] as const) describe(`battle simulation input / ${flow}`, () => {
  function projectWithBattle() {
    const { project } = battleCase({ flow, commands: [choice()], commandKind: "attack" });
    project.system.battleFlow = flow;
    project.system.startActorIds = [ACTOR]; project.session.partyActorIds = [ACTOR];
    for (const troop of project.database.troops) if (troop.id === TROOP) troop.battleFlow = flow;
    project.maps[project.startMapId].events.push({ id: "battle", name: "Battle", x: 1, y: 0, trigger: { kind: "action" }, commands: [], pages: [{
      id: "battle-page", name: "Battle", conditions: [], graphic: {}, priority: "same", trigger: { kind: "action" },
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "battleProcessing", troopId: TROOP, battleFlow: flow, canEscape: false, canLose: true },
        { kind: "setVariable", variableId: "mapTail", op: "=", value: 1 }],
    }] });
    return project;
  }
  it("balance simulation reports required input rather than an invented nonvictory", () => {
    const project = projectWithBattle(); let failure: unknown;
    try { simulateBattle({ project, troopId: TROOP, battleFlow: flow, heroLevel: 1, partyActorIds: [ACTOR], seed: 1, n: 1 }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "BATTLE_EVENT_INPUT_REQUIRED" });
  });
  it("scene simulation stops without executing map tails or writing a defeat", () => {
    const project = projectWithBattle();
    const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 }, steps: [
      { kind: "face", dir: "right" }, { kind: "interact" },
    ] });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
    expect(result.session.battleResult).toBeUndefined();
    expect(result.session.variables.mapTail).toBeUndefined();
  });
  it("walkthrough simulation stops without executing map tails or writing a defeat", () => {
    const result = runWalkthrough(projectWithBattle(), [{ do: "interact", eventId: "battle" }]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
    expect(result.session.battleResult).toBeUndefined();
    expect(result.session.variables.mapTail).toBeUndefined();
  });
});
