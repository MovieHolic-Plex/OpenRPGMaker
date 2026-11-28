// npm run bake:demos 의 입구. Windows 에서도 같은 환경 변수로 굽기 본체를 띄운다.
//
// 최적화 (2026-11-27):
//   1. 데모별 입력 해시 캐시 (`<cache>/v2/<id>-<sha256>`): package-lock.json 의 루트 버전 범프를 빼고
//      데모별 의존 그래프를 따로 추적한다 — 릴리스 버전 범프·무관한 커밋·다른 데모 수정이
//      변하지 않은 데모(특히 chrono-bell)를 무효화하지 않는다.
//   2. esbuild 단일 번들 + 코드 분할(큰 JSON 은 디스크에서 직접 JSON.parse):
//      vite-node 모듈 적재(~90초/프로세스)를 ~1초로 줄이고, esbuild 실패 시 vite-node 로 폴백한다.
//   3. 캐시 미스 데모는 CPU·메모리 예산 안에서 병렬 워커 풀로 굽고, BGM 은 캐시·병렬 다운로드로
//      메인 프로세스에서 한 번에 맞춘다.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, utimesSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEMO_ENTRY_FILES,
  computeDemoConcurrency,
  isDemoCacheInputRelevant,
  normalizePackageLockForHash,
  prunePerDemoCache,
  resolveDemoCacheScope,
  sortDemosByWeight,
  syncDemoBgm,
} from "./bake-demos-lib.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const entry = "scripts/content/bake-flagship-demos.mts";
const externalCacheDir = process.env.OPRN_BAKE_DEMOS_CACHE_DIR;
const cacheDir = externalCacheDir || join(root, "node_modules/.cache/oprn-bake-demos");
const args = process.argv.slice(2);
const forwarded = args.filter((arg) => arg !== "--no-cache" && arg !== "--force");
const outIndex = forwarded.indexOf("--out");
const outDir = resolve(root, (outIndex === -1 ? undefined : forwarded[outIndex + 1]) ?? "dist");
const demosDir = join(outDir, "demos");
const onlyIndex = forwarded.indexOf("--only");
const onlyFilter = onlyIndex === -1 ? null : (forwarded[onlyIndex + 1] ?? "").split(",").filter(Boolean);
const CACHE_SCHEMA_VERSION = "v2";

