// 폴른 스타 1막 장면 확인 — 한 번 부팅해 (A)포고·토비 소원 복선 (B)이리스 깨어남 (C)천문대 일지 (D)엔딩 클리프행어를 읽는 속도로 넘기며
// 영상(video.webm, 구간 offsets.json)과 상자마다 프레임(frames/<장면>-NN.png)을 남긴다. (진단 전용 · 게이트 아님)
//   node scripts/qa/runtime/fallen-scenes1.capture.mjs <project.json> <outDir>
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: fallen-scenes1.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-scenes1");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg ?? "tmp/fs-scenes1");
await mkdir(join(out, "frames"), { recursive: true });
const report = { errors: [], notes: [], segments: [] };
const READ_MS = Number(process.env.READ_MS ?? 1500);

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: join(out, "raw"), size: { width: 480, height: 270 } } });
const t0 = Date.now();
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-scenes1", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const ONLY = process.env.ONLY || "";
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const busy = async () => (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen")) || (await present("ending-screen")) || (await page.locator(".dialogue-box").count()) > 0;
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const teleport = async (mapId, x, y) => {
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 20000 });
  await page.waitForTimeout(1200);
};
const face = async (dir) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(260); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(300); };
const setSw = (ids) => page.evaluate((a) => { for (const id of a) window.__oprnDebug.setSwitch(id, true); }, ids);
// 장면 하나: 상자·연출이 끝날 때까지 읽는 속도로 Enter. 상자마다 프레임을 남긴다.
const scene = async (name, { maxRounds = 140, quietNeeded = 4, interact = false, picks = [] } = {}) => {
  const from = Date.now() - t0; let n = 0, quiet = 0, pickAt = 0;
  if (interact) { await page.keyboard.press("Enter"); await page.waitForTimeout(900); }
  for (let i = 0; i < maxRounds && quiet < quietNeeded; i++) {
    if (await present("runtime-choices")) {
      quiet = 0; const k = picks[pickAt++] ?? 0;
      await page.screenshot({ path: join(out, "frames", `${name}-${String(n++).padStart(2, "0")}-choice.png`) });
      for (let j = 0; j < k; j++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(250); }
      await page.keyboard.press("Enter");
    } else if (await busy()) { quiet = 0; await page.screenshot({ path: join(out, "frames", `${name}-${String(n++).padStart(2, "0")}.png`) }); await page.keyboard.press("Enter"); }
    else { quiet++; if (n > 0 && quiet === 2) await page.screenshot({ path: join(out, "frames", `${name}-${String(n++).padStart(2, "0")}-after.png`) }); }
    await page.waitForTimeout(READ_MS);
  }
  report.segments.push({ name, fromMs: from, toMs: Date.now() - t0, boxes: n });
};

try {
  await page.goto(`${server.url}/player.html?demo=chrono-bell&e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { state: "attached", timeout: 420000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "frames", "title.png") });
  for (let i = 0; i < 8 && (await present("title-screen")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(900); }
  await page.waitForSelector("[data-testid='runtime-state-json']", { state: "attached", timeout: 120000 }).catch(async (e) => { await page.screenshot({ path: join(out, "stuck.png") }); throw e; });
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 60000 });
  // A. 오프닝 → 포고(F2: 토비의 소원)
  // ONLY 로 일부만 찍을 때도 오프닝 연출은 먼저 흘려보내야 뒤 장면의 상호작용이 막히지 않는다.
  await scene(!ONLY || ONLY === "A" ? "A-open-proclamation" : "warm-open", { maxRounds: 260, quietNeeded: 12 });
  report.notes.push("after A: " + JSON.stringify(await live()).slice(0, 160));
  // B. 이리스 깨어남(8-5)
  await setSw(["sw_fs_main_started", "sw_fs_main_step0"]);
  await teleport("fs_forest", 15, 8); await face("up");
  if (!ONLY || ONLY === "B") await scene("B-iris-wake", { quietNeeded: 6, interact: true, picks: [1, 2, 1], maxRounds: 200 });
  report.notes.push("after B: " + JSON.stringify(await live()).slice(0, 160));
  // C. 천문대 일지(9-A/9-B)
  await setSw(["sw_fs_main_started", "sw_fs_main_step0", "sw_fs_main_step1", "sw_fs_iris_awake", "sw_fs_iris_joined", "sw_fs_q_bread_done"]);
  await teleport("fs_observatory", 13, 12); await face("up");
  if (!ONLY || ONLY === "C") await scene("C-scope-journal", { quietNeeded: 6, interact: true });
  // D. 엔딩(13-2~13-4)
  await setSw(["sw_fs_main_started", "sw_fs_main_step0", "sw_fs_main_step1", "sw_fs_main_step2", "sw_fs_iris_awake", "sw_fs_iris_joined", "sw_fs_q_bread_done", "sw_fs_scope_journal_played"]);
  await teleport("fs_observatory", 12, 13); await face("up");
  await scene("D-ending", { maxRounds: 220, quietNeeded: 10, interact: true });
  for (let i = 0; i < 12 && !(await present("ending-screen")); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  report.notes.push("ending-screen: " + (await present("ending-screen")));
  await page.screenshot({ path: join(out, "frames", "D-final.png") });
} finally {
  await page.evaluate(() => window.__oprnInput?.dir?.(null)).catch(() => {});
  const video = page.video();
  await context.close();
  const p = await video?.path();
  if (p) await rename(p, join(out, "video.webm"));
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ notes: report.notes, errors: report.errors.slice(0, 5), segments: report.segments }));
  await browser.close();
  await server.close();
}
