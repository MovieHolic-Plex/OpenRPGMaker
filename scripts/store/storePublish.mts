/**
 * 공식 팩 게시기의 올리기 부분: 대상 주소·운영자 세션·blob/상품/판본 올리기·올리기 전 검사.
 * 주소와 토큰은 코드·저장소에 두지 않는다 — 환경 변수로만 받는다(openwiki/asset-store.md 「게시기」).
 *   STORE_PUBLISH_STAGING_URL      스테이징(개발 로그인이 켜진 서버)
 *   STORE_PUBLISH_DEV_EMAIL        스테이징 개발 로그인에 쓸 운영자 이메일(그 서버의 STORE_ADMIN_EMAILS 에 있어야 한다)
 *   STORE_PUBLISH_PRODUCTION_URL   운영
 *   STORE_LINK_TOKEN               운영 admin-link 일회용 토큰(15분·한 번). 인자로 받지 않는다(프로세스 목록에 남는다).
 * 설정하지 않은 대상은 「설정 안 됨」으로 끝나고 아무것도 보내지 않는다.
 */
import { storeThirdPartyName, validateManifest, type StorePackManifest } from "../../src/assetStore/format";
import { z } from "zod";

/** 서버 목록 응답에서 쓰는 부분만(`/api/v1/me`, `/api/v1/items`). */
const ItemList = z.object({ items: z.array(z.object({ slug: z.string(), title: z.string(), status: z.string().optional() })) });
export type PublishTarget = "staging" | "production";
export interface Pack { readonly manifest: StorePackManifest; readonly blobs: ReadonlyMap<string, Uint8Array> }
export interface Session { readonly base: string; readonly headers: Readonly<Record<string, string>> }

export class PublishError extends Error {
  constructor(message: string, readonly exitCode = 1) { super(message); this.name = "PublishError"; }
}

const TARGET_ENV: Readonly<Record<PublishTarget, string>> = { staging: "STORE_PUBLISH_STAGING_URL", production: "STORE_PUBLISH_PRODUCTION_URL" };

/** 대상 주소(끝 / 없음). 환경 변수가 없으면 null. */
export function targetBase(target: PublishTarget, env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[TARGET_ENV[target]]?.trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (target === "production" && url.protocol !== "https:") throw new PublishError(`${TARGET_ENV.production} 는 https 주소여야 합니다.`, 2);
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}

export function requireTargetBase(target: PublishTarget, env: NodeJS.ProcessEnv = process.env): string {
  const base = targetBase(target, env);
  if (!base) throw new PublishError(`${TARGET_ENV[target]} 가 설정되지 않았습니다. 게시기는 주소를 코드에 두지 않습니다.`, 2);
  return base;
}

/**
 * 올리기 전 검사: 매니페스트 형식과, 제3자 팩 이름(Rasak·REFMAP·RPG Maker MV/MZ·PAW)이 id·이름·제목·태그에 없는지.
 * 공식 팩도 편집기 buildPack 과 같은 규칙을 지난다(스토어 서버도 같은 storeThirdPartyName 으로 거절한다).
 */
export function publishProblems(manifest: StorePackManifest): string[] {
  const checked = validateManifest(manifest);
  const problems = checked.ok ? [] : [...checked.errors];
  const named: [string, string][] = [["제목", manifest.title], ...manifest.tags.map((tag): [string, string] => ["태그", tag])];
  for (const asset of Object.values(manifest.content.assets)) named.push([`에셋 ${asset.id}`, asset.id], [`에셋 ${asset.id}`, asset.name]);
  for (const tileset of Object.values(manifest.content.tilesets)) {
    named.push([`타일셋 ${tileset.id}`, tileset.id], [`타일셋 ${tileset.id}`, tileset.name]);
    if (tileset.image.type === "bundled") named.push([`타일셋 ${tileset.id} 그림`, tileset.image.id]);
    for (const graft of tileset.tileGrafts ?? []) named.push([`타일셋 ${tileset.id} 이식`, graft.sourceChipset]);
  }
  for (const [where, text] of named) {
    const word = storeThirdPartyName(text, manifest.license);
    if (word) problems.push(`${where}: 제3자 팩 이름 「${word}」`);
  }
  return problems;
}

async function sessionFrom(base: string, login: Response, failure: string): Promise<Session> {
  const cookie = login.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  if (login.status !== 303 || !cookie) throw new PublishError(`${failure} (${login.status})`);
  const page = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const csrf = /<meta name="csrf" content="([^"]+)"/.exec(page)?.[1];
  if (!csrf) throw new PublishError("로그인하지 못했습니다(csrf 없음).");
  return { base, headers: { cookie, "x-csrf-token": csrf } };
}

