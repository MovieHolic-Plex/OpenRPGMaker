// 동료가 저장했을 때 참여 창이 그 변경을 반영하는 데 걸리는 시간과 받는 양.
// 동료 = 같은 호스트에 다른 탭 id 로 붙은 두 번째 HTTP 세션(meta.title 만 바꾼 saveMapPatch).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";
const arg = (n, f) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : f; };
const APP = resolve(arg("--app", ".")), URL_ = arg("--url");
const scratch = mkdtempSync(join(tmpdir(), "oprn-refresh-"));
const ud = join(scratch, "ud");
for (let run = 1; run <= 2; run++) {
  const app = await electron.launch({ args: [APP, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + ud], cwd: APP,
    env: { ...process.env, XDG_CONFIG_HOME: join(scratch, "config"), OPRN_RENDERER_DIR: join(APP, "dist") }, timeout: 60000 });
  try {
    const start = await app.firstWindow();
    await start.waitForSelector("[data-testid=start-join-team]");
    await start.click("[data-testid=start-join-team]");
    await start.fill("[data-testid=start-join-input]", URL_);
    const opened = app.waitForEvent("window");
    const t0 = Date.now();
    await start.click("[data-testid=start-join-submit]");
    const team = await opened;
    const cdp = await team.context().newCDPSession(team);
    await cdp.send("Network.enable");
    const reqs = new Map(); const done = [];
    cdp.on("Network.requestWillBeSent", (e) => reqs.set(e.requestId, { path: new URL(e.request.url).pathname + new URL(e.request.url).search, ch: e.request.headers?.["x-oprn-channel"] ?? null, t: e.timestamp }));
    cdp.on("Network.responseReceived", (e) => { const r = reqs.get(e.requestId); if (r) r.status = e.response.status; });
    cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) { done.push({ ...r, wire: e.encodedDataLength, ms: Math.round((e.timestamp - r.t) * 1000), at: Date.now() }); reqs.delete(e.requestId); } });
    cdp.on("Network.loadingFailed", (e) => { const r = reqs.get(e.requestId); if (r) { done.push({ ...r, wire: 0, failed: e.errorText, ms: Math.round((e.timestamp - r.t) * 1000), at: Date.now() }); reqs.delete(e.requestId); } });
    await team.waitForFunction(() => { const m = document.querySelector("#app .main"); return Boolean(m && m.querySelector("canvas") && document.querySelector("aside[aria-label='팀 연결 상태']")?.textContent?.includes("·")); }, null, { timeout: 300000 });
    const ready = Date.now() - t0;
    await team.waitForTimeout(30000); // 부팅 뒤 배경 로드·자동 저장·캐시 쓰기까지
    const bootWire = done.reduce((s, r) => s + (r.wire ?? 0), 0);
    const bootTop = Object.entries(done.reduce((m, r) => { const k = r.ch ?? r.path; m[k] = (m[k] ?? 0) + (r.wire ?? 0); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + "=" + (v / 1048576).toFixed(1) + "MB");
    const mark = done.length;
    // 동료 저장.
    const newTitle = "동료 저장 " + Date.now();
    const teammate = await team.evaluate(async (newTitle) => {
      const cfg = globalThis.__OPRN_BRIDGE__;
      const call = async (channel, payload) => { const r = await fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json", "x-oprn-bridge-token": cfg.token, "x-oprn-session": "teammate-tab", "x-oprn-project": "", "x-oprn-channel": channel }, body: JSON.stringify({ channel, payload }) }); return r.json(); };
      const status = await call("oprn:project.status");
      const loaded = await call("oprn:project.loadFolded", { projectDir: status.projectDir, assetBlobs: true });
      const meta = JSON.parse(loaded.folded).meta;
      const t = performance.now();
      const saved = await call("oprn:project.saveMapPatch", { projectDir: status.projectDir, baseSha: loaded.sha256, patch: { set: { meta: { ...meta, title: newTitle } } } });
      return { kind: saved.kind, revision: saved.revision, saveMs: Math.round(performance.now() - t) };
    }, newTitle);
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 2000 }); await cdp.send("Profiler.start");
    const tSaved = Date.now();
    const seen = await team.waitForFunction((newTitle) => (document.querySelector("#app .topbar")?.textContent ?? "").includes(newTitle), newTitle, { timeout: 120000 }).then(() => Date.now() - tSaved, () => null);
    const { profile } = await cdp.send("Profiler.stop");
    // --profile-out <폴더>: 두 번째 실행의 참여 창 CPU 프로파일을 남긴다(DevTools 에서 열 수 있다).
    if (run === 2 && arg("--profile-out")) writeFileSync(join(resolve(arg("--profile-out")), "member-refresh.cpuprofile"), JSON.stringify(profile));
    if (run === 2) {
      const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
      const incl = new Map(); let i = 0, busy = 0;
      for (const s of profile.samples) { const d = profile.timeDeltas[i++] ?? 0; const n0 = byId.get(s); if (n0.callFrame.functionName === "(idle)") continue; busy += d; const seen = new Set(); let id = s; while (id !== undefined) { const m = byId.get(id); const k = m.callFrame.functionName || "(anon)"; if (!seen.has(k)) { incl.set(k, (incl.get(k) ?? 0) + d); seen.add(k); } id = parent.get(id); } }
      process.stdout.write("REFRESH PROF busy=" + Math.round(busy / 1000) + "ms top=" + JSON.stringify([...incl].sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\((root|program|anon)\)$/.test(k)).slice(0, 30).map(([k, v]) => k + ":" + Math.round(v / 1000))) + "\n");
    }
    await team.waitForTimeout(1000);
    const after = done.slice(mark);
    const refreshWire = after.reduce((s, r) => s + (r.wire ?? 0), 0);
    process.stdout.write("REFRESH RUN " + run + " ready=" + ready + "ms bootWire=" + (bootWire / 1048576).toFixed(1) + "MB top=" + JSON.stringify(bootTop)
      + " teammate=" + JSON.stringify(teammate) + " visibleAfter=" + seen + "ms refreshWire=" + (refreshWire / 1024).toFixed(0) + "KB calls=" + JSON.stringify(after.filter((r) => r.ch && r.ch !== "oprn:team.status").map((r) => r.ch + ":" + Math.round(r.wire / 1024) + "KB/" + r.ms + "ms")) + "\n");
  } finally {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  }
}
rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
process.stdout.write("REFRESH_DONE\n");
