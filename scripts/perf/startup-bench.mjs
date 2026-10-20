#!/usr/bin/env node
// 시작 속도 측정기 — 데스크톱 앱(Electron, 빌드 결과)의 「시작 화면 → 편집기」 와 웹(oprn-serve)의 편집기 부팅을 N 번 재고 중앙값을 낸다.
//
//   node scripts/perf/startup-bench.mjs electron --project <폴더> [--runs 5] [--dist dist] [--out file.json]
//   node scripts/perf/startup-bench.mjs web --url http://127.0.0.1:PORT/ [--runs 5] [--out file.json]
//
// Electron 은 xvfb 안에서 띄운다(DISPLAY 가 없으면 xvfb-run 으로 자기 자신을 다시 부른다). 사용자 설정 폴더는
// --config-home(기본 ~/fs-bench/cfg) 로 따로 두고, 최근 목록에 --project 하나를 심는다 — 실제 사용자처럼 V8 코드 캐시가
// 남도록 실행 사이에 지우지 않는다. 첫 실행은 데우기로 버린다(--warmup 0 으로 끌 수 있다).
// 측정점(모두 앱 실행 시각 기준 ms): 창 문서 시작(nav), 첫 페인트(fp), 시작 화면 카드가 보이고 입력 가능(home),
// 편집 단추 → 편집기 셸(editorShell) → 입력 가능(editorSettled). 웹은 같은 이름의 편집기 부팅 마크를 페이지 시작 기준으로 낸다.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir, loadavg } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const mode = args[0];
const opt = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const runs = Number(opt("runs", "5"));
const warmup = Number(opt("warmup", "1"));
const out = opt("out", null);

if (mode === "electron" && !process.env.DISPLAY && !process.env.OPRN_BENCH_IN_XVFB) {
  const result = spawnSync("xvfb-run", ["-a", "-s", "-screen 0 1920x1080x24", process.execPath, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, OPRN_BENCH_IN_XVFB: "1" },
  });
  process.exit(result.status ?? 1);
}

const { _electron: electron, chromium } = await import("@playwright/test");

const median = (values) => {
  const sorted = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
};

function summarize(samples) {
  const keys = [...new Set(samples.flatMap((sample) => Object.keys(sample.t)))];
  const result = {};
  for (const key of keys) result[key] = median(samples.map((sample) => sample.t[key]));
  return result;
}

const pageMarks = () => {
  const marks = {};
  for (const entry of performance.getEntriesByType("mark")) {
    if (entry.name.startsWith("oprn:boot:")) marks[entry.name.slice(10)] = Math.round(entry.startTime);
  }
  for (const entry of performance.getEntriesByType("paint")) marks[entry.name] = Math.round(entry.startTime);
  const resources = performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name.replace(/^.*\/assets\//, ""),
    start: Math.round(entry.startTime),
    end: Math.round(entry.responseEnd),
    size: entry.decodedBodySize || entry.transferSize || 0,
  }));
  return { timeOrigin: performance.timeOrigin, marks, resources };
};

