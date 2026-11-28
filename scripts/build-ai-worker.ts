#!/usr/bin/env node
// 데스크톱 앱에 싣는 순수 Node ESM 조수 워커(dist-electron/ai-worker.mjs)와 그 옆 자료 폴더(worker-data)를 만든다.
// build-electron.mjs 가 부른다.
//
// @oh-my-pi/* → @earendil-works/pi-ai + pi-agent-core 교체(2026-11-28)로:
// - Bun 단일 실행파일(oh-my-pi-worker[.exe], ~166MB) 불필요 → Electron 바이너리(ELECTRON_RUN_AS_NODE=1)가 ESM 번들을 직접 실행
// - Windows Rust 네이티브 애드온(pi_natives.win32-x64-baseline.node, 138MB) 완전 제거
// - ESM 포맷이라 import.meta.url 이 네이티브로 살아 있고, OS 무관 단일 번들 하나만 싣는다
//
// 사용: node scripts/build-ai-worker.ts <출력 폴더>
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [outArg] = process.argv.slice(2);
if (!outArg) throw new Error("사용: node scripts/build-ai-worker.ts <출력 폴더>");
const outDir = resolve(outArg);

const DATA_MIN_BYTES = 64 * 1024;
const dataDir = join(outDir, "worker-data");
const RESERVED = new Set("arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(" "));
const externalized = new Map<string, number>();

const externalJson: Plugin = {
  name: "oprn-worker-data-json",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.json$/ }, (args) => {
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

mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, "ai-worker.mjs");
await build({
  absWorkingDir: REPO_ROOT,
  bundle: true,
  minify: true,
  entryPoints: [join(REPO_ROOT, "scripts/oh-my-pi-worker.ts")],
  outfile,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["electron", "node:*"],
  banner: {
    js: 'import { createRequire as __oprnCreateRequire } from "node:module"; import { fileURLToPath as __oprnFileURLToPath } from "node:url"; import { dirname as __oprnDirname } from "node:path"; const require = __oprnCreateRequire(import.meta.url); const __filename = __oprnFileURLToPath(import.meta.url); const __dirname = __oprnDirname(__filename);',
  },
  logLevel: "warning",
  plugins: [externalJson],
});

const sizeMb = (statSync(outfile).size / 1048576).toFixed(2);
const totalDataMb = ([...externalized.values()].reduce((a, b) => a + b, 0) / 1048576).toFixed(1);
console.log(`built ${relative(REPO_ROOT, outfile)} (${sizeMb} MB), externalized ${externalized.size} json files (${totalDataMb} MB) into worker-data`);
