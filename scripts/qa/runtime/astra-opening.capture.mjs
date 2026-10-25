// 『아스트라 호라이즌』 오프닝 — 출하 플레이어(player.html)에서 타이틀 앞 인트로 → 타이틀 → PRESS START → 새 게임 → 박사 소개를 1배속 영상으로 남긴다. (진단 전용 · 게이트 아님)
//   node scripts/qa/runtime/astra-opening.capture.mjs <play.json> <outDir> [--title-ms 14000] [--no-professor]
// 산출: video.webm(전체), intro.webm/mp4(인트로 구간), title.webm/mp4(타이틀 구간), professor.webm/mp4(박사 소개), frames/*.png, timeline.json.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const [projectArg, outArg] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--title"));
const titleMs = Number(flag("title-ms", "14000"));
const withProfessor = !args.includes("--no-professor");
if (!projectArg) throw new Error("usage: astra-opening.capture.mjs <play.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/astra-opening");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg ?? "tmp/astra-opening");
await mkdir(join(out, "frames"), { recursive: true });
const VW = 960, VH = 640;
const report = { errors: [], console: [], marks: {}, introShots: [], professorShots: [] };

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--autoplay-policy=no-user-gesture-required"] });
const present = (page, sel) => page.locator(sel).count().then((n) => n > 0);
const shotName = (tag, t) => join(out, "frames", `${tag}-${String(t).padStart(6, "0")}.png`);

