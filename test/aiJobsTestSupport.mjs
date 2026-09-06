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
  const f = await fixture(t, runtime, options);
  let origin;
  const handler = createAiJobsHttpHandler({ ...f, origins: () => [origin], onError: error => f.errors.push(error), ...httpOptions });
  const server = createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { handler.close(); server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  const session = await fetch(`${origin}/api/ai-jobs/session`);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const { csrfToken } = await session.json();
  const headers = { Origin: origin, Cookie: cookie, 'X-AI-Jobs-CSRF': csrfToken, 'Content-Type': 'application/json' };
  const request = (path = '', { method = 'GET', body, headers: extra = {} } = {}) => fetch(`${origin}/api/ai-jobs${path}`, {
    method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { ...f, server, origin, headers, request, post: (path, body, extra = {}) => request(path, { method: 'POST', body, headers: extra }) };
}
