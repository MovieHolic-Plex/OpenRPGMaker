#!/usr/bin/env node
// scripts/ci-full-blame.mjs — main 의 ci-full 이 빨개지면 «새로 실패한 시험 파일» 마다 원인 후보 PR 을 짚는다.
//
// 왜 (2026-11-25 ci-speed): PR 에는 관련 시험만 돌고 전체는 ci-full(밤 1회·릴리스 전)만 돈다. 여러 레인이 같은 날 머지하면
//   ci-full 새 실패의 원인을 찾는 데 반나절이 걸렸다(v0.420 이 새 실패 14 → 9 → 7 로 하루 넘게 막힘). 레인은 PR 댓글로 알 수 있다.
//
// 무엇을 하나:
//   1. 이번 판(--run, 기본: main 에서 가장 최근에 끝난 실패 판)과 기준 판(--baseline, 기본: 그 전의 완전한 main 판)을
//      scripts/ci-full-diff.mjs 의 computeCiFullDiff 로 실패 파일 단위로 대조한다 → 새 실패 목록(단독 재실행 통과는 빠진다).
//   2. 기준 판 머리..이번 판 머리 의 main 첫 부모 커밋(스쿼시 PR)마다 바뀐 파일을 본다. 새 실패 시험이 런타임 import 그래프로 기대는
//      파일(시험 자신 포함)을 바꾼 커밋이 원인 후보다. 시험에서 가까운 의존(걸음 수가 작은 것)을 바꾼 PR 이 앞이다. 시험마다 앞 3개까지.
//   3. --post 면 후보 PR 마다 댓글 하나(그 PR 이 짚인 시험 전부)와 이슈 하나(전체 표)를 단다. 같은 판으로 두 번 달지 않는다(표식 줄).
//   그래프는 체크아웃(이번 판 머리)에서 만든다 — 워크플로는 이번 판 머리를 fetch-depth 0 으로 체크아웃한다.
//
// 사용:
//   node scripts/ci-full-blame.mjs [--run <id>] [--baseline <id>] [--out targets.json] [--post]
//   --post 없이는 표준 출력에 대상만 찍는다(gh 읽기만). --post 는 GH_TOKEN 에 pull-requests·issues 쓰기 권한이 필요하다.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { computeCiFullDiff, repoSlug } from "./ci-full-diff.mjs";
import { distances, loadRepoGraph } from "./lib/testImportGraph.mjs";

export const MAX_CANDIDATES_PER_TEST = 3;
const MARKER = (runId) => `<!-- ci-full-blame:${runId} -->`;

