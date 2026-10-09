#!/usr/bin/env node
// 조수 턴 지연 실측 프로브 — 모델 왕복 자체와 실제 Pi 에이전트 런을 같은 자로 잰다.
//
// 왜(2026-09-26 실측): "프롬프트 하나가 몇 분" 의 원인을 모델 속도로 오진하지 않기 위해서다.
// 작은 프롬프트 한 콜은 gemini-3.8-flash 도 gemini-3.7-flash 도 ~2초였다(provider 모드).
// 즉 체감 지연은 **왕복 수와 콜당 payload** 에서 온다 — 이 프로브는 그 둘을 분리해 잰다.
//
//   node scripts/qa/_ai-turn-latency-probe.mjs provider [--sizes 1000,8000,30000]
//   node scripts/qa/_ai-turn-latency-probe.mjs agent    [--thinking off,high]
//
// 기본 base 는 동반 서비스(루프백 17832)다 — vite dev 서버·dev 포트 없이 돈다(동반 서비스가
// /v1/chat/completions 와 /v1/agent/run 을 직접 처리한다. 400 응답으로 확인).
// 증거는 verify-shots/ai-turn-latency/<mode>.json 에 남는다(저장소 관례).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DEFAULT_BASE = process.env.AI_LATENCY_BASE ?? "http://127.0.0.1:17832";
const PROVIDER_ID = "google-antigravity";
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_PROJECT = "test/fixtures/projects/glass-ui-qa-v3.json";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) { args._.push(token); continue; }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { args[key] = true; continue; }
    args[key] = next;
    i += 1;
  }
  return args;
}

const numList = (value, fallback) =>
  typeof value === "string" && value.trim()
    ? value.split(",").map((part) => Number(part.trim())).filter((n) => Number.isFinite(n) && n >= 0)
    : fallback;
const strList = (value, fallback) =>
  typeof value === "string" && value.trim() ? value.split(",").map((s) => s.trim()).filter(Boolean) : fallback;

/** 헤더는 동반 서비스 규약 그대로: 제공자 지정 + (있으면) 동반 토큰. */
function headers(extra = {}) {
  const h = { "Content-Type": "application/json", "X-Oprn-Provider": PROVIDER_ID, ...extra };
  const token = process.env.OPRN_COMPANION_TOKEN;
  if (token) h["x-oprn-companion-token"] = token;
  return h;
}

function gitSha() {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

function evidencePath(mode, args) {
  return args.out ? resolve(ROOT, String(args.out)) : join(ROOT, "verify-shots", "ai-turn-latency", `${mode}.json`);
}

function writeEvidence(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`evidence: ${path.replace(`${ROOT}/`, "")}`);
}

/** 대략적인 토큰 수 → 채울 문자 수. LLM 토크나이저 근사(한글 1자 ≈ 1~1.5토큰, 영문 4자 ≈ 1토큰). */
function fillerFor(targetTokens) {
  const word = "forest road house tree water rock meadow path bridge lamp fence 0123456789 ";
  const perWord = 6; // 단어당 대략 토큰(영문 기준 보수적)
  return word.repeat(Math.max(1, Math.ceil(targetTokens / perWord)));
}

async function chatOnce({ base, model, effort, body, stream }) {
  const started = performance.now();
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!stream) {
    const text = await response.text();
    const ms = Math.round(performance.now() - started);
    let usage = null;
    let error = null;
    try {
      const json = JSON.parse(text);
      usage = json.usage ?? null;
      error = json.error ?? null;
    } catch { error = text.slice(0, 200); }
    return { ms, status: response.status, usage, error, firstTokenMs: null };
  }
  // 스트리밍: 첫 바이트/첫 델타까지의 시간을 따로 잰다(체감 응답 시작).
  if (!response.body) return { ms: Math.round(performance.now() - started), status: response.status, usage: null, error: "no body", firstTokenMs: null };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let firstTokenMs = null;
  let usage = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (firstTokenMs === null && /"content"\s*:\s*"/.test(chunk)) firstTokenMs = Math.round(performance.now() - started);
    const usageMatch = /"usage"\s*:\s*(\{[^}]*\})/.exec(chunk);
    if (usageMatch) { try { usage = JSON.parse(usageMatch[1]); } catch { /* 부분 청크 */ } }
  }
  return { ms: Math.round(performance.now() - started), status: response.status, usage, error: null, firstTokenMs };
}

