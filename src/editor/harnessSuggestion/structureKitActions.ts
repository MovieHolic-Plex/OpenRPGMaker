// harnessSuggestion/structureKitActions.ts
// [등록] 경로 — 감지 패턴을 tileset.structureKits 에 저장한다(스토어 접점만 이 파일에).
// 순수 변환(패턴↔킷↔스탬프)은 structureKitModel.ts 참조.

import { HOUSE_KITS } from "@/editor/houseKit";
import {
  structureKitFromMapRegion,
  structureKitSignature,
  type MapRegion,
} from "@/editor/harnessSuggestion/structureKitModel";
import { bakeInteriorObject, bakeStructureKit, copyName } from "@/editor/harnessSuggestion/structureKitRasterModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type {
  HouseStructureKitDef,
  MapId,
  SectionStructureKitDef,
  StructureKitDef,
  TilesetId,
} from "@/project/types";
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

/** DB 편집기: 빈 3×3 킷을 만들어 등록하고 돌려준다. */
export function createBlankStructureKit(tilesetId: TilesetId): SectionStructureKitDef {
  const kit: SectionStructureKitDef = {
    id: `kit_${randomUuid()}`,
    kind: "section",
    name: "새 구조물",
    width: 3,
    height: 3,
    rows: [
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
    ],
    learnedFrom: "db-authored",
    createdAt: new Date().toISOString(),
  };
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}

/**
 * DB 편집기: 어떤 원본이든 section 사본으로 굳혀 이 타일셋에 등록한다.
 * registerStructureKit 의 서명 중복 차단을 쓰지 않는다 — 복제는 "같은 모양을 하나 더" 가 의도다.
 */
export function duplicateIntoTileset(
  tilesetId: TilesetId,
  source: StructureKitDef | InteriorObjectDef,
): SectionStructureKitDef {
  const existingNames = (store.getCurrent().tilesets[tilesetId]?.structureKits ?? [])
    .map((kit) => kit.name ?? "구조물");
  const id = `kit_${randomUuid()}`;
  const kit = "cells" in source
    ? bakeInteriorObject(source, id, copyName(source.label, existingNames))
    : bakeStructureKit(source, id, copyName(source.name ?? "구조물", existingNames));
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}

/**
 * 집 킷 한 채를 전개해 굳힌 새 구조물.
 * 파라메트릭 시공은 build_house_kit 의 일이고, 여기서는 그 결과를 편집 시작점으로만 빌린다.
 *
 * 일부 킷(예: aframe-stone)은 폭·높이가 등식 하나를 정확히 맞춰야 시공된다 —
 * stampFootprintHouseKit 이 그 조건을 어기면 조용히 실패(ok:false)하고,
 * expandHouseStructureKit 은 그걸 빈 셀 목록으로 삼켜 버린다. 그 결과를 그대로
 * 저장하면 타일이 하나도 없는 킷이 "구조물"이랍시고 생긴다 — 구운 결과에 실제
 * 타일이 있는지 확인하고, 없으면 아무것도 등록하지 않은 채 null 을 돌려준다.
 */
export function createStructureKitFromHouse(
  tilesetId: TilesetId,
  houseKitId: string,
  size: { readonly width: number; readonly height: number },
): SectionStructureKitDef | null {
  const existingNames = (store.getCurrent().tilesets[tilesetId]?.structureKits ?? [])
    .map((kit) => kit.name ?? "구조물");
  const source: HouseStructureKitDef = {
    id: `kit_seed_${randomUuid()}`,
    kind: "house",
    name: HOUSE_KITS[houseKitId as keyof typeof HOUSE_KITS]?.name ?? "집",
    houseKitId,
    wings: [{ x: 0, y: 0, w: Math.max(3, size.width), h: Math.max(5, size.height) }],
    chimney: true,
    learnedFrom: "builtin-parametric",
  };
  const kit = bakeStructureKit(source, `kit_${randomUuid()}`, copyName(source.name ?? "집", existingNames));
  const hasPaintedTile = kit.rows.some((row) => row.tiles.some((tile) => tile !== TILE.EMPTY));
  if (!hasPaintedTile) return null;
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}

/**
 * 가져오기 커밋. id 는 새로 발급하고(원본 id 는 사람이 외우는 값이 아니다),
 * learnedFrom 은 db-authored 로 굳힌다 — builtin-parametric 을 그대로 두면
 * 프로젝트 데이터인데 편집이 잠긴 유령 킷이 생긴다.
 * ai.origin 은 손대지 않는다 — 자동 경로가 "user" 를 만들지 않는 제로 부트스트랩 규약.
 */
export function importStructureKits(
  tilesetId: TilesetId,
  entries: readonly { readonly kit: SectionStructureKitDef; readonly name: string }[],
): number {
  if (entries.length === 0) return 0;
  const prepared = entries.map((entry) => ({
    ...entry.kit,
    id: `kit_${randomUuid()}`,
    name: entry.name,
    learnedFrom: "db-authored" as const,
  }));
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), ...prepared.map((kit) => structuredClone(kit))];
  });
  return prepared.length;
}