/** 대상에 맞는 운영자 세션: 스테이징은 개발 로그인, 운영은 admin-link 일회용 토큰. */
export async function openSession(target: PublishTarget, base: string, env: NodeJS.ProcessEnv = process.env): Promise<Session> {
  if (target === "staging") {
    const email = env.STORE_PUBLISH_DEV_EMAIL?.trim();
    if (!email) throw new PublishError("STORE_PUBLISH_DEV_EMAIL 이 설정되지 않았습니다(스테이징 개발 로그인 운영자 이메일).", 2);
    const login = await fetch(`${base}/auth/dev`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, name: "OPRN 운영", next: "/" }) });
    return sessionFrom(base, login, "개발 로그인 실패 — 서버의 STORE_DEV_LOGIN=1 인지 확인하세요");
  }
  const token = env.STORE_LINK_TOKEN?.trim();
  if (!token) throw new PublishError("STORE_LINK_TOKEN(admin-link 일회용 토큰)이 필요합니다.", 2);
  const login = await fetch(`${base}/auth/link`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  return sessionFrom(base, login, "링크 로그인 실패 — 토큰은 15분·한 번만 쓸 수 있습니다");
}

/** 쓰고 난 운영자 세션을 남기지 않는다(/api/v1/logout 은 앱 토큰만 지운다). */
export async function closeSession(session: Session): Promise<void> {
  await fetch(`${session.base}/logout`, { method: "POST", redirect: "manual", headers: { cookie: session.headers.cookie ?? "", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: session.headers["x-csrf-token"] ?? "" }) });
}

async function sendJson(session: Session, path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${session.base}${path}`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  return { status: response.status, body: parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {} };
}

async function uploadMissingBlobs(session: Session, pack: Pack): Promise<void> {
  const check = await sendJson(session, "/api/v1/blobs/check", { sha256s: [...pack.blobs.keys()] });
  const missing = Array.isArray(check.body.missing) ? check.body.missing.filter((sha): sha is string => typeof sha === "string") : [];
  for (const sha of missing) {
    const bytes = pack.blobs.get(sha);
    if (!bytes) throw new PublishError(`서버가 모르는 blob 을 팩에서 찾지 못했습니다: ${sha.slice(0, 12)}`);
    const sent = await fetch(`${session.base}/api/v1/blobs`, { method: "POST", headers: { ...session.headers, "x-sha256": sha, "content-type": "application/octet-stream" }, body: new Uint8Array(bytes) });
    if (!sent.ok) throw new PublishError(`blob 올리기 실패 ${sent.status}: ${(await sent.text()).slice(0, 200)}`);
  }
}

const failure = (what: string, result: { status: number; body: Record<string, unknown> }): PublishError =>
  new PublishError(`${what} ${result.status}: ${String(result.body.message ?? "")} ${Array.isArray(result.body.details) ? result.body.details.join(" / ") : ""}`.trim());

/** 새 상품. 운영자 세션이라 바로 공개된다. */
export async function createItem(session: Session, pack: Pack): Promise<{ slug: string; status: string }> {
  await uploadMissingBlobs(session, pack);
  const created = await sendJson(session, "/api/v1/items", { manifest: pack.manifest });
  if (created.status !== 201 && created.status !== 200) throw failure("상품 만들기 실패", created);
  return { slug: String(created.body.slug), status: String(created.body.status) };
}

/** 이미 있는 상품에 판본을 더한다. 프로젝트에 넣은 id 는 그대로 이어진다. */
export async function addVersion(session: Session, slug: string, pack: Pack): Promise<{ version: number; status: string }> {
  await uploadMissingBlobs(session, pack);
  const added = await sendJson(session, `/api/v1/items/${encodeURIComponent(slug)}/versions`, { manifest: pack.manifest });
  if (added.status !== 201 && added.status !== 200) throw failure("판본 더하기 실패", added);
  return { version: Number(added.body.version), status: String(added.body.status) };
}

/** 이 세션 운영자의 상품 중 제목이 같은 것(숨김·대기 포함). 공개 목록 첫 쪽만 보던 옛 방식은 25번째부터 중복 상품을 만들었다. */
export async function findOwnItem(session: Session, title: string): Promise<string | null> {
  const response = await fetch(`${session.base}/api/v1/me`, { headers: session.headers });
  if (!response.ok) throw new PublishError(`내 상품 목록을 받지 못했습니다(${response.status}).`);
  const body = ItemList.parse(await response.json());
  return body.items.find((item) => item.title === title && item.status !== "removed")?.slug ?? null;
}

/** 로그인 없이 공개 목록에서 제목으로 찾는다(plan 용). */
export async function findPublicItem(base: string, title: string): Promise<string | null> {
  const response = await fetch(`${base}/api/v1/items?q=${encodeURIComponent(title)}`);
  if (!response.ok) throw new PublishError(`목록을 받지 못했습니다(${response.status}).`);
  const body = ItemList.parse(await response.json());
  return body.items.find((item) => item.title === title)?.slug ?? null;
}
