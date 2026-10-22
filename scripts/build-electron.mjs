#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { readOAuthClientsFromPiAi } from "./lib/oauthClients.mjs";

/**
 * 큰 JSON 을 `module.exports = JSON.parse("…")` 로 싣는다(Node 번들 전용) — vite 쪽 scripts/lib/jsonParseModules.mjs 와 같은 이유.
 * esbuild 의 json 로더는 JSON 을 객체 리터럴로 펼친다. 메인 번들이 번들 타일셋·참고문서 약 80MB 를 품어서, 앱을 켤 때마다
 * V8 이 그 리터럴을 스크립트로 훑느라 첫 모듈 평가까지 2.6초가 걸렸다(2026-10-20 실측, load≈40). 문자열 리터럴은 훑기만 하고
 * JSON.parse 는 전용 파서라 같은 데이터가 훨씬 빨리 객체가 된다. 기본·이름 가져오기 모두 CommonJS 상호운용으로 그대로다.
 */
const jsonParseModules = {
  name: "oprn-json-parse-modules",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.json$/ }, (args) => {
      const text = readFileSync(args.path, "utf8");
      if (text.length < 20_000) return undefined;
      return { contents: `module.exports = JSON.parse(${JSON.stringify(text)});\n`, loader: "js" };
    });
  },
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "dist-electron");

const ENTRIES = [
  {
    // 시작 입구(package.json main). 스플래시를 띄우고 본체(app.cjs)를 읽는다 — 가볍게 둔다(크기 상한을 아래에서 검사).
    entry: resolve(REPO_ROOT, "electron/main/boot.ts"),
    outfile: resolve(OUT_DIR, "main.cjs"),
    maxBytes: 200_000,
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  },
  {
    entry: resolve(REPO_ROOT, "electron/main/main.ts"),
    outfile: resolve(OUT_DIR, "app.cjs"),
    injectOAuth: true,
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  },
  {
    entry: resolve(REPO_ROOT, "electron/preload/index.ts"),
    outfile: resolve(OUT_DIR, "preload.cjs"),
    format: "cjs",
    platform: "node",
    target: "node22",
    external: ["electron", "node:*"],
  },
  {
    // 브라우저 로컬 서버가 페이지에 주입하는 브리지 — IPC 대신 HTTP 로 같은 채널을 부른다.
    entry: resolve(REPO_ROOT, "electron/browser/bridge.ts"),
    outfile: resolve(OUT_DIR, "browser-bridge.js"),
    format: "iife",
    platform: "browser",
    target: "es2020",
    external: [],
  },
];

// CJS 번들에서 import.meta 는 빈 객체다. 모듈 최상위에서 import.meta.url 을 읽으면(fileURLToPath 등)
// 메인 프로세스가 로드 즉시 죽어 앱이 켜지지 않는다 — 2026-09-22(ohMyPiPiAi·aiAuthRuntime),
// 2026-10-04(worldmapBuild, v0.108.0) 두 번 출하됐다. 쓰는 곳에서 지연 평가해야 한다.
function assertNoOAuthSecrets(file) {
  const text = readFileSync(file, "utf8");
  const leaked = Object.values(oauthClients).filter((value) => typeof value === "string" && value.length >= 8 && text.includes(value));
  if (leaked.length) throw new Error(`${file}: OAuth 클라이언트 값이 ${leaked.length}건 들어 있다 — 메인 번들 밖으로 새면 안 된다.`);
}

function assertNoTopLevelImportMeta(file) {
  const offenders = readFileSync(file, "utf8")
    .split("\n")
    .map((line, index) => ({ line, no: index + 1 }))
    .filter(({ line }) => /^\S/.test(line) && /\bimport_meta\d*\.url\b/.test(line))
    // 한 줄짜리 함수 정의(`var f = () => ...`, `function f() {...}`)는 부를 때 평가되므로 괜찮다.
    .filter(({ line }) => !/^(?:var|let|const) [\w$]+ = (?:async )?(?:\([^)]*\)|[\w$]+) =>/.test(line) && !/^(?:async )?function\b/.test(line));
  if (offenders.length === 0) return;
  const list = offenders.map(({ line, no }) => `  ${no}: ${line.slice(0, 200)}`).join("\n");
  throw new Error(`${file}: 모듈 최상위에서 import.meta.url 을 읽는다 — CJS 번들에서는 비어 있어 앱 시작이 죽는다. 함수 안으로 옮겨 지연 평가하라.\n${list}`);
}

