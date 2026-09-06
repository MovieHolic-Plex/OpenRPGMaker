import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { armEventCommandObservation, eventCommandQaOp } from "../../lib/runtimeQaEventCommands.mjs";

const VIDEO = '[data-testid="runtime-movie-video"]';
const OVERLAY = '[data-testid="runtime-movie-overlay"]';
const DIALOGUE = '[data-testid="dialogue-box"]';
const state = (path, equals) => ({ source: "state", path, equals });
const dom = (selector, equals) => ({ source: "dom", selector, read: "present", equals });
const op = (trigger, observe, extra = {}) => ({ kind: "eventCommand", trigger, observe, timeoutMs: 15000, ...extra });
const boot = { id: "u04-boot", ops: [op({ kind: "key", key: "Enter" }, [state(["mapId"], "map_intro"), state(["player"], { x: 2, y: 3 })])], expect: { mapId: "map_intro", x: 2, y: 3 } };

// The CLI below consumes commands exported by the actual editor proof. The ordinary
// runtime-QA entry can also load this default scenario with a U04 --project fixture.
export default {
  id: "event-command-remediation-u04",
  beats: [boot, { id: "g3-f10", shot: true, ops: [{ kind: "face", dir: "up" },
    op({ kind: "action" }, [dom('[data-testid="picture-picA"]', true), dom(`${DIALOGUE}.page-ready`, true), dom('[data-testid="picture-wrong-target"]', false)])],
  expect: { x: 2, y: 3, testidPresent: ["picture-picA", "dialogue-box"], testidAbsent: ["picture-wrong-target"] } },
  { id: "g5-f2", shot: true, ops: [
    op({ kind: "key", key: "z" }, [dom(VIDEO, true)], { event: { selector: VIDEO, type: "playing" } }),
    op({ kind: "none" }, [dom(VIDEO, false), dom(`${DIALOGUE}.page-ready`, true)]),
  ], expect: { x: 2, y: 3, testidPresent: ["dialogue-box"], testidAbsent: ["runtime-movie-overlay"] } }],
};

/** Read-only timing/state observations plus a native video clock hold after decoding.
 * The first real playing event pauses the video so key assertions cannot race a 3s
 * clip. End verification releases this hold and seeks, then awaits native ended.
 * add/remove wrappers call the native implementation unchanged; they only account
 * for the five movie-owner registrations already traced in playSceneMovies.ts.
 */
function installMediaProbe() {
  const records = { picture: null, movie: null, sentinel: null, complete: null, events: [], listeners: [] };
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  let pendingMovieKey = false;
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    const media = this instanceof HTMLVideoElement && this.dataset.testid === "runtime-movie-video";
    if (media || (this === document && type === "keydown" && pendingMovieKey)) {
      records.listeners.push({ target: this, type, callback, active: true });
      if (media && type === "playing") pendingMovieKey = true;
      if (this === document) pendingMovieKey = false;
    }
    return add.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    for (const entry of records.listeners) if (entry.target === this && entry.type === type && entry.callback === callback) entry.active = false;
    return remove.call(this, type, callback, options);
  };
  const onMedia = event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || video.dataset.testid !== "runtime-movie-video") return;
    records.events.push({ type: event.type, at: performance.now(), currentTime: video.currentTime, readyState: video.readyState, trusted: event.isTrusted });
    if (event.type === "playing" && !records.movie) {
      records.movie = { video, at: performance.now(), source: video.getAttribute("src"), duration: video.duration, decoded: video.readyState >= 2 };
      video.pause();
    }
  };
  for (const type of ["playing", "ended", "error", "abort"]) document.addEventListener(type, onMedia, true);
  const observer = new MutationObserver(() => {
    const now = performance.now();
    const picture = document.querySelector('[data-testid="picture-picA"]');
    if (picture && !records.picture) records.picture = { at: now, opacity: Number(picture.style.opacity) };
    if (picture && !records.complete && Number(picture.style.opacity) === 0.502) records.complete = { at: now };
    const sentinel = document.querySelector('[data-testid="dialogue-box"]');
    if (sentinel && !records.sentinel) records.sentinel = { at: now, pictureOpacity: picture ? Number(picture.style.opacity) : null };
  });
  observer.observe(document, { childList: true, subtree: true, attributes: true });
  window.__u04Probe = {
    read: () => ({ picture: records.picture, complete: records.complete, sentinel: records.sentinel,
      movie: records.movie && { at: records.movie.at, duration: records.movie.duration, decoded: records.movie.decoded,
        source: records.movie.source, connected: records.movie.video.isConnected, paused: records.movie.video.paused },
      events: records.events, activeMovieListeners: records.listeners.filter(entry => entry.active).length,
      totalMovieListeners: records.listeners.length }),
    video: () => records.movie?.video,
    dispose: () => {
      observer.disconnect();
      for (const type of ["playing", "ended", "error", "abort"]) document.removeEventListener(type, onMedia, true);
      EventTarget.prototype.addEventListener = add;
      EventTarget.prototype.removeEventListener = remove;
      delete window.__u04Probe;
    },
  };
}

