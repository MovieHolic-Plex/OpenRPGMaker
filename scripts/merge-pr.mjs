#!/usr/bin/env node
// PR 머지 도우미 — ci-fast 가 그 PR 의 **현재 머리 커밋**에서 초록일 때만 `gh pr merge` 한다.
//
// 왜 (2026-10-25): 에이전트가 `gh pr merge` 를 바로 불러서, 체크가 끝나기 전(또는 체크가 아예 없을 때)에
// 빨간 코드가 main 에 들어왔다. 실측: run 40185571034 — #3464 의 TS18048 이 머지 뒤 main 의 ci-fast 에서야 잡혔고,
// 그 뒤 머지된 PR 들도 같은 빨간 main 위에 쌓였다. 저장소에 브랜치 보호가 없어서 GitHub 가 대신 막아 주지 않는다.
//
// 쓰는 법:
//   node scripts/merge-pr.mjs <PR 번호> [--squash|--merge|--rebase] [--delete-branch] [--timeout-min=40]
//   기본은 --squash. 나머지 인자는 고르지 않는다 — 이 도우미가 할 일은 「기다렸다가 머지」 하나다.
//
// 판정:
//   - PR 머리 sha 의 체크 런 중 이름이 `fast`(ci-fast 워크플로의 잡)인 것을 찾는다.
//   - 없으면 기다린다(푸시 직후엔 아직 안 생겼을 수 있다). 시간 안에 안 생기면 실패한다 — 체크 없음은 통과가 아니다.
//   - success 면 머지. 그 사이 머리가 바뀌었으면(새 푸시) 처음부터 다시 기다린다.
//   - failure·cancelled·timed_out 등이면 머지하지 않고 exit 1. 로그 보는 명령을 찍어 준다.
//   - 머지 직전에 `gh pr merge --match-head-commit <sha>` 를 써서, 검사한 커밋과 다른 커밋이 머지되지 않게 한다.
//
// 이 스크립트는 테스트를 돌리지 않는다. GitHub API 만 읽는다.
import { execFileSync } from "node:child_process";

const REQUIRED_CHECK = "fast";
const POLL_MS = 20_000;

function usage(message) {
  if (message) process.stderr.write(`merge-pr: ${message}\n`);
  process.stderr.write("쓰는 법: node scripts/merge-pr.mjs <PR 번호> [--squash|--merge|--rebase] [--delete-branch] [--timeout-min=40]\n");
  process.exit(2);
}

function parseArgs(argv) {
  const options = { pr: undefined, method: "--squash", deleteBranch: false, timeoutMin: 40 };
  for (const arg of argv) {
    if (/^\d+$/.test(arg)) options.pr = arg;
    else if (arg === "--squash" || arg === "--merge" || arg === "--rebase") options.method = arg;
    else if (arg === "--delete-branch" || arg === "-d") options.deleteBranch = true;
    else if (arg.startsWith("--timeout-min=")) {
      const value = Number(arg.slice("--timeout-min=".length));
      if (!Number.isFinite(value) || value <= 0) usage(`잘못된 --timeout-min: ${arg}`);
      options.timeoutMin = value;
    } else if (arg === "-h" || arg === "--help") usage();
    else usage(`모르는 인자: ${arg}`);
  }
  if (!options.pr) usage("PR 번호가 없다");
  return options;
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function repoSlug() {
  return gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
}

function prState(pr) {
  const raw = gh(["pr", "view", pr, "--json", "state,headRefOid,isDraft,mergeable,url"]);
  return JSON.parse(raw);
}

function fastCheckRuns(repo, sha) {
  const raw = gh(["api", `repos/${repo}/commits/${sha}/check-runs?per_page=100`, "-q", `[.check_runs[] | select(.name == "${REQUIRED_CHECK}")]`]);
  return JSON.parse(raw || "[]");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repo = repoSlug();
  const deadline = Date.now() + options.timeoutMin * 60_000;
  let lastNote = "";
  const note = (text) => {
    if (text !== lastNote) process.stdout.write(`merge-pr #${options.pr}: ${text}\n`);
    lastNote = text;
  };

  for (;;) {
    const state = prState(options.pr);
    if (state.state !== "OPEN") {
      process.stderr.write(`merge-pr: PR #${options.pr} 는 ${state.state} 상태다. 머지하지 않는다.\n`);
      process.exit(1);
    }
    if (state.isDraft) {
      process.stderr.write(`merge-pr: PR #${options.pr} 는 초안이다. 머지하지 않는다.\n`);
      process.exit(1);
    }
    const sha = state.headRefOid;
    const runs = fastCheckRuns(repo, sha);
    // 같은 sha 에 push·pull_request 두 판이 있을 수 있다. 가장 최근 것을 본다.
    runs.sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")));
    const run = runs[0];

    if (!run) {
      note(`${sha.slice(0, 10)} 에 ci-fast 체크가 아직 없다. 기다린다.`);
    } else if (run.status !== "completed") {
      note(`${sha.slice(0, 10)} ci-fast ${run.status} — 기다린다. ${run.html_url}`);
    } else if (run.conclusion === "success") {
      note(`${sha.slice(0, 10)} ci-fast 초록. 머지한다.`);
      const args = ["pr", "merge", options.pr, options.method, "--match-head-commit", sha];
      if (options.deleteBranch) args.push("--delete-branch");
      try {
        execFileSync("gh", args, { stdio: "inherit" });
      } catch {
        // 머지 직전에 새 푸시가 들어오면 --match-head-commit 이 거절한다. 새 머리로 다시 기다린다.
        const now = prState(options.pr);
        if (now.state === "OPEN" && now.headRefOid !== sha) {
          note(`머리가 ${now.headRefOid.slice(0, 10)} 로 바뀌었다. 새 커밋의 ci-fast 를 기다린다.`);
          continue;
        }
        process.stderr.write("merge-pr: gh pr merge 가 실패했다(충돌·권한 등). 위 메시지를 보고 고친다.\n");
        process.exit(1);
      }
      process.stdout.write(`merge-pr #${options.pr}: 머지됨 (${sha.slice(0, 10)}).\n`);
      return;
    } else {
      process.stderr.write(
        `merge-pr: ${sha.slice(0, 10)} ci-fast ${run.conclusion}. 머지하지 않는다.\n` +
          `  로그: gh run view --job ${run.id} --log-failed   (${run.html_url})\n` +
          "  고쳐서 푸시한 뒤 이 명령을 다시 부른다.\n",
      );
      process.exit(1);
    }

    if (Date.now() > deadline) {
      process.stderr.write(`merge-pr: ${options.timeoutMin}분 안에 ci-fast 가 끝나지 않았다. 머지하지 않는다.\n`);
      process.exit(1);
    }
    await sleep(POLL_MS);
  }
}

main().catch((error) => {
  process.stderr.write(`merge-pr: ${error?.stderr?.toString?.() || error?.message || error}\n`);
  process.exit(1);
});
