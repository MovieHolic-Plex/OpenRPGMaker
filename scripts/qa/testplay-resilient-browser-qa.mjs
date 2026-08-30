#!/usr/bin/env node
// 테스트 플레이 복원력 브라우저 검증 — 실제 크로미움으로 «항상 시작된다» 를 증명한다.
//
// 왜 하네스가 따로 필요한가: `scripts/runtime-qa.mjs` 는 출하 플레이어(player.html)만 본다.
// 이 변경의 표면은 **편집기 테스트 플레이 창**이므로 편집기 셸을 지나야 하고,
// 깨진 프로젝트를 만들려면 인페이지에서 `@/project/store` 를 직접 흔들어야 한다.
// 선택자는 기존 e2e(`test/e2e/testplay-runtime-instrument.spec.ts`)와 같은 경로를 쓴다:
//   ?blankProject=1 → edit-canvas 캔버스 → mode-play → test-play-window.
//
// 판정:
//   (a) 정상 프로젝트  → 놀 수 있는 프레임(캔버스 색 2종 이상) + 복구 패널 부재
//   (b) 깨진 프로젝트  → 놀 수 있는 프레임 **또는** 이유 문구가 채워진 복구 패널
// 빈 화면 · 멈춤 · 잡히지 않은 pageerror 는 실패다.
//
// 사용: node scripts/qa/testplay-resilient-browser-qa.mjs [--base-url http://127.0.0.1:9842] [--out <dir>]

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE_URL = argValue("--base-url", process.env.QA_BASE_URL ?? "http://127.0.0.1:9842");
const OUT_DIR = argValue("--out", "verify-shots/testplay-resilient");
const BOOT_TIMEOUT = 120_000;

mkdirSync(OUT_DIR, { recursive: true });

/** 캔버스 샷의 서로 다른 색 종수. 미세한 압축 잡음이 아니라 실제 그림을 세려고 6비트로 양자화한다. */
function distinctColors(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const seen = new Set();
  for (let index = 0; index < png.data.length; index += 4) {
    const alpha = png.data[index + 3];
    if (alpha === 0) continue;
    const r = png.data[index] >> 2;
    const g = png.data[index + 1] >> 2;
    const b = png.data[index + 2] >> 2;
    seen.add((r << 12) | (g << 6) | b);
  }
  return { distinct: seen.size, width: png.width, height: png.height };
}

/** 페이지 오류·콘솔 오류를 남김없이 모은다. 워크트리의 Supabase 프록시 거부는 런타임 결함이 아니다. */
function attachDiagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack ?? error).slice(0, 400)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push(message.text().slice(0, 400));
  });
  return { pageErrors, consoleErrors };
}

async function openEditor(page) {
  // 첫 네비게이션은 vite 가 의존성을 변환하는 동안 기본 30초를 넘긴다(부하 높은 호스트에서 실측).
  page.setDefaultNavigationTimeout(BOOT_TIMEOUT);
  page.setDefaultTimeout(BOOT_TIMEOUT);
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await page.goto(`${BASE_URL}/?blankProject=1`, { waitUntil: "domcontentloaded" });
  await page
    .locator('[data-testid="edit-canvas"] canvas')
    .first()
    .waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
  await page.locator('[data-testid="mode-play"]').waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
}

