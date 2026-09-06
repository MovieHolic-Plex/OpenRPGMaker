import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const root = '.omo/evidence/life-full-20260906/39';
const jobs = {
  typecheck: [300, 'npm', 'run', 'typecheck:app'],
  build: [600, 'npm', 'run', 'build'],
  browser: [600, 'node', `${root}/browser-proof.mjs`],
  firefox: [600, 'env', 'TASK39_BROWSER=firefox', 'node', `${root}/browser-proof.mjs`],
  index: [120, 'npm', 'run', 'openwiki:index', '--', '--check'],
};
const name = process.argv[2];
const [seconds, ...command] = jobs[name];
const args = ['--timeout', '900', '/tmp/rpg-zzu-life-full-qa-01a0727b.lock', 'timeout', String(seconds), ...command];
const started = new Date().toISOString();
const result = spawnSync('flock', args, { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
  env: { ...process.env, VITE_CACHE_DIR: `/tmp/st_01a0759d-${name}-cache` } });
writeFileSync(`${root}/${name}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
const receipt = { command: ['flock', ...args], started, finished: new Date().toISOString(), exit: result.status, signal: result.signal,
  head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {encoding: 'utf8'}).trim(), error: result.error?.message };
writeFileSync(`${root}/${name}.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
process.exitCode = result.status ?? 1;
