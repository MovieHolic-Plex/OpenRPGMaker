#!/usr/bin/env bun
// 데스크톱 앱에 싣는 조수 워커(dist-electron/oh-my-pi-worker[.exe])를 만든다. build-electron.mjs 가 부르고, ci-fast 도 같은 것을 부른다.
// 사용: bun scripts/build-ai-worker.ts <출력 폴더> [linux|windows ...]   (대상 생략 = 둘 다)
//
// pi_natives 애드온을 싣지 않는다 (2026-11-26, worker-slim).
// @oh-my-pi/pi-natives 는 Rust 애드온(리눅스 136MB·윈도 138MB)을 실행 중에 계산한 경로로 읽는다. 전에는 그 파일을 워커 옆에 두었다
// (openwiki/release-and-version.md «데스크톱 AI 워커는 네이티브 애드온을 옆에 둔다»). 우리 경로(Agent·전송·도구 호출)는 애드온 함수를
// 하나도 부르지 않는다. 호출 기록기로 MVP 여러 판을 돌려 0건이었다(omp-to-pi 레인). 그래서 로더(loadNative)를 빈 바인딩으로 바꿔 굽는다.
// 이름 가져오기는 «없음»(undefined)이 되고, omp 의 기능 확인(`bindings.x ?? 대체`)은 대체 경로로 간다. 누가 새로 애드온 함수를 부르면
// «… is not a function» 으로 그 요청만 실패한다. omp 판을 올려 로더 모양이 바뀌면 아래 치환이 0건이 되고 빌드가 멈춘다.
import { chmodSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = {
  linux: { target: "bun-linux-x64", name: "oh-my-pi-worker" },
  windows: { target: "bun-windows-x64", name: "oh-my-pi-worker.exe" },
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

for (const key of wanted) {
  const { target, name } = TARGETS[key];
  const outfile = join(outDir, name);
  const result = await Bun.build({
    entrypoints: [join(REPO_ROOT, "scripts/oh-my-pi-worker.ts")],
    compile: { target, outfile },
    plugins: [noNativeAddon],
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) {
    for (const log of result.logs) console.error(String(log));
    throw new Error(`AI 워커 컴파일 실패: ${target}`);
  }
  if (key !== "windows") chmodSync(outfile, 0o755);
  console.log(`built ${outfile.replace(`${REPO_ROOT}/`, "")}`);
}