async function runProvider(args) {
  const base = String(args.base ?? DEFAULT_BASE);
  const models = strList(args.models, [String(args.model ?? DEFAULT_MODEL)]);
  const efforts = strList(args.efforts, ["off", "high"]);
  const sizes = numList(args.sizes, [1000, 8000, 30000]);
  const reps = Number(args.reps ?? 1);
  const stream = args.stream === true;
  const rows = [];
  for (const model of models) {
    for (const effort of efforts) {
      for (const size of sizes) {
        for (let rep = 1; rep <= reps; rep += 1) {
          // --image 를 주면 검수 호출 모양(텍스트 + 이미지)을 그대로 흉내낸다 — 실제 검수는
          // 맵 PNG 한 장(detail high)을 high 강도로 물으므로, 그 비용을 같은 자로 재기 위한 것이다.
          const imagePart = [];
          if (args.image) {
            // 쉼표로 여러 장을 주면 한 호출에 여러 이미지를 싱는다 — 검수 묶기(맵 K장/콜)의 비용을
            // 재기 위한 것이다. 한 장 비용 대비 K장 비용이 어떻게 늘는지가 묶기 이득을 정한다.
            for (const one of String(args.image).split(",").map((s) => s.trim()).filter(Boolean)) {
              const bytes = readFileSync(resolve(ROOT, one));
              imagePart.push({ type: "image_url", image_url: { url: `data:image/png;base64,${bytes.toString("base64")}` } });
            }
          }
          const body = {
            model,
            stream,
            max_tokens: 8192,
            messages: [
              {
                role: "user",
                content: imagePart.length > 0
                  ? [{ type: "text", text: imagePart.length > 1 ? `아래 ${imagePart.length}장의 맵 그림 각각에서 타일이 어색한 곳이 있으면 맵별로 한 줄씩만 지적하세요.` : "이 맵 그림에서 타일이 어색한 곳이 있으면 한 줄로만 지적하세요." }, ...imagePart]
                  : `${fillerFor(size)}\n\n위 목록에서 단어 하나만 그대로 답하세요.`,
              },
            ],
            // effort "off" 는 필드 자체를 보내지 않는다 — 실제 클라이언트(configForLiteModel)와 같은 모양.
            ...(effort === "off" ? {} : { reasoning: { effort } }),
          };
          let row;
          try {
            const measured = await chatOnce({ base, model, effort, body, stream });
            row = { model, effort, targetTokens: size, rep, ...measured };
          } catch (error) {
            row = { model, effort, targetTokens: size, rep, ms: null, status: "ERR", usage: null, error: String(error?.message ?? error), firstTokenMs: null };
          }
          rows.push(row);
          const usage = row.usage ? `prompt=${row.usage.prompt_tokens ?? "?"}` : "";
          console.log(`${model.padEnd(17)} effort=${String(effort).padEnd(5)} target=${String(size).padStart(6)} → ${String(row.ms ?? "-").padStart(6)}ms status=${row.status} ${usage}${row.error ? ` err=${String(row.error).slice(0, 60)}` : ""}`);
        }
      }
    }
  }
  return { mode: "provider", base, measuredAt: new Date().toISOString(), commit: gitSha(), stream, rows };
}

