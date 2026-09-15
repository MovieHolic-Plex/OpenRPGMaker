// Real Chromium + shipping player acceptance. Intentionally RED before NPC behavior lands.
// node scripts/qa/npc-behavior.mjs --scenario pursuit|trainer|editor [--headed] [--relay]
// NPC_QA_ROOT selects the checkout under test; default is the checkout owning this script.
// --relay forwards owned Vite bytes via Node only for documented ERR_NETWORK_CHANGED hosts.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { makeFixture, SOURCE_MAP, ARRIVAL_MAP, PURSUER, TRAINER } from './npc-behavior-fixture.mjs';

const args = process.argv.slice(2);
let scenario;
let headed = false;
let relay = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scenario') scenario = args[++i];
  else if (args[i] === '--headed') headed = true;
  else if (args[i] === '--relay') relay = true;
  else throw new Error(`Unknown argument: ${args[i]}`);
}
assert.ok(['pursuit', 'trainer', 'editor'].includes(scenario), 'Use --scenario pursuit|trainer|editor');
const runnerRoot = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const root = realpathSync(resolve(process.env.NPC_QA_ROOT ?? runnerRoot));
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(realpathSync(git('rev-parse', '--show-toplevel')), root, 'NPC_QA_ROOT must be a checkout root');
const sourceCommit = git('rev-parse', 'HEAD');
const sourceDirty = git('status', '--porcelain').length > 0;
// The shared player helper lets Vite use cwd as its root. Match cwd even when invoked from /tmp.
process.chdir(root);
const serverHelper = resolve(root, 'scripts/lib/runtimeQaRun.mjs');
const out = resolve(root, 'output/evidence/npc-behavior', scenario);
const report = { scenario, root, sourceCommit, sourceDirty, runnerRoot, serverHelper,
  transport: relay ? 'Node forwards owned Vite responses' : 'direct Chromium',
  status: 'running', visualReview: 'preliminary; lead review required', cases: [], actions: [], cleanup: [], errors: [] };
let server;
let browser;
let current;
let interrupted = false;
let serial = 0;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  interrupted = true;
  report.errors.push(`Interrupted by ${signal}`);
  // Closing the owned browser rejects outstanding navigation/evaluate calls, entering paired finally blocks.
  if (browser) void browser.close().catch(error => report.errors.push(`interrupt cleanup: ${errorText(error)}`));
});
await mkdir(out, { recursive: true });
function log(action, data = {}) {
  const entry = { sequence: ++serial, case: current?.name, action, ...data };
  report.actions.push(entry);
  console.log(JSON.stringify(entry));
}
function errorText(error) { return error instanceof Error ? error.stack : String(error); }

// Installed before any application module. Captures the real Game, never substitutes a scene.
function installBrowserProbe({ name, projectUrl }) {
  const qa = window.__npcQa = { name, waits: {}, history: [], failures: [], frame: 0, phase: 'boot', game: null };
  if (projectUrl) window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: `npc-qa:${name}`, qaInstrumentation: true };
  qa.snapshot = () => {
    const scene = qa.game?.scene?.getScenes(false).find(s => s.sys.settings.key === 'PlayScene');
    const text = document.querySelector('[data-testid="runtime-state-json"]')?.textContent;
    const mirror = text ? JSON.parse(text) : null;
    const debug = window.__oprnDebug?.readState();
    const sprites = window.__oprnCharacterSprites?.();
    const battle = document.querySelector('[data-testid="battle-scene"]');
    const result = document.querySelector('[data-testid="battle-result-panel"]');
    return { frame: qa.frame, phase: qa.phase, map: mirror?.mapId, player: mirror?.player,
      moving: scene?.moving, routeActive: !!scene?.playerRoute,
      bootText: mirror ? undefined : document.body?.innerText.slice(0, 3000),
      inputEnabled: mirror?.inputEnabled, running: mirror?.running,
      events: mirror?.events, movers: mirror?.movers, sprites,
      horror: debug?.horror, eventLocations: debug?.eventLocations,
      completion: scene?.session?.detectionEncounterCompletions ? structuredClone(scene.session.detectionEncounterCompletions) : null,
      victory: debug?.switches.sw_0001, caught: debug?.switches.sw_0003,
      commands: debug?.variables.var_0001, secondCommands: debug?.variables.var_0002,
      battleResult: debug?.battleResult, battle: battle ? { phase: battle.dataset.battlePhase,
        director: battle.dataset.battleDirectorStep, busy: battle.dataset.battleSequenceBusy,
        hasField: !!battle.querySelector('[data-testid="battle-field"]'),
        attack: !!battle.querySelector('[data-testid="actor-command-attack"]'),
        target: battle.querySelector('[data-battle-target-id][data-battle-command-cursor="true"]')?.dataset.battleTargetId,
        result: result?.dataset.battleResult } : null };
  };
  qa.observe = source => {
    const state = qa.snapshot();
    if (source === 'postrender' && state.player) {
      const compact = JSON.stringify({ ...state, frame: undefined });
      if (compact !== qa.lastState) {
        qa.history.push({ ...state, at: performance.now() });
        qa.lastState = compact;
      }
      if (qa.guard) {
        try { qa.guard(state); } catch (e) { qa.failures.push(String(e)); qa.guard = null; }
      }
    }
    for (const wait of Object.values(qa.waits)) wait.inspect(state, source);
  };
  qa.arm = (id, source, argument, timeoutMs, future) => {
    if (qa.waits[id]) throw new Error(`Duplicate signal ${id}`);
    const predicate = (0, eval)(`(${source})`);
    let resolveSignal, rejectSignal;
    const promise = new Promise((yes, no) => { resolveSignal = yes; rejectSignal = no; });
    // Keep early rejection handled; the original rejecting Promise is always awaited by Node.
    promise.catch(() => {});
    const finish = (error, state) => {
      clearTimeout(timer);
      wait.inspect = () => {};
      if (error) rejectSignal(error); else resolveSignal(state);
    };
    const wait = { promise, inspect: (state, signal) => {
      try {
        if (predicate(state, argument, signal)) finish(null, state);
      } catch (error) { finish(error); }
    }, cancel: () => finish(new Error(`Cancelled ${id}`)) };
    const timer = setTimeout(() => finish(new Error(`Signal deadline: ${id}; last=${JSON.stringify(qa.snapshot())}`)), timeoutMs);
    qa.waits[id] = wait;
    if (!future) wait.inspect(qa.snapshot(), 'initial');
  };
  qa.observer = new MutationObserver(() => qa.observe('mutation'));
  qa.observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  let phaser;
  Object.defineProperty(window, 'Phaser', { configurable: true, get: () => phaser, set(value) {
    phaser = value;
    const Game = value.Game;
    value.Game = class extends Game {
      constructor(config) {
        super(config);
        qa.game = this;
        qa.render = () => { qa.frame++; qa.observe('postrender'); };
        this.events.on('postrender', qa.render);
        this.events.once('playscene-ready', () => qa.observe('playscene-ready'));
      }
    };
  } });
  qa.dispose = () => {
    for (const wait of Object.values(qa.waits)) wait.cancel();
    qa.waits = {};
    qa.observer.disconnect();
    qa.game?.events.off('postrender', qa.render);
    qa.guard = null;
    return { observersDisconnected: true, renderListenerRemoved: true, signalsCancelled: true };
  };
  if (projectUrl) qa.arm('title', '() => !!document.querySelector("[data-testid=title-new-game]")', null, 120000, false);
  else {
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    qa.arm('editor-canvas', '() => !!document.querySelector("[data-testid=edit-canvas]")', null, 120000, false);
  }
}

