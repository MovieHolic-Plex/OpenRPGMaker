#!/usr/bin/env node
// `.omo/test-timings.json` 을 ci-full 실행의 vitest 리포트에서 다시 만든다.
//
// 이 표는 verify-gates 의 `--shard i/n` 이 파일을 «측정한 시간» 으로 나누는 근거다
// (`scripts/lib/vitestShardPlan.mjs`). 파일마다 `{ sec, n }` — 초 평균과 평균에 쓴 회차 수.
//
// 사용:
//   node scripts/update-test-timings.mjs <runId> [<runId>...]   # gh run download 로 받아 평균
//   node scripts/update-test-timings.mjs 45328461701 --from /tmp/dl   # <from>/<runId>/ 에 이미 받은 것을 쓴다
//   옵션: --out <경로>(기본 .omo/test-timings.json) --repo <owner/name> --commit <sha>
//
// 입력은 회차마다 아티팩트 `gates-report-shard-*` 의 `gates-vitest-report.json` 이다
// (`testResults[].name`, `endTime - startTime`). 병합 규칙은 mergeTimingRuns 의 주석을 본다.
// 갱신은 사람이 가끔 PR 로 한다 — 매일 자동 커밋은 열린 PR 마다 충돌을 낸다.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mergeTimingRuns, TIMINGS_FILE } from "./lib/vitestShardPlan.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const optionNames = new Set(["--from", "--out", "--repo", "--commit"]);
const runIds = args.filter((arg, index) => !arg.startsWith("--") && !optionNames.has(args[index - 1]));
if (runIds.length === 0 || runIds.some((id) => !/^\d+$/u.test(id))) {
  console.error("사용: node scripts/update-test-timings.mjs <runId> [<runId>...] [--from <dir>] [--out <path>] [--repo <owner/name>] [--commit <sha>]");
  process.exit(2);
}
const outPath = resolve(option("--out") ?? TIMINGS_FILE);
const fromDir = option("--from");
const repoArgs = option("--repo") ? ["--repo", option("--repo")] : [];

function findReports(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findReports(full, found);
    else if (entry.name === "gates-vitest-report.json") found.push(full);
  }
  return found;
}

function download(runId) {
  const dir = fromDir ? join(resolve(fromDir), runId) : mkdtempSync(join(tmpdir(), `test-timings-${runId}-`));
  if (fromDir && existsSync(dir)) return dir;
  mkdirSync(dir, { recursive: true });
  const result = spawnSync("gh", ["run", "download", runId, ...repoArgs, "--pattern", "gates-report-shard-*", "--dir", dir], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`gh run download ${runId} 실패 (exit=${result.status})`);
  return dir;
}

const runs = [];
let commit = option("--commit");
for (const runId of runIds) {
  const dir = download(runId);
  const reports = findReports(dir);
  if (reports.length === 0) throw new Error(`run ${runId}: gates-vitest-report.json 이 없다 (${dir})`);
  const results = reports.flatMap((file) => JSON.parse(readFileSync(file, "utf8")).testResults ?? []);
  console.log(`run ${runId}: 샤드 리포트 ${reports.length}개, 파일 ${results.length}개`);
  runs.push(results);
  // 마지막 회차의 커밋을 적는다 — 아티팩트에 commit.txt 가 있다.
  const commitFile = join(dir, "gates-report-shard-1", "commit.txt");
  if (!option("--commit") && existsSync(commitFile)) commit = readFileSync(commitFile, "utf8").trim();
}

const files = mergeTimingRuns(runs);
const lines = Object.entries(files).map(([file, entry]) => `    ${JSON.stringify(file)}: ${JSON.stringify(entry)}`);
const body =
  `{\n  "version": 1,\n  "updatedAt": ${JSON.stringify(new Date().toISOString().slice(0, 10))},\n` +
  `  "commit": ${JSON.stringify(commit ?? null)},\n  "runs": ${JSON.stringify(runIds)},\n  "files": {\n${lines.join(",\n")}\n  }\n}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, "utf8");
console.log(`${outPath}: 파일 ${lines.length}개 (회차 ${runIds.length}개 평균)`);
