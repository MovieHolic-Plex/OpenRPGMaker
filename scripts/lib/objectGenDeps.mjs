// 화면 없는 공방(src/headless/objectGen.ts)에 넣을 모델·그림·관문 — 코딩 에이전트 호스트(oprn-agent-host.mjs)가 쓴다.
//   경로 고르기는 objectGenRoute.mjs(순수): Claude Code 가 있으면 Opus 5.5 medium(`claude -p`), 없으면 ChatGPT 구독
//   (OPRN_OBJECTGEN_CHAT_URL 의 OpenAI 호환 주소, 없으면 Codex 로그인으로 GPT 6.1 Terra high). 둘 다 없으면 크게 실패.
//   참고 그림: ChatGPT(Codex) 로그인만(scripts/lib/codexImageRuntime.ts). Google·유료 API 로 바꾸지 않는다.
//   3/4 관문 영수증: object-gate 판정기(scripts/lib/workshopGate.mjs, claude -p 에 묶인 프로필). Claude Code 가 없으면
//   영수증 단계는 없고(건너뛰는 것이 아니라 없다고 기록·알림), 공방 독립 검수·3/4 조언은 그대로 돈다.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { startWorkshopGate, workshopGateStatus, cancelWorkshopGate, workshopGateUnavailable } from "./workshopGate.mjs";
import { chooseObjectGenRoute } from "./objectGenRoute.mjs";

// OPRN_OBJECTGEN_CHAT_URL(OpenAI 호환 /v1)·_CHAT_KEY·_MODEL·_EFFORT·_GATE=off 는 고르기를 덮는 스위치다 — 없어도 고른다.
const CHAT_URL = process.env.OPRN_OBJECTGEN_CHAT_URL || "";
const CHAT_KEY = process.env.OPRN_OBJECTGEN_CHAT_KEY || "";
const CHAT_TIMEOUT_MS = 9 * 60_000;
const CODEX_RESPONSES = "https://chatgpt.com/backend-api/codex/responses";

function has(name) {
  try { execFileSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" }); return true; } catch { return false; }
}

/** 이 컴퓨터에서 고른 경로(objectGenRoute.mjs) — 호스트가 시작 때 한 번 읽는다. */
export function objectGenRoute() {
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  return chooseObjectGenRoute({
    hasClaude: has("claude"),
    codexLogin: existsSync(join(codexHome, "auth.json")),
    chatUrl: CHAT_URL,
    gateOff: process.env.OPRN_OBJECTGEN_GATE === "off",
    model: process.env.OPRN_OBJECTGEN_MODEL || "",
    effort: process.env.OPRN_OBJECTGEN_EFFORT || process.env.OPRN_OBJECTGEN_CHAT_EFFORT || "",
  });
}

/** 그릴 수 없는 까닭(없으면 null). 두 경로가 다 없을 때만 이유를 돌려준다. */
export function objectGenUnavailable() {
  const route = objectGenRoute();
  if (!route.ok) return route.reason;
  return route.gate === "receipt" ? workshopGateUnavailable() : null;
}

/** 공방 ChatRequest → `claude -p` 한 턴(stream-json, 그림 포함). 이전 대화는 한 메시지 안에 차례로 적는다. */
function claudeChat(log, MODEL, EFFORT) {
  return (surface, request) => {
    const system = request.messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n"))).join("\n\n");
    const blocks = [];
    for (const message of request.messages.filter((m) => m.role !== "system")) {
      const prefix = message.role === "assistant" ? "[너의 지난 답]\n" : blocks.length ? "[사용자]\n" : "";
      const parts = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content ?? [];
      let first = true;
      for (const part of parts) {
        if (part.type === "text") blocks.push({ type: "text", text: (first ? prefix : "") + part.text });
        else if (part.type === "image_url") {
          const match = /^data:(image\/[a-z]+);base64,(.*)$/su.exec(part.image_url.url);
          if (match) blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
        }
        first = false;
      }
    }
    blocks.push({ type: "text", text: "JSON 객체 하나만 답하라. 코드 울타리·설명 글 없이." });
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn("claude", ["-p", "--bare", "--model", MODEL, "--effort", EFFORT, "--system-prompt", system || "JSON 하나만 답한다.",
        "--tools", "", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--no-session-persistence"], { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), CHAT_TIMEOUT_MS);
      const abort = () => child.kill("SIGTERM");
      request.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (d) => { stdout += d; });
      child.stderr.on("data", (d) => { stderr += d; });
      child.on("close", (code) => {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", abort);
        const result = stdout.trim().split("\n").map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).find((e) => e.type === "result");
        const text = String(result?.result ?? "").replace(/^```(?:json)?\s*/iu, "").replace(/```\s*$/u, "").trim();
        log?.(`objectgen chat ${surface} ${Math.round((Date.now() - started) / 1000)}s code=${code} route=claude model=${MODEL} images=${blocks.filter((b) => b.type === "image").length}${result?.total_cost_usd !== undefined ? ` cost=$${result.total_cost_usd}` : ""}`);
        if (code !== 0 || !result || result.is_error) {
          const why = String(result?.result ?? stderr).slice(0, 200);
          reject(Object.assign(new Error(`그리기 모델(${MODEL}) 호출 실패: ${why}`), { status: /429|limit/iu.test(why) ? 429 : /401|login/iu.test(why) ? 401 : 500 }));
        } else resolve(text);
      });
      child.stdin.end(`${JSON.stringify({ type: "user", message: { role: "user", content: blocks } })}\n`);
    });
  };
}

