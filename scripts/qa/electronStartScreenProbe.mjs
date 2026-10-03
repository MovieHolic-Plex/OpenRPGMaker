// 데스크톱 시작 화면 QA — 실제 Electron(dist-electron/main.cjs + dist/)을 띄워 시작 화면 → 새 게임 → 편집기 → 재기동까지 본다.
//
// 사용자 데이터(최근 목록·localStorage)는 임시 --user-data-dir 로 격리한다. 사용자의 최근 목록을 건드리지 않는다.
// 새 게임 폴더는 OPRN_NEW_PROJECT_ROOT(임시)에 만든다 — 폴더 대화상자는 자동화할 수 없다.
//
//   npm run build:fast && npm run build:electron
//   xvfb-run -a node scripts/qa/electronStartScreenProbe.mjs
//
// 결과: verify-shots/start-screen/ 의 PNG 와 probe.json.
// OPRN_START_QA_REAL=<폴더>:<폴더> 를 주면 실제 프로젝트를 **사본으로** 떠서 최근 목록에 더한다(원본에는 쓰지 않는다).
// 업로드 타일셋·접힌 타일셋(형식 2)·큰 맵에서도 시작 화면이 카드 그림을 굽는지 본다.
import { _electron as electron } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MAIN_BUNDLE = join(REPO_ROOT, "dist-electron/main.cjs");
const OUT_DIR = resolve(REPO_ROOT, "verify-shots/start-screen");
const FIXTURE_PROJECT = "test/fixtures/life-full.reloaded.project.json";
mkdirSync(OUT_DIR, { recursive: true });

// /tmp 아래는 시작 화면이 「임시 폴더」로 숨긴다. 보이는 프로젝트는 임시 폴더 밖(체크아웃 안 .vite-cache)에 만든다.
const scratch = join(REPO_ROOT, ".vite-cache", "start-qa-" + Date.now().toString(36));
const userData = join(scratch, "user-data");
const projectsRoot = join(scratch, "projects");
const newRoot = join(scratch, "new-games");
mkdirSync(userData, { recursive: true });
mkdirSync(projectsRoot, { recursive: true });

const store = (...args) => execFileSync("node", ["scripts/oprn-store.mjs", ...args], { cwd: REPO_ROOT, stdio: "pipe" });
const village = join(projectsRoot, "village");
store("init", village);
store("import-json", village, "--json", FIXTURE_PROJECT);
const emptyGame = join(projectsRoot, "empty");
store("init", emptyGame);
const temporary = mkdtempSync(join(tmpdir(), "oprn-packaged-"));
store("init", temporary);
const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
const realProjects = (process.env.OPRN_START_QA_REAL ?? "").split(":").filter(Boolean).map((source, index) => {
  const copy = join(projectsRoot, "real-" + index + "-" + basename(source));
  // project.sqlite 와 assets/ 만 뜬다 — WAL 이 비어 있는(닫힌) 저장소여야 사본이 온전하다.
  mkdirSync(copy, { recursive: true });
  cpSync(join(source, "project.sqlite"), join(copy, "project.sqlite"));
  if (existsSync(join(source, "assets"))) cpSync(join(source, "assets"), join(copy, "assets"), { recursive: true });
  return copy;
});
writeFileSync(join(userData, "recent-projects.json"), JSON.stringify([
  { projectDir: temporary, title: temporary, lastOpenedAt: iso(5) },
  { projectDir: village, title: village, lastOpenedAt: iso(90) },
  ...realProjects.map((projectDir, index) => ({ projectDir, title: projectDir, lastOpenedAt: iso(120 + index) })),
  { projectDir: join(projectsRoot, "gone"), title: "사라진 폴더", lastOpenedAt: iso(600) },
  { projectDir: emptyGame, title: "빈 폴더 게임", lastOpenedAt: iso(60 * 30) },
], null, 2));

