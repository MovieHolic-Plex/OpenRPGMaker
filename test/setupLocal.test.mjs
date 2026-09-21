import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupLocal, readConfiguration, prepareProject, validateConfig, requireNode24, ensureDependencies } from '../scripts/setup-local.mjs';

async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'oprn setup 한글 '));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}

test('private folder settings preserve existing env and use owner-only permissions', async t => {
  const root = await directory(t); await writeFile(join(root, '.env.local'), 'OTHER_SETTING=preserved\n');
  let prepared;
  const config = await setupLocal({ root, ask: async () => ({ projectDir: 'my game' }), prepare: async value => { prepared = value; } });
  assert.equal(config.projectDir, join(root, 'my game')); assert.deepEqual(prepared, config);
  assert.deepEqual(await readConfiguration(root, {}), config);
  assert.equal(await readFile(join(root, '.env.local'), 'utf8'), 'OTHER_SETTING=preserved\n');
  assert.equal((await stat(join(root, '.oprn-local.json'))).mode & 0o777, 0o600);
  await assert.rejects(setupLocal({ root }), { code: 'CONFIG_EXISTS' });
});

test('preparation failure or cancellation cannot publish settings', async t => {
  const root = await directory(t);
  await assert.rejects(setupLocal({ root, ask: async () => ({ projectDir: 'game' }), prepare: async () => { throw new Error('cannot open'); } }));
  await assert.rejects(stat(join(root, '.oprn-local.json')), { code: 'ENOENT' });
  const signal = AbortSignal.abort(); let prepared = false;
  await assert.rejects(setupLocal({ root, signal, ask: async () => ({ projectDir: 'game' }), prepare: async () => { prepared = true; } }));
  assert.equal(prepared, false);
});

test('existing non-project folder is never initialized over user files', async t => {
  const root = await directory(t); let initialized = false;
  await assert.rejects(prepareProject({ projectDir: root }, { initialize: async () => { initialized = true; }, open: async () => {} }), { code: 'PROJECT_MISSING' });
  assert.equal(initialized, false);
});

test('existing database is opened and closed, new folder is initialized and closed', async t => {
  const root = await directory(t); await writeFile(join(root, 'project.sqlite'), 'fixture');
  const calls = []; const store = { info: () => ({ projectId: 'fixture' }), close: () => calls.push('close') };
  const adapters = { initialize: async () => { calls.push('init'); return store; }, open: async () => { calls.push('open'); return store; } };
  await prepareProject({ projectDir: root }, adapters);
  await prepareProject({ projectDir: join(root, 'new') }, adapters);
  assert.deepEqual(calls, ['open', 'close', 'init', 'close']);
});

test('Node requirement, explicit path precedence, and dependency preservation', async t => {
  const root = await directory(t);
  assert.throws(() => requireNode24('22.1.0'), { code: 'NODE_VERSION' }); requireNode24('24.11.1');
  assert.throws(() => validateConfig({ projectDir: '' }), { code: 'INVALID_PROJECT' });
  assert.deepEqual(await readConfiguration(root, { OPRN_PROJECT_DIR: 'chosen' }), { projectDir: join(root, 'chosen') });
  const calls = []; const run = async (_cmd, args) => calls.push(args);
  await ensureDependencies(root, run); await mkdir(join(root, 'node_modules')); await ensureDependencies(root, run);
  assert.deepEqual(calls, [['--version'], ['ci'], ['--version']]);
});
