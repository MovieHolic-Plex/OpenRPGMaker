// node bench.mjs <before|after> <run#>  (BASE env = 서버 주소). 서버·복사본은 호출자가 새로 준비한다.
import { launch, BASE, wait, lagSnapshot, lagReset, longTop, profStart, profStop, heap, writeFileSync, mkdirSync, rmSync } from "./lib.mjs";
import { execSync } from "node:child_process";
const side = process.argv[2], run = process.argv[3];
const profile = `/tmp/lag-int/prof-${side}-${run}`; rmSync(profile, { recursive: true, force: true });
mkdirSync("verify-shots/editor-lag-integrated/raw", { recursive: true });
const res = { side, run: Number(run), load: execSync("cut -d' ' -f1-3 /proc/loadavg").toString().trim() };
const med = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const { ctx, page, cdp } = await launch({ profile });
page.on("pageerror", (e) => (res.pageerrors ??= []).push(String(e).slice(0, 160)));
const ready = () => page.evaluate(() => typeof window.__oprnEditWorldToClient === "function" && document.querySelectorAll("canvas").length > 0).catch(() => false);
async function load(kind) {
  const t0 = Date.now();
  if (kind === "cold") await page.goto(BASE + "/"); else await page.reload();
  for (let i = 0; i < 1500; i++) { if (await ready()) break; await wait(40); }
  const ms = Date.now() - t0;
  const snap = await lagSnapshot(page);
  return { readyMs: ms, long: longTop(snap.long), parse: { n: snap.json.parse.n, ms: Math.round(snap.json.parse.ms), MB: +(snap.json.parse.chars / 1e6).toFixed(1) }, netMB: +(snap.fetches.reduce((a, f) => a + (f.respBytes || 0), 0) / 1e6).toFixed(1), fetches: snap.fetches.length };
}
res.s1_cold = await load("cold"); await wait(4000);
res.s1_warm = await load("warm"); await wait(4000);
res.s1_warm2 = await load("warm"); await wait(3000);
const raf2 = "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))";
// 맵 열기
await page.click("[data-testid=sidebar-maps]"); await wait(800);
await page.click("[data-testid=map-tree-node-map_blank_start]"); await wait(2500);
await page.click("[data-testid=layer-lower]"); await wait(500);
// 타일 하나 선택
const tileId = await page.evaluate(() => { const e = [...document.querySelectorAll("[data-testid^=chipset-tile-]")].filter(e => e.getBoundingClientRect().width > 0)[5]; e?.click(); return e?.dataset.testid; });
await page.click("[data-testid=tool-paint]").catch(() => {}); await wait(500);
const cv = await page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].map(c => c.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: c.x, y: c.y, w: c.width, h: c.height }; });
res.canvas = cv; res.tileId = tileId;
const cx = cv.x + cv.w / 2 - 100, cy = cv.y + cv.h / 2;
// s2: 한 칸 칠하기 → 자동저장
await lagReset(page); await profStart(cdp);
const t2 = Date.now();
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up();
res.s2_paintClickMs = Date.now() - t2;
await wait(10000);
const p2 = await profStop(cdp, `s2-${side}-${run}`, false);
const sn2 = await lagSnapshot(page);
const save2 = sn2.fetches.filter(f => f.method !== "GET");
res.s2 = { long: longTop(sn2.long, 6), saveFetches: save2.map(f => ({ url: f.url.slice(0, 60), method: f.method, reqKB: Math.round(f.reqBytes / 1024), atMs: f.t - (sn2.now - 10000 - res.s2_paintClickMs) , respMs: f.done ? f.done - f.t : null })), stringify: { n: sn2.json.stringify.n, MB: +(sn2.json.stringify.chars / 1e6).toFixed(2), ms: Math.round(sn2.json.stringify.ms) }, parse: { n: sn2.json.parse.n, ms: Math.round(sn2.json.parse.ms) },
  hot: p2.inclusive.filter(([, k]) => /digest|sha|hash|stableStr|canonical|fingerprint|checksum|serialize/i.test(k)).slice(0, 6), top: p2.top.slice(0, 5), busyMs: p2.totalMs - p2.idleMs };
