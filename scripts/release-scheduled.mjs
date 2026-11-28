#!/usr/bin/env node
// scripts/release-scheduled.mjs
// 조건 기반 자동 릴리스 — .github/workflows/auto-release.yml 이 1시간마다 부른다.
// 규칙과 판정은 scripts/lib/releaseGate.mjs, ci-full 대조(requireCiFull 시)는 scripts/ci-full-diff.mjs.
//
// 조건이 다 맞으면 기존 릴리스 경로를 그대로 탄다(새 발행기를 만들지 않는다):
//   ① release-auto.mjs --skip-publish  → release/next PR(버전 범프 + 사용자 말 CHANGELOG)
//   ② ci-fast·ci-related-tests(직전 발행 태그 대비)·(필요 시) app-update-e2e 를 release/next 에 디스패치
//      (GITHUB_TOKEN 푸시는 워크플로를 깨우지 않는다)
//      → ci-full 게이트 분리 모드에서는 ci-related-tests 초록을 기다리고,
//        업데이트/Electron 변경 시 app-update-e2e 초록도 기다린다.
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
import {
  AUTO_RELEASE_RULES,
  decideAutoRelease,
  evaluateAppUpdateE2eNeed,
  isManifestDiffOnlyRootVersion,
  renderGateSummary,
  selectUserFacingCommits,
} from "./lib/releaseGate.mjs";
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
  // 릴리스의 created_at 은 커밋 시각이다. 하루 상한은 발행 시각(published_at)으로 센다. 초안은 no-draft 검사가 따로 막는다.
  const recentReleaseTags = published.filter((release) => new Date(release.published_at).getTime() > dayAgo).map((release) => release.tag_name);
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

