#!/usr/bin/env node
// 모든 잡이 self-hosted 러너(mdc2·win11)에서 돌고, 포크 코드는 그 러너에 닿지 못하는지 검사하는 게이트.
//
// 규칙 (2026-11-23, 오너 「github runner 를 아예 안 쓰고싶다」):
//   1. runs-on 은 라벨 목록 하나다. 호스티드 라벨(ubuntu-*·windows-*·macos-*)과 `${{ }}` 식은 쓰지 않는다.
//      목록에는 self-hosted 가 있고, mdc2+linux 또는 win11+windows 가 있어야 한다.
//      (윈도 스모크 워크플로 둘은 오너 결정으로 지웠다. win11 라벨은 나중에 윈도 러너를 등록할 때를 위한 자리다.)
//   2. 잡마다 `if:` 가 포크 가드로 시작한다. 포크 PR 과 pull_request_target 은 잡을 건너뛴다.
//      다른 조건은 `가드 && ( … )` 처럼 괄호로 묶어 뒤에 붙인다(`||` 로 가드를 우회하지 못하게).
//   3. 워크플로 트리거에 pull_request_target·workflow_run 을 쓰지 않는다(포크가 비밀과 함께 들어오는 길).
//   4. 아직 옮기지 못한 잡은 아래 PENDING 에 이유와 함께 적는다. 게이트는 그 목록을 매번 찍는다.
//
// 사용: node scripts/check-self-hosted-workflows.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { load } from "js-yaml";

const DIR = ".github/workflows";
const HOSTED = /^(?:ubuntu|macos|windows)-[a-z0-9][a-z0-9._-]*$/i;

export const FORK_GUARD =
  "github.event_name != 'pull_request_target' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)";

// 파일 → 잡 → 이유. 줄이기만 한다. 비면 호스티드 잡 0 이다.
export const PENDING = {
  "mac-onboarding.yml": {
    "launcher-and-private-setup": "macOS 러너 없음. 워크플로는 disabled_manually 라 돌지 않는다. 리눅스 이동/제거는 오너 결정 대기",
  },
  "desktop-release.yml": {
    packages: "릴리스 워크플로라 v0.418.0 발행 뒤 별도 PR 로 옮긴다(이미 mdc2-heavy, 폴백 식만 남음)",
  },
};

const FORBIDDEN_TRIGGERS = ["pull_request_target", "workflow_run"];

export function jobsOf(source) {
  const workflow = load(source);
  return Object.entries(workflow?.jobs ?? {})
    .filter(([, job]) => job != null && Object.hasOwn(job, "runs-on"))
    .map(([job, definition]) => ({ job, value: definition["runs-on"], condition: definition.if }));
}

// 옛 이름. 테스트와 다른 스크립트가 runs-on 만 볼 때 쓴다.
export function runsOnValues(source) {
  return jobsOf(source).map(({ job, value }) => ({ job, value }));
}

export function triggersOf(source) {
  const workflow = load(source);
  // js-yaml 은 `on:` 키를 문자열 "on" 으로 읽는다.
  const on = workflow?.on ?? workflow?.true;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  return Object.keys(on ?? {});
}

export function isAllowedRunsOn(value) {
  const labels = typeof value === "string" ? [value] : value;
  if (!Array.isArray(labels) || labels.length === 0) return false;
  if (!labels.every((label) => typeof label === "string" && label.length > 0)) return false;
  if (labels.some((label) => HOSTED.test(label) || label.includes("${{"))) return false;
  const set = new Set(labels.map((label) => label.toLowerCase()));
  if (!set.has("self-hosted")) return false;
  return (set.has("mdc2") && set.has("linux")) || (set.has("win11") && set.has("windows"));
}

function normalize(text) {
  let s = String(text).replace(/\s+/g, " ").trim();
  const wrapped = /^\$\{\{(.*)\}\}$/.exec(s);
  if (wrapped) s = wrapped[1].trim();
  return s;
}

// `가드` 또는 `가드 && ( … )` 이고 그 괄호가 식 끝에서 닫히는지 본다.
export function hasForkGuard(condition) {
  if (typeof condition !== "string") return false;
  const s = normalize(condition);
  if (s === FORK_GUARD) return true;
  const prefix = `${FORK_GUARD} && (`;
  if (!s.startsWith(prefix)) return false;
  let depth = 1;
  let quote = false;
  for (let i = prefix.length; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "'") quote = !quote;
    if (quote) continue;
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i === s.length - 1;
    }
  }
  return false;
}

export function checkWorkflow(name, source) {
  const violations = [];
  const pending = PENDING[name] ?? {};
  for (const trigger of triggersOf(source)) {
    if (FORBIDDEN_TRIGGERS.includes(trigger)) violations.push(`on.${trigger} 금지 트리거`);
  }
  const jobs = jobsOf(source);
  for (const { job, value, condition } of jobs) {
    if (Object.hasOwn(pending, job)) continue;
    if (!isAllowedRunsOn(value)) violations.push(`jobs.${job}.runs-on 은 self-hosted 라벨 목록이어야 한다`);
    if (!hasForkGuard(condition)) violations.push(`jobs.${job}.if 가 포크 가드로 시작하지 않는다`);
  }
  for (const job of Object.keys(pending)) {
    if (!jobs.some((entry) => entry.job === job)) violations.push(`PENDING 의 jobs.${job} 이 없다(목록에서 지운다)`);
  }
  return { violations, checked: jobs.length };
}

function main() {
  let files;
  try {
    files = readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name)).sort();
  } catch {
    console.error(`워크플로 디렉터리를 읽지 못했다: ${DIR}`);
    return 2;
  }

  const violations = [];
  let checked = 0;
  for (const name of files) {
    try {
      const result = checkWorkflow(name, readFileSync(join(DIR, name), "utf8"));
      checked += result.checked;
      for (const violation of result.violations) violations.push(`${join(DIR, name)}  ${violation}`);
    } catch (error) {
      violations.push(`${join(DIR, name)}  ${error.message}`);
    }
  }
  for (const name of Object.keys(PENDING)) {
    if (!files.includes(name)) violations.push(`${join(DIR, name)}  PENDING 에 있지만 파일이 없다`);
  }

  if (violations.length > 0) {
    console.error(`\n러너 선택 계약 위반 ${violations.length}건:\n`);
    for (const violation of violations) console.error(`  ${violation}`);
    console.error(`\nruns-on 은 [self-hosted, linux, x64, mdc2, …] 같은 라벨 목록, if 는 "${FORK_GUARD}" 로 시작해야 한다.`);
    return 1;
  }

  const pendingList = Object.entries(PENDING).flatMap(([file, jobs]) => Object.entries(jobs).map(([job, why]) => `${file} ${job}: ${why}`));
  console.log(`러너 선택 계약 통과: 워크플로 ${files.length}개 / 잡 ${checked}개 / 남은 예외 ${pendingList.length}개`);
  for (const line of pendingList) console.log(`  예외 ${line}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
