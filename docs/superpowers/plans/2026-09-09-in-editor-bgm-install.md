# 에디터 내 BGM 팩 설치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에디터 안에서 버튼 하나로 GitHub 릴리스 BGM 팩(281곡·1.3GB)을 받고, 서버 재시작 없이 바로 재생 가능하게 만든다.

**Architecture:** 비공개 레포라 `gh` 자격증명이 필요하므로 vite 미들웨어가 `installRelease` 를 대신 호출한다(새 안전장치 없음 — 잠금·검증·원자적 교체가 이미 있다). 클라이언트는 빌드타임 define 을 *부팅 시드* 로만 쓰고, 설치 후 런타임 값으로 덮어써서 `isCatalogBgmAvailable` 의 동기 시그니처를 유지한다. preview 는 `dist/` 에 없는 카탈로그 파일을 `public/` 에서 서빙해 재빌드를 없앤다.

**Tech Stack:** TypeScript, Vite 플러그인(`Connect.NextHandleFunction`), vitest, 기존 `scripts/lib/bgm-release.mjs`

**Spec:** `docs/superpowers/specs/2026-09-09-in-editor-bgm-install-design.md`

## Global Constraints

- 테스트 실행: `npm test -- <파일>` (= `node scripts/run-vitest.mjs run --configLoader bundle`)
- 릴리스 상수는 `assets/bgm-release-v1.json` 이 유일한 출처. 281곡 / archive `1304157696` B / tag `bgm-v1` / repo `MovieHolic-Plex/rpg-zzu` 를 코드에 하드코딩하지 않는다.
- 카탈로그 나열 규칙은 한 곳에서만 정의한다: `/\.(?:mp3|wav)$/i` + `size > 0`. 빌드타임 시드와 런타임 status 가 반드시 같은 헬퍼를 부른다.
- `isCatalogBgmAvailable(resourceId: string): boolean` 은 **동기 시그니처를 유지**한다. 소비처 7개 파일은 수정하지 않는다.
- 기존 테스트 `test/audioInventoryDelivery.test.ts` 가 `vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", …)` 로 define 을 갈아끼운다. **모듈 로드 시점에 시드를 고정하면 이 테스트가 깨진다** — 런타임 override 가 없을 때는 매 호출마다 define 을 읽어야 한다.
- 서버 전용 환경변수는 non-VITE: `RPG_ZZU_BGM_INSTALL_REMOTE`. 번들에 인라인되면 안 된다.
- 오류 응답 본문은 `{ "error": string }` 한 형태로 통일.
- 커밋 스타일: `type(scope): 제목` + 왜 그런지 설명하는 본문 + `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/assets/installedBgm.ts` (신규) | 설치 파일명 판정 하나. 빌드타임 시드 + 런타임 override |
| `src/assets/audioResourceCatalog.ts` (수정) | define 직접 참조를 제거하고 위 모듈만 본다 |
| `scripts/lib/bgmCatalogDir.ts` (신규) | 카탈로그 디렉터리 나열 규칙 하나 |
| `scripts/lib/audioDelivery.ts` (수정) | 나열 규칙 공유 + preview 의 `public/` 폴백 |
| `scripts/lib/bgmInstall.ts` (신규) | status/install/cancel 엔드포인트 + 접근 가드 |
| `src/editor/bgmInstallClient.ts` (신규) | status 조회·설치 시작/중단·폴링·이벤트 |
| `src/editor/panels/bgmInstallBanner.ts` (신규) | 배너 DOM |
| `vite.config.ts` (수정) | 플러그인 등록 |
| `.env.example` (수정) | opt-in 문서화 |

---

## Task 1: 런타임 설치 판정

**Files:**
- Create: `src/assets/installedBgm.ts`
- Modify: `src/assets/audioResourceCatalog.ts:19-26`
- Test: `test/installedBgmRuntime.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `setInstalledBgmFiles(names: readonly string[] | null): void`, `isBgmFileInstalled(fileName: string): boolean`

- [ ] **Step 1: Write the failing test**

`test/installedBgmRuntime.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";
import { isCatalogBgmAvailable } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";

afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("빌드타임 시드를 매 호출마다 읽는다 — 모듈 로드 시점에 고정하지 않는다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["a.mp3"]);
  expect(isBgmFileInstalled("a.mp3")).toBe(true);
  expect(isBgmFileInstalled("b.mp3")).toBe(false);
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["b.mp3"]);
  expect(isBgmFileInstalled("b.mp3")).toBe(true);
});

