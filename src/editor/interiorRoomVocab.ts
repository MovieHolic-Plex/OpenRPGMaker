/**
 * 타일셋에 저장된 실내 가구·방 종류를 파이프라인이 읽는 실행 어휘로 바꾼다.
 * 코드 카탈로그(interiorObjectCatalog) 는 시드·폴백 전용 — 이 모듈은 프로젝트 데이터를 정본으로 본다.
 */
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { bakeInteriorObject } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { structureKitSize, structureKitUnitCells } from "@/editor/harnessSuggestion/structureKitModel";
import type {
  InteriorFurnitureSnap,
  InteriorRoomKindRecord,
  SectionStructureKitDef,
  StructureKitDef,
  TilesetDef,
} from "@/project/types";

const SNAPS: readonly InteriorFurnitureSnap[] = ["wall-north", "wall-any", "floor", "free"];

export type InteriorRoomVocab = {
  readonly objectsById: ReadonlyMap<string, InteriorObjectDef>;
  readonly kindsById: ReadonlyMap<string, InteriorRoomKindRecord>;
};

export function isInteriorFurnitureSnap(value: unknown): value is InteriorFurnitureSnap {
  return typeof value === "string" && (SNAPS as readonly string[]).includes(value);
}

/** 실내 가구로 취급할 킷 — 시드 계보 또는 스냅/역할 메타. */
export function isInteriorFurnitureKit(kit: StructureKitDef): boolean {
  if (kit.kind !== "section") return false;
  if (kit.learnedFrom === "interior-catalog") return true;
  if (isInteriorFurnitureSnap(kit.ai?.snap)) return true;
  return Boolean(kit.ai?.interiorRole?.trim());
}

export function interiorFurnitureKits(tileset: TilesetDef | undefined): readonly SectionStructureKitDef[] {
  if (!tileset) return [];
  return (tileset.structureKits ?? []).filter(
    (kit): kit is SectionStructureKitDef => isInteriorFurnitureKit(kit),
  );
}

export function interiorObjectFromKit(kit: SectionStructureKitDef): InteriorObjectDef {
  const cells = structureKitUnitCells(kit).map((cell) => ({
    dx: cell.dx,
    dy: cell.dy,
    layer: cell.layer,
    tile: cell.tile,
  }));
  const size = structureKitSize(kit);
  const upper = cells.some((cell) => cell.layer === "upper");
  const lower = cells.some((cell) => cell.layer === "lower");
  const role = kit.ai?.interiorRole?.trim() || null;
  const snap: InteriorFurnitureSnap = isInteriorFurnitureSnap(kit.ai?.snap) ? kit.ai.snap : "floor";
  return {
    id: kit.id,
    label: kit.name ?? kit.id,
    role,
    width: size.width,
    height: size.height,
    layer: upper && !lower ? "upper" : "lower",
    cells,
    themes: kit.ai?.themes ?? [],
    snap,
  };
}

function kindsFromRecords(records: readonly InteriorRoomKindRecord[]): Map<string, InteriorRoomKindRecord> {
  const kinds = new Map<string, InteriorRoomKindRecord>();
  for (const record of records) {
    const id = record.id.trim();
    if (!id) continue;
    kinds.set(id, {
      id,
      label: record.label.trim() || id,
      requiredRoles: record.requiredRoles.map((role) => role.trim()).filter(Boolean),
      ...(record.suggestedModifiers && record.suggestedModifiers.length > 0
        ? { suggestedModifiers: record.suggestedModifiers.map((item) => item.trim()).filter(Boolean) }
        : {}),
      ...(record.walkway ? { walkway: true } : {}),
    });
  }
  return kinds;
}

/** 타일셋 데이터가 있으면 그것을, 없으면 호출부가 준 폴백(코드 카탈로그)을 쓴다. */
export function resolveInteriorRoomVocab(
  tileset: TilesetDef | undefined,
  fallbackObjects: readonly InteriorObjectDef[],
  fallbackKinds: readonly InteriorRoomKindRecord[],
): InteriorRoomVocab {
  const kits = interiorFurnitureKits(tileset);
  const objectsById = kits.length > 0
    ? new Map(kits.map((kit) => {
      const object = interiorObjectFromKit(kit);
      return [object.id, object] as const;
    }))
    : new Map(fallbackObjects.map((entry) => [entry.id, entry]));
  const authoredKinds = tileset?.interiorRoomKinds;
  const kindsById = authoredKinds !== undefined
    ? kindsFromRecords(authoredKinds)
    // Phase 3 파생 체인: 저작값 없음 → 꾸러미 장소에서 유도 → 그래도 없으면 호출부 폴백.
    // 저작값이 있으면(빈 배열 포함) 유도를 타지 않는다 — []는 "전부 지움"이다.
    : kindsFromRecords(kindsDerivedFromConceptBundles(tileset).concat(fallbackKinds));
  return { objectsById, kindsById };
}

/**
 * Phase 3: 개념 꾸러미 장소를 방 종류 문법으로 유도한다.
 * - 같은 id가 여러 꾸러미에 있으면 첫 정의가 이긴다(저작 순서).
 * - role walkway → walkway: true. entrance/room → requiredRoles 없음(구성은 꾸러미가 소유).
 * - requiredRoles는 비워 둔다: 방 하나 짓기의 폴백 문법일 뿐, 시설 합성의 근거가 아니다(Phase 1 계약).
 */
export function kindsDerivedFromConceptBundles(tileset: TilesetDef | undefined): InteriorRoomKindRecord[] {
  const out: InteriorRoomKindRecord[] = [];
  const seen = new Set<string>();
  for (const bundle of tileset?.scratchConceptBundles ?? []) {
    for (const place of bundle.places) {
      const id = place.id.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        label: place.label.trim() || id,
        requiredRoles: [],
        ...(place.role === "walkway" ? { walkway: true as const } : {}),
      });
    }
  }
  return out;
}

/** 이 타일셋의 방 종류가 저작값인지, 꾸러미 유도인지, 둘 다 없는지. 공간 종류 탭의 출처 표시에 쓴다. */
export function interiorRoomKindSource(tileset: TilesetDef | undefined): "authored" | "derived" | "none" {
  if (tileset?.interiorRoomKinds !== undefined) return "authored";
  return kindsDerivedFromConceptBundles(tileset).length > 0 ? "derived" : "none";
}

export function seedInteriorTilesetCatalog(
  tileset: TilesetDef,
  objects: readonly InteriorObjectDef[],
  kinds: readonly InteriorRoomKindRecord[],
): boolean {
  let changed = false;
  if (tileset.interiorRoomKinds === undefined) {
    tileset.interiorRoomKinds = kinds.map((kind) => ({
      id: kind.id,
      label: kind.label,
      requiredRoles: [...kind.requiredRoles],
      ...(kind.suggestedModifiers ? { suggestedModifiers: [...kind.suggestedModifiers] } : {}),
      ...(kind.walkway ? { walkway: true } : {}),
    }));
    changed = true;
  }
  const existing = tileset.structureKits ?? [];
  if (!existing.some(isInteriorFurnitureKit)) {
    const furniture = objects.map((object) => {
      const kit = bakeInteriorObject(object, object.id, object.label);
      return {
        ...kit,
        learnedFrom: "interior-catalog" as const,
        ai: {
          description: "",
          placementRules: "",
          ...(object.role ? { interiorRole: object.role } : {}),
          snap: object.snap,
          themes: [...object.themes],
        },
      };
    });
    tileset.structureKits = [...existing, ...furniture];
    changed = true;
  }
  return changed;
}
