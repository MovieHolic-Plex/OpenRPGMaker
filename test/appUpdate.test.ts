import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, lstatSync, readdirSync, symlinkSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { explainInstallError, extractLoginUrl, resolveInstalled, type InstallerPaths } from "../electron/main/agentInstaller";
import { appUpdateChipText, appUpdateModeFor, portableDownloadUrl, summarizeReleaseNotes } from "../electron/shared/appUpdate";
import { createHash } from "node:crypto";
import { ensureOnDemandAsset, ONDEMAND_MANIFEST_FILE, onDemandAssetFor, parseOnDemandManifest } from "../electron/main/assetsOnDemand";
import { planOnDemand } from "../scripts/desktop-ondemand-assets.mjs";
import { gzipSync, gunzipSync } from "node:zlib";
import { AssetStoreClient, isPrivateHost, sameOriginUrl, StoreError } from "../electron/main/assetStoreClient";
import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile } from "node:fs/promises";
import { createServer, preview, type Connect, type ViteDevServer, type PreviewServer } from "vite";
import { audioDeliveryPlugin } from "../scripts/lib/audioDelivery";
import * as releaseApi from "../scripts/lib/bgm-release.mjs";
import { bgmInstallPlugin, type BgmInstallOptions } from "../scripts/lib/bgmInstall";
import { cacheDirectoryAccepted, commitOwnedCacheFile, ensureCachedTrack } from "../electron/main/bgmOnDemand";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { BRIDGE_BODY_LIMIT, readBridgeRequestBody } from "../electron/serve/bridgeRequestBody";
import { OPRN_CHANNELS } from "../electron/shared/channels";
import { bridgeJsonParts, encodeBridgeRequest } from "../electron/browser/requestBody";
import { pathToFileURL } from "node:url";
import { CLI_PROJECT_STORE_FILE, electronUserArgIndex, inspectCliProjectArgs, projectDirFromOpenPath, shouldBootToStartScreen } from "../electron/main/cliProject";
import { decideAfterCloseFlush, decideCloseResponse, flushProjectForClose } from "../electron/main/closeFlow";
import { allowFolderSwitch, folderSwitchFlushOk, isAppRendererFrame } from "../electron/shared/folderSwitch";
import { acceptMenuFolder, prepareNewProjectDir } from "../electron/main/newProjectDir";
import { PLAYER_EDITOR_ONLY_ASSETS, stripEditorOnlyJson } from "../scripts/lib/playerEditorOnlyAssets.mjs";
import { isolateTimers } from "./mergedTeardown";

