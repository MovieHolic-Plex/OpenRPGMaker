/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAction } from "@/player/playSceneMovement";
import { peekFarmFeedbackMessage } from "@/player/playSceneZoneFeedback";
import { renderEventLayer } from "@/player/playSceneMapRuntime";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { transitionToNextDay } from "@/player/dayTransition";
import { attemptFishingCatch } from "@/project/fishing";
import { advanceSeasonalForage, collectForageAt, resolveForageAt } from "@/project/seasonalForage";
import { ensureChest, placeableKey } from "@/project/placeables";
import { startSession } from "@/project/session";
import * as sessionModule from "@/project/session";
import { store } from "@/project/store";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { event, page, mockSprite, mockTileImage } from "./runtimeEventPageFixtures";

// Only the chest DOM endpoint is intercepted, after real coordinate lookup.
const openChest = vi.hoisted(() => vi.fn());
vi.mock("@/player/playSceneChest", async () => {
  const { findChestAt } = await import("@/project/placeables");
  return { tryChestInteraction: (scene: Parameters<typeof handleAction>[0], x: number, y: number) => {
    const chest = findChestAt(scene.session, scene.map.id, x, y);
    if (!chest) return false;
    openChest(chest.id);
    return true;
  } };
});
afterEach(() => vi.restoreAllMocks());

function fixture() {
  const project = p2LifeProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  map.events = [];
  const fishing = { enabled: true, energyCost: 3, spots: [{
    id: "pond", mapId: map.id, area: { x: 2, y: 3, w: 1, h: 1 },
    catches: [{ fishId: "fish_trout", weight: 1 }],
  }] };
  const forage = { enabled: true, areas: [{
    id: "meadow", mapId: map.id, area: { x: 2, y: 3, w: 1, h: 1 },
    dailySpawnCount: 1, maxActive: 1, despawnAfterDays: 2,
    entries: [{ id: "berry", itemId: "item_berry", weight: 1 }],
  }] };
  project.system.fishing = fishing;
  project.system.seasonalForage = forage;
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  const session = startSession(project, 410);
  session.x = 2; session.y = 2;
  const scene = {
    map, session, tileX: 2, tileY: 2, facing: "down" as const,
    lastActionTargetKey: "", eventPositions: {}, autonomousNPCs: new Map(), eventSprites: new Map(),
    runEvent: vi.fn(async () => undefined), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
  };
  return { project, map, session, scene, fishing, forage };
}
function spawn(f: ReturnType<typeof fixture>) {
  expect(transitionToNextDay(f.project, f.session, "1:spring:1")).toMatchObject({ ok: true });
  const target = Object.values(f.session.placeables ?? {}).find(p => p.forageSpawn);
  if (!target) throw new Error("Date transition failed to generate forage");
  return target;
}
function refuse(f: ReturnType<typeof fixture>) {
  const before = structuredClone(f.session);
  // true is the real action-combat dispatcher's no-swing condition.
  expect(handleAction(f.scene)).toBe(true);
  expect(f.session).toEqual(before);
  expect(f.scene.refreshRuntimeSurfaces).not.toHaveBeenCalled();
  expect(peekFarmFeedbackMessage(f.scene)).toBeTruthy();
}