async function observedAction(page, observation, action) {
  await page.evaluate(armEventCommandObservation, observation);
  try {
    await page.evaluate(() => window.__eventCommandQa.start());
    await action();
    const trace = await page.evaluate(async () => { window.__eventCommandQa.check(); return await window.__eventCommandQa.result; });
    assert.equal(trace.status, "success", JSON.stringify(trace));
    return trace;
  } finally {
    await page.evaluate(() => { window.__eventCommandQa.abort(); delete window.__eventCommandQa; });
  }
}

async function abortByNavigation(page) {
  let timer;
  let resolveReceipt;
  const received = new Promise(resolve => {
    resolveReceipt = resolve;
    timer = setTimeout(() => resolve({ status: "timeout", error: "Missing pagehide abort receipt" }), 15000);
  });
  try {
    await page.exposeFunction("u04AbortReceipt", resolveReceipt);
    await page.evaluate(armEventCommandObservation, op({ kind: "none" }, [dom(OVERLAY, false)], { event: { selector: VIDEO, type: "ended" } }));
    await page.evaluate(() => {
      window.__eventCommandQa.start();
      window.__eventCommandQa.result.then(trace => window.u04AbortReceipt(trace));
      window.addEventListener("pagehide", () => window.__u04Probe.dispose(), { once: true });
    });
    await page.goto("about:blank", { waitUntil: "load" });
    const trace = await received;
    assert.equal(trace.status, "aborted");
    assert.ok(Object.values(trace.cleanup).every(Boolean));
    assert.equal(await page.locator("video").count(), 0);
    return { ...trace, channel: "real navigation/pagehide (not a fabricated video abort event)", documentDisposed: true };
  } finally { clearTimeout(timer); }
}

