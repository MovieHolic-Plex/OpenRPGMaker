// 『폴른 스타』 영화식 오프닝 — 출하 플레이어(player.html)에서 타이틀 → 새 게임 → 오프닝을 1배속 영상으로 남긴다. (진단 전용 · 게이트 아님)
//   node scripts/qa/runtime/fallen-opening.capture.mjs <play.json> <outDir> [--skip-test]
// 산출: video.webm(전체), opening.webm(오프닝 구간만, 1배), timeline.json(컷 시작 시각·캔버스 시계), frames/*.png(컷마다 몇 장).
// --skip-test: 두 번째 부팅에서 오프닝 3초 뒤 「건너뛰기」 단추를 탭해 바로 맵으로 넘어가는지 본다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const skipTest = process.argv.includes("--skip-test");
if (!projectArg) throw new Error("usage: fallen-opening.capture.mjs <play.json> <outDir> [--skip-test]");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-opening");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg ?? "tmp/fs-opening");
await mkdir(join(out, "frames"), { recursive: true });
const VW = 960, VH = 540;
const report = { errors: [], console: [], shots: [], openingStartMs: 0, openingEndMs: 0, skip: null };

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--autoplay-policy=no-user-gesture-required"] });

async function boot(recordVideo) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, ...(recordVideo ? { recordVideo: { dir: join(out, "raw"), size: { width: VW, height: VH } } } : {}) });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
  page.on("console", (m) => { if (m.type() === "error") report.console.push(m.text().slice(0, 200)); });
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-opening", qaInstrumentation: true }; });
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { state: "attached", timeout: 420000 });
  await page.waitForFunction(() => document.querySelector("[data-testid='title-screen']")?.getAttribute("data-seq-state") === "done", undefined, { timeout: 60000 }).catch(() => {});
  return { context, page };
}
const present = (page, id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
async function startNewGame(page) {
  for (let i = 0; i < 6 && !(await present(page, "cinematic-sequence")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(700); }
  await page.waitForSelector("[data-testid='cinematic-sequence']", { state: "attached", timeout: 30000 });
}

try {
  const t0 = Date.now();
  const { context, page } = await boot(true);
  await page.waitForTimeout(1200);
  await startNewGame(page);
  report.openingStartMs = Date.now() - t0;
  // 컷이 바뀔 때마다(캔버스 data-time-ms 가 작아질 때) 시각을 적고, 컷마다 처음·가운데·끝 무렵을 찍는다.
  let lastPage = "", n = 0;
  while (await present(page, "cinematic-sequence")) {
    const state = await page.evaluate(() => {
      const root = document.querySelector("[data-testid='cinematic-sequence']");
      const c = document.querySelector("[data-testid='opening-animatic-stage']");
      return { page: root?.dataset.page ?? "", time: Number(c?.dataset.timeMs ?? -1), media: root?.dataset.mediaState ?? "" };
    }).catch(() => null);
    if (!state) break;
    if (state.page && state.page !== lastPage) { lastPage = state.page; report.shots.push({ page: state.page, atMs: Date.now() - t0, firstCanvasMs: state.time }); }
    if (n++ % 6 === 0) await page.screenshot({ path: join(out, "frames", `p${state.page}-${String(Date.now() - t0).padStart(6, "0")}.png`) }).catch(() => {});
    await page.waitForTimeout(250);
  }
  report.openingEndMs = Date.now() - t0;
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, "frames", "after-handoff.png") });
  report.afterHandoff = await page.evaluate(() => window.__oprnDebug?.readState?.()?.currentMapId ?? null).catch(() => null);
  const video = page.video();
  await context.close();
  const raw = await video?.path();
  if (raw) await rename(raw, join(out, "video.webm"));
  // 오프닝 구간만 잘라 1배속 그대로 둔다(재인코딩 — 키프레임 경계와 무관하게 정확히 자른다).
  // 첫 컷의 캔버스 시계로 실제 시작 시각을 되짚는다(폴링 간격만큼 늦게 본다).
  const first = report.shots[0];
  if (first && first.firstCanvasMs >= 0) report.openingStartMs = Math.min(report.openingStartMs, first.atMs - first.firstCanvasMs);
  const ss = Math.max(0, report.openingStartMs / 1000 - 0.3), dur = (report.openingEndMs - report.openingStartMs) / 1000 + 1.8;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", ss.toFixed(2), "-i", join(out, "video.webm"), "-t", dur.toFixed(2), "-c:v", "libvpx-vp9", "-b:v", "2.5M", "-an", join(out, "opening.webm")]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", ss.toFixed(2), "-i", join(out, "video.webm"), "-t", dur.toFixed(2), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", "-an", join(out, "opening.mp4")]);

  if (skipTest) {
    const { context: c2, page: p2 } = await boot(false);
    await startNewGame(p2);
    await p2.waitForTimeout(3600);
    const before = Date.now();
    report.skip = { button: await p2.evaluate(() => { const b = document.querySelector("[data-testid='cinematic-skip']"); if (!b) return null; const r = b.getBoundingClientRect(), cs = getComputedStyle(b); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { r: [r.x, r.y, r.width, r.height], opacity: cs.opacity, pe: cs.pointerEvents, top: top?.className ?? top?.tagName }; }) };
    await p2.screenshot({ path: join(out, "frames", "before-skip.png") });
    await p2.locator("[data-testid='cinematic-skip']").first().click({ timeout: 8000 });
    await p2.waitForSelector("[data-testid='cinematic-sequence']", { state: "detached", timeout: 15000 });
    report.skip.tapToGoneMs = Date.now() - before;
    await p2.waitForTimeout(2000);
    report.skip.mapId = await p2.evaluate(() => window.__oprnDebug?.readState?.()?.currentMapId ?? null).catch(() => null);
    await p2.screenshot({ path: join(out, "frames", "after-skip.png") });
    await c2.close();
  }
} finally {
  await writeFile(join(out, "timeline.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ shots: report.shots, start: report.openingStartMs, end: report.openingEndMs, afterHandoff: report.afterHandoff, skip: report.skip, errors: report.errors.slice(0, 5), console: report.console.slice(0, 5) }));
  await browser.close();
  await server.close();
}
