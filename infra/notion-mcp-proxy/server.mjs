import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { Readable } from "node:stream";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

loadDotEnv(fileURLToPath(new URL("./.env", import.meta.url)));

const config = {
  token: required("NOTION_TOKEN"),
  bindHost: required("BIND_HOST"),
  port: numberEnv("PORT", 8788),
  hostname: required("MCP_HOSTNAME").toLowerCase(),
  certFile: process.env.TLS_CERT_FILE?.trim(),
  keyFile: process.env.TLS_KEY_FILE?.trim(),
  allowedCidrs: required("ALLOWED_CIDRS").split(",").map(parseCidr),
};

if (config.token === "secret_replace_me") throw new Error("Replace NOTION_TOKEN in .env before starting the service");
if (Boolean(config.certFile) !== Boolean(config.keyFile)) throw new Error("Set both TLS_CERT_FILE and TLS_KEY_FILE, or neither");
const tlsEnabled = Boolean(config.certFile && config.keyFile && existsSync(config.certFile) && existsSync(config.keyFile));
const scheme = tlsEnabled ? "https" : "http";

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a TCP port`);
  return value;
}

function ipv4ToInt(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return undefined;
  let output = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    output = (output << 8) | octet;
  }
  return output >>> 0;
}

function parseCidr(value) {
  const [ip, prefixText] = value.trim().split("/");
  const address = ipv4ToInt(ip ?? "");
  const prefix = Number(prefixText);
  if (address === undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid ALLOWED_CIDRS entry: ${value}`);
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { address: address & mask, mask };
}

function isAllowedAddress(remoteAddress) {
  const normalized = remoteAddress?.replace(/^::ffff:/, "");
  const address = normalized ? ipv4ToInt(normalized) : undefined;
  return address !== undefined && config.allowedCidrs.some((cidr) => (address & cidr.mask) === cidr.address);
}

function isExpectedHost(hostHeader) {
  if (typeof hostHeader !== "string") return false;
  const host = hostHeader.split(":", 1)[0]?.toLowerCase();
  return host === config.hostname;
}

function isExpectedOrigin(originHeader) {
  if (originHeader === undefined) return true;
  try {
    return new URL(originHeader).hostname.toLowerCase() === config.hostname;
  } catch {
    return false;
  }
}

async function notion(path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : {};
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload ? payload.message : text;
    throw new Error(`Notion API ${response.status}: ${String(message).slice(0, 500)}`);
  }
  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function toolResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
}

function markdownToBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    const [type, text] = heading
      ? [`heading_${heading[1].length}`, heading[2]]
      : bullet
        ? ["bulleted_list_item", bullet[1]]
        : numbered
          ? ["numbered_list_item", numbered[1]]
          : ["paragraph", line];
    blocks.push({ object: "block", type, [type]: { rich_text: [{ type: "text", text: { content: text.slice(0, 1900) } }] } });
  }
  return blocks;
}

function makeServer() {
  const server = new McpServer(
    { name: "mdc-notion-proxy", version: "1.0.0" },
    { instructions: "Use only the exposed least-privilege Notion tools. This MCP endpoint is restricted to an IP allowlist." },
  );

  server.registerTool(
    "notion_search",
    {
      description: "Search pages and databases that were explicitly shared with the proxy's Notion integration.",
      inputSchema: z.object({ query: z.string().min(1).max(500), page_size: z.number().int().min(1).max(25).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, page_size }) => {
      try {
        return toolResult(await notion("/search", { method: "POST", body: { query, page_size: page_size ?? 10 } }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "notion_fetch",
    {
      description: "Fetch a Notion page and its first 100 child blocks. The page must be shared with the proxy integration.",
      inputSchema: z.object({ page_id: z.string().uuid() }),
      annotations: { readOnlyHint: true },
    },
    async ({ page_id }) => {
      try {
        const [page, children] = await Promise.all([notion(`/pages/${page_id}`), notion(`/blocks/${page_id}/children?page_size=100`)]);
        return toolResult({ page, children });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "notion_create_page",
    {
      description: "Create a basic Markdown page below a shared parent page. Supported formatting: headings, bullets, numbered lists, and paragraphs.",
      inputSchema: z.object({ parent_page_id: z.string().uuid(), title: z.string().min(1).max(500), markdown: z.string().min(1).max(80_000) }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ parent_page_id, title, markdown }) => {
      try {
        return toolResult(await notion("/pages", {
          method: "POST",
          body: { parent: { type: "page_id", page_id: parent_page_id }, properties: { title: { title: [{ type: "text", text: { content: title } }] } }, children: markdownToBlocks(markdown) },
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "notion_append_content",
    {
      description: "Append basic Markdown content to an existing shared Notion page. It never replaces or deletes existing content.",
      inputSchema: z.object({ page_id: z.string().uuid(), markdown: z.string().min(1).max(80_000) }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ page_id, markdown }) => {
      try {
        return toolResult(await notion(`/blocks/${page_id}/children`, { method: "PATCH", body: { children: markdownToBlocks(markdown) } }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "notion_create_comment",
    {
      description: "Add a page-level comment to an existing shared Notion page.",
      inputSchema: z.object({ page_id: z.string().uuid(), text: z.string().min(1).max(1_900) }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ page_id, text }) => {
      try {
        return toolResult(await notion("/comments", {
          method: "POST",
          body: { parent: { page_id }, rich_text: [{ type: "text", text: { content: text } }] },
        }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
  return server;
}

const mcpHandler = createMcpHandler(makeServer, { legacy: "stateless" });

async function handleMcp(request, response) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Readable.toWeb(request);
    init.duplex = "half";
  }
  const upstream = await mcpHandler.fetch(new Request(`${scheme}://${config.hostname}:${config.port}${request.url ?? "/mcp"}`, init));
  const outputHeaders = Object.fromEntries(upstream.headers.entries());
  response.writeHead(upstream.status, outputHeaders);
  if (upstream.body) {
    for await (const chunk of Readable.fromWeb(upstream.body)) response.write(chunk);
  }
  response.end();
}

const requestHandler = (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (tlsEnabled) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (!isAllowedAddress(request.socket.remoteAddress)) {
    response.writeHead(403, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "source IP is not allowed" }));
    return;
  }
  if (!isExpectedHost(request.headers.host) || !isExpectedOrigin(request.headers.origin)) {
    response.writeHead(421, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "unexpected host or origin" }));
    return;
  }
  if (request.method === "GET" && request.url === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url !== "/mcp") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  void handleMcp(request, response).catch((error) => {
    if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  });
};

const httpServer = tlsEnabled
  ? createHttpsServer({ cert: readFileSync(config.certFile), key: readFileSync(config.keyFile), minVersion: "TLSv1.3" }, requestHandler)
  : createHttpServer(requestHandler);

httpServer.listen(config.port, config.bindHost, () => {
  console.log(`notion-mcp-proxy listening on ${scheme}://${config.hostname}:${config.port}/mcp`);
});

function stop(signal) {
  console.log(`received ${signal}; stopping`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
