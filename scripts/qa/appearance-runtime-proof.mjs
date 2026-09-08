import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import scenario, { cleanupCharacterAppearanceFixture } from "./runtime/character-appearance-sets.scenario.mjs";

// Same shipped-player harness; Firefox avoids this workstation's Chromium
// ERR_NETWORK_CHANGED asset failures. This context never touches user storage.
const server = await startPlayerQaServer();
let browser;
try {
  browser = await firefox.launch({ headless: process.env.QA_HEADED !== "1" });
  const page = await browser.newPage();
  const browserErrors = [];
  const pendingRequests = new Set();
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  page.on("request", (request) => pendingRequests.add(request.url()));
  page.on("requestfinished", (request) => pendingRequests.delete(request.url()));
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request.url());
    browserErrors.push(`${request.url()} ${request.failure()?.errorText}`);
  });
  const capture = page.screenshot.bind(page);
  const captureStates = [];
  // Capture completed typewriting, not the first two letters of a live line.
  // This wraps only evidence capture; the real player and harness actions run unchanged.
  page.screenshot = async (options) => {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const box = document.querySelector("[data-testid='dialogue-box']");
      if (!box) { resolve(); return; }
      let observer;
      const timeout = setTimeout(() => { observer?.disconnect(); reject(new Error("Dialogue did not settle")); }, 15000);
      const settled = () => {
        if (!box.isConnected || (box.classList.contains("page-ready") && box.dataset.dialoguePhase === "shown")) {
          clearTimeout(timeout);
          observer?.disconnect();
          resolve();
        }
      };
      observer = new MutationObserver(settled);
      observer.observe(box, { attributes: true });
      settled();
    }));
    captureStates.push(await page.evaluate(() => ({
      text: document.querySelector("[data-testid='dialogue-box'] .body")?.textContent ?? "",
      portrait: document.querySelector("[data-testid='dialogue-face']")?.getAttribute("data-face-mode") ?? null,
      player: window.__oprnPlayerSprite?.(),
      npc: window.__oprnCharacterSprites?.().events["qa-guide-event"],
    })));
    return capture(options);
  };
  let report;
  try {
    report = await runRuntimeQa(page, scenario, { serverUrl: server.url });
  } catch (error) {
    console.error(JSON.stringify({
      browserErrors,
      pendingRequests: [...pendingRequests],
      body: await page.locator("body").innerText(),
    }, null, 2));
    await capture({ path: "output/evidence/appearance-sets/runtime-boot-failure.png" });
    throw error;
  }
  const sprites = await page.evaluate(() => ({
    player: window.__oprnPlayerSprite?.(),
    characters: window.__oprnCharacterSprites?.(),
  }));
  await writeFile("verify-shots/runtime-qa/character-appearance-sets/sprites.json", JSON.stringify(sprites, null, 2));
  await writeFile("verify-shots/runtime-qa/character-appearance-sets/capture-states.json", JSON.stringify(captureStates, null, 2));
  console.log(JSON.stringify({
    beats: report.beats.map(({ id, failures }) => ({ id, failures })),
    errors: report.errors,
    player: sprites.player,
  }, null, 2));
  assert.equal(report.errors.length, 0, "Runtime reported errors");
  assert.deepEqual(report.beats.flatMap((beat) => beat.failures), [], "Runtime scenario failures");
  assert.equal(sprites.player?.resourceId, "qa-manual-charset", "Player must use the uploaded appearance charset");
  assert.equal(captureStates[0]?.player?.frame, 76, "Selected player cell five must be visible");
  assert.equal(captureStates[0]?.npc?.textureKey, "qa-manual-charset", "NPC must use the linked uploaded charset");
  assert.equal(captureStates[0]?.npc?.frame, 88, "Selected NPC cell five must be visible");
  console.log("APPEARANCE_RUNTIME_PASS");
} finally {
  await browser?.close();
  await server.close();
  cleanupCharacterAppearanceFixture();
  console.log(`cleanup: closed Firefox and player server ${server.port}; removed appearance fixture`);
}
