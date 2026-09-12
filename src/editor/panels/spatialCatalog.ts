import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { placeCards, placedCards, regionCards, worldCards } from "@/editor/panels/spatialCatalogHierarchy";
import type { SpatialAuthoringSession, SpatialShellTab, SpatialSourceFilter } from "@/editor/panels/spatialAuthoringSession";
import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import type { SpatialDesignReference } from "@/project/spatial/types";

export { spatialCardDomSelector, spatialPresentationId } from "@/editor/panels/spatialPresentation";

export type SpatialCardSource = "default" | "own" | "placed";
export type SpatialCompatibilitySource = "room-rule" | "house-shape";

export type SpatialGalleryCard = {
  readonly id: string;
  readonly name: string;
  readonly source: SpatialCardSource;
  readonly kind: SpatialShellTab;
  readonly usage: number;
  readonly localId?: string;
  /** Present only for an actual canonical library record, never inferred from localId. */
  readonly canonicalSource?: SpatialDesignReference;
  readonly subtitle?: string;
  readonly tilesetId?: string;
  readonly objectId?: string;
  readonly mapId?: string;
  readonly placeKind?: "facility" | "settlement" | "natural";
  readonly regionKind?: "terrain" | "settlement";
  readonly missingSource?: boolean;
  readonly compatibility?: SpatialCompatibilitySource;
  readonly mapUsage?: boolean;
};

function matchesSource(card: SpatialGalleryCard, filter: SpatialSourceFilter): boolean {
  if (filter === "all") return card.source !== "placed";
  if (filter === "defaults") return card.source === "default";
  return card.source === "own";
}

function boundInteriorTilesetId(): string | undefined {
  const tilesets = visibleAuthoringProject().tilesets;
  return Object.hasOwn(tilesets, INTERIOR_ROOM_TILESET_ID) ? INTERIOR_ROOM_TILESET_ID : undefined;
}

function tilesetUsage(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const map of Object.values(visibleAuthoringProject().maps)) {
    counts.set(map.tilesetId, (counts.get(map.tilesetId) ?? 0) + 1);
  }
  return counts;
}

function tileCards(): SpatialGalleryCard[] {
  const usage = tilesetUsage();
  return Object.values(visibleAuthoringProject().tilesets).map((tileset) => ({
    id: tileset.id,
    localId: tileset.id,
    name: tileset.name || tileset.id,
    source: tileset.image.type === "bundled" ? "default" : "own",
    kind: "tiles",
    usage: usage.get(tileset.id) ?? 0,
    tilesetId: tileset.id,
  }));
}

function objectCards(): SpatialGalleryCard[] {
  const project = visibleAuthoringProject();
  const tilesetId = boundInteriorTilesetId();
  const cards: SpatialGalleryCard[] = INTERIOR_OBJECT_CATALOG.map((object) => ({
    id: object.id,
    localId: object.id,
    name: object.label,
    source: "default",
    kind: "objects",
    usage: 0,
    tilesetId,
    objectId: object.id,
  }));
  const known = new Set(cards.map((card) => card.id));
  for (const tileset of Object.values(project.tilesets)) {
    for (const kit of tileset.structureKits ?? []) {
      const id = spatialPresentationId("tileset-kit", tileset.id, kit.id);
      if (known.has(id)) continue;
      known.add(id);
      cards.push({
        id,
        localId: kit.id,
        name: kit.name || kit.id,
        source: "own",
        kind: "objects",
        usage: 0,
        tilesetId: tileset.id,
        objectId: kit.id,
      });
    }
  }
  for (const object of Object.values(project.spatialAuthoring?.library.objects ?? {})) {
    const id = spatialPresentationId("library-object", "library", object.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: object.id,
      canonicalSource: { kind: "object", id: object.id },
      name: object.name,
      source: "own",
      kind: "objects",
      usage: 0,
      tilesetId: object.graphic.tilesetId,
      objectId: object.graphic.kitId,
    });
  }
  return cards;
}

function spaceCards(): SpatialGalleryCard[] {
  const project = visibleAuthoringProject();
  const tilesetId = boundInteriorTilesetId();
  const cards: SpatialGalleryCard[] = BUILTIN_INTERIOR_ROOM_KINDS.map((kind) => ({
    id: kind.id,
    localId: kind.id,
    name: kind.label,
    source: "default",
    kind: "spaces",
    usage: 0,
    tilesetId,
    subtitle: kind.walkway ? "통로" : undefined,
  }));
  const known = new Set(cards.map((card) => card.id));
  for (const tileset of Object.values(project.tilesets)) {
    for (const kind of tileset.interiorRoomKinds ?? []) {
      const id = spatialPresentationId("tileset-room", tileset.id, kind.id);
      if (known.has(id)) continue;
      known.add(id);
      cards.push({
        id,
        localId: kind.id,
        name: kind.label,
        source: "own",
        kind: "spaces",
        usage: 0,
        tilesetId: tileset.id,
        compatibility: "room-rule",
        subtitle: "호환 방 규칙",
      });
    }
  }
  for (const space of Object.values(project.spatialAuthoring?.library.spaces ?? {})) {
    const id = spatialPresentationId("library-space", "library", space.id);
    if (known.has(id)) continue;
    known.add(id);
    cards.push({
      id,
      localId: space.id,
      canonicalSource: { kind: "space", id: space.id },
      name: space.name,
      source: "own",
      kind: "spaces",
      usage: 0,
      tilesetId: space.tilesetId,
    });
  }
  return cards;
}

const DESIGN_LISTERS: Record<SpatialShellTab, () => SpatialGalleryCard[]> = {
  tiles: tileCards,
  objects: objectCards,
  spaces: spaceCards,
  places: placeCards,
  regions: regionCards,
  worlds: worldCards,
};

export function spatialAllSourceDesignCount(tab: SpatialShellTab): number {
  return DESIGN_LISTERS[tab]().length;
}

export function listSpatialGalleryCards(session: SpatialAuthoringSession): readonly SpatialGalleryCard[] {
  if (session.mode === "instances") return placedCards(session.tab);
  const cards = DESIGN_LISTERS[session.tab]().filter((card) => matchesSource(card, session.source));
  if (session.tab === "places" && session.placeKindFilter) {
    return cards.filter((card) => card.placeKind === session.placeKindFilter);
  }
  if (session.tab === "regions" && session.regionKindFilter) {
    return cards.filter((card) => card.regionKind === session.regionKindFilter);
  }
  return cards;
}

export function spatialCardById(session: SpatialAuthoringSession, id: string | null): SpatialGalleryCard | undefined {
  if (!id) return undefined;
  const visible = listSpatialGalleryCards(session).find((card) => card.id === id);
  if (visible) return visible;
  if (session.mode === "instances") return undefined;
  return DESIGN_LISTERS[session.tab]().find((card) => card.id === id);
}