it("define 이 없는 헤드리스 도구에서는 전량 설치로 본다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", undefined);
  expect(isBgmFileInstalled("anything.mp3")).toBe(true);
});

it("런타임 override 가 시드를 이긴다 — 재시작 없이 재생 가능으로 뒤집힌다", () => {
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
  const entry = findBgmRuntimeEntry("cc0-bgm-rtp-fld-001");
  if (!entry) throw new Error("Missing registry entry");
  expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(false);
  setInstalledBgmFiles([entry.fileName]);
  expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(true);
});

it("override 를 null 로 되돌리면 시드로 복귀한다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["seed.mp3"]);
  setInstalledBgmFiles(["runtime.mp3"]);
  expect(isBgmFileInstalled("seed.mp3")).toBe(false);
  setInstalledBgmFiles(null);
  expect(isBgmFileInstalled("seed.mp3")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/installedBgmRuntime.test.ts`
Expected: FAIL — `Failed to resolve import "@/assets/installedBgm"`

- [ ] **Step 3: Write minimal implementation**

`src/assets/installedBgm.ts`:

```ts
// Vite 가 설치된 팩 파일명을 주입한다. 헤드리스 메타데이터 도구에는 배포가 없어 define 도 없다.
declare const __OPRN_INSTALLED_BGM_FILES__: readonly string[] | undefined;

// 빌드타임 define 은 *부팅 시드* 다. 에디터가 설치를 끝내면 런타임 값이 이를 대체해서
// 개발 서버 재시작 없이 판정이 바뀐다. null 이면 시드로 되돌아간다.
let runtimeInstalled: ReadonlySet<string> | null = null;

export function setInstalledBgmFiles(names: readonly string[] | null): void {
  runtimeInstalled = names === null ? null : new Set(names);
}

export function isBgmFileInstalled(fileName: string): boolean {
  if (runtimeInstalled) return runtimeInstalled.has(fileName);
  // 시드는 매 호출마다 읽는다 — 모듈 로드 시점에 잡아 두면 테스트의 stubGlobal 이 무력해진다.
  return typeof __OPRN_INSTALLED_BGM_FILES__ === "undefined"
    || __OPRN_INSTALLED_BGM_FILES__.includes(fileName);
}
```

`src/assets/audioResourceCatalog.ts` — 19-26줄의 `declare` 와 define 참조를 지우고 교체:

```ts
import { isBgmFileInstalled } from "./installedBgm";

export function isCatalogBgmAvailable(resourceId: string): boolean {
  const bgm = findBgmRuntimeEntry(resourceId);
  return !bgm || bgmCdnBase() !== null || isBgmFileInstalled(bgm.fileName);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/installedBgmRuntime.test.ts test/audioInventoryDelivery.test.ts`
Expected: PASS 전부. **기존 `audioInventoryDelivery.test.ts` 3건이 그대로 통과해야 한다** — 깨지면 시드를 모듈 로드 시점에 고정한 것이다.

- [ ] **Step 5: Commit**

```bash
git add src/assets/installedBgm.ts src/assets/audioResourceCatalog.ts test/installedBgmRuntime.test.ts
git commit -m "feat(bgm): 설치 판정을 런타임에 갱신할 수 있게 한다"
```

---

## Task 2: 나열 규칙 공유 + preview 의 public 폴백

**Files:**
- Create: `scripts/lib/bgmCatalogDir.ts`
- Modify: `scripts/lib/audioDelivery.ts`
- Test: `test/bgmCatalogDir.test.ts`, `test/audioDeliveryHttp.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `CATALOG_RELATIVE_DIR: string`, `listInstalledCatalogFiles(directory: string): string[]`

- [ ] **Step 1: Write the failing test**

`test/bgmCatalogDir.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "../scripts/lib/bgmCatalogDir";

it("mp3/wav 만, 0바이트는 빼고, 정렬해서 돌려준다", async () => {
  const root = await mkdtemp(join(tmpdir(), "bgm-catalog-"));
  try {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "b.mp3"), "sound");
    await writeFile(join(root, "a.wav"), "sound");
    await writeFile(join(root, "empty.mp3"), "");
    await writeFile(join(root, "notes.txt"), "text");
    expect(listInstalledCatalogFiles(root)).toEqual(["a.wav", "b.mp3"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("디렉터리가 없으면 빈 배열이다 — 팩 미설치가 오류는 아니다", () => {
  expect(listInstalledCatalogFiles(join(tmpdir(), "absent-bgm-dir-xyz"))).toEqual([]);
});

it("카탈로그 상대 경로를 한 곳에서만 정의한다", () => {
  expect(CATALOG_RELATIVE_DIR).toBe("assets/cc0/audio/catalog");
});
```

`test/audioDeliveryHttp.test.ts` 에 케이스 추가:

```ts
it("preview 에서 dist 에 없는 카탈로그 파일을 public 에서 서빙한다", async () => {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/assets/cc0/audio/catalog/late.wav`,
      { signal: AbortSignal.timeout(10000) });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    const absent = await fetch(`http://127.0.0.1:${address.port}/assets/cc0/audio/catalog/absent.mp3`,
      { signal: AbortSignal.timeout(10000) });
    expect(absent.status).toBe(404);
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
}, 20000);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/bgmCatalogDir.test.ts test/audioDeliveryHttp.test.ts`
Expected: FAIL — `bgmCatalogDir` 미해결, preview 폴백 케이스는 404

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/bgmCatalogDir.ts`:

```ts
import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

/** public/ 와 dist/ 아래 카탈로그가 놓이는 상대 경로. 빌드타임 시드와 런타임 status 가 함께 쓴다. */
export const CATALOG_RELATIVE_DIR = "assets/cc0/audio/catalog";

/**
 * 설치된 카탈로그 파일명. 규칙이 시드와 status 사이에서 갈라지면 새로고침만으로
 * 재생 가능 여부가 뒤집히므로, 두 곳 모두 이 함수만 부른다.
 */
export function listInstalledCatalogFiles(directory: string): string[] {
  let entries: string[];
  try { entries = readdirSync(directory); }
  catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw error;
  }
  return entries
    .filter(file => /\.(?:mp3|wav)$/i.test(file) && statSync(resolve(directory, file)).size > 0)
    .sort();
}
```

`scripts/lib/audioDelivery.ts` — `config()` 의 인라인 나열을 교체하고, guard 에 폴백을 추가한다:

```ts
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "./bgmCatalogDir";

// config() 안:
const directory = resolve(root, typeof config.publicDir === "string" ? config.publicDir : "public", CATALOG_RELATIVE_DIR);
let files: string[] = [];
if (config.publicDir !== false) files = listInstalledCatalogFiles(directory);
return { define: { __OPRN_INSTALLED_BGM_FILES__: JSON.stringify(files) } };
```

guard 는 `root` 하나가 아니라 후보 목록을 받는다. preview 는 `[dist, public]`, dev 는 `[public]`:

```ts
const guard = (roots: readonly string[]): Connect.NextHandleFunction => (request, response, next) => {
  let path: string;
  try { path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
  catch { response.statusCode = 400; response.end(); return; }
  if (!path.startsWith("/assets/") || !/\.(?:mp3|wav|ogg|m4a|mid|midi|mp4|webm|ogv)$/i.test(path)) { next(); return; }
  const candidates = roots.map(root => ({ root, file: resolve(root, `.${path}`) }));
  if (candidates.some(({ root, file }) => relative(root, file).startsWith(".."))) {
    response.statusCode = 400; response.end(); return;
  }
  void (async () => {
    for (const [index, { file }] of candidates.entries()) {
      let info;
      try { info = await stat(file); }
      catch (error) { if (!missing(error)) throw error; continue; }
      if (!info.isFile()) continue;
      // 첫 후보(빌드 산출물)에 있으면 기본 정적 미들웨어가 그대로 처리한다.
      if (index === 0) { next(); return; }
      await pipeAudioFile(file, request, response);  // Range 지원 필요
      return;
    }
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("Media not found. For catalog BGM install the pack from the editor, or run npm run bgm:install.");
  })().catch(next);
};
```

