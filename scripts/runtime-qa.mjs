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
//   node scripts/runtime-qa.mjs --scenario checkpoints --checkpoint-set fallen-star --checkpoint all --parallel 2
//                                                        # 타이틀을 거치지 않고 단계마다 바로 시작(체크포인트)
//   … --checkpoint boss,ending                           # 고른 것만 / 접두사는 boss*
//   … --netns                                            # 루프백만 있는 네트워크 이름 공간에서(ERR_NETWORK_CHANGED 회피)
//   … --save-checkpoints                                 # captureCheckpoint op 이 뜬 실제 저장을 세트 파일에 넣는다
//   … --whole-game <project 폴더>                        # project.sqlite + assets/ 실물 게임을 컴파일된 출하 플레이어
//                                                        # (dist/export-player, wholeGamePlayer --serve)로 띄운다. 올린 그림도 나온다.
//                                                        # 먼저 `vite build --config vite.player.config.ts` 로 dist 를 만든다.
//
// 게이트가 실패하면 비영점으로 종료한다. 결과는 SUMMARY.md 를 **먼저** 읽어라.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md
import { chromium, firefox } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRuntimeQa, startPlayerQaServer } from "./lib/runtimeQaRun.mjs";
import { materializeGeneratedProject } from "./lib/qaProjectGenerator.mjs";
import {
  loadCheckpointSet,
  resolveOutRoot,
  runCheckpoints,
  saveCapturedCheckpoints,
  selectCheckpoints,
} from "./lib/runtimeQaCheckpoints.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

