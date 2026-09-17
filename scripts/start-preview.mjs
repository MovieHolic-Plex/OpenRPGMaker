// `npm start` opens a persistent project host at the existing mdc-server address.
// A plain Vite preview has no storage bridge after the SQLite migration.
// Keep this filename: existing systemd services invoke it directly.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..");

/** .env.local → .env 순으로 읽어 첫 정의를 남긴다(앞 파일이 이긴다). 옛 이름은 별칭 심이 새 이름으로 옮긴다. */
function envFileValues() {
  const values = {};
  for (const file of [join(repoRoot, ".env.local"), join(repoRoot, ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator <= 0 || line.startsWith("#")) continue;
      const name = line.slice(0, separator).trim();
      if (name in values) continue;
      values[name] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  applyLegacyEnvAliases(values);
  return values;
}

/** Resolve only an explicitly selected project; never silently create a blank replacement. */
export function projectHostArgs(argv, env, fileEnv = {}, rootDir = repoRoot) {
  const options = new Map();
  const allowed = new Set(["--project-dir", "--host", "--port", "--public-origin", "--dist", "--bridge"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!allowed.has(flag)) throw new Error(`알 수 없는 인자: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} 값이 필요합니다`);
    options.set(flag, value);
  }
  const projectDir = options.get("--project-dir") || env.OPRN_PROJECT_DIR || fileEnv.OPRN_PROJECT_DIR;
  if (!projectDir) {
    throw new Error("저장할 프로젝트 폴더가 필요합니다. OPRN_PROJECT_DIR을 설정하거나 npm start -- --project-dir /path/to/project 를 사용하세요. 저장 없는 미리보기는 npm run preview 입니다.");
  }
  const absoluteProjectDir = resolve(rootDir, projectDir);
  if (!existsSync(join(absoluteProjectDir, "project.sqlite"))) {
    throw new Error(`기존 project.sqlite를 찾을 수 없습니다: ${absoluteProjectDir}. 폴더를 확인하거나 oprn-store로 프로젝트를 먼저 생성/이관하세요. 빈 프로젝트로 대체하지 않습니다.`);
  }
  options.set("--project-dir", absoluteProjectDir);
  if (!options.has("--host")) options.set("--host", "0.0.0.0");
  if (!options.has("--port")) options.set("--port", "9888");
  if (!options.has("--public-origin")) {
    options.set("--public-origin", env.OPRN_PUBLIC_ORIGIN || fileEnv.OPRN_PUBLIC_ORIGIN || "http://mdc-server:9888");
  }
  return [...options].flat();
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("npm start -- --project-dir /path/to/existing-project [--host 0.0.0.0 --port 9888 --public-origin http://mdc-server:9888] [--dist path --bridge path]");
    console.log("OPRN_PROJECT_DIR / OPRN_PUBLIC_ORIGIN: process env > .env.local > .env. Build first: npm run build:packaged && npm run build:electron");
    return;
  }
  const args = projectHostArgs(process.argv.slice(2), process.env, envFileValues());
  const host = spawn(process.execPath, [join(root, "oprn-serve.mjs"), ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  host.on("exit", (code, signal) => {
    console.log(`[oprn] project host exited: code=${code ?? "null"} signal=${signal ?? "none"}`);
    process.exit(signal ? 1 : (code ?? 0));
  });
  host.on("error", (error) => {
    console.error(`[oprn] project host failed to start: ${error.message}`);
    process.exit(1);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => host.kill(signal));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`[oprn] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
