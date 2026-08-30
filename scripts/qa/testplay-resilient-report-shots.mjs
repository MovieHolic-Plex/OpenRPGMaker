#!/usr/bin/env node
// 보고서용 증거 촬영 — 테스트 플레이 복원력 5장면을 실제 크로미움으로 찍는다.
//
// `testplay-resilient-browser-qa.mjs` 는 게이트(통과/실패)다. 이 스크립트는 **보고서에 실을
// 그림**을 찍는다: 정상 · 자동복구 · 막힘 · 에셋 실패 · 복구 패널 전체 모습.
// 선택자·부팅 경로는 게이트와 같다(?blankProject=1 → edit-canvas → mode-play → test-play-window).
//
// 사용: node scripts/qa/testplay-resilient-report-shots.mjs [--base-url http://127.0.0.1:9842] [--out <dir>]

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE_URL = argValue("--base-url", process.env.QA_BASE_URL ?? "http://127.0.0.1:9842");
const OUT_DIR = argValue("--out", "verify-shots/testplay-resilient-report");
const BOOT_TIMEOUT = 120_000;

mkdirSync(OUT_DIR, { recursive: true });

/** 캔버스 샷의 서로 다른 색 종수. 압축 잡음이 아니라 실제 그림을 세려고 6비트로 양자화한다. */
function distinctColors(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const seen = new Set();
  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] === 0) continue;
    seen.add(((png.data[index] >> 2) << 12) | ((png.data[index + 1] >> 2) << 6) | (png.data[index + 2] >> 2));
  }
  return { distinct: seen.size, width: png.width, height: png.height };
}

