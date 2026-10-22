// 자율 이동 NPC·야생이 한 방향 턱 칸에 올라서지 않는지 표본 추출(eec18c8fbb 검증). node ledge-probe.mjs <project.json> <outDir>  (unshare -rn 안에서)
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outDir] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
await mkdir(outDir, { recursive: true });
const MAP = process.env.MAP ?? "mx_map_meadow";
const m = project.maps[MAP], ledges = project.tilesets[m.tilesetId].ledgeDirections ?? {};
const ledgeCells = new Set(); const cellList = [];
for (let i = 0; i < m.width * m.height; i++) if (ledges[String(m.upperTiles[i])] || ledges[String(m.lowerTiles[i])]) { const c = `${i % m.width},${Math.floor(i / m.width)}`; ledgeCells.add(c); cellList.push([i % m.width, Math.floor(i / m.width)]); }
console.log("ledge cells", cellList.length, JSON.stringify(cellList.slice(0, 12)));
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:ledge", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) { if (!(await page.locator('[data-testid="cinematic-sequence"],[data-testid="dialogue-box"]').count())) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  const [cx, cy] = cellList[Math.floor(cellList.length / 2)];
  await page.evaluate(([mm, x, y]) => window.__oprnDebug.teleport(mm, x, y + 1), [MAP, cx, cy]);
  await page.waitForTimeout(800);
  const bad = new Map(); let samples = 0, seen = new Set();
  for (let t = 0; t < 70; t++) {
    const pos = await page.evaluate(() => { const ep = window.__oprnHooksScene.eventPositions; const out = []; const push = (id, p) => out.push([id, p.x, p.y]); if (ep instanceof Map) ep.forEach((p, id) => push(id, p)); else for (const id of Object.keys(ep ?? {})) push(id, ep[id]); return out; });
    samples++;
    for (const [id, x, y] of pos) { seen.add(id); if (ledgeCells.has(`${Math.round(x)},${Math.round(y)}`)) bad.set(id, [...(bad.get(id) ?? []), `${t}:${x},${y}`]); }
    await page.waitForTimeout(500);
  }
  console.log("samples", samples, "events seen", seen.size);
  console.log("ON-LEDGE", bad.size ? JSON.stringify([...bad]) : "none");
  await page.screenshot({ path: join(outDir, "ledge.png") });
} finally { await browser.close(); await server.close(); }
