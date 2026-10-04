// 사용법: node run-ssr.mjs shared-docs-eq.mts <project.sqlite> <serveOrigin>
// 저장된 shared_* 타일셋의 referenceDocuments 가 라이브러리 판본과 통째로 같은지(=빼도 되는지) 센다.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const sc = await (globalThis as any).__ssrImport("/src/project/sharedContent.ts");
  await sc.loadSharedContent({ scope: "defaults" });
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  let eqBytes = 0, neBytes = 0, eqN = 0, neN = 0, noLib = 0, noLibBytes = 0;
  const ne: string[] = [];
  for (const [id, ref] of Object.entries<any>(doc.tilesets)) {
    if (!id.startsWith("shared_")) continue;
    const t = ref?.$blob ? JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(ref.$blob) as any).body) : ref;
    const docs = t.referenceDocuments;
    if (!docs?.length) continue;
    const bytes = JSON.stringify(docs).length;
    const lib = sc.sharedContentTileset(id);
    if (!lib) { noLib++; noLibBytes += bytes; continue; }
    if (JSON.stringify(lib.referenceDocuments ?? []) === JSON.stringify(docs)) { eqN++; eqBytes += bytes; }
    else { neN++; neBytes += bytes; if (ne.length < 12) ne.push(`${id}: persisted ${docs.length} cats ${bytes}B vs lib ${lib.referenceDocuments?.length ?? 0} cats ${JSON.stringify(lib.referenceDocuments ?? []).length}B`); }
  }
  console.log(JSON.stringify({ equal: eqN, equalMB: +(eqBytes / 1e6).toFixed(2), notEqual: neN, notEqualMB: +(neBytes / 1e6).toFixed(2), noLibrary: noLib, noLibraryMB: +(noLibBytes / 1e6).toFixed(2) }));
  console.log(ne.join("\n"));
}
