import { afterEach, describe, expect, it, beforeEach, vi, beforeAll } from "vitest";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues, repairProjectReferences, validateProjectReferences } from "@/project/io/references";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { store } from "@/project/store";
import type { FarmAnimalBuildingDefinition, FarmAnimalSpeciesRecord, GameEvent, GameMap, Project, ResourceProfile, UploadedAsset, TilesetDef, TileGroupMetadata } from "@/project/types";
import { resetToastsForTest } from "@/util/toast";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom, type FakeNode } from "./fakeDom";
import { anchoredPopupPosition } from "@/editor/panels/popupPosition";
import { normalizeWorld, type WorldEntity } from "@/project/world";
import { createWorldPanelState, deleteWorldEntity, draftFromEntity, saveDraft } from "@/editor/panels/worldManager";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { makeSvgIcon, SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import * as fs from "node:fs";
import * as path from "node:path";
import { isCellInsideSelection, regionTaskMenuItems, type RegionSelection } from "@/editor/panels/mapSelectionContextMenu";
import { RESOURCE_FOLDER_IMPORT_CAP, filesFromResourceDrop, renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import { canonicalResourceProfileId, dedupeListedProfiles } from "@/editor/panels/resourceManagerUtils";
import { defaultResourceProfiles, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { decideImageDataUrl, decideImageImport, formatImageImportDimensionError, formatImageImportSizeError } from "@/editor/panels/resourceManagerImageImport";
import { buildStampObjectIndex } from "@/ai/stampObjects";
import { propsForTileset } from "@/editor/propRecommendations";
import { albumEntries, albumEntryId } from "@/editor/panels/structureKitDbSources";
import { isRetiredObject, retiredObjectIds } from "@/project/retiredObjects";
import { editorState } from "@/editor/editorState";
import { revealPaletteTileFromMap } from "@/editor/panels/tilePalette";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools, getTool } from "@/editor/tools/toolRegistry";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { ToolContext } from "@/editor/tools/types";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { captureFocus, restoreFocus, applyRovingTabindex, cssEscape } from "@/editor/panels/sidebarFocus";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, resolveSpatialBuildSource, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { listSpatialGalleryCards } from "../src/editor/panels/spatialCatalog";
import { own, spatialId } from "../src/project/spatial/domain";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { isolateTimers } from "./mergedTeardown";

describe("p1ReferenceIntegrity", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  afterEach(() => {
    resetToastsForTest();
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("P1 farm-animal project reference integrity", () => {
    it("reports duplicate definitions and every cross-record failure with an exact authored path", () => {
      // Break caught: farm-animal rows can contain dangling ids and impossible capacity/compatibility without blocking play.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      addEvent(project, "event_chicken");
      project.database.farmAnimalSpecies = [
        species("chicken", feedItem.id, productItem.id),
        species("cow", "missing_feed", "missing_product"),
        species("chicken", feedItem.id, productItem.id),
      ];
      project.system.farmAnimalBuildings = [
        building(project, "coop", 1, ["chicken", "missing_species"]),
        building(project, "coop", 4, ["chicken"]),
        { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
        { ...building(project, "off_map", 4, ["chicken"]), x: project.maps[project.startMapId]!.width },
        building(project, "cow_home", 4, ["chicken"]),
      ];
      project.session.farmAnimals = [
        { instanceId: "hen_1", speciesId: "chicken", name: "Hen 1", buildingId: "coop", eventId: "event_chicken" },
        { instanceId: "hen_2", speciesId: "chicken", name: "Hen 2", buildingId: "coop" },
        { instanceId: "hen_1", speciesId: "chicken", name: "Duplicate" },
        { instanceId: "ghost", speciesId: "missing_species", name: "Ghost" },
        { instanceId: "no_home", speciesId: "chicken", name: "No home", buildingId: "missing_building" },
        { instanceId: "no_event", speciesId: "chicken", name: "No event", eventId: "missing_event" },
        { instanceId: "wrong_home", speciesId: "cow", name: "Wrong home", buildingId: "cow_home" },
      ];

      const issues = collectProjectReferenceIssues(project);

      expect(issues).toEqual(expect.arrayContaining([
        "database.farmAnimalSpecies[2].id duplicates database.farmAnimalSpecies[0].id: chicken",
        "database.farmAnimalSpecies[1].feedItemId does not exist: missing_feed",
        "database.farmAnimalSpecies[1].productItemId does not exist: missing_product",
        "system.farmAnimalBuildings[1].id duplicates system.farmAnimalBuildings[0].id: coop",
        "system.farmAnimalBuildings[0].allowedSpeciesIds[1] does not exist: missing_species",
        "system.farmAnimalBuildings[2].mapId does not exist: missing_map",
        `system.farmAnimalBuildings[3].position (${project.maps[project.startMapId]!.width}, 0) is out of bounds for map ${project.startMapId}`,
        "session.farmAnimals[2].instanceId duplicates session.farmAnimals[0].instanceId: hen_1",
        "session.farmAnimals[3].speciesId does not exist: missing_species",
        "session.farmAnimals[4].buildingId does not exist: missing_building",
        "session.farmAnimals[5].eventId does not exist: missing_event",
        "session.farmAnimals[6].buildingId cow_home does not allow speciesId cow",
        "session.farmAnimals[1].buildingId exceeds system.farmAnimalBuildings[0].capacity: coop (1)",
      ]));
      expect(() => validateProjectReferences(project)).toThrow(/database\.farmAnimalSpecies\[2\]\.id/);
    });

    it("repairs invalid definitions and assignments without inventing replacement species or capacity", () => {
      // Break caught: load repair substitutes unrelated ids or leaves a cascading farm-animal reference failure.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      addEvent(project, "event_keep");
      project.database.farmAnimalSpecies = [
        species("chicken", feedItem.id, productItem.id),
        species("cow", feedItem.id, productItem.id),
        species("invalid_items", "missing_feed", productItem.id),
      ];
      project.system.farmAnimalBuildings = [
        building(project, "coop", 1, ["chicken", "invalid_items", "missing_species"]),
        { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
        { ...building(project, "off_map", 4, ["chicken"]), y: project.maps[project.startMapId]!.height },
      ];
      project.session.farmAnimals = [
        { instanceId: "keep", speciesId: "chicken", name: "Keep", buildingId: "coop", eventId: "event_keep" },
        { instanceId: "overflow", speciesId: "chicken", name: "Overflow", buildingId: "coop" },
        { instanceId: "incompatible", speciesId: "cow", name: "Incompatible", buildingId: "coop" },
        { instanceId: "invalid_species", speciesId: "invalid_items", name: "Invalid items" },
        { instanceId: "unknown_species", speciesId: "missing_species", name: "Unknown" },
        { instanceId: "unknown_home", speciesId: "chicken", name: "Unknown home", buildingId: "missing_building" },
        { instanceId: "removed_home", speciesId: "chicken", name: "Removed home", buildingId: "missing_home" },
      ];

      repairProjectReferences(project);

      expect(project.database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken", "cow"]);
      // 맵 밖으로 나간 축사는 지우지 않고 맵 안으로 당긴다(배정된 개체를 말없이 풀지 않게) — 맵이 없어진 축사만 빠진다.
      const startHeight = project.maps[project.startMapId]!.height;
      expect(project.system.farmAnimalBuildings).toEqual([
        expect.objectContaining({ id: "coop", capacity: 1, allowedSpeciesIds: ["chicken"] }),
        expect.objectContaining({ id: "off_map", capacity: 4, y: startHeight - 1, allowedSpeciesIds: ["chicken"] }),
      ]);
      expect(project.session.farmAnimals?.map((row) => row.instanceId)).toEqual([
        "keep", "overflow", "incompatible", "unknown_home", "removed_home",
      ]);
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "keep")).toMatchObject({
        speciesId: "chicken",
        buildingId: "coop",
        eventId: "event_keep",
      });
      for (const instanceId of ["overflow", "incompatible", "unknown_home", "removed_home"]) {
        expect(project.session.farmAnimals?.find((row) => row.instanceId === instanceId)?.buildingId).toBeUndefined();
      }
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("includes animal-home ids in map impact and clears only assignments to cascaded homes", () => {
      // Break caught: deleting a map silently leaves farmAnimalBuildings and starting-animal buildingIds dangling.
      const project = referenceProject();
      const target = addMap(project, "map_barnyard");
      target.events.push({
        id: "event_barnyard_hen",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
      });
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      project.system.farmAnimalBuildings = [
        buildingOn(target, "coop", 4, ["chicken"]),
        buildingOn(target, "barn", 4, ["chicken"]),
        building(project, "source_home", 4, ["chicken"]),
      ];
      project.session.farmAnimals = [
        {
          instanceId: "coop_animal",
          speciesId: "chicken",
          name: "Coop",
          buildingId: "coop",
          eventId: "event_barnyard_hen",
        },
        { instanceId: "barn_animal", speciesId: "chicken", name: "Barn", buildingId: "barn" },
        { instanceId: "source_animal", speciesId: "chicken", name: "Source", buildingId: "source_home" },
      ];

      const impact = collectMapDeletionImpact(project, target.id);
      expect(impact?.farmAnimalBuildingCount).toBe(2);
      expect(impact?.farmAnimalBuildingIds).toEqual(["coop", "barn"]);

      applyMapDeletion(project, target.id);

      expect(project.system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["source_home"]);
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.buildingId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.eventId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "barn_animal")?.buildingId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "source_animal")?.buildingId).toBe("source_home");
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("blocks database item deletion when a species uses it as feed or product", () => {
      // Break caught: deleting an item used by a farm species bypasses the database reference guard.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      store.replace(project);

      expect(databaseReferenceMessage("items", feedItem.id)).toMatch(/동물 종.*먹이/);
      expect(databaseReferenceMessage("items", productItem.id)).toMatch(/동물 종.*생산물/);
    });

    it("keeps referenced species and buildings when their farm-animal UI delete buttons are clicked", () => {
      // Break caught: the structured animal editor splices referenced species/buildings without consulting a guard.
      restoreDom = installFakeDom();
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      project.system.farmAnimalBuildings = [building(project, "coop", 4, ["chicken"])];
      project.session.farmAnimals = [{ instanceId: "hen", speciesId: "chicken", name: "Hen", buildingId: "coop" }];
      store.replace(project);
      const host = document.createElement("div") as unknown as FakeElement;
      renderFarmAnimalsTab(host as unknown as HTMLElement, () => undefined);

      findByTestId(host, "db-farm-species-chicken")?.querySelector("button")?.click();
      findByTestId(host, "db-farm-building-coop")?.querySelector("button")?.click();

      expect(store.getCurrent().database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken"]);
      expect(store.getCurrent().system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["coop"]);
    });
  });
  function referenceProject(): Project {
    return createBlankProject();
  }
  function species(id: string, feedItemId: string, productItemId: string): FarmAnimalSpeciesRecord {
    return {
      id,
      name: id,
      feedItemId,
      productItemId,
      productCount: 1,
      productEveryDays: 1,
      petFriendship: 10,
    };
  }
  function building(
    project: Project,
    id: string,
    capacity: number,
    allowedSpeciesIds: string[],
  ): FarmAnimalBuildingDefinition {
    return buildingOn(project.maps[project.startMapId]!, id, capacity, allowedSpeciesIds);
  }
  function buildingOn(
    map: GameMap,
    id: string,
    capacity: number,
    allowedSpeciesIds: string[],
  ): FarmAnimalBuildingDefinition {
    return { id, name: id, mapId: map.id, x: 0, y: 0, capacity, allowedSpeciesIds };
  }
  function addMap(project: Project, id: string): GameMap {
    const map = structuredClone(project.maps[project.startMapId]!);
    map.id = id;
    map.name = id;
    map.events = [];
    project.maps[id] = map;
    project.mapTree.children.push({ mapId: id, children: [] });
    return map;
  }
  function addEvent(project: Project, id: string): void {
    const event: GameEvent = {
      id,
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
    };
    project.maps[project.startMapId]!.events.push(event);
  }
});

describe("popupPosition", () => {
  isolateTimers();
  describe("anchoredPopupPosition", () => {
    it("keeps a docked assistant menu inside the viewport instead of its clipped host", () => {
      // Break: the menu was absolutely positioned inside an overflow:hidden side host.
      expect(anchoredPopupPosition(
        { left: 1450, right: 1482, top: 100, bottom: 132 },
        { width: 220, height: 360 },
        { width: 1600, height: 900 },
      )).toEqual({ left: 1262, top: 136 });
    });

    it("opens above the anchor when there is no room below", () => {
      expect(anchoredPopupPosition(
        { left: 700, right: 732, top: 760, bottom: 792 },
        { width: 200, height: 300 },
        { width: 800, height: 820 },
      )).toEqual({ left: 532, top: 456 });
    });
  });
});

describe("projectWikiCodex", () => {
  isolateTimers();
  const now = 1_788_652_800_000;
  const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  let cleanup: () => void;
  beforeEach(() => {
    cleanup = installFakeDom();
    vi.spyOn(Date, "now").mockReturnValue(now);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  function documentEntity(overrides: Partial<WorldEntity> = {}): WorldEntity {
    return { id: "w_rule", type: "guideline", name: "Combat", summary: "Action combat", body: "**Action** combat", origin: "ai",
      wiki: { kind: "declaration", basis: "inferred", topic: "combat-mode", combatMode: "action",
        sources: [{ id: "user-1", kind: "user", text: hostile, at: 10 }] }, ...overrides };
  }
  function load(entities: WorldEntity[]) {
    const project = createBlankProject();
    project.world = normalizeWorld({ entities, relations: [] });
    store.replace(project);
    return project;
  }
  function edit(entity: WorldEntity) {
    const state = createWorldPanelState({ initialEntityId: entity.id });
    state.editDraft = draftFromEntity(store.getCurrent().world!.entities.find((entry) => entry.id === entity.id)!, []);
    return state;
  }
  function control(panel: FakeElement, id: string): FakeElement {
    const node = findByTestId(panel, id);
    if (!node) throw new Error(`Missing control: ${id}`);
    return node;
  }
  describe("sourced codex manual editing", () => {
    it("preserves wiki metadata and source history while recording a chronological manual source", () => {
      const old = documentEntity({ id: "w_old", wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "old", kind: "user", text: "Old rule", at: 1 }] } });
      const entity = documentEntity();
      const current = { ...entity, wiki: { ...entity.wiki!, supersedes: [old.id] } };
      const project = load([old, current]);
      const state = edit(current);
      state.editDraft!.tagsText = "reviewed";
      saveDraft(state, project.world!);
      const saved = store.getCurrent().world!.entities.find((entry) => entry.id === current.id)!;
      expect(saved.wiki).toMatchObject({ kind: "declaration", basis: "explicit", topic: "combat-mode", combatMode: "action", supersedes: [old.id] });
      expect(saved.wiki!.sources[0]).toEqual(current.wiki.sources[0]);
      expect(saved.wiki!.sources[1]).toMatchObject({ kind: "manual", at: now });
      expect(saved.wiki!.sources[1]!.id).not.toBe(saved.wiki!.sources[0]!.id);
      expect(saved.wiki!.sources[1]!.text).toContain(saved.body);
      expect(normalizeWorld(store.getCurrent().world)).toEqual(store.getCurrent().world);
      expect(state.editDraft).toBeNull();
    });

    it("clears stale machine combat mode through the real body input and save controls", () => {
      const entity = documentEntity();
      load([entity]);
      const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: entity.id }));
      control(panel, "world-edit-toggle").click();
      const body = control(panel, "world-edit-body");
      body.value = "Use random encounters instead";
      body.dispatchEvent(new Event("input"));
      control(panel, "world-edit-save").click();
      const saved = store.getCurrent().world!.entities[0]!;
      expect(saved.body).toBe(body.value);
      expect(saved.wiki?.basis).toBe("explicit");
      expect(saved.wiki?.combatMode).toBeUndefined();
      expect(saved.wiki?.sources[0]).toEqual(entity.wiki!.sources[0]);
    });

    it("saves progress edits separately without altering or fabricating application evidence", () => {
      const entity = documentEntity({ wiki: { kind: "progress", basis: "observed", topic: "map-build", sources: [{ id: "apply-1", kind: "application", text: "Placed 3 tiles", at: 10 }] } });
      const project = load([entity]);
      const state = edit(entity);
      state.editDraft!.body = "I think 100 tiles were placed";
      saveDraft(state, project.world!);
      const world = normalizeWorld(store.getCurrent().world);
      expect(world.entities.find((entry) => entry.id === entity.id)).toEqual(entity);
      const note = world.entities.find((entry) => entry.id === state.selectedId)!;
      expect(note.id).not.toBe(entity.id);
      expect(note.body).toBe("I think 100 tiles were placed");
      expect(note.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "map-build" });
      expect(note.wiki?.sources).toHaveLength(1);
      expect(note.wiki?.sources[0]).toMatchObject({ kind: "manual", at: now });
      expect(note.wiki?.sources[0]?.text).toContain(entity.id);
      expect(note.wiki?.supersedes).toBeUndefined();
    });

    it("protects referenced historical deletion and leaves supersession intact", () => {
      const old = documentEntity({ id: "w_old" });
      const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New rule", at: 20 }], supersedes: [old.id] } });
      load([old, latest]);
      expect(deleteWorldEntity(old.id)).toBe(false);
      expect(deleteWorldEntity(latest.id)).toBe(false);
      expect(normalizeWorld(store.getCurrent().world).entities).toEqual([old, latest]);
      expect(document.body.textContent).not.toBe("");
    });

    it("rejects locked and racing drafts without losing pending text", () => {
      const entity = documentEntity({ locked: true });
      const project = load([entity]);
      const state = edit(entity);
      state.editDraft!.body = "Pending";
      saveDraft(state, project.world!);
      expect(state.editError).not.toBe("");
      expect(store.getCurrent().world!.entities[0]).toEqual(entity);
      const unlocked = { ...entity, locked: false };
      load([unlocked]);
      const racing = edit(unlocked);
      racing.editDraft!.body = "Pending";
      store.update((p) => { p.world = { entities: [{ ...unlocked, summary: "Concurrent" }], relations: [] }; });
      saveDraft(racing, project.world!);
      expect(racing.editError).not.toBe("");
      expect(racing.editDraft!.body).toBe("Pending");
      expect(store.getCurrent().world!.entities[0]!.summary).toBe("Concurrent");
    });

    it("makes inferred knowledge explicit and keeps manual sources across repeated saves", () => {
      const entity = documentEntity({ wiki: { kind: "knowledge", basis: "inferred", topic: "village", sources: [{ id: "user-1", kind: "user", text: "Village plan", at: 10 }] } });
      const project = load([entity]);
      const state = edit(entity);
      state.editDraft!.body = "Confirmed village plan";
      saveDraft(state, project.world!);
      const first = store.getCurrent().world!.entities[0]!;
      const next = edit(first);
      next.editDraft!.summary = "Confirmed";
      saveDraft(next, project.world!);
      const saved = store.getCurrent().world!.entities[0]!;
      expect(saved.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "village" });
      expect(saved.wiki!.sources.slice(0, 2)).toEqual(first.wiki!.sources);
      expect(saved.wiki!.sources.map((source) => source.kind)).toEqual(["user", "manual", "manual"]);
      expect(new Set(saved.wiki!.sources.map((source) => source.id)).size).toBe(3);
    });

    it("retains legacy manual document behavior", () => {
      const entity = documentEntity({ wiki: undefined, origin: "user" });
      const project = load([entity]);
      const state = edit(entity);
      state.editDraft!.body = "Updated";
      saveDraft(state, project.world!);
      expect(store.getCurrent().world!.entities[0]!.wiki).toBeUndefined();
      expect(store.getCurrent().world!.entities[0]!.body).toBe("Updated");
      expect(deleteWorldEntity(entity.id)).toBe(true);
    });

    it("renders parsed provenance, collapsed source text, supersession, body and reference controls safely", () => {
      const old = documentEntity({ id: "w_old" });
      const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New", at: 20 }], supersedes: [old.id] } });
      const project = load([old, latest]);
      const mapId = Object.keys(project.maps)[0]!;
      store.update((p) => { p.world = normalizeWorld({ entities: [{ ...old, refs: [{ kind: "map", id: mapId }] }, latest], relations: [] }); });
      const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: old.id }));
      const provenance = control(panel, "world-wiki-provenance");
      expect(provenance.dataset).toMatchObject({ basis: "inferred", kind: "declaration", superseded: "true" });
      const sources = control(panel, "world-wiki-sources");
      expect(sources.tagName.toLowerCase()).toBe("details");
      expect(sources.getAttribute("open")).toBeNull();
      const source = control(panel, "world-wiki-source-0");
      expect(source.textContent).toContain(hostile);
      expect(source.textContent).toContain("user-1");
      expect(source.querySelector("img")).toBeNull();
      expect(source.querySelector("script")).toBeNull();
      expect([source, ...source.querySelectorAll("*")].every((node) => node.innerHTML === "")).toBe(true);
      expect(panel.querySelector(".world-markdown")?.querySelector("strong")?.textContent).toBe("Action");
      expect(findByTestId(panel, `world-ref-jump-map-${mapId}`)).toBeTruthy();
    });
  });
});

