import { REGION_REFERENCES } from "@/project/regionReferences";
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSpatialGalleryCards, spatialCardById, spatialPresentationId } from "@/editor/panels/spatialCatalog";
import {
  bindSpatialAuthoringControllerFactory,
  editAuthoringDraft,
  previewAuthoringDraft,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import type { SpatialAuthoringController, SpatialAuthoringDraft, SpatialAuthoringPreview } from "@/editor/spatial/authoringTypes";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { placeDesign } from "./support/spatialSchemaFixture";
import {
  resetSpatialAuthoringSessions,
  setSpatialTab,
  spatialSession,
  type SpatialAuthoringSession,
} from "@/editor/panels/spatialAuthoringSession";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { spatialFixture } from "./support/spatialSchemaFixture";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness/combinedTownGroups";
import { MATERIAL_SLOT_IDS } from "@/editor/operators/materialSlots";
import { OUTDOOR_OBJECT_CATALOG, outdoorObjectById } from "@/project/defaults/spatial/outdoorObjectCatalog";
import { SPACE_CATALOG, spaceDefById } from "@/project/defaults/spatial/spaceCatalog";
import { PLACE_CATALOG, placeDefById, FACILITY_ENTRY_PORT_ID } from "@/project/defaults/spatial/placeCatalog";
import { REGION_CATALOG, WORLD_CATALOG, GEOGRAPHY_TERRAIN, regionDefById, regionsOfWorld } from "@/project/defaults/spatial/geographyCatalog";
import { buildOutdoorObjectKits, buildSpatialCatalogLibrary } from "@/editor/content/spatial/catalogSeed";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";


const previous = store.getCurrent();

function sessionFor(patch: Partial<SpatialAuthoringSession>): SpatialAuthoringSession {
  return {
    ...spatialSession(),
    ...patch,
  };
}

function furnitureKit(id: string, name: string) {
  return {
    id,
    name,
    kind: "section" as const,
    width: 1,
    height: 1,
    rows: [{ tiles: [0] }],
    learnedFrom: "user-paint" as const,
    ai: { snap: "floor" as const, interiorRole: "bed" },
  };
}

beforeEach(() => {
  resetSpatialAuthoringSessions();
  store.replace(createBlankProject(), { preserveEventDrafts: false });
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions();
  store.replace(previous, { preserveEventDrafts: false });
});

describe("spatial catalog source fidelity", () => {
  it("shows one canonical object for a registered graphic and retains unrelated compatibility kits", () => {
    const { project, document, tilesetId } = spatialFixture();
    project.tilesets[tilesetId]!.structureKits!.push(furnitureKit("unregistered", "Unregistered"));
    store.replace({ ...project, spatialAuthoring: document } as unknown as ReturnType<typeof store.getCurrent>);
    const cards = listSpatialGalleryCards(sessionFor({ tab: "objects", source: "own", mode: "design" }));
    expect(cards.filter((card) => card.tilesetId === tilesetId && card.objectId === "kit").map((card) => card.id))
      .toEqual([spatialPresentationId("library-object", "library", "desk")]);
    expect(cards.some((card) => card.id === spatialPresentationId("tileset-kit", tilesetId, "unregistered"))).toBe(true);
  });

  it("keeps authored furniture and builtin-id overrides beside defaults", () => {
    // Given: user furniture plus an override that reuses a builtin local id
    const tilesetIds = Object.keys(store.getCurrent().tilesets);
    const first = tilesetIds[0];
    const second = tilesetIds[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error("blank project needs two tilesets");
    store.update((draft) => {
      const a = draft.tilesets[first];
      const b = draft.tilesets[second];
      if (!a || !b) throw new Error("missing tilesets");
      a.structureKits = [furnitureKit("bed_v", "Authored Bed V"), furnitureKit("my_chair", "Workshop Chair")];
      b.structureKits = [furnitureKit("bed_v", "Other Atlas Bed")];
    });
    setSpatialTab("objects");

    // When
    const defaults = listSpatialGalleryCards(sessionFor({ tab: "objects", source: "defaults", mode: "design" }));
    const own = listSpatialGalleryCards(sessionFor({ tab: "objects", source: "own", mode: "design" }));
    const selected = spatialCardById(sessionFor({ tab: "objects", source: "own", mode: "design" }), spatialPresentationId("tileset-kit", first, "bed_v"));

    // Then: defaults stay builtin; own cards keep authored names and distinct presentation ids
    expect(defaults.find((card) => card.id === "bed_v")?.name).not.toBe("Authored Bed V");
    expect(defaults.find((card) => card.id === "bed_v")?.source).toBe("default");
    // 배송 칩셋 가운데 구조 킷을 이미 갖는 것(성벽 실측 부품·공용 숲 오브젝트)은
    // 사용자가 만든 것이 아니므로 내 설계 목록에 나오지 않는다.
    expect(own.some((card) => card.tilesetId === "opengameart_castle")).toBe(false);
    expect(defaults.some((card) => card.tilesetId === "opengameart_castle" && card.objectId === "castle-measured-fountain")).toBe(true);
    expect(own.map((card) => card.id).sort()).toEqual(
      [
        spatialPresentationId("tileset-kit", first, "bed_v"),
        spatialPresentationId("tileset-kit", first, "my_chair"),
        // 두 번째 타일셋에 저작한 킷도 내 것이다(번들 시트여도 시드 킷이 아니다).
        spatialPresentationId("tileset-kit", second, "bed_v"),
      ].sort(),
    );
    expect(own.find((card) => card.id === spatialPresentationId("tileset-kit", first, "bed_v"))?.name).toBe("Authored Bed V");
    expect(own.find((card) => card.id === spatialPresentationId("tileset-kit", second, "bed_v"))?.name).toBe("Other Atlas Bed");
    expect(own.find((card) => card.id === spatialPresentationId("tileset-kit", first, "my_chair"))?.name).toBe("Workshop Chair");
    expect(selected?.name).toBe("Authored Bed V");
    expect(selected?.objectId).toBe("bed_v");
    expect(selected?.tilesetId).toBe(first);
  });

  it("does not bind builtin object cards to an arbitrary first atlas", () => {
    // Given: canonical interior atlas removed
    store.update((draft) => {
      delete draft.tilesets[INTERIOR_ROOM_TILESET_ID];
    });
    const firstAtlas = Object.keys(store.getCurrent().tilesets)[0];
    expect(firstAtlas).toBeDefined();

    // When
    const cards = listSpatialGalleryCards(sessionFor({ tab: "objects", source: "defaults", mode: "design" }));
    const bed = cards.find((card) => card.id === "bed_v");

    // Then
    expect(bed).toBeDefined();
    expect(bed?.tilesetId).toBeUndefined();
    expect(bed?.tilesetId).not.toBe(firstAtlas);
  });

  it("labels legacy room rules and house shapes as compatibility sources", () => {
    // Given
    const tilesetId = Object.keys(store.getCurrent().tilesets)[0];
    expect(tilesetId).toBeDefined();
    if (!tilesetId) throw new Error("missing tileset");
    store.update((draft) => {
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset");
      tileset.interiorRoomKinds = [{ id: "bedroom", label: "Legacy Bedroom", requiredRoles: ["bed"] }];
      draft.villageTemplates = [{ id: "cottage", name: "Cottage", w: 6, h: 6, wings: [{ x: 0, y: 0, w: 6, h: 6 }] }];
    });

    // When
    const spaces = listSpatialGalleryCards(sessionFor({ tab: "spaces", source: "own", mode: "design" }));
    const places = listSpatialGalleryCards(sessionFor({ tab: "places", source: "own", mode: "design" }));
    const room = spaces.find((card) => card.id === spatialPresentationId("tileset-room", tilesetId, "bedroom"));
    const house = places.find((card) => card.id === spatialPresentationId("house-template", "house-shape", "cottage"));

    // Then
    expect(room?.name).toBe("Legacy Bedroom");
    expect(room?.compatibility).toBe("room-rule");
    expect(house?.name).toBe("Cottage");
    expect(house?.compatibility).toBe("house-shape");
    expect(house?.placeKind).toBe("settlement");
  });

  it("marks occurrences missing when the live library drops the source but keeps the snapshot name", () => {
    // Given
    const { project, document } = spatialFixture();
    store.replace(project, { preserveEventDrafts: false });
    store.update((draft) => {
      draft.spatialAuthoring = structuredClone(document);
      const next = { ...draft.spatialAuthoring.library.spaces };
      delete next.room;
      draft.spatialAuthoring = {
        ...draft.spatialAuthoring,
        library: { ...draft.spatialAuthoring.library, spaces: next },
      };
    });
    const snapshotName = document.occurrences["occ-a"]?.snapshot.library.spaces.room?.name;
    expect(snapshotName).toBeDefined();

    // When
    const cards = listSpatialGalleryCards(sessionFor({ tab: "spaces", mode: "instances", source: "all" }));
    const card = cards.find((entry) => entry.id === "occ-a");

    // Then
    expect(card?.name).toBe(snapshotName);
    expect(card?.missingSource).toBe(true);
  });


  it("keeps injective source-qualified ids for colon fragments, library scope, house shapes, and Unicode", () => {
    const donorId = Object.keys(store.getCurrent().tilesets)[0];
    if (!donorId) throw new Error("missing donor tileset");
    const donor = store.getCurrent().tilesets[donorId];
    if (!donor) throw new Error("missing donor");
    store.update((draft) => {
      const clone = (id: string) => ({ ...structuredClone(donor), id, structureKits: [] as typeof donor.structureKits });
      draft.tilesets["atlas::west"] = {
        ...clone("atlas::west"),
        structureKits: [furnitureKit("bed", "Colon-scope bed")],
      };
      draft.tilesets.atlas = {
        ...clone("atlas"),
        structureKits: [furnitureKit("west::bed", "Colon-local bed")],
      };
      draft.tilesets.library = {
        ...clone("library"),
        structureKits: [furnitureKit("desk", "Tileset-library desk")],
      };
      draft.tilesets["서부::한"] = {
        ...clone("서부::한"),
        structureKits: [furnitureKit("침대", "Unicode colon-scope")],
      };
      draft.tilesets["서부"] = {
        ...clone("서부"),
        structureKits: [furnitureKit("한::침대", "Unicode colon-local")],
      };
      draft.spatialAuthoring = {
        version: 1,
        library: {
          objects: {
            desk: {
              id: "desk",
              name: "Canonical library desk",
              revision: 1,
              tags: [],
              provenance: { origin: "user" },
              graphic: { tilesetId: donorId, kitId: "kit" },
              anchors: [],
              chips: [],
            },
          },
          spaces: {},
          places: {},
          regions: {},
          worlds: {},
        },
        occurrences: {},
        rootOccurrenceIds: [],
        connections: [],
        legacyImport: {
          version: 1,
          sourceHash: "0".repeat(64),
          mapping: [],
          backup: { encoding: "raw-json", json: "{}", sha256: "0".repeat(64) },
        },
      };
      draft.villageTemplates = [{ id: "cottage", name: "Template Cottage", w: 6, h: 6, wings: [{ x: 0, y: 0, w: 6, h: 6 }] }];
      draft.villagePresets = [{ id: "cottage", name: "Preset Cottage" }];
    });

    const objects = listSpatialGalleryCards(sessionFor({ tab: "objects", source: "own", mode: "design" }));
    const places = listSpatialGalleryCards(sessionFor({ tab: "places", source: "own", mode: "design" }));
    const regions = listSpatialGalleryCards(sessionFor({ tab: "regions", source: "own", mode: "design" }));
    const byName = (name: string) => objects.find((card) => card.name === name);
    expect(byName("Colon-scope bed")?.tilesetId).toBe("atlas::west");
    expect(byName("Colon-scope bed")?.objectId).toBe("bed");
    expect(byName("Colon-local bed")?.tilesetId).toBe("atlas");
    expect(byName("Colon-local bed")?.objectId).toBe("west::bed");
    expect(byName("Tileset-library desk")?.tilesetId).toBe("library");
    expect(byName("Canonical library desk")?.name).toBe("Canonical library desk");
    expect(byName("Unicode colon-scope")?.tilesetId).toBe("서부::한");
    expect(byName("Unicode colon-local")?.objectId).toBe("한::침대");
    expect(objects.filter((card) => card.name === "Colon-scope bed" || card.name === "Colon-local bed")).toHaveLength(2);
    expect(objects.filter((card) => card.name === "Tileset-library desk" || card.name === "Canonical library desk")).toHaveLength(2);
    expect(places.filter((card) => card.name === "Template Cottage")).toHaveLength(1);
    expect(regions.filter((card) => card.name === "Preset Cottage")).toHaveLength(1);
    expect(regions.find((card) => card.name === "Preset Cottage")?.regionKind).toBe("settlement");
    expect(new Set(objects.map((card) => card.id)).size).toBe(objects.length);
    expect(new Set(places.map((card) => card.id)).size).toBe(places.length);
    expect(new Set(regions.map((card) => card.id)).size).toBe(regions.length);
    expect(spatialPresentationId("tileset-kit", "atlas::west", "bed")).not.toBe(
      spatialPresentationId("tileset-kit", "atlas", "west::bed"),
    );
    expect(spatialPresentationId("tileset-kit", "library", "desk")).not.toBe(
      spatialPresentationId("library-object", "library", "desk"),
    );
    expect(spatialPresentationId("house-template", "house-shape", "cottage")).not.toBe(
      spatialPresentationId("house-preset", "house-shape", "cottage"),
    );
  });
  it("does not treat raw GameMaps as world occurrences", () => {
    // Given
    const mapIds = Object.keys(store.getCurrent().maps);
    expect(mapIds.length).toBeGreaterThan(0);

    // When
    const worlds = listSpatialGalleryCards(sessionFor({ tab: "worlds", mode: "instances", source: "all" }));
    const tiles = listSpatialGalleryCards(sessionFor({ tab: "tiles", mode: "instances", source: "all" }));

    // Then
    expect(worlds).toEqual([]);
    expect(tiles.every((card) => card.mapUsage === true)).toBe(true);
    expect(tiles.map((card) => card.mapId).sort()).toEqual([...mapIds].sort());
    expect(tiles.every((card) => card.subtitle === "맵 사용")).toBe(true);
  });
});

describe("spatial catalog draft and preview galleries", () => {
  function bindViewController(): void {
    const drafts = new WeakSet<SpatialAuthoringDraft>();
    const previews = new WeakSet<SpatialAuthoringPreview>();
    const controller: SpatialAuthoringController = {
      createDraft() {
        const value = { project: structuredClone(store.getCurrent()) };
        drafts.add(value);
        return { kind: "ok", value };
      },
      continueDraft(preview) {
        if (!previews.has(preview)) return { kind: "error", error: { code: "foreign-preview", message: "foreign" } };
        const value = { project: structuredClone(preview.project) };
        drafts.add(value);
        return { kind: "ok", value };
      },
      preview(draft) {
        if (!drafts.has(draft)) return { kind: "error", error: { code: "foreign-draft", message: "foreign" } };
        const value = { project: structuredClone(draft.project), impact: { mapIds: [], occurrenceIds: [], events: [] } };
        previews.add(value);
        return { kind: "ok", value };
      },
      apply() {
        return { kind: "error", error: { code: "unsupported", message: "catalog-view-only" } };
      },
      undo: () => false,
      redo: () => false,
    };
    bindSpatialAuthoringControllerFactory(() => controller);
  }

  it("lists a draft place without writing the live store", () => {
    // Given
    const { project, document } = spatialFixture();
    store.replace({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }, { preserveEventDrafts: false });
    bindViewController();
    const before = structuredClone(store.getCurrent());
    const placeId = "dock";

    // When
    const edited = editAuthoringDraft((current) => {
      const spatial = current.spatialAuthoring;
      if (!spatial) return current;
      return {
        ...current,
        spatialAuthoring: {
          ...spatial,
          library: {
            ...spatial.library,
            places: { ...spatial.library.places, [placeId]: placeDesign(placeId, "room") },
          },
        },
      };
    });

    // Then
    expect(edited.kind).toBe("ok");
    expect(store.getCurrent()).toEqual(before);
    const cards = listSpatialGalleryCards(sessionFor({ tab: "places", source: "own", mode: "design" }));
    expect(cards.some((card) => card.localId === placeId)).toBe(true);
    expect(visibleAuthoringProject().spatialAuthoring?.library.places[placeId]).toBeDefined();
    expect(store.getCurrent().spatialAuthoring?.library.places[placeId]).toBeUndefined();
  });

  it("lists a previewed cloned occurrence without writing the live store", () => {
    // Given
    const { project, document } = spatialFixture();
    store.replace({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }, { preserveEventDrafts: false });
    bindViewController();
    const before = structuredClone(store.getCurrent());
    const cloneId = "occ-clone";

    // When
    editAuthoringDraft((current) => {
      const spatial = current.spatialAuthoring;
      const source = spatial?.occurrences["occ-a"];
      if (!spatial || !source) return current;
      return {
        ...current,
        spatialAuthoring: {
          ...spatial,
          occurrences: { ...spatial.occurrences, [cloneId]: { ...structuredClone(source), id: cloneId } },
          rootOccurrenceIds: [...spatial.rootOccurrenceIds, cloneId],
        },
      };
    });
    const previewed = previewAuthoringDraft();

    // Then
    expect(previewed.kind).toBe("ok");
    expect(store.getCurrent()).toEqual(before);
    const cards = listSpatialGalleryCards(sessionFor({ tab: "spaces", mode: "instances", source: "all" }));
    expect(cards.some((card) => card.id === cloneId)).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.occurrences[cloneId]).toBeUndefined();
  });

  it("resets hierarchy galleries when the project session switches", () => {
    // Given
    const { project, document } = spatialFixture();
    store.replace({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }, { preserveEventDrafts: false });
    bindViewController();
    editAuthoringDraft((current) => {
      const spatial = current.spatialAuthoring;
      if (!spatial) return current;
      return {
        ...current,
        spatialAuthoring: {
          ...spatial,
          library: {
            ...spatial.library,
            places: { ...spatial.library.places, dock: placeDesign("dock", "room") },
          },
        },
      };
    });
    expect(listSpatialGalleryCards(sessionFor({ tab: "places", source: "own", mode: "design" })).some((card) => card.localId === "dock")).toBe(true);

    // When
    store.replaceProject(createBlankProject());

    // Then
    expect(listSpatialGalleryCards(sessionFor({ tab: "places", source: "own", mode: "design" })).some((card) => card.localId === "dock")).toBe(false);
  });
});

describe("shipped spatial design catalog", () => {
  // 계획서 94~109행의 정본 목록. 이름이 아니라 이 표가 기준이다.
  const PLANNED_OBJECTS = [
    "outdoor-tree", "outdoor-pine", "outdoor-dead-tree", "outdoor-stump", "outdoor-rock",
    "outdoor-boulder", "outdoor-bush", "outdoor-flowers", "outdoor-well", "outdoor-sign",
    "outdoor-bench", "outdoor-lamp", "outdoor-crate", "outdoor-barrel", "outdoor-fence",
    "outdoor-gate", "outdoor-wood-bridge", "outdoor-stone-bridge", "outdoor-stairs", "outdoor-dock",
  ] as const;
  const PLANNED_SPACES = [
    "market-square", "quiet-courtyard", "kitchen-garden", "forest-clearing", "lakeshore",
    "river-crossing", "harbor-pier", "snow-camp", "mountain-gate", "cave-mouth",
    "mine-chamber", "ruined-court",
  ] as const;
  const PLANNED_PLACES = [
    "lake-village", "forest-hamlet", "harbor-town", "snow-outpost",
    "mountain-pass", "old-ruins", "working-mine", "forest-sanctuary",
  ] as const;
  const PLANNED_REGIONS = [
    { id: "lake-country", world: "lake-kingdom", places: ["lake-village", "working-mine"] },
    { id: "deep-forest", world: "lake-kingdom", places: ["forest-hamlet", "forest-sanctuary"] },
    { id: "harbor-coast", world: "lake-kingdom", places: ["harbor-town", "harbor-town"] },
    { id: "snow-frontier", world: "northern-frontier", places: ["snow-outpost", "forest-hamlet"] },
    { id: "high-pass", world: "northern-frontier", places: ["mountain-pass", "working-mine"] },
    { id: "ancient-ruins", world: "northern-frontier", places: ["old-ruins", "forest-sanctuary"] },
  ] as const;

  it("binds every outdoor object to a verified tile group with matching passability", () => {
    // Given: 배송 오브젝트와 승인된 타일 어휘.
    const harness = new Map(COMBINED_TOWN_HARNESS_GROUPS.map((group) => [group.id, group]));
    expect(OUTDOOR_OBJECT_CATALOG.map((entry) => entry.id)).toEqual([...PLANNED_OBJECTS]);

    for (const object of OUTDOOR_OBJECT_CATALOG) {
      // When: 선언한 근거에서 허용 타일을 읽는다.
      const tiles = [...new Set(object.cells.map((cell) => cell.tile))];
      const group = harness.get(object.authority);
      const chipsetKey = object.authority.startsWith("CHIPSET_TILE_GROUPS.")
        ? object.authority.slice("CHIPSET_TILE_GROUPS.".length)
        : null;
      const allowed = group
        ? [...group.tileIds]
        : chipsetKey
          ? [...(CHIPSET_TILE_GROUPS as Record<string, readonly number[]>)[chipsetKey] ?? []]
          : object.authority.replace("tileSemanticsCombinedTown:", "").split(",").map(Number);

      // Then: 모든 칸이 그 근거 안에 있고, 통행성과 레이어가 어긋나지 않는다.
      expect({ id: object.id, missing: tiles.filter((tile) => !allowed.includes(tile)) })
        .toEqual({ id: object.id, missing: [] });
      if (group) expect({ id: object.id, passage: object.passage }).toEqual({ id: object.id, passage: group.passage });
      const layers = [...new Set(object.cells.map((cell) => cell.layer))];
      expect({ id: object.id, layers }).toEqual({ id: object.id, layers: [object.passage === "passable" ? "lower" : "upper"] });
      expect(object.cells.length).toBeGreaterThan(0);
    }
  });

  it("keeps every space walkable with named ports and at least two object families", () => {
    // Given
    const slots = new Set<string>(MATERIAL_SLOT_IDS);
    expect(SPACE_CATALOG.map((entry) => entry.id)).toEqual([...PLANNED_SPACES]);

    for (const space of SPACE_CATALOG) {
      // When
      const families = new Set(space.slots.flatMap((slot) => outdoorObjectById(slot.objectId)?.families ?? []));

      // Then: 재료가 유도된 슬롯이고, 포트는 이름과 좌표를 갖고, 고정 배치가 포트를 막지 않는다.
      if (space.environment === "outdoor") {
        for (const area of space.areas) expect({ space: space.id, material: area.material, known: slots.has(area.material) })
          .toEqual({ space: space.id, material: area.material, known: true });
      }
      expect(families.size).toBeGreaterThanOrEqual(2);
      expect(space.ports.length).toBeGreaterThanOrEqual(2);
      for (const port of space.ports) {
        expect(port.name.trim().length).toBeGreaterThan(0);
        expect({ id: port.id, inside: port.x >= 0 && port.y >= 0 && port.x < space.width && port.y < space.height })
          .toEqual({ id: port.id, inside: true });
      }
      for (const slot of space.slots) {
        const object = outdoorObjectById(slot.objectId);
        expect({ space: space.id, object: slot.objectId, known: object !== undefined })
          .toEqual({ space: space.id, object: slot.objectId, known: true });
        if (!slot.at || !object || object.passage !== "solid") continue;
        const blocked = space.ports.filter((port) =>
          port.x >= slot.at!.x && port.x < slot.at!.x + object.width
          && port.y >= slot.at!.y && port.y < slot.at!.y + object.height);
        expect({ slot: slot.id, blocked: blocked.map((port) => port.id) }).toEqual({ slot: slot.id, blocked: [] });
      }
    }
  });

  it("links every place child to a port that actually exists on its design", () => {
    // Given: 배송 시설 19종과 공간 카탈로그.
    expect(PLACE_CATALOG.map((entry) => entry.id)).toEqual([...PLANNED_PLACES]);

    for (const place of PLACE_CATALOG) {
      const children = new Map(place.children.map((child) => [child.id, child]));
      expect(children.size).toBe(place.children.length);

      for (const link of place.links) {
        for (const side of [link.from, link.to]) {
          if (side.childId === null) continue;
          const child = children.get(side.childId);
          expect({ link: link.id, child: side.childId, known: child !== undefined })
            .toEqual({ link: link.id, child: side.childId, known: true });
          if (!child) continue;
          if (child.kind === "space") {
            // When/Then: 공간 자식은 선언된 포트 id 를 실제로 갖는다.
            const design = spaceDefById(child.designId);
            expect({ link: link.id, design: child.designId, port: side.portId, exists: design?.ports.some((port) => port.id === side.portId) })
              .toEqual({ link: link.id, design: child.designId, port: side.portId, exists: true });
          } else {
            // 시설 자식은 포트 목록 대신 진입 방을 갖는다. 계약 이름과 진입 방을 함께 본다.
            // 초안 시설 묶음은 공용 실내 리셋으로 은퇴했다 — 진입 방 계약만 남는다.
            expect(side.portId).toBe(FACILITY_ENTRY_PORT_ID);
          }
        }
      }
    }
  });

  it("reproduces the planned region table and keeps world overviews enterable", () => {
    // Given
    expect(REGION_CATALOG.map((entry) => entry.id)).toEqual(PLANNED_REGIONS.map((row) => row.id));

    for (const row of PLANNED_REGIONS) {
      const region = regionDefById(row.id);
      // When/Then: 소속 세계와 품는 장소가 표와 같고, 경로 폴리라인이 마커에 정확히 물린다.
      expect({ id: row.id, world: region?.world }).toEqual({ id: row.id, world: row.world });
      expect({ id: row.id, places: [...(region?.places ?? [])].map((child) => child.designId).sort() })
        .toEqual({ id: row.id, places: [...row.places].sort() });
      for (const child of region?.places ?? []) {
        expect({ child: child.id, known: placeDefById(child.designId) !== undefined })
          .toEqual({ child: child.id, known: true });
        expect({ child: child.id, inside: child.x >= 0 && child.y >= 0 && child.x < GEOGRAPHY_TERRAIN.width && child.y < GEOGRAPHY_TERRAIN.height })
          .toEqual({ child: child.id, inside: true });
      }
      for (const path of region?.routes ?? []) {
        const from = region?.places.find((child) => child.id === path.from);
        const to = region?.places.find((child) => child.id === path.to);
        expect(path.points.length).toBeGreaterThanOrEqual(2);
        expect(path.points[0]).toEqual({ x: from?.x, y: from?.y });
        expect(path.points[path.points.length - 1]).toEqual({ x: to?.x, y: to?.y });
      }
    }

    for (const world of WORLD_CATALOG) {
      const owned = regionsOfWorld(world.id).map((region) => region.id);
      // 개요는 세 지역 입구를 모두 드러내야 한다 — 시작 지역만 열면 나머지로 들어갈 수 없다.
      expect({ id: world.id, regions: world.regions.map((child) => child.designId) }).toEqual({ id: world.id, regions: owned });
      expect({ id: world.id, ports: world.ports.length }).toEqual({ id: world.id, ports: world.regions.length });
      expect(owned).toContain(world.entryRegion);
      for (const connection of world.connections) {
        expect(owned).toContain(connection.from);
        expect(owned).toContain(connection.to);
      }
    }
  });

  it("offers completed-map references as the only default region cards", () => {
    // Given: 프로젝트 라이브러리가 비어 있는 새 프로젝트.
    store.replace(createBlankProject(), { preserveEventDrafts: false });

    // When: 지역·세계 탭 갤러리를 읽는다.
    const regions = listSpatialGalleryCards(sessionFor({ tab: "regions", source: "all", mode: "design" }));
    const worlds = listSpatialGalleryCards(sessionFor({ tab: "worlds", source: "all", mode: "design" }));

    // Then: 기본 지역 카드는 완성 맵 사례뿐이다 — 지형 어휘 더미(REGION_CATALOG)는 내지 않는다.
    expect(regions.filter((card) => card.source === "default").map((card) => card.localId))
      .toEqual(REGION_REFERENCES.map(reference => reference.id));
    expect(regions.every((card) => card.regionReferenceId !== undefined || card.canonicalSource !== undefined)).toBe(true);
    expect(worlds.filter((card) => card.source === "default").map((card) => card.localId))
      .toEqual(WORLD_CATALOG.map((world) => world.id));
  });

  it("assembles the whole catalog into a library the real validator accepts", () => {
    // Given: 배송 카탈로그만으로 조립한 라이브러리.
    const library = buildSpatialCatalogLibrary();

    // When: 실제 스키마 검증기를 통과시킨다(테스트용 느슨한 사본이 아니다).
    const document = validateSpatialAuthoring({ ...emptySpatialDocument(), library });

    // Then: 48개 정의가 그대로 남고, 세계는 자기 시작 지역을 자식으로 갖는다.
    expect({
      objects: Object.keys(document.library.objects).length,
      spaces: Object.keys(document.library.spaces).length,
      places: Object.keys(document.library.places).length,
      regions: Object.keys(document.library.regions).length,
      worlds: Object.keys(document.library.worlds).length,
    }).toEqual({ objects: 20, spaces: 12, places: 8, regions: 6, worlds: 2 });

    for (const world of Object.values(document.library.worlds)) {
      const entry = world.regions.find((child) => child.id === world.entryPort.childId);
      expect({ world: world.id, entryPresent: entry !== undefined }).toEqual({ world: world.id, entryPresent: true });
    }
    // 각 오브젝트 그림은 실제 킷 행으로 구워진다 — 빈 킷은 그림이 아니다.
    const kits = buildOutdoorObjectKits();
    expect(kits).toHaveLength(20);
    for (const kit of kits) {
      const painted = kit.rows.flatMap((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])]).filter((tile) => tile >= 0);
      expect({ kit: kit.id, painted: painted.length > 0 }).toEqual({ kit: kit.id, painted: true });
    }
  });
});