describe("real confirmation life-field routing", () => {
  it("catches one fish without inventing a rod requirement and refreshes", () => {
    const f = fixture(), rng = structuredClone(f.session.rng);
    expect(handleAction(f.scene)).toBe(true);
    expect(f.session.inventory.item_trout).toBe(1);
    expect(f.session.energy).toBe(7);
    expect(f.session.collections?.item_trout?.caughtCount).toBe(1);
    expect(f.session.rng).not.toEqual(rng);
    expect(f.scene.refreshRuntimeSurfaces).toHaveBeenCalledOnce();
    expect(f.scene.syncRuntimeState).toHaveBeenCalledOnce();
  });
  it("picks date-generated forage before an overlapping fishing area", () => {
    const f = fixture(), target = spawn(f), rng = structuredClone(f.session.rng);
    expect(handleAction(f.scene)).toBe(true);
    expect(f.session.inventory.item_berry).toBe(1);
    expect(f.session.inventory.item_trout).toBeUndefined();
    expect(f.session.rng).toEqual(rng);
    expect(f.session.placeables?.[placeableKey(target.mapId, target.x, target.y)]).toBeUndefined();
    expect(f.scene.refreshRuntimeSurfaces).toHaveBeenCalledOnce();
  });
  it("keeps event then chest priority above forage/fishing", () => {
    const f = fixture(); spawn(f);
    ensureChest(f.session, { id: "storage", mapId: f.map.id, x: 2, y: 3 });
    f.map.events.push(event("dialogue", 2, 3, [page("p", "same", { kind: "action" })]));
    const before = structuredClone(f.session); openChest.mockClear();
    expect(handleAction(f.scene)).toBe(true);
    expect(f.scene.runEvent).toHaveBeenCalledWith("dialogue");
    expect(openChest).not.toHaveBeenCalled(); expect(f.session).toEqual(before);
    f.map.events = [];
    expect(handleAction(f.scene)).toBe(true);
    expect(openChest).toHaveBeenCalledWith("storage"); expect(f.session).toEqual(before);
  });
  it("finishes the front coordinate before checking a feet event", () => {
    const f = fixture(); f.map.events.push(event("feet", 2, 2, [page("p", "below", { kind: "action" })]));
    expect(handleAction(f.scene)).toBe(true);
    expect(f.session.inventory.item_trout).toBe(1); expect(f.scene.runEvent).not.toHaveBeenCalled();
  });
  it("falls back from non-target front to feet fish, but not from explicit refusal", () => {
    const f = fixture(); f.scene.tileY = 3;
    expect(handleAction(f.scene)).toBe(true); expect(f.session.inventory.item_trout).toBe(1);
    f.scene.tileY = 2; f.session.energy = 0;
    f.map.events.push(event("feet", 2, 2, [page("p", "below", { kind: "action" })]));
    f.scene.refreshRuntimeSurfaces.mockClear(); refuse(f);
    expect(f.scene.runEvent).not.toHaveBeenCalled();
  });
  it("explicit fish refusal cannot fall through to a mature underfoot crop", () => {
    const f = fixture(); f.session.energy = 0; delete f.project.system.energy;
    f.project.system.skillSystem = { enabled: false };
    f.project.database.fishSpecies = [];
    f.map.farmableArea = [{ x: 2, y: 2, w: 1, h: 1 }];
    f.project.database.crops = [{ id: "ready", name: "Ready", seedItemId: "item_reward", harvestItemId: "item_reward", harvestCount: 1, stages: [{ days: 1 }], seasons: ["spring"] }];
    f.session.farmPlots = { [f.map.id]: { "2,2": { tilled: true, watered: false, cropId: "ready", growthDays: 1, stage: 1 } } };
    refuse(f); expect(f.session.inventory.item_reward).toBeUndefined();
  });
  it("collects generated forage underfoot", () => {
    const f = fixture(); spawn(f); f.scene.tileY = 3;
    expect(handleAction(f.scene)).toBe(true); expect(f.session.inventory.item_berry).toBe(1);
  });
  it.each(["energy", "species", "inventory", "tool", "disabled"] as const)("consumes fish %s refusal without changing any owner/RNG", reason => {
    const f = fixture();
    if (reason === "energy") f.session.energy = 0;
    if (reason === "species") f.project.database.fishSpecies = [];
    if (reason === "inventory") f.session.inventory.item_trout = ITEM_QUANTITY_MAX;
    if (reason === "tool") f.project.system.toolActions = [{ id: "rod", action: "fish", itemId: "item_reward" }];
    if (reason === "disabled") f.fishing.enabled = false;
    refuse(f);
  });
  it("uses the shared authored itemId-first fish resolver in actual catch", () => {
    const f = fixture();
    f.project.system.toolActions = [{ id: "rod", action: "fish", itemId: "item_reward", farmTool: "axe" }];
    f.session.inventory.item_reward = 1; f.session.equippedToolItemId = "item_reward";
    expect(handleAction(f.scene)).toBe(true); expect(f.session.inventory.item_trout).toBe(1);
    f.project.system.toolActions = [{ id: "rod", action: "fish", itemId: "item_reward", requiresFarmable: true }];
    f.scene.refreshRuntimeSurfaces.mockClear(); refuse(f);
  });
  it("rejects authored out-of-map fish regions at the catch authority and consumes input", () => {
    const f = fixture(); f.scene.tileY = f.map.height - 1;
    f.fishing.spots[0].area.y = f.map.height;
    const before = structuredClone(f.session);
    expect(attemptFishingCatch(f.project, f.session, { mapId: f.map.id, x: 2, y: f.map.height })).toMatchObject({ ok: false, reason: "invalid-state" });
    expect(f.session).toEqual(before); refuse(f);
  });
  it.each(["expired", "season", "definition", "inventory", "disabled"] as const)("consumes forage %s refusal instead of fishing", reason => {
    const f = fixture(); spawn(f);
    if (reason === "expired") f.session.gameTime = { year: 1, season: "spring", day: 4, hour: 6, minute: 0 };
    if (reason === "season") f.session.gameTime = { year: 1, season: "summer", day: 1, hour: 6, minute: 0 };
    if (reason === "definition") f.forage.areas[0].entries = [];
    if (reason === "inventory") f.session.inventory.item_berry = ITEM_QUANTITY_MAX;
    if (reason === "disabled") f.forage.enabled = false;
    refuse(f);
  });
  it("rejects fractional and out-of-map forage without truncating into a valid reward", () => {
    const f = fixture(); spawn(f); const before = structuredClone(f.session);
    expect(collectForageAt(f.project, f.session, f.map.id, 2.5, 3).ok).toBe(false);
    f.map.height = 3;
    expect(collectForageAt(f.project, f.session, f.map.id, 2, 3).ok).toBe(false);
    expect(f.session).toEqual(before); refuse(f);
  });
  it("does not guess a fishing area from a water tile or change farm not-a-target behavior", () => {
    const f = fixture(); f.fishing.spots = []; f.map.lowerTiles[3 * f.map.width + 2] = -1;
    const before = structuredClone(f.session);
    expect(handleAction(f.scene)).toBe(false); expect(f.session).toEqual(before);
  });
});