**주의:** 폴백 경로는 기본 정적 미들웨어를 안 거치므로 `Range` 헤더를 직접 처리해야 한다 (기존 테스트가 206 을 요구한다). `sirv` 를 새로 끌어오지 말고, preview 의 폴백 루트를 `configurePreviewServer` 에서 `sirv(publicRoot)` 미들웨어로 등록하는 편이 단순하다면 그렇게 한다 — vite 가 이미 `sirv` 를 의존한다. 구현자는 둘 중 더 적은 코드를 고르되, 위 테스트 두 개(200 바이트 일치 / 404)와 기존 206 테스트를 모두 통과시켜야 한다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/bgmCatalogDir.test.ts test/audioDeliveryHttp.test.ts test/audioInventoryDelivery.test.ts`
Expected: PASS 전부 (기존 dev/preview 206 케이스 포함)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bgmCatalogDir.ts scripts/lib/audioDelivery.ts test/bgmCatalogDir.test.ts test/audioDeliveryHttp.test.ts
git commit -m "feat(bgm): preview 가 재빌드 없이 새로 설치된 곡을 서빙한다"
```

---

## Task 3: 설치 엔드포인트

**Files:**
- Create: `scripts/lib/bgmInstall.ts`
- Test: `test/bgmInstallEndpoint.test.ts`

**Interfaces:**
- Consumes: `CATALOG_RELATIVE_DIR`, `listInstalledCatalogFiles` (Task 2)
- Produces: `bgmInstallPlugin(options?: BgmInstallOptions): Plugin`

```ts
export type BgmInstallOptions = {
  /** 테스트 주입용. 기본은 루프백 + RPG_ZZU_BGM_INSTALL_REMOTE opt-in. */
  readonly allowAddress?: (address: string | undefined) => boolean;
  /** 테스트 주입용. 기본은 bgm-release.mjs 의 installRelease. */
  readonly install?: (input: { root: string; manifest: unknown; signal: AbortSignal }) => Promise<unknown>;
};
```

응답 계약 (spec 「표면 계약」 그대로):
- `GET /api/bgm/status` → 200 `{ expected, installed, installing, stagedBytes, archiveBytes, remoteAllowed, error }`
- `POST /api/bgm/install` → 202 `{ started: true }` / 200 `{ started: false, complete: true }` / 409 / 403
- `DELETE /api/bgm/install` → 202
- 모든 오류 본문 `{ error: string }`

- [ ] **Step 1: Write the failing test**

`test/bgmInstallEndpoint.test.ts` — Task 2 의 vite 통합 하네스를 그대로 쓴다:

```ts
import { mkdtemp, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createServer } from "vite";
import { bgmInstallPlugin } from "../scripts/lib/bgmInstall";

async function harness(plugin: ReturnType<typeof bgmInstallPlugin>) {
  const root = await mkdtemp(join(tmpdir(), "bgm-install-"));
  await mkdir(join(root, "public/assets/cc0/audio/catalog"), { recursive: true });
  await writeFile(join(root, "index.html"), "<!doctype html><title>SPA shell</title>");
  await mkdir(join(root, "assets"), { recursive: true });
  await copyFile("assets/bgm-release-v1.json", join(root, "assets/bgm-release-v1.json"));
  const server = await createServer({ configFile: false, root, cacheDir: join(root, ".cache"),
    logLevel: "silent", optimizeDeps: { noDiscovery: true, include: [] }, plugins: [plugin],
    server: { host: "127.0.0.1", port: 0 } });
  await server.listen(0);
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Missing isolated TCP server");
  const origin = `http://127.0.0.1:${address.port}`;
  return { root, origin, close: async () => { await server.close(); await rm(root, { recursive: true, force: true }); },
    request: (path: string, init?: RequestInit) => fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(10000) }) };
}

it("status 는 매니페스트 기대치와 설치 현황을 함께 준다", async () => {
  const h = await harness(bgmInstallPlugin({ install: async () => ({}) }));
  try {
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.expected).toBe(281);
    expect(body.archiveBytes).toBe(1304157696);
    expect(body.installed).toEqual([]);
    expect(body.installing).toBe(false);
  } finally { await h.close(); }
}, 20000);

