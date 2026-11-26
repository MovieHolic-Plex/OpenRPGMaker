import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const payloadRoots = ["dist", "dist-electron", "scripts/lib"];
const usage = "npm run qa:bundle -- [--with-demos] [--with-worker] [--skip-build] [--base <git-ref>] [--out <file>]";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`);
  return result.stdout;
}

function git(...args) {
  return run("git", args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
}

function resolveBase(override) {
  const resolveCommit = (ref) => git("rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`);
  if (override !== undefined) return { base: override, commit: resolveCommit(override) };

  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const versionTag = `v${version}`;
  try {
    return { base: versionTag, commit: resolveCommit(`refs/tags/${versionTag}`) };
  } catch {
    const base = git("describe", "--tags", "--abbrev=0");
    return { base, commit: resolveCommit(`refs/tags/${base}`) };
  }
}

function collectPublicChanges(override) {
  let resolved;
  try {
    resolved = resolveBase(override);
  } catch {
    const ref = override === undefined ? "the version tag or latest reachable tag" : JSON.stringify(override);
    console.warn(`WARNING: qa:bundle could not resolve base ${ref}. All byte-identical public copies will be excluded, so QA may use stale assets from the AppImage.`);
    return { base: null, changedPublic: new Set() };
  }

  const tracked = git("diff", "--no-renames", "--name-only", "-z", resolved.commit, "--", "public/");
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z", "--", "public/");
  return { base: resolved.base, changedPublic: new Set([tracked, untracked].flatMap((paths) => paths.split("\0").filter(Boolean))) };
}

async function step(name, fn) {
  const started = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`qa:bundle ${name}: ${((performance.now() - started) / 1000).toFixed(2)}s`);
  }
}

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function matchesPublic(file, publicFile) {
  const original = join(root, publicFile);
  const copy = join(root, file);
  const source = statSync(original, { throwIfNoEntry: false });
  if (!source?.isFile() || source.size !== statSync(copy).size) return false;
  const [sourceHash, copyHash] = await Promise.all([hashFile(original), hashFile(copy)]);
  return sourceHash === copyHash;
}

async function collect(withDemos, withWorker, changedPublic) {
  const files = ["package.json"];
  const excludedPublicFiles = [];
  const changedPublicIncluded = [];
  const excluded = (file) =>
    file.endsWith(".d.mts") ||
    (!withDemos && file === "dist/demos") ||
    (!withWorker && /^dist-electron\/(?:oh-my-pi-worker[^/]*|pi_natives[^/]*\.node|agent-npm|worker-data)$/.test(file));

  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (excluded(file)) continue;
      if (entry.isDirectory()) await walk(file);
      else if (!entry.isFile()) throw new Error(`Unsupported QA bundle entry: ${file}`);
      else if (dir.startsWith("dist/") || dir === "dist") {
        // 데모는 명시적으로 고른 산출물이다. 기본 AppImage 의 public 사본은 변경이 없을 때만 재사용한다.
        const publicFile = `public/${file.slice("dist/".length)}`;
        if (!file.startsWith("dist/demos/") && await matchesPublic(file, publicFile)) {
          if (!changedPublic.has(publicFile)) {
            excludedPublicFiles.push(file);
            continue;
          }
          changedPublicIncluded.push(publicFile);
        }
        files.push(file);
      } else files.push(file);
    }
  }

  for (const dir of payloadRoots) await walk(dir);
  return { files: files.sort(), excludedPublicFiles: excludedPublicFiles.sort(), changedPublicIncluded: changedPublicIncluded.sort() };
}

