// 호스트 쪽 Pi 실행 중계 — 무거운 키 캐시와 끊긴 스트림 이어 받기.
//
// 왜 필요한가 (2026-09-27 프리셋 팀 첫 생성 실측):
// 1) 요청마다 프로젝트 전체가 실렸다. 몬스터 수집 새 프로젝트 첫 요청이 151MB(타일셋 84MB · 에셋 66MB)였고,
//    작업 중 이 둘은 거의 바뀌지 않는다. 브라우저는 무거운 키를 해시로만 보내고, 호스트가 처음 본 내용만 받아 둔다.
// 2) 브라우저 연결이 끊기면 워커가 곧바로 에이전트를 중단했다(「aborted by client after 51 turns」). 와이파이·절전·
//    Docker 인터페이스 변경 같은 흔한 끊김 한 번에 40분짜리 팀 실행이 「실패」로 끝났다. 이제 실행은 runId 로 호스트에
//    남고 이벤트가 번호째 쌓인다. 브라우저는 GET ?runId=&after=N 으로 이어 받는다. 명시 중단(POST /v1/agent/cancel)만
//    워커를 멈춘다. 아무도 이어 받지 않으면 RESUME_GRACE_MS 뒤에 멈춘다.

import { createHash, randomUUID } from "node:crypto";
import { piTimer } from "./piRunTiming.mjs";

/** 무거운 키 — 요청 프로젝트에서 해시로 바꿔 보낼 수 있는 최상위 키. */
export const PI_HEAVY_PROJECT_KEYS = ["tilesets", "database", "assets"];
/** 캐시 상한(바이트, JSON 길이). 넘으면 오래된 것부터 버린다 — 버린 해시는 다음 요청이 409 로 다시 받는다. */
const CACHE_LIMIT = 512 * 1024 * 1024;
/** 끊긴 실행을 이어 받을 때까지 기다리는 시간. 지나면 워커를 멈추고 기록을 지운다. */
export const RESUME_GRACE_MS = 5 * 60 * 1000;
/** 끝난 실행 기록을 들고 있는 시간 — 마지막 done 줄을 놓친 브라우저가 다시 받을 수 있게. */
const FINISHED_TTL_MS = 10 * 60 * 1000;
/** 실행 하나가 들고 있는 줄 상한(바이트). 체크포인트 줄이 크므로 넘으면 오래된 줄부터 버린다(이어 받기 창이 줄어든다). */
const LOG_LIMIT = 256 * 1024 * 1024;

const cache = new Map(); // hash -> { json, size }
let cacheSize = 0;

export function heavyHash(json) {
  return createHash("sha256").update(json).digest("hex");
}

function remember(hash, json) {
  if (cache.has(hash)) { const entry = cache.get(hash); cache.delete(hash); cache.set(hash, entry); return; }
  cache.set(hash, { json, size: json.length });
  cacheSize += json.length;
  while (cacheSize > CACHE_LIMIT && cache.size > 1) {
    const [oldest, entry] = cache.entries().next().value;
    cache.delete(oldest);
    cacheSize -= entry.size;
  }
}

/**
 * 요청 몸통의 무거운 키를 해시째 확인한다(되살리지 않는다).
 * body.heavy = { [key]: hash } — 프로젝트의 그 키는 비어 있다. body.heavyBlobs = { [hash]: json } — 이번에 새로 보낸 내용.
 * 캐시에 없는 해시가 있으면 { missing } 을 돌려준다(호출자가 409 로 되돌려 브라우저가 그 내용만 다시 보낸다).
 * 있으면 { body(heavy·heavyBlobs 를 뺀 몸통), heavy: { refs, blobs } } — blobs 는 이 순간 캐시의 JSON 글을 붙잡아 둔다
 * (뒤에 다른 요청이 캐시를 밀어내도 이 실행은 글을 잃지 않는다. 글은 참조라 복사되지 않는다).
 */
