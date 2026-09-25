// 공용 장소·오브젝트 목록 — 조수의 list_spatial_designs / get_spatial_design 이 장소 설계 문서(spatialAuthoring) 없이도 보여 주는
// 읽기 전용 목록. 편집기 「장소」 탭과 같은 원본을 쓴다: 검토 장소(reviewedPlaceIndex, 공용 SQLite 포함) + 등록 장소
// (REGION_REFERENCES·PLACE_REFERENCES). 오브젝트는 「오브젝트」 탭과 같은 프로젝트 타일셋 킷에, 도안이 있는 타일 그룹(잎 없는 고목 등)·
// 장소 안 킷(생성 건물 외형·성채 항구 나룻배)·장소 조각(나룻배·부두)·무늬(화산 봉우리)·저작 집 형태를 더한다.
//
// 쓰는 법: 장소는 import_region_reference({id}), 오브젝트는 stamp_object({objectId, mapId, x, y}), 집 형태는 author_house 도 된다.
import sharedObjectIndex from "@/assets/sharedObjectIndex.json";
import { REGION_REFERENCES, PLACE_REFERENCES } from "@/project/regionReferences";
import { SHARED_REGION_REFERENCES } from "@/project/sharedSpatialReferences";
import { reviewedPlaceIndex } from "@/project/defaults/spatial/reviewedPlaceIndex";
import { AUTHORED_HOUSE_FORM_DEFS } from "@/project/defaults/authoredHouseFormCatalog";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { Project, TilesetDef } from "@/project/types";

export type SharedPlaceEntry = {
  readonly id: string; readonly kind: "place"; readonly name: string;
  readonly placeKind: "facility" | "settlement" | "natural";
  readonly tilesetId: string | null; readonly width?: number; readonly height?: number;
  readonly tags: readonly string[]; readonly source: "registered" | "reviewed"; readonly use: string;
};

export type SharedObjectSource = "tileset-kit" | "tile-group" | "place-kit" | "place-part" | "pattern" | "house-form";
export type SharedObjectEntry = {
  readonly id: string; readonly kind: "object"; readonly name: string;
  readonly tilesetId: string; readonly width: number; readonly height: number;
  readonly tags: readonly string[]; readonly source: SharedObjectSource; readonly use: string;
  /** Place the object comes from (place-kit / place-part): stamp_object loads it first. */
  readonly referenceId?: string;
};

/** Curated pieces cut from registered places, and small documented patterns. */
type PlacePart = { id: string; name: string; tags: string[]; referenceId: string; rect: { x: number; y: number; width: number; height: number }; layers: "both" | "upper" | "lower" };
type Pattern = { id: string; name: string; tags: string[]; tilesetId: string; width: number; height: number; upper: number[]; lower?: number[] };

export const PLACE_PARTS: readonly PlacePart[] = [
  { id: "part:harbor-rowboat", name: "나룻배(8×4, 물 위)", tags: ["항구", "배", "나룻배", "물"], referenceId: "nuleolmok-harbor-town-76x60",
    rect: { x: 42, y: 52, width: 8, height: 4 }, layers: "upper" },
  { id: "part:harbor-pier-two-boats", name: "나무 부두와 나룻배 두 척(20×5)", tags: ["항구", "부두", "배", "말뚝"], referenceId: "nuleolmok-harbor-town-76x60",
    rect: { x: 42, y: 51, width: 20, height: 5 }, layers: "upper" },
  { id: "part:harbor-cargo", name: "부두 짐 · 오크통 줄(3×1)", tags: ["항구", "짐", "오크통"], referenceId: "nuleolmok-harbor-town-76x60",
    rect: { x: 47, y: 48, width: 3, height: 1 }, layers: "upper" },
];

export const PATTERNS: readonly Pattern[] = [
  // tiledata/climate-villages 문서 「화산 봉우리」: 위층, 통행 불가. 둘레 한 칸 비우고 맨 재(240) 위에.
  { id: "pattern:volcano-peak-pair", name: "화산 봉우리 한 쌍(잠든·분화, 4×2)", tags: ["화산", "봉우리", "용암"], tilesetId: "forest_harmony_volcano",
    width: 4, height: 2, upper: [858, 859, 918, 919, 888, 889, 948, 949] },
  { id: "pattern:volcano-peak-dormant", name: "잠든 화산 봉우리(2×2)", tags: ["화산", "봉우리"], tilesetId: "forest_harmony_volcano",
    width: 2, height: 2, upper: [858, 859, 888, 889] },
  { id: "pattern:volcano-peak-erupting", name: "분화하는 화산 봉우리(2×2)", tags: ["화산", "봉우리", "용암"], tilesetId: "forest_harmony_volcano",
    width: 2, height: 2, upper: [918, 919, 948, 949] },
];

