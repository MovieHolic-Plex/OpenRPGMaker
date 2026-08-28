import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
