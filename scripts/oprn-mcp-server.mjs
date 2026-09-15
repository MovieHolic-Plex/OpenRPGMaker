#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";

const HEADLESS_ENTRY = resolve(fileURLToPath(new URL("../src/headless/index.ts", import.meta.url)));
const PROTOCOL_VERSION = "2024-11-05";

function parseArgs(argv) {
  const parsed = { projectPath: undefined, auditLogPath: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") {
      parsed.projectPath = argv[i + 1];
      i += 1;
    } else if (arg === "--audit-log") {
      parsed.auditLogPath = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function loadProject(module, projectPath) {
  const bytes = readFileSync(projectPath);
  // 확장자 판정은 src/headless 가 든다(.oprn 우선, 옛 .rpgzzu 도 읽음) — 여기서 문자열을 따로 들지 않는다.
  if (module.isHeadlessPackagePath(projectPath)) {
    return module.loadHeadlessProjectFromPackage(bytes);
  }
  return module.loadHeadlessProject(bytes.toString("utf8"));
}

function send(message) {
  const body = JSON.stringify(message);
  const bytes = Buffer.byteLength(body, "utf8");
  process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${body}`);
}

function success(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function failure(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function audit(auditLogPath, record) {
  if (!auditLogPath) return;
  appendFileSync(auditLogPath, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`, "utf8");
}

function textContent(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

function handleRequest(module, project, auditLogPath, request) {
  const id = request.id ?? null;
  try {
    if (request.method === "initialize") {
      success(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "oprn-headless", version: "0.1.0" },
      });
      return;
    }
    if (request.method === "notifications/initialized") {
      return;
    }
    if (request.method === "tools/list") {
      success(id, { tools: module.listHeadlessMcpTools() });
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
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        failure(id, -32602, "tools/call params.arguments must be an object");
        return;
      }
      const result = module.runHeadlessTool(project, name, args);
      audit(auditLogPath, { tool: name, args, summary: result.summary, ok: result.ok });
      success(id, { content: textContent(result), isError: result.ok !== true });
      return;
    }
    failure(id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    failure(id, -32603, error instanceof Error ? error.message : String(error));
  }
}

function startFramedJsonRpc() {
  let buffer = Buffer.alloc(0);
  let handler = undefined;
  const pending = [];
  const done = new Promise((resolvePromise) => process.stdin.on("end", resolvePromise));
  function dispatch(message) {
    if (handler) handler(message);
    else pending.push(message);
  }
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const lengthMatch = /^Content-Length:\s*(\d+)$/im.exec(header);
      if (!lengthMatch) {
        throw new Error("Missing Content-Length header");
      }
      const length = Number(lengthMatch[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) return;
      const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
      buffer = buffer.slice(bodyEnd);
      dispatch(JSON.parse(body));
    }
  });
  process.stdin.resume();
  return {
    done,
    setHandler(nextHandler) {
      handler = nextHandler;
      while (pending.length > 0) handler(pending.shift());
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.projectPath) {
    throw new Error("Usage: node scripts/oprn-mcp-server.mjs --project <file.json|file.oprn> [--audit-log <path>]   (legacy .rpgzzu still opens)");
  }
  const rpc = startFramedJsonRpc();
  await withTsModule(HEADLESS_ENTRY, "headless.mjs", async (module) => {
    const project = loadProject(module, args.projectPath);
    rpc.setHandler((request) => handleRequest(module, project, args.auditLogPath, request));
    await rpc.done;
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
