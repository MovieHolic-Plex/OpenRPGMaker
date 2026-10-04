// 사용법: node run-ssr.mjs ref-ownership.mts <project.sqlite>
// 저장 문서의 referenceDocuments 를 「새 프로젝트가 번들에서 얻는 것」과 대조해, 번들 소유로 뺄 수 있는 몫을 잰다.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, mods: { defaultAssets: any; serialize: any; digest: any }) {
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const [id, t] of Object.entries<any>(doc.tilesets ?? {})) {
    if (t?.$blob) doc.tilesets[id] = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(t.$blob) as any).body);
  }
  const fresh = mods.defaultAssets.defaultTilesets();
  mods.defaultAssets.ensureBundledTilesets({ tilesets: fresh });
  let total = 0, same = 0, differ = 0, unbundled = 0, sharedPrefix = 0, sourceLinked = 0;
  const differing: string[] = [];
  const notInBundle: string[] = [];
  for (const [id, t] of Object.entries<any>(doc.tilesets)) {
    const cats: any[] = t.referenceDocuments ?? [];
    if (!cats.length) continue;
    const bundled = fresh[id]?.referenceDocuments as any[] | undefined;
    for (const c of cats) {
      const bytes = JSON.stringify(c).length;
      total += bytes;
      if (id.startsWith("shared_")) { sharedPrefix += bytes; continue; }
      if (!bundled) { unbundled += bytes; if (notInBundle.length < 15) notInBundle.push(`${id}:${c.id}:${bytes}`); continue; }
      const b = bundled.find((x) => x.id === c.id);
      if (b && JSON.stringify(b) === JSON.stringify(c)) same += bytes;
      else { differ += bytes; if (differing.length < 25) differing.push(`${id}:${c.id}:${bytes}:${b ? "changed" : "notInBundleCat"}`); }
    }
    if (t.referenceSourceTilesetId) sourceLinked++;
  }
  console.log(JSON.stringify({ totalMB: +(total / 1e6).toFixed(2), sameAsBundleMB: +(same / 1e6).toFixed(2), differMB: +(differ / 1e6).toFixed(2), unbundledMB: +(unbundled / 1e6).toFixed(2), sharedPrefixMB: +(sharedPrefix / 1e6).toFixed(2), sourceLinked }, null, 1));
  console.log("differing", differing.join("\n  "));
  console.log("notInBundle", notInBundle.join("\n  "));
}
