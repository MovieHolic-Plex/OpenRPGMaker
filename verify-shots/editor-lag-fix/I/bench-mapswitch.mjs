// 같은 타일셋 맵 전환 실측: node bench-mapswitch.mjs <label> [tilesetId] [reps]
import { chromium } from "playwright";
import fs from "node:fs";
const label = process.argv[2] ?? "ms";
const tilesetId = process.argv[3] ?? "easyrpg_chipset_combined_town_retro_world";
const reps = Number(process.argv[4] ?? 6);
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9838";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => {
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
  window.__long = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ entryTypes: ["longtask"] }); } catch {}
});
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(async ({ id, reps }) => {
  const s = window.__oprnEditorStore;
  const { editorState } = await import("/src/editor/editorState.ts");
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  s.update((d) => { d.maps[d.startMapId].tilesetId = id; });
  await new Promise((r) => setTimeout(r, 6000));
  const cur = s.getCurrent();
  const a = cur.startMapId;
  s.update((d) => {
    const src = d.maps[a];
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = "bench_map_b"; copy.name = "벤치B"; d.maps["bench_map_b"] = copy;
    if (d.mapOrder) d.mapOrder.push("bench_map_b");
  });
  await new Promise((r) => setTimeout(r, 3000));
  const cells = () => document.querySelectorAll("[data-testid^='chipset-tile-']").length;
  const runs = [];
  let paletteSheet = document.querySelector("[data-testid='tile-palette']");
  for (let i = 0; i < reps * 2; i++) {
    const target = i % 2 === 0 ? "bench_map_b" : a;
    const long0 = window.__long.length;
    const t0 = performance.now();
    editorState.set({ currentMapId: target });
    await raf2();
    const total = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 900));
    const sh = document.querySelector("[data-testid='tile-palette']");
    runs.push({ target, total: Math.round(total), long: window.__long.slice(long0).map(Math.round), cells: cells(), sameSheet: sh === paletteSheet });
    paletteSheet = sh;
  }
  return runs;
}, { id: tilesetId, reps });
fs.writeFileSync(`${label}.json`, JSON.stringify(out, null, 1));
const med = (l) => l.sort((x, y) => x - y)[Math.floor(l.length / 2)];
console.log(label, "total median", med(out.map((r) => r.total)), "long sum median", med(out.map((r) => r.long.reduce((x, y) => x + y, 0))), "cells", out.at(-1).cells, "sameSheet", out.filter((r) => r.sameSheet).length + "/" + out.length);
console.log(JSON.stringify(out.slice(0, 4)));
await b.close();