const gh = (args, input) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, input, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
const ghJson = (args) => {
  const raw = gh(args).trim();
  return raw ? JSON.parse(raw) : null;
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/**
 * 순수 판정: 새 실패 시험 → 원인 후보 커밋들.
 * @param {string[]} failures 새 실패 시험 경로
 * @param {{sha: string, pr: string|null, subject: string, changed: string[]}[]} commits 범위 안 커밋(오래된 것 → 새 것)
 * @param {Map<string, Set<string>>} forward 런타임 import 그래프(파일 → 그 파일이 import 하는 것)
 * @param {ReadonlyMap<string, string>} [sources] 시험 소스 — 시험이 경로 문자열로 읽는 파일(readFileSync("test/x.test.ts") 등)을 바꾼 커밋도 걸음 0 으로 친다.
 */
export function blameFailures(failures, commits, forward, limit = MAX_CANDIDATES_PER_TEST, sources = new Map()) {
  return failures.map((test) => {
    const deps = distances(forward, [test]);
    const source = sources.get(test) ?? "";
    for (const commit of commits) for (const path of commit.changed) if (!deps.has(path) && path.includes("/") && (source.includes(`"${path}"`) || source.includes(`'${path}'`) || source.includes(`\`${path}\``))) deps.set(path, 0);
    const hits = [];
    commits.forEach((commit, order) => {
      const touched = commit.changed.filter((path) => deps.has(path)).sort((a, b) => deps.get(a) - deps.get(b) || (a < b ? -1 : 1));
      if (touched.length === 0) return;
      hits.push({ ...commit, order, distance: deps.get(touched[0]), touched: touched.slice(0, 5) });
    });
    hits.sort((a, b) => a.distance - b.distance || b.order - a.order);
    return { test, candidates: hits.slice(0, limit).map(({ order, changed, ...rest }) => rest), more: Math.max(0, hits.length - limit) };
  });
}

/** PR 번호 → 그 PR 이 짚인 시험들. */
export function groupByPr(rows) {
  const byPr = new Map();
  for (const row of rows) {
    for (const candidate of row.candidates) {
      if (!candidate.pr) continue;
      if (!byPr.has(candidate.pr)) byPr.set(candidate.pr, { pr: candidate.pr, subject: candidate.subject, tests: [] });
      byPr.get(candidate.pr).tests.push({ test: row.test, distance: candidate.distance, touched: candidate.touched });
    }
  }
  return [...byPr.values()].sort((a, b) => Number(a.pr) - Number(b.pr));
}

const runLink = (run) => `[${run.id}](${run.url})`;

export function prComment(entry, diff, issueRef) {
  const lines = [
    MARKER(diff.candidate.id),
    `**ci-full 새 실패 원인 후보** — main ci-full ${runLink(diff.candidate)} 에서 기준 판 ${runLink(diff.baseline)} 에 없던 실패가 생겼고, 이 PR 이 그 시험이 기대는 파일을 바꿨다.`,
    "",
    "| 새 실패 시험 | 이 PR 이 바꾼 의존 파일 | 걸음 |",
    "|---|---|---|",
    ...entry.tests.map((item) => `| \`${item.test}\` | ${item.touched.map((path) => `\`${path}\``).join(" ")} | ${item.distance} |`),
    "",
    `확인: \`gh workflow run ci-vitest-files.yml --ref main -f files="${entry.tests.map((item) => item.test).join(" ")}"\``,
    `원인이 아니면 무시해도 된다(후보는 import 그래프로만 고른다). 전체 표: ${issueRef}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function issueBody(rows, diff) {
  const lines = [
    MARKER(diff.candidate.id),
    `main ci-full ${runLink(diff.candidate)} (머리 \`${diff.candidate.headSha.slice(0, 9)}\`) 에서 기준 판 ${runLink(diff.baseline)} (머리 \`${diff.baseline.headSha.slice(0, 9)}\`) 에 없던 실패 ${rows.length}개.`,
    "원인 후보는 두 머리 사이 머지 중 그 시험이 런타임 import 로 기대는 파일을 바꾼 PR 이다(가까운 의존이 앞). 만든 도구: `scripts/ci-full-blame.mjs`.",
    "",
    "| 새 실패 시험 | 원인 후보 (걸음) |",
    "|---|---|",
    ...rows.map((row) => `| \`${row.test}\` | ${row.candidates.length === 0 ? "후보 없음 — 의존 파일을 바꾼 머지가 없다(시간 초과·환경·러너 부하 의심)" : row.candidates.map((candidate) => `${candidate.pr ? `#${candidate.pr}` : candidate.sha.slice(0, 9)} (${candidate.distance})`).join(", ") + (row.more ? ` 외 ${row.more}` : "")} |`),
  ];
  return `${lines.join("\n")}\n`;
}

function latestMainFailure(repo) {
  const runs = ghJson(["api", `repos/${repo}/actions/workflows/ci-full.yml/runs?branch=main&status=completed&per_page=30`, "--jq", ".workflow_runs"]) ?? [];
  return runs.find((run) => run.conclusion === "failure")?.id ?? null;
}

/** 이번 판보다 먼저 만들어진 main 판 중 성공·실패로 끝난 가장 새 것(리포트 유무는 computeCiFullDiff 가 본다). */
function previousMainRun(repo, runId) {
  const runs = ghJson(["api", `repos/${repo}/actions/workflows/ci-full.yml/runs?branch=main&status=completed&per_page=60`, "--jq", ".workflow_runs"]) ?? [];
  const current = runs.find((run) => String(run.id) === String(runId));
  if (!current) return null;
  return runs.filter((run) => run.created_at < current.created_at && (run.conclusion === "failure" || run.conclusion === "success"))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]?.id ?? null;
}

