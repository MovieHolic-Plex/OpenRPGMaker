import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile, open as fsOpen } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openAiJobsRepository } from '../scripts/lib/aiJobs/repository.mjs';
import { createAiJobsScheduler } from '../scripts/lib/aiJobs/scheduler.mjs';
import { deferred, fixture, inputFor, resultFor, waitFor } from './aiJobsTestSupport.mjs';

test('cancel is durable before returning, including queued work', { timeout: 5000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-jobs-scheduler-'));
  const repository = await openAiJobsRepository({ directory });
  t.after(async () => { await repository.close(); await rm(directory, { recursive: true, force: true }); });
  const input = { version: 1, family: 'assistant', project: { backend: 'local', projectId: 'fixture-A' },
    projectSnapshot: await repository.putJson({ maps: [] }), artwork: [], target: {}, mode: 'review', payload: {}, dependsOn: [] };
  const { job } = await repository.admit({ idempotencyKey: 'cancel', input });
  const scheduler = createAiJobsScheduler({ repository });
  await scheduler.cancel(job.id);
  assert.equal(repository.snapshot().jobs[0].generation, 'cancelled');
});

test('generation host exposes durable checkpoint save/load, not only orphan blob writes', { timeout: 10000 }, async t => {
  let capabilities;
  const f = await fixture(t, { async executeJob(input, host) {
    capabilities = [typeof host.saveCheckpoint, typeof host.loadCheckpoint];
    return resultFor(input, host);
  } });
  const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
  await f.scheduler.admit({ idempotencyKey: 'checkpoint-host', input: await inputFor(f.repository) }); await done;
  assert.deepEqual(capabilities, ['function', 'function']);
});

test('checkpoint draft, generated IDs, tool results and artifacts survive restart and fence stale writers', { timeout: 10000 }, async t => {
  let allocations = 0, oldHost;
  const f = await fixture(t, { async executeJob(input, host) {
    oldHost = host; allocations++;
    const artifact = await host.putBlob(Buffer.from('private-draft-art'), 'image/png');
    const ref = await host.saveCheckpoint({ stageKey: 'tools/1', state: { generatedId: `allocated-${allocations}`, draft: { maps: [{ id: 'map-new' }] }, toolResults: [{ ok: true }], nextStep: 2 }, artifacts: [artifact] });
    const disk = JSON.parse(await readFile(join(f.directory, 'metadata.json'), 'utf8')).snapshot;
    assert.deepEqual(disk.jobs[0].checkpointRef, ref);
    throw new Error('worker interrupted after deterministic stage');
  } });
  const failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
  const { job } = await f.scheduler.admit({ idempotencyKey: 'checkpoint-restart', input: await inputFor(f.repository) }); await failed;
  const checkpointRef = f.scheduler.getJob(job.id).checkpointRef;
  await assert.rejects(oldHost.saveCheckpoint({ stageKey: 'late', state: {}, artifacts: [] }), { code: 'STALE_ATTEMPT' });
  assert.deepEqual(f.scheduler.getJob(job.id).checkpointRef, checkpointRef);
  await f.scheduler.close(); await f.repository.close();
  const repository = await openAiJobsRepository({ directory: f.directory });
  const scheduler = createAiJobsScheduler({ repository, async executeJob(input, host) {
    const checkpoint = await host.loadCheckpoint();
    assert.equal(checkpoint.state.generatedId, 'allocated-1'); assert.equal(checkpoint.state.nextStep, 2);
    assert.equal(Buffer.from(await host.readBlob(checkpoint.artifacts[0])).toString(), 'private-draft-art');
    return resultFor(input, host, checkpoint.state);
  } });
  try {
    const done = waitFor(scheduler, e => e.states.generation === 'succeeded');
    await scheduler.retry(job.id, { stage: 'generation' }); await done;
    assert.equal(allocations, 1);
    assert.equal((await repository.readJson(scheduler.getJob(job.id).resultRef)).payload.generatedId, 'allocated-1');
  } finally { await scheduler.close(); await repository.close(); }
});

