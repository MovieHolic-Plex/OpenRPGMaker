/**
 * 에셋 스토어 중계(메인 프로세스, Electron 비의존). 렌더러는 스토어 서버에 직접 요청하지 않는다 —
 * 이 모듈이 대신 받고, 받은 바이트의 sha256·형식을 확인한 뒤 디스크 캐시에 둔다.
 * 위키: openwiki/asset-store.md.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSha256, STORE_LIMITS, validateManifest, type StoreCatalogPage, type StoreItemDetail, type StorePackManifest } from "../../src/assetStore/format";
import { sniffMime } from "../../src/assetStore/sniff";
import { normalizeGameConcept, type GameConcept } from "../../src/concepts/format";

export const DEFAULT_STORE_URL = "https://store.openrpgmaker.com";

export interface StoreUser { id: number; email: string; displayName: string; role: string }
export interface InstalledItem {
  slug: string; version: number; title: string; kind: string; grade: string; license: string;
  aiGenerated: boolean; author: string; cover: string | null; installedAt: string; storeUrl: string;
}
export interface StorePackage {
  manifest: StorePackManifest; blobs: Record<string, Uint8Array>; slug: string; version: number;
  author: string; storeUrl: string; itemUrl: string;
}
export interface UploadInput { manifest: StorePackManifest; blobs: Record<string, Uint8Array>; targetSlug?: string }
export type Progress = (event: { slug: string; phase: "install" | "upload"; done: number; total: number }) => void;

export class StoreError extends Error {
  constructor(message: string, readonly status = 0, readonly details: string[] = []) { super(message); }
}

interface TokenVault { load(): string | null; save(token: string | null): void; persistent(): boolean }

export class AssetStoreClient {
  private token: string | null;
  private storeUrl: string;

  constructor(private readonly root: string, private readonly vault: TokenVault, envUrl?: string) {
    mkdirSync(join(root, "blobs"), { recursive: true });
    mkdirSync(join(root, "manifests"), { recursive: true });
    this.storeUrl = normalizeUrl(envUrl || this.readConfig().url || DEFAULT_STORE_URL);
    this.token = vault.load();
  }

  get url(): string { return this.storeUrl; }
  get loggedIn(): boolean { return this.token !== null; }
  get tokenPersistent(): boolean { return this.vault.persistent(); }

  setUrl(url: string): void {
    const next = normalizeUrl(url);
    if (next !== this.storeUrl) { this.storeUrl = next; this.setToken(null); }
    this.writeConfig({ url: next });
  }

  setToken(token: string | null): void {
    this.token = token;
    this.vault.save(token);
  }

  private readConfig(): { url?: string } {
    try { return JSON.parse(readFileSync(join(this.root, "config.json"), "utf8")) as { url?: string }; } catch { return {}; }
  }
  private writeConfig(config: { url?: string }): void { writeAtomic(join(this.root, "config.json"), JSON.stringify(config, null, 2)); }

  private async request(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.json !== undefined) headers.set("content-type", "application/json");
    if (init.auth !== false && this.token) headers.set("authorization", `Bearer ${this.token}`);
    headers.set("accept", "application/json");
    let response: Response;
    try {
      response = await fetch(this.storeUrl + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, signal: init.signal ?? AbortSignal.timeout(60_000) });
    } catch (error) {
      throw new StoreError(`스토어(${this.storeUrl})에 연결하지 못했습니다. 인터넷 연결이나 스토어 주소를 확인해 주세요.`, 0, [String((error as Error)?.message ?? error)]);
    }
    if (response.status === 401 && this.token) {
      this.setToken(null);
      throw new StoreError("로그인이 만료되었습니다. 다시 로그인해 주세요.", 401);
    }
    return response;
  }

  private async json<T>(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<T> {
    const response = await this.request(path, init);
    const text = new TextDecoder().decode(await readCapped(response, STORE_LIMITS.manifestBytes + 65_536).catch(() => new Uint8Array()));
    let body: { message?: string; details?: string[] } = {};
    try { body = JSON.parse(text) as typeof body; } catch { /* 빈 응답·잘린 응답 */ }
    if (!response.ok) throw new StoreError(body.message ?? `스토어 오류 ${response.status}`, response.status, body.details ?? []);
    return body as T;
  }

  /** 내 상품 숨기기·다시 보이기. 서버가 작가 본인인지 확인한다. */
  setVisibility(slug: string, hidden: boolean): Promise<{ status: string }> {
    return this.json<{ status: string }>(`/api/v1/items/${encodeURIComponent(slug)}/visibility`, { method: "POST", json: { hidden } });
  }

  catalog(query: { q?: string; kind?: string; grade?: string; sort?: string; page?: number; lang?: string }): Promise<StoreCatalogPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
    return this.json<StoreCatalogPage>(`/api/v1/items?${params}`);
  }

  /** lang 을 주면 그 언어판 제목·소개를 받는다(없으면 원문). 설치 기록에는 lang 없이 받은 원문을 쓴다. */
  item(slug: string, lang?: string): Promise<StoreItemDetail> {
    return this.json<StoreItemDetail>(`/api/v1/items/${encodeURIComponent(slug)}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`);
  }

  /** 컨셉 피드 한 쪽. 서버가 준 카드는 하나라도 형식이 틀리면 쪽 전체를 받지 않는다(편집기와 같은 normalizeGameConcept). */
  async concepts(query: { tag?: string; q?: string; preset?: string; cursor?: string; lang?: string }): Promise<{ items: GameConcept[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (typeof value === "string" && value !== "") params.set(key, value);
    const body = await this.json<{ items?: unknown; nextCursor?: unknown }>(`/api/v1/concepts?${params}`);
    if (!Array.isArray(body.items)) throw new StoreError("스토어가 보낸 컨셉 목록 형식이 올바르지 않습니다.");
    return { items: body.items.map(conceptFromStore), nextCursor: typeof body.nextCursor === "string" && /^-?\d{1,9}:\d{1,18}$/.test(body.nextCursor) ? body.nextCursor : null };
  }

  async concept(input: { slug: string; lang?: string }): Promise<{ concept: GameConcept; similar: GameConcept[] }> {
    const body = await this.json<{ concept?: unknown; similar?: unknown }>(`/api/v1/concepts/${encodeURIComponent(input.slug)}${input.lang ? `?lang=${encodeURIComponent(input.lang)}` : ""}`);
    return { concept: conceptFromStore(body.concept), similar: Array.isArray(body.similar) ? body.similar.map(conceptFromStore) : [] };
  }

  /** 「이걸로 만들었다」 세기. 실패해도 만들기는 계속되므로 오류 대신 false. */
  async conceptMade(input: { slug: string }): Promise<boolean> {
    try {
      await this.json(`/api/v1/concepts/${encodeURIComponent(input.slug)}/made`, { method: "POST", json: {} });
      return true;
    } catch {
      return false;
    }
  }

  me(): Promise<{ user: StoreUser; items: (StoreItemDetail & { status: string })[] }> {
    return this.json(`/api/v1/me`);
  }

  private blobPath(sha: string): string { return join(this.root, "blobs", sha.slice(0, 2), sha); }

  /** 캐시에 있으면 그것을, 없으면 받아서 해시·형식을 확인하고 캐시에 둔다. */
  async blob(sha: string): Promise<Uint8Array> {
    if (!isSha256(sha)) throw new StoreError("파일 주소가 올바르지 않습니다.");
    const path = this.blobPath(sha);
    if (existsSync(path)) return new Uint8Array(readFileSync(path));
    const response = await this.request(`/api/v1/blobs/${sha}`, { auth: false });
    if (!response.ok) throw new StoreError(`파일을 받지 못했습니다(${response.status}).`, response.status);
    const bytes = await readCapped(response, STORE_LIMITS.blobBytes);
    if (createHash("sha256").update(bytes).digest("hex") !== sha) throw new StoreError("받은 파일의 해시가 맞지 않습니다. 다시 시도해 주세요.");
    if (!sniffMime(bytes)) throw new StoreError("받은 파일이 그림·소리 형식이 아닙니다.");
    writeAtomic(path, bytes);
    return bytes;
  }

  private manifestPath(slug: string, version: number): string { return join(this.root, "manifests", `${slug}@${version}.json`); }
  private indexPath(): string { return join(this.root, "installed.json"); }

  installed(): InstalledItem[] {
    try {
      const value = JSON.parse(readFileSync(this.indexPath(), "utf8")) as { items?: Record<string, InstalledItem> };
      return Object.values(value.items ?? {}).sort((a, b) => b.installedAt.localeCompare(a.installedAt));
    } catch { return []; }
  }
  private writeInstalled(items: InstalledItem[]): void {
    writeAtomic(this.indexPath(), JSON.stringify({ version: 1, items: Object.fromEntries(items.map((item) => [item.slug, item])) }, null, 2));
  }

  /** 받기: 매니페스트 검증 → blob 전부 받기(해시 확인) → 설치 목록에 기록. 받기 수도 센다. */
  async install(slug: string, progress: Progress, version?: number): Promise<InstalledItem> {
    const detail = await this.item(slug);
    const target = version ?? detail.latestVersion;
    // 판본 번호는 캐시 파일 이름에 들어간다 — 서버가 준 값이라도 양의 정수만 믿는다.
    if (!Number.isSafeInteger(target) || target < 1) throw new StoreError("스토어가 알려 준 판본 번호가 올바르지 않습니다.");
    const raw = await this.json<unknown>(`/api/v1/items/${encodeURIComponent(slug)}/versions/${target}/manifest`);
    const checked = validateManifest(raw);
    if (!checked.ok) throw new StoreError("팩 형식이 올바르지 않아 받지 않았습니다.", 0, checked.errors);
    const manifest = checked.value;
    let done = 0;
    progress({ slug, phase: "install", done, total: manifest.blobs.length });
    for (const entry of manifest.blobs) {
      const bytes = await this.blob(entry.sha256);
      if (sniffMime(bytes) !== entry.mime || bytes.byteLength !== entry.bytes) throw new StoreError("받은 파일이 팩 설명과 다릅니다.");
      done += 1;
      progress({ slug, phase: "install", done, total: manifest.blobs.length });
    }
    writeAtomic(this.manifestPath(slug, target), JSON.stringify(manifest));
    const record: InstalledItem = {
      slug, version: target, title: detail.title, kind: detail.kind, grade: detail.grade, license: detail.license,
      aiGenerated: detail.aiGenerated, author: detail.author, cover: detail.cover, installedAt: new Date().toISOString(), storeUrl: this.storeUrl,
    };
    this.writeInstalled([record, ...this.installed().filter((item) => item.slug !== slug)]);
    await this.request(`/api/v1/items/${encodeURIComponent(slug)}/downloads`, { method: "POST", json: {} }).catch(() => undefined);
    return record;
  }

  uninstall(slug: string): void {
    const items = this.installed();
    const removed = items.find((item) => item.slug === slug);
    if (!removed) return;
    const rest = items.filter((item) => item.slug !== slug);
    this.writeInstalled(rest);
    rmSync(this.manifestPath(slug, removed.version), { force: true });
    this.collectGarbage(rest);
  }

  /** 남은 설치가 쓰지 않는 blob 을 지운다(미리보기로만 받은 것도 포함). */
  private collectGarbage(rest: InstalledItem[]): void {
    const keep = new Set<string>();
    for (const item of rest) {
      try {
        const manifest = JSON.parse(readFileSync(this.manifestPath(item.slug, item.version), "utf8")) as StorePackManifest;
        for (const blob of manifest.blobs) keep.add(blob.sha256);
      } catch { /* 깨진 매니페스트는 다음 설치 때 다시 받는다 */ }
    }
    const blobsRoot = join(this.root, "blobs");
    for (const shard of readdirSync(blobsRoot)) {
      for (const name of readdirSync(join(blobsRoot, shard))) if (isSha256(name) && !keep.has(name)) rmSync(join(blobsRoot, shard, name), { force: true });
    }
  }

  /** 렌더러가 프로젝트에 넣을 재료. 설치되어 있어야 한다. */
  async packageFor(slug: string): Promise<StorePackage> {
    const record = this.installed().find((item) => item.slug === slug);
    if (!record) throw new StoreError("먼저 받기를 눌러 주세요.");
    let manifest: StorePackManifest;
    try { manifest = JSON.parse(readFileSync(this.manifestPath(slug, record.version), "utf8")) as StorePackManifest; }
    catch { throw new StoreError("받아 둔 팩이 깨졌습니다. 다시 받아 주세요."); }
    const blobs: Record<string, Uint8Array> = {};
    for (const entry of manifest.blobs) blobs[entry.sha256] = await this.blob(entry.sha256);
    return { manifest, blobs, slug, version: record.version, author: record.author, storeUrl: record.storeUrl, itemUrl: `${record.storeUrl}/items/${encodeURIComponent(slug)}` };
  }

  /** 기기 코드 로그인 시작. 승인될 때까지 기다리는 쪽은 pollLogin. */
  startLogin(client: string): Promise<{ device_code: string; user_code: string; verification_uri: string; verification_uri_complete: string; expires_in: number; interval: number }> {
    return this.json(`/api/v1/device/code`, { method: "POST", json: { client }, auth: false });
  }

  async pollLogin(deviceCode: string): Promise<"pending" | "approved" | "denied" | "expired"> {
    const response = await this.request(`/api/v1/device/token`, { method: "POST", json: { device_code: deviceCode }, auth: false });
    const body = await response.json().catch(() => ({})) as { access_token?: string; error?: string };
    if (response.ok && body.access_token) { this.setToken(body.access_token); return "approved"; }
    if (body.error === "authorization_pending") return "pending";
    return body.error === "access_denied" ? "denied" : "expired";
  }

  async logout(): Promise<void> {
    if (this.token) await this.request(`/api/v1/logout`, { method: "POST", json: {} }).catch(() => undefined);
    this.setToken(null);
  }

  /** 올리기: 서버에 없는 blob 만 올리고 → 새 상품 또는 새 판본을 만든다. */
  async upload(input: UploadInput, progress: Progress): Promise<{ slug: string; status: string; version: number }> {
    if (!this.token) throw new StoreError("올리려면 먼저 로그인해 주세요.", 401);
    const checked = validateManifest(input.manifest);
    if (!checked.ok) throw new StoreError("팩 형식이 올바르지 않습니다.", 0, checked.errors);
    const label = input.targetSlug ?? input.manifest.title;
    const shas = input.manifest.blobs.map((blob) => blob.sha256);
    const { missing } = await this.json<{ missing: string[] }>(`/api/v1/blobs/check`, { method: "POST", json: { sha256s: shas } });
    let done = shas.length - missing.length;
    progress({ slug: label, phase: "upload", done, total: shas.length });
    for (const sha of missing) {
      const bytes = input.blobs[sha];
      if (!bytes || createHash("sha256").update(bytes).digest("hex") !== sha) throw new StoreError("올릴 파일이 매니페스트와 맞지 않습니다.");
      await this.json(`/api/v1/blobs`, { method: "POST", body: bytes, headers: { "x-sha256": sha, "content-type": "application/octet-stream" }, signal: AbortSignal.timeout(300_000) });
      done += 1;
      progress({ slug: label, phase: "upload", done, total: shas.length });
    }
    const path = input.targetSlug ? `/api/v1/items/${encodeURIComponent(input.targetSlug)}/versions` : `/api/v1/items`;
    return this.json(path, { method: "POST", json: { manifest: input.manifest } });
  }
}

