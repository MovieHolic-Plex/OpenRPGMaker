/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sceneHarness = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeScene {
    readonly loaderListeners = new Map<string, Listener[]>();
    readonly registryValues = new Map<string, unknown>();
    readonly textureKeys = new Set<string>();
    readonly load = {
      on: (event: string, listener: Listener): void => {
        const listeners = this.loaderListeners.get(event) ?? [];
        listeners.push(listener);
        this.loaderListeners.set(event, listeners);
      },
      image: vi.fn(),
      emit: (event: string, ...args: unknown[]): void => {
        for (const listener of this.loaderListeners.get(event) ?? []) listener(...args);
      },
    };
    readonly textures = {
      exists: (key: string): boolean => this.textureKeys.has(key),
      addCanvas: (key: string): object => {
        this.textureKeys.add(key);
        return {};
      },
    };
    readonly game = {
      registry: {
        get: (key: string): unknown => this.registryValues.get(key),
        set: (key: string, value: unknown): void => {
          this.registryValues.set(key, value);
        },
        events: { once: vi.fn() },
      },
      events: { emit: vi.fn() },
    };
    readonly cameras = {
      main: {
        setBackgroundColor: vi.fn(),
        startFollow: vi.fn(),
      },
    };
    readonly add = {
      container: vi.fn(() => ({ setDepth: vi.fn() })),
      sprite: vi.fn((_x: number, _y: number, key: string) => {
        if (!this.textureKeys.has(key)) throw new Error(`missing texture: ${key}`);
        return {
          setTexture: vi.fn(),
          setFrame: vi.fn(),
          setPosition: vi.fn(),
        };
      }),
    };
    readonly events = { once: vi.fn() };
  }

  return { FakeScene };
});

const project = vi.hoisted(() => ({
  system: {},
  startMapId: "map-start",
}));

const mapRuntime = vi.hoisted(() => ({
  loadMap: vi.fn((scene: { map?: unknown }) => {
    scene.map = { id: "map-start", width: 20, height: 15 };
  }),
  renderTiles: vi.fn(),
  activeRuntimeEvents: vi.fn(() => []),
  syncRuntimeState: vi.fn(),
  refreshRuntimeSurfaces: vi.fn(),
  refreshRuntimeEntities: vi.fn(),
  fireAutoTriggers: vi.fn(async () => undefined),
}));

vi.mock("@/app/phaserRuntime", () => ({
  getLoadedPhaser: () => ({ Scene: sceneHarness.FakeScene }),
}));
vi.mock("@/assets/bundled", () => ({
  loadBundledAssets: vi.fn(),
  registerBundledFrames: vi.fn(),
}));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => project } }));
vi.mock("@/project/playerFootprint", () => ({ resolvePlayerBody: () => ({ footprint: { width: 1, height: 1 } }) }));
vi.mock("@/project/playResolution", () => ({ resolvePlayResolution: () => ({ width: 320, height: 240 }) }));
vi.mock("@/project/session", () => ({ startSession: vi.fn() }));
vi.mock("@/player/input", () => ({ Input: class { setEnabled(): void {} } }));
vi.mock("@/player/runtimeDom", () => ({ RuntimeDomOverlay: class {} }));
vi.mock("@/player/audio", () => ({ resumeAudioState: vi.fn(), stopAllAudio: vi.fn() }));
vi.mock("@/player/mapBgm", () => ({ startMapBgm: vi.fn() }));
vi.mock("@/editor/tilesetImage", () => ({ ensureTilesetTexture: vi.fn() }));
vi.mock("@/player/playerSpriteResources", () => ({
  resolvePlayerSpriteResource: () => ({
    texture: "missing-texture",
    resourceId: "missing-resource",
    idleFrameFor: () => 0,
  }),
}));
vi.mock("@/player/playSceneMapRuntime", () => mapRuntime);
vi.mock("@/player/playSceneMapCommands", () => ({
  applyChangeTileStep: vi.fn(), flashCamera: vi.fn(), shakeCamera: vi.fn(), transferTo: vi.fn(),
}));
vi.mock("@/player/playSceneMovement", () => ({ resetEncounterCounter: vi.fn(), updatePlayScene: vi.fn() }));
vi.mock("@/player/characterDepth", () => ({
  characterSpriteY: () => 8,
  footprintSpriteX: () => 8,
  MAP_LOWER_LAYER_DEPTH: 0,
  MAP_UPPER_LAYER_DEPTH: 1,
  placeCharacterSprite: vi.fn(),
}));
vi.mock("@/player/playSceneInterpreter", () => ({ runEvent: vi.fn() }));
vi.mock("@/player/playSceneSchedulers", () => ({
  registerAutonomousMover: vi.fn(), updateParallelEvents: vi.fn(), updateTimers: vi.fn(),
}));
vi.mock("@/player/playScenePageMoveRoutes", () => ({ registerPageMoveRoutes: vi.fn() }));
vi.mock("@/player/playSceneAutonomous", () => ({ updateAutonomousNPCs: vi.fn() }));
vi.mock("@/player/playSceneOverlays", () => ({
  showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(), showGameOverScreen: vi.fn(),
  showEndingScreen: vi.fn(), returnToTitle: vi.fn(),
}));
vi.mock("@/player/playSceneTestHooks", () => ({ installPlaySceneTestHooks: vi.fn() }));
vi.mock("@/player/playSceneCamera", () => ({
  applyStoredCameraState: vi.fn(), centerRuntimeCamera: vi.fn(), panRuntimeCamera: vi.fn(),
}));
vi.mock("@/player/checkpoints", () => ({
  hasSessionCheckpoint: vi.fn(), restoreSessionCheckpoint: vi.fn(), setSessionCheckpoint: vi.fn(), getSessionCheckpoint: vi.fn(),
}));
vi.mock("@/player/playSceneFollowers", () => ({ syncFollowerSprites: vi.fn() }));
vi.mock("@/player/playSceneLighting", () => ({
  installLightingLayer: vi.fn(), syncLightingLayer: vi.fn(), updateLighting: vi.fn(),
}));
vi.mock("@/player/playSceneWeather", () => ({
  installWeatherLayer: vi.fn(), syncWeatherLayer: vi.fn(), updateWeather: vi.fn(),
}));
vi.mock("@/player/playSceneFieldSpawns", () => ({ updateFieldSpawnsForScene: vi.fn() }));
vi.mock("@/player/playSceneActionCombat", () => ({
  initializeActionCombatForScene: vi.fn(), updateActionCombatForScene: vi.fn(),
}));
vi.mock("@/player/playSceneTime", () => ({
  applyAdvanceTimeStep: vi.fn(), applySetTimeStep: vi.fn(), installTimeTintLayer: vi.fn(),
  isGameTimePausedForRuntime: vi.fn(), sleepUntilMorningScene: vi.fn(), updateGameTime: vi.fn(), updateTimeTint: vi.fn(),
}));
vi.mock("@/player/npcSchedules", () => ({ tickNpcSchedules: vi.fn(), updateNpcSchedules: vi.fn() }));
vi.mock("@/player/playSceneTileCulling", () => ({ syncTileCulling: vi.fn() }));
vi.mock("@/player/playSceneZoneFeedback", () => ({
  createPlaySceneZoneFeedback: () => ({}), destroyPlaySceneZoneFeedback: vi.fn(), syncPlaySceneZoneFeedback: vi.fn(),
}));
vi.mock("@/player/handSlotChip", () => ({ mountHandSlotChip: () => ({ update: vi.fn(), destroy: vi.fn() }) }));
vi.mock("@/player/playSceneDom", () => ({ dialogueHost: () => document.body }));
vi.mock("@/player/minimap", () => ({
  createMinimap: vi.fn(async () => null), destroyMinimap: vi.fn(), syncMinimapPosition: vi.fn(), syncMinimapVisibility: vi.fn(),
}));

