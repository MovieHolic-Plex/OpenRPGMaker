#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

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


/**
 * vitest 워커의 힙 상한.
 *
 * 이 저장소의 스위트는 파일 단위로 워커가 갈리고(pool=forks), 케이스가 많은 파일일수록 한 워커의 힙이
 * 자란다. 실측(2026-09-11): `test/verificationPlanAtomicity.test.ts` 가 108케이스에서 피크 4.34GB —
 * Node 기본 상한(이 박스에서 4,288MB, `v8.getHeapStatistics().heap_size_limit`)을 넘겨 워커가
 * `Ineffective mark-compacts near heap limit` 으로 죽고, 그 워커가 맡은 파일은 결과를 못 내놨다.
 * 기본 상한은 머신 메모리(98GB)와 무관하게 **프로세스당** 걸리므로 RAM 이 남아도 소용이 없다.
 *
 * 그래서 8GB 를 기본으로 깔아 둔다(근본 수정은 그 파일을 세 파일로 가른 것 — 각 피크 3.13/2.06/2.88GB).
 * 사용자가 이미 `--max-old-space-size` 를 줬으면 그 값을 존중한다. 더 키우려면 `OPRN_VITEST_HEAP_MB`.
 */
const DEFAULT_HEAP_MB = process.env.OPRN_VITEST_HEAP_MB ?? "8192";
function withHeapOption(nodeOptions) {
  const current = nodeOptions ?? "";
  if (/--max-old-space-size/.test(current)) return current;
  return `${current} --max-old-space-size=${DEFAULT_HEAP_MB}`.trim();
}

const packagePath = fileURLToPath(import.meta.resolve("vitest/package.json"));
const vitestCli = canonicalizeWindowsDrive(join(dirname(packagePath), "vitest.mjs"));
const root = canonicalizeWindowsDrive(process.cwd());
const args = canonicalizeRootArgs(process.argv.slice(2), root);
const result = spawnSync(process.execPath, [vitestCli, ...args], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: withHeapOption(process.env.NODE_OPTIONS) },
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