test('one generation and one physical provider request; dispatch and response are durable at both boundaries', { timeout: 10000 }, async t => {
  const first = deferred(), firstDispatch = deferred(), secondDispatch = deferred(), releaseExecutor = deferred();
  t.after(() => { first.resolve({ text: 'first' }); releaseExecutor.resolve(); });
  let count = 0, executing = 0, maxExecuting = 0;
  const f = await fixture(t, {
    async dispatchProvider(request, context) {
      count++;
      const disk = JSON.parse(await readFile(join(f.directory, 'metadata.json'), 'utf8')).snapshot;
      assert.equal(disk.operations.find(o => o.id === context.operationId).status, 'dispatched');
      if (count === 1) { firstDispatch.resolve(); return first.promise; }
      secondDispatch.resolve(); return { text: request.step };
    },
    async executeJob(input, host) {
      executing++; maxExecuting = Math.max(maxExecuting, executing);
      const responses = await Promise.all(['first', 'second'].map(step => host.providerOperation({ key: step, request: { step } })));
      const disk = JSON.parse(await readFile(join(f.directory, 'metadata.json'), 'utf8')).snapshot;
      assert.ok(disk.operations.filter(o => o.jobId === host.jobId).every(o => o.status === 'succeeded' && o.responseRef));
      await releaseExecutor.promise;
      executing--; return resultFor(input, host, { responses });
    },
  });
  const input = await inputFor(f.repository);
  const one = await f.scheduler.admit({ idempotencyKey: 'one', input });
  await firstDispatch.promise;
  const two = await f.scheduler.admit({ idempotencyKey: 'two', input });
  assert.equal(count, 1); assert.equal(f.scheduler.getJob(two.job.id).generation, 'queued');
  const completed = waitFor(f.scheduler, e => e.jobId === two.job.id && e.states.generation === 'succeeded');
  first.resolve({ text: 'first' }); await secondDispatch.promise;
  assert.equal(count, 2); releaseExecutor.resolve(); await completed;
  assert.equal(count, 4); assert.equal(maxExecuting, 1);
  assert.equal(f.scheduler.getJob(one.job.id).generation, 'succeeded');
  assert.equal(f.scheduler.getJob(one.job.id).report, 'pending');
});

test('cancel persists before abort; retry waits for old physical request and reuses its late durable response without resurrection', { timeout: 10000 }, async t => {
  const response = deferred(), dispatched = deferred(), aborted = deferred();
  t.after(() => response.resolve({ text: 'late paid output' }));
  let count = 0, starts = 0;
  const f = await fixture(t, {
    async dispatchProvider(_request, { signal, jobId }) {
      count++;
      signal.addEventListener('abort', () => { assert.equal(f.scheduler.getJob(jobId).generation, 'cancelled'); aborted.resolve(); }, { once: true });
      dispatched.resolve(); return response.promise;
    },
    async executeJob(input, host) { starts++; const value = await host.providerOperation({ key: 'completion/0', request: { model: 'fixture' } }); return resultFor(input, host, value); },
  });
  const { job } = await f.scheduler.admit({ idempotencyKey: 'cancel-late', input: await inputFor(f.repository) });
  await dispatched.promise;
  const oldAttempt = f.scheduler.getJob(job.id).activeAttemptId;
  await f.scheduler.cancel(job.id); await aborted.promise;
  await assert.rejects(f.scheduler.retry(job.id, { stage: 'generation' }), { code: 'DUPLICATE_SPEND_ACK_REQUIRED' });
  await f.scheduler.retry(job.id, { stage: 'generation', acknowledgeDuplicateSpend: true });
  assert.equal(starts, 1); assert.equal(count, 1);
  assert.equal(f.scheduler.getJob(job.id).generation, 'queued');
  const done = waitFor(f.scheduler, e => e.jobId === job.id && e.states.generation === 'succeeded');
  response.resolve({ text: 'late paid output' }); await done;
  const state = f.repository.snapshot();
  assert.equal(starts, 2); assert.equal(count, 1);
  assert.equal(state.attempts.find(a => a.id === oldAttempt).status, 'cancelled');
  assert.equal(state.operations[0].status, 'succeeded');
  const result = await f.repository.readJson(state.jobs[0].resultRef);
  assert.notEqual(result.attemptId, oldAttempt);
  assert.deepEqual(result.payload, { text: 'late paid output' });
});

test('unknown dispatch never automatically replays; explicit acknowledged retry is durable before second dispatch', { timeout: 10000 }, async t => {
  let count = 0;
  const f = await fixture(t, {
    async dispatchProvider() {
      count++;
      if (count === 1) throw new Error('connection lost after dispatch');
      assert.equal(f.repository.snapshot().operations[0].error, 'duplicate-spend-acknowledged');
      return { text: 'second' };
    },
    async executeJob(input, host) { return resultFor(input, host, await host.providerOperation({ key: 'text', request: {} })); },
  });
  const failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
  const { job } = await f.scheduler.admit({ idempotencyKey: 'unknown', input: await inputFor(f.repository) });
  await failed;
  assert.equal(count, 1);
  assert.equal(f.repository.snapshot().operations[0].status, 'outcome-unknown');
  await assert.rejects(f.scheduler.retry(job.id, { stage: 'generation' }), { code: 'DUPLICATE_SPEND_ACK_REQUIRED' });
  const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
  await f.scheduler.retry(job.id, { stage: 'generation', acknowledgeDuplicateSpend: true }); await done;
  assert.equal(count, 2);
});

