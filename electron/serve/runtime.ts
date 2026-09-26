import { sharedContentMiddleware } from "../../scripts/lib/sharedContentSqlite";
import { SHARED_CONTENT_ENDPOINT, SHARED_CONTENT_PREVIEW_ENDPOINT } from "../../src/project/sharedContentSchema";
import { SHARED_REFERENCE_IMAGE_PREFIX } from "../../src/project/bundledReferenceImagePath";
import { readSharedTileReferences } from "../../scripts/lib/sharedTileReferencesSqlite";
import { SHARED_TILE_REFERENCES_ENDPOINT } from "../../src/project/sharedTileReferences";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile, rename, readdir } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, normalize, resolve, sep, basename } from "node:path";
import { createStoreHandlers } from "../main/dispatch";
import { createProjectSessionRegistry, type SessionRegistry } from "../main/sessions";
import { ASSET_RESPONSE_CSP, assetCacheControl, safeAssetContentType } from "../shared/assetMime";
import { OPRN_CHANNELS } from "../shared/channels";
import { isCompanionPath } from "../../scripts/lib/ohMyPiHttp.mjs";
import { createCompanionMiddleware } from "../../scripts/lib/companion/middleware.mjs";
import { createActivityMirrorMiddleware } from "../../scripts/lib/activityMirrorMiddleware.mjs";
import { isActivityMirrorPath } from "../../scripts/lib/activityMirror.mjs";
import { sharedCharacterGraphicsMiddleware } from "../../scripts/lib/sharedCharacterGraphics";
import { SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "../../src/project/sharedCharacterGraphicsSchema";

import { loginPage, teamPage } from "./teamPage";
import { sendHttpBody } from "./httpBody";
import { BridgeRequestBodyError, readBridgeRequestBody } from "./bridgeRequestBody";

const BRIDGE_PATH = "/__oprn/bridge";
const BRIDGE_SCRIPT_PATH = "/__oprn/bridge.js";
const ASSET_PATH_PREFIX = "/__oprn/asset/";
const LOOPBACK = "127.0.0.1";

/** Stamp the request title onto a canonical project seed without parsing the rest of the document. */
function projectSeedWithTitle(serialized: string, title: string): string {
  const match = /^\{"version":\d+,"meta":\{"title":"(?:\\.|[^"\\])*"/.exec(serialized);
  if (!match) throw new Error("invalid project seed");
  const prefix = match[0].slice(0, match[0].lastIndexOf('"title":') + '"title":'.length);
  return `${prefix}${JSON.stringify(title)}${serialized.slice(match[0].length)}`;
}

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
  ".mid": "audio/midi",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
};

