// 임시 실측 하네스 공용 (커밋 금지). 실제 빌드 + 복사본 프로젝트 + oprn-serve 를 Playwright/CDP 로 잰다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";

export const OUT = "verify-shots/editor-lag-integrated";
export const BASE = process.env.BASE ?? "http://127.0.0.1:19850";

export const INIT_SCRIPT = () => {
  localStorage.setItem("oprn:editor-ui-mode", localStorage.getItem("oprn:editor-ui-mode") ?? "standard");
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  const P = (window.__lag = { long: [], json: { parse: { n: 0, ms: 0, chars: 0, big: [] }, stringify: { n: 0, ms: 0, chars: 0, big: [] } }, fetches: [], t0: performance.now(), on: true });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  const oParse = JSON.parse;
  JSON.parse = function (s, r) {
    const t = performance.now();
    const v = oParse.call(JSON, s, r);
    const d = performance.now() - t;
    const c = typeof s === "string" ? s.length : 0;
    P.json.parse.n++; P.json.parse.ms += d; P.json.parse.chars += c;
    if (c > 200000 || d > 20) P.json.parse.big.push([Math.round(performance.now()), Math.round(d), c]);
    return v;
  };
  const oStr = JSON.stringify;
  const timed = localStorage.getItem("lagTimeStringify") === "1";
  JSON.stringify = timed ? function (v, r, sp) {
    const t = performance.now();
    const s = oStr.call(JSON, v, r, sp);
    const d = performance.now() - t;
    const c = typeof s === "string" ? s.length : 0;
    P.json.stringify.n++; P.json.stringify.ms += d; P.json.stringify.chars += c;
    if (c > 200000 || d > 20) P.json.stringify.big.push([Math.round(performance.now()), Math.round(d), c]);
    return s;
  } : function (v, r, sp) {
    const s = oStr.call(JSON, v, r, sp);
    P.json.stringify.n++; P.json.stringify.chars += typeof s === "string" ? s.length : 0;
    return s;
  };
  // fetch / XHR 목록 (URL, 메서드, 요청 바이트, 응답 헤더 시각, 몸통 완료 시각)
  const oFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = (init && init.method) || (input instanceof Request ? input.method : "GET");
    let reqBytes = 0;
    const b = init && init.body;
    if (typeof b === "string") reqBytes = b.length; else if (b && b.byteLength != null) reqBytes = b.byteLength; else if (b && b.size != null) reqBytes = b.size;
    const rec = { url: url.replace(location.origin, ""), method, reqBytes, t: Math.round(performance.now()), hdr: 0, done: 0, respBytes: 0, status: 0, blockedMs: 0 };
    P.fetches.push(rec);
    try {
      const r = await oFetch.apply(this, arguments);
      rec.hdr = Math.round(performance.now()); rec.status = r.status;
      try {
        const c = r.clone();
        c.arrayBuffer().then((ab) => { rec.respBytes = ab.byteLength; rec.done = Math.round(performance.now()); }).catch(() => {});
      } catch {}
      return r;
    } catch (e) { rec.err = String(e).slice(0, 80); throw e; }
  };
};

