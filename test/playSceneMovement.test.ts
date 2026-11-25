import { describe, expect, it, afterEach, vi } from "vitest";
import { maybeTriggerRandomEncounter, resetEncounterCounter, handleAction } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { reseedSessionRng, startSession } from "@/project/session";
import { Window } from "happy-dom";
import { RuntimeDomOverlay, buildLifeRuntimeSnapshot, type RuntimeActionReceipt } from "@/player/runtimeDom";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { lifeQaProject } from "./fixtures/life-full/qaObservability";
import { createBlankProject } from "@/project/defaults";
import { isolateTimers } from "./mergedTeardown";

describe("actionEncounterGuard", () => {
  isolateTimers();
  function makeMap(actionCombat: boolean): GameMap {
    return {
      id: actionCombat ? "map_action" : "map_normal",
      name: "t",
      encounterRate: 1000,
      troopIds: ["troop_a"],
      actionCombat,
    } as unknown as GameMap;
  }
  function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
    const scene = {
      running: false,
      inputEnabled: true,
      map,
      tileX: 0,
      tileY: 0,
      session: { partyActorIds: [], switches: {}, variables: {} },
      // playBattle 은 Promise<BattleResult> 계약이다(playSceneTypes.ts). void 를 돌려주는 페이크는
      // 인카운터 결과 소모(패배→게임 오버) 경로를 가린다.
      playBattle: async (cmd: { kind: string }) => {
        playBattleCalls.push(cmd.kind);
        return "escape" as const;
      },
      setInputEnabled: (enabled: boolean) => {
        scene.inputEnabled = enabled;
      },
    } as unknown as PlaySceneContext & { inputEnabled: boolean };
    return scene;
  }
  describe("랜덤 인카운트 액션 전투 가드", () => {
    it("액션 전투 맵에서는 walk 스텝이 playBattle 을 부르지 않는다", () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: true };
      const calls: string[] = [];
      const scene = makeScene(makeMap(true), calls);

      resetEncounterCounter();
      for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

      expect(calls).toEqual([]);
    });

    it("같은 설정의 비(非)액션 맵에서는 playBattle 이 호출된다", () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: true };
      const calls: string[] = [];
      const scene = makeScene(makeMap(false), calls);

      resetEncounterCounter();
      maybeTriggerRandomEncounter(scene);

      expect(calls).toEqual(["battleProcessing"]);
    });

    it("액션 맵에서 쌓인 누적값이 리셋되어 맵을 나가자마자 전투가 터지지 않는다", () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: true };
      const calls: string[] = [];
      const actionScene = makeScene(makeMap(true), calls);
      const normalScene = makeScene({ ...makeMap(false), encounterRate: 10 } as unknown as GameMap, calls);

      resetEncounterCounter();
      // rate 1000 이면 한 스텝마다 누적이 임계를 채우지만, 액션 맵에선 발동 대신 리셋된다.
      for (let i = 0; i < 10; i += 1) maybeTriggerRandomEncounter(actionScene);
      expect(calls).toEqual([]);

      // 낮은 encounterRate 맵으로 나가면 오래된 누적값이 남아 즉시 발동하면 안 된다.
      maybeTriggerRandomEncounter(normalScene);
      expect(calls).toEqual([]);
    });
  });
});

describe("encounterInBattleGuard", () => {
  isolateTimers();
  type BattleOutcome = "victory" | "defeat" | "escape";
  // encounterRate 1000 이면 첫 스텝의 누적값이 임계(1000)에 정확히 닿아 RNG 없이 발동한다.
  // 세션 RNG에 의존하지 않으므로 이 스위트는 시드와 무관하게 결정적이다.
  function makeEncounterMap(): GameMap {
    return {
      id: "map_field",
      name: "field",
      encounterRate: 1000,
      troopIds: ["troop_a"],
    } as unknown as GameMap;
  }
  interface FakeSceneHandle {
    readonly scene: PlaySceneContext;
    readonly battleCalls: string[];
    readonly inputCalls: boolean[];
    finishBattle(result: BattleOutcome): void;
    /** setInputEnabled(true) 로 입력이 복구될 때 resolve — 고정 대기 없이 정확한 상태 변화를 기다린다. */
    readonly inputRestored: Promise<void>;
  }
  function makeSceneInBattleProbe(map: GameMap): FakeSceneHandle {
    const battleCalls: string[] = [];
    const inputCalls: boolean[] = [];
    let settleBattle: ((result: BattleOutcome) => void) | undefined;
    let signalRestored: (() => void) | undefined;
    const inputRestored = new Promise<void>((resolve) => {
      signalRestored = resolve;
    });

    const scene = {
      running: false,
      inputEnabled: true,
      lastActionTargetKey: "",
      map,
      tileX: 3,
      tileY: 4,
      session: { partyActorIds: [], switches: {}, variables: {} },
      playBattle: (step: { kind: string }): Promise<BattleOutcome> => {
        battleCalls.push(step.kind);
        return new Promise<BattleOutcome>((resolve) => {
          settleBattle = resolve;
        });
      },
      setInputEnabled: (enabled: boolean): void => {
        inputCalls.push(enabled);
        scene.inputEnabled = enabled;
        if (enabled) signalRestored?.();
      },
      refreshRuntimeSurfaces: (): void => {},
    } as unknown as PlaySceneContext & { inputEnabled: boolean };

    return {
      scene,
      battleCalls,
      inputCalls,
      finishBattle: (result) => {
        if (!settleBattle) throw new Error("전투가 시작되지 않았다");
        settleBattle(result);
      },
      inputRestored,
    };
  }
  describe("전투 중 랜덤 인카운터 재진입 가드", () => {
    it("전투가 진행되는 동안 걸음이 더 발생해도 두 번째 인카운터가 터지지 않는다", () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: false };
      const probe = makeSceneInBattleProbe(makeEncounterMap());

      resetEncounterCounter();
      maybeTriggerRandomEncounter(probe.scene);
      for (let step = 0; step < 5; step += 1) maybeTriggerRandomEncounter(probe.scene);

      expect(probe.battleCalls).toEqual(["battleProcessing"]);
    });

    it("인카운터 전투가 시작되면 맵 로직과 입력이 잠긴다", () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: false };
      const probe = makeSceneInBattleProbe(makeEncounterMap());

      resetEncounterCounter();
      maybeTriggerRandomEncounter(probe.scene);

      expect(probe.scene.running).toBe(true);
      expect(probe.inputCalls).toEqual([false]);
    });

    it("전투가 끝나면 맵 입력과 인카운터가 정상 복구된다", async () => {
      const project = store.getCurrent();
      project.system.actionCombat = { enabled: false };
      const probe = makeSceneInBattleProbe(makeEncounterMap());

      resetEncounterCounter();
      maybeTriggerRandomEncounter(probe.scene);
      expect(probe.battleCalls).toHaveLength(1);

      probe.finishBattle("victory");
      await probe.inputRestored;

      expect(probe.scene.running).toBe(false);
      expect(probe.inputCalls).toEqual([false, true]);

      maybeTriggerRandomEncounter(probe.scene);
      expect(probe.battleCalls).toEqual(["battleProcessing", "battleProcessing"]);
    });
  });
});