// 남의 앱 OAuth 클라이언트 값(src/ai/oauth/clientConfig.ts)은 저장소에 없다. 패키징된 앱에는 node_modules 가 없으므로
// 빌드 때 설치된 참조 구현에서 읽어 주입한다. 환경변수가 있으면 그것이 이긴다. 못 읽으면 로그인만 실패한다.
const OAUTH_ENV = { antigravityClientId: "OPRN_ANTIGRAVITY_CLIENT_ID", antigravityClientSecret: "OPRN_ANTIGRAVITY_CLIENT_SECRET", codexClientId: "OPRN_CODEX_CLIENT_ID" };
const oauthClients = readOAuthClientsFromPiAi();
for (const [key, name] of Object.entries(OAUTH_ENV)) if (process.env[name]?.trim()) oauthClients[key] = process.env[name].trim();
const missingOAuth = Object.keys(OAUTH_ENV).filter((key) => !oauthClients[key]);
if (missingOAuth.length) process.stderr.write(`warning: OAuth 클라이언트 값 없음 — ${missingOAuth.join(", ")} (해당 로그인은 패키지 앱에서 실패한다)\n`);

/**
 * 메인 번들의 «프로젝트 코어 지연 읽기»(electron/main/projectCore.ts 머리말).
 * loadRepair·io/serialize 를 가리키는 모든 import 를 대역 모듈로 바꾼다. 대역은 내보내는 이름마다 getter 를 두고,
 * 처음 읽힐 때 dist-electron/project-core.cjs 를 require 한다(esbuild 는 CJS 모듈의 이름 가져오기를 쓰는 자리에서 속성으로 읽는다).
 * 이름 목록은 빌드한 코어 번들을 Node 로 읽어 얻으므로 손으로 맞출 목록이 없다.
 */
const PROJECT_CORE_MODULES = {
  loadRepair: resolve(REPO_ROOT, "src/project/persistence/core/loadRepair.ts"),
  serialize: resolve(REPO_ROOT, "src/project/io/serialize.ts"),
};
function lazyProjectCorePlugin(exportNames) {
  const byPath = new Map(Object.entries(PROJECT_CORE_MODULES).map(([namespace, path]) => [path, namespace]));
  return {
    name: "oprn-lazy-project-core",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /(?:loadRepair|serialize)$/ }, async (args) => {
        if (args.pluginData?.lazyCoreSkip) return undefined;
        const resolved = await pluginBuild.resolve(args.path, { resolveDir: args.resolveDir, kind: args.kind, importer: args.importer, pluginData: { lazyCoreSkip: true } });
        const namespace = byPath.get(resolved.path);
        return namespace ? { path: namespace, namespace: "oprn-lazy-project-core" } : undefined;
      });
      pluginBuild.onLoad({ filter: /.*/, namespace: "oprn-lazy-project-core" }, (args) => {
        const names = exportNames[args.path];
        if (!names?.length) throw new Error(`프로젝트 코어 ${args.path} 의 내보내기 목록이 비었다`);
        return {
          loader: "js",
          resolveDir: REPO_ROOT,
          contents: [
            `const { join } = require("node:path");`,
            `let core;`,
            `const load = () => (core ??= require(join(__dirname, "project-core.cjs"))[${JSON.stringify(args.path)}]);`,
            `for (const name of ${JSON.stringify(names)}) Object.defineProperty(module.exports, name, { enumerable: true, get: () => load()[name] });`,
          ].join("\n"),
        };
      });
    },
  };
}

