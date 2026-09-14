import { clearTimeout, setTimeout } from "node:timers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankMap, createBlankProject, ensureBundledTilesets, repairInteriorTransparentPropLayers } from "@/project/defaults";
import { ensureInteriorRoomHarness, INTERIOR_ROOM_TILESET_ID, interiorRoomTileGroups, seedDefaultInteriorCatalog } from "@/editor/interiorRoomPipeline";
import { interiorFurnitureKits, interiorObjectFromKit } from "@/editor/interiorRoomVocab";
import { runRoomPipeline } from "@/editor/roomHarness/engine";
import { deserialize, serialize, serializeForComparison } from "@/project/io";
import { sha256HexText } from "@/util/sha256";
import type { Project, SectionStructureKitDef, TilesetDef } from "@/project/types";

// Complete frozen catalog output, not a learnedFrom-only approximation.
function legacyCabinet(): SectionStructureKitDef {
  return { id: "cabinet", kind: "section", name: "캐비닛", width: 1, height: 2,
    rows: [{ tiles: [148] }, { tiles: [178] }], learnedFrom: "interior-catalog",
    ai: { description: "", placementRules: "", snap: "wall-north", themes: ["bedroom", "dining"] } };
}

function cabinetProject(floorTile = 72): Project {
  const project = createBlankProject();
  // The editor loads bundled runtime contracts before room authoring starts.
  ensureBundledTilesets(project);
  runRoomPipeline(project, "villager-room-v1", {
    mapId: "map_cabinet", name: "Cabinet contract", width: 16, height: 14, seed: 17, floorTile,
    rooms: [{ id: "room", x: 2, y: 5, w: 12, h: 6, theme: "storage" }],
    door: { x: 8, y: 10 }, theme: "storage",
    concept: { facilityLabel: "Cabinet contract", rooms: { room: {
      placeId: "room", placeLabel: "Room", role: "room", things: [
        { thingId: "cabinet", objectId: "cabinet", label: "Cabinet", count: 1, required: true, chips: [] },
      ],
    } } },
  });
  return project;
}

function interior(project: Project): TilesetDef { return project.tilesets[INTERIOR_ROOM_TILESET_ID]!; }

