import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code = "error", readonly details?: unknown) {
    super(message);
  }
}

export interface Ctx {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly cookies: Readonly<Record<string, string>>;
  readonly ip: string;
}

type Handler = (ctx: Ctx) => Promise<void> | void;
interface Route { method: string; parts: string[]; handler: Handler }

export class Router {
  private readonly routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, parts: path.split("/").filter(Boolean), handler });
    return this;
  }
  get(path: string, handler: Handler): this { return this.on("GET", path, handler); }
  post(path: string, handler: Handler): this { return this.on("POST", path, handler); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | "method" | null {
    const parts = pathname.split("/").filter(Boolean);
    let methodMismatch = false;
    for (const route of this.routes) {
      if (route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let index = 0; index < parts.length; index += 1) {
        const want = route.parts[index]!;
        let got: string;
        try { got = decodeURIComponent(parts[index]!); } catch { ok = false; break; }
        if (want.startsWith(":")) params[want.slice(1)] = got;
        else if (want !== got) { ok = false; break; }
      }
      if (!ok) continue;
      if (route.method !== method && !(route.method === "GET" && method === "HEAD")) { methodMismatch = true; continue; }
      return { handler: route.handler, params };
    }
    return methodMismatch ? "method" : null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    try { out[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* 깨진 쿠키는 무시 */ }
  }
  return out;
}

export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] ?? NaN);
  if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, "본문이 너무 큽니다.", "too_large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, "본문이 너무 큽니다.", "too_large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson<T = unknown>(req: IncomingMessage, limit = 10 * 1024 * 1024): Promise<T> {
  const type = req.headers["content-type"] ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "JSON 본문이 필요합니다.", "unsupported_media_type");
  const body = await readBody(req, limit);
  try { return JSON.parse(body.toString("utf8")) as T; } catch { throw new HttpError(400, "JSON 을 읽지 못했습니다.", "bad_json"); }
}

export async function readForm(req: IncomingMessage, limit = 64 * 1024): Promise<URLSearchParams> {
  const type = req.headers["content-type"] ?? "";
  if (!type.includes("application/x-www-form-urlencoded")) throw new HttpError(415, "양식 본문이 필요합니다.", "unsupported_media_type");
  return new URLSearchParams((await readBody(req, limit)).toString("utf8"));
}

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
};
/** 파일을 R2 에서 내보내면 그림·소리가 그 주소로 돌려보내진다 — img·media 에 그 출처를 더한다. */
let fileOrigin = "";
export function setFileOrigin(origin: string): void { fileOrigin = origin ? ` ${origin}` : ""; }
const pageCsp = () => `default-src 'self'; img-src 'self' data:${fileOrigin}; media-src 'self'${fileOrigin}; script-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;

export function sendJson(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(value);
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(body);
}

export function sendHtml(res: ServerResponse, status: number, html: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8", "content-security-policy": pageCsp(), "cache-control": "no-store", ...headers });
  res.end(html);
}

export function redirect(res: ServerResponse, location: string, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(303, { ...SECURITY_HEADERS, location, ...headers });
  res.end();
}

export function sendBytes(res: ServerResponse, bytes: Buffer, mime: string, headers: Record<string, string> = {}): void {
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": mime,
    "content-length": String(bytes.length),
    "content-security-policy": "default-src 'none'; sandbox",
    ...headers,
  });
  res.end(bytes);
}

/** HTML 이스케이프. 화면에 들어가는 모든 사용자 문자열이 이것을 지난다. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** 단일 인스턴스용 고정 창 속도 제한. 소유권 판단이 아니라 남용 완화다. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; reset: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  /** cost 만큼 쓴다(요청 수면 1, 바이트 예산이면 바이트 수). */
  take(key: string, cost = 1): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      if (this.hits.size > 50_000) this.hits.clear();
      this.hits.set(key, { count: cost, reset: now + this.windowMs });
      return cost <= this.limit;
    }
    entry.count += cost;
    return entry.count <= this.limit;
  }
}