async function proveCase(server, original, entry, directory, out, ending = "ended") {
  const fixture = structuredClone(original);
  const command = structuredClone(fixture.maps.map_intro.events[0].pages[0].commands[entry.index]);
  assert.deepEqual(command, entry.expected);
  // Isolate the exported command, not a reconstructed replacement, behind a real
  // map action. Other event/asset data remains the exported editor project's data.
  const sequence = [command, { kind: "text", body: `${entry.name}-sentinel` }];
  fixture.maps.map_intro.events[0].commands = sequence;
  fixture.maps.map_intro.events[0].pages[0].commands = sequence;
  const name = ending === "ended" ? entry.name : `${entry.name}-${ending}`;
  const projectPath = join(directory, `${name}.json`);
  await writeFile(projectPath, JSON.stringify(fixture), { flag: "wx" });
  // Fresh Firefox avoids Chromium's observed ERR_NETWORK_CHANGED loopback failures
  // on this shared host, without retrying or hiding failed module requests.
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const writes = [];
  console.log(`${name}: fresh browser boot`);
  await page.route(url => /supabase|dbserver|\/rest\/v1/i.test(url.href), async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  await page.addInitScript(installMediaProbe);
  try {
    const isMovie = command.kind === "playMovie";
    const observations = [state(["player"], { x: 2, y: 3 }), dom('[data-testid="picture-wrong-target"]', false)];
    if (isMovie) observations.push(dom(VIDEO, true), dom(DIALOGUE, command.wait === false));
    else observations.push(state(["pictures", "picA", "x"], command.x), dom('[data-testid="picture-picA"]', true), dom(DIALOGUE, true));
    const report = await runRuntimeQa(page, { id: `u04-${name}`, projectFixture: projectPath, beats: [boot, {
      id: isMovie ? "g5-f2" : "g3-f10", shot: true, note: JSON.stringify(command),
      ops: [{ kind: "face", dir: "up" }, op({ kind: "action" }, observations, { event: isMovie ? { selector: VIDEO, type: "playing" } : { selector: '[data-testid="picture-picA"] img', type: "load" } })],
      expect: { x: 2, y: 3, testidAbsent: ["picture-wrong-target"] },
    }] }, { serverUrl: server.url, outDir: join(out, name) });
    assert.deepEqual(report.errors, []);
    assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats.map(beat => beat.failures)));
    const before = await page.evaluate(() => window.__u04Probe.read());
    const receipts = { command, before, report: `${name}/manifest.json`, playerUrl: page.url(), writes };
    assert.ok(page.url().endsWith("/player.html"));
    assert.equal(await page.locator(".editor-layout").count(), 0);
    if (!isMovie) {
      const rendered = await page.locator('[data-testid="picture-picA"]').evaluate(node => ({ left: node.style.left, top: node.style.top, transform: node.style.transform, opacity: Number(node.style.opacity), render: node.dataset.render, imageWidth: node.querySelector("img").naturalWidth }));
      assert.equal(rendered.left, `${command.x}px`); assert.equal(rendered.top, `${command.y}px`);
      assert.equal(rendered.transform, "scale(0.5) rotate(15deg)"); assert.equal(rendered.render, "image");
      assert.equal(rendered.imageWidth, 32);
      receipts.rendered = rendered;
      if (command.waitForPicture === true && command.durationMs > 0) {
        // Observe actual DOM ordering, not an epsilon-adjusted wall-clock proxy.
        // Exact duration advancement without a final frame is covered by the unit seam.
        assert.ok(before.complete && before.complete.at <= before.sentinel.at, JSON.stringify(before));
        // This renderer uses rAF, not CSS transitionend. Its actual final rounded
        // opacity must already be visible at sentinel insertion.
        receipts.sentinelAtFullOpacity = before.sentinel.pictureOpacity === 0.502;
        assert.equal(receipts.sentinelAtFullOpacity, true, JSON.stringify(before));
      } else if (command.durationMs > 0) {
        assert.ok(before.sentinel.at - before.picture.at < command.durationMs, JSON.stringify(before));
      }
    } else {
      assert.equal(before.movie.decoded, true);
      assert.equal(before.movie.source, original.assets.uploaded[command.resourceId].dataUrl);
      assert.equal(before.movie.connected, true);
      assert.equal(before.events.some(event => event.type === "ended"), false);
      assert.equal(before.totalMovieListeners, 5);
      if (ending === "abort") {
        receipts.abort = await abortByNavigation(page);
        assert.deepEqual(writes, []);
        await writeFile(join(out, `${name}.json`), JSON.stringify(receipts, null, 2));
        console.log(`${name}: dedicated player navigation abort PASS`);
        return receipts;
      }
      const finished = [dom(OVERLAY, false), ...(command.wait !== false ? [dom(DIALOGUE, true)] : [])];
      // For wait:false the earlier sentinel is already proven. A confirm key may
      // legitimately dismiss that dialogue; do not require it to remain visible.
      receipts.escape = await eventCommandQaOp(page, op({ kind: "key", key: "Escape" }, [dom(OVERLAY, true)], { event: { selector: "*", type: "keydown" } }));
      assert.equal(await page.locator(OVERLAY).count(), 1);
      // Escape may open the general player menu without skipping the movie.
      // Close that real surface before testing Z; its buttons own keyboard focus.
      if (await page.locator('[data-testid="main-menu"]').count()) {
        receipts.closeMenu = await eventCommandQaOp(page, op({ kind: "key", key: "Escape" }, [dom('[data-testid="main-menu"]', false), dom(OVERLAY, true)]));
      }
      receipts.confirmKeyTarget = await page.evaluate(() => document.activeElement?.tagName);
      if (command.skippable !== false && ending === "ended") {
        receipts.skip = await eventCommandQaOp(page, op({ kind: "key", key: "z" }, finished));
      } else {
        if (command.skippable === false) {
          receipts.nonSkippable = await eventCommandQaOp(page, op({ kind: "key", key: "z" }, [dom(OVERLAY, true)], { event: { selector: "*", type: "keydown" } }));
          // The event subscription captures before the owner; assert again after
          // the real key dispatch has completed so an incorrect skip cannot pass.
          assert.equal(await page.locator(OVERLAY).count(), 1);
        }
        receipts.finish = await observedAction(page, op({ kind: "none" }, finished, { event: { selector: VIDEO, type: ending }, timeoutMs: 5000 }), async () => {
          await page.evaluate(async ending => {
            const video = window.__u04Probe.video();
            if (ending === "ended") { video.currentTime = video.duration - 0.05; await video.play(); }
            else video.dispatchEvent(new Event(ending)); // Explicit native-boundary fault injection after real decoding.
          }, ending);
        });
      }
      const after = await page.evaluate(() => window.__u04Probe.read());
      receipts.after = after;
      assert.equal(after.movie.connected, false); assert.equal(after.movie.paused, true);
      assert.equal(after.activeMovieListeners, 0);
    }
    assert.deepEqual(writes, []);
    assert.equal(await page.evaluate(() => Boolean(window.__eventCommandQa)), false);
    await writeFile(join(out, `${name}.json`), JSON.stringify(receipts, null, 2));
    console.log(`${name}: dedicated player PASS`);
    return receipts;
  } catch (error) {
    await writeFile(join(out, `${name}-failure.json`), JSON.stringify({ error: String(error), errors, url: page.url(), body: await page.locator("body").innerText(), probe: await page.evaluate(() => window.__u04Probe?.read()) }, null, 2));
    throw error;
  } finally {
    await page.evaluate(() => window.__u04Probe?.dispose());
    await context.close();
    await browser.close();
  }
}

