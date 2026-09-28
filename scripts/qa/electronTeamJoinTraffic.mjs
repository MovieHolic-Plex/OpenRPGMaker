// 참여 창 로드·저장이 어디서 시간을 쓰는지 잰다. 요청마다 경로·크기·시간·캐시를 남긴다.
// 실행: xvfb-run -a node electronTeamJoinTraffic.mjs --app . --url http://<호스트>:9840 [--runs 2] [--out traffic.json]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const APP = resolve(arg("--app", process.cwd()));
const JOIN_URL = arg("--url");
const RUNS = Number(arg("--runs", "2"));
const OUT = resolve(arg("--out", "traffic.json"));
const scratch = mkdtempSync(join(tmpdir(), "oprn-team-traffic-"));
const userData = join(scratch, "userdata");
const runs = [];

const classify = (url, channel) => {
  const u = new URL(url);
  if (u.pathname === "/__oprn/bridge") return "bridge:" + (channel ?? "?");
  if (u.pathname.startsWith("/__oprn/asset/")) return "project-asset";
  if (u.pathname.startsWith("/__oprn/shared-content/image/")) return "shared-ref-image";
  if (u.pathname.startsWith("/__oprn/")) return u.pathname;
  if (/\.js$/.test(u.pathname)) return "code-js";
  if (/\.css$/.test(u.pathname)) return "code-css";
  if (/\.(png|jpe?g|webp|gif)$/.test(u.pathname)) return "static-image";
  if (/\.(mid|mp3|ogg|wav)$/.test(u.pathname)) return "static-audio";
  if (u.pathname === "/" || /\.html$/.test(u.pathname)) return "html";
  return "static-other";
};

for (let run = 1; run <= RUNS; run++) {
  const app = await electron.launch({
    args: [APP, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + userData],
    cwd: APP,
    env: { ...process.env, XDG_CONFIG_HOME: join(scratch, "config"), OPRN_RENDERER_DIR: join(APP, "dist") },
    timeout: 60_000,
  });
  const requests = [];
  try {
    const start = await app.firstWindow({ timeout: 30_000 });
    await start.waitForSelector("[data-testid=start-join-team]", { timeout: 30_000 });
    await start.click("[data-testid=start-join-team]");
    await start.fill("[data-testid=start-join-input]", JOIN_URL);
    const opened = app.waitForEvent("window", { timeout: 60_000 });
    const t0 = Date.now();
    await start.click("[data-testid=start-join-submit]");
    const team = await opened;
    const cdp = await team.context().newCDPSession(team);
    await cdp.send("Network.enable");
    const byId = new Map();
    cdp.on("Network.requestWillBeSent", (e) => {
      const channel = e.request.headers?.["x-oprn-channel"];
      byId.set(e.requestId, { url: e.request.url, method: e.request.method, channel, start: e.timestamp, sent: e.request.postData?.length ?? 0, inm: e.request.headers?.["If-None-Match"] ?? e.request.headers?.["if-none-match"] ?? null });
    });
    cdp.on("Network.responseReceived", (e) => {
      const r = byId.get(e.requestId); if (!r) return;
      r.status = e.response.status; r.fromCache = e.response.fromDiskCache || e.response.fromMemoryCache || e.response.fromServiceWorker;
      r.encoding = e.response.headers["content-encoding"] ?? e.response.headers["Content-Encoding"] ?? "";
      r.ttfb = e.response.timing ? e.response.timing.receiveHeadersEnd : null;
    });
    cdp.on("Network.requestServedFromCache", (e) => { const r = byId.get(e.requestId); if (r) r.fromCache = true; });
    cdp.on("Network.loadingFinished", (e) => {
      const r = byId.get(e.requestId); if (!r) return;
      r.wire = e.encodedDataLength; r.ms = Math.round((e.timestamp - r.start) * 1000); requests.push(r); byId.delete(e.requestId);
    });
    cdp.on("Network.loadingFailed", (e) => { const r = byId.get(e.requestId); if (!r) return; r.failed = e.errorText; r.ms = Math.round((e.timestamp - r.start) * 1000); requests.push(r); byId.delete(e.requestId); });
    const marks = {};
    await team.waitForFunction(() => document.querySelector("#app .topbar"), null, { timeout: 300_000 });
    marks.topbar = Date.now() - t0;
    await team.waitForFunction(() => {
      const main = document.querySelector("#app .main");
      const bar = document.querySelector("aside[aria-label='팀 연결 상태']");
      return Boolean(main && main.querySelector("canvas") && bar && bar.textContent && bar.textContent.includes("·"));
    }, null, { timeout: 300_000 });
    marks.editorReady = Date.now() - t0;
    await team.waitForTimeout(8000); // 폴링·배경 로드까지
    // 맵에 타일 한 칸을 칠한 것과 같은 크기의 저장을 흉내내지 않고, 실제 편집 경로를 쓴다.
    const edit = await team.evaluate(async () => {
      const t = performance.now();
      const project = await globalThis.oprn.project.status();
      const status = await globalThis.oprn.team.status();
      return { statusMs: Math.round(performance.now() - t), projectDir: project.projectDir, revision: status.revision };
    });
    marks.statusRoundTripMs = edit.statusMs;
    const perf = await team.evaluate(() => ({ heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576) }));
    runs.push({ run, marks, perf, requests });
    const sum = {};
    for (const r of requests) {
      const k = classify(r.url, r.channel);
      const s = (sum[k] ??= { n: 0, wireKB: 0, maxMs: 0, cached: 0 });
      s.n++; s.wireKB += (r.wire ?? 0) / 1024; s.maxMs = Math.max(s.maxMs, r.ms ?? 0); if (r.fromCache) s.cached++;
    }
    for (const s of Object.values(sum)) s.wireKB = Math.round(s.wireKB);
    process.stdout.write("RUN " + run + " marks=" + JSON.stringify(marks) + " heap=" + perf.heapMB + "MB\n");
    for (const [k, s] of Object.entries(sum).sort((a, b) => b[1].wireKB - a[1].wireKB)) process.stdout.write("  " + k.padEnd(34) + " n=" + String(s.n).padStart(4) + " wire=" + String(s.wireKB).padStart(8) + "KB maxMs=" + String(s.maxMs).padStart(6) + " cached=" + s.cached + "\n");
    const slow = [...requests].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0)).slice(0, 8);
    for (const r of slow) process.stdout.write("  slow " + (r.ms + "ms").padStart(8) + " " + String(Math.round((r.wire ?? 0) / 1024)).padStart(7) + "KB " + (r.encoding || "-") + " " + classify(r.url, r.channel) + " " + new URL(r.url).pathname.slice(0, 70) + "\n");
  } catch (error) {
    process.stdout.write("RUN " + run + " ERROR " + String(error?.stack ?? error).slice(0, 400) + "\n");
  } finally {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  }
}
writeFileSync(OUT, JSON.stringify(runs.map((r) => ({ ...r, requests: r.requests.map(({ url, channel, method, status, wire, ms, fromCache, encoding, sent, failed, inm }) => ({ path: new URL(url).pathname + new URL(url).search, channel, method, status, wire, ms, fromCache, encoding, sent, failed, inm })) })), null, 1));
rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
process.stdout.write("TRAFFIC_DONE " + OUT + "\n");
