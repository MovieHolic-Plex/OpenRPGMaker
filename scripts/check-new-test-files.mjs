#!/usr/bin/env node
// 새 시험 파일 경고 — PR 이 test/ 아래에 새 *.test.* 파일을 더하면, 같은 모듈을 이미 시험하는 파일이 있는지 찾아 GitHub 경고로 알린다.
// 왜 (2026-11-25): 시험 파일 3,299개 중 거의 전부가 버그 하나마다 새로 생긴 파일이었고, 파일마다 import 비용(10~15초)을 따로 냈다.
// AGENTS.md 「새 회귀 시험은 기존 모듈의 시험 파일에 넣는다」를 글로만 두니 계속 새 파일이 생겼다. 실패가 아니라 경고다 — 정말 새 모듈이면 새 파일이 맞다.
//
// 쓰는 법: node scripts/check-new-test-files.mjs [--base <ref>]   (기본 HEAD~1, ci-fast 의 fetch-depth 2 체크아웃 기준)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyzeFile, primaryModule } from "./test-merge/lib.mjs";

const TEST_RE = /^test\/.+\.test\.[cm]?[jt]sx?$/;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });

export function addedTestFiles(base) {
  return git("diff", "--name-only", "--diff-filter=A", `${base}...HEAD`)
    .split("\n")
    .filter((p) => TEST_RE.test(p));
}

export function moduleOf(path, text) {
  try {
    return primaryModule(analyzeFile(path, text).imports);
  } catch {
    return null;
  }
}

/** 새 파일마다 같은 주 모듈을 import 하는 기존 시험 파일 목록을 돌려준다. */
export function findHomes(added, existing, read) {
  const addedSet = new Set(added);
  const byModule = new Map();
  for (const p of existing) {
    if (addedSet.has(p)) continue;
    const text = read(p);
    for (const m of text.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
      const list = byModule.get(m[1]) ?? [];
      list.push(p);
      byModule.set(m[1], list);
    }
  }
  return added.map((path) => {
    const mod = moduleOf(path, read(path));
    return { path, mod, homes: mod ? [...new Set(byModule.get(mod) ?? [])].sort() : [] };
  });
}

function main() {
  const i = process.argv.indexOf("--base");
  const base = i > 0 ? process.argv[i + 1] : "HEAD~1";
  let added;
  try {
    added = addedTestFiles(base);
  } catch (e) {
    console.log(`새 시험 파일 검사: 기준 ${base} 와 비교하지 못했다 — 건너뛴다 (${String(e.message).split("\n")[0]})`);
    return;
  }
  if (added.length === 0) {
    console.log("새 시험 파일 없음");
    return;
  }
  const existing = git("ls-files", "test").split("\n").filter((p) => TEST_RE.test(p));
  const results = findHomes(added, existing, (p) => readFileSync(p, "utf8"));
  for (const r of results) {
    const where = r.homes.length
      ? `같은 모듈(${r.mod})을 이미 시험하는 파일: ${r.homes.slice(0, 3).join(", ")}${r.homes.length > 3 ? ` 외 ${r.homes.length - 3}개` : ""} — 회귀 시험은 그 파일에 it 로 더한다.`
      : `같은 모듈을 시험하는 기존 파일을 찾지 못했다${r.mod ? `(주 모듈 ${r.mod})` : ""} — 정말 새 모듈이면 이름을 모듈 이름으로(<모듈>.test.ts).`;
    console.log(`::warning file=${r.path},title=새 시험 파일::${where} (AGENTS.md 「새 회귀 시험은 기존 모듈의 시험 파일에 넣는다」)`);
  }
  console.log(`새 시험 파일 ${results.length}개, 그중 기존 집이 있는 것 ${results.filter((r) => r.homes.length).length}개`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