async function proveCinematic(server, original, directory, out) {
  const fixture = structuredClone(original);
  fixture.system.opening = { enabled: true, skippable: false, scenes: [
    { id: "u04-video", kind: "video", resourceId: "u04-movie", narration: "", durationMs: 0 },
  ] };
  const path = join(directory, "cinematic.json");
  await writeFile(path, JSON.stringify(fixture), { flag: "wx" });
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("playing", function hold(event) {
      if (!(event.target instanceof HTMLVideoElement) || !event.target.matches(".cinematic-video")) return;
      document.removeEventListener("playing", hold, true);
      window.__u04Cinematic = event.target;
      event.target.pause();
    }, true);
  });
  try {
    const report = await runRuntimeQa(page, { id: "u04-cinematic-url", projectFixture: path, beats: [{
      id: "g5-f2-cinematic-url", shot: true,
      ops: [op({ kind: "key", key: "Enter" }, [dom(".cinematic-video", true), dom('[data-testid="runtime-state-json"]', false)], { event: { selector: ".cinematic-video", type: "playing" } })],
      expect: { testidPresent: ["cinematic-sequence"], testidAbsent: ["runtime-state-json"] },
    }] }, { serverUrl: server.url, outDir: join(out, "cinematic-url") });
    assert.deepEqual(report.errors, []);
    assert.ok(report.beats.every(beat => beat.failures.length === 0));
    const decoded = await page.evaluate(() => ({ readyState: window.__u04Cinematic.readyState, source: window.__u04Cinematic.getAttribute("src") }));
    assert.ok(decoded.readyState >= 2);
    assert.equal(decoded.source, original.assets.uploaded["u04-movie"].dataUrl);
    const trace = await observedAction(page, op({ kind: "none" }, [state(["mapId"], "map_intro"), dom(".cinematic-video", false)], { event: { selector: ".cinematic-video", type: "ended" } }), async () => {
      await page.evaluate(async () => { const video = window.__u04Cinematic; video.currentTime = video.duration - 0.05; await video.play(); });
    });
    const cleanup = await page.evaluate(() => ({ paused: window.__u04Cinematic.paused, source: window.__u04Cinematic.getAttribute("src"), connected: window.__u04Cinematic.isConnected }));
    assert.deepEqual(cleanup, { paused: true, source: null, connected: false });
    const receipt = { report: "cinematic-url/manifest.json", decoded, trace, cleanup };
    await writeFile(join(out, "cinematic-url.json"), JSON.stringify(receipt, null, 2));
    console.log("G5-F2 cinematic URL: real decoding/native ended/map boot/source release PASS");
    return receipt;
  } finally { await context.close(); await browser.close(); }
}

