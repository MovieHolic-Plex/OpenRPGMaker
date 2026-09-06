import { afterEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { handleAction } from "@/player/playSceneMovement";
import { RuntimeDomOverlay, buildLifeRuntimeSnapshot, type RuntimeActionReceipt } from "@/player/runtimeDom";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { lifeQaProject } from "./fixtures/life-full/qaObservability";

const windows: Window[] = [];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const w of windows.splice(0)) w.close(); });

function fixture(instrumented = false) {
  const w = new Window(); windows.push(w);
  vi.stubGlobal("window", w); vi.stubGlobal("document", w.document);
  vi.stubGlobal("HTMLElement", w.HTMLElement); vi.stubGlobal("CustomEvent", w.CustomEvent);
  const project = lifeQaProject();
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  const session = startSession(project, 5);
  const host = document.createElement("div"); document.body.append(host);
  const runtimeDom = new RuntimeDomOverlay(() => host, { qaInstrumentation: instrumented });
  const scene: Parameters<typeof handleAction>[0] = {
    session, map: project.maps[project.startMapId]!, tileX: 2, tileY: 2,
    facing: "down", lastActionTargetKey: "", eventPositions: {}, autonomousNPCs: new Map(),
    eventSprites: new Map(), runEvent: async () => undefined, runtimeDom,
  };
  return { scene, project, session, host, runtimeDom };
}

function nextReceipt(host: HTMLElement): Promise<RuntimeActionReceipt> {
  return new Promise((resolve, reject) => {
    const onReceipt = (event: Event) => {
      clearTimeout(timeout); host.removeEventListener("oprn:action", onReceipt);
      if (event instanceof CustomEvent) resolve(event.detail);
      else reject(new Error("Not a receipt event"));
    };
    const timeout = setTimeout(() => {
      host.removeEventListener("oprn:action", onReceipt); reject(new Error("Missing action receipt"));
    }, 500);
    host.addEventListener("oprn:action", onReceipt);
  });
}

describe("life QA observability", () => {
  it("clones existing life owners without progressing makers or paying recovery", () => {
    const { session } = fixture();
    session.farmPlots = { map_blank_start: { "2,3": { tilled: true, watered: false, stage: 2 } } };
    session.makerInstances = { m: { instanceId: "m", makerId: "removed", status: "processing", readyAtMinute: 0 } };
    session.farmAnimals = { a: { instanceId: "a", name: "Cow", speciesId: "cow", buildingId: "barn", friendship: 4, productionProgress: 1, readyProductCount: 2 } };
    session.farmBuildingPlacements = { barn: { instanceId: "barn", typeId: "shed", level: 1, mapId: "map_blank_start", x: 4, y: 4, orientation: "down" } };
    session.lifeRecovery = { nextSequence: 2, claims: { "1": { id: "1", sourceKind: "maker", sourceId: "m", reason: "removed", items: [{ itemId: "qa-hoe", count: 3 }] } } };
    const before = structuredClone(session);
    const snapshot = buildLifeRuntimeSnapshot(session);
    for (const key of ["farmPlots", "energy", "makerInstances", "farmAnimals", "farmBuildingPlacements", "lifeRecovery"] as const) {
      expect(snapshot[key]).toEqual(before[key]);
    }
    expect(snapshot.farmPlots).not.toBe(session.farmPlots);
    expect(snapshot.lifeRecovery?.claims).not.toBe(session.lifeRecovery.claims);
    expect(snapshot.makerInstances?.m?.status).toBe("processing");
    expect(session).toEqual(before);
    expect(snapshot.farmPlots?.map_blank_start?.["2,3"]).not.toHaveProperty("regrowDaysRemaining");
    expect(snapshot.farmAnimals?.a).not.toHaveProperty("housingPlacementId");
  });
  it("does not materialize missing optional owners", () => {
    expect(buildLifeRuntimeSnapshot({})).toEqual({});
  });
  it("publishes a prearmed actual acceptance then a rejection without state mutation", async () => {
    const { scene, host, session, runtimeDom } = fixture(true);
    const accepted = nextReceipt(host);
    expect(handleAction(scene)).toBe(true);
    expect(await accepted).toMatchObject({ sequence: 1, kind: "action", handled: true, farmAttempts: [{ kind: "tilled", x: 2, y: 3, energySpent: 1 }] });
    scene.facing = "right";
    const before = structuredClone(session);
    const rejected = nextReceipt(host);
    expect(handleAction(scene)).toBe(false);
    expect(await rejected).toMatchObject({ sequence: 2, handled: false, farmAttempts: [{ kind: "ignored", reason: "insufficient-energy" }, { kind: "ignored", reason: "insufficient-energy" }] });
    expect(session).toEqual(before);
    expect(session).not.toHaveProperty("actionReceipt");
    expect(runtimeDom.actionReceipt?.sequence).toBe(2);
    expect(fixture(true).runtimeDom.actionReceipt).toBeUndefined();
  });
  it("off does not emit or retain an action receipt even after a real action", () => {
    const { scene, runtimeDom, host } = fixture();
    const observed = vi.fn(); host.addEventListener("oprn:action", observed);
    handleAction(scene);
    expect(runtimeDom.actionReceipt).toBeUndefined();
    expect(observed).not.toHaveBeenCalled();
    expect(host.querySelector("[data-testid=runtime-state-json]")).toBeNull();
    expect(Reflect.has(window, "__oprnDebug")).toBe(false);
  });
  it("the headless runner reports the same life owners, detached from its session", () => {
    const project = lifeQaProject();
    const result = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: [] });
    expect(result.ok).toBe(true);
    expect(result.finalState.energy).toBe(1);
    expect(result.finalState.farmPlots).toEqual(result.session.farmPlots);
    expect(result.finalState.farmPlots).not.toBe(result.session.farmPlots);
  });
});

describe("life QA baseline characterization", () => {
  it("real action spends one energy to till, then rejects without changing session", () => {
    const { scene, session } = fixture();
    expect(handleAction(scene)).toBe(true);
    expect(session.farmPlots?.[scene.map.id]?.["2,3"]).toMatchObject({ tilled: true });
    expect(session.energy).toBe(0);
    scene.facing = "right";
    const before = structuredClone(session);
    expect(handleAction(scene)).toBe(false);
    expect(session).toEqual(before);
  });
  it("an uninstrumented overlay starts without a mirror", () => {
    const { host, runtimeDom } = fixture();
    expect(runtimeDom.instrumented).toBe(false);
    expect(host.querySelector("[data-testid=runtime-state-json]")).toBeNull();
  });
});
