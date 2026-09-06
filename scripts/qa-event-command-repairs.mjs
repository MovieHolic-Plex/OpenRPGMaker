import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const scenario = args[args.indexOf("--scenario") + 1];
if (scenario === "battle-flow") {
  await import("./qa-event-command-battle-flow.mjs");
} else if (scenario === "editor-support") {
  await import("./qa-event-command-editor-support.mjs");
} else {
const phaseIndex = args.indexOf("--phase");
const phase = phaseIndex >= 0 ? args[phaseIndex + 1] : "surface";
assert(["map-effects", "audio-layers", "battle-state"].includes(scenario), "Choose an implemented repair scenario");
assert(["red", "green", "surface"].includes(phase), "Unknown evidence phase");
const out = join(root, `output/evidence/event-command-repairs/${scenario === "audio-layers" ? "audio" : scenario === "battle-state" ? "battle-state" : "map"}`, phase);
await mkdir(out, { recursive: true });
const report = {
  scenario, phase, head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  actions: [], observations: [], errors: [], warnings: [], screenshots: [],
  cleanup: { browserClosed: false, serverClosed: false },
};
let server, browser, page;
let sequence = 0;

// Subscribe to exact DOM/state changes before keys; the only timer is a bounded failure deadline.
async function observe(expression, action, timeout = 20_000) {
  const id = ++sequence;
  await page.evaluate(({ id, expression, timeout }) => {
    window.__repairSignals ??= {};
    window.__repairSignals[id] = new Promise(resolve => {
      let settled = false;
      let timer;
      const observer = new MutationObserver(check);
      const mediaEvents = ["playing", "ended", "volumechange", "timeupdate", "pause", "animationend", "transitionend"];
      for (const event of mediaEvents) document.addEventListener(event, check, true);
      function finish(pass) {
        if (settled) return;
        settled = true;
        observer.disconnect();
        for (const event of mediaEvents) document.removeEventListener(event, check, true);
        clearTimeout(timer);
        resolve({ pass, text: document.body?.innerText.slice(0, 800) });
      }
      function check() {
        if (Function(`return (${expression})`)()) finish(true);
      }
      observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
      timer = setTimeout(() => finish(false), timeout);
      check();
    });
  }, { id, expression, timeout });
  if (action) {
    report.actions.push(action);
    await page.keyboard.press(action);
  }
  const result = await page.evaluate(id => window.__repairSignals[id], id);
  assert(result.pass, `State not reached: ${expression}\n${result.text}`);
}

async function marker(text, key = "Enter") {
  await observe(
    `document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent === ${JSON.stringify(text)}`,
    key,
  );
}

async function snapshot(label) {
  const value = await page.evaluate(() => ({
    state: JSON.parse(document.querySelector('[data-testid="runtime-state-json"]').textContent),
    sprites: window.__oprnCharacterSprites(),
  }));
  report.observations.push({ label, ...value });
  return value;
}

async function shot(name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path });
  report.screenshots.push(path);
}

async function audioSnapshot(label) {
  const tracks = await page.evaluate(() => [...document.querySelectorAll('audio[data-oprn-audio]')].map(audio => ({
    id: Object.keys(window.__repairAudioSources).find(id => window.__repairAudioSources[id] === audio.src),
    volume: audio.volume, loop: audio.loop, paused: audio.paused, currentTime: audio.currentTime,
  })));
  report.observations.push({ label, tracks });
  return tracks;
}

async function runAudioScenario() {
  await marker("AUDIO START");
  assert.deepEqual(await page.evaluate(() => window.__oprnAudioState().volume), { bgm: 0.7, se: 0.8 });
  for (const [text, id, volume, loop] of [
    ["BGM READY", "qa_bgm", 0.7, true],
    ["BGS READY", "qa_bgs", 0.441, true],
    ["SE READY", "qa_se", 0.504, false],
    ["AMBIENT MUTED", "qa_ambient", 0, true],
    ["AMBIENT READY", "qa_ambient", 0.175, true],
  ]) {
    await marker(text);
    await observe(
      `[...document.querySelectorAll('audio[data-oprn-audio]')].some(a => a.src === window.__repairAudioSources[${JSON.stringify(id)}] && !a.paused && a.currentTime > 0 && a.loop === ${loop} && Math.abs(a.volume - ${volume}) < 0.000001)`,
    );
    const tracks = await audioSnapshot(text);
    if (id !== "qa_bgm") assert(tracks.some(a => a.id === "qa_bgm" && a.loop && !a.paused && Math.abs(a.volume - 0.7) < 0.000001));
    if (id === "qa_se" || id === "qa_ambient") assert(tracks.some(a => a.id === "qa_bgs" && a.loop && !a.paused));
    await shot(text.toLowerCase().replaceAll(" ", "-"));
  }
  await observe(`!!document.querySelector('[data-testid="save-slot-1"]')`, "Enter");
  await observe('localStorage.getItem("qa:event-command-repairs:save-slot:1") !== null', "Enter");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("qa:event-command-repairs:save-slot:1")));
  assert.equal(saved.session.audio.bgs.volume, 63);
  assert.equal(saved.session.audio.ambient.volume, 25);
  await observe(`JSON.parse(document.querySelector('[data-testid="status-menu-debug-json"]').textContent).mode === "main"`, "Escape");
  await marker("AUDIO SAVED", "Escape");
  await observe(`!!document.querySelector('[data-testid="player-load-window"]')`, "Enter");
  await observe('[...document.querySelectorAll("audio[data-oprn-audio]")].every(a => !Object.values(window.__repairAudioSources).includes(a.src) || !a.loop)');
  await observe(`!document.querySelector('[data-testid="player-load-window"]') && !document.querySelector('[data-testid="dialogue-box"]')`, "Enter");
  for (const id of ["qa_bgm", "qa_bgs", "qa_ambient"]) {
    await observe(`[...document.querySelectorAll('audio[data-oprn-audio]')].some(a => a.src === window.__repairAudioSources[${JSON.stringify(id)}] && a.loop && !a.paused && a.currentTime > 0)`);
  }
  const restored = await audioSnapshot("restored loops");
  assert(Math.abs(restored.find(a => a.id === "qa_ambient").volume - 0.175) < 0.000001);
  assert(Math.abs(restored.find(a => a.id === "qa_bgs").volume - 0.441) < 0.000001);
  report.mediaEvents = await page.evaluate(() => window.__repairMediaEvents);
  assert(report.mediaEvents.some(e => e.id === "qa_se" && e.name === "playing" && !e.loop));
  assert(!report.mediaEvents.some(e => e.name === "error"));
  await observe('window.__oprnDebug?.readState().x === 4', "ArrowRight");
  await shot("restored-input");
}

