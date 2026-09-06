import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import type { Page } from "@playwright/test";
import { runRuntimeQa } from "../scripts/lib/runtimeQaRun.mjs";
import type { RuntimeQaExpect } from "../scripts/lib/runtimeQa.d.mts";
import type { AudioCommandState } from "@/project/session";
import { RuntimeDomOverlay, type RuntimeStateSnapshot } from "@/player/runtimeDom";
import { installPlaySceneTestHooks, type RuntimeDebugHook } from "@/player/playSceneTestHooks";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class TestHost extends FakeElement {
  constructor() {
    super("div");
  }
}

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

function hostElement(host: TestHost): HTMLElement {
  return host as unknown as HTMLElement;
}

function snapshot(): RuntimeStateSnapshot {
  return {
    mapId: "map_town",
    inputEnabled: true,
    running: false,
    player: { x: 1, y: 2 },
    switches: {},
    variables: {},
    timers: { timer1: 12 },
    timerActive: { timer1: true },
    flags: {},
    mapOverrides: {},
    gold: 10,
    inventory: {},
    partyActorIds: [],
    actorSkillIds: {},
    actorExperience: {},
    actorLevels: {},
    actorVitals: {},
    eventLocations: {},
    actorEquipment: {},
    actorRows: {},
    classOverrides: {},
    audio: {} as AudioCommandState,
    pictures: {},
    events: {},
    movers: {},
  };
}