async function launch() {
  const app = await electron.launch({
    args: [MAIN_BUNDLE, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + userData],
    cwd: REPO_ROOT,
    env: { ...process.env, OPRN_RENDERER_DIR: join(REPO_ROOT, "dist"), OPRN_NEW_PROJECT_ROOT: newRoot },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.waitForLoadState("domcontentloaded");
  return { app, page, errors };
}

async function shutdown(app) {
  await Promise.race([app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}), new Promise((r) => setTimeout(r, 3_000))]);
  await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 5_000))]);
  try { const child = app.process(); if (child?.exitCode === null) child.kill("SIGKILL"); } catch { /* 이미 끝났다 */ }
}

const shot = (page, name) => page.screenshot({ path: join(OUT_DIR, name + ".png"), fullPage: false });
const probe = { scratch };

// ── 1회차: 시작 화면 → 새 게임 → 편집기 ────────────────────────────────
{
  const { app, page, errors } = await launch();
  await page.waitForSelector("[data-testid='start-continue'], .start-hero", { timeout: 30_000 });
  // 편집기에서 한 번도 안 연 프로젝트(픽스처 마을)도 시작 화면이 직접 카드 그림을 굽는다.
  const coverDeadline = Date.now() + 20_000;
  const expected = [village, ...realProjects];
  while (expected.some((dir) => !existsSync(join(dir, "cover.jpg"))) && Date.now() < coverDeadline + realProjects.length * 20_000) await page.waitForTimeout(300);
  await page.waitForTimeout(400);
  await shot(page, "01-home");
  probe.home = await page.evaluate(() => ({
    url: location.href,
    continueTitle: document.querySelector("[data-testid='start-continue'] .start-hero-title")?.textContent ?? null,
    continueHasCover: Boolean(document.querySelector("[data-testid='start-continue'] img")),
    cards: [...document.querySelectorAll(".start-card-title")].map((node) => node.textContent),
    hiddenNote: document.querySelector(".start-hidden-note")?.textContent ?? null,
    stylesheetRules: [...document.styleSheets].reduce((sum, sheet) => sum + sheet.cssRules.length, 0),
  }));
  probe.home.neverOpenedCoverBytes = existsSync(join(village, "cover.jpg")) ? readFileSync(join(village, "cover.jpg")).length : 0;
  probe.home.realCovers = realProjects.map((dir) => ({ dir: basename(dir), bytes: existsSync(join(dir, "cover.jpg")) ? readFileSync(join(dir, "cover.jpg")).length : 0 }));
  probe.home.cardImages = await page.evaluate(() => [...document.querySelectorAll(".start-card")].map((card) => ({
    title: card.querySelector(".start-card-title")?.textContent ?? null,
    hasImage: Boolean(card.querySelector("img")),
  })));
  // 빈 폴더(맵 없음) 프로젝트는 그림을 굽지 않는다 — 첫 글자로 남는다.
  probe.home.emptyProjectCover = existsSync(join(emptyGame, "cover.jpg"));

  await page.click("[data-testid='start-hidden-toggle']");
  await shot(page, "02-home-hidden-shown");
  await page.click("[data-testid='start-hidden-toggle']");

  await page.click("[data-testid='start-new-game']");
  await page.waitForFunction(() => document.querySelector("[data-testid='start-location']")?.textContent?.includes("/"), null, { timeout: 10_000 });
  await page.click("[data-testid='start-genre-option-monster-collect']");
  await page.fill("[data-testid='start-intent-input']", "풀숲에서 첫 몬스터를 만나는 마을");
  await page.locator(".start-arrival-settings summary").click();
  await page.fill("[data-testid='start-title-input']", "QA 몬스터 마을");
  await page.waitForFunction(() => document.querySelector("[data-testid='start-location']")?.textContent?.endsWith("QA 몬스터 마을"), null, { timeout: 10_000 });
  await shot(page, "03-new-game");
  probe.newGame = await page.evaluate(() => ({
    location: document.querySelector("[data-testid='start-location']")?.textContent ?? null,
    pressed: [...document.querySelectorAll(".first-world-poster[aria-pressed='true']")].map((node) => node.getAttribute("data-testid")),
  }));

  await page.click("[data-testid='start-create']");
  let editorReady = true;
  try {
    await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 90_000, state: "visible" });
  } catch {
    editorReady = false;
  }
  await page.waitForTimeout(3_000);
  await shot(page, "04-editor-after-create");
  probe.editor = await page.evaluate(async () => {
    const status = await window.oprn.project.status();
    const loaded = await window.oprn.project.load({ projectDir: status.projectDir });
    const project = loaded?.serialized ? JSON.parse(loaded.serialized) : null;
    return {
      url: location.href,
      welcomeOverlay: Boolean(document.querySelector("[data-testid='editor-welcome']")),
      // AI 가 없는 QA 창에서는 한 문장이 보내지지 않고 조수 입력창에 담긴다 — 그 안내가 떠야 한다.
      handoffNotice: (document.body.innerText ?? "").includes("적어 둔 한 문장을 조수 입력창에 담았습니다"),
      handoffTextOnPage: (document.body.innerText ?? "").includes("풀숲에서 첫 몬스터를 만나는 마을")
        || [...document.querySelectorAll("textarea, [contenteditable='true']")].some((node) => (node.value ?? node.textContent ?? "").includes("풀숲에서 첫 몬스터를 만나는 마을")),
      projectDir: status.projectDir,
      savedTitle: project?.meta?.title ?? null,
      savedGenre: project?.system?.genre ?? null,
      monsterCollection: project?.system?.monsterCollection ?? null,
    };
  });
  probe.editor.editorReady = editorReady;
  // 대표 그림은 부팅 4초 뒤 한 번 굽는다.
  const coverPath = probe.editor.projectDir ? join(probe.editor.projectDir, "cover.jpg") : "";
  const deadline = Date.now() + 20_000;
  while (coverPath && !existsSync(coverPath) && Date.now() < deadline) await page.waitForTimeout(500);
  probe.editor.cover = coverPath && existsSync(coverPath) ? readFileSync(coverPath).length : 0;
  probe.firstRunErrors = errors.slice(0, 20);
  await shutdown(app);
}