it("설치를 시작하면 202 를 주고, 끝나면 status 가 설치본을 반영한다", async () => {
  let resolveInstall: () => void = () => {};
  const gate = new Promise<void>(resolve => { resolveInstall = resolve; });
  const h = await harness(bgmInstallPlugin({ install: async ({ root }) => {
    await gate;
    await writeFile(join(root, "public/assets/cc0/audio/catalog/done.mp3"), "sound");
    return {};
  } }));
  try {
    const start = await h.request("/api/bgm/install", { method: "POST" });
    expect(start.status).toBe(202);
    expect((await (await h.request("/api/bgm/status")).json()).installing).toBe(true);
    resolveInstall();
    await new Promise(resolve => setTimeout(resolve, 50));
    const done = await (await h.request("/api/bgm/status")).json();
    expect(done.installing).toBe(false);
    expect(done.installed).toEqual(["done.mp3"]);
  } finally { await h.close(); }
}, 20000);

it("이미 설치가 돌고 있으면 두 번째 POST 는 409 다", async () => {
  const gate = new Promise<void>(() => {});
  const h = await harness(bgmInstallPlugin({ install: () => gate as Promise<unknown> }));
  try {
    expect((await h.request("/api/bgm/install", { method: "POST" })).status).toBe(202);
    const second = await h.request("/api/bgm/install", { method: "POST" });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBeTruthy();
  } finally { await h.close(); }
}, 20000);

it("설치 실패는 status 의 error 로 드러나고 installing 이 풀린다", async () => {
  const h = await harness(bgmInstallPlugin({ install: async () => { throw new Error("gh 실행 실패"); } }));
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    await new Promise(resolve => setTimeout(resolve, 50));
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.installing).toBe(false);
    expect(body.error).toMatch(/gh 실행 실패/);
  } finally { await h.close(); }
}, 20000);

it("허용되지 않은 주소는 403 이고 status 가 이유를 알려준다", async () => {
  const h = await harness(bgmInstallPlugin({ allowAddress: () => false, install: async () => ({}) }));
  try {
    const denied = await h.request("/api/bgm/install", { method: "POST" });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBeTruthy();
    // status 는 막힌 곳에서도 읽을 수 있어야 배너가 이유를 띄운다.
    const body = await (await h.request("/api/bgm/status")).json();
    expect(body.remoteAllowed).toBe(false);
  } finally { await h.close(); }
}, 20000);

it("중단 요청은 설치에 넘긴 signal 을 abort 한다", async () => {
  let aborted = false;
  const h = await harness(bgmInstallPlugin({ install: ({ signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("취소됨")); }, { once: true });
  }) }));
  try {
    await h.request("/api/bgm/install", { method: "POST" });
    expect((await h.request("/api/bgm/install", { method: "DELETE" })).status).toBe(202);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(aborted).toBe(true);
    expect((await (await h.request("/api/bgm/status")).json()).installing).toBe(false);
  } finally { await h.close(); }
}, 20000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/bgmInstallEndpoint.test.ts`
Expected: FAIL — `Failed to resolve import "../scripts/lib/bgmInstall"`

- [ ] **Step 3: Write minimal implementation**

`scripts/lib/bgmInstall.ts`. 요점:

```ts
import { statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Connect, Plugin } from "vite";
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "./bgmCatalogDir";
import { installRelease, readTrustedManifest } from "./bgm-release.mjs";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function defaultAllowAddress(address: string | undefined): boolean {
  if (process.env.RPG_ZZU_BGM_INSTALL_REMOTE === "1") return true;
  return address !== undefined && LOOPBACK.has(address.replace(/^\[|\]$/g, ""));
}