test('restart retains paid response and interrupts worker; queued resumes, interrupted requires explicit safe retry', { timeout: 10000 }, async t => {
  const responseDelivered = deferred(); let count = 0;
  const f = await fixture(t, {
    async dispatchProvider() { count++; return { text: 'durable' }; },
    async executeJob(input, host, signal) {
      await host.providerOperation({ key: 'text', request: {} });
      const cancelled = new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      responseDelivered.resolve(); await cancelled;
      return resultFor(input, host);
    },
  });
  const input = await inputFor(f.repository);
  const { job } = await f.scheduler.admit({ idempotencyKey: 'restart', input });
  await responseDelivered.promise;
  const queued = await f.repository.admit({ idempotencyKey: 'queued', input });
  await f.scheduler.close(); await f.repository.close();
  const repository = await openAiJobsRepository({ directory: f.directory });
  const scheduler = createAiJobsScheduler({ repository,
    dispatchProvider: async () => { count++; return { text: 'new queued response' }; },
    executeJob: async (nextInput, host) => resultFor(nextInput, host, await host.providerOperation({ key: 'text', request: {} })),
  });
  t.after(async () => { await scheduler.close(); await repository.close(); });
  assert.equal(scheduler.getJob(job.id).generation, 'interrupted');
  const queuedDone = waitFor(scheduler, e => e.jobId === queued.job.id && e.states.generation === 'succeeded');
  scheduler.start(); await queuedDone;
  assert.equal(count, 2); assert.equal(scheduler.getJob(job.id).generation, 'interrupted');
  const retried = waitFor(scheduler, e => e.jobId === job.id && e.states.generation === 'succeeded');
  await scheduler.retry(job.id, { stage: 'generation' }); await retried;
  assert.equal(count, 2);
  assert.deepEqual((await repository.readJson(scheduler.getJob(job.id).resultRef)).payload, { text: 'durable' });
  await scheduler.close(); await repository.close();
});

test('provider key mismatch fails without redispatch; known-not-dispatched failures permit safe retry', { timeout: 10000 }, async t => {
  let calls = 0, attempt = 0;
  const f = await fixture(t, {
    async dispatchProvider() { calls++; if (calls === 1) throw Object.assign(new Error('preflight'), { code: 'PROVIDER_NOT_DISPATCHED' }); return { text: 'ok' }; },
    async executeJob(input, host) {
      attempt++;
      const response = await host.providerOperation({ key: 'text', request: { step: attempt > 2 ? 'changed' : 'same' } });
      if (attempt === 2) throw new Error('worker crashed after paid response');
      return resultFor(input, host, response);
    },
  });
  let failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
  const { job } = await f.scheduler.admit({ idempotencyKey: 'safe', input: await inputFor(f.repository) }); await failed;
  assert.equal(f.repository.snapshot().operations[0].status, 'failed');
  failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
  await f.scheduler.retry(job.id, { stage: 'generation' }); await failed;
  failed = waitFor(f.scheduler, e => e.states.generation === 'failed');
  await f.scheduler.retry(job.id, { stage: 'generation' }); await failed;
  assert.equal(calls, 2); assert.equal(attempt, 3);
});

test('automatic report has separate state and no provider authority; partial retry does not regenerate', { timeout: 10000 }, async t => {
  let generations = 0, renders = 0;
  const f = await fixture(t, {
    async executeJob(input, host) { generations++; return resultFor(input, host, { text: 'retained' }); },
    async renderReport(result, host) {
      renders++; assert.equal('providerOperation' in host, false); assert.equal(result.payload.text, 'retained');
      return { state: renders === 1 ? 'partial' : 'ready', document: { artifacts: [], missing: renders === 1 ? ['preview'] : [] } };
    },
  });
  const partial = waitFor(f.scheduler, e => e.states.report === 'partial');
  const { job } = await f.scheduler.admit({ idempotencyKey: 'report', input: await inputFor(f.repository) }); await partial;
  const ref = f.scheduler.getJob(job.id).resultRef;
  const ready = waitFor(f.scheduler, e => e.states.report === 'ready');
  await f.scheduler.retry(job.id, { stage: 'report' }); await ready;
  assert.equal(generations, 1); assert.equal(renders, 2); assert.deepEqual(f.scheduler.getJob(job.id).resultRef, ref);
  assert.equal(f.scheduler.getJob(job.id).application, 'awaiting-review');
  assert.equal(f.scheduler.getJob(job.id).save, 'unsaved');
});

