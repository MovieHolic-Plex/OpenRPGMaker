import { mkdtemp, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createServer, preview, type Connect, type ViteDevServer, type PreviewServer } from "vite";
import * as releaseApi from "../scripts/lib/bgm-release.mjs";
import { bgmInstallPlugin, type BgmInstallOptions } from "../scripts/lib/bgmInstall";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function harness(options: BgmInstallOptions & { install: NonNullable<BgmInstallOptions["install"]> }, setup: {
  mode?: "dev" | "preview";
  env?: string;
  onRequest?: (request: Connect.IncomingMessage) => void;
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "bgm-install-"));
  await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await copyFile("assets/bgm-release-v1.json", join(root, "assets/bgm-release-v1.json"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
  if (setup.env !== undefined) await writeFile(join(root, ".env.local"), setup.env);
  await mkdir(join(root, "dist"));
  await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
  const settled = deferred();
  const observe = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, _response, next) => { setup.onRequest?.(request); next(); });
  };
  const config = { configFile: false as const, root, cacheDir: join(root, ".cache"),
    logLevel: "silent" as const, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [
      { name: "test-request-observer", configureServer: observe, configurePreviewServer: observe },
      bgmInstallPlugin({ ...options, install: input => options.install(input).finally(() => settled.resolve()) }),
    ] };
  const server = setup.mode === "preview"
    ? await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } })
    : await createServer({ ...config, server: { host: "127.0.0.1", port: 0 } });
  if ("listen" in server) await server.listen(0);
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    root,
    installationSettled: settled.promise,
    request: (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) }),
    close: async () => { await server.close(); await rm(root, { recursive: true, force: true }); },
  };
}

it("status 는 매니페스트 기대치와 설치 현황을 함께 준다", async () => {
  const h = await harness({ install: async () => ({}) });
  try {
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.expected).toBe(281);
    expect(body.archiveBytes).toBe(1304157696);
    expect(body.installed).toEqual([]);
    expect(body.installing).toBe(false);
    expect(body.error).toBeNull();
  } finally { await h.close(); }
}, 20000);

it("설치를 시작하면 202 를 주고, 끝나면 status 가 설치본을 반영한다", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const h = await harness({ install: async ({ root }) => {
    await gate;
    await writeFile(join(root, "public/assets/cc0/audio/catalog/done.mp3"), "sound");
    return {};
  } });
  try {
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    expect((await (await h.request("/api/bgm/status")).json()).installing).toBe(true);
    release();
    await h.installationSettled;
    const done = await (await h.request("/api/bgm/status")).json();
    expect(done.installing).toBe(false);
    expect(done.installed).toEqual(["done.mp3"]);
  } finally { await h.close(); }
}, 20000);

it("이미 설치가 돌고 있으면 두 번째 POST 는 409 다", async () => {
  const gate = deferred();
  const h = await harness({ install: () => gate.promise });
  try {
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    const second = await h.request("/api/bgm/install", { method: "POST" });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBeTruthy();
  } finally { gate.resolve(); await h.close(); }
}, 20000);

it("설치 실패는 status 의 error 로 드러나고 installing 이 풀린다", async () => {
  const h = await harness({ install: async () => { throw new Error("gh 실행 실패"); } });
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    await h.installationSettled;
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.installing).toBe(false);
    expect(body.error).toMatch(/gh 실행 실패/);
  } finally { await h.close(); }
}, 20000);

it("허용되지 않은 주소는 403 이고, status 는 막힌 곳에서도 읽힌다", async () => {
  const h = await harness({ allowAddress: () => false, install: async () => ({}) });
  try {
    const denied = await h.request("/api/bgm/install", { method: "POST" });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBeTruthy();
    // 배너가 이유를 띄우려면 막힌 클라이언트도 status 는 읽을 수 있어야 한다.
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.remoteAllowed).toBe(false);
  } finally { await h.close(); }
}, 20000);

it("중단 요청은 설치에 넘긴 signal 을 abort 한다", async () => {
  let aborted = false;
  const started = deferred();
  const h = await harness({ install: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("취소됨")); }, { once: true });
    started.resolve();
  }) });
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    await started.promise;
    expect((await h.request("/api/bgm/install", { method: "DELETE" })).status).toBe(202);
    await h.installationSettled;
    expect(aborted).toBe(true);
    expect((await (await h.request("/api/bgm/status")).json()).installing).toBe(false);
  } finally { await h.close(); }
}, 20000);

it("reserves one install while simultaneous POSTs await the cold manifest", async () => {
  const manifest = await releaseApi.readTrustedManifest("assets/bgm-release-v1.json");
  const manifestGate = deferred<typeof manifest>();
  vi.spyOn(releaseApi, "readTrustedManifest").mockReturnValue(manifestGate.promise);
  const bothArrived = deferred();
  const installGate = deferred();
  const install = vi.fn(() => installGate.promise);
  let posts = 0;
  const h = await harness({ install }, { onRequest: request => {
    if (request.method === "POST" && ++posts === 2) bothArrived.resolve();
  } });
  try {
    const responses = Promise.all([
      h.request("/api/bgm/install", { method: "POST" }),
      h.request("/api/bgm/install", { method: "POST" }),
    ]);
    await bothArrived.promise;
    manifestGate.resolve(manifest);
    expect((await responses).map(response => response.status).sort()).toEqual([202, 409]);
    expect(install).toHaveBeenCalledTimes(1);
  } finally {
    manifestGate.resolve(manifest);
    installGate.resolve();
    await h.close();
  }
}, 20000);

