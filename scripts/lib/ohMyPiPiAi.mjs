// 동반 서버 어댑터. 인증(상태·로그인·갱신·해제)은 순수 Node 에서 돌고,
// Bun 워커는 모델 호출(completion) 하나만 맡는다 — 그래서 Bun 이 없는 머신도
// 로그인까지는 끝마칠 수 있고, 워커는 실제로 모델을 부를 때에서야 처음 뜨운다.

import http from "node:http";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  listOhMyPiProviders,
  logoutProvider,
  providerStatus,
  publicProviderStatus,
  refreshProvider,
  resolveRequestApiKey,
  seedOAuthForTests,
  setEnvScanDecision,
  startProviderLogin,
  cancelProviderLogin,
} from "./aiAuthRuntime.ts";
import { applyLegacyEnvAliases } from "./oprnEnv.mjs";
import { piTimer } from "./piRunTiming.mjs";
import { isOpenAiCompatProviderId } from "../../src/ai/openAiCompat.ts";
import {
  deleteOpenAiCompat,
  listOpenAiCompatPublic,
  assertOpenAiCompatModelsAllowed,
  resolveOpenAiCompatRun,
  saveOpenAiCompat,
  testOpenAiCompat,
} from "./openAiCompatRuntime.ts";

applyLegacyEnvAliases();

let workerPortPromise;
let workerChild;
let workerStale = false;

/**
 * 살아 있는 워커를 «다음 요청 때 갈아 끼울 것» 으로 표시한다. 워커는 모듈 그래프를 부팅 때
 * **한 번** 로드하는 Bun 자식 프로세스라, 코드를 고쳐도 그대로 두면 옛 판정·옛 병합 코드가
 * 계속 돈다. 실측(2026-09-14): 맵 묶음 병합이 «묶음이 만든 정의» 를 데려오는 픽스가 들어간
 * 뒤에도, 페이지를 새로 고친 편집기는 `적용 실패(commit-rejected): 직렬화 왕복 실패: setSwitch:
 * switchId가 존재하지 않습니다: sw_ev_battle_<uuid>_clear` 를 그대로 재현했다 — 브라우저가 낡은
 * 것이 아니라 **워커가 낡아 있었다**. 지금 도는 실행은 죽이지 않는다: 갈아 끼우는 자리는 다음
 * 요청이다(진행 중인 Pi 실행을 파일 저장 한 번으로 끊지 않는다).
 */

/** 실행 도중 키를 다시 푸는 간격. resolveRequestApiKey 는 남은 수명이 15분 아래일 때만 갱신하므로 대부분 호출은 저장본을 읽고 끝난다. */
const WORKER_KEY_REFRESH_MS = 5 * 60_000;

/**
 * 워커 실행이 도는 동안 요청 키를 주기적으로 다시 풀어 워커에 밀어 넣는다(scripts/lib/piWorkerKeys.ts).
 * 시작 때 한 번 푼 키는 15분 남짓만 보장된다 — 팀 실행이 그보다 길면 실행 중간에 「OAuth token expired before request」로
 * 에이전트가 죽었다(2026-10-05 스트레스 실측, 18분 40초째). 본문이 끝나거나 취소되면 멈춘다.
 */
function keepWorkerKeysFresh(port, providerApiKeys, body, signal) {
  if (!body) return body;
  const providers = Object.keys(providerApiKeys).filter((provider) => providerApiKeys[provider]);
  if (!providers.length) return body;
  let timer = null;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  timer = setInterval(async () => {
    const fresh = {};
    for (const provider of providers) {
      try { fresh[provider] = await resolveRequestApiKey(provider); } catch { /* 갱신 실패 — 원래 키로 계속 간다 */ }
    }
    await fetch(`http://127.0.0.1:${port}/agent/keys`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerApiKeys: fresh }),
    }).catch(() => undefined);
  }, WORKER_KEY_REFRESH_MS);
  timer.unref?.();
  signal?.addEventListener("abort", stop, { once: true });
  return body.pipeThrough(new TransformStream({ flush: stop, cancel: stop }));
}

