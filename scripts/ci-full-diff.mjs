#!/usr/bin/env node
// scripts/ci-full-diff.mjs
// main 의 마지막 ci-full 판을 «직전 기준 판» 과 **실패 파일 단위**로 대조한다.
// v0.418·v0.419 레인이 손으로 하던 대조(샤드 아티팩트를 받아 실패 파일 목록을 비교)를 스크립트로 옮겼다.
//
// 판 고르기 (자동):
//   이번 판  = 기준 태그(마지막 발행 태그) **이후** main 커밋에서 돈 ci-full 중 가장 새 «완전한» 판.
//              완전 = 시험 샤드 잡이 전부 success·failure 로 끝났고 샤드마다 gates-report 아티팩트가 있다.
//   기준 판  = 기준 태그에 **포함된** 커밋(태그와 같거나 그 조상, 또는 그 위의 release 범프 커밋 하나)에서
//              돈 판 중 리포트가 있는 가장 새 것부터 최대 BASELINE_LAYERS 개. 파일마다 그 파일을 돌린 가장 새 판이
//              기준이다(layerBaselines). 어느 기준 판에서도 안 돈 파일의 실패는 «기준 판에 없음» 으로 따로 센다.
//   이번 판의 실패 파일 = 샤드 failedFiles 합집합 − 단독 재실행 통과(flakeRetries).
//
// 사용:
//   node scripts/ci-full-diff.mjs [--tag vX.Y.Z] [--candidate <run id>] [--baseline <run id>] [--out diff.json]
//   기본 태그는 발행된(초안 아닌) 가장 새 vX.Y.Z 릴리스다. 결과 JSON 을 stdout(또는 --out)에 쓴다.
//   읽기만 한다(gh api·gh run download). 저장소에 아무것도 쓰지 않는다.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { diffFailedFiles, layerBaselines, runCompleteness, summarizeShardReports } from "./lib/releaseGate.mjs";

const BASELINE_LAYERS = 3;

const SHARD_ARTIFACT = /^gates-report-shard-\d+$/u;
const TEST_JOB = /^tests \(\d+\)$/u;

function ghJson(args) {
  const raw = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  return raw.trim() ? JSON.parse(raw) : null;
}

export function repoSlug() {
  return process.env.GITHUB_REPOSITORY || execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" }).trim();
}

/** 발행된(초안 아닌) 가장 새 vX.Y.Z 릴리스 태그. */
export function latestPublishedTag(repo) {
  const releases = ghJson(["api", `repos/${repo}/releases?per_page=30`]) ?? [];
  const published = releases
    .filter((release) => !release.draft && /^v\d+\.\d+\.\d+$/u.test(release.tag_name))
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  return published[0]?.tag_name ?? null;
}

/**
 * 커밋이 태그에 «포함» 되는지, 태그 «이후» 인지, 관계없는지.
 * 포함: 태그와 같거나 태그의 조상. 또는 태그 조상 위에 `chore(release)` 범프 커밋 하나만 얹힌 release/next 머리.
 */
function relationToTag(repo, tag, sha, cache) {
  if (cache.has(sha)) return cache.get(sha);
  let relation = "other";
  try {
    const cmp = ghJson(["api", `repos/${repo}/compare/${tag}...${sha}`, "--jq", "{status: .status, ahead: .ahead_by, msgs: [.commits[].commit.message]}"]);
    if (cmp.status === "identical" || cmp.status === "behind") relation = "included";
    else if (cmp.status === "ahead") relation = "after";
    else if (cmp.status === "diverged" && cmp.ahead === 1 && /^chore\(release\)/u.test(cmp.msgs?.[0] ?? "")) relation = "included";
  } catch {
    relation = "other";
  }
  cache.set(sha, relation);
  return relation;
}

function runShape(repo, run) {
  const jobs = ghJson(["api", `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`, "--jq", "[.jobs[] | {name, conclusion}]"]) ?? [];
  const artifacts = ghJson(["api", `repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`, "--jq", "[.artifacts[] | select(.expired | not) | .name]"]) ?? [];
  const testJobs = jobs.filter((job) => TEST_JOB.test(job.name));
  const reportCount = artifacts.filter((name) => SHARD_ARTIFACT.test(name)).length;
  return { ...runCompleteness({ testJobs, reportCount }), reportNames: artifacts.filter((name) => SHARD_ARTIFACT.test(name)) };
}

