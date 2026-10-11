// 시연 오프닝을 player.html 에서 재생하며 webm 으로 남긴다(소리는 webm 에 담기지 않는다). 사용: node ... <project.json> <outDir>
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectPath, outDir] = process.argv.slice(2);
const projectJson = await readFile(projectPath, "utf8");
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 }, recordVideo: { dir: outDir, size: { width: 960, height: 720 } } });
const pageStart = Date.now();
const page = await context.newPage();
const errors = [];
const audioRequests = [];
page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("response", (r) => { if (/\/assets\/(se|easyrpg\/sound|cc0\/audio)\//.test(r.url())) audioRequests.push(`${Math.round((Date.now() - pageStart) / 100) / 10}s ${r.status()} ${r.url().split("/assets/")[1]}`); });
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "truck-demo", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
await page.waitForTimeout(800);
const enterAt = Date.now() - pageStart;
await page.keyboard.press("Enter");
for (let i = 1; i < Number(process.env.TITLE_ENTERS ?? 1); i++) { await page.waitForTimeout(2200); await page.keyboard.press("Enter"); }
const total = Number(process.env.RECORD_MS ?? 45000), every = Number(process.env.ENTER_EVERY_MS ?? 0);
const t1 = Date.now();
while (Date.now() - t1 < total) {
  await page.waitForTimeout(every > 0 ? every : total);
  if (every > 0) await page.keyboard.press("Enter");
}
console.log(JSON.stringify({ enterAtMs: enterAt, errors, audioRequests }));
await context.close(); await browser.close(); await server.close();