/** 테스트 플레이를 누르고 «놀 수 있는 프레임» 또는 «복구 패널» 중 먼저 오는 결말을 기다린다(고정 sleep 금지). */
async function triggerTestPlayAndSettle(page) {
  await page.locator('[data-testid="mode-play"]').click();
  await page.locator('[data-testid="test-play-window"]').waitFor({ state: "visible", timeout: BOOT_TIMEOUT });
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

async function inspect(page, label) {
  const recovery = page.locator('[data-testid="play-recovery-panel"]');
  const recoveryVisible = (await recovery.count()) > 0 && (await recovery.first().isVisible());
  const recoveryReason = recoveryVisible
    ? ((await page.locator('[data-testid="play-recovery-reason"]').first().textContent()) ?? "").trim()
    : "";
  const canvas = page.locator('[data-testid="test-play-window"] canvas').first();
  let canvasStats = null;
  if ((await canvas.count()) > 0 && (await canvas.isVisible())) {
    const shot = await canvas.screenshot();
    const canvasPath = `${OUT_DIR}/${label}-canvas.png`;
    writeFileSync(canvasPath, shot);
    canvasStats = { ...distinctColors(shot), path: canvasPath };
  }
  const fullPath = `${OUT_DIR}/${label}-window.png`;
  await page.screenshot({ path: fullPath });
  return { recoveryVisible, recoveryReason, canvasStats, screenshot: fullPath };
}

/** 인페이지에서 로드된 프로젝트를 런타임에 못 놀 상태로 바꾼다. 실제 편집기 store 를 지난다. */
async function breakProject(page, mode) {
  return await page.evaluate(async (breakMode) => {
    const { store } = await import(/* @vite-ignore */ "/src/project/store.ts");
    const before = store.getCurrent();
    const mapIds = Object.keys(before.maps ?? {});
    store.update((draft) => {
      if (breakMode === "no-maps") {
        draft.maps = {};
        return;
      }
      draft.startMapId = "map_does_not_exist_zzu";
      draft.session = { ...draft.session, partyActorIds: [] };
    });
    const after = store.getCurrent();
    return {
      mode: breakMode,
      beforeStartMapId: before.startMapId,
      beforeMapCount: mapIds.length,
      afterStartMapId: after.startMapId,
      afterMapCount: Object.keys(after.maps ?? {}).length,
      afterParty: after.session?.partyActorIds ?? null,
    };
  }, mode);
}

async function runCase(browser, { label, breakMode, accept }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const result = { label, breakMode, ok: false, outcome: null, error: null, mutation: null };
  try {
    await openEditor(page);
    if (breakMode) result.mutation = await breakProject(page, breakMode);
    result.outcome = await triggerTestPlayAndSettle(page);
    result.inspection = await inspect(page, label);
    result.ok = accept(result);
  } catch (error) {
    result.error = String(error?.message ?? error).slice(0, 600);
    try {
      result.inspection = await inspect(page, `${label}-failure`);
    } catch {
      /* 실패 위에 실패를 덮지 않는다 — 진단은 아래 카운트로 보고한다. */
    }
  }
  result.pageErrors = diagnostics.pageErrors;
  result.consoleErrors = diagnostics.consoleErrors;
  await context.close();
  return result;
}

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});

const cases = [
  {
    label: "a-valid-project",
    breakMode: null,
    // 정상 프로젝트는 반드시 그려져야 하고 복구 패널이 있어서는 안 된다.
    accept: (result) =>
      result.outcome === "playing" &&
      result.inspection?.recoveryVisible === false &&
      (result.inspection?.canvasStats?.distinct ?? 0) > 1,
  },
  {
    label: "b-broken-start-map-and-party",
    breakMode: "start-map-and-party",
    accept: (result) =>
      (result.outcome === "playing" && (result.inspection?.canvasStats?.distinct ?? 0) > 1) ||
      (result.inspection?.recoveryVisible === true && result.inspection.recoveryReason.length > 0),
  },
  {
    label: "c-broken-no-maps",
    breakMode: "no-maps",
    accept: (result) =>
      (result.outcome === "playing" && (result.inspection?.canvasStats?.distinct ?? 0) > 1) ||
      (result.inspection?.recoveryVisible === true && result.inspection.recoveryReason.length > 0),
  },
];

const results = [];
for (const testCase of cases) results.push(await runCase(browser, testCase));
await browser.close();

for (const result of results) {
  console.log(`\n== ${result.label} (${result.breakMode ?? "정상"}) → ${result.ok ? "통과" : "실패"}`);
  if (result.mutation) console.log(`   프로젝트 훼손: ${JSON.stringify(result.mutation)}`);
  console.log(`   결말: ${result.outcome ?? "(없음)"}`);
  if (result.error) console.log(`   예외: ${result.error}`);
  console.log(
    `   복구 패널: ${result.inspection?.recoveryVisible ? `보임 — 이유 «${result.inspection.recoveryReason}»` : "없음"}`,
  );
  console.log(
    result.inspection?.canvasStats
      ? `   캔버스 ${result.inspection.canvasStats.width}×${result.inspection.canvasStats.height} 색 ${result.inspection.canvasStats.distinct}종 → ${result.inspection.canvasStats.path}`
      : "   캔버스: 없음",
  );
  console.log(`   샷: ${result.inspection?.screenshot ?? "(없음)"}`);
  console.log(`   pageerror ${result.pageErrors.length}건 / console.error ${result.consoleErrors.length}건`);
  for (const entry of result.pageErrors) console.log(`     pageerror: ${entry}`);
  for (const entry of result.consoleErrors) console.log(`     console.error: ${entry}`);
}

writeFileSync(`${OUT_DIR}/report.json`, `${JSON.stringify({ baseUrl: BASE_URL, results }, null, 2)}\n`);
const failed = results.filter((result) => !result.ok);
console.log(`\n게이트: ${failed.length === 0 ? "통과" : `실패 (${failed.map((r) => r.label).join(", ")})`}`);
process.exit(failed.length === 0 ? 0 : 1);
