// node bench-layer.mjs <label> [reps] : 레이어 단추 클릭 → 2 rAF 까지
import { chromium } from "playwright";
import fs from "node:fs";
const label = process.argv[2] ?? "layer";
const reps = Number(process.argv[3] ?? 10);
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9850";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1");
  window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ entryTypes: ["longtask"] }); } catch {} });
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(async (reps) => {
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const runs = [];
  for (let i = 0; i < reps * 2; i++) {
    const id = i % 2 === 0 ? "layer-upper" : "layer-lower";
    const long0 = window.__long.length;
    const t0 = performance.now();
    document.querySelector(`[data-testid='${id}']`).click();
    await raf2();
    runs.push({ id, total: Math.round(performance.now() - t0), long: window.__long.slice(long0).map(Math.round) });
    await new Promise((r) => setTimeout(r, 700));
  }
  return runs;
}, reps);
fs.writeFileSync(`${label}.json`, JSON.stringify(out, null, 1));
const med = (l) => l.sort((x, y) => x - y)[Math.floor(l.length / 2)];
console.log(label, "median", med(out.map((r) => r.total)), "all", out.map((r) => r.total).join(","));
await b.close();