async function followSequence(page, t0, tag, list) {
  let last = "", n = 0;
  while (await present(page, "[data-testid='cinematic-sequence']")) {
    const s = await page.evaluate(() => {
      const root = document.querySelector("[data-testid='cinematic-sequence']");
      const c = document.querySelector("[data-testid='opening-animatic-stage']");
      return { page: root?.dataset.page ?? "", time: Number(c?.dataset.timeMs ?? -1) };
    }).catch(() => null);
    if (!s) break;
    if (s.page && s.page !== last) { last = s.page; list.push({ page: s.page, atMs: Date.now() - t0, firstCanvasMs: s.time }); }
    if (n++ % 5 === 0) await page.screenshot({ path: shotName(`${tag}-p${s.page}`, Date.now() - t0) }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

function cut(src, name, startMs, endMs) {
  const ss = Math.max(0, startMs / 1000), dur = Math.max(0.5, (endMs - startMs) / 1000);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", ss.toFixed(2), "-i", src, "-t", dur.toFixed(2), "-c:v", "libvpx-vp9", "-b:v", "2.5M", "-an", join(out, `${name}.webm`)]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", ss.toFixed(2), "-i", src, "-t", dur.toFixed(2), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", "-an", join(out, `${name}.mp4`)]);
}

try {
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, recordVideo: { dir: join(out, "raw"), size: { width: VW, height: VH } } });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
  page.on("console", (m) => { if (m.type() === "error") report.console.push(m.text().slice(0, 200)); });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-opening", qaInstrumentation: true }; });
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  const t0 = Date.now();
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  // 1) 타이틀 앞 인트로.
  await page.waitForSelector("[data-testid='cinematic-sequence'], [data-testid='title-screen']", { state: "attached", timeout: 420000 });
  report.marks.introSeen = await present(page, "[data-testid='cinematic-sequence']");
  await followSequence(page, t0, "intro", report.introShots);
  report.marks.introEnd = Date.now() - t0;
  const first = report.introShots[0];
  report.marks.introStart = first && first.firstCanvasMs >= 0 ? first.atMs - first.firstCanvasMs : 0;
  // 2) 타이틀(별·달리기·PRESS START).
  await page.waitForSelector("[data-testid='title-screen']", { state: "attached", timeout: 60000 });
  report.marks.titleStart = Date.now() - t0;
  for (const at of [1500, 4000, 6500, 9000, 12000].filter((x) => x < titleMs)) {
    await page.waitForTimeout(at - (Date.now() - t0 - report.marks.titleStart));
    await page.screenshot({ path: shotName("title", at) });
  }
  await page.waitForTimeout(Math.max(0, titleMs - (Date.now() - t0 - report.marks.titleStart)));
  report.marks.pressStart = await page.evaluate(() => document.querySelector("[data-testid='title-screen']")?.dataset.pressStart ?? null);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  report.marks.afterPress = await page.evaluate(() => document.querySelector("[data-testid='title-screen']")?.dataset.pressStart ?? null);
  await page.screenshot({ path: shotName("title-menu", Date.now() - t0) });
  report.marks.titleEnd = Date.now() - t0;
  // 3) 새 게임 → 박사 소개.
  if (withProfessor) {
    for (let i = 0; i < 6 && !(await present(page, "[data-testid='cinematic-sequence']")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(700); }
    report.marks.profStart = Date.now() - t0;
    // 컷마다: 첫 장을 1.6초에 찍고, 컷 그림이 끝까지 돌 때까지(캔버스 시계) 기다린 뒤 Enter 한 번. 안 넘어가면 다시.
    const pageNow = () => page.evaluate(() => document.querySelector("[data-testid='cinematic-sequence']")?.dataset.page ?? "").catch(() => "");
    const canvasMs = () => page.evaluate(() => Number(document.querySelector("[data-testid='opening-animatic-stage']")?.dataset.timeMs ?? -1)).catch(() => -1);
    for (let guard = 0; guard < 16 && await present(page, "[data-testid='cinematic-sequence']"); guard++) {
      const s = await pageNow();
      report.professorShots.push({ page: s, atMs: Date.now() - t0 });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: shotName(`prof-p${s}`, Date.now() - t0) });
      for (let w = 0; w < 30 && (await canvasMs()) < 4300 && (await pageNow()) === s; w++) await page.waitForTimeout(250);
      await page.screenshot({ path: shotName(`prof-p${s}-end`, Date.now() - t0) });
      // 컷이 제 시간에 스스로 넘어가면 Enter 가 다음 컷을 건너뛴다 — 잠깐 기다려 본다.
      for (let w = 0; w < 8 && (await pageNow()) === s; w++) await page.waitForTimeout(250);
      for (let k = 0; k < 4 && (await pageNow()) === s && await present(page, "[data-testid='cinematic-sequence']"); k++) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(900);
      }
    }
    report.marks.profEnd = Date.now() - t0;
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shotName("after-prof", Date.now() - t0) });
    // 4) 방 첫 이벤트: 소년/소녀 고르기 → 별빛 쇼케이스 이름 짓기. 대사는 Enter 로 넘기고, 선택지에선 아래(소녀)를 고른다.
    report.marks.nameStart = Date.now() - t0;
    for (let i = 0; i < 24 && !(await present(page, "[data-testid='runtime-name-entry']")); i++) {
      const choice = await page.locator("[data-testid*='choice']").count().catch(() => 0);
      if (choice > 0 && !report.marks.choiceShot) { report.marks.choiceShot = true; await page.screenshot({ path: shotName("choice", Date.now() - t0) }); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(250); }
      await page.keyboard.press("Enter");
      await page.waitForTimeout(800);
    }
    report.marks.nameEntry = await present(page, "[data-testid='runtime-name-entry']");
    if (report.marks.nameEntry) {
      await page.waitForTimeout(1200);
      await page.keyboard.type("루나", { delay: 200 });
      await page.waitForTimeout(1400);
      await page.screenshot({ path: shotName("name-showcase", Date.now() - t0) });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(260);
      await page.screenshot({ path: shotName("name-confirm", Date.now() - t0) });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: shotName("name-after", Date.now() - t0) });
      // 박사 무대의 남은 대사 → 주인공이 작아지며 무대가 걷힌다 → 방. 넘길 때마다 0.35초 간격으로 세 장.
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Enter");
        for (const at of [350, 700, 1050]) { await page.waitForTimeout(350); await page.screenshot({ path: shotName(`stage-${i}-${at}`, Date.now() - t0) }); }
      }
    }
    report.marks.nameEnd = Date.now() - t0;
  }
  const video = page.video();
  await context.close();
  const raw = await video?.path();
  if (raw) await rename(raw, join(out, "video.webm"));
  const src = join(out, "video.webm");
  if (report.marks.introSeen) cut(src, "intro", Math.max(0, report.marks.introStart - 200), report.marks.introEnd + 400);
  cut(src, "title", report.marks.titleStart, report.marks.titleEnd);
  if (withProfessor && report.marks.profStart) cut(src, "professor", report.marks.profStart, report.marks.profEnd + 1000);
  if (report.marks.nameEntry) cut(src, "naming", report.marks.nameStart, report.marks.nameEnd);
} finally {
  await writeFile(join(out, "timeline.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ marks: report.marks, intro: report.introShots, prof: report.professorShots, errors: report.errors.slice(0, 5), console: report.console.slice(0, 5) }));
  await browser.close();
  await server.close();
}
