// 데스크톱 시작 화면 QA — 실제 Electron(dist-electron/main.cjs + dist/)을 띄워 컨셉 피드 → 상세 → 만들기 → 편집기 → 재기동까지 본다.
// (2026-10-07 컨셉 피드로 다시 씀. AI 가 연결 안 된 창이면 만들기가 연결 관문에서 멈춘다 — 「나중에」 로 폴더가 안 생기는지 보고,
//  편집기 왕복은 「빈 프로젝트로 시작」으로 본다. AI 가 연결돼 있으면 컨셉 기획이 저장됐는지까지 본다.)
//
// 사용자 데이터(최근 목록·localStorage)는 임시 --user-data-dir 로 격리한다. 사용자의 최근 목록을 건드리지 않는다.
// 새 게임 폴더는 OPRN_NEW_PROJECT_ROOT(임시)에 만든다 — 폴더 대화상자는 자동화할 수 없다.
//
//   npm run build:fast && npm run build:electron
//   xvfb-run -a node scripts/qa/electronStartScreenProbe.mjs
//
// 결과: verify-shots/start-screen/(OPRN_START_QA_OUT_NAME 로 바꿈) 의 PNG 와 probe.json.
// OPRN_START_QA_REAL=<폴더>:<폴더> 를 주면 실제 프로젝트를 **사본으로** 떠서 최근 목록에 더한다(원본에는 쓰지 않는다).
// 업로드 타일셋·접힌 타일셋(형식 2)·큰 맵에서도 시작 화면이 카드 그림을 굽는지 본다.
import { _electron as electron } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MAIN_BUNDLE = join(REPO_ROOT, "dist-electron/main.cjs");
const OUT_DIR = resolve(REPO_ROOT, "verify-shots", process.env.OPRN_START_QA_OUT_NAME ?? "start-screen");
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

