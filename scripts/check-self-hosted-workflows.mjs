#!/usr/bin/env node
// 워크플로가 **GitHub 호스티드 러너**를 쓰지 않는지 검사하는 게이트.
//
// 왜 필요한가:
//   GitHub Actions 는 호스티드 러너(`ubuntu-*`, `macos-*`, `windows-*`)에만 분(minute) 과금을 한다.
//   self-hosted 러너는 무료·무제한이다. 이 저장소는 32코어 박스를 러너로 붙여서 쓰므로
//   과금 경로가 하나도 없다(실측 2026-09-17: ci-full 47분·77분 실행의 billable 이 전부 `{}`,
//   같은 API 가 과거 ubuntu/macos 실행에는 `{"UBUNTU":{jobs:7,…}}` 를 돌려준다).
//
//   문제는 그게 **관습으로만** 유지된다는 것이다. 새 워크플로를 추가하면서 남들이 쓰는 대로
//   `runs-on: ubuntu-latest` 라고 적으면 아무도 안 막는다. 이 게이트가 그 자리를 막는다.
//
// 하는 일: 모든 워크플로의 `runs-on` 을 훑어 호스티드 라벨이 있으면 exit 1.
//          정말 호스티드가 필요한 건(맥은 이 박스로 self-host 가 불가능하다) 아래 ALLOW 에
//          **이유와 함께** 적는다 — 비용 결정이 코드로 보이게 하는 게 목적이다.
//
// 사용: node scripts/check-self-hosted-workflows.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = ".github/workflows";

/** 호스티드가 불가피한 워크플로. 키는 파일명, 값은 **왜** 인지. */
const ALLOW = new Map([
  [
    "security-audit.yml",
    "공개 pull_request 의 비신뢰 코드를 self-hosted 러너에서 실행하면 안 된다. 이 감사는 " +
      "호스티드 러너에서 파일명만 보고하고 npm ci --ignore-scripts 로 의존성만 검사한다.",
  ],
  [
    "mac-onboarding.yml",
    "macOS 러너는 이 박스로 self-host 할 수 없다(리눅스 박스). 분당 10배 과금이라 " +
      "저장소 수준에서 disabled_manually 로 꺼 둔 상태다 — 켤 거면 비용을 먼저 판단하라.",
  ],
]);

const HOSTED = /^(ubuntu|macos|windows)-/i;

/**
 * 한 파일에서 `runs-on` 값들을 뽑는다. YAML 파서 의존성 없이 세 가지 표기를 다 본다:
 *   runs-on: ubuntu-latest
 *   runs-on: [self-hosted, oprn-box]
 *   runs-on:
 *     - self-hosted
 *     - oprn-box
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
    if (labels.some((label) => label.toLowerCase() === "self-hosted")) continue;
    const hosted = labels.filter((label) => HOSTED.test(label));
    if (hosted.length === 0) continue; // 변수 치환 등 — 판단 불가는 통과시킨다
    if (ALLOW.has(name)) continue;
    violations.push({ name, line, hosted });
  }
}

if (violations.length > 0) {
  console.error(`\nGitHub 호스티드 러너를 쓰는 워크플로가 ${violations.length}건 있다:\n`);
  for (const { name, line, hosted } of violations) {
    console.error(`  ${DIR}/${name}:${line}  runs-on: ${hosted.join(", ")}`);
  }
  console.error(
    "\n이 저장소는 self-hosted 러너(이 박스, 라벨 `oprn-box` / `oprn-full`)로만 돈다.\n" +
    "호스티드 러너는 분 단위로 과금되고, 무료 한도를 넘기면 CI 가 조용히 멈춘다.\n\n" +
    "고치는 법:\n" +
    "  runs-on: [self-hosted, oprn-box]   푸시·PR 레인 (4코어/8GB)\n" +
    "  runs-on: [self-hosted, oprn-full]  야간 전체 게이트 (6코어/20GB)\n\n" +
    "정말 호스티드가 필요하면(예: macOS) 이 스크립트의 ALLOW 에 **이유와 함께** 등록하라.\n",
  );
  process.exit(1);
}

const allowed = files.filter((name) => ALLOW.has(name));
console.log(
  `self-hosted 계약 통과: 워크플로 ${files.length}개 / runs-on ${checked}곳` +
  (allowed.length > 0 ? ` (호스티드 허용: ${allowed.join(", ")})` : ""),
);
