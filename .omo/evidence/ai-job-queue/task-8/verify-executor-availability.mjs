import assert from 'node:assert/strict';
import { access, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
// Resolve from the checkout, never a global/package-version fallback.
const projectRequire = createRequire(join(root, 'package.json'));
const { chromium } = projectRequire('playwright');
const executablePath = chromium.executablePath();
const evidence = {
  node: process.version, execPath: process.execPath, root,
  nodeModules: await realpath(join(root, 'node_modules')),
  playwrightEntry: projectRequire.resolve('playwright'),
  playwrightVersion: projectRequire('playwright/package.json').version,
  testVersion: projectRequire('@playwright/test/package.json').version,
  executablePath, home: process.env.HOME, tmpdir: process.env.TMPDIR,
  playwrightEnv: Object.keys(process.env).filter(key => key.startsWith('PLAYWRIGHT_')),
};
assert.equal(process.env.TMPDIR, '/dev/shm');
await access(executablePath, constants.X_OK);
evidence.executableAccess = 'X_OK';
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath, timeout: 15000 });
  evidence.browserVersion = browser.version();
} finally {
  if (browser) { await browser.close(); evidence.browserClosed = true; }
}
const directory = await mkdtemp('/dev/shm/task8-executor-proof-');
const previous = Object.fromEntries(['AI_JOBS_DIRECTORY', 'VITE_CACHE_DIR', 'DEV_SERVER_NO_TLS'].map(key => [key, process.env[key]]));
process.env.AI_JOBS_DIRECTORY = join(directory, 'jobs');
process.env.VITE_CACHE_DIR = join(directory, 'vite-cache');
process.env.DEV_SERVER_NO_TLS = '1';
const origin = 'http://127.0.0.1:19841';
const streamController = new AbortController();
let server, reader, streamWork;
try {
  server = await createServer({
    configFile: join(root, 'vite.config.ts'), configLoader: 'runner',
    server: { host: '127.0.0.1', port: 19841, strictPort: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  await server.listen();
  evidence.ownedListener = { pid: process.pid, origin, configLoader: 'runner' };
  const response = await fetch(`${origin}/api/ai-jobs/session`, { signal: AbortSignal.timeout(10000) });
  const { csrfToken, ...session } = await response.json();
  evidence.session = session;
  assert.equal(session.generationAvailable, true);
  assert.equal(session.reportAvailable, true);
  const headers = { Origin: origin, Cookie: response.headers.get('set-cookie').split(';')[0], 'X-AI-Jobs-CSRF': csrfToken, 'Content-Type': 'application/json' };
  const stream = await fetch(`${origin}/api/ai-jobs/events`, { signal: AbortSignal.any([streamController.signal, AbortSignal.timeout(30000)]) });
  reader = stream.body.getReader();
  const admitted = Promise.withResolvers();
  const decoder = new TextDecoder();
  streamWork = (async () => {
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error('SSE ended before admitted event');
      pending += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        const data = block.split('\n').find(line => line.startsWith('data: '));
        if (data) {
          const event = JSON.parse(data.slice(6));
          if (event.kind === 'admitted') { admitted.resolve(event); return; }
        }
      }
    }
  })().catch(error => { admitted.reject(error); throw error; });
  // Observe rejection immediately while the POST is in flight.
  admitted.promise.catch(() => {}); streamWork.catch(() => {});
  const post = (path, body, extra = {}) => fetch(`${origin}/api/ai-jobs${path}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  // Deliberately invalid family payload cannot reach a provider even if execution
  // wins the cancellation race. This is admission-only, not generation evidence.
  const submission = { input: { version: 1, family: 'assistant', project: { backend: session.configuredBackend, projectId: 'task8-executor-availability-isolated-fixture' }, target: {}, mode: 'review', payload: {}, dependsOn: [] }, projectSnapshot: { maps: [] }, artwork: [] };
  const admission = await post('', submission, { 'Idempotency-Key': 'task8-executor-availability' });
  const receipt = await admission.json();
  evidence.admission = { status: admission.status, created: receipt.created, jobId: receipt.job?.id, project: receipt.job?.project };
  assert.equal(admission.status, 202);
  evidence.admittedEvent = await admitted.promise;
  assert.equal(evidence.admittedEvent.jobId, receipt.job.id);
  const cancelled = await post(`/${receipt.job.id}/cancel`, {});
  evidence.cancel = { status: cancelled.status, generation: (await cancelled.json()).job.generation };
  assert.equal(cancelled.status, 200);
  const detail = await (await fetch(`${origin}/api/ai-jobs/${receipt.job.id}`, { signal: AbortSignal.timeout(10000) })).json();
  evidence.providerOperations = detail.operations;
  assert.equal(detail.operations.length, 0);
  assert.deepEqual(detail.job.project, submission.input.project);
  evidence.userProjectWrites = 0;
} finally {
  try {
    if (reader) await reader.cancel();
    if (streamWork) await streamWork;
  } finally {
    streamController.abort();
    try { if (server) { await server.close(); evidence.ownedServerClosed = true; } }
    finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      await rm(directory, { recursive: true, force: true });
      evidence.privateDirectoryRemoved = true;
    }
  }
}
await writeFile(new URL('./executor-installed-admission.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
