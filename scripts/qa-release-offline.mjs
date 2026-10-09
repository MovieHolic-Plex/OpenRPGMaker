import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const target = resolve(process.argv[2] ?? "verify-shots/release-artifact/release.html");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const errors = [], requests = [];
try {
  await context.addInitScript(() => { window.__OPENRPG_BOOT__ = { qaInstrumentation: true }; });
  await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort("blockedbyclient"); });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(pathToFileURL(target).href, { waitUntil: "load", timeout: 120000 });
  await page.getByTestId("title-screen").waitFor({ state: "visible", timeout: 60000 });
  await arm(page, "!!window.__oprnDebug?.readState()?.currentMapId");
  await page.keyboard.press("Enter");
  await signal(page);
  const before = await page.evaluate(() => {
    const state = window.__oprnDebug.readState(); return { map: state.currentMapId, x: state.x, y: state.y };
  });
  await arm(page, `window.__oprnDebug.readState().x !== ${before.x}`);
  await page.keyboard.down("ArrowRight");
  try { await signal(page); } finally { await page.keyboard.up("ArrowRight"); }
  await arm(page, "!window.__oprnPlayerSprite().moving"); await signal(page);
  const after = await page.evaluate(() => {
    const state = window.__oprnDebug.readState(); return { map: state.currentMapId, x: state.x, y: state.y };
  });
  assert.equal(after.map, before.map); assert.notEqual(after.x, before.x);
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  await page.screenshot({ path: `${target}.png` });
  await writeFile(`${target}.qa.json`, JSON.stringify({ before, after, requests, errors, pass: true }, null, 2));
  console.log(`PASS offline verified release boots and moves: ${target}`);
} finally { await context.close(); await browser.close(); }

async function arm(page, expression) {
  await page.evaluate(expression => {
    window.__releaseQaSignal = new Promise(resolve => {
      let game;
      const condition = Function(`return (${expression})`);
      const finish = value => { clearTimeout(deadline); observer.disconnect(); game?.events.off("poststep", check); resolve(value); };
      const check = () => {
        const found = window.Phaser?.Display.Canvas.CanvasPool.pool.find(entry => entry.parent?.game)?.parent.game;
        if (found && found !== game) { game?.events.off("poststep", check); game = found; game.events.on("poststep", check); }
        if (condition()) finish(true);
      };
      const deadline = setTimeout(() => finish(false), 30000);
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      check();
    });
  }, expression);
}
async function signal(page) { assert.equal(await page.evaluate(() => window.__releaseQaSignal), true, "Runtime state deadline"); }
