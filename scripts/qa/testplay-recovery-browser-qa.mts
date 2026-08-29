// 테스트 플레이 회복력 실브라우저 QA.
//
// 왜 이 스크립트가 따로 있는가: `scripts/runtime-qa.mjs` 는 **출하 플레이어**(player.html)를
// 검증한다. 여기서 고치는 결함은 **편집기의 «테스트 플레이»** 경로에 있으므로, 편집기 셸을
// 실제로 띄우고 톱바의 테스트 버튼을 눌러야 한다. 두 하네스는 대상이 다르다.
//
// 판정 규칙 (AGENTS.md 의 "어떻게든 테스트 플레이는 가능해야 한다" 를 그대로 옮긴 것):
//   - 정상 프로젝트: 플레이 화면이 실제로 그려져야 한다(캔버스 색 다양성 > 1) AND
//     복구 패널이 없어야 한다.
//   - 망가진 프로젝트: **그려지거나(수리 성공) 복구 패널이 뜨거나(정직한 실패)** 둘 중 하나.
//     빈 화면 / 멈춤 / 미포착 pageerror 는 실패다 — 이것이 고치려는 결함 그 자체다.
//
// 사용:
//   npx vite-node --script scripts/qa/testplay-recovery-browser-qa.mts -- --port 9852
//
// 시드 계약: src/editor/devShowcaseProjects.ts:95 createE2eProjectForLocation 이
// window.__RPG_ZZU_E2E_PROJECT__ 를 structuredClone 한다. isE2eProject 는 version/maps/
// startMapId/database 를 요구하므로 **역직렬화된 Project** 를 넣어야 한다.
import { chromium, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 콜드 dev 서버 + 포화된 공유 머신을 견디는 예산. 환경변수로 올릴 수 있다. */
const NAV_TIMEOUT_MS = Number(process.env.QA_NAV_TIMEOUT_MS ?? 240_000);
const BOOT_TIMEOUT_MS = Number(process.env.QA_BOOT_TIMEOUT_MS ?? 240_000);
/** 부팅이 ready / recovery / 실패 중 하나로 정량하기를 기다리는 상한. */
const SETTLE_TIMEOUT_MS = Number(process.env.QA_SETTLE_TIMEOUT_MS ?? 120_000);

function parseArgs(argv: readonly string[]): { port: string; outDir: string } {
  let port = "9852";
  let outDir = "verify-shots/testplay-resilient";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") port = argv[++i] ?? port;
    else if (argv[i] === "--out") outDir = argv[++i] ?? outDir;
  }
  return { port, outDir };
}

type CaseResult = {
  readonly name: string;
  readonly verdict: "PASS" | "FAIL";
  readonly outcome: string;
  readonly distinctColors: number;
  readonly recoveryPanel: boolean;
  readonly recoveryReason: string;
  readonly pageErrors: readonly string[];
  readonly consoleErrors: readonly string[];
  readonly shot: string;
};

/** 정상 프로젝트: 런타임 QA smoke 가 사용하는 **실제로 녹다고 입증된** 픽스처를 쓴다.
 *  battle-v3.json 은 상자 배경이 거의 검은 전통 픽스처라 "그려졌는가" 판정에 부적사하다. */