describe("regionTaskIcons", () => {
  isolateTimers();
  const REQUIRED_REGION_TASK_ICONS: readonly SvgIconName[] = [
    "terrain",
    "structure",
    "polish",
    "npc",
    "chest",
    "combat",
    "mood",
    "composite",
    "pin",
    "save",
    "warning",
    "door",
    "sign",
    "shop",
  ];
  describe("region task icons", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("SVG_ICON_NAMES contains all 14 new region-task icons", () => {
      for (const name of REQUIRED_REGION_TASK_ICONS) {
        expect(SVG_ICON_NAMES).toContain(name);
      }
    });

    it("every icon in SVG_ICON_NAMES produces a valid svg with currentColor stroke, none fill, and child elements", () => {
      for (const name of SVG_ICON_NAMES) {
        const svg = makeSvgIcon(name);
        expect(svg).toBeDefined();
        expect(svg.getAttribute("stroke")).toBe("currentColor");
        expect(svg.getAttribute("fill")).toBe("none");
        expect(svg.childNodes.length).toBeGreaterThan(0);
      }
    });

    it("no icon spec attribute value in tileToolbarIcons matches color literals (hex, rgb, hsl)", () => {
      const filePath = path.resolve(__dirname, "../src/editor/panels/tileToolbarIcons.ts");
      const source = fs.readFileSync(filePath, "utf-8");

      // Match hex colors (#fff, #123456), rgb(...), hsl(...)
      const colorLiteralRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]*\)|hsl\([^)]*\)/g;
      const matches = source.match(colorLiteralRegex);
      expect(matches).toBeNull();
    });
  });
});