async function readPartyHud(label) {
  const hud = await page.evaluate(() => {
    const row = document.querySelector('.battle-actor-status[data-record-id="actor_hero"]');
    return {
      level: Number(row?.querySelector('.battle-actor-level .battle-vital-value')?.textContent),
      hp: Number(row?.querySelector('.battle-actor-hp .battle-vital-value')?.textContent),
      maxHp: Number(row?.querySelector('.battle-actor-hp .battle-vital-max')?.textContent?.replace('/', '')),
      text: row?.textContent,
    };
  });
  report.observations.push({ label, hud });
  return hud;
}

async function runStateScenario() {
  await marker("STATE START");
  await observe('!!document.querySelector(\'[data-testid="actor-command-defend"][data-battle-command-cursor="true"]:not(:disabled)\')', "Enter", 60_000);
  const before = await readPartyHud("level before event");
  assert.equal(before.level, 7);
  assert.equal(before.maxHp, 700);
  assert(before.hp > 0 && before.hp <= 300);
  await shot("01-level-before");
  await observe('document.querySelector(\'.battle-actor-status[data-record-id="actor_hero"] .battle-actor-level .battle-vital-value\')?.textContent.trim() === "11" && !!document.querySelector(\'[data-testid="actor-command-defend"]:not(:disabled)\')', "Enter", 30_000);
  const after = await readPartyHud("level after event");
  assert.equal(after.level, 11);
  assert.equal(after.maxHp, 1100);
  assert(after.hp > 0 && after.hp <= 300);
  await shot("02-level-after");
  await observe('!!document.querySelector(\'[data-testid="actor-command-attack"][data-battle-command-cursor="true"]:not(:disabled)\')', "ArrowDown");
  await observe('["targetSelect", "resolved"].includes(document.querySelector(\'[data-testid="battle-scene"]\')?.dataset.battlePhase)', "Enter");
  const resultReady = '(() => { const panel = document.querySelector(\'[data-testid="battle-result-panel"]\'); const battle = document.querySelector(\'[data-testid="battle-scene"]\'); return panel && !panel.hidden && Number(getComputedStyle(panel).opacity) >= 0.9 && battle?.dataset.battleSequenceBusy === "false"; })()';
  const targetSelection = await page.evaluate(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase === "targetSelect");
  await observe(resultReady, targetSelection ? "Enter" : undefined, 30_000);
  await shot("03-state-result");
  await marker("STATE RETURNED");
  const returned = await snapshot("returned session");
  const friendship = await page.evaluate(() => window.__oprnDebug.readState().friendship);
  assert.equal(friendship.qa_npc, 56);
  assert.equal(returned.state.actorLevels.actor_hero, 11);
  assert.equal(returned.state.actorVitals.actor_hero.maxHp, 1100);
  assert(returned.state.actorVitals.actor_hero.hp > 0 && returned.state.actorVitals.actor_hero.hp <= 300);
  report.observations.push({ label: "returned friendship", friendship });
  await shot("04-state-returned");
  await observe('!document.querySelector(\'[data-testid="dialogue-box"]\') && window.__oprnDebug.readState().switches.state_repair_done === true', "Enter");
  await observe('window.__oprnDebug.readState().x === 4', "ArrowRight");
}

