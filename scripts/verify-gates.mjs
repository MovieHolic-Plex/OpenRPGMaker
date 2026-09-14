#!/usr/bin/env node
// 검증 게이트 실행기 — 종료 코드를 **직접** 확인하고, 기준선 대비 '새 실패'만 골라낸다.
//
// 왜 필요한가 (실측):
//  1. 백그라운드 실행기가 exit 0 을 보고했지만 실제로는 typecheck exit 2, vitest exit 1 이었다.
//     에이전트의 "테스트 통과했습니다" 자기보고는 근거로 쓸 수 없다.
//  2. 이 저장소의 기준선은 이미 빨간불이다(test/ 타입 에러 다수 + 실패 테스트 다수).
//     따라서 "전부 초록"을 요구하면 게이트가 무용지물이 된다. 기준선 대비 **새로 생긴**
//     실패만 회귀로 취급해야 실제로 작동한다.
//  3. 그 «새 실패» 판정도 정확해야 한다(실측 2026-09-11). 실패 파일이 기준선의 failedFiles 에
//     없으면 곧바로 회귀로 세던 때, 기준선(09-02) 이후 추가된 테스트 파일 1,116개 중 이미 빨간
//     것들이 전부 회귀로 잡혀 127건이 됐다 — 그중 84건은 그때 **존재하지도 않던 파일**이다.
//     없는 파일은 회귀할 수 없다. 그래서 «기준선 이후 신규 파일» 을 세 번째 갈래로 **보고**하되,
//     신규 여부를 확인할 수 없으면 회귀로 남긴다(래칫 보호). 판정 경로는 `baselineNovelty`.
//     기준선 파일은 자동으로 고치지 않는다 — 갱신은 사람이 `--save-baseline` 으로 하는 결정이다.
//
// 사용:
//   node scripts/verify-gates.mjs                          # 실행 + 요약
//   node scripts/verify-gates.mjs --save-baseline          # 현재 상태를 기준선으로 저장
//   node scripts/verify-gates.mjs --baseline <path>        # 기준선 대비 회귀만 실패 처리
//   node scripts/verify-gates.mjs --json                   # 기계 판독용 출력
//   node scripts/verify-gates.mjs --only typecheck|tests|css|surface
//                                                          # css 는 수 초, surface 는 수십 초, 나머지는 수 분
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { classifyTestFailures } from "./lib/gatesRegression.mjs";

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
// `--changed[=ref]` — vitest 의 `--changed` 로 넘겨 "바뀐 파일에 영향받는 테스트만" 돌린다.
// 23,700건 전체(15~26분)를 매 반복 돌리지 않기 위한 스코프다. 최종 게이트는 플래그 없이 전체를 돈다.
const changedArg = args.find((entry) => entry === "--changed" || entry.startsWith("--changed=")) ?? null;
const changedArgs = changedArg
  ? (changedArg.includes("=")
      ? ["--changed", changedArg.slice("--changed=".length)]
      : ["--changed"])
  : [];
if (changedArg && flag("--save-baseline")) {
  // 부분집합 실행을 기준선으로 저장하면 기준선이 그 부분집합이 돼 다음 전체 실행의
  // 모든 실패가 "신규 회귀"로 보고된다(게이트 무력화).
  throw new Error("--save-baseline 과 --changed 는 함께 쓸 수 없다 — 기준선이 부분집합이 된다.");
}

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

/**
 * git 이 아는 파일 목록. 실패하면 `null` — 부르는 쪽이 «확인 불가» 로 처리한다.
 * 게이트를 git 없이 돌리는 것(압축 배포본 등)을 막지 않되, 그때는 회귀 판정이 보수적으로 남는다.
 */