describe("regionTaskMenu", () => {
  isolateTimers();
  const SELECTION: RegionSelection = { mapId: "m1", x: 2, y: 3, width: 4, height: 5 };   // x∈[2,6), y∈[3,8)

  describe("isCellInsideSelection", () => {
    it("경계를 반개구간으로 판정한다", () => {
      expect(isCellInsideSelection(SELECTION, 2, 3)).toBe(true);
      expect(isCellInsideSelection(SELECTION, 5, 7)).toBe(true);
      expect(isCellInsideSelection(SELECTION, 6, 7)).toBe(false); // x 상한 제외
      expect(isCellInsideSelection(SELECTION, 2, 8)).toBe(false); // y 상한 제외
      expect(isCellInsideSelection(SELECTION, 1, 3)).toBe(false);
    });
  });
  describe("regionTaskMenuItems", () => {
    it("keeps AI routing alongside the encounter action — it hands the region to the assistant chat", () => {
      const openModal = vi.fn();
      const items = regionTaskMenuItems(SELECTION, openModal);
      expect(items.map((item) => item.testId)).toEqual(["region-walk-encounter-menu-item", "region-ai-task-menu-item"]);
      const item = items.find((candidate) => candidate.id === "region-ai-task");
      if (!item) throw new Error("Missing AI action");

      item.action();
      expect(openModal).toHaveBeenCalledTimes(1);
      expect(openModal).toHaveBeenCalledWith({
        mapId: "m1",
        region: { x: 2, y: 3, width: 4, height: 5 },
      });
    });
  });
});

