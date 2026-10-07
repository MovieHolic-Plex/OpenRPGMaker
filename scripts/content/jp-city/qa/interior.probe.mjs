// 일본 집 실내 런타임 QA — 출하 player.html 에서 «현관에서 방향 입력으로 걸어 복도 계단을 밟으면 2층, 2층 계단통 아랫줄을 밟으면 1층 계단 앞,
// 방마다 걸어 들어간다, 원룸도 현관에서 부엌·유닛 배스·방까지 걷는다». 길은 interior-fixture.mts 가 엔진 canMove BFS 로 구한다(손으로 적지 않는다).
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/interior.probe.mjs'
// 증거: verify-shots/jp-city/interior-runtime/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/interior-runtime");
const FIXTURE = "/tmp/oprn-jp-interior-fixture.json";
const PATHS = "/tmp/oprn-jp-interior-paths.json";
const PROJECT_URL = "/__qa/interior.json";
const F1 = "jp-city-house-1f", F2 = "jp-city-house-2f", APT = "jp-city-apartment-1k";
const failures = [], lines = [];
const record = (ok, label, detail) => { lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`); if (!ok) failures.push(label); };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/interior-fixture.mts", "--out", FIXTURE, "--paths", PATHS], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
const P = JSON.parse(await readFile(PATHS, "utf8"));
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
  record(s0.currentMapId === P.start.map && s0.x === P.start.at[0] && s0.y === P.start.at[1], `시작 = 1층 현관 타타키 (${P.start.at})`, `${s0.currentMapId} (${s0.x},${s0.y})`);
  await page.screenshot({ path: join(OUT, "00-genkan.png") });
  /** 한 칸씩 — dir(d)→dir(null) 이 한 걸음(첫 탭은 방향만 바뀔 수 있어 2번까지). */
  const stepTo = async (d, want, map) => {
    let st;
    for (let i = 0; i < 3; i++) {
      await page.evaluate((x) => { window.__oprnInput.dir(x); window.__oprnInput.dir(null); }, d);
      await page.waitForTimeout(650);
      st = await state();
      if (st.currentMapId !== map || (st.x === want[0] && st.y === want[1])) break;
    }
    return st;
  };
  let n = 0;
  for (const leg of P.legs) {
    n += 1;
    if (leg.map === "jp-city-apartment-1k" && (await state()).currentMapId !== leg.map) {
      await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [leg.map, ...P.aptStart]);
      await page.waitForTimeout(800);
    }
    const trail = [];
    let ok = true, st = await state();
    for (const [i, [d, x, y]] of leg.steps.entries()) {
      const last = i === leg.steps.length - 1;
      st = await stepTo(d, [x, y], leg.map);
      if (last && leg.transfer) {
        for (let k = 0; k < 4 && st.currentMapId !== leg.transfer.to; k++) { await page.waitForTimeout(500); st = await state(); }
        trail.push(`${st.currentMapId}(${st.x},${st.y})`);
        ok = st.currentMapId === leg.transfer.to && st.x === leg.transfer.at[0] && st.y === leg.transfer.at[1];
        break;
      }
      trail.push(`${st.x},${st.y}`);
      if (st.currentMapId !== leg.map || st.x !== x || st.y !== y) { ok = false; break; }
    }
    record(ok, leg.label, trail.join(" → "));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `${String(n).padStart(2, "0")}.png`) });
  }
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 일본 집 실내 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "",
  "증거: `00-genkan.png`(시작) · `NN.png` = 위 N번째 줄이 끝난 화면"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
