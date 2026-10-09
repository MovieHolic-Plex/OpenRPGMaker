#!/usr/bin/env node
// scripts/check-surface-gates.mjs
//
// 이벤트 에디터 **표면 스냅샷 게이트** 묶음 실행기.
//
// 왜 별도 실행기가 필요한가 (실측):
//  1. 이 저장소의 `npm test` 는 clean main 에서도 84~86 파일이 빨갛다. 표면 게이트 3~5개를
//     그 안에 두면 사람이 "빨간 게 늘었나"를 눈으로 셀 수 없다. 실제로 표면 게이트가
//     빨간 상태로 며칠 방치될 수 있는 구조였다.
//  2. vitest 의 위치 인자 필터는 **substring OR** 이다. `"eventEditor"` 를 넘기면
//     eventEditor* 테스트 40여 개가 전부 걸리고, `"eventEditor.*\.baseline\.test\.ts"` 같은
//     정규식은 매치가 0이다(실측). 그래서 파일 경로를 직접 열거해야 한다.
//  3. 축이 늘어날 때(조건 축 등) 파일이 아직 없으면 vitest 는 "No test files found" 로
//     exit 1 한다. 그래서 **존재하는 축만** 넘기고, 필수 축이 빠지면 별도로 하드 실패한다.
//
// 사용:
//   node scripts/check-surface-gates.mjs           # 게이트 (기준선 갱신 금지)
//   node scripts/check-surface-gates.mjs --json
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { requiredAxisFailures } from "./lib/surface-axis-results.mjs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const asJson = process.argv.includes("--json");

/**
 * 축 목록. `required` 인 축의 파일이 없으면 게이트는 통과하지 않는다 —
 * 축이 조용히 사라지면(파일 삭제/개명) 게이트가 초록인 채로 보증을 잃는다.
 */
const AXES = [
  { path: "test/databaseAllTabsRenderWalk.test.ts", required: true, label: "DB primary surfaces" },
  // 축이 아니라 **축들이 공유하는 계약 자체**의 테스트. 여기가 죽으면 축 전부가 동시에
  // 초록 거짓말을 하고, 그 죽음은 축 테스트로는 안 보인다(안전장치는 정상 실행에서 안 돈다).
  { path: "test/surfaceGateSupport.test.ts", required: true, label: "게이트 계약" },
  { path: "test/eventEditorFormSurface.baseline.test.ts", required: true, label: "폼(kind)" },
  { path: "test/eventEditorM2Surface.baseline.test.ts", required: true, label: "M2(commandId)" },
  { path: "test/eventEditorShellSurface.baseline.test.ts", required: true, label: "셸" },
  { path: "test/eventEditorCommitProbe.baseline.test.ts", required: true, label: "커밋 프로브" },
  // 아래 3축은 신설 직후 required: false 였다. 전부 초록이 됐으므로 필수로 올린다 —
  // 파일이 사라지면(개명/삭제) 게이트가 초록인 채로 보증을 잃는 것이 가장 나쁜 실패다.
  { path: "test/eventEditorConditionSurface.baseline.test.ts", required: true, label: "조건/열거값" },
  { path: "test/eventEditorPortalSurface.baseline.test.ts", required: true, label: "포털(피커/모달)" },
  { path: "test/eventEditorInteractionSurface.baseline.test.ts", required: true, label: "상호작용 후 폼" },
  // 스냅샷이 아니라 동작 계약이지만 같은 리팩터를 감시하므로 함께 돈다.
  { path: "test/eventEditorStagedState.test.ts", required: true, label: "연속 편집 누적" },
];