// 리소스 관리자에 폴더를 놓으면 폴더 자체가 파일 한 장으로 들어와 「알 수 없는 형식」이 됐다.
// 폴더 안을 읽고, 지금 분류의 확장자만 가져온다.
describe("resourceFolderDrop", () => {
  isolateTimers();
  function fileNamed(name: string): File {
    return new File(["x"], name, { type: "application/octet-stream" });
  }
  function fileEntry(name: string, onRead?: () => void): FileSystemEntry {
    return {
      name,
      isFile: true,
      isDirectory: false,
      file(success) {
        onRead?.();
        success(fileNamed(name));
      },
    } as FileSystemFileEntry;
  }
  function dirEntry(name: string, children: readonly FileSystemEntry[]): FileSystemEntry {
    return {
      name,
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let pending = children.slice();
        return {
          readEntries(success) {
            const batch = pending.splice(0, 100);
            success(batch);
          },
        };
      },
    } as FileSystemDirectoryEntry;
  }
  function transfer(entries: readonly (FileSystemEntry | null)[], files: readonly File[] = []): DataTransfer {
    return {
      items: entries.map((entry) => ({
        kind: "file",
        webkitGetAsEntry: () => entry,
      })),
      files,
    } as unknown as DataTransfer;
  }
  describe("filesFromResourceDrop", () => {
    it("keeps a single dropped file when the browser does not expose a directory entry", async () => {
      const png = fileNamed("lamp.png");
      const read = await filesFromResourceDrop({
        items: [{ kind: "file", webkitGetAsEntry: () => null }],
        files: [png],
      } as unknown as DataTransfer);

      expect(read.files.map((file) => file.name)).toEqual(["lamp.png"]);
      expect(read.notice).toBeNull();
    });

    it("imports images inside a dropped folder and skips notes", async () => {
      const read = await filesFromResourceDrop(transfer([
        dirEntry("village-pictures", [
          fileEntry("lamp.png"),
          fileEntry("notes.txt"),
          dirEntry("signs", [fileEntry("sign.png"), fileEntry(".hidden.png")]),
        ]),
      ], [fileNamed("village-pictures")]));

      expect(read.files.map((file) => file.name)).toEqual(["lamp.png", "sign.png"]);
      expect(read.notice).toBeNull();
    });

    it("says when a folder has nothing the current category can import", async () => {
      const read = await filesFromResourceDrop(transfer([
        dirEntry("music", [fileEntry("theme.mp3")]),
      ]), ["png"]);

      expect(read.files).toEqual([]);
      expect(read.noticeKind).toBe("error");
      expect(read.notice).toBe("이 폴더에서 지금 분류로 가져올 파일이 없습니다.");
    });

    it("stops after the folder cap and does not read the rest", async () => {
      let extraReads = 0;
      const children = Array.from({ length: RESOURCE_FOLDER_IMPORT_CAP + 3 }, (_, index) => (
        fileEntry(`tile-${index}.png`, () => {
          if (index >= RESOURCE_FOLDER_IMPORT_CAP) extraReads += 1;
        })
      ));
      const read = await filesFromResourceDrop(transfer([dirEntry("tiles", children)]));

      expect(read.files).toHaveLength(RESOURCE_FOLDER_IMPORT_CAP);
      expect(extraReads).toBe(0);
      expect(read.noticeKind).toBe("info");
      expect(read.notice).toBe(`폴더에서는 앞의 ${RESOURCE_FOLDER_IMPORT_CAP}개만 가져옵니다.`);
    });

    it("still passes a loose file through even when its extension is not a folder match", async () => {
      const read = await filesFromResourceDrop(transfer([fileEntry("sheet.bmp")]));

      expect(read.files.map((file) => file.name)).toEqual(["sheet.bmp"]);
      expect(read.notice).toBeNull();
    });
  });
});

