import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTask8Runtime, createQaWire, createQaPersistence, PROJECT_ID, hash } from './qa-wire.mjs';
import { httpFixture, submission, resultFor, waitFor } from '../../../../test/aiJobsTestSupport.mjs';
import { familyPlans } from './plan-examples.mjs';

test('runtime assembly cannot select the forbidden default provider, even for unknown Node operations', async () => {
  let forbiddenCalls = 0;
  const forbidden = async () => { forbiddenCalls++; throw new Error('FORBIDDEN_LIVE_SENTINEL'); };
  const controlled = async () => { throw Object.assign(new Error('Unplanned operation'), { code: 'PROVIDER_NOT_DISPATCHED' }); };
  const runtime = await createTask8Runtime({ dispatchProvider: controlled }, { dispatchProvider: forbidden },
    async ({ dispatchProvider = forbidden }) => ({ dispatchProvider }));
  await assert.rejects(runtime.dispatchProvider({}, { key: 'unknown' }), { code: 'PROVIDER_NOT_DISPATCHED' });
  await assert.rejects(createTask8Runtime({}, {}, forbidden), { code: 'PROVIDER_NOT_DISPATCHED' });
  assert.equal(forbiddenCalls, 0);
});

test('machine plan examples cover six families and all seven tileset operation variants with exact pins', () => {
  const wire = createQaWire({ getService: () => null });
  const plans = familyPlans({ tilesetId: 'qa-tileset', tileIds: [4, 5], imageResponse: { image: { dataUrl: 'data:image/png;base64,AP8=' } } });
  for (const plan of plans) wire.plan(plan);
  assert.equal(plans.length, 12); assert.equal(new Set(plans.map(p => p.match.family)).size, 6);
  assert.deepEqual(plans.filter(p => p.match.family === 'tileset').map(p => p.match.operation),
    ['cluster-edit', 'range-classify', 'unclassified-analysis', 'knowledge-analysis', 'proposal-draft', 'question-followup', 'structure-kit-metadata']);
  assert.equal(plans.reduce((n, p) => n + p.operations.length, 0), 23);
  assert.equal(wire.counts().plans.length, 12); wire.close();
});

const response = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'exact controlled bytes' } }] };
const operation = (key, extra = {}) => ({ key, kind: 'text', provider: 'google-antigravity', response, ...extra });
const plan = (id, operations) => ({ id, match: { family: 'assistant', projectId: PROJECT_ID }, operations });
const submitted = () => { const body = submission(); body.input.project.projectId = PROJECT_ID; return body; };
async function infrastructure(t, execute) {
  let f;
  const wire = createQaWire({ getService: () => f, waitTimeout: 5000 });
  f = await httpFixture(t, { dispatchProvider: wire.dispatchProvider,
    executeJob: (input, host) => execute(input, { ...host, providerOperation: op => wire.providerOperation(host, op) }) });
  return { f, wire };
}
const call = (host, key) => host.providerOperation({ key, request: { kind: 'text', provider: 'google-antigravity', body: { model: 'controlled' } } });

test('real HTTP ledger: registered reached signal, held release, exact response, exhausted plan fails closed', { timeout: 15000 }, async t => {
  const { f, wire } = await infrastructure(t, async (input, host) => resultFor(input, host, await call(host, 'assistant/provider/0')));
  try {
    wire.plan(plan('held', [operation('assistant/provider/0', { hold: true })]));
    assert.throws(() => wire.release({ planId: 'held', index: 0 }), /not held/);
    const reached = wire.wait({ type: 'operation-reached', planId: 'held', index: 0 });
    const { job } = await (await f.post('', submitted(), { 'Idempotency-Key': 'held' })).json();
    assert.equal((await reached).jobId, job.id);
    assert.deepEqual(wire.counts().held, ['held:0']);
    assert.equal(wire.counts().events[1].type, 'waiter-registered');
    const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
    wire.release({ planId: 'held', index: 0 }); await done;
    const detail = await (await f.request(`/${job.id}`)).json();
    assert.deepEqual(await f.repository.readJson(detail.operations[0].responseRef), response);
    assert.equal(detail.operations[0].status, 'succeeded');
    assert.equal(wire.counts().controlledCalls, 1);
    const failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
    const second = await (await f.post('', submitted(), { 'Idempotency-Key': 'unplanned' })).json(); await failed;
    assert.equal(f.scheduler.getJob(second.job.id).generation, 'failed');
    assert.equal(wire.counts().violations[0].kind, 'unplanned-job');
    assert.equal(wire.counts().controlledCalls, 1);
    assert.equal(wire.counts().operationCount, 2);
    assert.equal(f.repository.snapshot().operations[1].status, 'failed');
  } finally { wire.close(); }
});