function gitNames(commandArgs) {
  const { code, out } = run("git", commandArgs);
  if (code !== 0) return null;
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * «이 파일이 기준선 시점에 없었다» 를 판정하는 술어를 만든다. 확인할 수 없으면 `null`.
 *
 * 세 경로를 순서대로 쓴다:
 *  1. `baseline.tests.testFiles` — 저장 시점의 전량 목록. 정확하다(신 기준선).
 *  2. `baseline.gitHead` — 그 커밋의 트리. 정확하다(저장 시 HEAD 를 기록한 경우).
 *  3. `ranAt` + `git log --diff-filter=A --since` — **근사**다. 날짜 기반이라 리베이스·
 *     cherry-pick 으로 커밋 날짜가 뒤집히면 틀릴 수 있다. 그래도 «기준선 이후 추가» 만
 *     세므로 조용히 면제하는 방향으로는 틀리지 않는다(모르면 회귀로 남는다).
 */
function baselineNovelty(baseline) {
  const recorded = baseline?.tests?.testFiles;
  if (Array.isArray(recorded) && recorded.length > 0) {
    const existed = new Set(recorded);
    return { isNewFile: (file) => !existed.has(file), method: "baselineTestFiles" };
  }
  const head = baseline?.gitHead;
  if (typeof head === "string" && head) {
    const tracked = gitNames(["ls-tree", "-r", "--name-only", head, "--", "test/"]);
    if (tracked) {
      const existed = new Set(tracked);
      return { isNewFile: (file) => !existed.has(file), method: "gitTree" };
    }
  }
  const ranAt = baseline?.tests?.ranAt ?? baseline?.ranAt;
  if (typeof ranAt === "string" && ranAt) {
    const added = gitNames(["log", "--diff-filter=A", `--since=${ranAt}`, "--name-only", "--format=", "--", "test/"]);
    if (added) {
      const novel = new Set(added);
      return { isNewFile: (file) => novel.has(file), method: "gitAddedSince" };
    }
  }
  return { isNewFile: null, method: "unknown" };
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
  // A runner/bootstrap failure must not be allowed to reuse evidence from an older run.
  // Remove the fixed evidence file first; only this invocation may recreate it.
  rmSync(reportPath, { force: true });
  const { code } = run("node", [
    "scripts/run-vitest.mjs",
    "run",
    "--configLoader",
    "bundle",
    "--reporter=json",
    "--outputFile",
    reportPath,
    ...changedArgs,
  ]);

  if (!existsSync(reportPath)) {
    throw new Error(`vitest JSON 리포트가 생성되지 않았다: ${reportPath} (exit=${code})`);
  }
  const parsed = JSON.parse(readFileSync(reportPath, "utf8"));
  const results = parsed.testResults ?? [];
  // 파일 경로 정규화는 한 곳에서만 한다 — 실패 목록과 전량 목록이 같은 표기를 써야
  // 기준선 대조(«이 파일이 그때 있었나»)가 어긋나지 않는다.
  const normalize = (name) => {
    const slashed = String(name ?? "").split("\\").join("/");
    const index = slashed.indexOf("/test/");
    return index >= 0 ? slashed.slice(index + 1) : slashed;
  };
  const failedFiles = [...new Set(results.filter((entry) => entry.status !== "passed").map((entry) => normalize(entry.name)))].sort();
  // 기준선이 «그때 어떤 테스트 파일이 있었나» 를 스스로 기록할 수 있게 전량을 함께 돌려준다.
  // 이게 없으면 신규 파일과 기존 파일을 구분할 수 없어, 스위트가 커질수록 «새 실패» 가 부풀고
  // 래칫이 노이즈에 묻힌다(실측 2026-09-11: 127건 중 84건이 신규 파일).
  const testFiles = [...new Set(results.map((entry) => normalize(entry.name)))].sort();
  const failedCount = Number(parsed.numFailedTests ?? 0);
  const passedCount = Number(parsed.numPassedTests ?? 0);
  const totalCount = Number(parsed.numTotalTests ?? 0);

  // 빈 결과를 기준선으로 굳히지 않는다. 이 방어가 없어서 위 파싱 버그가 조용히 통과했다.
  if (code !== 0 && failedFiles.length === 0 && failedCount === 0) {
    throw new Error(
      `vitest 가 exit=${code} 인데 실패 항목을 하나도 읽지 못했다 — 리포트 파싱을 확인하라 (${reportPath})`
    );
  }
  if (results.length === 0) {
    throw new Error(`vitest 리포트에 테스트 파일이 0개다 — 수집 경로를 확인하라 (${reportPath})`);
  }
  if (totalCount === 0) {
    throw new Error(`vitest 가 테스트를 하나도 수집하지 못했다 — runner 로딩 경로를 확인하라 (${reportPath})`);
  }

  return { name: "vitest", exitCode: code, totalCount, failedCount, passedCount, failedFiles, testFiles };
}

// CSS 게이트 — 자체 기준선을 가진 두 정적 분석 스크립트를 그대로 실행한다.
//
// 여기 붙이는 이유: 이 저장소는 GitHub Actions 가 리포지터리 수준에서 꺼져 있고
// (`actions/permissions` → enabled:false, 마지막 실행 2026-08-04),
// 그 뒤로도 1,109 커밋(그중 CSS 330 커밋)이 들어왔다. 즉 CI 는 집행 경로가 아니다.
// AGENTS.md:79 가 지정한 실제 집행 경로는 "감독자가 직접 `npm run gates`" 이므로,
// 래칫도 거기 있어야 한다. 따로 `npm run gates:css` 로만 두면 별도로 기억해야 하고,
// 그건 §4.1(하드코딩 hex)이 593 → 1,940 으로 3.2배 늘어난 것과 같은 실패 경로다.
//
// typecheck/tests 와 달리 기준선 대비 비교를 하지 않는다 — 두 스크립트가 각자
// `.omo/css-budget-baseline.json` 과 인라인 유예 목록으로 이미 래칫을 구현하고 있어서,
// exit != 0 은 그 자체로 "새 위반"을 뜻한다. 여기서 또 기준선을 씌우면 이중 유예가 된다.
function cssGate() {
  const budget = run("node", ["scripts/check-css-budget.mjs"]);
  const graph = run("node", ["scripts/check-css-graph.mjs"]);
  return {
    name: "css",
    exitCode: budget.code === 0 && graph.code === 0 ? 0 : 1,
    budgetExitCode: budget.code,
    graphExitCode: graph.code,
    failures: [
      ...(budget.code === 0 ? [] : [`check-css-budget.mjs exit=${budget.code}`]),
      ...(graph.code === 0 ? [] : [`check-css-graph.mjs exit=${graph.code}`]),
    ],
    out: `${budget.out}${graph.out}`.trimEnd(),
  };
}

// 표면 스냅샷 게이트 — 이벤트 에디터 폼/M2/셸/커밋/조건 축 + CSS 실사용 클래스.
//
// 왜 `tests` 게이트와 별도인가 (실측): `npm test` 는 clean main 에서도 84~86 파일이 빨갛다.
// 표면 게이트를 그 안에만 두면 사람이 "빨간 게 늘었나"를 눈으로 셀 수 없고, 아래 회귀 판정도
// "기준선에 없던 파일이 실패"라는 넓은 그물에만 걸린다. 표면 축은 **새로 만든 축이라 항상
// 초록이어야 하는** 게이트이므로 기준선 관용을 주지 않고 종료 코드를 그대로 본다.
//
// css 게이트와 같은 이유로 기준선 대비 비교를 하지 않는다 — 각 축이 자체 기준선 + 하한선
// 래칫을 이미 갖고 있어서, exit != 0 은 그 자체로 "새 위반"이다.
function surfaceGate() {
  const { code, out } = run("node", ["scripts/check-surface-gates.mjs", "--json"]);
  let parsed = null;
  try {
    parsed = JSON.parse(out.slice(out.indexOf("{")));
  } catch {
    // JSON 파싱 실패도 게이트 실패다 — 조용히 통과시키면 실행기 고장이 초록으로 보인다.
  }
  return {
    name: "surface",
    exitCode: code,
    axes: parsed?.axes ?? [],
    skippedAxes: parsed?.skippedAxes ?? [],
    failures: parsed?.failures ?? (code === 0 ? [] : [`check-surface-gates.mjs exit=${code} (출력 파싱 실패)`]),
    out: (parsed?.out ?? out).trimEnd(),
  };
}

// 브라우저 게이트 — 실제 Chromium 으로 페이지를 띄우는 테스트는 32워커 무리 안에서 자기
// 준비 마감을 넘긴다(실측 2026-09-13: 단독 37s 통과 / 전체 스위트 동시 실행 시
// `page.waitForSelector` 30s 타임아웃, 남은 회귀 1건이 늘 이 파일이었다).
// 마감을 늘리는 대신 **경합에서 떼어낸다**: 동시성을 낮춰 따로 돌리고 종료 코드를 그대로 본다.
function listBrowserTestFiles(dir = resolve(process.cwd(), "test"), acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) listBrowserTestFiles(full, acc);
    else if (entry.name.endsWith(".browser.test.ts")) acc.push(full.slice(process.cwd().length + 1));
  }
  return acc;
}

