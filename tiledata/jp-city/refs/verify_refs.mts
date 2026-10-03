/** jp_city 참고문서 배선 확인(저장소 루트에서 `npx --no-install tsx tiledata/jp-city/refs/verify_refs.mts`). 시험 스위트가 아니라 내 검증용. */
import { createJpCityTileset, ensureJpCityReferences } from "../../../src/project/defaults/jpCity";
import { validateTilesetReferences, referencePageStarts } from "../../../src/project/tilesetReferences";
import { createBlankProject } from "../../../src/project/defaults";
import { referenceOwner } from "../../../src/project/tilesetReferences";
import fs from "node:fs";

const ts = createJpCityTileset();
const refs = ts.referenceDocuments ?? [];
validateTilesetReferences(refs);
let docs = 0, imgs = 0, pages = 0, chars = 0, maxPages = 0;
for (const c of refs) {
  docs += c.documents.length; imgs += c.images.length;
  for (const d of c.documents) { chars += d.markdown.length; const n = referencePageStarts(d.markdown).length; pages += n; maxPages = Math.max(maxPages, n); }
  for (const im of c.images) {
    if (!fs.existsSync("public" + im.dataUrl)) throw new Error("파일 없음 " + im.dataUrl);
    if (im.caption.length > 4000 || im.name.length > 200) throw new Error("길이 " + im.id);
  }
  if (c.description.length > 4000) throw new Error("설명 길이");
}
console.log("createJpCityTileset: 용도", refs.length, "문서", docs, "이미지", imgs, "글자", chars, "읽기 쪽(6000자 분할)", pages, "최대 쪽/문서", maxPages);
// 새 프로젝트
const bp = createBlankProject();
const own = referenceOwner(bp, bp.tilesets.jp_city!);
console.log("새 프로젝트 jp_city 참고문서 용도", (own.referenceDocuments ?? []).length);
// 기존 프로젝트: 비어 있음 → 채움 / 저작 문서 보존 / 두 번째는 변화 없음
const old = createJpCityTileset(); old.referenceDocuments = [];
console.log("빈 사본 ensure →", ensureJpCityReferences(old), (old.referenceDocuments ?? []).length);
console.log("재실행 →", ensureJpCityReferences(old));
const authored = createJpCityTileset();
authored.referenceDocuments = [
  { id: "mine", name: "내 용도", description: "d", documents: [{ id: "mine-doc", name: "x", markdown: "# 내 글" }], images: [] },
  { id: "jp-building", name: "옛", description: "옛", documents: [{ id: "my-note", name: "내 메모", markdown: "# 메모" }, { id: "jp-bld-tool", name: "옛 도구", markdown: "옛" }], images: [] },
];
console.log("저작 혼합 ensure →", ensureJpCityReferences(authored));
const a = authored.referenceDocuments!;
const bld = a.find((c) => c.id === "jp-building")!;
console.log("보존:", a.some((c) => c.id === "mine"), bld.documents.some((d) => d.id === "my-note"), "번들 교체:", bld.documents.find((d) => d.id === "jp-bld-tool")!.markdown.length > 100, "용도 수", a.length);
const ptr = createJpCityTileset(); (ptr as { referenceSourceTilesetId?: string }).referenceSourceTilesetId = "other"; ptr.referenceDocuments = [];
console.log("공유 포인터 ensure →", ensureJpCityReferences(ptr));
