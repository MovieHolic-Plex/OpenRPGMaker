import { describe, expect, it } from "vitest";
import { ICE_GRAND_EXPANSE_BOSS_EVENT, ICE_GRAND_EXPANSE_GUARDS } from "@/project/defaults/iceGrandExpanseBoss";
import { ICE_GRAND_EXPANSE_FIELD_SPAWNS } from "@/project/defaults/iceGrandExpanseFieldSpawns";
import { ICE_GRAND_EXPANSE_BOSS, ICE_GRAND_EXPANSE_START } from "@/project/defaults/iceGrandExpansePlan";
import {
  assertIceGrandExpanseSummitAccess,
  ICE_GRAND_EXPANSE_GATE,
  ICE_GRAND_EXPANSE_SEALS,
  ICE_GRAND_EXPANSE_SEAL_SWITCHES,
  reachableIceGrandExpanseCells,
} from "@/project/defaults/iceGrandExpanseSeals";
import { hasSessionCheckpoint } from "@/player/checkpoints";
import { resolveEventPage } from "@/project/io";
import { startSession } from "@/project/session";
import {
  actionFaceReached,
  actionScenario,
  EXPEDITION_ORDERS,
  expectGameplayError,
  frozenPoints,
  fullyUnlockedScenario,
  gameplayFixture,
  loadIceExpanseVerifier,
  requiredEvent,
  sealScenario,
} from "./helpers/iceGrandExpanseGameplayFixture";

