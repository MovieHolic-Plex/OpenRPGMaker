import { describe, expect, it } from "vitest";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { suspendedCorridorFixture } from "./fixtures/functionalAcceptance";

describe("functional walking preserves blocking interpreter ownership", () => {
  it("rejects the forced-shop corridor rather than overwriting its pending continuation with the outgoing transfer", () => {
    const f = suspendedCorridorFixture();
    const ledger = new AssistantAcceptanceLedger("corridor", "Round trip", f.project);
    ledger.adopt([{ id: "trip", title: "Trip", criteria: [{ kind: "mapRoundTrip", target: { mapId: f.origin.id },
      start: f.project.startPos, destination: { mapId: f.destination.id }, outgoing: { eventId: f.outgoing.id }, returning: { eventId: f.returning.id } }] }]);
    expect(ledger.evaluate(f.project).items[0].evidence[0].passed).toBe(false);
  });
  it("split and unsplit public walks both stop at the same suspended shop without executing the transfer", () => {
    const f = suspendedCorridorFixture();
    const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
    if (!tool) throw new Error("Missing scene tool");
    const results = [false, true].map(split => tool.run(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
      ...(split ? [{ kind: "walk", to: { x: 1, y: 2 } }] : []),
      { kind: "walk", to: { x: 1, y: 4 } },
      { kind: "expect", mapId: f.destination.id },
    ] }).data);
    for (const result of results) expect(result).toMatchObject({ ok: false, finalState: { mapId: f.origin.id, x: 1, y: 2, gold: 100, gameOver: false } });
  });
  it("cannot start another autorun over an already held shop interpreter", () => {
    const f = suspendedCorridorFixture();
    f.corridor.pages![0].trigger = { kind: "auto" };
    f.outgoing.pages![0].trigger = { kind: "auto" };
    f.origin.events = [f.corridor, f.outgoing];
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [] });
    expect(result).toMatchObject({ ok: false, finalState: { mapId: f.origin.id, gold: 100 } });
  });
  it("fails closed when transfer-triggered autorun suspension cannot preserve the outer continuation", () => {
    const f = suspendedCorridorFixture();
    f.origin.events = [f.outgoing];
    f.corridor.pages![0].trigger = { kind: "auto" };
    f.destination.events.push(f.corridor);
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
      { kind: "walk", to: { x: 1, y: 4 } }, { kind: "expect", interactionComplete: true },
    ] });
    expect(result).toMatchObject({ ok: false, finalState: { mapId: f.destination.id, gold: 100, gameOver: false } });
  });
  it("a real purchase resumes the held shop's game-over command rather than dropping it", () => {
    const f = suspendedCorridorFixture();
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
      { kind: "walk", to: { x: 1, y: 2 } },
      { kind: "expect", interactionComplete: false, gameOver: false },
      { kind: "purchase", eventId: f.corridor.id, itemId: "item_potion", count: 1, unitPrice: 10 },
      { kind: "expect", gameOver: true, goldDelta: -10, inventoryDelta: { item_potion: 1 } },
    ] });
    expect(result.ok).toBe(true);
    const commands = f.corridor.pages?.[0]?.commands;
    if (!commands) throw new Error("Missing corridor commands");
    const interpreter = createInterpreter([...commands], startSession(f.project, 1), f.project, { currentEventId: f.corridor.id });
    expect(interpreter.start().kind).toBe("shop");
    expect(interpreter.resume(false).kind).toBe("gameOver");
  });
});
