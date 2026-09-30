// node prof2.mjs <stage: mapswitch|layer|filter> <mode: cpu|trace> [tilesetId]
import { chromium } from "playwright";
import fs from "node:fs";
const stage = process.argv[2] ?? "mapswitch";
const mode = process.argv[3] ?? "cpu";
const tilesetId = process.argv[4] ?? "easyrpg_chipset_combined_town_retro_world";
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9838";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
if (process.env.DEL_HAS) console.log("deleted", await page.evaluate(() => { let cnt = 0; const walk = (rules) => { for (let i = rules.length - 1; i >= 0; i--) { const r = rules[i]; if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /(^|[ ,])(body|html):has\(/.test(r.selectorText)) { try { (r.parentRule ?? r.parentStyleSheet).deleteRule(i); cnt++; } catch {} } } }; for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} } return cnt; }));
const mapA = await page.evaluate(async (id) => {
  const s = window.__oprnEditorStore;
  s.update((d) => { d.maps[d.startMapId].tilesetId = id; });
  await new Promise((r) => setTimeout(r, 6000));
  const a = s.getCurrent().startMapId;
  s.update((d) => { const c = JSON.parse(JSON.stringify(d.maps[a])); c.id = "bench_map_b"; c.name = "벤치B"; d.maps.bench_map_b = c; if (d.mapOrder) d.mapOrder.push("bench_map_b"); });
  await new Promise((r) => setTimeout(r, 3000));
  return a;
}, tilesetId);
const cdp = await page.context().newCDPSession(page);
const events = [];
if (mode === "cpu") {
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
} else {
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "v8", "disabled-by-default-devtools.timeline","disabled-by-default-devtools.timeline.invalidationTracking"] }, transferMode: "ReportEvents" });
}
const reps = 4;
if (stage === "mapswitch") {
  await page.evaluate(async ({ a, reps }) => {
    const { editorState } = await import("/src/editor/editorState.ts");
    for (let i = 0; i < reps * 2; i++) { editorState.set({ currentMapId: i % 2 === 0 ? "bench_map_b" : a }); await new Promise((r) => setTimeout(r, 1000)); }
  }, { a: mapA, reps });
} else if (stage === "layer") {
  for (let i = 0; i < reps; i++) {
    await page.evaluate(() => document.querySelector("[data-testid='layer-upper']").click()); await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector("[data-testid='layer-lower']").click()); await page.waitForTimeout(800);
  }
} else if (stage === "filter") {
  for (let i = 0; i < reps; i++) for (const q of ["나무", ""]) {
    await page.evaluate((query) => { const input = document.querySelector("[data-testid='tile-search-input']"); input.value = query; input.dispatchEvent(new Event("input", { bubbles: true })); }, q);
    await page.waitForTimeout(800);
  }
}
const tag = `p2-${stage}-${mode}`;
if (mode === "cpu") {
  const { profile } = await cdp.send("Profiler.stop");
  fs.writeFileSync(`/tmp/${tag}.cpuprofile`, JSON.stringify(profile));
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); const dt = profile.timeDeltas; let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const cf = nodes.get(profile.samples[i]).callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0)); total += dt[i] ?? 0;
  }
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const incl = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    let id = profile.samples[i]; const seen = new Set();
    while (id !== undefined) { const cf = nodes.get(id).callFrame; const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) ?? 0) + (dt[i] ?? 0)); } id = parent.get(id); }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1000 / reps / (stage === "mapswitch" ? 2 : 2)).toFixed(1).padStart(8)}ms/op ${k}`);
  console.log(`total ${(total/1000).toFixed(0)}ms over ${reps*2} ops`);
  console.log("== self (top 20) ==\n" + top(self, 20).join("\n"));
  console.log("== inclusive (top 30) ==\n" + top(incl, 30).join("\n"));
} else {
  await new Promise((res) => { cdp.once("Tracing.tracingComplete", res); cdp.send("Tracing.end"); });
  // main thread: find tid with most RunTask
  const cnt = new Map(); for (const e of events) if (e.name === "RunTask" && e.ph === "X") cnt.set(`${e.pid}:${e.tid}`, (cnt.get(`${e.pid}:${e.tid}`) ?? 0) + e.dur);
  const [mainKey] = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]; const [mp, mt] = mainKey.split(":").map(Number);
  const xs = events.filter((e) => e.pid === mp && e.tid === mt && e.ph === "X" && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = new Map(); const stack = [];
  const bucket = (n) => /^(UpdateLayoutTree|RecalculateStyles)$/.test(n) ? "style" : /^Layout$/.test(n) ? "layout" : /^(PrePaint|Paint|Layerize|UpdateLayer|UpdateLayerTree|Commit|CompositeLayers|RasterTask|HitTest|Decode Image|ImageDecodeTask)$/.test(n) ? "paint/raster" : /GC/.test(n) ? "gc" : /^(FunctionCall|EvaluateScript|v8\.compile|v8\.run|EventDispatch|TimerFire|FireAnimationFrame|RunMicrotasks|V8\.|v8\.|ParseHTML|XHRLoad|MessageEvent|ResourceFinish|HTMLDocumentParser|FireIdleCallback|HandlePostMessage)/.test(n) ? "js" : n === "RunTask" ? "task-other" : "other:" + n;
  const add = (e, s) => { const k = bucket(e.name); self.set(k, (self.get(k) ?? 0) + s); };
  for (const e of xs) {
    while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) { const p = stack.pop(); add(p, p.dur - p.child); }
    if (stack.length) stack.at(-1).child += e.dur;
    stack.push({ name: e.name, ts: e.ts, dur: e.dur, child: 0 });
  }
  while (stack.length) { const p = stack.pop(); add(p, p.dur - p.child); }
  const inv = new Map();
  for (const e of events) if (/InvalidationTracking/.test(e.name)) { const d = e.args?.data ?? {}; const k = `${e.name.replace("InvalidationTracking","")} | ${d.reason ?? ""} | ${d.extraData ?? ""} | sel=${d.selectorPart ?? ""} | cls=${d.changedClass ?? ""}${d.changedAttribute ?? ""}${d.changedId ?? ""} | node=${d.nodeName ?? ""}`; inv.set(k, (inv.get(k) ?? 0) + 1); }
  console.log("== invalidations (count total) ==\n" + [...inv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${String(v).padStart(6)} ${k}`).join("\n"));
  const ops = reps * 2;
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / 1000 / ops).toFixed(1).padStart(8)}ms/op ${k}`);
  console.log("== main-thread self time by bucket ==\n" + rows.join("\n"));
  const tasks = xs.filter((e) => e.name === "RunTask" && e.dur > 20000).map((e) => Math.round(e.dur / 1000));
  console.log("long tasks(>20ms):", tasks.join(","));
  const ule = xs.filter((e) => e.name === "UpdateLayoutTree" && e.dur > 3000).map((e) => `${Math.round(e.dur / 1000)}ms/${e.args?.elementCount ?? "?"}el`);

  {
    const big = xs.filter((e) => e.name === "UpdateLayoutTree" && e.dur > 20000 && (e.args?.elementCount ?? 0) > 2000).slice(2, 5);
    const invs = events.filter((e) => /InvalidationTracking/.test(e.name)).sort((a, b) => a.ts - b.ts);
    const all = xs.filter((e) => e.name === "UpdateLayoutTree").sort((a, b) => a.ts - b.ts);
    for (const e of big) {
      const prev = all.filter((x) => x.ts + x.dur <= e.ts).at(-1);
      const from = prev ? prev.ts + prev.dur : e.ts - 200000;
      const parents = xs.filter((x) => x.ts <= e.ts && x.ts + x.dur >= e.ts + e.dur && x !== e).map((x) => x.name).slice(-5).join(">");
      const g = new Map();
      for (const v of invs) if (v.ts >= from && v.ts <= e.ts) { const d = v.args?.data ?? {}; const k = `${v.name.replace("InvalidationTracking","")}|${d.reason ?? ""}|${d.nodeName ?? ""}|${d.changedClass ?? ""}${d.changedAttribute ?? ""}|${d.selectorPart ?? ""}`; g.set(k, (g.get(k) ?? 0) + 1); }
      for (const v of invs) if (v.ts >= from && v.ts <= e.ts && String(v.args?.data?.nodeName ?? "").startsWith("BODY")) { const st = (v.args?.data?.stackTrace ?? []).slice(0, 6).map((f) => `${f.functionName || "?"}@${String(f.url).split("/").slice(-2).join("/")}:${f.lineNumber}`).join(" < "); console.log("  BODYINV", v.name.replace("InvalidationTracking",""), v.args.data.reason ?? "", st.slice(0, 400)); }
      console.log(`ULE ${Math.round(e.dur/1000)}ms ${e.args?.elementCount}el parents=${parents}`);
      console.log([...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `   ${v} ${k}`.slice(0, 220)).join("\n"));
    }
  }
  console.log("UpdateLayoutTree>3ms:", ule.slice(0, 20).join(" "));
}
await b.close();