describe("runner parity", () => {
  it.each(["fishing", "forage", "chest", "farm"] as const)("does not certify an explicit feet event when front %s owns input", owner => {
    const f = fixture();
    f.map.events.push(event("feet", 2, 2, [page("p", "below", { kind: "action" })]));
    if (owner === "farm") {
      f.fishing.spots = [];
      f.map.farmableArea = [{ x: 2, y: 3, w: 1, h: 1 }];
      f.project.database.crops = [{ id: "ready", name: "Ready", seedItemId: "item_reward", harvestItemId: "item_reward", harvestCount: 1, stages: [{ days: 1 }], seasons: ["spring"] }];
    }
    const createSession = sessionModule.startSession;
    vi.spyOn(sessionModule, "startSession").mockImplementationOnce((project, seed) => {
      const session = createSession(project, seed);
      if (owner === "forage") expect(advanceSeasonalForage(project, session, session.gameTime!)).toMatchObject({ ok: true, spawned: 1 });
      if (owner === "chest") ensureChest(session, { id: "storage", mapId: f.map.id, x: 2, y: 3 });
      if (owner === "farm") session.farmPlots = { [f.map.id]: { "2,3": { tilled: true, watered: false, cropId: "ready", growthDays: 1, stage: 1 } } };
      return session;
    });
    const result = runSceneTest(f.project, { mapId: f.map.id, start: { x: 2, y: 2 }, steps: [{ kind: "interact", eventId: "feet" }] });
    expect(result.ok).toBe(false);
    expect(result.failedStepIndex).toBe(0);
  });

  it("shares fish tool refusal and honors chest priority without awarding a fish", () => {
    const f = fixture(); f.project.system.toolActions = [{ id: "rod", action: "fish", itemId: "item_reward" }];
    const refused = runSceneTest(f.project, { mapId: f.map.id, start: { x: 2, y: 2 }, steps: [{ kind: "interact" }] });
    expect(refused.ok, refused.failureReason).toBe(true); expect(refused.session.inventory.item_trout).toBeUndefined();
    expect(refused.session.energy).toBe(10);
    f.project.system.toolActions = [];
    // Chests are runtime owners, not supported authored start-state fields.
    const createSession = sessionModule.startSession;
    vi.spyOn(sessionModule, "startSession").mockImplementationOnce((project, seed) => {
      const session = createSession(project, seed);
      ensureChest(session, { id: "storage", mapId: f.map.id, x: 2, y: 3 });
      return session;
    });
    const chest = runSceneTest(f.project, { mapId: f.map.id, start: { x: 2, y: 2 }, steps: [{ kind: "interact" }] });
    expect(chest.ok, chest.failureReason).toBe(true); expect(chest.session.inventory.item_trout).toBeUndefined();
  });
  it("runs fish acceptance and consumes a repeated energy refusal", () => {
    const f = fixture(); f.project.system.energy = { max: 3, initial: 3, restorePerDay: 0 };
    const result = runSceneTest(f.project, { mapId: f.map.id, start: { x: 2, y: 2 }, steps: [{ kind: "interact" }, { kind: "interact" }] });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.inventory.item_trout).toBe(1); expect(result.session.energy).toBe(0);
  });
  it("generates forage through advanceDays and collects through interact", () => {
    const f = fixture();
    const result = runSceneTest(f.project, { mapId: f.map.id, start: { x: 2, y: 2 }, steps: [{ kind: "advanceDays", days: 1 }, { kind: "interact" }] });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.inventory.item_berry).toBe(1); expect(result.session.inventory.item_trout).toBeUndefined();
  });
});

