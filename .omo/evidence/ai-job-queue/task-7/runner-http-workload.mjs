// Non-UI owned-fixture workload: real session, SSE socket, service disconnect and counts.
import http from 'node:http';
import assert from 'node:assert/strict';
import { once } from 'node:events';
const origin = `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? 19841}`;
const signal = AbortSignal.timeout(15000);
function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(path, origin), { method, signal, agent: false, headers: { Origin: origin, 'Content-Type': 'application/json' } }, resolve);
    req.once('error', reject);
    req.end(method === 'POST' ? '{}' : undefined);
  });
}
async function json(path, method) {
  const response = await request(path, method);
  assert.equal(response.statusCode, 200);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks));
}
const session = await json('/api/ai-jobs/session');
assert.equal(typeof session.csrfToken, 'string');
const stream = await request('/api/ai-jobs/events?after=0');
assert.equal(stream.statusCode, 200);
assert.equal(stream.headers['content-type'], 'text/event-stream');
// Subscribe to the exact stream-end event BEFORE asking the real service to close it.
const ended = once(stream, 'end', { signal });
stream.resume();
await json('/__task7/disconnect-sse', 'POST');
await ended;
const counts = await json('/__task7/counts');
assert.equal(counts.providerCalls, 0);
assert.equal(counts.jobs, 0);
assert.equal(counts.activeBrowsers, 0);
assert.deepEqual(counts.errors, []);
assert.equal(counts.sseConnections.length, 1);
console.log(JSON.stringify({ workload: 'non-UI HTTP session/SSE', sessionEstablished: true, sseEnded: true, counts }));