/** 기준선을 다시 쓰는 환경변수. 게이트 실행 중에 켜져 있으면 그 자체가 실패다. */
const UPDATE_ENVS = [
  "FORM_SURFACE_UPDATE",
  "M2_SURFACE_UPDATE",
  "SHELL_SURFACE_UPDATE",
  "COMMIT_PROBE_UPDATE",
  "CONDITION_SURFACE_UPDATE",
  "PORTAL_SURFACE_UPDATE",
  "INTERACTION_SURFACE_UPDATE",
  "SURFACE_FLOOR_UPDATE",
  "CSS_LIVE_BASELINE_UPDATE",
];

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return { code: result.status ?? -1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const failures = [];

// 1) 갱신 모드 차단. 기준선을 방금 다시 쓴 상태의 "통과"는 자기 확인이다
//    (실측: 기준선 mtime 20:54:49~57, "9 tests 통과" 확인이 20:55:00).
const updateOn = UPDATE_ENVS.filter((k) => process.env[k] === "1");
if (updateOn.length) {
  failures.push(`기준선 갱신 모드가 켜져 있다: ${updateOn.join(", ")} — 게이트는 갱신 없이 돌려야 한다.`);
}

// 2) 필수 축 존재 확인.
const missing = AXES.filter((a) => a.required && !existsSync(resolve(ROOT, a.path)));
for (const a of missing) failures.push(`필수 축 파일이 없다: ${a.path} (${a.label})`);

const present = AXES.filter((a) => existsSync(resolve(ROOT, a.path)));
const skipped = AXES.filter((a) => !a.required && !existsSync(resolve(ROOT, a.path)));

// 3) 스냅샷 축 실행. 캐시 디렉터리를 분리해 병렬 워크트리와 경합하지 않는다.
let snapshot = { code: 0, out: "" };
let axisExecution = [];
if (!failures.length) {
  const resultDir = mkdtempSync(resolve(tmpdir(), "db-surface-"));
  const resultFile = resolve(resultDir, "vitest.json");
  snapshot = run(
    "node",
    ["scripts/run-vitest.mjs", "run", "--configLoader", "bundle", ...present.map((a) => a.path), "--reporter=default", "--reporter=json", `--outputFile.json=${resultFile}`],
    { VITE_CACHE_DIR: process.env.VITE_CACHE_DIR ?? ".vite-cache/surface-gates" }
  );
  if (snapshot.code !== 0) failures.push(`표면 스냅샷 축 실패 (vitest exit=${snapshot.code})`);
  const results = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, "utf8")) : {};
  failures.push(...requiredAxisFailures(AXES.filter(axis => axis.required), results, ROOT));
  axisExecution = (results.testResults ?? []).map(file => ({
    path: relative(ROOT, file.name), status: file.status,
    assertions: (file.assertionResults ?? []).map(assertion => ({ name: assertion.fullName, status: assertion.status })),
  }));
  rmSync(resultDir, { recursive: true });
}

// 4) CSS 실사용 클래스 축. 표면 기준선의 classes 를 정본으로 읽으므로 위 축 뒤에 온다.
const cssLive = run("node", ["scripts/check-css-live-classes.mjs"]);
if (cssLive.code !== 0) failures.push(`check-css-live-classes.mjs exit=${cssLive.code}`);

const report = {
  name: "surface",
  exitCode: failures.length ? 1 : 0,
  axes: present.map((a) => a.path),
  skippedAxes: skipped.map((a) => a.path),
  axisExecution,
  snapshotExitCode: snapshot.code,
  cssLiveExitCode: cssLive.code,
  failures,
};

if (asJson) {
  console.log(JSON.stringify({ ...report, out: `${snapshot.out}${cssLive.out}` }, null, 2));
} else {
  console.log(`표면 게이트 축 ${present.length}개: ${present.map((a) => a.label).join(", ")}`);
  if (skipped.length) console.log(`  아직 없는 축(선택): ${skipped.map((a) => a.label).join(", ")}`);
  if (failures.length) {
    console.log("");
    console.log(snapshot.out.trimEnd());
    console.log(cssLive.out.trimEnd());
    console.log("");
    console.log(`표면 게이트 실패 ${failures.length}건:`);
    for (const line of failures) console.log(`   ${line}`);
  } else {
    console.log(cssLive.out.trimEnd());
    console.log(`표면 게이트 통과 (vitest exit=0, css-live exit=0)`);
  }
}

process.exit(report.exitCode);
