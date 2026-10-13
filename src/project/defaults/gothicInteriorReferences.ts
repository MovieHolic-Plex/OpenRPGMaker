// gothic_manor 실내 참고문서(번들 소유) — 기물 사전·저택 1·2층 평면·은신처 접근칸. 생성: scripts/content/prepare-gothic-interior-references.py
// gothic_manor 타일셋 정의(야외 담당)가 `referenceDocuments: createGothicInteriorReferences()` 로 이 자료를 들고 태어나게 하고,
// ensureBundledTilesets 안에서 `ensureGothicInteriorReferences(project.tilesets[id])` 를 부른다(아직 배선하지 않았다 — 타일셋 정의가 생기면 한 줄씩).
import references from "@/assets/gothicInteriorReferences.json";
import type { TilesetDef } from "../types";

export const GOTHIC_INTERIOR_REFERENCE_PURPOSE = "gothic-interior-authoring";

export function createGothicInteriorReferences(): NonNullable<TilesetDef["referenceDocuments"]> {
  return structuredClone(references) as NonNullable<TilesetDef["referenceDocuments"]>;
}

/** 빠진 용도·문서·그림만 덧붙이고, 저자가 직접 쓴 문서는 건드리지 않는다. 바뀌었으면 true. */
export function ensureGothicInteriorReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== "gothic_manor" || tileset.referenceSourceTilesetId) return false;
  const next = [...(tileset.referenceDocuments ?? [])];
  let changed = false;
  for (const shipped of references) {
    const index = next.findIndex((entry) => entry.id === shipped.id);
    if (index < 0) { next.push(structuredClone(shipped) as (typeof next)[number]); changed = true; continue; }
    const current = next[index]!;
    const merged = { ...current,
      documents: [...current.documents.filter((d) => !shipped.documents.some((s) => s.id === d.id)), ...shipped.documents],
      images: [...current.images.filter((d) => !shipped.images.some((s) => s.id === d.id)), ...shipped.images] };
    if (JSON.stringify(current) !== JSON.stringify(merged)) { next[index] = structuredClone(merged) as (typeof next)[number]; changed = true; }
  }
  if (changed) tileset.referenceDocuments = next;
  return changed;
}
