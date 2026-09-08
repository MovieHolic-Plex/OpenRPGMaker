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
    expect(own.map((card) => card.id).sort()).toEqual(
      [
        spatialPresentationId("tileset-kit", first, "bed_v"),
        spatialPresentationId("tileset-kit", first, "my_chair"),
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
    expect(places.filter((card) => card.name === "Template Cottage" || card.name === "Preset Cottage")).toHaveLength(2);
    expect(new Set(objects.map((card) => card.id)).size).toBe(objects.length);
    expect(new Set(places.map((card) => card.id)).size).toBe(places.length);
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
