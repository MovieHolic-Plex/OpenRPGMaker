import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveRequestApiKey } from '../aiAuthRuntime.ts';
import { rejectSecrets } from './providerOperations.mjs';

function notDispatched(message) { return Object.assign(new Error(message), { code: 'PROVIDER_NOT_DISPATCHED' }); }
/** One job-owned Bun process per physical operation. Auth stays in Node; never in Chromium. */
export function createJobProviderAdapter({ resolveKey = resolveRequestApiKey, spawnWorker = spawn, wireFetch = fetch } = {}) {
  return async (request, { signal }) => {
    rejectSecrets(request);
    if (!request || !['text', 'image'].includes(request.kind)
      || !['google-antigravity', 'openai-codex'].includes(request.provider)
      || !request.body || typeof request.body !== 'object' || Array.isArray(request.body)
      || Object.keys(request).some(key => !['kind', 'provider', 'body'].includes(key))
      || Object.keys(request.body).some(key => !['model', 'messages', 'stream', 'max_tokens', 'tools', 'tool_choice', 'response_format', 'temperature', 'reasoning', 'prompt', 'size', 'aspectRatio', 'imageSize', 'n'].includes(key))) {
      throw notDispatched('Only known text/image provider operations are supported; arbitrary URLs/options are not accepted');
    }
    signal.throwIfAborted();
    let apiKey;
    try { apiKey = await resolveKey(request.provider); }
    catch { throw notDispatched('Provider authentication unavailable; reconnect in existing provider settings'); }
    signal.throwIfAborted();
    const child = spawnWorker('bun', [fileURLToPath(new URL('../../oh-my-pi-worker.ts', import.meta.url))], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RPG_ZZU_OH_MY_PI_WORKER_PORT: '0', RPG_ZZU_AI_JOB_SINGLE_DISPATCH: '1' },
    });
    let exited = false;
    const closed = new Promise(resolve => child.once('close', () => { exited = true; resolve(); }));
    const controller = new AbortController();
    const abort = () => { controller.abort(signal.reason); if (!exited) child.kill('SIGKILL'); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let timer;
    try {
      const port = await new Promise((resolve, reject) => {
        let output = '';
        timer = setTimeout(() => reject(notDispatched('Bun provider worker startup timed out')), 30_000);
        child.stdout.on('data', chunk => {
          output += String(chunk);
          const ready = output.match(/READY (\d+)/);
          if (ready) resolve(Number(ready[1]));
        });
        // Drain stderr, but never expose provider/auth internals to job blobs.
        child.stderr.resume();
        child.once('error', () => reject(notDispatched('Bun provider worker is unavailable')));
        child.once('close', () => { controller.abort(); reject(notDispatched('Bun provider worker exited before dispatch')); });
      });
      clearTimeout(timer);
      signal.throwIfAborted();
      // Past this point any exception is an unknown physical outcome, never safe-to-retry.
      const response = await wireFetch(`http://127.0.0.1:${port}/${request.kind === 'text' ? 'complete' : 'image'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: request.provider, body: { ...request.body, stream: false }, apiKey }), signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Provider operation failed (${response.status}); physical outcome may be unknown`);
      const payload = await response.json();
      rejectSecrets(payload);
      return request.kind === 'text' ? payload.completion : payload;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (!exited) child.kill('SIGKILL');
      await closed;
    }
  };
}