describe("generated forage rendering", () => {
  it("retains the forage warning through real event-only refresh and clears it after repair", () => {
    const f = fixture(); spawn(f); const entries = f.forage.areas[0].entries;
    f.forage.areas[0].entries = [];
    const warning = vi.fn();
    const scene = { ...f.scene, eventSprites: new Map<string, ReturnType<typeof mockSprite>>(),
      add: { sprite: mockSprite, image: mockTileImage }, tileLayer: { add: vi.fn(), removeAll: vi.fn() }, missingResources: new Set<string>(),
      runtimeDom: { clearEventMarkers: vi.fn(), upsertEventMarker: vi.fn(), syncMissingResourceError: warning },
    };
    renderPlaceableOverlays(scene); renderEventLayer(scene);
    expect(scene.missingResources).toEqual(new Set(["forage:meadow/berry"]));
    expect(warning).toHaveBeenLastCalledWith(scene.missingResources);
    f.forage.areas[0].entries = entries; renderEventLayer(scene);
    expect(scene.missingResources.size).toBe(0);
  });
  it("draws a visible bundled fallback, removes it on pickup, and never mutates on render", () => {
    const f = fixture(); spawn(f);
    const sprite = vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn() }));
    const scene = { ...f.scene, add: { sprite }, tileLayer: { add: vi.fn() }, missingResources: new Set<string>() };
    const before = structuredClone(f.session);
    renderPlaceableOverlays(scene);
    expect(sprite).toHaveBeenCalledOnce(); expect(f.session).toEqual(before);
    handleAction(f.scene); sprite.mockClear(); renderPlaceableOverlays(scene);
    expect(sprite).not.toHaveBeenCalled();
  });
  it("warns on missing definitions with a fallback but hides expired forage", () => {
    const f = fixture(); spawn(f);
    const sprite = vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn() }));
    const scene = { ...f.scene, add: { sprite }, tileLayer: { add: vi.fn() }, missingResources: new Set<string>() };
    f.forage.areas[0].entries = [];
    renderPlaceableOverlays(scene); expect(sprite).toHaveBeenCalledOnce(); expect(scene.missingResources.size).toBe(1);
    f.forage.areas[0].entries = [{ id: "berry", itemId: "item_berry", weight: 1 }];
    f.session.gameTime = { year: 1, season: "spring", day: 4, hour: 6, minute: 0 };
    sprite.mockClear(); renderPlaceableOverlays(scene); expect(sprite).not.toHaveBeenCalled();
  });
});