describe("agentInstaller", () => {
  isolateTimers();
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  function paths(platform: NodeJS.Platform): InstallerPaths {
    const agentsDir = mkdtempSync(join(tmpdir(), "oprn-agents-"));
    roots.push(agentsDir);
    return { agentsDir, npmCli: null, nodeCommand: "/app/OPRN Studio.exe", nodeEnv: { ELECTRON_RUN_AS_NODE: "1" }, platform, arch: "x64" };
  }
  function touch(file: string): void {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "");
  }
  describe("resolveInstalled", () => {
    it("runs the Claude ACP adapter through the app runtime and points it at the bundled official claude binary", () => {
      const p = paths("win32");
      const modules = join(p.agentsDir, "claude", "node_modules");
      touch(join(modules, "@agentclientprotocol", "claude-agent-acp", "dist", "index.js"));
      expect(resolveInstalled(p, "claude")).toBeNull();
      touch(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
      const found = resolveInstalled(p, "claude");
      expect(found?.adapter.command).toBe("/app/OPRN Studio.exe");
      expect(found?.adapter.env.ELECTRON_RUN_AS_NODE).toBe("1");
      expect(found?.adapter.env.CLAUDE_CODE_EXECUTABLE).toBe(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
      expect(found?.cli.command).toBe(join(modules, "@anthropic-ai", "claude-agent-sdk-win32-x64", "claude.exe"));
    });

    it("finds the opencode baseline binary without running its postinstall", () => {
      const p = paths("win32");
      touch(join(p.agentsDir, "opencode", "node_modules", "opencode-windows-x64-baseline", "bin", "opencode.exe"));
      expect(resolveInstalled(p, "opencode")?.adapter.args).toEqual(["acp"]);
    });
  });
  describe("explainInstallError", () => {
    it.each([
      ["npm error code ENOTFOUND\nnpm error request to https://registry.npmjs.org failed, reason: getaddrinfo ENOTFOUND", /인터넷/u],
      ["npm error code ECONNREFUSED proxy http://127.0.0.1:9", /프록시/u],
      ["npm error code ENOSPC: no space left on device", /디스크/u],
      ["npm error code EPERM: operation not permitted, rename", /백신/u],
      ["npm error code SELF_SIGNED_CERT_IN_CHAIN", /인증서/u],
    ])("maps %s to a Korean action", (output, expected) => {
      expect(explainInstallError(output, "win32")).toMatch(expected);
    });
  });
  describe("extractLoginUrl", () => {
    it("waits until the printed URL is complete", () => {
      expect(extractLoginUrl("visit: https://claude.com/cai/oauth/authorize?code=true&sta")).toBeNull();
      expect(extractLoginUrl("visit: https://claude.com/cai/oauth/authorize?code=true&state=x\nPaste code")).toBe("https://claude.com/cai/oauth/authorize?code=true&state=x");
    });
  });
});

// test/appUpdate.test.ts
// 앱 자동 업데이트의 순수 판단(electron/shared/appUpdate.ts). 설치 형태 판정이 틀리면 portable 이 스스로를
// 지우려 하거나(설치판 경로), 설치판이 칩만 띄우고 끝난다. 실제 교체·재시작은 CI e2e(app-update-e2e.yml)가 본다.
describe("appUpdate", () => {
  isolateTimers();
  describe("appUpdateModeFor", () => {
    it("윈도 portable 은 알리기만, 설치판은 자동", () => {
      expect(appUpdateModeFor({ platform: "win32", isPackaged: true, env: { PORTABLE_EXECUTABLE_FILE: "C:\\a.exe" } })).toBe("manual");
      expect(appUpdateModeFor({ platform: "win32", isPackaged: true, env: {} })).toBe("auto");
    });

    it("리눅스는 AppImage 로 켰을 때만 자동이고, 개발 실행·맥은 끈다", () => {
      expect(appUpdateModeFor({ platform: "linux", isPackaged: true, env: { APPIMAGE: "/x/OPRN.AppImage" } })).toBe("auto");
      expect(appUpdateModeFor({ platform: "linux", isPackaged: true, env: {} })).toBe("off");
      expect(appUpdateModeFor({ platform: "win32", isPackaged: false, env: {} })).toBe("off");
      expect(appUpdateModeFor({ platform: "darwin", isPackaged: true, env: {} })).toBe("off");
    });
  });
  describe("appUpdateChipText", () => {
    it("다 받았을 때와 portable 새 판일 때만 칩을 띄운다", () => {
      expect(appUpdateChipText({ kind: "ready", version: "0.420.0" })).toBe("v0.420 준비됨 · 다시 시작");
      expect(appUpdateChipText({ kind: "available", version: "0.420.0", downloadUrl: portableDownloadUrl("0.420.0") })).toBe("새 버전 있음 · 내려받기");
      expect(appUpdateChipText({ kind: "downloading", version: "0.420.0" })).toBeNull();
      expect(appUpdateChipText({ kind: "idle" })).toBeNull();
    });

    it("portable 링크는 그 판의 고정 이름 exe 다", () => {
      expect(portableDownloadUrl("v0.420.0")).toBe("https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/download/v0.420.0/OPRN.Studio-windows.exe");
    });
  });
  describe("summarizeReleaseNotes", () => {
    it("GitHub 피드 HTML 의 「주요 변경」 절에서 항목만 최대 3개 뽑고 PR 번호를 뗀다", () => {
      const html = "<h2>주요 변경</h2><ul><li>앱 안 자동 업데이트 (#5010)</li><li><strong>윈도</strong> 설치판</li><li>셋</li><li>넷</li></ul><h2>개발</h2><ul><li>내부</li></ul>";
      expect(summarizeReleaseNotes(html)).toEqual(["앱 안 자동 업데이트", "윈도 설치판", "셋"]);
    });

    it("「주요 변경」 절이 끝나면 다음 절 항목을 가져오지 않는다", () => {
      expect(summarizeReleaseNotes("## 주요 변경\n- 하나\n## 개발\n- 내부")).toEqual(["하나"]);
    });

    it("항목이 없거나 본문이 아니면 빈 배열", () => {
      expect(summarizeReleaseNotes("그냥 문장")).toEqual([]);
      expect(summarizeReleaseNotes(null)).toEqual([]);
    });
  });
});

describe("assetsOnDemand", () => {
  isolateTimers();
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  function tempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "ondemand-"));
    roots.push(root);
    return root;
  }
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const blob = (bytes: Uint8Array) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const BASE = "https://raw.githubusercontent.com/MovieHolic-Plex/OpenRPGMaker/abc123/public/";
  it("accepts only an https manifest with sized, hashed entries", () => {
    const files = { "assets/a.png": [3, "0".repeat(64)] };
    expect(parseOnDemandManifest({ base: BASE, files })).not.toBeNull();
    expect(parseOnDemandManifest({ base: "http://example.com/x/", files })).toBeNull();
    expect(parseOnDemandManifest({ base: BASE, files: { "assets/a.png": [3, "nothex"] } })).toBeNull();
  });
  it("maps a percent-encoded app path to the commit-pinned public URL and ignores unlisted paths", () => {
    const manifest = parseOnDemandManifest({ base: BASE, files: { "assets/shared/portraits/a b/bust-base.png": [3, "1".repeat(64)] } });
    expect(onDemandAssetFor(manifest, "assets/shared/portraits/a%20b/bust-base.png")?.url).toBe(`${BASE}assets/shared/portraits/a%20b/bust-base.png`);
    expect(onDemandAssetFor(manifest, "assets/shared/portraits/other.png")).toBeUndefined();
    expect(onDemandAssetFor(manifest, "constructor")).toBeUndefined();
  });
  it("downloads a listed file once, stores it under its hash and rejects bytes that do not match", async () => {
    const renderer = tempRoot();
    const cache = join(tempRoot(), "cache");
    const good = new Uint8Array([1, 2, 3, 4]);
    writeFileSync(join(renderer, ONDEMAND_MANIFEST_FILE), JSON.stringify({
      base: BASE,
      files: { "assets/region-references/a.oprn.json": [4, sha(good)], "assets/region-references/b.oprn.json": [4, sha(good)] },
    }));
    const asked: string[] = [];
    const serve = (bytes: Uint8Array): typeof fetch => async (input) => {
      asked.push(String(input));
      return new Response(bytes.slice().buffer);
    };
    const path = await ensureOnDemandAsset(renderer, "assets/region-references/a.oprn.json", cache, serve(good));
    expect(path).toBe(join(cache, `${sha(good)}.json`));
    expect([...readFileSync(path!)]).toEqual([...good]);
    expect(asked).toEqual([`${BASE}assets/region-references/a.oprn.json`]);
    expect(await ensureOnDemandAsset(renderer, "assets/region-references/a.oprn.json", cache, serve(good))).toBe(path);
    expect(asked).toHaveLength(1);

    const otherCache = join(tempRoot(), "cache");
    expect(await ensureOnDemandAsset(renderer, "assets/region-references/b.oprn.json", otherCache, serve(new Uint8Array([9, 9, 9, 9])))).toBeNull();
    expect(await ensureOnDemandAsset(renderer, "assets/unlisted.png", otherCache, serve(good))).toBeNull();
  });
  it("keeps demo-used portrait folders and files that differ from the commit, moves the rest", () => {
    const dist = tempRoot();
    const write = (rel: string, bytes: Uint8Array) => {
      mkdirSync(join(dist, rel, ".."), { recursive: true });
      writeFileSync(join(dist, rel), bytes);
      return bytes;
    };
    const used = write("assets/shared/portraits/people1-boy/bust-happy.png", new Uint8Array([1]));
    const free = write("assets/shared/portraits/people2-lion/bust-base.png", new Uint8Array([2]));
    write("assets/shared/portraits/people3-cat/bust-base.png", new Uint8Array([3]));
    const place = write("assets/region-references/gungnae.oprn.json", new Uint8Array([4]));
    write("assets/region-references/gungnae.png", new Uint8Array([5]));
    const blobs = new Map([
      ["assets/shared/portraits/people1-boy/bust-happy.png", blob(used)],
      ["assets/shared/portraits/people2-lion/bust-base.png", blob(free)],
      ["assets/shared/portraits/people3-cat/bust-base.png", blob(new Uint8Array([99]))],
      ["assets/region-references/gungnae.oprn.json", blob(place)],
    ]);
    const plan = planOnDemand({ distDir: dist, blobs, demos: '{"faceResourceId":"shared-people1-boy-expressions-02","faces":[{"assetId":"shared-people2-lion-expressions-00"}]}' });
    expect(plan.moved.map((item: { rel: string }) => item.rel).sort()).toEqual(["assets/region-references/gungnae.oprn.json", "assets/shared/portraits/people2-lion/bust-base.png"]);
    expect(plan.kept.demo).toEqual(["assets/shared/portraits/people1-boy/bust-happy.png"]);
    expect(plan.kept.untracked).toEqual(["assets/shared/portraits/people3-cat/bust-base.png"]);
  });
});

