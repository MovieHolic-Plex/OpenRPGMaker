// 동료 메뉴(에메랄드 파티 카드) 1배 촬영 — 첫 동료를 받고 복제해 6칸을 채운 뒤 메뉴 → 동료 항목.
//   node scripts/qa/astra-horizon/detail-probe.mjs <project.json> <outDir> [partySize=4]
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outArg, sizeArg] = process.argv.slice(2);
const size = Number(sizeArg ?? 4);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg); await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:detail", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (t) => page.locator(`[data-testid="${t}"]`).count().then((n) => n > 0);
const live = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; return (s.monsterParty ?? []).length; });
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  let quiet = 0;
  for (let i = 0; i < 200 && quiet < 5; i++) { const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("runtime-choices")) || (await present("title-screen")); quiet = busy ? 0 : quiet + 1; await page.keyboard.press("Enter"); await page.waitForTimeout(350); }
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_lab", 7, 6));
  await page.waitForTimeout(1200);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__oprnInput.face("up")); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700);
    if (await present("dialogue-box")) break;
  }
  for (let i = 0; i < 80; i++) { if ((await live()) && !(await present("dialogue-box")) && !(await present("runtime-choices"))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  console.log("party", await live());
  await page.evaluate((n) => {
    const s = window.__oprnHooksScene.session; const base = s.monsterParty[0];
    for (let i = s.monsterParty.length; i < n; i++) { const id = `${base}_c${i}`; s.monsterInstances[id] = { ...s.monsterInstances[base], currentHp: i === 2 ? 3 : undefined }; s.monsterParty.push(id); }
  }, size);
  console.log("party", await live());
  await page.keyboard.press("Escape"); await page.waitForTimeout(900);
  const entries = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='status-menu-command-']")].map((n) => n.dataset.testid).filter((t) => !/rail|icon/.test(t)));
  console.log("entries", JSON.stringify(entries));
  await shot("menu");
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  await shot("party");
  await page.keyboard.press("Enter"); await page.waitForTimeout(900); await shot("detail0");
  for (let k = 1; k < 4; k++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(500); await shot(`detail${k}`); }
} finally { await browser.close(); await server.close(); }
