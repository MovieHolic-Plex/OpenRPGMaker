import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
const projectJson = await readFile(process.argv[2], "utf8");
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "probe", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", r => r.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
await page.waitForTimeout(6000);
console.log(await page.evaluate(() => document.querySelector(".rm-title-screen-title")?.outerHTML.slice(0,600)));
console.log(JSON.stringify(await page.evaluate(() => { const t = document.querySelector('.rm-title-screen-title'); const l = document.querySelector('.rm-title-screen-logo'); const cs = x => x && (({ color, webkitTextFillColor, backgroundImage, backgroundClip, filter, fontSize, opacity, textShadow, webkitTextStroke }) => ({ color, webkitTextFillColor: webkitTextFillColor, backgroundImage, bs: getComputedStyle(x).backgroundSize, bp: getComputedStyle(x).backgroundPosition, backgroundClip, filter, fontSize, opacity, textShadow: textShadow?.slice(0,120), stroke: webkitTextStroke }))(getComputedStyle(x)); return { root: document.querySelector('.rm-title-screen')?.className, title: cs(t), tAttrs: t && Object.fromEntries([...t.attributes].map(a => [a.name, a.value])), logo: cs(l) }; }), null, 1));
await page.screenshot({ path: "/tmp/oprn-mux/title-probe.png", clip: { x: 80, y: 40, width: 560, height: 200 } });
for (const [name, css] of [["noanim", "animation:none"], ["nostroke", "-webkit-text-stroke:0;animation:none"], ["nostroke-nofilter", "-webkit-text-stroke:0;filter:none;animation:none"], ["boxshadow0", "box-shadow:none;-webkit-text-stroke:0;animation:none"]]) {
  await page.evaluate(c => { const t = document.querySelector('.rm-title-screen-title'); t.dataset.orig ??= t.getAttribute('style'); t.setAttribute('style', t.dataset.orig + ';' + c); }, css);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/oprn-mux/title-probe-${name}.png`, clip: { x: 80, y: 40, width: 560, height: 200 } });
}
await browser.close(); await server.close();
