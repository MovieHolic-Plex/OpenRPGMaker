// panels/structureKitDbSources.ts
// 데이터베이스 '구조물' 탭의 원본(source) 모델 — DOM 의존 없는 순수 데이터 계층.
// 규약: 타일셋 레일이 앨범 축이고, 원본은 그 앨범 안을 두 갈래(실내 오브젝트 ·
// 내가 저장한 구조물)로 나누는 필터다. 실내 오브젝트는 실내 칩셋 전용 — 다른 타일셋에 섞이지 않는다.

import {
  INTERIOR_OBJECT_CATALOG,
  interiorObjectsForTheme,
  type InteriorObjectDef,
  type InteriorObjectSnap,
} from "@/editor/interiorObjectCatalog";
import { interiorFurnitureKits, interiorObjectFromKit, isInteriorFurnitureKit } from "@/editor/interiorRoomVocab";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import {
  INTERIOR_ROOM_THEME_CATALOG,
  INTERIOR_ROOM_TILESET_ID,
  INTERIOR_SEMANTIC_TILE_CATALOG,
  VR,
  type InteriorRoomTheme,
  type InteriorSemanticTileRole,
  type InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import type { StructureKitDef, TilesetDef } from "@/project/types";

/** 'all'은 앨범 전체(기본값). 나머지 둘이 요구된 원본 칩이다. */
export type StructureKitDbSource = "all" | "interior" | "user";

export interface StructureKitSourceDef {
  readonly id: StructureKitDbSource;
  readonly label: string;
}

/** 실내 오브젝트 래스터의 받침 타일 — 잔디가 아니라 실내 나무 바닥. */
export const INTERIOR_OBJECT_THUMB_BACKGROUND_TILE = VR.FLOOR;

/** 레일 위 원본 칩 순서 — 전체 다음에 실내 · 내 저장. */
export const STRUCTURE_KIT_SOURCES: readonly StructureKitSourceDef[] = [
  { id: "all", label: "전체" },
  { id: "interior", label: "실내 오브젝트" },
  { id: "user", label: "내가 저장한 구조물" },
];

/** 표의 한 행 — 구조 킷이거나 실내 오브젝트다. */
export type StructureAlbumEntry =
  | { readonly kind: "kit"; readonly source: "user"; readonly kit: StructureKitDef }
  | { readonly kind: "object"; readonly source: "interior"; readonly object: InteriorObjectDef };

/** 실내 가구 — 타일셋에 시드된 킷이 있으면 그것, 실내 칩셋은 코드 카탈로그 폴백. */
export function interiorObjectsForTileset(tileset: TilesetDef | undefined): readonly InteriorObjectDef[] {
  if (!tileset) return [];
  const fromKits = interiorFurnitureKits(tileset).map(interiorObjectFromKit);
  if (fromKits.length > 0) return fromKits;
  if (tileset.id === INTERIOR_ROOM_TILESET_ID) return INTERIOR_OBJECT_CATALOG;
  return [];
}

/** 앨범(타일셋) 전체 행 — 실내 오브젝트 → 등록 킷 순. */
export function albumEntries(tileset: TilesetDef | undefined): readonly StructureAlbumEntry[] {
  if (!tileset) return [];
  const entries: StructureAlbumEntry[] = [];
  for (const object of interiorObjectsForTileset(tileset)) {
    entries.push({ kind: "object", source: "interior", object });
  }
  for (const kit of tileset.structureKits ?? []) {
    if (isInteriorFurnitureKit(kit)) continue;
    entries.push({ kind: "kit", source: "user", kit });
  }
  return entries;
}

/** 원본 필터. 'all'은 통과. */
export function entriesForSource(
  entries: readonly StructureAlbumEntry[],
  source: StructureKitDbSource,
): readonly StructureAlbumEntry[] {
  if (source === "all") return entries;
  return entries.filter((entry) => entry.source === source);
}

/** 행의 안정 id — 킷 id 또는 오브젝트 id. */
export function albumEntryId(entry: StructureAlbumEntry): string {
  return entry.kind === "kit" ? entry.kit.id : entry.object.id;
}

/** 오브젝트가 속한 테마의 한국어 이름 목록. */
export function interiorObjectThemeLabels(
  object: InteriorObjectDef,
  tileset?: TilesetDef,
): readonly string[] {
  const kinds = tileset?.interiorRoomKinds ?? BUILTIN_INTERIOR_ROOM_KINDS;
  const labels = new Map(kinds.map((kind) => [kind.id, kind.label]));
  return object.themes.map((theme) => labels.get(theme) ?? INTERIOR_ROOM_THEME_CATALOG[theme as InteriorRoomTheme]?.label ?? theme);
}

/** 레이어 한국어 이름. */
export function interiorObjectLayerLabel(layer: "lower" | "upper"): string {
  return layer === "upper" ? "상층" : "하층";
}

/** 배치 스냅 규약 한국어 설명. */
export function interiorObjectSnapLabel(snap: InteriorObjectSnap): string {
  switch (snap) {
    case "wall-north":
      return "북쪽 벽에 밀착";
    case "wall-any":
      return "아무 벽면에 부착";
    case "floor":
      return "바닥 위 자유 배치";
    case "free":
      return "제약 없음";
  }
}

/** 의미 역할 한국어 이름. 장식류(role=null)는 '장식'. */
export function interiorObjectRoleLabel(object: InteriorObjectDef): string {
  if (!object.role) return "장식";
  return INTERIOR_SEMANTIC_TILE_CATALOG[object.role as InteriorSemanticTileRole]?.label ?? object.role;
}

/** 조합형 분위기(modifier)의 한국어 이름 — 파이프라인은 영문 키만 갖고 있어 UI 이름은 여기서 정한다. */
export const INTERIOR_THEME_MODIFIER_LABELS: Readonly<Record<InteriorThemeModifier, string>> = {
  rustic: "소박함",
  luxury: "화려함",
  sacred: "신성함",
  scholarly: "학구적",
  martial: "무예풍",
};

/** 테마 문법의 필수 역할 한 칸 — 그 역할을 대표하는 실내 오브젝트가 붙는다. */
export interface InteriorThemeRoleSlot {
  readonly role: string;
  readonly label: string;
  /** 같은 테마 안에서 이 역할을 맡는 첫 오브젝트. 카탈로그에 없으면 undefined. */
  readonly object: InteriorObjectDef | undefined;
}

/** '방 종류' 카드 한 장 — 테마 이름, 필수 역할, 제안 분위기. */
export interface InteriorThemeCard {
  readonly theme: string;
  readonly label: string;
  readonly roles: readonly InteriorThemeRoleSlot[];
  readonly modifierLabels: readonly string[];
}

/** 테마 문법 전체를 카드 목록으로 — 타일셋에 저작된 공간 종류만. 기본 7종 폴백은 시드가 담당한다. */
export function interiorThemeCards(tileset?: TilesetDef): readonly InteriorThemeCard[] {
  const kinds = tileset?.interiorRoomKinds ?? [];
  const objects = interiorObjectsForTileset(tileset);
  return kinds.map((kind) => {
    const theme = kind.id;
    const themed = objects.filter((object) => object.themes.includes(kind.id));
    const fallback = interiorObjectsForTheme(kind.id);
    const pool = themed.length > 0 ? themed : fallback;
    return {
      theme,
      label: kind.label,
      roles: kind.requiredRoles.map((role) => ({
        role: role as InteriorSemanticTileRole,
        label: INTERIOR_SEMANTIC_TILE_CATALOG[role as InteriorSemanticTileRole]?.label ?? role,
        object: pool.find((object) => object.role === role),
      })),
      modifierLabels: (kind.suggestedModifiers ?? []).map(
        (modifier) => INTERIOR_THEME_MODIFIER_LABELS[modifier as InteriorThemeModifier] ?? modifier,
      ),
    };
  });
}