function browserGate() {
  const files = listBrowserTestFiles();
  if (files.length === 0) return { name: "browser", exitCode: 0, files: [], failures: [], out: "" };
  const { code, out } = run("node", [
    "scripts/run-vitest.mjs",
    "run",
    "--config",
    "vitest.browser.config.ts",
    "--configLoader",
    "bundle",
    "--reporter=default",
    "--maxWorkers=2",
    "--minWorkers=1",
    ...files,
  ]);
  const failed = out.split("\n").map((line) => line.trim()).filter((line) => /^(FAIL|×)\s+test\//.test(line));
  return {
    name: "browser",
    exitCode: code,
    files,
    failures: code === 0 ? [] : (failed.length ? failed : [`browser tests exit=${code}`]),
    out: out.trimEnd(),
  };
}

const report = { ranAt: new Date().toISOString(), cwd: process.cwd() };
if (only !== "tests" && only !== "css" && only !== "surface" && only !== "browser") report.typecheck = typecheckGate();
if (only !== "typecheck" && only !== "css" && only !== "surface" && only !== "browser") report.tests = testsGate();
if (only !== "typecheck" && only !== "tests" && only !== "surface" && only !== "browser") report.css = cssGate();
if (only !== "typecheck" && only !== "tests" && only !== "css" && only !== "browser") report.surface = surfaceGate();
if (only !== "typecheck" && only !== "tests" && only !== "css" && only !== "surface") report.browser = browserGate();

if (flag("--save-baseline")) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  // 기준선은 이제 git 추적 대상이다(.gitignore 예외). AGENTS.md 는 병렬 에이전트마다 새
  // 워크트리를 강제하므로, 절대 경로인 `cwd` 를 그대로 저장하면 워크트리마다 기준선이
  // 더럽혀져 매번 의미 없는 diff 가 생긴다. 실행 시점 진단용으로는 --json 에 그대로 남기고,
  // 저장본에서만 뺀다. `ranAt` 도 같은 이유로 재저장 때마다 바뀌지만, 그건 언제 갱신했는지를
  // 알려주는 유용한 정보라 남긴다.
  const { cwd: _cwd, css: cssReport, surface: surfaceReport, browser: browserReport, ...rest } = report;
  // CSS/표면 게이트의 `out` 은 사람이 읽는 콘솔 출력이라 기준선에 넣으면 수백 줄이 쌓인다.
  // 애초에 두 게이트는 기준선 대비 비교를 하지 않으므로 종료 코드만 기록으로 남긴다.
  const persisted = { ...rest };
  // 기준선이 «언제의 나무였나» 를 스스로 남긴다. 이 한 줄이 없으면 다음 비교는 날짜 근사
  // (`ranAt` + git log)로 내려앉고, 리베이스·cherry-pick 이 섞이면 신규 파일 판정이 흔들린다.
  const headNow = run("git", ["rev-parse", "HEAD"]);
  if (headNow.code === 0 && headNow.out.trim()) persisted.gitHead = headNow.out.trim().split("\n")[0];
  if (cssReport) persisted.css = { name: cssReport.name, exitCode: cssReport.exitCode };
  // 표면 게이트는 **어떤 축이 돌았는지**를 기록에 남긴다. 축 파일이 개명·삭제되면
  // check-surface-gates.mjs 가 하드 실패하지만, 선택 축(조건 등)이 조용히 빠지는 것은
  // 기준선 diff 로만 보인다.
  if (surfaceReport)
    persisted.surface = {
      name: surfaceReport.name,
      exitCode: surfaceReport.exitCode,
      axes: surfaceReport.axes,
      skippedAxes: surfaceReport.skippedAxes,
    };
  if (browserReport)
    persisted.browser = { name: browserReport.name, exitCode: browserReport.exitCode, files: browserReport.files };
  writeFileSync(baselinePath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
  // «등재» 를 눈에 보이게 한다: 이 숫자가 다음 실행에서 신규 파일을 가려내는 기준이 된다.
  const enrolled = persisted.tests?.testFiles?.length ?? 0;
  console.log(`기준선 저장: ${baselinePath}${enrolled > 0 ? ` (테스트 파일 ${enrolled}개 등재)` : ""}`);
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
    const novelty = baselineNovelty(baseline);
    const classified = classifyTestFailures({
      failedFiles: report.tests.failedFiles,
      baselineFailedFiles: baseline.tests.failedFiles ?? [],
      isNewFile: novelty.isNewFile ?? undefined,
    });
    regressions.push(...classified.regressions);
    report.newFileFailures = classified.newFileFailures;
    report.testAttribution = novelty.method;
  }
}

