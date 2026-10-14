#!/usr/bin/env node
// 편집기 시작 시간 측정기: 영구 프로필 크로미움으로 한 주소를 N번 연다(첫 번째 = 콜드 캐시, 나머지 = 웜).
// 사용: node scripts/qa/startup-perf-probe.mjs --url http://127.0.0.1:9705/ --runs 5 --label head [--cpu out.cpuprofile] [--json out.json]
// 준비 완료 = 부팅 로더(#oprn-boot-loader)가 걷히고 perf-metrics-json 에 initialEditRenderMs 가 찍힌 시점.
// 로그인이 필요한 호스트(비루프백)는 --cookie 를 줘야 한다. 루프백 oprn-serve 는 로그인이 없다.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const url = arg("url");
const runs = Number(arg("runs", "5"));
const label = arg("label", "probe");
const cpuOut = arg("cpu");
const jsonOut = arg("json");
const timeoutMs = Number(arg("timeout", "120000"));
// --settle ms: 준비 완료 뒤 이 시간 동안 더 기다려 «준비 뒤 한가할 때 도는 일»(요약·기준본)의 메인 스레드 시간과 가장 긴 멈춤을 잰다.
const settleMs = Number(arg("settle", "0"));
if (!url) throw new Error("--url 이 필요합니다");

const profileDir = mkdtempSync(join(tmpdir(), "startup-probe-"));
const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const page = context.pages()[0] ?? (await context.newPage());
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Performance.enable");

// 페이지 안 계측: 부팅 로더 제거 시각, initialEditRender, longtask.
await page.addInitScript(() => {
  const t = { loaderGone: null, editRender: null, longTasks: [], paint: {} };
  window.__startupProbe = t;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) t.longTasks.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  const check = () => {
    const now = performance.now();
    if (t.loaderGone === null && document.body && !document.getElementById("oprn-boot-loader") && document.getElementById("app")?.childElementCount) t.loaderGone = now;
    const pre = document.querySelector("[data-testid='perf-metrics-json']");
    if (t.editRender === null && pre && /initialEditRenderMs/.test(pre.textContent || "")) t.editRender = now;
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", check);
});

const results = [];
let profileTaken = false;
for (let run = 0; run < runs; run += 1) {
  const net = { requests: 0, bytes: 0, scripts: [], shared: [] };
  const reqUrl = new Map();
  const onReq = (ev) => reqUrl.set(ev.requestId, { url: ev.request.url, t: ev.timestamp });
  const onFin = (ev) => {
    const r = reqUrl.get(ev.requestId);
    if (!r) return;
    net.requests += 1;
    net.bytes += ev.encodedDataLength;
    if (/\.js(\?|$)/.test(r.url)) net.scripts.push({ u: r.url.replace(/^https?:\/\/[^/]+/, ""), kb: Math.round(ev.encodedDataLength / 1024), ms: Math.round((ev.timestamp - r.t) * 1000) });
    else if (/__oprn|\/api\//.test(r.url)) net.shared.push({ u: r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 80), kb: Math.round(ev.encodedDataLength / 1024), ms: Math.round((ev.timestamp - r.t) * 1000) });
  };
  cdp.on("Network.requestWillBeSent", onReq);
  cdp.on("Network.loadingFinished", onFin);
  const wantCpu = cpuOut && run === runs - 1 && !profileTaken;
  if (wantCpu) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    await cdp.send("Profiler.start");
  }
  const t0 = Date.now();
  await page.goto("about:blank");
  const navStart = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  let ready = null;
  try {
    await page.waitForFunction(() => window.__startupProbe && window.__startupProbe.editRender !== null && window.__startupProbe.loaderGone !== null, null, { timeout: timeoutMs, polling: 50 });
    ready = Date.now() - navStart;
  } catch (error) {
    ready = null;
  }
  const inPage = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const t = window.__startupProbe;
    const lt = t.longTasks;
    return {
      loaderGone: t.loaderGone && Math.round(t.loaderGone),
      editRender: t.editRender && Math.round(t.editRender),
      dcl: nav && Math.round(nav.domContentLoadedEventEnd),
      load: nav && Math.round(nav.loadEventEnd),
      longTaskCount: lt.length,
      longTaskTotal: lt.reduce((a, [, d]) => a + d, 0),
      longTaskTop: lt.slice().sort((a, b) => b[1] - a[1]).slice(0, 5),
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      perf: document.querySelector("[data-testid='perf-metrics-json']")?.textContent ?? null,
      bootText: document.querySelector("#oprn-boot-loader .oprn-boot-text")?.textContent ?? null,
    };
  });
  let settle = null;
  if (settleMs > 0 && ready !== null) {
    const before = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    const ltBefore = await page.evaluate(() => window.__startupProbe.longTasks.length);
    await page.waitForTimeout(settleMs);
    const after = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    const lt = await page.evaluate((n) => window.__startupProbe.longTasks.slice(n), ltBefore);
    settle = { windowMs: settleMs, threadMs: Math.round(((after.ThreadTime ?? 0) - (before.ThreadTime ?? 0)) * 1000), longTasks: lt.length, longestMs: lt.reduce((a, [, d]) => Math.max(a, d), 0), longTaskTotalMs: lt.reduce((a, [, d]) => a + d, 0) };
  }
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  inPage.settle = settle;
  inPage.cpuMs = { thread: Math.round((m.ThreadTime ?? 0) * 1000), script: Math.round((m.ScriptDuration ?? 0) * 1000), task: Math.round((m.TaskDuration ?? 0) * 1000), layout: Math.round((m.LayoutDuration ?? 0) * 1000) };
  if (wantCpu) {
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(cpuOut, JSON.stringify(profile));
    profileTaken = true;
  }
  cdp.off("Network.requestWillBeSent", onReq);
  cdp.off("Network.loadingFinished", onFin);
  results.push({ run, kind: run === 0 ? "cold" : "warm", readyMs: ready, ...inPage, net: { requests: net.requests, mb: +(net.bytes / 1048576).toFixed(2), shared: net.shared, bigScripts: net.scripts.sort((a, b) => b.kb - a.kb).slice(0, 4) } });
  console.log(`[${label}] run ${run} ${run === 0 ? "cold" : "warm"} ready=${ready}ms loaderGone=${inPage.loaderGone} editRender=${inPage.editRender} longTasks=${inPage.longTaskCount}/${inPage.longTaskTotal}ms cpu(thread/script)=${inPage.cpuMs.thread}/${inPage.cpuMs.script}ms${inPage.settle ? ` post-ready ${inPage.settle.threadMs}ms cpu, ${inPage.settle.longTasks} long tasks (max ${inPage.settle.longestMs}ms)` : ""} netMB=${(net.bytes / 1048576).toFixed(1)} req=${net.requests}`);
}
await context.close();
rmSync(profileDir, { recursive: true, force: true });
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ label, url, results }, null, 1));
