import { requestPiRender, resolvePiRender } from "./lib/piRenderBroker.ts";
import { requestPiCheckpoint, resolvePiCheckpoint } from "./lib/piCheckpointBroker.ts";
// Bun 전용 완성 워커. `@oh-my-pi/pi-ai` 가 bun:sqlite · type:text import 를 쓰므로
// Node/tsx 에선 로드되지 않아, 모델 호출만 이 루프백 프로세스에 남긴다.
//
// 인증은 이곳에 없다: 토큰·로그인·갱신은 Node 쒡(scripts/lib/aiAuthRuntime.ts)이 전부 소유하고,
// 이 워커는 이미 부혼 apiKey 를 요청 본밎으로 받는다. 그러지 않으면 Bun 없는 머신에서
// 로그인조차 불가능해진다.

import { completeProvider } from "./lib/ohMyPiPiAiRuntime.ts";
import { generateProviderImage } from "./lib/ohMyPiImageRuntime.ts";
import { generateCodexImage } from "./lib/codexImageRuntime.ts";
import { CODEX_PROVIDER_ID } from "../src/ai/oauth/credentials.ts";
import { runPiAgent } from "./lib/piAgentRuntime.ts";
import { runPiTeam } from "./lib/piTeamRuntime.ts";
import { createPiAgentNdjsonStream } from "./lib/piAgentStream.ts";
import { preparePiWorkerSharedContent } from "./lib/piWorkerSharedContent.ts";
import { preparePiWorkerAudio } from './lib/piWorkerAudio.ts';
import { holdWorkerKeys, refreshWorkerKeys } from "./lib/piWorkerKeys.ts";
import type { PiAgentRequest } from "../src/ai/piAgent/protocol.ts";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";
import { piTimer } from "./lib/piRunTiming.mjs";

applyLegacyEnvAliases();

const port = Number(process.env.OPRN_OH_MY_PI_WORKER_PORT || 0);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * 무거운 키(타일셋·DB·에셋)를 해시로 받아 파싱해 둔 객체를 쓴다. 호스트는 해시만 보내고, 여기 없으면 409 로 그 해시의
 * 원문(heavyRaw, 이미 객체로 파싱돼 온다)을 받는다. 실행은 요청 프로젝트를 structuredClone 해서 고치므로(runPiAgent·runPiTeam)
 * 여기 쥔 객체는 실행 사이에 오염되지 않는다.
 * 왜(2026-10-04 실측, 새 프로젝트 168MB): 실행마다 호스트 파싱·직렬화·워커 파싱이 4.5~5s 였다.
 */
