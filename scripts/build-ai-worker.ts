#!/usr/bin/env bun
// 데스크톱 앱에 싣는 조수 워커(dist-electron/oh-my-pi-worker[.exe])와 그 옆 자료 폴더(worker-data)를 만든다. build-electron.mjs 가 부르고, ci-fast 도 같은 것을 부른다.
// 사용: bun scripts/build-ai-worker.ts <출력 폴더> [linux|windows ...]   (대상 생략 = 둘 다)
//
// 리눅스 워커에는 pi_natives 애드온을 싣지 않는다 (2026-11-26, worker-slim). 윈도 워커는 싣는다(아래 «윈도는 애드온이 필요하다»).
// @oh-my-pi/pi-natives 는 Rust 애드온(리눅스 136MB·윈도 138MB)을 실행 중에 계산한 경로로 읽는다. 전에는 그 파일을 워커 옆에 두었다
// (openwiki/release-and-version.md «데스크톱 AI 워커는 네이티브 애드온을 옆에 둔다»). 우리 경로(Agent·전송·도구 호출)는 애드온 함수를
// 하나도 부르지 않는다. 호출 기록기로 MVP 여러 판을 돌려 0건이었다(omp-to-pi 레인). 그래서 로더(loadNative)를 빈 바인딩으로 바꿔 굽는다.
// 이름 가져오기는 «없음»(undefined)이 되고, omp 의 기능 확인(`bindings.x ?? 대체`)은 대체 경로로 간다. 누가 새로 애드온 함수를 부르면
// «… is not a function» 으로 그 요청만 실패한다. omp 판을 올려 로더 모양이 바뀌면 아래 치환이 0건이 되고 빌드가 멈춘다.
//
// 윈도는 애드온이 필요하다. 윈도에서는 omp 가 시작하자마자 pi-natives/path 의 expandWindowsLongPath(8.3 짧은 경로 펼치기)를 부르고,
// 그 함수는 윈도에서만 애드온을 읽는다. 애드온 없이 구운 윈도 워커는 «does not export `expandWindowsLongPath`» 로 바로 죽었다
// (2026-11-26 windows-worker-smoke, #5257 머지 직후). 그래서 윈도 워커는 로더를 그대로 두고 애드온을 워커 옆에 둔다(로더가 실행 파일 폴더를 본다).
// 윈도 애드온은 리눅스 호스트의 node_modules 에 설치되지 않는다(os 필터). package-lock 의 resolved·integrity 로 받아 검증하고 캐시한다.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = {
  linux: { target: "bun-linux-x64", name: "oh-my-pi-worker", addon: null },
  windows: { target: "bun-windows-x64", name: "oh-my-pi-worker.exe", addon: "win32-x64" },
} as const;

const [outArg, ...targetArgs] = process.argv.slice(2);
if (!outArg) throw new Error("사용: bun scripts/build-ai-worker.ts <출력 폴더> [linux|windows ...]");
const outDir = resolve(outArg);
const wanted = (targetArgs.length ? targetArgs : Object.keys(TARGETS)) as (keyof typeof TARGETS)[];
for (const key of wanted) if (!TARGETS[key]) throw new Error(`모르는 대상: ${key} (linux|windows)`);

const LOADER = "export function loadNative() {";
const noNativeAddon: import("bun").BunPlugin = {
  name: "oprn-no-pi-natives-addon",
  setup(build) {
    build.onLoad({ filter: /[\\/]@oh-my-pi[\\/]pi-natives[\\/]native[\\/]loader-state\.js$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      const count = source.split(LOADER).length - 1;
      if (count !== 1) throw new Error(`${args.path}: «${LOADER}» 가 ${count}번 있다. omp 판이 바뀌었다. 애드온 빼기 치환을 새 로더에 맞춰라`);
      return { contents: source.replace(LOADER, `${LOADER}\n\treturn {};\n}\nfunction oprnOriginalLoadNative() {`), loader: "js" };
    });
  },
};