async function validProject(): Promise<Project> {
  const raw = await readFile(join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json"), "utf8");
  return deserialize(raw);
}

/**
 * 망가진 프로젝트: 목표에 적힌 변수를 **한꺼번에** 건다 — 없는 시작 맵 + 빈 파티 +
 * 경계 밖 시작 좌표 + 없는 타일셋 id. 하나만 걸면 다른 경로가 우연히 구제할 수 있다.
 */
async function brokenProject(): Promise<Project> {
  const project = await validProject();
  project.startMapId = "map-does-not-exist-" + Date.now();
  project.startPos = { x: 9999, y: 9999 };
  project.session = { ...project.session, partyActorIds: [] };
  const firstMapId = Object.keys(project.maps)[0];
  if (firstMapId) project.maps[firstMapId]!.tilesetId = "tileset-does-not-exist";
  return project;
}

/**
 * 색 다양성은 **스톰샷 PNG** 에서 재다. 살아 있는 WebGL 추상화 버툴은 표시 후
 * `drawImage` 로 다시 읽으면 밍 번다 — preserveDrawingBuffer 가 없으면 정상 동작이다.
 * 실제로 이 함정에 한 번 밟혔다: 명함하게 플레이 중이었는 화면이 distinct=1 로 재혔다.
 * 레토의 기존 QA(`scripts/lib/runtimeQaRun.mjs:435`)도 pngjs 로 PNG 를 읽는다 — 그 방식을 따른다.
 */
function distinctColorsFromPng(buffer: Buffer): number {
  const png = PNG.sync.read(buffer);
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4) {
    seen.add((png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!);
  }
  return seen.size;
}

type BootOutcome = "ready" | "recovery" | "boot-failed" | "stuck";

/**
 * 부팅 종리를 **제품 자신의 상태 변화**로 기다린다. sleep 은 없다.
 * playBootDiagnostics.ts 가 window.__oprnPlayBootLog 를 심으므로 그것을 관심한다.
 * 주의: PlayScene.create 안에서 던진 예상은 Phaser 내부에서 삼키므로 진단 항목이
 * 아에 생기지 않는다 — 그래서 pageerror 도 종리 신호로 함메 넣는다.
 */
async function waitForBootOutcome(page: Page, sawPageError: () => boolean): Promise<BootOutcome> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  const probe = await page.waitForFunction(() => {
    if (document.querySelector("[data-testid='play-recovery-panel']")) return "recovery";
    const reader = (window as unknown as { __oprnPlayBootLog?: () => readonly { stage: string; ok: boolean }[] }).__oprnPlayBootLog;
    const log = typeof reader === "function" ? reader() : [];
    if (log.some((entry) => entry.stage === "ready" && entry.ok)) return "ready";
    if (log.some((entry) => !entry.ok && (entry.stage === "error" || entry.stage === "timeout"))) return "boot-failed";
    return false;
  }, undefined, { timeout: Math.max(1_000, deadline - Date.now()) }).catch(() => null);

  if (probe) return (await probe.jsonValue()) as BootOutcome;
  return sawPageError() ? "boot-failed" : "stuck";
}

async function runCase(
  page: Page,
  name: string,
  project: Project,
  baseUrl: string,
  outDir: string,
  expectPlayable: boolean,
): Promise<CaseResult> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.addInitScript((seed) => {
    (window as unknown as { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__ = seed;
    const uiMode = window.localStorage.getItem("oprn:editor-ui-mode");
    window.localStorage.clear();
    if (uiMode !== null) window.localStorage.setItem("oprn:editor-ui-mode", uiMode);
  }, project as unknown);

  // 콜드 vite dev 는 첫 브라우저 방문에서 TS 모듈 그래프 전체를 변환한다. 공유 머신이
  // 포화 상태면 30초 기본값으로는 어림도 없다 — 실측으로 30000ms 초과가 났다.
  // "commit" 으로 네비게이션만 확인하고, 실제 준비 판정은 edit-canvas 로 한다.
  await page.goto(baseUrl, { waitUntil: "commit", timeout: NAV_TIMEOUT_MS });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: BOOT_TIMEOUT_MS });

  // 톱바 테스트 버튼. menu.ts:641 dataset.testid = "mode-play".
  await page.getByTestId("mode-play").click();

  // 대기는 sleep 이 아니라 **제품의 부팅 상태 변화**를 기다린다.
  const outcome = await waitForBootOutcome(page, () => pageErrors.length > 0);

  await mkdir(join(REPO_ROOT, outDir), { recursive: true });
  const shot = join(outDir, `${name}.png`);
  const shotPath = join(REPO_ROOT, shot);
  await page.screenshot({ path: shotPath, fullPage: false });

  const recoveryPanel = await page.locator("[data-testid='play-recovery-panel']").count() > 0;
  const recoveryReason = recoveryPanel
    ? (await page.locator("[data-testid='play-recovery-reason']").first().textContent().catch(() => "")) ?? ""
    : "";
  const distinctColors = distinctColorsFromPng(await readFile(shotPath));

  // "놀 수 있다" 는 제품의 ready 신호로 정하고, 화소 수는 보조 근거로만 실는다.
  // 화소만으로 판정하면 검은 배경 맵이 오판된다(실제로 battle 픽스처에서 겪었다).
  const playable = outcome === "ready";
  let verdict: "PASS" | "FAIL";
  let outcomeText: string;
  if (expectPlayable) {
    verdict = playable && !recoveryPanel ? "PASS" : "FAIL";
    outcomeText = playable
      ? (recoveryPanel ? "부팅은 됐는데 복구 패널도 뜼다(정상 프로젝트에서는 실패)" : "툴레이 화면이 ready 까지 도달했다")
      : `정상 프로젝트인데 ready 에 도달하지 모했다 (outcome=${outcome})`;
  } else if (playable) {
    verdict = "PASS";
    outcomeText = "예미검사가 수리해서 그대로 플레이됅다";
  } else if (recoveryPanel && recoveryReason.trim().length > 0) {
    verdict = "PASS";
    outcomeText = "복구 패널이 사유와 함게 뜼다 — 정직한 실패";
  } else if (recoveryPanel) {
    verdict = "FAIL";
    outcomeText = "복구 패널은 뜼지만 사유가 버어 있다";
  } else {
    verdict = "FAIL";
    outcomeText = outcome === "stuck"
      ? "마다른 길: 로드 오버레이에서 진행도 중단도 없이 얼어붙었다(복구 패널 없음)"
      : `마다른 길: 부팅이 실패했는다 복구 패널이 없다 (outcome=${outcome})`;
  }

  return {
    name, verdict, outcome: outcomeText, distinctColors, recoveryPanel,
    recoveryReason: recoveryReason.trim().slice(0, 300),
    pageErrors: [...pageErrors], consoleErrors: [...consoleErrors], shot,
  };
}

