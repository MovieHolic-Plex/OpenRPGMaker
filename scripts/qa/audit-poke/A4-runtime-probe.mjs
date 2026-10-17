// A4 감사 프로브: build_monster_game 산출물을 출하 플레이어(player.html)에서 실제 입력으로 돌려
// (1) 절벽 한 방향 점프 (2) 맵 이름 팝업 유무 (3) 시야선 트레이너(!·걸어옴·한 번만) 를 측정한다.
//   node scripts/qa/audit-poke/A4-runtime-probe.mjs <project.json> <outDir>
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await mkdir(out, { recursive: true });
const report = { steps: [], errors: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch {}
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:a4", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const step = (id, data) => { report.steps.push({ id, ...data }); console.log(id, JSON.stringify(data)); };
const shot = (n) => page.screenshot({ path: join(out, `${n}.png`) });
const teleport = async (m, x, y) => {
  await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [m, x, y]);
  await page.waitForFunction(([a, b, c]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === a && s.x === b && s.y === c; }, [m, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const press = async (dir, ms) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(ms); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(500); };
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) {
    if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break;
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  }
  step("start", await live());

  // (1) 절벽: 1번길 (5,3) → 아래로 한 칸(턱 (5,4)) → 2칸 점프해 (5,5)
  await teleport("mx_map_meadow", 5, 3);
  step("map-name-popup-dom", { texts: await page.evaluate(() => [...document.querySelectorAll("body *")].filter((n) => n.children.length === 0 && /1번길|별싹 들판/.test(n.textContent || "")).map((n) => (n.className || n.tagName) + ":" + n.textContent.trim().slice(0, 30))) });
  await shot("ledge-before");
  await press("down", 120);
  await page.waitForTimeout(800);
  const afterDown = await live();
  step("ledge-down-from-north", { from: { x: 5, y: 3 }, to: { x: afterDown.x, y: afterDown.y } });
  await shot("ledge-after-down");
  await press("up", 150); await page.waitForTimeout(500);
  const afterUp = await live();
  step("ledge-up-back", { from: { x: afterDown.x, y: afterDown.y }, to: { x: afterUp.x, y: afterUp.y } });
  // 옆(좌우)에서 턱 칸으로 진입 시도: (3,4) -> right
  await teleport("mx_map_meadow", 3, 4);
  await press("right", 150); await page.waitForTimeout(400);
  const side = await live();
  step("ledge-from-side", { from: { x: 3, y: 4 }, to: { x: side.x, y: side.y } });

  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
} catch (e) {
  report.errors.push(String(e?.stack ?? e));
  await shot("failure").catch(() => {});
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
} finally {
  await browser.close(); await server.close();
}
console.log("errors", report.errors.length, report.errors.slice(0, 3).join(" | ").slice(0, 600));