export async function provePictureCancellationContinuation(server, original, directory, out, operation) {
  const fixture = structuredClone(original);
  const ready = "u04-followup-ready", done = "u04-followup-done";
  const sentinel = "u04-followup-sentinel", tooLate = "u04-followup-too-late";
  fixture.switches.push(...[ready, done, sentinel, tooLate].map(id => ({ id, name: id })));
  const picture = { ...fixture.maps.map_intro.events[0].pages[0].commands[0], durationMs: 500, waitForPicture: true };
  assert.equal(picture.kind, "showPicture");
  const foreground = [
    { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: true },
    { kind: "setSwitch", switchId: sentinel, value: false },
    { kind: "setSwitch", switchId: tooLate, value: false },
    { kind: "setSwitch", switchId: done, value: false },
    { kind: "setSwitch", switchId: ready, value: true }, picture,
    { kind: "setSwitch", switchId: sentinel, value: true },
    { kind: "text", body: `g3-f10-${operation}-continued` },
  ];
  fixture.maps.map_intro.events[0].commands = foreground;
  fixture.maps.map_intro.events[0].pages[0].commands = foreground;
  const mutation = operation === "erase" ? { kind: "erasePicture", pictureId: picture.pictureId }
    : { ...picture, x: 90, durationMs: 0, waitForPicture: false };
  const producer = [{ kind: "fork", condition: { kind: "switch", switchId: sentinel, value: false }, then: [
    { ...picture, pictureId: "unaffected", x: 77, durationMs: 0, waitForPicture: false },
    mutation,
    { kind: "setSwitch", switchId: done, value: true },
  ], else: [
    { kind: "setSwitch", switchId: tooLate, value: true },
    { kind: "setSwitch", switchId: done, value: true },
  ] }, { kind: "setSwitch", switchId: ready, value: false }];
  // Foreground action is admitted before updateParallelEvents in the same scene
  // update. No wait command, long-duration margin or timing retry is involved.
  // The gated page owns these commands; the legacy fallback must be empty.
  fixture.maps.map_intro.events.push({ id: "u04-canceller", x: 0, y: 0, trigger: { kind: "parallel" }, commands: [], pages: [{
    id: "u04-canceller-page", name: "U04 cancellation", graphic: {}, priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 }, trigger: { kind: "parallel" },
    conditions: [{ kind: "switch", switchId: ready, value: true }, { kind: "switch", switchId: done, value: false }], commands: producer,
  }] });
  const name = `g3-f10-continuation-${operation}`;
  const path = join(directory, `${name}.json`);
  await writeFile(path, JSON.stringify(fixture), { flag: "wx" });
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const writes = [];
  await page.route(url => /supabase|dbserver|\/rest\/v1/i.test(url.href), async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { writes.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  // Retain removed JSON text nodes too: both the initial wait and its authored
  // parallel cancellation can occur before MutationObserver's delivery checkpoint.
  await page.addInitScript(({ ready, done, sentinel, tooLate }) => {
    const snapshots = [];
    const record = text => {
      if (!text) return;
      const state = JSON.parse(text);
      snapshots.push({ picture: state.pictures?.picA ?? null, ready: state.switches[ready], done: state.switches[done], sentinel: state.switches[sentinel], tooLate: state.switches[tooLate] });
    };
    const observer = new MutationObserver(records => {
      for (const entry of records) {
        if (!(entry.target instanceof Element) || !entry.target.matches('[data-testid="runtime-state-json"]')) continue;
        for (const node of entry.removedNodes) record(node.textContent);
        record(entry.target.textContent);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
    window.__u04Continuation = { snapshots, dispose: () => observer.disconnect() };
  }, { ready, done, sentinel, tooLate });
  try {
    const observe = [state(["switches", done], true), state(["switches", sentinel], true), state(["switches", tooLate], false),
      state(["player"], { x: 2, y: 3 }), state(["pictures", "unaffected", "x"], 77), dom(DIALOGUE, true),
      dom('[data-testid="picture-wrong-target"]', false), dom('[data-testid="picture-picA"]', operation !== "erase")];
    if (operation !== "erase") observe.push(state(["pictures", "picA", "x"], 90));
    const readiness = { ...boot, ops: boot.ops.map(operation => ({ ...operation, timeoutMs: 120000,
      observe: [...operation.observe, state(["switches", done], false), state(["switches", sentinel], false)],
    })) };
    const report = await runRuntimeQa(page, { id: name, projectFixture: path, beats: [readiness, {
      id: name, shot: true, note: "Authored parallel picture operation must not terminate the live foreground event",
      ops: [{ kind: "face", dir: "up" }, op({ kind: "action" }, observe)],
      expect: { x: 2, y: 3, testidPresent: ["dialogue-box", "picture-unaffected"], testidAbsent: ["picture-wrong-target"] },
    }] }, { serverUrl: server.url, outDir: join(out, name) });
    const snapshots = await page.evaluate(() => window.__u04Continuation.snapshots);
    const receipt = { report: `${name}/manifest.json`, operation, foreground, producer, snapshots, writes };
    await writeFile(join(out, `${name}.json`), JSON.stringify(receipt, null, 2));
    assert.deepEqual(report.errors, []);
    assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats.map(beat => beat.failures)));
    assert.ok(snapshots.some(state => state.picture?.x === picture.x && state.ready === true && state.done === false && state.sentinel === false), "Original waiting picture must exist before the cancellation");
    assert.deepEqual(writes, []);
    assert.ok(page.url().endsWith("/player.html"));
    assert.equal(await page.evaluate(() => Boolean(window.__eventCommandQa)), false);
    console.log(`${name}: authored parallel operation -> live foreground sentinel PASS`);
    return receipt;
  } finally {
    await page.evaluate(() => window.__u04Continuation?.dispose());
    await context.close();
    await browser.close();
  }
}

export async function proveU04(editorProject, editorCases, out) {
  const original = JSON.parse(await readFile(editorProject, "utf8"));
  const cases = JSON.parse(await readFile(editorCases, "utf8"));
  const temporary = await mkdtemp(join(tmpdir(), "u04-player-"));
  const cache = await mkdtemp(join(tmpdir(), "u04-player-cache-"));
  Object.assign(process.env, { VITE_CACHE_DIR: cache, E2E_FREEZE_DEV_SERVER: "1", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", VITE_SUPABASE_USE_PROXY: "0" });
  const server = await startPlayerQaServer();
  await mkdir(out, { recursive: true });
  const receipts = [];
  try {
    for (const entry of cases) receipts.push(await proveCase(server, original, entry, temporary, out));
    const unedited = JSON.parse(await readFile(join(dirname(editorProject), "editor-source.json"), "utf8"));
    receipts.push(await proveCase(server, unedited, { name: "g5-f2-defaults", index: 2, expected: unedited.maps.map_intro.events[0].pages[0].commands[2] }, temporary, out));
    const noSkip = cases.find(entry => entry.name === "g5-f2-true-false");
    receipts.push(await proveCase(server, original, noSkip, temporary, out, "error"));
    receipts.push(await proveCase(server, original, noSkip, temporary, out, "abort"));
    receipts.push(await proveCinematic(server, original, temporary, out));
    await writeFile(join(out, "SUMMARY.md"), receipts.map(receipt => `- ${receipt.report}: PASS`).join("\n") + "\n");
  } finally {
    await server.close();
    await rm(temporary, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
    await writeFile(join(out, "cleanup.json"), JSON.stringify({ serverPort: server.port, serverClosed: true, browserClosed: true, temporaryRemoved: temporary, cacheRemoved: cache, completedCases: receipts.length }, null, 2));
    console.log("U04 player cleanup: contexts/server closed; temporary fixtures and cache removed");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, cases, out = ".omo/evidence/event-command-remediation/U04/player"] = process.argv.slice(2);
  assert.ok(project && cases, "Usage: node scripts/qa/runtime/event-command-remediation-u04.scenario.mjs editor-project.json editor-cases.json [out]");
  await proveU04(project, cases, out);
}