// 다운로드가 끝나고 검증·전개로 넘어가면 스테이징 크기가 archive 크기에서 멈춘다.
// 배너는 그 시점에 "검증 중" 으로 문구를 바꾼다.
function stagedBytes(parent: string): number {
  let total = 0;
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(".bgm-stage-")) continue;
    total += directorySize(join(parent, entry.name));
  }
  return total;
}
```

상태는 플러그인 클로저에 둔다: `current: Promise<unknown> | null`, `controller: AbortController | null`, `lastError: string | null`. `POST` 는 `current` 가 있으면 409. 없으면 `AbortController` 를 만들고 `install({ root, manifest, signal })` 를 시작한 뒤 **await 하지 않고** 202 를 반환한다 — `.finally()` 에서 `current = null` 로 되돌리고, `.catch()` 에서 `lastError` 를 채운다. 성공 시 `lastError = null`.

미들웨어는 `server.middlewares.use("/api/bgm", handler)` 로 dev·preview 양쪽에 등록한다(`configureServer` + `configurePreviewServer`). 모든 응답은 `Content-Type: application/json; charset=utf-8`.

`GET /api/bgm/status` 는 가드를 적용하지 않는다 — 막힌 클라이언트도 이유를 읽어야 배너를 그린다. `POST`/`DELETE` 에만 `allowAddress` 를 적용한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/bgmInstallEndpoint.test.ts`
Expected: PASS 6건

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bgmInstall.ts test/bgmInstallEndpoint.test.ts
git commit -m "feat(bgm): 설치·상태·중단 엔드포인트를 추가한다"
```

---

## Task 4: 클라이언트

**Files:**
- Create: `src/editor/bgmInstallClient.ts`
- Test: `test/bgmInstallClient.test.ts`

**Interfaces:**
- Consumes: `setInstalledBgmFiles` (Task 1), Task 3 의 HTTP 계약
- Produces:

```ts
export const BGM_INSTALLED_EVENT = "rpgzzu:bgm-installed";
export type BgmInstallStatus = {
  readonly expected: number; readonly installed: readonly string[]; readonly installing: boolean;
  readonly stagedBytes: number; readonly archiveBytes: number;
  readonly remoteAllowed: boolean; readonly error: string | null;
};
export function fetchBgmStatus(): Promise<BgmInstallStatus | null>;
export function startBgmInstall(): Promise<{ readonly ok: boolean; readonly error: string | null }>;
export function cancelBgmInstall(): Promise<void>;
export function applyBgmStatus(status: BgmInstallStatus): void;
export function watchBgmInstall(onStatus: (status: BgmInstallStatus) => void): () => void;
```

- [ ] **Step 1: Write the failing test**

`test/bgmInstallClient.test.ts`:

```ts
import { afterEach, expect, it, vi } from "vitest";
import { applyBgmStatus, fetchBgmStatus, startBgmInstall, BGM_INSTALLED_EVENT } from "@/editor/bgmInstallClient";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";

const status = (over: Partial<Parameters<typeof applyBgmStatus>[0]> = {}) => ({
  expected: 281, installed: ["x.mp3"], installing: false,
  stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over,
});

afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); });

it("status 를 적용하면 판정이 갱신되고 완료 이벤트가 뜬다", () => {
  const seen: string[] = [];
  const listener = () => seen.push("fired");
  window.addEventListener(BGM_INSTALLED_EVENT, listener);
  try {
    applyBgmStatus(status());
    expect(isBgmFileInstalled("x.mp3")).toBe(true);
    expect(seen).toEqual(["fired"]);
  } finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
});

it("설치 중 status 는 적용하되 완료 이벤트는 내지 않는다", () => {
  const seen: string[] = [];
  const listener = () => seen.push("fired");
  window.addEventListener(BGM_INSTALLED_EVENT, listener);
  try { applyBgmStatus(status({ installing: true })); expect(seen).toEqual([]); }
  finally { window.removeEventListener(BGM_INSTALLED_EVENT, listener); }
});

it("엔드포인트가 없는 배포 환경에서는 null 을 주고 조용히 넘어간다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>", {
    status: 200, headers: { "Content-Type": "text/html" } })));
  expect(await fetchBgmStatus()).toBeNull();
});

it("403 은 사용자에게 보여줄 이유를 담아 돌려준다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "원격 접속에서는 opt-in 이 필요합니다." }),
    { status: 403, headers: { "Content-Type": "application/json" } })));
  const result = await startBgmInstall();
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/opt-in/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/bgmInstallClient.test.ts`
Expected: FAIL — `Failed to resolve import "@/editor/bgmInstallClient"`

- [ ] **Step 3: Write minimal implementation**

핵심 규칙:
- `fetchBgmStatus` 는 `Content-Type` 이 JSON 이 아니면 `null`. 배포된 정적 에디터는 SPA 폴백 HTML 을 주므로 이것으로 "엔드포인트 없음" 을 판별한다. 네트워크 예외도 `null`.
- `applyBgmStatus` 는 항상 `setInstalledBgmFiles(status.installed)` 를 호출하고, `installing === false` 일 때만 `BGM_INSTALLED_EVENT` 를 디스패치한다.
- `watchBgmInstall` 은 1000ms 폴링, `installing` 이 false 로 바뀌면 한 번 더 적용하고 스스로 멈춘다. 반환값은 해제 함수.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/bgmInstallClient.test.ts`
Expected: PASS 4건

