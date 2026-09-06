import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { openAiJobsRepository } from '../scripts/lib/aiJobs/repository.mjs';

async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'rpg-ai-jobs-'));
  const repositories = [];
  t.after(async () => {
    try { for (const repository of repositories.reverse()) await repository.close(); }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
  async function open(extra = {}) {
    const repository = await openAiJobsRepository({ directory, ...options, ...extra });
    repositories.push(repository);
    return repository;
  }
  return { directory, open, repository: await open() };
}

async function inputFor(repository, family = 'assistant') {
  return {
    version: 1, family, project: { backend: 'local', projectId: 'project-A' },
    projectSnapshot: await repository.putJson({ id: 'project-A', maps: [] }),
    artwork: [], target: { mapId: 'map-A' }, mode: 'review',
    payload: { prompt: 'test request', config: { model: 'fixture-model' } }, dependsOn: [],
  };
}

// Break: acknowledging an admission whose metadata could not be written.
test('failed metadata persistence admits no job and emits no success or inbox', async (t) => {
  let armed = false;
  const fileOps = { ...fs, async open(path, ...args) {
    if (armed && String(path).includes('.metadata.json.')) {
      throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
    }
    return fs.open(path, ...args);
  } };
  const { repository, open } = await fixture(t, { fileOps });
  const input = await inputFor(repository);
  armed = true;
  await assert.rejects(repository.admit({ idempotencyKey: 'request-1', input }), { code: 'PERSISTENCE_FAILED' });
  assert.equal(repository.snapshot().jobs.length, 0);
  assert.equal(repository.snapshot().events.length, 0);
  assert.equal(repository.snapshot().inbox.length, 0);
  armed = false;
  await repository.close();
  assert.equal((await open()).snapshot().jobs.length, 0);
});

async function start(repository, jobId, stage = 'generation') {
  const attemptId = `${jobId}-${stage}`;
  await repository.transaction(draft => {
    const job = draft.jobs.find(j => j.id === jobId);
    job[stage] = 'running'; job.activeAttemptId = attemptId;
    draft.attempts.push({ id: attemptId, jobId, stage, status: 'running', startedAt: job.createdAt, finishedAt: null, error: null });
  });
  return attemptId;
}

function complete(draft, jobId, resultRef) {
  const job = draft.jobs.find(j => j.id === jobId);
  const attempt = draft.attempts.find(a => a.id === job.activeAttemptId);
  attempt.status = 'succeeded'; attempt.finishedAt = job.updatedAt;
  job.activeAttemptId = null; job.generation = 'succeeded'; job.resultRef = resultRef;
  job.application = 'awaiting-editor'; job.save = 'unsaved';
}

async function resultFor(repository, job, input, attemptId) {
  const artwork = await repository.putBlob(Buffer.from([137, 80, 78, 71]), 'image/png');
  return repository.putJson({
    version: 1, family: input.family, jobId: job.id, attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: null, artifacts: [artwork], payload: { summary: 'fixture output' },
  });
}

// Break: losing exact inputs, family identity, opaque payload fields or detached records on reload.
test('all six families, immutable input/artwork blobs and exact identities survive reload', async (t) => {
  const { repository, open, directory } = await fixture(t);
  for (const family of ['assistant', 'region', 'database', 'event-commands', 'tileset', 'image']) {
    const input = await inputFor(repository, family);
    input.artwork = [await repository.putBlob(Buffer.from('artwork'), 'image/png')];
    input.payload.context = { selection: [1, null, true], nested: { unknownAdapterField: 'retained' } };
    const accepted = repository.admit({ idempotencyKey: family, input });
    const expected = structuredClone(input);
    input.payload.prompt = 'changed after submit';
    const { job } = await accepted;
    assert.equal(job.family, family);
    assert.deepEqual(await repository.readJson(job.inputRef), expected);
    job.project.projectId = 'caller mutation';
  }
  const snapshot = repository.snapshot();
  assert.equal(snapshot.jobs.length, 6);
  assert.equal(snapshot.inbox.length, 0);
  assert.ok(snapshot.jobs.every(j => j.project.projectId === 'project-A' && j.generation === 'queued'));
  const stored = JSON.parse(await fs.readFile(join(directory, 'metadata.json'), 'utf8'));
  assert.deepEqual(stored.snapshot, snapshot);
  assert.equal((await fs.stat(join(directory, 'metadata.json'))).mode & 0o777, 0o600);
  await repository.close();
  const reopened = await open();
  assert.deepEqual(reopened.snapshot(), snapshot);
  const input = await reopened.readJson(snapshot.jobs[0].inputRef);
  assert.equal(Buffer.from(await reopened.readBlob(input.artwork[0])).toString(), 'artwork');
});

// Break: duplicate submissions race to create multiple jobs, or mismatches reuse an old result.
test('concurrent duplicate keys create one job; canonical key ordering is equivalent; changed identity conflicts', async (t) => {
  const { repository, open } = await fixture(t);
  const input = await inputFor(repository);
  const reordered = { ...input, payload: { config: { model: 'fixture-model' }, prompt: 'test request' } };
  const receipts = await Promise.all([input, reordered, input].map(value => repository.admit({ idempotencyKey: 'same-key', input: value })));
  assert.deepEqual(receipts.map(r => r.created), [true, false, false]);
  assert.equal(new Set(receipts.map(r => r.job.id)).size, 1);
  for (const changed of [
    { ...input, payload: { prompt: 'different' } },
    { ...input, project: { backend: 'remote-B', projectId: 'project-A' } },
    { ...input, target: { mapId: 'map-B' } },
  ]) await assert.rejects(repository.admit({ idempotencyKey: 'same-key', input: changed }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(repository.snapshot().events.length, 1);
  await repository.close();
  const reopened = await open();
  assert.equal((await reopened.admit({ idempotencyKey: 'same-key', input })).created, false);
});

// Break: independently persisted job/attempt/operation/inbox produces a split outcome after restart.
test('one snapshot atomically commits result, attempt, provider response, event and deduplicated inbox', async (t) => {
  const { repository, open, directory } = await fixture(t);
  const input = await inputFor(repository, 'database');
  const { job } = await repository.admit({ idempotencyKey: 'complete', input });
  const attemptId = await start(repository, job.id);
  const requestRef = await repository.putJson({ messages: [{ role: 'user', content: 'fixture' }] });
  const responseRef = await repository.putJson({ content: 'paid response retained' });
  const resultRef = await resultFor(repository, job, input, attemptId);
  await repository.transaction(draft => {
    draft.operations.push({ id: 'operation-1', jobId: job.id, attemptId, kind: 'completion', status: 'succeeded', requestRef, responseRef, error: null });
    complete(draft, job.id, resultRef);
  });
  const completed = repository.snapshot();
  assert.equal(completed.inbox.length, 1);
  assert.equal(completed.events.at(-1).kind, 'outcome');
  assert.equal(completed.attempts[0].status, 'succeeded');
  assert.equal(completed.operations[0].responseRef.sha256, responseRef.sha256);
  assert.equal(completed.jobs[0].generation, 'succeeded');
  assert.equal(completed.jobs[0].application, 'awaiting-editor');
  assert.equal(completed.jobs[0].save, 'unsaved');
  assert.equal(completed.jobs[0].report, 'pending');
  await repository.transaction(() => {});
  assert.deepEqual(repository.snapshot(), completed);
  assert.deepEqual(JSON.parse(await fs.readFile(join(directory, 'metadata.json'), 'utf8')).snapshot, completed);
  await repository.close();
  const reopened = await open();
  assert.deepEqual(reopened.snapshot(), completed);
  const read = await reopened.markInboxRead(completed.inbox[0].eventSeq);
  assert.notEqual(read.inbox[0].readAt, null);
  assert.deepEqual((await reopened.markInboxRead(completed.inbox[0].eventSeq)), read);
  const retainedResult = await reopened.readJson(resultRef);
  assert.deepEqual(retainedResult.payload, { summary: 'fixture output' });
  assert.deepEqual(Buffer.from(await reopened.readBlob(retainedResult.artifacts[0])), Buffer.from([137, 80, 78, 71]));
  await reopened.close();
  assert.deepEqual((await open()).snapshot(), read);
});

for (const method of ['writeFile', 'sync', 'rename']) {
  test(`failed metadata ${method} preserves the complete previous outcome snapshot`, async (t) => {
    let armed = false;
    const injected = () => { throw Object.assign(new Error(`injected ${method}`), { code: 'EIO' }); };
    const fileOps = {
      async open(path, ...args) {
        const handle = await fs.open(path, ...args);
        return new Proxy(handle, { get(target, key) {
          if (armed && String(path).includes('.metadata.json.') && key === method) return injected;
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        } });
      },
      async rename(from, to) { if (armed && method === 'rename' && String(to).endsWith('/metadata.json')) injected(); return fs.rename(from, to); },
    };
    const { repository, open, directory } = await fixture(t, { fileOps });
    const input = await inputFor(repository);
    const { job } = await repository.admit({ idempotencyKey: method, input });
    const attemptId = await start(repository, job.id);
    const resultRef = await resultFor(repository, job, input, attemptId);
    const before = repository.snapshot();
    armed = true;
    await assert.rejects(repository.transaction(draft => complete(draft, job.id, resultRef)), { code: 'PERSISTENCE_FAILED' });
    assert.deepEqual(repository.snapshot(), before);
    assert.deepEqual(JSON.parse(await fs.readFile(join(directory, 'metadata.json'), 'utf8')).snapshot, before);
    assert.equal((await fs.readdir(directory)).filter(name => name.endsWith('.tmp')).length, 0);
    armed = false;
    await repository.transaction(draft => complete(draft, job.id, resultRef));
    const after = repository.snapshot();
    assert.equal(after.inbox.length, 1);
    await repository.close();
    assert.deepEqual((await open()).snapshot(), after);
  });
}

test('admission remains unacknowledged and invisible until metadata directory sync completes', { timeout: 10000 }, async (t) => {
  let armed = false;
  let metadataRenamed = false;
  const reached = Promise.withResolvers();
  const release = Promise.withResolvers();
  let root;
  const fileOps = {
    async rename(from, to) { await fs.rename(from, to); if (armed && String(to).endsWith('/metadata.json')) metadataRenamed = true; },
    async open(path, ...args) {
      const handle = await fs.open(path, ...args);
      return new Proxy(handle, { get(target, key) {
        if (key === 'sync' && armed && metadataRenamed && path === root) return async () => { reached.resolve(); await release.promise; await target.sync(); };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    },
  };
  const f = await fixture(t, { fileOps }); root = f.directory;
  t.after(() => release.resolve());
  const input = await inputFor(f.repository);
  armed = true;
  let acknowledged = false;
  const receipt = f.repository.admit({ idempotencyKey: 'barrier', input }).then(value => { acknowledged = true; return value; });
  try {
    await reached.promise;
    assert.equal(acknowledged, false);
    assert.equal(f.repository.snapshot().jobs.length, 0);
  } finally { release.resolve(); }
  assert.equal((await receipt).created, true);
  armed = false;
  assert.equal(f.repository.snapshot().jobs.length, 1);
});

test('post-rename sync failure is outcome-unknown, never acknowledged; writer is fenced until reopen', async (t) => {
  let armed = false;
  let renamed = false;
  let root;
  const fileOps = {
    async rename(from, to) { await fs.rename(from, to); if (armed && String(to).endsWith('/metadata.json')) renamed = true; },
    async open(path, ...args) {
      const handle = await fs.open(path, ...args);
      return new Proxy(handle, { get(target, key) {
        if (key === 'sync' && armed && renamed && path === root) return async () => { throw new Error('directory sync failed'); };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    },
  };
  const f = await fixture(t, { fileOps }); root = f.directory;
  const input = await inputFor(f.repository);
  armed = true;
  await assert.rejects(f.repository.admit({ idempotencyKey: 'uncertain', input }), { code: 'DURABILITY_UNKNOWN' });
  assert.throws(() => f.repository.snapshot(), { code: 'DURABILITY_UNKNOWN' });
  await assert.rejects(f.repository.transaction(() => {}), { code: 'DURABILITY_UNKNOWN' });
  armed = false;
  await f.repository.close();
  const reopened = await f.open();
  assert.equal(reopened.snapshot().jobs.length, 1);
  assert.equal((await reopened.admit({ idempotencyKey: 'uncertain', input })).created, false);
});

test('failed blob sync and missing referenced input prevent admission', async (t) => {
  let armed = false;
  const fileOps = { async open(path, ...args) {
    const handle = await fs.open(path, ...args);
    return new Proxy(handle, { get(target, key) {
      if (key === 'sync' && armed && String(path).includes('/blobs/.')) return async () => { throw new Error('blob sync failed'); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
  const { repository } = await fixture(t, { fileOps });
  const input = await inputFor(repository);
  armed = true;
  await assert.rejects(repository.admit({ idempotencyKey: 'blob-failure', input }), { code: 'PERSISTENCE_FAILED' });
  armed = false;
  await assert.rejects(repository.admit({ idempotencyKey: 'missing', input: { ...input, projectSnapshot: { ...input.projectSnapshot, sha256: '0'.repeat(64) } } }), { code: 'CORRUPT_STORAGE' });
  assert.equal(repository.snapshot().jobs.length, 0);
});

test('lossy/non-plain serializable values and invalid envelopes are rejected without admission', async (t) => {
  const { repository } = await fixture(t);
  const input = await inputFor(repository);
  const cycle = {}; cycle.self = cycle;
  for (const value of [undefined, () => {}, new Date(), Infinity, NaN, -0, 1n, cycle, new Array(2), { get value() { throw new Error('getter must not run'); } }]) {
    await assert.rejects(repository.admit({ idempotencyKey: 'invalid', input: { ...input, payload: { value } } }), { code: 'INVALID_DATA' });
  }
  for (const changed of [{ ...input, version: 2 }, { ...input, family: 'unknown' }, { ...input, dependsOn: ['nonexistent-job'] }]) {
    await assert.rejects(repository.admit({ idempotencyKey: 'invalid', input: changed }), { code: 'INVALID_DATA' });
  }
  assert.equal(repository.snapshot().jobs.length, 0);
});

test('transactions cannot erase retained jobs, rewrite identity, or invent a saved/successful state', async (t) => {
  const { repository } = await fixture(t);
  await repository.admit({ idempotencyKey: 'identity', input: await inputFor(repository) });
  const before = repository.snapshot();
  for (const change of [
    draft => { draft.jobs.pop(); },
    draft => { draft.jobs[0].project.projectId = 'different-project'; },
    draft => { draft.jobs[0].generation = 'succeeded'; },
    draft => { draft.jobs[0].save = 'saved'; },
    draft => { draft.jobs[0].generation = 'running'; },
  ]) await assert.rejects(repository.transaction(change), { code: 'INVALID_DATA' });
  assert.deepEqual(repository.snapshot(), before);
  let retained;
  await repository.transaction(draft => { retained = draft; draft.jobs[0].application = 'awaiting-review'; });
  retained.jobs[0].application = 'applied';
  assert.equal(repository.snapshot().jobs[0].application, 'awaiting-review');
});

test('mismatched result identity is rejected and input/artifact hashes detect disk corruption', async (t) => {
  const { repository, open, directory } = await fixture(t);
  const input = await inputFor(repository);
  const { job } = await repository.admit({ idempotencyKey: 'identity', input });
  const attemptId = await start(repository, job.id);
  const good = await resultFor(repository, job, input, attemptId);
  const result = await repository.readJson(good);
  const bad = await repository.putJson({ ...result, project: { backend: 'local', projectId: 'project-B' } });
  await assert.rejects(repository.transaction(draft => complete(draft, job.id, bad)), { code: 'INVALID_DATA' });
  await repository.transaction(draft => complete(draft, job.id, good));
  await repository.close();
  await fs.writeFile(join(directory, 'blobs', result.artifacts[0].sha256), 'corrupted');
  await assert.rejects(open(), { code: 'CORRUPT_STORAGE' });
  await assert.rejects(fs.access(join(directory, 'writer.lock')), { code: 'ENOENT' });
});

for (const corruption of ['malformed-json', 'checksum', 'invalid-record', 'missing-metadata', 'missing-input']) {
  test(`on-disk ${corruption} fails loudly without resetting or retaining a writer lock`, async (t) => {
    const { repository, open, directory } = await fixture(t);
    const { job } = await repository.admit({ idempotencyKey: 'disk', input: await inputFor(repository) });
    await repository.close();
    const path = join(directory, 'metadata.json');
    if (corruption === 'malformed-json') await fs.writeFile(path, '{');
    if (corruption === 'checksum') {
      const envelope = JSON.parse(await fs.readFile(path, 'utf8')); envelope.snapshot.jobs[0].generation = 'failed';
      await fs.writeFile(path, JSON.stringify(envelope));
    }
    if (corruption === 'invalid-record') {
      const envelope = JSON.parse(await fs.readFile(path, 'utf8'));
      envelope.snapshot.jobs[0].generation = 'fictional-state';
      // Independently serialize canonical JSON: emulate a valid checksum over invalid records.
      const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
      envelope.sha256 = createHash('sha256').update(JSON.stringify(ordered(envelope.snapshot))).digest('hex');
      await fs.writeFile(path, JSON.stringify(envelope));
    }
    if (corruption === 'missing-metadata') await fs.rm(path);
    if (corruption === 'missing-input') await fs.rm(join(directory, 'blobs', job.inputRef.sha256));
    await assert.rejects(open(), { code: 'CORRUPT_STORAGE' });
    await assert.rejects(fs.access(join(directory, 'writer.lock')), { code: 'ENOENT' });
  });
}

function child(t, script) {
  const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const message = once(process, 'message', { signal: AbortSignal.timeout(5000) });
  const exit = once(process, 'exit', { signal: AbortSignal.timeout(5000) });
  const closed = once(process, 'close', { signal: AbortSignal.timeout(5000) });
  t.after(async () => { if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL'); await closed; });
  return { process, message, exit, closed };
}

test('exclusive ownership rejects a second process without damaging the first writer', { timeout: 10000 }, async (t) => {
  const { repository, directory, open } = await fixture(t);
  await assert.rejects(open(), { code: 'WRITER_LOCKED' });
  const worker = child(t, `
    import { openAiJobsRepository } from ${JSON.stringify(new URL('../scripts/lib/aiJobs/repository.mjs', import.meta.url).href)};
    try { const r = await openAiJobsRepository({ directory: ${JSON.stringify(directory)} }); await r.close(); process.send({ code: 'UNEXPECTED_OPEN' }); }
    catch (error) { process.send({ code: error.code }); }
    process.disconnect();
  `);
  assert.equal((await worker.message)[0].code, 'WRITER_LOCKED');
  assert.deepEqual(await worker.exit, [0, null]);
  assert.equal((await repository.admit({ idempotencyKey: 'still-owner', input: await inputFor(repository) })).created, true);
});

test('crashed running jobs recover as interrupted, dispatched operations unknown, and paid responses retained', { timeout: 10000 }, async (t) => {
  const { repository, directory, open } = await fixture(t);
  const input = await inputFor(repository);
  const { job } = await repository.admit({ idempotencyKey: 'crash', input });
  const queued = await repository.admit({ idempotencyKey: 'queued', input });
  const requestRef = await repository.putJson({ prompt: 'fixture' });
  const responseRef = await repository.putJson({ content: 'completed paid response' });
  await repository.close();
  const worker = child(t, `
    import { openAiJobsRepository } from ${JSON.stringify(new URL('../scripts/lib/aiJobs/repository.mjs', import.meta.url).href)};
    const r = await openAiJobsRepository({ directory: ${JSON.stringify(directory)} });
    await r.transaction(d => {
      const j = d.jobs[0]; j.generation = 'running'; j.activeAttemptId = 'crashed-attempt';
      d.attempts.push({ id: 'crashed-attempt', jobId: j.id, stage: 'generation', status: 'running', startedAt: j.createdAt, finishedAt: null, error: null });
      for (const status of ['prepared', 'dispatched', 'succeeded']) d.operations.push({ id: status, jobId: j.id, attemptId: 'crashed-attempt', kind: 'completion', status, requestRef: ${JSON.stringify(requestRef)}, responseRef: status === 'succeeded' ? ${JSON.stringify(responseRef)} : null, error: null });
    });
    process.on('message', () => {});
    process.send({ ready: true });
  `);
  assert.equal((await worker.message)[0].ready, true);
  worker.process.kill('SIGKILL');
  assert.deepEqual(await worker.exit, [null, 'SIGKILL']);
  await worker.closed;
  const owner = JSON.parse(await fs.readFile(join(directory, 'writer.lock', 'owner.json'), 'utf8'));
  assert.equal(owner.pid, worker.process.pid);
  // Competing restarters must not race to remove the newly acquired writer's lock.
  const contenders = await Promise.allSettled([open(), open()]);
  assert.equal(contenders.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(contenders.find(result => result.status === 'rejected').reason.code, 'WRITER_LOCKED');
  const recovered = contenders.find(result => result.status === 'fulfilled').value;
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.jobs.find(j => j.id === job.id).generation, 'interrupted');
  assert.equal(snapshot.jobs.find(j => j.id === queued.job.id).generation, 'queued');
  assert.equal(snapshot.attempts[0].status, 'interrupted');
  assert.deepEqual(snapshot.operations.map(o => o.status), ['prepared', 'outcome-unknown', 'succeeded']);
  assert.deepEqual(await recovered.readJson(snapshot.operations[2].responseRef), { content: 'completed paid response' });
  assert.equal(snapshot.inbox.length, 1);
  await recovered.close();
  assert.deepEqual((await open()).snapshot(), snapshot);
});

for (const kind of ['missing-owner', 'malformed-owner', 'foreign-owner', 'abandoned-guard']) {
  test(`uncertain ${kind} fails closed and preserves metadata`, async (t) => {
    const { repository, open, directory } = await fixture(t);
    await repository.admit({ idempotencyKey: 'lock', input: await inputFor(repository) });
    await repository.close();
    const before = await fs.readFile(join(directory, 'metadata.json'));
    if (kind === 'abandoned-guard') await fs.mkdir(join(directory, 'writer.guard'));
    else {
      await fs.mkdir(join(directory, 'writer.lock'));
      if (kind !== 'missing-owner') await fs.writeFile(join(directory, 'writer.lock', 'owner.json'), kind === 'malformed-owner' ? '{' : JSON.stringify({ pid: process.pid, hostname: 'another-host', token: 'fixture-token' }));
    }
    await assert.rejects(open(), { code: 'WRITER_LOCKED' });
    assert.deepEqual(await fs.readFile(join(directory, 'metadata.json')), before);
  });
}