describe("ice grand expanse progression", () => {
  it("authors the progression gate at the approved crown barrier opening", () => {
    const { map } = gameplayFixture();
    const gate = requiredEvent(map, ICE_GRAND_EXPANSE_GATE.id);
    expect(ICE_GRAND_EXPANSE_GATE).toEqual({ id: "ev_ice_expanse_central_gate", x: 64, y: 47 });
    expect([gate.x, gate.y, gate.trigger.kind]).toEqual([64, 47, "action"]);
  });

  it("keeps both seals walk-reachable before the gate while the crown stays locked", () => {
    const { project, map } = gameplayFixture();
    const state00 = startSession(project);
    const reachable00 = reachableIceGrandExpanseCells(project, map, state00);
    expect(actionFaceReached(reachable00, map, ICE_GRAND_EXPANSE_SEALS[0])).toBe(true);
    expect(actionFaceReached(reachable00, map, ICE_GRAND_EXPANSE_SEALS[1])).toBe(true);
    expect(actionFaceReached(reachable00, map, ICE_GRAND_EXPANSE_BOSS)).toBe(false);

    const state10 = startSession(project);
    state10.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.west] = true;
    const reachable10 = reachableIceGrandExpanseCells(project, map, state10);
    expect(actionFaceReached(reachable10, map, ICE_GRAND_EXPANSE_SEALS[1])).toBe(true);
    expect(actionFaceReached(reachable10, map, ICE_GRAND_EXPANSE_BOSS)).toBe(false);

    const state01 = startSession(project);
    state01.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.east] = true;
    const reachable01 = reachableIceGrandExpanseCells(project, map, state01);
    expect(actionFaceReached(reachable01, map, ICE_GRAND_EXPANSE_SEALS[0])).toBe(true);
    expect(actionFaceReached(reachable01, map, ICE_GRAND_EXPANSE_BOSS)).toBe(false);

    const state11 = startSession(project);
    state11.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.west] = true;
    state11.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.east] = true;
    state11.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate] = true;
    const reachable11 = reachableIceGrandExpanseCells(project, map, state11);
    for (const point of frozenPoints()) expect(actionFaceReached(reachable11, map, point)).toBe(true);
  });

  it.each(EXPEDITION_ORDERS)("walks the complete %s expedition from 64,120 without setup movement", async (order) => {
    const verifier = await loadIceExpanseVerifier();
    const input = await verifier.iceGrandExpanseOrderInputs(order);
    expect(input.start).toEqual(ICE_GRAND_EXPANSE_START);
    expect(input.steps.some((step) => step.kind === "set")).toBe(false);
    for (const step of input.steps) if (step.kind === "move") {
      expect(step.dir, `${order} contains move.to`).toBeDefined();
      expect("to" in step, `${order} contains move.to`).toBe(false);
    }

    const proof = await verifier.runIceGrandExpanseOrder(order);
    expect(proof.result.ok, proof.result.failureReason).toBe(true);
    expect(proof.battleTroops).toEqual(["troop_slime_pair", ...ICE_GRAND_EXPANSE_GUARDS.map(() => "troop_golem_guard"), "troop_dragon"]);
    const fieldSpawn = ICE_GRAND_EXPANSE_FIELD_SPAWNS[0];
    if (fieldSpawn === undefined) throw new RangeError("missing field spawn");
    expect(proof.result.log.some((line) => line.startsWith(`field spawn __field_spawn__${fieldSpawn.id}_`) && line.endsWith(": victory"))).toBe(true);
    const requiredEvents = [
      ...input.milestones.checkpointIds, ...input.milestones.sealIds,
      ...input.milestones.shortcutIds, ...input.milestones.guardIds, input.milestones.bossEventId,
    ];
    for (const eventId of requiredEvents) expect(proof.result.log).toContain(`event ${eventId} start`);
    expect(hasSessionCheckpoint(proof.result.session)).toBe(true);
    expect(proof.result.session.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate]).toBe(true);
    for (const guard of ICE_GRAND_EXPANSE_GUARDS) expect(proof.result.session.switches[guard.clearSwitchId]).toBe(true);
    expect(proof.result.session.switches[ICE_GRAND_EXPANSE_BOSS_EVENT.clearSwitchId]).toBe(true);
  });

  it.each(EXPEDITION_ORDERS)("walks from 64,120 to the first %s seal without opening the crown", async (order) => {
    const verifier = await loadIceExpanseVerifier();
    const proof = await verifier.proveIceGrandExpanseGateClosed(order);
    expect(proof).toMatchObject({ code: "GATE_CLOSED", order });
    expect(proof.stepsRun).toBeGreaterThan(0);
  });

  it("reaches every frozen anchor under the real fully unlocked effective pages", () => {
    const { project, map } = gameplayFixture();
    const opened = fullyUnlockedScenario(project, map);
    expect(opened.ok, opened.failureReason).toBe(true);
    const reachable = reachableIceGrandExpanseCells(project, map, opened.session);
    for (const point of frozenPoints()) {
      const reached = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable.has((point.y + dy) * map.width + point.x + dx));
      expect(reached, `${point.x},${point.y}`).toBe(true);
    }
  });

  it("executes seals through scene interpreter and enforces 00/10/01/11 gate states", () => {
    const { project, map } = gameplayFixture();
    const gate = requiredEvent(map, ICE_GRAND_EXPANSE_GATE.id);
    const closedGate = actionScenario(project, map, gate);
    expect(closedGate.ok, closedGate.failureReason).toBe(true);
    expect(closedGate.session.m2Runtime?.ui.at(-1)?.message).toContain("0/2");
    expect(resolveEventPage(gate, closedGate.session)?.id).toBe(`${ICE_GRAND_EXPANSE_GATE.id}_closed_0`);
    const states = [
      { order: [] as const, open: false }, { order: ["west"] as const, open: false },
      { order: ["east"] as const, open: false }, { order: ["west", "east"] as const, open: true },
    ];
    for (const state of states) {
      const session = sealScenario(project, map, state.order);
      expect(session.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate] === true).toBe(state.open);
      if (state.open) expect(() => assertIceGrandExpanseSummitAccess(project, map, session)).not.toThrow();
      else expectGameplayError(() => assertIceGrandExpanseSummitAccess(project, map, session), "GATE_CLOSED");
    }
    const complete = sealScenario(project, map, ["east", "west"]);
    expect(complete.m2Runtime?.ui.at(-1)?.message).toBe("서리 인장 2/2");
    expect(complete.m2Runtime?.quests["ice-expanse-seals"]?.["activate-seals"]?.state).toBe("complete");
    const openedGate = fullyUnlockedScenario(project, map, gate);
    expect(openedGate.ok, openedGate.failureReason).toBe(true);
    expect(resolveEventPage(gate, openedGate.session)?.id).toBe(`${ICE_GRAND_EXPANSE_GATE.id}_open`);
  });
});
