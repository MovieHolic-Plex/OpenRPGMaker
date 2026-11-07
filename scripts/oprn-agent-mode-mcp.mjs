#!/usr/bin/env node
// 에이전트 모드(실험)의 MCP 서버. 사용자 PC 의 코딩 에이전트(claude-agent-acp·codex-acp·opencode acp)가
// 자식 프로세스로 띄운다(stdio, 줄 단위 JSON-RPC). 도구 목록·스키마·실행은 전부 「열린 편집기」에 묻는다:
//   에이전트 ─MCP─▶ 이 프로세스 ─HTTP(127.0.0.1, 토큰)─▶ 데스크톱 메인 AgentHost ─▶ 편집기 렌더러가 스토어에서 실행
// 그래서 이 프로세스는 프로젝트 파일을 읽지도 쓰지도 않는다 — 쓰기는 편집기가 자기 저장 경로(브리지)로 한다.
// 환경 변수: OPRN_AGENT_HOST (http://127.0.0.1:<port>), OPRN_AGENT_TOKEN.
// Electron 바이너리로도 돈다(ELECTRON_RUN_AS_NODE=1) — node 가 없는 PC 에서도 패키지만으로 실행된다.
import { request as httpRequest } from "node:http";
import { createInterface } from "node:readline";

const HOST = process.env.OPRN_AGENT_HOST;
const TOKEN = process.env.OPRN_AGENT_TOKEN ?? "";
const RESULT_CAP = 30_000;

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const cap = (text) => (text.length > RESULT_CAP ? `${text.slice(0, RESULT_CAP)}\n…(${text.length - RESULT_CAP} chars cut)` : text);

async function ask(kind, payload) {
  if (!HOST) throw new Error("OPRN_AGENT_HOST is not set — this server must be started by OPRN Studio agent mode");
  // fetch(undici) 는 응답 머리를 300초 넘게 기다리면 끊는다 — 없는 기물 그리기는 한 판이 5~15분이다. 시간 상한은 호스트(agentHost toolTimeoutMs)가 정한다.
  const text = JSON.stringify({ kind, ...payload });
  const { status, raw } = await new Promise((resolve, reject) => {
    const req = httpRequest(`${HOST}/agent-mcp`, { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(text), "x-oprn-agent-token": TOKEN } }, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { chunks += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, raw: chunks }));
    });
    req.on("error", reject);
    req.end(text);
  });
  let body;
  try { body = JSON.parse(raw); } catch { body = { ok: false, error: `HTTP ${status}` }; }
  if (status < 200 || status >= 300 || body.ok === false && body.error) throw new Error(body.error ?? `HTTP ${status}`);
  return body.result;
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const id = request.id;
  try {
    if (request.method === "initialize") {
      send({ jsonrpc: "2.0", id, result: { protocolVersion: request.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "oprn", version: "1" } } });
      return;
    }
    if (typeof request.method === "string" && request.method.startsWith("notifications/")) return;
    if (request.method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: await ask("list", {}) } });
      return;
    }
    if (request.method === "tools/call") {
      const { name, arguments: args = {} } = request.params ?? {};
      const result = await ask("call", { name, args });
      const text = typeof result?.text === "string" ? result.text : JSON.stringify(result);
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: cap(text) }], isError: result?.isError === true } });
      return;
    }
    if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${request.method}` } });
  } catch (error) {
    if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
  }
});
