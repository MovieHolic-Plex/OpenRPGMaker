// harnessSuggestion/structureKitActions.ts
// [등록] 경로 — 감지 패턴을 tileset.structureKits 에 저장한다(스토어 접점만 이 파일에).
// 순수 변환(패턴↔킷↔스탬프)은 structureKitModel.ts 참조.

import { structureKitSignature } from "@/editor/harnessSuggestion/structureKitModel";
import { store } from "@/project/store";
import type { StructureKitDef, TilesetId } from "@/project/types";
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
