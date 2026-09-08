// Run against this worktree's Vite server on port 38422; see openwiki/bgm-catalog.md.
import { firefox } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.AUDIO_QA_URL ?? "http://127.0.0.1:38422";
const out = process.env.AUDIO_QA_OUT ?? "/dev/shm/rpg-zzu-issue693-audio-r2/evidence/native";
const MIDI = "easyrpg-music-battle-1";
const WAV = "cc0-music-field-loop";
await mkdir(out, { recursive: true });
const browser = await firefox.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const results = { origin, browser: "firefox", checks: [], pageErrors: [], console: [], requestFailures: [] };
page.on("pageerror", error => results.pageErrors.push(error.message));
page.on("console", message => {
  if (["error", "warning"].includes(message.type())) results.console.push(message.text());
});
page.on("requestfailed", request => results.requestFailures.push({ url: request.url().split("?")[0], error: request.failure()?.errorText }));
const check = (name, actual, expected) => {
  results.checks.push({ name, actual, expected });
  assert.deepEqual(actual, expected, name);
};
const byId = id => page.getByTestId(id);
try {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${origin}/?freshProject=1`, { waitUntil: "load", timeout: 180000 });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Editor readiness timeout")); }, 90000);
    const check = () => {
      if (!document.querySelector('[data-testid="edit-canvas"] canvas')) return;
      clearTimeout(deadline); observer.disconnect(); resolve();
    };
    const observer = new MutationObserver(check);
    observer.observe(document, { childList: true, subtree: true });
    check();
  }));
  results.mapId = await page.evaluate(async MIDI => {
    const [{ store }, { editorState }] = await Promise.all([import("/src/project/store.ts"), import("/src/editor/editorState.ts")]);
    if (!store.isLoaded()) await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { unsubscribe(); reject(new Error("Project readiness timeout")); }, 60000);
      const unsubscribe = store.subscribe(() => {
        if (!store.isLoaded()) return;
        clearTimeout(deadline); unsubscribe(); resolve();
      });
    });
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local-only persistence");
    const id = editorState.get().currentMapId;
    // A local-only legacy-reference fixture, not a saved/content deliverable.
    store.updateMap(id, map => { map.bgm = { mode: "custom", resourceId: MIDI, fadeInMs: 700 }; });
    return id;
  }, MIDI);
  await byId("sidebar-map-settings").click();
  await byId("map-bgm-resource-set").click();
  check("map MIDI row disabled", await byId(`map-bgm-resource-dialog-option-${MIDI}`).isDisabled(), true);
  check("map legacy confirm disabled", await byId("map-bgm-resource-dialog-ok").isDisabled(), true);
  check("map legacy preview retained", (await byId("map-bgm-resource-dialog-preview").textContent()).includes(MIDI), true);
  await page.screenshot({ path: `${out}/map-legacy.png` });
  await byId("map-bgm-resource-dialog-cancel").click();
  const mapBgm = () => page.evaluate(async id => (await import("/src/project/store.ts")).store.getCurrent().maps[id].bgm, results.mapId);
  check("map inspection preserves legacy", await mapBgm(), { mode: "custom", resourceId: MIDI, fadeInMs: 700 });
  await byId("map-bgm-resource-set").click();
  await byId(`map-bgm-resource-dialog-option-${WAV}`).click();
  check("map WAV confirm enabled", await byId("map-bgm-resource-dialog-ok").isDisabled(), false);
  await byId("map-bgm-resource-dialog-ok").click();
  check("map WAV applied", await mapBgm(), { mode: "custom", resourceId: WAV, fadeInMs: 700 });
  await page.screenshot({ path: `${out}/map-supported.png` });
  await byId(`map-properties-modal-${results.mapId}`).getByRole("button", { name: "닫기", exact: true }).click();

  for (const surface of ["native", "m2"]) {
    for (const currentId of ["", MIDI]) {
      // Open the shipped command-edit dialog, including staging, preview, custom
      // dropdown and Apply. No forTest renderer or mocked command body is used.
      await page.evaluate(async ({ surface, currentId }) => {
        const { openEventCommandEditDialog } = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
        window.midiApplied = null;
        openEventCommandEditDialog({
          initial: surface === "native"
            ? { kind: "playAudio", resourceId: currentId, loop: true }
            : { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { resourceId: currentId, volume: 100 } },
          onApply: command => { window.midiApplied = command; },
        });
      }, { surface, currentId });
      const selectId = surface === "native" ? "play-audio-resource-select" : "m2-command-resourceId-picker";
      check(`${surface} initial identity`, await byId(selectId).inputValue(), currentId);
      const trigger = page.locator(`[data-custom-select-for="${selectId}"]`);
      await trigger.click();
      const optionIndex = await byId(selectId).evaluate((select, MIDI) => [...select.options].find(option => option.value === MIDI).index, MIDI);
      const midiOption = page.locator(`.event-custom-select-option[data-option-index="${optionIndex}"]`);
      check(`${surface} visible MIDI option disabled`, await midiOption.isDisabled(), true);
      await page.screenshot({ path: `${out}/${surface}-${currentId ? "legacy" : "new"}.png` });
      await page.keyboard.press("Escape");
      // Probe the handler boundary as well as real disabled keyboard/pointer UI.
      await byId(selectId).evaluate((select, MIDI) => { select.value = MIDI; select.dispatchEvent(new Event("change", { bubbles: true })); }, MIDI);
      check(`${surface} rejected MIDI preserves identity`, await byId(selectId).inputValue(), currentId);
      if (currentId) {
        await byId("event-command-edit-ok").click();
        const applied = await page.evaluate(() => window.midiApplied);
        check(`${surface} legacy inspection applies unchanged`, surface === "native" ? applied.resourceId : applied.fields.resourceId, MIDI);
        continue;
      }
      await trigger.click();
      const wavIndex = await byId(selectId).evaluate((select, WAV) => [...select.options].find(option => option.value === WAV).index, WAV);
      await page.locator(`.event-custom-select-option[data-option-index="${wavIndex}"]`).click();
      check(`${surface} visible WAV selection`, await byId(selectId).inputValue(), WAV);
      if (surface === "native") {
        await page.evaluate(() => {
          window.nativeAudio = new Promise((resolve, reject) => {
            const heard = new WeakSet();
            const cleanup = () => {
              clearTimeout(deadline);
              document.removeEventListener("playing", observe, true);
              document.removeEventListener("volumechange", observe, true);
            };
            const observe = event => {
              const audio = event.target;
              if (!(audio instanceof HTMLAudioElement) || audio.dataset.oprnAudio !== "1" || !audio.src.endsWith("/field-loop.wav")) return;
              if (event.type === "playing" && event.isTrusted) heard.add(audio);
              if (!heard.has(audio) || audio.volume <= 0) return;
              cleanup(); resolve({ trusted: true, paused: audio.paused, volume: audio.volume, src: audio.currentSrc });
            };
            const deadline = setTimeout(() => { cleanup(); reject(new Error("Native audio playing timeout")); }, 15000);
            document.addEventListener("playing", observe, true);
            document.addEventListener("volumechange", observe, true);
          });
        });
        await byId("play-audio-preview").click();
        results.playback = await page.evaluate(() => window.nativeAudio);
        check("native WAV plays", results.playback.trusted && !results.playback.paused && results.playback.volume > 0, true);
        await byId("play-audio-stop").click();
      }
      await byId("event-command-edit-ok").click();
      const applied = await page.evaluate(() => window.midiApplied);
      check(`${surface} supported command applied`, surface === "native" ? applied.resourceId : applied.fields.resourceId, WAV);
    }
  }
  check("no native page errors", results.pageErrors, []);
} catch (error) {
  results.failure = String(error.stack ?? error);
  results.body = await page.locator("body").textContent();
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Native MIDI authoring proof: ${results.checks.length} checks passed; ${out}/results.json`);
