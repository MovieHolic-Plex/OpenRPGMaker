/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { playCommandBattle } from "@/player/commandBattle";
import { runEvent } from "@/player/playSceneInterpreter";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { foregroundOwner } from "@/player/foregroundControl";
import { PlayScene } from "@/player/PlayScene";
import { startSession } from "@/project/session";
import { fireAutoTriggers } from "@/player/playSceneMapRuntime";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { runFieldSpawnEventBattle } from "@/player/playSceneFieldSpawns";
import { createFieldSpawnRuntime } from "@/player/fieldSpawns";
import { bounded, encounterHarness, nextLeaseRelease, required } from "./fixtures/npcEncounterPipeline";

vi.mock("@/app/phaserRuntime", () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));
vi.mock("@/project/store", () => ({ store: { getCurrent: vi.fn() } }));
let fixture: ReturnType<typeof encounterHarness> | undefined;
afterEach(() => { fixture?.dispose(); fixture = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() {
  const f = fixture = encounterHarness("parallel");
  const step = required(f.page.commands[0]);
  if (step.kind !== "battleProcessing") throw new Error("Missing battle fixture");
  return { ...f, step };
}

describe("variable troop resolution", () => {
  it.each([undefined, "", "  ", "removed", 999999, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid value %s instead of the stale fixed troop", async value => {
    const f = setup();
    f.step.troopSource = "variable"; f.step.troopVariableId = "selectedTroop";
    // The session model is numeric; legacy string values arrive in old loaded sessions.
    Object.assign(f.scene.session.variables, { selectedTroop: value });
    f.battle.mockResolvedValue("victory");
    await expect(playCommandBattle(f.scene, f.step, () => true)).rejects.toMatchObject({ code: "BATTLE_VARIABLE_INVALID" });
    expect(f.battle).not.toHaveBeenCalled();
    expect(f.scene.session.battleResult).toBeUndefined();
  });
  it("rejects variable mode with no variable id even when the fixed troop is valid", async () => {
    const f = setup(); f.step.troopSource = "variable"; f.battle.mockResolvedValue("victory");
    await expect(playCommandBattle(f.scene, f.step, () => true)).rejects.toMatchObject({ code: "BATTLE_VARIABLE_INVALID" });
    expect(f.battle).not.toHaveBeenCalled();
  });
  it.each([0, 1, 1.9, "id"])("preserves legitimate compatibility for %s", async value => {
    const f = setup(); f.step.troopSource = "variable"; f.step.troopVariableId = "selectedTroop";
    Object.assign(f.scene.session.variables, { selectedTroop: value === "id" ? ` ${f.troopId} ` : value });
    f.battle.mockResolvedValue("victory");
    expect(await playCommandBattle(f.scene, f.step, () => true)).toBe("victory");
    expect(f.battle).toHaveBeenCalledWith(expect.objectContaining({ troopId: f.troopId }), expect.any(Function));
  });
});

describe("native event battle failure ownership", () => {
  it("defers autorun admission until Phaser emits create instead of treating boot as cancellation", async () => {
    const f = setup(); f.page.trigger = { kind: "auto" };
    f.step.troopSource = "variable"; f.step.troopVariableId = "selectedTroop";
    f.scene.session.variables.selectedTroop = 999999;
    let active = false;
    Object.defineProperty(f.scene, "sys", { value: { isActive: () => active } });
    const ready = Reflect.get(f.scene, "fireAutoTriggersWhenReady");
    if (typeof ready !== "function") throw new Error("Missing scene ready entry point");
    await ready.call(f.scene);
    await fireAutoTriggers(f.scene); // A boot-time surface refresh takes this independent path.
    expect(f.scene.autoStartedKeys.size).toBe(0);
    const show = vi.spyOn(f.scene, "showRuntimeOverlay");
    const failed = f.when(() => show.mock.calls.some(call => call[0] === "runtime-error") && !f.scene.running);
    active = true; f.scene.events.emit("create");
    await bounded(failed);
    expect(f.scene.inputEnabled).toBe(true);
    expect(f.scene.session.battleResult).toBeUndefined();
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
  });

  it("does not consume an autorun battle before the dialogue host is ready", async () => {
    const f = setup(); f.page.trigger = { kind: "auto" };
    let ready = false;
    const get = f.scene.game.registry.get.bind(f.scene.game.registry);
    vi.spyOn(f.scene.game.registry, "get").mockImplementation(key => key === "dialogue" && !ready ? undefined : get(key));
    await fireAutoTriggers(f.scene);
    expect(f.scene.autoStartedKeys.size).toBe(0);
    ready = true; f.battle.mockResolvedValue("victory");
    await fireAutoTriggers(f.scene);
    expect(f.battle).toHaveBeenCalledTimes(1);
    expect(f.scene.session.flags.encounterComplete).toBe(true);
  });

  it.each(["action", "auto", "parallel"] as const)("reports initialization failure and stops %s commands without an outcome", async trigger => {
    const f = setup(); f.page.trigger = { kind: trigger };
    f.step.troopId = "removed-troop";
    const host = document.createElement("div"); document.body.append(host);
    const get = f.scene.game.registry.get.bind(f.scene.game.registry);
    vi.spyOn(f.scene.game.registry, "get").mockImplementation(key => key === "dialogueHost" ? host : get(key));
    f.scene.playBattle = PlayScene.prototype.playBattle.bind(f.scene);
    const show = vi.spyOn(f.scene, "showRuntimeOverlay");
    const beforeAudio = structuredClone(f.scene.session.audio);
    const gameOver = vi.spyOn(f.scene, "showGameOverScreen");
    const completed = vi.fn();
    if (trigger === "parallel") {
      updateParallelEvents(f.scene, 0);
      const released = nextLeaseRelease(required(foregroundOwner(f.scene)));
      await bounded(released);
      updateParallelEvents(f.scene, 0);
      expect([...f.scene.parallelProcesses.values()][0]?.stopped).toBe(true);
    } else {
      await expect(bounded((trigger === "auto" ? fireAutoTriggers(f.scene) : runEvent(f.scene, f.event.id)).then(completed))).resolves.toBeUndefined();
    }
    expect(show).toHaveBeenCalledWith("runtime-error", expect.any(String));
    expect(show.mock.calls.find(call => call[0] === "runtime-error")?.[1].trim().length).toBeGreaterThan(0);
    expect(f.scene.session.audio).toEqual(beforeAudio);
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
    expect(foregroundOwner(f.scene)).toBeUndefined();
    expect(f.scene.battleAbortController).toBeUndefined();
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
    expect(f.scene.session.selfSwitches?.trainer?.A).not.toBe(true);
    expect(f.scene.session.battleResult).toBeUndefined();
    expect(gameOver).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="battle-scene"]')).toBeNull();
  });

  it.each(["random", "field"])("reports empty monster-party admission through the existing %s caller", async trigger => {
    const f = setup(); f.project.system.battleParty = "monsters"; f.scene.session.monsterParty = [];
    const host = document.createElement("div"); document.body.append(host);
    const get = f.scene.game.registry.get.bind(f.scene.game.registry);
    vi.spyOn(f.scene.game.registry, "get").mockImplementation(key => key === "dialogueHost" ? host : get(key));
    f.scene.playBattle = PlayScene.prototype.playBattle.bind(f.scene);
    const show = vi.spyOn(f.scene, "showRuntimeOverlay");
    if (trigger === "random") {
      f.map.encounterRate = 1000; f.map.troopIds = [f.troopId];
      resetEncounterCounter();
      const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
      maybeTriggerRandomEncounter(f.scene);
      await bounded(released);
    } else {
      f.map.fieldSpawns = [{ id: "spawn", troopId: f.troopId, area: { x: 0, y: 0, w: 2, h: 2 }, maxAlive: 1 }];
      f.scene.fieldSpawnState = createFieldSpawnRuntime(f.project, f.map, { x: 5, y: 5 });
      const instance = required(f.scene.fieldSpawnState.entries[0]?.alive[0]);
      await expect(bounded(runFieldSpawnEventBattle(f.scene, instance.eventId))).resolves.toBe(true);
    }
    expect(show).toHaveBeenCalledWith("runtime-error", expect.any(String));
    expect(f.scene.session.battleResult).toBeUndefined();
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
  });

  it("ignores a late rejection after cancellation without reporting into a new session", async () => {
    const f = setup();
    let rejectBattle: (error: Error) => void = () => { throw new Error("Missing reject"); };
    f.battle.mockImplementation(() => new Promise((_, reject) => { rejectBattle = reject; }));
    const pending = playCommandBattle(f.scene, f.step, () => true);
    f.scene.session = startSession(f.project);
    rejectBattle(new Error("cancelled-owner"));
    await expect(bounded(pending)).resolves.toBeNull();
    expect(f.scene.session.battleResult).toBeUndefined();
  });
});
