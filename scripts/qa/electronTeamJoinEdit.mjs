// 참여 창에서 실제 편집(타일 한 칸)을 하고 저장 왕복과 호스트 변경 반영이 얼마나 걸리는지 잰다.
// 실행: xvfb-run -a node electronTeamJoinEdit.mjs --app . --url http://<호스트>:9840 [--out edit.json]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";
const arg = (n, f) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : f; };
const APP = resolve(arg("--app", ".")), URL_ = arg("--url"), OUT = resolve(arg("--out", "edit.json"));
const scratch = mkdtempSync(join(tmpdir(), "oprn-edit-"));
const userData = join(scratch, "userdata");
const result = { boots: [] };
for (let run = 1; run <= 2; run++) {
  const app = await electron.launch({ args: [APP, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + userData], cwd: APP,
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
    cdp.on("Network.requestWillBeSent", (e) => reqs.set(e.requestId, { ch: e.request.headers?.["x-oprn-channel"] ?? new URL(e.request.url).pathname, t: e.timestamp, sent: e.request.postData?.length ?? 0 }));
    cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) { done.push({ ...r, wire: e.encodedDataLength, ms: Math.round((e.timestamp - r.t) * 1000), at: Date.now() }); reqs.delete(e.requestId); } });
    await team.waitForFunction(() => { const m = document.querySelector("#app .main"); return Boolean(m && m.querySelector("canvas") && document.querySelector("aside[aria-label='팀 연결 상태']")?.textContent?.includes("·")); }, null, { timeout: 300000 });
    const boot = Date.now() - t0;
    // 부팅 뒤 자동 저장(정규화)이 끝나기를 기다린다.
    await team.waitForTimeout(15000);
    const quiet = done.length;
    // 캔버스 가운데를 칠한다(편집기 기본 도구는 그리기).
    const box = await team.locator("#app .main canvas").first().boundingBox();
    const tEdit = Date.now();
    await team.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.6);
    // 자동 저장이 끝날 때까지(저장 채널 응답) 기다린다.
    let saved = null;
    for (let i = 0; i < 120 && !saved; i++) { await team.waitForTimeout(250); saved = done.slice(quiet).find((r) => r.ch === "oprn:project.saveMapPatch" || r.ch === "oprn:project.save"); }
    const saveMs = saved ? saved.at - tEdit : null;
    const status = await team.evaluate(() => document.querySelector("#app .topbar")?.textContent?.match(/자동 저장[^자]*/)?.[0] ?? "");
    result.boots.push({ run, bootMs: boot, editToSavedMs: saveMs, save: saved ? { ch: saved.ch, sentKB: Math.round(saved.sent / 1024), wireKB: Math.round(saved.wire / 1024), ms: saved.ms } : null, status,
      afterBoot: done.slice(0, quiet).filter((r) => r.ch.startsWith("oprn:project.save")).map((r) => ({ ch: r.ch, sentKB: Math.round(r.sent / 1024), wireKB: Math.round(r.wire / 1024), ms: r.ms })) });
    process.stdout.write("EDIT RUN " + run + " " + JSON.stringify(result.boots.at(-1)) + "\n");
  } finally {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  }
}
writeFileSync(OUT, JSON.stringify(result, null, 1));
rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
process.stdout.write("EDIT_DONE\n");
