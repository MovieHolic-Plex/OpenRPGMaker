import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectHostArgs } from '../scripts/start-preview.mjs';

async function existingProject(t) {
  const dir = await mkdtemp(join(tmpdir(), 'oprn-host 한글 '));
  // The launcher checks existence; SQLite validity belongs to the host.
  await writeFile(join(dir, 'project.sqlite'), 'existing');
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const options = args => Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => args.slice(i * 2, i * 2 + 2)));

test('missing storage refuses to launch instead of serving a memory-only editor', () => {
  assert.throws(() => projectHostArgs([], {}, {}), /OPRN_PROJECT_DIR/);
  assert.throws(() => projectHostArgs(['--project-dir'], {}), /값이 필요/);
  assert.throws(() => projectHostArgs(['--project-dir', '--port', '9888'], {}), /값이 필요/);
  assert.throws(() => projectHostArgs(['--unknown', 'value'], {}), /알 수 없는/);
});

test('configured existing project keeps the mdc address and path as one argument', async t => {
  const dir = await existingProject(t);
  const result = options(projectHostArgs([], { OPRN_PROJECT_DIR: dir }));
  assert.equal(result['--project-dir'], dir);
  assert.equal(result['--host'], '0.0.0.0');
  assert.equal(result['--port'], '9888');
  assert.equal(result['--public-origin'], 'http://mdc-server:9888');
});

test('CLI wins over process and file settings; relative folders resolve from repo root', async t => {
  const dir = await existingProject(t);
  const result = options(projectHostArgs(['--project-dir', '.', '--public-origin', 'http://studio:9000', '--port', '9000', '--host', '127.0.0.1', '--dist', '/bundle', '--bridge', '/bridge.js'],
    { OPRN_PROJECT_DIR: '/wrong', OPRN_PUBLIC_ORIGIN: 'http://wrong' }, { OPRN_PROJECT_DIR: '/also-wrong' }, dir));
  assert.equal(result['--project-dir'], dir);
  assert.equal(result['--public-origin'], 'http://studio:9000');
  assert.equal(result['--port'], '9000');
  assert.equal(result['--host'], '127.0.0.1');
  assert.equal(result['--dist'], '/bundle');
  assert.equal(result['--bridge'], '/bridge.js');
  assert.equal(options(projectHostArgs([], { OPRN_PROJECT_DIR: dir }, { OPRN_PROJECT_DIR: '/wrong' }))['--project-dir'], dir);
  assert.equal(options(projectHostArgs([], {}, { OPRN_PROJECT_DIR: dir }))['--project-dir'], dir);
});

test('a typo does not initialize a blank replacement project', async t => {
  const dir = await existingProject(t);
  const missing = join(dir, 'typo');
  assert.throws(() => projectHostArgs([], { OPRN_PROJECT_DIR: missing }), /기존 project.sqlite/);
});
