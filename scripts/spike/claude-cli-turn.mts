// 스파이크: 사용자의 로컬 `claude -p` 를 조수 엔진으로 한 턴 끝까지 돌린다(병합하지 않는 실험 코드).
//
//   bun scripts/spike/claude-cli-turn.mts [--model sonnet] [--out verify-shots/assistant-claude-p] [--task "..."]
//
// 흐름: 시험 프로젝트를 SQLite 폴더에 저장·재로드 → MCP 서버(127.0.0.1, 실행별 비밀값) + claude -p(stream-json)
//   → 결과 프로젝트 → mergeMapBundles + commitChangeset(편집기와 같은 게이트) → SQLite 저장 → 다시 열어 비교 → 전후 PNG.
// 기록: events.ndjson(우리 이벤트, 편집기 /v1/agent/run 과 같은 모양) · claude-stream.ndjson(CLI 원본 줄) · summary.json.

import fs from "node:fs";
import path from "node:path";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { createHeadlessBlankProject, setHeadlessPublicRoot } from "../../src/headless/index.ts";
import { commitChangeset } from "../../src/editor/tools/index.ts";
import { mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { detectClaudeCli } from "../lib/localCliAgent/claudeCli.ts";
import { runLocalCliAgent } from "../lib/localCliAgent/runLocalCliAgent.ts";

const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const out = path.resolve(arg("out", "verify-shots/assistant-claude-p")!);
const projectDir = path.resolve(".vite-cache/assistant-claude-p/project");
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(projectDir, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
setHeadlessPublicRoot(path.resolve("public"));

// 기록에 남기면 안 되는 값(우리 비밀값·홈 경로)을 지운다. 토큰처럼 보이는 긴 문자열도 가린다.
const secrets: string[] = [];
const scrub = (text: string) => {
  let value = text;
  for (const secret of secrets) value = value.split(secret).join("<mcp-token>");
  return value.replace(/(sk-ant-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, "$1…").split(process.env.HOME ?? "/home/x").join("~");
};
const write = (file: string, line: unknown) => fs.appendFileSync(path.join(out, file), `${scrub(JSON.stringify(line))}\n`);

// 1) CLI 찾기·로그인 확인 — 토큰은 보지 않는다.
const cli = detectClaudeCli();
write("events.ndjson", { type: "detect", ...cli });
if (!cli.found || !cli.loggedIn) { console.error("Claude Code 미설치 또는 미로그인", cli); process.exit(2); }

// 2) 시험 프로젝트 — 편집기가 여는 빈 프로젝트(버들항 20×15 빈 맵). SQLite 정본에 저장하고 다시 읽은 것을 출발점으로 쓴다.
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

// 3) 한 턴.
const task = arg("task", [
  `맵 ${mapId}(20×15, 지금은 비어 있음)를 작은 마을 공터로 꾸며 줘.`,
  "바닥을 풀로 채우고, 맵 가운데를 가로지르는 흙길 하나를 깔고, 길 위쪽에 나무 두 그루, 길 아래쪽에 우물이나 비슷한 소품 하나를 놓아라.",
  "칩셋 참고문서를 먼저 읽고, 끝나면 show_map_region 으로 맵 전체를 보고 확인한 뒤 짧게 보고해라.",
].join(" "))!;
const toolNames = [
  "get_project_summary", "get_map_region", "show_map_region",
  "list_tileset_references", "read_tileset_reference", "list_tileset_objects",
  "paint_tiles", "paint_road", "stamp_tileset_object", "place_props",
];
const started = Date.now();
const done = await runLocalCliAgent(
  { provider: "local-cli:claude", task, mapIds: [mapId], currentMapId: mapId, scopeStrict: true, project: base, ...(arg("model") ? { model: arg("model") } : {}) },
  {
    toolNames,
    renderToolImage: async (project, _tool, data) => renderToolRegionPngBase64(project, data),
    onEvent: (event) => {
      if (event.type === "done") { write("events.ndjson", { ...event, project: "<결과 프로젝트 — summary.json 참고>" }); return; }
      write("events.ndjson", event.type === "map_delta" ? { type: "map_delta", at: event.at, maps: event.maps.map((m) => ({ mapId: m.mapId, cells: JSON.stringify(m).length })) } : event);
      if (event.type === "tool_end") console.log(`${event.ok ? "OK  " : "FAIL"} ${event.name} — ${event.summary.slice(0, 140)}`);
      if (event.type === "assistant") console.log(`assistant: ${event.text.replace(/\n/g, " ").slice(0, 200)}`);
      if (event.type === "error") console.log(`ERROR ${event.message}`);
    },
    onRawLine: (message) => write("claude-stream.ndjson", message),
    onStderr: (text) => fs.appendFileSync(path.join(out, "claude-stderr.txt"), scrub(text)),
  },
);

// 4) 편집기와 같은 하류: 맵 묶음 병합 → 커밋 게이트.
const merged = mergeMapBundles(base, [{ mapIds: [mapId], project: done.project }]);
const gate = commitChangeset(merged.project, base);
const finalProject = gate.ok ? merged.project : base;

// 5) 정본 저장 → 다시 열어 비교.
store = await openLocalProjectStore({ projectDir });
const saved2 = await store.saveProject(finalProject);
store.close();
store = await openLocalProjectStore({ projectDir });
const reloaded = store.loadSnapshot()!;
store.close();
const reloadEqual = JSON.stringify(reloaded.project.maps[mapId]) === JSON.stringify(finalProject.maps[mapId]);
fs.writeFileSync(path.join(out, "after.png"), renderMapPng(reloaded.project, reloaded.project.maps[mapId]!, 2).png);

const lowerBefore = base.maps[mapId]!.lowerTiles, lowerAfter = reloaded.project.maps[mapId]!.lowerTiles;
const upperBefore = base.maps[mapId]!.upperTiles, upperAfter = reloaded.project.maps[mapId]!.upperTiles;
const changedCells = lowerAfter.reduce((n, v, i) => n + (v !== lowerBefore[i] || upperAfter[i] !== upperBefore[i] ? 1 : 0), 0);
const summary = {
  cli: { version: cli.version, authMethod: cli.authMethod, apiProvider: cli.apiProvider },
  task, mapId, projectId, storage: path.relative(process.cwd(), projectDir),
  ms: Date.now() - started, stats: done.stats, changedKeys: done.changedKeys,
  merge: { spills: merged.spills, conflicts: merged.conflicts },
  gate: { ok: gate.ok, issues: ((gate as { issues?: { severity: string; code: string; message: string }[] }).issues ?? []).filter((i) => i.severity === "error").slice(0, 10) },
  saved: saved2.kind, reloadRevision: reloaded.revision, reloadEqual, changedCells,
};
fs.writeFileSync(path.join(out, "summary.json"), scrub(JSON.stringify(summary, null, 2)));
console.log(JSON.stringify(summary, null, 2));
