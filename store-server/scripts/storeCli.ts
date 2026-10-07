/**
 * 에셋 스토어 명령줄 — 코딩 에이전트·운영자가 브라우저 없이 찾고, 받고, 올리고, 숨긴다.
 * 에디터 안 AI 조수는 이 파일이 아니라 에디터 도구(store_*)를 쓴다.
 *
 *   npx tsx store-server/scripts/storeCli.ts login                       # 기기 코드 → 브라우저에서 허락
 *   npx tsx store-server/scripts/storeCli.ts search 숲 --kind tileset
 *   npx tsx store-server/scripts/storeCli.ts pull <slug> <폴더>           # manifest.json + blobs/<sha256>
 *   npx tsx store-server/scripts/storeCli.ts publish <폴더>               # 같은 폴더 모양을 새 상품으로
 *   npx tsx store-server/scripts/storeCli.ts version <slug> <폴더>        # 내 상품에 새 판본
 *   npx tsx store-server/scripts/storeCli.ts hide <slug> | show <slug> | mine | whoami | logout
 *
 * 스토어 주소는 --base(기본 https://store.openrpgmaker.com). 토큰은 ~/.config/oprn-store/cli.json(600)에 주소별로 둔다.
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateManifest, type StorePackManifest } from "../../src/assetStore/format";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args.splice(index, 2)[1] : undefined; };
const base = (flag("--base") ?? process.env.OPRN_STORE_URL ?? "https://store.openrpgmaker.com").replace(/\/+$/, "");
const kind = flag("--kind");
const [command, ...rest] = args;

const configPath = join(homedir(), ".config", "oprn-store", "cli.json");
const readTokens = (): Record<string, string> => (existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) as Record<string, string> : {});
function saveToken(token: string | null): void {
  const tokens = readTokens();
  if (token) tokens[base] = token; else delete tokens[base];
  mkdirSync(join(homedir(), ".config", "oprn-store"), { recursive: true, mode: 0o700 });
  writeFileSync(configPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  chmodSync(configPath, 0o600);
}
const token = (): string => {
  const value = readTokens()[base];
  if (!value) throw new Error(`로그인하지 않았습니다. 먼저: storeCli.ts login --base ${base}`);
  return value;
};

async function api<T>(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (init.auth !== false) headers.set("authorization", `Bearer ${token()}`);
  const response = await fetch(base + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const text = await response.text();
  const body = text ? JSON.parse(text) as T & { message?: string; details?: string[] } : ({} as T & { message?: string; details?: string[] });
  if (!response.ok) throw new Error(`${response.status} ${body.message ?? text.slice(0, 200)}${body.details?.length ? `\n  ${body.details.join("\n  ")}` : ""}`);
  return body;
}

/** 팩 폴더: manifest.json 과 blobs/<sha256> 파일들. pull 이 같은 모양으로 내려받는다. */
function readPack(dir: string): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
  const checked = validateManifest(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")));
  if (!checked.ok) throw new Error(`매니페스트 검증 실패:\n  ${checked.errors.join("\n  ")}`);
  const blobs = new Map<string, Uint8Array>();
  for (const ref of checked.value.blobs) {
    const bytes = readFileSync(join(dir, "blobs", ref.sha256));
    if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) throw new Error(`blobs/${ref.sha256} 의 해시가 맞지 않습니다.`);
    blobs.set(ref.sha256, bytes);
  }
  return { manifest: checked.value, blobs };
}

async function uploadBlobs(blobs: Map<string, Uint8Array>): Promise<void> {
  const { missing } = await api<{ missing: string[] }>("/api/v1/blobs/check", { method: "POST", json: { sha256s: [...blobs.keys()] } });
  for (const [index, sha] of missing.entries()) {
    await api("/api/v1/blobs", { method: "POST", headers: { "x-sha256": sha, "content-type": "application/octet-stream" }, body: Buffer.from(blobs.get(sha)!) });
    console.log(`  파일 ${index + 1}/${missing.length}`);
  }
}

