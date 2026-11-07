// Short auto-play smoke of one built game in the shipped player (dist/export-player through wholeGamePlayer --serve).
//   node scripts/game-factory/smoke.mjs <game dir> [--seconds 60]
// PASS = the player boots, a new game reaches a field map, <seconds> of input runs, and no page error or console error
// is raised. Writes <game dir>/smoke/{result.json,frames/*.png}. Frames are kept for the dashboard video.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { firefox } from "playwright";

const game = resolve(process.argv[2] ?? "");
const secIdx = process.argv.indexOf("--seconds");
const SECONDS = secIdx > 0 ? Number(process.argv[secIdx + 1]) : 60;
const out = resolve(game, "smoke");
mkdirSync(resolve(out, "frames"), { recursive: true });
const t0 = Date.now();
const result = { seconds: SECONDS, booted: false, reachedMap: null, mapsSeen: [], moves: 0, errors: [], frames: [], verdict: "FAIL", reason: "" };
const save = () => writeFileSync(resolve(out, "result.json"), JSON.stringify({ ...result, wallSec: (Date.now() - t0) / 1000 }, null, 2));

const server = spawn(process.execPath, ["src/harnesses/assistant-capability/node/wholeGamePlayer.mjs", "--project-dir", resolve(game, "project"), "--out", resolve(out, "serve"), "--serve"],
  { env: { ...process.env, HARNESS_DIST_DIR: "dist" }, stdio: ["ignore", "ignore", "pipe"] });
let serverErr = "";
server.stderr.on("data", (c) => { serverErr = (serverErr + c).slice(-2000); });
let browser;
try {
  const urlFile = resolve(out, "serve", "player-url.json");
  for (let i = 0; i < 180 && !existsSync(urlFile); i += 1) {
    if (server.exitCode !== null) throw new Error(`player server exited: ${serverErr.slice(-400)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!existsSync(urlFile)) throw new Error("player server did not start in 180 s");
  const { playUrl, boot } = JSON.parse(readFileSync(urlFile, "utf8"));
  browser = await firefox.launch({ firefoxUserPrefs: { "network.notify.changed": false, "network.captive-portal-service.enabled": false, "network.connectivity-service.enabled": false } });
  const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
  page.on("pageerror", (e) => result.errors.push({ kind: "pageerror", text: String(e.message).slice(0, 300) }));
  page.on("console", (m) => { if (m.type() === "error") result.errors.push({ kind: "console", text: m.text().slice(0, 300) }); });
  await page.addInitScript((b) => { localStorage.clear(); window.__OPENRPG_BOOT__ = { ...b, qaInstrumentation: true }; }, boot);
  await page.goto(playUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  const state = () => page.evaluate(() => { const s = window.__oprnDebug?.readState?.(); return s ? { map: s.currentMapId ?? null, x: s.x, y: s.y } : null; }).catch(() => null);
  const frame = async (name) => { const f = resolve(out, "frames", `${String(result.frames.length).padStart(2, "0")}-${name}.png`); await page.screenshot({ path: f }); result.frames.push({ file: f, at: (Date.now() - t0) / 1000, name }); };
  await page.waitForTimeout(6000);
  result.booted = true;
  await frame("title");
  // Title -> new game -> opening: Enter advances every screen; the field is reached once the debug state names a map.
  for (let i = 0; i < 40 && !result.reachedMap; i += 1) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    const s = await state();
    if (s?.map) result.reachedMap = s.map;
  }
  if (!result.reachedMap) { result.reason = "no field map after 40 Enter presses"; await frame("stuck"); }
  else {
    await frame("first-map");
    const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
    const end = Date.now() + SECONDS * 1000;
    let last = await state(); let n = 0;
    while (Date.now() < end) {
      const key = n % 7 === 6 ? "Enter" : keys[Math.floor(n / 3) % 4];
      await page.keyboard.down(key); await page.waitForTimeout(260); await page.keyboard.up(key);
      n += 1;
      const s = await state();
      if (s && last && (s.x !== last.x || s.y !== last.y || s.map !== last.map)) result.moves += 1;
      if (s?.map && !result.mapsSeen.includes(s.map)) result.mapsSeen.push(s.map);
      last = s ?? last;
      if (n % 40 === 0) await frame(`play-${n}`);
    }
    await frame("end");
    result.verdict = result.errors.length ? "FAIL" : "PASS";
    result.reason = result.errors.length ? `${result.errors.length} page/console error(s)` : `reached ${result.reachedMap}, ${result.moves} moves`;
  }
} catch (error) {
  result.reason = `smoke crashed: ${String(error?.message ?? error).slice(0, 300)}`;
} finally {
  await browser?.close().catch(() => {});
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  if (server.exitCode === null) server.kill("SIGKILL");
  save();
}
process.exit(result.verdict === "PASS" ? 0 : 1);
