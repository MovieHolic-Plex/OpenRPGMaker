// Codex app-server JSON-RPC + ChatGPT OAuth bridge, shared by:
//   - scripts/chatgpt-oauth-companion.mjs  (standalone 127.0.0.1:17832 server, used by vite preview / dist)
//   - vite.config.ts codexOAuthPlugin      (dev-server middleware, same-origin, no separate process needed)
//
// Keep this module dependency-free beyond node builtins + the protocol helper so both call sites load it fast.

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { codexProcessSpec } from "./codexProcess.mjs";
import {
  chatCompletionsToCodexRequest,
  codexEventToChatCompletionChunks,
  nonStreamCompletion,
} from "./chatgptOAuthProtocol.mjs";

const authPath = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");

const CHATGPT_UPSTREAM_URL = "https://chatgpt.com/backend-api/codex/responses";
const UPSTREAM_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Spawn a codex app-server child process and wrap it in a tiny JSON-RPC client.
 * Returns a session handle whose `ready()` resolves once the initialize/initialized handshake completes.
 */
export function spawnCodexSession() {
  const spec = codexProcessSpec();
  const codex = spawn(spec.command, spec.args, {
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: true,
  });
  const pending = new Map();
  let nextRpcId = 1;
  let stdoutBuffer = "";

  codex.stdout.setEncoding("utf8");
  codex.stdout.on("data", (data) => {
    stdoutBuffer += data;
    let newline = stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      newline = stdoutBuffer.indexOf("\n");
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (message.id === undefined) continue;
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(String(message.error?.message ?? "Codex app-server error")));
      else waiter.resolve(message.result);
    }
  });

  codex.on("exit", (code) => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error(`Codex app-server exited (${code ?? "unknown"})`));
    }
    pending.clear();
  });

  function rpc(method, params) {
    const id = nextRpcId;
    nextRpcId += 1;
    codex.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  function notify(method, params) {
    codex.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  const readyPromise = rpc("initialize", {
    clientInfo: { name: "rpg-zzu", title: "RPG ZZU", version: "1.0.0" },
    capabilities: {},
  }).then(() => notify("initialized", {}));

  return {
    ready: () => readyPromise,
    rpc,
    notify,
    kill: () => codex.kill(),
  };
}

export async function accountStatus(session, refreshToken = false) {
  const result = await session.rpc("account/read", { refreshToken });
  const account = result?.account;
  return {
    connected: account?.type === "chatgpt",
    planType: typeof account?.planType === "string" ? account.planType : undefined,
  };
}

export async function readChatGptToken(session) {
  const status = await accountStatus(session, true);
  if (!status.connected) throw Object.assign(new Error("ChatGPT login required"), { status: 401 });
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  const accessToken = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (typeof accessToken !== "string" || typeof accountId !== "string") {
    throw Object.assign(new Error("ChatGPT OAuth token is unavailable"), { status: 401 });
  }
  return { accessToken, accountId };
}

export async function startDeviceLogin(session) {
  const result = await session.rpc("account/login/start", { type: "chatgptDeviceCode" });
  return { verificationUrl: result.verificationUrl, userCode: result.userCode };
}

async function consumeCodexSse(body, onEvent) {
  if (!body) throw new Error("ChatGPT returned no response body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/u, "");
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      onEvent(JSON.parse(payload));
    }
  }
}

/**
 * Call ChatGPT Codex Responses on behalf of the browser client.
 * Returns `{ stream: false, completion }` for non-streaming or `{ stream: true, chunks }` for SSE.
 */
export async function proxyCompletion(session, clientBody) {
  const { accessToken, accountId } = await readChatGptToken(session);
  const upstream = await fetch(CHATGPT_UPSTREAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "chatgpt-account-id": accountId,
      "OpenAI-Beta": "responses=experimental",
      originator: "pi",
      "User-Agent": "rpg-zzu-ai-oauth/1.0",
    },
    body: JSON.stringify(chatCompletionsToCodexRequest(clientBody)),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 1000);
    const err = new Error(detail || "ChatGPT request failed");
    err.status = upstream.status;
    throw err;
  }
  const state = { toolIndexes: new Map(), nextToolIndex: 0, sawToolCall: false };
  if (clientBody.stream === false) {
    await consumeCodexSse(upstream.body, (event) => {
      codexEventToChatCompletionChunks(event, state);
    });
    return { stream: false, completion: nonStreamCompletion(state) };
  }
  const chunks = [];
  await consumeCodexSse(upstream.body, (event) => {
    for (const chunk of codexEventToChatCompletionChunks(event, state)) chunks.push(chunk);
  });
  return { stream: true, chunks };
}
