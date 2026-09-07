import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { readPartyImages } from "../scripts/lib/exportPlayability.mjs";

const battlerCss = await readFile(new URL("../src/styles/runtime/battle-skins/_battlers.css", import.meta.url), "utf8");
function pngUrl(width, height) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
const staticArt = pngUrl(24, 32);
const sheetArt = pngUrl(72, 256);
const idleArt = pngUrl(96, 32);
const brokenArt = "data:image/png;base64,bm90LWFuLWltYWdl";
let browser;
before(async () => { browser = await chromium.launch({ args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

// Match actorNode/actorBattleImage markup; use the shipped idle CSS so computed
// backgrounds, reduced-motion fallback, layout and decoding run in Chromium.
async function party(t, variants = ["image", "sheet", "sheet-idle", "image-idle"]) {
  const page = await browser.newPage({ reducedMotion: "no-preference" });
  t.after(() => page.close());
  await page.setContent(`<style>
    .battle-actor-image, .battle-actor-sprite { display: block; width: 24px; height: 32px; }
    ${battlerCss}
  </style><div class="battle-actor-group" data-testid="battle-actor-sprites"></div>`);
  await page.evaluate(({ variants, staticArt, sheetArt, idleArt }) => {
    const group = document.querySelector(".battle-actor-group");
    variants.forEach((variant, index) => {
      const actor = document.createElement("div");
      actor.className = "battle-actor battle-pose-idle";
      actor.dataset.testid = `battle-actor-actor_${index + 1}`;
      actor.dataset.recordId = `actor_${index + 1}`;
      const image = variant.startsWith("image");
      const sprite = document.createElement(image ? "img" : "span");
      sprite.className = image ? "battle-actor-image" : "battle-actor-sprite";
      if (image) sprite.src = staticArt;
      else {
        sprite.dataset.testid = `battle-actor-sprite-generated-actor-hero-0${index + 1}-battle`;
        sprite.dataset.battlerSheetUrl = sheetArt;
        sprite.style.backgroundImage = `url("${sheetArt}")`;
        sprite.style.backgroundSize = "72px 256px";
        sprite.style.setProperty("--battle-sprite-frame-width", "24px");
      }
      if (variant.endsWith("-idle")) {
        sprite.dataset.battlerAnim = `actor-${index}`;
        sprite.style.setProperty("--battler-anim-frames", "4");
        sprite.style.setProperty("--battler-anim-duration", "1000ms");
        if (image) sprite.style.setProperty("--battler-anim-url", `url("${idleArt}")`);
        else {
          sprite.style.backgroundImage = `url("${idleArt}")`;
          sprite.style.backgroundSize = "96px 32px";
        }
      }
      actor.append(sprite);
      group.append(actor);
    });
  }, { variants, staticArt, sheetArt, idleArt });
  return page;
}

test("export QA validates four CSS-sheet actors, not nested test IDs or unrelated images", { timeout: 15000 }, async (t) => {
  const page = await party(t, ["sheet", "sheet-idle", "sheet", "sheet-idle"]);
  const images = await readPartyImages(page);
  assert.equal(images.length, 4);
  await page.evaluate(() => {
    const portrait = document.createElement("div");
    portrait.dataset.testid = "battle-actor-status-actor_1";
    portrait.innerHTML = '<img src="data:image/png;base64,bm90LWFuLWltYWdl">';
    document.body.append(portrait);
  });
  assert.deepEqual(await readPartyImages(page), images);
  assert.deepEqual(images.map((image) => image.id), [1, 2, 3, 4].map((id) => `battle-actor-actor_${id}`));
  assert.deepEqual(images.map((image) => image.src), [sheetArt, idleArt, sheetArt, idleArt]);
  assert.deepEqual(images.map((image) => [image.width, image.height]), [[72, 256], [96, 32], [72, 256], [96, 32]]);
  assert.ok(images.every((image) => image.renderedWidth > 0 && image.renderedHeight > 0));
});

test("export QA decodes static images, CSS sheets and both active idle-strip variants", { timeout: 15000 }, async (t) => {
  const images = await readPartyImages(await party(t));
  assert.equal(images.length, 4);
  assert.deepEqual(images.map((image) => image.src), [staticArt, sheetArt, idleArt, idleArt]);
  assert.deepEqual(images.map((image) => [image.width, image.height]), [[24, 32], [72, 256], [96, 32], [96, 32]]);
});

for (const fallback of ["reduced-motion", "dead-pose"]) {
  test(`export QA reads the rendered static image under ${fallback}`, { timeout: 15000 }, async (t) => {
    const page = await party(t);
    if (fallback === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
    else await page.locator(".battle-actor").last().evaluate((actor) => { actor.className = "battle-actor battle-pose-dead"; });
    const images = await readPartyImages(page);
    assert.equal(images.length, 4);
    assert.equal(images[3].src, staticArt);
    assert.equal(images[3].width, 24);
    assert.equal(images[2].src, idleArt);
  });
}

for (const defect of ["missing-actor", "extra-actor", "missing-sprite", "missing-background", "missing-image-idle", "broken-image", "broken-sheet", "broken-sheet-idle", "broken-image-idle", "zero-width", "zero-height", "hidden-actor"]) {
  test(`export QA rejects ${defect} instead of accepting incomplete party art`, { timeout: 15000 }, async (t) => {
    const page = await party(t);
    await page.evaluate(({ defect, brokenArt }) => {
      const actors = [...document.querySelectorAll(".battle-actor")];
      const sprites = actors.map((actor) => actor.firstElementChild);
      switch (defect) {
        case "missing-actor": actors[0].remove(); break;
        case "extra-actor": actors[0].parentElement.append(actors[0].cloneNode(true)); break;
        case "missing-sprite": sprites[0].remove(); break;
        case "missing-background": sprites[1].style.backgroundImage = "none"; break;
        case "missing-image-idle": sprites[3].style.removeProperty("--battler-anim-url"); break;
        case "broken-image": sprites[0].src = brokenArt; break;
        case "broken-sheet": sprites[1].style.backgroundImage = `url("${brokenArt}")`; break;
        case "broken-sheet-idle": sprites[2].style.backgroundImage = `url("${brokenArt}")`; break;
        case "broken-image-idle": sprites[3].style.setProperty("--battler-anim-url", `url("${brokenArt}")`); break;
        case "zero-width": sprites[1].style.width = "0px"; break;
        case "zero-height": sprites[1].style.height = "0px"; break;
        case "hidden-actor": actors[1].style.visibility = "hidden"; break;
      }
    }, { defect, brokenArt });
    await assert.rejects(readPartyImages(page));
  });
}
