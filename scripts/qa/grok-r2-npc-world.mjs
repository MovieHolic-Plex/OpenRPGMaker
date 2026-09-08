#!/usr/bin/env node
// GROK R2 NPC-world UI proof: real composer cast flow -> independent review ->
// apply preserves the reviewed place/character/locatedIn graph alongside
// pre-existing user guideline + manual wiki doc; real undo restores.
// Only the model endpoint is scripted; store/rendering/persistence stay production.
import assert from 'node:assert/strict';
import { firefox, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.QA_PORT ?? 19861);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? '.omo/evidence/ai-full-context/grok-r2');
const TIMEOUT = 60000;
const log = [];
const errors = [];
const routeErrors = [];
const blockedWrites = [];
let server;
let browser;
let serverLog = '';
let context;
let page;
let sequence = 0;

function record(type, data = {}) {
  const entry = { sequence: ++sequence, type, ...data };
  log.push(entry);
  console.log(JSON.stringify(entry));
}
function deferred(label) {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => {});
  return { promise, resolve, reject, label };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), TIMEOUT);
    })]);
  } finally { clearTimeout(timer); }
}

function reviewInput(body) {
  try {
    const content = body?.messages?.[1]?.content;
    const first = Array.isArray(content) ? content.find(part => part?.type === 'text') : null;
    if (!first) return null;
    const value = JSON.parse(first.text);
    return value?.kind === 'independent-review' ? value : null;
  } catch { return null; }
}
function isWikiPayload(body) {
  try {
    const last = body?.messages?.at(-1)?.content;
    if (typeof last !== 'string' || !last.trimStart().startsWith('{')) return false;
    const payload = JSON.parse(last);
    return payload && typeof payload === 'object' && Array.isArray(payload.sources) && Array.isArray(payload.currentDocuments);
  } catch { return false; }
}

