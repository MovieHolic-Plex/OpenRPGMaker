// 사용법: node run-ssr.mjs kits-order.mts <project.sqlite> <serveOrigin>  저장된 shared_* 타일셋의 structureKits 를 라이브러리와 id·순서·내용 단위로 비교한다.
import { DatabaseSync } from "node:sqlite";
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
export async function run(sqlite: string, origin: string, mods: any) {
  (globalThis as any).window = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => realFetch(typeof input === "string" && input.startsWith("/") ? origin + input : input, init)) as any;
  const sc = await (globalThis as any).__ssrImport("/src/project/sharedContent.ts");
  await sc.loadSharedContent({ scope: "defaults" });
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  for (const [id, ref] of Object.entries<any>(doc.tilesets)) {
    if (!id.startsWith("shared_")) continue;
    const persisted = ref.$blob ? JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(ref.$blob) as any).body) : ref;
    let lib: any;
    for (const l of Object.values<any>(sc.sharedContentSnapshot().libraries)) if (l.projectDefaults && l.tilesets[id]) lib = l.tilesets[id];
    if (!lib) continue;
    const pk: any[] = persisted.structureKits ?? [], lk: any[] = lib.structureKits ?? [];
    const { structureKits: _a, ...pr } = persisted, { structureKits: _b, ...lr } = lib;
    const pIds = pk.map(k => k.id), lIds = lk.map(k => k.id);
    console.log(JSON.stringify({
      id, whole: eq(persisted, lib), restEq: eq(pr, lr), kits: [pk.length, lk.length], sameOrder: eq(pIds, lIds),
      sameSet: eq([...pIds].sort(), [...lIds].sort()), contentEq: lk.every(k => eq(pk.find(p => p.id === k.id), k)),
      persistedExtra: pIds.filter(i => !lIds.includes(i)), nonSharedInLib: lIds.filter(i => !i.startsWith("shared_")).length,
      firstDiff: pIds.findIndex((v, i) => v !== lIds[i]),
      restDiffKeys: Object.keys({ ...pr, ...lr }).filter(k => !eq((pr as any)[k], (lr as any)[k])),
      libSharedFirst: eq(lIds, [...lIds.filter(i => i.startsWith("shared_")), ...lIds.filter(i => !i.startsWith("shared_"))]),
      persistedIsSharedFirstOfLib: eq(pIds, [...lIds.filter(i => i.startsWith("shared_")), ...lIds.filter(i => !i.startsWith("shared_"))]),
    }));
  }
}
