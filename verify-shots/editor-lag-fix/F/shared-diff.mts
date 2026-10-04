// 사용법: node run-ssr.mjs shared-diff.mts <project.sqlite> <serveOrigin>  저장된 shared_* 타일셋과 라이브러리 판본의 차이를 키 단위로 보인다.
import { DatabaseSync } from "node:sqlite";

function walk(a: any, b: any, path: string, out: string[]) {
  if (out.length > 12) return;
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) === !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`, out);
    return;
  }
  out.push(`${path}: ${JSON.stringify(a)?.slice(0, 60)} (len ${JSON.stringify(a)?.length}) -> ${JSON.stringify(b)?.slice(0, 60)} (len ${JSON.stringify(b)?.length})`);
}

export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const sc = await (globalThis as any).__ssrImport("/src/project/sharedContent.ts");
  await sc.loadSharedContent({ scope: "defaults" });
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const id of ["shared_paw_modern_interiors", "shared_refmap_crayon", "shared_refmap_snow", "shared_refmap_town_outside"]) {
    const persisted = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(doc.tilesets[id].$blob) as any).body);
    let lib: any;
    for (const l of Object.values<any>(sc.sharedContentSnapshot().libraries)) if (l.projectDefaults && l.tilesets[id]) lib = l.tilesets[id];
    const out: string[] = [];
    walk(persisted, lib, id, out);
    console.log(id, "persisted docs", persisted.referenceDocuments?.length, "lib docs", lib?.referenceDocuments?.length, "kits", persisted.structureKits?.length, lib?.structureKits?.length);
    console.log(out.join("\n"));
  }
}
