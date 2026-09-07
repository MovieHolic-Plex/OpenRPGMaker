#!/usr/bin/env node
// GROK R1 stale-approval UI proof: held independent review + intervening human
// DB edit via real clicks must reject the stale draft (no apply, no undo entry).
// Only the model endpoint is scripted; store/remote/persistence stay production.
import assert from 'node:assert/strict';
import { firefox, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.QA_PORT ?? 19851);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? '.omo/evidence/ai-full-context/grok-r1');
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

  // Held-review gate: only the reviewer response waits; writer rounds pass through.
  const reviewGate = deferred('independent review held');
  let reviewArrived = deferred('review request arrived');
  let wrote = false;
  await page.route('**/v1/chat/completions', async route => {
    let held = null;
    try {
      assert.equal(new URL(route.request().url()).origin, base);
      const body = route.request().postDataJSON();
      try {
        const msgs = (body.messages ?? []).map(m => JSON.stringify(m.content).slice(0, 200));
        record('LLM-request', { tools: (body.tools ?? []).map(t => t?.function?.name), messages: msgs.length, first: msgs[0] ?? null });
      } catch {}
      const events = await page.evaluate(() => window.qa?.events?.slice(-8) ?? []);
      record('session-events', { events });
      let message;
      const lastContent = body?.messages?.at(-1)?.content;
      let wiki = false;
      if (typeof lastContent === 'string' && lastContent.trimStart().startsWith('{')) {
        try {
          const payload = JSON.parse(lastContent);
          wiki = payload && typeof payload === 'object' && Array.isArray(payload.sources) && Array.isArray(payload.currentDocuments);
        } catch {}
      }
      const review = wiki ? null : reviewInput(body);
      if (wiki) {
        message = { role: 'assistant', content: '{"upserts":[]}' };
        record('LLM-wiki', {});
      } else if (review) {
        record('LLM-review-arrived', { revision: review.revision });
        reviewArrived.resolve({ revision: review.revision });
        reviewArrived = deferred('review request arrived');
        held = reviewGate;
        message = { role: 'assistant', content: JSON.stringify({ revision: review.revision, verdict: 'approved', summary: 'Title inspected', findings: [] }) };
      } else if (!(body.tools?.length)) {
        message = { role: 'assistant', content: JSON.stringify({ action: 'new_plan', goal: 'Change title', layers: [{ title: 'Title', items: [{
          title: 'Title', instruction: 'set_title_screen', successTools: ['set_title_screen'] }] }] }) };
        record('LLM-no-tools', {});
      } else if (!wrote) {
        wrote = true;
        message = { role: 'assistant', content: null, tool_calls: [{ id: 'title', type: 'function', function: {
          name: 'set_title_screen', arguments: JSON.stringify({ title: 'Reviewed title', reason: 'Change requested title' }) } }] };
        record('LLM-tools-write', {});
      } else {
        message = { role: 'assistant', content: 'Finished' };
        record('LLM-tools-finish', {});
      }
      if (held) {
        record('LLM-review-held', {});
        await bounded(held.promise, held.label);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }) });
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
        review: result.review ?? null, appliedCalls: result.appliedCalls ?? [] }));
      return result;
    };
    qa.waitSettled = () => new Promise((resolve, reject) => {
      const send = document.querySelector('[data-testid="ai-send"]');
      if (!send) { reject(new Error('ai-send missing')); return; }
      let wasBusy = send.disabled;
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('settle timeout')); }, 90000);
      const observer = new MutationObserver(() => {
        if (send.disabled) wasBusy = true;
        else if (wasBusy) { clearTimeout(timer); observer.disconnect(); resolve(); }
      });
      observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
    });
  });
  record('booted', {});

  const before = await page.evaluate(() => ({
    price: qa.store.getCurrent().database.items.find(item => item.id === 'item_potion')?.price,
    title: qa.store.getCurrent().system.titleScreen?.title,
    history: qa.history.getMapEditHistoryEntries().length,
  }));
  assert.equal(before.price, 50);
  record('baseline', before);
  await page.screenshot({ path: `${out}/r1-00-before.png` });

  // Real composer send (do mode): exact click/fill/click sequence.
  await page.getByTestId('ai-composer-mode-do').click();
  await page.getByTestId('ai-input').fill('Change the game title to Reviewed title');
  const settled = page.evaluate(() => qa.waitSettled());
  await page.getByTestId('ai-send').click();
  record('composer-sent', {});
  await page.screenshot({ path: `${out}/r1-01-turn-running.png` });

  // Wait for the exact held reviewer request (subscribed before sending).
  const arrived = await bounded(reviewArrived.promise, reviewArrived.label);
  record('review-held-confirmed', arrived);

  // Intervening human edit on a separate real surface: database panel price 50 -> 9876.
  await page.getByTestId('toolbar-database').click();
  await expect(page.getByTestId('database-modal')).toBeVisible();
  await page.getByTestId('db-tab-items').click();
  await page.getByTestId('db-record-row-item_potion').click();
  await page.getByTestId('db-field-price').fill('9876');
  await page.getByTestId('db-field-price').press('Tab');
  await page.waitForFunction(() => window.qa?.store.getCurrent().database.items.find(item => item.id === 'item_potion')?.price === 9876);
  const humanBoundary = await page.evaluate(() => ({ history: qa.history.getMapEditHistoryEntries().length }));
  record('human-price-edit', { price: 9876, ...humanBoundary });
  await page.screenshot({ path: `${out}/r1-02-human-edit-9876.png` });
  await page.keyboard.press('Escape');

  // Release the stale approval; the shared boundary must reject it.
  reviewGate.resolve();
  record('review-released', {});
  await bounded(settled, 'turn settled after stale approval');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/r1-03-after-stale-apply.png` });

  const after = await page.evaluate(() => ({
    price: qa.store.getCurrent().database.items.find(item => item.id === 'item_potion')?.price,
    title: qa.store.getCurrent().system.titleScreen?.title,
    history: qa.history.getMapEditHistoryEntries().length,
    result: qa.result,
    approved: qa.session.isDraftReviewApproved(),
    chatTail: (document.querySelector('[data-testid="ai-chat-log"]')?.innerText ?? '').slice(-1500),
    buttons: [...document.querySelectorAll('[data-testid="ai-chat-log"] button')].map(b => b.textContent?.trim()).filter(Boolean).slice(0, 20),
  }));
  record('after', after);
  assert.equal(after.price, 9876, 'intervening human price edit must survive');
  assert.equal(after.title, before.title, 'stale title draft must not apply');
  assert.equal(after.history, humanBoundary.history, 'stale apply must add no undo entry beyond the human edit itself');
  assert.deepEqual(after.result?.appliedCalls ?? [], [], 'no tool may be reported applied');
  assert.equal(after.approved, false, 'stale approval must not read as approved');
  assert.ok(after.chatTail.includes('무결성 검사에 막혀 적용하지 않았습니다'), `stale rejection must be visible in chat, got ${after.chatTail.slice(-300)}`);
  assert.ok(after.chatTail.includes('초안을 만든 뒤 프로젝트가 수정되었습니다'), `stale reason must name the cause, got ${after.chatTail.slice(-300)}`);

  assert.deepEqual(routeErrors, []);
  assert.deepEqual(errors, []);
  record('PASS', { assertions: 'real composer send; held review; real DB price 50->9876; stale approval rejected at shared boundary; price survives; title unchanged; no new undo; zero applied; approval false; visible stale-failure chat notice' });
  await writeFile(`${out}/r1-actions.json`, JSON.stringify({ log, errors, routeErrors, blockedWrites }, null, 2));
  await context.close();
  await browser.close();
  browser = null;
} catch (error) {
  process.exitCode = 1;
  record('FAIL', { error: error?.stack ?? String(error) });
  try {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: `${out}/r1-failure.png` });
      await writeFile(`${out}/r1-actions.json`, JSON.stringify({ log, errors, routeErrors, blockedWrites }, null, 2));
    }
  } catch {}
  try { if (context) await context.close(); } catch {}
  try { if (browser) await browser.close(); } catch {}
} finally {
  try {
    if (server) {
      server.kill('SIGKILL');
      await writeFile(`${out}/r1-server.log`, serverLog.slice(-20000));
    }
  } catch {}
}