export function markOhMyPiWorkerStale() {
  workerStale = true;
}

function startWorker() {
  if (workerStale) stopOhMyPiWorker();
  if (workerPortPromise) return workerPortPromise;
  let promise;
  promise = new Promise((resolve, reject) => {
    // 스크립트 경로는 bun 으로 스크립트를 띄울 때만 계산한다. CJS 번들(Electron 메인)에서는 import.meta.url 이
    // 비어 `new URL` 이 던진다 — 모듈 로드 때 평가하면 앱이 죽고(2026-09-22 실측: AppImage 시작 실패),
    // 여기서 무조건 평가하면 패키지 워커(OPRN_OH_MY_PI_WORKER_BIN)를 띄우기 전에 모든 채팅이
    // 500 "Invalid URL" 로 죽는다(2026-09-27 실측: 패키징된 linux 앱).
    const workerScript = () => process.env.OPRN_OH_MY_PI_WORKER_SCRIPT || fileURLToPath(new URL("../oh-my-pi-worker.ts", import.meta.url));
    const localBun = join(homedir(), ".bun", "bin", "bun");
    const bun = process.env.OPRN_BUN_PATH || (existsSync(localBun) ? localBun : "bun");
    // Tests point this at a script that crashes on startup to pin the failure contract.
    const command = process.env.OPRN_OH_MY_PI_WORKER_COMMAND;
    const packedBin = process.env.OPRN_OH_MY_PI_WORKER_BIN;
    const child = command
      ? spawn(command, [], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env }, shell: true })
      : packedBin && existsSync(packedBin)
        ? spawn(packedBin, [], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } })
        : spawn(bun, [workerScript()], {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });
    workerChild = child;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      // 자리 정리는 **자기 것일 때만**. 갈아 끼운 뒤 옛 워커가 늦게 죽으면 그 정리가
      // 새 워커의 자리를 지워 다음 요청이 워커를 하나 더 띄운다(실측: 테스트가 스폰 수로
      // 그걸 잡는다).
      if (workerPortPromise === promise) workerPortPromise = null;
      reject(error);
    };
    const onChunk = (chunk) => {
      const text = String(chunk);
      const match = text.match(/READY (\d+)/);
      if (match && !settled) {
        settled = true;
        resolve(Number(match[1]));
      }
    };
    child.stdout?.on("data", onChunk);
    // Keep the worker's own diagnosis: a startup crash (missing module, bad import) only
    // ever reached the server console, so the browser showed a bare exit code and every
    // Pi run looked like an unexplained failure.
    let startupLog = "";
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (!text) return;
      if (!settled) startupLog = `${startupLog}${startupLog ? "\n" : ""}${text}`.slice(-800);
      console.error(`[oh-my-pi-worker] ${text}`);
    });
    child.on("error", (error) => {
      fail(new Error(
        error.code === "ENOENT"
          ? "bun 이 필요합니다. oh-my-pi 제공자 로그인/전송은 Bun 에서만 로드됩니다."
          : error.message,
      ));
    });
    child.on("exit", (code, signal) => {
      // 죽은 포트를 물려주지 않는다 — 다음 요청이 새 워커를 띄운다(READY 뒤에 죽은 경우까지).
      // 단, 갈아 끼운 뒤 옛 워커가 늦게 죽는 경우에는 새 워커의 자리를 지우면 안 된다.
      if (workerChild === child) {
        console.error(`[oh-my-pi-worker] exited: code=${code ?? "none"}, signal=${signal ?? "none"}`);
        workerChild = null;
        workerPortPromise = null;
      }
      fail(new Error(startupLog
        ? `oh-my-pi worker exited (${code ?? "?"}): ${startupLog}`
        : `oh-my-pi worker exited (${code ?? "?"})`));
    });
    // 기동 타임아웃은 기동을 기다리는 동안만 의미가 있다. unref 하지 않으면 안 쓰는 타이머가
    // 프로세스를 30초 더 붙잡는다(실측: node 테스트 파일이 끝난 뒤에도 그만큼 안 끝났다).
    const startTimeout = setTimeout(() => fail(new Error("oh-my-pi worker start timed out")), 30_000);
    startTimeout.unref?.();
  });
  workerPortPromise = promise;
  return promise;
}

