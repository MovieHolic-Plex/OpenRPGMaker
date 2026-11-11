// 오프닝 검수 그림(모델 없음): 화면 검수자가 받는 것과 같은 그림 — 애니메틱 장면마다 `vqaShotPlan` 의 시각으로 찍은 표본 — 을 PNG 로 낸다.
// 그림은 편집기와 같은 캔버스 코드(`renderOpeningAnimaticPreview`, bare)가 그린다. 그래서 dev 서버가 떠 있어야 한다(`npm run dev:worktree`).
//   bun scripts/qa/assistant-v2/openingShots.mts <project.json|run-dir> <outPrefix> [--rebuild] [--origin http://127.0.0.1:9850]
// --rebuild: 저장본의 오프닝을 버리고 지금 코드의 `applyBlueprintOpening` 으로 다시 깐 뒤 찍는다(빌더 수정 전/후 비교의 «후»).
// 찍은 프로젝트는 <outPrefix>-project.json, 장면 목록은 <outPrefix>-shots.json 으로 남는다.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { applyBlueprintOpening } from "../../../src/editor/tools/blueprintOpening.ts";
import { vqaShotPlan } from "../../../src/ai/v2/judge/vqa.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const [input, prefix] = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--origin");
if (!input || !prefix) throw new Error("openingShots <project.json|run-dir> <outPrefix> [--rebuild] [--origin <dev 서버>]");
const project: Project = input.endsWith(".json") ? JSON.parse(fs.readFileSync(input, "utf8")) : readProjectSqlite(path.join(input, "project"));
fs.mkdirSync(path.dirname(prefix), { recursive: true });
if (argv.includes("--rebuild")) {
  if (project.system.opening) project.system.opening = { ...project.system.opening, scenes: [], stage: undefined } as typeof project.system.opening;
  console.log(applyBlueprintOpening(project).join("\n") || "오프닝을 깔지 않았다");
}
// 시각은 `vqaShotPlan` 과 같다(시작·중간·끝). 그 계획은 그림 수 상한에서 기본 오프닝을 맨 뒤로 밀어 일부만 찍으므로, 여기서는 장면 전부를 찍는다.
const planned = new Map(vqaShotPlan(project, new Set()).filter((item) => item.shotId && item.atMs).map((item) => [item.shotId!, [...item.atMs!]]));
const scenes = project.system.opening?.scenes ?? [];
const shots = scenes.flatMap((scene, i) => scene.kind !== "animatic" ? [] : [{ shotId: scene.id, where: `오프닝 ${i + 1}/${scenes.length}`,
  atMs: planned.get(scene.id) ?? [0, Math.floor(scene.durationMs / 2), Math.max(0, Math.floor(scene.durationMs) - 1)] }]);
for (const scene of project.system.opening?.scenes ?? []) {
  const layers = scene.kind === "animatic" ? scene.composition.layers.map((l) => `${l.id}:${l.kind}${l.role ? `/${l.role}` : ""}`).join(" ") : "";
  console.log(`${scene.id} ${scene.kind} ${scene.durationMs}ms 「${scene.narration ?? ""}」 ${layers}`);
}
// 브라우저로 넘기는 사본은 맵이 쓰는 타일셋만 싣는다(전부 실으면 100MB 를 넘어 페이지가 죽는다).
const used = new Set(Object.values(project.maps).map((map) => map.tilesetId));
const slim = { ...project, tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => used.has(id)).map(([id, t]) => [id, { ...t, referenceDocuments: undefined }])) };
fs.writeFileSync(`${prefix}-project.json`, JSON.stringify(slim));
fs.writeFileSync(`${prefix}-shots.json`, JSON.stringify(shots));
if (!shots.length) { console.log("찍을 애니메틱 장면이 없다"); process.exit(0); }
const browser = path.join(path.dirname(new URL(import.meta.url).pathname), "openingShots.browser.mjs");
const done = spawnSync("node", [browser, flag("origin") ?? `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? 9850}`, `${prefix}-project.json`, `${prefix}-shots.json`, prefix], { stdio: "inherit" });
process.exit(done.status ?? 1);