describe("assetStoreClient", () => {
  isolateTimers();
  describe("asset store client address rules", () => {
    it("allows plain http only for private hosts", () => {
      for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.0.5", "192.168.1.2", "172.20.0.1", "100.73.251.77", "mdc-server"]) expect(isPrivateHost(host), host).toBe(true);
      for (const host of ["10.evil.com", "192.168.1.2.evil.com", "100.73.251.77.nip.io", "store.openrpgmaker.com", "100.128.0.1", "172.32.0.1", "8.8.8.8"]) expect(isPrivateHost(host), host).toBe(false);
    });

    it("opens only same-origin login pages", () => {
      expect(sameOriginUrl("https://store.openrpgmaker.com/device?code=AB", "https://store.openrpgmaker.com")).toBe("https://store.openrpgmaker.com/device?code=AB");
      expect(sameOriginUrl("file:///etc/passwd", "https://store.openrpgmaker.com")).toBeNull();
      expect(sameOriginUrl("https://evil.example/device", "https://store.openrpgmaker.com")).toBeNull();
      expect(sameOriginUrl("not a url", "https://store.openrpgmaker.com")).toBeNull();
    });
  });
  describe("asset store client concept feed", () => {
    const SHA_FULL = "a".repeat(64);
    const SHA_CARD = "b".repeat(64);
    const card = (slug: string, extra: Record<string, unknown> = {}) => ({
      slug,
      title: "몸이 뒤바뀐 악역영애",
      hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
      description: "왕립 아카데미 무도회에서 시작하는 이야기.",
      tags: ["웹소설", "연애"],
      presetId: "story-cutscene",
      protagonist: "평민 소녀",
      stage: "왕립 아카데미",
      firstScene: "무도회장 거울 앞",
      brief: { experience: "처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
      thumb: { full: SHA_FULL, card: SHA_CARD },
      source: "official",
      madeCount: 3,
      aiGenerated: true,
      ...extra,
    });
    const roots: string[] = [];
    const requests: { url: string; method: string }[] = [];

    function client(respond: (url: string, init: RequestInit) => Response): AssetStoreClient {
      const root = mkdtempSync(join(tmpdir(), "oprn-store-client-"));
      roots.push(root);
      vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
        requests.push({ url: String(url), method: init.method ?? "GET" });
        return respond(String(url), init);
      }));
      return new AssetStoreClient(root, { load: () => null, save: () => undefined, persistent: () => false }, "https://store.example.com");
    }
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    afterEach(() => {
      vi.unstubAllGlobals();
      requests.length = 0;
      for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    it("normalizes a page of concepts and forwards the filters", async () => {
      const store = client(() => json({ items: [card("body-swap-villainess", { title: "  몸이 뒤바뀐 악역영애  ", aiGenerated: false })], nextCursor: "1000:24" }));
      const page = await store.concepts({ tag: "웹소설", cursor: "1000:0", q: "" });
      expect(page.nextCursor).toBe("1000:24");
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.title).toBe("몸이 뒤바뀐 악역영애");
      expect(page.items[0]!.aiGenerated).toBe(true);
      expect(page.items[0]!.madeCount).toBe(3);
      const url = new URL(requests[0]!.url);
      expect(url.pathname).toBe("/api/v1/concepts");
      expect(url.searchParams.get("tag")).toBe("웹소설");
      expect(url.searchParams.get("cursor")).toBe("1000:0");
      expect(url.searchParams.has("q")).toBe(false);
    });

    it("rejects malformed concepts from the server (unknown preset, non-sha thumbnail)", async () => {
      const badPreset = client(() => json({ concept: card("bad-preset", { presetId: "rts" }), similar: [] }));
      await expect(badPreset.concept({ slug: "bad-preset" })).rejects.toBeInstanceOf(StoreError);
      const badThumb = client(() => json({ items: [card("bad-thumb", { thumb: { full: "https://evil.example/x.png", card: SHA_CARD } })], nextCursor: null }));
      await expect(badThumb.concepts({})).rejects.toBeInstanceOf(StoreError);
      const ok = client(() => json({ concept: card("good-one"), similar: [card("good-two")] }));
      const detail = await ok.concept({ slug: "good-one" });
      expect(detail.similar.map((item) => item.slug)).toEqual(["good-two"]);
    });

    it("reports made as a boolean and never throws", async () => {
      const ok = client(() => new Response(null, { status: 204 }));
      await expect(ok.conceptMade({ slug: "good-one" })).resolves.toBe(true);
      expect(requests.at(-1)).toEqual({ url: "https://store.example.com/api/v1/concepts/good-one/made", method: "POST" });
      const missing = client(() => json({ error: "not_found", message: "컨셉을 찾을 수 없습니다." }, 404));
      await expect(missing.conceptMade({ slug: "gone-one" })).resolves.toBe(false);
      const offline = client(() => { throw new TypeError("fetch failed"); });
      await expect(offline.conceptMade({ slug: "good-one" })).resolves.toBe(false);
    });

    it("refuses a pack bundle larger than manifest + pack limits before reading it", async () => {
      const store = client((url) => url.endsWith("/bundle")
        ? new Response(new Uint8Array(8), { status: 200, headers: { "content-length": String(200 * 1024 * 1024) } })
        : json({ slug: "big-pack", latestVersion: 1 }));
      await expect(store.install("big-pack", () => undefined)).rejects.toThrow("스토어 응답이 너무 큽니다.");
      expect(requests.some((request) => request.url.endsWith("/manifest"))).toBe(false);
    });

    it("refuses a gzip bundle that inflates past the limit", async () => {
      const bomb = gzipSync(Buffer.alloc(190 * 1024 * 1024));
      const store = client((url) => url.endsWith("/bundle") ? new Response(bomb, { status: 200 }) : json({ slug: "bomb", latestVersion: 1 }));
      await expect(store.install("bomb", () => undefined)).rejects.toThrow("스토어 응답이 너무 큽니다.");
    });

    it("asks a store without /bundle only once per address", async () => {
      const store = client((url) => url.endsWith("/bundle") ? json({ message: "없는 주소입니다." }, 404)
        : url.endsWith("/manifest") ? json({ message: "점검 중" }, 503) : json({ slug: "old-server", latestVersion: 1 }));
      await expect(store.install("old-server", () => undefined)).rejects.toBeInstanceOf(StoreError);
      await expect(store.install("old-server", () => undefined)).rejects.toBeInstanceOf(StoreError);
      expect(requests.filter((request) => request.url.endsWith("/bundle"))).toHaveLength(1);
    });

    it("re-downloads a cached blob whose bytes no longer match its sha256", async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
      const sha = createHash("sha256").update(png).digest("hex");
      const store = client(() => new Response(png, { status: 200 }));
      const shard = join(roots.at(-1)!, "blobs", sha.slice(0, 2));
      mkdirSync(shard, { recursive: true });
      writeFileSync(join(shard, sha), "tampered");
      expect(await store.blob(sha)).toEqual(png);
      expect(requests.map((request) => request.url)).toEqual([`https://store.example.com/api/v1/blobs/${sha}`]);
    });

    it("reports an item through the store API", async () => {
      const store = client(() => json({ hidden: false }));
      await expect(store.report("some-item", "copyright", "원본 출처가 다릅니다")).resolves.toEqual({ hidden: false });
      expect(requests).toEqual([{ url: "https://store.example.com/api/v1/items/some-item/reports", method: "POST" }]);
    });
  });
});

