// harnessSuggestion/structureKitActions.ts
// [등록] 경로 — 감지 패턴을 tileset.structureKits 에 저장한다(스토어 접점만 이 파일에).
// 순수 변환(패턴↔킷↔스탬프)은 structureKitModel.ts 참조.

import {
  structureKitFromMapRegion,
  structureKitSignature,
  type MapRegion,
} from "@/editor/harnessSuggestion/structureKitModel";
import { store } from "@/project/store";
import type { MapId, StructureKitDef, TilesetId } from "@/project/types";
import { randomUuid } from "@/util/id";

/** 킷을 프로젝트 타일셋에 저장한다. 같은 서명이 이미 있으면 기존 킷을 돌려준다. */
export function registerStructureKit(tilesetId: TilesetId, kit: StructureKitDef): StructureKitDef {
  const existing = store.getCurrent().tilesets[tilesetId]?.structureKits
    ?.find((candidate) => structureKitSignature(candidate) === structureKitSignature(kit));
  if (existing) return existing;
  const stored: StructureKitDef = { ...kit, id: kit.id || `kit_${randomUuid()}` };
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(stored)];
  });
  return stored;
}

/** 칩 [구조물로 저장] — 지금 선택한 구획을 그 맵의 타일셋에만 등록한다. 맵이 없으면 null. */
export function saveSelectionAsStructureKit(
  selection: MapRegion & { readonly mapId: MapId },
): StructureKitDef | null {
  const map = store.getCurrent().maps[selection.mapId];
  if (!map) return null;
  return registerStructureKit(map.tilesetId, structureKitFromMapRegion(map, selection));
}

/** DB 관리: 킷 이름 변경. */
export function renameStructureKit(tilesetId: TilesetId, kitId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.structureKits) return;
    tileset.structureKits = tileset.structureKits.map((kit) =>
      kit.id === kitId ? { ...kit, name: trimmed } : kit,
    );
  });
}

/** DB 관리: 킷 삭제. */
export function deleteStructureKit(tilesetId: TilesetId, kitId: string): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.structureKits) return;
    tileset.structureKits = tileset.structureKits.filter((kit) => kit.id !== kitId);
  });
}

/** DB 편집기: 킷을 통째로 갈아끼운다. 없는 id 면 아무것도 하지 않는다(유령 킷 생성 방지). */
export function replaceStructureKit(tilesetId: TilesetId, kit: StructureKitDef): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.structureKits) return;
    if (!tileset.structureKits.some((candidate) => candidate.id === kit.id)) return;
    tileset.structureKits = tileset.structureKits.map((candidate) =>
      candidate.id === kit.id ? structuredClone(kit) : candidate,
    );
  });
}
