// 팔레트 실측: node bench-palette.mjs <label> [tilesetId] [reps]
// 결과는 verify-shots/editor-lag-fix/E/<label>.json, 스크린샷은 <label>-*.png
import { chromium } from "playwright";
import fs from "node:fs";
const label = process.argv[2] ?? "before";
const tilesetId = process.argv[3] ?? "forest_harmony";
const reps = Number(process.argv[4] ?? 5);
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9838";
const outDir = "verify-shots/editor-lag-fix/E";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => {
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
  window.__long = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ entryTypes: ["longtask"] });
  } catch { /* noop */ }
});
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
if (process.env.DEL_HAS) {
  const n = await page.evaluate(() => {
    let cnt = 0;
    const walk = (rules) => { for (let i = rules.length - 1; i >= 0; i--) { const r = rules[i]; if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /(^|[ ,])(body|html):has\(/.test(r.selectorText)) { try { (r.parentRule ?? r.parentStyleSheet).deleteRule(i); cnt++; } catch {} } } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
    return cnt;
  });
  console.log("deleted body:has rules", n);
}
if (process.env.EXTRA_CSS) await page.addStyleTag({ content: process.env.EXTRA_CSS });

// 헬퍼: 동작 실행 후 (조건이 참이 될 때까지) + 이중 rAF 까지의 시간과 그 사이 긴 작업 합
await page.evaluate(() => {
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cells = () => document.querySelectorAll("[data-testid^='chipset-tile-']").length;
  window.__cells = cells;
  // 필터 상태 서명: 셀 수 | 필터로 가려진 수 | 상태 표시 유무. 사용자 화면에 보이는 셀 수 = 셀 - 가려진 수.
  window.__sig = () => `${cells()}|${document.querySelectorAll(".chipset-tile.is-filtered-out").length}|${document.querySelector("[data-testid='palette-filter-status']") ? 1 : 0}`;
  window.__visible = () => cells() - document.querySelectorAll(".chipset-tile.is-filtered-out").length;
  window.__measure = async (action, waitFn, cap = 3000) => {
    const long0 = window.__long.length;
    const t0 = performance.now();
    await action();
    const tAct = performance.now() - t0;
    while (waitFn && !waitFn() && performance.now() - t0 < cap) await new Promise((r) => setTimeout(r, 4));
    await raf2();
    const total = performance.now() - t0;
    const lts = window.__long.slice(long0).map((x) => Math.round(x[1]));
    return { total: Math.round(total * 10) / 10, sync: Math.round(tAct * 10) / 10, long: lts, cells: cells() };
  };
});

const results = { label, tilesetId, reps, runs: {} };
const push = (k, v) => { (results.runs[k] ??= []).push(v); };

// 1) 타일셋 교체 → 팔레트 첫 표시
const first = await page.evaluate(async (id) => {
  const s = window.__oprnEditorStore;
  const before = window.__cells();
  const r = await window.__measure(
    () => s.update((d) => { const m = d.maps[d.startMapId]; m.tilesetId = id; }),
    () => window.__cells() > 300,
    10000,
  );
  return { before, ...r };
}, tilesetId);
results.tilesetSwitch = first;
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/${label}-palette-default.png` });

for (let i = 0; i < reps; i++) {
  // 2) 레이어 전환
  for (const id of ["layer-upper", "layer-lower"]) {
    const r = await page.evaluate(async (tid) => {
      const btn = document.querySelector(`[data-testid='${tid}']`);
      return await window.__measure(() => btn.click(), null);
    }, id);
    push("layer:" + id, r);
    await page.waitForTimeout(700);
  }
  // 3) 검색 필터 (디바운스 120ms 포함) — 입력 이벤트부터 셀 수가 바뀐 뒤 이중 rAF 까지
  for (const q of ["나무", ""]) {
    const r = await page.evaluate(async (query) => {
      const input = document.querySelector("[data-testid='tile-search-input']");
      const s0 = window.__sig();
      const r = await window.__measure(
        () => { input.value = query; input.dispatchEvent(new Event("input", { bubbles: true })); },
        () => window.__sig() !== s0, 2500);
      return { ...r, visible: window.__visible(), sig: window.__sig() };
    }, q);
    push("filter:" + (q || "clear"), r);
    await page.waitForTimeout(700);
  }
  // 4) 분류 select
  for (const v of ["__first", ""]) {
    const r = await page.evaluate(async (which) => {
      const sel = document.querySelector("[data-testid='tile-category-select']");
      const opts = [...sel.options].map((o) => o.value);
      const val = which === "__first" ? opts.find((o, idx) => idx > 0) : opts[0];
      const s0 = window.__sig();
      const r = await window.__measure(
        () => { sel.value = val; sel.dispatchEvent(new Event("change", { bubbles: true })); },
        () => window.__sig() !== s0, 2500);
      return { val, ...r, visible: window.__visible(), sig: window.__sig() };
    }, v);
    push("category:" + (v || "all"), r);
    await page.waitForTimeout(700);
  }
  // 5) 셀 클릭
  {
    const r = await page.evaluate(async () => {
      const list = [...document.querySelectorAll("[data-testid^='chipset-tile-']")];
      const cell = list[Math.min(40 + Math.floor(Math.random() * 20), list.length - 1)];
      const tid = cell.dataset.testid;
      return { tid, ...(await window.__measure(() => cell.click(), () => document.querySelector(`[data-testid='${tid}']`)?.getAttribute("aria-pressed") === "true")) };
    });
    push("cellclick", r);
    await page.waitForTimeout(500);
  }
  // 6) 스크롤 프레임
  {
    const r = await page.evaluate(async () => {
      const sheet = document.querySelector("[data-testid='tile-palette']");
      sheet.scrollTop = 0;
      await new Promise((rr) => setTimeout(rr, 300));
      const long0 = window.__long.length;
      const deltas = [];
      let last = performance.now();
      const start = last;
      await new Promise((resolve) => {
        const step = () => {
          const now = performance.now();
          deltas.push(now - last); last = now;
          sheet.scrollTop += 60;
          if (now - start < 1500) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      deltas.shift();
      deltas.sort((a, b) => a - b);
      return { frames: deltas.length, p50: Math.round(deltas[Math.floor(deltas.length * 0.5)] * 10) / 10, p95: Math.round(deltas[Math.floor(deltas.length * 0.95)] * 10) / 10, max: Math.round(deltas[deltas.length - 1] * 10) / 10, long: window.__long.slice(long0).map((x) => Math.round(x[1])), scrollTop: sheet.scrollTop };
    });
    push("scroll", r);
    await page.evaluate(() => { document.querySelector("[data-testid='tile-palette']").scrollTop = 0; });
    await page.waitForTimeout(500);
  }
}
// 검색 채운 상태 스크린샷
await page.evaluate(async () => {
  const input = document.querySelector("[data-testid='tile-search-input']");
  input.value = "나무"; input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
});
await page.screenshot({ path: `${outDir}/${label}-palette-filter.png` });
await page.evaluate(async () => {
  const input = document.querySelector("[data-testid='tile-search-input']");
  input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
});
await page.getByTestId("layer-upper").click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/${label}-palette-upper.png` });
// 요약
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
results.summary = {};
for (const [k, arr] of Object.entries(results.runs)) {
  results.summary[k] = { n: arr.length, totalMedian: med(arr.map((x) => x.total ?? x.p50)), cells: arr[0].cells, visible: arr.map((x) => x.visible).join(","), longSum: med(arr.map((x) => (x.long ?? []).reduce((a, c) => a + c, 0))) };
  if (k === "scroll") results.summary[k] = { p50: med(arr.map((x) => x.p50)), p95: med(arr.map((x) => x.p95)), max: med(arr.map((x) => x.max)), longSum: med(arr.map((x) => x.long.reduce((a, c) => a + c, 0))) };
}
await b.close();
fs.writeFileSync(`${outDir}/${label}.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify({ tilesetSwitch: results.tilesetSwitch, summary: results.summary }, null, 1));
