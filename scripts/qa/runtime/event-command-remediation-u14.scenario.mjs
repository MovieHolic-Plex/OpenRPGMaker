import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox } from "@playwright/test";
import { runRuntimeQa, startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const present = (selector, equals = true) => ({ source: "dom", selector, read: "present", equals });
const state = (path, equals) => ({ source: "state", path, equals });
const audio = (path, equals) => ({ source: "state", selector: "#u14-audio-observation", path, equals });
const ready = body => [present('[data-testid="dialogue-box"].page-ready'),
  { source: "dom", selector: '[data-testid="dialogue-box"] .body', read: "text", equals: body }];
const key = (key, observe, event) => ({ kind: "eventCommand", trigger: { kind: "key", key }, observe, ...(event ? { event } : {}), timeoutMs: 30_000 });
const playing = (id, volume) => [audio(["latest", id, "playing"], true), audio(["latest", id, "paused"], false), audio(["latest", id, "volume"], volume)];
const boot = { id: "boot", ops: [key("Enter", [state(["player"], { x: 2, y: 3 })]), { kind: "seed", seed: 1 }] };

export function scenario(projectFixture) {
  return { id: "event-command-remediation-u14", projectFixture, viewport: { width: 1280, height: 800 }, beats: [boot,
    { id: "layers", shot: true, ops: [key("z", [...ready("U14_LAYERS"), ...playing("u14-ambient", 0.175), ...playing("u14-se", 0.4), ...playing("u14-defeat", 0.7 * 0.4), audio(["latest", "u14-ambient", "loop"], true), audio(["latest", "u14-se", "loop"], false)])] },
    { id: "other-bgm", ops: [key("z", [...ready("U14_OTHER"), ...playing("u14-other", 0.7)])] },
    { id: "memorized-restored", shot: true, ops: [key("z", [...ready("U14_RESTORED"), audio(["requests", "u14-field"], 2), audio(["latest", "u14-field", "playing"], true)])] },
    { id: "bgm-only-stop", shot: true, ops: [key("z", [...ready("U14_STOPPED"), audio(["latest", "u14-field", "paused"], true), ...playing("u14-ambient", 0.175), ...playing("u14-se", 0.4)])] },
    { id: "system-field", shot: true, ops: [key("z", [state(["mapId"], "u14-destination"), state(["running"], false), audio(["requests", "u14-other"], 2), audio(["latest", "u14-other", "playing"], true)])] },
    { id: "destination-event", ops: [key("z", ready("U14_SYSTEM_FIELD"))] },
    { id: "system-battle", shot: true, ops: [key("z", [present('[data-testid="battle-scene"]'), audio(["latest", "u14-battle", "playing"], true), audio(["requests", "u14-battle"], 1)])] },
  ] };
}
export default scenario(".omo/evidence/event-command-remediation/U14/surface/player-fixture.json");

/** Observe native media events, without replacing playback, decoding, gain or clocks. */
function installAudioObservation(sources) {
  const records = { requests: {}, latest: {}, events: [] };
  const latest = new Map();
  const observed = new Set();
  const nativePlay = HTMLMediaElement.prototype.play;
  const nativeSetItem = Storage.prototype.setItem;
  const publish = () => {
    let node = document.getElementById("u14-audio-observation");
    if (!node) { node = document.createElement("script"); node.id = "u14-audio-observation"; node.type = "application/json"; document.body.append(node); }
    node.textContent = JSON.stringify(records);
  };
  Storage.prototype.setItem = function (key, value) {
    nativeSetItem.call(this, key, value);
    if (key.endsWith(":save-slot:1")) {
      records.savedBgm = JSON.parse(value).session.audio.bgm;
      publish();
    }
  };
  HTMLMediaElement.prototype.play = function (...args) {
    const id = Object.keys(sources).find(id => sources[id] === this.src);
    if (id) {
      this.dataset.u14Resource = id; latest.set(id, this);
      if (!observed.has(this)) {
        observed.add(this);
        for (const type of events) this.addEventListener(type, onMedia);
      }
      records.requests[id] = (records.requests[id] ?? 0) + 1;
      records.latest[id] = { playing: false, paused: this.paused, volume: this.volume, loop: this.loop };
      publish();
    }
    return nativePlay.apply(this, args);
  };
  const onMedia = event => {
    const element = event.target;
    if (!(element instanceof HTMLAudioElement) || !element.dataset.u14Resource) return;
    const id = element.dataset.u14Resource;
    records.events.push({ id, type: event.type, trusted: event.isTrusted, readyState: element.readyState, currentTime: element.currentTime,
      volume: element.volume, paused: element.paused, connected: element.isConnected, sourceCleared: element.getAttribute("src") === "",
      error: element.error && { code: element.error.code, message: element.error.message } });
    if (latest.get(id) === element) {
      const previous = records.latest[id];
      records.latest[id] = { playing: previous.playing || event.type === "playing", paused: element.paused, volume: element.volume, loop: element.loop };
    }
    publish();
  };
  const events = ["playing", "pause", "volumechange", "ended", "error"];
  window.__u14AudioObservation = { read: () => records, dispose: () => {
    for (const element of observed) for (const type of events) element.removeEventListener(type, onMedia);
    HTMLMediaElement.prototype.play = nativePlay;
    Storage.prototype.setItem = nativeSetItem;
    document.getElementById("u14-audio-observation")?.remove(); delete window.__u14AudioObservation;
  } };
}

export async function proveU14Player(sourceFile, out) {
  await mkdir(out, { recursive: true });
  const owned = await mkdtemp(join(out, "tmp-player-"));
  process.env.VITE_CACHE_DIR = join(owned, "cache"); process.env.E2E_FREEZE_DEV_SERVER = "1";
  process.env.VITE_SUPABASE_URL = ""; process.env.VITE_SUPABASE_ANON_KEY = ""; process.env.VITE_SUPABASE_USE_PROXY = "0";
  const saved = JSON.parse(await readFile(sourceFile, "utf8"));
  const commands = saved.maps[saved.startMapId].events[0].pages[0].commands;
  assert.equal(commands.length, 8); assert.deepEqual(commands[6], { kind: "stopAudio", channel: "bgm" });
  assert.deepEqual(commands[0].fields, { channel: "ambient", resourceId: "u14-ambient", volume: 25, fadeMs: 0 });
  const text = body => ({ kind: "text", body });
  const layer = (channel, resourceId, volume) => ({ ...commands[0], fields: { channel, resourceId, volume, fadeMs: 0 } });
  const troopId = saved.database.troops[0]?.id; assert.ok(troopId);
  const battle = { kind: "battleProcessing", troopId, canEscape: true, canLose: true, battleFlow: "strict", onWin: [], onEscape: [], onLose: [] };
  const program = [commands[1], commands[0], layer("se", "u14-se", 50), layer("me", "u14-defeat", 40), text("U14_LAYERS"),
    layer("bgm", "u14-other", 100), text("U14_OTHER"), commands[2], text("U14_RESTORED"), commands[6], text("U14_STOPPED"),
    commands[3], commands[4], commands[5], { kind: "transfer", mapId: "u14-destination", x: 2, y: 3, fade: "none" }];
  const server = await startPlayerQaServer(); let browser;
  const observations = [];
  try {
    browser = await firefox.launch({ headless: true });
    for (const id of ["layers", "result", "gain-command", "gain-map", "battle-gain-25-same", "battle-gain-0-same", "battle-gain-25-different", "battle-gain-0-different"]) {
      const project = structuredClone(saved);
      const map = project.maps[project.startMapId];
      const destinationEvent = structuredClone(map.events[0]);
      destinationEvent.commands = [text("U14_SYSTEM_FIELD"), battle];
      destinationEvent.pages[0].commands = destinationEvent.commands;
      project.maps["u14-destination"] = { ...structuredClone(map), id: "u14-destination", name: "U14 destination", events: [destinationEvent] };
      const gainReview = id.startsWith("gain-");
      const battleGainReview = id.startsWith("battle-gain-");
      const gain = id.includes("-25-") ? 0.25 : 0;
      const sameTrack = id.endsWith("-same");
      const saveLoad = [{ kind: "openSaveMenu" }, text("U14_GAIN_SAVED"), { kind: "m2Command", commandId: "m2-093-open-load-menu", fields: {} }];
      let selected = id === "layers" ? program : [commands[3], commands[4], battle];
      if (gainReview) {
        const reset = id === "gain-map"
          ? [{ kind: "transfer", mapId: "u14-destination", x: 2, y: 3, fade: "none" }]
          : [{ kind: "playAudio", resourceId: "u14-field", loop: true }, text("U14_GAIN_DEFAULT"), ...saveLoad];
        selected = [layer("bgm", "u14-field", 25), text("U14_GAIN_LAYER"), ...reset];
        destinationEvent.commands = [text("U14_GAIN_DEFAULT"), ...saveLoad];
        destinationEvent.pages[0].commands = destinationEvent.commands;
      } else if (battleGainReview) {
        selected = [layer("bgm", "u14-field", gain * 100), text("U14_GAIN_LAYER"),
          { ...commands[3], fields: { slot: "battle", resourceId: sameTrack ? "u14-field" : "u14-battle" } }, commands[4], battle, text("U14_GAIN_RETURNED")];
      }
      map.events[0].commands = selected; map.events[0].pages[0].commands = selected;
      for (const troop of project.database.troops) troop.battleEventPages = [];
      if (id === "result" || battleGainReview) {
        // Exercise a normal defeat transition, not the unrelated already-dead-at-mount path.
        for (const enemy of project.database.enemies) {
          enemy.stats.attack = 999; enemy.actions = []; enemy.attackOptions.normalAttacksMiss = false;
        }
        for (const klass of project.database.classes) klass.battleCommands = klass.battleCommands.filter(command => command.kind === "defend");
      }
      const fixture = join(owned, `${id}.json`); await writeFile(fixture, JSON.stringify(project));
      let spec = id === "layers" ? scenario(fixture) : { id: "event-command-remediation-u14-result", projectFixture: fixture,
        viewport: { width: 1280, height: 800 }, query: { e2eVitals: "1" }, beats: [boot,
          { id: "battle-command", ops: [{ kind: "setVitals", hp: 1, mp: 0 }, key("z", [present('[data-testid="actor-command-defend"]'),
            { source: "dom", selector: '[data-testid="battle-scene"]', read: "attribute", name: "data-battle-director-step", equals: "command" },
            present('[data-testid="battle-scene"][data-battle-sequence-busy="false"]')])] },
          { id: "system-defeat", shot: true, ops: [key("Enter", [present('[data-testid="battle-result-panel"]'), audio(["latest", "u14-defeat", "playing"], true), audio(["requests", "u14-defeat"], 1)])] },
        ] };
      if (gainReview) {
        spec = { id: `event-command-remediation-u14-${id}`, projectFixture: fixture, viewport: { width: 1280, height: 800 }, beats: [boot,
          { id: "layer-gain", ops: [key("z", [...ready("U14_GAIN_LAYER"), ...playing("u14-field", 0.175)])] },
          { id: "default-gain", shot: true, ops: [key("z", [...playing("u14-field", 0.7), audio(["requests", "u14-field"], 1),
            ...(id === "gain-map" ? [state(["mapId"], "u14-destination"), state(["running"], false)] : ready("U14_GAIN_DEFAULT"))])] },
          ...(id === "gain-map" ? [{ id: "destination-save-event", ops: [key("z", ready("U14_GAIN_DEFAULT"))] }] : []),
          { id: "save-menu", ops: [key("z", [present('[data-testid="main-menu"][data-status-menu-screen="function"] [data-testid="save-slot-1"]')])] },
          { id: "save-default-gain", ops: [key("Enter", [audio(["savedBgm"], { resourceId: "u14-field", loop: true })])] },
          { id: "save-back", ops: [key("Escape", [present('[data-testid="main-menu"][data-status-menu-screen="main"]')])] },
          { id: "save-close", ops: [key("Escape", [...ready("U14_GAIN_SAVED"), present('[data-testid="main-menu"]', false)])] },
          { id: "load-menu", ops: [key("z", [present('[data-testid="player-load-slots"]')])] },
          { id: "loaded-default-gain", shot: true, ops: [key("Enter", [...playing("u14-field", 0.7), audio(["requests", "u14-field"], 2), present('[data-testid="player-load-slots"]', false)])] },
        ] };
      } else if (battleGainReview) {
        spec = { id: `event-command-remediation-u14-${id}`, projectFixture: fixture, viewport: { width: 1280, height: 800 }, query: { e2eVitals: "1" }, beats: [boot,
          { id: "field-gain", ops: [key("z", [...ready("U14_GAIN_LAYER"), ...playing("u14-field", gain * 0.7)])] },
          { id: "battle-gain", ops: [{ kind: "setVitals", hp: 1, mp: 0 }, key("z", [present('[data-testid="actor-command-defend"]'),
            { source: "dom", selector: '[data-testid="battle-scene"]', read: "attribute", name: "data-battle-director-step", equals: "command" },
            present('[data-testid="battle-scene"][data-battle-sequence-busy="false"]'),
            ...playing(sameTrack ? "u14-field" : "u14-battle", sameTrack ? gain * 0.7 : 0.7)])] },
          { id: "battle-result", ops: [key("Enter", [present('[data-testid="battle-result-panel"]')])] },
          { id: "restored-field-gain", shot: true, ops: [key("Enter", [...ready("U14_GAIN_RETURNED"), ...playing("u14-field", gain * 0.7), audio(["requests", "u14-field"], 2)])] },
        ] };
      }
      const context = await browser.newContext(); const writes = [];
      await context.route(url => /(?:supabase|dbserver|\/rest\/v1)/i.test(url.href), async route => {
        if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) { writes.push(route.request().method()); await route.abort("blockedbyclient"); }
        else await route.continue();
      });
      const page = await context.newPage(); page.setDefaultNavigationTimeout(120_000);
      await page.addInitScript(installAudioObservation, Object.fromEntries(Object.entries(project.assets.uploaded).filter(([key]) => key.startsWith("u14-")).map(([key, asset]) => [key, asset.dataUrl])));
      try {
        const report = await runRuntimeQa(page, spec, { serverUrl: server.url, outDir: join(out, `player-${id}`) });
        const receipt = await page.evaluate(() => ({ url: location.href, editor: Boolean(document.querySelector(".editor-layout")), audio: window.__u14AudioObservation.read() }));
        observations.push({ id, receipt, remoteWrites: writes });
        await writeFile(join(out, "player-observations.json"), JSON.stringify(observations, null, 2));
        assert.deepEqual(report.errors, []); assert.ok(report.beats.every(beat => beat.failures.length === 0), JSON.stringify(report.beats.map(beat => ({ id: beat.id, failures: beat.failures }))));
        assert.equal(receipt.editor, false); assert.ok(receipt.url.includes("/player.html")); assert.deepEqual(writes, []);
        assert.ok(receipt.audio.events.some(event => event.type === "playing" && event.trusted && event.readyState >= 2));
        // hardStop deliberately clears src and removes the element. Firefox reports code 4
        // for that disposed empty source; retained receipts distinguish it from playback errors.
        for (const event of receipt.audio.events.filter(event => event.type === "error")) {
          assert.equal(event.connected, false); assert.equal(event.sourceCleared, true);
          assert.equal(event.paused, true); assert.equal(event.error?.code, 4);
        }
        console.log(`PLAYER PASS: ${id}, ${report.beats.length} beats, native media playing/volume/pause evidence`);
      } finally { await page.evaluate(() => window.__u14AudioObservation?.dispose()); await context.close(); }
    }
  } finally {
    await browser?.close(); await server.close(); await rm(owned, { recursive: true, force: true });
    await writeFile(join(out, "player-cleanup.json"), JSON.stringify({ serverClosed: true, browserClosed: true, temporaryFixturesRemoved: true }));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await proveU14Player(resolve(process.argv[2] ?? ".omo/evidence/event-command-remediation/U14/surface/editor-exported.json"), resolve(process.argv[3] ?? ".omo/evidence/event-command-remediation/U14/surface"));
}