- [ ] **Step 5: Commit**

```bash
git add src/editor/bgmInstallClient.ts test/bgmInstallClient.test.ts
git commit -m "feat(bgm): 설치 상태를 런타임에 반영하는 클라이언트를 추가한다"
```

---

## Task 5: 배너 · 플러그인 등록 · 문서

**Files:**
- Create: `src/editor/panels/bgmInstallBanner.ts`
- Modify: `src/editor/panels/databaseResourcePickerDialog.ts:91-141,233`, `vite.config.ts:601`, `.env.example`
- Test: `test/bgmInstallBanner.test.ts`

**Interfaces:**
- Consumes: Task 4 전부
- Produces:

```ts
export function bgmInstallBanner(input: {
  readonly kind: string;
  readonly onInstalled: () => void;
  /** 주입하면 그대로 쓴다(테스트 경로). 없으면 fetchBgmStatus() 로 비동기 채운다. */
  readonly status?: BgmInstallStatus;
}): HTMLElement | null;
```

- [ ] **Step 1: Write the failing test**

`test/bgmInstallBanner.test.ts`:

```ts
import { expect, it, vi } from "vitest";
import { bgmInstallBanner } from "@/editor/panels/bgmInstallBanner";

const status = (over = {}) => ({ expected: 281, installed: ["a.mp3"], installing: false,
  stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over });

it("음악이 아닌 종류에는 배너를 그리지 않는다", () => {
  expect(bgmInstallBanner({ kind: "sound", onInstalled: () => {} })).toBeNull();
});

it("미설치 곡 수와 받을 용량을 보여준다", async () => {
  const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status() });
  expect(banner?.querySelector("[data-testid=bgm-install-status-text]")?.textContent).toContain("281");
  expect(banner?.querySelector("[data-testid=bgm-install-button]")).toBeTruthy();
});

it("전량 설치돼 있으면 배너 자체가 없다", () => {
  const installed = Array.from({ length: 281 }, (_unused, index) => `t${index}.mp3`);
  expect(bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ installed }) })).toBeNull();
});

it("원격 차단이면 버튼을 잠그고 opt-in 방법을 알려준다", () => {
  const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ remoteAllowed: false }) });
  const button = banner?.querySelector<HTMLButtonElement>("[data-testid=bgm-install-button]");
  expect(button?.disabled).toBe(true);
  expect(banner?.querySelector("[data-testid=bgm-install-error]")?.textContent)
    .toContain("RPG_ZZU_BGM_INSTALL_REMOTE");
});

it("다운로드가 끝나고 검증 단계에 들어가면 문구가 바뀐다", () => {
  const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {},
    status: status({ installing: true, stagedBytes: 1304157696 }) });
  expect(banner?.querySelector("[data-testid=bgm-install-status-text]")?.textContent).toContain("검증");
});

it("설치 중에만 취소 버튼을 내놓는다", () => {
  const idle = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status() });
  expect(idle?.querySelector("[data-testid=bgm-install-cancel]")).toBeNull();
  const busy = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ installing: true }) });
  expect(busy?.querySelector("[data-testid=bgm-install-cancel]")).toBeTruthy();
});
```

목록 재생성까지 이어지는지는 판정 계층에서 검증한다 — 배너가 `onInstalled` 를 부르면
`refreshList` 가 카탈로그를 다시 읽고, 그때 항목 수가 실제로 늘어야 한다.
같은 파일에 이어서:

```ts
import { setInstalledBgmFiles } from "@/assets/installedBgm";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
// 파일명은 BGM_CATALOG 가 아니라 런타임 레지스트리에 있다. BGM_RUNTIME_ENTRIES 는
// 모듈 내부 const 라 export 되지 않으므로 접근자 두 개를 조합해서 얻는다.
import { BGM_CATALOG_TRACK_COUNT, bgmCatalogResourceIds, findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";

it("설치 반영 후 리소스 목록이 다시 만들어지면 항목이 늘어난다", () => {
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
  const project = createBlankProject();
  const before = listDatabaseResourceOptions("music", project).length;
  const everyFileName = bgmCatalogResourceIds()
    .map(id => findBgmRuntimeEntry(id)?.fileName)
    .filter((name): name is string => name !== undefined);
  expect(everyFileName).toHaveLength(BGM_CATALOG_TRACK_COUNT);
  setInstalledBgmFiles(everyFileName);
  const after = listDatabaseResourceOptions("music", project).length;
  expect(after - before).toBe(BGM_CATALOG_TRACK_COUNT);
  setInstalledBgmFiles(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/bgmInstallBanner.test.ts`