export type LocalProjectServerOptions = {
  /** 기본 프로젝트. 추가 프로젝트는 이 폴더의 .oprn-projects 아래에 저장한다. */
  readonly projectDir: string;
  readonly sessions?: SessionRegistry;
  readonly distDir: string;
  /** 빌드된 브라우저 브리지 원문(electron/browser/bridge.ts 의 산출물). */
  readonly browserBridgeSource: string;
  readonly port?: number;
  /** Non-loopback hosting requires the exact externally visible origin (TLS at a reverse proxy is supported). */
  readonly host?: string;
  readonly publicOrigin?: string;
  /** Explicit host-owner access to the host AI credentials. Other members remain denied. */
  readonly enableOwnerAi?: boolean;
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
      if (size > maxBytes) { exceeded = true; chunks.length = 0; reject(new Error(`request exceeds ${maxBytes} bytes`)); request.resume(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): Promise<void> {
  const text = JSON.stringify(body);
  return sendHttpBody(response, status, text, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
}

function pageCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Inline host pages get one nonce. Injected script tags without it do not run. */
function sendHtml(response: ServerResponse, html: string, status = 200): void {
  const nonce = randomUUID().replaceAll("-", "");
  const stamped = html.replaceAll("<script>", `<script nonce="${nonce}">`);
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": pageCsp(nonce),
  });
  response.end(stamped);
}

export async function startLocalProjectServer(options: LocalProjectServerOptions): Promise<LocalProjectServer> {
  const host = options.host ?? LOOPBACK;
  const shared = !!options.publicOrigin || (host !== LOOPBACK && host !== 'localhost' && host !== '::1');
  if (shared && !options.publicOrigin) throw new Error('공유 호스트에는 --public-origin 이 필요합니다');
  let publicOrigin = options.publicOrigin ? new URL(options.publicOrigin).origin : null;
  if (publicOrigin && !/^https?:/.test(publicOrigin)) throw new Error('HTTP(S) origin required');
  const clients = new Map<string, number>();
  const root = resolve(options.distDir);
  const projectDir = resolve(options.projectDir);
  const sessions = options.sessions ?? createProjectSessionRegistry();
  const SESSION_KEY = `host:${randomUUID()}`;
  await sessions.open(SESSION_KEY, projectDir);
  const handlers = createStoreHandlers(sessions);
  const team = sessions.require(SESSION_KEY).team;
  const cookieName = `oprn_session_${createHash('sha256').update(sessions.require(SESSION_KEY).projectDir).digest('hex').slice(0, 24)}`;
  let ownerAccessCode: string | null = null;
  {
    const accessPath = resolve(projectDir, '.oprn-host-access');
    let existing: string | undefined;
    try { existing = (await readFile(accessPath, 'utf8')).trim(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    ownerAccessCode = team.ownerToken(existing);
    if (ownerAccessCode !== existing) {
      const pending = `${accessPath}.${randomUUID()}.tmp`;
      await writeFile(pending, ownerAccessCode + '\n', { mode: 0o600, flag: 'wx' });
      await rename(pending, accessPath);
    }
  }
  // 접속 코드는 팀 관리에서 켤 때만 요구한다. 0.0.0.0 바인드도 기동 때 켜지 않는다.
  // 동반 서비스도 실행별 토큰을 요구한다(설계 7.4) — 루프백·페이지 출처 모두 같은 머신의 다른
  // 프로세스에 열려 있다. 렌더러는 브리지 설정에서 토큰을 받아 fetch 헤더로 실어 보낸다.
  const companionToken = randomUUID();
  const companion = createCompanionMiddleware({ token: companionToken });
  // 활동 미러 2종도 같은 본체를 쓴다 — 예전에는 vite 플러그인에만 있어서 로컬 서버로 연
  // 브라우저 탭의 편집·AI 로그가 404 로 조용히 사라졌다(I3). 페이지와 같은 출처라 CORS 는 없다.
  const activityMirror = createActivityMirrorMiddleware({ baseDir: projectDir });
  const token = randomUUID();

  const projectsRoot = resolve(sessions.require(SESSION_KEY).projectDir, '.oprn-projects');
  const isProjectId = (id: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id);
  const projectPath = async (id: string): Promise<string> => {
    if (!id) return projectDir;
    if (!isProjectId(id)) throw new Error('invalid project id');
    const path = resolve(projectsRoot, id);
    if (await realpath(projectsRoot) !== projectsRoot || await realpath(path) !== path || !sessions.directoryExists(path)) {
      throw new Error('unknown project');
    }
    return path;
  };

  const dispatchBridge = async (payload: unknown, key: string): Promise<unknown> => {
    if (!payload || typeof payload !== "object") throw new Error("invalid request");
    const body = payload as { readonly channel?: unknown; readonly payload?: unknown };
    const channel = typeof body.channel === "string" ? body.channel : "";
    if (channel === OPRN_CHANNELS.startRecentProjects) {
      const entries = await readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
      return entries.filter((entry) => entry.isDirectory() && isProjectId(entry.name)).map((entry) => ({ projectDir: entry.name, title: entry.name }));
    }
    if (channel === OPRN_CHANNELS.startCreateProject) {
      if (sessions.member(key).role !== 'owner') throw new Error('새 프로젝트는 팀 소유자만 만들 수 있습니다.');
      const input = body.payload as { title?: unknown; seed?: unknown } | null;
      if (typeof input?.title !== 'string' || !input.title.trim() || input.title.length > 200 || typeof input.seed !== 'string') {
        throw new Error('프로젝트 이름과 시작 데이터가 필요합니다.');
      }
      const title = input.title.trim();
      const seedText = projectSeedWithTitle(input.seed, title);
      const id = randomUUID();
      await mkdir(projectsRoot, { recursive: true });
      if (await realpath(projectsRoot) !== projectsRoot) throw new Error('invalid projects directory');
      const dir = resolve(projectsRoot, id);
      await mkdir(dir);
      const temporaryKey = `create:${id}`;
      try {
        const created = await sessions.open(temporaryKey, dir, team);
        const saved = await created.store.saveSerialized(seedText, null);
        if (saved.kind !== 'saved' || created.store.info().title !== title) throw new Error('새 프로젝트 저장을 확인하지 못했습니다.');
        return { projectDir: id, projectId: created.store.projectId };
      } catch (error) {
        sessions.close(temporaryKey);
        await rm(dir, { recursive: true, force: true });
        throw error;
      } finally {
        sessions.close(temporaryKey);
      }
    }
    if (channel === OPRN_CHANNELS.startOpenFolder) {
      if (sessions.member(key).role !== 'owner') throw new Error('프로젝트 열기는 팀 소유자만 할 수 있습니다.');
      const input = body.payload as { bytes?: unknown } | null;
      if (typeof (input as { projectDir?: unknown } | null)?.projectDir === 'string') {
        const id = (input as { projectDir: string }).projectDir;
        const dir = await projectPath(id);
        const opened = await sessions.open(`open:${id}`, dir, team);
        return { projectDir: id, isNew: false, projectId: opened.store.projectId };
      }
      if (typeof input?.bytes !== 'string') throw new Error('project.sqlite 파일이 필요합니다.');
      const id = randomUUID();
      await mkdir(projectsRoot, { recursive: true });
      const dir = resolve(projectsRoot, id);
      await mkdir(dir);
      try {
        await writeFile(resolve(dir, 'project.sqlite'), Buffer.from(input.bytes, 'base64'), { flag: 'wx' });
        const opened = await sessions.open(`open:${id}`, dir, team);
        return { projectDir: id, isNew: false, projectId: opened.store.projectId };
      } catch (error) {
        sessions.close(`open:${id}`);
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
    }
    const handler = Object.hasOwn(handlers, channel) ? handlers[channel] : undefined;
    if (!handler) throw new Error(`${channel}: 알 수 없는 채널입니다`);

    // 클라이언트가 보낸 디스크 경로 대신 인증된 탭의 프로젝트를 연다.
    if (channel === OPRN_CHANNELS.projectOpen) {
      const opened = await handler(key, { projectDir: sessions.require(key).projectDir });
      return shared ? { ...(opened as object), projectDir: 'host-project' } : opened;
    }

    if (channel === OPRN_CHANNELS.assetsPut) {
      const input = body.payload as { readonly bytes?: unknown };
      const bytes = typeof input?.bytes === "string" ? new Uint8Array(Buffer.from(input.bytes, "base64")) : input?.bytes;
      return await handler(key, { ...(body.payload as object), bytes });
    }

    const result = await handler(key, body.payload);
    if (channel === OPRN_CHANNELS.teamStatus) return { ...(result as object), accessCodeRequired: team.accessCodeRequired() };
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
    const config = `<script>window.__OPRN_BRIDGE__=${JSON.stringify({ endpoint: BRIDGE_PATH, token, requestBodyEncoding: "gzip", companionToken: shared ? null : companionToken })}</script>`;
    return html.replace('</head>', `${config}<script src="${BRIDGE_SCRIPT_PATH}"></script></head>`);
  };
  const serveStatic = async (pathname: string, response: ServerResponse): Promise<void> => {
    // URL.pathname 은 퍼센트 인코딩 그대로다 — 번들 BGM 「Town 1.mid」는 `Town%201.mid` 로 와서
    // 디코드 없이는 디스크에서 못 찾고 404 가 났다(2026-09-23 도그푸딩). 검사는 디코드한 뒤에 한다.
    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { response.writeHead(400).end("bad path"); return; }
    if (decoded.includes("\0")) { response.writeHead(400).end("bad path"); return; }
    const relative = decoded === "/" || decoded === "" ? "index.html" : decoded.replace(/^\//, "");
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
      const fingerprinted = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2|png)$/.test(relative);
      await sendHttpBody(response, 200, bytes, {
        "content-type": contentType,
        "cache-control": fingerprinted ? "private, max-age=31536000, immutable" : "no-cache",
      });
      return;
    }
    sendHtml(response, inject(bytes.toString("utf8")));
  };

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${LOOPBACK}`);
      const requestedProject = url.searchParams.get('hostProject') ?? '';
      const returnUrl = /^[0-9a-f-]{36}$/.test(requestedProject) ? `/?hostProject=${requestedProject}` : '/';
      const entryLoginPage = loginPage.replace('action="/__oprn/login"', `action="/__oprn/login${returnUrl === '/' ? '' : returnUrl.slice(1)}"`);
      const expectedOrigin = publicOrigin ?? `http://${request.headers.host}`;
      // Reject DNS rebinding and cross-origin requests before any filesystem/AI handler.
      const allowedHost = publicOrigin ? new URL(publicOrigin).host : new URL(serverUrl).host;
      if (request.headers.host !== allowedHost || (request.headers.origin && request.headers.origin !== expectedOrigin)) {
        await sendJson(response, 403, { error: 'origin' }); return;
      }
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('referrer-policy', 'same-origin');
      const cookie = (request.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
      const signedIn = team.accessCodeRequired() ? (cookie ? team.sessionMember(cookie) : null) : team.owner();
      if (url.pathname === '/__oprn/login' && request.method === 'POST') {
        const member = team.authenticate(new URLSearchParams(await readRequestBody(request, 4096)).get('token') ?? '');
        if (!member) { sendHtml(response, entryLoginPage.replace('id="login-error" hidden', 'id="login-error"'), 401); return; }
        const id = team.createSession(member.id, Date.now() + 12 * 60 * 60 * 1000);
        if (!id) { await sendJson(response, 429, { error: '접속 세션이 너무 많습니다' }); return; }
        response.writeHead(303, { location: returnUrl, 'set-cookie': `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${publicOrigin?.startsWith('https:') ? '; Secure' : ''}`, 'cache-control': 'no-store' }).end(); return;
      }
      if (url.pathname === '/__oprn/logout' && request.method === 'POST') {
        if (cookie) team.deleteSession(cookie);
        response.writeHead(303, { location: '/', 'set-cookie': `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` }).end(); return;
      }
      if (!signedIn) {
        if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
          sendHtml(response, entryLoginPage);
        } else await sendJson(response, 401, { error: '팀 접속 코드로 로그인하세요' });
        return;
      }
      if (url.pathname === '/__oprn/team' && request.method === 'GET') {
        sendHtml(response, inject(teamPage.replaceAll('href="/"', `href="${returnUrl}"`))); return;
      }
      if (url.pathname === SHARED_CONTENT_ENDPOINT || url.pathname === SHARED_CONTENT_PREVIEW_ENDPOINT || url.pathname.startsWith(SHARED_REFERENCE_IMAGE_PREFIX)) { sharedContentMiddleware(request, response, () => {}); return; }
      if (url.pathname === SHARED_TILE_REFERENCES_ENDPOINT) {
        if (request.method !== 'GET') { await sendJson(response, 405, { error: 'Read only' }); return; }
        response.setHeader('cache-control', 'no-store');
        await sendJson(response, 200, readSharedTileReferences()); return;
      }
      if (url.pathname === SHARED_CHARACTER_GRAPHICS_ENDPOINT) {
        if (request.method !== 'GET' && signedIn?.role !== 'owner') {
          await sendJson(response, 403, { error: '호스트 공용 자료는 팀 소유자만 수정할 수 있습니다.' }); return;
        }
        sharedCharacterGraphicsMiddleware(request, response, () => {});
        return;
      }
      // 활동 미러(조수·편집 로그)는 호스트 디스크(projectDir/output/)에 쓴다. 공유 호스트에서도
      // 소유자는 이 로그로 조수를 진단하므로 붙이되, 팀원은 호스트 디스크에 쓰거나 남의 로그를
      // 읽지 못하게 403 으로 막는다. 예전엔 공유 모드에서 통째로 빠져 405 로 떨어졌고, 클라이언트는
      // 첫 실패에 미러를 끄므로 소유자 로그까지 조용히 0줄이 됐다(2026-09-23 도그푸딩).
      if (isActivityMirrorPath(url.pathname)) {
        if ((shared || team.accessCodeRequired()) && signedIn?.role !== 'owner') {
          await sendJson(response, 403, { error: '활동 로그는 팀 소유자만 호스트에 남길 수 있습니다.' }); return;
        }
        let passedThrough = false;
        activityMirror(request, response, () => { passedThrough = true; });
        if (!passedThrough) return;
      }
      if (isCompanionPath(request.url ?? '')) {
        if (shared || team.accessCodeRequired()) {
          if (signedIn?.role !== 'owner') { await sendJson(response, 403, { error: '호스트 AI는 팀 소유자만 사용할 수 있습니다.' }); return; }
          if (shared && !options.enableOwnerAi) { await sendJson(response, 503, { error: '호스트 AI 연결이 꺼져 있습니다. OPRN_HOST_OWNER_AI=1로 활성화하세요.' }); return; }
          // Authenticated owner + same-origin validation replaces the browser token here.
          request.headers['x-oprn-companion-token'] = companionToken;
        }
        let passedThrough = false;
        await companion(request, response, () => { passedThrough = true; });
        if (!passedThrough) return;
      }
      if (request.method === "POST" && url.pathname === BRIDGE_PATH) {
        if (request.headers["x-oprn-bridge-token"] !== token) {
          await sendJson(response, 403, { error: "token" });
          return;
        }
        try {
          const tab = request.headers['x-oprn-session'];
          if (tab !== undefined && (typeof tab !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(tab))) throw new Error('invalid tab id');
          const project = request.headers['x-oprn-project'] ?? '';
          if (typeof project !== 'string') throw new Error('invalid project id');
          const body = await readBridgeRequestBody(request);
          const selectedDir = await projectPath(project);
          const key = `${cookie ?? 'local'}:${tab ?? 'default'}:${project}`;
          if (!clients.has(key)) {
            if (clients.size >= 256) throw new Error('too many sessions');
            await sessions.open(key, selectedDir, team);
          }
          clients.set(key, Date.now());
          sessions.setMember(key, (signedIn ?? team.owner()).id);
          if (body?.channel === 'oprn:host.access') {
            if (sessions.member(key).role !== 'owner') { await sendJson(response, 403, { error: '접속 설정은 소유자만 변경할 수 있습니다.' }); return; }
            const required = (body.payload as { required?: unknown } | null)?.required;
            if (typeof required !== 'boolean') throw new Error('invalid access setting');
            // Establish the current owner's login before enabling the gate.
            if (required) {
              const id = team.createSession(team.owner().id, Date.now() + 12 * 60 * 60 * 1000);
              if (!id) throw new Error('접속 세션이 너무 많습니다');
              response.setHeader('set-cookie', `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${publicOrigin?.startsWith('https:') ? '; Secure' : ''}`);
            }
            team.setAccessCodeRequired(required);
            await sendJson(response, 200, { accessCodeRequired: required, ownerAccessCode: required ? ownerAccessCode : null });
          } else await sendJson(response, 200, await dispatchBridge(body, key));
        } catch (error) {
          await sendJson(response, error instanceof BridgeRequestBodyError ? error.statusCode : 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }
      if (request.method === "GET" && url.pathname === BRIDGE_SCRIPT_PATH) {
        response.writeHead(200, { "content-type": MIME_BY_EXTENSION[".js"] ?? "text/javascript", "cache-control": "no-store" });
        response.end(options.browserBridgeSource);
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith(ASSET_PATH_PREFIX)) {
        const parts = url.pathname.slice(ASSET_PATH_PREFIX.length).split('/');
        const project = parts.length === 2 ? parts[0]! : '';
        const sha256 = parts.at(-1);
        const assetKey = `asset:${randomUUID()}`;
        const assetSession = await sessions.open(assetKey, await projectPath(project), team);
        try {
          const asset = assetSession.store.listAssets().find((row) => row.sha256 === sha256);
          if (!asset) {
            response.writeHead(404).end("unknown asset");
            return;
          }
          const bytes = await assetSession.store.assetBytes(asset.sha256);
          // SHA-256 paths of allowlisted types are immutable. Opaque MIME stays uncached.
          response.writeHead(200, {
            "content-type": safeAssetContentType(asset.mime),
            "cache-control": assetCacheControl(asset.mime),
            "content-security-policy": ASSET_RESPONSE_CSP,
            "x-content-type-options": "nosniff",
          });
          response.end(Buffer.from(bytes));
        } finally { sessions.close(assetKey); }
        return;
      }
      if (request.method === "GET" || request.method === "HEAD") {
        await serveStatic(url.pathname, response);
        return;
      }
      response.writeHead(405).end("method not allowed");
    })().catch(error => {
      if (!response.headersSent) void sendJson(response, 500, { error: error instanceof Error ? error.message : 'request failed' });
      else response.end();
    });
  });

  let serverUrl = '';
  const cleanup = setInterval(() => {
    for (const [key, touched] of clients) if (Date.now() - touched > 5 * 60_000) { sessions.close(key); clients.delete(key); }
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
