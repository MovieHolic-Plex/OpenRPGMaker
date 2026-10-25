// Multi-turn whole-game session driver for the editor assistant.
//
// Why: genre-run allows one original prompt plus at most two repairs per case. Building a whole game
// takes many follow-up requests, the way a non-expert user would type them. This driver keeps ONE
// owned project host and ONE editor page alive, and feeds the real `ai-input` box one request at a
// time from an inbox folder. The operator (outer agent) only types requests or clicks the assistant's
// own question cards. It never calls editor tools or edits content.
//
// Usage:
//   node src/harnesses/assistant-capability/node/wholeGameSession.mjs --project-dir <dir> --out <session dir> [--v2] [--turn-timeout-ms N] [--store-url <store> [--store-auto-install]]
// Control files (written by the operator into <out>/inbox/, processed in name order):
//   NNN.txt    -> a natural-language request typed into ai-input and sent
//   NNN.click  -> one data-testid (first line) of a visible assistant card button to click
//   NNN.reload -> save, close the browser context, reopen a fresh context and record persistence
//   NNN.stop   -> save, reload-check, write live.json and exit
// Output per step: <out>/turns/NNN.json (+ NNN.png), <out>/state.json, <out>/transcript.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, appendFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { firefox } from 'playwright';
import { stored, writeRuntimeProject, newEditor, startHost } from './editorDriver.mjs';
import { readOAuthClientsFromPiAi } from '../../../../scripts/lib/oauthClients.mjs';
import { installStoreBridge } from './storeBridgeShim.mjs';

// Same environment repair as genre-run: the host bundle in /tmp cannot locate pi-ai itself.
{
  const clients = readOAuthClientsFromPiAi();
  for (const [key, value] of [['OPRN_ANTIGRAVITY_CLIENT_ID', clients.antigravityClientId],
    ['OPRN_ANTIGRAVITY_CLIENT_SECRET', clients.antigravityClientSecret], ['OPRN_CODEX_CLIENT_ID', clients.codexClientId]]) {
    if (value && !process.env[key]) process.env[key] = value;
  }
}

const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const projectDir = resolve(option('project-dir') ?? '');
const out = resolve(option('out') ?? '');
if (!option('project-dir') || !option('out')) throw Error('wholeGameSession --project-dir <dir> --out <session dir> [--v2]');
const useV2 = argv.includes('--v2');
// --store-url <스토어>: 브라우저 편집기에 읽기 전용 스토어 다리를 붙인다(storeBridgeShim.mjs). --store-auto-install: 「묻지 않고 넣기」를 켠 사용자.
const storeUrl = option('store-url');
const storeAutoInstall = argv.includes('--store-auto-install');
const turnTimeoutMs = Number(option('turn-timeout-ms') ?? 45 * 60_000);
const sleep = ms => new Promise(done => setTimeout(done, ms));
const json = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2));
for (const sub of ['inbox', 'done', 'turns']) mkdirSync(resolve(out, sub), { recursive: true });
const transcript = resolve(out, 'transcript.md');
if (!existsSync(transcript)) writeFileSync(transcript, `# Whole-game session transcript\n\nproject: ${projectDir}\nassistant: ${useV2 ? 'v2 (localStorage oprn:assistant-v2=1)' : 'v1 (product default)'}\n\n`);
const log = text => appendFileSync(transcript, text + '\n');

// Cards that need a user answer. Their text is dumped so the operator can decide like a user.
// Only these hold the turn. Object-generation / store cards stay on screen without blocking, so they are
// reported (INFO_SELECTOR) but never treated as awaiting an answer.
const CARD_SELECTOR = ['ai-decision-prompt', 'ai-tileset-change-card', 'ai-creation-choice', 'ai-pending-review', 'ai-store-music-card']
  .map(id => `[data-testid="${id}"]`).join(',');
const INFO_SELECTOR = ['ai-objectgen-card', 'ai-store-missing-card'].map(id => `[data-testid="${id}"]`).join(',');

let state = { phase: 'startup', startedAt: new Date().toISOString(), turns: 0 };
const writeState = extra => { state = { ...state, ...extra, updatedAt: new Date().toISOString() }; json(resolve(out, 'state.json'), state); };
writeState({});