function assertNoHold(stage) {
  const holds = ghJson(["pr", "list", "--state", "open", "--label", AUTO_RELEASE_RULES.holdLabel, "--json", "number"]) ?? [];
  if (holds.length > 0) {
    throw new Error(`${stage} 직전에 ${AUTO_RELEASE_RULES.holdLabel} 라벨이 붙어 멈춘다 (${holds.map((pr) => `#${pr.number}`).join(", ")})`);
  }
}

/** release/next 에 디스패치한 워크플로의 그 머리 커밋 판을 찾아 끝날 때까지 본다. 초록이 아니면 던진다(머지하지 않는다). */
function waitDispatchedRun(workflow, headSha, timeoutMin) {
  const deadline = Date.now() + timeoutMin * 60_000;
  let id = null;
  while (!id && Date.now() < deadline) {
    const runs = ghJson(["run", "list", "--workflow", workflow, "--branch", "release/next", "--event", "workflow_dispatch", "--limit", "10", "--json", "databaseId,headSha"]) ?? [];
    id = runs.find((entry) => entry.headSha === headSha)?.databaseId ?? null;
    if (!id) run("sleep", ["5"]);
  }
  if (!id) throw new Error(`${workflow} 판이 ${headSha.slice(0, 10)} 에 생기지 않았다`);
  // gh run watch 는 실패하면 0 이 아닌 코드로 끝난다 → run() 이 던진다.
  run("timeout", [`${Math.max(1, Math.round((deadline - Date.now()) / 1000))}`, "gh", "run", "watch", String(id), "--exit-status", "--interval", "10"]);
  return `run ${id} 초록`;
}

function checkAppUpdateE2eNeed(repo, sinceTag, now) {
  let changedFiles = null;
  let packageManifestDiffOnlyVersion = true;
  let lockfileDiffOnlyVersion = true;
  if (sinceTag) {
    const rawDiff = git(["diff", "--name-only", `${sinceTag}..origin/main`], { allowFailure: true });
    if (rawDiff !== null) {
      changedFiles = rawDiff.split("\n").map((line) => line.trim()).filter(Boolean);
      if (changedFiles.includes("package.json")) {
        const beforePkg = git(["show", `${sinceTag}:package.json`], { allowFailure: true });
        const afterPkg = git(["show", "origin/main:package.json"], { allowFailure: true });
        packageManifestDiffOnlyVersion = isManifestDiffOnlyRootVersion(beforePkg, afterPkg);
      }
      if (changedFiles.includes("package-lock.json")) {
        const beforeLock = git(["show", `${sinceTag}:package-lock.json`], { allowFailure: true });
        const afterLock = git(["show", "origin/main:package-lock.json"], { allowFailure: true });
        lockfileDiffOnlyVersion = isManifestDiffOnlyRootVersion(beforeLock, afterLock);
      }
    }
  }
  let lastPassingRun = null;
  try {
    const runs = ghJson([
      "api",
      `repos/${repo}/actions/workflows/app-update-e2e.yml/runs?status=completed&per_page=20`,
      "--jq",
      '[.workflow_runs[] | select(.conclusion == "success") | {id, headSha: .head_sha, createdAt: .created_at, completedAt: .updated_at}] | first // null',
    ]);
    if (runs && runs.id) lastPassingRun = runs;
  } catch {
    lastPassingRun = null;
  }
  return evaluateAppUpdateE2eNeed({
    sinceTag,
    changedFiles,
    packageManifestDiffOnlyVersion,
    lockfileDiffOnlyVersion,
    lastPassingRun,
    now,
  });
}

function execute(repo, decision, inputs, now) {
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
  // 봇(GITHUB_TOKEN)이 연 PR 의 pull_request 런은 잡 0개로 멈췄다가 머지 때 실패로 닫힌다 — 시험이 하나도 돌지 않는다.
  // 실측: v0.420 PR #5159 의 ci-fast·ci-related-tests·app-update-e2e 셋 다(run 45730826290 «workflow file issue»).
  // 그래서 PR 에 걸린 나머지 두 검사도 같은 머리에 직접 디스패치한다.
  // 직전 발행 태그(sinceTag) 기준으로 diff 를 잡아야 릴리스에 들어가는 모든 변경의 관련 시험이 돈다.
  const relatedBase =
    (inputs.sinceTag && git(["rev-parse", `${inputs.sinceTag}^{commit}`], { allowFailure: true })) ||
    git(["rev-parse", "origin/main"]);
  step("ci-related-tests", () => gh(["workflow", "run", "ci-related-tests.yml", "--ref", "release/next", "-f", `base=${relatedBase}`]) || "디스패치");
  const e2eNeed = checkAppUpdateE2eNeed(repo, inputs.sinceTag, now);
  if (e2eNeed.required) {
    step("app-update-e2e", () => gh(["workflow", "run", "app-update-e2e.yml", "--ref", "release/next"]) || `디스패치 (${e2eNeed.reason})`);
  } else {
    step("app-update-e2e", () => `건너뜀 (${e2eNeed.reason})`);
  }
  if (!AUTO_RELEASE_RULES.requireCiFull) {
    step("ci-related-tests-wait", () => waitDispatchedRun("ci-related-tests.yml", pr.headRefOid, 45));
  }
  if (e2eNeed.required) {
    step("app-update-e2e-wait", () => waitDispatchedRun("app-update-e2e.yml", pr.headRefOid, 50));
  }
  // merge-pr 가 CI 를 기다리는 동안 누가 hold-release 를 붙일 수 있다. merge-pr 가 머지 직전에, 여기서 태그 직전에 다시 본다.
  assertNoHold("merge");
  step("merge", () => run("node", ["scripts/merge-pr.mjs", String(pr.number), "--timeout-min=60", `--refuse-if-label=${AUTO_RELEASE_RULES.holdLabel}`]));
  assertNoHold("publish");
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
const ciDiff = AUTO_RELEASE_RULES.requireCiFull ? computeCiFullDiff({ repo, tag: inputs.sinceTag }) : null;
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
    record.result = execute(repo, decision, inputs, now);
    const gateNote = ciDiff
      ? `ci-full 새 실패 0 (판 ${ciDiff.candidate?.id} 대 ${ciDiff.baseline?.id})`
      : "ci-fast·ci-related-tests 통과 (ci-full 게이트 분리)";
    record.notifiedIssue = notify(repo, `${record.result.tag} 자동 릴리스: PR #${record.result.pr} 머지, 태그·초안 생성, desktop-release 가 산출물 검증 뒤 발행한다. 사용자 체감 변경 ${inputs.userCommits.length}개, ${gateNote}.`);
  } catch (error) {
    record.error = error.message;
    record.notifiedIssue = notify(repo, `자동 릴리스가 도중에 멈춤: ${error.message}\n열린 release/next PR 이 있으면 다음 회차는 넘어간다. 사람이 확인해 머지하거나 닫는다.`);
    exitCode = 1;
  }
}
if (args.json) writeFileSync(args.json, `${JSON.stringify(record, null, 2)}\n`);
process.exit(exitCode);
