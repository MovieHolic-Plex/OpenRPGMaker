#!/usr/bin/env node
// scripts/release-scheduled.mjs
// 조건 기반 자동 릴리스 — .github/workflows/auto-release.yml 이 3시간마다 부른다.
// 규칙과 판정은 scripts/lib/releaseGate.mjs, ci-full 대조는 scripts/ci-full-diff.mjs.
//
// 조건이 다 맞으면 기존 릴리스 경로를 그대로 탄다(새 발행기를 만들지 않는다):
//   ① release-auto.mjs --skip-publish  → release/next PR(버전 범프 + 사용자 말 CHANGELOG)
//   ② ci-fast 를 release/next 에 디스패치(GITHUB_TOKEN 푸시는 워크플로를 깨우지 않는다)
//   ③ merge-pr.mjs <PR>                → fast·fast-static·패리티 초록일 때만 그 머리 커밋을 squash
//   ④ release-auto.mjs --skip-propose  → 태그 + 초안 릴리스(본문 = CHANGELOG 그 절)
//   ⑤ desktop-release 디스패치          → 산출물 검증 뒤 발행(30분 cron 도 같은 초안을 집는다)
//   ⑥ 알림: 「자동 릴리스 기록」 이슈에 코멘트 한 줄(리드가 보는 한 곳)
// 조건이 안 맞으면 아무것도 쓰지 않고 이유를 워크플로 요약과 JSON 에 남긴다(조용히 넘어간다).
//
// 사용:
//   node scripts/release-scheduled.mjs --dry-run [--json out.json] [--summary $GITHUB_STEP_SUMMARY]
//   node scripts/release-scheduled.mjs           # 조건이 맞으면 실제로 발행
//   --now <ISO>  판정 시각 고정(재현용)
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { AUTO_RELEASE_RULES, decideAutoRelease, renderGateSummary, selectUserFacingCommits } from "./lib/releaseGate.mjs";
import { computeCiFullDiff, repoSlug } from "./ci-full-diff.mjs";

const ISSUE_TITLE = "자동 릴리스 기록";

function run(command, args, { allowFailure = false, inherit = false } = {}) {
  try {
    const out = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", inherit ? "inherit" : "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    return (out ?? "").trim();
  } catch (error) {
    if (allowFailure) return null;
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${command} ${args.join(" ")} 실패${stderr ? `: ${stderr.split("\n").slice(-3).join(" / ")}` : ""}`);
  }
}
const git = (args, options) => run("git", args, options);
const gh = (args, options) => run("gh", args, options);
const ghJson = (args) => JSON.parse(gh(args) || "null");

function parseArgs(argv) {
  const args = { dryRun: false, json: null, summary: null, now: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = argv[++i];
    else if (arg === "--summary") args.summary = argv[++i];
    else if (arg === "--now") args.now = argv[++i];
    else throw new Error(`모르는 인자입니다: ${arg}`);
  }
  return args;
}

function gatherInputs(repo, now) {
  const releases = ghJson(["api", `repos/${repo}/releases?per_page=30`]) ?? [];
  const versioned = releases.filter((release) => /^v\d+\.\d+\.\d+$/u.test(release.tag_name));
  const published = versioned
    .filter((release) => !release.draft && release.published_at)
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const lastPublished = published[0] ?? null;
  const dayAgo = now.getTime() - 24 * 3_600_000;
  const recentReleaseTags = versioned.filter((release) => new Date(release.created_at).getTime() > dayAgo).map((release) => release.tag_name);
  const draftTags = versioned.filter((release) => release.draft).map((release) => release.tag_name);

  const sinceTag = lastPublished?.tag_name ?? null;
  git(["fetch", "origin", "main", "--tags", "--quiet"], { allowFailure: true });
  const range = sinceTag ? ["origin/main", `^${sinceTag}`] : ["origin/main"];
  const log = git(["log", "--no-merges", "--pretty=format:%H%x09%s", ...range], { allowFailure: true }) ?? "";
  const commits = log.split("\n").filter(Boolean).map((line) => {
    const [sha, ...rest] = line.split("\t");
    return { sha, subject: rest.join("\t") };
  });

  const holdPrs = ghJson(["pr", "list", "--state", "open", "--label", AUTO_RELEASE_RULES.holdLabel, "--json", "number,title,url"]) ?? [];
  const openRelease = (ghJson(["pr", "list", "--state", "open", "--head", "release/next", "--json", "number,url,labels,headRefOid"]) ?? [])[0] ?? null;
  return {
    lastPublished: lastPublished ? { tag: lastPublished.tag_name, publishedAt: lastPublished.published_at } : null,
    sinceTag,
    commits,
    userCommits: selectUserFacingCommits(commits),
    recentReleaseTags,
    draftTags,
    holdPrs,
    openReleasePr: openRelease
      ? { number: openRelease.number, url: openRelease.url, auto: openRelease.labels.some((label) => label.name === AUTO_RELEASE_RULES.autoLabel) }
      : null,
  };
}

function trackingIssue(repo) {
  const found = ghJson(["issue", "list", "--state", "open", "--search", `"${ISSUE_TITLE}" in:title`, "--json", "number,title"]) ?? [];
  const exact = found.find((issue) => issue.title === ISSUE_TITLE);
  if (exact) return exact.number;
  gh(["label", "create", AUTO_RELEASE_RULES.autoLabel, "--color", "0e8a16", "--description", "조건 기반 자동 릴리스", "--force"], { allowFailure: true });
  const url = gh(["issue", "create", "--title", ISSUE_TITLE, "--label", AUTO_RELEASE_RULES.autoLabel, "--body",
    `scripts/release-scheduled.mjs 가 자동 릴리스를 낼 때마다, 또는 도중에 멈출 때마다 여기에 한 줄 남긴다.\n넘어간 회차는 Actions 의 auto-release 실행 요약에만 남는다.\n발행을 막으려면 아무 열린 PR 에 \`${AUTO_RELEASE_RULES.holdLabel}\` 라벨을 붙인다.`]);
  return Number(url.split("/").pop());
}

