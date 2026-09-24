// 런타임(내보내기 플레이어) 전용 비전 QA — 반복 작업용 CLI.
//
// 에디터 셸을 태우지 않는다. player.html 을 전용 vite 서버로 띄우므로 스크린샷에
// 톱바/사이드바가 섞이지 않고, shim alias 를 그대로 통과해 **출하 경로**를 검증한다.
//
// 사용:
//   node scripts/runtime-qa.mjs                          # smoke 시나리오
//   node scripts/runtime-qa.mjs --scenario smoke
//   node scripts/runtime-qa.mjs --project path/to/project.json
//   node scripts/runtime-qa.mjs --headed                 # 눈으로 보며 반복
//
// 게이트가 실패하면 비영점으로 종료한다. 결과는 SUMMARY.md 를 **먼저** 읽어라.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md
import { chromium, firefox } from "@playwright/test";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRuntimeQa, startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const args = { scenario: "smoke", project: null, out: null, headed: false, browser: "chromium" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--headed") args.headed = true;
    else if (arg === "--scenario") args.scenario = argv[++i];
    else if (arg === "--project") args.project = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--browser") args.browser = argv[++i];
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (!["chromium", "firefox"].includes(args.browser)) throw new Error(`알 수 없는 브라우저: ${args.browser}`);
  return args;
}

async function loadScenario(name) {
  const path = join(REPO_ROOT, "scripts/qa/runtime", `${name}.scenario.mjs`);
  const module = await import(pathToFileURL(path).href);
  const scenario =
    module.default ?? Object.values(module).find((value) => value && Array.isArray(value.beats));
  if (!scenario) throw new Error(`${path} 에서 시나리오를 찾지 못했다(beats 배열 필요)`);
  return scenario;
}

const args = parseArgs(process.argv.slice(2));
const scenario = await loadScenario(args.scenario);
// --project 는 픽스처를 갈아끼운다. 시나리오의 기대 좌표/맵은 그 프로젝트에 맞아야 한다.
const effective = args.project ? { ...scenario, projectFixture: args.project } : scenario;

const server = await startPlayerQaServer();
let browser;
let report;
try {
  const browserType = args.browser === "firefox" ? firefox : chromium;
  browser = await browserType.launch({
    headless: !args.headed,
    args: args.browser === "chromium" ? ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] : [],
  });
  console.log(JSON.stringify({ qaBrowser: args.browser, qaPort: server.port }));
  const page = await browser.newPage();
  report = await runRuntimeQa(page, effective, {
    serverUrl: server.url,
    // resolve: 절대 경로(--out /tmp/...)는 그대로 쓴다. join 은 저장소 안 tmp/... 로 바꿔 버린다.
    outDir: args.out ? resolve(REPO_ROOT, args.out) : undefined,
  });
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
    console.log(JSON.stringify({ qaCleanup: "browser and server closed", qaPort: server.port }));
  }
}

const failed = report.beats.filter((beat) => beat.failures.length > 0);
const outDir = args.out ?? `verify-shots/runtime-qa/${report.scenarioId}`;
console.log(`\n리포트: ${outDir}/SUMMARY.md  ← 먼저 읽어라`);
console.log(`게이트: ${failed.length === 0 && report.errors.length === 0 ? "통과" : "실패"}`);
for (const beat of failed) console.log(`  실패 ${beat.id}: ${beat.failures.join(", ")}`);
for (const error of report.errors) console.log(`  에러 ${error}`);

process.exit(failed.length > 0 || report.errors.length > 0 ? 1 : 0);