// CSS 게이트는 기준선 유무와 무관하게 실패가 곧 회귀다(자체 래칫을 이미 통과한 뒤이므로).
// 기준선이 있을 때 종료 코드가 regressions 로만 결정되기 때문에 여기서 함께 넣어야 한다.
for (const failure of report.css?.failures ?? []) regressions.push(`css ${failure}`);
// 표면 게이트도 같은 이유로 기준선 유무와 무관하게 실패가 곧 회귀다.
for (const failure of report.surface?.failures ?? []) regressions.push(`surface ${failure}`);
// 브라우저 게이트도 같은 이유로 기준선 유무와 무관하게 실패가 곧 회귀다.
for (const failure of report.browser?.failures ?? []) regressions.push(`browser ${failure}`);
// 새로 실패한 테스트 파일은 **단독 재실행**으로 한 번 더 판정한다. 실측(2026-09-13): 32워커
// 전체 실행에서는 매번 서로 다른 파일들이 "새로 실패"에 섞였고, 그 전부가 단독으로는 통과했다 —
// 굶주린 워커에서만 흔들리는 타이밍 플레이크다.
//
// 판정은 **파일별 · maxWorkers=1** 로 한다. 후보를 한 실행에 몰아 돌렸더니 그 배치 자체가
// 경합을 만들어 멀쩡한 파일을 "단독 재실행도 실패"로 오판했다(2026-09-13 실측: 같은 파일이
// 한 실행에 모으면 실패, 하나씩 돌리면 통과). 동시 실행도 하지 않는다.
// 판정 기준은 종료 코드가 아니라 **테스트 단위 실패 수**다 — 테스트는 다 통과하는데 테스트 밖
// 프로세스 오류로 파일이 영원히 회귀가 되던 문제(같은 날 실측)를 막는다.
// 예산(기본 20분)을 넘긴 후보는 판정하지 않고 회귀로 남긴다. `--no-flake-retry` 로 끈다.
const flakeRetries = [];
if (baseline && regressions.length > 0 && !flag("--no-flake-retry")) {
  const deadline = Date.now() + (Number(value("--flake-budget-min", "20")) || 20) * 60_000;
  const kept = [];
  for (const entry of regressions) {
    const match = /^tests (test\/\S+\.ts): 새로 실패$/u.exec(entry);
    if (!match) {
      kept.push(entry);
      continue;
    }
    if (Date.now() > deadline) {
      kept.push(`${entry} [재판정 예산 초과]`);
      continue;
    }
    const soloPath = `${tmpdir()}/gate-flake-${match[1].replace(/[^a-z0-9]+/giu, "_")}.json`;
    rmSync(soloPath, { force: true });
    run("node", [
      "scripts/run-vitest.mjs",
      "run",
      "--configLoader",
      "bundle",
      "--reporter=json",
      `--outputFile=${soloPath}`,
      "--maxWorkers=1",
      "--minWorkers=1",
      match[1],
    ]);
    let soloFailures = null;
    if (existsSync(soloPath)) {
      try {
        const solo = JSON.parse(readFileSync(soloPath, "utf8"));
        soloFailures = solo.numFailedTests ?? 0;
      } catch {
        soloFailures = null;
      }
    }
    if (soloFailures === 0) flakeRetries.push(match[1]);
    else kept.push(`${entry} [단독 재실행도 테스트 실패${soloFailures === null ? "(리포트 없음)" : ` ${soloFailures}건`}]`);
  }
  regressions.length = 0;
  regressions.push(...kept);
}
report.flakeRetries = flakeRetries;

