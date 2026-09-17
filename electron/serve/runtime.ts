import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, normalize, resolve, sep, basename } from "node:path";
import { createStoreHandlers } from "../main/dispatch";
import { createProjectSessionRegistry, type SessionRegistry } from "../main/sessions";
import { OPRN_CHANNELS } from "../shared/channels";
import { createCompanionMiddleware } from "../../scripts/lib/companion/middleware.mjs";
import { createActivityMirrorMiddleware } from "../../scripts/lib/activityMirrorMiddleware.mjs";

import { loginPage, teamPage } from "./teamPage";

const BRIDGE_PATH = "/__oprn/bridge";
const BRIDGE_SCRIPT_PATH = "/__oprn/bridge.js";
const ASSET_PATH_PREFIX = "/__oprn/asset/";
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
  readonly sessions?: SessionRegistry;
  readonly distDir: string;
  /** 빌드된 브라우저 브리지 원문(electron/browser/bridge.ts 의 산출물). */
  readonly browserBridgeSource: string;
  readonly port?: number;
  /** Non-loopback hosting requires the exact externally visible origin (TLS at a reverse proxy is supported). */
  readonly host?: string;
  readonly publicOrigin?: string;
};

export type LocalProjectServer = {
  readonly url: string;
  readonly token: string;
  readonly ownerAccessCode: string | null;
  /** 동반 서비스(AI) 실행별 토큰(설계 7.4). 페이지는 브리지 설정에서 받는다. */
  readonly companionToken: string;
  readonly projectDir: string;
  close(): Promise<void>;
};

