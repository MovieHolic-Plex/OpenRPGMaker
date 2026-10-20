// 현대 타일 개선판(2026-10-20) 장면을 출하 player.html 로 1배 촬영한다 — 굽은 실제 시트·실제 맵 칸 번호로 그린 그림.
//
//   node scripts/qa/runtime/modern-tiles.capture.mjs --out-dir <폴더> <맵.json>…
//
// 맵마다: teleport → 주인공 숨김 → 카메라 따라가기 끊고 줌 1·맵 가운데 고정 → 캔버스 화소를 그대로 PNG(<맵 id>.png).
// 결과는 <폴더>/<맵 id>.png 와 SUMMARY.md(맵·크기·오류). 판정은 사람이 시안과 나란히 놓고 본다(기계 통과 ≠ 시각 합격).
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PROJECT_URL = "/__qa/modern-tiles-project.json";
let outDir = join(REPO_ROOT, "verify-shots/runtime-qa/modern-tiles");
const maps = [];
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--out-dir") outDir = resolve(process.argv[++i]);
  else maps.push(resolve(process.argv[i]));
}
if (!maps.length) { console.error("맵 JSON 경로가 필요하다"); process.exit(2); }
await mkdir(outDir, { recursive: true });
const FIXTURE = join(outDir, "_fixture.json");
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/qa/runtime/modern-tiles-fixture.mts", "--out", FIXTURE, ...maps],
  { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=6000" } });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const info = JSON.parse(built.stdout.trim().split("\n").pop());
const projectJson = await readFile(FIXTURE, "utf8");
const { width: VW, height: VH } = info.playResolution;

const lines = [`# modern-tiles 런타임 촬영`, "", `해상도 ${VW}×${VH}, 줌 1, 출하 player.html`, ""];
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const log = [];
  page.on("pageerror", (e) => log.push(`pageerror: ${String(e?.message ?? e).split("\n")[0]}`));
  page.on("console", (m) => { if (m.type() === "error") log.push(`console: ${m.text()}`); });
  await page.addInitScript((projectUrl) => {
    try { localStorage.clear(); } catch { /* 없음 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:modern-tiles", qaInstrumentation: true };
  }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => !!window.__oprnHooksScene && !!window.__oprnDebug, undefined, { timeout: 90_000 });
  for (const id of info.maps) {
    await page.evaluate((m) => window.__oprnDebug.teleport(m, 0, 0), id);
    await page.waitForFunction((m) => window.__oprnDebug.readState().currentMapId === m, id, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    const dims = await page.evaluate(() => {
      const s = window.__oprnHooksScene, c = s.cameras.main;
      s.player?.setVisible?.(false);
      c.stopFollow(); c.removeBounds(); c.setZoom(1); c.centerOn(s.map.width * 8, s.map.height * 8);
      return { w: s.map.width * 16, h: s.map.height * 16, cw: c.width, ch: c.height };
    });
    await page.waitForTimeout(400);
    const canvas = await page.$("canvas");
    const box = await canvas.boundingBox();
    const clipW = Math.min(dims.w, box.width), clipH = Math.min(dims.h, box.height);
    const clip = { x: box.x + (box.width - clipW) / 2, y: box.y + (box.height - clipH) / 2, width: clipW, height: clipH };
    const file = join(outDir, `${id}.png`);
    await page.screenshot({ path: file, clip });
    lines.push(`- ${id}: 맵 ${dims.w}×${dims.h}px, 캔버스 ${box.width}×${box.height}(카메라 ${dims.cw}×${dims.ch}) → ${file}`);
  }
  lines.push("", "## 오류", ...(log.length ? log.map((l) => `- ${l}`) : ["- 없음"]));
} finally {
  await browser?.close();
  await server.close();
}
await writeFile(join(outDir, "SUMMARY.md"), lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