describe("audioDeliveryHttp", () => {
  isolateTimers();
  it.each(["dev", "preview"])("serves real media bytes/ranges and missing-media 404s through Vite %s", async mode => {
    const root = await mkdtemp(join(tmpdir(), "audio-delivery-"));
    const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
    for (const directory of ["public", "dist"]) {
      await mkdir(join(root, directory, "assets"), { recursive: true });
      await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, directory, "assets/valid.wav"));
    }
    await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
    await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
    const config = { configFile: false as const, root, cacheDir: join(root, ".cache"), logLevel: "silent" as const,
      optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()] };
    const server = mode === "dev"
      ? await createServer({ ...config, server: { host: "127.0.0.1", port: 0 } })
      : await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
    try {
      if ("listen" in server) await server.listen(0);
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
      const origin = `http://127.0.0.1:${address.port}`;
      const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
      const response = await request("/assets/valid.wav");
      expect(response.headers.get("content-type")).toMatch(/^audio\//);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      const range = await request("/assets/valid.wav", { headers: { Range: "bytes=0-31" } });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
      for (const method of ["GET", "HEAD"]) {
        const absent = await request("/assets/absent.mp3?cache=1", { method });
        expect(absent.status).toBe(404);
        expect(absent.headers.get("content-type")).not.toMatch(/text\/html/);
      }
      expect((await request("/ordinary-spa-route")).status).toBe(200);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);
  // 에디터에서 팩을 설치하면 파일은 public/ 으로 들어가지만 preview 는 dist/ 를 서빙한다.
  // 폴백이 없으면 재빌드 전까지 새로 받은 281곡이 전부 404 다.
  it("preview 는 dist 에 없는 카탈로그 파일을 public 에서 서빙한다", async () => {
    const root = await mkdtemp(join(tmpdir(), "audio-preview-fallback-"));
    const bytes = await readFile("public/assets/cc0/audio/ui-confirm.wav");
    await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
    await mkdir(join(root, "dist/assets"), { recursive: true });
    // public 에만 둔다 — 설치 직후 재빌드 전 상태를 그대로 재현한다.
    await copyFile("public/assets/cc0/audio/ui-confirm.wav", join(root, "public/assets/cc0/audio/catalog/late.wav"));
    await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
    await copyFile(join(root, "index.html"), join(root, "dist/index.html"));
    const server = await preview({ configFile: false, root, cacheDir: join(root, ".cache"), logLevel: "silent",
      optimizeDeps: { noDiscovery: true, include: [] }, plugins: [audioDeliveryPlugin()],
      preview: { host: "127.0.0.1", port: 0 } });
    try {
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
      const request = (path: string, init?: RequestInit) =>
        fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
      const response = await request("/assets/cc0/audio/catalog/late.wav");
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      // 폴백은 기본 정적 미들웨어를 안 거치므로 Range 를 직접 지켜야 한다.
      const range = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=0-31" } });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(0, 32));
      const suffix = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: "bytes=-32" } });
      expect(suffix.status).toBe(206);
      expect(Buffer.from(await suffix.arrayBuffer())).toEqual(bytes.subarray(-32));
      const head = await request("/assets/cc0/audio/catalog/late.wav", { method: "HEAD" });
      expect(head.headers.get("content-length")).toBe(String(bytes.length));
      expect(await head.text()).toBe("");
      for (const value of [`bytes=${bytes.length}-`, "bytes=-0"]) {
        const invalid = await request("/assets/cc0/audio/catalog/late.wav", { headers: { Range: value } });
        expect(invalid.status).toBe(416);
        expect(invalid.headers.get("content-range")).toBe(`bytes */${bytes.length}`);
        expect(await invalid.text()).toBe("");
      }
      expect((await request("/assets/cc0/audio/catalog/absent.mp3")).status).toBe(404);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 20000);
});