/** 서버 컨셉 카드 → 검사한 GameConcept. 스토어 카드의 썸네일은 blob sha256 이어야 한다(경로·주소는 받지 않는다). */
function conceptFromStore(value: unknown): GameConcept {
  let concept: GameConcept;
  try {
    concept = normalizeGameConcept(value);
  } catch (error) {
    throw new StoreError("스토어가 보낸 컨셉 형식이 올바르지 않습니다.", 0, [error instanceof Error ? error.message : String(error)]);
  }
  if (!isSha256(concept.thumb.full) || !isSha256(concept.thumb.card)) throw new StoreError("스토어가 보낸 컨셉 썸네일 주소가 올바르지 않습니다.");
  return concept;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isPrivateHost(parsed.hostname))) {
    throw new StoreError("스토어 주소는 https 여야 합니다(내부망 주소만 http 허용).");
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
}

/** 스테이징(Tailscale·사설망·루프백)만 http 를 허용한다. */
export function isPrivateHost(host: string): boolean {
  const octet = "(25[0-5]|2[0-4]\\d|1?\\d?\\d)";
  const ip = (prefix: string, rest: number) => new RegExp(`^${prefix}(\\.${octet}){${rest}}$`).test(host);
  return host === "localhost" || host === "[::1]" || ip("127", 3) || ip("10", 3) || ip("192\\.168", 2) || ip("172\\.(1[6-9]|2\\d|3[01])", 2)
    || ip("100\\.(6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])", 2) || /^[a-z0-9-]+$/i.test(host);
}

/** 응답 본문을 max 바이트까지만 읽는다. 넘으면 끊는다(악의적인 서버가 메모리를 채우지 못하게). */
async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > max) { await response.body?.cancel(); throw new StoreError("스토어 응답이 너무 큽니다."); }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); throw new StoreError("스토어 응답이 너무 큽니다."); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

function writeAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, data);
  renameSync(temp, path);
}

/** url 이 base 와 같은 출처(프로토콜·호스트·포트)일 때만 정규화한 주소를 돌려준다. */
export function sameOriginUrl(url: string, base: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(base).origin ? parsed.toString() : null;
  } catch { return null; }
}
