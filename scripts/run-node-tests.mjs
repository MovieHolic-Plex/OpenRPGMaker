#!/usr/bin/env node
// node:test 기반 테스트 러너 — `test/**/*.test.mjs` 를 **탐색해서** 실행한다.
//
// 왜 탐색인가 (실측):
//   vitest 의 include 는 `test/**/*.test.ts` 라서 `.mjs` 테스트를 수집하지 않고,
//   package.json 의 `test:ai-oauth` 는 파일 2개만 이름으로 지정하고 있었다.
//   그 결과 `playerArtifactPipeline*.node.test.mjs` 5개 + `playerReleasePreflight.test.mjs`
//   (합계 85 케이스)가 **어디에서도 실행되지 않는 상태로 방치**되어 있었다.
//   지키는 대상이 웹 플레이어 export 의 fail-closed 경계(롤백/복구/가드)였으므로 위험이 컸다.
//   파일 목록을 다시 하드코딩하면 같은 사고가 반복되므로 디렉터리를 탐색한다.
//
// 사용:
//   node scripts/run-node-tests.mjs              # test/ 아래 모든 .test.mjs
//   node scripts/run-node-tests.mjs --list       # 실행 없이 목록만
//   node scripts/run-node-tests.mjs <패턴>       # 경로에 패턴이 포함된 파일만
import { readdirSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const ROOT = process.cwd();
const TEST_DIR = join(ROOT, "test");
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const filters = args.filter((arg) => !arg.startsWith("-"));

function collect(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, found);
    } else if (entry.endsWith(".test.mjs")) {
      found.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  }
  return found;
}

let files = collect(TEST_DIR).sort();
if (filters.length > 0) {
  files = files.filter((file) => filters.some((filter) => file.includes(filter)));
}

if (files.length === 0) {
  console.error(
    filters.length > 0
      ? `node:test 대상 없음 — 패턴과 일치하는 파일이 없습니다: ${filters.join(", ")}`
      : "node:test 대상 없음 — test/ 아래에 *.test.mjs 가 하나도 없습니다. 탐색 경로를 확인하세요."
  );
  process.exit(1);
}

console.log(`node:test 대상 ${files.length}개`);
for (const file of files) console.log(`   ${file}`);

if (listOnly) process.exit(0);

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
