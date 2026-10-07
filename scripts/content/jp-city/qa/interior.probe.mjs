// 일본 집 실내 런타임 QA — 출하 player.html 에서 «현관에서 방향 입력으로 걸어 복도 계단을 밟으면 2층, 2층 계단통 아랫줄을 밟으면 1층 계단 앞,
// 화실·LDK·부엌·탈의실·화장실에 걸어 들어간다, 원룸도 현관에서 방까지 걷는다».
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/interior.probe.mjs'
// 증거: verify-shots/jp-city/interior-runtime/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/interior-runtime");
const FIXTURE = "/tmp/oprn-jp-interior-fixture.json";
const PROJECT_URL = "/__qa/interior.json";
const F1 = "jp-city-house-1f", F2 = "jp-city-house-2f", APT = "jp-city-apartment-1k";
const failures = [], lines = [];
const record = (ok, label, detail) => { lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`); if (!ok) failures.push(label); };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/interior-fixture.mts", "--out", FIXTURE], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const log = [];
  page.on("pageerror", (e) => log.push(String(e?.message ?? e).split("\n")[0]));
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((u) => { try { localStorage.clear(); } catch { /* 없음 */ } window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: "runtime-qa:jp-interior", qaInstrumentation: true }; }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 90_000 });
  await page.addStyleTag({ content: "[data-testid='field-hud']{visibility:hidden!important}" });
  await page.waitForTimeout(800);
  const state = () => page.evaluate(() => window.__oprnDebug.readState());
  const s0 = await state();
  record(s0.currentMapId === F1 && s0.x === 9 && s0.y === 13, "시작 = 1층 현관 타타키 (9,13)", `${s0.currentMapId} (${s0.x},${s0.y})`);
  await page.screenshot({ path: join(OUT, "genkan.png") });
  const DIRS = { up: "up", down: "down", left: "left", right: "right" };
  /** 한 칸씩 — dir(d)→dir(null) 이 한 걸음(첫 탭은 방향만 바뀔 수 있어 2번까지). */
  const stepTo = async (d, want, map) => {
    let st;
    for (let i = 0; i < 2; i++) {
      await page.evaluate((x) => { window.__oprnInput.dir(x); window.__oprnInput.dir(null); }, DIRS[d]);
      await page.waitForTimeout(650);
      st = await state();
      if (st.currentMapId !== map || (st.x === want[0] && st.y === want[1])) break;
    }
    return st;
  };
  const walk = async (label, map, path) => {
    const trail = [];
    let ok = true, st = await state();
    for (const [d, x, y] of path) {
      st = await stepTo(d, [x, y], map);
      trail.push(`${st.x},${st.y}`);
      if (st.currentMapId !== map || st.x !== x || st.y !== y) { ok = false; break; }
    }
    record(ok, label, trail.join(" → "));
    return ok;
  };
  // 현관 → 아가리카마치 → 복도 → 화실(서쪽 3줄 틈 y11) 안으로
  await walk("현관 타타키 → 마루(아가리카마치 줄) → 화실 안까지 걷는다", F1, [["up", 9, 12], ["up", 9, 11], ["left", 8, 11], ["left", 7, 11], ["left", 6, 11], ["left", 5, 11], ["up", 5, 10]]);
  await page.screenshot({ path: join(OUT, "washitsu.png") });
  await walk("화실 → 복도 → LDK(동쪽 3줄 틈) → 식탁 옆 → 부엌 통로", F1, [["down", 5, 11], ["right", 6, 11], ["right", 7, 11], ["right", 8, 11], ["right", 9, 11], ["right", 10, 11], ["right", 11, 11], ["right", 12, 11], ["right", 13, 11],
    ["up", 13, 10], ["right", 14, 10], ["right", 15, 10], ["right", 16, 10], ["right", 17, 10], ["right", 18, 10], ["up", 18, 9], ["up", 18, 8], ["up", 18, 7], ["up", 18, 6], ["right", 19, 6], ["up", 19, 5], ["up", 19, 4], ["left", 18, 4], ["left", 17, 4]]);
  await page.screenshot({ path: join(OUT, "kitchen.png") });
  // 복도 → 탈의실(가로 틈 x8) · 화장실(가로 틈 x11)
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 8, 10), [F1]);
  await page.waitForTimeout(500);
  await walk("복도 → 탈의실(가로 칸막이 틈 1칸) → 욕실(세로 칸막이 3줄 틈)", F1, [["up", 8, 9], ["up", 8, 8], ["up", 8, 7], ["up", 8, 6], ["up", 8, 5], ["left", 7, 5], ["left", 6, 5], ["left", 5, 5], ["left", 4, 5]]);
  await page.screenshot({ path: join(OUT, "bath.png") });
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 11, 10), [F1]);
  await page.waitForTimeout(500);
  await walk("복도 → 화장실", F1, [["up", 11, 9], ["up", 11, 8], ["up", 11, 7], ["up", 11, 6], ["up", 11, 5]]);
  // 계단: (9,10) 에서 위 → 계단 발칸 (9,9) = 2층
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 9, 10), [F1]);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__oprnInput.face("up"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "stairs-1f.png") });
  let st;
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { window.__oprnInput.dir("up"); window.__oprnInput.dir(null); }); await page.waitForTimeout(900); st = await state(); if (st.currentMapId === F2) break; }
  record(st.currentMapId === F2 && st.x === 9 && st.y === 5, "1층 계단 발칸 (9,9) 을 밟으면 2층 계단통 앞 (9,5)", `${st.currentMapId} (${st.x},${st.y})`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "arrive-2f.png") });
  await walk("2층 복도 → 아이방(세로 3줄 틈 y7) 책상 앞", F2, [["down", 9, 6], ["down", 9, 7], ["right", 10, 7], ["right", 11, 7], ["right", 12, 7], ["right", 13, 7], ["right", 14, 7], ["right", 15, 7], ["right", 16, 7], ["up", 16, 6], ["up", 16, 5]]);
  await page.screenshot({ path: join(OUT, "kids.png") });
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 10, 5), [F2]);
  await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { window.__oprnInput.dir("up"); window.__oprnInput.dir(null); }); await page.waitForTimeout(900); st = await state(); if (st.currentMapId === F1) break; }
  record(st.currentMapId === F1 && st.x === 9 && st.y === 10, "2층 계단통 아랫줄 (10,4) 를 밟으면 1층 계단 앞 (9,10)", `${st.currentMapId} (${st.x},${st.y})`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "back-1f.png") });
  const [h1, h2] = await Promise.all(["stairs-1f.png", "back-1f.png"].map(async (f) => createHash("sha256").update(await readFile(join(OUT, f))).digest("hex").slice(0, 12)));
  lines.push(`  (계단 앞 사진 ${h1} · 복귀 사진 ${h2})`);
  // 원룸
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 7, 12), [APT]);
  await page.waitForTimeout(800);
  await walk("원룸 현관 → 부엌 복도 → 방", APT, [["up", 7, 11], ["left", 6, 11], ["up", 6, 10], ["up", 6, 9], ["up", 6, 8], ["up", 6, 7], ["up", 6, 6]]);
  await page.screenshot({ path: join(OUT, "apartment.png") });
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 일본 집 실내 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "",
  "증거: `genkan.png`(시작) · `washitsu.png` · `kitchen.png` · `bath.png` · `stairs-1f.png`(계단을 봄) · `arrive-2f.png` · `kids.png` · `back-1f.png` · `apartment.png`"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
