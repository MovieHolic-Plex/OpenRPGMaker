#!/usr/bin/env node
// ChatGPT 연결 재현 — 실제 동반 서비스(/auth·/v1)에 요청을 보내 「한 번 실패한 뒤에도 다음 요청이 산다」를 확인한다.
//
//   node scripts/qa/chatgpt-connection-repro.mjs [--base http://127.0.0.1:9818] [--host mdc-server:9888] [--origin http://mdc-server:9888]
//                                                [--model gpt-6.1-sol] [--skip-cli] [--skip-oauth]
//
// 단계
//   1. GET  /auth/status?provider=openai-codex            — ChatGPT(OAuth) 로그인 상태(토큰은 출력하지 않는다)
//   2. POST /v1/local-agents/health {cli:"codex"} ×2      — 설정 화면의 「연결 시험」과 같은 몸통. 예전엔 매번 400 이었다
//   3. POST /v1/chat/completions (openai-codex)            — 없는 모델로 한 번 실패시킨 뒤 같은 연결로 두 번 더. 뒤의 둘은 200 이어야 한다
//
//   --restart-serve  (따로 도는 모드) 로컬 서버(oprn-serve)를 직접 띄웠다가 다시 시작해, 이미 열린 페이지가 쥔 옛 토큰이
//                    403 이 되는 것과 /__oprn/handshake 로 새 토큰을 받아 같은 요청이 다시 200 이 되는 것을 확인한다.
//                    모델은 부르지 않는다. 렌더러 번들(dist)·브리지(dist-electron/browser-bridge.js)가 있어야 한다(--dist/--bridge 로 바꿀 수 있다).
//
// 실제 모델을 짧게 부른다(구독 한도를 조금 쓴다). 9888 처럼 공개 주소로 묶인 호스트는 --host/--origin 을 그 주소로 준다.
// 일렉트론 앱의 루프백 동반 서비스는 실행별 토큰이 필요하다 — OPRN_COMPANION_TOKEN 환경 변수로 넘긴다(출력하지 않는다).

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const base = flag("base", "http://127.0.0.1:9818").replace(/\/$/, "");
const hostHeader = flag("host", "");
const origin = flag("origin", hostHeader ? `http://${hostHeader}` : "");
const model = flag("model", "gpt-6.1-sol");
const token = process.env.OPRN_COMPANION_TOKEN ?? "";

const headers = {
  "content-type": "application/json",
  ...(hostHeader ? { host: hostHeader } : {}),
  ...(origin ? { origin } : {}),
  ...(token ? { "x-oprn-companion-token": token } : {}),
};

const SECRET = /(eyJ[\w-]{10,}\.[\w-]+\.[\w-]+|sk-[\w-]{10,}|Bearer\s+\S+)/gu;
const clip = (text) => String(text ?? "").replace(SECRET, "<redacted>").replace(/\s+/gu, " ").slice(0, 160);

