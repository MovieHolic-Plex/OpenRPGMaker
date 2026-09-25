// 공용 장소·오브젝트 목록 — 조수의 list_spatial_designs / get_spatial_design 이 장소 설계 문서(spatialAuthoring) 없이도 보여 주는
// 읽기 전용 목록. 편집기 「장소」「오브젝트」 탭과 같은 원본을 쓴다.
// - 장소: 검토 장소(reviewedPlaceIndex, 공용 SQLite 포함) + 등록 장소(REGION_REFERENCES·PLACE_REFERENCES) → import_region_reference.
// - 오브젝트: 공용 오브젝트 카탈로그(src/assets/sharedObjectCatalog.json — 잎 없는 고목·화산 봉우리·기후 지형·항구 부품·
//   생성 건물·집 외형·마을 소품 + 파이프라인이 뽑은 tiledata/*/shared-objects.json(가구·탈것·표지물 등), 생성기 scripts/content/build-shared-object-catalog.mjs) + 이 프로젝트 타일셋의 다른 구조 킷·
//   도안 있는 타일 그룹 → stamp_object.
import catalog from "@/assets/sharedObjectCatalog.json";
import { REGION_REFERENCES, PLACE_REFERENCES } from "@/project/regionReferences";
import { SHARED_REGION_REFERENCES } from "@/project/sharedSpatialReferences";
import { reviewedPlaceIndex } from "@/project/defaults/spatial/reviewedPlaceIndex";
import type { Project, TilesetDef } from "@/project/types";

export type SharedPlaceEntry = {
  readonly id: string; readonly kind: "place"; readonly name: string;
  readonly placeKind: "facility" | "settlement" | "natural";
  readonly tilesetId: string | null; readonly width?: number; readonly height?: number;
  readonly tags: readonly string[]; readonly source: "registered" | "reviewed"; readonly use: string;
};

export type SharedObjectCategory = "tree" | "volcano" | "gate" | "terrain" | "harbor" | "house" | "prop" | "furniture" | "vehicle" | "landmark";
export type SharedObjectSourceDef =
  | { readonly kind: "tileset"; readonly tilesetId: string }
  | { readonly kind: "place-kit"; readonly referenceId: string; readonly kitId: string };
/** One manifest entry (src/assets/sharedObjectCatalog.json). */
export interface SharedObjectDef {
  readonly id: string; readonly name: string; readonly category: SharedObjectCategory;
  readonly tags: readonly string[]; readonly owner: string; readonly tilesetId: string;
  readonly source: SharedObjectSourceDef; readonly width: number; readonly height: number;
  readonly defaultLayers: "both" | "upper" | "lower"; readonly passage: string; readonly preview: string;
  /** Present for tileset-sourced objects: cells in `source.tilesetId` numbering, -1 = leave the map cell. */
  readonly lower?: readonly number[]; readonly upper?: readonly number[];
  /** Map a pipeline object was cut from (tiledata/<pipeline>/shared-objects.json entries). */
  readonly sourceMap?: string;
}
export const SHARED_OBJECTS: readonly SharedObjectDef[] = (catalog as unknown as { objects: SharedObjectDef[] }).objects;
const BY_ID = new Map(SHARED_OBJECTS.map(object => [object.id, object]));
export const sharedObjectDef = (id: string): SharedObjectDef | undefined => BY_ID.get(resolveObjectAlias(id));

export type SharedObjectEntry = {
  readonly id: string; readonly kind: "object"; readonly name: string; readonly category: SharedObjectCategory | "project-kit" | "project-group";
  readonly tilesetId: string; readonly width: number; readonly height: number; readonly passage?: string;
  readonly tags: readonly string[]; readonly owner?: string; readonly preview?: string; readonly use: string;
  /** Place the object comes from (place kits): stamp_object loads it first. */
  readonly referenceId?: string;
};

/** Ids published by PR #1499 before the catalog existed. */
export function resolveObjectAlias(id: string): string {
  if (id === "pattern:volcano-peak-pair") return "obj:volcano/peak-pair";
  if (id === "pattern:volcano-peak-dormant") return "obj:volcano/peak-dormant";
  if (id === "pattern:volcano-peak-erupting") return "obj:volcano/peak-erupting";
  if (id === "part:harbor-rowboat") return "obj:harbor/rowboat";
  if (id === "part:harbor-cargo") return "obj:harbor/cargo";
  if (id.startsWith("house:")) return `obj:house/${id.slice("house:".length)}`;
  if (id.startsWith("refkit:")) {
    const kitId = id.slice(id.indexOf("/") + 1);
    return SHARED_OBJECTS.find(object => object.source.kind === "place-kit" && object.source.kitId === kitId)?.id ?? id;
  }
  return id;
}

