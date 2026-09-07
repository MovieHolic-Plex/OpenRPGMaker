import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Requires the checkout's already installed managed Chromium; never provisions it.
test('real Vite runner config retains installed executor availability after config loading', { timeout: 30000 }, async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'ai-jobs-vite-runtime-'));
  const names = ['AI_JOBS_DIRECTORY', 'VITE_CACHE_DIR', 'DEV_SERVER_NO_TLS'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.AI_JOBS_DIRECTORY = join(directory, 'jobs');
  process.env.VITE_CACHE_DIR = join(directory, 'vite-cache');
  process.env.DEV_SERVER_NO_TLS = '1';
  let server;
  try {
    server = await createServer({
      root, configFile: join(root, 'vite.config.ts'), configLoader: 'runner',
      server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const response = await fetch(`${origin}/api/ai-jobs/session`);
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.equal(session.generationAvailable, true);
    assert.equal(session.reportAvailable, true);
    assert.equal(session.requiresRestart, false);
    const admission = await fetch(`${origin}/api/ai-jobs`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: response.headers.get('set-cookie').split(';')[0],
        'X-AI-Jobs-CSRF': session.csrfToken,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'runtime-available-invalid-input',
      },
      body: '{}',
    });
    // Reach validation beyond the executor guard without scheduling paid work.
    assert.equal(admission.status, 400);
    assert.equal((await admission.json()).code, 'INVALID_DATA');
    assert.deepEqual((await (await fetch(`${origin}/api/ai-jobs`)).json()).jobs, []);
  } finally {
    try { if (server) await server.close(); }
    finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
      await rm(directory, { recursive: true, force: true });
    }
  }
});
