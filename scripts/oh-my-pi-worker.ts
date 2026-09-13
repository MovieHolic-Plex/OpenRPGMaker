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
import { encodePiAgentEvent, type PiAgentEvent, type PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

const port = Number(process.env.RPG_ZZU_OH_MY_PI_WORKER_PORT || 0);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
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
      if (request.method === "POST" && url.pathname === "/agent/run") {
        // Pi 에이전트 실행. 진행 이벤트를 NDJSON 으로 흘리고 마지막 줄 `done` 에 결과 프로젝트를 싣는다.
        // 오류도 이벤트 줄로 보낸다 — 헤더가 이미 나간 뒤라 상태 코드로는 말할 수 없다.
        const body = await request.json() as { apiKey?: string; providerApiKeys?: Record<string, string | undefined>; request?: PiAgentRequest };
        const agentRequest = body.request;
        if (!agentRequest || typeof agentRequest !== "object" || typeof agentRequest.task !== "string" || !agentRequest.project) {
          return json({ error: "request.task 와 request.project 가 필요합니다" }, 400);
        }
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const write = (line: string) => {
              try { controller.enqueue(encoder.encode(line)); } catch { /* 클라이언트가 끊었다 */ }
            };
            const agentOptions = {
              apiKey,
              providerApiKeys: body.providerApiKeys,
              signal: request.signal,
              onEvent: (event: PiAgentEvent) => write(encodePiAgentEvent(event)),
              ...(agentRequest.readOnly ? { readOnlyTools: true } : {}),
              ...(agentRequest.timeoutMs ? { timeoutMs: agentRequest.timeoutMs } : {}),
            };
            (agentRequest.mode === "team" ? runPiTeam : runPiAgent)(agentRequest, agentOptions)
              .catch((error) => write(encodePiAgentEvent({ type: "error", message: error instanceof Error ? error.message : String(error) })))
              .finally(() => { try { controller.close(); } catch { /* 이미 닫힘 */ } });
          },
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
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
