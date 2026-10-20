// 로컬 CLI 엔진 한 차례 — runPiAgent 를 그대로 부른다(provider `local-cli:<cli>`). 실시간 체크포인트·관문·spatialProof 가
// Pi 엔진과 같은 코드로 도는지 헤드리스로 확인한다. 편집기 UI 시험은 scripts/qa/local-cli-editor-e2e.mjs.
//
//   bun scripts/spike/claude-cli-turn.mts [--cli claude|codex|gemini] [--model sonnet] [--out verify-shots/assistant-claude-p/<cli>] [--task "..."]
//
// 흐름: 시험 프로젝트를 SQLite 폴더에 저장·재로드 → runPiAgent(local-cli, applyMode default, onCheckpoint=편집기처럼 수용)
//   → mergeMapBundles + commitChangeset(편집기와 같은 게이트) → SQLite 저장 → 다시 열어 비교 → 전후 PNG.

import fs from "node:fs";
import path from "node:path";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { createHeadlessBlankProject, setHeadlessPublicRoot } from "../../src/headless/index.ts";
import { commitChangeset } from "../../src/editor/tools/index.ts";
import { mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { LOCAL_CLI_ADAPTERS } from "../lib/localCliAgent/registry.ts";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import type { LocalCliId } from "../lib/localCliAgent/types.ts";

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const cli = (arg("cli", "claude") as LocalCliId);
const out = path.resolve(arg("out", `verify-shots/assistant-claude-p/${cli}`)!);
const projectDir = path.resolve(`.vite-cache/assistant-claude-p/project-${cli}`);
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(projectDir, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
setHeadlessPublicRoot(path.resolve("public"));

const scrub = (text: string) => text.replace(/(sk-ant-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, "$1…").split(process.env.HOME ?? "/home/x").join("~");
const write = (file: string, line: unknown) => fs.appendFileSync(path.join(out, file), `${scrub(JSON.stringify(line))}\n`);

const status = await LOCAL_CLI_ADAPTERS[cli].detect();
write("events.ndjson", { type: "detect", ...status, models: status.models.length });
if (status.state !== "ready") { console.error(`${status.label} ${status.stateLabel}`); process.exit(2); }

let store = await initLocalProjectStore({ projectDir });
const saved = await store.saveProject(createHeadlessBlankProject());
if (saved.kind !== "saved") throw new Error(`첫 저장 실패: ${saved.kind}`);
const projectId = store.info().projectId;
store.close();
store = await openLocalProjectStore({ projectDir });
const base = store.loadSnapshot()!.project;
store.close();
const mapId = base.startMapId!;
fs.writeFileSync(path.join(out, "before.png"), renderMapPng(base, base.maps[mapId]!, 2).png);

const task = arg("task", [
  `맵 ${mapId}(20×15, 지금은 비어 있음)를 작은 마을 공터로 꾸며 줘.`,
  "바닥을 풀로 채우고, 맵 가운데를 가로지르는 흙길 하나를 깔고, 길 위쪽에 나무 두 그루, 길 아래쪽에 우물이나 비슷한 소품 하나를 놓아라.",
  "칩셋 참고문서를 먼저 읽고, 끝나면 show_map_region 으로 맵 전체를 보고 확인한 뒤 짧게 보고해라.",
].join(" "))!;
const initialToolNames = ["get_project_summary", "get_map_region", "show_map_region", "paint_tiles", "paint_road", "stamp_tileset_object", "place_props"];
const checkpoints: { label: string; tool: string; proofKeys: number }[] = [];
const started = Date.now();
const done = await runPiAgent(
  { provider: `local-cli:${cli}`, task, mapIds: [mapId], currentMapId: mapId, scopeStrict: true, project: base, applyMode: "default", initialToolNames, ...(arg("model") ? { model: arg("model") } : {}) },
  {
    renderToolImage: async (project, _tool, data) => renderToolRegionPngBase64(project, data),
    // 편집기의 실시간 적용 자리 — 받은 체크포인트를 그대로 수용한다(편집기는 여기서 커밋 게이트·되돌리기 기록을 한다).
    onCheckpoint: async (checkpoint) => { checkpoints.push({ label: checkpoint.label, tool: checkpoint.toolName, proofKeys: Object.keys(checkpoint.spatialProof ?? {}).length }); },
    onEvent: (event) => {
      if (event.type === "done") { write("events.ndjson", { type: "done", stats: event.stats, changedKeys: event.changedKeys, spatialProof: !!event.spatialProof }); return; }
      write("events.ndjson", event.type === "map_delta" ? { type: "map_delta", at: event.at, maps: event.maps.map((m) => ({ mapId: m.mapId, bytes: JSON.stringify(m).length })) } : event.type === "prompt_inspection" ? { type: event.type } : event);
      if (event.type === "tool_end") console.log(`${event.ok ? "OK  " : "FAIL"} ${event.name} — ${event.summary.slice(0, 140)}`);
      if (event.type === "assistant") console.log(`assistant: ${event.text.replace(/\n/g, " ").slice(0, 200)}`);
      if (event.type === "error") console.log(`ERROR ${event.message}`);
      if (event.type === "execution_status") console.log(`status ${event.name}: ${String(event.summary).slice(0, 200)}`);
    },
  },
);

const merged = mergeMapBundles(base, [{ mapIds: [mapId], project: done.project }]);
const gate = commitChangeset(merged.project, base);
const finalProject = gate.ok ? merged.project : base;
store = await openLocalProjectStore({ projectDir });
const saved2 = await store.saveProject(finalProject);
store.close();
store = await openLocalProjectStore({ projectDir });
const reloaded = store.loadSnapshot()!;
store.close();
const reloadEqual = JSON.stringify(reloaded.project.maps[mapId]) === JSON.stringify(finalProject.maps[mapId]);
fs.writeFileSync(path.join(out, "after.png"), renderMapPng(reloaded.project, reloaded.project.maps[mapId]!, 2).png);
const a = base.maps[mapId]!, b = reloaded.project.maps[mapId]!;
const changedCells = b.lowerTiles.reduce((n, v, i) => n + (v !== a.lowerTiles[i] || b.upperTiles[i] !== a.upperTiles[i] ? 1 : 0), 0);
const summary = {
  cli: { id: cli, version: status.version, authMethod: status.authMethod, billing: status.billing },
  task, mapId, projectId, storage: path.relative(process.cwd(), projectDir),
  ms: Date.now() - started, stats: done.stats, changedKeys: done.changedKeys, stoppedEarly: done.stoppedEarly,
  checkpoints: checkpoints.length, checkpointTools: [...new Set(checkpoints.map((c) => c.tool))], spatialProof: !!done.spatialProof,
  merge: { spills: merged.spills, conflicts: merged.conflicts },
  gate: { ok: gate.ok, issues: ((gate as { issues?: { severity: string; code: string; message: string }[] }).issues ?? []).filter((i) => i.severity === "error").slice(0, 10) },
  saved: saved2.kind, reloadRevision: reloaded.revision, reloadEqual, changedCells,
};
fs.writeFileSync(path.join(out, "summary.json"), scrub(JSON.stringify(summary, null, 2)));
console.log(JSON.stringify(summary, null, 2));