type RefKit = { id: string; name: string; width: number; height: number; tilesetId: string; referenceId: string; kitId: string };
export const PLACE_KITS = (sharedObjectIndex as { refKits: RefKit[] }).refKits;

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

function kitObjects(tileset: TilesetDef): SharedObjectEntry[] {
  return (tileset.structureKits ?? []).filter(kit => kit.kind === "section").map(kit => ({
    id: `kit:${tileset.id}/${kit.id}`, kind: "object" as const, name: kit.name || kit.id, tilesetId: tileset.id, width: kit.width, height: kit.height,
    tags: [tileset.name, ...(kit.id.includes("well") ? ["우물"] : [])], source: "tileset-kit" as const,
    use: `stamp_object({objectId:'kit:${tileset.id}/${kit.id}', mapId, x, y})`,
  }));
}

function groupObjects(tileset: TilesetDef): SharedObjectEntry[] {
  return (tileset.tileGroups ?? []).filter(group => group.previewMap && group.previewMap.width > 0).map(group => ({
    id: `group:${tileset.id}/${group.id}`, kind: "object" as const, name: group.name || group.id, tilesetId: tileset.id,
    width: group.previewMap!.width, height: group.previewMap!.height, tags: [tileset.name, group.role ?? ""].filter(Boolean),
    source: "tile-group" as const, use: `stamp_object({objectId:'group:${tileset.id}/${group.id}', mapId, x, y}) — 그룹 도안 그대로`,
  }));
}

/** Every reusable object the assistant can stamp in this project (bundled + place-sourced). */
export function sharedObjects(project: Project): SharedObjectEntry[] {
  const out: SharedObjectEntry[] = [];
  for (const tileset of Object.values(project.tilesets)) out.push(...kitObjects(tileset), ...groupObjects(tileset));
  for (const kit of PLACE_KITS) {
    out.push({ id: kit.id, kind: "object", name: kit.name, tilesetId: kit.tilesetId, width: kit.width, height: kit.height,
      tags: [kit.id.includes("/fft-bp") ? "건물 외형" : "장소 킷", kit.referenceId], source: "place-kit", referenceId: kit.referenceId,
      use: `stamp_object({objectId:'${kit.id}', mapId, x, y}) — 다른 타일셋 맵이면 그림을 이식해 옮긴다` });
  }
  for (const part of PLACE_PARTS) {
    out.push({ id: part.id, kind: "object", name: part.name, tilesetId: "forest_harmony", width: part.rect.width, height: part.rect.height,
      tags: part.tags, source: "place-part", referenceId: part.referenceId, use: `stamp_object({objectId:'${part.id}', mapId, x, y})` });
  }
  for (const pattern of PATTERNS) {
    out.push({ id: pattern.id, kind: "object", name: pattern.name, tilesetId: pattern.tilesetId, width: pattern.width, height: pattern.height,
      tags: pattern.tags, source: "pattern", use: `stamp_object({objectId:'${pattern.id}', mapId, x, y})` });
  }
  for (const form of AUTHORED_HOUSE_FORM_DEFS) {
    out.push({ id: `house:${form.id}`, kind: "object", name: `건물 외형 · ${form.name}`, tilesetId: DEFAULT_TILESET_ID, width: form.w, height: form.h,
      tags: ["건물 외형", "집", `${form.stories}층`], source: "house-form",
      use: `author_house({templateId:'${form.id}'}) (문·실내까지) 또는 stamp_object({objectId:'house:${form.id}'}) (외형만)` });
  }
  return out;
}

export function isSharedDesignId(id: string): boolean {
  return /^(reviewed:|kit:|group:|refkit:|part:|pattern:|house:)/.test(id)
    || [...REGION_REFERENCES, ...PLACE_REFERENCES, ...SHARED_REGION_REFERENCES].some(entry => entry.id === id);
}

export function matchesQuery(entry: { id: string; name: string; tags: readonly string[] }, query: string): boolean {
  if (!query) return true;
  const q = query.toLocaleLowerCase();
  return [entry.id, entry.name, ...entry.tags].some(value => value.toLocaleLowerCase().includes(q));
}