/** 공방 ChatRequest → OpenAI 호환 chat/completions 한 번(그림은 image_url 그대로). */
function openAiChat(log, MODEL, EFFORT) {
  return async (surface, request) => {
    const started = Date.now();
    const response = await fetch(`${CHAT_URL.replace(/\/$/u, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(CHAT_KEY ? { authorization: `Bearer ${CHAT_KEY}` } : {}) },
      body: JSON.stringify({ model: MODEL, ...(EFFORT ? { reasoning_effort: EFFORT } : {}), messages: request.messages, ...(request.response_format ? { response_format: request.response_format } : {}), ...(request.temperature !== undefined ? { temperature: request.temperature } : {}) }),
      signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(CHAT_TIMEOUT_MS)]) : AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null);
    log?.(`objectgen chat ${surface} ${Math.round((Date.now() - started) / 1000)}s http=${response.status} route=openai-compat model=${MODEL} host=${new URL(CHAT_URL).host}`);
    if (!response.ok) throw Object.assign(new Error(`그리기 모델(${MODEL}) 호출 실패: HTTP ${response.status} ${JSON.stringify(body?.error ?? "").slice(0, 160)}`), { status: response.status });
    const content = body?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => p.text ?? "").join("\n") : "";
    return text.replace(/^```(?:json)?\s*/iu, "").replace(/```\s*$/u, "").trim();
  };
}

/** 공방 ChatRequest → ChatGPT(Codex) 로그인의 /responses 한 번(스트리밍만 받는다 — codexWebSearchRuntime.ts 와 같은 계약). */
function codexChat(log, MODEL, EFFORT) {
  return async (surface, request) => {
    const { loadCodexSession, resolveConfig } = await import("god-tibo-imagen");
    const session = await loadCodexSession(resolveConfig()).catch(() => null);
    if (!session?.accessToken || !session.accountId || session.authMode !== "chatgpt") throw Object.assign(new Error("ChatGPT(Codex) 로그인이 없거나 만료됐다 — `codex login`"), { status: 401 });
    const text = (m) => (typeof m.content === "string" ? m.content : m.content.filter((p) => p.type === "text").map((p) => p.text).join("\n"));
    const input = request.messages.filter((m) => m.role !== "system").map((m) => ({
      type: "message", role: m.role === "assistant" ? "assistant" : "user",
      content: (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content).map((p) =>
        p.type === "image_url" ? { type: "input_image", image_url: p.image_url.url } : { type: m.role === "assistant" ? "output_text" : "input_text", text: p.text }),
    }));
    const started = Date.now();
    const signal = request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(CHAT_TIMEOUT_MS)]) : AbortSignal.timeout(CHAT_TIMEOUT_MS);
    const response = await fetch(CODEX_RESPONSES, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "ChatGPT-Account-Id": session.accountId, "Content-Type": "application/json", Accept: "text/event-stream", originator: "codex_cli_rs" },
      body: JSON.stringify({ model: MODEL, instructions: [request.messages.filter((m) => m.role === "system").map(text).join("\n\n"), "JSON 객체 하나만 답하라. 코드 울타리·설명 글 없이."].filter(Boolean).join("\n\n"), input, ...(EFFORT ? { reasoning: { effort: EFFORT } } : {}), store: false, stream: true }),
      signal,
    });
    const body = await response.text();
    log?.(`objectgen chat ${surface} ${Math.round((Date.now() - started) / 1000)}s http=${response.status} route=codex model=${MODEL}`);
    if (!response.ok) throw Object.assign(new Error(`그리기 모델(${MODEL}, ChatGPT) 호출 실패: HTTP ${response.status}`), { status: response.status });
    let out = "";
    for (const line of body.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const event = JSON.parse(line.slice(5)); if (event.type === "response.output_text.delta") out += event.delta; } catch { /* 다음 줄 */ }
    }
    return out.replace(/^```(?:json)?\s*/iu, "").replace(/```\s*$/u, "").trim();
  };
}

/** 참고 그림 한 장 — ChatGPT(Codex) 로그인. 실패는 던진다(엔진이 「참고 그림 없이 그림」으로 판 기록에 남긴다). */
function codexReference(log) {
  return async (prompt, signal, options) => {
    const { generateCodexImage } = await import("./codexImageRuntime.ts");
    const attached = options?.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/u);
    const started = Date.now();
    const image = await generateCodexImage({ prompt, size: "1024x1024", ...(attached ? { referenceImages: [{ mimeType: attached[1], data: attached[2] }] } : {}) }, { signal });
    log?.(`objectgen reference ${Math.round((Date.now() - started) / 1000)}s ${image.provider}/${image.model} ${image.base64.length}b64`);
    return { dataUrl: `data:${image.mimeType};base64,${image.base64}`, source: `${image.provider}/${image.model}` };
  };
}

/** 3/4 관문 영수증 한 장 — 판정기 작업을 띄우고 끝날 때까지 기다린다. */
function gate(log) {
  return async (input, signal) => {
    const started = startWorkshopGate(input);
    if (!started.ok) throw Object.assign(new Error(started.error ?? "그림 확인기를 띄우지 못했다"), { unavailable: Boolean(started.unavailable) });
    const onAbort = () => cancelWorkshopGate(started.jobId);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const status = workshopGateStatus(started.jobId);
        if (status.state === "running") continue;
        log?.(`objectgen gate ${input.name} ${status.state} ${Math.round((status.elapsedMs ?? 0) / 1000)}s ${status.result?.final ?? status.error ?? ""}`);
        if (status.state !== "done" || !status.result) throw new Error(status.error ?? `그림 확인 ${status.state}`);
        const r = status.result;
        return { final: r.final, verdict: r.verdict, reasons: r.reasons ?? [], ...(r.fix ? { fix: r.fix } : {}), pixelSha256: r.pixelSha256, profileHash: r.profileHash, refer: r.refer ? { verdict: r.refer.verdict, judge: r.refer.judge } : null };
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  };
}

const png = {
  decode(bytes) {
    const image = PNG.sync.read(Buffer.from(bytes));
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.byteLength) };
  },
  encode(image) {
    const out = new PNG({ width: image.width, height: image.height });
    out.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
    return PNG.sync.write(out);
  },
};

/** 판 그림 기록을 dir/<시각>-<제목>/ 에 PNG 와 record.json 으로 남긴다. */
function archiveTo(dir, log) {
  const save = (folder, name, dataUrl) => {
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/su.exec(dataUrl ?? "");
    if (!m) return null;
    const file = `${name}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
    writeFileSync(join(folder, file), Buffer.from(m[2], "base64"));
    return file;
  };
  return (record) => {
    const slug = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${String(record.request.title).replace(/[^\p{L}\p{N}-]+/gu, "_").slice(0, 40)}`;
    const folder = join(dir, slug);
    mkdirSync(folder, { recursive: true });
    const out = {
      ...record,
      reference: record.reference && {
        ...record.reference,
        accepted: record.reference.accepted.map((url, i) => save(folder, `reference-${i + 1}`, url)),
        rejected: record.reference.rejected.map((r, i) => ({ why: r.why, file: save(folder, `reference-rejected-${i + 1}`, r.png) })),
      },
      runs: record.runs.map((run) => ({ ...run, attempts: run.attempts.map((a) => ({ ...a, png: save(folder, `${run.letter}-try${a.attempt}`, a.png) })) })),
    };
    writeFileSync(join(folder, "record.json"), JSON.stringify(out, null, 1));
    log?.(`objectgen archive ${folder}`);
  };
}

export function createObjectGenDeps({ publicDir, log, archiveDir }) {
  const route = objectGenRoute();
  if (!route.ok) throw new Error(route.reason);
  log?.(`objectgen route ${route.route} — ${route.label}; 3/4 영수증 ${route.gate}${route.note ? ` (${route.note})` : ""}`);
  const chat = route.route === "claude" ? claudeChat(log, route.model, route.effort) : route.route === "openai-compat" ? openAiChat(log, route.model, route.effort) : codexChat(log, route.model, route.effort);
  return {
    publicDir, png, route: { route: route.route, model: route.model, effort: route.effort, gate: route.gate, label: route.label, note: route.note },
    ...(archiveDir ? { archive: archiveTo(archiveDir, log) } : {}),
    chat, referenceImage: codexReference(log), ...(route.gate === "receipt" ? { objectGate: gate(log) } : {}), log,
  };
}
