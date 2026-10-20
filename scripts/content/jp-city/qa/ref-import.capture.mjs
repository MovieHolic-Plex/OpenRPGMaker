// ref-import-fixture.mts 로 만든 프로젝트를 출하 player.html 에서 열어 장소마다 찍는다(가져온 jp_city 장소가 지금 시트로 바르게 그려지는가).
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/ref-import.capture.mjs <fixture.json> <출력 폴더> <맵id>:<x>:<y>[:이름] …'
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const [fixture, OUT, ...spots] = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const body = await readFile(fixture, "utf8");
const PROJECT_URL = "/__qa/ref-import.json";
const server = await startPlayerQaServer();
const result = { shots: [] };
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((projectUrl) => { try { localStorage.clear(); } catch { /* 없음 */ } window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:ref-import", qaInstrumentation: true }; }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__oprnDebug?.teleport === "function", undefined, { timeout: 90_000 });
  for (const spot of spots) {
    const [mapId, x, y, name = mapId] = spot.split(":");
    await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [mapId, +x, +y]);
    await page.waitForTimeout(2500);
    const canvas = await page.$("canvas");
    await (canvas ?? page).screenshot({ path: join(OUT, `${name}.png`) });
    result.shots.push({ name, mapId, x: +x, y: +y });
  }
  result.ok = true;
} catch (error) {
  result.error = String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ");
  result.ok = false;
} finally {
  await browser?.close();
  await server.close();
}
await writeFile(join(OUT, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
