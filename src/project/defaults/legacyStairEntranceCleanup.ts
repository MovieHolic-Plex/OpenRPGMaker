import type { TilesetDef } from "../types";

// 옛 「계단 입구」 참고문서 정리(2026-11-23, 오너 결정으로 번들 참고 그림·문서 삭제).
// 2026-10-22 부터 번들이 모든 칩셋 사본에 「계단 입구」 용도(안내 문서 id stair-entrance-guide + /assets/ 경로 그림)를 덧붙였다.
// 그림 파일이 없어졌으므로 저장된 사본에서도 번들이 넣은 문서·그림을 떼어 조수가 더는 읽지 않게 한다.
// 저자가 그 용도에 덧붙인 문서·직접 올린 그림(data: URL)은 남기고, 남는 것이 없으면 용도째 뗀다.
// 계단 배치 규칙의 정본은 src/assets/stairContracts.json(project/stairs/contract.ts)이며 이 정리와 무관하다.
const LEGACY_CATEGORY_ID = "stair-entrance";
const LEGACY_GUIDE_DOC_ID = "stair-entrance-guide";

export function removeLegacyStairEntranceReferences(tileset: TilesetDef): boolean {
  const list = tileset.referenceDocuments;
  if (!list?.some((c) => c.id === LEGACY_CATEGORY_ID && c.documents.some((d) => d.id === LEGACY_GUIDE_DOC_ID))) return false;
  const next = [];
  for (const c of list) {
    if (c.id !== LEGACY_CATEGORY_ID || !c.documents.some((d) => d.id === LEGACY_GUIDE_DOC_ID)) { next.push(c); continue; }
    const documents = c.documents.filter((d) => d.id !== LEGACY_GUIDE_DOC_ID);
    const images = c.images.filter((i) => !i.dataUrl.startsWith("/assets/"));
    if (documents.length || images.length) next.push({ ...c, documents, images });
  }
  tileset.referenceDocuments = next;
  return true;
}
