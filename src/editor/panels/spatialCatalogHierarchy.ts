import { linkedRegionMapId } from "@/project/spatial/regionMapLinks";
import { REGION_REFERENCES, PLACE_REFERENCES } from "@/project/regionReferences";
import { REVIEWED_PLACES } from "@/project/defaults/spatial/reviewedPlaceCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import type { SpatialKind } from "@/project/spatial/types";
import type { SpatialShellTab } from "@/editor/panels/spatialAuthoringSession";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import { GEOGRAPHY_TERRAIN, WORLD_CATALOG } from "@/project/defaults/spatial/geographyCatalog";

function boundInteriorTilesetId(): string | undefined {
  const tilesets = visibleAuthoringProject().tilesets;
  return Object.hasOwn(tilesets, INTERIOR_ROOM_TILESET_ID) ? INTERIOR_ROOM_TILESET_ID : undefined;
}

function placeCards(): SpatialGalleryCard[] {
  const project = visibleAuthoringProject();
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
    subtitle: bundle.facilities[0]?.label === bundle.label ? undefined : bundle.facilities[0]?.label,
  }));
  cards.push(...PLACE_REFERENCES.map(entry => ({ id: `region-reference:${entry.id}`, localId: entry.id,
    regionReferenceId: entry.id, name: entry.name, source: "default" as const, kind: "places" as const,
    usage: 0, tilesetId: entry.tilesetId, placeKind: "placeKind" in entry ? entry.placeKind : "facility" as const, subtitle: "완성 장소 사례" })));
  cards.unshift(...REVIEWED_PLACES.map(place => ({ id: `reviewed-place:${place.id}`, localId: place.id, reviewedPlaceId: place.id, name: place.name, source: "default" as const, kind: "places" as const, usage: 0, placeKind: place.kind })));
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
      subtitle: "건물 외형 · 호환 도안",
    });
  }
  for (const place of Object.values(project.spatialAuthoring?.library.places ?? {})) {
    const id = spatialPresentationId("library-place", "library", place.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: place.id,
      canonicalSource: { kind: "place", id: place.id },
      name: place.name,
      source: "own",
      kind: "places",
      usage: 0,
      placeKind: place.kind,
      subtitle: `포함된 장소 ${place.children.length}`,
    });
  }
  return cards;
}

function regionCards(): SpatialGalleryCard[] {
  // 장소 탭과 같은 규약 — 실제 완성 맵에서 온 참고 사례만 기본 카드로 보인다.
  // 지형 어휘 더미 6종(REGION_CATALOG 카드)은 갤러리에 내지 않는다. 실체가 없는
  // 기본 설계가 목록을 채우면 무엇을 쓸 수 있는지가 오히려 안 보인다.
  const cards: SpatialGalleryCard[] = REGION_REFERENCES.map(entry => ({ id: `region-reference:${entry.id}`, localId: entry.id,
    regionReferenceId: entry.id, name: entry.name, source: "default" as const, kind: "regions" as const,
    usage: 0, tilesetId: entry.tilesetId, regionKind: "regionKind" in entry ? entry.regionKind : "settlement" as const, subtitle: "완성 맵 사례" }));
  const known = new Set(cards.map((card) => card.id));
  for (const region of Object.values(visibleAuthoringProject().spatialAuthoring?.library.regions ?? {})) {
    const id = spatialPresentationId("library-region", "library", region.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: region.id,
      canonicalSource: { kind: "region", id: region.id },
      name: region.name,
      regionMapId: linkedRegionMapId(visibleAuthoringProject(), region.id),
      source: "own",
      kind: "regions",
      usage: 0,
      tilesetId: region.terrain.tilesetId,
      regionKind: region.settlement ? "settlement" as const : "terrain" as const,
    });
  }
  const project = visibleAuthoringProject();
  for (const preset of project.villagePresets ?? []) {
    const id = spatialPresentationId("house-preset", "village", preset.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: preset.id,
      name: preset.name,
      source: "own",
      kind: "regions",
      usage: 0,
      regionKind: "settlement",
      subtitle: "마을 설계서",
    });
  }
  return cards;
}

function worldCards(): SpatialGalleryCard[] {
  const cards: SpatialGalleryCard[] = WORLD_CATALOG.map((world) => ({
    id: world.id,
    localId: world.id,
    name: world.label,
    source: "default" as const,
    kind: "worlds" as const,
    usage: 0,
    tilesetId: GEOGRAPHY_TERRAIN.tilesetId,
    subtitle: `지역 ${world.regions.length}곳`,
  }));
  const known = new Set(cards.map((card) => card.id));
  for (const world of Object.values(visibleAuthoringProject().spatialAuthoring?.library.worlds ?? {})) {
    const id = spatialPresentationId("library-world", "library", world.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: world.id,
      canonicalSource: { kind: "world", id: world.id },
      name: world.name,
      source: "own",
      kind: "worlds",
      usage: 0,
      tilesetId: world.terrain.tilesetId,
    });
  }
  return cards;
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
  const library = visibleAuthoringProject().spatialAuthoring?.library;
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
  const project = visibleAuthoringProject();
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
      regionMapId: entry.kind === "region" ? linkedRegionMapId(project, entry.source.id, entry.id) : undefined,
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