function readRequestBody(request: IncomingMessage, maxBytes = 64 * 1024 * 1024): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    request.on("data", (chunk: Buffer) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > maxBytes) { exceeded = true; chunks.length = 0; reject(new Error("request exceeds 64 MiB")); request.resume(); return; }
      chunks.push(chunk);
    });
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
  const host = options.host ?? LOOPBACK;
  const shared = !!options.publicOrigin || (host !== LOOPBACK && host !== 'localhost' && host !== '::1');
  if (shared && !options.publicOrigin) throw new Error('공유 호스트에는 --public-origin 이 필요합니다');
  let publicOrigin = options.publicOrigin ? new URL(options.publicOrigin).origin : null;
  if (publicOrigin && !/^https?:/.test(publicOrigin)) throw new Error('HTTP(S) origin required');
  const logins = new Map<string, { memberId: string; expiresAt: number }>();
  const clients = new Map<string, number>();
  const root = resolve(options.distDir);
  const projectDir = resolve(options.projectDir);
  const sessions = options.sessions ?? createProjectSessionRegistry();
  const SESSION_KEY = `host:${randomUUID()}`;
  await sessions.open(SESSION_KEY, projectDir);
  const handlers = createStoreHandlers(sessions);
  const team = sessions.require(SESSION_KEY).team;
  const ownerAccessCode = shared ? team.ownerToken() : null;
  // 동반 서비스도 실행별 토큰을 요구한다(설계 7.4) — 루프백·페이지 출처 모두 같은 머신의 다른
  // 프로세스에 열려 있다. 렌더러는 브리지 설정에서 토큰을 받아 fetch 헤더로 실어 보낸다.
  const companionToken = randomUUID();
  const companion = createCompanionMiddleware({ token: companionToken });
  // 활동 미러 2종도 같은 본체를 쓴다 — 예전에는 vite 플러그인에만 있어서 로컬 서버로 연
  // 브라우저 탭의 편집·AI 로그가 404 로 조용히 사라졌다(I3). 페이지와 같은 출처라 CORS 는 없다.
  const activityMirror = createActivityMirrorMiddleware({ baseDir: projectDir });
  const token = randomUUID();

  const dispatchBridge = async (payload: unknown, key: string): Promise<unknown> => {
    if (!payload || typeof payload !== "object") throw new Error("invalid request");
    const body = payload as { readonly channel?: unknown; readonly payload?: unknown };
    const channel = typeof body.channel === "string" ? body.channel : "";
    const handler = Object.hasOwn(handlers, channel) ? handlers[channel] : undefined;
    if (!handler) throw new Error(`${channel}: 알 수 없는 채널입니다`);

    // 로컬 서버는 폴더 하나에 묶인다.
    if (channel === OPRN_CHANNELS.projectOpen) {
      const opened = await handler(key, { projectDir });
      return shared ? { ...(opened as object), projectDir: 'host-project' } : opened;
    }

    if (channel === OPRN_CHANNELS.assetsPut) {
      const input = body.payload as { readonly bytes?: unknown };
      const bytes = typeof input?.bytes === "string" ? new Uint8Array(Buffer.from(input.bytes, "base64")) : input?.bytes;
      return await handler(key, { ...(body.payload as object), bytes });
    }

    const result = await handler(key, body.payload);
    if (channel === OPRN_CHANNELS.assetsRead && result instanceof Uint8Array) {
      return Buffer.from(result).toString("base64");
    }
    if (shared && channel === OPRN_CHANNELS.projectBackup) return `${basename(resolve(String(result), '..'))}/project.sqlite`;
    if (shared && channel === OPRN_CHANNELS.projectStatus && result && typeof result === 'object') {
      return { ...result, projectDir: 'host-project', url: 'host-project' };
    }
    return result;
  };

  const inject = (html: string): string => {
    const config = `<script>window.__OPRN_BRIDGE__=${JSON.stringify({ endpoint: BRIDGE_PATH, token, companionToken: shared ? null : companionToken })}</script>`;
    return html.replace('</head>', `${config}<script src="${BRIDGE_SCRIPT_PATH}"></script></head>`);
  };
  const serveStatic = async (pathname: string, response: ServerResponse): Promise<void> => {
    const relative = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\//, "");
    const target = resolve(root, normalize(relative));
    if (relative.split("/").some(part => part.startsWith(".")) || (target !== root && !target.startsWith(root + sep))) {
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
    const html = inject(bytes.toString("utf8"));
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(html);
  };

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${LOOPBACK}`);
      const expectedOrigin = publicOrigin ?? `http://${request.headers.host}`;
      // Reject DNS rebinding and cross-origin requests before any filesystem/AI handler.
      const allowedHost = publicOrigin ? new URL(publicOrigin).host : new URL(serverUrl).host;
      if (request.headers.host !== allowedHost || (request.headers.origin && request.headers.origin !== expectedOrigin)) {
        sendJson(response, 403, { error: 'origin' }); return;
      }
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('referrer-policy', 'same-origin');
      const cookie = /(?:^|; )oprn_session=([a-f0-9-]+)/.exec(request.headers.cookie ?? '')?.[1];
      const login = cookie ? logins.get(cookie) : undefined;
      const signedIn = login && login.expiresAt > Date.now() ? team.member(login.memberId) : null;
      if (url.pathname === '/__oprn/login' && request.method === 'POST') {
        const member = team.authenticate(new URLSearchParams(await readRequestBody(request, 4096)).get('token') ?? '');
        if (!member) { response.writeHead(401, { 'content-type': 'text/html; charset=utf-8' }).end(loginPage.replace('id="login-error" hidden', 'id="login-error"')); return; }
        if (logins.size >= 256) { sendJson(response, 429, { error: '접속 세션이 너무 많습니다' }); return; }
        const id = randomUUID();
        logins.set(id, { memberId: member.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
        response.writeHead(303, { location: '/', 'set-cookie': `oprn_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${publicOrigin?.startsWith('https:') ? '; Secure' : ''}`, 'cache-control': 'no-store' }).end(); return;
      }
      if (url.pathname === '/__oprn/logout' && request.method === 'POST') {
        if (cookie) logins.delete(cookie);
        response.writeHead(303, { location: '/', 'set-cookie': 'oprn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }).end(); return;
      }
      if (shared && !signedIn) {
        if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(loginPage);
        } else sendJson(response, 401, { error: '팀 접속 코드로 로그인하세요' });
        return;
      }
      if (url.pathname === '/__oprn/team' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(inject(teamPage)); return;
      }
      if (!shared) {
        let passedThrough = false;
        activityMirror(request, response, () => { passedThrough = true; });
        if (!passedThrough) return;
        passedThrough = false;
        await companion(request, response, () => { passedThrough = true; });
        if (!passedThrough) return;
      }
      if (request.method === "POST" && url.pathname === BRIDGE_PATH) {
        if (request.headers["x-oprn-bridge-token"] !== token) {
          sendJson(response, 403, { error: "token" });
          return;
        }
        try {
          const tab = request.headers['x-oprn-session'];
          if (tab !== undefined && (typeof tab !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(tab))) throw new Error('invalid tab id');
          const key = `${cookie ?? 'local'}:${tab ?? 'default'}`;
          if (!clients.has(key)) {
            if (clients.size >= 256) throw new Error('too many sessions');
            await sessions.open(key, projectDir);
          }
          clients.set(key, Date.now());
          sessions.setMember(key, (signedIn ?? team.owner()).id);
          sendJson(response, 200, await dispatchBridge(JSON.parse(await readRequestBody(request)), key));
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
        response.writeHead(200, { "content-type": asset.mime, "cache-control": "private, no-cache", "content-security-policy": "sandbox" });
        response.end(Buffer.from(bytes));
        return;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(url.pathname, response);
        return;
      }
      response.writeHead(405).end("method not allowed");
    })().catch(error => {
      if (!response.headersSent) sendJson(response, 500, { error: error instanceof Error ? error.message : 'request failed' });
      else response.end();
    });
  });

  let serverUrl = '';
  const cleanup = setInterval(() => {
    for (const [key, touched] of clients) if (Date.now() - touched > 5 * 60_000) { sessions.close(key); clients.delete(key); }
    for (const [id, session] of logins) if (session.expiresAt <= Date.now()) logins.delete(id);
  }, 60_000);
  cleanup.unref();
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, resolvePromise);
  }).catch(error => { clearInterval(cleanup); companion.dispose(); sessions.close(SESSION_KEY); throw error; });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : (options.port ?? 0);

  if (publicOrigin && new URL(publicOrigin).port === '0') {
    const address = new URL(publicOrigin); address.port = String(port); publicOrigin = address.origin;
  }
  serverUrl = publicOrigin ?? `http://${host === '::1' ? '[::1]' : host}:${port}`;
  return {
    url: serverUrl,
    ownerAccessCode,
    token,
    companionToken,
    projectDir,
    async close(): Promise<void> {
      clearInterval(cleanup);
      companion.dispose();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
      for (const key of clients.keys()) sessions.close(key);
      sessions.close(SESSION_KEY);
    },
  };
}