describe("resourceManager", () => {
  isolateTimers();
  describe("resourceManagerDedup", () => {
    isolateTimers();
    const upload = (id: string, kind: UploadedAsset["kind"]): UploadedAsset => ({
      id,
      name: id,
      kind,
      dataUrl: "data:image/png;base64,x",
      meta: {},
    });
    const profile = (kind: ResourceProfile["kind"], assetId: string | undefined, name = assetId ?? "anonymous"): ResourceProfile =>
      assetId === undefined ? { kind, name } : { kind, name, assetId };
    describe("리소스 관리자 목록 중복 제거", () => {
      // EasyRPG 칩셋 시트(easyrpg-chipset-*)는 2026-10-07 저작권 정리(PR #2335)로 번들에서 빠졌다.
      // 접을 칩셋 별칭이 더는 없으므로, 기본 목록에 별칭 칩셋 카드가 남지 않는지만 본다.
      it("기본 프로젝트의 칩셋 목록에 easyrpg-chipset-* 별칭 카드가 남지 않는다", () => {
        const all = defaultResourceProfiles();
        const chipsets = dedupeListedProfiles(all, []).filter((p) => p.kind === "chipset");
        expect(chipsets.filter((p) => p.assetId?.startsWith("easyrpg-chipset-"))).toEqual([]);
        expect(chipsets.some((p) => p.assetId === "tex_beodeul_city")).toBe(true);
      });

      it("캐릭터셋도 같은 시트의 RTP id 별칭이 접히고 정본 프로필만 남는다", () => {
        const all = defaultResourceProfiles();
        const visible = dedupeListedProfiles(all, []).filter((p) => p.kind === "charset");
        expect(all.filter((p) => p.kind === "charset").some((p) => p.assetId === "easyrpg-charset-actor1")).toBe(true);
        expect(visible.some((p) => p.assetId?.startsWith("easyrpg-charset-"))).toBe(false);
        expect(visible.some((p) => p.assetId === "tex_easyrpg_charset_actor1")).toBe(true);
        // 데이터에서 프로필을 지우지 않는다 — 목록만 접는다.
        expect(visible.length).toBeLessThan(all.filter((p) => p.kind === "charset").length);
      });

      it("업로드 자산과 같은 assetId 를 가진 프로필은 업로드 카드가 대신 보인다", () => {
        const profiles = [
          profile("chipset", "my-upload", "업로드와 겹침"),
          profile("chipset", "tex_easyrpg_chipset_dungeon"),
        ];
        const visible = dedupeListedProfiles(profiles, [upload("my-upload", "tileset")]);
        expect(visible.map((p) => p.assetId)).toEqual(["tex_easyrpg_chipset_dungeon"]);
      });

      it("정본 프로필이 없는 별칭 프로필만 있는 프로젝트는 그대로 보인다", () => {
        const profiles = [profile("chipset", "easyrpg-chipset-dungeon")];
        const visible = dedupeListedProfiles(profiles, []);
        expect(visible).toHaveLength(1);
        expect(visible[0]?.assetId).toBe("easyrpg-chipset-dungeon");
      });

      it("assetId 없는 프로필은 서로 다른 항목으로 유지된다", () => {
        const profiles = [profile("chipset", undefined, "수작업 칩셋 A"), profile("chipset", undefined, "수작업 칩셋 B")];
        expect(dedupeListedProfiles(profiles, [])).toHaveLength(2);
      });

      it("canonicalResourceProfileId 는 캐릭터셋 별칭을 번들 텍스처 키로 접는다", () => {
        // 칩셋 별칭의 번들 시트는 PR #2335 로 삭제됐다 — 접을 대상이 없으면 id 를 그대로 둔다.
        expect(canonicalResourceProfileId("easyrpg-chipset-dungeon")).toBe("easyrpg-chipset-dungeon");
        expect(canonicalResourceProfileId("easyrpg-charset-actor1")).toBe("tex_easyrpg_charset_actor1");
        expect(canonicalResourceProfileId("tex_easyrpg_chipset_dungeon")).toBe("tex_easyrpg_chipset_dungeon");
        expect(canonicalResourceProfileId("custom-upload")).toBe("custom-upload");
      });
    });
  });
  describe("resourceManagerImageImport", () => {
    isolateTimers();
    describe("decideImageImport", () => {
      it("accepts png and jpeg without normalization", () => {
        expect(
          decideImageImport({ fileName: "tile.png", mimeType: "image/png", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
        expect(
          decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "jpeg", normalizeToPng: false });
      });

      it("accepts webp and gif with PNG normalization", () => {
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "image/webp", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
        expect(
          decideImageImport({ fileName: "anim.gif", mimeType: "image/gif", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "gif", normalizeToPng: true });
      });

      it("rejects oversize files with actual size and the 4MB limit", () => {
        const decision = decideImageImport({
          fileName: "big.png",
          mimeType: "image/png",
          sizeBytes: 6 * 1024 * 1024,
        });
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.reason).toBe("size");
          expect(decision.message).toContain("6.0MB");
          expect(decision.message).toContain("4MB");
        }
      });

      it("rejects unsupported formats naming the actual type", () => {
        const decision = decideImageImport({
          fileName: "icon.svg",
          mimeType: "image/svg+xml",
          sizeBytes: 100,
        });
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.reason).toBe("format");
          expect(decision.message).toContain("image/svg+xml");
        }
      });

      it("falls back to extension when MIME is empty", () => {
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("falls back to extension for generic octet-stream MIME", () => {
        expect(
          decideImageImport({ fileName: "tile.png", mimeType: "application/octet-stream", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "application/octet-stream", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("prefers MIME over a conflicting extension for image types", () => {
        expect(
          decideImageImport({ fileName: "renamed-svg.png", mimeType: "image/svg+xml", sizeBytes: 100 }).ok
        ).toBe(false);
        expect(
          decideImageImport({ fileName: "photo.webp", mimeType: "image/png", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
      });

      it("accepts uppercase extensions", () => {
        expect(
          decideImageImport({ fileName: "SHOT.WEBP", mimeType: "", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("normalizes the non-standard image/jpg alias to PNG", () => {
        expect(
          decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpg", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "jpeg", normalizeToPng: true });
      });
    });
    describe("decideImageDataUrl", () => {
      it("passes png/jpeg data URLs through", () => {
        const decision = decideImageDataUrl("data:image/png;base64,AAAA");
        expect(decision).toEqual({ ok: true, format: "png", normalizeToPng: false });
      });

      it("flags webp/gif data URLs for normalization", () => {
        expect(decideImageDataUrl("data:image/webp;base64,AAAA")).toEqual({
          ok: true,
          format: "webp",
          normalizeToPng: true,
        });
      });

      it("follows the file-level decision for empty or generic data-URL headers", () => {
        expect(
          decideImageDataUrl("data:;base64,AAAA", { format: "webp", normalizeToPng: true })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
        // 일반 헤더는 파일 판정이 png 여도 PNG 로 다시 그린다 — 그대로 저장하면
        // safeUploadedResourceUrl 화이트리스트에 걸려 플레이에서 보이지 않는다.
        expect(
          decideImageDataUrl("data:application/octet-stream;base64,AAAA", { format: "png", normalizeToPng: false })
        ).toEqual({ ok: true, format: "png", normalizeToPng: true });
      });

      it("still rejects non-image data URLs without a fallback", () => {
        const decision = decideImageDataUrl("data:;base64,AAAA");
        expect(decision.ok).toBe(false);
      });

      it("normalizes the image/jpg data-URL alias", () => {
        expect(decideImageDataUrl("data:image/jpg;base64,AAAA")).toEqual({
          ok: true,
          format: "jpeg",
          normalizeToPng: true,
        });
      });
    });
    describe("error message helpers", () => {
      it("shows actual megabytes in size errors", () => {
        const message = formatImageImportSizeError(2.5 * 1024 * 1024);
        expect(message).toContain("2.5MB");
        expect(message).toContain("4MB");
      });

      it("appends actual dimensions when the validator message lacks them", () => {
        const withDims = formatImageImportDimensionError("칩셋: 16x16 단위", 20, 20);
        expect(withDims).toContain("20x20");
        const already = formatImageImportDimensionError("필요 16x16, 현재 20x20", 20, 20);
        expect(already).toBe("필요 16x16, 현재 20x20");
      });
    });
  });
  // 가져오기 직후 새 리소스가 어디에 있는지 보여야 한다.
  //
  // 목록은 기본 포함 리소스(캐릭셋만 40여 줄) 뒤에 업로드분을 덧붙이고, 가져오기 후 목록을
  // 통째로 다시 그리면서 스크롤이 맨 위로 돌아간다. 그래서 "가져오기 완료" 토스트만 뜨고
  // 목록은 그대로인 것처럼 보였다 — 방금 넣은 줄을 짚어 주고 화면 안으로 끌어와야 한다.
  describe("resourceManagerRevealImport", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    const ASSET_ID = "charset_img_reveal";
    function charsetAsset(id: string): UploadedAsset {
      return {
        id,
        name: `teal-${id}`,
        kind: "charset",
        dataUrl: "data:image/png;base64,AAAA",
        meta: { tileSize: 24, frames: 96, frameWidth: 24, frameHeight: 32, width: 288, height: 256 },
      } as UploadedAsset;
    }
    function renderWorkbench(recentAssetId?: string): { root: FakeNode; scrolled: string[] } {
      const scrolled: string[] = [];
      const container = document.createElement("div");
      document.body.append(container);
      const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
      renderResourceWorkbench(container, {
        categories: [{ kind: "charset", label: "캐릭터셋" }],
        selectedKind: "charset",
        profiles: [],
        uploaded,
        kindSelect: document.createElement("select") as HTMLSelectElement,
        fileInput: document.createElement("input") as HTMLInputElement,
        actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
        onSelectKind: () => {},
        onImport: () => {},
        ...(recentAssetId === undefined ? {} : { recentAssetId }),
      });
      const root = container as unknown as FakeNode;
      for (const asset of uploaded) {
        const row = findByTestId(root, `resource-upload-${asset.id}`);
        if (!row) continue;
        (row as unknown as { scrollIntoView: () => void }).scrollIntoView = () => scrolled.push(asset.id);
      }
      return { root, scrolled };
    }
    describe("resource manager import reveal", () => {
      it("marks the just-imported row so it stands out from the bundled list", () => {
        const { root } = renderWorkbench(ASSET_ID);

        const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
        const older = findByTestId(root, "resource-upload-charset_img_old") as FakeElement | null;
        expect(fresh?.dataset.recent).toBe("true");
        expect(older?.dataset.recent).toBeUndefined();
      });

      it("leaves every row unmarked when nothing was just imported", () => {
        const { root } = renderWorkbench();

        const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
        expect(fresh?.dataset.recent).toBeUndefined();
      });

      it("scrolls the just-imported row into view", () => {
        const container = document.createElement("div");
        document.body.append(container);
        const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
        const scrolled: string[] = [];
        // scrollIntoView 는 렌더 도중 불리므로 프로토타입에서 가로챈다.
        const proto = Object.getPrototypeOf(container) as { scrollIntoView: () => void };
        const original = proto.scrollIntoView;
        proto.scrollIntoView = function patched(this: { dataset?: Record<string, string> }): void {
          scrolled.push(this.dataset?.recent === "true" ? "recent" : "other");
        };
        try {
          renderResourceWorkbench(container, {
            categories: [{ kind: "charset", label: "캐릭터셋" }],
            selectedKind: "charset",
            profiles: [],
            uploaded,
            kindSelect: document.createElement("select") as HTMLSelectElement,
            fileInput: document.createElement("input") as HTMLInputElement,
            actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
            onSelectKind: () => {},
            onImport: () => {},
            recentAssetId: ASSET_ID,
          });
        } finally {
          proto.scrollIntoView = original;
        }

        expect(scrolled).toEqual(["recent"]);
      });
    });
  });
});

describe("retiredObjects", () => {
  isolateTimers();
  function bundledTilesets(): Record<string, TilesetDef> {
    const project = createBlankProject();
    ensureBundledTilesets(project);
    return project.tilesets;
  }
  describe("retired objects", () => {
    let tilesets: Record<string, TilesetDef>;
    beforeAll(() => { tilesets = bundledTilesets(); });

    it("names only objects that still exist in their bundled tileset", () => {
      const stale: string[] = [];
      for (const [tilesetId, ids] of retiredObjectIds()) {
        const kits = new Set((tilesets[tilesetId]?.structureKits ?? []).map((kit) => kit.id));
        for (const id of ids) if (!kits.has(id)) stale.push(`${tilesetId}:${id}`);
      }
      expect(stale).toEqual([]);
    });

    it("drops a retired kit from the object search, album and assistant dictionary but keeps its definition", () => {
      const gyms = tilesets["monster_gyms"]!;
      const leaderMat = "mk-monster-gyms-g_leader_mat";
      expect(isRetiredObject(gyms.id, leaderMat)).toBe(true);
      expect(gyms.structureKits?.some((kit) => kit.id === leaderMat)).toBe(true);
      expect(propsForTileset(gyms).map((choice) => choice.id)).not.toContain(leaderMat);
      expect(albumEntries(gyms).map(albumEntryId)).not.toContain(leaderMat);
      expect(buildStampObjectIndex(gyms).map((entry) => entry.id)).not.toContain(leaderMat);
      expect(propsForTileset(gyms).map((choice) => choice.id)).toContain("mk-monster-gyms-g_bigrock");

      const unlisted: TilesetDef = { ...gyms, id: "unlisted_copy_of_monster_gyms" };
      expect(propsForTileset(unlisted).map((choice) => choice.id)).toContain(leaderMat);
      expect(albumEntries(unlisted).map(albumEntryId)).toContain(leaderMat);
      expect(buildStampObjectIndex(unlisted).map((entry) => entry.id)).toContain(leaderMat);
    });

    it("does not retire the same id in a tileset that is not listed", () => {
      expect(isRetiredObject("monster_climate", "mk-monster-gyms-g_leader_mat")).toBe(false);
      expect(isRetiredObject(undefined, "mk-monster-gyms-g_leader_mat")).toBe(false);
    });
  });
});

describe("revealPaletteTileFromMap", () => {
  isolateTimers();
  describe("revealPaletteTileFromMap (eyedropper → chipset)", () => {
    let restoreDom: (() => void) | null = null;
    let storage: Map<string, string>;

    beforeEach(() => {
      restoreDom = installFakeDom();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          requestAnimationFrame: (cb: (t: number) => void) => {
            cb(0);
            return 0;
          },
          setTimeout: (cb: () => void) => {
            cb();
            return 0;
          },
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
          scrollTo: () => {},
          scrollX: 0,
          scrollY: 0,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        },
      });
      storage = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
          getItem: (k: string) => storage.get(k) ?? null,
          setItem: (k: string, v: string) => {
            storage.set(k, v);
          },
          removeItem: (k: string) => {
            storage.delete(k);
          },
          clear: () => storage.clear(),
          key: () => null,
          length: 0,
        },
      });
      store.replace(createBlankProject());
      editorState.set({
        currentMapId: store.getCurrent().startMapId,
        layer: "lower",
        tool: "paint",
        selectedTile: 0,
      });
      document.body.replaceChildren();
    });

    afterEach(() => {
      document.body.replaceChildren();
      restoreDom?.();
      restoreDom = null;
    });

    it("re-renders the palette root when present", () => {
      const root = document.createElement("div");
      root.dataset.testid = "left-palette-root";
      document.body.append(root);
      editorState.set({ selectedTile: 105, layer: "lower" });
      revealPaletteTileFromMap(105);
      expect(root.childElementCount).toBeGreaterThan(0);
    });

    // 좌패널 1면 통합(2026-08-21) 회귀 방지: 예전에는 스포이트가 작업 탭을 "칠하기"로
    // 강제하고 localStorage 에 썼다 — 감독이 고른 탭이 조용히 덮였다. 탭 자체가 없어졌으니
    // 이 함수는 저장소를 건드릴 이유가 없다.
    it("does not write any palette tab state to storage", () => {
      const root = document.createElement("div");
      root.dataset.testid = "left-palette-root";
      document.body.append(root);
      editorState.set({ selectedTile: 105, layer: "lower" });
      revealPaletteTileFromMap(105);
      expect(localStorage.getItem("oprn:palette-work-tab")).toBeNull();
      expect([...storage.keys()].filter((key) => key.includes("palette-work-tab"))).toEqual([]);
    });
  });
});

describe("setGroupLayout", () => {
  isolateTimers();
  type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
  type SetGroupLayoutData = {
    readonly axis: "horizontal" | "vertical";
    readonly groupId: string;
    readonly tilesetId: string;
  };
  function contextWithGroup(): ToolContext {
    // set_group_layout 은 tilesetId 를 생략하면 시작 맵의 칩셋을 쓴다 — 시작 맵을 합본 마을 위에 둔다.
    const project = startOnRetiredCombinedTown(createBlankProject());
    project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [layoutGroup()];
    return { project };
  }
  function layoutGroup(): TileGroupMetadata {
    return {
      defaultLayer: "upper",
      description: "2칸 나무",
      id: "tree-pair",
      name: "나무 2칸",
      placementRules: "위/아래 한 덩어리",
      role: "prop",
      tileIds: [100],
    };
  }
  function groupOf(ctx: ToolContext): TileGroupMetadata {
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === "tree-pair");
    if (!group) throw new Error("test group missing");
    return group;
  }
  function grammarOf(ctx: ToolContext): PatternGrammar {
    const grammar = groupOf(ctx).patternGrammar;
    if (!grammar) throw new Error("patternGrammar missing");
    return grammar;
  }
  function dataOf(value: unknown): SetGroupLayoutData {
    if (!isSetGroupLayoutData(value)) throw new Error("set_group_layout data shape mismatch");
    return value;
  }
  function isSetGroupLayoutData(value: unknown): value is SetGroupLayoutData {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    return Reflect.get(value, "tilesetId") === COMBINED_TOWN_TILESET_ID
      && typeof Reflect.get(value, "groupId") === "string"
      && (Reflect.get(value, "axis") === "vertical" || Reflect.get(value, "axis") === "horizontal");
  }
  describe("set_group_layout", () => {
    it("세로 위/아래 구성을 저장하고 샘플에서 위 칸 260, 아래 칸 290으로 배치한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: the group layout is persisted as top/bottom.
      const result = runTool(ctx, "set_group_layout", { axis: "vertical", bottom: [290], groupId: "tree-pair", top: [260] });

      // Then: the grammar, tile union, registry data, and sample placement match the saved layout.
      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toBe("구성 저장: 나무 2칸 — 위 [260] / 아래 [290] (세로)");
      expect(dataOf(result.data)).toEqual({ axis: "vertical", groupId: "tree-pair", tilesetId: COMBINED_TOWN_TILESET_ID });
      expect(grammarOf(ctx)).toEqual({
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "top", tileIds: [260] },
          { role: "bottom", tileIds: [290] },
        ],
        preserveCaps: true,
        repeat: "body",
      });
      expect(groupOf(ctx).tileIds).toEqual([100, 260, 290]);

      const sample = buildGroupSample(ctx.project.tilesets[COMBINED_TOWN_TILESET_ID], groupOf(ctx));
      expect(sample.w).toBe(5);
      expect(sample.h).toBe(2);
      expect(sample.upper[0]).toBe(260);
      expect(sample.lower[sample.w]).toBe(290);
      expect(sample.upper[sample.w]).toBe(TILE.EMPTY);
      expect(sample.lower[0]).toBe(TILE.GRASS);
    });

    it("가로 좌/우 구성을 leftCap/rightCap 문법으로 저장한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: the group layout is persisted as left/right.
      const result = runTool(ctx, "set_group_layout", {
        axis: "horizontal",
        groupId: "tree-pair",
        left: [210],
        right: [211],
        tilesetId: COMBINED_TOWN_TILESET_ID,
      });

      // Then: the horizontal expandable grammar uses the supported cap roles.
      expect(result.ok, result.summary).toBe(true);
      expect(grammarOf(ctx)).toEqual({
        axis: "horizontal",
        kind: "horizontal_expandable",
        minHeight: 1,
        minWidth: 2,
        parts: [
          { role: "leftCap", tileIds: [210] },
          { role: "rightCap", tileIds: [211] },
        ],
        preserveCaps: true,
        repeat: "body",
      });
      expect(groupOf(ctx).tileIds).toEqual([100, 210, 211]);
    });

    it("없는 그룹/타일셋, 축별 필수 파트 누락, 잘못된 타일 id를 거부한다", () => {
      // Given: a project with one editable tile group.
      const ctx = contextWithGroup();

      // When: invalid layout requests are made.
      const missingGroup = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "missing", top: [260] });
      const missingTileset = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair", tilesetId: "missing", top: [260] });
      const missingVerticalParts = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair" });
      const invalidTile = runTool(ctx, "set_group_layout", { axis: "horizontal", groupId: "tree-pair", right: [9999] });

      // Then: all invalid calls fail without replacing the existing group layout.
      expect(missingGroup.ok).toBe(false);
      expect(missingGroup.issues?.[0]?.code).toBe("group-not-found");
      expect(missingTileset.ok).toBe(false);
      expect(missingTileset.issues?.[0]?.code).toBe("tileset-not-found");
      expect(missingVerticalParts.ok).toBe(false);
      expect(missingVerticalParts.issues?.[0]?.code).toBe("invalid-args");
      expect(invalidTile.ok).toBe(false);
      expect(invalidTile.issues?.[0]?.code).toBe("tile-out-of-range");
      expect(groupOf(ctx).patternGrammar).toBeUndefined();
    });

    it("레지스트리에 등록되고 브라우저는 활성 툴만 노출한다", () => {
      const toolNames = allTools().map((tool) => tool.name);
      // set_group_layout 은 deprecated 레거시 — getTool 호환만 유지, 브라우저 숨김.
      expect(toolNames).toContain("set_group_layout");
      expect(getTool("set_group_layout")?.deprecated).toBe(true);
      const categoryNames = TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name));
      expect(categoryNames).not.toContain("set_group_layout");
    });
  });
});