function notify(repo, text) {
  try {
    const number = trackingIssue(repo);
    const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
    gh(["issue", "comment", String(number), "--body", `${text}${runUrl ? `\n\n실행: ${runUrl}` : ""}`]);
    return number;
  } catch (error) {
    console.error(`[release-scheduled] 알림 실패: ${error.message}`);
    return null;
  }
}

function execute(repo, decision) {
  const steps = [];
  const step = (name, fn) => {
    const result = fn();
    steps.push({ name, result });
    console.log(`[release-scheduled] ${name}: ${result}`);
    return result;
  };
  step("propose", () => run("node", ["scripts/release-auto.mjs", "--skip-publish"]));
  const pr = (ghJson(["pr", "list", "--state", "open", "--head", "release/next", "--json", "number,url,headRefOid"]) ?? [])[0];
  if (!pr) throw new Error("release/next PR 이 열리지 않았다");
  gh(["label", "create", AUTO_RELEASE_RULES.autoLabel, "--color", "0e8a16", "--description", "조건 기반 자동 릴리스", "--force"], { allowFailure: true });
  step("label", () => gh(["pr", "edit", String(pr.number), "--add-label", AUTO_RELEASE_RULES.autoLabel]) || `#${pr.number}`);
  step("ci-fast", () => gh(["workflow", "run", "ci-fast.yml", "--ref", "release/next"]) || "디스패치");
  step("merge", () => run("node", ["scripts/merge-pr.mjs", String(pr.number), "--timeout-min=60"]));
  step("publish", () => run("node", ["scripts/release-auto.mjs", "--skip-propose"]));
  git(["fetch", "origin", "--tags", "--quiet"], { allowFailure: true });
  const version = JSON.parse(git(["show", "origin/main:package.json"])).version;
  const tag = `v${version}`;
  step("desktop-release", () => gh(["workflow", "run", "desktop-release.yml", "-f", `tag=${tag}`], { allowFailure: true }) ?? "디스패치 실패 — 30분 cron 이 집는다");
  return { tag, pr: pr.number, prUrl: pr.url, steps };
}

const args = parseArgs(process.argv.slice(2));
const now = args.now ? new Date(args.now) : new Date();
const repo = repoSlug();
const inputs = gatherInputs(repo, now);
const ciDiff = computeCiFullDiff({ repo, tag: inputs.sinceTag });
const decision = decideAutoRelease({
  userCommits: inputs.userCommits,
  sinceTag: inputs.sinceTag,
  ciDiff,
  lastPublishedAt: inputs.lastPublished?.publishedAt ?? null,
  recentReleaseTags: inputs.recentReleaseTags,
  holdPrs: inputs.holdPrs,
  draftTags: inputs.draftTags,
  openReleasePr: inputs.openReleasePr,
  now,
});
const record = { at: now.toISOString(), dryRun: args.dryRun, repo, decision, inputs: { ...inputs, commits: inputs.commits.length }, ciDiff };
const summary = renderGateSummary({ decision, at: record.at, dryRun: args.dryRun, ciDiff });
console.log(summary);
if (args.summary) appendFileSync(args.summary, summary);

let exitCode = 0;
if (decision.release && !args.dryRun) {
  try {
    record.result = execute(repo, decision);
    record.notifiedIssue = notify(repo, `${record.result.tag} 자동 릴리스: PR #${record.result.pr} 머지, 태그·초안 생성, desktop-release 가 산출물 검증 뒤 발행한다. 사용자 체감 변경 ${inputs.userCommits.length}개, ci-full 새 실패 0 (판 ${ciDiff.candidate?.id} 대 ${ciDiff.baseline?.id}).`);
  } catch (error) {
    record.error = error.message;
    record.notifiedIssue = notify(repo, `자동 릴리스가 도중에 멈춤: ${error.message}\n열린 release/next PR 이 있으면 다음 회차는 넘어간다. 사람이 확인해 머지하거나 닫는다.`);
    exitCode = 1;
  }
}
if (args.json) writeFileSync(args.json, `${JSON.stringify(record, null, 2)}\n`);
process.exit(exitCode);
