import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupError, requireNode24, ensureDependencies, readConfiguration, validateConfig, probeProject, setupLocal, runCommand, reportError } from './setup-local.mjs';

const ORIGIN = 'http://127.0.0.1:9999';
const openBrowser = url => runCommand(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [url]);

export async function launchServer({ root, projectId, createServer, open = openBrowser, signals = process, log = console.log }) {
  const url = new URL('/', ORIGIN);
  url.searchParams.set('project', projectId);
  let server; let ready = false; let stopped = false; let closing;
  const completed = Promise.withResolvers();
  // A signal during create/listen is latched: never start or open after cancellation.
  const stop = () => { stopped = true; if (ready) void close(); };
  const close = () => {
    stopped = true;
    if (!closing) closing = (async () => {
      try { if (server) await server.close(); completed.resolve(); }
      catch { completed.reject(new SetupError('CLOSE_FAILED', 'Vite could not close cleanly. Close this Terminal process before restarting.')); }
      finally { signals.off('SIGINT', stop); signals.off('SIGTERM', stop); }
    })();
    return closing;
  };
  signals.on('SIGINT', stop); signals.on('SIGTERM', stop);
  try {
    server = await createServer({ root, configLoader: 'runner', mode: 'development', server: { host: '127.0.0.1', port: 9999, strictPort: true, https: false, open: false } });
    if (stopped) throw new SetupError('CANCELLED', 'Launch cancelled.');
    await server.listen();
    if (stopped) throw new SetupError('CANCELLED', 'Launch cancelled.');
    ready = true;
    log(`RPG Maker is listening: ${url.href}`);
    log('Keep this Terminal open. Ctrl-C stops this server. Online saving requires Supabase access; export JSON for a separate backup.');
    if (open) {
      try { await open(url.href); }
      catch { log(`Browser could not open. Open this URL yourself: ${url.href}`); }
    }
    return { url: url.href, closed: completed.promise, close };
  } catch (error) {
    await close();
    await completed.promise;
    if (error instanceof SetupError) throw error;
    if (error.code === 'EADDRINUSE' || /^Port \d+ is already in use$/.test(error.message)) {
      throw new SetupError('PORT_BUSY', 'Port 9999 is already in use. No browser was opened and no other server was stopped. Close your earlier launcher Terminal yourself, then retry.');
    }
    throw new SetupError('VITE_START', 'Vite could not start. Check folder permissions and dependencies. Existing node_modules is preserved; move a broken install aside yourself, then run npm ci.');
  }
}

async function main() {
  requireNode24();
  if (process.argv.slice(2).some(arg => arg !== '--no-open')) throw new SetupError('ARGUMENTS', 'Only --no-open is supported. Never pass credentials as arguments.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.chdir(root); // Existing Vite config uses process.cwd() for env precedence.
  await ensureDependencies(root);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  let config;
  try {
    const existing = await readConfiguration(root);
    if (!existing.url || !existing.anonKey || !existing.projectId) {
      config = await setupLocal({ root, signal: controller.signal });
    } else {
      if (!['1', 'true'].includes(existing.proxy)) throw new SetupError('PROXY_REQUIRED', 'Set VITE_SUPABASE_USE_PROXY=1 and server-only SUPABASE_ANON_KEY in your private configuration, then restart. Existing files were not changed.');
      config = validateConfig(existing);
      await probeProject(config, { signal: controller.signal });
    }
    if (controller.signal.aborted) throw new SetupError('CANCELLED', 'Launch cancelled.');
  } finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
  // Override runtime settings only. Never rewrite existing env files, leak a
  // legacy VITE key into the browser, inherit TLS, or reuse a worktree port.
  process.env.DEV_SERVER_NO_TLS = '1';
  process.env.RPG_ZZU_PUBLIC_ORIGIN = ORIGIN;
  process.env.VITE_SUPABASE_ANON_KEY = '';
  // Vite must use exactly the normalized snapshot that passed the probe, even
  // if an env file changes while the request is in flight.
  process.env.SUPABASE_UPSTREAM_URL = config.url;
  process.env.SUPABASE_ANON_KEY = config.anonKey;
  process.env.VITE_SUPABASE_PROJECT_ID = config.projectId;
  process.env.VITE_SUPABASE_USE_PROXY = '1';
  try { await runCommand('bun', ['--version']); }
  catch (error) { if (error instanceof SetupError) throw error; console.log('Optional: Bun is not available. Editing and Node provider login still work; AI completions require Bun and a configured provider. Nothing was installed.'); }
  let createServer;
  try { ({ createServer } = await import('vite')); }
  catch { throw new SetupError('DEPENDENCIES_BROKEN', 'Cannot load Vite. Move a broken node_modules aside yourself, then run npm ci.'); }
  const running = await launchServer({ root, projectId: config.projectId, createServer, open: process.argv.includes('--no-open') ? false : openBrowser });
  await running.closed;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(reportError);
}