describe("sidebarFocus", () => {
  isolateTimers();
  describe("sidebarFocus - Focus survival & Roving Tabindex", () => {
    let container: HTMLElement;
    let restoreFakeDom: () => void;

    beforeEach(() => {
      restoreFakeDom = installFakeDom();
      container = document.createElement("div");
      document.body.replaceChildren(container);
    });

    afterEach(() => {
      restoreFakeDom();
    });

    describe("captureFocus & restoreFocus", () => {
      it("preserves a search caret while filtering replaces the input", () => {
        const input = document.createElement("input");
        input.type = "search";
        input.dataset.testid = "tile-search-input";
        input.value = "xab";
        container.append(input);
        input.focus();
        input.setSelectionRange(1, 1);
        const snapshot = captureFocus(container);
        const replacement = document.createElement("input");
        replacement.type = "search";
        replacement.dataset.testid = input.dataset.testid;
        replacement.value = input.value;
        container.replaceChildren(replacement);
        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(replacement);
        expect(replacement.selectionStart).toBe(1);
        expect(replacement.selectionEnd).toBe(1);
      });

      it("captures and restores focus by data-testid", () => {
        const btn1 = document.createElement("button");
        btn1.dataset.testid = "tool-paint";
        const btn2 = document.createElement("button");
        btn2.dataset.testid = "tool-fill";
        container.append(btn1, btn2);
        btn2.focus();
        expect(document.activeElement).toBe(btn2);

        const snapshot = captureFocus(container);
        expect(snapshot).not.toBeNull();

        // Clear container and simulate rebuild
        container.replaceChildren();

        const newBtn1 = document.createElement("button");
        newBtn1.dataset.testid = "tool-paint";
        const newBtn2 = document.createElement("button");
        newBtn2.dataset.testid = "tool-fill";
        container.append(newBtn1, newBtn2);

        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(newBtn2);
      });

      it("falls back to DOM path/index when data-testid is absent", () => {
        const btn1 = document.createElement("button");
        const btn2 = document.createElement("button");
        container.append(btn1, btn2);
        btn2.focus();

        const snapshot = captureFocus(container);
        container.replaceChildren();

        const newBtn1 = document.createElement("button");
        const newBtn2 = document.createElement("button");
        container.append(newBtn1, newBtn2);

        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(newBtn2);
      });

      it("does not restore focus if activeElement was outside the container", () => {
        const outsideBtn = document.createElement("button");
        document.body.append(outsideBtn);
        outsideBtn.focus();

        const snapshot = captureFocus(container);
        expect(snapshot).toBeNull();

        const newBtn = document.createElement("button");
        newBtn.dataset.testid = "tool-fill";
        container.append(newBtn);

        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(outsideBtn);
      });

      it("restores focus to oprn-tool-overflow anchor when focused element inside overflow dropdown disappears", () => {
        const toolbar = document.createElement("div");
        toolbar.setAttribute("role", "toolbar");

        const overflowTrigger = document.createElement("button");
        overflowTrigger.dataset.testid = "oprn-tool-overflow";

        const dropdown = document.createElement("div");
        dropdown.dataset.testid = "toolbar-overflow-dropdown";

        const brush2Btn = document.createElement("button");
        brush2Btn.dataset.testid = "brush-size-2";
        dropdown.append(brush2Btn);

        toolbar.append(overflowTrigger, dropdown);
        container.append(toolbar);

        brush2Btn.focus();
        expect(document.activeElement).toBe(brush2Btn);

        const snapshot = captureFocus(container);

        // Rebuild container with dropdown closed (brush-size-2 is gone)
        container.replaceChildren();
        const newToolbar = document.createElement("div");
        newToolbar.setAttribute("role", "toolbar");
        const newOverflowTrigger = document.createElement("button");
        newOverflowTrigger.dataset.testid = "oprn-tool-overflow";
        newToolbar.append(newOverflowTrigger);
        container.append(newToolbar);

        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(newOverflowTrigger);
      });
      it("escapes data-testid unconditionally for quoted string attribute selectors", () => {
        expect(cssEscape('foo"bar\\baz')).toBe('foo\\"bar\\\\baz');
      });

      it("falls back to the anchor named by an ancestor's data-focus-fallback-anchor", () => {
        const rail = document.createElement("div");
        const toggle = document.createElement("button");
        toggle.dataset.testid = "basic-rail-toggle-tiles";
        const flyout = document.createElement("div");
        flyout.dataset.testid = "basic-rail-flyout";
        flyout.dataset.focusFallbackAnchor = "basic-rail-toggle-tiles";
        const closeBtn = document.createElement("button");
        closeBtn.dataset.testid = "basic-flyout-close";
        flyout.append(closeBtn);
        rail.append(toggle, flyout);
        container.append(rail);

        closeBtn.focus();
        const snapshot = captureFocus(container);
        expect(snapshot?.fallbackAnchorTestId).toBe("basic-rail-toggle-tiles");

        // Rebuild with the flyout closed — the close button no longer exists.
        container.replaceChildren();
        const newRail = document.createElement("div");
        const newToggle = document.createElement("button");
        newToggle.dataset.testid = "basic-rail-toggle-tiles";
        newRail.append(newToggle);
        container.append(newRail);

        restoreFocus(container, snapshot);
        expect(document.activeElement).toBe(newToggle);
      });
    });

    describe("applyRovingTabindex & keyboard navigation", () => {
      it("드롭다운 버튼은 roving tabindex 를 받지 않아 Tab 순서에 남고, 그 안에서 누른 화살표는 도구막대 포커스를 옮기지 않는다", () => {
        const toolbar = document.createElement("div");
        toolbar.setAttribute("role", "toolbar");

        const tool1 = document.createElement("button");
        tool1.dataset.testid = "tool-paint";
        tool1.classList.add("active");

        const overflowTrigger = document.createElement("button");
        overflowTrigger.dataset.testid = "oprn-tool-overflow";

        const dropdown = document.createElement("div");
        dropdown.dataset.testid = "toolbar-overflow-dropdown";

        const copyBtn = document.createElement("button");
        copyBtn.dataset.testid = "copy-button";
        const brush4Btn = document.createElement("button");
        brush4Btn.dataset.testid = "brush-size-4";

        dropdown.append(copyBtn, brush4Btn);
        toolbar.append(tool1, overflowTrigger, dropdown);
        container.append(toolbar);

        applyRovingTabindex(container);

        // Toolbar buttons get roving tabindex
        expect(tool1.getAttribute("tabindex")).toBe("0");
        expect(overflowTrigger.getAttribute("tabindex")).toBe("-1");

        // Dropdown buttons must NOT get tabindex="-1"
        expect(copyBtn.getAttribute("tabindex")).toBeNull();
        expect(brush4Btn.getAttribute("tabindex")).toBeNull();

        // Arrow keys inside dropdown must NOT preventDefault or hijack focus to toolbar
        copyBtn.focus();
        let prevented = false;
        const arrowDownEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
        arrowDownEvent.key = "ArrowDown";
        arrowDownEvent.preventDefault = () => { prevented = true; };

        copyBtn.dispatchEvent(arrowDownEvent);
        expect(prevented).toBe(false);
        expect(document.activeElement).toBe(copyBtn);
      });
      it("data-roving 그룹도 roving tabindex 를 받고 aria-current 로 활성 버튼을 고른다", () => {
        const group = document.createElement("div");
        group.setAttribute("role", "group");
        group.dataset.roving = "true";

        const first = document.createElement("button");
        first.dataset.testid = "layer-lower";
        first.setAttribute("aria-current", "false");
        const second = document.createElement("button");
        second.dataset.testid = "layer-upper";
        second.setAttribute("aria-current", "true");
        const third = document.createElement("button");
        third.dataset.testid = "layer-event";
        third.setAttribute("aria-current", "false");

        group.append(first, second, third);
        container.append(group);

        applyRovingTabindex(container);

        expect(first.getAttribute("tabindex")).toBe("-1");
        expect(second.getAttribute("tabindex")).toBe("0");
        expect(third.getAttribute("tabindex")).toBe("-1");

        second.focus();
        const downEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
        downEvent.key = "ArrowDown";
        second.dispatchEvent(downEvent);
        expect(document.activeElement).toBe(third);
        expect(third.getAttribute("tabindex")).toBe("0");
        expect(second.getAttribute("tabindex")).toBe("-1");
      });

      it("sets tabindex=0 on active button and tabindex=-1 on others", () => {
        const toolbar = document.createElement("div");
        toolbar.setAttribute("role", "toolbar");
        toolbar.dataset.testid = "oprn-tile-toolbar";

        const btn1 = document.createElement("button");
        btn1.dataset.testid = "oprn-tool-undo";
        const btn2 = document.createElement("button");
        btn2.dataset.testid = "tool-select";
        btn2.classList.add("active");
        const btn3 = document.createElement("button");
        btn3.dataset.testid = "tool-fill";

        toolbar.append(btn1, btn2, btn3);
        container.append(toolbar);

        applyRovingTabindex(container);

        expect(btn1.getAttribute("tabindex")).toBe("-1");
        expect(btn2.getAttribute("tabindex")).toBe("0");
        expect(btn3.getAttribute("tabindex")).toBe("-1");
      });

      it("moves focus on ArrowRight / ArrowLeft / Home / End and stops propagation", () => {
        const toolbar = document.createElement("div");
        toolbar.setAttribute("role", "toolbar");

        const btn1 = document.createElement("button");
        btn1.dataset.testid = "tool-paint";
        const btn2 = document.createElement("button");
        btn2.dataset.testid = "tool-fill";
        const btn3 = document.createElement("button");
        btn3.dataset.testid = "tool-erase";

        toolbar.append(btn1, btn2, btn3);
        container.append(toolbar);

        applyRovingTabindex(container);

        btn1.focus();
        expect(document.activeElement).toBe(btn1);

        let stopped = false;
        let prevented = false;
        const rightEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
        rightEvent.key = "ArrowRight";
        rightEvent.stopPropagation = () => { stopped = true; };
        rightEvent.preventDefault = () => { prevented = true; };

        btn1.dispatchEvent(rightEvent);
        expect(document.activeElement).toBe(btn2);
        expect(stopped).toBe(true);
        expect(prevented).toBe(true);

        // Home moves to first
        const homeEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
        homeEvent.key = "Home";
        btn2.dispatchEvent(homeEvent);
        expect(document.activeElement).toBe(btn1);

        // End moves to last
        const endEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
        endEvent.key = "End";
        btn1.dispatchEvent(endEvent);
        expect(document.activeElement).toBe(btn3);
      });
    });
  });
});

