// 사용법: node run-ssr.mjs normalizer-cost.mts <project.sqlite> <serveOrigin>
// store.normalizeCurrentProject 의 16개 정규화기를 하나씩 재고(콜드=첫 호출, 웜=둘째 호출), 각 호출 뒤 내용 요약이 바뀌는지 본다.
// 이미 정규화된 프로젝트에서 두 번째 로드가 낭비하는 시간(=버전 표지로 건너뛸 수 있는 시간)의 근거.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const imp = (globalThis as any).__ssrImport;
  const sc = await imp("/src/project/sharedContent.ts");
  const inst = await imp("/src/project/installReferenceOwners.ts");
  const str = await imp("/src/project/sharedTileReferences.ts");
  const legacy = await imp("/src/project/io/rewriteLegacyDialogue.ts");
  const blank = await imp("/src/project/defaults/blankProject.ts");
  const scar = await imp("/src/project/defaults/scarloxyPokemonInteriors.ts");
  const bri = await imp("/src/project/bundledReferenceImages.ts");
  const ipl = await imp("/src/project/defaults/interiorTransparentPropLayerRepair.ts");
  const ddi = await imp("/src/project/defaults/defaultDatabaseIconResources.ts");
  const ddb = await imp("/src/project/defaults/defaultDatabase.ts");
  const fmr = await imp("/src/project/faceMatchRepair.ts");
  const mt = await imp("/src/project/mapTree.ts");
  const da = mods.defaultAssets;
  const digest = mods.digest.jsonContentDigest;

  await sc.loadSharedContent({ scope: "defaults" });
  inst.installReferenceDocumentOwners();
  // 타일 참고문서 스냅숏: 부팅에서는 loadSharedTileReferences() 가 채운다.
  const trs = await imp("/src/project/sharedTileReferences.ts");
  if (trs.loadSharedTileReferences) await trs.loadSharedTileReferences();

  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const [id, t] of Object.entries<any>(doc.tilesets ?? {})) {
    if (t?.$blob) doc.tilesets[id] = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(t.$blob) as any).body);
  }
  const project = mods.serialize.deserializeParsed(doc);

  const list: [string, (p: any) => boolean][] = [
    ["legacyDialogue", (p) => legacy.rewriteLegacyAdvancedDialogueInProject(p)],
    ["mapConnections", (p) => { if (Array.isArray(p.mapConnections)) return false; p.mapConnections = []; return true; }],
    ["scarloxyInteriors", (p) => scar.ensureScarloxyPokemonInteriors(p)],
    ["mapTreeCoverage", (p) => mt.repairMapTreeOrphans(p)],
    ["switchVariableSlots", (p) => blank.ensureSwitchVariableSlots(p)],
    ["bundledTilesets", (p) => da.ensureBundledTilesets(p)],
    ["sharedTileReferences", (p) => str.ensureSharedTileReferences(p)],
    ["bundledReferenceImages", (p) => bri.externalizeBundledReferenceImages(p)],
    ["interiorPropLayers", (p) => ipl.repairInteriorTransparentPropLayers(p)],
    ["legacyRmTileset", (p) => da.removeLegacyRmTileset(p)],
    ["legacySpriteRefs", (p) => da.removeLegacySpriteReferences(p)],
    ["bundledResourceProfiles", (p) => da.ensureBundledResourceProfiles(p)],
    ["databaseIconResources", (p) => ddi.ensureDefaultDatabaseIconResources(p)],
    ["bundledBattleAnimations", (p) => ddb.ensureBundledBattleAnimations(p)],
    ["retroRoster", (p) => ddb.ensureRetroRosterRecords(p)],
    ["faceMatches", (p) => { const r = fmr.repairFaceMatches(p); return r.actors + r.eventFaces > 0; }],
  ];

  const time = <T>(fn: () => T): [T, number] => { const t = performance.now(); const v = fn(); return [v, performance.now() - t]; };
  const rows: Record<string, unknown>[] = [];
  const [, dCold] = time(() => digest(project));
  const [, dWarm] = time(() => digest(project));
  for (const pass of ["pass1", "pass2"]) {
    let total = 0, changedAny = false;
    for (const [name, fn] of list) {
      const [applied, ms] = time(() => fn(project));
      total += ms; changedAny ||= !!applied;
      rows.push({ pass, name, applied: !!applied, ms: +ms.toFixed(1) });
    }
    const [, dAfter] = time(() => digest(project));
    rows.push({ pass, name: "(합계 정규화기)", applied: changedAny, ms: +total.toFixed(1) });
    rows.push({ pass, name: "(jsonContentDigest 뒤)", applied: null, ms: +dAfter.toFixed(1) });
  }
  console.log(JSON.stringify({ digestColdMs: +dCold.toFixed(0), digestWarmMs: +dWarm.toFixed(0), rows }, null, 1));
}
