// 기존 프로젝트 사본의 이식 칸이 버들항 번들 꼬리(농장·던전 천장·성벽)와 겹칠 때 새 번들 끝 뒤로 옮겨지는지 증명한다(2026-10-22).
//   bun scripts/qa/beodeul-graft-relocation-proof.mts <프로젝트 사본 폴더>... [--out verify-shots/beodeul-graft-relocation]
// 사본 폴더만 쓴다(사용자 원본 폴더를 넘기지 말 것). 각 사본에서:
//   1) 저장본 그대로 모든 맵을 그린다(전) → 2) ensureBundledTilesets(옮기기) → 모든 맵을 다시 그려 화소가 같은지 대조
//   3) 성벽 마을(author_beodeul_town walls:true)을 새 맵에 짓는다 → 4) 사본에 저장 → 다시 열어 같은지·기존 맵 화소가 그대로인지 확인.
import fs from "node:fs";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { openLocalProjectStore } from "../../electron/local-store/store.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { beodeulTailRelocations, BEODEUL_TOWN_WALL_BASE } from "../../src/project/defaults/beodeulCity.ts";
import { townWallAvailable } from "../../src/editor/tools/beodeulTownWall.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { serialize } from "../../src/project/io/serialize.ts";
import { installReferenceDocumentOwners } from "../../src/project/installReferenceOwners.ts";

// 편집기 부팅과 같게: 저장에서 번들 참고문서를 빼고 로드에서 되돌린다(src/main.ts).
installReferenceDocumentOwners();
import type { Project } from "../../src/project/types.ts";

const argv = process.argv.slice(2);
const outAt = argv.indexOf("--out");
const OUT = outAt >= 0 ? argv[outAt + 1]! : "verify-shots/beodeul-graft-relocation";
const dirs = argv.filter((a, i) => !a.startsWith("--") && (outAt < 0 || i !== outAt + 1));

