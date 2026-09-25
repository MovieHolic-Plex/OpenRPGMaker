
/**
 * 진단 전용(커밋 안 함): 실제 프로젝트를 임시 SQLite 로컬 스토어에 저장하고 다시 읽어
 * 내용 동일성(참고문서 포함)과 저장 경로의 동기 비용을 잰다. 원본 프로젝트는 건드리지 않는다.
 * 실행: npx tsx scripts/qa/_save-roundtrip.mts <project.json> <label>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize, serialize } from "@/project/io";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { jsonContentDigest } from "@/project/persistence/core/contentDigest";
import { projectWireView } from "@/project/io/serialize";
import { initLocalProjectStore } from "../../electron/local-store/store";
import type { Project } from "@/project/types";

const fixturePath = process.argv[2];
const label = process.argv[3] ?? "roundtrip";
if (!fixturePath) throw new Error("usage: <project.json> <label>");
const outDir = "verify-shots/editor-perf-fix";
mkdirSync(outDir, { recursive: true });

const raw = readFileSync(fixturePath, "utf8");
const loaded = deserialize(raw) as Project;

const time = <T,>(name: string, fn: () => T): { name: string; ms: number; value: T } => {
  const t = performance.now();
  const value = fn();
  return { name, ms: Math.round((performance.now() - t) * 10) / 10, value };
};

const refDocSummary = (project: Project) => {
  const out: Record<string, { categories: number; documents: number; images: number; bytes: number }> = {};
  for (const [id, ts] of Object.entries(project.tilesets)) {
    const docs = ts.referenceDocuments;
    if (!docs) continue;
    let documents = 0;
    let images = 0;
    for (const category of docs) {
      documents += (category as { documents?: unknown[] }).documents?.length ?? 0;
      images += (category as { images?: unknown[] }).images?.length ?? 0;
    }
    out[id] = { categories: docs.length, documents, images, bytes: JSON.stringify(docs).length };
  }
  return out;
};

const projectDir = await mkdtemp(join(tmpdir(), "oprn-perf-roundtrip-"));
try {
  const store = await initLocalProjectStore({ projectDir });
  const persisted = projectWithoutEventDrafts(loaded);

  const beforeDigest = time("digest before save", () => jsonContentDigest(projectWireView(persisted))!);
  const beforeRefs = refDocSummary(persisted);

  const serialized = time("serialize for save", () => serialize(persisted));
  const saved = await store.saveSerialized(serialized.value, null);
  const reloaded = store.loadSnapshot();
  if (!reloaded) throw new Error("reload returned nothing");

  const afterDigest = time("digest after reload", () => jsonContentDigest(projectWireView(reloaded.project))!);
  const afterRefs = refDocSummary(reloaded.project);

  // 어느 키가 달라지는가 — 저장 영수증 정규화 설계의 근거
  const wireBefore = projectWireView(persisted) as Record<string, unknown>;
  const wireAfter = projectWireView(reloaded.project) as Record<string, unknown>;
  const differingKeys: Array<{ key: string; beforeDigest?: string; afterDigest?: string }> = [];
  for (const key of new Set([...Object.keys(wireBefore), ...Object.keys(wireAfter)])) {
    const a = jsonContentDigest(wireBefore[key], key);
    const b = jsonContentDigest(wireAfter[key], key);
    if (a !== b) differingKeys.push({ key, beforeDigest: a?.slice(0, 12), afterDigest: b?.slice(0, 12) });
  }
  // serializeForComparison 로도 같은 비교를 해 본다 — 현재 영수증이 쓰는 정규화
  const cmpEqual = (await import("@/project/io")).serializeForComparison(persisted)
    === (await import("@/project/io")).serializeForComparison(reloaded.project);

  // 승인된 불변식 (2)~(5'): 손실 방향 검증
  // (2) 타일셋별 referenceDocuments 깊은 동일성 + id 집합 + 문서 밖 필드
  const perTilesetDocsEqual: string[] = [];
  for (const [id, tileset] of Object.entries(persisted.tilesets)) {
    const after = reloaded.project.tilesets[id];
    if (!after) { perTilesetDocsEqual.push(`${id}: MISSING after reload`); continue; }
    const a = JSON.stringify(tileset.referenceDocuments ?? null);
    const b = JSON.stringify(after.referenceDocuments ?? null);
    if (a !== b) perTilesetDocsEqual.push(`${id}: referenceDocuments differ (${a.length} vs ${b.length} bytes)`);
    const { referenceDocuments: _a, ...restA } = tileset as Record<string, unknown>;
    const { referenceDocuments: _b, ...restB } = after as Record<string, unknown>;
    if (jsonContentDigest(restA) !== jsonContentDigest(restB)) perTilesetDocsEqual.push(`${id}: non-document fields differ`);
  }
  // (3) 맵별 타일 배열 element-wise + 길이
  const perMapProblems: string[] = [];
  for (const [id, map] of Object.entries(persisted.maps)) {
    const after = reloaded.project.maps[id];
    if (!after) { perMapProblems.push(`${id}: MISSING after reload`); continue; }
    for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const) {
      const a = (map as Record<string, unknown>)[key];
      const b = (after as Record<string, unknown>)[key];
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) perMapProblems.push(`${id}.${key} differs`);
    }
  }
  // (4) database 깊은 동일성
  const databaseEqual = jsonContentDigest(persisted.database) === jsonContentDigest(reloaded.project.database);
  // (5) 삭제 방향: 로컬에 없는 최상위 키가 재로드 뒤 생기지 않았는가 (로드 정규화가 채우는 것은 기록만)
  const addedTopKeys = Object.keys(reloaded.project as Record<string, unknown>)
    .filter((key) => !Object.prototype.hasOwnProperty.call(persisted, key));

  const refsEqual = JSON.stringify(beforeRefs) === JSON.stringify(afterRefs);
  const digestEqual = beforeDigest.value === afterDigest.value;
  const mapsEqual = JSON.stringify(Object.keys(persisted.maps).sort()) === JSON.stringify(Object.keys(reloaded.project.maps).sort());
  const tilesetsEqual = JSON.stringify(Object.keys(persisted.tilesets).sort()) === JSON.stringify(Object.keys(reloaded.project.tilesets).sort());

  const payload = {
    label,
    saveKind: saved.kind,
    digestEqual,
    refsEqual,
    mapsEqual,
    tilesetsEqual,
    beforeDigest: beforeDigest.value.slice(0, 16),
    afterDigest: afterDigest.value.slice(0, 16),
    maps: Object.keys(persisted.maps).length,
    tilesets: Object.keys(persisted.tilesets).length,
    referenceDocumentTilesets: Object.keys(beforeRefs).length,
    referenceDocumentBytes: Object.values(beforeRefs).reduce((s, v) => s + v.bytes, 0),
    serializeForComparisonEqual: cmpEqual,
    perTilesetDocumentProblems: perTilesetDocsEqual,
    perMapProblems,
    databaseEqual,
    addedTopKeys,
    differingKeys,
    timings: [beforeDigest, serialized, afterDigest].map((t) => ({ name: t.name, ms: t.ms })),
  };
  writeFileSync(`${outDir}/${label}.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  const lossProblems = [...perTilesetDocsEqual, ...perMapProblems, ...(databaseEqual ? [] : ["database differs"])];
  if (!refsEqual || !mapsEqual || !tilesetsEqual || lossProblems.length > 0) {
    console.error("ROUNDTRIP MISMATCH");
    process.exitCode = 1;
  }
} finally {
  await rm(projectDir, { recursive: true, force: true });
}
