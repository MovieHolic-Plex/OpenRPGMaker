// Bun-only worker: @oh-my-pi/pi-ai ships TypeScript + bun:sqlite and will not load under Node/tsx.
// Node (vite plugin / companion) talks to this loopback process.

import {
  completeProvider,
  listOhMyPiProviders,
  logoutProvider,
  publicProviderStatus,
  refreshProvider,
  saveProviderApiKey,
  seedOAuthForTests,
  startProviderLogin,
} from "./lib/ohMyPiPiAiRuntime.ts";

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
      if (request.method === "GET" && url.pathname === "/providers") {
        return json({ providers: listOhMyPiProviders() });
      }
      const body = request.method === "GET" ? {} : await request.json() as Record<string, unknown>;
      const provider = typeof body.provider === "string" ? body.provider : "openai-codex";
      if (request.method === "POST" && url.pathname === "/status") {
        return json(publicProviderStatus(provider));
      }
      if (request.method === "POST" && url.pathname === "/login") {
        return json(await startProviderLogin(provider, body));
      }
      if (request.method === "POST" && url.pathname === "/seed-oauth") {
        if (process.env.RPG_ZZU_OH_MY_PI_TEST_STUB !== "1") return json({ error: "forbidden" }, 403);
        seedOAuthForTests(provider, {
          access: String(body.access ?? "a"),
          refresh: String(body.refresh ?? "r"),
          expires: Number(body.expires) || 0,
        });
        return json(publicProviderStatus(provider));
      }
      if (request.method === "POST" && url.pathname === "/refresh") {
        return json(await refreshProvider(provider));
      }
      if (request.method === "POST" && url.pathname === "/logout") {
        return json(logoutProvider(provider));
      }
      if (request.method === "POST" && url.pathname === "/key") {
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
        if (!apiKey) return json({ error: "apiKey is required" }, 400);
        return json(saveProviderApiKey(provider, apiKey));
      }
      if (request.method === "POST" && url.pathname === "/complete") {
        const payload = body.body && typeof body.body === "object" ? body.body as Record<string, unknown> : body;
        const result = await completeProvider(provider, payload);
        return json(result);
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
