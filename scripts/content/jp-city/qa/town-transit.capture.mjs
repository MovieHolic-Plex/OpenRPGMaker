// 동네 한 장의 차 흐름·버스를 출하 player.html 에서 찍는다(역 앞 간선, 学校前 정류장).
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/town-transit.capture.mjs'
// 증거: verify-shots/jp-city/town-transit/{ekimae,school}.png + result.json
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/town-transit");
const FIXTURE = "/tmp/oprn-town-transit.json";
const PROJECT_URL = "/__qa/town-transit.json";
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/town-transit-fixture.mts", "--out", FIXTURE], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
const server = await startPlayerQaServer();
const result = { shots: [] };
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((projectUrl) => { try { localStorage.clear(); } catch { /* 없음 */ } window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:town-transit", qaInstrumentation: true }; }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__oprnTransit === "function" && window.__oprnTransit()?.vehicles?.some((v) => v.sprite), undefined, { timeout: 90_000 });
  for (const [name, x, y, waitBus] of [["ekimae", 34, 12, "駅前"], ["school", 40, 73, "学校前"]]) {
    await page.evaluate(([x, y]) => window.__oprnDebug.teleport("jp-city-town", x, y), [x, y]);
    const deadline = Date.now() + 60_000;
    let bus = null;
    while (Date.now() < deadline) {
      const t = await page.evaluate(() => window.__oprnTransit());
      bus = t.vehicles.find((v) => v.id === "jp-bus-city" && v.open && v.stopAt !== null && Math.abs(v.rect.x + v.rect.w / 2 - x) < 6 && Math.abs(v.rect.y - y) < 6) ?? null;
      if (bus) break;
      await page.waitForTimeout(400);
    }
    const t = await page.evaluate(() => window.__oprnTransit());
    const near = t.vehicles.filter((v) => Math.abs(v.rect.x - x) < 16 && Math.abs(v.rect.y - y) < 10 && v.sprite?.visible).length;
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    result.shots.push({ name, bus: bus ? `${bus.id} x ${bus.rect.x}~${bus.rect.x + bus.rect.w - 1} y ${bus.rect.y}` : null, nearVehicles: near, routes: t.routes.length });
  }
  result.ok = result.shots.every((s) => s.bus && s.nearVehicles >= 2);
} catch (error) {
  result.error = String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ");
  result.ok = false;
} finally {
  await browser?.close();
  await server.close();
}
await writeFile(join(OUT, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
