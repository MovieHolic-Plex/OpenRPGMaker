import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const out = path.resolve("output/evidence/inn-inspection-v5");
const audit = JSON.parse(fs.readFileSync(`${out}/audit.json`, "utf8"));
const usedCount = audit.objects.filter(object => object.placementFile).length;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
fs.mkdirSync(`${out}/qa`, { recursive: true });
try {
  for (const [name, width, height] of [["desktop",1440,960], ["tablet",900,1000], ["mobile",390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`file://${out}/index.html`, { waitUntil: "load" });
    const decoded = await page.evaluate(async () => {
      const images = [...document.querySelectorAll("[data-zoom] img")];
      for (const image of images) image.loading = "eager";
      await Promise.all(images.map(image => image.decode()));
      return { images: images.length, invalid: images.filter(image => !image.naturalWidth || !image.alt).length };
    });
    assert.equal(decoded.invalid, 0);
    assert.equal(await page.locator("[data-object]").count(), audit.objects.length);
    assert.equal(await page.locator("[data-tile]").count(), 480);
    assert.equal(await page.locator(".case").count(), 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.screenshot({ path: `${out}/qa/${name}-overview.png` });
    // Capture every furniture card, all lodging cases, and the complete atlas at each width.
    for (const card of await page.locator("[data-object]").all()) {
      const id = await card.getAttribute("id");
      await card.screenshot({ path: `${out}/qa/${name}-${id}.png` });
      const disclosure = card.locator("summary");
      await disclosure.click();
      assert.equal(await card.locator("details").evaluate(element => element.open), true);
      await disclosure.click();
    }
    for (const [index, card] of (await page.locator(".case").all()).entries()) {
      await card.screenshot({ path: `${out}/qa/${name}-lodging-${index + 1}.png` });
    }
    for (const id of ["maps", "unknown", "atlas", "evidence"]) {
      await page.locator(`#${id}`).screenshot({ path: `${out}/qa/${name}-${id}.png` });
    }

    await page.locator('[data-filter="placed"]').click();
    assert.equal(await page.locator("[data-object]:visible").count(), usedCount);
    await page.locator('[data-filter="unused"]').click();
    assert.equal(await page.locator("[data-object]:visible").count(), audit.objects.length - usedCount);
    await page.locator('[data-filter="all"]').click();
    await page.locator("#object-search").fill("stairs_down");
    assert.equal(await page.locator("[data-object]:visible").count(), 1);
    await page.locator("#object-search").fill("no-such-object-123");
    assert.equal(await page.locator("#object-empty").isVisible(), true);
    await page.locator("#object-search").fill("");
    await page.locator("#tile-status").selectOption("unconfirmed");
    assert.equal(await page.locator("[data-tile]:visible").count(), 4);
    await page.locator("#tile-search").fill("409");
    assert.equal(await page.locator("[data-tile]:visible").count(), 1);
    await page.locator("#tile-search").fill("no-such-tile");
    assert.equal(await page.locator("#tile-empty").isVisible(), true);
    await page.locator("#tile-search").fill("");
    await page.locator("#tile-status").selectOption("all");

    for (const selector of [".hero-shot [data-zoom]", "#object-stairs_down .assembly", "#object-flue .pixel", ".atlas-tile.unconfirmed [data-zoom]"]) {
      const opener = page.locator(selector).first();
      await opener.focus();
      await page.keyboard.press("Enter");
      await page.locator("#zoom").waitFor({ state: "visible" });
      await page.locator("#zoom-image").evaluate(image => image.decode());
      await page.screenshot({ path: `${out}/qa/${name}-zoom-${results.length}-${selector.includes("assembly") ? "assembly" : selector.includes("flue") ? "flue" : selector.includes("atlas") ? "unknown" : "game"}.png` });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#zoom").evaluate(dialog => dialog.open), false);
      assert.equal(await opener.evaluate(element => document.activeElement === element), true);
    }
    assert.deepEqual(errors, []);
    results.push({ name, width, height, decodedImages: decoded.images, furnitureCards: audit.objects.length, atlasTiles: 480, lodgingCases: 6, filters: true, keyboardZoom: true, horizontalOverflow: false, errors });
    await page.close();
  }
  fs.writeFileSync(`${out}/browser-proof.json`, JSON.stringify({ passed: true, results, visualInterpretationApproved: false }, null, 2));
  console.log(JSON.stringify({ passed: true, results }));
} finally {
  await browser.close();
}