report.baseline = baseline ? baselinePath : null;
report.regressions = regressions;

if (!asJson && flakeRetries.length > 0) {
  console.log(`부하 플레이크 ${flakeRetries.length}건 — 단독 재실행에서 통과했으므로 회귀에서 제외:`);
  for (const file of flakeRetries) console.log(`   ${file}`);
  console.log("");
}

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
  if (report.css) {
    const gate = report.css;
    console.log(`css            exit=${gate.exitCode}  budget=${gate.budgetExitCode}  graph=${gate.graphExitCode}`);
    // 실패했을 때만 스크립트 출력을 그대로 보여준다 — 어느 지표가 얼마나 늘었는지,
    // 어느 파일이 고아인지는 그 출력에 이미 파일 경로까지 찍혀 있다.
    if (gate.exitCode !== 0 && gate.out) {
      for (const line of gate.out.split("\n")) console.log(`   ${line}`);
    }
  }
  if (report.browser) {
    const gate = report.browser;
    console.log(`browser        exit=${gate.exitCode}  파일=${gate.files.length}`);
    if (gate.exitCode !== 0 && gate.out) {
      for (const line of gate.out.split("\n").slice(-20)) console.log(`   ${line}`);
    }
  }
  if (report.surface) {
    const gate = report.surface;
    console.log(`surface        exit=${gate.exitCode}  축=${gate.axes.length}` + (gate.skippedAxes.length ? `  미구현축=${gate.skippedAxes.length}` : ""));
    if (gate.exitCode !== 0 && gate.out) {
      for (const line of gate.out.split("\n")) console.log(`   ${line}`);
    }
  }
  if (baseline) {
    // 신규 파일 실패는 **회귀가 아니다** — 기준선 시점에 없던 파일은 깨질 수가 없다. 다만
    // 조용히 넘기지 않는다: 몇 건인지, 어떤 파일인지, 그리고 «신규 여부를 어떻게 판정했는지» 를
    // 함께 찍어야 다음 사람이 이 숫자를 신뢰할지 판단할 수 있다.
    const newFiles = report.newFileFailures ?? [];
    const attribution = report.testAttribution;
    if (newFiles.length > 0) {
      console.log(`\n기준선 이후 신규 파일 실패 ${newFiles.length}건 (회귀 아님 — 판정: ${attribution}):`);
      for (const line of newFiles.slice(0, 10)) console.log(`   ${line}`);
      if (newFiles.length > 10) console.log(`   …외 ${newFiles.length - 10}건 (--json 의 newFileFailures 참조)`);
    }
    if (attribution === "unknown") {
      console.log(
        "   ⚠ 기준선에 테스트 파일 목록도 gitHead 도 없다 — 신규 파일을 구분할 수 없어 전부 회귀로 셌다.\n" +
        "     `--save-baseline` 로 갱신하면 다음부터 신규 파일이 분리된다(래칫은 그대로 유지된다)."
      );
    }
    console.log(regressions.length === 0
      ? `\n기준선 대비 회귀 없음 (${baselinePath})`
      : `\n기준선 대비 회귀 ${regressions.length}건:`);
    for (const line of regressions) console.log(`   ${line}`);
  } else {
    console.log(`\n기준선 없음 — --save-baseline 으로 먼저 기록하세요.`);
  }
}

// 기준선이 있으면 회귀 여부로, 없으면 게이트 종료 코드로 판정한다.
// (CSS 게이트는 위에서 이미 regressions 에 합류했으므로 두 경로 모두에서 반영된다.)
if (baseline) process.exit(regressions.length === 0 ? 0 : 1);
process.exit(
  (report.typecheck?.exitCode ?? 0) === 0 &&
    (report.tests?.exitCode ?? 0) === 0 &&
    (report.css?.exitCode ?? 0) === 0 &&
    (report.surface?.exitCode ?? 0) === 0
    ? 0
    : 1
);