// ── 2회차: 재기동하면 방금 만든 게임이 「이어서 만들기」 첫 장에 그림과 함께 있다 ──────
{
  const { app, page, errors } = await launch();
  await page.waitForSelector("[data-testid='start-continue']", { timeout: 30_000 });
  await page.waitForTimeout(400);
  await shot(page, "05-home-after-create");
  probe.relaunch = await page.evaluate(() => ({
    continueTitle: document.querySelector("[data-testid='start-continue'] .start-hero-title")?.textContent ?? null,
    continueHasCover: Boolean(document.querySelector("[data-testid='start-continue'] img")),
    cards: [...document.querySelectorAll(".start-card-title")].map((node) => node.textContent),
  }));
  // 좁은 창(세로 배치)
  await page.setViewportSize({ width: 720, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, "06-home-narrow");
  probe.relaunchErrors = errors.slice(0, 20);
  await shutdown(app);
}

writeFileSync(join(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));

// ── 첫 방문: 최근 작업이 하나도 없는 사용자 데이터 ──────────────────────
{
  writeFileSync(join(userData, "recent-projects.json"), "[]");
  const { app, page } = await launch();
  await page.waitForSelector(".start-hero.is-welcome", { timeout: 30_000 });
  await page.waitForTimeout(600);
  await shot(page, "07-first-visit");
  await shutdown(app);
}
writeFileSync(join(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
// 임시 프로젝트·사용자 데이터를 치운다. 스크린샷과 probe.json 만 남긴다.
rmSync(scratch, { recursive: true, force: true });
rmSync(temporary, { recursive: true, force: true });
process.exit(0);