// ── 1회차: 피드 → 상세 → 만들기 → 편집기 ──────────────────────────────
{
  const { app, page, errors } = await launch();
  await page.waitForSelector("[data-testid='concept-feed-card']", { timeout: 30_000 });
  // 편집기에서 한 번도 안 연 프로젝트(픽스처 마을)도 시작 화면이 직접 카드 그림을 굽는다.
  const coverDeadline = Date.now() + 20_000;
  const expected = [village, ...realProjects];
  while (expected.some((dir) => !existsSync(join(dir, "cover.jpg"))) && Date.now() < coverDeadline + realProjects.length * 20_000) await page.waitForTimeout(300);
  await page.waitForTimeout(800);
  await shot(page, "01-home");
  probe.home = await page.evaluate(() => ({
    url: location.href,
    feedCards: document.querySelectorAll("[data-testid='concept-feed-card']").length,
    offlineNote: !document.querySelector("[data-testid='concept-feed-offline']")?.hidden,
    continueCards: [...document.querySelectorAll(".cf-continue-title")].map((node) => node.textContent),
    continueImages: [...document.querySelectorAll(".cf-continue-card")].map((card) => Boolean(card.querySelector("img"))),
    hiddenNote: document.querySelector(".cf-continue-note")?.textContent ?? null,
    brokenThumbs: [...document.querySelectorAll(".cf-thumb-img")].filter((img) => img.complete && img.naturalWidth === 0).length,
  }));
  probe.home.neverOpenedCoverBytes = existsSync(join(village, "cover.jpg")) ? readFileSync(join(village, "cover.jpg")).length : 0;
  probe.home.realCovers = realProjects.map((dir) => ({ dir: basename(dir), bytes: existsSync(join(dir, "cover.jpg")) ? readFileSync(join(dir, "cover.jpg")).length : 0 }));
  // 빈 폴더(맵 없음) 프로젝트는 그림을 굽지 않는다 — 첫 글자로 남는다.
  probe.home.emptyProjectCover = existsSync(join(emptyGame, "cover.jpg"));

  await page.click("[data-testid='start-hidden-toggle']");
  await shot(page, "02-home-hidden-shown");
  await page.click("[data-testid='start-hidden-toggle']");

  // 내리면 더 나온다(비상용 번들이 24장 이하면 끝 표시만).
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(800);
  await shot(page, "03-scrolled");
  probe.scroll = await page.evaluate(() => ({ cards: document.querySelectorAll("[data-testid='concept-feed-card']").length }));

  // 분류 칩
  await page.click("[data-testid='concept-feed-chip-추리']");
  await page.waitForTimeout(600);
  probe.chip = await page.evaluate(() => ({ cards: [...document.querySelectorAll("[data-testid='concept-feed-card'] .cf-tags")].map((node) => node.textContent) }));
  await page.click("[data-testid='concept-feed-chip-전체']");
  await page.waitForTimeout(600);

  // 상세
  await page.locator("[data-testid='concept-feed-card']").first().click();
  await page.waitForSelector("[data-testid='concept-detail']:not([hidden])");
  await page.waitForTimeout(800);
  await shot(page, "04-detail");
  probe.detail = await page.evaluate(() => ({
    title: document.querySelector(".cf-detail-title")?.textContent ?? null,
    similar: document.querySelectorAll(".cf-mini").length,
  }));
  await page.fill("[data-testid='concept-detail-tweak']", "주인공을 고양이로");
  const before = existsSync(newRoot) ? readdirSync(newRoot).length : 0;
  await page.click("[data-testid='concept-detail-make']");
  const outcome = await Promise.race([
    page.waitForSelector("[data-testid='ai-connect-gate']", { timeout: 30_000 }).then(() => "gate"),
    page.waitForURL(/index\.html/, { timeout: 30_000 }).then(() => "editor"),
  ]).catch(() => "timeout");
  probe.make = { outcome };
  if (outcome === "gate") {
    await page.waitForTimeout(400);
    await shot(page, "05-make-ai-gate");
    await page.click("[data-testid='ai-connect-gate-later']");
    await page.waitForTimeout(600);
    probe.make.foldersAfterDecline = (existsSync(newRoot) ? readdirSync(newRoot).length : 0) - before;
    probe.make.makeEnabledAgain = await page.evaluate(() => !document.querySelector("[data-testid='concept-detail-make']")?.disabled);
    // 편집기 왕복은 빈 프로젝트로.
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-testid='concept-feed-blank']");
    await page.click("[data-testid='concept-feed-blank']");
  }
  let editorReady = true;
  try {
    await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 90_000, state: "visible" });
  } catch {
    editorReady = false;
  }
  await page.waitForTimeout(3_000);
  await shot(page, "06-editor-after-create");
  probe.editor = await page.evaluate(async () => {
    const status = await window.oprn.project.status();
    const loaded = await window.oprn.project.load({ projectDir: status.projectDir });
    const project = loaded?.serialized ? JSON.parse(loaded.serialized) : null;
    return {
      url: location.href,
      welcomeOverlay: Boolean(document.querySelector("[data-testid='concept-feed']")),
      projectDir: status.projectDir,
      savedTitle: project?.meta?.title ?? null,
      savedGenre: project?.system?.genre ?? null,
      savedConcept: project?.gameDesignBrief?.concept ?? null,
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
  await page.waitForSelector("[data-testid='start-continue']:not([hidden])", { timeout: 30_000 });
  await page.waitForTimeout(600);
  await shot(page, "07-home-after-create");
  probe.relaunch = await page.evaluate(() => ({
    continueCards: [...document.querySelectorAll(".cf-continue-title")].map((node) => node.textContent),
    firstHasCover: Boolean(document.querySelector(".cf-continue-card img")),
  }));
  // 좁은 창(세로 배치)
  await page.setViewportSize({ width: 720, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, "08-home-narrow");
  probe.relaunchErrors = errors.slice(0, 20);
  await shutdown(app);
}

writeFileSync(join(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));

// ── 첫 방문: 최근 작업이 하나도 없는 사용자 데이터 ──────────────────────
{
  writeFileSync(join(userData, "recent-projects.json"), "[]");
  const { app, page } = await launch();
  await page.waitForSelector("[data-testid='concept-feed-card']", { timeout: 30_000 });
  await page.waitForTimeout(800);
  await shot(page, "09-first-visit");
  probe.firstVisit = await page.evaluate(() => ({ continueHidden: Boolean(document.querySelector("[data-testid='start-continue']")?.hidden) }));
  await shutdown(app);
}
writeFileSync(join(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
// 임시 프로젝트·사용자 데이터를 치운다. 스크린샷과 probe.json 만 남긴다.
rmSync(scratch, { recursive: true, force: true });
rmSync(temporary, { recursive: true, force: true });
process.exit(0);
