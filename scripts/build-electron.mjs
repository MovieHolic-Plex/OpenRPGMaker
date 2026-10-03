#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(REPO_ROOT, "dist-electron");

const ENTRIES = [
  {
    entry: resolve(REPO_ROOT, "electron/main/main.ts"),
    outfile: resolve(OUT_DIR, "main.cjs"),
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

await mkdir(OUT_DIR, { recursive: true });
// 자산 브라우저가 받은 RAR 팩(예: Rasak Modern)을 메인 프로세스에서 푼다 — node-unrar-js 는 wasm 을 따로 읽는다.
// 번들(main.cjs) 옆에 두고 electron/main/rarPack.ts 가 __dirname 에서 읽는다.
copyFileSync(resolve(REPO_ROOT, "node_modules/node-unrar-js/dist/js/unrar.wasm"), resolve(OUT_DIR, "unrar.wasm"));
process.stdout.write("staged dist-electron/unrar.wasm\n");
for (const { entry, outfile, format, platform, target, external } of ENTRIES) {
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
  });
  process.stdout.write(`built ${outfile.replace(`${REPO_ROOT}/`, "")}\n`);
  if (format === "cjs") assertNoTopLevelImportMeta(outfile);
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