// s3: 20칸 드래그
await lagReset(page);
const stepPx = 16; const per = [];
const t3 = Date.now();
await page.mouse.move(cx, cy + 64); await page.mouse.down();
for (let i = 1; i <= 20; i++) { const a = performance.now(); await page.mouse.move(cx + i * stepPx, cy + 64); per.push(performance.now() - a); }
await page.mouse.up();
res.s3 = { dragOnlyMs: Date.now() - t3, perMoveMedianMs: +med(per).toFixed(1), perMoveMaxMs: +Math.max(...per).toFixed(1), moves: per.length };
await wait(6000);
const sn3 = await lagSnapshot(page);
res.s3.longAfter = longTop(sn3.long, 5); res.s3.saveFetches = sn3.fetches.filter(f => f.method !== "GET").length;
await page.screenshot({ path: `verify-shots/editor-lag-integrated/raw/s3-${side}-${run}.png` });
// in-page 타이머 벤치
const timed = (name, fnSrc, reps) => page.evaluate(async ({ fnSrc, reps }) => {
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const fn = new Function("i", `return (${fnSrc})(i)`);
  const out = [];
  for (let i = 0; i < reps; i++) { const l0 = window.__lag.long.length; const t = performance.now(); await fn(i); await raf2(); const total = performance.now() - t; await new Promise(r => setTimeout(r, 800)); out.push({ total: Math.round(total), long: window.__lag.long.slice(l0).reduce((a, b) => a + b[1], 0) }); }
  return out;
}, { fnSrc, reps });
const sum = (o) => ({ medianMs: med(o.map(x => x.total)), all: o.map(x => x.total), longSumMedian: med(o.map(x => x.long)) });
res.s4 = sum(await timed("map", `(i)=>{document.querySelector("[data-testid='map-tree-node-"+(i%2===0?"map_fc0b2b2f-01b2-4e91-992d-06ddda34b8fa":"map_blank_start")+"']").click();}`, 8));
res.s5 = sum(await timed("layer", `(i)=>{document.querySelector("[data-testid='"+(i%2===0?"layer-upper":"layer-lower")+"']").click();}`, 10));
const q = ["나무", "", "집", "", "물", ""];
res.s6 = sum(await timed("pal", `(i)=>{const q=${JSON.stringify(q)}[i%6];const el=document.querySelector("[data-testid='tile-search-input']");el.value=q;el.dispatchEvent(new Event("input",{bubbles:true}));}`, 12));
// s7: 장소 탭
await page.click("[data-testid=toolbar-database]"); await wait(2500);
await lagReset(page);
res.s7 = await page.evaluate(async () => {
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  let last = performance.now(); const mo = new MutationObserver(() => { last = performance.now(); }); mo.observe(document.body, { subtree: true, childList: true, attributes: true });
  const g = document.querySelector("[data-testid=db-tab-group-world]"); const tab = () => document.querySelector("[data-testid=db-tab-spatial-places]");
  if (!tab() || tab().getBoundingClientRect().width === 0) g?.click();
  await raf2();
  const t0 = performance.now(); last = t0; const l0 = window.__lag.long.length;
  tab().click(); await raf2(); const rafMs = performance.now() - t0;
  let quiet = 0; while (performance.now() - last < 600 && performance.now() - t0 < 30000) await new Promise(r => setTimeout(r, 50));
  mo.disconnect();
  return { rafMs: Math.round(rafMs), settleMs: Math.round(last - t0), longSumMs: Math.round(window.__lag.long.slice(l0).reduce((a, b) => a + b[1], 0)), cards: document.querySelectorAll("[data-testid^=spatial-place],[class*=place-card],[class*=spatial-card]").length, gallery: !!document.querySelector("[data-testid=spatial-shell-places]") };
});
await page.screenshot({ path: `verify-shots/editor-lag-integrated/raw/s7-${side}-${run}.png` });
res.heap = await heap(cdp);
writeFileSync(`verify-shots/editor-lag-integrated/raw/${side}-${run}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ side, run, cold: res.s1_cold.readyMs, warm: res.s1_warm.readyMs, paintLong: res.s2.long.totalMs, dragOnly: res.s3.dragOnlyMs, perMove: res.s3.perMoveMedianMs, map: res.s4.medianMs, layer: res.s5.medianMs, pal: res.s6.medianMs, places: res.s7 }));
await ctx.close();
