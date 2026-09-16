import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { createStoreHandlers } from "../main/dispatch";
import { createProjectSessionRegistry } from "../main/sessions";
import { OPRN_CHANNELS } from "../shared/channels";
import { createCompanionMiddleware } from "../../scripts/lib/companion/middleware.mjs";

const BRIDGE_PATH = "/__oprn/bridge";
const BRIDGE_SCRIPT_PATH = "/__oprn/bridge.js";
const ASSET_PATH_PREFIX = "/__oprn/asset/";
const SESSION_KEY = "browser";
const LOOPBACK = "127.0.0.1";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
};

export type LocalProjectServerOptions = {
  /** 이 폴더만 연다. 브라우저가 다른 경로를 요구해도 무시한다. */
  readonly projectDir: string;
  readonly distDir: string;
  /** 빌드된 브라우저 브리지 원문(electron/browser/bridge.ts 의 산출물). */
  readonly browserBridgeSource: string;
  readonly port?: number;
};

export type LocalProjectServer = {
  readonly url: string;
  readonly token: string;
  readonly projectDir: string;
  close(): Promise<void>;
};

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(text);
}

export async function startLocalProjectServer(options: LocalProjectServerOptions): Promise<LocalProjectServer> {
  const root = resolve(options.distDir);
  const projectDir = resolve(options.projectDir);
  const sessions = createProjectSessionRegistry();
  await sessions.open(SESSION_KEY, projectDir);
  const handlers = createStoreHandlers(sessions);
  const companion = createCompanionMiddleware();
  const token = randomUUID();

  const dispatchBridge = async (payload: unknown): Promise<unknown> => {
    const body = payload as { readonly channel?: unknown; readonly payload?: unknown };
    const channel = typeof body.channel === "string" ? body.channel : "";
    const handler = handlers[channel];
    if (!handler) throw new Error(`${channel}: 알 수 없는 채널입니다`);

    // 로컬 서버는 폴더 하나에 묶인다.
    if (channel === OPRN_CHANNELS.projectOpen) return await handler(SESSION_KEY, { projectDir });

    if (channel === OPRN_CHANNELS.assetsPut) {
      const input = body.payload as { readonly bytes?: unknown };
      const bytes = typeof input?.bytes === "string" ? new Uint8Array(Buffer.from(input.bytes, "base64")) : input?.bytes;
      return await handler(SESSION_KEY, { ...(body.payload as object), bytes });
    }

    const result = await handler(SESSION_KEY, body.payload);
    if (channel === OPRN_CHANNELS.assetsRead && result instanceof Uint8Array) {
      return Buffer.from(result).toString("base64");
    }
    return result;
  };

  const serveStatic = async (pathname: string, response: ServerResponse): Promise<void> => {
    const relative = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\//, "");
    const target = resolve(root, normalize(relative));
    if (target !== root && !target.startsWith(root + sep)) {
      response.writeHead(403).end("forbidden");
      return;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(target);
    } catch {
      response.writeHead(404).end("not found");
      return;
    }
    const extension = extname(target);
    const contentType = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
    if (extension !== ".html") {
      response.writeHead(200, { "content-type": contentType });
      response.end(bytes);
      return;
    }
    const config = `<script>window.__OPRN_BRIDGE__=${JSON.stringify({ endpoint: BRIDGE_PATH, token })}</script>`;
    const injection = `${config}<script src="${BRIDGE_SCRIPT_PATH}"></script>`;
    const html = bytes.toString("utf8").replace("</head>", `${injection}</head>`);
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(html);
  };

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${LOOPBACK}`);
      let passedThrough = false;
      await companion(request, response, () => {
        passedThrough = true;
      });
      if (!passedThrough) return;
      if (request.method === "POST" && url.pathname === BRIDGE_PATH) {
        if (request.headers["x-oprn-bridge-token"] !== token) {
          sendJson(response, 403, { error: "token" });
          return;
        }
        try {
          sendJson(response, 200, await dispatchBridge(JSON.parse(await readRequestBody(request))));
        } catch (error) {
          sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }
      if (request.method === "GET" && url.pathname === BRIDGE_SCRIPT_PATH) {
        response.writeHead(200, { "content-type": MIME_BY_EXTENSION[".js"] ?? "text/javascript", "cache-control": "no-store" });
        response.end(options.browserBridgeSource);
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith(ASSET_PATH_PREFIX)) {
        const sha256 = url.pathname.slice(ASSET_PATH_PREFIX.length);
        const asset = sessions.require(SESSION_KEY).store.listAssets().find((row) => row.sha256 === sha256);
        if (!asset) {
          response.writeHead(404).end("unknown asset");
          return;
        }
        const bytes = await sessions.require(SESSION_KEY).store.assetBytes(sha256);
        response.writeHead(200, { "content-type": asset.mime, "cache-control": "public, max-age=31536000, immutable" });
        response.end(Buffer.from(bytes));
        return;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(url.pathname, response);
        return;
      }
      response.writeHead(405).end("method not allowed");
    })();
  });

  await new Promise<void>((resolvePromise) => server.listen(options.port ?? 0, LOOPBACK, resolvePromise));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : (options.port ?? 0);

  return {
    url: `http://${LOOPBACK}:${port}`,
    token,
    projectDir,
    async close(): Promise<void> {
      companion.dispose();
      sessions.close(SESSION_KEY);
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    },
  };
}
