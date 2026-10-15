// 연애 기본값(하루 루프·호감 HUD·타이틀·장르 잠금) 증거 — 모델 없이.
//   bun scripts/qa/romance-fix/defaults.mts <campus-seed.json> <outDir>
// 입력은 연애 인터뷰(gameDesignBrief.interview.genre=romance)가 박힌 프로젝트(씨앗) JSON 이다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { applyRomanceDefaults } from "../../../src/project/romancePreset.ts";
import { genreLockReport } from "../../../src/project/genreLock.ts";
import type { Project } from "../../../src/project/types.ts";
const [seedFile, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(seedFile, "utf8")) as Project;
const log: Record<string, unknown> = {};
const before = { genre: project.gameDesignBrief?.interview?.genre, timeSystem: project.system.timeSystem ?? null, socialLoop: (project.system as any).socialLoop ?? null, hud: project.system.fieldHud ?? null, title: project.system.titleScreen?.backgroundResourceId, lock: project.system.genreLock ?? null, startTileset: project.maps[project.startMapId]?.tilesetId };
log.before = before;
log.applied = applyRomanceDefaults(project);
log.applyTwice = applyRomanceDefaults(project); // 멱등
log.after = { timeSystem: project.system.timeSystem, socialLoop: project.system.socialLoop, hudWidgets: project.system.fieldHud?.widgets?.map(w => `${w.id}:${w.source}/${w.shape}`), title: project.system.titleScreen?.backgroundResourceId, lock: project.system.genreLock?.preset ?? null };
// 잠금이 걸렸으면 조수 경로는 허용 밖 칩셋을 거부한다.
const ctx = { project: structuredClone(project) as Project, assistantRun: true } as never;
const jp = Object.keys(project.tilesets).find(id => /beodeul|atlas_biome_interior/.test(id)) ?? "";
const r = runTool(ctx, "create_map", { name: "버들항 시험", tilesetId: jp || Object.keys(project.tilesets)[0], width: 20, height: 15 });
log.createMapOutsideFamily = { tileset: jp, ok: r.ok, message: r.ok ? null : (r as any).issues?.[0]?.message?.slice(0, 200) };
const r2 = runTool(ctx, "create_map", { name: "도시 거리 시험", tilesetId: "modern_city", width: 30, height: 24 });
log.createMapInsideFamily = { ok: r2.ok };
log.report = genreLockReport(project);
writeFileSync(`${outDir}/project.json`, serialize(project));
writeFileSync(`${outDir}/defaults-log.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
