// 이미 올린 팩 프리셋 타일셋의 「까는 순서」 문서를 지금 프리셋 지침으로 맞춘다.
//
// 참고문서는 사용자가 시트를 올릴 때 한 번 구워 프로젝트 행에 들어간다. 지침을 고쳐도(예: 2026-09-25 마을 짜임
// build_pack_town 추가) 예전에 올린 프로젝트의 조수는 옛 지침만 읽는다 — 글만 바꾸고 그림(사용자 원본에서 구운 것)은 둔다.

import type { TilesetDef } from "../types";
import { MV_PACK_PRESETS } from "./packs";

export function refreshMvPackGuide(tileset: TilesetDef): boolean {
  const preset = tileset.mvPack && MV_PACK_PRESETS.find((entry) => entry.id === tileset.mvPack!.presetId);
  if (!preset) return false;
  const category = tileset.referenceDocuments?.find((entry) => entry.id === `mvpack-${preset.id}`);
  const guide = category?.documents.find((doc) => doc.id === "guide");
  if (!category || !guide || guide.markdown === preset.guide) return false;
  tileset.referenceDocuments = tileset.referenceDocuments!.map((entry) => entry !== category ? entry : {
    ...entry,
    documents: entry.documents.map((doc) => (doc === guide ? { ...doc, markdown: preset.guide } : doc)),
  });
  return true;
}
