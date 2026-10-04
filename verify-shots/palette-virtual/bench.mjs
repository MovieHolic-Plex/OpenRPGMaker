// node bench.mjs <label> <tilesetId> [reps]   (QA_BASE_URL 필수 아님: 기본 9863)
import { chromium } from "playwright";
import fs from "node:fs";
const label = process.argv[2], tilesetId = process.argv[3], reps = Number(process.argv[4] ?? 5);
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9863";
const outDir = "verify-shots/palette-virtual";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => {
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
  window.__long = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ entryTypes: ["longtask"] }); } catch {}
});
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cells = () => document.querySelectorAll("[data-testid^='chipset-tile-']").length;
  window.__cells = cells;
  window.__nodes = () => document.querySelector("[data-testid='tile-palette']")?.querySelectorAll("*").length ?? 0;
  window.__sig = () => [...document.querySelectorAll("[data-testid^='chipset-tile-']")].map((e) => e.dataset.tileIndex + (e.classList.contains("is-filtered-out") ? "x" : "")).join(",").length + ":" + document.querySelectorAll(".chipset-tile.is-filtered-out").length + ":" + (document.querySelector("[data-testid='palette-filter-status']")?.textContent ?? "");
  window.__measure = async (action, waitFn, cap = 3000) => {
    const long0 = window.__long.length; const t0 = performance.now();
    await action(); const tAct = performance.now() - t0;
    while (waitFn && !waitFn() && performance.now() - t0 < cap) await new Promise((r) => setTimeout(r, 2));
    await raf2();
    return { total: Math.round((performance.now() - t0) * 10) / 10, sync: Math.round(tAct * 10) / 10, long: window.__long.slice(long0).map((x) => Math.round(x[1])), cells: cells() };
  };
});
const R = { label, tilesetId, runs: {} };
const push = (k, v) => (R.runs[k] ??= []).push(v);
const sw = await page.evaluate(async (id) => {
  const s = window.__oprnEditorStore;
  return await window.__measure(() => s.update((d) => { d.maps[d.startMapId].tilesetId = id; }), () => window.__cells() > 50 && window.__nodes() > 0, 90000);
}, tilesetId);
R.tilesetSwitch = sw;
await page.waitForTimeout(5000);
R.nodesAfterSettle = await page.evaluate(() => ({ nodes: window.__nodes(), cells: window.__cells(), panelAll: document.querySelectorAll("*").length }));
const shot = async (n) => (await page.locator("[data-testid='tile-palette']").screenshot({ path: `${outDir}/${label}-${n}.png` }));
await shot("default");
for (let i = 0; i < reps; i++) {
  for (const v of ["__first", "terrain", "water", ""]) {
    const r = await page.evaluate(async (which) => {
      const sel = document.querySelector("[data-testid='tile-category-select']");
      const opts = [...sel.options].map((o) => o.value);
      const val = which === "__first" ? opts.find((o, k) => k > 0) : which === "" ? opts[0] : which;
      if (!opts.includes(val)) return { skip: val };
      const s0 = window.__sig();
      const r = await window.__measure(() => { sel.value = val; sel.dispatchEvent(new Event("change", { bubbles: true })); }, () => window.__sig() !== s0, 4000);
      return { val, ...r, nodes: window.__nodes(), sig: window.__sig() };
    }, v);
    push("category:" + (v || "all"), r);
    await page.waitForTimeout(600);
  }
  {
    const r = await page.evaluate(async () => {
      const list = [...document.querySelectorAll("[data-testid^='chipset-tile-']:not(.is-filtered-out)")];
      const cell = list[Math.min(40 + Math.floor(Math.random() * 20), list.length - 1)];
      const tid = cell.dataset.testid;
      return { tid, ...(await window.__measure(() => cell.click(), () => document.querySelector(`[data-testid='${tid}']`)?.getAttribute("aria-pressed") === "true")) };
    });
    push("cellclick", r); await page.waitForTimeout(500);
  }
  {
    const r = await page.evaluate(async () => {
      const sheet = document.querySelector("[data-testid='tile-palette']");
      sheet.scrollTop = 0; await new Promise((rr) => setTimeout(rr, 300));
      const long0 = window.__long.length; const deltas = []; let last = performance.now(); const start = last;
      await new Promise((resolve) => { const step = () => { const now = performance.now(); deltas.push(now - last); last = now; sheet.scrollTop += 60; if (now - start < 1500) requestAnimationFrame(step); else resolve(); }; requestAnimationFrame(step); });
      deltas.shift(); deltas.sort((a, b) => a - b);
      return { frames: deltas.length, p50: Math.round(deltas[Math.floor(deltas.length * .5)] * 10) / 10, p95: Math.round(deltas[Math.floor(deltas.length * .95)] * 10) / 10, max: Math.round(deltas[deltas.length - 1] * 10) / 10, long: window.__long.slice(long0).map((x) => Math.round(x[1])), scrollTop: sheet.scrollTop };
    });
    push("scroll", r);
    await page.evaluate(() => { document.querySelector("[data-testid='tile-palette']").scrollTop = 0; });
    await page.waitForTimeout(500);
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
R.summary = {};
for (const [k, arr] of Object.entries(R.runs)) {
  const ok = arr.filter((x) => !x.skip);
  if (!ok.length) continue;
  R.summary[k] = k === "scroll" ? { p50: med(ok.map((x) => x.p50)), p95: med(ok.map((x) => x.p95)), max: med(ok.map((x) => x.max)) } : { total: med(ok.map((x) => x.total)), sync: med(ok.map((x) => x.sync)), nodes: ok[0].nodes, cells: ok[0].cells };
}
await b.close();
fs.writeFileSync(`${outDir}/${label}.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify({ tilesetSwitch: R.tilesetSwitch, nodesAfterSettle: R.nodesAfterSettle, summary: R.summary }));
