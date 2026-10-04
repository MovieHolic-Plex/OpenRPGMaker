// C: 타일셋 필드별 바이트 분해 (docs 외 ~83MB 의 정체 찾기).
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize } from "../../../src/project/io/serialize";

const dir = process.env.PROJ ?? "/tmp/lag-proj-C";
const store = await openLocalProjectStore({ projectDir: dir });
const raw = store.exportSerialized();
if (!raw) throw new Error("no serialized");
const project = deserialize(raw);
store.close();
const size = (v: unknown) => JSON.stringify(v ?? null).length;
const byKey = new Map<string, number>();
for (const t of Object.values(project.tilesets) as any[]) {
  for (const [k, v] of Object.entries(t)) byKey.set(k, (byKey.get(k) ?? 0) + size(v));
}
console.log(JSON.stringify([...byKey].sort((a, b) => b[1] - a[1]).slice(0, 15)));
const top = Object.entries(project.tilesets).map(([id, t]) => [id, size(t)] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(JSON.stringify(top));