// fetch 는 Host 헤더를 바꾸지 못한다 — 공개 주소로 묶인 호스트(9888)를 루프백으로 두드리려면 node:http 로 보낸다.
function send(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${base}${path}`);
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const request = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
      headers: { ...headers, ...(payload ? { "content-length": payload.length } : {}) } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.setTimeout(300_000, () => request.destroy(new Error("timeout")));
    request.end(payload);
  });
}

async function call(method, path, body) {
  const started = Date.now();
  try {
    const { status, text } = await send(method, path, body);
    let json = null;
    try { json = JSON.parse(text); } catch { /* 본문이 JSON 이 아니다 */ }
    return { status, json, text, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, json: null, text: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

const rows = [];
let failed = false;
const record = (step, result, ok, note = "") => {
  rows.push({ step, status: result.status, ms: result.ms, ok, note: note || clip(result.json?.error ?? result.text) });
  if (!ok) failed = true;
};

// ── 서버 재시작 뒤 옛 토큰 ───────────────────────────────────────────────────────────────
// 서버는 실행마다 브리지·동반 서비스 토큰을 새로 만든다. 예전엔 열린 페이지가 옛 토큰을 계속 실어 모든 저장·AI 요청이
// 403 이 됐다(새로고침 전까지). 지금은 페이지가 403 에 /__oprn/handshake 로 새 토큰을 받아 한 번 다시 보낸다.
if (has("restart-serve")) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const freePort = () => new Promise((ok, fail) => { const probe = createServer(); probe.once("error", fail); probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => ok(port)); }); });
  const port = await freePort();
  const projectDir = mkdtempSync(join(tmpdir(), "oprn-restart-repro-"));
  const serveArgs = ["scripts/oprn-serve.mjs", "--project-dir", projectDir, "--port", String(port),
    "--dist", flag("dist", resolve(repo, "dist")), "--bridge", flag("bridge", resolve(repo, "dist-electron/browser-bridge.js"))];
  const local = `http://127.0.0.1:${port}`;
  const start = async () => {
    const child = spawn(process.execPath, serveArgs, { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    for (let i = 0; i < 240 && !output.includes("OPRN 로컬 편집기"); i += 1) {
      if (child.exitCode !== null) throw new Error(`oprn-serve 가 바로 끝났습니다: ${clip(output)}`);
      await new Promise((r) => setTimeout(r, 250));
    }
    return child;
  };
  const stop = (child) => new Promise((r) => { child.once("exit", r); child.kill("SIGTERM"); });
  // 토큰은 변수에만 둔다 — 출력하지 않는다.
  const localCall = (method, path, extra = {}, body) => new Promise((ok) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const started = Date.now();
    const request = http.request({ hostname: "127.0.0.1", port, path, method, headers: { origin: local, ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}), ...extra } }, (response) => {
      const chunks = []; response.on("data", (c) => chunks.push(c));
      response.on("end", () => { const text = Buffer.concat(chunks).toString("utf8"); let json = null; try { json = JSON.parse(text); } catch { /* 평문 */ } ok({ status: response.statusCode ?? 0, json, text, ms: Date.now() - started }); });
    });
    request.on("error", (error) => ok({ status: 0, json: null, text: error.message, ms: Date.now() - started }));
    request.end(payload);
  });
  const pageTokens = async () => {
    const page = await localCall("GET", "/");
    const config = /window\.__OPRN_BRIDGE__=(\{.*?\})<\/script>/u.exec(page.text);
    return config ? JSON.parse(config[1]) : {};
  };
  const companion = (tok) => localCall("GET", "/auth/status?provider=openai-codex", { "x-oprn-companion-token": tok });
  const bridge = (tok) => localCall("POST", "/__oprn/bridge", { "x-oprn-bridge-token": tok, "x-oprn-session": "restart-repro" }, { channel: "oprn:project.status", payload: null });
  let child = await start();
  try {
    const opened = await pageTokens();
    record("열린 페이지가 토큰을 받음", { status: opened.companionToken && opened.token ? 200 : 0, ms: 0 }, Boolean(opened.companionToken && opened.token), "companionToken·bridge token 있음(값은 출력하지 않음)");
    record("재시작 전 /auth/status", await companion(opened.companionToken), true);
    await stop(child);
    child = await start();
    const staleCompanion = await companion(opened.companionToken);
    record("재시작 뒤 옛 동반 토큰 → 403(재현)", staleCompanion, staleCompanion.status === 403);
    const staleBridge = await bridge(opened.token);
    record("재시작 뒤 옛 브리지 토큰 → 403(재현)", staleBridge, staleBridge.status === 403);
    const handshake = await localCall("GET", "/__oprn/handshake");
    const fresh = handshake.json ?? {};
    const changed = typeof fresh.companionToken === "string" && fresh.companionToken !== opened.companionToken && typeof fresh.token === "string" && fresh.token !== opened.token;
    record("/__oprn/handshake 가 새 토큰을 줌", handshake, handshake.status === 200 && changed, handshake.status === 200 ? `둘 다 바뀜=${changed}` : "");
    const retried = await companion(fresh.companionToken);
    record("새 토큰으로 다시 보낸 /auth/status → 200", retried, retried.status === 200);
    const retriedBridge = await bridge(fresh.token);
    record("새 토큰으로 다시 보낸 브리지 → 200", retriedBridge, retriedBridge.status === 200);
    const foreign = await localCall("GET", "/__oprn/handshake", { origin: "http://evil.example" });
    record("다른 출처의 handshake → 403", foreign, foreign.status === 403);
  } finally {
    await stop(child);
    rmSync(projectDir, { recursive: true, force: true });
  }
  console.log(`local serve ${local} (재시작 시험)`);
  for (const row of rows) console.log(`${row.ok ? "PASS" : "FAIL"}  ${String(row.status).padEnd(3)}  ${String(row.ms).padStart(6)}ms  ${row.step}  ${row.note}`);
  console.log(failed ? "결과: 실패한 단계가 있습니다" : "결과: 모두 통과");
  process.exit(failed ? 1 : 0);
}

const status = await call("GET", "/auth/status?provider=openai-codex");
const connected = status.json?.connected === true && status.json?.expired !== true;
record("auth/status openai-codex", status, status.status === 200,
  status.status === 200 ? `connected=${status.json?.connected} expired=${status.json?.expired ?? "-"} authKind=${status.json?.authKind ?? "-"}` : "");

if (!has("skip-cli")) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const health = await call("POST", "/v1/local-agents/health", { cli: "codex" });
    // 200 이면 시험이 실제로 돌았다(Codex 미설치·미로그인은 ok:false 로 온다 — 그건 이 PC 의 상태지 연결 버그가 아니다).
    record(`local-agents/health codex #${attempt}`, health, health.status === 200,
      health.status === 200 ? `ok=${health.json?.ok} ${clip(health.json?.problem ?? health.json?.reply ?? "")}` : "");
  }
}

if (!has("skip-oauth")) {
  if (!connected) {
    rows.push({ step: "chat/completions", status: "-", ms: 0, ok: true, note: "ChatGPT(OAuth) 로그인이 없어 건너뜀 — 이 PC 에서 로그인한 뒤 다시 실행" });
  } else {
    const message = (id) => ({ model: id, messages: [{ role: "user", content: "Reply with exactly: OK" }], stream: false });
    const bad = await call("POST", "/v1/chat/completions?provider=openai-codex", message("gpt-does-not-exist"));
    record("chat/completions 없는 모델(일부러 실패)", bad, bad.status >= 400 && bad.status < 500);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const good = await call("POST", "/v1/chat/completions?provider=openai-codex", message(model));
      const reply = good.json?.choices?.[0]?.message?.content;
      record(`chat/completions ${model} 실패 뒤 #${attempt}`, good, good.status === 200 && typeof reply === "string",
        good.status === 200 ? `reply=${clip(reply)}` : "");
    }
  }
}

console.log(`base ${base}${hostHeader ? ` (Host ${hostHeader})` : ""}`);
for (const row of rows) console.log(`${row.ok ? "PASS" : "FAIL"}  ${String(row.status).padEnd(3)}  ${String(row.ms).padStart(6)}ms  ${row.step}  ${row.note}`);
console.log(failed ? "결과: 실패한 단계가 있습니다" : "결과: 모두 통과");
process.exit(failed ? 1 : 0);
