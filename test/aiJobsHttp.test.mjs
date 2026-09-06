import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request as nodeRequest } from 'node:http';
import { once } from 'node:events';
import { readFile, open as fsOpen } from 'node:fs/promises';
import { join } from 'node:path';
import { createAiJobsHttpHandler } from '../scripts/lib/aiJobs/http.mjs';
import { deferred, httpFixture, resultFor, submission, waitFor } from './aiJobsTestSupport.mjs';

test('HTTP rejects a foreign Origin rather than admitting paid work', { timeout: 5000 }, async t => {
  const server = createServer(createAiJobsHttpHandler({ origins: ['http://127.0.0.1:19841'] }));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ai-jobs`, {
    method: 'POST', headers: { Origin: 'http://evil.invalid', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
});

async function readEvents(response, count) {
  const reader = response.body.getReader(); const events = []; let buffer = '';
  try {
    while (events.length < count) {
      const { value, done } = await reader.read();
      assert.equal(done, false);
      buffer += new TextDecoder().decode(value);
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split('\n').find(line => line.startsWith('data: '));
        if (data) events.push(JSON.parse(data.slice(6)));
      }
    }
    return events;
  } finally { await reader.cancel(); }
}

test('real HTTP admission, immutable host blobs, live SSE, disconnect replay, inbox and manifest-only artifacts', { timeout: 10000 }, async t => {
  const hold = deferred(), dispatched = deferred(); let dispatchCount = 0;
  t.after(() => hold.resolve({ text: 'retained after client disconnect' }));
  const f = await httpFixture(t, {
    async dispatchProvider() { dispatchCount++; dispatched.resolve(); return hold.promise; },
    async executeJob(input, host) {
      assert.deepEqual(await host.readJson(input.projectSnapshot), { maps: [] });
      assert.equal(Buffer.from(await host.readBlob(input.artwork[0])).toString(), 'fixture-artwork');
      const payload = await host.providerOperation({ key: 'completion', request: { model: 'fixture' } });
      const art = await host.putBlob(Buffer.from('generated-output'), 'image/png');
      return { ...resultFor(input, host, payload), artifacts: [art] };
    },
  });
  const live = await f.request('/events?after=0');
  assert.equal(live.status, 200); assert.match(live.headers.get('content-type'), /^text\/event-stream/);
  const firstEvent = readEvents(live, 1);
  const body = submission();
  const response = await f.post('', body, { 'Idempotency-Key': 'http-one' });
  assert.equal(response.status, 202);
  const receipt = await response.json();
  assert.equal(response.headers.get('location'), `/api/ai-jobs/${receipt.job.id}`);
  const [admission] = await firstEvent;
  assert.equal(admission.kind, 'admitted');
  await dispatched.promise;
  // The submitting response and SSE client are both gone; Node owns the held provider work.
  const done = waitFor(f.scheduler, event => event.states.generation === 'succeeded');
  hold.resolve({ text: 'retained after client disconnect' }); await done;
  const detailResponse = await f.request(`/${receipt.job.id}`);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.job.generation, 'succeeded'); assert.equal(detail.job.report, 'pending');
  assert.equal(detail.job.application, 'awaiting-review'); assert.equal(detail.job.save, 'unsaved');
  const disk = JSON.parse(await readFile(join(f.directory, 'metadata.json'), 'utf8')).snapshot;
  const replay = await f.request(`/events?after=${admission.seq}`);
  assert.deepEqual(await readEvents(replay, disk.events.length - admission.seq), disk.events.slice(admission.seq));
  assert.equal((await f.request()).status, 200);
  const duplicate = await f.post('', body, { 'Idempotency-Key': 'http-one' });
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).job.id, receipt.job.id);
  const mismatch = await f.post('', { ...body, input: { ...body.input, payload: { different: true } } }, { 'Idempotency-Key': 'http-one' });
  assert.equal(mismatch.status, 409); assert.equal(dispatchCount, 1);
  const artifact = detail.manifest.find(ref => ref.byteLength === Buffer.byteLength('generated-output'));
  const bytes = await f.request(`/${receipt.job.id}/artifacts/${artifact.sha256}`);
  assert.equal(await bytes.text(), 'generated-output'); assert.match(bytes.headers.get('content-disposition'), /^attachment/);
  const privateRef = await f.repository.putJson({ private: 'not-in-manifest' });
  assert.equal((await f.request(`/${receipt.job.id}/artifacts/${privateRef.sha256}`)).status, 404);
  assert.equal((await f.request(`/${receipt.job.id}/artifacts/${detail.operations[0].responseRef.sha256}`)).status, 404);
  const inbox = (await (await f.request('/inbox')).json()).inbox;
  assert.equal(inbox.length, 1);
  const read = await f.post(`/inbox/${inbox[0].eventSeq}/read`, {});
  assert.equal(read.status, 200); assert.notEqual((await read.json()).inbox[0].readAt, null);
  const seq = f.repository.snapshot().events.length;
  await f.post(`/inbox/${inbox[0].eventSeq}/read`, {});
  assert.equal(f.repository.snapshot().events.length, seq);
  assert.deepEqual(f.scheduler.getJob(receipt.job.id).resultRef, detail.job.resultRef);
});

test('exact Host/Origin, local session CSRF, JSON-only mutations and secret rejection precede any admission', { timeout: 10000 }, async t => {
  const f = await httpFixture(t, { executeJob: async (input, host) => resultFor(input, host) });
  const post = headers => f.post('', submission(), { 'Idempotency-Key': 'security', ...headers });
  for (const headers of [
    { Origin: 'http://evil.invalid' }, { Origin: `${f.origin}/` }, { Origin: 'null' },
    { Origin: f.origin.replace('127.0.0.1', 'localhost') }, { Origin: '' },
    { Cookie: '' }, { 'X-AI-Jobs-CSRF': '' }, { 'X-AI-Jobs-CSRF': 'wrong' },
  ]) assert.equal((await post(headers)).status, 403);
  assert.equal((await post({ 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post({ 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal((await f.request('/session', { headers: { Origin: 'http://evil.invalid' } })).status, 403);
  const foreignHost = await new Promise((resolve, reject) => {
    const req = nodeRequest(`${f.origin}/api/ai-jobs/session`, { headers: { Host: 'evil.invalid', Origin: f.origin } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(foreignHost, 403);
  assert.equal((await f.post('', submission())).status, 400);
  for (const payload of [{ apiKey: 'secret' }, { nested: { access_token: 'secret' } }, { Authorization: 'secret' }, { prompt: 'Bearer secret' }]) {
    const body = submission(); body.input.payload = payload;
    assert.equal((await f.post('', body, { 'Idempotency-Key': 'secret' })).status, 400);
  }
  const body = submission(); body.artwork[0].base64 = 'https://evil.invalid/art.png';
  assert.equal((await f.post('', body, { 'Idempotency-Key': 'url' })).status, 400);
  assert.equal((await f.request('/events?after=-1')).status, 400);
  assert.equal((await f.request('/events?after=99')).status, 400);
  assert.equal(f.repository.snapshot().jobs.length, 0);
});

test('executor unavailable is explicit 503, with read access but no admission or browser fallback', { timeout: 10000 }, async t => {
  const f = await httpFixture(t);
  const status = await (await f.request()).json();
  assert.equal(status.generationAvailable, false); assert.equal(status.reportAvailable, false);
  const response = await f.post('', submission(), { 'Idempotency-Key': 'unavailable' });
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'EXECUTOR_UNAVAILABLE');
  assert.equal(f.repository.snapshot().jobs.length, 0);
  assert.equal(f.errors.pop().code, 'EXECUTOR_UNAVAILABLE');
});

test('oversized and malformed JSON get HTTP errors without admitting work or destroying the response socket', { timeout: 10000 }, async t => {
  const f = await httpFixture(t, { executeJob: async (input, host) => resultFor(input, host) }, {}, { maxBodyBytes: 16 });
  assert.equal((await f.post('', submission(), { 'Idempotency-Key': 'large' })).status, 413);
  const malformed = await fetch(`${f.origin}/api/ai-jobs`, { method: 'POST', headers: f.headers, body: '{' });
  assert.equal(malformed.status, 400); assert.equal(f.repository.snapshot().jobs.length, 0);
});

test('HTTP cancel/retry with unknown cost is explicit and fenced while old request remains physically active', { timeout: 10000 }, async t => {
  const held = deferred(), dispatched = deferred(); let dispatches = 0;
  t.after(() => held.resolve({ text: 'late' }));
  const f = await httpFixture(t, {
    async dispatchProvider() { dispatches++; dispatched.resolve(); return held.promise; },
    async executeJob(input, host) { return resultFor(input, host, await host.providerOperation({ key: 'text', request: {} })); },
  });
  const { job } = await (await f.post('', submission(), { 'Idempotency-Key': 'cancel' })).json();
  await dispatched.promise;
  const cancelled = await f.post(`/${job.id}/cancel`, {});
  assert.equal(cancelled.status, 200); assert.equal((await cancelled.json()).job.generation, 'cancelled');
  const unknown = await f.post(`/${job.id}/retry`, { stage: 'generation' });
  assert.equal(unknown.status, 409); assert.equal((await unknown.json()).code, 'DUPLICATE_SPEND_ACK_REQUIRED');
  const accepted = await f.post(`/${job.id}/retry`, { stage: 'generation', acknowledgeDuplicateSpend: true });
  assert.equal(accepted.status, 202); assert.equal((await accepted.json()).job.generation, 'queued');
  assert.equal(dispatches, 1);
  const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
  held.resolve({ text: 'late' }); await done;
  assert.equal(dispatches, 1); assert.equal(f.repository.snapshot().attempts[0].status, 'cancelled');
});

test('atomic application claim rejects other project/tab; receipt replay is idempotent and unsaved is distinct', { timeout: 10000 }, async t => {
  const f = await httpFixture(t, { executeJob: async (input, host) => resultFor(input, host, { text: 'proposal' }) });
  const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
  const { job } = await (await f.post('', submission(), { 'Idempotency-Key': 'apply' })).json(); await done;
  const ready = f.scheduler.getJob(job.id);
  const input = await f.repository.readJson(ready.inputRef);
  const claim = { claimId: 'tab-A-claim', project: ready.project, resultSha256: ready.resultRef.sha256, baselineSha256: input.projectSnapshot.sha256 };
  assert.equal((await f.post(`/${job.id}/application/prepare`, { ...claim, project: { backend: 'local', projectId: 'B' } })).status, 409);
  const claims = await Promise.all([claim, { ...claim, claimId: 'tab-B-claim' }].map(value => f.post(`/${job.id}/application/prepare`, value)));
  assert.deepEqual(claims.map(r => r.status).sort(), [200, 409]);
  const owner = f.scheduler.getJob(job.id).applicationEvidence.claim;
  assert.equal(f.scheduler.getJob(job.id).application, 'applying');
  const evidence = { claimId: owner.claimId, receiptId: 'receipt-1', project: ready.project, resultSha256: ready.resultRef.sha256,
    application: 'applied', save: 'failed', evidence: { appliedSnapshotSha256: input.projectSnapshot.sha256 }, saveEvidence: { reason: 'fixture publication failed' } };
  assert.equal((await f.post(`/${job.id}/application/evidence`, { ...evidence, save: 'saved' })).status, 400);
  const applied = await f.post(`/${job.id}/application/evidence`, evidence);
  assert.equal(applied.status, 200); assert.equal((await applied.json()).job.save, 'failed');
  const seq = f.repository.snapshot().events.length;
  assert.equal((await f.post(`/${job.id}/application/evidence`, evidence)).status, 200);
  assert.equal(f.repository.snapshot().events.length, seq);
  assert.equal((await f.post(`/${job.id}/application/evidence`, { ...evidence, receiptId: 'different' })).status, 409);
  assert.equal(f.scheduler.getJob(job.id).generation, 'succeeded');
  assert.deepEqual(f.scheduler.getJob(job.id).resultRef, ready.resultRef);
});

test('HTTP admission failure returns 503 and publishes no durable event or physical dispatch', { timeout: 10000 }, async t => {
  let armed = false, calls = 0;
  const f = await httpFixture(t, { async executeJob(input, host) { calls++; return resultFor(input, host); } }, {
    fileOps: { async open(path, ...args) {
      if (armed && String(path).includes('.metadata.json.')) throw Object.assign(new Error('admission write failed'), { code: 'EIO' });
      return fsOpen(path, ...args);
    } },
  });
  armed = true;
  const response = await f.post('', submission(), { 'Idempotency-Key': 'write-failure' });
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'PERSISTENCE_FAILED');
  assert.equal(f.repository.snapshot().events.length, 0); assert.equal(f.repository.snapshot().jobs.length, 0); assert.equal(calls, 0);
  assert.equal(f.errors.pop().code, 'PERSISTENCE_FAILED'); armed = false;
});

test('save-only retry moves applied+failed to applied+saved for the same receipt and exact applied hash', { timeout: 10000 }, async t => {
  let generations = 0;
  const f = await httpFixture(t, { async executeJob(input, host) { generations++; return resultFor(input, host); } });
  const done = waitFor(f.scheduler, e => e.states.generation === 'succeeded');
  const { job } = await (await f.post('', submission(), { 'Idempotency-Key': 'save-retry' })).json(); await done;
  const ready = f.scheduler.getJob(job.id), input = await f.repository.readJson(ready.inputRef);
  const claim = { claimId: 'apply-claim', project: ready.project, resultSha256: ready.resultRef.sha256, baselineSha256: input.projectSnapshot.sha256 };
  assert.equal((await f.post(`/${job.id}/application/prepare`, claim)).status, 200);
  const receipt = { claimId: claim.claimId, receiptId: 'immutable-receipt', project: ready.project, resultSha256: ready.resultRef.sha256,
    application: 'applied', save: 'failed', evidence: { appliedSnapshotSha256: 'a'.repeat(64) }, saveEvidence: { reason: 'publication-failed' } };
  assert.equal((await f.post(`/${job.id}/application/evidence`, receipt)).status, 200);
  const saved = { claimId: claim.claimId, receiptId: receipt.receiptId, project: ready.project, resultSha256: ready.resultRef.sha256,
    saveAttemptId: 'save-retry-1', save: 'saved', saveEvidence: { method: 'reload', confirmedSnapshotSha256: 'a'.repeat(64) } };
  assert.equal((await f.post(`/${job.id}/application/save-evidence`, { ...saved, saveEvidence: { method: 'reload', confirmedSnapshotSha256: 'b'.repeat(64) } })).status, 409);
  assert.equal(f.scheduler.getJob(job.id).save, 'failed');
  const response = await f.post(`/${job.id}/application/save-evidence`, saved);
  assert.equal(response.status, 200);
  const updated = (await response.json()).job;
  assert.equal(updated.application, 'applied'); assert.equal(updated.save, 'saved');
  assert.deepEqual(updated.applicationEvidence.receipt, receipt); assert.deepEqual(updated.resultRef, ready.resultRef);
  assert.equal(generations, 1); assert.equal(updated.saveEvidence.updates.length, 2);
  const seq = f.repository.snapshot().events.length;
  assert.equal((await f.post(`/${job.id}/application/save-evidence`, saved)).status, 200);
  assert.equal((await f.post(`/${job.id}/application/evidence`, receipt)).status, 200);
  assert.equal(f.repository.snapshot().events.length, seq); assert.equal(f.scheduler.getJob(job.id).save, 'saved');
  assert.equal((await f.post(`/${job.id}/application/save-evidence`, { ...saved, saveEvidence: { method: 'reload', confirmedSnapshotSha256: 'b'.repeat(64) } })).status, 409);
  assert.equal((await f.post(`/${job.id}/application/save-evidence`, { ...saved, receiptId: 'foreign-receipt' })).status, 409);
  assert.equal((await f.post(`/${job.id}/application/save-evidence`, { ...saved, project: { backend: 'local', projectId: 'foreign' } })).status, 409);
});


test('application snapshot upload is immutable, receipt-bound and visible only in its job manifest', { timeout: 10000 }, async t => {
  const f = await httpFixture(t, { executeJob: async (input, host) => resultFor(input, host) });
  const done = waitFor(f.scheduler, event => event.states.generation === 'succeeded');
  const admitted = await (await f.post('', submission(), { 'Idempotency-Key': 'applied-artifact' })).json();
  await done;
  const { job } = await (await f.request(`/${admitted.job.id}`)).json();
  const input = await f.repository.readJson(job.inputRef);
  const claim = { claimId: 'claim-art', receiptId: 'receipt-art', project: job.project, resultSha256: job.resultRef.sha256, baselineSha256: input.projectSnapshot.sha256 };
  const prepared = await f.post(`/${job.id}/application/prepare`, claim);
  assert.equal(prepared.status, 200);
  const serialized = '{"maps":[],"version":1}';
  const { createHash } = await import('node:crypto');
  const snapshotSha256 = createHash('sha256').update(serialized).digest('hex');
  const body = { claimId: claim.claimId, receiptId: claim.receiptId, project: job.project, resultSha256: claim.resultSha256, snapshotSha256, serialized };
  const uploaded = await f.post(`/${job.id}/application/artifact`, body);
  assert.equal(uploaded.status, 200);
  const { artifact } = await uploaded.json();
  assert.equal(artifact.sha256, snapshotSha256);
  assert.deepEqual(await (await f.post(`/${job.id}/application/artifact`, body)).json(), { artifact });
  assert.equal((await f.post(`/${job.id}/application/artifact`, { ...body, serialized: '{}' })).status, 400);
  const detail = await (await f.request(`/${job.id}`)).json();
  assert(detail.manifest.some(ref => ref.sha256 === snapshotSha256));
  assert.equal(await (await f.request(`/${job.id}/artifacts/${snapshotSha256}`)).text(), serialized);
});