/**
 * 워커에 오래 걸리는 요청 하나(로컬 CLI 완성 `/complete`). Node 내장 fetch(undici)는 응답 머리를 300초까지만 기다려,
 * 부하 걸린 기기에서 Sonnet 그리기 한 번이 5분을 넘자 「fetch failed」(500)로 공방 물건이 통째로 실패했다(2026-10-23 실측 300.7초).
 * 브라우저 쪽 상한은 10분(LLM_LOCAL_CLI_TIMEOUT_MS)이므로 여기는 node:http 로 머리 시간 제한 없이 보낸다(끊기는 브라우저 요청이 정한다).
 */
function postLongJson(port, pathname, body) {
  return new Promise((resolvePost, rejectPost) => {
    const data = Buffer.from(JSON.stringify(body ?? {}));
    const request = http.request({ host: "127.0.0.1", port, path: pathname, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": data.length } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolvePost({ ok: (response.statusCode ?? 500) < 400, status: response.statusCode ?? 500, json: async () => JSON.parse(text || "{}") });
      });
      response.on("error", rejectPost);
    });
    request.on("error", rejectPost);
    request.end(data);
  });
}

async function workerJson(pathname, body) {
  // An acknowledgement belongs to the worker already running this request.
  // A dev reload may mark it stale, but must not retire its pending decision.
  if (["/agent/checkpoint", "/agent/render"].includes(pathname) && !workerPortPromise) throw Object.assign(new Error("적용 대기 실행이 종료되었습니다."), { status: 409 });
  const port = await (["/agent/checkpoint", "/agent/render"].includes(pathname) ? workerPortPromise : startWorker());
  const post = () => (pathname === "/complete" ? postLongJson(port, pathname, body) : fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }));
  let response;
  try {
    response = await post();
  } catch (error) {
    // 적용·그림 응답은 워커가 기다리는 한 번짜리 결정이라 잃으면 실행 전체가 끊긴다. 부하 걸린 머신에서
    // 워커 소켓이 본문 도중 닫혀(`other side closed`, 핸들러는 불리지도 않았다) 턴이 통째로 죽었다
    // (2026-09-25 Rasak 마을, 턴마다 1~15분 사이). 새 연결로 한 번만 다시 보낸다 — 브로커는 같은 id 의
    // 재전달을 받아 준다.
    if (!["/agent/checkpoint", "/agent/render"].includes(pathname) || error?.cause?.code !== "UND_ERR_SOCKET") throw error;
    response = await post();
  }
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error || `oh-my-pi worker ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

/**
 * 워커 몸통 끝에 무거운 키 원문을 「heavyRaw」로 덧붙인다. 원문은 이미 JSON 이라 문자열로 감싸지 않고 그대로 이어 붙인다 —
 * 워커가 request.json() 한 번으로 객체를 받는다. 왜(2026-10-04 실측, 새 프로젝트 168MB): 실행마다 호스트가 무거운 키를
 * JSON.parse(1.4~1.9s) → 몸통째 JSON.stringify(1.5~1.7s) → 워커가 다시 파싱(1.6~1.8s) 했다. 워커가 해시로 쥐고 있으면 셋 다 없다.
 */
function withHeavyRaw(envelope, entries) {
  if (!envelope.endsWith("}")) throw new Error("워커 몸통이 객체가 아닙니다.");
  const raw = entries.map(([hash, json]) => `${JSON.stringify(hash)}:${json}`).join(",");
  return `${envelope.slice(0, -1)}${envelope.length > 2 ? "," : ""}"heavyRaw":{${raw}}}`;
}

export function stopOhMyPiWorker() {
  workerChild?.kill();
  workerChild = null;
  workerPortPromise = null;
  workerStale = false;
}

export async function createOhMyPiAdapters() {
  return {
    listProviders: async () => listOhMyPiProviders(),
    async status(provider) {
      // 로컬 CLI 엔진: 연결 여부는 그 CLI 가 스스로 말한 로그인 상태다(우리 저장소엔 자격이 없다).
      if (String(provider).startsWith("local-cli:")) {
        const { clis } = await workerJson("/local-agents", {});
        const row = (clis ?? []).find((entry) => `local-cli:${entry.id}` === provider);
        return { connected: row?.state === "ready", authKind: "local", ...(row && row.state !== "ready" ? { lastLoginError: `${row.label}: ${row.stateLabel}` } : {}) };
      }
      // 만료됐지만 갱신 가능한 로그인은 여기서 되살린다(single-flight + 백오프, aiAuthRuntime.providerStatus).
      return providerStatus(provider);
    },
    async setEnvScan(decision) {
      setEnvScanDecision(decision);
    },
    async login(provider, body, options) {
      return startProviderLogin(provider, body ?? {}, options ?? {});
    },
    async cancelLogin(provider) {
      cancelProviderLogin(provider);
      return publicProviderStatus(provider);
    },
    async saveKey(provider) {
      // 지원 제공자 둘 다 구독 로그인이다. API 키를 받는 생기면 사용자가
      // 키를 붙여넣고 연결된 상태를 기다리다 401 로 새는 경로가 다시 생긴다.
      const error = new Error(`${provider} 는 구독 로그인 전용이라 API 키를 쓰지 않습니다.`);
      error.status = 400;
      throw error;
    },
    async refresh(provider) {
      return refreshProvider(provider);
    },
    async logout(provider) {
      return logoutProvider(provider);
    },
    async seedOAuth(provider, creds) {
      seedOAuthForTests(provider, creds);
      return publicProviderStatus(provider);
    },
    // 사용자 지정(OpenAI 호환) 엔드포인트 관리 — 키·헤더 값은 이 프로세스의 저장 파일(0600)에만 있고 응답에는 공개 보기만 나간다.
    async compatList() { return { endpoints: listOpenAiCompatPublic() }; },
    async compatSave(body) { return { endpoint: saveOpenAiCompat(body ?? {}), endpoints: listOpenAiCompatPublic() }; },
    async compatDelete(id) { return deleteOpenAiCompat(String(id ?? "")); },
    async compatTest(body) { return testOpenAiCompat(body ?? {}); },
    async complete(provider, body) {
      // 호스트 직전 검사 — 차단·비허용 모델은 키를 꺼내거나 워커를 부르기 전에 거절한다(폴백 없음).
      assertOpenAiCompatModelsAllowed([{ provider, model: body?.model }]);
      // 로컬 CLI 엔진은 키가 없다 — 워커가 사용자의 CLI 로 한 차례 돌린다.
      if (String(provider).startsWith("local-cli:")) return workerJson("/complete", { provider, body });
      const apiKey = await resolveRequestApiKey(provider);
      // 사용자 지정 엔드포인트는 워커가 주소·헤더를 알아야 모델을 만든다. 키는 apiKey 로 따로 간다.
      if (isOpenAiCompatProviderId(provider)) {
        const { endpoints } = await resolveOpenAiCompatRun([provider]);
        return workerJson("/complete", { provider, body, apiKey, compatEndpoints: endpoints });
      }
      return workerJson("/complete", { provider, body, apiKey });
    },
    /** 로컬 에이전트 CLI 감지 — 워커(Bun)가 CLI 를 띄워 버전·로그인 상태만 읽는다. */
    async localAgents(body) { return workerJson("/local-agents", body ?? {}); },
    async localAgentHealth(body) { return workerJson("/local-agents/health", body ?? {}); },
    /** Pi 에이전트 실행. 워커의 NDJSON 본문(web ReadableStream)을 그대로 넘긴다. */
    async resolveRender(body) { return workerJson("/agent/render", body); },
    async resolveCheckpoint(body) {
      return workerJson("/agent/checkpoint", body);
    },
    /** runAgent 가 options.heavy(해시·글)를 받아 워커까지 해시째 넘긴다 — 중계가 프로젝트를 되살리지 않는다. */
    runAgentHeavyRefs: true,
    async runAgent(provider, body, options = {}) {
      // 이 실행이 쓸 수 있는 모든 (제공자, 모델) 쌍 — 기본 모델과 역할 넷. 하나라도 막히면 모델·워커를 부르기 전에 끝낸다.
      assertOpenAiCompatModelsAllowed([
        { provider, model: body.model },
        ...["deep", "writer", "vision", "build"].map((role) => ({ provider: body.roleModels?.[role]?.provider, model: body.roleModels?.[role]?.model })),
        ...["smol", "advisor"].map((role) => ({ provider: body.assistantRoles?.[role]?.provider, model: body.assistantRoles?.[role]?.model })),
      ]);
      // 로컬 CLI 엔진(local-cli:*)은 키가 없다 — 사용자가 그 CLI 에 직접 로그인해 있다. 키를 찾지 않는다.
      const apiKey = String(provider).startsWith("local-cli:") ? undefined : await resolveRequestApiKey(provider);
      const providerApiKeys = { [provider]: apiKey };
      // 사용자 지정 엔드포인트: 역할 넷 중 하나라도 쓰면 주소·헤더를 워커에 싣는다(없는 엔드포인트는 여기서 404 로 끝낸다).
      const compat = await resolveOpenAiCompatRun([
        provider,
        ...["deep", "writer", "vision", "build"].map((role) => body.roleModels?.[role]?.provider),
        ...["smol", "advisor"].map((role) => body.assistantRoles?.[role]?.provider),
      ].filter((id) => typeof id === "string"));
      for (const role of ["vision", "build"]) {
        const selected = body.roleModels?.[role];
        if (selected?.provider in compat.endpoints && !(selected.provider in providerApiKeys)) providerApiKeys[selected.provider] = compat.keys[selected.provider];
      }
      for (const role of ["deep", "writer"]) {
        const selected = body.roleModels?.[role];
        if (selected?.provider && !(selected.provider in providerApiKeys)) {
          // 작문은 다른 계정에 둘 수 있는 선택 역할이다 — 그 계정이 없으면 실행기가 실행 모델로 대신한다.
          if (role === "writer") {
            try { providerApiKeys[selected.provider] = await resolveRequestApiKey(selected.provider); }
            catch { providerApiKeys[selected.provider] = undefined; }
            continue;
          }
          providerApiKeys[selected.provider] = await resolveRequestApiKey(selected.provider);
        }
      }
      // 잔일·검토자(src/ai/assistantRoles.ts)도 선택 역할이다 — 계정이 없으면 실행기가 주 모델로 물러난다(작문과 같은 관례).
      for (const role of ["smol", "advisor"]) {
        const selected = body.assistantRoles?.[role];
        const roleProvider = selected && typeof selected === "object" ? selected.provider : undefined;
        if (!roleProvider || roleProvider in providerApiKeys || String(roleProvider).startsWith("local-cli:")) continue;
        if (roleProvider in compat.endpoints) { providerApiKeys[roleProvider] = compat.keys[roleProvider]; continue; }
        try { providerApiKeys[roleProvider] = await resolveRequestApiKey(roleProvider); }
        catch { providerApiKeys[roleProvider] = undefined; }
      }
            // Resolve the image slot independently. Missing credentials must fail the image tool,
      // not prevent unrelated read/authoring turns from starting.
      const imageProvider = body.imageProvider || 'google-antigravity';
      if (!(imageProvider in providerApiKeys)) {
        try { providerApiKeys[imageProvider] = await resolveRequestApiKey(imageProvider); }
        catch { providerApiKeys[imageProvider] = undefined; }
      }
      // 웹 검색은 조수 제공자와 무관하게 Codex 백엔드가 한다 — Antigravity 로 턴을 돌려도 검색은 ChatGPT 자격으로 나간다.
      // 자격이 없으면 undefined 로 두고 툴이 이유를 말하게 한다(여기서 던지면 미로그인 사용자의 모든 턴이 검색 때문에 죽는다).
      let codexApiKey;
      if (!("openai-codex" in providerApiKeys)) {
        try {
          codexApiKey = await resolveRequestApiKey("openai-codex");
        } catch {
          codexApiKey = undefined;
        }
      }
      const timer = piTimer("host runAgent");
      const port = await startWorker();
      timer.mark("worker");
      const heavy = options.heavy?.refs && Object.keys(options.heavy.refs).length ? options.heavy : null;
      const compatEndpoints = Object.keys(compat.endpoints).length ? { compatEndpoints: compat.endpoints } : {};
      const envelope = JSON.stringify({ apiKey, providerApiKeys, codexApiKey, ...compatEndpoints, request: { ...body, provider }, ...(heavy ? { heavy: heavy.refs } : {}) });
      timer.mark("stringify", `${Math.round(envelope.length / 1048576)}MB`);
      // 브라우저가 끊으면(중단 버튼) 그 신호를 워커까지 넘긴다 — 안 그러면 에이전트는 끝까지 돈다.
      const post = (raw) => fetch(`http://127.0.0.1:${port}/agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw.length ? withHeavyRaw(envelope, raw.map((hash) => [hash, heavy.blobs[hash]])) : envelope,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      // 무거운 키는 해시만 보내고 워커가 파싱해 둔 것을 쓴다. 워커가 모르면(막 떴거나 밀어냈으면) 409 로 그 해시만 받는다.
      let response = await post([]);
      if (heavy && response.status === 409) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.error !== "heavy-missing" || !Array.isArray(payload.missing)) {
          throw Object.assign(new Error(payload?.error || "oh-my-pi worker 409"), { status: 409 });
        }
        const missing = payload.missing.filter((hash) => typeof heavy.blobs[hash] === "string");
        timer.mark("workerMissing", `${missing.length}`);
        response = await post(missing);
      }
      if (heavy && response.ok && response.headers.get("X-Oprn-Heavy-Refs") !== "1") {
        // 해시를 모르는 옛 워커(패키지 빌드가 어긋난 경우) — 빈 키로 돌고 있다. 끊고 되살린 프로젝트로 다시 보낸다.
        void response.body?.cancel().catch(() => undefined);
        const project = { ...body.project };
        for (const [key, hash] of Object.entries(heavy.refs)) project[key] = JSON.parse(heavy.blobs[hash]);
        response = await fetch(`http://127.0.0.1:${port}/agent/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, providerApiKeys, codexApiKey, ...compatEndpoints, request: { ...body, project, provider } }),
          ...(options.signal ? { signal: options.signal } : {}),
        });
      }
      timer.mark("workerHeaders");
      timer.done();
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload?.error || `oh-my-pi worker ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return { stream: true, ndjson: keepWorkerKeysFresh(port, providerApiKeys, response.body, options.signal) };
    },
    async generateImage(provider, body) {
      const apiKey = await resolveRequestApiKey(provider);
      return workerJson("/image", { provider, body, apiKey });
    },
  };
}
