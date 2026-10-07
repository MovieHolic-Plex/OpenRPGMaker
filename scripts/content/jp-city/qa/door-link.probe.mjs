// 거리 건물 문 ↔ 실내(link_jp_city_interior) 런타임 QA — 출하 player.html 에서 «거리 문 앞에서 위로 한 걸음 → 실내 도착 칸,
// 실내 가장 먼 칸까지 걸어갔다가 출입구 틈을 밟으면 → 거리 문 앞 아래 칸». 길은 door-link-fixture.mts 가 엔진 canMove BFS 로 구한다.
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/door-link.probe.mjs [links.json]'
// 증거: verify-shots/jp-city/door-link/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/door-link");
const FIXTURE = "/tmp/oprn-jp-door-fixture.json";
const PATHS = "/tmp/oprn-jp-door-paths.json";
const PROJECT_URL = "/__qa/door.json";
const failures = [], lines = [];
const record = (ok, label, detail) => { lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`); if (!ok) failures.push(label); };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const linkArgs = process.argv[2] ? ["--links", process.argv[2]] : [];
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/door-link-fixture.mts", "--out", FIXTURE, "--paths", PATHS, ...linkArgs], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
const P = JSON.parse(await readFile(PATHS, "utf8"));
lines.push("도구 결과:", ...P.report.map((r) => `- ${r}`), "");
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const log = [];
  page.on("pageerror", (e) => log.push(String(e?.message ?? e).split("\n")[0]));
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((u) => { try { localStorage.clear(); } catch { /* 없음 */ } window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: "runtime-qa:jp-door", qaInstrumentation: true }; }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 90_000 });
  await page.addStyleTag({ content: "[data-testid='field-hud']{visibility:hidden!important}" });
  await page.waitForTimeout(800);
  const state = () => page.evaluate(() => window.__oprnDebug.readState());
  const tap = async (d) => { await page.evaluate((x) => { window.__oprnInput.dir(x); window.__oprnInput.dir(null); }, d); await page.waitForTimeout(650); };
  /** 한 칸씩 — 첫 탭은 방향만 바뀔 수 있어 3번까지. */
  const stepTo = async (d, want, map) => {
    let st;
    for (let i = 0; i < 3; i++) { await tap(d); st = await state(); if (st.currentMapId !== map || (st.x === want[0] && st.y === want[1])) break; }
    return st;
  };
  const waitMap = async (map) => { let st = await state(); for (let k = 0; k < 8 && st.currentMapId !== map; k++) { await page.waitForTimeout(500); st = await state(); } await page.waitForTimeout(700); return await state(); };
  let n = 0;
  for (const leg of P.legs) {
    n += 1;
    const tag = String(n).padStart(2, "0");
    await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [leg.street, ...leg.startAt]);
    await page.waitForTimeout(900);
    await tap("up"); // 위를 보게
    await page.waitForTimeout(1200); // 순간이동 페이드가 걷힐 때까지
    await page.screenshot({ path: join(OUT, `${tag}a-street.png`) });
    let st = await stepTo("up", leg.enter.slice(1), leg.street);
    st = await waitMap(leg.interior);
    record(st.currentMapId === leg.interior && st.x === leg.entryAt[0] && st.y === leg.entryAt[1], `${tag}a. ${leg.label} — 문 앞 (${leg.enter[1]},${leg.enter[2]}) 밟고 들어가기`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${leg.entryAt})`);
    await page.screenshot({ path: join(OUT, `${tag}b-inside.png`) });
    let ok = true; const trail = [];
    for (const [d, x, y] of leg.tourSteps) { st = await stepTo(d, [x, y], leg.interior); trail.push(`${st.x},${st.y}`); if (st.currentMapId !== leg.interior || st.x !== x || st.y !== y) { ok = false; break; } }
    record(ok, `${tag}b. 실내 가장 먼 칸까지 ${leg.tourSteps.length}걸음`, trail.slice(-4).join(" → "));
    await page.screenshot({ path: join(OUT, `${tag}c-far.png`) });
    for (const [i, [d, x, y]] of leg.exitSteps.entries()) {
      st = await stepTo(d, [x, y], leg.interior);
      if (i < leg.exitSteps.length - 1 && (st.currentMapId !== leg.interior || st.x !== x || st.y !== y)) break;
    }
    st = await waitMap(leg.street);
    record(st.currentMapId === leg.street && st.x === leg.exitAt[0] && st.y === leg.exitAt[1], `${tag}c. 출입구 밟고 거리로`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${leg.exitAt})`);
    await page.screenshot({ path: join(OUT, `${tag}d-back.png`) });
  }
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 거리 문 ↔ 실내 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "",
  "증거: NNa-street(문 앞) · NNb-inside(도착) · NNc-far(실내 가장 먼 칸) · NNd-back(거리로 나옴)"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