async function login(): Promise<void> {
  const started = await api<{ device_code: string; user_code: string; verification_uri_complete: string; interval: number; expires_in: number }>(
    "/api/v1/device/code", { method: "POST", json: { client: "OPRN 명령줄" }, auth: false });
  console.log(`브라우저에서 열고 허락하세요: ${started.verification_uri_complete}\n코드: ${started.user_code}`);
  const deadline = Date.now() + started.expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, started.interval) * 1000));
    const response = await fetch(`${base}/api/v1/device/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device_code: started.device_code }) });
    if (response.status === 428) continue;
    const body = await response.json() as { access_token?: string; user?: { email: string }; error?: string };
    if (!body.access_token) throw new Error(`로그인 실패: ${body.error ?? response.status}`);
    saveToken(body.access_token);
    console.log(`로그인했습니다: ${body.user?.email ?? ""}`);
    return;
  }
  throw new Error("허락을 기다리다 시간이 지났습니다.");
}

const commands: Record<string, () => Promise<void>> = {
  login,
  async logout() { await api("/api/v1/logout", { method: "POST" }).catch(() => undefined); saveToken(null); console.log("로그아웃했습니다."); },
  async whoami() { const me = await api<{ user: { email: string; displayName: string; role: string } }>("/api/v1/me"); console.log(`${me.user.displayName} <${me.user.email}> (${me.user.role})`); },
  async mine() {
    const me = await api<{ items: { slug: string; title: string; status: string; kind: string }[] }>("/api/v1/me");
    for (const item of me.items) console.log(`${item.status.padEnd(8)} ${item.kind.padEnd(10)} ${item.slug}  ${item.title}`);
  },
  async search() {
    const params = new URLSearchParams({ q: rest.join(" "), ...(kind ? { kind } : {}) });
    const page = await api<{ items: { slug: string; title: string; kind: string; grade: string; downloads: number }[]; total: number }>(`/api/v1/items?${params}`, { auth: false });
    console.log(`${page.total}개`);
    for (const item of page.items) console.log(`${item.kind.padEnd(10)} ${item.grade === "pack" ? "조수" : "    "} ↓${String(item.downloads).padEnd(4)} ${item.slug}  ${item.title}`);
  },
  async pull() {
    const [slug, dir] = rest;
    if (!slug || !dir) throw new Error("pull <slug> <폴더>");
    const detail = await api<{ versions: { version: number }[] }>(`/api/v1/items/${slug}`, { auth: false });
    const version = Math.max(...detail.versions.map((v) => v.version));
    const manifest = await api<StorePackManifest>(`/api/v1/items/${slug}/versions/${version}/manifest`, { auth: false });
    mkdirSync(join(dir, "blobs"), { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    for (const ref of manifest.blobs) {
      const bytes = new Uint8Array(await (await fetch(`${base}/api/v1/blobs/${ref.sha256}`)).arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== ref.sha256) throw new Error(`${ref.sha256} 해시가 맞지 않습니다.`);
      writeFileSync(join(dir, "blobs", ref.sha256), bytes);
    }
    console.log(`${slug} v${version} → ${dir} (파일 ${readdirSync(join(dir, "blobs")).length}개)`);
  },
  async publish() {
    const [dir] = rest;
    if (!dir) throw new Error("publish <폴더>");
    const pack = readPack(dir);
    await uploadBlobs(pack.blobs);
    const created = await api<{ slug: string; status: string; version: number }>("/api/v1/items", { method: "POST", json: { manifest: pack.manifest } });
    console.log(`${created.status}: ${base}/items/${created.slug}`);
  },
  async version() {
    const [slug, dir] = rest;
    if (!slug || !dir) throw new Error("version <slug> <폴더>");
    const pack = readPack(dir);
    await uploadBlobs(pack.blobs);
    const created = await api<{ status: string; version: number }>(`/api/v1/items/${slug}/versions`, { method: "POST", json: { manifest: pack.manifest } });
    console.log(`v${created.version} ${created.status}: ${base}/items/${slug}`);
  },
  async hide() { const [slug] = rest; console.log((await api<{ status: string }>(`/api/v1/items/${slug}/visibility`, { method: "POST", json: { hidden: true } })).status); },
  async show() { const [slug] = rest; console.log((await api<{ status: string }>(`/api/v1/items/${slug}/visibility`, { method: "POST", json: { hidden: false } })).status); },
};

const run = command ? commands[command] : undefined;
if (!run) {
  console.log(`명령: ${Object.keys(commands).join(" · ")}  (--base <스토어 주소>)`);
  process.exit(command ? 1 : 0);
}
run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
