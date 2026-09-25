// Standalone oh-my-pi companion (127.0.0.1:17832). Every provider — openai-codex
// included — authenticates and completes through @oh-my-pi/pi-ai.
// DEV uses vite.config.ts same-origin middleware. preview/dist needs this process.

import { createServer } from "node:http";
import { handleCompanionRequest, isCompanionPath } from "./lib/ohMyPiHttp.mjs";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "./lib/ohMyPiPiAi.mjs";
import { readRequestJson, writeCompanionResult } from "./lib/companionHttpUtil.mjs";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const host = "127.0.0.1";
const port = Number(process.env.OPRN_OAUTH_PORT || 17832);

const adapters = await createOhMyPiAdapters();

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

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  try {
    if (request.method === "OPTIONS") {
      const cors = allowedOrigin(origin);
      if (!cors) return sendJson(response, 403, { error: "Only loopback browser origins are allowed" }, undefined);
      response.writeHead(204, {
        "Access-Control-Allow-Origin": cors,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Content-Encoding, X-Oprn-Provider",
        Vary: "Origin",
      });
      return response.end();
    }
    if (!isCompanionPath(request.url ?? "")) {
      return sendJson(response, 404, { error: "Not found" }, origin);
    }
    const cors = allowedOrigin(origin);
    if (!cors) return sendJson(response, 403, { error: "Only loopback browser origins are allowed" }, undefined);
    const body = await readRequestJson(request);
    const result = await handleCompanionRequest(
      { method: request.method, url: request.url, headers: request.headers, body },
      adapters,
    );
    writeCompanionResult(response, result, { "Access-Control-Allow-Origin": cors, Vary: "Origin" });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return sendJson(response, status, { error: error instanceof Error ? error.message : "OAuth companion failed" }, origin);
  }
});

server.listen(port, host, () => console.log(`[oprn] AI companion (oh-my-pi): http://${host}:${port}`));
function shutdown() {
  server.close();
  stopOhMyPiWorker();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
