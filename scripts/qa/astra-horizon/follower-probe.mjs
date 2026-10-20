// 따라다니는 동료가 절벽 틈·턱 점프 뒤에 끼는지 표본 추출. node follower-probe.mjs <project.json> <outDir>  (unshare -rn 안에서)
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outDir] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
await mkdir(outDir, { recursive: true });
const MAP = process.env.MAP ?? "mx_map_meadow";
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:follower", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const snap = () => page.evaluate(() => { const s = window.__oprnHooksScene; const se = s.session; return { hero: [se.x, se.y], followers: (se.followers ?? []).map((f) => f.name), spr: [...s.followerSprites.entries()].map(([k, v]) => [k, Math.round(v.x / 16 * 10) / 10, Math.round(v.y / 16 * 10) / 10, v.visible]), trail: (se.followerTrail ?? []).slice(0, 6).map((p) => `${p.x},${p.y}`) }; });
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  const project = JSON.parse(projectJson);
  const sp = project.database.monsterSpecies.find((x) => x.id === "mx_species_spriglet");
  const N = Number(process.env.FOLLOWERS ?? 1);
  await page.evaluate(([g, n]) => { const se = window.__oprnHooksScene.session; se.followers = Array.from({ length: n }, (_, i) => ({ id: `monster:q${i}`, name: `q${i}`, graphic: g, kind: "monster" })); se.followerTrail = []; }, [sp.graphic.fieldGraphic ?? { kind: "sprite" }, N]);
  console.log("boot", JSON.stringify(await snap()));
  await page.evaluate(([mm, x, y]) => window.__oprnDebug.teleport(mm, x, y), [MAP, 7, 2]);
  await page.waitForTimeout(1200);
  console.log("tele", JSON.stringify(await snap()));
  const route = process.env.ROUTE ?? "down*22";
  const moves = route.split(",").flatMap((seg) => { const [dir, n] = seg.split("*"); return Array.from({ length: Number(n) }, () => ({ kind: "move", dir })); });
  await page.evaluate((mv) => window.__oprnDebug.playerRoute(mv), moves);
  let worst = 0, hiddenN = 0;
  for (let t = 0; t < 40; t++) { await page.waitForTimeout(700); const s = await snap(); for (const [, fx, fy, vis] of s.spr) { worst = Math.max(worst, Math.max(Math.abs(fx - s.hero[0]), Math.abs(fy - s.hero[1]))); if (!vis) hiddenN++; } console.log(t, JSON.stringify(s)); if (t % 8 === 7) await page.screenshot({ path: join(outDir, `f${t}.png`) }); }
  console.log("SUMMARY maxChebyshev", worst.toFixed(1), "hiddenSamples", hiddenN);
} finally { await browser.close(); await server.close(); }