function rangeCommits(baseSha, headSha) {
  const out = git("log", "--first-parent", "--reverse", "--format=%H%x09%s", `${baseSha}..${headSha}`).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [sha, subject] = line.split("\t");
    const changed = git("diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", `${sha}^`, sha).trim().split("\n").filter(Boolean);
    return { sha, pr: (subject.match(/\(#(\d+)\)\s*$/u) || [])[1] ?? null, subject, changed };
  });
}

function post(repo, rows, diff) {
  const marker = MARKER(diff.candidate.id);
  const title = `ci-full 새 실패 ${rows.length}개 (run ${diff.candidate.id})`;
  const existing = ghJson(["issue", "list", "-R", repo, "--state", "all", "--search", `"run ${diff.candidate.id}" in:title`, "--json", "number,title"]) ?? [];
  let issue = existing.find((item) => item.title === title)?.number ?? null;
  if (!issue) {
    const url = gh(["issue", "create", "-R", repo, "--title", title, "--body-file", "-"], issueBody(rows, diff)).trim();
    issue = Number(url.split("/").pop());
    console.log(`이슈 #${issue}: ${url}`);
  } else console.log(`이슈 #${issue} 이미 있음 — 건너뜀`);
  for (const entry of groupByPr(rows)) {
    const bodies = gh(["api", "--paginate", `repos/${repo}/issues/${entry.pr}/comments?per_page=100`, "--jq", ".[].body | @json"]).split("\n").filter(Boolean).map((line) => JSON.parse(line));
    if (bodies.some((body) => body.includes(marker))) {
      console.log(`#${entry.pr} 에 이미 댓글 있음 — 건너뜀`);
      continue;
    }
    gh(["pr", "comment", entry.pr, "-R", repo, "--body-file", "-"], prComment(entry, diff, `#${issue}`));
    console.log(`#${entry.pr} 댓글: ${entry.tests.map((item) => item.test).join(", ")}`);
  }
}

function main(argv) {
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  const repo = repoSlug();
  const runId = value("--run") ?? latestMainFailure(repo);
  if (!runId) throw new Error("main 의 실패한 ci-full 판이 없다");
  const baselineId = value("--baseline") ?? previousMainRun(repo, runId);
  if (!baselineId) throw new Error(`run ${runId} 앞의 main ci-full 판이 없다`);
  const diff = computeCiFullDiff({ repo, candidateId: runId, baselineId });
  if (diff.error) throw new Error(`대조 실패: ${diff.error}`);
  const commits = rangeCommits(diff.baseline.headSha, diff.candidate.headSha);
  const graph = loadRepoGraph(process.cwd());
  // 기준 판에서 돌지 않은 시험(새 시험 파일 등)의 실패도 이번 판에서 처음 보인 실패다.
  const rows = blameFailures([...new Set([...diff.newFailures, ...(diff.notInBaseline ?? [])])], commits, graph.forward, MAX_CANDIDATES_PER_TEST, graph.sources);
  const report = { run: diff.candidate, baseline: diff.baseline, commits: commits.length, rows, prs: groupByPr(rows) };
  console.log(`ci-full-blame: run ${diff.candidate.id} vs ${diff.baseline.id} — 새 실패 ${rows.length}개, 범위 커밋 ${commits.length}개, 댓글 대상 PR ${report.prs.length}개`);
  for (const row of rows) console.log(`  ${row.test} ← ${row.candidates.map((candidate) => `${candidate.pr ? `#${candidate.pr}` : candidate.sha.slice(0, 9)}(${candidate.distance}: ${candidate.touched[0]})`).join(", ") || "후보 없음"}`);
  const out = value("--out");
  if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  if (argv.includes("--post") && rows.length > 0) post(repo, rows, diff);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`ci-full-blame: ${error.message}`);
    process.exitCode = 2;
  }
}