const host = await startHost(projectDir, dirname(projectDir));
const browser = await firefox.launch({ firefoxUserPrefs: { 'network.notify.changed': false, 'network.notify.IPv6': false,
  'network.captive-portal-service.enabled': false, 'network.connectivity-service.enabled': false } });
const requests = [], pageErrors = [];
let editor, page;
async function open() {
  editor = await newEditor(browser, host.url, projectDir, {}, { async onPage(p) {
    p.on('pageerror', error => pageErrors.push({ at: new Date().toISOString(), message: error.message.slice(0, 500) }));
    if (storeUrl) await installStoreBridge(p, storeUrl, { autoInstall: storeAutoInstall });
    await p.addInitScript(v2 => {
      localStorage.setItem('oprn:editor-welcome-dismissed', '1');
      localStorage.setItem('oprn:assistant-v2', v2 ? '1' : '0');
    }, useV2);
    p.on('request', request => {
      if (request.method() !== 'POST' || !/\/v1\/(agent\/run|chat\/completions)/.test(request.url())) return;
      try {
        const raw = request.postDataBuffer();
        const body = JSON.parse(raw?.[0] === 31 ? gunzipSync(raw) : raw);
        requests.push({ endpoint: new URL(request.url()).pathname, model: body.model, provider: body.provider ?? request.headers()['x-oprn-provider'],
          assistantVersion: body.assistantVersion, runId: body.runId, at: new Date().toISOString() });
      } catch { requests.push({ endpoint: new URL(request.url()).pathname, observationError: true }); }
    });
  } });
  page = editor.page;
}
async function save() {
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(() => ['idle', 'saved', 'error', 'unsaved-session'].includes(
    document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind), null, { timeout: 180000 });
  return page.getByTestId('toolbar-save').getAttribute('data-autosave-kind');
}
const busy = () => page.evaluate(() => Boolean(window.__oprnAiBridge?.status().turnBusy)).catch(() => true);
async function cards(selector = CARD_SELECTOR) {
  return page.evaluate(selector => [...document.querySelectorAll(selector)].filter(node => node.offsetParent !== null).map(node => ({
    testid: node.dataset.testid, text: node.innerText.slice(0, 1500),
    buttons: [...node.querySelectorAll('button')].filter(b => !b.disabled).map(b => ({ testid: b.dataset.testid ?? null, text: b.innerText.trim().slice(0, 80) })),
  })), selector).catch(() => []);
}
async function waitSettle(mark, startedAt, graceMs = 20000) {
  // A turn is over when the stream closed after the mark and the bridge is idle, or a card waits for an answer.
  for (;;) {
    if (Date.now() - startedAt > turnTimeoutMs) return 'timeout';
    const value = await page.evaluate(m => ({ events: (window.__capEvents ?? []).slice(m), busy: Boolean(window.__oprnAiBridge?.status().turnBusy) }), mark).catch(() => null);
    if (value) {
      const closed = value.events.some(e => ['stream_closed', 'error', 'stream_error'].includes(e.type));
      if (!value.busy && (closed || Date.now() - startedAt > graceMs)) return 'settled';
      if ((await cards()).length && value.busy) {
        // A pending question card holds the turn. Give the operator the decision.
        await sleep(5000);
        if ((await cards()).length && await busy()) return 'awaiting-answer';
      }
      writeState({ phase: 'turn', elapsedMs: Date.now() - startedAt, events: value.events.length,
        lastTool: value.events.filter(e => e.type === 'tool_start').at(-1)?.name ?? null });
    }
    await sleep(3000);
  }
}
async function persistenceCheck(tag) {
  const kind = await save();
  const applied = stored(projectDir);
  await editor.context.close();
  await open();
  const reloaded = stored(projectDir), loaded = editor.loads.find(load => load.sha256 === applied.sha256);
  const receipt = { tag, saveKind: kind, projectId: applied.projectId, revision: applied.revision, afterSha256: applied.sha256,
    reloadedSha256: reloaded.sha256, sameStoredDocument: applied.sha256 === reloaded.sha256, rendererLoadObserved: Boolean(loaded),
    rendererMapsAndDatabaseEqual: Boolean(loaded) && isDeepStrictEqual(applied.project.maps, loaded.maps) && isDeepStrictEqual(applied.project.database, loaded.database),
    maps: Object.values(applied.project.maps).map(m => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, events: (m.events ?? []).length })) };
  json(resolve(out, `persistence-${tag}.json`), receipt);
  return receipt;
}