function parseArgs(argv) {
  const args = {
    scenario: "smoke", project: null, out: null, headed: false, browser: "chromium",
    checkpoint: null, checkpointSet: null, parallel: 2, saveCheckpoints: false, wholeGame: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--headed") args.headed = true;
    else if (arg === "--scenario") args.scenario = argv[++i];
    else if (arg === "--project") args.project = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--browser") args.browser = argv[++i];
    else if (arg === "--checkpoint") args.checkpoint = argv[++i];
    else if (arg === "--checkpoint-set") args.checkpointSet = argv[++i];
    else if (arg === "--parallel") args.parallel = Number(argv[++i]);
    else if (arg === "--save-checkpoints") args.saveCheckpoints = true;
    else if (arg === "--whole-game") args.wholeGame = argv[++i];
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (!["chromium", "firefox"].includes(args.browser)) throw new Error(`알 수 없는 브라우저: ${args.browser}`);
  // 부하 상한: 체크포인트 일꾼 하나가 브라우저 하나다. 기본 2, 최대 4.
  if (!Number.isInteger(args.parallel) || args.parallel < 1 || args.parallel > 4) throw new Error(`--parallel 은 1~4: ${args.parallel}`);
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

// --netns: 서버와 브라우저를 빈 네트워크 이름 공간(루프백만)에서 돌린다. 이 머신의 tailscale·docker 인터페이스가
// 크로미움에 «네트워크 바뀜» 을 계속 알려 vite 모듈 요청이 net::ERR_NETWORK_CHANGED 로 끊기는데, 런치 플래그로는
// 부하 중에 다 못 막는다(2026-10-21 실측). 바깥 네트워크가 필요한 시나리오에는 쓰지 마라.
if (process.argv.includes("--netns") && process.env.OPRN_QA_IN_NETNS !== "1") {
  const inner = process.argv.slice(1).filter((arg) => arg !== "--netns").map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(" ");
  const result = spawnSync("unshare", ["-rn", "bash", "-c", `ip link set lo up && exec ${JSON.stringify(process.execPath)} ${inner}`], {
    stdio: "inherit",
    env: { ...process.env, OPRN_QA_IN_NETNS: "1" },
  });
  process.exit(result.status ?? 1);
}
const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--netns"));
const scenario = await loadScenario(args.scenario);
// --project 는 픽스처를 갈아끼운다. 시나리오의 기대 좌표/맵은 그 프로젝트에 맞아야 한다.
let effective = args.project ? { ...scenario, projectFixture: args.project } : scenario;
// 생성기 게임(kind: generator)은 커밋된 픽스처가 없다(실측 72MB) — 시나리오가 `projectGenerator` 를
// 들고 있으면 실행 시점에 제품과 같은 코드 경로로 만든다. 그래야 시나리오가 어느 기계에서도 돈다.
if (!effective.projectFixture && effective.projectGenerator) {
  effective = { ...effective, projectFixture: await materializeGeneratedProject(effective.projectGenerator.game) };
}

const browserType = args.browser === "firefox" ? firefox : chromium;
const launchBrowser = () => browserType.launch({
  headless: !args.headed,
  // 뒤 두 플래그: 이 머신의 tailscale·docker 인터페이스 때문에 크로미움이 «네트워크 바뀜» 으로 vite 모듈 요청을
  // 통째로 끊는다(net::ERR_NETWORK_CHANGED → 백지·훅 없음). 산발적이라 긴 실행이 «부하로 죽은» 것처럼 보인다.
  args: args.browser === "chromium"
    ? ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"]
    : [],
});

const checkpointSetName = args.checkpointSet ?? (args.checkpoint ? scenario.checkpointSet ?? null : null);
if (args.checkpoint || args.checkpointSet) {
  if (!checkpointSetName) throw new Error(`시나리오 ${scenario.id} 에 checkpointSet 이 없다 — --checkpoint-set <세트> 를 줘라`);
  const set = await loadCheckpointSet(checkpointSetName);
  // 생성기 게임의 부팅 재료는 시나리오뿐 아니라 **세트**에도 실린다(to-scenario 가 둘 다 쓴다).
  // 여기서 먼저 물질화해야 한다 — 체크포인트마다 scenarioForCheckpoint 가 projectFixture 를 보고
  // 부팅하고, 없으면 기본 픽스처로 떨어진다(그러면 «없는 맵» 으로 죽는다).
  const generatedFrom = effective.projectGenerator ?? set.projectGenerator;
  if (!effective.projectFixture && generatedFrom) {
    effective = { ...effective, projectFixture: await materializeGeneratedProject(generatedFrom.game) };
  }
  const checkpoints = selectCheckpoints(set, args.checkpoint ?? "all");
  const outRoot = resolveOutRoot(args.out, scenario.id);
  // --whole-game: 체크포인트도 SQLite 실물 게임(출하 플레이어)으로 부팅한다 — 빠지면 기본 픽스처로 떨어져 «없는 맵» 으로 죽었다.
  const server = args.wholeGame ? await startWholeGameServer(args.wholeGame) : await startPlayerQaServer();
  if (args.wholeGame) effective = { ...effective, projectFixture: server.projectFixture };
  let results;
  try {
    console.log(JSON.stringify({ qaBrowser: args.browser, qaPort: server.port, checkpointSet: set.set, checkpoints: checkpoints.map((c) => c.id), parallel: args.parallel }));
    results = await runCheckpoints({ scenario: effective, set, checkpoints, parallel: args.parallel, launchBrowser, serverUrl: server.url, ...(server.projectUrl ? { projectUrl: server.projectUrl } : {}), outRoot });
  } finally {
    await server.close();
    console.log(JSON.stringify({ qaCleanup: "browsers and server closed", qaPort: server.port }));
  }
  if (args.saveCheckpoints) {
    const saved = await saveCapturedCheckpoints(checkpointSetName, results.flatMap((r) => r.capturedCheckpoints));
    console.log(`체크포인트 저장: ${saved}개 → scripts/qa/runtime/checkpoints/${checkpointSetName}.json`);
  }
  const failedCheckpoints = results.filter((r) => !r.ok);
  console.log(`\n리포트: ${outRoot}/SUMMARY.md  ← 먼저 읽어라`);
  console.log(`게이트: ${failedCheckpoints.length === 0 ? "통과" : "실패"} (${results.length - failedCheckpoints.length}/${results.length})`);
  for (const r of failedCheckpoints) console.log(`  실패 ${r.id}: ${r.failures.slice(0, 3).join(" / ")}`);
  process.exit(failedCheckpoints.length > 0 ? 1 : 0);
}

/** SQLite 실물 게임을 wholeGamePlayer --serve 로 띄운다 — 제품 prepareWebExport + dist/export-player + 올린 그림(SHA 확인). */
async function startWholeGameServer(projectDir) {
  const serveOut = mkdtempSync(join(tmpdir(), "runtime-qa-whole-"));
  const child = spawn(process.execPath, [join(REPO_ROOT, "src/harnesses/assistant-capability/node/wholeGamePlayer.mjs"), "--project-dir", resolve(projectDir), "--out", serveOut, "--serve"], { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "inherit"] });
  const served = await new Promise((done, fail) => {
    let buffer = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); fail(new Error("wholeGamePlayer --serve 가 10분 안에 뜨지 않았다")); }, 600_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const line = buffer.split("\n").find((row) => row.startsWith("{"));
      if (!line) return;
      try { const parsed = JSON.parse(line); clearTimeout(timer); done(parsed); } catch { /* 줄이 덜 왔다 */ }
    });
    child.on("exit", (code) => { clearTimeout(timer); fail(new Error(`wholeGamePlayer 종료 ${code}`)); });
  });
  const url = new URL(served.playUrl);
  return {
    url: url.origin,
    port: Number(url.port),
    projectUrl: served.boot.projectUrl,
    projectFixture: join(serveOut, "player.json"),
    close: async () => { child.kill("SIGTERM"); },
  };
}

