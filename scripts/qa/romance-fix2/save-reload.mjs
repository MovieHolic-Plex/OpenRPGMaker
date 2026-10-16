// 시험 프로젝트를 SQLite 폴더 저장소(project.sqlite)에 실제로 저장하고 다시 열어 같은지 확인한다 — 정본 저장 근거.
//   node scripts/qa/romance-fix2/save-reload.mjs <project.json> <newProjectDir>   (시험용 새 폴더만 — 기존 프로젝트·원격에 쓰지 않는다)
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const [file, dir] = process.argv.slice(2);
if (!file || !dir) throw Error("Usage: save-reload.mjs <project.json> <newProjectDir>");
const project = JSON.parse(fs.readFileSync(file, "utf8"));
await withTsModule("electron/local-store/store.ts", "romance-save-reload.mjs", async (api) => {
  let s = await api.initLocalProjectStore({ projectDir: dir });
  const id = s.projectId;
  try {
    const saved = await s.saveSerialized(JSON.stringify(project), null);
    assert.equal(saved.kind, "saved", `save: ${saved.kind}`);
  } finally { s.close(); }
  s = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const a = s.loadSnapshot();
    assert(a, "reload: no snapshot");
    const same = isDeepStrictEqual(Object.keys(a.project.maps).sort(), Object.keys(project.maps).sort())
      && isDeepStrictEqual((a.project.endings ?? []).map((e) => e.id).sort(), (project.endings ?? []).map((e) => e.id).sort())
      && isDeepStrictEqual(a.project.system.socialLoop, project.system.socialLoop)
      && a.project.maps[a.project.startMapId].events.length === project.maps[project.startMapId].events.length;
    console.log(JSON.stringify({ projectId: id, projectDir: dir, revision: a.revision, sha256: a.sha256.slice(0, 12), maps: Object.keys(a.project.maps).length, endings: (a.project.endings ?? []).length, reloadMatches: same }));
    assert(same, "reload differs");
  } finally { s.close(); }
});