describe("spatialManualBuildBoundary", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  it("builds canonical place maps when the gallery carries explicit library identity", () => {
    // Given
    const fixture = placeCompilerFixture();
    const document = fixtureDocument(fixture);
    const source = own(document.occurrences, placeRoot).source;
    const project = { ...fixture, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
    installManualProject(project);
    patchSpatialSession({ tab: "places", mode: "design" });
    const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === source.id);
    const canonical = authoringValue(resolveSpatialBuildSource(card));
    if (canonical.kind !== "place") throw new TypeError("Expected place source");
    // When
    const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: canonical.kind, id: canonical.id },
      rootId: spatialId("new-place-not-fixture-root"), seed: 19, destination: { kind: "new-maps" } }));
    // Then
    expect(card).toMatchObject({ canonicalSource: { kind: "place", id: source.id } });
    const built = fixtureDocument(preview.project);
    expect(built.rootOccurrenceIds).toEqual(["new-place-not-fixture-root"]);
    expect(Object.keys(preview.project.maps).length).toBeGreaterThan(Object.keys(project.maps).length);
    expect(Object.values(built.occurrences).every(occurrence => occurrence.seed === 19 && occurrence.parentSlot !== undefined)).toBe(true);
    expect(store.getCurrent()).toEqual(project);
  });
  it.each(["objects", "spaces"] as const)("carries true canonical identity for %s without deriving it from kit IDs", tab => {
    // Given
    manualBuildFixture();
    patchSpatialSession({ tab, mode: "design" });
    const id = tab === "objects" ? "hearth-design" : spaceDesign;
    const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === id);
    // When
    const source = authoringValue(resolveSpatialBuildSource(card));
    // Then
    expect(source).toEqual({ kind: tab === "objects" ? "object" : "space", id });
  });
  it("requires explicit conversion when a compatibility card has a coincident canonical localId", () => {
    // Given
    manualBuildFixture();
    const card = { id: "legacy-room", localId: spaceDesign, name: "Compiler room", source: "own", kind: "spaces",
      usage: 0, compatibility: "room-rule" } as const;
    // When
    const result = resolveSpatialBuildSource(card);
    // Then
    expect(result).toMatchObject({ kind: "error", error: { code: "unsupported", message: "canonical-copy-required" } });
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it.each(["selection", "entry", "map-mismatch", "fractional-seed"] as const)("rejects missing or invalid %s before a proposal is issued", fault => {
    // Given
    const { project, target } = manualBuildFixture();
    // When
    const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("invalid-target"),
      seed: fault === "fractional-seed" ? 19.5 : 19, destination: { kind: "map", currentMapId: target.mapId,
        selection: fault === "selection" ? null : { ...target.rect, mapId: fault === "map-mismatch" ? "other-map" : target.mapId },
        entry: fault === "entry" ? null : target.entry } });
    // Then
    expect(result.kind).toBe("error");
    expect(hasAuthoringPreview()).toBe(false);
    expect(store.getCurrent()).toEqual(project);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("discloses the original frozen proposal when source and seed controls change", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("disclosed-root"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    const preview = authoringValue(previewSpatialSourceBuild(input));
    patchSpatialSession({ designId: "another-visible-source" });
    // When
    const result = previewSpatialSourceBuild({ ...input, seed: 31 });
    // Then
    expect(result).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
    expect(spatialBuildProposal()).toEqual({ input, preview });
    expect(Object.isFrozen(spatialBuildProposal()?.input)).toBe(true);
  });
  it("drops transient build inputs when project identity changes", () => {
    // Given
    const { project } = manualBuildFixture();
    authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("project-one"), seed: 19,
      destination: { kind: "new-maps" } }));
    // When
    store.replaceProject(project);
    // Then
    expect(spatialBuildProposal()).toBeNull();
    expect(hasAuthoringPreview()).toBe(false);
  });
});
