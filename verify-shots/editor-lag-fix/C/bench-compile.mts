// C: 장소 카드 컴파일 벤치. 사용: vite-node --config vitest.config.ts verify-shots/editor-lag-fix/C/bench-compile.mts <label> [limit]
// 프로젝트 사본(/tmp/lag-proj-C)을 읽기 전용으로 열어 카드마다 previewPlaceMaps 를 돌리고 시간·출력 지문을 남긴다.
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { deserialize } from "../../../src/project/io/serialize";
import { previewPlaceMaps } from "../../../src/editor/panels/spatialPlacePreview";
import type { Project } from "../../../src/project/types";

const label = process.argv[2] ?? "before";
const limit = Number(process.argv[3] ?? 40);
const dir = process.env.PROJ ?? "/tmp/lag-proj-C";
const OUT = "verify-shots/editor-lag-fix/C/";

const store = await openLocalProjectStore({ projectDir: dir });
const raw = store.exportSerialized();
if (!raw) throw new Error("no serialized project");
const t0 = performance.now();
const project: Project = deserialize(raw);
const loadMs = performance.now() - t0;
store.close();

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const docBytes = Object.values(project.tilesets).reduce((n, t) => n + JSON.stringify(t.referenceDocuments ?? []).length, 0);
const places = Object.values(project.spatialAuthoring?.library.places ?? {});
console.log(label, "tilesets", Object.keys(project.tilesets).length, "refDocBytes", docBytes, "libraryPlaces", places.length, "deserializeMs", Math.round(loadMs));

const rows: any[] = [];
let done = 0;
for (const place of places) {
  if (done >= limit) break;
  const s = performance.now();
  let out: any;
  try {
    const r = previewPlaceMaps({ project, place, floor: null });
    out = { ok: true, maps: r.maps.map(m => ({ id: m.map.id, x: m.x, y: m.y, level: m.level, digest: sha(m.map) })),
      authoring: sha(r.project.spatialAuthoring), tree: sha(r.project.mapTree), conns: sha(r.project.mapConnections), allMaps: sha(r.project.maps) };
  } catch (e: any) { out = { ok: false, error: String(e?.code ?? e?.name) + ":" + String(e?.message).slice(0, 120) }; }
  const ms = performance.now() - s;
  rows.push({ id: place.id, ms: Math.round(ms * 10) / 10, ...out });
  done++;
}
const times = rows.map(r => r.ms).sort((a, b) => a - b);
const sum = times.reduce((a, b) => a + b, 0);
const summary = { label, cards: rows.length, totalMs: Math.round(sum), meanMs: Math.round(sum / rows.length), medianMs: times[Math.floor(times.length / 2)], maxMs: times[times.length - 1], failed: rows.filter(r => !r.ok).length, deserializeMs: Math.round(loadMs), refDocBytes: docBytes };
console.log(JSON.stringify(summary));
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + `${label}.json`, JSON.stringify({ summary, rows }, null, 1));