import { PlayScene } from "@/player/PlayScene";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";
import {
  clearRecentPlayBootDiagnosticsForTest,
  listRecentPlayBootDiagnostics,
} from "@/player/playBootDiagnostics";

const initialSession = {
  switches: {}, variables: {}, timers: {}, currentMapId: "map-start", x: 2, y: 3,
  mapOverrides: {}, flags: {}, audio: {}, pictures: [],
};

const diagnostics = new LocalDiagnosticSession();
afterEach(() => { diagnostics.clear(); vi.restoreAllMocks(); });

beforeEach(() => {
  clearRecentPlayBootDiagnosticsForTest();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({ fillStyle: "", fillRect: vi.fn() }),
  });
});

describe("PlayScene asset load resilience", () => {
  it("replaces a failed texture and still reaches ready while recording the failure", () => {
    diagnostics.start(true, ["asset"]);
    const scene = new PlayScene() as PlayScene & InstanceType<typeof sceneHarness.FakeScene>;
    const stages: string[] = [];
    const onReady = vi.fn();
    scene.registryValues.set("initialSession", initialSession);
    scene.registryValues.set("dialogue", {});
    scene.registryValues.set("dialogueHost", document.body);
    scene.registryValues.set("onPlayLoadStage", (stage: string) => stages.push(stage));
    scene.registryValues.set("onPlaySceneReady", onReady);

    scene.preload();
    scene.load.emit("loaderror", { key: "missing-texture", url: "/assets/missing.png" });
    scene.create();

    expect(scene.failedAssets).toEqual([
      { key: "missing-texture", url: "/assets/missing.png" },
    ]);
    expect(scene.textureKeys.has("missing-texture")).toBe(true);
    expect(listRecentPlayBootDiagnostics()[0]).toMatchObject({
      stage: "assets",
      ok: false,
      detail: expect.stringContaining("missing-texture"),
    });
    expect(stages).toEqual(["map", "ready"]);
    expect(onReady).toHaveBeenCalledOnce();
    expect(scene.game.events.emit).toHaveBeenCalledWith("playscene-ready");
    expect(diagnostics.snapshot().receipts).toEqual([
      { category: "asset", phase: "assets", ok: false, sequence: 1,
        elapsedMs: expect.any(Number), provenance: "runtime", evidence: "observed", savedGeneration: null },
    ]);
  });

  it.each(["replacement", "initially-disabled", "stopped"] as const)(
    "does not publish a deferred loader failure into a %s diagnostic session", transition => {
      if (transition !== "initially-disabled") diagnostics.start(true, ["asset"]);
      const scene = new PlayScene() as PlayScene & InstanceType<typeof sceneHarness.FakeScene>;
      scene.preload();
      if (transition === "stopped") diagnostics.stop();
      else { diagnostics.clear(); diagnostics.start(true, ["asset"]); }

      scene.load.emit("loaderror", { key: "missing-texture", url: "/assets/missing.png" });

      expect(listRecentPlayBootDiagnostics()[0]).toMatchObject({ stage: "assets", ok: false });
      expect(scene.textureKeys.has("missing-texture")).toBe(true);
      expect(diagnostics.snapshot().receipts).toEqual([]);
    },
  );
});