async function electronRun(projectDir, configHome) {
  const t0 = Date.now();
  const app = await electron.launch({
    args: [resolve(opt("main", join(REPO, "dist-electron/main.cjs"))), "--disable-dev-shm-usage"],
    cwd: REPO,
    env: { ...process.env, XDG_CONFIG_HOME: configHome, OPRN_RENDERER_DIR: resolve(REPO, opt("dist", "dist")) },
  });
  const t = {};
  try {
    const page = await app.firstWindow();
    // 시작 화면: 최근 월드 카드(편집 단추)가 그려진 순간. 카드가 생기기 전까지는 홈이 쓸모가 없다.
    await page.locator('[data-testid^="start-world-make"]').first().waitFor({ state: "visible", timeout: 120_000 });
    t.home = Date.now() - t0;
    const mainTiming = await app.evaluate(() => ({
      processStart: performance.timeOrigin,
      timing: globalThis.__oprnMainTiming ?? null,
    }));
    const home = await page.evaluate(pageMarks);
    t.mainToNav = Math.round(home.timeOrigin - mainTiming.processStart);
    t.nav = Math.round(home.timeOrigin - t0);
    t.fp = home.marks["first-paint"] !== undefined ? t.nav + home.marks["first-paint"] : null;
    t.fcp = home.marks["first-contentful-paint"] !== undefined ? t.nav + home.marks["first-contentful-paint"] : null;
    if (mainTiming.timing) for (const [key, value] of Object.entries(mainTiming.timing)) t[`main.${key}`] = Math.round(mainTiming.processStart + value - t0);
    const homeBytes = home.resources.reduce((sum, entry) => sum + entry.size, 0);
    t.homeKB = Math.round(homeBytes / 1024);
    // 편집기: 첫 카드의 편집 단추 → index.html 부팅 → settled.
    const clickAt = Date.now();
    await page.locator('[data-testid^="start-world-make"]').first().click();
    await page.waitForURL(/index\.html/, { timeout: 60_000 });
    await page.waitForFunction(() => performance.getEntriesByName("oprn:boot:settled").length > 0, null, { timeout: 180_000, polling: 50 });
    const editor = await page.evaluate(pageMarks);
    const navAt = editor.timeOrigin;
    t.editorClick = clickAt - t0;
    t["editor.nav"] = Math.round(navAt - clickAt);
    for (const [name, at] of Object.entries(editor.marks)) t[`editor.${name}`] = Math.round(navAt - clickAt + at);
    t.editorKB = Math.round(editor.resources.reduce((sum, entry) => sum + entry.size, 0) / 1024);
    return { t, homeResources: home.resources, editorResources: editor.resources };
  } finally {
    await Promise.race([app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
    try { const child = app.process(); if (child?.exitCode === null) child.kill("SIGKILL"); } catch { /* 이미 끝남 */ }
  }
}

async function webRun(url, profileDir) {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1600, height: 900 },
    args: ["--disable-features=NetworkServiceSandbox", "--disable-dev-shm-usage"],
  });
  const t = {};
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const t0 = Date.now();
    await page.goto(url, { waitUntil: "commit" });
    await page.waitForFunction(() => performance.getEntriesByName("oprn:boot:settled").length > 0, null, { timeout: 180_000, polling: 50 });
    const marks = await page.evaluate(pageMarks);
    t.nav = Math.round(marks.timeOrigin - t0);
    for (const [name, at] of Object.entries(marks.marks)) t[`editor.${name}`] = at;
    t.editorKB = Math.round(marks.resources.reduce((sum, entry) => sum + entry.size, 0) / 1024);
    return { t, editorResources: marks.resources };
  } finally {
    await context.close();
  }
}

const samples = [];
const meta = { mode, runs, warmup, startedAt: new Date().toISOString(), load: [], commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim() };

if (mode === "electron") {
  const projectDir = realpathSync(resolve(opt("project", join(homedir(), "fs-bench/fallen-proj"))));
  const configHome = resolve(opt("config-home", join(homedir(), "fs-bench/cfg")));
  // 앱 이름 폴더는 package.json 의 name 이다(electron app.getName()).
  const appName = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).productName ?? JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).name;
  for (const name of new Set([appName, "oprn", "OPRN Studio", "Electron"])) {
    mkdirSync(join(configHome, name), { recursive: true });
    writeFileSync(join(configHome, name, "recent-projects.json"), JSON.stringify([{ projectDir, title: "bench", lastOpenedAt: new Date().toISOString() }], null, 2));
  }
  for (let index = 0; index < warmup + runs; index += 1) {
    const load = loadavg()[0];
    const sample = await electronRun(projectDir, configHome);
    sample.load = Math.round(load * 10) / 10;
    console.error(`[run ${index}${index < warmup ? " warmup" : ""}] load ${sample.load} home ${sample.t.home}ms editor settled +${sample.t["editor.settled"]}ms`);
    if (index >= warmup) { samples.push(sample); meta.load.push(sample.load); }
  }
} else if (mode === "web") {
  const url = opt("url", null);
  if (!url) throw new Error("--url 이 필요합니다");
  const profileDir = resolve(opt("profile", join(homedir(), "fs-bench/web-profile")));
  for (let index = 0; index < warmup + runs; index += 1) {
    const load = loadavg()[0];
    const sample = await webRun(url, profileDir);
    sample.load = Math.round(load * 10) / 10;
    console.error(`[run ${index}${index < warmup ? " warmup" : ""}] load ${sample.load} fcp ${sample.t["editor.first-contentful-paint"]}ms settled ${sample.t["editor.settled"]}ms`);
    if (index >= warmup) { samples.push(sample); meta.load.push(sample.load); }
  }
} else {
  console.error("usage: startup-bench.mjs electron|web …");
  process.exit(2);
}

const report = { meta, median: summarize(samples), samples };
if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ meta: { ...meta, load: meta.load }, median: report.median }, null, 2));
if (!existsSync(join(REPO, "dist-electron/main.cjs")) && mode === "electron") console.error("dist-electron/main.cjs 가 없습니다 — npm run build:electron");
