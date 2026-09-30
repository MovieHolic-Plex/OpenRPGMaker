// 사용법: node run-ssr.mjs ref-roundtrip-eq.mts <project.sqlite> <serveOrigin>
// 참고문서 소유 분리의 동치 증명: 옛 파일 로드 -> 정규화 -> 저장(뺀 문서) -> 다시 로드(되돌림) 결과가 뺀 적 없는 프로젝트와 JSON 동치인가.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const imp = (globalThis as any).__ssrImport;
  const sc = await imp("/src/project/sharedContent.ts");
  const own = await imp("/src/project/referenceOwnership.ts");
  const inst = await imp("/src/project/installReferenceOwners.ts");
  const { jsonEqual } = await imp("/src/util/structuralJson.ts");
  const refs = await imp("/src/project/tilesetReferences.ts");
  await sc.loadSharedContent({ scope: "defaults" });

  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const [id, t] of Object.entries<any>(doc.tilesets ?? {})) {
    if (t?.$blob) doc.tilesets[id] = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(t.$blob) as any).body);
  }
  const fullRaw = JSON.stringify(doc);

  // 1) 켜기 전(예전 동작): 로드 -> 정규화 -> 직렬화
  const t0 = performance.now();
  const before = mods.serialize.deserializeParsed(structuredClone(doc));
  mods.defaultAssets.ensureBundledTilesets(before);
  sc.ensureSharedContent(before);
  const fullWire = mods.serialize.serialize(before);
  const tBefore = performance.now() - t0;

  // 2) 켠 뒤: 같은 로드 -> 정규화 -> 직렬화(뺌) -> 다시 로드(되돌림)
  inst.installReferenceDocumentOwners();
  const a = mods.serialize.deserializeParsed(structuredClone(doc));
  mods.defaultAssets.ensureBundledTilesets(a);
  sc.ensureSharedContent(a);
  const t1 = performance.now();
  const strippedWire = mods.serialize.serialize(a);
  const tStrip = performance.now() - t1;
  const markers = (strippedWire.match(/"referenceDocumentsOwner":"(bundle|shared)"/g) ?? []).length;
  const t2 = performance.now();
  const b = mods.serialize.deserialize(strippedWire);
  const tRestore = performance.now() - t2;
  const noMarkerLeft = !Object.values<any>(b.tilesets).some((t) => "referenceDocumentsOwner" in t);

  const result: Record<string, unknown> = {
    fullWireMB: +(fullWire.length / 1e6).toFixed(2),
    strippedWireMB: +(strippedWire.length / 1e6).toFixed(2),
    saving: +(1 - strippedWire.length / fullWire.length).toFixed(3),
    markers,
    roundTripJsonEqual: jsonEqual(a, b),
    roundTripEqualToPreFeature: jsonEqual(before, b),
    noMarkerLeft,
    strictStringEqualIgnoringKeyOrder: undefined,
    ms: { legacyLoadEnsureSerialize: Math.round(tBefore), strip: Math.round(tStrip), restoreParse: Math.round(tRestore) },
  };
  // 2회차: 같은 프로젝트를 한 번 더 돌려도 뺀 문서가 안정적인가(멱등)
  const strippedAgain = mods.serialize.serialize(b);
  result.idempotent = strippedAgain === strippedWire;

  // 3) 저자가 고친 문서는 그대로 남는가 — shared_ 문서 한 글자 수정 + 번들 타일셋에 저자 범주 추가
  const c = mods.serialize.deserialize(strippedWire);
  const sharedId = Object.keys(c.tilesets).find((id) => id.startsWith("shared_") && c.tilesets[id].referenceDocuments?.length);
  const bundleId = Object.keys(c.tilesets).find((id) => !id.startsWith("shared_") && c.tilesets[id].referenceDocuments?.length);
  const authored: Record<string, unknown> = { sharedId, bundleId };
  if (sharedId) c.tilesets[sharedId].referenceDocuments[0].documents[0].markdown += "\n저자가 고친 줄";
  if (bundleId) c.tilesets[bundleId].referenceDocuments.push({ id: "author_cat", name: "저자 범주", description: "x", documents: [{ id: "d1", name: "d1", markdown: "저자 문서" }], images: [] });
  const cw = mods.serialize.serialize(c);
  const d = mods.serialize.deserialize(cw);
  authored.sharedEditKept = sharedId ? d.tilesets[sharedId].referenceDocuments[0].documents[0].markdown.endsWith("저자가 고친 줄") : null;
  authored.bundleCategoryKept = bundleId ? d.tilesets[bundleId].referenceDocuments.some((x: any) => x.id === "author_cat") : null;
  authored.editedTilesetsStoredInFull = (cw.match(/"referenceDocumentsOwner"/g) ?? []).length === markers - (sharedId ? 1 : 0) - (bundleId ? 1 : 0);
  authored.wireEqualAfterEdit = jsonEqual(c, d);
  result.authored = authored;

  // 4) 조수 도구가 읽는 경로: 되돌린 프로젝트에서 참고문서 목록/소유자 해석이 그대로인가
  let listed = 0, listedBefore = 0, mismatch = 0;
  for (const [id, t] of Object.entries<any>(b.tilesets)) {
    const owner = refs.referenceOwner(b, t);
    const ownerBefore = refs.referenceOwner(before, before.tilesets[id]);
    const m = (owner.referenceDocuments ?? []).map((x: any) => refs.referenceManifest(x));
    const mb = (ownerBefore.referenceDocuments ?? []).map((x: any) => refs.referenceManifest(x));
    listed += m.length; listedBefore += mb.length;
    if (JSON.stringify(m) !== JSON.stringify(mb)) mismatch += 1;
  }
  result.tools = { categoriesListed: listed, categoriesListedBefore: listedBefore, mismatchTilesets: mismatch };

  // 5) .oprn 내보내기(serializePretty)는 문서를 그대로 담는가
  const pretty = mods.serialize.serializePretty(a);
  result.prettyKeepsDocs = !pretty.includes("referenceDocumentsOwner") && pretty.length > strippedWire.length;

  // 6) 소유자 해석기가 없을 때(헤드리스)는 예전과 같은 바이트인가
  own.registerReferenceDocumentOwners(null);
  result.headlessSerializeIdenticalToLegacy = mods.serialize.serialize(a) === fullWire;
  void fullRaw;
  console.log(JSON.stringify(result, null, 1));
}
