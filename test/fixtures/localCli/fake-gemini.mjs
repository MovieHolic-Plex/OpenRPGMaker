#!/usr/bin/env node
// 녹화 재생용 가짜 `gemini` — gemini-cli 0.38 의 `--output-format stream-json` 모양(init·message·tool_use·tool_result·result)을
// 그대로 내면서, 각본의 도구 호출은 «진짜로» 우리 MCP 서버에 보낸다(설정 파일·토큰 환경 변수도 실제 어댑터가 만든 것).
// 이 머신의 gemini 는 로그인이 없어 실제 차례를 못 돈다 — 어댑터·루프·관문 경로를 이것으로 끝까지 검증한다.
//   각본: OPRN_FAKE_GEMINI_SCRIPT=<json> { "turns": [ { "say"?: string, "tools"?: [{ "name", "args" }] } ... ] }
import { readFileSync } from "node:fs";
const out = (line) => process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), ...line })}\n`);
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("0.38.1-fake"); process.exit(0); }
const settings = JSON.parse(readFileSync(process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH, "utf8"));
const server = settings.mcpServers?.oprn;
const script = JSON.parse(readFileSync(process.env.OPRN_FAKE_GEMINI_SCRIPT, "utf8"));
const resumed = args.includes("--resume");
let stdin = ""; for await (const chunk of process.stdin) stdin += chunk;
const session = "fake-gemini-session";
out({ type: "init", session_id: session, model: args[args.indexOf("-m") + 1] ?? "auto" });
out({ type: "message", role: "user", content: stdin.slice(0, 200) });
let rpc = 0;
const call = async (method, params) => {
  const token = String(server.headers.Authorization).replace(/^Bearer \$/u, "");
  const res = await fetch(server.httpUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env[token]}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpc, method, params }) });
  return (await res.json()).result;
};
let calls = 0;
if (server) {
  await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake-gemini", version: "0" } });
  const listed = (await call("tools/list", {})).tools.map((t) => t.name);
  for (const turn of resumed ? script.resumeTurns ?? [] : script.turns) {
    if (turn.say) out({ type: "message", role: "assistant", content: turn.say, delta: true });
    for (const tool of turn.tools ?? []) {
      const id = `tool_${++calls}`;
      out({ type: "tool_use", tool_name: tool.name, tool_id: id, parameters: tool.args ?? {} });
      if (!listed.includes(tool.name)) { out({ type: "tool_result", tool_id: id, status: "error", output: "", error: { type: "tool_not_registered", message: `Tool "${tool.name}" not found in registry.` } }); continue; }
      const result = await call("tools/call", { name: tool.name, arguments: tool.args ?? {} });
      const text = (result.content ?? []).filter((p) => p.type === "text").map((p) => p.text).join("\n");
      out({ type: "tool_result", tool_id: id, status: result.isError ? "error" : "success", output: text });
    }
  }
}
out({ type: "result", status: "success", stats: { total_tokens: 1234, input_tokens: 1000, output_tokens: 234, cached: 600, duration_ms: 10, tool_calls: calls } });