async function arm(page, id, predicate, argument = null, timeout = 20000, future = false) {
  log('arm', { signal: id });
  await page.evaluate(({ id, source, argument, timeout, future }) => {
    window.__npcQa.arm(id, source, argument, timeout, future);
  }, { id, source: predicate.toString(), argument, timeout, future });
}
async function wait(page, id) {
  const state = await page.evaluate(async id => {
    const qa = window.__npcQa;
    try { return await qa.waits[id].promise; }
    finally { delete qa.waits[id]; }
  }, id);
  log('signal', { signal: id, map: state.map, player: state.player });
  return state;
}
async function phase(page, name) {
  log('phase', { name });
  await page.evaluate(name => { window.__npcQa.phase = name; }, name);
}
async function snap(page) { return page.evaluate(() => window.__npcQa.snapshot()); }
async function shot(page, name) {
  const path = `${current.name}-${name}.png`;
  await page.screenshot({ path: resolve(out, path) });
  current.screenshots.push(path);
  log('screenshot', { path });
}
async function key(page, value) { log('keyboard', { key: value }); await page.keyboard.press(value); }
const arrived = (s, p) => s.map === p.map && s.player?.x === p.x && s.player?.y === p.y && !s.moving
  && Math.abs(s.sprites.player.x - (p.x + 0.5) * 16) < 0.1 && Math.abs(s.sprites.player.y - (p.y + 1) * 16) < 0.1;
async function walk(page, keyName, map, x, y) {
  const id = `walk-${++serial}`;
  await arm(page, id, arrived, { map, x, y });
  await key(page, keyName);
  return wait(page, id);
}
async function route(page, dirs, map, x, y) {
  const id = `route-${++serial}`;
  await arm(page, id, (s, p) => !s.routeActive && s.map === p.map && s.player?.x === p.x && s.player?.y === p.y && !s.moving
    && Math.abs(s.sprites.player.x - (p.x + 0.5) * 16) < 0.1 && Math.abs(s.sprites.player.y - (p.y + 1) * 16) < 0.1, { map, x, y });
  log('player-route', { dirs });
  await page.evaluate(dirs => window.__oprnDebug.playerRoute(dirs.map(dir => ({ kind: 'move', dir }))), dirs);
  return wait(page, id);
}
async function guard(page, predicate, arg = null) {
  await page.evaluate(({ source, arg }) => {
    const check = (0, eval)(`(${source})`);
    window.__npcQa.guard = state => check(state, arg);
  }, { source: predicate.toString(), arg });
}
async function assertGuard(page) {
  assert.deepEqual(await page.evaluate(() => window.__npcQa.failures), [], 'Every rendered frame satisfies the scenario invariant');
}