try {
  await open();
  writeState({ phase: 'baseline' });
  const baseKind = await save();
  const base = stored(projectDir);
  json(resolve(out, 'baseline.json'), { projectId: base.projectId, revision: base.revision, sha256: base.sha256, saveKind: baseKind });
  await page.screenshot({ path: resolve(out, 'baseline.png') });
  writeState({ phase: 'idle', projectId: base.projectId, hostUrl: host.url });
  log(`baseline: projectId ${base.projectId}, revision ${base.revision}\n`);
  for (;;) {
    const next = readdirSync(resolve(out, 'inbox')).filter(n => /\.(txt|click|reload|stop|wait)$/.test(n)).sort()[0];
    if (!next) { await sleep(2000); continue; }
    const step = next.replace(/\.[a-z]+$/, ''), kind = next.split('.').pop();
    const body = readFileSync(resolve(out, 'inbox', next), 'utf8').trim();
    renameSync(resolve(out, 'inbox', next), resolve(out, 'done', next));
    const startedAt = Date.now(), requestMark = requests.length, errorMark = pageErrors.length;
    if (kind === 'stop') {
      const receipt = await persistenceCheck(`final-${step}`);
      await editor.context.close();
      writeRuntimeProject(projectDir, resolve(out, 'live.json'));
      log(`\n## ${step} STOP\nfinal persistence: same=${receipt.sameStoredDocument} rendererEqual=${receipt.rendererMapsAndDatabaseEqual} rev=${receipt.revision}\n`);
      writeState({ phase: 'stopped', final: receipt });
      break;
    }
    if (kind === 'reload') {
      writeState({ phase: 'reload', step });
      const receipt = await persistenceCheck(step);
      log(`\n## ${step} RELOAD\npersistence: same=${receipt.sameStoredDocument} rendererEqual=${receipt.rendererMapsAndDatabaseEqual} rev=${receipt.revision}\n`);
      writeState({ phase: 'idle', lastStep: step });
      continue;
    }
    // .wait: keep observing the previous turn from its own event mark (a turn misread as settled).
    const mark = kind === 'wait' ? (state.lastMark ?? 0) : await page.evaluate(() => (window.__capEvents ?? []).length);
    if (kind === 'wait') {
      log(`\n## ${step} WAIT (continue observing from event ${mark})\n`);
    } else if (kind === 'txt') {
      if (await busy()) await waitSettle(mark, Date.now());
      // --snapshots: the stored project before each typed turn (advisor replay needs before/after; after = next turn's before or live.json).
      if (argv.includes('--snapshots')) { try { mkdirSync(resolve(out, 'snapshots'), { recursive: true }); writeRuntimeProject(projectDir, resolve(out, 'snapshots', `${step}-before.json`)); } catch (error) { log(`snapshot failed: ${error.message}\n`); } }
      await page.getByTestId('ai-input').fill(body);
      await page.getByTestId('ai-send').click();
      log(`\n## ${step} USER (${new Date().toISOString()})\n${body}\n`);
    } else {
      // 가장 최근 카드 안의 첫 단추(앞 카드의 같은 단추는 이미 끝났다; 곡마다 「넣기」가 있는 카드에서는 맨 위 = 1순위 곡).
      const testid = body.split('\n')[0].trim();
      const inCard = page.locator(CARD_SELECTOR).last().locator(`[data-testid="${testid}"]:not([disabled])`);
      const button = (await inCard.count()) ? inCard.first() : page.locator(`[data-testid="${testid}"]:not([disabled])`).last();
      await button.click();
      log(`\n## ${step} USER CLICK (${new Date().toISOString()}) ${body.split('\n')[0]}\n`);
    }
    writeState({ phase: 'turn', step });
    // 카드 단추(예: 스토어 음악 「넣기」)는 받기가 끝난 뒤에야 후속 요청을 보낸다 — 그 턴이 시작될 때까지 더 기다린다.
    const outcome = await waitSettle(mark, startedAt, kind === 'click' ? 5 * 60_000 : 20000);
    if (outcome === 'timeout') {
      await page.evaluate(() => window.__oprnAiBridge?.abort()).catch(() => {});
      await page.waitForFunction(() => !window.__oprnAiBridge?.status().turnBusy, null, { timeout: 60000 }).catch(() => {});
    }
    const events = await page.evaluate(m => (window.__capEvents ?? []).slice(m), mark);
    const pending = [...await cards(), ...await cards(INFO_SELECTOR)];
    let saveKind = null;
    if (outcome !== 'awaiting-answer') saveKind = await save().catch(error => `save-failed: ${error.message.slice(0, 200)}`);
    const snap = stored(projectDir);
    // 편집기는 마지막 보고 하나만 말풍선으로 보인다(aiPiAgentCommand lastAssistantText). 끝맺음 관문 앞의 초안은 따로 남긴다(G32).
    const reports = events.filter(e => e.type === 'assistant').map(e => (e.text ?? '').trim()).filter(Boolean);
    const answer = reports.at(-1) ?? '';
    const draftReports = reports.slice(0, -1);
    const tools = events.filter(e => e.type === 'tool_end' || e.type === 'tool_start').map(e => ({ type: e.type, name: e.name, ok: e.ok, summary: typeof e.summary === 'string' ? e.summary.slice(0, 400) : undefined }));
    const turn = { step, kind, input: body, outcome, elapsedMs: Date.now() - startedAt, saveKind, revision: snap.revision, sha256: snap.sha256,
      requests: requests.slice(requestMark), errors: events.filter(e => ['error', 'stream_error'].includes(e.type)).map(e => e.message),
      pageErrors: pageErrors.slice(errorMark), toolCalls: tools.filter(t => t.type === 'tool_end'), pendingCards: pending, answer, draftReports,
      done: events.filter(e => e.type === 'done').map(e => ({ stats: e.stats, usage: e.usage })),
      statusNotes: events.filter(e => e.type === 'execution_status').map(e => `${e.name}: ${String(e.summary ?? '').slice(0, 300)}`).slice(-40),
      advisor: events.filter(e => e.type === 'execution_status' && String(e.name).startsWith('v2.advisor')).map(e => ({ name: e.name, data: e.data })),
      toolArgs: events.filter(e => e.type === 'tool_start').map(e => ({ name: e.name, args: e.args })),
      maps: Object.values(snap.project.maps).map(m => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, events: (m.events ?? []).length })) };
    json(resolve(out, 'turns', `${step}.json`), turn);
    await page.screenshot({ path: resolve(out, 'turns', `${step}.png`) }).catch(() => {});
    const toolLine = turn.toolCalls.map(t => `${t.name}${t.ok === false ? '(FAIL)' : ''}`).join(', ');
    log(`### ${step} ASSISTANT — ${outcome}, ${(turn.elapsedMs / 60000).toFixed(1)} min, save=${saveKind}, rev ${snap.revision}, model ${[...new Set(turn.requests.map(r => r.model))].join('/') || '-'}\n` +
      `tools (${turn.toolCalls.length}): ${toolLine || '-'}\n` + (turn.errors.length ? `errors: ${turn.errors.join(' | ').slice(0, 800)}\n` : '') +
      (pending.length ? `PENDING CARDS: ${JSON.stringify(pending).slice(0, 1500)}\n` : '') + `\n${answer || '(no assistant text)'}\n`);
    state.turns += 1;
    writeState({ phase: outcome === 'awaiting-answer' ? 'awaiting-answer' : 'idle', lastStep: step, lastOutcome: outcome, lastMark: mark });
  }
} catch (error) {
  writeState({ phase: 'crashed', failure: String(error?.stack ?? error).slice(0, 2000) });
  log(`\nDRIVER CRASH: ${String(error?.message ?? error).slice(0, 1000)}\n`);
  try { writeRuntimeProject(projectDir, resolve(out, 'live-crash.json')); } catch {}
  process.exitCode = 1;
} finally {
  json(resolve(out, 'requests.json'), requests);
  await browser.close().catch(() => {});
  await host.close();
}
