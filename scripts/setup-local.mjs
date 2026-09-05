import { lstatSync, openSync, fchmodSync, writeFileSync, fsyncSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Only these value-free errors may reach the terminal. Remote bodies and causes
// can contain credentials, so never include them in error messages or stacks.
export class SetupError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function requireNode24(version = process.versions.node) {
  if (!/^24\./.test(version)) throw new SetupError('NODE_VERSION', 'Install Node.js 24 LTS (including npm) from https://nodejs.org, then reopen Terminal. No tools were installed.');
}
function exists(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw new SetupError('CONFIG_IO', 'Cannot read this folder. Extract the checkout into a writable folder you own.'); }
}
export function runCommand(command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { shell: false, stdio: 'ignore', ...options });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => {
      cleanup();
      if (signal) reject(new SetupError('CANCELLED', 'Command cancelled. Any existing or partial install was preserved.'));
      else if (code === 0) resolveCommand();
      else reject(new Error('Command failed'));
    });
  });
}
export async function ensureDependencies(root, run = runCommand) {
  try { await run('npm', ['--version'], { cwd: root }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('NPM_MISSING', 'npm is required. Install Node.js 24 LTS including npm manually, then reopen Terminal.'); }
  if (exists(join(root, 'node_modules'))) return;
  try { await run('npm', ['ci'], { cwd: root, stdio: 'inherit' }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('INSTALL_FAILED', 'npm ci failed. Check the network and folder permissions. Any partial node_modules is preserved; move it aside yourself before retrying npm ci.'); }
}
export async function readConfiguration(root) {
  let loadEnv;
  try { ({ loadEnv } = await import('vite')); }
  catch { throw new SetupError('DEPENDENCIES_BROKEN', 'Cannot load Vite. Existing node_modules was not changed. Move a broken install aside yourself, then run npm ci in this folder.'); }
  let env;
  try { env = loadEnv('development', root, ''); }
  catch { throw new SetupError('CONFIG_IO', 'Cannot load the development env files. Ask the owner to check their dotenv syntax and permissions.'); }
  return {
    url: env.SUPABASE_UPSTREAM_URL ?? env.VITE_SUPABASE_URL ?? '',
    anonKey: env.SUPABASE_ANON_KEY ?? '',
    projectId: env.VITE_SUPABASE_PROJECT_ID ?? '',
    proxy: env.VITE_SUPABASE_USE_PROXY,
  };
}
export function validateConfig({ url, anonKey, projectId }) {
  let origin;
  try { origin = new URL(url); } catch { /* The value-free boundary error below covers parsing too. */ }
  if (!origin || !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(url) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new SetupError('INVALID_URL', 'Use your own HTTPS Supabase origin only (no credentials, path, query or fragment). HTTP is allowed only on loopback.');
  }
  let anon = /^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey);
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
    try { anon = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; }
    catch { anon = false; }
  }
  if (!anon) throw new SetupError('INVALID_KEY', 'Use an anon JWT or sb_publishable_ key from the owner. Admin, service_role, secret keys and database credentials are not accepted.');
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 200 || /[\p{C}\\'"`]/u.test(projectId)) {
    throw new SetupError('INVALID_PROJECT', 'Enter the existing application project id (not the Supabase project reference); no controls, quotes or backslashes, maximum 200 characters.');
  }
  return { url: origin.origin, anonKey, projectId: projectId.trim() };
}
export async function probeProject(config, { signal, timeoutMs = 10000 } = {}) {
  const { url, anonKey, projectId } = validateConfig(config);
  const query = new URLSearchParams({ select: 'project_id', project_id: `eq.${projectId}`, limit: '1' });
  const bounded = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(`${url}/rest/v1/projects?${query}`, {
      method: 'GET', redirect: 'manual', signal: signal ? AbortSignal.any([signal, bounded]) : bounded,
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Accept-Profile': 'rpg_zzu', Accept: 'application/json' },
    });
    if (response.status >= 300 && response.status < 400) throw new SetupError('PROBE_REDIRECT', 'Supabase redirected the probe. Ask the owner for the direct HTTPS origin; credentials were not forwarded.');
    if ([401, 403].includes(response.status)) throw new SetupError('PROBE_AUTH', 'Supabase denied read access. Ask the owner to check the anon key and project read permissions.');
    if ([400, 404, 406].includes(response.status)) throw new SetupError('PROBE_SCHEMA', 'The rpg_zzu projects API is unavailable. Ask the owner to provision/expose that schema. Setup does not run migrations.');
    if (!response.ok) throw new SetupError('PROBE_SERVER', 'Supabase returned a server error. Ask the owner to check service health, then retry.');
    // Limit both duration and bytes; a remote endpoint must not exhaust local memory.
    const reader = response.body.getReader();
    let body = ''; let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new SetupError('PROBE_RESPONSE', 'Supabase returned an unexpected project response. Ask the owner to check the endpoint.'); }
      body += decoder.decode(value, { stream: true });
    }
    let rows;
    try { rows = JSON.parse(body + decoder.decode()); }
    catch { throw new SetupError('PROBE_RESPONSE', 'Supabase returned invalid JSON. Check the Supabase origin with the owner.'); }
    if (!Array.isArray(rows)) throw new SetupError('PROBE_RESPONSE', 'Supabase returned an unexpected project response.');
    if (rows.length === 0) throw new SetupError('PROJECT_MISSING', 'The existing application project was not found or is not readable. Ask the owner for its project id and read access. Nothing was created.');
    if (rows.length !== 1 || rows[0]?.project_id !== projectId) throw new SetupError('PROBE_RESPONSE', 'Supabase did not return the requested project id. Check the endpoint with the owner.');
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError('PROBE_NETWORK', 'Supabase could not be reached, the request timed out, or setup was cancelled. Check network/TLS and retry.');
  } finally {
    if (response?.body && !response.body.locked) await response.body.cancel();
  }
}
export function readAnswer(label, { input = process.stdin, output = process.stdout, secret = false, signal } = {}) {
  if (!input.isTTY) return Promise.reject(new SetupError('TTY_REQUIRED', 'Setup needs an interactive Terminal to mask the key. Run npm run setup:local there; never pass keys as arguments.'));
  return new Promise((resolveAnswer, reject) => {
    let value = ''; const raw = input.isRaw;
    const finish = (error) => {
      input.off('data', data); input.off('end', cancelled); input.off('error', cancelled);
      signal?.removeEventListener('abort', cancelled);
      input.setRawMode(raw); input.pause(); output.write('\n');
      error ? reject(error) : resolveAnswer(value);
    };
    const cancelled = () => finish(new SetupError('CANCELLED', 'Setup cancelled. No configuration was written.'));
    const data = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004' || character === '\u001b') { cancelled(); return; }
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u007f' || character === '\b') {
          if (value) { value = [...value].slice(0, -1).join(''); output.write('\b \b'); }
        } else if (!/[\p{C}]/u.test(character)) {
          if (value.length >= 8192) { finish(new SetupError('INPUT_LONG', 'Input is too long. Setup cancelled.')); return; }
          value += character; output.write(secret ? '*' : character);
        }
      }
    };
    input.setRawMode(true); input.setEncoding('utf8');
    input.on('data', data); input.once('end', cancelled); input.once('error', cancelled);
    signal?.addEventListener('abort', cancelled, { once: true });
    output.write(label); input.resume();
    if (signal?.aborted) cancelled();
  });
}
async function askConfiguration(signal) {
  console.log('Use your own provisioned Supabase access and an EXISTING application project. This setup only reads; it creates no remote data. Ctrl-C cancels.');
  const url = await readAnswer('Supabase origin: ', { signal });
  const anonKey = await readAnswer('Anon / publishable key (masked): ', { secret: true, signal });
  const projectId = await readAnswer('Existing application project id: ', { signal });
  return { url, anonKey, projectId };
}
export async function setupLocal({ root, ask = askConfiguration, probe = probeProject, signal } = {}) {
  const path = join(root, '.env.local');
  if (exists(path)) throw new SetupError('CONFIG_EXISTS', '.env.local already exists and was not changed. Ask its owner to correct it privately, then restart.');
  // These override .env.local in Vite. Never silently save settings that will be ignored.
  if (['.env.development', '.env.development.local'].some(name => exists(join(root, name)))
    || ['SUPABASE_UPSTREAM_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_USE_PROXY', 'VITE_SUPABASE_ANON_KEY'].some(name => process.env[name] !== undefined)) {
    throw new SetupError('CONFIG_PRECEDENCE', 'Development-mode files or shell settings take precedence. Ask the owner to configure those privately, or use a clean checkout/Terminal. Existing settings were not changed.');
  }
  let config;
  try { config = validateConfig(await ask(signal)); await probe(config, { signal }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('SETUP_FAILED', 'Setup failed or was cancelled before writing. Check the supplied settings and retry.'); }
  if (signal?.aborted) throw new SetupError('CANCELLED', 'Setup cancelled. No configuration was written.');
  const values = { SUPABASE_UPSTREAM_URL: config.url, SUPABASE_ANON_KEY: config.anonKey, VITE_SUPABASE_USE_PROXY: '1', VITE_SUPABASE_PROJECT_ID: config.projectId, VITE_SUPABASE_ANON_KEY: '' };
  // dotenv-expand expands even single-quoted dollars. Escape them for exact Vite round-trip.
  const text = '# Private local settings. Do not share or commit this file.\n' + Object.entries(values).map(([name, value]) => `${name}='${value.replaceAll('$', '\\$')}'\n`).join('');
  let fd;
  try {
    fd = openSync(path, 'wx', 0o600);
    fchmodSync(fd, 0o600); // Keep owner access even under a restrictive inherited umask.
    writeFileSync(fd, text); fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) unlinkSync(path);
    throw new SetupError(error.code === 'EEXIST' ? 'CONFIG_EXISTS' : 'CONFIG_WRITE', error.code === 'EEXIST' ? '.env.local appeared during setup and was not changed.' : 'Could not write private settings. Check folder permissions and free space, then retry.');
  } finally { if (fd !== undefined) closeSync(fd); }
  return config;
}
export function reportError(error) {
  console.error(error instanceof SetupError ? `${error.code}: ${error.message}` : 'START_FAILED: Startup failed. Existing settings were not changed. Check Node 24, dependencies and folder permissions.');
  process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  try {
    requireNode24();
    if (process.argv.length > 2) throw new SetupError('ARGUMENTS', 'Setup accepts no arguments. Enter credentials only at the masked Terminal prompt.');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    process.chdir(root);
    await ensureDependencies(root);
    await setupLocal({ root, signal: controller.signal });
    console.log('Private .env.local created (0600). Launch with Start RPG Maker.command or npm run mac:launch.');
  } catch (error) { reportError(error); }
  finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
}
