import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
try {
  const url = pathToFileURL("C:\\Users\\USER\\Downloads\\rpg-zzu-tilemap-harness-overhaul\\tilemap-harness-overhaul-report.html").href;
  await page.goto(url, { waitUntil: "load" });
  await page.locator("h1").waitFor({ state: "visible" });
  const evidence = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
    sections: document.querySelectorAll("main section").length,
    diagrams: document.querySelectorAll("svg").length,
    screenshotLoaded: document.querySelector("#hero-shot")?.naturalWidth > 0,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    reportHeight: document.documentElement.scrollHeight,
  }));
  await page.screenshot({ path: ".playwright-cli/tilemap-harness-overhaul-report.png", fullPage: true });
  evidence.pageErrors = pageErrors;
  if (!evidence.screenshotLoaded) throw new Error("actual browser evidence image did not load");
  if (evidence.horizontalOverflow) throw new Error("report has horizontal overflow at 1440px");
  if (evidence.sections < 8 || evidence.diagrams < 6) throw new Error("report is missing visual sections");
  if (pageErrors.length) throw new Error(pageErrors.join(" | "));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