/** 윈도 애드온을 워커 옆에 둔다. lock 의 pi-natives 가 모두 한 버전이어야 한다(두 버전이 섞이면 다른 버전 로더가 ~/.omp/natives 를 찾다 죽는다, 2026-11-04). */
function stageAddon(tag: string): void {
  const lock = JSON.parse(readFileSync(join(REPO_ROOT, "package-lock.json"), "utf8"));
  const nativesVersion = lock.packages["node_modules/@oh-my-pi/pi-natives"]?.version;
  if (!nativesVersion) throw new Error("package-lock 에 @oh-my-pi/pi-natives 가 없습니다");
  const stray = Object.entries(lock.packages as Record<string, { version?: string }>)
    .filter(([key, entry]) => /(^|\/)node_modules\/@oh-my-pi\/pi-natives$/.test(key) && entry.version !== nativesVersion)
    .map(([key, entry]) => `${key}@${entry.version}`);
  if (stray.length) throw new Error(`@oh-my-pi/pi-natives 가 ${nativesVersion} 하나가 아닙니다: ${stray.join(", ")}. package.json 의 @oh-my-pi/* 를 같은 버전으로 고정하세요`);
  const filename = `pi_natives.${tag}-baseline.node`;
  const packagePath = `node_modules/@oh-my-pi/pi-natives-${tag}`;
  const entry = lock.packages[packagePath];
  if (entry?.version !== nativesVersion) throw new Error(`${packagePath} 버전(${entry?.version})이 pi-natives ${nativesVersion} 과 다릅니다`);
  const outfile = join(outDir, filename);
  const installed = join(REPO_ROOT, packagePath, filename);
  if (existsSync(installed) && JSON.parse(readFileSync(join(REPO_ROOT, packagePath, "package.json"), "utf8")).version === nativesVersion) {
    copyFileSync(installed, outfile);
  } else {
    const cacheDir = join(REPO_ROOT, "node_modules/.cache/oprn-pi-natives");
    const tarball = join(cacheDir, `pi-natives-${tag}-${entry.version}.tgz`);
    const [algorithm, expected] = String(entry.integrity).split("-", 2);
    const matches = (bytes: Buffer) => createHash(algorithm).update(bytes).digest("base64") === expected;
    if (!(existsSync(tarball) && matches(readFileSync(tarball)))) {
      const download = spawnSync("curl", ["-fsSL", "--retry", "3", entry.resolved], { maxBuffer: 1 << 30 });
      if (download.status !== 0) throw new Error(`AI 워커 애드온 다운로드 실패 (${tag}): ${String(download.stderr).trim()}`);
      if (!matches(download.stdout)) throw new Error(`AI 워커 애드온 무결성 불일치 (${tag}): ${entry.resolved}`);
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(tarball, download.stdout);
    }
    const scratch = mkdtempSync(join(tmpdir(), "oprn-pi-natives-"));
    try {
      const untar = spawnSync("tar", ["-xzf", tarball, "-C", scratch, `package/${filename}`], { stdio: "inherit" });
      if (untar.status !== 0) throw new Error(`AI 워커 애드온 압축 해제 실패 (${tag})`);
      copyFileSync(join(scratch, "package", filename), outfile);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  console.log(`staged ${filename}`);
}

// 큰 JSON(번들 타일셋·참고문서 등 약 150개, 148MB)을 실행 파일에 박지 않고 <출력 폴더>/worker-data 에 두고 실행 때 읽는다 (2026-11-26, worker-slim).
// 박아 두면 워커 실행 파일이 리눅스 341MB 가 되고, 켤 때마다 그 JSON 을 스크립트로 훑느라 첫 조수 요청 기동이 약 7초 걸렸다(밖에 두면 약 2.5초, omp-to-pi 실측).
// 경로 해석·없을 때의 문구는 scripts/lib/workerData.ts. node_modules 의 JSON 은 그대로 둔다. 같은 폴더를 프로젝트 코어도 쓰므로(build-electron.mjs)
// 여기서는 폴더를 비우지 않는다. build-electron.mjs 가 빌드 처음에 비운다.
const DATA_MIN_BYTES = 64 * 1024;
const dataDir = join(outDir, "worker-data");
const RESERVED = new Set("arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(" "));
const externalized = new Map<string, number>();
const externalJson: import("bun").BunPlugin = {
  name: "oprn-worker-data-json",
  setup(build) {
    build.onLoad({ filter: /\.json$/ }, (args) => {
      if (args.path.split(sep).includes("node_modules")) return undefined;
      const bytes = statSync(args.path).size;
      if (bytes < DATA_MIN_BYTES) return undefined;
      const rel = relative(REPO_ROOT, args.path).split(sep).join("/");
      if (rel.startsWith("../")) return undefined;
      if (!externalized.has(rel)) {
        mkdirSync(dirname(join(dataDir, rel)), { recursive: true });
        copyFileSync(args.path, join(dataDir, rel));
        externalized.set(rel, bytes);
      }
      const data = JSON.parse(readFileSync(args.path, "utf8"));
      const names = data && typeof data === "object" && !Array.isArray(data)
        ? Object.keys(data).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED.has(name))
        : [];
      return {
        loader: "js",
        contents: [
          `import { readWorkerJson } from ${JSON.stringify(join(REPO_ROOT, "scripts/lib/workerData.ts"))};`,
          `const data = readWorkerJson(${JSON.stringify(rel)});`,
          "export default data;",
          ...names.map((name) => `export const ${name} = data[${JSON.stringify(name)}];`),
        ].join("\n"),
      };
    });
  },
};

for (const key of wanted) {
  const { target, name, addon } = TARGETS[key];
  const outfile = join(outDir, name);
  const result = await Bun.build({
    entrypoints: [join(REPO_ROOT, "scripts/oh-my-pi-worker.ts")],
    compile: { target, outfile },
    plugins: addon ? [externalJson] : [noNativeAddon, externalJson],
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) {
    for (const log of result.logs) console.error(String(log));
    throw new Error(`AI 워커 컴파일 실패: ${target}`);
  }
  if (key !== "windows") chmodSync(outfile, 0o755);
  if (addon) stageAddon(addon);
  console.log(`built ${outfile.replace(`${REPO_ROOT}/`, "")}`);
}
const dataBytes = [...externalized.values()].reduce((sum, bytes) => sum + bytes, 0);
console.log(`staged ${relative(REPO_ROOT, dataDir) || dataDir}: ${externalized.size} JSON, ${(dataBytes / 1048576).toFixed(1)}MB`);