const sameImage = (a: Buffer, b: Buffer) => { const x = PNG.sync.read(a), y = PNG.sync.read(b); return x.width === y.width && x.height === y.height && Buffer.compare(x.data, y.data) === 0; };
const results: unknown[] = [];
for (const projectDir of dirs) {
  const name = projectDir.replace(/\/+$/, "").split("/").pop()!;
  const dir = `${OUT}/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  let store = await openLocalProjectStore({ projectDir });
  const before = store.loadSnapshot()!;
  store.close();
  const raw = before.project as Project;
  const ts0 = raw.tilesets.beodeul_city!;
  const beodeulMaps = Object.values(raw.maps).filter((m) => m.tilesetId === "beodeul_city");
  const renders = new Map<string, Buffer>();
  for (const map of Object.values(raw.maps)) {
    try { renders.set(map.id, renderMapPng(raw, map, 1).png); } catch (e) { console.warn(name, map.id, "render(before) failed", (e as Error).message); }
  }
  const p = structuredClone(raw);
  beodeulTailRelocations.length = 0;
  ensureBundledTilesets(p);
  const moved = [...beodeulTailRelocations];
  const ts = p.tilesets.beodeul_city!;
  const grafts0 = ts0.tileGrafts ?? [], grafts = ts.tileGrafts ?? [];
  const lostPictures = new Set(grafts0.map((g) => `${g.sourceChipset}:${g.sourceTile}`));
  for (const g of grafts) lostPictures.delete(`${g.sourceChipset}:${g.sourceTile}`);
  assert.equal(lostPictures.size, 0, `${name}: 이식 그림이 사라졌다 ${[...lostPictures].slice(0, 5)}`);
  assert(!grafts.some((g) => g.targetTile >= 23936 && g.targetTile < 28672), `${name}: 번들 꼬리 안에 이식 칸이 남았다`);
  assert(townWallAvailable(ts), `${name}: 성벽 칸이 실리지 않았다`);
  const mapDiffs: Record<string, string> = {};
  for (const map of Object.values(p.maps)) {
    const b = renders.get(map.id); if (!b) continue;
    const a = renderMapPng(p, map, 1).png;
    mapDiffs[map.id] = sameImage(a, b) ? "same" : "DIFFERENT";
  }
  // 성벽 마을 하나를 새 맵에 짓는다
  const ctx: { project: Project } = { project: p };
  const town = runTool(ctx as never, "author_beodeul_town", { id: "map_wall_relocation_proof", name: "성벽 마을 (이식 칸 옮김 증명)", walls: true, houseCount: 5, seed: 7 }, { dryRun: false }) as { ok: boolean; summary: string; data?: { mapId: string; walls?: unknown; houses?: number } };
  assert(town.ok, `${name}: 성벽 마을 실패 ${town.summary}`);
  const townMap = ctx.project.maps[town.data!.mapId]!;
  const wallCells = (townMap.upperTiles ?? []).filter((t) => t >= BEODEUL_TOWN_WALL_BASE && t < BEODEUL_TOWN_WALL_BASE + 128).length;
  assert(wallCells > 50, `${name}: 성벽 칸이 맵에 없다(${wallCells})`);
  fs.writeFileSync(`${dir}/walled-town-1x.png`, renderMapPng(ctx.project, townMap, 1).png);
  // 사본에 저장 → 다시 열기
  store = await openLocalProjectStore({ projectDir });
  const saved = await store.saveSerialized(serialize(ctx.project), before.sha256);
  assert.equal(saved.kind, "saved");
  store.close();
  store = await openLocalProjectStore({ projectDir });
  const loaded = store.loadSnapshot()!;
  const projectId = store.projectId;
  store.close();
  const noDocs = (t: object) => ({ ...t, referenceDocuments: undefined });
  assert.deepEqual(noDocs(loaded.project.tilesets.beodeul_city!), noDocs(ctx.project.tilesets.beodeul_city!));
  assert.deepEqual(loaded.project.maps, ctx.project.maps);
  const reloadDiffs: Record<string, string> = {};
  for (const map of Object.values(loaded.project.maps as Project["maps"])) {
    const b = renders.get(map.id); if (!b) continue;
    reloadDiffs[map.id] = sameImage(renderMapPng(loaded.project as Project, map, 1).png, b) ? "same" : "DIFFERENT";
  }
  for (const m of beodeulMaps.slice(0, 3)) {
    fs.writeFileSync(`${dir}/${m.id}-before-1x.png`, renders.get(m.id)!);
    fs.writeFileSync(`${dir}/${m.id}-after-reload-1x.png`, renderMapPng(loaded.project as Project, (loaded.project as Project).maps[m.id]!, 1).png);
  }
  // 옮긴 번호 표본: 저장본에서 이식 칸을 쓰던 맵 칸 하나
  let sample: unknown = null;
  for (const m of beodeulMaps) {
    const i = m.upperTiles.findIndex((t) => grafts0.some((g) => g.targetTile === t));
    if (i >= 0) { sample = { map: m.id, cell: i, before: m.upperTiles[i], after: (loaded.project as Project).maps[m.id]!.upperTiles[i] }; break; }
  }
  const row = {
    copy: projectDir, projectId, revisionBefore: before.revision, revisionAfter: loaded.revision, sha256: loaded.sha256,
    countBefore: ts0.count, countAfter: ts.count, graftsBefore: grafts0.length, graftsAfter: grafts.length,
    graftRangeBefore: grafts0.length ? [Math.min(...grafts0.map((g) => g.targetTile)), Math.max(...grafts0.map((g) => g.targetTile))] : null,
    graftRangeAfter: grafts.length ? [Math.min(...grafts.map((g) => g.targetTile)), Math.max(...grafts.map((g) => g.targetTile))] : null,
    relocations: moved, beodeulMaps: beodeulMaps.length, mapsCompared: Object.keys(mapDiffs).length,
    mapDiffsAfterNormalize: mapDiffs, mapDiffsAfterReload: reloadDiffs, sampleRenumbered: sample,
    walledTown: { mapId: townMap.id, size: `${townMap.width}x${townMap.height}`, wallCells, houses: town.data?.houses, summary: town.summary.slice(0, 300) },
  };
  fs.writeFileSync(`${dir}/proof.json`, JSON.stringify(row, null, 1));
  results.push(row);
  const bad = Object.entries({ ...mapDiffs, ...reloadDiffs }).filter(([, v]) => v !== "same");
  console.log(JSON.stringify({ name, moved, maps: Object.keys(mapDiffs).length, different: bad, wallCells, houses: town.data?.houses, rev: `${before.revision}->${loaded.revision}` }));
}
fs.writeFileSync(`${OUT}/proof.json`, JSON.stringify(results, null, 1));
