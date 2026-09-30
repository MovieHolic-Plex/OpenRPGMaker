// 사용법: VITE_CACHE_DIR=/tmp/f-vite-ssr node verify-shots/editor-lag-fix/F/run-ssr.mjs idempotence.mts <project.sqlite>
// 저장된 문서(접힘)를 펼쳐 ensureBundledTilesets / ensureSharedTileReferences 를 두 번 돌리고,
// 프로젝트 최상위 키·타일셋·업로드 자산 단위로 무엇이 바뀌는지와 멱등 여부를 본다.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, mods: { defaultAssets: any; serialize: any; digest: any }) {
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const [id, t] of Object.entries<any>(doc.tilesets ?? {})) {
    if (t?.$blob) doc.tilesets[id] = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(t.$blob) as any).body);
  }
  const project = mods.serialize.deserializeParsed(doc);
  const digestOf = (v: unknown) => mods.digest.jsonContentDigest(v);
  const snap = (): Map<string, string> => {
    const m = new Map<string, string>();
    for (const [k, v] of Object.entries<any>(project)) {
      if (k === "tilesets") for (const [id, t] of Object.entries<any>(v)) m.set(`tilesets.${id}`, digestOf(t));
      else if (k === "assets") {
        for (const [ak, av] of Object.entries<any>(v)) {
          if (ak === "uploaded") for (const [id, a] of Object.entries<any>(av)) m.set(`assets.uploaded.${id}`, digestOf(a));
          else m.set(`assets.${ak}`, digestOf(av));
        }
      } else m.set(k, digestOf(v));
    }
    return m;
  };
  let before = snap();
  const out: any = { tilesetCount: Object.keys(project.tilesets).length, topDigest: digestOf(project) };
  const steps: [string, () => boolean][] = [
    ["bundled1", () => mods.defaultAssets.ensureBundledTilesets(project)],
    ["bundled2", () => mods.defaultAssets.ensureBundledTilesets(project)],
  ];
  for (const [name, fn] of steps) {
    const t0 = performance.now();
    const returned = fn();
    const ms = performance.now() - t0;
    const after = snap();
    const diff: string[] = [];
    for (const [k, v] of after) if (before.get(k) !== v) diff.push(before.has(k) ? k : `+${k}`);
    for (const k of before.keys()) if (!after.has(k)) diff.push(`-${k}`);
    out[name] = { returned, ms: Math.round(ms), n: diff.length, changed: diff.slice(0, 30) };
    before = after;
  }
  out.topDigestAfter = digestOf(project);
  console.log(JSON.stringify(out, null, 1));
}
