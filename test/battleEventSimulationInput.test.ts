import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/battle/simulate";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import type { Command } from "@/project/types";
import { ACTOR, TROOP, battleCase, choice } from "./battleEventRepairFlow.fixture";

for (const flow of ["gauge", "strict"] as const) describe(`battle simulation input / ${flow}`, () => {
  function projectWithBattle(commands: readonly Command[] = [choice()]) {
    const { project } = battleCase({ flow, commands, commandKind: "attack" });
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

  for (const variableId of [undefined, "key"]) {
    const commands: readonly Command[] = [
      { kind: "inputWait", variableId },
      { kind: "setVariable", variableId: "inputTail", op: "=", value: 1 },
      { kind: "gameOver" },
    ];
    it(`balance inputWait variable=${variableId} requires input instead of inventing a defeat`, () => {
      const project = projectWithBattle(commands);
      expect(() => simulateBattle({
        project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
        partyActorIds: [ACTOR], seed: 1, n: 1,
      })).toThrowError(expect.objectContaining({ code: "BATTLE_EVENT_INPUT_REQUIRED" }));
    });
    it(`scene inputWait variable=${variableId} cannot write battle/map tails`, () => {
      const project = projectWithBattle(commands);
      const result = runSceneTest(project, {
        mapId: project.startMapId, start: { x: 0, y: 0 },
        steps: [{ kind: "face", dir: "right" }, { kind: "interact" }],
      });
      expect(result.ok, "inputWait cannot silently complete a scene simulation").toBe(false);
      expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
      expect(result.session.battleResult).toBeUndefined();
      expect(result.session.variables.inputTail).toBeUndefined();
      expect(result.session.variables.mapTail).toBeUndefined();
    });
    it(`walkthrough inputWait variable=${variableId} cannot write battle/map tails`, () => {
      const result = runWalkthrough(projectWithBattle(commands), [{ do: "interact", eventId: "battle" }]);
      expect(result.ok, "inputWait cannot silently complete a walkthrough").toBe(false);
      expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
      expect(result.session.battleResult).toBeUndefined();
      expect(result.session.variables.inputTail).toBeUndefined();
      expect(result.session.variables.mapTail).toBeUndefined();
    });
  }

  it.each(["balance", "scene", "walkthrough"] as const)("%s explicitly bypasses wait/text presentation but never the following choice", runner => {
    const project = projectWithBattle([
      { kind: "wait", ms: 500 }, { kind: "text", body: "Presentation only" }, choice(),
    ]);
    if (runner === "balance") {
      expect(() => simulateBattle({
        project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
        partyActorIds: [ACTOR], seed: 1, n: 1,
      })).toThrowError(expect.objectContaining({ code: "BATTLE_EVENT_INPUT_REQUIRED" }));
      return;
    }
    const result = runner === "scene"
      ? runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 },
        steps: [{ kind: "face", dir: "right" }, { kind: "interact" }] })
      : runWalkthrough(project, [{ do: "interact", eventId: "battle" }]);
    expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
    expect(result.session.battleResult).toBeUndefined();
    expect(result.session.variables.mapTail).toBeUndefined();
  });

  it.each(["balance", "scene", "walkthrough"] as const)("%s completes presentation-only events without requiring invented user input", runner => {
    const project = projectWithBattle([
      { kind: "wait", ms: 500 }, { kind: "text", body: "Presentation only" },
      { kind: "setVariable", variableId: "presentedTail", op: "=", value: 37 },
      { kind: "gameOver" },
    ]);
    if (runner === "balance") {
      const result = simulateBattle({
        project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
        partyActorIds: [ACTOR], seed: 1, n: 1,
      });
      expect(result.samples).toBe(1);
      expect(result.winRate).toBe(0);
      expect(result.roundLogs.length).toBe(flow === "strict" ? 1 : 0);
      return;
    }
    const result = runner === "scene"
      ? runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 },
        steps: [{ kind: "face", dir: "right" }, { kind: "interact" }] })
      : runWalkthrough(project, [{ do: "interact", eventId: "battle" }]);
    expect(result.ok).toBe(true);
    expect(result.session.battleResult).toBe("defeat");
    expect(result.session.variables.presentedTail).toBe(37);
    expect(result.session.variables.mapTail).toBe(1);
  });
});
