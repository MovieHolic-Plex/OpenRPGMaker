import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { StoreConfig } from "./config";
import type { Db } from "./db";
import { HttpError, type Ctx } from "./http";

export interface User { id: number; email: string; displayName: string; role: "user" | "admin"; blocked: boolean }
export interface Auth { user: User; via: "session" | "token"; csrf: string | null }

export const SESSION_COOKIE = "oprn_store_session";
const SESSION_DAYS = 30;
const DEVICE_MINUTES = 10;
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const newToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

function rowUser(row: Record<string, unknown>): User {
  return { id: Number(row.id), email: String(row.email), displayName: String(row.display_name), role: row.role === "admin" ? "admin" : "user", blocked: Boolean(row.blocked) };
}

export async function upsertUser(db: Db, config: StoreConfig, input: { email: string; displayName: string; googleSub?: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "이메일 형식이 올바르지 않습니다.", "bad_email");
  const name = input.displayName.trim().slice(0, 40) || email.split("@")[0]!;
  const role = config.adminEmails.has(email) ? "admin" : "user";
  const { rows } = await db.query(
    `insert into store_users (email, display_name, google_sub, role) values ($1, $2, $3, $4)
     on conflict (email) do update set
       google_sub = coalesce(store_users.google_sub, excluded.google_sub),
       role = case when excluded.role = 'admin' then 'admin' else store_users.role end
     returning *`,
    [email, name, input.googleSub ?? null, role],
  );
  return rowUser(rows[0]);
}

export async function createSession(db: Db, userId: number): Promise<{ token: string; csrf: string }> {
  const token = newToken();
  const csrf = newToken(18);
  await db.query(
    "insert into store_sessions (token_hash, user_id, csrf, expires_at) values ($1, $2, $3, now() + make_interval(days => $4))",
    [hashToken(token), userId, csrf, SESSION_DAYS],
  );
  return { token, csrf };
}