async function openEditor(page) {
  page.setDefaultNavigationTimeout(BOOT_TIMEOUT);
  page.setDefaultTimeout(BOOT_TIMEOUT);
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto(`${BASE_URL}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"] canvas').first().waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
  await page.locator('[data-testid="mode-play"]').waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
}

async function triggerTestPlayAndSettle(page, { earlyToast = false, label = "" } = {}) {
  await page.locator('[data-testid="mode-play"]').click();
  await page.locator('[data-testid="test-play-window"]').waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
  // 자동복구 토스트는 info 라 2초 뒤 show 를 잃는다 → 뜨는 즉시 찍어야 그림에 남는다.
  if (earlyToast) {
    try {
      await page.locator('[data-testid="toast"].show').first().waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
      // info 토스트는 2초 뒤 스스로 사라진다. opacity 전환이 끝나길 폴링으로 기다리면 그 사이에 타이머가
      // 먼저 끝나 «토스트 없는 스크린샷»이 남는다(실측: 로딩 4/에셋 단계 그림만 찍혔다).
      // 그래서 기다리지 않고 촬영용으로 불투명도를 못박은 뒤 곧바로 찍는다 — 텍스트·위치는 실물 그대로다.
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('[data-testid="toast"]')) {
          if (!(node instanceof HTMLElement)) continue;
          node.style.setProperty("opacity", "1", "important");
          node.style.setProperty("transform", "none", "important");
          node.style.setProperty("transition", "none", "important");
        }
      });
      writeFileSync(`${OUT_DIR}/${label}-toast-live.png`, await page.screenshot());
      writeFileSync(`${OUT_DIR}/${label}-toast.png`, await page.locator('[data-testid="toast-stack"]').first().screenshot());
    } catch {
      /* 토스트를 놓쳐도 본 검증은 계속한다 — 결말 판정이 본체다. */
    }
  }
  const outcome = await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-testid="play-recovery-panel"]');
      if (panel instanceof HTMLElement && panel.offsetParent !== null) return "recovery";
      if (document.querySelector('[data-testid="runtime-state-json"]')) return "playing";
      return null;
    },
    undefined,
    { timeout: BOOT_TIMEOUT },
  );
  return await outcome.jsonValue();
}

/** 인페이지에서 로드된 프로젝트를 못 놀 상태로 바꾼다. 실제 편집기 store 를 지난다. */
async function breakProject(page, mode) {
  return await page.evaluate(async (breakMode) => {
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    store.update((draft) => {
      if (breakMode === "no-maps") {
        draft.maps = {};
        return;
      }
      draft.startMapId = "map_does_not_exist_zzu";
      draft.session = { ...draft.session, partyActorIds: [] };
    });
    const after = store.getCurrent();
    return { mode: breakMode, startMapId: after.startMapId, mapCount: Object.keys(after.maps ?? {}).length };
  }, mode);
}

/** 부팅 진단에 남은 에셋 실패 줄을 읽는다 — 자리표시자를 깐 근거다. */
async function readAssetFailures(page) {
  return await page.evaluate(async () => {
    const module = await import(/* @vite-ignore */ "/src/player/playBootDiagnostics.ts");
    return module
      .listRecentPlayBootDiagnostics()
      .filter((entry) => entry.stage === "assets" && entry.ok === false)
      .map((entry) => entry.detail ?? "");
  });
}

async function shootElement(page, selector, label) {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0 || !(await target.isVisible())) return null;
  const path = `${OUT_DIR}/${label}.png`;
  writeFileSync(path, await target.screenshot());
  return path;
}

async function inspect(page, label) {
  const shots = {};
  const recovery = page.locator('[data-testid="play-recovery-panel"]');
  const recoveryVisible = (await recovery.count()) > 0 && (await recovery.first().isVisible());
  const recoveryReason = recoveryVisible
    ? ((await page.locator('[data-testid="play-recovery-reason"]').first().textContent()) ?? "").trim()
    : "";
  let canvasStats = null;
  const canvas = page.locator('[data-testid="test-play-window"] canvas').first();
  if ((await canvas.count()) > 0 && (await canvas.isVisible())) {
    const shot = await canvas.screenshot();
    const path = `${OUT_DIR}/${label}-canvas.png`;
    writeFileSync(path, shot);
    canvasStats = { ...distinctColors(shot), path };
    shots.canvas = path;
  }
  if (recoveryVisible) shots.panel = await shootElement(page, '[data-testid="play-recovery-panel"]', `${label}-panel`);
  const toastText = (
    await page.locator('[data-testid="toast-stack"] .toast-message').allTextContents()
  ).map((text) => text.trim());
  const windowPath = `${OUT_DIR}/${label}-window.png`;
  await page.screenshot({ path: windowPath });
  shots.window = windowPath;
  return { recoveryVisible, recoveryReason, canvasStats, toastText, shots };
}

async function runCase(browser, { label, breakMode, blockAssets, injectPanel, earlyToast }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack ?? error).slice(0, 300)));
  const result = { label, breakMode: breakMode ?? null, blockAssets: blockAssets === true, error: null };
  try {
    if (blockAssets) {
      // 프로젝트가 가리키는 그림 파일이 사라진 상황을 그대로 만든다(캐시를 타지 않도록 처음부터 건다).
      await page.route(/\/assets\/.*\.png(\?.*)?$/, (route) => route.abort("failed"));
    }
    await openEditor(page);
    if (breakMode) result.mutation = await breakProject(page, breakMode);
    result.outcome = await triggerTestPlayAndSettle(page, { earlyToast: earlyToast === true, label });
    if (blockAssets) result.assetFailures = await readAssetFailures(page);
    if (injectPanel) result.injected = await injectRecoveryPanel(page);
    result.inspection = await inspect(page, label);
  } catch (error) {
    result.error = String(error?.message ?? error).slice(0, 400);
    try {
      result.inspection = await inspect(page, `${label}-failure`);
    } catch {
      /* 실패 위에 실패를 덮지 않는다. */
    }
  }
  result.pageErrors = pageErrors;
  await context.close();
  return result;
}

/**
 * 복구 패널의 «세 버튼 + 자동복구 목록» 전체 모습을 찍는다. 문맥(ready-timeout)과 복구 문구는
 * 실제 권위(describeBootFailure / preflightProjectForPlay)가 만든 값을 그대로 넣는다 —
 * 그림만 주입이고 문구는 주입이 아니다.
 */
async function injectRecoveryPanel(page) {
  return await page.evaluate(async () => {
    const [{ mountPlayLoadingOverlay }, recovery, { preflightProjectForPlay }, { store }] = await Promise.all([
      import(/* @vite-ignore */ "/src/player/playLoadingOverlay.ts"),
      import(/* @vite-ignore */ "/src/player/playBootRecovery.ts"),
      import(/* @vite-ignore */ "/src/project/playPreflight.ts"),
      import(/* @vite-ignore */ "/src/project/store.ts"),
    ]);
    const broken = structuredClone(store.getCurrent());
    broken.startMapId = "map_does_not_exist_zzu";
    broken.session = { ...broken.session, partyActorIds: [] };
    const preflight = preflightProjectForPlay(broken);
    const repairs = recovery.repairSummaries(preflight.repairs);
    const described = recovery.describeBootFailure({
      kind: "ready-timeout",
      readyReason: "timeout",
      mapId: preflight.project.startMapId,
      elapsedMs: 30_000,
      detail: "waitForPlaySceneReady",
    });
    const host = document.querySelector('[data-testid="test-play-window"]') ?? document.body;
    const overlay = mountPlayLoadingOverlay(host, "error");
    overlay.showRecovery({
      title: described.title,
      reason: described.reason,
      diagnostics: described.diagnostics,
      repairs,
      onRetry: () => undefined,
      onSafeMode: () => undefined,
    });
    return { title: described.title, reason: described.reason, repairs };
  });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const allCases = [
  { label: "a-valid" },
  { label: "b-repaired", breakMode: "start-map-and-party", earlyToast: true },
  { label: "c-no-maps", breakMode: "no-maps" },
  { label: "d-assets-blocked", blockAssets: true },
  { label: "e-recovery-panel", injectPanel: true },
];
// --cases b-repaired 처럼 일부만 다시 찍는다(한 장면을 고칠 때 전체 10분을 다시 쓰지 않는다).
const only = (argValue("--cases", "") || "").split(",").map((name) => name.trim()).filter(Boolean);
const cases = only.length > 0 ? allCases.filter((entry) => only.includes(entry.label)) : allCases;
const results = [];
for (const testCase of cases) {
  const result = await runCase(browser, testCase);
  results.push(result);
  console.log(
    `== ${result.label}: 결말 ${result.outcome ?? "(없음)"} / 복구패널 ${result.inspection?.recoveryVisible ? "보임" : "없음"} / ` +
      `캔버스 색 ${result.inspection?.canvasStats?.distinct ?? "-"}종 / pageerror ${result.pageErrors.length}건${result.error ? ` / 예외 ${result.error}` : ""}`,
  );
  if (result.assetFailures) console.log(`   에셋 실패 ${result.assetFailures.length}건: ${result.assetFailures.slice(0, 3).join(" | ")}`);
  if (result.inspection?.toastText?.length) console.log(`   토스트: ${result.inspection.toastText.join(" | ")}`);
  if (result.inspection?.recoveryReason) console.log(`   이유: ${result.inspection.recoveryReason}`);
}
await browser.close();
const reportPath = only.length > 0 ? `${OUT_DIR}/report.${only.join("+")}.json` : `${OUT_DIR}/report.json`;
writeFileSync(reportPath, `${JSON.stringify({ baseUrl: BASE_URL, results }, null, 2)}\n`);
console.log(`\n증거: ${OUT_DIR}/report.json`);
