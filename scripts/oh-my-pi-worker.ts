// 순수 Node / Electron 호환 AI 실행 워커 (@earendil-works/pi-ai + pi-agent-core).
//
// 인증은 이곳에 없다: 토큰·로그인·갱신은 Node 호스트(scripts/lib/aiAuthRuntime.ts)가 전부 소유하고,
// 이 워커는 이미 푼 apiKey 를 요청 본문으로 받아 모델 호출·에이전트 루프만 맡는다.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requestPiRender, requestPiOpeningGeneration, resolvePiRender } from "./lib/piRenderBroker.ts";
import { requestPiCheckpoint, resolvePiCheckpoint } from "./lib/piCheckpointBroker.ts";
import { completeProvider } from "./lib/ohMyPiPiAiRuntime.ts";
import { fetchProviderUsage } from "./lib/providerUsageRuntime.ts";
import { generateProviderImage } from "./lib/ohMyPiImageRuntime.ts";
import { generateCodexImage } from "./lib/codexImageRuntime.ts";
import { CODEX_PROVIDER_ID } from "../src/ai/oauth/credentials.ts";
import { runPiAgent } from "./lib/piAgentRuntime.ts";
import { runAssistantV2 } from "./lib/assistantV2Runtime.ts";
import { isMonsterRequestTurn } from "../src/ai/piAgent/monsterGameRequest.ts";
import { runPiTeam } from "./lib/piTeamRuntime.ts";
import { createPiAgentNdjsonStream } from "./lib/piAgentStream.ts";
import { detectLocalClis, healthCheckLocalCli, pickDefaultLocalCli } from "./lib/localCliAgent/registry.ts";
import { localCliIdOf } from "./lib/localCliAgent/types.ts";
import { preparePiWorkerSharedContent } from "./lib/piWorkerSharedContent.ts";
import { preparePiWorkerAudio } from "./lib/piWorkerAudio.ts";
import { holdWorkerKeys, refreshWorkerKeys } from "./lib/piWorkerKeys.ts";
import type { PiAgentRequest } from "../src/ai/piAgent/protocol.ts";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";
import { piTimer } from "./lib/piRunTiming.mjs";
import { registerOpenAiCompatEndpoints } from "./lib/openAiCompatModel.ts";
import { configureWorkerStore } from "./lib/workerStore.ts";

applyLegacyEnvAliases();

const port = Number(process.env.OPRN_OH_MY_PI_WORKER_PORT || 0);
const MAX_BODY_BYTES = 256 * 1024 * 1024;

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  const payload = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("요청 본문이 최대 크기(256MiB)를 넘었습니다."), { status: 413 });
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * 무거운 키(타일셋·DB·에셋)를 해시로 받아 파싱해 둔 객체를 쓴다. 호스트는 해시만 보내고, 여기 없으면 409 로 그 해시의
 * 원문(heavyRaw, 이미 객체로 파싱돼 온다)을 받는다.
 */
const HEAVY_KEYS = ["tilesets", "database", "assets"] as const;
const HEAVY_CACHE_MAX = 6;
const heavyCache = new Map<string, unknown>();

