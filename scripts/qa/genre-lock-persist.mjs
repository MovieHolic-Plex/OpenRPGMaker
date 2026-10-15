#!/usr/bin/env node
// 장르 잠금 저장→재로드 증거: 몬스터 프리셋으로 만든 프로젝트를 SQLite 프로젝트 폴더에 저장하고 새 연결로 다시 읽는다.
// 실행: node scripts/qa/genre-lock-persist.mjs [projectDir]   (생략하면 임시 폴더). 장르 잠금이 없는 프로젝트는 직렬화에 genreLock 키가 없어야 한다.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "../ontology-ts-loader.mjs";

const HEADLESS = resolve(fileURLToPath(new URL("../../src/headless/index.ts", import.meta.url)));
const STORE = resolve(fileURLToPath(new URL("../../electron/local-store/store.ts", import.meta.url)));
const PUBLIC_DIR = resolve(fileURLToPath(new URL("../../public", import.meta.url)));
const args = process.argv.slice(2);
const fromIndex = args.indexOf("--from");
const fromFile = fromIndex >= 0 ? args.splice(fromIndex, 2)[1] : undefined;   // --from <project.json>: 이 프로젝트(예: oprn-tools --write 결과)를 저장·재로드한다
const projectDir = args[0] ?? mkdtempSync(resolve(tmpdir(), "genre-lock-"));

await withTsModule(HEADLESS, "headless.mjs", async (headless) => {
  await withTsModule(STORE, "store.mjs", async (storeModule) => {
    headless.setHeadlessPublicRoot(PUBLIC_DIR);
    const plain = headless.normalizeHeadlessProject(headless.createHeadlessBlankProject());
    const plainJson = headless.serializeHeadlessProject(plain);
    console.log(JSON.stringify({ check: "no-lock project has no genreLock key", ok: !plainJson.includes("genreLock") }));

    let project;
    if (fromFile) project = headless.loadHeadlessProject((await import("node:fs")).readFileSync(fromFile, "utf8"));
    else {
      const run = headless.runHeadlessToolWithProject(plain, "reset_project", { prompt: "포켓몬 라이크", title: "별빛 몬스터", genrePreset: "monster-collect" });
      if (!run.result.ok) throw new Error(`reset_project failed: ${run.result.summary}`);
      project = run.project;
    }
    const saved = headless.normalizeHeadlessProject(project);
    const store = await storeModule.initLocalProjectStore({ projectDir });
    const projectId = store.projectId;
    await store.saveProject(saved);
    store.close();

    const reopened = await storeModule.openLocalProjectStore({ projectDir });
    const snapshot = reopened.loadSnapshot();
    reopened.close();
    const lock = snapshot?.project.system.genreLock;
    const startMap = snapshot?.project.maps[snapshot.project.startMapId];
    console.log(JSON.stringify({
      check: "SQLite save -> reload preserves system.genreLock", projectDir, projectId,
      reloadedGenreLock: lock, startMapTileset: startMap?.tilesetId,
      maps: Object.fromEntries(Object.values(snapshot?.project.maps ?? {}).map((map) => [map.name, map.tilesetId])),
      ok: !!lock && lock.preset === "monster-collect" && lock.mode === "enforce" && lock.allowedFamilies.includes("oprn-monster"),
    }, null, 1));
  });
});