async function main() {
  const { values: flags } = parseArgs({
    options: {
      "with-demos": { type: "boolean" },
      "with-worker": { type: "boolean" },
      "skip-build": { type: "boolean" },
      base: { type: "string" },
      out: { type: "string", default: "release/qa-bundle.tgz" },
      help: { type: "boolean" },
    },
  });
  if (flags.help) {
    console.log(usage);
    return;
  }
  const output = resolve(root, flags.out);
  const withDemos = flags["with-demos"] ?? false;
  const withWorker = flags["with-worker"] ?? false;

  // 산출물 목록을 걷는 도중 이전 번들을 집어넣지 않도록 출력은 입력 폴더 밖에 둔다.
  for (const dir of [...payloadRoots, "public", "package.json"]) {
    const input = resolve(root, dir);
    if (output === input || output.startsWith(`${input}/`) || output.startsWith(`${input}\\`)) {
      throw new Error("--out must be outside the bundle inputs");
    }
  }
  const manifest = {
    gitSha: git("rev-parse", "HEAD"),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    dirty: git("status", "--porcelain").length > 0,
    buildTime: new Date().toISOString(),
    included: { roots: [...payloadRoots, "package.json"], demos: withDemos, worker: withWorker },
  };

  if (!flags["skip-build"]) {
    await step("renderer", () => run(process.execPath, [
      "node_modules/vite/bin/vite.js", "build", "--mode", "packaged", "--configLoader", "runner",
    ]));
    await step("electron", () => run(process.execPath, ["scripts/build-electron.mjs"], {
      env: { ...process.env, OPRN_QA_FAST: withWorker ? "0" : "1" },
    }));
    if (withDemos) await step("demos", () => run(process.execPath, ["scripts/content/bake-flagship-demos.mjs"]));
  }

  const { base, changedPublic } = collectPublicChanges(flags.base);
  const { files, excludedPublicFiles, changedPublicIncluded } = await step("collect files", () => collect(withDemos, withWorker, changedPublic));
  const required = ["dist/index.html", "dist-electron/main.cjs", "dist-electron/app.cjs"];
  if (withDemos) {
    const { FLAGSHIP_DEMO_IDS } = await import("../../src/project/flagship/types.ts");
    for (const id of FLAGSHIP_DEMO_IDS) required.push(`dist/demos/${id}.play.json`, `dist/demos/${id}.project.json`);
  }
  if (withWorker) required.push(
    "dist-electron/oh-my-pi-worker",
    "dist-electron/worker-data/src/assets/beodeulCityTileset.json",
    "dist-electron/agent-npm/bin/npm-cli.js",
  );
  for (const file of required) {
    if (!files.includes(file)) throw new Error(`Missing QA bundle input: ${file}`);
  }

  mkdirSync(dirname(output), { recursive: true });
  const temp = mkdtempSync(join(dirname(output), ".qa-bundle-"));
  try {
    // 실패한 압축이 직전에 만든 정상 번들을 덮지 않도록 같은 파일 시스템에서 교체한다.
    const archive = join(temp, "bundle.tgz");
    const manifestName = "qa-bundle.json";
    writeFileSync(join(temp, manifestName), JSON.stringify({
      ...manifest,
      base,
      fileCount: files.length + 1,
      excludedPublicFileCount: excludedPublicFiles.length,
      excludedPublicFiles,
      changedPublicIncluded: { count: changedPublicIncluded.length, files: changedPublicIncluded.slice(0, 200) },
    }, null, 2) + "\n");
    const list = join(temp, "files");
    writeFileSync(list, files.join("\0") + "\0");
    await step("tar", () => run("tar", [
      "-czf", archive, "--no-recursion", "-C", root, "--null", "-T", list, "-C", temp, manifestName,
    ], { env: { ...process.env, TAR_OPTIONS: "" } }));
    renameSync(archive, output);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  console.log(`qa:bundle ${output} (${(lstatSync(output).size / 1048576).toFixed(1)} MiB, ${files.length + 1} files, ${excludedPublicFiles.length} public copies excluded, ${changedPublicIncluded.length} changed public copies included)`);
}

try {
  await main();
} catch (error) {
  console.error(`qa:bundle: ${error.message}\n${usage}`);
  process.exitCode = 1;
}