async function runCase(name, fixtureKind, body, width = 1024) {
  if (interrupted) throw new Error('Interrupted; remaining cases were not run');
  current = { name, status: 'running', fixtureLoaded: false, screenshots: [], errors: [], browserErrors: [], blockedRequests: [] };
  const result = current;
  report.cases.push(result);
  let context, page, tracing = false;
  try {
    const fixture = await makeFixture(fixtureKind, root);
    const viewport = { width, height: scenario === 'editor' && width > 1024 ? 900 : 768 };
    result.viewport = viewport;
    context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    log('context-created');
    context.setDefaultTimeout(20000);
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true }); tracing = true;
    await context.addInitScript(installBrowserProbe, { name, projectUrl: scenario === 'editor' ? null : '/__npc-qa/project.json' });
    // Only the owned local server and fixture may be reached, even on accidental app DB boot.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const localAudit = scenario === 'editor' && url.origin === server.url
        && url.pathname === '/__oprn/edit-activity' && request.method() === 'POST';
      if (url.origin !== server.url || /\/(supabase|rest\/v1)(\/|$)/.test(url.pathname)
        || (!['GET', 'HEAD'].includes(request.method()) && !localAudit)) {
        result.blockedRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
        await route.abort('blockedbyclient');
      } else if (url.pathname === '/__npc-qa/project.json') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
      } else if (relay) {
        try {
          const response = await context.request.fetch(request.url(), {
            method: request.method(), headers: { ...request.headers(), connection: 'close' },
            data: request.postDataBuffer() ?? undefined, maxRetries: 0, timeout: 120000,
          });
          try {
            const headers = response.headers();
            delete headers['content-encoding']; delete headers['content-length']; delete headers['transfer-encoding'];
            await route.fulfill({ status: response.status(), headers, body: await response.body() });
          } finally {
            await response.dispose();
          }
        } catch (error) {
          // Preserve the failure in the report while allowing the owned cleanup path to run.
          result.errors.push(`relay ${url.pathname}: ${errorText(error)}`);
          await route.abort('failed');
        }
      } else await route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', error => result.browserErrors.push(errorText(error)));
    page.on('console', message => { if (message.type() === 'error') result.browserErrors.push(message.text()); });
    page.on('requestfailed', request => result.errors.push(`requestfailed ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
    log('navigate', { surface: scenario === 'editor' ? '/?blankProject=1&aiBridge=0' : '/player.html' });
    await page.goto(`${server.url}/${scenario === 'editor' ? '?blankProject=1&aiBridge=0' : 'player.html'}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (scenario !== 'editor') {
      await wait(page, 'title');
      await arm(page, 'runtime-ready', (s, p) => s.frame > 0 && s.map === p.map && s.player?.x === p.x && s.player?.y === p.y
        && !!s.sprites && s.inputEnabled === true && !s.moving,
      { map: fixture.startMapId, ...fixture.startPos }, 120000);
      await key(page, 'Enter');
      await wait(page, 'runtime-ready');
      const engine = await page.evaluate(() => ({ version: window.Phaser.VERSION,
        realGame: window.__npcQa.game instanceof window.Phaser.Game,
        scene: window.__npcQa.game.scene.getScene('PlayScene').sys.settings.key,
        renderer: window.__npcQa.game.renderer.type, texture: window.__oprnPlayerSprite().textureKey }));
      assert.equal(engine.realGame, true); assert.equal(engine.scene, 'PlayScene');
      assert.notEqual(engine.texture, '__MISSING');
      result.engine = engine;
      result.fixtureLoaded = true;
      log('fixture-loaded', engine);
      await page.evaluate(() => window.__oprnDebug.setSeed(12345));
      await shot(page, 'boot');
    }
    await body(page, fixture);
    await assertGuard(page);
    assert.deepEqual(result.blockedRequests, [], 'No DB, external, or unexpected write requests');
    assert.deepEqual(result.errors, [], 'No failed requests');
    assert.deepEqual(result.browserErrors, [], 'No browser errors');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = errorText(error);
    log('failed', { message: String(error) });
    if (page && !page.isClosed()) {
      try { result.failureState = await snap(page); await shot(page, 'failure'); }
      catch (captureError) { result.errors.push(`failure capture: ${errorText(captureError)}`); }
    }
  } finally {
    if (page && !page.isClosed()) {
      try {
        const data = await page.evaluate(() => {
          const qa = window.__npcQa;
          return { history: qa.history, failures: qa.failures, cleanup: qa.dispose() };
        });
        await writeFile(resolve(out, `${name}-states.json`), JSON.stringify(data.history, null, 2));
        result.invariantFailures = data.failures;
        report.cleanup.push({ case: name, ...data.cleanup });
      } catch (error) { report.errors.push(`probe cleanup: ${errorText(error)}`); }
    }
    try {
      if (tracing) { await context.tracing.stop({ path: resolve(out, `${name}-trace.zip`) }); report.cleanup.push({ case: name, traceStopped: true }); }
    } catch (error) { report.errors.push(`trace cleanup: ${errorText(error)}`); }
    finally {
      if (context) {
        try { await context.close(); report.cleanup.push({ case: name, contextClosed: true }); }
        catch (error) { report.errors.push(`context cleanup: ${errorText(error)}`); }
      }
    }
  }
}

