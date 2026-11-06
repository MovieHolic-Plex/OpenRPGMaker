#!/usr/bin/env node
// 코딩 에이전트에 편집기 도구를 MCP 로 주는 얇은 다리 — 호출은 데워 둔 호스트(oprn-agent-host.mjs serve)로 넘긴다.
// 도구 목록을 통째로 주지 않는다: 편집기 도구는 526개 · 스키마 1.24M 자(약 41만 토큰)라 Claude Code 가 첫 차례에
// 「Autocompact is thrashing」으로 죽었다(2026-11-06 agent-direct-edit Phase 2 실측). 한 줄 설명 + 위 단계 스키마만으로도 약 9만 토큰.
// 그래서 스키마가 작은 자주 쓰는 도구만 MCP 도구로 바로 주고(약 1.2만 토큰), 나머지는 oprn_tools(찾기) · oprn_schema · oprn_call 로 닿는다.
//   claude --mcp-config '{"mcpServers":{"oprn":{"command":"node","args":["scripts/oprn-agent-mcp.mjs","--port","9850"]}}}'
import { createInterface } from "node:readline";

const argv = process.argv.slice(2);
const portArg = argv.indexOf("--port");
const BASE = `http://127.0.0.1:${portArg >= 0 ? Number(argv[portArg + 1]) : 9850}`;
const RESULT_CAP = 30_000;
// 스키마+설명 6천 자 이하이면서 실제 실행에서 자주 쓰인 도구. 큰 스키마 도구(place_npc 4.6만 자 · upsert_event 4.2만 자 ·
// make_villager 4.8만 자 · define_ending 2.6만 자 …)는 oprn_call 로 부른다.
export const NATIVE_TOOLS = ["get_project_summary", "create_map", "list_hand_interior_parts", "get_event", "find_events", "set_start_position",
  "link_maps", "place_door", "place_chest", "declare_story_flag", "manage_flag_slot", "create_opening_animatic_shot", "get_database_records",
  "upsert_troop", "author_forest_route", "check_reachability", "play_walkthrough", "run_scene_test", "get_map_region", "show_map_region",
  "paint_tiles", "stamp_object", "find_village_type", "add_event_page", "patch_event_page"];

const getJson = async (path) => (await fetch(BASE + path)).json();
const runTool = async (name, args, map) => (await fetch(`${BASE}/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, args: args ?? {}, ...(map ? { map } : {}) }) })).json();
const capped = (text) => (text.length > RESULT_CAP ? `${text.slice(0, RESULT_CAP)}\n…(${text.length - RESULT_CAP}자 더 있음 — 범위를 좁혀 다시 부르세요)` : text);
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

let listed = null;
async function toolList() {
  if (listed) return listed;
  const all = await getJson("/tools");
  const names = new Set(all.map((t) => t.name));
  listed = [
    { name: "oprn_tools", description: `편집기 도구 ${all.length}개를 낱말로 찾는다(이름·설명). 이름 [read|write] 한 줄 설명을 돌려준다.`, inputSchema: { type: "object", properties: { query: { type: "string" } } } },
    { name: "oprn_schema", description: "편집기 도구 하나의 전체 JSON 스키마와 설명.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "oprn_call", description: "편집기 도구를 이름으로 부른다(편집기 조수와 같은 실행기; 성공한 쓰기는 열린 프로젝트에 바로 저장된다).",
      inputSchema: { type: "object", properties: { name: { type: "string" }, args: { type: "object" }, mapId: { type: "string" } }, required: ["name"] } },
  ];
  for (const name of NATIVE_TOOLS.filter((n) => names.has(n))) {
    const schema = await getJson(`/schema?name=${encodeURIComponent(name)}`);
    listed.push({ name, description: `${String(schema.description ?? "").slice(0, 1200)}${schema.mode === "write" ? " [writes]" : ""}`,
      inputSchema: schema.parameters?.type === "object" ? schema.parameters : { type: "object", properties: {} } });
  }
  return listed;
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const { id, method, params } = request;
  const reply = (value, isError = false) => send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: capped(typeof value === "string" ? value : JSON.stringify(value)) }], isError } });
  try {
    if (method === "initialize") return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "oprn-agent", version: "1" } } });
    if (method?.startsWith("notifications/")) return;
    if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: await toolList() } });
    if (method === "tools/call") {
      const { name, arguments: a = {} } = params;
      if (name === "oprn_tools") {
        const q = String(a.query ?? "").toLowerCase();
        return reply((await getJson("/tools")).filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q)).map((t) => `${t.name} [${t.mode}] ${t.description}`).join("\n"));
      }
      if (name === "oprn_schema") return reply(await getJson(`/schema?name=${encodeURIComponent(a.name ?? "")}`));
      const result = name === "oprn_call" ? await runTool(a.name, a.args, a.mapId) : await runTool(name, a);
      return reply(result, result.ok === false);
    }
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `no method ${method}` } });
  } catch (error) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(error instanceof Error ? error.message : error) } });
  }
});
