// Standalone ChatGPT OAuth companion (127.0.0.1:17832).
// Used by vite preview / dist builds (no dev middleware). For `npm run dev`, the
// vite.config.ts codexOAuthPlugin mounts the same logic same-origin and this
// separate process is not needed.
//
// Auth/session/proxy logic lives in ./lib/codexOAuthSession.mjs (shared with the dev plugin).

import { createServer } from "node:http";
import {
  spawnCodexSession,
  accountStatus,
  startDeviceLogin,
  proxyCompletion,
} from "./lib/codexOAuthSession.mjs";

const host = "127.0.0.1";
const port = Number(process.env.RPG_ZZU_OAUTH_PORT || 17832);

const session = spawnCodexSession();
await session.ready();

function allowedOrigin(origin) {
  if (!origin) return "*";
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin) ? origin : null;
}

function sendJson(response, status, value, origin) {
  const cors = allowedOrigin(origin);
  if (!cors) return sendJson(response, 403, { error: "Only loopback browser origins are allowed" }, undefined);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": cors, Vary: "Origin" });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function streamCompletion(request, response, origin) {
  const clientBody = await readJsonBody(request);
  const result = await proxyCompletion(session, clientBody);
  const cors = allowedOrigin(origin);
  if (!cors) return sendJson(response, 403, { error: "Only loopback browser origins are allowed" }, undefined);
  if (!result.stream) return sendJson(response, 200, result.completion, origin);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": cors,
    Vary: "Origin",
  });
  for (const chunk of result.chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
  response.end("data: [DONE]\n\n");
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  try {
    if (request.method === "OPTIONS") {
      const cors = allowedOrigin(origin);
      if (!cors) return sendJson(response, 403, { error: "Only loopback browser origins are allowed" }, undefined);
      response.writeHead(204, {
        "Access-Control-Allow-Origin": cors,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      });
      return response.end();
    }
    if (request.method === "GET" && request.url === "/auth/status") {
      return sendJson(response, 200, await accountStatus(session, false), origin);
    }
    if (request.method === "POST" && request.url === "/auth/login") {
      return sendJson(response, 200, await startDeviceLogin(session), origin);
    }
    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      return await streamCompletion(request, response, origin);
    }
    return sendJson(response, 404, { error: "Not found" }, origin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return sendJson(response, status, { error: error instanceof Error ? error.message : "OAuth companion failed" }, origin);
  }
});

server.listen(port, host, () => console.log(`[rpg-zzu] ChatGPT OAuth companion: http://${host}:${port}`));
function shutdown() {
  server.close();
  session.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
