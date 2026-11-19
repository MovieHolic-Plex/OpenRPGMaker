#!/usr/bin/env node
// 포크 PR 과 pull_request_target 이 호스티드 러너로 가는지 검사하는 게이트.
//
// 모든 워크플로의 `runs-on` 에서 호스티드 라벨과 포크를 거르는 mdc2 선택식만 허용한다.
//
// 사용: node scripts/check-self-hosted-workflows.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { load } from "js-yaml";

const DIR = ".github/workflows";
const HOSTED = /^(?:ubuntu|macos|windows)-[a-z0-9][a-z0-9._-]*$/i;
const REPOSITORY = String.raw`github\.repository`;
const HEAD_REPOSITORY = String.raw`github\.event\.pull_request\.head\.repo\.full_name`;

// 부분 문자열만 찾으면 `||` 로 조건을 우회하는 식도 통과한다. 식 전체에서 두 조건이
// mdc2 라벨 배열을 AND 로 제어하고 마지막 OR 가 호스티드 라벨인지 확인한다.
const MDC2_EXPRESSION = new RegExp([
  String.raw`^\$\{\{`,
  String.raw`github\.event_name\s*!=\s*'pull_request_target'`,
  "&&",
  String.raw`\(\s*github\.event_name\s*!=\s*'pull_request'\s*\|\|\s*`,
  `(?:${HEAD_REPOSITORY}\\s*==\\s*${REPOSITORY}|${REPOSITORY}\\s*==\\s*${HEAD_REPOSITORY})`,
  String.raw`\)`,
  "&&",
  String.raw`fromJSON\s*\(\s*'(?<labels>[^']*)'\s*\)`,
  String.raw`\|\|`,
  "'(?<fallback>[^']*)'",
  String.raw`\}\}$`,
].join(String.raw`\s*`));

export function runsOnValues(source) {
  const workflow = load(source);
  return Object.entries(workflow?.jobs ?? {})
    .filter(([, job]) => job != null && Object.hasOwn(job, "runs-on"))
    .map(([job, definition]) => ({ job, value: definition["runs-on"] }));
}

function isHosted(label) {
  return typeof label === "string" && HOSTED.test(label);
}

export function isAllowedRunsOn(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(isHosted);
  if (isHosted(value)) return true;
  if (typeof value !== "string") return false;

  const match = MDC2_EXPRESSION.exec(value.trim());
  if (!match || !isHosted(match.groups.fallback)) return false;

  let labels;
  try {
    labels = JSON.parse(match.groups.labels);
  } catch {
    return false;
  }
  if (!Array.isArray(labels) || !labels.every((label) => typeof label === "string" && label.length > 0)) return false;
  const normalized = labels.map((label) => label.toLowerCase());
  return normalized.includes("self-hosted") && normalized.includes("mdc2");
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
    const path = join(DIR, name);
    try {
      for (const { job, value } of runsOnValues(readFileSync(path, "utf8"))) {
        checked += 1;
        if (!isAllowedRunsOn(value)) violations.push(`${path}  jobs.${job}.runs-on`);
      }
    } catch (error) {
      violations.push(`${path}  ${error.message}`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n러너 선택 계약 위반 ${violations.length}건:\n`);
    for (const violation of violations) console.error(`  ${violation}`);
    console.error("\n호스티드 라벨 또는 ci-fast.yml 과 같이 포크 PR 과 pull_request_target 을 호스티드로 보내는 mdc2 선택식을 써야 한다.");
    return 1;
  }

  console.log(`러너 선택 계약 통과: 워크플로 ${files.length}개 / runs-on ${checked}곳`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
