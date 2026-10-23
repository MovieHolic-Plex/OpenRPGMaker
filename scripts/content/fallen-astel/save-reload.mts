// 『폴른 스타』 왕도 아스텔 — 정본 저장소(project.sqlite) 저장 → 다시 열기 → 읽은 프로젝트가 같은지 확인한다.
// 입력은 플래그십 데모를 직렬화한 JSON(res480-fixture.mts, RES_WHICH=fallen, 다른 RES_ 덮어쓰기 없이)이다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/fallen-astel/save-reload.mts <fixture.json> <projectDir>
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store.ts";
import { ASTEL } from "../../../src/project/flagship/fallenAstel.ts";

const [fixture, projectDir] = process.argv.slice(2);
if (!fixture || !projectDir) throw new Error("usage: save-reload.mts <fixture.json> <projectDir>");
const serialized = readFileSync(fixture, "utf8");
const source = JSON.parse(serialized) as { maps: Record<string, { width: number; height: number; lowerTiles: number[]; upperTiles: number[]; events: { id: string; x: number; y: number }[] }> };

let store = await initLocalProjectStore({ projectDir });
const before = store.loadSnapshot();
const saved = await store.saveSerialized(serialized, before?.sha256 ?? null);
assert.equal(saved.kind, "saved", `save failed: ${JSON.stringify(saved)}`);
const projectId = store.info().projectId;
store.close();

store = await openLocalProjectStore({ projectDir });
const loaded = store.loadSnapshot();
store.close();
assert.ok(loaded, "reload returned no snapshot");
const hub = (loaded.project as typeof source).maps.fs_hub!;
const want = source.maps.fs_hub!;
assert.equal(hub.width, ASTEL.W); assert.equal(hub.height, ASTEL.H);
assert.deepEqual(hub.lowerTiles, want.lowerTiles);
assert.deepEqual(hub.upperTiles, want.upperTiles);
assert.deepEqual(hub.events.map((e) => [e.id, e.x, e.y]), want.events.map((e) => [e.id, e.x, e.y]));
const proof = {
  projectId, projectDir, storeFile: `${projectDir}/project.sqlite`, revision: loaded.revision, sha256: loaded.sha256,
  hub: { width: hub.width, height: hub.height, events: hub.events.length }, mapCount: Object.keys((loaded.project as typeof source).maps).length,
  savedAndReopened: true,
};
writeFileSync(`${projectDir}/astel-save-reload-proof.json`, JSON.stringify(proof, null, 1));
console.log(JSON.stringify(proof));
