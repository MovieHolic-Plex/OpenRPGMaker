
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fails = [];
page.on("requestfailed", (r) => fails.push(r.url()));
await page.goto("file:///home/main/paseo-workspace/worktrees/3lblgwmp/brave-mantis/docs/2026-09-14-team-panel-plan.html");
await page.waitForTimeout(1500);
const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.src.split("/").pop(), ok: i.complete && i.naturalWidth > 0 })));
console.log("images:", JSON.stringify(imgs, null, 0));
console.log("failed requests:", fails.length);
await page.screenshot({ path: "/tmp/plan-top.png" });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.42));
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/plan-mid.png" });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/plan-bottom.png" });
await browser.close();
