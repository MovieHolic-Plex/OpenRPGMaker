// Owned backend-surface exercise, not family UI E2E or a visual/image inspection.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { PROJECT_ID, hash } from './qa-wire.mjs';
const origin = process.env.TASK8_ORIGIN, runId = process.env.TASK8_RUN_ID;
assert.ok(origin && runId, 'Run under TASK8_QA=1 run-owned.py');
const control = async (path, body = {}) => {
  const response = await fetch(`${origin}/__task8/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Task8-Run-Id': runId }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
};
const sessionResponse = await fetch(`${origin}/api/ai-jobs/session`), cookie = sessionResponse.headers.get('set-cookie').split(';')[0];
const session = await sessionResponse.json();
assert.equal(session.generationAvailable, true); assert.equal(session.reportAvailable, true);
const postJob = async (path, body, extra = {}) => {
  const response = await fetch(`${origin}/api/ai-jobs${path}`, { method: 'POST', headers: { Origin: origin, Cookie: cookie,
    'X-AI-Jobs-CSRF': session.csrfToken, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
};
const browser = await chromium.launch({ headless: true, handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false });
const external = [], pageErrors = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
    // Only static GET transport is forwarded by Node; all writes hit the fixture's real HTTP guard.
    if (request.method() === 'GET' && !/^\/(api|supabase|auth|v1)(\/|$)/.test(url.pathname)) {
      if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 }); return route.fulfill({ response });
    }
    return route.continue();
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage(); page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${origin}/task8-bootstrap.html`);
  const serialized = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/project/defaults.ts');
    const { serialize } = await import('/src/project/io.ts');
    return serialize(createBlankProject());
  });
  await control('persistence/init', { projectId: PROJECT_ID, serialized, sha256: hash(serialized) });
  const loaded = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    await store.load();
    return { project: JSON.parse(JSON.stringify(store.getCurrent())), identity: store.getLoadedProjectIdentity() };
  });
  assert.deepEqual(loaded.identity, { backend: session.configuredBackend, projectId: PROJECT_ID });
  const response = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ name: 'Task8 Controlled Potion', price: 37 }) } }] };
  await control('plan', { id: 'real-database', match: { family: 'database', projectId: PROJECT_ID, payload: { brief: 'Disposable controlled potion' } },
    operations: [{ key: 'database/text', kind: 'text', provider: 'google-antigravity', hold: true, response }] });
  const registered = control('wait', { type: 'waiter-registered', planId: 'real-database', waitType: 'operation-reached' });
  const reached = control('wait', { type: 'operation-reached', planId: 'real-database', index: 0 });
  await registered; // Exact subscription acknowledgement before the actual admission action.
  const { job } = await postJob('', { input: { version: 1, family: 'database', project: loaded.identity, target: {}, mode: 'review', dependsOn: [],
    payload: { kind: 'item', brief: 'Disposable controlled potion', withArtwork: false, config: { authMode: 'chatgpt', providerId: 'google-antigravity', agentMode: 'chat', model: 'gemini-3.7-flash', liteModel: 'gemini-3.7-flash', maxToolCalls: 8, maxTokens: 4096 } } },
    projectSnapshot: loaded.project, artwork: [] }, { 'Idempotency-Key': 'real-database' });
  assert.equal((await reached).jobId, job.id);
  const generated = control('wait', { type: 'job-event', jobId: job.id, generation: 'succeeded' });
  const reportReady = control('wait', { type: 'job-event', jobId: job.id, report: 'ready' });
  await control('release', { planId: 'real-database', index: 0 }); await generated; await reportReady;
  let counts = await control('counts');
  assert.equal(counts.jobCount, 1); assert.equal(counts.controlledCalls, 1); assert.equal(counts.operationCount, 1);
  assert.equal(counts.operations[0].status, 'succeeded'); assert.deepEqual(counts.violations, []);
  assert.equal(counts.jobs[0].application, 'awaiting-review');
  // Stable publication failure switch is not consumed by incidental autosave/commit logging.
  await control('persistence/configure', { failWrites: 0, blockWrites: true });
  const applied = await page.evaluate(async id => {
    const { applyJobResult } = await import('/src/editor/aiJobs/applyJobResult.ts');
    return applyJobResult(id, { review: { approved: true } });
  }, job.id);
  assert.equal(applied.application, 'applied', JSON.stringify(applied)); assert.equal(applied.evidencePending, undefined, JSON.stringify(applied));
  const failedSave = await page.evaluate(async id => (await import('/src/editor/aiJobs/applyJobResult.ts')).retryJobSave(id), job.id);
  // Production retryJobSave leaves a thrown HTTP publication error as unknown,
  // not failed. Preserve that contract; the wire proves the canonical row was untouched.
  assert.equal(failedSave.save, 'unknown', JSON.stringify(failedSave));
  const failedEvidence = (await control('counts')).jobs[0].saveEvidence.updates.at(-1);
  assert.equal(failedEvidence.save, 'unknown');
  assert.equal(JSON.parse(failedEvidence.evidence.reason).code, 'PROVIDER_NOT_DISPATCHED');
  const beforeSuccess = await control('persistence/snapshot');
  assert.ok(beforeSuccess.rejectedWrites >= 1);
  assert.equal(beforeSuccess.tables.projects[0].current_json.database.items.some(item => item.name === 'Task8 Controlled Potion'), false);
  await control('persistence/configure', { failWrites: 0, blockWrites: false });
  const after = (await control('counts')).events.at(-1).seq;
  const savedReportArmed = control('wait', { type: 'waiter-registered', waitType: 'job-event', after });
  const savedReport = control('wait', { type: 'job-event', jobId: job.id, save: 'saved', report: 'ready', after });
  await savedReportArmed;
  const saved = await page.evaluate(async id => (await import('/src/editor/aiJobs/applyJobResult.ts')).retryJobSave(id), job.id);
  assert.equal(saved.save, 'saved', JSON.stringify(saved)); assert.equal(saved.receiptId, applied.receiptId);
  await savedReport; // Do not turn a pending report refresh into a shutdown interruption.
  const readback = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { loadProjectFromSupabase } = await import('/src/project/supabaseProjectSync.ts');
    const project = await loadProjectFromSupabase(store.getLoadedConnection());
    return { item: project.database.items.find(item => item.name === 'Task8 Controlled Potion'), mapIds: Object.keys(project.maps) };
  });
  assert.equal(readback.item.price, 37);
  // Exercise normal map patch/CAS + independent maps row save/load through the same production functions.
  const mapProof = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { loadProjectFromSupabase, saveProjectMapPatchToSupabase } = await import('/src/project/supabaseProjectSync.ts');
    const config = store.getLoadedConnection(), base = await loadProjectFromSupabase(config), changed = structuredClone(base);
    const id = changed.startMapId; changed.maps[id].name = 'Task8 Canonical Map Readback';
    const saved = await saveProjectMapPatchToSupabase({ baseProject: base, project: changed, changedMapIds: [id] }, config);
    const reloaded = await loadProjectFromSupabase(config);
    return { kind: saved.kind, id, name: reloaded.maps[id].name };
  });
  assert.equal(mapProof.kind, 'saved'); assert.equal(mapProof.name, 'Task8 Canonical Map Readback');
  counts = await control('counts');
  assert.equal(counts.jobCount, 1); assert.equal(counts.controlledCalls, 1); assert.equal(counts.operationCount, 1);
  assert.equal(counts.jobs[0].application, 'applied'); assert.equal(counts.jobs[0].save, 'saved');
  assert.deepEqual(counts.violations, []); assert.deepEqual(counts.errors, []);
  // A real legacy HTTP request is denied by Node, not intercepted by this browser context.
  for (const path of ['/v1/chat/completions', '/v1/images/generations', '/api/ai/chat/completions', '/api/qwen/chat/completions', '/api/cpen/chat/completions']) {
    const blocked = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(blocked.status, 451);
  }
  const foreign = await fetch(`${origin}/supabase/rest/v1/projects?project_id=eq.not-the-qa-project`); assert.equal(foreign.status, 409);
  const noAuth = await fetch(`${origin}/__task8/counts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(noAuth.status, 403);
  counts = await control('counts');
  assert.equal(counts.violations.length, 6); assert.equal(counts.controlledCalls, 1);
  assert.deepEqual(external, []); assert.deepEqual(pageErrors, []);
  await writeFile('.omo/evidence/ai-job-queue/task-8/qa-wire-real-http-proof.json', JSON.stringify({ runId, origin, jobId: job.id,
    applied, failedSave, saved, readback, mapProof, expectedNegativeViolations: counts.violations,
    controlledCalls: counts.controlledCalls, jobCount: counts.jobCount, operationCount: counts.operationCount,
    externalBrowserOrigins: external, pageErrors, persistenceReads: counts.persistence.reads, persistenceWrites: counts.persistence.writes }, null, 2));
  console.log('TASK8_REAL_HTTP_GREEN', JSON.stringify({ jobId: job.id, controlledCalls: 1, jobCount: 1, operationCount: 1, saved: saved.save }));
} finally { await browser.close(); }