async function pursuit(page, fixture) {
  await guard(page, (s, maps) => {
    if (!s.map) return;
    for (const [id, event] of Object.entries(s.events ?? {})) {
      if (id !== 'npc_qa_pursuer') continue;
      const m = maps[s.map];
      if (m.lowerTiles[event.y * m.width + event.x] === 46) throw new Error('Pursuer crossed blocked terrain');
    }
    if (s.caught && (s.phase !== 'reacquisition' || s.horror?.hiding)) {
      throw new Error('Pursuer caught the player before visible reacquisition');
    }
  }, fixture.maps);
  await phase(page, 'source-acquisition');
  await arm(page, 'acquisition', s => s.horror?.pursuits.npc_qa_pursuer?.active === true);
  await wait(page, 'acquisition');
  await shot(page, 'acquired');
  await arm(page, 'corner-search', s => s.map === 'npc_qa_source' && s.horror?.pursuits.npc_qa_pursuer?.searchMs > 0);
  await phase(page, 'corner-route');
  await route(page, ['right', 'right', 'down', 'down'], SOURCE_MAP, 9, 6);
  const lost = await wait(page, 'corner-search');
  assert.equal(lost.horror.pursuits[PURSUER].active, true);
  await shot(page, 'corner');
  await phase(page, 'real-door');
  const crossed = await walk(page, 'ArrowDown', ARRIVAL_MAP, 2, 4);
  // Immediate semantic assertion: baseline drops active searching pursuers at this door.
  assert.equal(crossed.horror?.pursuits[PURSUER]?.doors.length, 1, 'Active last-seen pursuit must queue exactly one real door after corner LOS loss');
  assert.equal(crossed.horror.pursuits[PURSUER].doors[0].mapId, ARRIVAL_MAP);
  assert.equal(crossed.sprites.events[PURSUER], undefined, 'No premature destination sprite');
  await shot(page, 'door-queued');
  await phase(page, 'unseen-hiding');
  await route(page, ['down', 'down'], ARRIVAL_MAP, 2, 6);
  await arm(page, 'hidden', s => !!s.horror?.hiding && s.sprites.player.visible === false);
  await key(page, 'ArrowDown'); // Face the adjacent hiding event; solid tile prevents a step.
  await key(page, 'Enter');
  const hidden = await wait(page, 'hidden');
  assert.deepEqual(hidden.horror.hiding.witnessedBy, []);
  await arm(page, 'arrival', s => s.eventLocations?.npc_qa_pursuer?.mapId === 'npc_qa_arrival' && !!s.sprites.events.npc_qa_pursuer, null, 30000);
  const entry = await wait(page, 'arrival');
  assert.equal(entry.horror.pursuits[PURSUER].doors.length, 0);
  assert.equal(Object.keys(entry.sprites.events).filter(id => id === PURSUER).length, 1);
  assert.notEqual(entry.sprites.events[PURSUER].textureKey, '__MISSING');
  await shot(page, 'arrival');
  await phase(page, 'arrival-search-movement');
  await arm(page, 'beyond-entry', s => {
    const npc = s.sprites?.events.npc_qa_pursuer;
    return !!s.horror?.hiding && s.horror.pursuits.npc_qa_pursuer?.active && npc
      && (Math.abs(npc.x - 40) >= 15 || Math.abs(npc.y - 80) >= 15);
  }, null, 30000);
  await wait(page, 'beyond-entry');
  await shot(page, 'search-beyond-entry');
  await arm(page, 'search-ended', s => !!s.horror?.hiding && s.horror.pursuits.npc_qa_pursuer?.active === false, null, 30000);
  const ended = await wait(page, 'search-ended');
  assert.equal(ended.caught, false);
  await shot(page, 'search-ended');
  await phase(page, 'reacquisition');
  await arm(page, 'visible-contact', s => {
    const npc = s.events?.npc_qa_pursuer;
    return s.caught && !s.horror?.hiding && npc && s.player
      && Math.abs(npc.x - s.player.x) + Math.abs(npc.y - s.player.y) === 1;
  }, null, 30000);
  await arm(page, 'unhidden', s => !s.horror?.hiding && s.sprites.player.visible === true);
  await arm(page, 'reacquired-current-target', s => {
    const pursuit = s.horror?.pursuits.npc_qa_pursuer;
    return s.map === 'npc_qa_arrival' && !s.horror.hiding && pursuit?.active === true
      && s.player?.x === 3 && s.player?.y === 6
      && pursuit.lastSeen?.x === s.player.x && pursuit.lastSeen?.y === s.player.y;
  });
  await key(page, 'Enter');
  await wait(page, 'unhidden');
  await walk(page, 'ArrowRight', ARRIVAL_MAP, 3, 6);
  const reacquired = await wait(page, 'reacquired-current-target');
  assert.equal(reacquired.horror.pursuits[PURSUER].doors.length, 0);
  assert.equal(Object.keys(reacquired.sprites.events).filter(id => id === PURSUER).length, 1);
  assert.equal(Object.keys(reacquired.horror.pursuits).length, 1, 'Reacquisition retains the same single pursuit');
  await shot(page, 'reacquired');
  await wait(page, 'visible-contact');
  await shot(page, 'visible-contact');
}

async function negativeTrainer(page, kind) {
  await phase(page, kind);
  await guard(page, s => {
    if (s.running || s.inputEnabled === false || s.commands !== 0 || s.battle) throw new Error('Trainer detected outside its unobstructed forward ray');
    const npc = s.events?.npc_qa_trainer;
    if (npc && (npc.x !== 3 || npc.y !== 5)) throw new Error('Undetected fixed trainer moved');
  });
  const x = kind === 'behind' ? 1 : 7;
  // Real completed steps expose the runtime to the rejected ray, then leave it.
  await walk(page, 'ArrowUp', SOURCE_MAP, x, 5);
  await shot(page, 'rejected-ray');
  await walk(page, 'ArrowDown', SOURCE_MAP, x, 6);
  await assertGuard(page);
}

