#!/usr/bin/env node
// 검증 게이트 실행기 — 종료 코드를 **직접** 확인하고, 기준선 대비 '새 실패'만 골라낸다.
//
// 왜 필요한가 (실측):
//  1. 백그라운드 실행기가 exit 0 을 보고했지만 실제로는 typecheck exit 2, vitest exit 1 이었다.
//     에이전트의 "테스트 통과했습니다" 자기보고는 근거로 쓸 수 없다.
//  2. 이 저장소의 기준선은 이미 빨간불이다(test/ 타입 에러 다수 + 실패 테스트 다수).
//     따라서 "전부 초록"을 요구하면 게이트가 무용지물이 된다. 기준선 대비 **새로 생긴**
//     실패만 회귀로 취급해야 실제로 작동한다.
//
// 사용:
//   node scripts/verify-gates.mjs                          # 실행 + 요약
//   node scripts/verify-gates.mjs --save-baseline          # 현재 상태를 기준선으로 저장
//   node scripts/verify-gates.mjs --baseline <path>        # 기준선 대비 회귀만 실패 처리
//   node scripts/verify-gates.mjs --json                   # 기계 판독용 출력
//   node scripts/verify-gates.mjs --only typecheck|tests
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_BASELINE = resolve(process.cwd(), ".omo/gates-baseline.json");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const only = value("--only", null);
const asJson = flag("--json");
const baselinePath = resolve(value("--baseline", DEFAULT_BASELINE));

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  // spawnSync 의 status 가 진짜 종료 코드다. 파이프를 거치면 마지막 명령의 코드로 뒤바뀐다
  // (`tsc | tail` 이 exit 0 으로 보였던 원인).
  return { code: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function typecheckGate() {
  const { code, out } = run("npx", ["tsc", "--noEmit", "-p", "tsconfig.app.json"]);
  const lines = out.split("\n").filter((line) => /error TS\d+:/.test(line));
  const byFile = {};
  for (const line of lines) {
    const file = /^([^(]+)\(/.exec(line)?.[1]?.replace(/\\/g, "/");
    if (file) byFile[file] = (byFile[file] ?? 0) + 1;
  }
  return { name: "typecheck:app", exitCode: code, errorCount: lines.length, files: byFile };
}

function testsGate() {
  // vitest 의 텍스트 출력(dot reporter)을 정규식으로 긁으면 안 된다 — Windows 콘솔에서
  // ANSI 이스케이프와 `❯` 글리프가 깨져(`??`) 매치가 전부 실패하고, 실패 파일 0건 ·
  // 통과 0건 인 **빈 기준선**이 조용히 저장됐다(실측: exitCode 1 인데 failedFiles 0).
  // 그러면 다음 실행에서 실제 실패 전부가 "신규 회귀"로 보고돼 게이트가 무용지물이 된다.
  // 그래서 기계 판독용 JSON 리포터를 쓴다.
  const reportPath = resolve(process.cwd(), ".omo/gates-vitest-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  const { code } = run("npx", [
    "vitest",
    "run",
    "--configLoader",
    "runner",
    "--reporter=json",
    "--outputFile",
    reportPath,
  ]);

  if (!existsSync(reportPath)) {
    throw new Error(`vitest JSON 리포트가 생성되지 않았다: ${reportPath} (exit=${code})`);
  }
  const parsed = JSON.parse(readFileSync(reportPath, "utf8"));
  const results = parsed.testResults ?? [];
  const failedFiles = [
    ...new Set(
      results
        .filter((entry) => entry.status !== "passed")
        .map((entry) => {
          const slashed = String(entry.name ?? "").split("\\").join("/");
          const index = slashed.indexOf("/test/");
          return index >= 0 ? slashed.slice(index + 1) : slashed;
        })
    ),
  ].sort();
  const failedCount = Number(parsed.numFailedTests ?? 0);
  const passedCount = Number(parsed.numPassedTests ?? 0);

  // 빈 결과를 기준선으로 굳히지 않는다. 이 방어가 없어서 위 파싱 버그가 조용히 통과했다.
  if (code !== 0 && failedFiles.length === 0 && failedCount === 0) {
    throw new Error(
      `vitest 가 exit=${code} 인데 실패 항목을 하나도 읽지 못했다 — 리포트 파싱을 확인하라 (${reportPath})`
    );
  }
  if (results.length === 0) {
    throw new Error(`vitest 리포트에 테스트 파일이 0개다 — 수집 경로를 확인하라 (${reportPath})`);
  }

  return { name: "vitest", exitCode: code, failedCount, passedCount, failedFiles };
}

const report = { ranAt: new Date().toISOString(), cwd: process.cwd() };
if (only !== "tests") report.typecheck = typecheckGate();
if (only !== "typecheck") report.tests = testsGate();

if (flag("--save-baseline")) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`기준선 저장: ${baselinePath}`);
}

// 기준선 대비 회귀 판정 — 새로 깨진 파일만 잡는다.
let regressions = [];
const baseline = !flag("--save-baseline") && existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;

if (baseline) {
  if (report.typecheck && baseline.typecheck) {
    for (const [file, count] of Object.entries(report.typecheck.files)) {
      const before = baseline.typecheck.files?.[file] ?? 0;
      if (count > before) regressions.push(`typecheck ${file}: ${before} → ${count}`);
    }
  }
  if (report.tests && baseline.tests) {
    const before = new Set(baseline.tests.failedFiles ?? []);
    for (const file of report.tests.failedFiles) {
      if (!before.has(file)) regressions.push(`tests ${file}: 새로 실패`);
    }
  }
}
report.baseline = baseline ? baselinePath : null;
report.regressions = regressions;

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  if (report.typecheck) {
    const gate = report.typecheck;
    console.log(`typecheck:app  exit=${gate.exitCode}  errors=${gate.errorCount}  files=${Object.keys(gate.files).length}`);
    for (const [file, count] of Object.entries(gate.files).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`   ${count.toString().padStart(4)}  ${file}`);
    }
  }
  if (report.tests) {
    const gate = report.tests;
    console.log(`vitest         exit=${gate.exitCode}  failed=${gate.failedCount}  passed=${gate.passedCount}  files=${gate.failedFiles.length}`);
  }
  if (baseline) {
    console.log(regressions.length === 0
      ? `\n기준선 대비 회귀 없음 (${baselinePath})`
      : `\n기준선 대비 회귀 ${regressions.length}건:`);
    for (const line of regressions) console.log(`   ${line}`);
  } else {
    console.log(`\n기준선 없음 — --save-baseline 으로 먼저 기록하세요.`);
  }
}

// 기준선이 있으면 회귀 여부로, 없으면 게이트 종료 코드로 판정한다.
if (baseline) process.exit(regressions.length === 0 ? 0 : 1);
process.exit((report.typecheck?.exitCode ?? 0) === 0 && (report.tests?.exitCode ?? 0) === 0 ? 0 : 1);