it.each(["unrelated", "corrupt"])("does not bypass trusted verification for 281 %s files", async kind => {
  const manifest = await releaseApi.readTrustedManifest("assets/bgm-release-v1.json");
  const install = vi.fn(async (input: Parameters<typeof releaseApi.verifyInstalled>[0]) => {
    expect((await releaseApi.verifyInstalled(input)).complete).toBe(false);
    throw new Error("verification reached; download deliberately unavailable");
  });
  const h = await harness({ install });
  try {
    await Promise.all(manifest.tracks.map((track, index) => writeFile(join(h.root,
      "public/assets/cc0/audio/catalog", kind === "corrupt" ? track.fileName : `unrelated-${index}.mp3`), "bad")));
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    await h.installationSettled;
    expect(install).toHaveBeenCalledTimes(1);
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.installing).toBe(false);
    expect(body.error).toContain("verification reached");
  } finally { await h.close(); }
}, 20000);

it.each(["dev", "preview"] as const)("loads server-only remote opt-in from .env.local in %s", async mode => {
  vi.stubEnv("OPRN_BGM_INSTALL_REMOTE", undefined);
  const install = vi.fn(async () => ({}));
  const h = await harness({ install }, { mode, env: "OPRN_BGM_INSTALL_REMOTE=1\n", onRequest: request => {
    Object.defineProperty(request.socket, "remoteAddress", { configurable: true, value: "203.0.113.1" });
  } });
  try {
    expect(process.env.OPRN_BGM_INSTALL_REMOTE).toBeUndefined();
    expect((await (await h.request("/api/bgm/status")).json()).remoteAllowed).toBe(true);
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    await h.installationSettled;
    expect(install).toHaveBeenCalledTimes(1);
  } finally { await h.close(); }
}, 20000);

// 옛 이름 호환(한 릴리스): 사용자 .env.local 에 아직 RPG_ZZU_BGM_INSTALL_REMOTE=1 이 남아 있어도 원격 opt-in 이 살아 있어야 한다.
// 이 값은 process.env 가 아니라 Vite loadEnv 객체에서 오므로, 별칭 심을 그 객체에도 적용했는지 여기서 고정한다.
it.each(["dev", "preview"] as const)("still honours the legacy RPG_ZZU_BGM_INSTALL_REMOTE opt-in from .env.local in %s", async mode => {
  vi.stubEnv("OPRN_BGM_INSTALL_REMOTE", undefined);
  vi.stubEnv("RPG_ZZU_BGM_INSTALL_REMOTE", undefined);
  const install = vi.fn(async () => ({}));
  const h = await harness({ install }, { mode, env: "RPG_ZZU_BGM_INSTALL_REMOTE=1\n", onRequest: request => {
    Object.defineProperty(request.socket, "remoteAddress", { configurable: true, value: "203.0.113.1" });
  } });
  try {
    expect(process.env.OPRN_BGM_INSTALL_REMOTE).toBeUndefined();
    expect((await (await h.request("/api/bgm/status")).json()).remoteAllowed).toBe(true);
  } finally { await h.close(); }
}, 20000);

it("preview stays loopback-only without opt-in and ignores forwarded addresses", async () => {
  vi.stubEnv("OPRN_BGM_INSTALL_REMOTE", undefined);
  const install = vi.fn(async () => ({}));
  const h = await harness({ install }, { mode: "preview", onRequest: request => {
    Object.defineProperty(request.socket, "remoteAddress", { configurable: true, value: "203.0.113.1" });
  } });
  try {
    expect((await (await h.request("/api/bgm/status")).json()).remoteAllowed).toBe(false);
    expect((await h.request("/api/bgm/install", {
      method: "POST", headers: { "X-Forwarded-For": "127.0.0.1" },
    })).status).toBe(403);
    expect(install).not.toHaveBeenCalled();
  } finally { await h.close(); }
}, 20000);

it("cancels the reserved job before the manifest loads without starting an installer", async () => {
  const manifest = await releaseApi.readTrustedManifest("assets/bgm-release-v1.json");
  const manifestGate = deferred<typeof manifest>();
  vi.spyOn(releaseApi, "readTrustedManifest").mockReturnValue(manifestGate.promise);
  const install = vi.fn(async () => ({}));
  const h = await harness({ install });
  try {
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    expect((await h.request("/api/bgm/install", { method: "DELETE" })).status).toBe(202);
    manifestGate.resolve(manifest);
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.installing).toBe(false);
    expect(body.error).toBeNull();
    expect(install).not.toHaveBeenCalled();
  } finally { manifestGate.resolve(manifest); await h.close(); }
}, 20000);
