// Cold-start probe for the shipped player: time to title screen and to the first map after "new game".
//
//   node scripts/qa/perf/game-load.mjs <url> [--label name] [--shot out.png] [--json out.json] [--down-mbps 50 --rtt-ms 20]
//
// --down-mbps 를 주면 CDP 로 회선을 흉내 낸다(내려받기 Mbps, 왕복 지연 ms). 주지 않으면 루프백 그대로다 —
// 데스크톱 내보내기(같은 번들을 디스크에서 읽는다)에 가깝다.
// One browser, fresh context, HTTP cache disabled via CDP (cold). Reports:
//   title  — navigation start → [data-testid=title-screen] attached
//   map    — Enter pressed on the title → title gone and a game canvas on screen (+2 frames)
//   net    — request count and bytes (encoded / decoded) split by type, before the title
//   cpu    — main-thread long-task time before the title (parse + project build/deserialize + first render)
// file:// URLs work too (standalone single-HTML export).
import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
if (!url) { console.error("usage: game-load.mjs <url> [--label x] [--shot out.png] [--json out.json]"); process.exit(2); }
const label = opt("label") ?? url;
const timeoutMs = Number(opt("timeout") ?? 240_000);

const browser = await chromium.launch({
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const downMbps = Number(opt("down-mbps") ?? 0);
  if (downMbps > 0) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: Number(opt("rtt-ms") ?? 20),
      downloadThroughput: (downMbps * 1_000_000) / 8,
      uploadThroughput: (10 * 1_000_000) / 8,
    });
  }
  const requests = new Map();
  cdp.on("Network.responseReceived", (e) => {
    requests.set(e.requestId, { url: e.response.url, type: e.type, encoded: 0, status: e.response.status });
  });
  cdp.on("Network.loadingFinished", (e) => { const r = requests.get(e.requestId); if (r) r.encoded = e.encodedDataLength; });
  await page.addInitScript(() => {
    window.__loadProbe = { longTask: 0, longTaskCount: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) { window.__loadProbe.longTask += entry.duration; window.__loadProbe.longTaskCount += 1; }
      }).observe({ type: "longtask", buffered: true });
    } catch { /* not supported */ }
  });
  // --profile: CPU 프로파일로 타이틀까지의 메인 스레드 시간을 «JS 컴파일·파싱 / 프로젝트 읽기(JSON·deserialize) / 그 밖»으로 나눈다.
  const profile = args.includes("--profile");
  if (profile) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "commit", timeout: timeoutMs });
  await page.waitForSelector('[data-testid="title-screen"]', { state: "attached", timeout: timeoutMs });
  const titleMs = Date.now() - t0;
  const atTitle = await page.evaluate(() => ({
    longTask: Math.round(window.__loadProbe.longTask),
    longTaskCount: window.__loadProbe.longTaskCount,
    domContentLoaded: Math.round(performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? 0),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  }));
  let cpu = null;
  if (profile) {
    const { profile: prof } = await cdp.send("Profiler.stop");
    const byId = new Map(prof.nodes.map((n) => [n.id, n]));
    const self = new Map();
    const dt = prof.timeDeltas; let total = 0;
    prof.samples.forEach((id, i) => { const d = dt[i] ?? 0; total += d; self.set(id, (self.get(id) ?? 0) + d); });
    const buckets = {};
    const add = (k, us) => { buckets[k] = (buckets[k] ?? 0) + us; };
    for (const [id, us] of self) {
      const n = byId.get(id); const f = n.callFrame; const name = f.functionName;
      if (name === "(idle)" || name === "(program)") { add(name, us); continue; }
      if (name === "(garbage collector)") { add("gc", us); continue; }
      if (/^\(.*compile|parse/i.test(name) || name === "(compile)") { add("js-compile", us); continue; }
      if (name === "parse" && f.url === "") { add("JSON.parse", us); continue; }
      add(f.url ? f.url.replace(/^.*\//, "").replace(/-[A-Za-z0-9_-]{8}\.js$/, ".js") : `(native ${name || "anon"})`, us);
    }
    cpu = Object.fromEntries(Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, us]) => [k, Math.round(us / 1000)]));
    cpu.totalSampledMs = Math.round(total / 1000);
  }
  const net = { count: 0, encodedMB: 0, byType: {} };
  for (const r of requests.values()) {
    net.count += 1; net.encodedMB += r.encoded;
    const t = (net.byType[r.type] ??= { count: 0, encodedMB: 0 });
    t.count += 1; t.encodedMB += r.encoded;
  }
  const mb = (b) => Math.round(b / 104857.6) / 10;
  net.encodedMB = mb(net.encodedMB);
  for (const t of Object.values(net.byType)) t.encodedMB = mb(t.encodedMB);
  const largest = [...requests.values()].sort((a, b) => b.encoded - a.encoded).slice(0, 5)
    .map((r) => `${mb(r.encoded)}MB ${r.url.replace(/^.*\//, "").slice(0, 60)}`);
  // Start a new game.
  await page.waitForTimeout(300);
  const t1 = Date.now();
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Enter");
    const gone = await page.waitForSelector('[data-testid="title-screen"]', { state: "detached", timeout: 1_500 }).then(() => true, () => false);
    if (gone) break;
  }
  await page.waitForFunction(() => {
    if (document.querySelector('[data-testid="title-screen"]')) return false;
    const canvas = [...document.querySelectorAll("canvas")].find((c) => c.width > 100 && c.height > 100 && c.offsetParent !== null);
    return Boolean(canvas);
  }, undefined, { timeout: timeoutMs, polling: 50 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const mapMs = Date.now() - t1;
  const after = await page.evaluate(() => ({ longTaskTotal: Math.round(window.__loadProbe.longTask) }));
  let total = 0; for (const r of requests.values()) total += r.encoded;
  const shot = opt("shot");
  if (shot) await page.screenshot({ path: shot });
  const result = {
    label, url, downMbps: downMbps || null, titleMs, mapMs, totalMs: titleMs + mapMs,
    beforeTitle: { ...atTitle, net, largest, ...(cpu ? { cpu } : {}) },
    afterMap: { requests: requests.size, encodedMB: mb(total), longTaskTotal: after.longTaskTotal },
    errors: errors.slice(0, 5),
  };
  console.log(JSON.stringify(result, null, 1));
  const out = opt("json");
  if (out) (await import("node:fs")).writeFileSync(out, JSON.stringify(result, null, 1));
} finally {
  await browser.close();
}