describe("QA instrumentation boundary", () => {
  it("normal boot writes no hidden state mirrors but keeps the visible timer HUD", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => hostElement(host));
    const stringify = vi.spyOn(JSON, "stringify");

    for (let frame = 0; frame < 120; frame += 1) {
      overlay.syncRuntimeState(snapshot());
      overlay.syncAudioState({} as AudioCommandState);
    }

    expect(overlay.instrumented).toBe(false);
    expect(findByTestId(host, "runtime-state-json")).toBeNull();
    expect(findByTestId(host, "audio-state-json")).toBeNull();
    expect(stringify).not.toHaveBeenCalled();
    // Visible runtime UI must not regress to win the absence check.
    expect(findByTestId(host, "runtime-timer-hud")?.textContent).toContain("00:12");
    stringify.mockRestore();
  });

  it("QA boot retains both state mirrors", () => {
    const host = new TestHost();
    const overlay = new RuntimeDomOverlay(() => hostElement(host), { qaInstrumentation: true });

    overlay.syncRuntimeState(snapshot());
    overlay.syncAudioState({} as AudioCommandState);

    expect(overlay.instrumented).toBe(true);
    expect(findByTestId(host, "runtime-state-json")?.textContent).toContain("map_town");
    expect(findByTestId(host, "audio-state-json")).not.toBeNull();
    expect(findByTestId(host, "runtime-timer-hud")?.textContent).toContain("00:12");
  });

  it("reports only requested reward counts from the installed runtime hook", async () => {
    const previousWindow = globalThis.window;
    const testWindow = { location: { search: "" } } as Window & { __oprnDebug?: RuntimeDebugHook };
    const session = {
      currentMapId: "map_town", x: 0, y: 0, gold: 0,
      eventLocations: {}, selfSwitches: {}, switches: {}, variables: {}, timers: {},
      inventory: { item_capture_orb: 5, unrelated_item: 99 }, partyActorIds: [],
      monsterInstances: {
        party_leaf: { speciesId: "species_leafling" },
        box_leaf: { speciesId: "species_leafling" },
        unowned_leaf: { speciesId: "species_leafling" },
        box_other: { speciesId: "species_other" },
      },
      monsterParty: ["party_leaf"], monsterBox: ["box_leaf", "box_other", "missing_instance"],
    };
    const evidenceDir = ".omo/evidence/assistant-tool-reliability/runtime-harness";
    await mkdir(evidenceDir, { recursive: true });
    const outDir = await mkdtemp(`${evidenceDir}/unit-`);
    try {
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
      installPlaySceneTestHooks({ events: { once: vi.fn() } } as never, {} as never, () => session as never, () => {});
      const hook = testWindow.__oprnDebug!;
      const snapshot = hook.readState();
      expect(snapshot.monsterInstances).toEqual(session.monsterInstances);
      expect(snapshot.monsterParty).toEqual(session.monsterParty);
      expect(snapshot.monsterBox).toEqual(session.monsterBox);
      snapshot.monsterInstances.party_leaf.speciesId = "changed";
      snapshot.monsterParty.length = 0;
      snapshot.monsterBox.length = 0;
      snapshot.inventory.item_capture_orb = 0;
      expect(session.monsterInstances.party_leaf.speciesId).toBe("species_leafling");
      expect(session.monsterParty).toEqual(["party_leaf"]);
      expect(session.monsterBox).toHaveLength(3);
      expect(session.inventory.item_capture_orb).toBe(5);

      // Execute the harness's actual page callback; only browser transport/DOM are stubbed.
      const page = {
        on() {}, async setViewportSize() {}, async addInitScript() {}, async route() {},
        async goto() {}, async waitForSelector() {}, async screenshot() {},
        async evaluate(fn: (...args: unknown[]) => unknown, arg: unknown) {
          return runInNewContext(`(${fn.toString()})(arg)`, {
            arg, window: { __oprnDebug: testWindow.__oprnDebug },
            document: { querySelector: () => null, querySelectorAll: () => [] },
          });
        },
      } as unknown as Page;
      const run = (expectation: RuntimeQaExpect) => runRuntimeQa(page, {
        id: "reward-count-contract", beats: [{ id: "observed", expect: expectation }],
      }, { serverUrl: "http://runtime.invalid", outDir });
      const expected = {
        inventoryCounts: { item_capture_orb: 5, missing_item: 0 },
        ownedMonsterCounts: { species_leafling: 2, missing_species: 0 },
      };
      const report = await run(expected);
      expect(report.errors).toEqual([]);
      expect(report.beats[0].failures).toEqual([]);
      expect(report.beats[0].state).toEqual({
        currentMapId: "map_town", x: 0, y: 0, gold: 0, battleResult: null, ...expected,
      });
      expect(JSON.parse(await readFile(`${outDir}/manifest.json`, "utf8"))).toEqual(report);
      expect((await run({ inventoryCounts: { item_capture_orb: 6 }, ownedMonsterCounts: { species_leafling: 3 } })).beats[0].failures).toHaveLength(2);
      expect((await run({})).beats[0].state).toEqual({ currentMapId: "map_town", x: 0, y: 0, gold: 0, battleResult: null });

      const zero = { inventoryCounts: { item_capture_orb: 0 }, ownedMonsterCounts: { species_leafling: 0 } };
      for (const unavailable of [undefined, {}, { readState: () => null }, { readState: () => ({}) }]) {
        testWindow.__oprnDebug = unavailable as RuntimeDebugHook | undefined;
        expect((await run(zero)).beats[0].failures).toHaveLength(2);
      }
      testWindow.__oprnDebug = undefined;
      expect((await run({})).beats[0].failures).toEqual([]);
    } finally {
      await rm(outDir, { recursive: true, force: true });
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
    }
  });

  it("cross-map teleport loads the destination exactly once and same-map teleport never loads", () => {
    const previousWindow = globalThis.window;
    const testWindow = { location: { search: "" } } as Window & { __oprnDebug?: RuntimeDebugHook };
    const loads: string[] = [];
    const session = {
      currentMapId: "map_town",
      x: 0,
      y: 0,
      switches: {},
      variables: {},
      inventory: {},
      gold: 0,
      flags: {},
      timers: {},
    };
    const scene = {
      events: { once: vi.fn() },
      getMapId: () => session.currentMapId,
      loadMap: (mapId: string) => loads.push(mapId),
      tileX: 0,
      tileY: 0,
    };

    try {
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
      installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => session as never, () => {});

      testWindow.__oprnDebug?.teleport("map_forest", 3, 4);
      expect(loads).toEqual(["map_forest"]);
      expect([scene.tileX, scene.tileY]).toEqual([3, 4]);

      testWindow.__oprnDebug?.teleport("map_forest", 5, 6);
      expect(loads).toEqual(["map_forest"]);
      expect([scene.tileX, scene.tileY]).toEqual([5, 6]);
    } finally {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
    }
  });
});
