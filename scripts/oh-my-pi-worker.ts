// Bun 전용 완성 워커. `@oh-my-pi/pi-ai` 가 bun:sqlite · type:text import 를 쓰므로
// Node/tsx 에선 로드되지 않아, 모델 호출만 이 루프백 프로세스에 남긴다.
//
// 인증은 이곳에 없다: 토큰·로그인·갱신은 Node 쒡(scripts/lib/aiAuthRuntime.ts)이 전부 소유하고,
// 이 워커는 이미 부혼 apiKey 를 요청 본밎으로 받는다. 그러지 않으면 Bun 없는 머신에서
// 로그인조차 불가능해진다.

import { completeProvider } from "./lib/ohMyPiPiAiRuntime.ts";
import { generateProviderImage } from "./lib/ohMyPiImageRuntime.ts";

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
      if (request.method === "POST" && url.pathname === "/image") {
        const body = await request.json() as Record<string, unknown>;
        const provider = typeof body.provider === "string" ? body.provider : "google-antigravity";
        const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        return json(await generateProviderImage(provider, payload, { apiKey }));
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
