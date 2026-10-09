/**
 * AI 스튜디오(장면 콘솔) 표면 캡처 — 도구 4탭 · 도구 필터 · 장면 검색 · 덱 접기 · 컴포저 포커스.
 *
 *   BASE=http://127.0.0.1:<내 워크트리 포트> node scripts/capture-ai-studio.mjs
 *   VIEWPORTS=1440x900,1280x720 OUT=/tmp/ai-studio-shots  (기본값)
 *
 * 포트를 반드시 내 트리의 dev 서버로 박아라 — 남의 워크트리 서버를 찍으면 다른 브랜치를 근거로 쓰게 된다
 * (openwiki/testing.md). 넘침 검사(overflow)와 주요 사각형을 JSON 으로 함께 찍는다.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:9878";
const OUT = process.env.OUT ?? "/tmp/ai-studio-shots";
const VIEWPORTS = (process.env.VIEWPORTS ?? "1440x900,1280x720,1920x1080").split(",").map((v) => v.split("x").map(Number));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
  let ok = false;
  for (let attempt = 0; attempt < 5 && !ok; attempt++) {
    try {
      await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
      await page.waitForFunction(() => {
        const c = document.querySelector("[data-testid=edit-canvas] canvas");
        return c && c.width > 100;
      }, null, { timeout: 60_000 });
      ok = true;
    } catch (e) { console.log(`attempt ${attempt} failed: ${String(e).slice(0, 120)}`); }
  }
  if (!ok) { console.log("boot failed", w, h); await page.close(); continue; }
  await page.waitForTimeout(1200);
  await page.getByTestId("topbar-ai-studio").click();
  await page.waitForTimeout(1500);
  const tag = `${w}x${h}`;
  await page.screenshot({ path: path.join(OUT, `${tag}-01-studio.png`) });
  for (const tab of ["work", "changes", "activity"]) {
    await page.getByTestId(`ai-studio-tab-${tab}`).click(); await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${tag}-02-tab-${tab}.png`) });
  }
  await page.getByTestId("ai-studio-tab-tools").click(); await page.waitForTimeout(200);
  // tool filter
  await page.getByTestId("ai-studio-tool-filter").fill("길"); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${tag}-03-tool-filter.png`) });
  await page.getByTestId("ai-studio-tool-filter").fill(""); await page.waitForTimeout(200);
  // scene search
  await page.getByTestId("ai-studio-scene-search").fill("숲"); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${tag}-04-scene-search.png`), clip: { x: 0, y: 48, width: 260, height: 300 } });
  await page.getByTestId("ai-studio-scene-search").fill(""); await page.waitForTimeout(200);
  // deck collapsed
  await page.getByTestId("ai-studio-deck-collapse").click(); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${tag}-05-deck-collapsed.png`) });
  await page.getByTestId("ai-studio-deck-collapse").click(); await page.waitForTimeout(400);
  // composer focus (suggest popover)
  await page.getByTestId("ai-input").click(); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${tag}-06-composer-focus.png`) });
  // measure
  const rects = await page.evaluate(() => {
    const q = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const overflow = [];
    for (const e of document.querySelectorAll(".ai-studio-shell *")) {
      if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0) {
        overflow.push({ cls: e.className?.toString().slice(0, 60), sw: e.scrollWidth, cw: e.clientWidth });
      }
    }
    return {
      shell: q("[data-testid=ai-studio-shell]"), scenes: q(".ai-studio-scenes"), monitor: q("[data-testid=ai-studio-monitor]"),
      stage: q("[data-testid=ai-studio-monitor-stage]"), canvas: q("[data-testid=edit-canvas] canvas"), chat: q("[data-testid=ai-studio-chat]"),
      deck: q("[data-testid=ai-studio-deck]"), pane: q("[data-testid=ai-studio-deck-pane]"), composer: q("[data-testid=ai-studio-composer]"),
      briefing: q("[data-testid=ai-studio-briefing]"), exit: q("[data-testid=ai-studio-exit]"), zoom: q("[data-testid=editor-zoom-controls]"),
      sceneCount: document.querySelectorAll("[data-testid=ai-studio-scene]").length,
      thumbStates: [...document.querySelectorAll(".ai-studio-scene-thumb")].slice(0, 5).map((c) => c.dataset.thumbState),
      overflow: overflow.slice(0, 8),
    };
  });
  console.log(JSON.stringify({ viewport: tag, rects }));
  console.log("errors:", errors.filter((e) => !e.includes("ERR_CONNECTION_REFUSED")).slice(0, 5));
  await page.close();
}
await browser.close();