test('cancel + real HTTP retry reuses a completed late controlled response without redispatch', { timeout: 15000 }, async t => {
  const { f, wire } = await infrastructure(t, async (input, host) => resultFor(input, host, await call(host, 'assistant/provider/0')));
  try {
    wire.plan(plan('cancel', [operation('assistant/provider/0', { hold: true, cancel: 'late-response' })]));
    const reached = wire.wait({ type: 'operation-reached', planId: 'cancel', index: 0 });
    const { job } = await (await f.post('', submitted(), { 'Idempotency-Key': 'cancel' })).json(); await reached;
    assert.equal((await f.post(`/${job.id}/cancel`, {})).status, 200);
    const blocked = await f.post(`/${job.id}/retry`, { stage: 'generation' });
    assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'DUPLICATE_SPEND_ACK_REQUIRED');
    f.errors.splice(0).forEach(error => assert.equal(error.code, 'DUPLICATE_SPEND_ACK_REQUIRED'));
    assert.equal((await f.post(`/${job.id}/retry`, { stage: 'generation', acknowledgeDuplicateSpend: true })).status, 202);
    const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
    wire.release({ planId: 'cancel', index: 0 }); await done;
    assert.equal(wire.counts().controlledCalls, 1); assert.equal(wire.counts().operationCount, 1);
    assert.equal(wire.counts().attempts.length, 2);
    assert.equal(wire.counts().logicalRequests, 2); assert.equal(wire.counts().reusedResponses, 1);
    assert.deepEqual(await f.repository.readJson(wire.counts().operations[0].responseRef), response);
    assert.equal(wire.counts().plans[0].remaining, 0);
  } finally { wire.close(); }
});

test('controlled failure retries and wrong Node key never consumes a configured response', { timeout: 15000 }, async t => {
  const { f, wire } = await infrastructure(t, async (input, host) => resultFor(input, host, await call(host, 'assistant/provider/0')));
  try {
    const first = operation('assistant/provider/0'); delete first.response; first.failure = 'not-dispatched';
    wire.plan(plan('retry', [first, operation('assistant/provider/0')]));
    const failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
    const { job } = await (await f.post('', submitted(), { 'Idempotency-Key': 'retry' })).json(); await failed;
    const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
    assert.equal((await f.post(`/${job.id}/retry`, { stage: 'generation' })).status, 202); await done;
    assert.deepEqual(wire.counts().operations.map(o => o.status), ['failed', 'succeeded']);
    wire.plan(plan('wrong', [operation('assistant/provider/999')]));
    const unexpected = waitFor(f.scheduler, e => e.states.generation === 'failed');
    await f.post('', submitted(), { 'Idempotency-Key': 'wrong' }); await unexpected;
    assert.equal(wire.counts().violations[0].kind, 'unexpected-operation');
    assert.equal(wire.counts().controlledCalls, 2);
    assert.equal(wire.counts().plans[1].remaining, 1);
  } finally { wire.close(); }
});

