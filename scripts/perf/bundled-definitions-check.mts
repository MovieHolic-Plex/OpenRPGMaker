// 번들 타일셋 정의의 내용 지문 — 지연 로드(src/project/defaults/bundledJson.ts) 전후로 같은 값을 내는지 대조한다.
//
//   npx tsx scripts/perf/bundled-definitions-check.mts > a.txt   (두 체크아웃에서 각각 돌려 diff)
//
// 찍는 것: 새 프로젝트의 번들 타일셋 전부(defaultTilesets), 옛 프로젝트 보강(ensureBundledTilesets — 빠진 칩셋·옛 칸 표·빠진 참고문서),
// 칩셋별 «새 사본의 참고문서»(로드가 저장본에서 뺀 번들 참고문서를 되돌릴 때 쓰는 값). 지연 출처가 있는 판이면 참고문서 전용 경로가
// 타일셋을 통째로 만든 값과 같은지도 확인한다.
import { createHash } from "node:crypto";
import * as defaults from "../../src/project/defaults/defaultAssets";
import type { TilesetDef } from "../../src/project/types";

const sha = (value: unknown): string => createHash("sha256").update(JSON.stringify(value) ?? "undefined").digest("hex").slice(0, 16);

const fresh = defaults.defaultTilesets();
const ids = Object.keys(fresh).sort();
console.log(`defaultTilesets ${ids.length} ${sha(ids.map((id) => [id, fresh[id]]))}`);
for (const id of ids) console.log(`  tileset ${id} ${sha(fresh[id])}`);

// 옛 프로젝트: 칩셋 몇 개가 빠졌고, 몇 개는 옛 굽기(칸 표 일부·참고문서가 빠짐)다.
const old: { tilesets: Record<string, TilesetDef> } = { tilesets: structuredClone(fresh) };
for (const id of ["jp_city", "beodeul_city", "desert_east"]) delete old.tilesets[id];
for (const id of ["modern_city", "wizarding_world", "joseon_baram", "atlas_biome_interior", "sky_island"]) {
  const t = old.tilesets[id];
  if (!t) continue;
  t.count -= 10;
  t.passability = t.passability.slice(0, t.count);
  t.priority = t.priority.slice(0, t.count);
  t.terrain = t.terrain.slice(0, t.count);
  t.tileMeta = t.tileMeta.slice(0, t.count);
  t.structureKits = (t.structureKits ?? []).slice(1);
  t.referenceDocuments = (t.referenceDocuments ?? []).slice(1);
}
const changed = defaults.ensureBundledTilesets(old);
console.log(`ensureBundledTilesets changed=${changed} ${sha(Object.keys(old.tilesets).sort().map((id) => [id, old.tilesets[id]]))}`);
for (const id of Object.keys(old.tilesets).sort()) console.log(`  ensured ${id} ${sha(old.tilesets[id])}`);

for (const id of ids) console.log(`  docs ${id} ${sha(defaults.bundledTilesetById(id)?.referenceDocuments)}`);

const docsOnly = (defaults as Record<string, unknown>).bundledReferenceDocumentsById as ((id: string) => unknown) | undefined;
if (docsOnly) {
  let mismatch = 0;
  for (const id of ids) {
    if (sha(docsOnly(id)) !== sha(defaults.bundledTilesetById(id)?.referenceDocuments)) { mismatch += 1; console.log(`  MISMATCH docs-only ${id}`); }
  }
  console.error(`docs-only path: ${ids.length - mismatch}/${ids.length} equal`);
  if (mismatch) process.exitCode = 1;
}
