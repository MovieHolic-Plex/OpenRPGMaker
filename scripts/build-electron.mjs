#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
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

/**
 * 프로젝트 코어(project-core.cjs)의 큰 JSON(64KB 이상)을 번들에 넣지 않고 dist-electron/worker-data/<저장소 상대 경로> 에서 읽는다 (2026-11-26, worker-slim).
 * 조수 워커(scripts/build-ai-worker.ts)가 같은 폴더·같은 경로 규칙을 쓰므로 번들 타일셋 JSON 이 앱 안에 한 벌만 남는다(전에는 코어 123MB·워커 각각).
 * 폴더는 builder 가 asarUnpack 한다. Electron 의 fs 는 app.asar/dist-electron/worker-data 경로를 풀린 폴더로 이어 준다.
 */
const WORKER_DATA_DIR = resolve(OUT_DIR, "worker-data");
const externalDataJson = {
  name: "oprn-worker-data-json",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.json$/ }, (args) => {
      if (args.path.split(sep).includes("node_modules") || statSync(args.path).size < 64 * 1024) return undefined;
      const rel = relative(REPO_ROOT, args.path).split(sep).join("/");
      if (rel.startsWith("../")) return undefined;
      mkdirSync(dirname(join(WORKER_DATA_DIR, rel)), { recursive: true });
      copyFileSync(args.path, join(WORKER_DATA_DIR, rel));
      return {
        loader: "js",
        contents: [
          `const { readFileSync } = require("node:fs");`,
          `const file = require("node:path").join(__dirname, "worker-data", ${JSON.stringify(rel)});`,
          `let text;`,
          `try { text = readFileSync(file, "utf8"); } catch (error) { throw new Error(\`프로젝트 코어 자료를 읽지 못했습니다(\${error.code ?? error.message}): \${file}. 앱 설치가 깨졌을 수 있습니다. 앱을 다시 설치하거나 업데이트하세요.\`); }`,
          `module.exports = JSON.parse(text);`,
        ].join("\n"),
      };
    });
  },
};

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
    // 본체도 상한을 둔다(2026-11-24): 문자열 상수 하나 때문에 번들 타일셋 JSON 112MB 가 딸려 와 121.5MB 였고,
    // 앱을 켤 때마다 이 파일을 읽는 데 3초 넘게 걸렸다. 타일셋 정의·팀 병합은 project-core.cjs(지연 읽기)에만 둔다.
    // 고친 뒤 2.05MB 다. 상한은 그 두 배 정도로 두어 큰 JSON 하나만 딸려 와도 빌드가 멈추게 한다.
    maxBytes: 4_000_000,
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
// 빌드 때 설치된 @earendil-works/pi-ai 에서 읽어 주입한다. 환경변수가 있으면 그것이 이긴다.
// Google Antigravity OAuth 는 계정 정지 위험으로 비활성화되어 필수 검사에서 뺀다(2026-11-28).
const OAUTH_ENV = { antigravityClientId: "OPRN_ANTIGRAVITY_CLIENT_ID", antigravityClientSecret: "OPRN_ANTIGRAVITY_CLIENT_SECRET", codexClientId: "OPRN_CODEX_CLIENT_ID" };
const REQUIRED_OAUTH_KEYS = ["codexClientId"];
const oauthClients = readOAuthClientsFromPiAi();
for (const [key, name] of Object.entries(OAUTH_ENV)) if (process.env[name]?.trim()) oauthClients[key] = process.env[name].trim();
const missingOAuth = REQUIRED_OAUTH_KEYS.filter((key) => !oauthClients[key]);
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
  teamMerge: resolve(REPO_ROOT, "src/project/persistence/core/teamMerge.ts"),
};
function lazyProjectCorePlugin(exportNames) {
  const byPath = new Map(Object.entries(PROJECT_CORE_MODULES).map(([namespace, path]) => [path, namespace]));
  return {
    name: "oprn-lazy-project-core",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /(?:loadRepair|serialize|teamMerge)$/ }, async (args) => {
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
// 코어와 워커가 같이 채운다. 지난 빌드의 파일이 남아 패키지에 딸려 가지 않게 여기서 한 번만 비운다.
rmSync(WORKER_DATA_DIR, { recursive: true, force: true });
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
  plugins: [externalDataJson, jsonParseModules],
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
  if (maxBytes && readFileSync(outfile).length > maxBytes) throw new Error(`${outfile}: ${readFileSync(outfile).length} bytes > ${maxBytes} — 무거운 import(번들 타일셋 JSON 등)가 끌려 왔다. esbuild metafile 로 사슬을 찾아 가벼운 모듈로 떼라`);
}

// 에이전트 모드(실험)의 MCP 서버. 에이전트가 Electron 바이너리(ELECTRON_RUN_AS_NODE)로 띄우므로 asar 밖에 둔다(asarUnpack).
copyFileSync(resolve(REPO_ROOT, "scripts/oprn-agent-mode-mcp.mjs"), resolve(OUT_DIR, "oprn-agent-mode-mcp.mjs"));
process.stdout.write("staged dist-electron/oprn-agent-mode-mcp.mjs\n");

async function stageWorkerPayloads() {
  // 에이전트 모드 설치기(electron/main/agentInstaller.ts)가 쓰는 npm. 사용자 PC 에 node·npm 이 없어도 앱이 Electron 바이너리로 이 npm 을 돌려
  // 공식 에이전트 패키지를 앱 전용 폴더에 받는다. 순수 JS 라 OS 마다 같은 것을 싣는다(약 12MB). 무결성 값으로 검증하고 캐시한다.
  const AGENT_NPM = { version: "12.2.2", integrity: "sha512-KglgbZyacf7jH+FHuNRqVuCzQi8VhI2a7J87Ix43FsPTuZoGWmIXXGdZtBUOA79vwL+IJREqURVzupA7PsQTcA==" };
  {
    const cacheDir = resolve(REPO_ROOT, "node_modules/.cache/oprn-agent-npm");
    const tarball = resolve(cacheDir, `npm-${AGENT_NPM.version}.tgz`);
    const verified = (file) => existsSync(file) && `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}` === AGENT_NPM.integrity;
    if (!verified(tarball)) {
      mkdirSync(cacheDir, { recursive: true });
      const response = await fetch(`https://registry.npmjs.org/npm/-/npm-${AGENT_NPM.version}.tgz`);
      if (!response.ok) throw new Error(`npm ${AGENT_NPM.version} 내려받기 실패: HTTP ${response.status}`);
      writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
      if (!verified(tarball)) throw new Error(`npm ${AGENT_NPM.version} 무결성 값이 맞지 않습니다`);
    }
    const target = resolve(OUT_DIR, "agent-npm");
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    const untar = spawnSync("tar", ["-xzf", tarball, "-C", target, "--strip-components=1"], { stdio: "inherit" });
    if (untar.status !== 0) throw new Error("npm 압축을 풀지 못했습니다");
    if (!existsSync(resolve(target, "bin/npm-cli.js"))) throw new Error("dist-electron/agent-npm/bin/npm-cli.js 가 없습니다");
    process.stdout.write(`staged dist-electron/agent-npm (npm ${AGENT_NPM.version})\n`);
  }

  // 순수 Node AI 워커(dist-electron/ai-worker.mjs)를 esbuild 로 묶는다 — Bun 단일 실행파일·pi_natives 애드온 불필요.
  // 옛 빌드가 남긴 Bun 워커·애드온·CJS 워커 파일은 먼저 지운다.
  for (const name of readdirSync(OUT_DIR)) {
    if (/^(?:pi_natives\..*\.node|oh-my-pi-worker(?:\.exe)?|ai-worker\.cjs)$/.test(name)) rmSync(resolve(OUT_DIR, name), { force: true });
  }
  const worker = spawnSync(process.execPath, [resolve(REPO_ROOT, "scripts/build-ai-worker.ts"), OUT_DIR], { cwd: REPO_ROOT, stdio: "inherit" });
  if (worker.status !== 0) throw new Error("AI 워커 빌드 실패");
}

if (process.env.OPRN_QA_FAST === "1") {
  // 오버레이는 기존 AppImage 의 워커와 함께 배치된 의존 파일을 쓴다.
  process.stdout.write("QA fast: skipped agent worker and agent-npm staging\n");
} else {
  await stageWorkerPayloads();
}
