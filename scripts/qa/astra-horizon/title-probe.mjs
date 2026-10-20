// 타이틀 화면만 3배로 찍는다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const [projectArg, outPng] = process.argv.slice(2);
const projectJson = await readFile(projectArg, "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "qa:title", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 }); await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 }); await page.waitForTimeout(3500);
  await page.screenshot({ path: outPng });
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
  await page.screenshot({ path: outPng.replace(/\.png$/, "-down.png") });
} finally { await browser.close(); await server.close(); }
