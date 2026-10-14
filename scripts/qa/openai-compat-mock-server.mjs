#!/usr/bin/env node
// OpenAI 호환 모의 서버 — 「사용자 지정 (OpenAI 호환)」 제공자 시험용. 실제 모델이 아니다.
//
//   node scripts/qa/openai-compat-mock-server.mjs --port 18401 --key sk-mock --script steps.json --log calls.jsonl
//
// 흉내 내는 것: GET /v1/models, POST /v1/chat/completions(SSE 스트리밍·비스트리밍·도구 호출).
// 시험용 스위치:
//   --key <값>          Authorization: Bearer <값> 을 요구한다(CLIProxyAPI 처럼 {"error":"Missing API key"} 로 401).
//   --no-tools          요청에 tools 가 있으면 400 (이 모델은 도구를 못 쓴다).
//   --no-models         GET /v1/models 를 404 로.
//   --reject-reasoning  reasoning_effort 가 있으면 400 (모르는 인자).
//   --rate-limit        chat/completions 를 429 + Retry-After 로.
//   --delay <ms>        응답 전 지연.
//   --script <json>     대화 단계 [{text}|{tool:{name,args}}|{tools:[...]}]. 대화에 든 assistant 메시지 수가 단계 번호다.
//   --log <jsonl>       요청 요약을 한 줄씩 남긴다(키 값은 남기지 않고 authOk 만).
//   --dump <jsonl>      요청 본문(메시지 글)을 한 줄씩 남긴다 — 어떤 프롬프트가 왔는지 볼 때. Authorization 헤더는 쓰지 않는다.
//   --classify-reply <json>  system 메시지가 「You classify ONE user request」 로 시작하는 의도 분류 호출에 이 JSON 문자열을 답으로 준다.
//   --tools-only-script 스크립트를 tools 가 실린 요청에만 적용한다(tools 없는 요청은 짧은 글만 돌려준다).
// 비밀: 이 서버는 키를 로그·표준 출력에 찍지 않는다.

import { createServer } from "node:http";
import { appendFileSync, readFileSync } from "node:fs";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const next = process.argv[index + 1];
  return next === undefined || next.startsWith("--") ? true : next;
}

const port = Number(arg("port", 18401));
const requiredKey = typeof arg("key", "") === "string" ? arg("key", "") : "";
const noTools = arg("no-tools", false) === true;
const noModels = arg("no-models", false) === true;
const rejectReasoning = arg("reject-reasoning", false) === true;
const rateLimit = arg("rate-limit", false) === true;
const delayMs = Number(arg("delay", 0)) || 0;
const logPath = typeof arg("log", "") === "string" ? arg("log", "") : "";
const dumpPath = typeof arg("dump", "") === "string" ? arg("dump", "") : "";
const toolsOnlyScript = arg("tools-only-script", false) === true;
const classifyReply = typeof arg("classify-reply", "") === "string" ? arg("classify-reply", "") : "";
const scriptPath = typeof arg("script", "") === "string" ? arg("script", "") : "";
const steps = scriptPath ? JSON.parse(readFileSync(scriptPath, "utf8")) : [];

