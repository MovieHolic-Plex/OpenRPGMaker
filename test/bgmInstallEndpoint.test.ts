import { mkdtemp, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createServer } from "vite";
import { bgmInstallPlugin, type BgmInstallOptions } from "../scripts/lib/bgmInstall";

async function harness(options: BgmInstallOptions) {
  const root = await mkdtemp(join(tmpdir(), "bgm-install-"));
  await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await copyFile("assets/bgm-release-v1.json", join(root, "assets/bgm-release-v1.json"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
  const server = await createServer({ configFile: false, root, cacheDir: join(root, ".cache"),
    logLevel: "silent", optimizeDeps: { noDiscovery: true, include: [] }, plugins: [bgmInstallPlugin(options)],
    server: { host: "127.0.0.1", port: 0 } });
  await server.listen(0);
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    root,
    request: (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) }),
    close: async () => { await server.close(); await rm(root, { recursive: true, force: true }); },
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

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
    await settle();
    const done = await (await h.request("/api/bgm/status")).json();
    expect(done.installing).toBe(false);
    expect(done.installed).toEqual(["done.mp3"]);
  } finally { await h.close(); }
}, 20000);

it("이미 설치가 돌고 있으면 두 번째 POST 는 409 다", async () => {
  const h = await harness({ install: () => new Promise<never>(() => {}) });
  try {
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    const second = await h.request("/api/bgm/install", { method: "POST" });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBeTruthy();
  } finally { await h.close(); }
}, 20000);

it("설치 실패는 status 의 error 로 드러나고 installing 이 풀린다", async () => {
  const h = await harness({ install: async () => { throw new Error("gh 실행 실패"); } });
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    await settle();
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
  const h = await harness({ install: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("취소됨")); }, { once: true });
  }) });
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    expect((await h.request("/api/bgm/install", { method: "DELETE" })).status).toBe(202);
    await settle();
    expect(aborted).toBe(true);
    expect((await (await h.request("/api/bgm/status")).json()).installing).toBe(false);
  } finally { await h.close(); }
}, 20000);
