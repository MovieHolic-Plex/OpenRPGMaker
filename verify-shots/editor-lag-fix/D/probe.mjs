// D 측정: 실제 마우스 스트로크 60 샘플 동안 프레임·긴 태스크·DOM 변이·store emit 을 잰다.
// 사용: node probe.mjs <label> [url]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const label = process.argv[2] ?? "before";
const url = process.argv[3] ?? "http://127.0.0.1:9839/?freshProject=1";
const outDir = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.addInitScript(() => {
  globalThis.__name = globalThis.__name || ((f) => f);
  const w = window;
  w.__longs = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__longs.push(e.duration); }).observe({ type: "longtask", buffered: true });
});
await page.goto(url);
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(async () => {
  const mod = await import(/* @vite-ignore */ "/src/editor/editorState.ts");
  mod.editorState.set({ tool: "paint", layer: "lower", selectedTile: 6, paintShape: "pen", activePaletteStamp: null, brushSize: 1 });
});
await page.waitForTimeout(1500);

const box = await page.getByTestId("edit-canvas").locator("canvas").boundingBox();
const y0 = box.y + box.height * 0.5;
const x0 = box.x + box.width * 0.1;
await page.mouse.move(x0, y0);

await page.evaluate(() => {
  const w = window;
  const SEL = { toolbar: '[data-testid="editor-zoom-controls"]', banner: '[data-testid="map-lock-banner"]', journey: ".authoring-journey-host" };
  w.__toolbarEl = document.querySelector(SEL.toolbar);
  w.__bannerEl = document.querySelector(SEL.banner);
  w.__journeyEl = document.querySelector(SEL.journey);
  w.__journeyChild = w.__journeyEl?.firstElementChild ?? null;
  w.__longs.length = 0;
  w.__frames = [];
  w.__muts = { total: 0, toolbar: 0, banner: 0, journey: 0, other: 0 };
  w.__changes = 0;
  w.__otherTop = {};
  w.__unsub = w.__oprnEditorStore.subscribe(() => { w.__changes += 1; });
  w.__mo = new MutationObserver((records) => {
    for (const r of records) {
      w.__muts.total += 1;
      const t = r.target instanceof Element ? r.target : r.target.parentElement;
      let k = "other";
      for (const [name, sel] of Object.entries(SEL)) if (t && t.closest(sel)) { k = name; break; }
      w.__muts[k] += 1;
      if (k === "other" && t) {
        const anc = t.closest("[data-testid]");
        const key = (anc ? anc.getAttribute("data-testid") : "-") + " > " + t.tagName + "." + String(t.className?.baseVal ?? t.className).slice(0, 40);
        w.__otherTop[key] = (w.__otherTop[key] ?? 0) + 1;
      }
    }
  });
  w.__mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  let last = performance.now();
  const tick = (t) => { w.__frames.push(t - last); last = t; if (!w.__stop) requestAnimationFrame(tick); };
  w.__stop = false;
  requestAnimationFrame(tick);
});

const t0 = Date.now();
await page.mouse.down();
const N = 60;
for (let i = 1; i <= N; i++) {
  await page.mouse.move(x0 + i * 10, y0 + Math.sin(i / 5) * 6);
  await page.waitForTimeout(16);
}
const duringSnap = await page.evaluate(() => {
  const w = window;
  return {
    toolbarKept: w.__toolbarEl?.isConnected ?? null,
    bannerKept: w.__bannerEl?.isConnected ?? null,
    journeyChildKept: w.__journeyChild?.isConnected ?? null,
    muts: { ...w.__muts },
    changes: w.__changes,
  };
});
await page.mouse.up();
const strokeMs = Date.now() - t0;
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const w = window;
  w.__stop = true; w.__mo.disconnect(); w.__unsub();
  const fr = w.__frames.slice(2).sort((a, b) => a - b);
  const q = (p) => fr[Math.min(fr.length - 1, Math.floor(fr.length * p))];
  const longs = w.__longs;
  const txt = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ?? null;
  return {
    frames: fr.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +fr[fr.length - 1].toFixed(1),
    over50: fr.filter((d) => d > 50).length,
    longTasks: longs.length, longTaskMax: Math.round(Math.max(0, ...longs)), longTaskSum: Math.round(longs.reduce((a, b) => a + b, 0)),
    mutsTotal: w.__muts,
    otherTop: Object.entries(w.__otherTop).sort((a, b) => b[1] - a[1]).slice(0, 12), changes: w.__changes,
    afterKept: { toolbar: w.__toolbarEl?.isConnected, banner: w.__bannerEl?.isConnected, journeyChild: w.__journeyChild?.isConnected },
    toolbarText: txt('[data-testid="editor-zoom-controls"]'),
    journeyText: txt(".authoring-journey-host"),
    bannerClass: document.querySelector('[data-testid="map-lock-banner"]')?.className,
    toolbarChildren: document.querySelector('[data-testid="editor-zoom-controls"]')?.children.length,
  };
});
const out = { label, strokeMs, during: duringSnap, after: res };
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(outDir, `result-${label}.json`), JSON.stringify(out, null, 2));
await page.screenshot({ path: path.join(outDir, `after-stroke-${label}.png`) });
await browser.close();