describe("bgmInstallEndpoint", () => {
  isolateTimers();
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
});

describe("bgmOnDemandCache", () => {
  isolateTimers();
  const roots: string[] = [];
  const track = { fileName: "rtp-fld-001-test.mp3", bytes: 4, sha256: "abcd" };
  const fetch404: typeof fetch = async () => new Response(null, { status: 404 });
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  it("does not follow a cache directory or file that is a symlink", async () => {
    const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
    roots.push(root);
    const outside = join(root, "outside");
    mkdirSync(outside, { mode: 0o700 });
    writeFileSync(join(outside, "secret.txt"), "secret");
    const linkedDir = join(root, "linked-dir");
    symlinkSync(outside, linkedDir);
    expect(await ensureCachedTrack(track, linkedDir, fetch404)).toBeNull();

    const cache = join(root, "owned");
    mkdirSync(cache, { mode: 0o700 });
    symlinkSync(join(outside, "secret.txt"), join(cache, track.fileName));
    expect(await ensureCachedTrack(track, cache, fetch404)).toBeNull();
    expect(lstatSync(join(cache, track.fileName)).isSymbolicLink()).toBe(true);
  });
  it("accepts a Windows cache whose mode has group and other write bits and serves a stored track", async () => {
    const windowsDir = { isDirectory: () => true, uid: 0, mode: 0o40777 };
    expect(cacheDirectoryAccepted(windowsDir, "win32", undefined)).toBe(true);
    expect(cacheDirectoryAccepted(windowsDir, "linux", 1000)).toBe(false);
    expect(cacheDirectoryAccepted({ isDirectory: () => true, uid: 1000, mode: 0o40700 }, "linux", 1000)).toBe(true);
    expect(cacheDirectoryAccepted({ isDirectory: () => true, uid: 0, mode: 0o40700 }, "linux", 1000)).toBe(false);

    const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
    roots.push(root);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const ready = { fileName: "ready.mp3", bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
    writeFileSync(join(root, ready.fileName), bytes);
    expect(await ensureCachedTrack(ready, root, fetch404)).toBe(join(root, ready.fileName));
  });
  it("drops the temporary file when a cache write cannot finish", async () => {
    const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
    roots.push(root);
    const bytes = new Uint8Array([9, 9, 9, 9]);
    const trackInMissingDir = {
      fileName: "missing-dir/track.mp3",
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await ensureCachedTrack(trackInMissingDir, root, async () => new Response(body))).toBeNull();
    expect(readdirSync(root).filter((name) => name.endsWith(".part"))).toEqual([]);
  });
  function readyTrack(bytes: Uint8Array): { fileName: string; bytes: number; sha256: string } {
    return { fileName: "fresh.mp3", bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  function responseFor(bytes: Uint8Array): typeof fetch {
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return async () => new Response(body);
  }
  it("keeps a temporary file that this attempt did not create", async () => {
    const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
    roots.push(root);
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const bytes = new Uint8Array([7, 7, 7, 7]);
      const track = readyTrack(bytes);
      const partial = `${join(root, track.fileName)}.${process.pid}.${now}.part`;
      writeFileSync(partial, "keep");
      expect(await ensureCachedTrack(track, root, responseFor(bytes))).toBeNull();
      expect(readFileSync(partial, "utf8")).toBe("keep");
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("removes the temporary file when the finished name is a directory", () => {
    const root = mkdtempSync(join(tmpdir(), "bgm-cache-"));
    roots.push(root);
    const target = join(root, "track.mp3");
    mkdirSync(target);
    writeFileSync(join(target, "keep.txt"), "keep");
    expect(() => commitOwnedCacheFile(target, new Uint8Array([8, 8, 8, 8]))).toThrow();
    expect(readdirSync(root).filter((name) => name.includes(".part"))).toEqual([]);
    expect(readFileSync(join(target, "keep.txt"), "utf8")).toBe("keep");
  });
});

describe("bridgeRequestBody", () => {
  isolateTimers();
  function request(channel: string, decodedBytes: number, declaredLength?: number): IncomingMessage {
    const payload = "x".repeat(decodedBytes);
    const body = gzipSync(JSON.stringify({ channel, payload: { blob: payload } }), { level: 1 });
    const stream = new PassThrough() as unknown as IncomingMessage & PassThrough;
    Object.assign(stream, { headers: { "x-oprn-channel": channel, "content-encoding": "gzip", "content-length": String(declaredLength ?? body.length) } });
    queueMicrotask(() => stream.end(body));
    return stream;
  }
  const overBridgeLimit = BRIDGE_BODY_LIMIT + 1024 * 1024;
  describe("bridge request body limits", () => {
    it("accepts a map patch larger than the general 64MB decoded bound, like a full save", async () => {
      // A first save after load normalization carries nearly every tileset (2026-09-26: 96MB decoded).
      const envelope = await readBridgeRequestBody(request(OPRN_CHANNELS.projectSaveMapPatch, overBridgeLimit));
      expect(envelope.channel).toBe(OPRN_CHANNELS.projectSaveMapPatch);
      const full = await readBridgeRequestBody(request(OPRN_CHANNELS.projectSave, overBridgeLimit));
      expect(full.channel).toBe(OPRN_CHANNELS.projectSave);
    }, 60_000);

    it("lets project documents send more than 64MB of gzip", async () => {
      // 2026-09-28: a new project's first full save was 69MB gzip (187MB decoded) and got 413 on every retry.
      const overWire = BRIDGE_BODY_LIMIT + 1;
      for (const channel of [OPRN_CHANNELS.projectSave, OPRN_CHANNELS.projectSaveMapPatch, OPRN_CHANNELS.startCreateProject]) {
        expect((await readBridgeRequestBody(request(channel, 16, overWire))).channel).toBe(channel);
      }
      await expect(readBridgeRequestBody(request(OPRN_CHANNELS.teamStatus, 16, overWire))).rejects.toMatchObject({ statusCode: 413 });
    });

    it("keeps the 64MB decoded bound for other channels", async () => {
      await expect(readBridgeRequestBody(request(OPRN_CHANNELS.teamStatus, overBridgeLimit))).rejects.toMatchObject({ statusCode: 413 });
    }, 60_000);
  });
});

describe("browserBridgeRequestEncoding", () => {
  isolateTimers();
  describe("browser bridge request encoding", () => {
    it("matches JSON.stringify byte for byte across chunk boundaries", () => {
      const cases: unknown[] = [
        { a: 1, b: undefined, c: [undefined, () => 1, null, Number.NaN, "s"], d: new Date(0), e: { toJSON: () => undefined }, f: "가😀".repeat(50), g: [[1, 2], { h: "x".repeat(300) }], i: "" },
        { big: "a".repeat(1000) + "😀" + "b".repeat(1000), arr: ["😀".repeat(400), 1, { z: "q\n\"\u0001".repeat(200) }] },
        "top", 5, null, [], {}, [{ a: [] }],
      ];
      for (const value of cases) {
        for (const chunk of [1, 2, 3, 7, 64, 4096]) expect(bridgeJsonParts(value, chunk).join("")).toBe(JSON.stringify(value));
      }
    });

    it("never quotes a long string in one piece", () => {
      // 2026-09-28: Firefox threw «allocation size overflow» quoting a 187M-char full-save document in one go.
      const serialized = "x".repeat(1000);
      const parts = bridgeJsonParts({ channel: "oprn:project.save", payload: { serialized } }, 64);
      expect(parts.length).toBeGreaterThan(10);
      expect(Math.max(...parts.map((part) => part.length))).toBeLessThan(200);
      expect(JSON.parse(parts.join(""))).toEqual({ channel: "oprn:project.save", payload: { serialized } });
    });

    it("rejects cycles like JSON.stringify", () => {
      const cycle: Record<string, unknown> = {};
      cycle.self = cycle;
      expect(() => bridgeJsonParts(cycle)).toThrow(TypeError);
    });

    it("gzips the joined parts", async () => {
      const value = { channel: "oprn:project.save", payload: { serialized: "가".repeat(2 * 1024 * 1024) } };
      const encoded = await encodeBridgeRequest(value);
      expect(encoded.headers["content-encoding"]).toBe("gzip");
      const bytes = new Uint8Array(await (encoded.body as Blob).arrayBuffer());
      expect(gunzipSync(bytes).toString("utf8")).toBe(JSON.stringify(value));
    });
  });
});

describe("cliProjectFolder", () => {
  isolateTimers();
  const roots: string[] = [];
  function scratch(): string {
    // /tmp 가 심볼릭 링크면 명령줄 해석(realpath)과 테스트가 만든 경로가 달라진다.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "oprn-cli-project-")));
    roots.push(dir);
    return dir;
  }
  function project(parent: string, name = "game"): string {
    const dir = join(parent, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CLI_PROJECT_STORE_FILE), "not-a-real-database");
    return dir;
  }
  afterEach(() => {
    for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  describe("CLI project folder arguments", () => {
    it("treats the electron app path as not a user argument", () => {
      expect(electronUserArgIndex(false)).toBe(1);
      expect(electronUserArgIndex(true)).toBe(2);
    });

    it("opens the first directory that contains project.sqlite and skips switches", () => {
      const root = scratch();
      const game = project(root);
      const hit = inspectCliProjectArgs(
        ["/opt/OPRN/oprn", "--no-sandbox", "--disable-gpu", game],
        root,
      );
      expect(hit).toEqual({ dir: game, ignored: [] });
    });

    it("keeps a store deep link out of the project scan", () => {
      const root = scratch();
      const game = project(root);
      const link = "oprn://store/install?store=https%3A%2F%2Fstore.openrpgmaker.com&slug=forest-pack";
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", link, "--ozone-platform=x11", game], root);
      expect(hit.dir).toBe(game);
      expect(hit.ignored).toEqual([]);
    });

    it("resolves a relative path against the caller working directory", () => {
      const root = scratch();
      project(root, "quest");
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "quest"], root);
      expect(hit.dir).toBe(join(root, "quest"));
    });

    it("skips the dev-app entry when fromIndex is 2, even if that entry is a directory", () => {
      const root = scratch();
      const game = project(root, "game");
      const appDir = join(root, "app");
      mkdirSync(appDir);
      const hit = inspectCliProjectArgs(["/usr/bin/electron", appDir, "game"], root, { fromIndex: 2 });
      expect(hit).toEqual({ dir: game, ignored: [] });
    });

    it("expands a leading tilde with the given home directory", () => {
      const home = scratch();
      const game = project(home, "quest");
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "~/quest"], "/somewhere/else", { homedir: home });
      expect(hit.dir).toBe(game);
    });

    it("accepts a file URL for a project folder", () => {
      const root = scratch();
      const game = project(root);
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", pathToFileURL(game).href], root);
      expect(hit.dir).toBe(game);
    });

    it("opens the parent folder when the command line points at project.sqlite", () => {
      const root = scratch();
      const game = project(root);
      const store = join(game, CLI_PROJECT_STORE_FILE);
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn", store], root)).toEqual({ dir: game, ignored: [] });
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn", pathToFileURL(store).href], root).dir).toBe(game);
    });

    it("follows a symlink to the project directory", () => {
      const root = scratch();
      const game = project(root, "real");
      const link = join(root, "link");
      symlinkSync(game, link);
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", link], root);
      expect(hit.dir).toBe(game);
    });

    it("ignores a missing path, a file, and a folder with no project store", () => {
      const root = scratch();
      const empty = join(root, "empty");
      mkdirSync(empty);
      const file = join(root, "notes.txt");
      writeFileSync(file, "hello");
      const missing = join(root, "missing");
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", missing, file, empty], root);
      expect(hit.dir).toBeNull();
      expect(hit.ignored).toEqual([missing, file, empty]);
    });

    it("does not treat a directory named project.sqlite as the store file", () => {
      const root = scratch();
      const dir = join(root, "odd");
      mkdirSync(join(dir, CLI_PROJECT_STORE_FILE), { recursive: true });
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", dir], root);
      expect(hit).toEqual({ dir: null, ignored: [dir] });
    });

    it("continues after an invalid path and opens the next project", () => {
      const root = scratch();
      const game = project(root);
      const missing = join(root, "nope");
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", missing, game], root);
      expect(hit).toEqual({ dir: game, ignored: [missing] });
    });

    it("stops at the first project when several are passed", () => {
      const root = scratch();
      const first = project(root, "first");
      const second = project(root, "second");
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", first, second], root);
      expect(hit).toEqual({ dir: first, ignored: [] });
    });

    it("does not warn about an app entry file the wrapper passed through", () => {
      const root = scratch();
      const entry = join(root, "app.asar");
      writeFileSync(entry, "bundle");
      const script = join(root, "main.cjs");
      writeFileSync(script, "module.exports = {}");
      const game = project(root);
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn", entry, script], root)).toEqual({ dir: null, ignored: [] });
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn", entry, game], root).dir).toBe(game);
    });

    it("ignores a bare name that is not a path and does not throw on a bad file URL", () => {
      const root = scratch();
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn", "main.cjs", "file://%"], root)).toEqual({
        dir: null,
        ignored: ["file://%"],
      });
      expect(inspectCliProjectArgs(["/opt/OPRN/oprn"], root)).toEqual({ dir: null, ignored: [] });
    });

    it("opens a folder from macOS open-file when it contains project.sqlite", () => {
      const root = scratch();
      const game = project(root);
      expect(projectDirFromOpenPath(game)).toBe(game);
    });

    it("opens the parent folder when open-file points at project.sqlite", () => {
      const root = scratch();
      const game = project(root);
      expect(projectDirFromOpenPath(join(game, CLI_PROJECT_STORE_FILE))).toBe(game);
    });

    it("does not open a file, an empty folder, or a directory named project.sqlite", () => {
      const root = scratch();
      const empty = join(root, "empty");
      mkdirSync(empty);
      const notes = join(root, "notes.txt");
      writeFileSync(notes, "hello");
      const odd = join(root, "odd");
      mkdirSync(join(odd, CLI_PROJECT_STORE_FILE), { recursive: true });
      expect(projectDirFromOpenPath(notes)).toBeNull();
      expect(projectDirFromOpenPath(empty)).toBeNull();
      expect(projectDirFromOpenPath(odd)).toBeNull();
      expect(projectDirFromOpenPath(join(odd, CLI_PROJECT_STORE_FILE))).toBeNull();
      expect(projectDirFromOpenPath("")).toBeNull();
    });

    it("follows an open-file symlink to the project directory", () => {
      const root = scratch();
      const game = project(root, "real");
      const link = join(root, "link");
      symlinkSync(game, link);
      expect(projectDirFromOpenPath(link)).toBe(game);
    });

    it("skips the start screen only for QA or a project chosen on the command line or via open-file", () => {
      const none = { smokePage: false, openProjectDirEnv: false, cliProjectDir: null, openFileProjectDir: null };
      expect(shouldBootToStartScreen(none)).toBe(true);
      expect(shouldBootToStartScreen({ ...none, cliProjectDir: "/games/quest" })).toBe(false);
      expect(shouldBootToStartScreen({ ...none, openFileProjectDir: "/games/quest" })).toBe(false);
      expect(shouldBootToStartScreen({ ...none, smokePage: true })).toBe(false);
      expect(shouldBootToStartScreen({ ...none, openProjectDirEnv: true, openFileProjectDir: "/games/quest" })).toBe(false);
    });

    it("swallows a probe that throws", () => {
      const hit = inspectCliProjectArgs(["/opt/OPRN/oprn", "/tmp/oprn-cli-boom"], "/tmp", {
        isProjectDir: () => { throw new Error("boom"); },
      });
      expect(hit.dir).toBeNull();
      expect(hit.ignored).toEqual(["/tmp/oprn-cli-boom"]);
    });
  });
});

