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
    : kindsFromRecords(fallbackKinds);
  return { objectsById, kindsById };
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
