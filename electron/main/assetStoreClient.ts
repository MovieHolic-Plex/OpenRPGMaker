/**
 * 에셋 스토어 중계(메인 프로세스, Electron 비의존). 렌더러는 스토어 서버에 직접 요청하지 않는다 —
 * 이 모듈이 대신 받고, 받은 바이트의 sha256·형식을 확인한 뒤 디스크 캐시에 둔다.
 * 위키: openwiki/asset-store.md.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSha256, validateManifest, type StoreCatalogPage, type StoreItemDetail, type StorePackManifest } from "../../src/assetStore/format";
import { sniffMime } from "../../src/assetStore/sniff";

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
    const body = await response.json().catch(() => ({})) as { message?: string; details?: string[] };
    if (!response.ok) throw new StoreError(body.message ?? `스토어 오류 ${response.status}`, response.status, body.details ?? []);
    return body as T;
  }

  catalog(query: { q?: string; kind?: string; grade?: string; sort?: string; page?: number }): Promise<StoreCatalogPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
    return this.json<StoreCatalogPage>(`/api/v1/items?${params}`);
  }

  item(slug: string): Promise<StoreItemDetail> {
    return this.json<StoreItemDetail>(`/api/v1/items/${encodeURIComponent(slug)}`);
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
    const bytes = new Uint8Array(await response.arrayBuffer());
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

function normalizeUrl(url: string): string {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isPrivateHost(parsed.hostname))) {
    throw new StoreError("스토어 주소는 https 여야 합니다(내부망 주소만 http 허용).");
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
}

/** 스테이징(Tailscale·사설망·루프백)만 http 를 허용한다. */
function isPrivateHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || /^10\./.test(host) || /^192\.168\./.test(host) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || !host.includes(".");
}

function writeAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, data);
  renameSync(temp, path);
}
