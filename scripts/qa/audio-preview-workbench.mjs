import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = root + "output/evidence/audio-preview-ux/";
const origin = process.env.AUDIO_PREVIEW_QA_URL ?? "http://127.0.0.1:9841";
const report = { origin, browser: "Chromium", httpRelay: process.env.AUDIO_QA_HTTP_RELAY === "1", rows: [], errors: [], cleanup: false };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ["--no-sandbox", "--mute-audio", "--disable-gpu", "--use-gl=swiftshader", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (report.httpRelay) await context.route(origin + "/**", async route => { await route.fulfill({ response: await route.fetch() }); });
await context.addInitScript(() => {
  window.__qaContexts = []; window.__qaPanners = [];
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(...args) { super(...args); window.__qaContexts.push(this); }
    createStereoPanner() { const p = super.createStereoPanner(); window.__qaPanners.push(p); return p; }
  };
});
const page = await context.newPage();
page.on("pageerror", e => report.errors.push(String(e)));
async function receipt(row) { report.rows.push(row); await writeFile(out + "browser-report.json", JSON.stringify(report, null, 2)); console.log("QA_PASS " + row.scenario); }
async function mediaEvent(selector, event, action, minVolume = -1) {
  const token = "AUDIO_QA_" + crypto.randomUUID();
  const result = page.waitForEvent("console", { predicate: m => m.text().startsWith(token), timeout: 26000 }).then(m => JSON.parse(m.text().slice(token.length)), e => ({ error: String(e) }));
  await page.evaluate(({ selector, event, token, minVolume }) => {
    const signal = AbortSignal.timeout(25000);
    const listener = e => {
      const a = e.target;
      if (!(a instanceof HTMLMediaElement) || !a.matches(selector) || a.volume < minVolume) return;
      document.removeEventListener(event, listener, true);
      console.info(token + JSON.stringify({ event, trusted: e.isTrusted, current: a.currentTime, duration: a.duration, paused: a.paused, loop: a.loop, volume: a.volume, rate: a.playbackRate, src: a.currentSrc }));
    };
    document.addEventListener(event, listener, { capture: true, signal });
  }, { selector, event, token, minVolume });
  await action();
  const observation = await result;
  assert.equal(observation.error, undefined);
  assert.equal(observation.trusted, true);
  return observation;
}
async function storeAction(action) {
  const token = "STORE_QA_" + crypto.randomUUID();
  const signal = page.waitForEvent("console", { predicate: m => m.text() === token, timeout: 26000 }).then(() => true, e => ({ error: String(e) }));
  await page.evaluate(async token => {
    const { store } = await import("/src/project/store.ts");
    const abort = AbortSignal.timeout(25000);
    const off = store.subscribe(() => { off(); abort.removeEventListener("abort", off); console.info(token); });
    abort.addEventListener("abort", off, { once: true });
  }, token);
  await action(); assert.equal(await signal, true);
}
async function captures(name, selector) {
  const metrics = [];
  for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const value = await page.locator(selector).evaluate(n => {
      const transport = n.querySelector('[data-testid$="-transport"]');
      const r = transport?.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, transport: r?.toJSON() };
    });
    assert.equal(value.horizontalOverflow, false);
    assert.ok(value.transport && value.transport.height > 0 && value.transport.bottom <= size.height && value.transport.top >= 0);
    const artifact = name + "-" + size.width + ".png";
    await page.screenshot({ path: out + artifact }); metrics.push({ ...value, artifact });
  }
  return metrics;
}
async function runtimeState() {
  return page.evaluate(async () => ({ state: (await import("/src/player/audio/index.ts")).getAudioEngine().audioStateSnapshot(), playing: [...document.querySelectorAll("audio[data-oprn-audio]")].some(a => !a.paused && !!a.currentSrc) }));
}
try {
  await page.goto(origin + "/?freshProject=1", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(async () => {
    const [{ store }, { createBlankProject }, { focusProjectStartMap }] = await Promise.all([import("/src/project/store.ts"), import("/src/project/defaults.ts"), import("/src/editor/mapSelection.ts")]);
    if (!store.isLoaded()) await new Promise((resolve, reject) => {
      const abort = AbortSignal.timeout(90000);
      const off = store.subscribe(() => { if (store.isLoaded()) { off(); abort.removeEventListener("abort", fail); resolve(); } });
      function fail() { off(); reject(new Error("load deadline")); }
      abort.addEventListener("abort", fail, { once: true });
    });
    if (store.isRemotePersistenceEnabled()) throw new Error("QA must not write remote projects");
    const project = createBlankProject();
    Object.values(project.maps)[0].bgm = { mode: "custom", resourceId: "cc0-bgm-field" };
    store.replaceProject(project); focusProjectStartMap();
  });
  await page.getByTestId("toolbar-sound-test").click();
  const dm = '[data-testid="audio-test-dialog"] audio[data-editor-audio-preview]';
  await page.locator('[data-testid="audio-test-list"] [data-resource-id="cc0-bgm-field"]').click();
  assert.equal(await page.locator(dm).evaluate(a => a.paused), true);
  const play = await mediaEvent(dm, "playing", () => page.getByTestId("audio-test-play").click());
  const progress = await mediaEvent(dm, "timeupdate", async () => {});
  const pause = await mediaEvent(dm, "pause", () => page.getByTestId("audio-test-play").click());
  const seek = await mediaEvent(dm, "seeked", () => page.getByTestId("audio-test-seek").fill("20"));
  assert.ok(Math.abs(seek.current - 20) < .3); assert.equal(pause.paused, true);
  const dialogShots = await captures("after-dialog", '[data-testid="audio-test-dialog"]');
  await receipt({ scenario: "dialog MP3 play pause seek and desktop layout", play, progress, pause, seek, dialogShots });
  await page.getByTestId("audio-test-tab-sound").click();
  await page.locator('[data-testid="audio-test-list"] [data-resource-id="cc0-sound-ui-confirm"]').click();
  const ended = await mediaEvent(dm, "ended", () => page.getByTestId("audio-test-play").click());
  assert.equal(ended.loop, false); assert.equal(await page.getByTestId("audio-test-transport").getAttribute("data-state"), "ended");
  assert.match(await page.getByTestId("audio-test-time").innerText(), /\.18/);
  const replay = await mediaEvent(dm, "ended", () => page.getByTestId("audio-test-play").click());
  await page.getByTestId("audio-test-filter").fill("NO_MATCH_QA");
  report.searchDebug = await page.locator("input").evaluateAll(nodes => nodes.filter(n => n.type === "search").map(n => ({ testid: n.dataset.testid, value: n.value, connected: n.isConnected, label: n.getAttribute("aria-label"), focused: document.activeElement === n })));
  console.log("QA_SEARCH " + JSON.stringify(report.searchDebug));
  await page.keyboard.press("Space");
  assert.equal(await page.getByTestId("audio-test-filter").inputValue(), "NO_MATCH_QA ");
  assert.equal(await page.locator('[data-testid="audio-test-list"] [tabindex="0"]').count(), 1);
  await page.screenshot({ path: out + "after-empty-search.png" });
  await receipt({ scenario: "short SE ended replay and keyboard text protection", ended, replay });
  await page.getByTestId("audio-test-close").click();
  await mediaEvent("audio[data-oprn-audio]", "playing", () => page.evaluate(async () => {
    const engine = (await import("/src/player/audio/index.ts")).getAudioEngine(); engine.setQaInstrumentation(true); engine.unlock();
    engine.setVolume("bgm", .37); engine.setVolume("se", .29); engine.setPlaybackRate(.85); engine.setPan(-.2);
    engine.play("bgm", "cc0-music-field-loop", "/assets/cc0/audio/field-loop.wav", true, { fadeInMs: 0 });
  }));
  await page.evaluate(async () => (await import("/src/player/audio/index.ts")).getAudioEngine().setFadeInMs(777));
  const gameBefore = await runtimeState();
  await page.getByTestId("toolbar-sound-test").click();
  await page.locator('[data-testid="audio-test-list"] [data-resource-id="cc0-music-field-loop"]').click();
  await page.getByTestId("audio-test-advanced").locator("summary").click();
  for (const [id, value] of [["volume", "40"], ["tempo", "125"], ["balance", "40"], ["fade", "2"]]) await page.getByTestId("audio-test-" + id).locator("input").fill(value);
  const fadeStart = await mediaEvent(dm, "playing", () => page.getByTestId("audio-test-play").click());
  const fadeEnd = await mediaEvent(dm, "timeupdate", async () => {}, .39);
  assert.equal(fadeStart.volume, 0); assert.ok(Math.abs(fadeEnd.volume - .4) < .02); assert.equal(fadeEnd.rate, 1.25);
  const panners = await page.evaluate(() => window.__qaPanners.map(p => ({ pan: p.pan.value, context: p.context.state })));
  assert.ok(panners.some(p => Math.abs(p.pan - .4) < .001)); assert.deepEqual(await runtimeState(), gameBefore);
  await page.screenshot({ path: out + "after-advanced.png" });
  await page.getByTestId("audio-test-reset").click(); assert.equal(await page.locator(dm).evaluate(a => a.volume), 1);
  await page.getByTestId("audio-test-close").click(); assert.deepEqual(await runtimeState(), gameBefore);
  assert.equal(await page.locator("audio[data-editor-audio-preview]").count(), 0);
  await receipt({ scenario: "real WebAudio pan fade and gameplay isolation", gameBefore, fadeStart, fadeEnd, panners });
  await page.getByTestId("toolbar-resource-manager").click();
  await page.getByTestId("resource-category-list").getByRole("option", { name: "음악 (BGM)", exact: true }).click();
  await page.locator('[data-testid="audio-resource-row"][data-resource-id="cc0-bgm-field"]').click();
  const rm = '[data-testid="resource-modal"] audio[data-editor-audio-preview]';
  const rmPlay = await mediaEvent(rm, "playing", () => page.getByTestId("audio-description-preview-play").click());
  await mediaEvent(rm, "pause", () => page.getByTestId("audio-description-preview-play").click());
  await mediaEvent(rm, "seeked", () => page.getByTestId("audio-description-preview-seek").fill("10"));
  assert.equal(await page.getByTestId("audio-description-reset").count(), 1);
  const original = await page.getByTestId("audio-description-input").inputValue();
  await page.getByTestId("audio-description-input").fill("QA_DESCRIPTION_SENTINEL"); await page.getByTestId("audio-description-input").press("Space");
  assert.equal(await page.locator(rm).evaluate(a => a.paused), true);
  await storeAction(() => page.getByTestId("audio-description-save").click());
  await page.getByTestId("audio-description-input").fill(""); await storeAction(() => page.getByTestId("audio-description-save").click());
  await storeAction(() => page.getByTestId("audio-description-reset").click()); assert.equal(await page.getByTestId("audio-description-input").inputValue(), original);
  const choosing = page.waitForEvent("filechooser"); await page.getByTestId("resource-import-button").click(); const chooser = await choosing;
  const wave = await readFile(root + "public/assets/cc0/audio/field-loop.wav");
  await storeAction(() => chooser.setFiles({ name: "길어진 음원 제목 ".repeat(5) + ".wav", mimeType: "audio/wav", buffer: wave }));
  await page.getByTestId("audio-description-input").fill("긴 설명에서도 재생 버튼과 탐색 막대가 유지됩니다. ".repeat(30));
  await storeAction(() => page.getByTestId("audio-description-save").click());
  const rmShots = await captures("after-resource-long", '[data-testid="resource-command-panel"]');
  await receipt({ scenario: "resource manager playback authoring and long content", rmPlay, rmShots });
  await page.getByTestId("resource-modal-close").click(); assert.deepEqual(await runtimeState(), gameBefore);
  await page.getByRole("button", { name: "맵 설정", exact: true }).click();
  await page.getByTestId("map-bgm-resource-set").click();
  const pm = '[data-testid="map-bgm-resource-dialog"] audio[data-editor-audio-preview]';
  const pickerPlay = await mediaEvent(pm, "playing", () => page.getByTestId("db-resource-picker-audio-play").last().click());
  await mediaEvent(pm, "pause", () => page.getByTestId("db-resource-picker-audio-play").last().click());
  const pickerSeek = await mediaEvent(pm, "seeked", () => page.getByTestId("db-resource-picker-audio-seek").last().fill("15"));
  await page.getByTestId("map-bgm-resource-dialog-search").fill("NO_MATCH_QA");
  const pickerShots = await captures("after-picker", '[data-testid="map-bgm-resource-dialog"]');
  await page.getByTestId("map-bgm-resource-dialog-cancel").click(); await page.keyboard.press("Escape");
  assert.equal(await page.locator("audio[data-editor-audio-preview]").count(), 0); assert.deepEqual(await runtimeState(), gameBefore);
  await receipt({ scenario: "map picker playback seek empty search and cleanup", pickerPlay, pickerSeek, pickerShots });
  await page.getByTestId("toolbar-sound-test").click(); await page.getByTestId("audio-test-tab-sound").click();
  await context.route(origin + "/assets/cc0/audio/ui-confirm.wav", route => route.abort("failed"));
  const mediaError = await mediaEvent(dm, "error", () => page.locator('[data-testid="audio-test-list"] [data-resource-id="cc0-sound-ui-confirm"]').click());
  assert.equal(await page.getByTestId("audio-test-transport").getAttribute("data-state"), "error");
  assert.equal(await page.getByTestId("audio-test-play").getAttribute("aria-pressed"), "false");
  await page.screenshot({ path: out + "after-media-error.png" }); await page.getByTestId("audio-test-close").click();
  await receipt({ scenario: "real media error is not false playing", mediaError });
  await page.evaluate(async () => (await import("/src/player/audio/index.ts")).getAudioEngine().stopAll(false));
  assert.deepEqual(report.errors, []);
  report.success = true; console.log("QA_DONE PASS");
} catch (error) {
  report.success = false; report.failure = String(error?.stack ?? error); console.error("QA_FAIL " + report.failure);
  try { report.visible = (await page.locator("body").innerText()).slice(-2500); await page.screenshot({ path: out + "qa-failure.png" }); } catch (captureError) { report.captureError = String(captureError); }
  process.exitCode = 1;
} finally {
  await context.close(); await browser.close(); report.cleanup = true;
  await writeFile(out + "browser-report.json", JSON.stringify(report, null, 2));
}
