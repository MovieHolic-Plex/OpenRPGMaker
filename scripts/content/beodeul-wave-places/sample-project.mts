// 버들항 웨이브 장소(되살림, beodeul_wave_places) — 새 프로젝트에서 등록 장소 다섯을 조수와 같은 경로(importReferenceScene)로 맵으로 가져와
// 정본 저장소(project.sqlite)에 저장 → 다시 열어 네 층·타일셋이 같은지 확인하고, 장소마다 출하 플레이어용 프로젝트 JSON(시작 맵만 다름)을 쓴다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/beodeul-wave-places/sample-project.mts <projectDir> <outDir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store.ts";
import { createBlankProject } from "../../../src/project/defaults";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets";
import { preloadRegionReferenceScene, importReferenceScene } from "../../../src/project/regionReferenceImport";
import { BEODEUL_WAVE_PLACE_REFERENCES } from "../../../src/project/beodeulWavePlaceReferences";
import type { MapId, Project } from "../../../src/project/types";

const [projectDir, outDir] = process.argv.slice(2);
if (!projectDir || !outDir) throw new Error("usage: sample-project.mts <projectDir> <outDir>");
const p = createBlankProject();
p.meta.title = "버들항 웨이브 장소 (되살림)";
p.system.opening = undefined;
ensureBundledTilesets(p);
assert.ok(p.tilesets.beodeul_wave_places, "새 프로젝트에 beodeul_wave_places 가 없다");
const oldMaps = Object.keys(p.maps);
const imported: { id: string; mapId: string; entry: [number, number]; mode: string }[] = [];
for (const ref of BEODEUL_WAVE_PLACE_REFERENCES) {
  const scene = await preloadRegionReferenceScene(ref.id);
  const mapId = ref.id.replace(/-/g, "_");
  const r = importReferenceScene(p, scene, { newMapId: mapId, name: ref.name });
  const m = /입구 칸 \((\d+),(\d+)\)/.exec(ref.rules.join(" "))!;
  imported.push({ id: ref.id, mapId: r.mapId, entry: [Number(m[1]), Number(m[2])], mode: r.tileset.mode });
}
for (const old of oldMaps) delete p.maps[old as MapId];
p.mapTree = { mapId: imported[0]!.mapId as MapId, children: imported.slice(1).map((i) => ({ mapId: i.mapId as MapId, children: [] })) } as Project["mapTree"];
p.startMapId = imported[0]!.mapId as MapId;
p.startPos = { x: imported[0]!.entry[0], y: imported[0]!.entry[1] };

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
mkdirSync(projectDir, { recursive: true });
let store = await initLocalProjectStore({ projectDir });
const saved = await store.saveProject(p);
assert.equal(saved.kind, "saved", JSON.stringify(saved));
const projectId = store.info().projectId;
store.close();
store = await openLocalProjectStore({ projectDir });
const snap = store.loadSnapshot();
store.close();
assert.ok(snap, "reload returned nothing");
const layers = {} as Record<string, string>;
for (const i of imported) {
  const a = p.maps[i.mapId]!, b = snap.project.maps[i.mapId]!;
  for (const k of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const) assert.deepEqual(b[k], a[k], `${i.mapId} reload differs in ${k}`);
  layers[i.mapId] = sha([b.lowerTiles, b.upperTiles]);
}
const ts = snap.project.tilesets.beodeul_wave_places!;
assert.equal(ts.count, p.tilesets.beodeul_wave_places!.count);
assert.deepEqual(ts.passability, p.tilesets.beodeul_wave_places!.passability);

const portable = structuredClone(snap.project) as Project;
for (const a of Object.values(portable.assets.uploaded)) {
  if (a.ref && !a.dataUrl) {
    const bytes = readFileSync(join(projectDir, "assets", `${a.ref.sha256}.${a.ref.extension}`));
    a.dataUrl = `data:${a.ref.mime};base64,${bytes.toString("base64")}`; delete a.ref;
  }
}
mkdirSync(outDir, { recursive: true });
for (const i of imported) {
  const one = structuredClone(portable);
  one.startMapId = i.mapId as MapId; one.startPos = { x: i.entry[0], y: i.entry[1] };
  writeFileSync(join(outDir, `${i.mapId}.project.json`), JSON.stringify(one));
}
const proof = { projectId, projectDir, storeFile: join(projectDir, "project.sqlite"), revision: snap.revision, sha256: snap.sha256,
  tilesetCount: ts.count, imported, layersSha: layers, savedAndReopened: true };
writeFileSync(join(outDir, "save-reload-proof.json"), JSON.stringify(proof, null, 1));
console.log(JSON.stringify(proof));