async function fight(page, completionAfter = 1) {
  await arm(page, 'actual-battle-command', s => s.battle?.hasField && s.battle.attack && s.battle.phase === 'actorCommand' && s.battle.busy === 'false', null, 30000);
  await wait(page, 'actual-battle-command');
  await shot(page, 'actual-battle');
  await arm(page, 'target-selection', s => s.battle?.phase === 'targetSelect' && !!s.battle.target);
  assert.equal(await page.getByTestId('actor-command-attack').getAttribute('data-battle-command-cursor'), 'true',
    'Fresh actor command menu selects attack for keyboard confirmation');
  log('battle-attack-keyboard');
  await key(page, 'Enter');
  await wait(page, 'target-selection');
  await arm(page, 'actual-victory', s => s.battle?.result === 'victory' && s.battle.director === 'result' && s.battle.busy === 'false', null, 30000);
  await key(page, 'Enter');
  await wait(page, 'actual-victory');
  await shot(page, 'victory-result');
  await arm(page, 'battle-completed', (s, count) => !s.battle && s.battleResult === 'victory' && s.victory === true && s.commands === count && s.inputEnabled === true && !s.running, completionAfter, 30000);
  await key(page, 'Enter');
  return wait(page, 'battle-completed');
}

async function visibleTrainer(page, kind) {
  await phase(page, 'front-visible');
  await arm(page, 'detection-lock', s => s.inputEnabled === false && !s.moving && s.player?.x === 7 && s.player?.y === 5);
  await arm(page, 'adjacent-stop', s => {
    const npc = s.events?.npc_qa_trainer, sprite = s.sprites?.events.npc_qa_trainer;
    return npc && sprite && s.player && Math.abs(npc.x - s.player.x) + Math.abs(npc.y - s.player.y) === 1
      && Math.abs(sprite.x - (npc.x + 0.5) * 16) < 0.1 && Math.abs(sprite.y - (npc.y + 1) * 16) < 0.1;
  });
  await key(page, 'ArrowUp');
  const locked = await wait(page, 'detection-lock');
  assert.equal(locked.commands, 0, 'No command execution before approach');
  await phase(page, 'locked-approach');
  await guard(page, s => {
    if (s.player?.x !== 7 || s.player?.y !== 5 || s.inputEnabled !== false) throw new Error('Ordinary keyboard moved/unlocked player during approach');
    if (Math.abs(s.sprites.player.x - 120) > 0.1 || Math.abs(s.sprites.player.y - 96) > 0.1) throw new Error('Player sprite moved while input locked');
    if (s.events.npc_qa_second && (s.events.npc_qa_second.x !== 11 || s.events.npc_qa_second.y !== 5)) throw new Error('Second trainer stole foreground approach');
    const npc = s.events.npc_qa_trainer;
    if (s.commands > 0 && Math.abs(npc.x - 7) + Math.abs(npc.y - 5) !== 1) throw new Error('Trainer ran commands from afar');
  });
  log('keyboard-down', { key: 'ArrowRight' });
  await page.keyboard.down('ArrowRight');
  try { await wait(page, 'adjacent-stop'); await assertGuard(page); }
  finally { await page.keyboard.up('ArrowRight'); log('keyboard-up', { key: 'ArrowRight' }); }
  const history = await page.evaluate(() => window.__npcQa.history.filter(s => s.phase === 'locked-approach'));
  assert.ok(history.some(s => s.sprites.events[TRAINER]?.x > 56 && s.sprites.events[TRAINER]?.x < 104), 'Actual intermediate rendered approach, not a warp');
  await shot(page, 'adjacent');
  // The guard is scoped to approach; the normal command runner restores input on completion.
  await page.evaluate(() => { window.__npcQa.guard = null; });
  await phase(page, 'battle');
  const done = await fight(page);
  assert.ok(done.completion && Object.keys(done.completion).length > 0, 'Completion must be retained in the real per-event/page session record');
  if (kind === 'two-trainers') assert.equal(done.secondCommands, 0);
  await phase(page, 'completion-no-repeat');
  await guard(page, s => {
    if (s.commands !== 1 || s.battle) throw new Error('Completed trainer repeated commands/battle');
  });
  await walk(page, 'ArrowDown', SOURCE_MAP, 7, 6);
  await walk(page, 'ArrowUp', SOURCE_MAP, 7, 5);
  await assertGuard(page);
  await shot(page, 'completed-reentry');
}

async function manualFirstTrainer(page) {
  await phase(page, 'manual-first');
  await arm(page, 'manual-battle', s => !!s.battle, null, 30000);
  await key(page, 'ArrowUp');
  await key(page, 'Enter');
  await wait(page, 'manual-battle');
  const done = await fight(page);
  assert.equal(done.completion?.[TRAINER]?.npc_qa_page, true, 'Manual execution records the same page completion');
  await guard(page, s => {
    if (s.commands !== 1 || s.battle) throw new Error('Automatic detection repeated a manually completed battle');
  });
  await walk(page, 'ArrowDown', SOURCE_MAP, 3, 7);
  await walk(page, 'ArrowUp', SOURCE_MAP, 3, 6);
  await assertGuard(page);
  await shot(page, 'manual-completed-reentry');
}

