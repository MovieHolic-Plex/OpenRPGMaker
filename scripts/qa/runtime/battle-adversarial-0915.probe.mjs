// 적대적 리뷰용 계측 프로브 (2026-09-15).
// 두 가지를 실측한다.
//   A) 전투 진입 전환 타임라인 — 블라인드 커버가 걷히는 시점과 인트로 메시지가 뜨는 시점의 선후.
//      (계약: "인트로 안무는 커버가 걷힌 뒤 시작한다")
//   B) 커맨드 카드 기하 — 스크롤포트 밖으로 나간 행, 스크롤 큐의 실제 가시성, 뷰포트별 클리핑.
//
//   node scripts/qa/runtime/battle-adversarial-0915.probe.mjs
//
// 결과: verify-shots/runtime-qa/battle-adversarial-0915/ 에 PNG + timeline.json + stdout JSON.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-adversarial-0915");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const project = JSON.parse(
  await readFile(new URL("../../../test/fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"),
);

const SAMPLE = `(() => {
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const ov = document.querySelector('[data-testid="battle-transition-overlay"]')
    ?? document.querySelector('.battle-transition-overlay');
  const bars = [...document.querySelectorAll('.battle-transition-blind-bar')];
  let maxCover = 0;
  for (const b of bars) {
    const t = getComputedStyle(b).transform;
    const m = /matrix\\(([^)]+)\\)/.exec(t);
    const sx = m ? num(m[1].split(',')[0]) : 1;
    const r = b.getBoundingClientRect();
    maxCover = Math.max(maxCover, sx * r.width);
  }
  const msg = document.querySelector('[data-testid="battle-message-window"]');
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const dlg = document.querySelector('[data-testid="dialogue-box"]');
  const barRects = bars.map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });
  return {
    overlay: !!ov,
    phase: ov?.dataset.battleTransitionPhase ?? null,
    bars: bars.length,
    barRects,
    maxCoverW: Math.round(maxCover),
    vw: innerWidth,
    msg: !!msg,
    msgOpacity: msg ? num(getComputedStyle(msg).opacity) : null,
    msgRect: msg ? (() => { const r = msg.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() : null,
    scene: !!scene,
    step: scene?.dataset.battleDirectorStep ?? null,
    busy: scene?.dataset.battleSequenceBusy ?? null,
    dlg: !!dlg,
  };
})()`;

const measureCommand = `(() => {
  const scene = document.querySelector('[data-testid="battle-scene"]');
  const panel = document.querySelector('.battle-command-panel');
  const menu = document.querySelector('.battle-command-menu');
  const cue = document.querySelector('[data-testid="battle-command-scroll-cue"]');
  const rect = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }; };
  const port = menu?.closest('.battle-command-panel') ?? menu;
  const rows = [...document.querySelectorAll('button.battle-command')].map((b) => {
    const r = b.getBoundingClientRect();
    return { testid: b.dataset.testid, inert: b.dataset.battleCommandInert ?? null, rect: { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom) } };
  });
  return {
    viewport: [innerWidth, innerHeight],
    uiStyle: scene?.dataset.battleUiStyle ?? null,
    panelRect: rect(panel),
    menuRect: rect(menu),
    menuClientH: menu?.clientHeight ?? null,
    menuScrollH: menu?.scrollHeight ?? null,
    menuScrollTop: menu?.scrollTop ?? null,
    menuOverflowY: menu ? getComputedStyle(menu).overflowY : null,
    cueExists: !!cue,
    cueHidden: cue ? cue.hidden : null,
    cueRect: rect(cue),
    cueOpacity: cue ? getComputedStyle(cue).opacity : null,
    cueText: cue?.textContent ?? null,
    rows,
    rowsClipped: rows.filter((r) => menu && r.rect.bottom > menu.getBoundingClientRect().bottom + 0.5).map((r) => r.testid),
    sceneClientH: scene?.clientHeight ?? null,
    sceneScrollH: scene?.scrollHeight ?? null,
    docScrollH: document.documentElement.scrollHeight,
  };
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { timeline: [], command: {}, errors: [] };

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__adv/project.json", saveNamespace: "adv-qa", qaInstrumentation: true };
  });
  await page.route("**/__adv/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  await page.evaluate(() => window.__oprnDebug.teleport("map_moonwell_forest", 14, 3));
  await page.waitForFunction(() => {
    const s = window.__oprnDebug.readState();
    return s.currentMapId === "map_moonwell_forest" && s.x === 14 && s.y === 3;
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });

  // A) 전환 타임라인 — 대사를 z 로 넘기면서 30ms 간격으로 표본을 뜬다.
  const t0 = Date.now();
  let sawOverlayAt = null;
  let shotCover = false;
  let shotMsgAfterCover = false;
  let bannerSeen = false;
  for (let i = 0; i < 260; i++) {
    const s = await page.evaluate(SAMPLE);
    const t = Date.now() - t0;
    if (s.overlay && sawOverlayAt === null) sawOverlayAt = t;
    report.timeline.push({ t, ...s });
    if (!shotCover && sawOverlayAt !== null && t - sawOverlayAt > 120) {
      shotCover = true;
      await page.screenshot({ path: resolve(out, "A1-cover-closed.png") });
    }
    if (s.msg && (s.msgOpacity ?? 0) > 0.5) bannerSeen = true;
    // 계약 확인: 커버가 화면에 있는 동안 배너는 보이지 않아야 한다. 커버가 사라진 직후를 찍는다.
    if (!shotMsgAfterCover && !s.overlay && (s.msgOpacity ?? 0) > 0.35) {
      shotMsgAfterCover = true;
      await page.screenshot({ path: resolve(out, "A2-banner-after-cover.png") });
    }
    if (s.dlg) await page.keyboard.press("z");
    if (i > 8 && s.scene && s.busy === "false" && bannerSeen) break;
    await page.waitForTimeout(30);
  }
  await page.screenshot({ path: resolve(out, "A3-entry-end.png") });

  // B) 커맨드 카드 기하 — 1024x768 에서 먼저, 그 뒤 뷰포트를 바꿔 반복.
  const viewports = [[1024, 768], [1280, 800], [640, 360], [375, 667]];
  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    // 커맨드 국면이 아니면 결정키로 밀어 넣는다.
    for (let i = 0; i < 30; i++) {
      const ok = await page.evaluate(() => !!document.querySelector('[data-testid="actor-command-attack"]'));
      if (ok) break;
      await page.keyboard.press("z");
      await page.waitForTimeout(200);
    }
    report.command[`${w}x${h}`] = await page.evaluate(measureCommand);
    await page.screenshot({ path: resolve(out, `B-command-${w}x${h}.png`) });
  }
} finally {
  await browser.close();
  await server.close();
}

report.timeline = report.timeline.filter((r) => r.overlay || r.scene || r.msg);
await writeFile(resolve(out, "timeline.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