// 도그푸딩 「등대지기의 겨울」: 얼어붙은 해안 동굴(인카운터 표 2개·조우율 25)에서 30걸음을 오갔는데
// 전투가 한 번도 나지 않았다고 보고됐다. 생성된 모양 그대로(조건 `{}` 인 표 항목, encounterRate 25)
// 런타임 조우 판정이 30걸음 안에 발동하는지 여러 시드로 못박는다. 당시 재현은 다른 맵으로
// __oprnDebug.teleport 한 뒤라 화면·입력이 옛 맵에 묶여 있었다(PR #1219 로 고침).
describe("generatedCaveEncounterFires", () => {
  isolateTimers();
  function caveLike(): GameMap {
    const project = store.getCurrent();
    const base = project.maps[project.startMapId]!;
    return {
      ...base,
      id: "map_ice_cave",
      encounterRate: 25,
      encounterTable: [
        { troopId: project.database.troops[0]!.id, weight: 50, conditions: {} },
        { troopId: project.database.troops[1]!.id, weight: 50, conditions: {} },
      ],
    } as GameMap;
  }
  function stepsUntilEncounter(seed: number, maxSteps: number): number | null {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: false };
    const session = startSession(project);
    reseedSessionRng(session, seed);
    const battles: string[] = [];
    const scene = {
      running: false,
      inputEnabled: true,
      map: caveLike(),
      tileX: 3,
      tileY: 3,
      session,
      playBattle: (step: { troopId: string }) => { battles.push(step.troopId); return new Promise(() => {}); },
      setInputEnabled: () => {},
      refreshRuntimeSurfaces: () => {},
    } as unknown as PlaySceneContext;
    resetEncounterCounter();
    for (let step = 1; step <= maxSteps; step += 1) {
      maybeTriggerRandomEncounter(scene);
      if (battles.length > 0) return step;
    }
    return null;
  }
  describe("generated cave encounter table", () => {
    it("fires within 30 steps for every seed", () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        const steps = stepsUntilEncounter(seed, 30);
        expect(steps, `seed ${seed}`).not.toBeNull();
      }
    });
  });
});

describe("lifeQaObservability", () => {
  isolateTimers();
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
});

describe("terrainEncounterScaling", () => {
  isolateTimers();
  function authorTerrain(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const tile = map.lowerTiles[project.startPos.y * map.width + project.startPos.x] ?? 0;
    if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
    while (tileset.terrain.length <= tile) tileset.terrain.push(0);
    tileset.terrain[tile] = tag;
    const meta = [...(tileset.tileMeta ?? [])];
    while (meta.length <= tile) meta.push({ label: "", description: "" });
    meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
    tileset.tileMeta = meta;
    return { mapId, x: project.startPos.x, y: project.startPos.y };
  }
  function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
    const scene = {
      running: false,
      inputEnabled: true,
      map,
      tileX: 0,
      tileY: 0,
      session: { partyActorIds: [], switches: {}, variables: {} },
      playBattle: async (cmd: { kind: string }) => {
        playBattleCalls.push(cmd.kind);
        return "escape" as const;
      },
      setInputEnabled: (enabled: boolean) => {
        scene.inputEnabled = enabled;
      },
    } as unknown as PlaySceneContext & { inputEnabled: boolean };
    return scene;
  }
  describe("terrain encounter scaling", () => {
    it("scales map encounter rate by terrain encounterRatePercent", () => {
      const project = createBlankProject();
      project.system.actionCombat = { enabled: false };
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("missing map");
      map.encounterRate = 1000;
      map.troopIds = ["troop_a"];
      map.encounterTable = undefined;
      const loc = authorTerrain(project, 2);
      project.database.terrains = [
        { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t2", name: "안전지대", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      ];
      store.replaceProject(project);
      const calls: string[] = [];
      const scene = makeScene(store.getCurrent().maps[loc.mapId] as GameMap, calls);
      scene.tileX = loc.x;
      scene.tileY = loc.y;

      resetEncounterCounter();
      for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

      expect(calls).toEqual([]);
    });
  });
});