export function sharedPlaces(): SharedPlaceEntry[] {
  const reviewed = reviewedPlaceIndex().map((place): SharedPlaceEntry => ({
    id: `reviewed:${place.id}`, kind: "place", name: place.name, placeKind: place.kind, tilesetId: place.tilesetId,
    tags: place.tags, source: "reviewed", use: `import_region_reference({id:'reviewed:${place.id}'}) — 장소의 맵 전부를 새 맵으로`,
  }));
  const registered = [...REGION_REFERENCES, ...PLACE_REFERENCES, ...SHARED_REGION_REFERENCES].map((entry): SharedPlaceEntry => {
    const placeKind = "placeKind" in entry && typeof entry.placeKind === "string" ? entry.placeKind as SharedPlaceEntry["placeKind"]
      : "regionKind" in entry && entry.regionKind === "terrain" ? "natural" : "settlement";
    return { id: entry.id, kind: "place", name: entry.name, placeKind, tilesetId: entry.tilesetId, width: entry.width, height: entry.height,
      tags: [placeKind, entry.tilesetId, `${entry.width}×${entry.height}`], source: "registered",
      use: `import_region_reference({id:'${entry.id}'}) · 칸 배열은 read_region_reference` };
  });
  return [...reviewed, ...registered];
}

// Bundled pieces the catalog already carries — not repeated as raw kit:/group: rows.
const coveredKit = (kitId: string) => kitId.startsWith("dewbank:");
const coveredGroup = (groupId: string) => groupId.startsWith("bare-trees:") || groupId.startsWith("climate-terrain:") || groupId.startsWith("atlas-vehicles:");

function kitObjects(tileset: TilesetDef): SharedObjectEntry[] {
  return (tileset.structureKits ?? []).filter(kit => kit.kind === "section" && !coveredKit(kit.id)).map(kit => ({
    id: `kit:${tileset.id}/${kit.id}`, kind: "object" as const, name: kit.name || kit.id, category: "project-kit" as const, tilesetId: tileset.id,
    width: kit.width, height: kit.height, tags: [tileset.name, "타일셋 킷", ...(kit.ai?.tags ?? [])], use: `stamp_object({objectId:'kit:${tileset.id}/${kit.id}', mapId, x, y})`,
  }));
}

function groupObjects(tileset: TilesetDef): SharedObjectEntry[] {
  return (tileset.tileGroups ?? []).filter(group => group.previewMap && group.previewMap.width > 0 && !coveredGroup(group.id)).map(group => ({
    id: `group:${tileset.id}/${group.id}`, kind: "object" as const, name: group.name || group.id, category: "project-group" as const, tilesetId: tileset.id,
    width: group.previewMap!.width, height: group.previewMap!.height, tags: [tileset.name, group.role ?? ""].filter(Boolean),
    use: `stamp_object({objectId:'group:${tileset.id}/${group.id}', mapId, x, y}) — 그룹 도안 그대로`,
  }));
}

export function catalogEntry(object: SharedObjectDef): SharedObjectEntry {
  return { id: object.id, kind: "object", name: object.name, category: object.category, tilesetId: object.tilesetId,
    width: object.width, height: object.height, passage: object.passage, tags: object.tags, owner: object.owner, preview: object.preview,
    ...(object.source.kind === "place-kit" ? { referenceId: object.source.referenceId } : {}),
    use: object.category === "house" && object.id.startsWith("obj:house/") && object.source.kind === "tileset"
      ? `stamp_object({objectId:'${object.id}', mapId, x, y}) (외형만) 또는 author_house({templateId:'${object.id.slice("obj:house/".length)}'}) (문·실내까지)`
      : `stamp_object({objectId:'${object.id}', mapId, x, y})` };
}

/** Every reusable object the assistant can stamp in this project: the shared catalog, then this project's other kits/groups. */
export function sharedObjects(project: Project): SharedObjectEntry[] {
  const out: SharedObjectEntry[] = SHARED_OBJECTS.map(catalogEntry);
  for (const tileset of Object.values(project.tilesets)) out.push(...kitObjects(tileset), ...groupObjects(tileset));
  return out;
}

export function isSharedDesignId(id: string): boolean {
  return /^(reviewed:|kit:|group:|obj:|refkit:|part:|pattern:|house:)/.test(id)
    || [...REGION_REFERENCES, ...PLACE_REFERENCES, ...SHARED_REGION_REFERENCES].some(entry => entry.id === id);
}

export function matchesQuery(entry: { id: string; name: string; tags: readonly string[] }, query: string): boolean {
  if (!query) return true;
  const q = query.toLocaleLowerCase();
  return [entry.id, entry.name, ...entry.tags].some(value => value.toLocaleLowerCase().includes(q));
}
