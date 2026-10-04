import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { sharedContentTileset } from '@/project/sharedContent';
import { sharedObjectKit } from '@/project/sharedSpatialReferences';
import { CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY, LPC_WOODEN_FURNITURE_16_ID, LPC_WOODEN_FURNITURE_TILESET_ID } from "@/project/defaults/constants";
import { SHARED_VILLAGE_OBJECT_ID, SHARED_VILLAGE_OBJECT_TEXTURE } from "@/project/defaults/sharedVillageObjects";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { placeCards, placedCards, regionCards, worldCards } from "@/editor/panels/spatialCatalogHierarchy";
import type { SpatialAuthoringSession, SpatialShellTab, SpatialSourceFilter } from "@/editor/panels/spatialAuthoringSession";
import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import type { SpatialDesignReference } from "@/project/spatial/types";
import type { TilesetDef } from "@/project/types";
import { SHARED_OBJECTS } from "@/editor/tools/sharedDesignCatalog";

const SHARED_OBJECT_CATEGORY_LABEL: Readonly<Record<string, string>> = {
  tree: "잎 없는 고목", volcano: "화산 봉우리", gate: "성문·문루", terrain: "기후 지형", harbor: "항구 부품", house: "집 외형", prop: "마을 소품",
  furniture: "가구", vehicle: "탈것", landmark: "표지물",
};

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
  readonly regionReferenceId?: string;
  readonly regionMapId?: string;
  readonly reviewedPlaceId?: string;
  /** Shared object catalog id (src/assets/sharedObjectCatalog.json) — preview image + stamp_object. */
  readonly sharedObjectId?: string;
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
  // 공용 오브젝트 카탈로그(잎 없는 고목·화산 봉우리·기후 지형·항구 부품·성문루·집 외형·마을 소품). 조수 stamp_object 와 같은 목록.
  cards.push(...SHARED_OBJECTS.map((object): SpatialGalleryCard => ({
    id: `shared-object:${object.id}`,
    localId: object.id,
    name: object.name,
    source: "default",
    kind: "objects",
    usage: 0,
    tilesetId: object.tilesetId,
    sharedObjectId: object.id,
    subtitle: `${SHARED_OBJECT_CATEGORY_LABEL[object.category] ?? object.category} · ${object.width}×${object.height}`,
  })));
  const known = new Set(cards.map((card) => card.id));
  for (const tileset of Object.values(project.tilesets)) {
    for (const kit of tileset.structureKits ?? []) {
      // 숲마을 선별 소품(dewbank:*)은 공용 카탈로그 카드로 이미 보인다.
      if (kit.id.startsWith("dewbank:")) continue;
      // Keep compatibility cards until a canonical design owns the same graphic.
      if (Object.values(project.spatialAuthoring?.library.objects ?? {}).some((object) =>
        object.graphic.tilesetId === tileset.id && object.graphic.kitId === kit.id)) continue;
      const id = spatialPresentationId("tileset-kit", tileset.id, kit.id);
      if (known.has(id)) continue;
      known.add(id);
      cards.push({
        id,
        localId: kit.id,
        name: kit.name || kit.id,
        // 번들 시트에서 온 가구 팩은 공용 오브젝트다 — Tibo 실내 확장, LPC 나무 가구,
        // 공유 숲마을 오브젝트가 그렇다. 호스트 공용 팩도 설치된 원본 킷을 확인한다.
        // 나머지 킷은 저작자가 이 프로젝트에서 만든 것이므로
        // 내 오브젝트로 남는다.
        source: sharedObjectKit(tileset.id, kit.id) || isBundledFurniturePackKit(tileset, kit.id)
          || (tileset.id.startsWith("shared_") && sharedContentTileset(tileset.id)?.structureKits?.some(k => k.id === kit.id)) ? "default" : "own",
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

/**
 * 번들 가구 팩에서 시드된 킷인가 — 자료집의 "공용 오브젝트" 판정.
 *
 * 왜 id 접두사가 아니라 타일셋 신원으로 가르는가: 공용성은 **어느 시트에서 왔는가**의
 * 사실이고, 킷 id 는 저작자가 복제·개명할 수 있는 값이다. 시트가 번들이면 그 팩의
 * 시드 킷은 공용이고, 저작자가 그 위에 새로 만든 킷은 id 규약이 없어도 내 것으로 남는다.
 * Tibo 는 복원 시절의 `tibo-` 접두사를 유지해 기존 판정과 결과가 같다.
 */
function isBundledFurniturePackKit(tileset: Pick<TilesetDef, "id" | "image">, kitId: string): boolean {
  // LPC 나무 가구는 32px 판과 16px 판이 같은 킷 id 를 공유한다 — 둘 다 공용이다.
  if (tileset.id === LPC_WOODEN_FURNITURE_TILESET_ID || tileset.id === LPC_WOODEN_FURNITURE_16_ID) {
    return kitId.startsWith("lpc_");
  }
  if (tileset.id === "tibo_interior_expanded") return kitId.startsWith("tibo-");
  // Castle2 실측 부품(잔디 중심·분수 전체 등 14종)은 castleStructureKits 가 번들 시트에 시드한다.
  if (tileset.id === CASTLE_TILESET_ID
    && tileset.image.type === "bundled"
    && tileset.image.id === CASTLE_TILESET_TEXTURE_KEY) {
    return kitId.startsWith("castle-measured-");
  }
  // 손 도트 실내 v5(atlas_biome_interior): 가구 381종 킷은 번들 시드 — 공용 오브젝트.
  if (tileset.id === "atlas_biome_interior") return kitId.startsWith("hand-interior:");
  if (tileset.id === SHARED_VILLAGE_OBJECT_ID
    && tileset.image.type === "bundled"
    && tileset.image.id === SHARED_VILLAGE_OBJECT_TEXTURE) {
    return kitId.startsWith("shared-village:");
  }
  return false;
}

function spaceCards(): SpatialGalleryCard[] {
  const project = visibleAuthoringProject();
  const cards: SpatialGalleryCard[] = [];
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
      subtitle: `${space.environment === "outdoor" ? "실외" : "실내"} · ${space.width}×${space.height}`,
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
  if (session.mode === "instances") return session.tab === "places"
    ? [...placedCards("places"), ...placedCards("spaces")]
    : placedCards(session.tab);
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