describe("constructionHarness", () => {
  isolateTimers();
  describe("construction:harness verifier", () => {
    it("binds the package command to the dependency-free local Node wrapper", () => {
      // Given
      const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

      // When
      const command = Reflect.get(Reflect.get(packageJson, "scripts"), "construction:harness");

      // Then
      expect(command).toBe("node scripts/run-construction-harness.mjs");
      expect(existsSync(resolve("scripts/run-construction-harness.mjs"))).toBe(true);
    });
  });
});

describe("electronCloseFlow", () => {
  isolateTimers();
  describe("desktop close decisions", () => {
    it("closes after either save attempt reports success", () => {
      expect(decideAfterCloseFlush("auto", true)).toBe("close");
      expect(decideAfterCloseFlush("save", true)).toBe("close");
    });

    it("asks what to do when the automatic save fails or times out", () => {
      expect(decideAfterCloseFlush("auto", false)).toBe("confirm");
      expect(decideAfterCloseFlush("auto", undefined)).toBe("confirm");
    });

    it("closes a clean project without contacting the disconnected host", async () => {
      const project = {
        hasUnsavedChanges: () => false,
        flush: vi.fn().mockRejectedValue(new Error("host offline")),
      };
      expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("close");
      expect(project.flush).not.toHaveBeenCalled();
    });

    it("checks for remaining edits even when the save reports a failure", async () => {
      let dirty = true;
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const project = {
        hasUnsavedChanges: () => dirty,
        flush: vi.fn().mockRejectedValue(new Error("host offline")),
      };
      try {
        expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("confirm");
        expect(decideAfterCloseFlush("save", await flushProjectForClose(project))).toBe("report-failure");
        project.flush.mockImplementationOnce(async () => {
          dirty = false;
          throw new Error("an older request failed after the current version was saved");
        });
        expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("close");
      } finally {
        log.mockRestore();
      }
    });

    it("keeps the editor open and reports failure after an unsuccessful explicit save", () => {
      expect(decideAfterCloseFlush("save", false)).toBe("report-failure");
      expect(decideAfterCloseFlush("save", undefined)).toBe("report-failure");
    });

    it("maps the native buttons and treats dismissal as Cancel", () => {
      expect(decideCloseResponse(0)).toBe("save");
      expect(decideCloseResponse(1)).toBe("discard");
      expect(decideCloseResponse(2)).toBe("cancel");
      expect(decideCloseResponse(-1)).toBe("cancel");
    });
  });
});