await mkdir(OUT_DIR, { recursive: true });
// 자산 브라우저가 받은 RAR 팩(예: Rasak Modern)을 메인 프로세스에서 푼다 — node-unrar-js 는 wasm 을 따로 읽는다.
// 번들(main.cjs) 옆에 두고 electron/main/rarPack.ts 가 __dirname 에서 읽는다.
copyFileSync(resolve(REPO_ROOT, "node_modules/node-unrar-js/dist/js/unrar.wasm"), resolve(OUT_DIR, "unrar.wasm"));
process.stdout.write("staged dist-electron/unrar.wasm\n");
// 코어 번들을 먼저 만들고, 그 내보내기 이름으로 메인 번들의 대역을 만든다.
const PROJECT_CORE_OUT = resolve(OUT_DIR, "project-core.cjs");
await build({
  absWorkingDir: REPO_ROOT,
  bundle: true,
  entryPoints: [resolve(REPO_ROOT, "electron/main/projectCore.ts")],
  format: "cjs",
  logLevel: "warning",
  outfile: PROJECT_CORE_OUT,
  platform: "node",
  target: "node22",
  external: ["electron", "node:*"],
  plugins: [jsonParseModules],
});
assertNoTopLevelImportMeta(PROJECT_CORE_OUT);
const projectCoreExports = JSON.parse(spawnSync(process.execPath, ["-e",
  `const core = require(${JSON.stringify(PROJECT_CORE_OUT)}); console.log(JSON.stringify(Object.fromEntries(Object.entries(core).map(([k, v]) => [k, Object.keys(v)]))))`,
], { encoding: "utf8", maxBuffer: 1 << 24 }).stdout || "{}");
for (const namespace of Object.keys(PROJECT_CORE_MODULES)) {
  if (!projectCoreExports[namespace]?.length) throw new Error(`project-core.cjs 를 읽지 못했거나 ${namespace} 내보내기가 없다`);
}
process.stdout.write(`built dist-electron/project-core.cjs (${Object.values(projectCoreExports).flat().length} exports)\n`);

for (const { entry, outfile, format, platform, target, external, injectOAuth, maxBytes } of ENTRIES) {
  await build({
    absWorkingDir: REPO_ROOT,
    bundle: true,
    entryPoints: [entry],
    format,
    logLevel: "warning",
    outfile,
    platform,
    target,
    external,
    // 남의 앱 OAuth 값은 Node 메인 번들에만 넣는다 — preload·브라우저 브리지(페이지에 주입되는 파일)로 새면 안 된다.
    plugins: platform === "node" ? [jsonParseModules, ...(injectOAuth ? [lazyProjectCorePlugin(projectCoreExports)] : [])] : [],
    define: { __OPRN_OAUTH_CLIENTS__: injectOAuth ? JSON.stringify(oauthClients) : "undefined" },
  });
  process.stdout.write(`built ${outfile.replace(`${REPO_ROOT}/`, "")}\n`);
  if (format === "cjs") assertNoTopLevelImportMeta(outfile);
  if (!injectOAuth) assertNoOAuthSecrets(outfile);
  // 입구가 무거워지면 아이콘을 누른 뒤 스플래시가 그만큼 늦게 뜬다(electron/main/boot.ts).
  if (maxBytes && readFileSync(outfile).length > maxBytes) throw new Error(`${outfile}: ${readFileSync(outfile).length} bytes > ${maxBytes} — 시작 입구에 무거운 import 가 끌려 왔다`);
}

// 데스크톱 앱은 사용자 PC에 bun 이 없다. 리눅스·윈도우 워커를 실행 파일로 넣어 채팅이 그 파일을 띄운다.
const workerEntry = resolve(REPO_ROOT, "scripts/oh-my-pi-worker.ts");
for (const [target, name] of [["bun-linux-x64", "oh-my-pi-worker"], ["bun-windows-x64", "oh-my-pi-worker.exe"]]) {
  const outfile = resolve(OUT_DIR, name);
  const result = spawnSync("bun", ["build", workerEntry, "--compile", `--target=${target}`, `--outfile=${outfile}`], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`AI 워커 컴파일 실패: ${target}`);
  if (!name.endsWith(".exe")) chmodSync(outfile, 0o755);
  process.stdout.write(`built dist-electron/${name}\n`);
}

