import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { openAiJobsRepository } from '../scripts/lib/aiJobs/repository.mjs';
import { createAiJobsScheduler } from '../scripts/lib/aiJobs/scheduler.mjs';
import { createAiJobsHttpHandler } from '../scripts/lib/aiJobs/http.mjs';

export const deferred = () => Promise.withResolvers();
export function waitFor(scheduler, predicate) {
  const result = deferred();
  const timeout = setTimeout(() => { unsubscribe(); result.reject(new Error('Expected durable job event not observed')); }, 5000);
  const unsubscribe = scheduler.subscribe(event => {
    if (predicate(event)) { clearTimeout(timeout); unsubscribe(); result.resolve(event); }
  });
  return result.promise;
}
export async function fixture(t, runtime = {}, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-jobs-task2-'));
  const repository = await openAiJobsRepository({ directory, ...options });
  const errors = [];
  const scheduler = createAiJobsScheduler({ repository, onError: error => errors.push(error), ...runtime });
  t.after(async () => {
    try { await scheduler.close(); await repository.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
    assert.deepEqual(errors, []);
  });
  return { repository, scheduler, directory, errors };
}
export async function inputFor(repository, overrides = {}) {
  return { version: 1, family: 'assistant', project: { backend: 'local', projectId: 'fixture-A' },
    projectSnapshot: await repository.putJson({ maps: [] }), artwork: [], target: {}, mode: 'review', payload: {}, dependsOn: [], ...overrides };
}
export function resultFor(input, host, payload = {}) {
  return { version: 1, family: input.family, jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: null, artifacts: [], payload };
}
export function submission() {
  return { input: { version: 1, family: 'assistant', project: { backend: 'local', projectId: 'fixture-A' },
    target: {}, mode: 'review', payload: {}, dependsOn: [] }, projectSnapshot: { maps: [] },
    artwork: [{ mediaType: 'image/png', base64: Buffer.from('fixture-artwork').toString('base64') }] };
}
export async function httpFixture(t, runtime = {}, options = {}, httpOptions = {}) {
  // Compose one teardown instead of depending on the runner's hook order.
  let closeFixture;
  const f = await fixture({ after: close => { closeFixture = close; } }, runtime, options);
  const controller = new AbortController();
  const signal = t.signal ? AbortSignal.any([t.signal, controller.signal]) : controller.signal;
  const requests = new Set();
  const handlers = new Set();
  let origin;
  const handler = createAiJobsHttpHandler({ ...f, origins: () => [origin], onError: error => f.errors.push(error), ...httpOptions });
  const server = createServer((req, res) => {
    const work = handler(req, res);
    handlers.add(work);
    work.then(() => handlers.delete(work), error => { handlers.delete(work); f.errors.push(error); });
    return work;
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    controller.abort(new Error('HTTP fixture cleanup'));
    handler.close();
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    // Aborted fetches are observed by their callers. Socket closure prevents new
    // handlers, but only the returned route promises settle accepted handlers.
    await Promise.allSettled([...requests]);
    await closed;
    await Promise.allSettled([...handlers]);
    await closeFixture();
  });
  const ownedFetch = (...args) => {
    const work = fetch(...args);
    requests.add(work);
    work.then(() => requests.delete(work), () => requests.delete(work));
    return work;
  };
  const session = await ownedFetch(`${origin}/api/ai-jobs/session`, { signal });
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const { csrfToken } = await session.json();
  const headers = { Origin: origin, Cookie: cookie, 'X-AI-Jobs-CSRF': csrfToken, 'Content-Type': 'application/json' };
  const request = (path = '', { method = 'GET', body, headers: extra = {} } = {}) => ownedFetch(`${origin}/api/ai-jobs${path}`, {
    signal, method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { ...f, server, origin, headers, request, post: (path, body, extra = {}) => request(path, { method: 'POST', body, headers: extra }) };
}
