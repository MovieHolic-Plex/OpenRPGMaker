import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { loadEnv } from 'vite';

// Setup fixtures own their configuration; inherited developer credentials must
// not override temporary files. Individual precedence tests still set real env.
const configEnvKeys = [
  'SUPABASE_UPSTREAM_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_USE_PROXY', 'VITE_SUPABASE_ANON_KEY',
];
const inheritedConfigEnv = new Map(configEnvKeys.map(name => [name, process.env[name]]));
beforeEach(() => {
  for (const name of configEnvKeys) delete process.env[name];
});
afterEach(() => {
  for (const [name, value] of inheritedConfigEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const api = () => import('../scripts/setup-local.mjs');
const key = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
const config = { url: 'https://example.supabase.co', anonKey: key, projectId: 'existing project 한글 & #$HOME' };
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'RPG setup 한글 '));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function http(t, handler) {
  const server = createServer(handler);
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test('fresh setup probes before writing exclusive private config, round-trips through Vite', async t => {
  const { setupLocal } = await api();
  const root = await directory(t);
  let probes = 0;
  await setupLocal({ root, ask: async () => config, probe: async actual => {
    assert.deepEqual(actual, config);
    assert.deepEqual(await readdir(root), []);
    probes++;
  } });
  assert.equal(probes, 1);
  const file = join(root, '.env.local');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const env = loadEnv('development', root, '');
  assert.equal(env.SUPABASE_UPSTREAM_URL, config.url);
  assert.equal(env.SUPABASE_ANON_KEY, key);
  assert.equal(env.VITE_SUPABASE_PROJECT_ID, config.projectId);
  assert.equal(env.VITE_SUPABASE_USE_PROXY, '1');
  assert.equal(env.VITE_SUPABASE_ANON_KEY, '');
});

test('existing env files and exclusive-create races cannot be overwritten', async t => {
  const { setupLocal } = await api();
  const root = await directory(t);
  await writeFile(join(root, '.env'), 'UNRELATED="keep # $literal"\n');
  await setupLocal({ root, ask: async () => config, probe: async () => {} });
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'UNRELATED="keep # $literal"\n');
  const before = await readFile(join(root, '.env.local'));
  await assert.rejects(setupLocal({ root, ask: async () => assert.fail('must not prompt') }), { code: 'CONFIG_EXISTS' });
  assert.deepEqual(await readFile(join(root, '.env.local')), before);
  const raced = await directory(t);
  await assert.rejects(setupLocal({ root: raced, ask: async () => config, probe: async () => {
    await writeFile(join(raced, '.env.local'), 'another owner');
  } }), { code: 'CONFIG_EXISTS' });
  assert.equal(await readFile(join(raced, '.env.local'), 'utf8'), 'another owner');
});

test('cancellation, invalid input, probe failure leave no partial configuration or secret error', async t => {
  const { setupLocal } = await api();
  for (const options of [
    { ask: async () => { throw new Error('cancelled'); } },
    { ask: async () => ({ ...config, anonKey: 'sb_secret_dangerous' }) },
    { ask: async () => config, probe: async () => { throw new Error(key); } },
  ]) {
    const root = await directory(t);
    await assert.rejects(setupLocal({ root, ...options }), error => !String(error).includes(key));
    assert.deepEqual(await readdir(root), []);
  }
});

test('validation rejects admin credentials and unsafe origins without reflecting supplied values', async () => {
  const { validateConfig } = await api();
  const admin = `e30.${Buffer.from('{"role":"service_role"}').toString('base64url')}.sig`;
  for (const anonKey of [admin, 'sb_secret_private', 'postgres://user:password@host/db', 'unknown', `${key}\n`]) {
    assert.throws(() => validateConfig({ ...config, anonKey }), error => error.code === 'INVALID_KEY' && !String(error).includes(anonKey));
  }
  for (const url of ['http://remote.example', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com/?key=secret', 'https://example.com/#secret', 'file:///tmp/x', 'https://example.com\\@evil.test', 'https://example.com\n']) {
    assert.throws(() => validateConfig({ ...config, url }), { code: 'INVALID_URL' });
  }
  for (const projectId of ['', 'x\ny', 'x\\y', 'x"y']) {
    assert.throws(() => validateConfig({ ...config, projectId }), { code: 'INVALID_PROJECT' });
  }
  for (const url of ['http://127.0.0.1:8100', 'http://localhost:8100', 'http://[::1]:8100', config.url]) {
    assert.equal(validateConfig({ ...config, url }).url, url);
  }
  assert.equal(validateConfig({ ...config, anonKey: 'sb_publishable_example123' }).anonKey, 'sb_publishable_example123');
});

test('probe makes only bounded GET with schema, encoded exact project filter and private headers', async t => {
  const { probeProject } = await api();
  const url = await http(t, (req, res) => {
    assert.equal(req.method, 'GET');
    const request = new URL(req.url, 'http://localhost');
    assert.equal(request.pathname, '/rest/v1/projects');
    assert.equal(request.searchParams.get('project_id'), `eq.${config.projectId}`);
    assert.equal(request.searchParams.get('select'), 'project_id');
    assert.equal(request.searchParams.get('limit'), '1');
    assert.equal(req.headers['accept-profile'], 'rpg_zzu');
    assert.equal(req.headers.apikey, key);
    assert.equal(req.headers.authorization, `Bearer ${key}`);
    res.end(JSON.stringify([{ project_id: config.projectId }]));
  });
  await probeProject({ ...config, url });
});

test('probe rejects redirects without forwarding credentials and classifies remote failures', async t => {
  const { probeProject } = await api();
  let redirected = 0;
  const target = await http(t, (_req, res) => { redirected++; res.end('[]'); });
  for (const [status, body, code] of [[302, '', 'PROBE_REDIRECT'], [401, key, 'PROBE_AUTH'], [403, key, 'PROBE_AUTH'], [404, key, 'PROBE_SCHEMA'], [406, key, 'PROBE_SCHEMA'], [200, '[]', 'PROJECT_MISSING'], [200, '{}', 'PROBE_RESPONSE'], [200, 'bad json', 'PROBE_RESPONSE'], [500, key, 'PROBE_SERVER']]) {
    const url = await http(t, (_req, res) => { res.writeHead(status, { Location: target }); res.end(body); });
    await assert.rejects(probeProject({ ...config, url }), error => error.code === code && !String(error).includes(key));
  }
  assert.equal(redirected, 0);
});

test('probe cancellation observes a real request before abort, not a sleep', { timeout: 10000 }, async t => {
  const { probeProject } = await api();
  const received = Promise.withResolvers();
  const url = await http(t, (_req, res) => { received.resolve(); res.on('close', () => res.destroy()); });
  const controller = new AbortController();
  const pending = probeProject({ ...config, url }, { signal: controller.signal });
  const rejected = assert.rejects(pending, { code: 'PROBE_NETWORK' });
  await received.promise;
  controller.abort();
  await rejected;
});

test('masked terminal input never echoes key and restores raw mode on completion and cancellation', async () => {
  const { readAnswer } = await api();
  for (const ending of ['\r', '\u0003']) {
    const input = new PassThrough(); input.isTTY = true; input.isRaw = false;
    const raw = []; input.setRawMode = value => { raw.push(value); input.isRaw = value; };
    let text = '';
    const output = new Writable({ write(chunk, _encoding, callback) { text += chunk; callback(); } });
    const answer = readAnswer('Key: ', { input, output, secret: true });
    const checked = ending === '\r' ? answer.then(value => assert.equal(value, key)) : assert.rejects(answer, { code: 'CANCELLED' });
    input.write(key + ending);
    await checked;
    assert.equal(text.includes(key), false);
    assert.deepEqual(raw, [true, false]);
    assert.equal(input.listenerCount('data'), 0);
  }
});


test('configuration uses Vite development precedence and process overrides without changing files', async t => {
  const { readConfiguration, setupLocal } = await api();
  const root = await directory(t);
  const files = ['.env', '.env.local', '.env.development', '.env.development.local'];
  for (const [index, file] of files.entries()) {
    await writeFile(join(root, file), `VITE_SUPABASE_PROJECT_ID='project-${index}'\n`);
    assert.equal((await readConfiguration(root)).projectId, `project-${index}`);
  }
  const original = process.env.VITE_SUPABASE_PROJECT_ID;
  try {
    process.env.VITE_SUPABASE_PROJECT_ID = 'shell-project';
    assert.equal((await readConfiguration(root)).projectId, 'shell-project');
  } finally {
    if (original === undefined) delete process.env.VITE_SUPABASE_PROJECT_ID;
    else process.env.VITE_SUPABASE_PROJECT_ID = original;
  }
  for (const [index, file] of files.entries()) assert.equal(await readFile(join(root, file), 'utf8'), `VITE_SUPABASE_PROJECT_ID='project-${index}'\n`);
  await rm(join(root, '.env.local'));
  await assert.rejects(setupLocal({ root, ask: () => assert.fail('must not prompt over higher-precedence settings') }), { code: 'CONFIG_PRECEDENCE' });
});

test('setup rejects symlink targets and cannot write after cancellation during the probe', async t => {
  const { setupLocal } = await api();
  const { symlink } = await import('node:fs/promises');
  const root = await directory(t);
  await writeFile(join(root, 'private-target'), 'unchanged');
  await symlink(join(root, 'private-target'), join(root, '.env.local'));
  await assert.rejects(setupLocal({ root }), { code: 'CONFIG_EXISTS' });
  assert.equal(await readFile(join(root, 'private-target'), 'utf8'), 'unchanged');
  const empty = await directory(t);
  const controller = new AbortController();
  await assert.rejects(setupLocal({ root: empty, ask: async () => config, signal: controller.signal, probe: async () => controller.abort() }), { code: 'CANCELLED' });
  assert.deepEqual(await readdir(empty), []);
});

test('noninteractive key entry fails closed without reading a piped key', async () => {
  const { readAnswer } = await api();
  const input = new PassThrough();
  await assert.rejects(readAnswer('Key: ', { input, secret: true }), { code: 'TTY_REQUIRED' });
  assert.equal(input.listenerCount('data'), 0);
});

test('probe bounds response size and validates returned identity', async t => {
  const { probeProject } = await api();
  for (const body of ['x'.repeat(65537), JSON.stringify([{ project_id: 'wrong-project' }])]) {
    const url = await http(t, (_req, res) => res.end(body));
    await assert.rejects(probeProject({ ...config, url }), { code: 'PROBE_RESPONSE' });
  }
});


test('private mode remains exactly 0600 under a restrictive inherited umask', async t => {
  const { setupLocal } = await api();
  const root = await directory(t);
  const original = process.umask(0o777);
  try { await setupLocal({ root, ask: async () => config, probe: async () => {} }); }
  finally { process.umask(original); }
  assert.equal((await stat(join(root, '.env.local'))).mode & 0o777, 0o600);
});

test('origin-only validation does not accept URL-normalized paths or empty credential syntax', async () => {
  const { validateConfig } = await api();
  for (const url of ['https://example.com/path/..', 'https://@example.com', 'https://example.com/?', 'https://example.com/#']) {
    assert.throws(() => validateConfig({ ...config, url }), { code: 'INVALID_URL' });
  }
});


test('generated private settings override conflicting base env through Vite without mutating the base file', async t => {
  const { setupLocal, readConfiguration } = await api();
  const root = await directory(t);
  const base = [
    'VITE_SUPABASE_URL=https://old.example',
    'SUPABASE_UPSTREAM_URL=${VITE_SUPABASE_URL}',
    'SUPABASE_ANON_KEY=sb_secret_old_admin_key',
    'VITE_SUPABASE_ANON_KEY=old_browser_key',
    'VITE_SUPABASE_PROJECT_ID=old-project',
    'VITE_SUPABASE_USE_PROXY=0',
    'UNRELATED="keep # base value"',
    '',
  ].join('\n');
  const basePath = join(root, '.env');
  await writeFile(basePath, base, { mode: 0o640 });
  const before = await stat(basePath);
  const requested = { ...config, projectId: '기존 프로젝트 #$HOME ${PATH} &=$SUPABASE_ANON_KEY' };
  await setupLocal({ root, ask: async () => requested, probe: async actual => assert.deepEqual(actual, requested) });
  assert.deepEqual(await readConfiguration(root), { ...requested, proxy: '1' });
  const effective = loadEnv('development', root, '');
  assert.equal(effective.VITE_SUPABASE_ANON_KEY, '');
  assert.equal(effective.UNRELATED, 'keep # base value');
  assert.equal(await readFile(basePath, 'utf8'), base);
  const after = await stat(basePath);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mode, before.mode);
  assert.equal(after.mtimeMs, before.mtimeMs);
  const privateBytes = await readFile(join(root, '.env.local'));
  await assert.rejects(setupLocal({ root, ask: () => assert.fail('existing configuration must not prompt') }), { code: 'CONFIG_EXISTS' });
  assert.deepEqual(await readFile(join(root, '.env.local')), privateBytes);
  assert.equal(await readFile(basePath, 'utf8'), base);
});