const server = args.wholeGame ? await startWholeGameServer(args.wholeGame) : await startPlayerQaServer();
if (args.wholeGame) effective = { ...effective, projectFixture: server.projectFixture };
let browser;
let report;
try {
  browser = await launchBrowser();
  console.log(JSON.stringify({ qaBrowser: args.browser, qaPort: server.port }));
  // QA_RECORD_VIDEO=<폴더> — 움직임 증거용 영상(webm). 크기는 시나리오 viewport. 꺼 두면 예전과 같다.
  const videoDir = process.env.QA_RECORD_VIDEO;
  const context = videoDir
    ? await browser.newContext({ viewport: effective.viewport, recordVideo: { dir: resolve(REPO_ROOT, videoDir), size: effective.viewport } })
    : undefined;
  const page = context ? await context.newPage() : await browser.newPage();
  report = await runRuntimeQa(page, effective, {
    serverUrl: server.url,
    ...(server.projectUrl ? { projectUrl: server.projectUrl } : {}),
    // resolve: 절대 경로(--out /tmp/...)는 그대로 쓴다. join 은 저장소 안 tmp/... 로 바꿔 버린다.
    outDir: args.out ? resolve(REPO_ROOT, args.out) : undefined,
  });
} finally {
  try {
    // 영상은 컨텍스트를 닫아야 파일로 끝난다.
    for (const ctx of browser?.contexts() ?? []) await ctx.close().catch(() => undefined);
    await browser?.close();
  } finally {
    await server.close();
    console.log(JSON.stringify({ qaCleanup: "browser and server closed", qaPort: server.port }));
  }
}

if (args.saveCheckpoints && report.capturedCheckpoints?.length) {
  const setName = scenario.checkpointSet ?? scenario.id;
  const saved = await saveCapturedCheckpoints(setName, report.capturedCheckpoints);
  console.log(`체크포인트 저장: ${saved}개 → scripts/qa/runtime/checkpoints/${setName}.json`);
}
const failed = report.beats.filter((beat) => beat.failures.length > 0);
const outDir = args.out ?? `verify-shots/runtime-qa/${report.scenarioId}`;
console.log(`\n리포트: ${outDir}/SUMMARY.md  ← 먼저 읽어라`);
console.log(`게이트: ${failed.length === 0 && report.errors.length === 0 ? "통과" : "실패"}`);
for (const beat of failed) console.log(`  실패 ${beat.id}: ${beat.failures.join(", ")}`);
for (const error of report.errors) console.log(`  에러 ${error}`);

process.exit(failed.length > 0 || report.errors.length > 0 ? 1 : 0);