try {
  server = await startPlayerQaServer();
  report.url = server.url;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu",
      "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"],
  });
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "warning" || message.type() === "error") {
      report.warnings.push({ type: message.type(), text: message.text() });
    }
  });
  await page.route("**/__repair-bootstrap", route => route.fulfill({
    contentType: "text/html", body: '<!doctype html><html><body><div id="app"></div></body></html>',
  }));
  await page.route(url => url.origin === server.url && !url.pathname.startsWith("/__repair"), async route => {
    try {
      const method = route.request().method();
      await route.fulfill({ response: await route.fetch({ maxRetries: method === "GET" || method === "HEAD" ? 1 : 0 }) });
    } catch (error) {
      if (page.isClosed()) return;
      report.errors.push(`Local asset transport: ${error instanceof Error ? error.message : String(error)}`);
      try {
        await route.abort();
      } catch (abortError) {
        if (!page.isClosed()) report.errors.push(`Abort request: ${abortError instanceof Error ? abortError.message : String(abortError)}`);
      }
    }
  });
  await page.routeWebSocket(url => url.host === new URL(server.url).host, () => {});
  await page.goto(`${server.url}/__repair-bootstrap`);
  const project = await page.evaluate(async scenario => {
    if (scenario === "audio-layers") {
      const { audioCommandRepairsProject } = await import("/test/fixtures/eventCommandAudioRepairs.ts");
      return audioCommandRepairsProject();
    }
    if (scenario === "battle-state") {
      const { battleEventStateRepairsProject } = await import("/test/fixtures/battleEventStateRepairs.ts");
      return battleEventStateRepairsProject();
    }
    const { mapCommandRepairsProject } = await import("/test/fixtures/eventCommandRepairs.ts");
    return mapCommandRepairsProject();
  }, scenario);
  await page.route("**/__repair-project.json", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(project),
  }));
  await page.addInitScript(sources => {
    window.__repairAudioSources = sources;
    window.__repairMediaEvents = [];
    for (const name of ["playing", "ended", "error"]) document.addEventListener(name, event => {
      if (!(event.target instanceof HTMLAudioElement)) return;
      const audio = event.target;
      const id = Object.keys(sources).find(key => sources[key] === audio.src);
      if (id) window.__repairMediaEvents.push({ id, name, time: audio.currentTime, volume: audio.volume, loop: audio.loop });
    }, true);
    window.__OPENRPG_BOOT__ = {
      projectUrl: "/__repair-project.json", saveNamespace: "qa:event-command-repairs", qaInstrumentation: true,
    };
  }, Object.fromEntries(Object.entries(project.assets.uploaded).filter(([id]) => id.startsWith("qa_")).map(([id, asset]) => [id, asset.dataUrl])));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await observe('!!document.querySelector(\'[data-testid="title-screen"]\')', undefined, 120_000);
  if (scenario === "audio-layers") {
    await runAudioScenario();
  } else if (scenario === "battle-state") {
    await runStateScenario();
  } else {
  await marker("REPAIR START");
  await marker("LOCATION COMPLETE");
  const location = await snapshot("location");
  await shot("01-location");
  assert.equal(location.state.events.repair_a.x, 8);
  assert.equal(location.state.events.repair_a.y, 7);
  assert.equal(location.sprites.events.repair_a.x, 136);
  assert.equal(location.sprites.events.repair_a.y, 128);
  await marker("SWAP COMPLETE");
  const swap = await snapshot("swap");
  await shot("02-swap");
  assert.equal(swap.state.events.repair_a.x, 10);
  assert.equal(swap.state.events.repair_b.x, 8);
  assert.equal(swap.state.events.repair_a.direction, "right");
  assert.equal(swap.state.events.repair_b.direction, "left");
  assert.equal(swap.sprites.events.repair_a.x, 168);
  assert.equal(swap.sprites.events.repair_b.x, 136);
  await marker("FIELDS COMPLETE");
  const fields = await snapshot("canonical-fields");
  await shot("03-fields-weather");
  assert.equal(fields.state.m2Runtime.system.system_bgm, "cc0-music-field-loop");
  assert.equal(fields.state.m2Runtime.system.system_se, "cc0-sound-ui-confirm");
  assert.equal(fields.state.m2Runtime.screen.weather, "snow,0.7");
  await observe(
    'window.__oprnDebug?.readState().switches.repair_done === true && !document.querySelector(\'[data-testid="dialogue-box"]\')',
    "Enter",
  );
  await observe('window.__oprnDebug?.readState().x === 4', "ArrowRight");
  await shot("04-input-restored");
  }
  assert.deepEqual(report.errors, []);
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.failure = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) await shot("failure");
} finally {
  if (browser) {
    await browser.close();
    report.cleanup.browserClosed = true;
  }
  if (server) {
    await server.close();
    report.cleanup.serverClosed = true;
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"),
    `# ${scenario}: ${report.pass ? "PASS" : "FAIL"}\n\nHead: ${report.head}\n` +
    `Keyboard actions: ${report.actions.join(", ")}\n\n` +
    `Immediately inspect: ${report.screenshots.join(", ")}\n\n` +
    `Cleanup: ${JSON.stringify(report.cleanup)}\n\n${report.failure ?? ""}\n`);
  console.log(JSON.stringify({ pass: report.pass, out, cleanup: report.cleanup, failure: report.failure }));
}

}
