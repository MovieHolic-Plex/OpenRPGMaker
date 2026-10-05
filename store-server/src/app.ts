import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { isSha256, STORE_LIMITS, type StoreItemStatus } from "../../src/assetStore/format";
import { sniffMime } from "../../src/assetStore/sniff";
import {
  authenticate, createSession, decideDeviceCode, destroySession, findDeviceCode, googleUser, pollDeviceCode,
  requireAdmin, requireWriter, revokeToken, sessionCookie, startDeviceCode, upsertUser, type Auth,
} from "./auth";
import { BlobStore } from "./blobStore";
import type { StoreConfig } from "./config";
import type { Db } from "./db";
import { HttpError, parseCookies, RateLimiter, readBody, readForm, readJson, redirect, Router, sendBytes, sendHtml, sendJson, type Ctx } from "./http";
import {
  addVersion, adminQueue, adminSetStatus, authorVisibility, blobServable, createItem, itemDetail, listCatalog, myItems,
  recordDownload, reportItem, singleManifest, versionManifest, type SingleInput,
} from "./items";
import * as pages from "./web/pages";

export interface App { server: Server; close(): Promise<void> }

const STATIC_TYPES: Record<string, string> = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

export function createApp(config: StoreConfig, db: Db, publicDir: string): App {
  const blobs = new BlobStore(config.blobDir);
  const router = new Router();
  const limits = {
    // 큰 팩은 blob 이 수백 개다(버들항 96개). 사용자마다 센다 — 로그인 없이는 올릴 수 없다.
    blob: new RateLimiter(1500, 60_000),
    create: new RateLimiter(20, 60_000),
    report: new RateLimiter(20, 60_000),
    login: new RateLimiter(30, 60_000),
    device: new RateLimiter(60, 60_000),
  };
  const limit = (limiter: RateLimiter, ctx: Ctx): void => {
    if (!limiter.take(ctx.ip)) throw new HttpError(429, "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요.", "rate_limited");
  };
  const clientKey = (ctx: Ctx, auth: Auth | null): string => auth ? `u:${auth.user.id}` : `ip:${createHash("sha256").update(`oprn-store:${ctx.ip}`).digest("hex").slice(0, 32)}`;
  const viewer = async (ctx: Ctx): Promise<Auth | null> => {
    try { return await authenticate(db, ctx); } catch (error) { if (error instanceof HttpError && error.status === 401) return null; throw error; }
  };
  const page = async (ctx: Ctx, body: (auth: Auth | null) => string | Promise<string>, status = 200): Promise<void> => {
    const auth = await viewer(ctx);
    sendHtml(ctx.res, status, await body(auth));
  };
  const loginRedirect = (ctx: Ctx): void => redirect(ctx.res, `/login?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}`);
  const safeNext = (value: string | null): string => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/");

  // ── JSON API (/api/v1) ─────────────────────────────────────────────
  router.get("/healthz", (ctx) => sendJson(ctx.res, 200, { ok: true }));
  router.get("/api/v1/items", async (ctx) => {
    const q = ctx.url.searchParams;
    sendJson(ctx.res, 200, await listCatalog(db, { q: q.get("q") ?? "", kind: q.get("kind") ?? "", grade: q.get("grade") ?? "", sort: q.get("sort") ?? "", page: Number(q.get("page") ?? 1) }));
  });
  router.get("/api/v1/items/:slug", async (ctx) => {
    const auth = await viewer(ctx);
    const { authorId: _authorId, ...detail } = await itemDetail(db, ctx.params.slug!, auth?.user ?? null);
    sendJson(ctx.res, 200, detail);
  });
  router.get("/api/v1/items/:slug/versions/:version/manifest", async (ctx) => {
    const auth = await viewer(ctx);
    const manifest = await versionManifest(db, ctx.params.slug!, Number(ctx.params.version), auth?.user ?? null);
    sendJson(ctx.res, 200, manifest, { "cache-control": "private, max-age=60" });
  });
  router.post("/api/v1/items/:slug/downloads", async (ctx) => {
    const auth = await viewer(ctx);
    await recordDownload(db, ctx.params.slug!, clientKey(ctx, auth));
    sendJson(ctx.res, 200, { ok: true });
  });
  router.get("/api/v1/blobs/:sha", async (ctx) => {
    const sha = ctx.params.sha!;
    if (!isSha256(sha)) throw new HttpError(400, "주소가 올바르지 않습니다.", "bad_sha");
    const servable = await blobServable(db, sha);
    if (!servable || !blobs.has(sha)) throw new HttpError(404, "파일을 찾지 못했습니다.", "not_found");
    // 내용 주소라 바뀌지 않는다. 다만 상품이 내려가면 더 주지 않으므로 공유 캐시 기간은 짧게 둔다.
    sendBytes(ctx.res, blobs.read(sha), servable.mime, { "cache-control": "public, max-age=3600", etag: `"${sha}"` });
  });
  router.post("/api/v1/blobs/check", async (ctx) => {
    await requireWriter(db, ctx);
    const body = await readJson<{ sha256s?: unknown }>(ctx.req, 256 * 1024);
    const list = Array.isArray(body.sha256s) ? body.sha256s.filter(isSha256).slice(0, STORE_LIMITS.blobs) : [];
    const { rows } = await db.query("select sha256 from store_blobs where sha256 = any($1::text[])", [list]);
    const known = new Set(rows.map((r) => String(r.sha256)).filter((sha) => blobs.has(sha)));
    sendJson(ctx.res, 200, { missing: list.filter((sha) => !known.has(sha)) });
  });
  router.post("/api/v1/blobs", async (ctx) => {
    const auth = await requireWriter(db, ctx);
    if (!limits.blob.take(`u:${auth.user.id}`)) throw new HttpError(429, "요청이 너무 많습니다. 잠시 뒤에 다시 시도해 주세요.", "rate_limited");
    const sha = String(ctx.req.headers["x-sha256"] ?? "");
    if (!isSha256(sha)) throw new HttpError(400, "x-sha256 헤더가 필요합니다.", "bad_sha");
    const bytes = new Uint8Array(await readBody(ctx.req, STORE_LIMITS.blobBytes));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== sha) throw new HttpError(400, "파일 해시가 맞지 않습니다. 전송 중에 깨졌을 수 있습니다.", "sha_mismatch");
    const mime = sniffMime(bytes);
    if (!mime) throw new HttpError(415, "받지 않는 파일 형식입니다. PNG·JPEG·WebP·OGG·MP3·WAV·M4A 만 받습니다.", "unsupported_media_type");
    blobs.put(sha, bytes);
    await db.query("insert into store_blobs (sha256, mime, bytes, uploaded_by) values ($1, $2, $3, $4) on conflict (sha256) do nothing", [sha, mime, bytes.byteLength, auth.user.id]);
    sendJson(ctx.res, 200, { sha256: sha, mime, bytes: bytes.byteLength });
  });
  router.post("/api/v1/items", async (ctx) => {
    limit(limits.create, ctx);
    const auth = await requireWriter(db, ctx);
    const body = await readJson<{ manifest?: unknown }>(ctx.req, STORE_LIMITS.manifestBytes + 4096);
    sendJson(ctx.res, 201, await createItem(db, config, blobs, auth.user, body.manifest));
  });
  router.post("/api/v1/single", async (ctx) => {
    limit(limits.create, ctx);
    const auth = await requireWriter(db, ctx);
    const body = await readJson<Partial<SingleInput>>(ctx.req, 64 * 1024);
    const input: SingleInput = {
      blob: String(body.blob ?? ""), title: String(body.title ?? ""), summary: String(body.summary ?? ""), description: String(body.description ?? ""),
      kind: String(body.kind ?? ""), license: String(body.license ?? ""), aiGenerated: body.aiGenerated === true, credits: String(body.credits ?? ""),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [], tileSize: Number(body.tileSize ?? 0), fileName: String(body.fileName ?? ""),
    };
    if (typeof body.aiGenerated !== "boolean") throw new HttpError(400, "AI 생성 여부를 골라 주세요.", "ai_required");
    if (!isSha256(input.blob)) throw new HttpError(400, "파일을 먼저 올려야 합니다.", "missing_blob");
    sendJson(ctx.res, 201, await createItem(db, config, blobs, auth.user, await singleManifest(db, blobs, input)));
  });
  router.post("/api/v1/items/:slug/versions", async (ctx) => {
    limit(limits.create, ctx);
    const auth = await requireWriter(db, ctx);
    const body = await readJson<{ manifest?: unknown }>(ctx.req, STORE_LIMITS.manifestBytes + 4096);
    sendJson(ctx.res, 201, await addVersion(db, blobs, auth, ctx.params.slug!, body.manifest));
  });
  router.post("/api/v1/items/:slug/visibility", async (ctx) => {
    const auth = await requireWriter(db, ctx);
    const body = await readJson<{ hidden?: unknown }>(ctx.req, 4096);
    sendJson(ctx.res, 200, { status: await authorVisibility(db, auth, ctx.params.slug!, body.hidden === true) });
  });
  router.post("/api/v1/items/:slug/reports", async (ctx) => {
    limit(limits.report, ctx);
    const auth = await viewer(ctx);
    const body = await readJson<{ reason?: unknown; detail?: unknown }>(ctx.req, 16 * 1024);
    sendJson(ctx.res, 200, await reportItem(db, config, ctx.params.slug!, clientKey(ctx, auth), String(body.reason ?? ""), String(body.detail ?? "")));
  });
  router.get("/api/v1/me", async (ctx) => {
    const auth = await authenticate(db, ctx);
    if (!auth) throw new HttpError(401, "로그인이 필요합니다.", "login_required");
    sendJson(ctx.res, 200, { user: auth.user, items: await myItems(db, auth.user) });
  });
  router.post("/api/v1/logout", async (ctx) => {
    await revokeToken(db, ctx);
    sendJson(ctx.res, 200, { ok: true });
  });
  router.post("/api/v1/device/code", async (ctx) => {
    limit(limits.device, ctx);
    const body = await readJson<{ client?: unknown }>(ctx.req, 4096);
    sendJson(ctx.res, 200, await startDeviceCode(db, config, String(body.client ?? "OPRN 에디터")));
  });
  router.post("/api/v1/device/token", async (ctx) => {
    limit(limits.device, ctx);
    const body = await readJson<{ device_code?: unknown }>(ctx.req, 4096);
    const result = await pollDeviceCode(db, String(body.device_code ?? ""));
    if (result.status === "approved") sendJson(ctx.res, 200, { access_token: result.token, user: result.user });
    else sendJson(ctx.res, result.status === "pending" ? 428 : 400, { error: result.status === "pending" ? "authorization_pending" : result.status === "denied" ? "access_denied" : "expired_token" });
  });
  router.get("/api/v1/admin/queue", async (ctx) => {
    const auth = await authenticate(db, ctx);
    if (!auth) throw new HttpError(401, "로그인이 필요합니다.", "login_required");
    requireAdmin(auth);
    sendJson(ctx.res, 200, await adminQueue(db));
  });
  router.post("/api/v1/admin/items/:slug/status", async (ctx) => {
    const auth = await requireWriter(db, ctx);
    requireAdmin(auth);
    const body = await readJson<{ status?: unknown; note?: unknown }>(ctx.req, 16 * 1024);
    await adminSetStatus(db, auth, ctx.params.slug!, String(body.status ?? "") as StoreItemStatus, String(body.note ?? ""));
    sendJson(ctx.res, 200, { ok: true });
  });

  // ── 웹 화면 ─────────────────────────────────────────────────────────
  router.get("/", (ctx) => page(ctx, async (auth) => {
    const q = ctx.url.searchParams;
    const query = { q: q.get("q") ?? "", kind: q.get("kind") ?? "", grade: q.get("grade") ?? "", sort: q.get("sort") ?? "", page: Number(q.get("page") ?? 1) };
    return pages.home(config, auth, query, await listCatalog(db, query));
  }));
  router.get("/items/:slug", (ctx) => page(ctx, async (auth) => {
    const detail = await itemDetail(db, ctx.params.slug!, auth?.user ?? null);
    return pages.item(config, auth, detail, ctx.url.searchParams.get("reported") === "1");
  }));
  router.post("/items/:slug/report", async (ctx) => {
    limit(limits.report, ctx);
    const form = await readForm(ctx.req);
    if (!pages.checkFormToken(config, `report:${ctx.params.slug}`, form.get("token") ?? "")) throw new HttpError(403, "신고 양식이 만료되었습니다. 페이지를 새로고침해 주세요.", "form_token");
    const auth = await viewer(ctx);
    await reportItem(db, config, ctx.params.slug!, clientKey(ctx, auth), form.get("reason") ?? "", form.get("detail") ?? "");
    redirect(ctx.res, `/items/${encodeURIComponent(ctx.params.slug!)}?reported=1`);
  });
  router.post("/items/:slug/visibility", async (ctx) => {
    const form = await readForm(ctx.req);
    const auth = await requireWriter(db, ctx, form.get("csrf"));
    await authorVisibility(db, auth, ctx.params.slug!, form.get("hidden") === "1");
    redirect(ctx.res, "/me");
  });
  router.get("/upload", async (ctx) => {
    const auth = await viewer(ctx);
    if (!auth) return loginRedirect(ctx);
    sendHtml(ctx.res, 200, pages.upload(config, auth));
  });
  router.get("/me", async (ctx) => {
    const auth = await viewer(ctx);
    if (!auth) return loginRedirect(ctx);
    sendHtml(ctx.res, 200, pages.me(config, auth, await myItems(db, auth.user)));
  });
  router.get("/admin", async (ctx) => {
    const auth = await viewer(ctx);
    if (!auth) return loginRedirect(ctx);
    requireAdmin(auth);
    sendHtml(ctx.res, 200, pages.admin(config, auth, await adminQueue(db)));
  });
  router.post("/admin/items/:slug/status", async (ctx) => {
    const form = await readForm(ctx.req);
    const auth = await requireWriter(db, ctx, form.get("csrf"));
    requireAdmin(auth);
    await adminSetStatus(db, auth, ctx.params.slug!, (form.get("status") ?? "") as StoreItemStatus, form.get("note") ?? "");
    redirect(ctx.res, "/admin");
  });
  router.get("/login", (ctx) => page(ctx, (auth) => pages.login(config, auth, safeNext(ctx.url.searchParams.get("next")))));
  router.post("/auth/dev", async (ctx) => {
    if (!config.devLogin) throw new HttpError(404, "없는 주소입니다.", "not_found");
    limit(limits.login, ctx);
    const form = await readForm(ctx.req);
    const user = await upsertUser(db, config, { email: form.get("email") ?? "", displayName: form.get("name") ?? "" });
    const session = await createSession(db, user.id);
    redirect(ctx.res, safeNext(form.get("next")), { "set-cookie": sessionCookie(config, session.token) });
  });
  router.get("/auth/google", (ctx) => {
    const google = config.google;
    if (!google) throw new HttpError(404, "Google 로그인이 설정되지 않았습니다.", "google_disabled");
    const state = randomBytes(16).toString("base64url");
    const next = safeNext(ctx.url.searchParams.get("next"));
    const url = new URL(google.authUrl);
    url.search = new URLSearchParams({ client_id: google.clientId, redirect_uri: `${config.publicUrl}/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }).toString();
    const secure = config.publicUrl.startsWith("https://") ? "; Secure" : "";
    redirect(ctx.res, url.toString(), { "set-cookie": `oprn_store_oauth=${state}.${encodeURIComponent(next)}; Path=/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}` });
  });
  router.get("/auth/google/callback", async (ctx) => {
    limit(limits.login, ctx);
    const [state, nextRaw] = (ctx.cookies.oprn_store_oauth ?? "").split(".");
    const code = ctx.url.searchParams.get("code");
    if (!state || state !== ctx.url.searchParams.get("state") || !code) throw new HttpError(400, "로그인 요청이 만료되었습니다. 다시 시도해 주세요.", "oauth_state");
    const info = await googleUser(config, code);
    const user = await upsertUser(db, config, { email: info.email, displayName: info.name, googleSub: info.sub });
    const session = await createSession(db, user.id);
    redirect(ctx.res, safeNext(decodeURIComponent(nextRaw ?? "/")), { "set-cookie": [sessionCookie(config, session.token), "oprn_store_oauth=; Path=/auth/google; Max-Age=0"] });
  });
  router.post("/logout", async (ctx) => {
    const form = await readForm(ctx.req);
    await requireWriter(db, ctx, form.get("csrf"));
    await destroySession(db, ctx);
    redirect(ctx.res, "/", { "set-cookie": sessionCookie(config, null) });
  });
  router.get("/device", async (ctx) => {
    const auth = await viewer(ctx);
    if (!auth) return loginRedirect(ctx);
    const code = (ctx.url.searchParams.get("code") ?? "").toUpperCase();
    sendHtml(ctx.res, 200, pages.device(config, auth, code, code ? await findDeviceCode(db, code) : null, ctx.url.searchParams.get("done")));
  });
  router.post("/device", async (ctx) => {
    const form = await readForm(ctx.req);
    const auth = await requireWriter(db, ctx, form.get("csrf"));
    const code = (form.get("code") ?? "").toUpperCase();
    const ok = await decideDeviceCode(db, code, auth.user.id, form.get("decision") === "approve");
    redirect(ctx.res, `/device?code=${encodeURIComponent(code)}&done=${ok ? form.get("decision") === "approve" ? "approved" : "denied" : "expired"}`);
  });
  router.get("/terms", (ctx) => page(ctx, (auth) => pages.terms(config, auth)));
  router.get("/copyright", (ctx) => page(ctx, (auth) => pages.copyright(config, auth)));
  router.get("/privacy", (ctx) => page(ctx, (auth) => pages.privacy(config, auth)));
  router.get("/static/:file", (ctx) => {
    const file = ctx.params.file!;
    const ext = file.slice(file.lastIndexOf("."));
    if (!/^[a-z0-9-]+\.[a-z]+$/.test(file) || !STATIC_TYPES[ext]) throw new HttpError(404, "없는 파일입니다.", "not_found");
    let bytes: Buffer;
    try { bytes = readFileSync(join(publicDir, file)); } catch { throw new HttpError(404, "없는 파일입니다.", "not_found"); }
    sendBytes(ctx.res, bytes, STATIC_TYPES[ext]!, { "cache-control": "public, max-age=300", "content-security-policy": "default-src 'none'" });
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", config.publicUrl);
    const forwarded = config.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]!.trim() : "";
    const ip = forwarded || req.socket.remoteAddress || "unknown";
    const found = router.match(req.method ?? "GET", url.pathname);
    const ctx: Ctx = { req, res, url, params: found && found !== "method" ? found.params : {}, cookies: parseCookies(req.headers.cookie), ip };
    const isApi = url.pathname.startsWith("/api/");
    const fail = (error: unknown): void => {
      if (res.headersSent) { res.destroy(); return; }
      const http = error instanceof HttpError ? error : null;
      if (!http) console.error("[store] unhandled", error);
      const status = http?.status ?? 500;
      const message = http?.message ?? "서버 오류가 났습니다.";
      if (isApi || req.headers.accept?.includes("application/json")) sendJson(res, status, { error: http?.code ?? "server_error", message, ...(http?.details ? { details: http.details } : {}) });
      else if (status === 401) redirect(res, `/login?next=${encodeURIComponent(url.pathname)}`);
      else sendHtml(res, status, pages.errorPage(config, status, message));
    };
    if (!found) return fail(new HttpError(404, "없는 주소입니다.", "not_found"));
    if (found === "method") return fail(new HttpError(405, "허용하지 않는 요청입니다.", "method_not_allowed"));
    Promise.resolve().then(() => found.handler(ctx)).catch(fail);
  });
  server.requestTimeout = 120_000;
  return {
    server,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

