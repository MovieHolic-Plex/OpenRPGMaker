// 참여 창 부팅 CPU 프로파일 (같은 userData 로 두 번: 첫 참여 / 두 번째 참여)
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";
const arg = (n, f) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : f; };
const APP = resolve(arg("--app", ".")), URL_ = arg("--url"), OUT = resolve(arg("--out", "/tmp/codex-tj"));
const RUNS = Number(arg("--runs", "2"));
const scratch = mkdtempSync(join(tmpdir(), "oprn-bootprof-"));
const ud = join(scratch, "ud");
for (let run = 1; run <= RUNS; run++) {
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
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start");
    const marks = [];
    team.on("console", (m) => { const t = m.text(); if (/boot|부팅|\[perf\]/i.test(t)) marks.push((Date.now() - t0) + "ms " + t.slice(0, 200)); });
    await team.waitForFunction(() => { const m = document.querySelector("#app .main"); return Boolean(m && m.querySelector("canvas") && document.querySelector("aside[aria-label='팀 연결 상태']")?.textContent?.includes("·")); }, null, { timeout: 300000, polling: 100 });
    const ready = Date.now() - t0;
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(join(OUT, "boot-run" + run + ".cpuprofile"), JSON.stringify(profile));
    process.stdout.write("BOOT RUN " + run + " ready=" + ready + "ms marks=" + JSON.stringify(marks.slice(0, 30)) + "\n");
    await team.waitForTimeout(run < RUNS ? 30000 : 1000);
  } finally {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  }
}
rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
process.stdout.write("BOOT_DONE\n");