/** NDJSON 한 줄씩 — 첫 이벤트/첫 assistant/done 까지의 시간을 단계로 남긴다. */
async function runAgentOnce({ base, project, thinking, model, task, maxTurns }) {
  const started = performance.now();
  const response = await fetch(`${base}/v1/agent/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      mode: "single", provider: PROVIDER_ID, model, thinkingLevel: thinking,
      task, mapIds: Object.keys(project.maps ?? {}), project,
      readOnly: true, maxTurns, timeoutMs: 240_000,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) {
    const text = await response.text();
    return { ms: Math.round(performance.now() - started), status: response.status, error: text.slice(0, 300), stats: null, turns: 0, toolCalls: 0 };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstLineMs = null;
  let firstAssistantMs = null;
  let done = null;
  let errorMessage = null;
  let turns = 0;
  let toolCalls = 0;
  const timeline = [];
  const pushEvent = (type, extra = {}) => { if (timeline.length < 400) timeline.push({ type, atMs: Math.round(performance.now() - started), ...extra }); };
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (firstLineMs === null) firstLineMs = Math.round(performance.now() - started);
      if (event.type === "turn") { turns += 1; pushEvent("turn", { index: turns }); }
      if (event.type === "tool_start") { toolCalls += 1; pushEvent("tool_start", { name: event.name ?? null }); }
      if (event.type === "tool_end") pushEvent("tool_end", { name: event.name ?? null, ok: event.ok === true });
      if (event.type === "assistant") pushEvent("assistant");
      if (event.type === "checkpoint") pushEvent("checkpoint", { label: event.label ?? null });
      if (event.type === "assistant" && firstAssistantMs === null) firstAssistantMs = Math.round(performance.now() - started);
      if (event.type === "done") done = event;
      if (event.type === "error") errorMessage = event.message ?? "error";
    }
  }
  return {
    ms: Math.round(performance.now() - started), status: response.status, error: errorMessage,
    firstLineMs, firstAssistantMs, turns, toolCalls, timeline,
    cacheRead: done?.stats?.usage?.cacheRead ?? null,
    stats: done?.stats ?? null, changedKeys: done?.changedKeys ?? null,
  };
}

async function runAgent(args) {
  const base = String(args.base ?? DEFAULT_BASE);
  const model = String(args.model ?? DEFAULT_MODEL);
  // google-antigravity 는 "off" 를 거부한다(실측: Supported efforts: minimal, low, medium, high) — 기본은 low/high.
  const levels = strList(args.thinking, ["low", "high"]);
  const maxTurns = Number(args.maxTurns ?? 4);
  const project = JSON.parse(readFileSync(resolve(ROOT, String(args.project ?? DEFAULT_PROJECT)), "utf8"));
  const task = String(args.task ?? "지금 맵을 어떤 숲 쉼터로 꾸밀지, 도구 조회 없이 두 항목으로 짧게 계획만 제안하세요.");
  const reps = Number(args.reps ?? 1);
  const rows = [];
  for (const thinking of levels) {
    for (let rep = 1; rep <= reps; rep += 1) {
      let row;
      try {
        row = await runAgentOnce({ base, project, thinking, model, task, maxTurns });
      } catch (error) {
        row = { ms: null, status: "ERR", error: String(error?.message ?? error), stats: null, turns: 0, toolCalls: 0 };
      }
      const entry = { model, thinking, rep, maxTurns, ...row };
      rows.push(entry);
      console.log(`${model} thinking=${String(thinking).padEnd(8)} rep=${rep} → ${String(entry.ms ?? "-").padStart(7)}ms turns=${entry.turns} tools=${entry.toolCalls} cacheRead=${entry.cacheRead ?? "-"} status=${entry.status}${entry.error ? ` err=${String(entry.error).slice(0, 60)}` : ""}`);
    }
  }
  return { mode: "agent", base, measuredAt: new Date().toISOString(), commit: gitSha(), project: String(args.project ?? DEFAULT_PROJECT), task, rows };
}

const args = parseArgs(process.argv.slice(2));
const mode = args._[0];
if (mode !== "provider" && mode !== "agent") {
  console.error("사용: _ai-turn-latency-probe.mjs <provider|agent> [--base URL] [--model M] [--sizes a,b] [--efforts off,high] [--thinking off,high] [--out PATH]");
  process.exit(2);
}
const result = mode === "provider" ? await runProvider(args) : await runAgent(args);
writeEvidence(evidencePath(mode, args), result);
