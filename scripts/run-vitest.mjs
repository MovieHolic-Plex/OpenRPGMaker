#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function canonicalizeWindowsDrive(path) {
  if (process.platform !== "win32") return path;
  return path.replace(/^([a-z]):/, (_, drive) => `${drive.toUpperCase()}:`);
}

function canonicalizeRootArgs(args, defaultRoot) {
  const normalized = [...args];
  let hasRoot = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === "--root" || argument === "-r") {
      hasRoot = true;
      if (normalized[index + 1]) {
        normalized[index + 1] = canonicalizeWindowsDrive(normalized[index + 1]);
        index += 1;
      }
      continue;
    }
    if (argument.startsWith("--root=")) {
      hasRoot = true;
      normalized[index] = `--root=${canonicalizeWindowsDrive(argument.slice("--root=".length))}`;
    }
  }

  if (!hasRoot) normalized.push("--root", defaultRoot);
  return normalized;
}

const packagePath = fileURLToPath(import.meta.resolve("vitest/package.json"));
const vitestCli = canonicalizeWindowsDrive(join(dirname(packagePath), "vitest.mjs"));
const root = canonicalizeWindowsDrive(process.cwd());
const args = canonicalizeRootArgs(process.argv.slice(2), root);
const result = spawnSync(process.execPath, [vitestCli, ...args], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.signal) {
  console.error(`Vitest terminated by signal ${result.signal}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
