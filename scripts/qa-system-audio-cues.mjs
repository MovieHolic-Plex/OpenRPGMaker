import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "output/evidence/event-command-completion/audio");
await mkdir(out, { recursive: true });
const report = { head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), actions: [], observations: [], errors: [], warnings: [], cleanup: {} };
let server, browser, page;
let sequence = 0;
async function observe(expression, key, timeout = 60000) {
  const id = ++sequence;
  await page.evaluate(({ expression, id, timeout }) => {
    window.__cueSignals ??= {};
    window.__cueSignals[id] = new Promise(resolve => {
      let timer;
      const events = ["playing", "pause", "ended", "volumechange", "timeupdate", "animationend", "transitionend"];
      const observer = new MutationObserver(check);
      function check() {
        if (Function(`return (${expression})`)()) finish(true);
      }
      function finish(pass) {
        observer.disconnect(); clearTimeout(timer);
        for (const name of events) document.removeEventListener(name, check, true);
        resolve({ pass, text: document.body.innerText.slice(0, 1200) });
      }
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      for (const name of events) document.addEventListener(name, check, true);
      timer = setTimeout(() => finish(false), timeout);
      check();
    });
  }, { expression, id, timeout });
  if (key) { report.actions.push(key); await page.keyboard.press(key); }
  const result = await page.evaluate(id => window.__cueSignals[id], id);
  assert(result.pass, `${expression}\n${result.text}`);
}
const marker = (text, key = "Enter") => observe(`document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent === ${JSON.stringify(text)}`, key);
async function tracks(label) {
  const value = await page.evaluate(() => [...document.querySelectorAll("audio[data-oprn-audio]")].map(a => ({
    id: Object.keys(window.__cueSources).find(id => window.__cueSources[id] === a.src),
    loop: a.loop, volume: a.volume, paused: a.paused, time: a.currentTime,
  })));
  report.observations.push({ label, tracks: value });
  return value;
}
async function battle(label) {
  await page.evaluate(() => window.__oprnDebug.setSeed(12345));
  await observe(`!!document.querySelector('[data-testid="actor-command-attack"]:not(:disabled)') && document.querySelector('[data-testid="battle-scene"]')?.dataset.battleSequenceBusy === 'false'`, "Enter");
  await observe(`document.querySelector('[data-testid="battle-scene"]')?.dataset.battlePhase === 'targetSelect'`, "Enter");
  await observe(`(() => { const panel = document.querySelector('[data-testid="battle-result-panel"]'); return panel && !panel.hidden && Number(getComputedStyle(panel).opacity) >= 0.9 && document.querySelector('[data-testid="battle-scene"]')?.dataset.battleSequenceBusy === 'false'; })()`, "Enter");
  await page.screenshot({ path: join(out, `${label}-result.png`) });
}
async function menu() {
  await observe(`!!document.querySelector('[data-testid="status-menu-debug-json"]')`, "Escape");
  await page.screenshot({ path: join(out, "restored-menu.png") });
  await observe(`!document.querySelector('[data-testid="status-menu-debug-json"]')`, "Escape");
}
try {
  server = await startPlayerQaServer({ port: 20006 });
  report.url = server.url;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--alsa-output-device=null", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"] });
  page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (["warning", "error"].includes(message.type())) report.warnings.push(message.text()); });
  await page.route("**/__cue-bootstrap", route => route.fulfill({ contentType: "text/html", body: '<html><body><div id="app"></div></body></html>' }));
  // Route loopback assets through Playwright's request transport on shared Linux hosts.
  await page.route(url => url.origin === server.url && !url.pathname.startsWith("/__cue"), async route => {
    try { await route.fulfill({ response: await route.fetch({ maxRetries: 1 }) }); }
    catch (error) { if (!page.isClosed()) { report.errors.push(String(error)); await route.abort(); } }
  });
  await page.routeWebSocket(url => url.host === new URL(server.url).host, () => {});
  await page.goto(`${server.url}/__cue-bootstrap`);
  const project = await page.evaluate(async () => {
    const { audioCommandRepairsProject } = await import("/test/fixtures/eventCommandAudioRepairs.ts");
    const project = audioCommandRepairsProject();
    const hero = project.database.actors.find(a => a.id === "actor_hero");
    const enemy = project.database.enemies.find(e => e.id === "enemy_slime");
    const troop = project.database.troops.find(t => t.id === "troop_slime");
    const klass = project.database.classes.find(c => c.id === hero.classId);
    klass.battleCommands = [{ id: "cmd_attack", name: "Attack", kind: "attack" }];
    enemy.stats = { ...enemy.stats, maxHp: 1, attack: 1, defense: 0, agility: 1 };
    troop.enemyIds = [enemy.id]; troop.members = [{ enemyId: enemy.id, x: 160, y: 100, hidden: false }]; troop.battleEventPages = [];
    project.system.battleFlow = "strict"; troop.battleFlow = "strict";
    project.system.battleUiStyle = "vxace";
    project.system.battleBgmResourceId = "qa_bgm";
    project.system.battleVictoryMeResourceId = "qa_bgm";
    const m2 = (family, cue, resourceId, volume, operation = "set") => ({ kind: "m2Command", commandId: family === "bgm" ? "m2-027-change-system-bgm" : "m2-028-change-system-se", fields: { cue, resourceId, volume, operation } });
    const text = body => ({ kind: "text", body });
    const fight = { kind: "battleProcessing", troopId: troop.id, canEscape: false, canLose: false, battleFlow: "strict" };
    const map = project.maps[project.startMapId];
    map.events[0].pages[0].commands = [
      text("CUE START"),
      { kind: "m2Command", commandId: "m2-210-sound-layer", fields: { channel: "bgm", resourceId: "qa_bgs", volume: 61, fadeMs: 0 } },
      { kind: "m2Command", commandId: "m2-210-sound-layer", fields: { channel: "bgs", resourceId: "qa_ambient", volume: 41, fadeMs: 0 } },
      m2("bgm", "battle", "qa_bgm", 37), m2("bgm", "victory", "qa_bgm", 37), m2("se", "confirm", "qa_se", 23),
      text("FIELD READY"), fight, text("FIELD RETURNED"),
      { kind: "setSwitch", switchId: "audio_repair_done", value: true }, { kind: "openSaveMenu" }, text("CUE SAVED"),
      { kind: "stopAudio" }, { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} },
    ];
    project.switches.push({ id: "cue_silent_done", name: "Silent pass" });
    const base = { name: "Cue contract", graphic: {}, priority: "below", trigger: { kind: "action" }, movement: { type: "fixed", speed: 3, frequency: 3 } };
    map.events.push({ id: "cue_actions", x: 3, y: 6, trigger: { kind: "action" }, commands: [], pages: [
      { ...base, id: "silence", conditions: [], commands: [
        m2("bgm", "battle", "", 100), m2("bgm", "victory", "", 100), m2("se", "confirm", "", 100), text("SILENT READY"), fight,
        text("SILENT RETURNED"), { kind: "setSwitch", switchId: "cue_silent_done", value: true },
      ] },
      { ...base, id: "reset", conditions: [{ kind: "switch", switchId: "cue_silent_done", value: true }], commands: [
        m2("bgm", "battle", "", 100, "reset"), m2("bgm", "victory", "", 100, "reset"), m2("se", "confirm", "", 100, "reset"),
        text("RESET READY"), fight, text("RESET RETURNED"),
      ] },
    ] });
    const { serialize, deserialize } = await import("/src/project/io.ts");
    return deserialize(serialize(project));
  });
  await page.route("**/__cue-project.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.addInitScript(sources => {
    window.__cueSources = sources; window.__cueMedia = []; window.__cueCalls = [];
    const idFor = audio => Object.keys(sources).find(key => sources[key] === audio.src);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__cueCalls.push({ id: idFor(this), src: this.src, loop: this.loop, volume: this.volume });
      return play.call(this);
    };
    for (const name of ["playing", "error", "ended"]) document.addEventListener(name, event => {
      if (!(event.target instanceof HTMLAudioElement)) return;
      const a = event.target; const id = idFor(a);
      if (id) window.__cueMedia.push({ id, name, loop: a.loop, volume: a.volume, time: a.currentTime,
        ...(a.error ? { error: { code: a.error.code, message: a.error.message } } : {}) });
    }, true);
    window.__OPENRPG_BOOT__ = { projectUrl: "/__cue-project.json", saveNamespace: "qa:system-audio-cues", qaInstrumentation: true };
  }, Object.fromEntries(Object.entries(project.assets.uploaded).filter(([id]) => id.startsWith("qa_")).map(([id, a]) => [id, a.dataUrl])));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await observe(`!!document.querySelector('[data-testid="title-screen"]')`, undefined, 120000);
  await marker("CUE START"); await marker("FIELD READY");
  await observe(`[...document.querySelectorAll('audio[data-oprn-audio]')].some(a => a.src === window.__cueSources.qa_bgs && !a.paused && a.currentTime > 0 && Math.abs(a.volume - .427) < .000001)`);
  await tracks("field before battle");
  await battle("override");
  const media = await page.evaluate(() => window.__cueMedia);
  assert(media.some(e => e.id === "qa_bgm" && e.loop && e.name === "playing" && Math.abs(e.volume - .259) < .000001));
  assert(media.some(e => e.id === "qa_bgm" && !e.loop && e.name === "playing" && Math.abs(e.volume - .259) < .000001));
  assert(media.some(e => e.id === "qa_se" && !e.loop && e.name === "playing" && Math.abs(e.volume - .184) < .000001));
  await marker("FIELD RETURNED");
  const returned = await tracks("returned field");
  assert(returned.some(a => a.id === "qa_bgs" && a.loop && Math.abs(a.volume - .427) < .000001));
  assert(returned.some(a => a.id === "qa_ambient" && a.loop && Math.abs(a.volume - .287) < .000001));
  await observe(`!!document.querySelector('[data-testid="save-slot-1"]')`, "Enter");
  await observe(`localStorage.getItem('qa:system-audio-cues:save-slot:1') !== null`, "Enter");
  report.saved = await page.evaluate(() => JSON.parse(localStorage.getItem("qa:system-audio-cues:save-slot:1")));
  assert.deepEqual(report.saved.session.systemAudioOverrides, { bgm: { battle: { resourceId: "qa_bgm", volume: 37 }, victory: { resourceId: "qa_bgm", volume: 37 } }, se: { confirm: { resourceId: "qa_se", volume: 23 } } });
  assert.deepEqual(report.saved.session.audio.bgm, { resourceId: "qa_bgs", loop: true, volume: 61, fadeInMs: 0 });
  await observe(`JSON.parse(document.querySelector('[data-testid="status-menu-debug-json"]').textContent).mode === 'main'`, "Escape");
  await marker("CUE SAVED", "Escape");
  await observe(`!!document.querySelector('[data-testid="player-load-window"]')`, "Enter");
  await observe(`document.querySelector('[data-testid="save-slot-1"]')?.getAttribute('aria-current') === 'true'`, "ArrowDown");
  await observe(`!document.querySelector('[data-testid="player-load-window"]') && !document.querySelector('[data-testid="dialogue-box"]')`, "Enter");
  await observe(`[...document.querySelectorAll('audio[data-oprn-audio]')].some(a => a.src === window.__cueSources.qa_bgs && !a.paused && a.currentTime > 0 && Math.abs(a.volume - .427) < .000001)`);
  const count = await page.evaluate(() => window.__cueCalls.filter(e => e.id === "qa_se").length);
  await menu();
  assert((await page.evaluate(() => window.__cueCalls.filter(e => e.id === "qa_se").length)) > count);
  await marker("SILENT READY");
  const silentStart = await page.evaluate(() => window.__cueCalls.length);
  await battle("silence");
  const silentCalls = await page.evaluate(start => window.__cueCalls.slice(start), silentStart);
  assert(!silentCalls.some(e => e.id === "qa_bgm" || e.id === "qa_se"));
  await marker("SILENT RETURNED");
  await observe(`!document.querySelector('[data-testid="dialogue-box"]')`, "Enter");
  const silentMenuStart = await page.evaluate(() => window.__cueCalls.length);
  await menu();
  assert(!(await page.evaluate(start => window.__cueCalls.slice(start), silentMenuStart)).some(e => e.id === "qa_se"));
  await marker("RESET READY");
  const resetStart = await page.evaluate(() => window.__cueMedia.length);
  await battle("reset");
  const reset = await page.evaluate(start => window.__cueMedia.slice(start), resetStart);
  assert(reset.some(e => e.id === "qa_bgm" && e.loop && e.name === "playing" && Math.abs(e.volume - .7) < .000001));
  assert(reset.some(e => e.id === "qa_bgm" && !e.loop && e.name === "playing" && Math.abs(e.volume - .7) < .000001));
  await marker("RESET RETURNED");
  await tracks("reset field return");
  report.mediaEvents = await page.evaluate(() => window.__cueMedia);
  report.calls = await page.evaluate(() => window.__cueCalls.map(({ src, ...rest }) => ({ ...rest, sourceKind: src.startsWith("data:audio/wav") ? "PCM WAV" : src })));
  assert(!report.mediaEvents.some(e => e.name === "error"));
  assert.deepEqual(report.errors, []);
  report.pass = true;
} catch (error) {
  report.pass = false; report.failure = error instanceof Error ? error.stack : String(error);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(out, "failure.png") });
    report.mediaEvents = await page.evaluate(() => window.__cueMedia);
  }
  process.exitCode = 1;
} finally {
  if (browser) { await browser.close(); report.cleanup.browserClosed = true; }
  if (server) { await server.close(); report.cleanup.serverClosed = true; }
  await writeFile(join(out, "player-qa.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, failure: report.failure, cleanup: report.cleanup, out }));
}
