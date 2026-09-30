// tibo_interior_expanded 를 ensureBundledTilesets 전후로 비교해 어느 키가 바뀌는지 본다.
import { DatabaseSync } from "node:sqlite";
function walk(a: any, b: any, path: string, out: string[]) {
  if (out.length > 30) return;
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk(a[k], b[k], `${path}.${k}`, out);
    return;
  }
  out.push(`${path}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`);
}
export async function run(sqlite: string, mods: { defaultAssets: any; serialize: any }) {
  const db = new DatabaseSync(sqlite, { readOnly: true });
  const doc = JSON.parse((db.prepare("select current_json from project").get() as any).current_json);
  const id = "tibo_interior_expanded";
  doc.tilesets[id] = JSON.parse((db.prepare("select body from tileset_blobs where sha256=?").get(doc.tilesets[id].$blob) as any).body);
  const project = { tilesets: { [id]: doc.tilesets[id] } } as any;
  const before = structuredClone(project.tilesets[id]);
  mods.defaultAssets.ensureBundledTilesets({ tilesets: project.tilesets, maps: { m: { tilesetId: id } } } as any);
  const out: string[] = [];
  walk(before, project.tilesets[id], "ts", out);
  console.log(out.join("\n"));
}