// 워커는 @oh-my-pi/pi-natives 의 Rust 애드온(.node)을 실행 중에 계산한 경로로 require 한다.
// `bun build --compile` 은 그런 파일을 따라가지 못해 싣지 않고, 애드온이 없는 워커는 시작하자마자
// `Failed to load pi_natives native addon` 으로 죽는다 — 로그인(Node 쪽)은 되는데 채팅만 안 되던 원인이다
// (실측 2026-09-27, v0.17.x). 로더는 컴파일된 실행 파일 옆 폴더(execDir)를 후보로 보므로 워커 옆에 둔다.
// baseline 하나만 싣는다: AVX2 가 있어도 로더가 modern 다음 후보로 baseline 을 집는다.
// 윈도우 애드온은 리눅스 호스트의 node_modules 에 설치되지 않는다(optionalDependencies 의 os 필터) —
// package-lock 의 tarball 주소와 무결성 값으로 받아 검증한다.
const lock = JSON.parse(readFileSync(resolve(REPO_ROOT, "package-lock.json"), "utf8"));
const nativesVersion = lock.packages["node_modules/@oh-my-pi/pi-natives"]?.version;
if (!nativesVersion) throw new Error("package-lock 에 @oh-my-pi/pi-natives 가 없습니다");
const ADDON_CACHE = resolve(REPO_ROOT, "node_modules/.cache/oprn-pi-natives");

function verifiedTarball(entry, tag) {
  const cached = join(ADDON_CACHE, `pi-natives-${tag}-${entry.version}.tgz`);
  const [algorithm, expected] = entry.integrity.split("-", 2);
  const matches = (bytes) => createHash(algorithm).update(bytes).digest("base64") === expected;
  if (existsSync(cached) && matches(readFileSync(cached))) return cached;
  const result = spawnSync("curl", ["-fsSL", "--retry", "3", entry.resolved], { maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`AI 워커 애드온 다운로드 실패 (${tag}): ${String(result.stderr).trim()}`);
  if (!matches(result.stdout)) throw new Error(`AI 워커 애드온 무결성 불일치 (${tag}): ${entry.resolved}`);
  mkdirSync(ADDON_CACHE, { recursive: true });
  writeFileSync(cached, result.stdout);
  return cached;
}

for (const tag of ["linux-x64", "win32-x64"]) {
  const filename = `pi_natives.${tag}-baseline.node`;
  const packagePath = `node_modules/@oh-my-pi/pi-natives-${tag}`;
  const entry = lock.packages[packagePath];
  if (entry?.version !== nativesVersion) throw new Error(`${packagePath} 버전(${entry?.version})이 pi-natives ${nativesVersion} 과 다릅니다`);
  const outfile = resolve(OUT_DIR, filename);
  const installed = resolve(REPO_ROOT, packagePath, filename);
  const installedVersion = existsSync(installed)
    ? JSON.parse(readFileSync(resolve(REPO_ROOT, packagePath, "package.json"), "utf8")).version
    : null;
  if (installedVersion === nativesVersion) {
    copyFileSync(installed, outfile);
  } else {
    const scratch = mkdtempSync(join(tmpdir(), "oprn-pi-natives-"));
    try {
      const untar = spawnSync("tar", ["-xzf", verifiedTarball(entry, tag), "-C", scratch, `package/${filename}`], { stdio: "inherit" });
      if (untar.status !== 0) throw new Error(`AI 워커 애드온 압축 해제 실패 (${tag})`);
      copyFileSync(join(scratch, "package", filename), outfile);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  process.stdout.write(`staged dist-electron/${filename}\n`);
}