async function blockedApproach(page) {
  await phase(page, 'blocked-approach');
  // Observe the exact ownership attempt before entering sight, including transient lock/release.
  await page.evaluate(() => {
    const scene = window.__npcQa.game.scene.getScene('PlayScene');
    const original = scene.setInputEnabled;
    window.__npcQa.lockTransitions = [];
    scene.setInputEnabled = function(enabled) {
      window.__npcQa.lockTransitions.push(enabled);
      return original.call(this, enabled);
    };
  });
  await arm(page, 'blocked-release', s => {
    const transitions = window.__npcQa.lockTransitions;
    return transitions.includes(false) && transitions.at(-1) === true && s.inputEnabled && !s.running;
  });
  await key(page, 'ArrowUp');
  const failed = await wait(page, 'blocked-release');
  assert.equal(failed.commands, 0); assert.equal(failed.battle, null);
  assert.equal(failed.events[TRAINER].x, 3, 'Blocked trainer must not warp through wall');
  assert.ok(!failed.completion || Object.keys(failed.completion).length === 0, 'Blocked approach is not completion');
  const attempts = await page.evaluate(() => window.__npcQa.lockTransitions.filter(v => !v).length);
  await walk(page, 'ArrowDown', SOURCE_MAP, 7, 6);
  await arm(page, 'blocked-rearmed', (s, n) => window.__npcQa.lockTransitions.filter(v => !v).length > n && s.inputEnabled && !s.running, attempts);
  await key(page, 'ArrowUp');
  await wait(page, 'blocked-rearmed');
  await shot(page, 'blocked-rearmed');
}

async function parallelBattle(page) {
  await phase(page, 'parallel-battle');
  await arm(page, 'scheduled-battle', s => !!s.battle, null, 30000);
  await key(page, 'ArrowUp'); // Faces the fixture's adjacent action event.
  await key(page, 'Enter');
  const started = await wait(page, 'scheduled-battle');
  assert.equal(started.commands, 0, 'Parallel interpreter must await battle rather than run its following command');
  await guard(page, s => { if (s.battle && s.commands !== 0) throw new Error('Parallel interpreter resumed before actual battle completion'); });
  await fight(page);
  await assertGuard(page);
  await shot(page, 'parallel-completed');
}

async function inactivePagedParallel(page) {
  await phase(page, 'inactive-paged-parallel');
  await guard(page, s => {
    if (s.commands !== 0 || s.battle || s.running) throw new Error('Inactive page executed legacy fallback commands');
  });
  await walk(page, 'ArrowUp', SOURCE_MAP, 7, 5);
  await walk(page, 'ArrowDown', SOURCE_MAP, 7, 6);
  await assertGuard(page);
  await shot(page, 'inactive-page-stayed-idle');
}

async function externalMapCancellation(page) {
  await phase(page, 'external-map-cancellation');
  await arm(page, 'old-trainer-dialogue', () => !!document.querySelector('[data-testid="dialogue-box"]'), null, 30000);
  await key(page, 'ArrowUp');
  await wait(page, 'old-trainer-dialogue');
  assert.equal((await snap(page)).commands, 0);
  await shot(page, 'before-external-map');
  await arm(page, 'replacement-released', s => s.map === 'npc_qa_arrival' && s.inputEnabled && !s.running
    && !document.querySelector('[data-testid="dialogue-box"]'));
  log('external-map-replacement');
  await page.evaluate(() => window.__oprnDebug.teleport('npc_qa_arrival', 2, 4));
  await wait(page, 'replacement-released');
  // The debug replacement is lifecycle setup, not door-following proof. A real step settles its sprite.
  await walk(page, 'ArrowRight', ARRIVAL_MAP, 3, 4);
  await key(page, 'Enter');
  const state = await snap(page);
  assert.equal(state.commands, 0, 'Cancelled dialogue cannot execute its following command');
  assert.notEqual(state.completion?.[TRAINER]?.npc_qa_page, true, 'Cancelled encounter has no completion receipt');
  await shot(page, 'external-map-cancelled');
}

async function authoredTransfer(page) {
  await phase(page, 'authored-transfer');
  await arm(page, 'authored-transfer-completed', s => s.map === 'npc_qa_arrival' && s.commands === 1
    && s.completion?.npc_qa_trainer?.npc_qa_page === true && s.inputEnabled && !s.running, null, 30000);
  await key(page, 'ArrowUp');
  await wait(page, 'authored-transfer-completed');
  await walk(page, 'ArrowRight', ARRIVAL_MAP, 3, 4);
  await shot(page, 'authored-transfer-completed');
}