Expected: FAIL — 모듈 미해결

- [ ] **Step 3: Write minimal implementation**

배너는 `el()` 헬퍼(`@/util/dom`)로 만든다. `status` 를 주입받으면 그대로 쓰고, 없으면 `fetchBgmStatus()` 로 비동기 채운다(테스트는 주입 경로만 쓴다).

`databaseResourcePickerDialog.ts` 배선:
- 91줄 `openDatabaseResourcePickerDialog` 안에서 배너를 만들고, 233줄 그리드 **앞**에 넣는다.
- `onInstalled` 는 118줄의 기존 `refreshList` 를 그대로 넘긴다 — 이미 `listDatabaseResourceOptions` 로 카탈로그를 다시 읽는다. **배지 갱신이 아니라 목록 재생성이다**: `audioResourceCatalog.ts:94` 가 미설치 곡을 목록에서 제외하므로 설치 후 항목 수가 3 → 281 로 바뀐다.

`vite.config.ts` 601줄 plugins 배열 맨 앞에 `bgmInstallPlugin()` 추가:

```ts
plugins: [bgmInstallPlugin(), audioDeliveryPlugin(), devPlayerBundlesPlugin(), /* … */],
```

`.env.example` 의 CC0 BGM 절에 추가:

```
# 에디터 안에서 BGM 팩을 받는 기능은 기본적으로 루프백(127.0.0.1)에서만 동작한다.
# gh 를 실행하고 디스크에 1.3GB 를 쓰므로 네트워크에 열지 않는 것이 기본값이다.
# mdc-server:9888 처럼 원격 주소로 에디터를 열어 쓸 때만 .env.local 에 아래를 넣는다.
# RPG_ZZU_BGM_INSTALL_REMOTE=1
```

- [ ] **Step 4: Run the full suite**

Run: `npm test -- test/bgmInstallBanner.test.ts test/bgmInstallClient.test.ts test/bgmInstallEndpoint.test.ts test/installedBgmRuntime.test.ts test/audioInventoryDelivery.test.ts test/audioDeliveryHttp.test.ts test/bgmCatalogDir.test.ts`
Expected: PASS 전부

- [ ] **Step 5: Commit**

```bash
git add src/editor/panels/bgmInstallBanner.ts src/editor/panels/databaseResourcePickerDialog.ts vite.config.ts .env.example test/bgmInstallBanner.test.ts
git commit -m "feat(bgm): 리소스 선택 창에서 팩을 바로 받는다"
```

---

## Task 6: 실물 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 게이트 실행**

Run: `npm run gates`
주의: 이 저장소의 게이트 기준선은 오래돼서 "새로 실패" 를 과다 보고한다. 표시된 파일은 **변경 전/후로 각각 다시 돌려** 실제 회귀인지 확인한다.

- [ ] **Step 2: 실제 서버에서 확인**

미설치 상태를 만들어 dev 서버를 띄우고 배너 → 설치 → 재시작 없이 재생 가능해지는지 확인한다. 이미 설치된 카탈로그를 지우지 말고, 임시 루트에서 확인하거나 `--root` 로 격리한다.

- [ ] **Step 3: PR**

본문은 다음 네 가지를 담는다: (1) 터미널 설치만 있던 지금 구조의 세 겹 불편(레포에 3곡뿐 ·
재시작 전까지 UI 가 막음 · preview 는 404), (2) 실측 근거(dev 9901 200/3,514,165B vs preview 9888 404),
(3) 새 안전장치를 만들지 않고 `installRelease` 를 재사용했다는 점, (4) 원격 허용이 기본값이 아니고
엔드포인트가 빌드 산출물에 존재하지 않는다는 보안 근거.

```bash
git push -u origin HEAD
gh pr create --title "feat(bgm): 에디터에서 BGM 팩을 직접 설치한다" --body-file docs/superpowers/plans/2026-09-09-in-editor-bgm-install-pr.md
```