describe.each([1, Number.MAX_SAFE_INTEGER])("forage accepted calendar year %s", year => {
  it.each([
    { spawnedDay: 1, liveDay: 1, lifetime: 1, expired: false },
    { spawnedDay: 1, liveDay: 2, lifetime: 1, expired: true },
    { spawnedDay: 1, liveDay: 3, lifetime: 1, expired: true },
    { spawnedDay: 1, liveDay: 2, lifetime: 2, expired: false },
    { spawnedDay: 1, liveDay: 3, lifetime: 2, expired: true },
    { spawnedDay: 3, liveDay: 1, lifetime: 2, expired: true },
  ])("checks spawn $spawnedDay -> live $liveDay, lifetime $lifetime without rounded ages", ({ spawnedDay, liveDay, lifetime, expired }) => {
    const f = fixture(); f.forage.areas[0].despawnAfterDays = lifetime;
    f.session.gameTime = { year, season: "spring", day: spawnedDay, hour: 6, minute: 0 };
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toMatchObject({ ok: true, spawned: 1 });
    f.session.gameTime = { ...f.session.gameTime, day: liveDay };
    const before = structuredClone(f.session), owners = f.session.placeables, rng = f.session.rng;
    const expected = expired ? { ok: false, reason: "expired" } : { ok: true, itemId: "item_berry" };
    expect(resolveForageAt(f.project, f.session, f.map.id, 2, 3)).toEqual(expected);
    expect(f.session).toEqual(before);
    const direct = structuredClone(f.session);
    expect(collectForageAt(f.project, direct, f.map.id, 2, 3)).toEqual(expected);
    if (expired) {
      expect(direct).toEqual(before);
      refuse(f);
      expect(f.session.placeables).toBe(owners); expect(f.session.rng).toBe(rng);
      const sprite = vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn() }));
      renderPlaceableOverlays({ ...f.scene, add: { sprite }, tileLayer: { add: vi.fn() } });
      expect(sprite).not.toHaveBeenCalled(); expect(f.session).toEqual(before);
    } else {
      expect(handleAction(f.scene)).toBe(true);
      expect(f.session).toEqual(direct);
      expect(f.session.inventory.item_berry).toBe(1);
      expect(f.session.placeables?.[placeableKey(f.map.id, 2, 3)]).toBeUndefined();
      expect(f.session.rng).toEqual(before.rng);
    }
  });

  it("advances adjacent days, expires owners and refuses duplicate/backward cursors atomically", () => {
    const f = fixture(); f.forage.areas[0].despawnAfterDays = 1;
    f.session.gameTime = { year, season: "spring", day: 1, hour: 6, minute: 0 };
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toMatchObject({ ok: true, spawned: 1 });
    f.forage.areas[0].dailySpawnCount = 0;
    f.session.gameTime = { ...f.session.gameTime, day: 2 };
    const rng = structuredClone(f.session.rng);
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toMatchObject({ ok: true, removed: 1, spawned: 0 });
    expect(f.session.placeables).toEqual({}); expect(f.session.rng).toEqual(rng);
    const before = structuredClone(f.session);
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toEqual({ ok: false, reason: "already-advanced" });
    expect(advanceSeasonalForage(f.project, f.session, { ...f.session.gameTime, day: 1 })).toEqual({ ok: false, reason: "stale-day" });
    expect(f.session).toEqual(before);
    f.session.forageLastAdvancedDayKey = "invalid";
    const invalid = structuredClone(f.session);
    expect(advanceSeasonalForage(f.project, f.session, { ...f.session.gameTime, day: 3 })).toEqual({ ok: false, reason: "stale-day" });
    expect(f.session).toEqual(invalid);
  });

  it("keeps exact three-day spawn cadence on the absolute calendar", () => {
    const f = fixture(); const area = f.forage.areas[0];
    f.project.system.seasonalForage = { ...f.forage, areas: [{ ...area, spawnEveryDays: 3, despawnAfterDays: 1 }] };
    const spawned: number[] = [], rng = structuredClone(f.session.rng);
    for (let day = 1; day <= 7; day++) {
      const date = { year, season: "spring" as const, day, hour: 6, minute: 0 };
      const result = advanceSeasonalForage(f.project, f.session, date);
      expect(result.ok).toBe(true);
      if (result.ok && result.spawned) spawned.push(day);
    }
    // Both tested years have (year - 1) divisible by 3; no unsafe arithmetic in the oracle.
    expect(spawned).toEqual([1, 4, 7]); expect(f.session.rng).toEqual(rng);
  });
});

describe("forage extreme year boundaries", () => {
  it.each([28, 99])("orders year/season transitions with %s days per season", daysPerSeason => {
    const f = fixture(); const year = Number.MAX_SAFE_INTEGER;
    f.project.system.timeSystem = { enabled: true, daysPerSeason };
    f.session.gameTime = { year: year - 1, season: "winter", day: daysPerSeason, hour: 6, minute: 0 };
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toMatchObject({ ok: true, spawned: 1 });
    f.session.gameTime = { year, season: "spring", day: 1, hour: 6, minute: 0 };
    expect(advanceSeasonalForage(f.project, f.session, f.session.gameTime)).toMatchObject({ ok: true, removed: 1, spawned: 1 });
    const before = structuredClone(f.session);
    expect(advanceSeasonalForage(f.project, f.session, { ...f.session.gameTime, year: year - 1, season: "winter", day: daysPerSeason })).toEqual({ ok: false, reason: "stale-day" });
    expect(f.session).toEqual(before);
  });
});
