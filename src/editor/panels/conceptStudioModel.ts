// 개념 꾸러미 스튜디오의 그림 소유 — DOM 없음.
// 카탈로그·내장 집은 피커 시드일 뿐이고, 고치는 순간 타일셋 structureKits 로 굽는다.

import { duplicateIntoTileset } from "@/editor/harnessSuggestion/structureKitActions";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById, type InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { interiorObjectFromKit } from "@/editor/interiorRoomVocab";
import { albumEntries } from "@/editor/panels/structureKitDbSources";
import { store } from "@/project/store";
import type { ConceptThingRecord, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { randomUuid } from "@/util/id";

export function conceptObjectsForTileset(tileset: TilesetDef): readonly InteriorObjectDef[] {
  const seen = new Set<string>();
  const objects: InteriorObjectDef[] = [];
  const add = (object: InteriorObjectDef): void => {
    if (seen.has(object.id)) return;
    seen.add(object.id);
    objects.push(object);
  };
  for (const entry of albumEntries(tileset)) {
    add(entry.kind === "object" ? entry.object : interiorObjectFromKit(entry.kit));
  }
  if (tileset.id === INTERIOR_ROOM_TILESET_ID) {
    for (const object of INTERIOR_OBJECT_CATALOG) add(object);
  }
  return objects;
}

export function resolveConceptObject(tileset: TilesetDef, objectId: string): InteriorObjectDef | undefined {
  return conceptObjectsForTileset(tileset).find((object) => object.id === objectId)
    ?? interiorObjectById(objectId);
}

export function isOwnedPicture(tileset: TilesetDef, objectId: string): boolean {
  return (tileset.structureKits ?? []).some(
    (kit) => kit.id === objectId && kit.learnedFrom === "db-authored",
  );
}

export function stampKitFromTiles(
  tiles: readonly number[],
  name: string,
  id: string,
): SectionStructureKitDef {
  if (tiles.length === 0) throw new Error("칸을 고른 뒤에 물건을 만듭니다.");
  return {
    id,
    kind: "section",
    name,
    width: tiles.length,
    height: 1,
    rows: [{ tiles: [...tiles] }],
    learnedFrom: "db-authored",
    ai: {
      description: "",
      placementRules: "",
      snap: "floor",
    },
  };
}

export function registerStampOnTileset(
  tilesetId: string,
  tiles: readonly number[],
  name: string,
): SectionStructureKitDef {
  const kit = stampKitFromTiles(tiles, name, `kit_${randomUuid()}`);
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  }, { scope: "database", label: "개념 스탬프" });
  return kit;
}

export function claimThingPicture(tilesetId: string, bundleId: string, thingId: string): string | null {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const thing = findThing(tileset, bundleId, thingId);
  if (!tileset || !thing) return null;
  if (isOwnedPicture(tileset, thing.objectId)) return thing.objectId;
  const object = resolveConceptObject(tileset, thing.objectId);
  if (!object) return null;
  const kit = duplicateIntoTileset(tilesetId, object);
  store.update((project) => {
    const nextThing = findThing(project.tilesets[tilesetId], bundleId, thingId);
    if (nextThing) nextThing.objectId = kit.id;
  }, { scope: "database", label: "개념 그림 소유" });
  return kit.id;
}

function findThing(
  tileset: TilesetDef | undefined,
  bundleId: string,
  thingId: string,
): ConceptThingRecord | undefined {
  return tileset?.scratchConceptBundles
    ?.find((bundle) => bundle.id === bundleId)
    ?.things.find((thing) => thing.id === thingId);
}
