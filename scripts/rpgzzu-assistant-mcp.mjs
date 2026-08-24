#!/usr/bin/env node
// MCP server: drives the LIVE editor AI chat panel (same session as the UI).
//
// Flow:
//   [MCP client] --stdio JSON-RPC--> this process
//        HTTP 127.0.0.1:17831  <-->  browser editor (aiAssistantBridge)
//
// Usage:
//   1) npm run mcp:assistant
//   2) Open editor (npm run dev) — bridge auto-connects in DEV
//   3) Point MCP client at this script (stdio)
//
// Tools: assistant_send, assistant_status, assistant_audit, assistant_harness, assistant_abort, assistant_ping

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createMcpStdioDecoder, encodeMcpStdioMessage } from "./lib/mcpStdioFraming.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_PORT = Number(process.env.AI_ASSISTANT_BRIDGE_PORT || 17831);
const HOST = "127.0.0.1";

/** @type {Map<string, { resolve: (v: unknown) => void, reject: (e: Error) => void, timer: NodeJS.Timeout }>} */
const waitingResults = new Map();
/** @type {{ id: string, type: string, text?: string }[]} */
const commandQueue = [];
/** @type {((cmd: object | null) => void)[]} */
const longPollWaiters = [];
let browserLastHelloAt = 0;
let browserSeen = false;
let activeStdioFraming = "content-length";

function send(message) {
  process.stdout.write(encodeMcpStdioMessage(message, activeStdioFraming));
}

function success(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function failure(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function textContent(value) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
}

// 이 브리지는 127.0.0.1에 바인딩되지만 브라우저의 CORS는 IP 바인딩이 아니라 Origin 헤더로만
// 판정한다 — Access-Control-Allow-Origin:"*"는 열려 있는 아무 탭(신뢰 못 하는 웹사이트 포함)이
// fetch로 /v1/agent/send 등을 호출해 라이브 AI 어시스턴트를 원격 조종할 수 있게 만든다
// (localhost 서비스 대상 drive-by/CSRF 패턴). 같은 머신의 Vite dev 서버(localhost/127.0.0.1,
// 임의 포트)만 허용하고 그 외 Origin은 헤더를 아예 세팅하지 않아 브라우저가 응답 읽기를 막게 한다.
const ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req, res) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && ALLOWED_ORIGIN_PATTERN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function pushCommand(command) {
  if (longPollWaiters.length > 0) {
    const waiter = longPollWaiters.shift();
    waiter?.(command);
    return;
  }
  commandQueue.push(command);
}

function takeCommand() {
  return commandQueue.shift() ?? null;
}

/**
 * @param {{ type: string, text?: string }} cmd
 * @param {number} timeoutMs
 */
function enqueueAndWait(cmd, timeoutMs) {
  const id = randomUUID();
  const command = { id, ...cmd };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waitingResults.delete(id);
      reject(new Error(`Browser bridge timeout after ${timeoutMs}ms (is the editor open on this machine?)`));
    }, timeoutMs);
    waitingResults.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
      timer,
    });
    pushCommand(command);
  });
}

function toolList() {
  return {
    tools: [
      {
        name: "assistant_ping",
        description: "Check whether the live editor AI bridge is connected (browser hello recently).",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "assistant_status",
        description: "Get live AI panel status (turnBusy, configReady, lastStatus). Requires open editor.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "assistant_send",
        description:
          "Send a user message through the LIVE editor AI assistant (same UI session). User sees chat stream, tools, and proposals. Returns audit + harness summary when the turn finishes.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "User message to send to the assistant" },
            timeoutMs: { type: "number", description: "Max wait for turn completion (default 300000)" },
          },
          required: ["text"],
          additionalProperties: false,
        },
      },
      {
        name: "assistant_audit",
        description: "Fetch the current AI audit log from the live editor panel.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "assistant_harness",
        description: "Fetch AssistantSession harness snapshot (messages + audit) from the live editor.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "assistant_abort",
        description: "Abort the in-flight AI turn in the live editor.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
    ],
  };
}