describe("electronFolderSwitch", () => {
  isolateTimers();
  describe("folder switch flush", () => {
    it("accepts a settled save with nothing left dirty", () => {
      expect(folderSwitchFlushOk({ kind: "saved", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "saved-local", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "not-loaded", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "not-configured", dirty: false })).toBe(true);
      expect(folderSwitchFlushOk({ kind: "disabled", dirty: false })).toBe(true);
    });

    it.each(["blocked", "timeout"] as const)("continues after %s only on explicit discard", async result => {
      const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      expect(await allowFolderSwitch(result, confirm)).toBe(false);
      expect(await allowFolderSwitch(result, confirm)).toBe(true);
      expect(confirm).toHaveBeenCalledWith(result);
      expect(await allowFolderSwitch("closed", confirm)).toBe(false);
      expect(await allowFolderSwitch("unavailable", confirm)).toBe(false);
      expect(confirm).toHaveBeenCalledTimes(2);
    });

    it("refuses a save that left changes, a conflict, or a bad report", () => {
      expect(folderSwitchFlushOk({ kind: "saved", dirty: true })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "conflict", dirty: false })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "error", dirty: true })).toBe(false);
      expect(folderSwitchFlushOk({ kind: "saved" })).toBe(false);
      expect(folderSwitchFlushOk({ dirty: false })).toBe(false);
      expect(folderSwitchFlushOk(null)).toBe(false);
      expect(folderSwitchFlushOk("saved")).toBe(false);
    });
  });
  describe("app renderer frame", () => {
    it("trusts the app scheme and the dev server origin only", () => {
      expect(isAppRendererFrame("app://oprn/index.html", undefined)).toBe(true);
      expect(isAppRendererFrame("http://127.0.0.1:9999/index.html", "http://127.0.0.1:9999/")).toBe(true);
      expect(isAppRendererFrame("http://127.0.0.1:9998/index.html", "http://127.0.0.1:9999/")).toBe(false);
      expect(isAppRendererFrame("https://example.com/", "http://127.0.0.1:9999/")).toBe(false);
      expect(isAppRendererFrame("http://127.0.0.1:9999/", undefined)).toBe(false);
      expect(isAppRendererFrame("not a url", "http://[")).toBe(false);
    });
  });
});