const fixedInputs = [
  "tsconfig.json",
  "assets/bgm-release-v1.json",
  "scripts/content/bake-flagship-demos.mjs",
  "scripts/content/bake-demos-lib.mjs",
  entry,
];
const query = /\?(?:raw|url|inline)$/;
const globCall = /import\.meta\.glob\s*\(\s*(\[(?:\s|,|"[^"]*"|'[^']*'|`[^`]*`)*\]|"[^"]*"|'[^']*'|`[^`]*`)/g;
const codeLoaders = new Map([
  [".ts", "ts"], [".mts", "ts"], [".cts", "ts"], [".tsx", "tsx"],
  [".js", "js"], [".mjs", "js"], [".cjs", "js"], [".jsx", "jsx"],
]);

const allDemoEntryAbs = new Map(
  Object.entries(DEMO_ENTRY_FILES).map(([id, rel]) => [id, resolve(root, rel)]),
);
const barrelAbs = resolve(root, "src/project/flagship/index.ts");

function addViteInputs(contents, file, inputs) {
  const dir = dirname(file);
  for (const [, patterns] of contents.matchAll(globCall)) {
    const positive = [];
    const negative = [];
    for (const [, literal] of patterns.matchAll(/["'`]([^"'`]+)["'`]/g)) {
      const exclude = literal.startsWith("!");
      const pattern = (exclude ? literal.slice(1) : literal).replace(query, "");
      const absolute = pattern.startsWith("@/") ? join(root, "src", pattern.slice(2))
        : pattern.startsWith("/") ? join(root, pattern.slice(1))
        : resolve(dir, pattern);
      (exclude ? negative : positive).push(relative(root, absolute).split("\\").join("/"));
    }
    for (const path of globSync(positive, { cwd: root, exclude: negative, withFileTypes: true })) {
      if (!path.isDirectory()) inputs.add(join(path.parentPath, path.name));
    }
  }
  for (const [, path] of contents.matchAll(/new\s+URL\s*\(\s*["'`]([^"'`\r\n]+)["'`]\s*,\s*import\.meta\.url\s*\)/g)) {
    if (path.includes("${") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) continue;
    const asset = path.startsWith("/")
      ? join(root, "public", path.split(/[?#]/, 1)[0].slice(1))
      : fileURLToPath(new URL(path, pathToFileURL(file)));
    if (statSync(asset, { throwIfNoEntry: false })?.isFile()) inputs.add(asset);
  }
}

/**
 * Trace the exact transitive file inputs for a single demo ID.
 * When `demoId` has an explicit entry file in `DEMO_ENTRY_FILES`, imports to the OTHER demos
 * and the flagship barrel are stubbed out so only shared bake code + THIS demo's graph are hashed.
 */
async function graphInputsForDemo(demoId, inputs) {
  const { build } = await import("esbuild");
  const knownEntry = allDemoEntryAbs.get(demoId);
  const excludedAbs = new Set();
  if (knownEntry) {
    for (const [otherId, absPath] of allDemoEntryAbs) {
      if (otherId !== demoId) excludedAbs.add(absPath);
    }
    excludedAbs.add(barrelAbs);
  }
  const { metafile } = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
    tsconfig: join(root, "tsconfig.json"),
    alias: { "@": join(root, "src") },
    packages: "external",
    external: ["node:*"],
    plugins: [{
      name: "oprn-bake-inputs",
      setup(graph) {
        graph.onResolve({ filter: query }, async (arg) => {
          const result = await graph.resolve(arg.path.replace(query, ""), {
            kind: arg.kind, importer: arg.importer, resolveDir: arg.resolveDir,
          });
          return { ...result, suffix: arg.path.match(query)[0] };
        });
        graph.onLoad({ filter: /.*/, namespace: "file" }, (arg) => {
          if (excludedAbs.has(arg.path)) {
            return { loader: "js", contents: "export {};" };
          }
          inputs.add(arg.path);
          const loader = codeLoaders.get(extname(arg.path));
          if (arg.suffix) return { loader: "text", contents: "" };
          if (extname(arg.path) === ".json") return { loader: "js", contents: "module.exports = {};" };
          if (!loader) return { loader: "empty", contents: "" };
          const contents = readFileSync(arg.path, "utf8");
          addViteInputs(contents, arg.path, inputs);
          return { loader, contents, resolveDir: dirname(arg.path) };
        });
      },
    }],
  });
  // esbuild 는 import 속성이 붙은 입력을 `x.json with { type: 'json' }` 이름으로 적는다 — 꼬리를 떼야 파일을 읽는다.
  for (const path of Object.keys(metafile.inputs)) {
    const clean = resolve(root, path.replace(/ with \{[^}]*\}$/, "").replace(query, ""));
    if (!excludedAbs.has(clean)) inputs.add(clean);
  }
}

async function computePerDemoKeys(demoIds) {
  const cacheScope = resolveDemoCacheScope();
  const fileDigestCache = new Map();
  const digestOf = (file) => {
    let digest = fileDigestCache.get(file);
    if (!digest) {
      digest = createHash("sha256").update(readFileSync(file)).digest("hex");
      fileDigestCache.set(file, digest);
    }
    return digest;
  };

  // package-lock.json 은 의존성 변경만 반영하고 루트 프로젝트 버전 범프는 무시한다.
  const lockPath = join(root, "package-lock.json");
  const lockDigest = existsSync(lockPath)
    ? createHash("sha256").update(normalizePackageLockForHash(readFileSync(lockPath, "utf8"))).digest("hex")
    : "no-lockfile";

  const keys = new Map();
  let fallbackFiles = null;
  for (const demoId of demoIds) {
    const inputs = new Set();
    try {
      await graphInputsForDemo(demoId, inputs);
    } catch (error) {
      if (process.env.CI) throw error;
      inputs.clear();
      if (!fallbackFiles) {
        console.warn(`bake:demos cache graph fallback (hashing src/**): ${error.message.split("\n")[0]}`);
        fallbackFiles = [];
        for (const file of readdirSync(join(root, "src"), { recursive: true, withFileTypes: true })) {
          if (file.isFile() || file.isSymbolicLink()) fallbackFiles.push(join(file.parentPath, file.name));
        }
      }
      for (const file of fallbackFiles) inputs.add(file);
    }

    for (const file of fixedInputs) inputs.add(join(root, file));
    const hash = createHash("sha256");
    hash.update(JSON.stringify([CACHE_SCHEMA_VERSION, cacheScope, demoId, process.version, lockDigest]));
    for (const file of [...inputs].sort()) {
      const relPath = relative(root, file);
      const posixRel = isAbsolute(relPath) ? file : relPath.split("\\").join("/");
      if (!isDemoCacheInputRelevant(posixRel, cacheScope)) continue;
      const digest = digestOf(file);
      hash.update(JSON.stringify([posixRel, digest]));
    }
    keys.set(demoId, hash.digest("hex"));
  }
  return keys;
}

/**
 * Bundle `bake-flagship-demos.mts` once with esbuild (code-split per demo, large JSON loaded via fs)
 * so parallel worker processes start in ~1s instead of ~90s with vite-node.
 */
async function buildBakeBundle() {
  const { build } = await import("esbuild");
  const bundleBase = join(root, "node_modules/.cache");
  mkdirSync(bundleBase, { recursive: true });
  const bundleDir = mkdtempSync(join(bundleBase, ".oprn-bake-bundle-"));
  const started = performance.now();
  try {
    await build({
      absWorkingDir: root,
      entryPoints: [entry],
      bundle: true,
      splitting: true,
      format: "esm",
      platform: "node",
      target: "node22",
      outdir: bundleDir,
      entryNames: "bake",
      outExtension: { ".js": ".mjs" },
      tsconfig: join(root, "tsconfig.json"),
      alias: { "@": join(root, "src") },
      packages: "external",
      external: ["node:*"],
      define: { "import.meta.env": "{}" },
      logLevel: "warning",
      plugins: [{
        name: "oprn-bake-runtime",
        setup(pluginBuild) {
          pluginBuild.onLoad({ filter: /\.css$/, namespace: "file" }, () => ({
            loader: "empty",
            contents: "",
          }));
          pluginBuild.onLoad({ filter: /\.json$/, namespace: "file" }, (arg) => {
            if (arg.path.split(sep).includes("node_modules")) return undefined;
            const text = readFileSync(arg.path, "utf8");
            if (text.length < 20_000) return undefined;
            const parsed = JSON.parse(text);
            const lines = [
              `import { readFileSync } from "node:fs";`,
              `const data = JSON.parse(readFileSync(${JSON.stringify(arg.path)}, "utf8"));`,
              `export default data;`,
            ];
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const keys = Object.keys(parsed);
              if (keys.length <= 200) {
                const specs = [];
                let index = 0;
                for (const key of keys) {
                  if (key === "default") continue;
                  const local = `_k${index++}`;
                  lines.push(`const ${local} = data[${JSON.stringify(key)}];`);
                  specs.push(`${local} as ${JSON.stringify(key)}`);
                }
                if (specs.length > 0) lines.push(`export { ${specs.join(", ")} };`);
              }
            }
            return { loader: "js", contents: lines.join("\n") };
          });
        },
      }],
    });
    const entryFile = join(bundleDir, "bake.mjs");
    console.log(`bake:demos esbuild bundle ${((performance.now() - started) / 1000).toFixed(2)}s`);
    return { bundleDir, entryFile };
  } catch (error) {
    rmSync(bundleDir, { recursive: true, force: true });
    console.warn(`bake:demos esbuild bundle fallback to vite-node: ${error.message.split("\n")[0]}`);
    return null;
  }
}

function spawnDemoWorker(demoId, bundleEntry) {
  return new Promise((resolveStatus) => {
    const workerArgs = [
      "--max-old-space-size=10000",
      ...(bundleEntry
        ? [bundleEntry]
        : ["node_modules/vite-node/dist/cli.mjs", "--script", entry]),
      "--out",
      outDir,
      "--only",
      demoId,
      "--no-bgm",
    ];
    const child = spawn(process.execPath, workerArgs, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, OPRN_ASSUME_ALL_BGM_INSTALLED: "1" },
    });
    child.on("error", (error) => { console.error(error.message); resolveStatus(1); });
    child.on("exit", (code) => resolveStatus(code ?? 1));
  });
}

function demoCachePath(demoId, key) {
  return join(cacheDir, CACHE_SCHEMA_VERSION, `${demoId}-${key}`);
}

function demoOutputNames(demoId) {
  return [`${demoId}.play.json`, `${demoId}.project.json`];
}

function restoreDemoFromCache(demoId, key) {
  const path = demoCachePath(demoId, key);
  const names = demoOutputNames(demoId);
  if (!names.every((name) => existsSync(join(path, name)))) return false;
  mkdirSync(demosDir, { recursive: true });
  for (const name of names) copyFileSync(join(path, name), join(demosDir, name));
  const now = new Date();
  try { utimesSync(path, now, now); } catch { /* ignore */ }
  return true;
}

function storeDemoInCache(demoId, key) {
  const v2Dir = join(cacheDir, CACHE_SCHEMA_VERSION);
  mkdirSync(v2Dir, { recursive: true });
  const target = demoCachePath(demoId, key);
  const temp = mkdtempSync(join(v2Dir, `.writing-${demoId}-`));
  try {
    for (const name of demoOutputNames(demoId)) {
      copyFileSync(join(demosDir, name), join(temp, name));
    }
    try {
      renameSync(temp, target);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code) || !existsSync(target)) throw error;
    }
    const now = new Date();
    try { utimesSync(target, now, now); } catch { /* ignore */ }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function bakeDemoPool(demoIds, onDemoBaked = null) {
  const ordered = sortDemosByWeight(demoIds);
  const concurrency = computeDemoConcurrency({ missCount: ordered.length });
  const bundle = await buildBakeBundle();
  const started = performance.now();
  let cursor = 0;
  let firstFailure = 0;
  try {
    const runWorker = async () => {
      while (cursor < ordered.length && firstFailure === 0) {
        const demoId = ordered[cursor++];
        const status = await spawnDemoWorker(demoId, bundle?.entryFile ?? null);
        if (status !== 0) {
          if (firstFailure === 0) firstFailure = status;
          return;
        }
        if (onDemoBaked) onDemoBaked(demoId);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, runWorker));
  } finally {
    if (bundle) rmSync(bundle.bundleDir, { recursive: true, force: true });
  }
  console.log(`bake:demos pool (${ordered.join(", ")}; workers=${concurrency}) ${((performance.now() - started) / 1000).toFixed(1)}s`);
  if (firstFailure !== 0) process.exit(firstFailure);
}

async function main() {
  const { FLAGSHIP_DEMO_IDS } = await import("../../src/project/flagship/types.ts");
  const targetDemos = onlyFilter
    ? FLAGSHIP_DEMO_IDS.filter((id) => onlyFilter.includes(id))
    : [...FLAGSHIP_DEMO_IDS];

  if (forwarded.includes("--bgm-only")) {
    await syncDemoBgm({
      root,
      outDir,
      demoIds: targetDemos,
      cacheDir: process.env.CI && !externalCacheDir ? null : cacheDir,
    });
    return;
  }

  let noCacheReason;
  if (process.env.CI && !externalCacheDir) noCacheReason = "CI";
  else if (process.env.OPRN_BAKE_DEMOS_NO_CACHE === "1") noCacheReason = "OPRN_BAKE_DEMOS_NO_CACHE=1";
  else noCacheReason = args.find((arg) => ["--no-cache", "--force"].includes(arg));

  if (noCacheReason) {
    console.log(`bake:demos cache disabled (${noCacheReason})`);
    await bakeDemoPool(targetDemos);
    if (!forwarded.includes("--no-bgm")) {
      await syncDemoBgm({
        root,
        outDir,
        demoIds: targetDemos,
        cacheDir: process.env.CI && !externalCacheDir ? null : cacheDir,
      });
    }
    return;
  }

  const keyStarted = performance.now();
  let keys = null;
  try {
    keys = await computePerDemoKeys(targetDemos);
  } catch (error) {
    console.log(`bake:demos cache disabled (key unavailable: ${error.message.split("\n")[0]})`);
  } finally {
    console.log(`bake:demos cache keys (${targetDemos.length} demos) ${((performance.now() - keyStarted) / 1000).toFixed(2)}s`);
  }

  if (!keys) {
    await bakeDemoPool(targetDemos);
    if (!forwarded.includes("--no-bgm")) {
      await syncDemoBgm({ root, outDir, demoIds: targetDemos, cacheDir });
    }
    return;
  }

  const hits = [];
  const misses = [];
  for (const demoId of targetDemos) {
    const key = keys.get(demoId);
    let ok = false;
    try {
      ok = restoreDemoFromCache(demoId, key);
    } catch (error) {
      console.warn(`bake:demos cache read failed (${demoId}): ${error.message}`);
    }
    if (ok) hits.push(`${demoId}@${key.slice(0, 10)}`);
    else misses.push(demoId);
  }

  if (hits.length > 0) console.log(`bake:demos cache hit (${hits.length}/${targetDemos.length}): ${hits.join(", ")}`);
  if (misses.length > 0) {
    console.log(`bake:demos cache miss (${misses.length}/${targetDemos.length}): ${misses.map((id) => `${id}@${keys.get(id).slice(0, 10)}`).join(", ")}`);
    await bakeDemoPool(misses, (demoId) => {
      try {
        storeDemoInCache(demoId, keys.get(demoId));
      } catch (error) {
        console.warn(`bake:demos cache store failed (${demoId}): ${error.message}`);
      }
    });
  }

  try {
    prunePerDemoCache(cacheDir, 3);
  } catch (error) {
    console.warn(`bake:demos cache prune failed: ${error.message}`);
  }

  if (!forwarded.includes("--no-bgm")) {
    await syncDemoBgm({ root, outDir, demoIds: targetDemos, cacheDir });
  }
}

await main();