export async function launch({ headless = true, dist = "", profile = "/home/main/scratch-lag/chrome-profile" } = {}) {
  const ctx = await chromium.launchPersistentContext(profile, {
    headless,
    viewport: { width: 1440, height: 900 },
    args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--disable-dev-shm-usage", "--js-flags=--max-old-space-size=8192", "--enable-precise-memory-info"],
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

export function summarizeProfile(profile, top = 15) {
  const nodes = new Map();
  for (const n of profile.nodes) nodes.set(n.id, n);
  const self = new Map();
  const dt = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0));
  }
  const byFn = new Map();
  let total = 0;
  for (const [id, us] of self) {
    const n = nodes.get(id);
    const cf = n.callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.replace(/^https?:\/\/[^/]+/, "")}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + us);
    total += us;
  }
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const keyOf = (n) => { const cf = n.callFrame; return `${cf.functionName || "(anon)"} ${cf.url.replace(/^https?:\/\/[^/]+/, "")}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`; };
  const incl = new Map();
  const callersOfStringify = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const seen = new Set();
    let id = profile.samples[i];
    const w = dt[i] ?? 0;
    const leaf = nodes.get(id);
    if (leaf.callFrame.functionName === "stringify" || leaf.callFrame.functionName === "JSON.stringify") {
      let p = parent.get(id), k = "?";
      while (p != null) { const pn = nodes.get(p); if (pn.callFrame.url) { k = keyOf(pn); break; } p = parent.get(p); }
      callersOfStringify.set(k, (callersOfStringify.get(k) ?? 0) + w);
    }
    while (id != null) { const k = keyOf(nodes.get(id)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + w); } id = parent.get(id); }
  }
  const inclTop = [...incl].filter(([k]) => !k.startsWith("(root)") && !k.startsWith("(program)") && !k.startsWith("(idle)") && !k.startsWith("(garbage")).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => [Math.round(us / 100) / 10, k]);
  const stringifyCallers = [...callersOfStringify].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, us]) => [Math.round(us / 100) / 10, k]);
  const rows = [...byFn].sort((a, b) => b[1] - a[1]);
  const idle = rows.filter(([k]) => k.startsWith("(idle)") || k.startsWith("(program)") || k.startsWith("(garbage collector)"));
  const busy = rows.filter(([k]) => !k.startsWith("(idle)"));
  return {
    totalMs: Math.round(total / 1000),
    idleMs: Math.round((rows.find(([k]) => k.startsWith("(idle)"))?.[1] ?? 0) / 1000),
    gcMs: Math.round((rows.find(([k]) => k.startsWith("(garbage collector)"))?.[1] ?? 0) / 1000),
    top: busy.slice(0, top).map(([k, us]) => [Math.round(us / 100) / 10, k]),
    inclusive: inclTop,
    stringifyCallers,
  };
}

export async function profStart(cdp) {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
}
export async function profStop(cdp, name, save = true) {
  const { profile } = await cdp.send("Profiler.stop");
  const s = summarizeProfile(profile);
  if (save) writeFileSync(`${OUT}/profile-${name}.cpuprofile.gz`, gzipSync(JSON.stringify(profile)));
  return s;
}

export async function heap(cdp) {
  await cdp.send("Performance.enable").catch(() => {});
  const m = await cdp.send("Performance.getMetrics");
  const o = Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
  const f = (v) => (typeof v === "number" ? +v.toFixed(2) : null);
  return { jsHeapUsedMB: Math.round((o.JSHeapUsedSize ?? 0) / 1048576), jsHeapTotalMB: Math.round((o.JSHeapTotalSize ?? 0) / 1048576), nodes: o.Nodes, taskDurationS: f(o.TaskDuration), scriptDurationS: f(o.ScriptDuration), layoutDurationS: f(o.LayoutDuration), recalcStyleS: f(o.RecalcStyleDuration) };
}

export async function lagSnapshot(page) {
  return page.evaluate(() => {
    const P = window.__lag;
    return { now: Math.round(performance.now()), long: P.long.slice(), json: JSON.parse(JSON.stringify(P.json)), fetches: P.fetches.map((f) => ({ ...f })) };
  });
}
export async function lagReset(page) {
  await page.evaluate(() => {
    const P = window.__lag;
    P.long.length = 0; P.fetches.length = 0;
    P.json.parse = { n: 0, ms: 0, chars: 0, big: [] }; P.json.stringify = { n: 0, ms: 0, chars: 0, big: [] };
    P.mark = performance.now();
  });
}

export function longTop(long, n = 5) {
  const s = [...long].sort((a, b) => b[1] - a[1]);
  return { count: long.length, totalMs: long.reduce((a, b) => a + b[1], 0), top: s.slice(0, n).map(([at, d]) => ({ atMs: at, durMs: d })) };
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { mkdirSync, writeFileSync, rmSync };