function resolveWorkerHeavy(
  project: PiAgentRequest["project"],
  refs: Record<string, string>,
  raw: Record<string, unknown> | undefined,
): { project: PiAgentRequest["project"]; missing?: undefined } | { missing: string[] } {
  for (const [hash, value] of Object.entries(raw ?? {})) {
    if (value && typeof value === "object") {
      heavyCache.delete(hash);
      heavyCache.set(hash, value);
    }
  }
  const missing: string[] = [];
  const next = { ...project } as Record<string, unknown>;
  for (const key of HEAVY_KEYS) {
    const hash = refs[key];
    if (typeof hash !== "string") continue;
    const value = heavyCache.get(hash);
    if (value === undefined) {
      missing.push(hash);
      continue;
    }
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

const server = createServer(async (req, res) => {
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort(new Error("client disconnected"));
  });
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  try {
    if (req.method === "POST" && url.pathname === "/complete") {
      const body = await readJsonBody(req);
      const provider = typeof body.provider === "string" ? body.provider : "openai-codex";
      const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
      const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
      registerOpenAiCompatEndpoints(body.compatEndpoints as never);
      sendJson(res, await completeProvider(provider, payload, { apiKey, signal: abortController.signal }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/usage") {
      const body = await readJsonBody(req);
      sendJson(res, await fetchProviderUsage(String(body.provider ?? ""), typeof body.apiKey === "string" ? body.apiKey : undefined));
      return;
    }
    if (req.method === "POST" && url.pathname === "/local-agents") {
      const body = await readJsonBody(req).catch(() => ({})) as { fresh?: boolean };
      const clis = await detectLocalClis({ fresh: body.fresh === true });
      sendJson(res, { clis, recommended: pickDefaultLocalCli(clis) ?? null });
      return;
    }
    if (req.method === "POST" && url.pathname === "/local-agents/health") {
      const body = await readJsonBody(req).catch(() => ({})) as { cli?: string; id?: string; model?: string };
      const id = localCliIdOf(`local-cli:${body.cli ?? body.id ?? ""}`);
      if (!id) {
        sendJson(res, { error: `알 수 없는 AI 프로그램입니다: ${String(body.cli ?? body.id ?? "(없음)")}. claude·codex·gemini 중 하나여야 합니다.` }, 400);
        return;
      }
      sendJson(res, await healthCheckLocalCli(id, typeof body.model === "string" && body.model ? body.model : undefined, abortController.signal));
      return;
    }
    if (req.method === "POST" && url.pathname === "/agent/render") {
      const body = await readJsonBody(req);
      const ok = resolvePiRender(body as never);
      sendJson(res, ok ? { ok: true } : { error: "이미지 요청이 만료되었거나 응답이 잘못됐습니다." }, ok ? 200 : 409);
      return;
    }
    if (req.method === "POST" && url.pathname === "/agent/checkpoint") {
      const body = await readJsonBody(req) as { checkpointId?: string; ok?: boolean; issue?: string; project?: PiAgentRequest["project"] };
      const found = typeof body.checkpointId === "string" && resolvePiCheckpoint(body.checkpointId, { ok: body.ok === true, issue: body.issue, project: body.project });
      sendJson(res, { ok: found }, found ? 200 : 409);
      return;
    }
    if (req.method === "POST" && url.pathname === "/agent/keys") {
      const body = await readJsonBody(req) as { providerApiKeys?: Record<string, string | undefined> };
      sendJson(res, { updated: refreshWorkerKeys(body.providerApiKeys ?? {}) });
      return;
    }
    if (req.method === "POST" && url.pathname === "/agent/run") {
      const timer = piTimer("worker /agent/run");
      const body = await readJsonBody(req) as {
        apiKey?: string;
        providerApiKeys?: Record<string, string | undefined>;
        codexApiKey?: string;
        compatEndpoints?: Record<string, never>;
        request?: PiAgentRequest;
        heavy?: Record<string, string>;
        heavyRaw?: Record<string, unknown>;
      };
      timer.mark("json");
      registerOpenAiCompatEndpoints(body.compatEndpoints);
      const sentRequest = body.request;
      if (!sentRequest || typeof sentRequest !== "object" || typeof sentRequest.task !== "string" || !sentRequest.project) {
        sendJson(res, { error: "request.task 와 request.project 가 필요합니다" }, 400);
        return;
      }
      const resolved = body.heavy && typeof body.heavy === "object" ? resolveWorkerHeavy(sentRequest.project, body.heavy, body.heavyRaw) : null;
      timer.mark("heavy", resolved?.missing ? `missing=${resolved.missing.length}` : "");
      timer.done();
      if (resolved?.missing) {
        sendJson(res, { error: "heavy-missing", missing: resolved.missing }, 409);
        return;
      }
      const resolvedRequest: PiAgentRequest = resolved ? { ...sentRequest, project: resolved.project } : sentRequest;
      const agentRequest: PiAgentRequest = resolvedRequest.monsterTurn === undefined
        ? { ...resolvedRequest, monsterTurn: isMonsterRequestTurn(resolvedRequest.task) }
        : resolvedRequest;
      const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
      await preparePiWorkerSharedContent();
      await preparePiWorkerAudio();
      configureWorkerStore(agentRequest.store, String(agentRequest.task ?? ""));
      const held = holdWorkerKeys(body.providerApiKeys, agentRequest.provider, apiKey);
      const stream = createPiAgentNdjsonStream((onEvent) => (
        agentRequest.assistantVersion === "v2" ? runAssistantV2 : agentRequest.mode === "team" ? runPiTeam : runPiAgent
      )(agentRequest, {
        apiKey,
        providerApiKeys: held.keys,
        codexApiKey: body.codexApiKey,
        signal: abortController.signal,
        onEvent,
        renderToolImage: (project, toolName, data, signal, latestBase) => requestPiRender(project, latestBase ?? agentRequest.project, toolName, data, onEvent, signal ?? abortController.signal, undefined, !!latestBase),
        generateOpeningImage: (project, args, signal) => requestPiOpeningGeneration(project, agentRequest.project, args, onEvent, signal ?? abortController.signal),
        onCheckpoint: (checkpoint, signal) => requestPiCheckpoint(checkpoint, onEvent, signal ?? abortController.signal),
        ...(agentRequest.readOnly ? { readOnlyTools: true } : {}),
        ...(agentRequest.timeoutMs ? { timeoutMs: agentRequest.timeoutMs } : {}),
      }).finally(held.release));

      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Oprn-Heavy-Refs": "1",
      });
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (res.writableEnded || res.destroyed) break;
          if (value && value.byteLength > 0) res.write(value);
        }
      } finally {
        reader.releaseLock();
        if (!res.writableEnded) res.end();
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/image") {
      const body = await readJsonBody(req);
      const provider = typeof body.provider === "string" ? body.provider : CODEX_PROVIDER_ID;
      const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
      const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
      sendJson(res, await (process.env.OPRN_OH_MY_PI_TEST_STUB === "1"
        ? generateProviderImage(provider, payload, { apiKey })
        : provider === CODEX_PROVIDER_ID
          ? generateCodexImage(payload, { apiKey })
          : generateProviderImage(provider, payload, { apiKey })));
      return;
    }
    sendJson(res, { error: "Not found" }, 404);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status) || 500
      : 500;
    sendJson(res, { error: error instanceof Error ? error.message : "ai worker failed" }, status);
  }
});

// 긴 추론 턴에서 유휴 소켓 타임아웃이 끊기지 않도록 타임아웃을 끈다(실행 상한은 piAgentRuntime timeoutMs 가 관리).
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 0;

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  process.stdout.write(`READY ${actualPort}\n`);
});
