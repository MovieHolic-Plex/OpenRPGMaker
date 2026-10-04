// 사용법: node run-ssr.mjs norm-live.mts <project.sqlite> <serveOrigin>
// 실제 서버의 공용 자료를 받아 설치하고(부팅과 같은 순서), 저장된 문서에 정규화기를 돌려 무엇이 바뀌는지 본다.
import { DatabaseSync } from "node:sqlite";

export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const sc = await (globalThis as any).__ssrImport("/src/project/sharedContent.ts");
  const str = await (globalThis as any).__ssrImport("/src/project/sharedTileReferences.ts");
  await sc.loadSharedContent({ scope: "defaults" });
  const okRefs = await str.loadSharedTileReferences();
  console.log("shared content revision", sc.sharedContentSnapshot().revision, "refs loaded", okRefs);

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
  const steps: [string, () => boolean][] = [
    ["bundledTilesets", () => mods.defaultAssets.ensureBundledTilesets(project)],
    ["sharedTileReferences", () => str.ensureSharedTileReferences(project)],
    ["bundled2", () => mods.defaultAssets.ensureBundledTilesets(project)],
    ["shared2", () => str.ensureSharedTileReferences(project)],
  ];
  for (const [name, fn] of steps) {
    const t0 = performance.now();
    const returned = fn();
    const ms = Math.round(performance.now() - t0);
    const after = snap();
    const diff: string[] = [];
    for (const [k, v] of after) if (before.get(k) !== v) diff.push(before.has(k) ? k : `+${k}`);
    for (const k of before.keys()) if (!after.has(k)) diff.push(`-${k}`);
    console.log(name, JSON.stringify({ returned, ms, n: diff.length, changed: diff.slice(0, 25) }));
    before = after;
  }
}