function describeRun(run, shape) {
  return {
    id: run.id,
    url: run.html_url,
    branch: run.head_branch,
    event: run.event,
    headSha: run.head_sha,
    createdAt: run.created_at,
    conclusion: run.conclusion,
    complete: shape.complete,
    testJobs: shape.testJobs,
    reports: shape.reports,
  };
}

/** 이번 판·기준 판을 고른다. 고정 run id 를 주면 그것을 쓴다. */
export function pickRuns({ repo, tag, candidateId = null, baselineId = null }) {
  const runs = ghJson(["api", `repos/${repo}/actions/workflows/ci-full.yml/runs?status=completed&per_page=60`, "--jq", ".workflow_runs"]) ?? [];
  runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const cache = new Map();
  let candidate = null;
  const baselines = [];
  const layers = baselineId ? 1 : BASELINE_LAYERS;
  for (const run of runs) {
    if (candidate && baselines.length >= layers) break;
    const wantCandidate = !candidate && (candidateId ? String(run.id) === String(candidateId) : run.head_branch === "main");
    const wantBaseline = baselines.length < layers && (baselineId ? String(run.id) === String(baselineId) : true);
    if (!wantCandidate && !wantBaseline) continue;
    const relation = candidateId && String(run.id) === String(candidateId) ? "after" : relationToTag(repo, tag, run.head_sha, cache);
    if (wantCandidate && relation === "after") {
      const shape = runShape(repo, run);
      if (shape.complete || candidateId) {
        candidate = describeRun(run, shape);
        continue;
      }
    }
    if (wantBaseline && (relation === "included" || baselineId)) {
      const shape = runShape(repo, run);
      if (shape.reports > 0) baselines.push(describeRun(run, shape));
    }
  }
  return { candidate, baselines };
}

function downloadReports(runId, dir) {
  execFileSync("gh", ["run", "download", String(runId), "--pattern", "gates-report-shard-*", "--dir", dir], { stdio: ["ignore", "pipe", "pipe"] });
  const reports = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, "gates-report.json");
    if (existsSync(file)) reports.push(JSON.parse(readFileSync(file, "utf8")));
  }
  return reports;
}

/** 전체 대조. 실패하면 throw 대신 `{ ok:false, error }` 를 돌려 판정에 «판정 불가» 로 남긴다. */
export function computeCiFullDiff({ repo = repoSlug(), tag = null, candidateId = null, baselineId = null } = {}) {
  const baseTag = tag ?? latestPublishedTag(repo);
  if (!baseTag) return { ok: false, error: "발행된 태그가 없음" };
  const { candidate, baselines } = pickRuns({ repo, tag: baseTag, candidateId, baselineId });
  const baseline = baselines[0] ?? null;
  if (!candidate) return { ok: false, tag: baseTag, error: `${baseTag} 이후 main 의 완전한 ci-full 판이 없음`, baseline };
  if (!baseline) return { ok: false, tag: baseTag, error: `${baseTag} 에 포함된 커밋의 ci-full 판이 없음`, candidate };
  const scratch = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "ci-full-diff-"));
  try {
    const candReports = downloadReports(candidate.id, join(scratch, "candidate"));
    if (candReports.length !== candidate.reports) {
      return { ok: false, tag: baseTag, candidate, baseline, error: `이번 판 리포트 ${candReports.length}/${candidate.reports} 만 받음` };
    }
    const layerSummaries = baselines.map((run, index) => summarizeShardReports(downloadReports(run.id, join(scratch, `baseline-${index}`))));
    const cand = summarizeShardReports(candReports);
    const base = layerBaselines(layerSummaries);
    const diff = diffFailedFiles(cand, base);
    return {
      ...diff,
      tag: baseTag,
      candidate: { ...candidate, failed: cand.failedFiles.length, ran: cand.ranFiles.length, flaky: cand.flakyFiles },
      baseline: { ...baseline, failed: base.failedFiles.length, ran: base.ranFiles.length },
      baselineLayers: baselines.map((run, index) => ({ ...run, failed: layerSummaries[index].failedFiles.length, ran: layerSummaries[index].ranFiles.length })),
    };
  } catch (error) {
    return { ok: false, tag: baseTag, candidate, baseline, error: String(error?.message ?? error).split("\n")[0] };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const value = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  const result = computeCiFullDiff({ tag: value("--tag"), candidateId: value("--candidate"), baselineId: value("--baseline") });
  const json = `${JSON.stringify(result, null, 2)}\n`;
  const out = value("--out");
  if (out) writeFileSync(out, json);
  process.stdout.write(json);
  process.exit(result.error ? 2 : 0);
}
