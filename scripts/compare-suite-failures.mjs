#!/usr/bin/env node
/**
 * 두 vitest 전체 로그의 실패 파일 목록을 비교해 "새 실패"만 뽑는다.
 *
 * 왜 필요한가: 이 저장소의 기준선은 이미 빨간불이다(기준 트리에서 87 파일 실패).
 * AGENTS.md 규약대로 기준선 대비 **새 실패**만 회귀로 본다. 눈으로 987개 파일을 비교하면 놓친다.
 *
 * 사용: node scripts/compare-suite-failures.mjs <base.log> <head.log>
 */
import { readFileSync } from "node:fs";

const [baseLog, headLog] = process.argv.slice(2);
if (!baseLog || !headLog) {
  console.error("사용: node scripts/compare-suite-failures.mjs <base.log> <head.log>");
  process.exit(2);
}

function failingFiles(path) {
  const text = readFileSync(path, "utf8");
  const files = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:FAIL|❯|×)?\s*(?:FAIL\s+)?((?:test|src)\/[\w./-]+\.(?:test|spec)\.[cm]?[jt]sx?)/);
    if (m) {
      if (/FAIL/.test(line) || /×/.test(line)) files.add(m[1]);
    }
  }
  return files;
}

const base = failingFiles(baseLog);
const head = failingFiles(headLog);
const added = [...head].filter((f) => !base.has(f)).sort();
const fixed = [...base].filter((f) => !head.has(f)).sort();

console.log(`base 실패 파일 ${base.size}개 / head 실패 파일 ${head.size}개`);
console.log(`\n새 실패 (회귀 후보) ${added.length}개:`);
for (const f of added) console.log(`  + ${f}`);
console.log(`\n기준선에서 사라진 실패 ${fixed.length}개:`);
for (const f of fixed) console.log(`  - ${f}`);
process.exit(added.length ? 1 : 0);