export function sessionCookie(config: StoreConfig, token: string | null): string {
  const secure = config.publicUrl.startsWith("https://") ? "; Secure" : "";
  return token === null
    ? `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
    : `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export async function destroySession(db: Db, ctx: Ctx): Promise<void> {
  const token = ctx.cookies[SESSION_COOKIE];
  if (token) await db.query("delete from store_sessions where token_hash = $1", [hashToken(token)]);
}

/** 세션 쿠키 또는 Bearer 토큰(앱)으로 사용자를 찾는다. 차단된 계정은 로그인되지 않은 것으로 본다. */
export async function authenticate(db: Db, ctx: Ctx): Promise<Auth | null> {
  const header = ctx.req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) {
    const { rows } = await db.query(
      `update store_tokens t set last_used_at = now() from store_users u
       where t.token_hash = $1 and t.revoked_at is null and u.id = t.user_id returning u.*`,
      [hashToken(header.slice(7).trim())],
    );
    if (rows.length === 0) throw new HttpError(401, "로그인이 만료되었습니다. 다시 로그인해 주세요.", "invalid_token");
    const user = rowUser(rows[0]);
    return user.blocked ? null : { user, via: "token", csrf: null };
  }
  const token = ctx.cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await db.query(
    `select u.*, s.csrf from store_sessions s join store_users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  if (rows.length === 0) return null;
  const user = rowUser(rows[0]);
  return user.blocked ? null : { user, via: "session", csrf: String(rows[0].csrf) };
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * 쓰기 요청의 사용자. 세션(브라우저)으로 온 요청은 CSRF 토큰이 맞아야 한다. 토큰(앱)은 쿠키를 쓰지 않으므로 필요 없다.
 * csrfFromForm 은 HTML 양식이 보낸 값이다.
 */
export async function requireWriter(db: Db, ctx: Ctx, csrfFromForm?: string | null): Promise<Auth> {
  const auth = await authenticate(db, ctx);
  if (!auth) throw new HttpError(401, "로그인이 필요합니다.", "login_required");
  if (auth.via === "session") {
    const sent = csrfFromForm ?? String(ctx.req.headers["x-csrf-token"] ?? "");
    if (!auth.csrf || !sent || !sameSecret(sent, auth.csrf)) throw new HttpError(403, "요청 확인 토큰이 맞지 않습니다. 페이지를 새로고침해 주세요.", "csrf");
  }
  return auth;
}

export function requireAdmin(auth: Auth): void {
  if (auth.user.role !== "admin") throw new HttpError(403, "관리자만 할 수 있습니다.", "forbidden");
}

function userCode(): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** 기기 코드 시작(앱). device_code 는 앱만 알고, user_code 는 사람이 브라우저에 확인한다. */
export async function startDeviceCode(db: Db, config: StoreConfig, clientName: string): Promise<Record<string, unknown>> {
  const deviceCode = newToken();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = userCode();
    const inserted = await db.query(
      `insert into store_device_codes (device_hash, user_code, client_name, expires_at)
       values ($1, $2, $3, now() + make_interval(mins => $4)) on conflict (user_code) do nothing`,
      [hashToken(deviceCode), code, clientName.slice(0, 60) || "OPRN", DEVICE_MINUTES],
    );
    if (inserted.rowCount === 1) {
      return {
        device_code: deviceCode,
        user_code: code,
        verification_uri: `${config.publicUrl}/device`,
        verification_uri_complete: `${config.publicUrl}/device?code=${encodeURIComponent(code)}`,
        expires_in: DEVICE_MINUTES * 60,
        interval: 2,
      };
    }
  }
  throw new HttpError(503, "로그인 코드를 만들지 못했습니다. 다시 시도해 주세요.", "device_code");
}

export async function findDeviceCode(db: Db, code: string): Promise<{ clientName: string; status: string } | null> {
  const { rows } = await db.query("select client_name, status from store_device_codes where user_code = $1 and expires_at > now()", [code.trim().toUpperCase()]);
  return rows[0] ? { clientName: String(rows[0].client_name), status: String(rows[0].status) } : null;
}

export async function decideDeviceCode(db: Db, code: string, userId: number, approve: boolean): Promise<boolean> {
  const result = await db.query(
    "update store_device_codes set status = $3, user_id = $2 where user_code = $1 and status = 'pending' and expires_at > now()",
    [code.trim().toUpperCase(), userId, approve ? "approved" : "denied"],
  );
  return result.rowCount === 1;
}

/** 앱이 기다리는 쪽. 승인되면 한 번만 토큰을 낸다. */
export async function pollDeviceCode(db: Db, deviceCode: string): Promise<{ status: "pending" | "denied" | "expired" } | { status: "approved"; token: string; user: User }> {
  const hash = hashToken(deviceCode);
  const { rows } = await db.query(
    `update store_device_codes set status = 'consumed' where device_hash = $1 and status = 'approved' and expires_at > now()
     returning user_id, client_name`,
    [hash],
  );
  if (rows[0]) {
    const token = newToken();
    await db.query("insert into store_tokens (token_hash, user_id, name) values ($1, $2, $3)", [hashToken(token), rows[0].user_id, rows[0].client_name]);
    const user = await db.query("select * from store_users where id = $1", [rows[0].user_id]);
    return { status: "approved", token, user: rowUser(user.rows[0]) };
  }
  const state = await db.query("select status, expires_at > now() as live from store_device_codes where device_hash = $1", [hash]);
  if (!state.rows[0] || !state.rows[0].live || state.rows[0].status === "consumed") return { status: "expired" };
  return { status: state.rows[0].status === "denied" ? "denied" : "pending" };
}

export async function revokeToken(db: Db, ctx: Ctx): Promise<void> {
  const header = ctx.req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) await db.query("update store_tokens set revoked_at = now() where token_hash = $1", [hashToken(header.slice(7).trim())]);
}

/** Google OAuth: 인가 코드 → 토큰 → userinfo. 확인된 이메일만 받는다. */
export async function googleUser(config: StoreConfig, code: string): Promise<{ email: string; name: string; sub: string }> {
  const google = config.google;
  if (!google) throw new HttpError(404, "Google 로그인이 설정되지 않았습니다.", "google_disabled");
  const tokenResponse = await fetch(google.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: `${config.publicUrl}/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new HttpError(502, "Google 로그인 확인에 실패했습니다.", "google_token");
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new HttpError(502, "Google 로그인 확인에 실패했습니다.", "google_token");
  const infoResponse = await fetch(google.userinfoUrl, { headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10_000) });
  if (!infoResponse.ok) throw new HttpError(502, "Google 계정 정보를 읽지 못했습니다.", "google_userinfo");
  const info = await infoResponse.json() as { email?: string; email_verified?: boolean; name?: string; sub?: string };
  if (!info.email || info.email_verified !== true || !info.sub) throw new HttpError(403, "확인된 Google 이메일이 필요합니다.", "google_unverified");
  return { email: info.email, name: info.name ?? info.email.split("@")[0]!, sub: info.sub };
}