export function resolveHeavyRefs(body) {
  const heavy = body?.heavy;
  if (!heavy || typeof heavy !== "object" || !body.project || typeof body.project !== "object") return { body };
  const blobs = body.heavyBlobs && typeof body.heavyBlobs === "object" ? body.heavyBlobs : {};
  for (const [hash, json] of Object.entries(blobs)) {
    if (typeof json !== "string") continue;
    // 보낸 쪽 해시를 믿지 않는다 — 다른 내용을 같은 해시로 심으면 다른 탭의 요청이 오염된다.
    if (heavyHash(json) !== hash) throw Object.assign(new Error("무거운 키 해시가 내용과 다릅니다."), { status: 400 });
    remember(hash, json);
  }
  const missing = [];
  const refs = {};
  const held = {};
  for (const key of PI_HEAVY_PROJECT_KEYS) {
    const hash = heavy[key];
    if (typeof hash !== "string") continue;
    const entry = cache.get(hash);
    if (!entry) { missing.push(hash); continue; }
    refs[key] = hash;
    held[hash] = entry.json;
  }
  if (missing.length) return { missing };
  const { heavy: _heavy, heavyBlobs: _blobs, ...rest } = body;
  return { body: rest, heavy: { refs, blobs: held } };
}

/** 요청 몸통의 무거운 키를 되살린다 — 해시째 받지 못하는 어댑터용. */
export function resolveHeavyProject(body) {
  const resolved = resolveHeavyRefs(body);
  if (resolved.missing || !resolved.heavy) return resolved;
  const project = { ...resolved.body.project };
  for (const [key, hash] of Object.entries(resolved.heavy.refs)) project[key] = JSON.parse(resolved.heavy.blobs[hash]);
  return { body: { ...resolved.body, project } };
}

// ── 실행 기록 ──────────────────────────────────────────────────────────────

const runs = new Map(); // runId -> Run

function createRun(runId, controller) {
  const run = {
    runId, controller, lines: [], firstSeq: 0, bytes: 0, finished: false, listeners: new Set(),
    detachedAt: Date.now(), graceTimer: null, cleanupTimer: null,
  };
  runs.set(runId, run);
  return run;
}

function pushLine(run, line) {
  run.lines.push(line);
  run.bytes += line.length;
  while (run.bytes > LOG_LIMIT && run.lines.length > 1) {
    run.bytes -= run.lines.shift().length;
    run.firstSeq += 1;
  }
  for (const listener of run.listeners) listener();
}

function finish(run) {
  run.finished = true;
  clearTimeout(run.graceTimer);
  for (const listener of run.listeners) listener();
  run.cleanupTimer = setTimeout(() => runs.delete(run.runId), FINISHED_TTL_MS);
  run.cleanupTimer.unref?.();
}

function detach(run) {
  if (run.finished || run.listeners.size > 0) return;
  run.detachedAt = Date.now();
  clearTimeout(run.graceTimer);
  run.graceTimer = setTimeout(() => {
    if (run.listeners.size > 0 || run.finished) return;
    run.controller.abort();
    runs.delete(run.runId);
  }, RESUME_GRACE_MS);
  run.graceTimer.unref?.();
}

/** 워커의 NDJSON 본문을 줄 단위로 읽어 실행 기록에 쌓는다. 브라우저 연결과 무관하게 끝까지 읽는다. */
async function pump(run, ndjson) {
  const reader = ndjson.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let index = pending.indexOf("\n");
      while (index >= 0) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        if (line.trim()) pushLine(run, line + "\n");
        index = pending.indexOf("\n");
      }
    }
    pending += decoder.decode();
    if (pending.trim()) pushLine(run, pending.endsWith("\n") ? pending : pending + "\n");
  } catch (error) {
    if (!run.controller.signal.aborted) pushLine(run, JSON.stringify({ type: "error", message: error instanceof Error ? error.message : String(error) }) + "\n");
  } finally {
    finish(run);
  }
}

/**
 * 실행 기록을 after 번째 줄부터 읽는 ReadableStream. 줄마다 seq 를 붙인다 — 끊긴 브라우저가 마지막으로 받은 번호를 안다.
 * 리더가 끊겨도(cancel) 실행은 계속된다. 실행이 끝나고 줄을 다 보내면 닫힌다.
 */
