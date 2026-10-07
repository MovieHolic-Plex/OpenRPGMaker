// 거리 건물 문 ↔ 실내(link_jp_city_interior) 런타임 QA — 출하 player.html 에서 «거리 문 앞에서 위로 한 걸음 → 실내 도착 칸,
// 실내 가장 먼 칸까지 걸어갔다가 출입구 틈을 밟으면 → 거리 문 앞 아래 칸». 길은 door-link-fixture.mts 가 엔진 canMove BFS 로 구한다.
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/door-link.probe.mjs [links.json …]'
// links.json 마다 한 판(상가 거리 건물 8채라 장소 21곳은 판 3개 — door-link-all-*.json). 판 번호가 증거 이름 머리.
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
const batches = process.argv.slice(2).length ? process.argv.slice(2) : [null];
const server = await startPlayerQaServer();
let browser;
let n = 0;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
for (const linksFile of batches) {
  const linkArgs = linksFile ? ["--links", linksFile] : [];
  const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/door-link-fixture.mts", "--out", FIXTURE, "--paths", PATHS, ...linkArgs], { cwd: ROOT, encoding: "utf8" });
  if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
  const body = await readFile(FIXTURE, "utf8");
  const P = JSON.parse(await readFile(PATHS, "utf8"));
  lines.push(`도구 결과 (${linksFile ?? "기본"}):`, ...P.report.map((r) => `- ${r}`), "");
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
  /** 마지막 걸음이 발판(다른 맵으로 감)인 길 — 중간 칸은 맵 안에 있어야 한다. */
  const walkOut = async (steps, map) => { for (const [i, [d, x, y]] of steps.entries()) { const st = await stepTo(d, [x, y], map); if (i < steps.length - 1 && (st.currentMapId !== map || st.x !== x || st.y !== y)) return st; } return await state(); };
  for (const leg of P.legs) {
    n += 1;
    const tag = String(n).padStart(2, "0");
    await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [leg.street, ...leg.startAt]);
    await page.waitForTimeout(900);
    await page.waitForTimeout(1200); // 순간이동 페이드가 걷힐 때까지 — 미리 방향 키를 누르지 않는다(이미 위를 보고 있으면 그 탭이 발판을 밟는다)
    await page.screenshot({ path: join(OUT, `${tag}a-street.png`) });
    let st = await state();
    for (let i = 0; i < 3 && st.currentMapId === leg.street && !(st.x === leg.enter[1] && st.y === leg.enter[2]); i++) { await tap(leg.enter[0]); st = await state(); }
    st = await waitMap(leg.interior);
    record(st.currentMapId === leg.interior && st.x === leg.entryAt[0] && st.y === leg.entryAt[1], `${tag}a. ${leg.label} — 문 앞 발판 (${leg.enter[1]},${leg.enter[2]}) 으로 ${leg.enter[0]} 한 걸음`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${leg.entryAt})`);
    await page.screenshot({ path: join(OUT, `${tag}b-inside.png`) });
    if (leg.stairs) {
      const S = leg.stairs;
      st = await walkOut(S.upSteps, leg.interior); st = await waitMap(S.floor);
      record(st.currentMapId === S.floor && st.x === S.upAt[0] && st.y === S.upAt[1], `${tag}s1. 계단 올라가기 ${S.upSteps.length}걸음`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${S.upAt})`);
      await page.screenshot({ path: join(OUT, `${tag}s-upstairs.png`) });
      st = await walkOut(S.downSteps, S.floor); st = await waitMap(leg.interior);
      record(st.currentMapId === leg.interior && st.x === S.downAt[0] && st.y === S.downAt[1], `${tag}s2. 위층 둘러보고 계단 내려오기 ${S.downSteps.length}걸음`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${S.downAt})`);
    }
    let ok = true; const trail = [];
    for (const [d, x, y] of leg.tourSteps) { st = await stepTo(d, [x, y], leg.interior); trail.push(`${st.x},${st.y}`); if (st.currentMapId !== leg.interior || st.x !== x || st.y !== y) { ok = false; break; } }
    record(ok, `${tag}b. 실내 양 끝(가장 먼 칸 → 거기서 가장 먼 칸)까지 ${leg.tourSteps.length}걸음`, trail.slice(-4).join(" → "));
    await page.screenshot({ path: join(OUT, `${tag}c-far.png`) });
    for (const [i, [d, x, y]] of leg.exitSteps.entries()) {
      st = await stepTo(d, [x, y], leg.interior);
      if (i < leg.exitSteps.length - 1 && (st.currentMapId !== leg.interior || st.x !== x || st.y !== y)) break;
    }
    st = await waitMap(leg.street);
    record(st.currentMapId === leg.street && st.x === leg.exitAt[0] && st.y === leg.exitAt[1], `${tag}c. 출입구 밟고 거리로`, `${st.currentMapId} (${st.x},${st.y}) / 기대 (${leg.exitAt})`);
    // d. 나온 칸에서 가만히 있어도 다시 끌려 들어가지 않는다(발판 되밟기 루프 없음).
    await page.waitForTimeout(1500);
    const still = await state();
    record(still.currentMapId === leg.street && still.x === leg.exitAt[0] && still.y === leg.exitAt[1], `${tag}d. 거리에 머문다(되튕김 없음, 1.5초)`, `${still.currentMapId} (${still.x},${still.y})`);
    await page.screenshot({ path: join(OUT, `${tag}d-back.png`) });
  }
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
  await page.close();
}
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 거리 문 ↔ 실내 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "",
  "증거: NNa-street(문 앞) · NNb-inside(도착) · NNs-upstairs(위층, 여러 층만) · NNc-far(실내 끝) · NNd-back(거리로 나와 1.5초 뒤)"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