// Stable IDs agreed in the task. Missing controls are an acceptance failure, never a fallback.
const editorValues = {
  'event-npc-sight-range': '9', 'event-npc-sight-los': true, 'event-npc-sight-facing': 'forward',
  'event-chase-scope': 'connected', 'event-chase-tracking': 'persistent',
  'event-chase-doorDelayMs': '1.7', 'event-chase-searchMs': '5.3', 'event-chase-onLost': 'return',
  'event-detection-enabled': true, 'event-detection-range': '7', 'event-detection-los': true,
  'event-detection-facing': 'forward', 'event-detection-emote': 'question',
  'event-detection-emoteMs': '900', 'event-detection-speed': '5',
};
async function editControl(page, id, value) {
  assert.equal(await page.getByTestId(id).count(), 1, `Required authoring control: ${id}`);
  const railId = await page.getByTestId(id).evaluate(node => node.closest('[data-rail-group]')?.dataset.testid);
  if (railId) {
    const header = page.getByTestId(railId).locator(':scope > .event-editor-settings-accordion-header');
    if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  }
  const signal = `control-${++serial}`;
  await arm(page, signal, (s, a) => {
    const node = document.querySelector(`[data-testid="${a.id}"]`);
    return node && (typeof a.value === 'boolean' ? node.checked === a.value : node.value === a.value);
  }, { id, value }, 20000, true);
  log('editor-control', { id, value });
  const control = page.getByTestId(id);
  if (typeof value === 'boolean') await control.setChecked(value);
  else if (await control.evaluate(node => node.tagName === 'SELECT')) {
    const optionIndex = await control.evaluate((node, value) => Array.from(node.options).findIndex(option => option.value === value), value);
    assert.ok(optionIndex >= 0, `Option ${id}=${value} exists`);
    const trigger = page.locator(`[data-custom-select-for="${id}"]`);
    assert.equal(await trigger.count(), 1, `Visible custom select for ${id}`);
    await trigger.click();
    await page.locator(`[data-custom-select-popover="true"] [data-option-index="${optionIndex}"]`).click();
  }
  else { await control.fill(value); await control.press('Tab'); }
  // The normal change handlers are synchronous; explicitly notify the observer after the real action.
  await page.evaluate(() => window.__npcQa.observe('editor-control'));
  await wait(page, signal);
}
async function editor(page, fixture) {
  await wait(page, 'editor-canvas');
  for (const [button, overlay] of [['login-guest', 'login-modal'], ['standard-welcome-start', 'standard-welcome-card'], ['coach-mark-skip', 'coach-mark-skip']]) {
    if (await page.getByTestId(button).isVisible()) {
      await arm(page, `dismiss-${button}`, (s, id) => !document.querySelector(`[data-testid="${id}"]`), overlay);
      await page.getByTestId(button).click(); await wait(page, `dismiss-${button}`);
    }
  }
  await arm(page, 'modal-open', () => !!document.querySelector('[data-testid="event-editor-modal"]'));
  const imported = await page.evaluate(async fixture => {
    const { store } = await import('/src/project/store.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const { deserialize } = await import('/src/project/io.ts');
    const { openEventEditorModal } = await import('/src/editor/panels/eventEditor/modal.ts');
    if (store !== window.__oprnEditorStore) throw new Error('Different editor store instance');
    if (store.isRemotePersistenceEnabled()) throw new Error('Remote persistence must be disabled before QA fixture insertion');
    // Keep current canonical DB defaults; the old runtime fixture predates editor-required fields.
    const editorFixture = structuredClone(store.getCurrent());
    Object.assign(editorFixture, {
      maps: fixture.maps, tilesets: fixture.tilesets, startMapId: fixture.startMapId,
      startPos: fixture.startPos, mapTree: fixture.mapTree, commonEvents: [],
    });
    // Exercise real draft/apply/export, not remote autosave or its intentional blank-session warning.
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(deserialize(JSON.stringify(editorFixture)), { preserveEventDrafts: false,
      change: { scope: 'project', origin: 'system', label: 'NPC browser contract fixture' } });
    editorState.set({ currentMapId: fixture.startMapId, selectedEventId: 'npc_qa_trainer', selectedEventPageId: 'npc_qa_page' });
    openEventEditorModal(fixture.startMapId, 'npc_qa_trainer');
    return { remotePersistence: store.isRemotePersistenceEnabled(), storeIdentity: store === window.__oprnEditorStore };
  }, fixture);
  assert.equal(imported.remotePersistence, false); assert.equal(imported.storeIdentity, true);
  current.fixtureLoaded = true;
  await wait(page, 'modal-open');
  await shot(page, 'modal');
  await editControl(page, 'event-page-movement-type', 'chase');
  for (const [id, value] of Object.entries(editorValues)) await editControl(page, id, value);
  await arm(page, 'applied', () => document.querySelector('[data-testid="event-editor-draft-status"]')?.dataset.state === 'applied');
  log('editor-apply'); await page.getByTestId('event-editor-apply').click(); await wait(page, 'applied');
  const readPage = () => page.evaluate(() => window.__oprnEditorStore.getCurrent().maps.npc_qa_source.events.find(e => e.id === 'npc_qa_trainer').pages.find(p => p.id === 'npc_qa_page'));
  const applied = await readPage();
  assert.deepEqual(applied.movement.sight, { range: 9, lineOfSight: true, facing: 'forward' });
  assert.deepEqual(applied.movement.pursuit, { scope: 'connected', tracking: 'persistent', doorDelayMs: 1700, searchMs: 5300, onLost: 'return' });
  assert.deepEqual(applied.detectionEncounter, { sight: { range: 7, lineOfSight: true, facing: 'forward' }, emote: 'question', emoteMs: 900, approachSpeed: 5 });
  await shot(page, 'applied');
  await arm(page, 'closed', () => !document.querySelector('[data-testid="event-editor-modal"]'));
  await page.getByTestId('event-editor-cancel').click(); await wait(page, 'closed');
  await arm(page, 'reopened', () => !!document.querySelector('[data-testid="event-editor-modal"]'));
  await page.evaluate(async () => {
    const { openEventEditorModal } = await import('/src/editor/panels/eventEditor/modal.ts');
    openEventEditorModal('npc_qa_source', 'npc_qa_trainer');
  });
  await wait(page, 'reopened');
  for (const [id, value] of Object.entries(editorValues)) {
    const actual = await page.getByTestId(id).evaluate(node => node.type === 'checkbox' ? node.checked : node.value);
    assert.equal(actual, value, `Reopened ${id}`);
  }
  assert.deepEqual((await readPage()).movement, applied.movement);
  assert.deepEqual((await readPage()).detectionEncounter, applied.detectionEncounter);
  await shot(page, 'reopened');
}

try {
  if (scenario === 'editor') {
    process.env.DEV_SERVER_NO_TLS = '1'; process.env.E2E_FREEZE_DEV_SERVER = '1';
    // Preserve the real in-browser edit log; this fixture does not exercise its dev disk mirror.
    process.env.VITE_EDIT_ACTIVITY_DISK_MIRROR = '0';
    // Vite treats port:0 as its default5173. Acquire an ephemeral port explicitly, then strict-bind it.
    const portProbe = netServer();
    await new Promise((yes, no) => { portProbe.once('error', no); portProbe.listen(0, '127.0.0.1', yes); });
    const port = portProbe.address().port;
    await new Promise((yes, no) => portProbe.close(error => error ? no(error) : yes()));
    const vite = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), configLoader: 'runner',
      cacheDir: resolve(root, '.vite-cache/npc-behavior-editor'),
      server: { host: '127.0.0.1', port, strictPort: true, open: false, hmr: false, watch: null }, logLevel: 'warn' });
    // Assign ownership before listen so a failed listen still closes the created server.
    server = { close: () => vite.close() };
    await vite.listen();
    const address = vite.httpServer.address();
    server.port = address.port; server.url = `http://127.0.0.1:${address.port}`;
  } else {
    const { startPlayerQaServer } = await import(pathToFileURL(serverHelper).href);
    server = await startPlayerQaServer();
  }
  log('server-owned', { url: server.url, root, sourceCommit, sourceDirty, runnerRoot, serverHelper });
  browser = await chromium.launch({ headless: !headed, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-features=LocalNetworkAccessChecks'] });
  log('browser-owned', { version: browser.version() });
  if (scenario === 'pursuit') await runCase('pursuit', 'pursuit', pursuit);
  if (scenario === 'trainer') {
    await runCase('behind', 'behind', page => negativeTrainer(page, 'behind'));
    await runCase('wall', 'wall', page => negativeTrainer(page, 'wall'));
    await runCase('front', 'front', page => visibleTrainer(page, 'front'));
    await runCase('two-trainers', 'two-trainers', page => visibleTrainer(page, 'two-trainers'));
    await runCase('manual-first', 'manual-first', manualFirstTrainer);
    await runCase('blocked-approach', 'blocked-approach', blockedApproach);
    await runCase('parallel-battle', 'parallel-battle', parallelBattle);
    await runCase('legacy-parallel-battle', 'legacy-parallel-battle', parallelBattle);
    await runCase('inactive-paged-parallel', 'inactive-paged-parallel', inactivePagedParallel);
    await runCase('external-map', 'external-map', externalMapCancellation);
    await runCase('authored-transfer', 'authored-transfer', authoredTransfer);
  }
  if (scenario === 'editor') for (const width of [1440, 1024]) await runCase(`editor-${width}`, 'editor', editor, width);
} catch (error) { report.errors.push(errorText(error)); }
finally {
  try {
    if (browser) { await browser.close(); report.cleanup.push({ browserClosed: !browser.isConnected() }); }
  } catch (error) { report.errors.push(`browser cleanup: ${errorText(error)}`); }
  finally {
    if (server) {
      try {
        await server.close(); report.cleanup.push({ serverClosed: true, port: server.port });
        if (server.port) {
          const check = netServer();
          await new Promise((yes, no) => { check.once('error', no); check.listen(server.port, '127.0.0.1', yes); });
          await new Promise((yes, no) => check.close(error => error ? no(error) : yes()));
          report.cleanup.push({ portReleased: server.port, verifiedByExclusiveBind: true });
        }
      } catch (error) { report.errors.push(`server cleanup: ${errorText(error)}`); }
    }
  }
  report.status = report.errors.length === 0 && report.cases.length > 0 && report.cases.every(c => c.status === 'passed') ? 'passed' : 'failed';
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(out, 'actions.jsonl'), report.actions.map(entry => JSON.stringify(entry)).join('\n') + '\n');
  await writeFile(resolve(out, 'SUMMARY.md'), [
    `# NPC ${scenario}: ${report.status}`, '', `Transport: ${report.transport}`, `Source: ${root}`,
    `Source commit: ${sourceCommit} (dirty: ${sourceDirty})`, `Runner: ${runnerRoot}`, `Server helper: ${serverHelper}`,
    'Screenshots are preliminary; lead real-surface review is required.', '',
    ...report.cases.flatMap(c => [`## ${c.name}: ${c.status}`, `Fixture loaded: ${c.fixtureLoaded}`,
      c.failure ? `\n\`\`\`\n${c.failure}\n\`\`\`` : '', ...c.screenshots.map(path => `- ${path}`),
      `- ${c.name}-trace.zip`, `- ${c.name}-states.json`]),
    '', '## Cleanup', '```json', JSON.stringify(report.cleanup, null, 2), '```',
    '', '## Harness errors', '```json', JSON.stringify(report.errors, null, 2), '```',
  ].join('\n'));
}
console.log(JSON.stringify({ scenario, status: report.status, report: resolve(out, 'report.json') }));
process.exitCode = report.status === 'passed' ? 0 : 1;