function log(entry) {
  if (!logPath) return;
  appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function send(res, status, body, headers = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(raw);
}

function authState(req) {
  const header = String(req.headers.authorization ?? "");
  if (!requiredKey) return { ok: true, present: Boolean(header) };
  if (!header) return { ok: false, present: false, message: "Missing API key" };
  return header === `Bearer ${requiredKey}` ? { ok: true, present: true } : { ok: false, present: true, message: "Invalid API key" };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function messageParts(message) {
  return Array.isArray(message?.content) ? message.content : [];
}

function summarize(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return {
    model: body.model,
    stream: body.stream === true,
    tools: Array.isArray(body.tools) ? body.tools.map((tool) => tool?.function?.name).filter(Boolean) : [],
    reasoning_effort: body.reasoning_effort,
    max_tokens: body.max_tokens ?? body.max_completion_tokens,
    roles: messages.map((message) => message.role),
    imageParts: messages.reduce((n, message) => n + messageParts(message).filter((part) => part?.type === "image_url").length, 0),
    toolResults: messages.filter((message) => message.role === "tool").length,
  };
}

function chunk(id, model, delta, finish = null, extra = {}) {
  return `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;
}

function stepFor(body) {
  const first = Array.isArray(body.messages) ? body.messages[0] : undefined;
  if (classifyReply && first?.role === "system" && String(first.content ?? "").startsWith("You classify ONE user request")) return { text: classifyReply };
  if (toolsOnlyScript && !(Array.isArray(body.tools) && body.tools.length)) return { text: "mock-ok" };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const assistantTurns = messages.filter((message) => message.role === "assistant").length;
  return steps[assistantTurns] ?? { text: "mock-ok" };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://mock.local");
  const auth = authState(req);
  if (req.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
    log({ path: url.pathname, authOk: auth.ok, authPresent: auth.present });
    if (!auth.ok) return send(res, 401, { error: auth.message });
    if (noModels) return send(res, 404, { error: "404 page not found" });
    return send(res, 200, { object: "list", data: ["mock-chat", "mock-reasoner", "mock-vision"].map((id) => ({ id, object: "model", owned_by: "mock" })) });
  }
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch { return send(res, 400, { error: { message: "invalid json" } }); }
    log({ path: url.pathname, authOk: auth.ok, authPresent: auth.present, ...summarize(body) });
    if (dumpPath) appendFileSync(dumpPath, `${JSON.stringify({ messages: (body.messages ?? []).map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 1500) : JSON.stringify(m.content ?? "").slice(0, 1500) })) })}\n`);
    if (!auth.ok) return send(res, 401, { error: auth.message });
    if (rateLimit) return send(res, 429, { error: { message: "Rate limit reached", type: "rate_limit_error" } }, { "Retry-After": "1" });
    if (noTools && Array.isArray(body.tools) && body.tools.length) {
      return send(res, 400, { error: { message: "tools is not supported by this model (function calling unavailable)", type: "invalid_request_error" } });
    }
    if (rejectReasoning && body.reasoning_effort !== undefined) {
      return send(res, 400, { error: { message: "Unrecognized request argument supplied: reasoning_effort", type: "invalid_request_error" } });
    }
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const id = `chatcmpl-mock-${Date.now()}`;
    const model = String(body.model ?? "mock-chat");
    const step = stepFor(body);
    const calls = step.tools ?? (step.tool ? [step.tool] : []);
    const toolCalls = calls.map((call, index) => ({ id: `call_mock_${index}_${Date.now()}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) } }));
    const usage = { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 };
    if (body.stream !== true) {
      return send(res, 200, { id, object: "chat.completion", created: Math.floor(Date.now() / 1000), model, usage,
        choices: [{ index: 0, message: { role: "assistant", content: step.text ?? null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, finish_reason: toolCalls.length ? "tool_calls" : "stop" }] });
    }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(chunk(id, model, { role: "assistant", content: "" }));
    const text = step.text ?? "";
    for (let i = 0; i < text.length; i += 6) res.write(chunk(id, model, { content: text.slice(i, i + 6) }));
    toolCalls.forEach((call, index) => {
      res.write(chunk(id, model, { tool_calls: [{ index, id: call.id, type: "function", function: { name: call.function.name, arguments: "" } }] }));
      const args = call.function.arguments;
      for (let i = 0; i < args.length; i += 24) res.write(chunk(id, model, { tool_calls: [{ index, function: { arguments: args.slice(i, i + 24) } }] }));
    });
    res.write(chunk(id, model, {}, toolCalls.length ? "tool_calls" : "stop"));
    res.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [], usage })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return undefined;
  }
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, { endpoints: ["POST /v1/chat/completions", "GET /v1/models"], mock: true });
  return send(res, 404, { error: "404 page not found" });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock openai-compatible server listening on http://127.0.0.1:${port}/v1 (auth=${requiredKey ? "required" : "none"} tools=${noTools ? "no" : "yes"} models=${noModels ? "404" : "yes"})\n`);
});
