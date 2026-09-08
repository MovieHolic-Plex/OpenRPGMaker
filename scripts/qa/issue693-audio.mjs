import { chromium, firefox } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.AUDIO_QA_URL ?? "http://127.0.0.1:38422";
const out = process.env.AUDIO_QA_OUT ?? "output/evidence/issue693-audio/browser";
await mkdir(out, { recursive: true });
const browserName = process.env.AUDIO_QA_BROWSER ?? "firefox";
const browser = await chromium.launch({ headless: true });
let editorBrowser;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const results = { origin, browserName, transport: [], errors: [] };
const check = (name, actual, expected) => {
  results.transport.push({ name, actual, expected });
  try { assert.deepEqual(actual, expected); } catch { results.errors.push(name); }
};
try {
  await page.goto(`${origin}/manifest.webmanifest`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await Promise.all((await caches.keys()).map(key => caches.delete(key)));
    const controlled = navigator.serviceWorker.controller ? Promise.resolve() : new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("SW control timeout")), 15000);
      navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(deadline); resolve(); }, { once: true });
    });
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    await controlled;
  });
  const path = "/assets/cc0/audio/ui-confirm.wav";
  const bytes = await readFile(`public${path}`);
  async function request(name, range) {
    const response = await page.evaluate(async ({ path, range }) => {
      try {
        const response = await fetch(path, { headers: range ? { Range: range } : {} });
        const data = new Uint8Array(await response.arrayBuffer());
        return { status: response.status, type: response.headers.get("content-type"), range: response.headers.get("content-range"), length: data.length, first: [...data.slice(0, 32)] };
      } catch (error) { return { error: String(error) }; }
    }, { path, range });
    results.transport.push({ name, response });
    return response;
  }
  const cold = await request("cold-range", "bytes=0-31");
  check("cold range status", cold.status, 206);
  check("cold range bytes", cold.first, [...bytes.subarray(0, 32)]);
  const full = await request("warm-full");
  check("full length", full.length, bytes.length);
  const warm = await request("warm-range", "bytes=0-31");
  check("warm range status", warm.status, 206);
  check("warm range length", warm.length, 32);
  const suffix = await request("suffix-range", "bytes=-16");
  check("suffix range status", suffix.status, 206);
  check("suffix range bytes", suffix.first, [...bytes.subarray(-16)]);
  const invalid = await request("unsatisfiable-range", `bytes=${bytes.length + 1}-`);
  check("unsatisfiable range status", invalid.status, 416);
  const missing = await page.evaluate(async () => {
    const response = await fetch("/assets/cc0/audio/catalog/absent.mp3");
    return { status: response.status, type: response.headers.get("content-type") };
  });
  check("missing media status", missing.status, 404);
  if (!process.argv.includes("--transport-only")) {
    editorBrowser = await (browserName === "chromium" ? chromium : firefox).launch({ headless: true });
    const editorContext = await editorBrowser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
    const editor = await editorContext.newPage();
    editor.on("console", message => {
      if (message.type() === "error" || message.type() === "warning") (results.console ??= []).push(message.text());
    });
    editor.on("requestfailed", request => (results.requestFailures ??= []).push({ url: request.url().split("?")[0], failure: request.failure()?.errorText }));
    editor.on("pageerror", error => { results.errors.push(`pageerror: ${error.message}`); });
    await editor.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
    await editor.goto(`${origin}/?freshProject=1`, { waitUntil: "domcontentloaded" });
    await editor.evaluate(() => new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Editor readiness timeout")); }, 90000);
      const check = () => {
        if (!document.querySelector('[data-testid="edit-canvas"] canvas')) return;
        clearTimeout(deadline); observer.disconnect(); resolve();
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { childList: true, subtree: true });
      check();
    }));
    results.project = await editor.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      if (!store.isLoaded()) await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => { unsubscribe(); reject(new Error("Project readiness timeout")); }, 60000);
        const unsubscribe = store.subscribe(() => {
          if (!store.isLoaded()) return;
          clearTimeout(deadline); unsubscribe(); resolve();
        });
      });
      if (store.isRemotePersistenceEnabled()) throw new Error("QA must not mutate remote content");
      const project = store.getCurrent();
      return { title: project.meta.title, startMapId: project.startMapId, remotePersistence: false, bgm: project.maps[project.startMapId]?.bgm, defaultBgm: project.system.defaultBgmResourceId };
    });
    // Arm the native, engine-owned playback event BEFORE the very first interaction.
    await editor.evaluate(() => {
      window.audioProof = new Promise(resolve => {
        const heard = new WeakSet();
        const finish = result => {
          clearTimeout(deadline);
          document.removeEventListener("playing", observe, true);
          document.removeEventListener("volumechange", observe, true);
          resolve(result);
        };
        const observe = event => {
          const audio = event.target;
          if (!(audio instanceof HTMLAudioElement) || audio.dataset.oprnAudio !== "1" || !audio.loop) return;
          if (event.type === "playing" && event.isTrusted) heard.add(audio);
          if (!heard.has(audio) || audio.volume <= 0) return;
          finish({ trusted: true, src: audio.currentSrc, readyState: audio.readyState, paused: audio.paused, volume: audio.volume });
        };
        const deadline = setTimeout(() => finish({ error: "First-click BGM did not play" }), 60000);
        document.addEventListener("playing", observe, true);
        document.addEventListener("volumechange", observe, true);
      });
    });
    await editor.getByTestId("mode-play").click();
    results.firstClick = await editor.evaluate(() => window.audioProof);
    await editor.screenshot({ path: `${out}/first-click.png` });
    results.firstClickState = await editor.evaluate(async () => {
      const { getAudioEngine } = await import("/src/player/audio/index.ts");
      return { unlocked: getAudioEngine().isUnlocked(), observed: window.__oprnAudioObserved,
        audios: [...document.querySelectorAll("audio")].map(audio => ({ src: audio.currentSrc || audio.src, loop: audio.loop, readyState: audio.readyState, paused: audio.paused, error: audio.error?.code })),
        windowText: document.querySelector('[data-testid="test-play-window"]')?.textContent?.slice(0, 2000) };
    });
    assert.equal(results.firstClick.trusted, true, JSON.stringify(results.firstClick));
    assert.equal(results.firstClick.paused, false);
    assert.ok(results.firstClick.readyState >= 2);
    assert.ok(results.firstClick.volume > 0);
    await editor.getByTestId("test-play-window-close").click();
    await editor.getByTestId("toolbar-sound-test").click();
    const visibleIds = await editor.locator('[data-testid="audio-test-list"] [data-resource-id]').evaluateAll(nodes => nodes.map(node => node.dataset.resourceId).filter(Boolean));
    const inventory = await editor.evaluate(async () => {
      const [{ store }, { listDatabaseResourceOptions }, { audioPlayback }] = await Promise.all([
        import("/src/project/store.ts"), import("/src/editor/panels/databaseResourcePickerDialog.ts"), import("/src/editor/panels/audioResourcePresentation.ts"),
      ]);
      const project = store.getCurrent();
      return listDatabaseResourceOptions("music", project).map(entry => ({ id: entry.id, ...audioPlayback(entry.id, project) }));
    });
    assert.deepEqual([...visibleIds].sort(), inventory.map(entry => entry.id).sort());
    results.inventory = [];
    for (const entry of inventory.filter(entry => entry.playable)) {
      const proof = await editor.evaluate(async entry => {
        const response = await fetch(entry.url, { cache: "no-store" });
        const bytes = await response.arrayBuffer();
        const context = new AudioContext();
        try {
          const decoded = await context.decodeAudioData(bytes.slice(0));
          return { id: entry.id, status: response.status, type: response.headers.get("content-type"), bytes: bytes.byteLength, channels: decoded.numberOfChannels, duration: decoded.duration };
        } finally { await context.close(); }
      }, entry);
      assert.equal(proof.status, 200);
      assert.match(proof.type, /^audio\//);
      assert.ok(proof.duration > 0);
      results.inventory.push(proof);
    }
    results.missingPlayback = await editor.evaluate(async () => {
      const { getAudioEngine } = await import("/src/player/audio/index.ts");
      const engine = getAudioEngine();
      engine.stopAll();
      const nativePlay = HTMLMediaElement.prototype.play;
      const observed = new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error("Missing media rejection timeout")), 15000);
        // Observe the browser's own promise, never replace its result or playback behavior.
        HTMLMediaElement.prototype.play = function () {
          const result = nativePlay.call(this);
          if (this.src.endsWith("/absent.mp3")) void result.catch(error => {
            clearTimeout(deadline); resolve({ name: error.name, code: this.error?.code });
          });
          return result;
        };
      });
      try {
        engine.play("bgm", "qa-missing", "/assets/cc0/audio/catalog/absent.mp3", true, { fadeInMs: 0 });
        return await observed;
      } finally { HTMLMediaElement.prototype.play = nativePlay; }
    });
    assert.equal(results.missingPlayback.name, "NotSupportedError");
    results.mimeAlias = await editor.evaluate(async () => {
      const { resolveAudioSource } = await import("/src/player/audio/audioResources.ts");
      const bytes = new Uint8Array(await (await fetch("/assets/cc0/audio/ui-confirm.wav")).arrayBuffer());
      const payload = btoa(String.fromCharCode(...bytes));
      const url = resolveAudioSource("alias", { assets: { uploaded: { alias: { kind: "sound", dataUrl: `data:audio/x-wav;base64,${payload}` } } } });
      const context = new AudioContext();
      try {
        const decoded = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
        return { canonical: url.startsWith("data:audio/wav;"), unchangedBytes: url.endsWith(payload), duration: decoded.duration };
      } finally { await context.close(); }
    });
    assert.equal(results.mimeAlias.canonical, true);
    assert.equal(results.mimeAlias.unchangedBytes, true);
    assert.ok(results.mimeAlias.duration > 0);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
      await editor.setViewportSize(viewport);
      await editor.screenshot({ path: `${out}/inventory-${viewport.width}.png` });
    }
    await editorContext.close();
  }
  assert.equal(results.errors.length, 0, results.errors.join(", "));
} finally {
  results.pages = [];
  for (const context of [...browser.contexts(), ...(editorBrowser?.contexts() ?? [])]) for (const page of context.pages()) {
    results.pages.push({ url: page.url(), body: (await page.locator("body").textContent())?.slice(-6000) });
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await editorBrowser?.close();
  await browser.close();
}
