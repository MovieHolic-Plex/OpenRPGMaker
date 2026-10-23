// 동료 따라다니기 — 한 번 부팅해 모퉁이·멈춤·되돌아가기·문 통과를 걷고, 프레임마다 주인공/동료 위치를 표본으로 남기고 영상을 굽는다.
//   node scripts/qa/runtime/fallen-follow.capture.mjs <project.json> <outDir> [--demo]   (진단 전용 · 게이트 아님)
// 판정: samples.json 의 동료-주인공 거리(칸)·동료 한 프레임 이동량(점프) · video.webm 1배 재생(구간 offsets.json).
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: fallen-follow.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-follow");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg ?? "tmp/fs-follow");
await mkdir(out, { recursive: true });
const MAP = process.env.FOLLOW_MAP ?? "fs_hub";
const START = (process.env.FOLLOW_START ?? "8,21").split(",").map(Number);
const report = { errors: [], notes: [], segments: [], moves: [] };

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: join(out, "raw"), size: { width: 480, height: 270 } } });
const t0 = Date.now();
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
const CP = { id: "hub-start", mapId: "fs_hub", x: 26, y: 23, facing: "down", party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }] };
await page.addInitScript((cp) => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-follow", qaInstrumentation: true, qaCheckpoint: cp }; }, CP);
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const teleport = async (mapId, x, y) => {
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 20000 });
  await page.waitForTimeout(900);
};
const press = async (dir, ms) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(ms); };
const dismiss = async () => { for (let i = 0; i < 12; i++) { const busy = (await present("dialogue-box")) || (await page.locator(".dialogue-box").count()) > 0; if (!busy) return; await page.keyboard.press("Enter"); await page.waitForTimeout(250); } };
// 정해진 칸 수만큼 걷는다 — 걸음이 시작될 때 좌표가 바뀌므로 목표 칸에 닿으면 키를 뗀다(맵이 바뀌면 거기서 끝).
const DELTA = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const walk = async (dir, tiles) => {
  await dismiss();
  const a = await live(); const [dx, dy] = DELTA[dir];
  const goal = [a.x + dx * tiles, a.y + dy * tiles];
  await page.evaluate((d) => window.__oprnInput.dir(d), dir);
  const until = Date.now() + tiles * 700 + 1500; let b = a;
  while (Date.now() < until) { await page.waitForTimeout(30); b = await live(); if (b.currentMapId !== a.currentMapId || (b.x === goal[0] && b.y === goal[1])) break; }
  await page.evaluate(() => window.__oprnInput.dir(null));
  report.moves.push({ dir, tiles, from: [a.currentMapId, a.x, a.y], to: [b.currentMapId, b.x, b.y] });
};
const startSampler = () => page.evaluate(() => {
  const s = window.__oprnHooksScene; window.__samples = []; window.__sampling = true; const t0 = performance.now();
  const tick = () => {
    if (!window.__sampling) return;
    const sc = window.__oprnHooksScene; const f = [...(sc.followerSprites?.values?.() ?? [])];
    window.__samples.push({ t: Math.round(performance.now() - t0), h: [sc.player.x, sc.player.y], f: f.map((p) => [p.x, p.y, p.visible !== false, p.frame?.name ?? null]), map: window.__oprnDebug.readLive().currentMapId });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const stopSampler = () => page.evaluate(() => { window.__sampling = false; return window.__samples; });
const hold = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(`${server.url}/player.html?demo=fallen-star&e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='runtime-state-json']", { state: "attached", timeout: 420000 }).catch(async (e) => { await page.screenshot({ path: join(out, "stuck.png") }); throw e; });
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 60000 });
  let quiet = 0;
  for (let i = 0; i < 200 && quiet < 5; i++) {
    const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen")) || (await page.locator(".dialogue-box").count()) > 0;
    quiet = busy ? 0 : quiet + 1;
    if (busy) await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  report.notes.push(`opening dismissed quiet=${quiet}`);
  await teleport(MAP, START[0], START[1]);
  await dismiss();
  report.notes.push("followers: " + JSON.stringify(await page.evaluate(() => (window.__oprnHooksScene.session.followers ?? []).map((f) => f.id))));
  await page.screenshot({ path: join(out, "start.png") });
  await startSampler();
  const seg = async (name, fn) => { const a = Date.now() - t0; await fn(); report.segments.push({ name, fromMs: a, toMs: Date.now() - t0 }); };
  // [이름, [[방향|"wait"|"teleport", 칸 수|ms|좌표]...]] — 모퉁이 · 멈춤 · 되돌아가기 · 문(허브 → 천문대) 통과.
  const script = JSON.parse(process.env.FOLLOW_SCRIPT ?? "null") ?? [
    ["corners", [["right", 6], ["up", 1], ["right", 5], ["down", 1], ["left", 3], ["wait", 900]]],
    ["stop-and-reverse", [["right", 4], ["wait", 1100], ["left", 2], ["right", 2], ["wait", 700]]],
    ["door", [["teleport", ["fs_hub", 22, 21]], ["right", 2], ["wait", 500], ["up", 2], ["up", 7], ["left", 3], ["up", 1], ["wait", 1000]]],
  ];
  for (const [name, steps] of script) await seg(name, async () => {
    for (const [d, n] of steps) {
      if (d === "teleport") { await teleport(...n); continue; }
      if (d === "wait") { await hold(n); continue; }
      await walk(d, n);
    }
  });
  const samples = await stopSampler();
  await writeFile(join(out, "samples.json"), JSON.stringify(samples));
  report.sampleCount = samples.length;
  await page.screenshot({ path: join(out, "end.png") });
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