const HEAVY_KEYS = ["tilesets", "database", "assets"] as const;
/** 쥐는 해시 수. 프로젝트 하나가 키 셋을 쓰므로 두 프로젝트 몫. 넘으면 오래 안 쓴 것부터 버린다(다음 요청이 409 로 다시 준다). */
const HEAVY_CACHE_MAX = 6;
const heavyCache = new Map<string, unknown>();
function resolveWorkerHeavy(project: PiAgentRequest["project"], refs: Record<string, string>, raw: Record<string, unknown> | undefined):
  { project: PiAgentRequest["project"]; missing?: undefined } | { missing: string[] } {
  for (const [hash, value] of Object.entries(raw ?? {})) {
    if (value && typeof value === "object") { heavyCache.delete(hash); heavyCache.set(hash, value); }
  }
  const missing: string[] = [];
  const next = { ...project } as Record<string, unknown>;
  for (const key of HEAVY_KEYS) {
    const hash = refs[key];
    if (typeof hash !== "string") continue;
    const value = heavyCache.get(hash);
    if (value === undefined) { missing.push(hash); continue; }
    heavyCache.delete(hash);
    heavyCache.set(hash, value);
    next[key] = value;
  }
  while (heavyCache.size > HEAVY_CACHE_MAX) {
    const oldest = heavyCache.keys().next().value;
    if (oldest === undefined) break;
    heavyCache.delete(oldest);
  }
  if (missing.length) return { missing };
  return { project: next as unknown as PiAgentRequest["project"] };
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  // Bun.serve 의 idleTimeout 기본값은 10초다 — 연결에 바이트가 오가지 않으면 소켓을 끊는다.
  // /agent/run 은 턴 시작·툴 호출·응답 끝에만 이벤트를 쓰므로 모델이 10초 넘게 생각하면 스트림이
  // 끊기고, Node 쪽 fetch 는 `terminated` 를 던지고 워커는 클라이언트 중단으로 오해해 에이전트를
  // 전부 abort 했다(실측 2026-09-14: 팀 모드 "마을 만들어줘" 가 매번 25~110초 만에 실패). 실행
  // 상한은 piAgentRuntime 의 timeoutMs(기본 PI_AGENT_DEFAULT_TIMEOUT_MS, 3000초)가 따로 들고 있으므로 유휴 타임아웃은 끈다.
  idleTimeout: 0,
  // 요청 본문 상한. Bun.serve 기본값은 128MiB 이고, 넘으면 응답 없이 소켓을 닫아 호스트 fetch 가 `EPIPE`(「fetch failed」)로 끝난다.
  // /agent/run 은 프로젝트 사본 전체(타일셋 이미지·에셋 dataURL)를 싣는다 — 2026-09-27 새 프로젝트 기본 자료가 늘어
  // 몬스터 수집 프리셋 첫 요청이 151MB 가 됐고, 팀 첫 생성이 한 턴도 못 돌고 매번 이 오류로 죽었다.
  // 호스트가 압축 요청을 풀 때 쓰는 상한(`readRequestJson` maxOutputLength 256MiB)과 같게 둔다.
  maxRequestBodySize: 256 * 1024 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/complete") {
        const body = await request.json() as Record<string, unknown>;
        const provider = typeof body.provider === "string" ? body.provider : "google-antigravity";
        const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        return json(await completeProvider(provider, payload, { apiKey }));
      }
      if (request.method === "POST" && url.pathname === "/agent/render") {
        const body = await request.json();
        return resolvePiRender(body) ? json({ ok: true }) : json({ error: "이미지 요청이 만료되었거나 응답이 잘못됐습니다." }, 409);
      }
      if (request.method === "POST" && url.pathname === "/agent/checkpoint") {
        const body = await request.json() as { checkpointId?: string; ok?: boolean; issue?: string; project?: PiAgentRequest["project"] };
        const found = typeof body.checkpointId === "string" && resolvePiCheckpoint(body.checkpointId, { ok: body.ok === true, issue: body.issue, project: body.project });
        return json({ ok: found }, found ? 200 : 409);
      }
      if (request.method === "POST" && url.pathname === "/agent/keys") {
        // 호스트가 실행 도중 갱신한 요청 키. 진행 중인 실행의 다음 모델 요청부터 쓰인다(piWorkerKeys.ts).
        const body = await request.json() as { providerApiKeys?: Record<string, string | undefined> };
        return json({ updated: refreshWorkerKeys(body.providerApiKeys ?? {}) });
      }
      if (request.method === "POST" && url.pathname === "/agent/run") {
        // Pi 에이전트 실행. 진행 이벤트를 NDJSON 으로 흘리고 마지막 줄 `done` 에 결과 프로젝트를 싣는다.
        // 오류도 이벤트 줄로 보낸다 — 헤더가 이미 나간 뒤라 상태 코드로는 말할 수 없다.
        const timer = piTimer("worker /agent/run");
        const body = await request.json() as { apiKey?: string; providerApiKeys?: Record<string, string | undefined>; codexApiKey?: string; request?: PiAgentRequest; heavy?: Record<string, string>; heavyRaw?: Record<string, unknown> };
        timer.mark("json");
        const sentRequest = body.request;
        if (!sentRequest || typeof sentRequest !== "object" || typeof sentRequest.task !== "string" || !sentRequest.project) {
          return json({ error: "request.task 와 request.project 가 필요합니다" }, 400);
        }
        const resolved = body.heavy && typeof body.heavy === "object" ? resolveWorkerHeavy(sentRequest.project, body.heavy, body.heavyRaw) : null;
        timer.mark("heavy", resolved?.missing ? `missing=${resolved.missing.length}` : "");
        timer.done();
        if (resolved?.missing) return json({ error: "heavy-missing", missing: resolved.missing }, 409);
        const agentRequest: PiAgentRequest = resolved ? { ...sentRequest, project: resolved.project } : sentRequest;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        // Cold catalog parsing is preparation, before the live stream begins.
        // Team members reuse this revision rather than blocking its heartbeat.
        await preparePiWorkerSharedContent();
        await preparePiWorkerAudio();
        const held = holdWorkerKeys(body.providerApiKeys, agentRequest.provider, apiKey);
        const stream = createPiAgentNdjsonStream((onEvent) => (agentRequest.mode === "team" ? runPiTeam : runPiAgent)(agentRequest, {
          apiKey,
          providerApiKeys: held.keys,
          codexApiKey: body.codexApiKey,
          signal: request.signal,
          onEvent,
          renderToolImage: (project, toolName, data, signal) => requestPiRender(project, agentRequest.project, toolName, data, onEvent, signal ?? request.signal),
          onCheckpoint: (checkpoint, signal) => requestPiCheckpoint(checkpoint, onEvent, signal ?? request.signal),
          ...(agentRequest.readOnly ? { readOnlyTools: true } : {}),
          ...(agentRequest.timeoutMs ? { timeoutMs: agentRequest.timeoutMs } : {}),
        }).finally(held.release));
        return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Oprn-Heavy-Refs": "1" } });
      }
      if (request.method === "POST" && url.pathname === "/image") {
        const body = await request.json() as Record<string, unknown>;
        const provider = typeof body.provider === "string" ? body.provider : "google-antigravity";
        const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        return json(await (provider === CODEX_PROVIDER_ID
          ? generateCodexImage(payload, { apiKey })
          : generateProviderImage(provider, payload, { apiKey })));
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error
        ? Number((error as { status: unknown }).status) || 500
        : 500;
      return json({ error: error instanceof Error ? error.message : "oh-my-pi worker failed" }, status);
    }
  },
});

process.stdout.write(`READY ${server.port}\n`);