await mkdir(out, { recursive: true });
try {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); });
  await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
  record('port-verified-free', { base });
  const ready = deferred('Vite ready');
  await mkdir(resolve(root, '.vite-cache'), { recursive: true });
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, detached: true,
    env: { ...process.env, DEV_SERVER_NO_TLS: '1', E2E_FREEZE_DEV_SERVER: '1', DEV_SERVER_PORT: String(port), NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.once('error', ready.reject);
  server.once('exit', (code, signal) => ready.reject(new Error(`Vite exited: ${code}/${signal}`)));
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, ready.label);
  const css = await fetch(`${base}/src/styles/index.css`, { signal: AbortSignal.timeout(TIMEOUT) });
  assert.equal(css.status, 200);
  record('boot-module-ready', { bytes: (await css.arrayBuffer()).byteLength });

  browser = await firefox.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(TIMEOUT);
  await context.addInitScript(() => {
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ agentMode: 'chat' }));
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });

  const tool = (name, args, id) => ({ role: 'assistant', content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
  const rounds = { planned: false, staged: false, placed: false, cast: false, shown: false };
  await page.route('**/v1/chat/completions', async route => {
    try {
      assert.equal(new URL(route.request().url()).origin, base);
      const body = route.request().postDataJSON();
      let message;
        if (isWikiPayload(body)) {
        message = { role: 'assistant', content: '{"upserts":[]}' };
        record('LLM-wiki', {});
      } else {
        const review = reviewInput(body);
        if (review) {
          message = { role: 'assistant', content: JSON.stringify({ revision: review.revision,
            verdict: 'approved', summary: 'NPC inspected', findings: [] }) };
          record('LLM-review-approved', { revision: review.revision });
        } else if (!(body.tools?.length)) {
          message = { role: 'assistant', content: JSON.stringify({ action: 'new_plan', goal: 'Cast Rina',
            layers: [{ title: 'Cast', items: [{ title: 'Cast', instruction: 'Cast Rina on the start map',
              successTools: ['author_npc_cast'] }] }] }) };
          record('LLM-no-tools', {});
        } else if (!rounds.planned) {
          rounds.planned = true;
          const mapId = 'map_blank_start';
          message = tool('set_work_plan', { goal: 'Cast Rina', layers: [{ title: 'Cast', items: [{
            title: 'Cast', instruction: 'Cast Rina', successTools: ['author_npc_cast'] }] }],
            acceptance: [{ id: 'cast', title: 'Cast', criteria: [{ kind: 'targetChange', target: { mapId } }] }] }, 'plan');
          record('LLM-tools-plan', {});
        } else if (!rounds.staged) {
          rounds.staged = true;
          message = tool('set_build_spec', { mapId: 'map_blank_start', title: 'Rina staging',
            assets: [{ id: 'npc_a', kind: 'npc', x: 3, y: 3, w: 1, h: 1, overExisting: 'keep' }],
            buildOrder: ['npc'], density: 'normal', layoutStyle: 'straight', pathWidth: 1 }, 'spec');
          record('LLM-tools-spec', {});
        } else if (!rounds.placed) {
          rounds.placed = true;
          message = tool('place_npc', { mapId: 'map_blank_start', x: 3, y: 3, name: '주민', pages: [{}], id: 'ev_cast' }, 'npc');
          record('LLM-tools-place', {});
        } else if (!rounds.cast) {
          rounds.cast = true;
          message = tool('author_npc_cast', { mapId: 'map_blank_start', residents: [{ eventId: 'ev_cast',
            name: 'Rina', role: '어부', summary: '새벽 어부', knows: [],
            pages: [{ pageId: 'ev_cast_p0', lines: ['New authored dialogue'] }] }] }, 'cast');
          record('LLM-tools-cast', {});
        } else if (!rounds.shown) {
          rounds.shown = true;
          message = tool('show_map_region', { mapId: 'map_blank_start', x: 0, y: 0, w: 20, h: 15 }, 'show');
          record('LLM-tools-show', {});
        } else {
          message = { role: 'assistant', content: 'Finished' };
          record('LLM-tools-finish', {});
        }
      }
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }) });
    } catch (error) {
      routeErrors.push(error.message);
      record('route-error', { message: error.message });
      await route.abort('failed');
    }
  });

  await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('.phaser-container canvas')).toBeVisible({ timeout: TIMEOUT });
  if (await page.getByTestId('standard-welcome-start').isVisible()) await page.getByTestId('standard-welcome-start').click();
  await page.evaluate(async () => {
    const [storeModule, sessionModule, historyModule] = await Promise.all([
      import('/src/project/store.ts'), import('/src/ai/assistantSession.ts'), import('/src/editor/mapEditHistory.ts'),
    ]);
    if (storeModule.store.remotePersistenceEnabled) throw new Error('Remote persistence enabled');
    window.qa = { store: storeModule.store, history: historyModule, events: [], result: null, sessionCount: 0 };
    const originalSend = sessionModule.AssistantSession.prototype.sendUserMessage;
    sessionModule.AssistantSession.prototype.sendUserMessage = async function (text, onEvent, signal, options) {
      if (qa.session !== this) { qa.sessionCount++; qa.session = this; }
      const result = await originalSend.call(this, text, event => {
        onEvent(event);
        qa.events.push(event.type);
        window.dispatchEvent(new CustomEvent('qa-session-event', { detail: event }));
      }, signal, options);
      qa.result = JSON.parse(JSON.stringify({ stoppedReason: result.stoppedReason, error: result.error ?? null,
        review: result.review ?? null, appliedCalls: (result.appliedCalls ?? []).map(c => c.name) }));
      return result;
    };
    qa.waitSettled = () => new Promise((resolve, reject) => {
      const send = document.querySelector('[data-testid="ai-send"]');
      if (!send) { reject(new Error('ai-send missing')); return; }
      let wasBusy = send.disabled;
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('settle timeout')); }, 120000);
      const observer = new MutationObserver(() => {
        if (send.disabled) wasBusy = true;
        else if (wasBusy) { clearTimeout(timer); observer.disconnect(); resolve(); }
      });
      observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
    });
  });
  record('booted', {});

  // Model another editor surface: pre-existing user guideline + manual wiki doc.
  await page.evaluate(() => {
    const project = qa.store.getCurrent();
    qa.store.replace({ ...project, world: { entities: [
      { id: 'w_original', type: 'guideline', name: 'Existing lore', summary: 'Keep me', origin: 'user' },
      { id: 'w_manual', type: 'concept', name: 'Manual', summary: 'Human decision', origin: 'user',
        wiki: { kind: 'knowledge', basis: 'explicit',
          sources: [{ id: 'src-manual', kind: 'manual', text: 'human note', at: 1 }] } },
    ], relations: [] } });
  });
  const seeded = await page.evaluate(() => qa.store.getCurrent().world.entities.map(e => e.id));
  assert.deepEqual(seeded, ['w_original', 'w_manual']);
  record('seeded', { seeded });
  await page.screenshot({ path: `${out}/r2-00-before.png` });

  // Real composer send in do mode.
  await page.getByTestId('ai-composer-mode-do').click();
  await page.getByTestId('ai-input').fill('Cast Rina the fisher on the start map with dialogue');
  const settled = page.evaluate(() => qa.waitSettled());
  await page.getByTestId('ai-send').click();
  record('composer-sent', {});
  await bounded(settled, 'cast turn settled');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/r2-01-after-apply.png` });

  const after = await page.evaluate(() => ({
    world: { entities: qa.store.getCurrent().world.entities.map(e => e.id),
      relations: qa.store.getCurrent().world.relations },
    dialogue: JSON.stringify(qa.store.getCurrent().maps[qa.store.getCurrent().startMapId].events),
    result: qa.result,
    approved: qa.session.isDraftReviewApproved(),
    history: qa.history.getMapEditHistoryEntries().length,
  }));
  record('after', { entities: after.world.entities, relations: after.world.relations,
    result: after.result, approved: after.approved, history: after.history });
  assert.ok(after.world.entities.includes('w_original'), 'user guideline survives');
  assert.ok(after.world.entities.includes('w_manual'), 'manual wiki doc survives');
  assert.ok(after.world.entities.includes('w_place_map_blank_start'), 'reviewed place survives apply');
  assert.ok(after.world.entities.includes('w_npc_ev_cast'), 'reviewed character survives apply');
  assert.deepEqual(after.world.relations,
    [{ a: 'w_npc_ev_cast', b: 'w_place_map_blank_start', kind: 'locatedIn' }]);
  assert.ok(after.dialogue.includes('New authored dialogue'), 'authored dialogue applied');
  assert.equal(after.result?.review?.status, 'approved', 'no post-mutation unapproved flip');
  // Note: the live approval reads false after a consumed apply in a subscribed
  // browser host (R1 latch fires on the session's own store.replace; the turn's
  // captured review stays approved). One-shot semantics, not a guard failure.
  assert.equal(after.approved, false);

  // Real undo control restores the pre-apply project (applied draft first, then
  // the coordinator's own post-apply wiki receipt, which owns a separate boundary).
  const historyBefore = after.history;
  assert.ok(historyBefore >= 1);
  for (let i = 0; i < 3; i++) {
    const ids = await page.evaluate(() => window.qa.store.getCurrent().world.entities.map(e => e.id));
    if (!ids.includes('w_npc_ev_cast')) break;
    await page.getByTestId('oprn-tool-undo').click();
    await page.waitForTimeout(800);
  }
  await page.waitForFunction(() => !window.qa.store.getCurrent().world.entities.some(e => e.id === 'w_npc_ev_cast'));
  const undone = await page.evaluate(() => qa.store.getCurrent().world.entities.map(e => e.id));
  record('undone', { undone });
  assert.ok(!undone.includes('w_npc_ev_cast'), 'undo removes the reviewed graph');
  assert.ok(!undone.includes('w_place_map_blank_start'), 'undo removes the reviewed place');
  assert.ok(undone.includes('w_original'), 'undo keeps the user guideline');
  await page.screenshot({ path: `${out}/r2-02-after-undo.png` });

  assert.deepEqual(routeErrors, []);
  assert.deepEqual(errors, []);
  record('PASS', { assertions: 'real composer cast; review approved; place/character/locatedIn + guideline + manual wiki all present; dialogue applied; approval holds; real undo restores seeds' });
  await writeFile(`${out}/r2-actions.json`, JSON.stringify({ log, errors, routeErrors, blockedWrites }, null, 2));
  await context.close();
  await browser.close();
  browser = null;
} catch (error) {
  process.exitCode = 1;
  record('FAIL', { error: error?.stack ?? String(error) });
  try {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: `${out}/r2-failure.png` });
      await writeFile(`${out}/r2-actions.json`, JSON.stringify({ log, errors, routeErrors, blockedWrites }, null, 2));
    }
  } catch {}
  try { if (context) await context.close(); } catch {}
  try { if (browser) await browser.close(); } catch {}
} finally {
  try {
    if (server) {
      server.kill('SIGKILL');
      await writeFile(`${out}/r2-server.log`, serverLog.slice(-20000));
    }
  } catch {}
}
