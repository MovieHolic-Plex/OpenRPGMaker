#!/usr/bin/env node
// 워크플로가 **소유자 컴퓨터(self-hosted)** 에서 돌지 않는지 검사하는 게이트.
//
// 이 저장소는 공개다. self-hosted 러너는 소유자의 컴퓨터라, 포크 PR 의 코드가
// 그 머신에서 실행되면 안 된다. CI 는 GitHub 호스티드 러너에서만 돈다 (2026-10-12).
//
// 하는 일: 모든 워크플로의 `runs-on` 을 훑어 self-hosted 이거나 호스티드 라벨이
//          아니면 exit 1.
//
// 사용: node scripts/check-self-hosted-workflows.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = ".github/workflows";

const HOSTED = /^(ubuntu|macos|windows)-/i;

/**
 * 한 파일에서 `runs-on` 값들을 뽑는다. YAML 파서 의존성 없이 세 가지 표기를 다 본다:
 *   runs-on: ubuntu-latest
 *   runs-on: [ubuntu-latest]
 *   runs-on:
 *     - ubuntu-latest
 * 주석(`#` 뒤)은 버린다 — 이 저장소의 워크플로는 주석이 길어서 `runs-on:` 을 설명하는
 * 문장이 흔하다.
 */
function runsOnValues(source) {
  const lines = source.split("\n");
  const found = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/#.*$/, "");
    const match = /^(\s*)runs-on:\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, indent, rest] = match;
    const trimmed = rest.trim();
    if (trimmed.startsWith("[")) {
      found.push({ line: index + 1, labels: trimmed.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean) });
      continue;
    }
    if (trimmed) {
      found.push({ line: index + 1, labels: [trimmed.replace(/^["']|["']$/g, "")] });
      continue;
    }
    // 블록 시퀀스: 다음 줄들이 더 깊은 들여쓰기의 `- 라벨`
    const labels = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const item = /^(\s*)-\s*(.+)$/.exec(lines[next].replace(/#.*$/, ""));
      if (!item || item[1].length <= indent.length) break;
      labels.push(item[2].trim().replace(/^["']|["']$/g, ""));
    }
    if (labels.length > 0) found.push({ line: index + 1, labels });
  }
  return found;
}

let files;
try {
  files = readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name)).sort();
} catch {
  console.error(`워크플로 디렉터리를 읽지 못했다: ${DIR}`);
  process.exit(2);
}

const violations = [];
let checked = 0;
for (const name of files) {
  const entries = runsOnValues(readFileSync(join(DIR, name), "utf8"));
  for (const { line, labels } of entries) {
    checked += 1;
    if (labels.some((label) => label.toLowerCase() === "self-hosted")) {
      violations.push({ name, line, hosted: labels });
      continue;
    }
    const hosted = labels.filter((label) => HOSTED.test(label));
    if (hosted.length === 0) violations.push({ name, line, hosted: labels });
  }
}

if (violations.length > 0) {
  console.error(`\n소유자 컴퓨터에서 도는 워크플로가 ${violations.length}건 있다:\n`);
  for (const { name, line, hosted } of violations) {
    console.error(`  ${DIR}/${name}:${line}  runs-on: ${hosted.join(", ")}`);
  }
  console.error(
    "\n이 저장소는 공개다. CI 는 GitHub 호스티드 러너에서만 돈다.\n" +
    "self-hosted 는 소유자 컴퓨터라 포크의 코드가 그 머신에서 실행된다.\n\n" +
    "고치는 법:\n" +
    "  runs-on: ubuntu-latest\n" +
    "  runs-on: macos-latest    macOS 가 필요할 때만\n",
  );
  process.exit(1);
}

console.log(`호스티드 러너 계약 통과: 워크플로 ${files.length}개 / runs-on ${checked}곳`);