function tail(run, after) {
  let seq = Math.max(after, run.firstSeq);
  let notify = null;
  const listener = () => notify?.();
  const encoder = new TextEncoder();
  let closed = false;
  const stop = () => {
    if (closed) return;
    closed = true;
    run.listeners.delete(listener);
    detach(run);
  };
  return new ReadableStream({
    start() {
      run.listeners.add(listener);
      clearTimeout(run.graceTimer);
    },
    async pull(controller) {
      for (;;) {
        if (closed) return;
        if (seq < run.firstSeq) {
          // 기록 상한으로 줄이 버려졌다 — 이어 받을 수 없음을 알리고 닫는다.
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: "이어 받을 실행 기록이 넘쳐 앞부분이 사라졌습니다. 다시 시도해 주세요." }) + "\n"));
          controller.close(); stop(); return;
        }
        const index = seq - run.firstSeq;
        if (index < run.lines.length) {
          const line = run.lines[index];
          controller.enqueue(encoder.encode(withSeq(line, seq)));
          seq += 1;
          return;
        }
        if (run.finished) { controller.close(); stop(); return; }
        await new Promise((resolve) => { notify = () => { notify = null; resolve(); }; });
      }
    },
    cancel() { stop(); },
  });
}

/** 줄에 seq 필드를 끼운다. 줄은 JSON 객체 한 개다 — 앞의 '{' 뒤에 붙이면 전체를 다시 파싱하지 않는다. */
function withSeq(line, seq) {
  const at = line.indexOf("{");
  if (at < 0) return line;
  const rest = line.slice(at + 1).trimStart();
  return line.slice(0, at + 1) + '"seq":' + seq + (rest.startsWith("}") ? "" : ",") + line.slice(at + 1);
}

/**
 * POST /v1/agent/run — 새 실행을 시작하고 기록 스트림을 돌려준다.
 * startAgent(body, signal, heavy?) 는 워커 NDJSON 을 돌려주는 기존 어댑터 호출이다. signal 은 실행 자체의 중단 신호다
 * (브라우저 연결이 아니라 — 그건 이어 받기로 흡수한다).
 */
export async function startRelayedRun(body, startAgent, options = {}) {
  const timer = piTimer("relay start");
  // heavyRefs: 어댑터가 무거운 키를 해시째 받아 워커까지 넘긴다(워커가 파싱해 둔 것을 쓴다). 아니면 여기서 되살린다.
  const resolved = options.heavyRefs ? resolveHeavyRefs(body) : resolveHeavyProject(body);
  timer.mark("resolveHeavy", resolved.missing ? `missing=${resolved.missing.length}` : "");
  if (resolved.missing) return { status: 409, body: { error: "heavy-missing", missing: resolved.missing } };
  const runId = typeof body.runId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.runId) ? body.runId : randomUUID();
  if (runs.has(runId)) return { status: 409, body: { error: "run-exists", runId } };
  const controller = new AbortController();
  const { runId: _runId, ...request } = resolved.body;
  const run = createRun(runId, controller);
  let result;
  try {
    result = await startAgent(request, controller.signal, resolved.heavy);
    timer.mark("startAgent");
    timer.done();
  } catch (error) {
    runs.delete(runId);
    throw error;
  }
  void pump(run, result.ndjson);
  return { status: 200, stream: true, ndjson: tail(run, 0), headers: { "X-Oprn-Run-Id": runId } };
}

/** GET /v1/agent/run?runId=&after= — 끊긴 실행을 이어 받는다. */
export function resumeRelayedRun(runId, after) {
  const run = runs.get(runId);
  if (!run) return { status: 404, body: { error: "실행 기록이 없습니다. 끝난 지 오래됐거나 호스트가 다시 시작됐습니다." } };
  const from = Number.isInteger(after) && after >= 0 ? after : 0;
  return { status: 200, stream: true, ndjson: tail(run, from), headers: { "X-Oprn-Run-Id": runId } };
}

/** POST /v1/agent/cancel — 사용자가 누른 중단. 이것만 워커를 멈춘다. */
export function cancelRelayedRun(runId) {
  const run = runs.get(runId);
  if (!run) return false;
  run.controller.abort();
  return true;
}

/** 테스트 전용: 기록·캐시 비우기. */
export function resetRelayForTests() {
  for (const run of runs.values()) { clearTimeout(run.graceTimer); clearTimeout(run.cleanupTimer); run.controller.abort(); }
  runs.clear();
  cache.clear();
  cacheSize = 0;
}

