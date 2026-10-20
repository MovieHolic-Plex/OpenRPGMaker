// gemini 어댑터 녹화 재생 시험 — 이 머신의 gemini 는 로그인이 없어(2026-10-20) 실제 차례를 못 돈다.
// 가짜 gemini(test/fixtures/localCli/fake-gemini.mjs)가 stream-json 모양을 내며 각본의 도구를 «진짜» MCP 로 부른다.
// 어댑터(설정 파일·토큰·인자) → 루프(acknowledged → 관문) → runPiAgent(체크포인트·관문) 를 끝까지 지난다.
//   bun scripts/spike/gemini-replay.mts
import fs from "node:fs";
import path from "node:path";
import { createHeadlessBlankProject, setHeadlessPublicRoot } from "../../src/headless/index.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { runPiAgent } from "../lib/piAgentRuntime.ts";

setHeadlessPublicRoot(path.resolve("public"));
const out = path.resolve("verify-shots/assistant-claude-p/gemini-replay");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
process.env.OPRN_LOCAL_CLI_GEMINI = path.resolve("test/fixtures/localCli/fake-gemini.mjs");
process.env.OPRN_FAKE_GEMINI_SCRIPT = path.resolve("test/fixtures/localCli/gemini-replay.json");
// 감지: 로그인 흔적 대신 키 환경 변수로 «연결됨»을 흉내 낸다(가짜 바이너리라 실제로 쓰이지 않는다).
process.env.GEMINI_API_KEY ??= "replay-only";
const base = createHeadlessBlankProject();
const mapId = base.startMapId!;
const rows: unknown[] = [];
let checkpoints = 0;
const done = await runPiAgent({ provider: "local-cli:gemini", task: "맵 가운데에 흙길을 깔아 줘.", mapIds: [mapId], currentMapId: mapId, scopeStrict: true, project: base, applyMode: "default",
  initialToolNames: ["get_project_summary", "get_map_region", "show_map_region", "paint_road"] }, {
  renderToolImage: async (project, _tool, data) => renderToolRegionPngBase64(project, data),
  onCheckpoint: async () => { checkpoints += 1; },
  onEvent: (event) => {
    if (event.type === "done") return;
    if (event.type === "tool_end") console.log(`${event.ok ? "OK  " : "FAIL"} ${event.name} — ${event.summary.slice(0, 160)}`);
    if (event.type === "assistant") console.log(`assistant: ${event.text}`);
    if (event.type === "error") console.log(`ERROR ${event.message}`);
    rows.push(event.type === "map_delta" ? { type: "map_delta" } : event);
  },
});
fs.writeFileSync(path.join(out, "events.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
fs.writeFileSync(path.join(out, "after.png"), renderMapPng(done.project, done.project.maps[mapId]!, 2).png);
const tools = rows.filter((r): r is { type: "tool_end"; name: string; ok: boolean } => (r as { type: string }).type === "tool_end");
const summary = { tools: tools.map((t) => `${t.name}:${t.ok ? "ok" : "fail"}`), checkpoints, stats: done.stats, changedKeys: done.changedKeys };
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