describe("interior authoring/load fixed point", () => {
  it("shares all 39 group records across authoring and load without runtime reseeding by supplemental groups", () => {
    const project = createBlankProject();
    ensureBundledTilesets(project);
    ensureInteriorRoomHarness(project);
    const before = structuredClone(interior(project));
    expect(before.tileGroups).toHaveLength(39);
    ensureBundledTilesets(project);
    expect(interior(project).tileGroups).toEqual(before.tileGroups);
    expect(interior(project).priority).toEqual(before.priority);
    expect(interior(project).passability).toEqual(before.passability);
    ensureInteriorRoomHarness(project);
    expect(interior(project).tileGroups).toEqual(before.tileGroups);
  });

  it.each(["user-source", "user-origin", "ambiguous-bundled"])("preserves exact IDs and complete %s group records", kind => {
    const project = createBlankProject();
    const group = interiorRoomTileGroups().find(g => g.id.endsWith("bed-horizontal"))!;
    group.tileIds = [148, 178];
    group.rules = [{ id: "own", kind: "adjacency", strength: "hard", params: { a: 148, b: 178, relation: "aAboveB" }, message: "" }];
    group.patternGrammar!.parts = [{ role: "leftCap", tileIds: [148] }, { role: "rightCap", tileIds: [178] }];
    group.layerHome = "lower";
    if (kind === "user-source") group.source = "user";
    if (kind === "user-origin") group.origin = "user";
    interior(project).tileGroups = [structuredClone(group)];
    ensureInteriorRoomHarness(project);
    ensureBundledTilesets(project);
    const fresh = deserialize(serialize(project));
    ensureBundledTilesets(fresh);
    ensureInteriorRoomHarness(fresh);
    expect(interior(fresh).tileGroups?.find(g => g.id === group.id)).toEqual(group);
    expect(interior(fresh).tileGroups?.filter(g => g.id === group.id)).toHaveLength(1);
  });

  it.each([72, 102])("constructs an upper cabinet retaining floor %s before any load repair", floor => {
    const project = cabinetProject(floor);
    const map = project.maps.map_cabinet!;
    const top = map.upperTiles.indexOf(148);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(map.upperTiles[top + map.width]).toBe(178);
    expect(map.lowerTiles[top]).toBe(floor);
    expect(map.lowerTiles[top + map.width]).toBe(floor);
    const before = serializeForComparison(project);
    const fresh = deserialize(serialize(project));
    ensureBundledTilesets(fresh);
    repairInteriorTransparentPropLayers(fresh);
    expect(serializeForComparison(fresh)).toBe(before);
  });

  it("repairs the complete untouched legacy kit before it can regain writer precedence", () => {
    const project = createBlankProject();
    interior(project).structureKits = [legacyCabinet()];
    ensureBundledTilesets(project);
    expect(interiorObjectFromKit(interiorFurnitureKits(interior(project))[0]!).cells.every(cell => cell.layer === "upper")).toBe(true);
    seedDefaultInteriorCatalog(interior(project));
    const kit = interiorFurnitureKits(interior(project))[0]!;
    expect(interiorObjectFromKit(kit).cells).toEqual([
      { dx: 0, dy: 0, layer: "upper", tile: 148 }, { dx: 0, dy: 1, layer: "upper", tile: 178 },
    ]);
    const saved = serializeForComparison(project);
    ensureBundledTilesets(project);
    seedDefaultInteriorCatalog(interior(project));
    expect(serializeForComparison(project)).toBe(saved);
  });

  it.each(["edited-ai", "edited-row", "custom-id", "authored", "kit-origin", "kit-layer", "parts", "graft", "source", "origin", "locked", "userLocked", "lower", "priority", "group-layer"])("leaves ambiguous/custom legacy kit and lower cells intact: %s", kind => {
    const project = createBlankProject();
    const ts = interior(project);
    const kit = legacyCabinet();
    if (kind === "edited-ai") kit.ai!.description = "My cabinet";
    if (kind === "edited-row") kit.rows[0]!.tiles[0] = 149;
    if (kind === "custom-id") kit.id = "my-cabinet";
    if (kind === "authored") kit.learnedFrom = "db-authored";
    if (kind === "kit-origin") kit.ai!.origin = "user";
    if (kind === "kit-layer") kit.ai!.layerHome = "lower";
    if (kind === "parts") kit.parts = [{ id: "own", kind: "anchor", dx: 0, dy: 0, w: 1, h: 1 }];
    if (kind === "graft") ts.tileGrafts = [{ targetTile: 148, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 1 }];
    if (kind === "source") ts.tileMeta![148] = { ...ts.tileMeta![148]!, source: "user", defaultLayer: "lower" };
    if (kind === "origin") ts.tileMeta![148] = { ...ts.tileMeta![148]!, origin: "user", defaultLayer: "lower" };
    if (kind === "locked") ts.tileMeta![148] = { ...ts.tileMeta![148]!, locked: true, defaultLayer: "lower" };
    if (kind === "userLocked") ts.tileMeta![148] = { ...ts.tileMeta![148]!, userLocked: true, defaultLayer: "lower" };
    if (kind === "lower") ts.tileMeta![148] = { ...ts.tileMeta![148]!, defaultLayer: "lower" };
    if (kind === "priority") ts.priority[148] = "lower";
    if (kind === "group-layer") ts.tileGroups!.find(group => group.id.endsWith("transparent-props"))!.layerHome = "lower";
    ts.structureKits = [kit];
    const map = createBlankMap("Authored lower", 5, 5, ts.id);
    map.lowerTiles.fill(72);
    map.lowerTiles[6] = 148; map.lowerTiles[11] = 178;
    project.maps[map.id] = map;
    const expectedKit = structuredClone(kit), expectedMap = structuredClone(map);
    ensureBundledTilesets(project);
    repairInteriorTransparentPropLayers(project);
    seedDefaultInteriorCatalog(ts);
    expect(ts.structureKits![0]).toEqual(expectedKit);
    expect(map).toEqual(expectedMap);
  });

  it.each([false, true])("does not infer per-cell author intent from tile membership, an untouched kit or plan (%s)", withPlan => {
    const project = createBlankProject();
    interior(project).structureKits = [legacyCabinet()];
    const map = createBlankMap("Manual lower cabinet", 5, 5, INTERIOR_ROOM_TILESET_ID);
    map.lowerTiles.fill(72); map.lowerTiles[6] = 148; map.lowerTiles[11] = 178;
    project.maps[map.id] = map;
    if (withPlan) map.roomHarnessPlan = { kitId: "villager-room-v1", plan: { seed: 17, concept: { rooms: { room: { things: [{ objectId: "cabinet" }] } } } } };
    const before = structuredClone(map);
    repairInteriorTransparentPropLayers(project);
    expect(map).toEqual(before);
  });

  it.each(["graphic", "both"] as const)("keeps %s title and authored nondefaults identity-significant", async mode => {
    const project = cabinetProject();
    project.system.titleScreen!.titleGraphic = { mode, resourceId: "oprn-title-field", x: 17, y: 21 };
    const identity = await sha256HexText(serializeForComparison(project));
    const fresh = deserialize(serialize(project));
    expect(await sha256HexText(serializeForComparison(fresh))).toBe(identity);
    fresh.system.titleScreen!.titleGraphic!.x = 18;
    expect(await sha256HexText(serializeForComparison(fresh))).not.toBe(identity);
    const authored = deserialize(serialize(project));
    interior(authored).tileGroups![0]!.tileIds.reverse();
    expect(await sha256HexText(serializeForComparison(authored))).not.toBe(identity);
  });
});