const { port, outDir } = parseArgs(process.argv.slice(2));
const baseUrl = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const results: CaseResult[] = [];
try {
  // 워밍업: 측정 대상 케이스가 콜드 변환 비용을 뒤집어쓰지 않게 먼저 한 번 방문한다.
  // 이 방문의 성패는 판정에 넣지 않는다 — 오직 vite 의 모듈 그래프를 데우는 목적이다.
  {
    const warmContext = await browser.newContext();
    const warmPage = await warmContext.newPage();
    try {
      await warmPage.goto(baseUrl, { waitUntil: "commit", timeout: NAV_TIMEOUT_MS });
      await warmPage.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: BOOT_TIMEOUT_MS });
      process.stdout.write("WARMUP=ok\n");
    } catch (error) {
      process.stdout.write(`WARMUP=failed ${error instanceof Error ? error.message.slice(0, 200) : String(error)}\n`);
    } finally {
      await warmContext.close();
    }
  }
  for (const [name, project, expectPlayable] of [
    ["valid-project", await validProject(), true],
    ["broken-project", await brokenProject(), false],
  ] as const) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    try {
      results.push(await runCase(page, name, project, baseUrl, outDir, expectPlayable));
    } catch (error) {
      results.push({
        name, verdict: "FAIL",
        outcome: `케이스가 예외로 끝났다: ${error instanceof Error ? error.message : String(error)}`,
        distinctColors: 0, recoveryPanel: false, recoveryReason: "",
        pageErrors: [], consoleErrors: [], shot: "",
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const lines = [
  "# 테스트 플레이 회복력 실브라우저 QA",
  "",
  `- 대상: ${baseUrl} (편집기 셸, 톱바 mode-play)`,
  `- 시각: ${new Date().toISOString()}`,
  "",
  "| 케이스 | 판정 | 결과 | 캔버스 색 | 복구 패널 | pageerror | console.error |",
  "|---|---|---|---|---|---|---|",
  ...results.map((r) =>
    `| ${r.name} | **${r.verdict}** | ${r.outcome} | ${r.distinctColors} | ${r.recoveryPanel ? "있음" : "없음"} | ${r.pageErrors.length} | ${r.consoleErrors.length} |`),
  "",
];
for (const r of results) {
  lines.push(`## ${r.name} — ${r.verdict}`, "");
  lines.push(`- 결과: ${r.outcome}`);
  lines.push(`- 캔버스 distinct color: ${r.distinctColors}`);
  if (r.recoveryReason) lines.push(`- 복구 사유 문구: \`${r.recoveryReason}\``);
  if (r.shot) lines.push(`- 스크린샷: \`${r.shot}\``);
  if (r.pageErrors.length) lines.push(`- pageerror:`, ...r.pageErrors.slice(0, 5).map((e) => `  - \`${e.slice(0, 300)}\``));
  if (r.consoleErrors.length) lines.push(`- console.error:`, ...r.consoleErrors.slice(0, 8).map((e) => `  - \`${e.slice(0, 300)}\``));
  lines.push("");
}
await mkdir(join(REPO_ROOT, outDir), { recursive: true });
await writeFile(join(REPO_ROOT, outDir, "SUMMARY.md"), lines.join("\n"), "utf8");
process.stdout.write(lines.join("\n") + "\n");

const failed = results.filter((r) => r.verdict === "FAIL");
process.stdout.write(failed.length === 0 ? "QA_VERDICT=PASS\n" : `QA_VERDICT=FAIL(${failed.map((r) => r.name).join(",")})\n`);
process.exit(failed.length === 0 ? 0 : 1);
