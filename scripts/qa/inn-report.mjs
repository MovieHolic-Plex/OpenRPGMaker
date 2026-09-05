import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const out = path.resolve("output/evidence/inn-exploration-v4");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const [name, width, height] of [["desktop",1440,960],["tablet",900,1000],["mobile",390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`file://${out}/index.html`, { waitUntil: "load" });
    const images = page.locator(".image-link img");
    assert.equal(await images.count(), 19);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(image => image.decode());
      assert.ok(await image.evaluate(image => image.naturalWidth > 0 && image.naturalHeight > 0 && image.alt.length > 0));
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${name}: horizontal overflow`);
    for (const [index, section] of (await page.locator("main > section").all()).entries()) {
      await section.screenshot({ path: `${out}/report-${name}-section-${index + 1}.png` });
    }
    // Every image opens the lightbox; Escape returns focus to its original link.
    for (const link of await page.locator(".image-link").all()) {
      await link.click();
      const dialog = page.locator("#zoom");
      await dialog.waitFor({ state: "visible" });
      await page.locator("#zoom-image").evaluate(image => image.decode());
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.ok(await link.evaluate(link => document.activeElement === link));
    }
    await page.locator(".hero .image-link").focus();
    await page.keyboard.press("Enter");
    await page.locator("#zoom").waitFor({ state: "visible" });
    await page.screenshot({ path: `${out}/report-${name}-lightbox.png` });
    await page.getByRole("button", { name: "닫기 · Esc" }).click();
    await page.locator("#zoom").waitFor({ state: "hidden" });
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({ path: `${out}/report-${name}.png` });
    assert.deepEqual(errors, []);
    results.push({ viewport: name, width, height, images: 19, sectionCaptures: 6, lightboxes: 19, horizontalOverflow: false, errors });
    await page.close();
  }
  fs.writeFileSync(`${out}/report-browser-proof.json`, JSON.stringify({ passed: true, results, visualInspection: "unavailable; geometric and interaction checks only" }, null, 2));
  console.log(JSON.stringify({ passed: true, results }));
} finally {
  await browser.close();
}