const remote = vi.hoisted(() => ({ wire: "", writes: 0, save: null as null | ((p: Project) => Promise<void>) }));
vi.mock("@/project/supabaseProjectSync", async importOriginal => {
  const actual = await importOriginal<typeof import("@/project/supabaseProjectSync")>();
  const save = async (project: Project) => {
    remote.writes++;
    if (remote.save) await remote.save(project);
    remote.wire = serialize(project);
    return { kind: "saved" as const, project: deserialize(remote.wire) };
  };
  return { ...actual, loadProjectFromSupabase: async () => deserialize(remote.wire),
    saveProjectToSupabase: save, saveProjectMapPatchToSupabase: async ({ project }: { project: Project }) => save(project) };
});
vi.mock("@/assets/supabaseResourceCache", () => ({ cacheSupabaseRootResources: async () => ({ skipped: [] }) }));

async function freshStore() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://interior.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-only");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "interior-contract");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network"); }));
  vi.resetModules();
  return (await import("@/project/store")).store;
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); remote.save = null; remote.writes = 0; });

async function bounded<T>(signal: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([signal, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Persistence signal deadline")), 10_000);
    })]);
  } finally { clearTimeout(deadline); }
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("real editor load/save migration lifecycle", () => {
  it("room pipeline -> save -> fresh store has equal existing canonical identity and stays clean", async () => {
    vi.useFakeTimers();
    remote.wire = serialize(createBlankProject());
    const store = await freshStore();
    await store.load();
    await store.flush();
    store.update(project => {
      const authored = cabinetProject();
      project.maps.map_cabinet = authored.maps.map_cabinet!;
      project.mapTree.children.push({ mapId: "map_cabinet", children: [] });
      ensureInteriorRoomHarness(project);
    });
    const before = await sha256HexText(serializeForComparison(store.getCurrent()));
    const saved = await store.flush();
    expect(saved.kind).toBe("saved");
    if (saved.kind !== "saved") throw new Error("save failed");
    expect(saved.receipt?.contentIdentity).toBe(before);
    const fresh = await freshStore();
    await fresh.load();
    expect(await sha256HexText(serializeForComparison(fresh.getCurrent()))).toBe(before);
    expect(fresh.hasUnsavedChanges()).toBe(false);
    expect(fresh.getAutoSaveState().kind).toBe("idle");
    const writes = remote.writes;
    await fresh.flush();
    expect(remote.writes).toBe(writes);
  });

  it.each(["load", "reconnect", "reload"])("%s marks migration pending after active load, retains dirty on failure, and catches up concurrent edits", async entry => {
    vi.useFakeTimers();
    const legacy = createBlankProject();
    interior(legacy).structureKits = [legacyCabinet()];
    remote.wire = serialize(legacy);
    const store = await freshStore();
    const states: string[] = [];
    const unsubscribe = store.subscribeAutoSave(state => {
      states.push(state.kind);
      if (state.kind === "pending") expect(store.isLoaded()).toBe(true);
    });
    if (entry === "load") await store.load();
    else if (entry === "reconnect") expect((await store.reconnectRemotePersistence()).kind).toBe("connected");
    else {
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
      expect((await store.reloadFromRemote()).kind).toBe("reloaded");
    }
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(states).toContain("pending");
    remote.save = async () => { throw new Error("migration save rejected"); };
    await expect(store.flush()).rejects.toThrow("migration save rejected");
    expect(store.hasUnsavedChanges()).toBe(true);
    const submitted = signal();
    const release = signal();
    let saves = 0;
    remote.save = async () => { if (++saves === 1) { submitted.resolve(); await release.promise; } };
    const saving = store.flush();
    try {
      await bounded(submitted.promise);
      expect(store.hasUnsavedChanges()).toBe(true);
      store.update(project => { project.meta.title = "Concurrent authored title"; });
    } finally { release.resolve(); }
    await bounded(saving);
    expect(saves).toBe(2);
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(deserialize(remote.wire).meta.title).toBe("Concurrent authored title");
    expect(interiorObjectFromKit(interiorFurnitureKits(interior(deserialize(remote.wire)))[0]!).cells.every(cell => cell.layer === "upper")).toBe(true);
    unsubscribe();
  });
});
