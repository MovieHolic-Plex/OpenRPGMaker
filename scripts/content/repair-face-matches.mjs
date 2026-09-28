// 저장된 프로젝트(project.sqlite)의 NPC·배우 얼굴을 걷기 그림의 짝으로 교정한다 — 에디터가 불러올 때 하는
// 교정(src/project/faceMatchRepair.ts)과 같은 함수를, 닫혀 있는 프로젝트 폴더에 미리 적용해 정본에 남긴다.
// 저장은 로컬 SQLite 저장소 API(saveSerialized)로 하고, 다시 열어 교정 결과가 그대로인지 확인한다.
//
// 사용: node scripts/content/repair-face-matches.mjs <projectDir> [<projectDir> ...] [--dry]
//   --dry  : 바꿀 건수만 세고 저장하지 않는다.
// 실행 중인 에디터·호스트가 연 프로젝트에는 쓰지 않는다(저장 충돌). 그런 프로젝트는 열 때 자동 교정된다.
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../ontology-ts-loader.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const dirs = args.filter((arg) => arg !== "--dry");
if (dirs.length === 0) throw Error("Usage: repair-face-matches.mjs <projectDir> [...] [--dry]");

const entry = "scripts/content/repair-face-matches.entry.ts";
await withTsModule(entry, "repair-face-matches.mjs", async (api) => {
  const results = [];
  for (const dirArg of dirs) {
    const dir = fs.realpathSync(dirArg);
    let store = await api.openLocalProjectStore({ projectDir: dir });
    let projectId, project, repaired;
    try {
      const before = store.loadSnapshot();
      if (!before) { results.push({ projectDir: dirArg, skipped: "빈 저장소" }); continue; }
      projectId = store.info().projectId;
      project = JSON.parse(JSON.stringify(before.project));
      repaired = api.repairFaceMatches(project);
      if (!dry && repaired.actors + repaired.eventFaces > 0) {
        assert.equal((await store.saveSerialized(JSON.stringify(project), before.sha256)).kind, "saved");
      }
    } finally { store.close(); }
    if (dry || repaired.actors + repaired.eventFaces === 0) { results.push({ projectId, projectDir: dirArg, ...repaired, saved: false }); continue; }
    store = await api.openLocalProjectStore({ projectDir: dir });
    try {
      const after = store.loadSnapshot();
      const reloaded = JSON.parse(JSON.stringify(after.project));
      assert(isDeepStrictEqual(reloaded, project), "다시 연 프로젝트가 저장한 내용과 다르다");
      const again = api.repairFaceMatches(reloaded);
      assert.deepEqual(again, { actors: 0, eventFaces: 0 }, "다시 연 프로젝트에 교정할 얼굴이 남았다");
      results.push({ projectId, projectDir: dirArg, ...repaired, saved: true, revision: after.revision, sha256: after.sha256 });
    } finally { store.close(); }
  }
  console.log(JSON.stringify(results, null, 2));
});

