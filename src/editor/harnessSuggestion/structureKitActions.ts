// harnessSuggestion/structureKitActions.ts
// [등록] 경로 — 감지 패턴을 tileset.structureKits 에 저장한다(스토어 접점만 이 파일에).
// 순수 변환(패턴↔킷↔스탬프)은 structureKitModel.ts 참조.

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
  MapId,
  SectionStructureKitDef,
  TilesetId,
} from "@/project/types";
import { randomUuid } from "@/util/id";

/** 킷을 프로젝트 타일셋에 저장한다. 같은 서명이 이미 있으면 기존 킷을 돌려준다. */
export function registerStructureKit(tilesetId: TilesetId, kit: SectionStructureKitDef): SectionStructureKitDef {
  const existing = store.getCurrent().tilesets[tilesetId]?.structureKits
    ?.find((candidate) => candidate.kind === "section" && structureKitSignature(candidate) === structureKitSignature(kit));
  if (existing) return existing as SectionStructureKitDef;
  const stored: SectionStructureKitDef = { ...kit, id: kit.id || `kit_${randomUuid()}` };
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
): SectionStructureKitDef | null {
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

/**
 * Phase 2 소유권 계약: 구조물은 그림 레지스트리 — 꾸러미 물건(thing.objectId)이 여기를 가리킨다.
 * 킷을 지우기 전 이 함수로 참조를 세어, 0이 아니면 삭제 UI가 고아 경고를 띄운다.
 * 카탈로그 폴백(interiorObjectById)이 있으면 시공은 되되 저작된 그림은 깨진다 — "깨짐"이 아니라 "고아"다.
 */
export function conceptThingsReferencingKit(
  tilesetId: TilesetId,
  kitId: string,
): { readonly bundleId: string; readonly bundleLabel: string; readonly thingId: string; readonly thingLabel: string }[] {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const out: { bundleId: string; bundleLabel: string; thingId: string; thingLabel: string }[] = [];
  for (const bundle of tileset?.scratchConceptBundles ?? []) {
    for (const thing of bundle.things) {
      if (thing.objectId === kitId) {
        out.push({ bundleId: bundle.id, bundleLabel: bundle.label, thingId: thing.id, thingLabel: thing.label });
      }
    }
  }
  return out;
}

/** DB 편집기: 킷을 통째로 갈아끼운다. 없는 id 면 아무것도 하지 않는다(유령 킷 생성 방지). */
export function replaceStructureKit(tilesetId: TilesetId, kit: SectionStructureKitDef): void {
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
  source: SectionStructureKitDef | InteriorObjectDef,
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
 * 가져오기 커밋. id 는 새로 발급하고(원본 id 는 사람이 외우는 값이 아니다),
 * learnedFrom 은 db-authored 로 굳힌다.
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
