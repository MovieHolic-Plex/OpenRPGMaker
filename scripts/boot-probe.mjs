import { chromium } from "@playwright/test";

const base = process.argv[2];
if (!base) throw new Error("usage: node scripts/boot-probe.mjs <baseUrl>");

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 200)));
await page.goto(`${base}/?freshProject=1`, { waitUntil: "domcontentloaded" });
let booted = true;
try {
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 45_000 });
} catch {
  booted = false;
}
console.log(JSON.stringify({ base, booted, pageErrors: pageErrors.slice(0, 3) }, null, 1));
await browser.close();
process.exit(booted ? 0 : 1);
