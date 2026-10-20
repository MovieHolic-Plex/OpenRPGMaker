#!/usr/bin/env node
// 데스크톱 첫 화면 「라이브러리 홈」(2026-10-20) 실제 Electron 캡처 — 표지 캐시(userData/start-covers)가 시작 뒤 한가할 때 구워지는지까지 본다.
//
//   npm run build:fast && npm run build:electron
//   xvfb-run -a -s "-screen 0 2560x1440x24" node scripts/qa/electronHomeCapture.mjs [실제 프로젝트 폴더 ...]
//
// 사용자 데이터는 임시 --user-data-dir 로 격리한다. 실제 프로젝트는 **사본**(sqlite 백업 + assets)으로만 연다 — 원본에 쓰지 않는다.
// 결과: verify-shots/home-redesign-electron/ 의 home-<폭>.png · first-<폭>.png 와 probe.json.
import { _electron as electron } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MAIN_BUNDLE = join(REPO_ROOT, "dist-electron/main.cjs");
const OUT_DIR = resolve(REPO_ROOT, "verify-shots", "home-redesign-electron");
const FIXTURE_PROJECT = "test/fixtures/life-full.reloaded.project.json";
mkdirSync(OUT_DIR, { recursive: true });

// /tmp 아래는 시작 화면이 「임시 폴더」로 숨긴다 — 체크아웃 안 .vite-cache 에 만든다.
const scratch = join(REPO_ROOT, ".vite-cache", "home-qa-" + Date.now().toString(36));
const projectsRoot = join(scratch, "projects");
mkdirSync(projectsRoot, { recursive: true });

const store = (...args) => execFileSync("node", ["scripts/oprn-store.mjs", ...args], { cwd: REPO_ROOT, stdio: "pipe" });
const village = join(projectsRoot, "village");
store("init", village);
store("import-json", village, "--json", FIXTURE_PROJECT);

const copies = process.argv.slice(2).map((source, index) => {
  const copy = join(projectsRoot, `real-${index}-${basename(source)}`);
  mkdirSync(copy, { recursive: true });
  // WAL 이 남은 저장소도 온전히 뜨도록 sqlite 백업 API 로 복사한다(읽기 전용으로 연다).
  execFileSync("python3", ["-c", "import sqlite3,sys;s=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);d=sqlite3.connect(sys.argv[2]);s.backup(d);d.close()", join(source, "project.sqlite"), join(copy, "project.sqlite")]);
  if (existsSync(join(source, "assets"))) cpSync(join(source, "assets"), join(copy, "assets"), { recursive: true });
  return copy;
});

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
function seedUserData(name, entries) {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "recent-projects.json"), JSON.stringify(entries, null, 2));
  return dir;
}

async function capture(userData, label, sizes) {
  const app = await electron.launch({
    args: [MAIN_BUNDLE, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + userData],
    cwd: REPO_ROOT,
    env: { ...process.env, OPRN_RENDERER_DIR: join(REPO_ROOT, "dist") },
  });
  const result = { label, shots: [], errors: [] };
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (error) => result.errors.push(error.message));
    await page.setViewportSize({ width: sizes[0][0], height: sizes[0][1] });
    await page.waitForSelector("[data-testid='start-hero']", { timeout: 60_000 });
    // 표지는 목록이 뜬 뒤 한가할 때(2.5초 뒤부터) 한 장씩 굽는다.
    const deadline = Date.now() + 90_000;
    const coversDir = join(userData, "start-covers");
    const want = label === "home" ? 1 + copies.length : 0;
    const count = () => (existsSync(coversDir) ? readdirSync(coversDir).length : 0);
    while (count() < want && Date.now() < deadline) await page.waitForTimeout(500);
    await page.waitForTimeout(1500);
    result.coverFiles = existsSync(coversDir) ? readdirSync(coversDir) : [];
    result.cards = await page.evaluate(() => [...document.querySelectorAll(".hm-card .hm-cov")].map((node) => ({
      for: node.getAttribute("data-cover-for"), img: Boolean(node.querySelector("img")), empty: node.classList.contains("is-empty"),
    })));
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(700);
      const file = join(OUT_DIR, `${label}-${width}.png`);
      await page.screenshot({ path: file });
      result.shots.push(file);
    }
  } finally {
    await Promise.race([app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}), new Promise((r) => setTimeout(r, 3_000))]);
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 5_000))]);
  }
  return result;
}

const SIZES = [[1920, 1080], [2560, 1440]];
const probe = { scratch, runs: [] };
probe.runs.push(await capture(seedUserData("ud-home", [
  ...copies.map((projectDir, index) => ({ projectDir, title: projectDir, lastOpenedAt: iso(5 + index * 60) })),
  { projectDir: village, title: village, lastOpenedAt: iso(60 * 30) },
]), "home", SIZES));
probe.runs.push(await capture(seedUserData("ud-first", []), "first", SIZES));
writeFileSync(join(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