describe("newProjectDir", () => {
  isolateTimers();
  const roots: string[] = [];
  function scratch(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "oprn-new-project-")));
    roots.push(dir);
    return dir;
  }
  afterEach(() => {
    for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  describe("new project folder", () => {
    it("creates a missing absolute folder", () => {
      const root = scratch();
      const dir = prepareNewProjectDir(join(root, "game"));
      expect(dir).toBe(join(root, "game"));
      expect(existsSync(dir)).toBe(true);
    });

    it("accepts an empty directory", () => {
      const root = scratch();
      const empty = join(root, "empty");
      mkdirSync(empty);
      expect(prepareNewProjectDir(empty)).toBe(empty);
    });

    it("refuses a folder that already has files and leaves them in place", () => {
      const root = scratch();
      const photos = join(root, "photos");
      mkdirSync(photos);
      writeFileSync(join(photos, "holiday.txt"), "keep");
      expect(() => prepareNewProjectDir(photos)).toThrow(/이미 파일이 있는 폴더/);
      expect(existsSync(join(photos, "holiday.txt"))).toBe(true);
      expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
    });

    it("refuses a file path and a relative path", () => {
      const root = scratch();
      const file = join(root, "notes.txt");
      writeFileSync(file, "x");
      expect(() => prepareNewProjectDir(file)).toThrow(/이미 파일이 있는 폴더/);
      expect(() => prepareNewProjectDir("games/new")).toThrow(/절대 경로/);
    });

    it("lets Open keep a non-empty folder and makes New refuse it", () => {
      const root = scratch();
      const photos = join(root, "photos");
      mkdirSync(photos);
      writeFileSync(join(photos, "holiday.txt"), "keep");
      expect(acceptMenuFolder(photos, "open")).toBe(photos);
      expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
      expect(() => acceptMenuFolder(photos, "new")).toThrow(/이미 파일이 있는 폴더/);
      expect(existsSync(join(photos, "project.sqlite"))).toBe(false);
    });
  });
});

describe("playerEditorOnlyAssets", () => {
  isolateTimers();
  const root = resolve(__dirname, "..");
  describe("player builds drop editor-only tileset reference documents", () => {
    it.each(Object.entries(PLAYER_EDITOR_ONLY_ASSETS))("%s strips to a same-shaped value (%s)", (file, mode) => {
      const text = readFileSync(resolve(root, file), "utf8");
      const original = JSON.parse(text) as unknown;
      const stripped = JSON.parse(stripEditorOnlyJson(mode, text)) as Record<string, unknown>;
      if (mode === "whole") {
        expect(stripped).toEqual(Array.isArray(original) ? [] : {});
      } else {
        const { referenceDocuments, ...rest } = original as Record<string, unknown>;
        expect(Array.isArray(referenceDocuments), "field mode needs a referenceDocuments array to drop").toBe(true);
        expect(stripped).toEqual({ ...rest, referenceDocuments: [] });
      }
    });

    // Not tileset reference categories: opening-effect research (editor tools only) and the shared village library.
    const NOT_TILESET_REFERENCES = new Set(["src/assets/openingReferences.json", "src/assets/sharedVillageReferences.json"]);

    it("lists every shipped tileset reference file", () => {
      const shipped = readdirSync(resolve(root, "src/assets"))
        .filter((name) => name.endsWith("References.json"))
        .map((name) => `src/assets/${name}`)
        .filter((file) => !NOT_TILESET_REFERENCES.has(file));
      expect(shipped.filter((file) => !(file in PLAYER_EDITOR_ONLY_ASSETS))).toEqual([]);
    });
  });
});
