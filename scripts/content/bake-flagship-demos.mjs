// npm run bake:demos 의 입구. Windows 에서도 같은 환경 변수로 굽기 본체를 띄운다.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  renameSync, rmSync, statSync, utimesSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const entry = "scripts/content/bake-flagship-demos.mts";
const cacheDir = join(root, "node_modules/.cache/oprn-bake-demos");
const args = process.argv.slice(2);
const forwarded = args.filter((arg) => arg !== "--no-cache" && arg !== "--force");
const out = forwarded.indexOf("--out");
const demosDir = resolve(root, (out === -1 ? undefined : forwarded[out + 1]) ?? "dist", "demos");
const fixedInputs = [
  "package-lock.json", "vite.config.ts", "tsconfig.json", "assets/bgm-release-v1.json",
  "scripts/content/bake-flagship-demos.mjs", entry,
];
const query = /\?(?:raw|url|inline)$/;
const globCall = /import\.meta\.glob\s*\(\s*(\[(?:\s|,|"[^"]*"|'[^']*'|`[^`]*`)*\]|"[^"]*"|'[^']*'|`[^`]*`)/g;
const codeLoaders = new Map([
  [".ts", "ts"], [".mts", "ts"], [".cts", "ts"], [".tsx", "tsx"],
  [".js", "js"], [".mjs", "js"], [".cjs", "js"], [".jsx", "jsx"],
]);

function bake(bgmOnly = false) {
  const result = spawnSync(process.execPath, [
    "--max-old-space-size=12000",
    "node_modules/vite-node/dist/cli.mjs",
    "--script",
    entry,
    ...forwarded,
    ...(bgmOnly ? ["--bgm-only"] : []),
  ], { cwd: root, stdio: "inherit", env: { ...process.env, OPRN_ASSUME_ALL_BGM_INSTALLED: "1" } });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function addViteInputs(contents, file, inputs) {
  const dir = dirname(file);
  // Vite 만 푸는 글롭과 URL 도 굽기 결과를 바꿀 수 있어 원본 파일을 키에 넣는다.
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

async function graphInputs(inputs) {
  const { build } = await import("esbuild");
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
          inputs.add(arg.path);
          const loader = codeLoaders.get(extname(arg.path));
          // 경로만 필요하다. 큰 JSON 은 이름 가져오기도 받는 대역으로 두고 자산은 빈 모듈로 읽는다.
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
  for (const path of Object.keys(metafile.inputs)) inputs.add(resolve(root, path.replace(query, "")));
}

async function computeKey() {
  const inputs = new Set();
  try {
    await graphInputs(inputs);
  } catch (error) {
    // 중간에 실패한 탐색 순서가 폴백 키에 영향을 주지 않게 한다.
    inputs.clear();
    console.warn(`bake:demos cache graph fallback (hashing src/**): ${error.message.split("\n")[0]}`);
    for (const file of readdirSync(join(root, "src"), { recursive: true, withFileTypes: true })) {
      if (file.isFile() || file.isSymbolicLink()) inputs.add(join(file.parentPath, file.name));
    }
  }

  for (const file of fixedInputs) inputs.add(join(root, file));
  const hash = createHash("sha256");
  hash.update(JSON.stringify([process.version, forwarded]));
  for (const file of [...inputs].sort()) {
    const path = relative(root, file);
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    hash.update(JSON.stringify([isAbsolute(path) ? file : path.split("\\").join("/"), digest]));
  }
  return hash.digest("hex");
}

function pruneCache() {
  const entries = readdirSync(cacheDir, { withFileTypes: true })
    .filter((dir) => dir.isDirectory() && /^[a-f0-9]{64}$/.test(dir.name))
    .map(({ name }) => ({ path: join(cacheDir, name), mtime: statSync(join(cacheDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { path } of entries.slice(3)) rmSync(path, { recursive: true, force: true });
}

function storeCache(cachePath, names) {
  mkdirSync(cacheDir, { recursive: true });
  const temp = mkdtempSync(join(cacheDir, ".writing-"));
  try {
    for (const name of names) copyFileSync(join(demosDir, name), join(temp, name));
    // 다른 굽기에서 절반만 쓴 JSON 을 읽지 않도록 완성된 폴더만 공개한다.
    try {
      renameSync(temp, cachePath);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code) || !existsSync(cachePath)) throw error;
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function main() {
  let reason;
  if (process.env.CI) reason = "CI";
  else if (process.env.OPRN_BAKE_DEMOS_NO_CACHE === "1") reason = "OPRN_BAKE_DEMOS_NO_CACHE=1";
  else reason = args.find((arg) => ["--no-cache", "--force", "--only", "--bgm-only"].includes(arg));
  if (reason) {
    console.log(`bake:demos cache disabled (${reason})`);
    return bake();
  }

  const started = performance.now();
  let key, names;
  try {
    // 본체와 같은 ID 목록을 읽어 출력 폴더에 남은 옛 데모를 캐시에 담지 않는다.
    const { FLAGSHIP_DEMO_IDS } = await import("../../src/project/flagship/types.ts");
    names = FLAGSHIP_DEMO_IDS.flatMap((id) => [`${id}.play.json`, `${id}.project.json`]);
    key = await computeKey();
  } catch (error) {
    console.log(`bake:demos cache disabled (key unavailable: ${error.message.split("\n")[0]})`);
  } finally {
    console.log(`bake:demos cache key ${((performance.now() - started) / 1000).toFixed(2)}s`);
  }
  if (!key) return bake();

  const cachePath = join(cacheDir, key);
  let hit = false;
  try {
    if (names.every((name) => existsSync(join(cachePath, name)))) {
      mkdirSync(demosDir, { recursive: true });
      for (const name of names) copyFileSync(join(cachePath, name), join(demosDir, name));
      hit = true;
    }
  } catch (error) {
    console.warn(`bake:demos cache read failed: ${error.message}`);
  }

  const short = key.slice(0, 12);
  if (hit) {
    console.log(`bake:demos cache hit ${short} (skipped demo build)`);
    bake(true);
  } else {
    console.log(`bake:demos cache miss ${short}`);
    bake();
  }
  try {
    if (!hit) storeCache(cachePath, names);
    const now = new Date();
    utimesSync(cachePath, now, now);
    pruneCache();
  } catch (error) {
    console.warn(`bake:demos cache update failed: ${error.message}`);
  }
}

await main();