test('explicit dependencies bind predecessor output; failed dependencies never execute', { timeout: 10000 }, async t => {
  const calls = [];
  const f = await fixture(t, { async executeJob(input, host) {
    calls.push(input.payload.name);
    if (input.payload.name === 'failure') throw new Error('fixture failure');
    if (input.dependsOn.length) assert.equal(host.dependencies[0].payload.name, 'parent');
    return resultFor(input, host, { name: input.payload.name });
  } });
  const input = await inputFor(f.repository);
  const parent = await f.repository.admit({ idempotencyKey: 'parent', input: { ...input, payload: { name: 'parent' } } });
  const child = await f.repository.admit({ idempotencyKey: 'child', input: { ...input, payload: { name: 'child' }, dependsOn: [parent.job.id] } });
  const failure = await f.repository.admit({ idempotencyKey: 'failure', input: { ...input, payload: { name: 'failure' } } });
  const blocked = await f.repository.admit({ idempotencyKey: 'blocked', input: { ...input, payload: { name: 'blocked' }, dependsOn: [failure.job.id] } });
  const done = waitFor(f.scheduler, e => e.jobId === blocked.job.id && e.states.generation === 'failed');
  f.scheduler.start(); await done;
  assert.equal(f.scheduler.getJob(child.job.id).generation, 'succeeded');
  assert.deepEqual(calls, ['parent', 'child', 'failure']);
});

test('renderer failure preserves generated result and permits only report retry', { timeout: 10000 }, async t => {
  let generated = 0, rendered = 0;
  const f = await fixture(t, {
    async executeJob(input, host) { generated++; return resultFor(input, host); },
    async renderReport() { rendered++; if (rendered === 1) throw new Error('renderer unavailable'); return { state: 'ready', document: { artifacts: [] } }; },
  });
  const failure = waitFor(f.scheduler, e => e.states.report === 'failed');
  const { job } = await f.scheduler.admit({ idempotencyKey: 'render-failed', input: await inputFor(f.repository) }); await failure;
  const resultRef = f.scheduler.getJob(job.id).resultRef;
  assert.equal(f.scheduler.getJob(job.id).generation, 'succeeded');
  await assert.rejects(f.scheduler.retry(job.id, { stage: 'generation' }), { code: 'RETRY_NOT_ALLOWED' });
  const done = waitFor(f.scheduler, e => e.states.report === 'ready');
  await f.scheduler.retry(job.id, { stage: 'report' }); await done;
  assert.equal(generated, 1); assert.equal(rendered, 2); assert.deepEqual(f.scheduler.getJob(job.id).resultRef, resultRef);
});

test('failed dispatch metadata persistence fences scheduler and performs zero physical requests', { timeout: 10000 }, async t => {
  let armed = false, count = 0;
  const fault = deferred();
  const f = await fixture(t, {
    onError: error => fault.resolve(error),
    async dispatchProvider() { count++; return {}; },
    async executeJob(input, host) { return resultFor(input, host, await host.providerOperation({ key: 'text', request: {} })); },
  }, { fileOps: { async open(path, ...args) {
    if (armed && String(path).includes('.metadata.json.')) throw Object.assign(new Error('injected dispatch write failure'), { code: 'EIO' });
    return fsOpen(path, ...args);
  } } });
  const unsubscribe = f.scheduler.subscribe(() => { if (f.repository.snapshot().operations.some(o => o.status === 'prepared')) armed = true; });
  await f.scheduler.admit({ idempotencyKey: 'failed-write', input: await inputFor(f.repository) });
  assert.equal((await fault.promise).code, 'PERSISTENCE_FAILED');
  assert.equal(count, 0); assert.equal(f.scheduler.status().requiresRestart, true);
  assert.equal(f.repository.snapshot().inbox.length, 0);
  unsubscribe(); armed = false;
});

test('admission while dependency scanning drains wakes the next eligible job', { timeout: 10000 }, async t => {
  const scanning = deferred(), release = deferred();
  t.after(() => release.resolve());
  const executed = [];
  const f = await fixture(t, { async executeJob(input, host) {
    executed.push(input.payload.name);
    return resultFor(input, host);
  } });
  const input = await inputFor(f.repository);
  const failed = await f.repository.admit({ idempotencyKey: 'previous-failure', input });
  await f.repository.transaction(draft => { draft.jobs[0].generation = 'failed'; });
  const blocked = await f.repository.admit({
    idempotencyKey: 'blocked-at-start',
    input: { ...input, dependsOn: [failed.job.id] },
  });
  const readJson = f.repository.readJson.bind(f.repository);
  let held = false;
  f.repository.readJson = async ref => {
    const value = await readJson(ref);
    if (!held && ref.sha256 === blocked.job.inputRef.sha256) {
      held = true;
      scanning.resolve();
      await release.promise;
    }
    return value;
  };
  f.scheduler.start();
  await scanning.promise;
  const completed = waitFor(f.scheduler, event => event.states.generation === 'succeeded');
  const next = await f.scheduler.admit({
    idempotencyKey: 'arrived-during-scan',
    input: { ...input, payload: { name: 'next' } },
  });
  release.resolve();
  await completed;
  assert.equal(f.scheduler.getJob(next.job.id).generation, 'succeeded');
  assert.deepEqual(executed, ['next']);
});
