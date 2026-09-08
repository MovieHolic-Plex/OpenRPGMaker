import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { store } from "@/project/store";
import type { SpatialKind } from "@/project/spatial/types";
import type { SpatialShellTab } from "@/editor/panels/spatialAuthoringSession";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { spatialPresentationId } from "@/editor/panels/spatialPresentation";

function boundInteriorTilesetId(): string | undefined {
  const tilesets = store.getCurrent().tilesets;
  return Object.hasOwn(tilesets, INTERIOR_ROOM_TILESET_ID) ? INTERIOR_ROOM_TILESET_ID : undefined;
}

function placeCards(): SpatialGalleryCard[] {
  const project = store.getCurrent();
  const tilesetId = boundInteriorTilesetId();
  const cards: SpatialGalleryCard[] = CONCEPT_FACILITY_TEMPLATES.map((bundle) => ({
    id: bundle.id,
    localId: bundle.id,
    name: bundle.label,
    source: "default",
    kind: "places",
    usage: 0,
    tilesetId,
    placeKind: "facility",
    objectId: bundle.things[0]?.objectId,
    subtitle: bundle.facilities[0]?.label,
  }));
  const known = new Set(cards.map((card) => card.id));
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.scratchConceptBundles === undefined) continue;
    for (const bundle of tileset.scratchConceptBundles) {
      const id = spatialPresentationId("tileset-bundle", tileset.id, bundle.id);
      if (known.has(id)) continue;
      known.add(id);
      cards.push({
        id,
        localId: bundle.id,
        name: bundle.label,
        source: "own",
        kind: "places",
        usage: 0,
        tilesetId: tileset.id,
        placeKind: "facility",
        objectId: bundle.things[0]?.objectId,
      });
    }
  }
  for (const template of project.villageTemplates ?? []) {
    const id = spatialPresentationId("house-template", "house-shape", template.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: template.id,
      name: template.name,
      source: "own",
      kind: "places",
      usage: 0,
      placeKind: "settlement",
      compatibility: "house-shape",
      subtitle: "호환 집 형태",
    });
  }
  for (const preset of project.villagePresets ?? []) {
    const id = spatialPresentationId("house-preset", "house-shape", preset.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: preset.id,
      name: preset.name,
      source: "own",
      kind: "places",
      usage: 0,
      placeKind: "settlement",
      compatibility: "house-shape",
      subtitle: "호환 집 형태",
    });
  }
  for (const place of Object.values(project.spatialAuthoring?.library.places ?? {})) {
    const id = spatialPresentationId("library-place", "library", place.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: place.id,
      name: place.name,
      source: "own",
      kind: "places",
      usage: 0,
      placeKind: place.kind,
    });
  }
  return cards;
}

function regionCards(): SpatialGalleryCard[] {
  return Object.values(store.getCurrent().spatialAuthoring?.library.regions ?? {}).map((region) => ({
    id: spatialPresentationId("library-region", "library", region.id),
    localId: region.id,
    name: region.name,
    source: "own" as const,
    kind: "regions" as const,
    usage: 0,
    tilesetId: region.terrain.tilesetId,
  }));
}

function worldCards(): SpatialGalleryCard[] {
  return Object.values(store.getCurrent().spatialAuthoring?.library.worlds ?? {}).map((world) => ({
    id: spatialPresentationId("library-world", "library", world.id),
    localId: world.id,
    name: world.name,
    source: "own" as const,
    kind: "worlds" as const,
    usage: 0,
    tilesetId: world.terrain.tilesetId,
  }));
}

function snapshotName(kind: SpatialKind, snapshotLibrary: {
  readonly objects: Readonly<Record<string, { readonly name: string }>>;
  readonly spaces: Readonly<Record<string, { readonly name: string }>>;
  readonly places: Readonly<Record<string, { readonly name: string }>>;
  readonly regions: Readonly<Record<string, { readonly name: string }>>;
  readonly worlds: Readonly<Record<string, { readonly name: string }>>;
}, sourceId: string): string | undefined {
  switch (kind) {
    case "object": return snapshotLibrary.objects[sourceId]?.name;
    case "space": return snapshotLibrary.spaces[sourceId]?.name;
    case "place": return snapshotLibrary.places[sourceId]?.name;
    case "region": return snapshotLibrary.regions[sourceId]?.name;
    case "world": return snapshotLibrary.worlds[sourceId]?.name;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function liveLibraryHas(kind: SpatialKind, sourceId: string): boolean {
  const library = store.getCurrent().spatialAuthoring?.library;
  if (!library) return false;
  switch (kind) {
    case "object": return Object.hasOwn(library.objects, sourceId);
    case "space": return Object.hasOwn(library.spaces, sourceId);
    case "place": return Object.hasOwn(library.places, sourceId);
    case "region": return Object.hasOwn(library.regions, sourceId);
    case "world": return Object.hasOwn(library.worlds, sourceId);
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function placedCards(tab: SpatialShellTab): SpatialGalleryCard[] {
  const project = store.getCurrent();
  const occurrences = Object.values(project.spatialAuthoring?.occurrences ?? {}).filter((entry) => {
    if (tab === "objects") return entry.kind === "object";
    if (tab === "spaces") return entry.kind === "space";
    if (tab === "places") return entry.kind === "place";
    if (tab === "regions") return entry.kind === "region";
    if (tab === "worlds") return entry.kind === "world";
    return false;
  });
  const cards: SpatialGalleryCard[] = occurrences.map((entry) => {
    const retained = snapshotName(entry.kind, entry.snapshot.library, entry.source.id);
    return {
      id: entry.id,
      localId: entry.source.id,
      name: retained ?? entry.source.id,
      source: "placed" as const,
      kind: tab,
      usage: 0,
      missingSource: !liveLibraryHas(entry.kind, entry.source.id),
      mapId: entry.bindings[0]?.mapId,
    };
  });
  if (tab === "tiles") {
    for (const map of Object.values(project.maps)) {
      cards.push({
        id: `map:${map.id}`,
        localId: map.id,
        name: map.name || map.id,
        source: "placed",
        kind: tab,
        usage: 0,
        mapId: map.id,
        tilesetId: map.tilesetId,
        mapUsage: true,
        subtitle: "맵 사용",
      });
    }
  }
  return cards;
}

export { placeCards, regionCards, worldCards, placedCards };
