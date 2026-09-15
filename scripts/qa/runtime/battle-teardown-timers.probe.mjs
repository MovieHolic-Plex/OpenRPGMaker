// 전투 teardown 타이머 누수 계측 프로브 (2026-09-16, 잔여 P2 F-teardown).
// battleDom.ts:348 은 적이 쓰러질 때 window.setTimeout(() => playBattleCue("faint"), 260) 을
// 걸고 그 id 를 어디에도 보관하지 않는다. 전투 이 destroy 된 뒤에 그 콜백이 살아 있으면
// 이미 사라진 씬의 오디오 핸들을 만진다.
//
//   node scripts/qa/runtime/battle-teardown-timers.probe.mjs
//
// 판정: 전투가 끝나(씬이 사라져) 600ms 안에 "씬이 사라진 뒤에 발화한" 타이머가 0 개여야 한다.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-teardown-timers");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8"));

const READ_UI = `(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const buttons = [...document.querySelectorAll("button.battle-command")].filter((n) => n.dataset.previewOnly !== "true");
  const cursor = buttons.findIndex((n) => n.dataset.battleCommandCursor === "true");
  return {
    scene: !!scene,
    title: !!document.querySelector('[data-testid="title-screen"]'),
    menu: buttons.map((n) => n.dataset.testid),
    cursor,
    targetPrompt: !!document.querySelector('[data-testid="battle-target-prompt"]'),
    resultPanel: !!document.querySelector('[data-testid="battle-result-panel"]'),
    resultConfirm: !!document.querySelector('[data-testid="battle-result-confirm"]'),
    dialogue: !!document.querySelector('[data-testid="dialogue-box"]'),
  };
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__teardown/project.json", saveNamespace: "teardown-qa", qaInstrumentation: true };
    window.__timerLog = [];
    const original = window.setTimeout;
    window.setTimeout = function (fn, ms, ...rest) {
      const record = { ms: typeof ms === "number" ? ms : -1, scheduledAt: performance.now(), firedAt: null };
      window.__timerLog.push(record);
      const wrapped = function (...args) { record.firedAt = performance.now(); return fn.apply(this, args); };
      return original.call(window, wrapped, ms, ...rest);
    };
    window.__audioAfterDestroy = [];
    const audioObserver = new MutationObserver((records) => {
      if (window.__battleGoneAt === undefined) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches && node.matches("audio[data-oprn-audio]")) {
            window.__audioAfterDestroy.push({ at: Math.round(performance.now() - window.__battleGoneAt) });
          }
        }
      }
    });
    audioObserver.observe(document, { childList: true, subtree: true });
    const observer = new MutationObserver(() => {
      const scene = document.querySelector('[data-testid="battle-scene"]');
      if (scene) {
        if (window.__battleSeenAt === undefined) window.__battleSeenAt = performance.now();
        return;
      }
      // 전투 씬을 **본 뒤에** 사라져야 "파괴"다. 시작 시점의 부재를 파괴로 읽으면 안 된다.
      if (window.__battleSeenAt !== undefined && window.__battleGoneAt === undefined) {
        window.__battleGoneAt = performance.now();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.route("**/__teardown/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(server.url + "/player.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  await page.evaluate(() => { window.__oprnInput.face("right"); window.__oprnInput.action(); });

  // 전투를 끝까지 진행한다(공격 반복). 적이 쓰러지면 faint 타이머가 걸린다.
  let sawResult = false;
  let lastUi = null;
  for (let i = 0; i < 150; i += 1) {
    const ui = await page.evaluate(READ_UI);
    lastUi = ui;
    if (ui.resultPanel) sawResult = true;
    if (!ui.scene && !ui.title && sawResult) break;
    if (ui.resultConfirm || ui.resultPanel) { await page.keyboard.press("z"); await page.waitForTimeout(150); continue; }
    if (ui.dialogue) { await page.keyboard.press("z"); await page.waitForTimeout(150); continue; }
    if (ui.targetPrompt) { await page.keyboard.press("z"); await page.waitForTimeout(150); continue; }
    if (!ui.scene) { await page.keyboard.press("z"); await page.waitForTimeout(300); continue; }
    const attackIdx = ui.menu.indexOf("actor-command-attack");
    if (attackIdx < 0) { await page.keyboard.press("z"); await page.waitForTimeout(150); continue; }
    if (ui.cursor !== attackIdx) { await page.keyboard.press(ui.cursor < attackIdx ? "ArrowDown" : "ArrowUp"); await page.waitForTimeout(60); continue; }
    await page.keyboard.press("z");
    await page.waitForTimeout(150);
  }
  report.sawResultPanel = sawResult;
  report.lastUi = lastUi;
  // 씬이 사라진 뒤 600ms 동안 발화한 타이머를 본다.
  await page.waitForTimeout(600);
  report.raw = await page.evaluate(() => {
    const seenAt = window.__battleSeenAt ?? null;
    const goneAt = window.__battleGoneAt ?? null;
    const log = window.__timerLog;
    const battleWindow = seenAt === null ? [] : log.filter((r) => r.scheduledAt >= seenAt && (goneAt === null || r.scheduledAt <= goneAt));
    return {
      battleSeenAt: seenAt === null ? null : Math.round(seenAt),
      battleGoneAt: goneAt === null ? null : Math.round(goneAt),
      totalTimers: log.length,
      battleTimers: battleWindow.length,
      faintScheduled: battleWindow.some((r) => r.ms === 260),
      firedAfterDestroy: battleWindow.filter((r) => r.firedAt !== null && goneAt !== null && r.firedAt > goneAt).map((r) => ({ ms: r.ms, lateBy: Math.round(r.firedAt - goneAt) })),
      stillPendingAfterDestroy: battleWindow.filter((r) => r.firedAt === null).map((r) => r.ms),
      // 파괴 뒤에 새로 만들어진 오디오 엘리먼트 = 씬이 사라진 뒤 울린 효과음.
      audioAfterDestroy: window.__audioAfterDestroy ?? [],
    };
  });
  await page.screenshot({ path: resolve(out, "after-battle.png") });
} finally {
  await browser.close();
  await server.close();
}
report.pass =
  report.raw?.battleGoneAt !== null
  && report.sawResultPanel === true
  && report.raw.audioAfterDestroy.length === 0
  && report.raw.firedAfterDestroy.filter((r) => r.ms === 260).length === 0;
await writeFile(resolve(out, "result.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ sawResultPanel: report.sawResultPanel, lastUi: report.lastUi, ...report.raw, pass: report.pass, errors: report.errors.slice(0, 2) }, null, 1));