test('opaque image response is byte-exact and abort-mode cancellation releases the scheduler', { timeout: 15000 }, async t => {
  const opaque = Buffer.from([0, 255, 1, 2, 128]); // Transport specimen, deliberately not decoded or presented as an image.
  const imageResponse = { image: { dataUrl: `data:image/png;base64,${opaque.toString('base64')}`, mimeType: 'image/png', model: 'controlled', provider: 'google-antigravity' } };
  const { f, wire } = await infrastructure(t, async (input, host) => resultFor(input, host,
    await host.providerOperation({ key: 'image/provider/generate', request: { kind: 'image', provider: 'google-antigravity', body: {} } })));
  try {
    const op = { key: 'image/provider/generate', kind: 'image', provider: 'google-antigravity', response: imageResponse };
    wire.plan(plan('opaque', [op]));
    const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
    await f.post('', submitted(), { 'Idempotency-Key': 'opaque' }); await done;
    const retained = await f.repository.readJson(wire.counts().operations[0].responseRef);
    assert.deepEqual(retained, imageResponse);
    assert.deepEqual(Buffer.from(retained.image.dataUrl.split(',')[1], 'base64'), opaque);
    wire.plan(plan('abort', [{ ...op, hold: true, cancel: 'abort' }]));
    const reached = wire.wait({ type: 'operation-reached', planId: 'abort', index: 0 });
    const { job } = await (await f.post('', submitted(), { 'Idempotency-Key': 'abort' })).json(); await reached;
    const aborted = wire.wait({ type: 'operation-failed', planId: 'abort', index: 0 });
    await f.post(`/${job.id}/cancel`, {}); await aborted;
    await f.scheduler.close();
    assert.equal(f.scheduler.getJob(job.id).generation, 'cancelled');
    assert.equal(wire.counts().operations[1].status, 'failed'); assert.deepEqual(wire.counts().held, []);
  } finally { wire.close(); }
});

test('control validates pins and unknown selectors; closing resolves exact-event waiters', async () => {
  const wire = createQaWire({ getService: () => null });
  assert.throws(() => wire.plan({ ...plan('pin', [operation('x', { responseSha256: 'a'.repeat(64) })]) }), { status: 400 });
  assert.throws(() => wire.plan({ ...plan('typo', [operation('x')]), match: { family: 'assistant', projectId: PROJECT_ID, target: {} } }), { status: 400 });
  const waiting = assert.rejects(wire.wait({ type: 'operation-reached', planId: 'never' }), { status: 503 });
  assert.equal(wire.counts().waiters, 1); wire.close(); await waiting; assert.equal(wire.counts().waiters, 0);
});

test('canonical persistence is uninitialized/foreign fail-closed and isolates project CAS from map-row overlay', () => {
  const wire = createQaWire({ getService: () => null }), persistence = createQaPersistence(wire);
  const url = (table, query = `project_id=eq.${PROJECT_ID}`) => new URL(`http://127.0.0.1/supabase/rest/v1/${table}?${query}`);
  assert.throws(() => persistence.request('GET', url('projects'), {}), /blocked/);
  const project = { version: 4, meta: { title: 'Disposable' }, maps: { m: { id: 'm', name: 'base' } }, tilesets: {} }, serialized = JSON.stringify(project);
  persistence.initialize({ projectId: PROJECT_ID, serialized, sha256: hash(serialized) });
  assert.throws(() => persistence.request('GET', url('projects', 'project_id=eq.foreign'), {}), /blocked/);
  persistence.configure({ failWrites: 1 });
  const changed = { project_id: PROJECT_ID, current_json: { ...project, meta: { title: 'saved' } }, current_sha256: 'new' };
  assert.throws(() => persistence.request('PATCH', url('projects', `project_id=eq.${PROJECT_ID}&current_sha256=eq.${hash(serialized)}`), changed), /publication failure/);
  assert.equal(persistence.request('GET', url('projects'), {})[0].current_sha256, hash(serialized));
  assert.deepEqual(persistence.request('PATCH', url('projects', `project_id=eq.${PROJECT_ID}&current_sha256=eq.wrong`), changed), []);
  assert.equal(persistence.request('PATCH', url('projects', `project_id=eq.${PROJECT_ID}&current_sha256=eq.${hash(serialized)}`), changed).length, 1);
  persistence.request('POST', url('maps', 'on_conflict=project_id,map_id'), [{ project_id: PROJECT_ID, map_id: 'm', map_json: { id: 'm', name: 'overlay' } }]);
  assert.equal(persistence.request('GET', url('maps'), {})[0].map_json.name, 'overlay');
  assert.equal(persistence.request('GET', url('projects'), {})[0].current_json.maps.m.name, 'base');
  assert.equal(persistence.snapshot().rejectedWrites, 1);
  wire.close();
});