async function callTool(name, args) {
  switch (name) {
    case "assistant_ping": {
      const ageMs = browserLastHelloAt ? Date.now() - browserLastHelloAt : null;
      return {
        ok: true,
        browserSeen,
        browserConnectedRecently: ageMs !== null && ageMs < 60_000,
        browserLastHelloAgeMs: ageMs,
        bridge: `http://${HOST}:${DEFAULT_PORT}`,
      };
    }
    case "assistant_status":
      return enqueueAndWait({ type: "status" }, 30_000);
    case "assistant_audit":
      return enqueueAndWait({ type: "audit" }, 30_000);
    case "assistant_harness":
      return enqueueAndWait({ type: "harness" }, 30_000);
    case "assistant_abort":
      return enqueueAndWait({ type: "abort" }, 15_000);
    case "assistant_send": {
      const text = typeof args?.text === "string" ? args.text.trim() : "";
      if (!text) throw new Error("text is required");
      const timeoutMs = Number(args?.timeoutMs) > 0 ? Number(args.timeoutMs) : 300_000;
      return enqueueAndWait({ type: "send", text }, timeoutMs);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handleMcpRequest(request) {
  const id = request.id ?? null;
  try {
    if (request.method === "initialize") {
      success(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "rpgzzu-assistant-bridge", version: "0.1.0" },
      });
      return;
    }
    if (request.method === "notifications/initialized") return;
    if (request.method === "tools/list") {
      success(id, toolList());
      return;
    }
    if (request.method === "tools/call") {
      const params = request.params ?? {};
      const name = params.name;
      const args = params.arguments ?? {};
      if (typeof name !== "string") {
        failure(id, -32602, "tools/call params.name must be a string");
        return;
      }
      void callTool(name, args)
        .then((result) => {
          const isError = result && typeof result === "object" && "ok" in result && result.ok === false;
          success(id, { content: textContent(result), isError: Boolean(isError) });
        })
        .catch((error) => {
          failure(id, -32603, error instanceof Error ? error.message : String(error));
        });
      return;
    }
    failure(id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    failure(id, -32603, error instanceof Error ? error.message : String(error));
  }
}

function startHttpBridge(port) {
  const server = createServer(async (req, res) => {
    cors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url || "/", `http://${HOST}:${port}`);

    try {
      if (req.method === "POST" && url.pathname === "/v1/browser/hello") {
        browserLastHelloAt = Date.now();
        browserSeen = true;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/browser/next") {
        browserLastHelloAt = Date.now();
        browserSeen = true;
        const waitMs = Math.min(30_000, Math.max(0, Number(url.searchParams.get("waitMs") || 25_000)));
        const immediate = takeCommand();
        if (immediate) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ command: immediate }));
          return;
        }
        const command = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            const idx = longPollWaiters.indexOf(resolver);
            if (idx >= 0) longPollWaiters.splice(idx, 1);
            resolve(null);
          }, waitMs);
          const resolver = (cmd) => {
            clearTimeout(timer);
            resolve(cmd);
          };
          longPollWaiters.push(resolver);
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ command }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/browser/result") {
        const body = await readJson(req);
        const id = body?.id;
        const result = body?.result;
        const waiter = typeof id === "string" ? waitingResults.get(id) : null;
        if (waiter) {
          waitingResults.delete(id);
          waiter.resolve(result);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            browserSeen,
            browserLastHelloAt,
            queueLength: commandQueue.length,
            waiting: waitingResults.size,
          }),
        );
        return;
      }

      // Agent/HTTP shortcut (same queue as MCP tools) — localhost only.
      if (req.method === "POST" && url.pathname === "/v1/agent/send") {
        const body = await readJson(req);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "text required" }));
          return;
        }
        const timeoutMs = Number(body?.timeoutMs) > 0 ? Number(body.timeoutMs) : 300_000;
        try {
          const result = await enqueueAndWait({ type: "send", text }, timeoutMs);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(504, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/agent/status") {
        try {
          const result = await enqueueAndWait({ type: "status" }, 30_000);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(504, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  server.listen(port, HOST, () => {
    process.stderr.write(`[rpgzzu-assistant-mcp] bridge http://${HOST}:${port}\n`);
  });
  return server;
}

function startFramedJsonRpc() {
  let handler = undefined;
  const pending = [];
  function dispatch(message) {
    if (handler) handler(message);
    else pending.push(message);
  }
  // HTTP-only mode (no MCP client on stdin) — keep process alive via the HTTP server.
  if (!process.stdin.isTTY && process.stdin.readableEnded) {
    return {
      setHandler(nextHandler) {
        handler = nextHandler;
      },
    };
  }
  const decoder = createMcpStdioDecoder((message) => {
    activeStdioFraming = decoder.framing();
    dispatch(message);
  });
  process.stdin.on("data", (chunk) => {
    try {
      decoder.push(chunk);
    } catch (error) {
      process.stderr.write(
        `[rpgzzu-assistant-mcp] stdin parse error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  });
  process.stdin.on("error", (error) => {
    process.stderr.write(
      `[rpgzzu-assistant-mcp] stdin error (ignored): ${error instanceof Error ? error.message : String(error)}\n`,
    );
  });
  // Do NOT exit when stdin ends — HTTP agent shortcuts still need the process.
  process.stdin.on("end", () => {
    process.stderr.write(`[rpgzzu-assistant-mcp] stdin closed; HTTP bridge stays up\n`);
  });
  process.stdin.resume();
  return {
    setHandler(nextHandler) {
      handler = nextHandler;
      while (pending.length > 0) handler(pending.shift());
    },
  };
}

function main() {
  const server = startHttpBridge(DEFAULT_PORT);
  server.on("error", (error) => {
    process.stderr.write(
      `[rpgzzu-assistant-mcp] HTTP listen error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
  const rpc = startFramedJsonRpc();
  rpc.setHandler(handleMcpRequest);
  process.stderr.write(
    `[rpgzzu-assistant-mcp] MCP stdio ready. Open the editor (npm run dev) so the AI panel connects.\n`,
  );
  // Keep event loop alive explicitly (HTTP server already does; this is belt-and-suspenders).
  setInterval(() => {}, 60_000).unref?.();
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
