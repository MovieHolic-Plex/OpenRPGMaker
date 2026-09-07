#!/usr/bin/env node
// Parent-owned, one-shot paired execution. No product writes or fallback runner.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(join(here, 'manifest.json'), 'utf8'));
const selection = JSON.parse(fs.readFileSync(join(here, 'selection.json'), 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = path => sha(fs.readFileSync(path));
const json = (path, value) => fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const check = (ok, message) => { if (!ok) throw new Error(message); };
const git = (root, args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
const now = () => new Date().toISOString();
const productPath = p => !p.split('/').includes('CLAUDE.md') && (/^(src|test|scripts|public|vendor|docs|openwiki|\.vite-cache)\//.test(p) || !p.includes('/'));
function identity(root) {
  const [head, tree] = git(root, ['rev-parse', 'HEAD', 'HEAD^{tree}']).trim().split('\n');
  const status = git(root, ['status', '--porcelain=v1', '--untracked-files=no']);
  const files = git(root, ['ls-files', '-z']).split('\0').filter(p => p && productPath(p)).sort();
  const digest = sha(JSON.stringify(files.map(p => [p, fs.lstatSync(join(root, p)).isSymbolicLink() ? fs.readlinkSync(join(root, p)) : hash(join(root, p))])));
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(p => p && productPath(p));
  return { head, tree, status, productFiles: files.length, productSha256: digest, untracked };
}
function cleanIdentity(root, expectedHead) {
  const result = identity(root);
  check(result.head === expectedHead, `HEAD changed: ${root}`);
  check(!result.status && !result.untracked.length, `Product/tracked tree is dirty: ${root}`);
  return result;
}
function protectedIdentity() {
  for (const label of ['current', 'base']) {
    const root = manifest[`${label}Root`];
    const files = Object.fromEntries(fs.readdirSync(root).filter(p => /^\.env(?:$|\.)/.test(p) && fs.statSync(join(root, p)).isFile()).sort().map(p => [p, hash(join(root, p))]));
    check(JSON.stringify(files) === JSON.stringify(manifest.environmentFiles[label]), `Environment files changed: ${label}`);
    check(hash(join(root, '.omo/gates-baseline.json')) === manifest.baselineHashes[label], `Filename baseline changed: ${label}`);
  }
  for (const [path, expected] of Object.entries(manifest.protectedEvidence)) check(hash(path) === expected, `Original evidence changed: ${path}`);
  for (const [path, expected] of Object.entries(manifest.installed)) check(hash(join(manifest.nodeModules, path)) === expected, `Installed runner changed: ${path}`);
}
function resources() {
  return { at: now(), node: process.version, execPath: process.execPath, versions: process.versions, platform: process.platform, arch: process.arch, kernel: os.release(), cpus: os.cpus().length, loadavg: os.loadavg(), freeMemory: os.freemem(), totalMemory: os.totalmem() };
}
// Missing mountpoints are created only in namespace tmpfs, never in a worktree.
function mirror(path, omit = []) {
  const args = ['--tmpfs', path];
  if (!fs.existsSync(path)) return args;
  for (const name of fs.readdirSync(path).sort()) {
    if (omit.includes(name)) continue;
    const p = join(path, name);
    args.push(...(fs.lstatSync(p).isSymbolicLink() ? ['--symlink', fs.readlinkSync(p), p] : ['--ro-bind', p, p]));
  }
  return args;
}
function artifactMount(source, destination, omit = []) {
  const args = ['--bind', destination, source];
  if (fs.existsSync(source)) for (const name of fs.readdirSync(source).sort()) {
    if (omit.includes(name)) continue;
    const p = join(source, name);
    args.push(...(fs.lstatSync(p).isSymbolicLink() ? ['--symlink', fs.readlinkSync(p), p] : ['--ro-bind', p, p]));
  }
  return args;
}
function sandbox(root, side) {
  return ['--die-with-parent', '--unshare-user', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--new-session',
    '--ro-bind', '/', '/', '--proc', '/proc', '--dev', '/dev',
    ...mirror(manifest.nodeModules, ['.vite', '.vite-temp', '.cache']),
    ...['.vite', '.vite-temp', '.cache'].flatMap(name => ['--bind', join(side, 'cache', name), join(manifest.nodeModules, name)]),
    ...mirror(root, ['output', '.playwright-mcp', '.vite-cache']),
    ...mirror(join(root, 'output'), ['evidence']),
    ...artifactMount(join(root, 'output/evidence'), join(side, 'artifacts/output-evidence')),
    ...artifactMount(join(root, '.playwright-mcp'), join(side, 'artifacts/playwright-mcp'), ['ember-quest.json']),
    '--bind', join(side, 'cache/tracked-cache-view'), join(root, '.vite-cache'),
    '--bind', side, side, '--bind', join(side, 'tmp'), '/tmp', '--chdir', root];
}
function configText(root, side) {
  return `import original from ${JSON.stringify(join(root, 'vitest.config.ts'))};
import { writeFileSync } from 'node:fs';
export default { ...original, root: ${JSON.stringify(root)}, cacheDir: ${JSON.stringify(join(side, 'cache/vitest'))},
  test: { ...original.test, include: ${JSON.stringify(manifest.files)} },
  plugins: [...(original.plugins || []), { name: 'phase3-triage-config-identity', configResolved(c) {
    const t = c.test;
    writeFileSync(${JSON.stringify(join(side, 'resolved-config.json'))}, JSON.stringify({root:c.root,configFile:c.configFile,configLoader:c.configLoader,cacheDir:c.cacheDir,mode:c.mode,resolve:c.resolve,test:{include:t.include,exclude:t.exclude,environment:t.environment,testTimeout:t.testTimeout,hookTimeout:t.hookTimeout,silent:t.silent,reporters:t.reporters,outputFile:t.outputFile,cache:t.cache,fileParallelism:t.fileParallelism,maxWorkers:t.maxWorkers,minWorkers:t.minWorkers,retry:t.retry,isolate:t.isolate,pool:t.pool}},null,2), {flag:'wx'});
  }}] };
`;
}
let active, interrupted, killTimer;
function signalGroup(signal) {
  if (!active?.pid) return;
  try { process.kill(-active.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = signal;
  signalGroup('SIGTERM');
  killTimer ??= setTimeout(() => signalGroup('SIGKILL'), 15000);
});
async function execute(root, side, args, env) {
  const stdoutPath = join(side, 'stdout.txt'), stderrPath = join(side, 'stderr.txt');
  const stdout = fs.openSync(stdoutPath, 'wx', 0o600), stderr = fs.openSync(stderrPath, 'wx', 0o600);
  const receipt = { cwd: root, command: ['timeout', ...args], started: now(), resourcesBefore: resources(), stdoutPath, stderrPath };
  json(join(side, 'command.json'), receipt);
  try {
    const result = await new Promise(resolve => {
      active = spawn('timeout', args, { cwd: root, env, detached: true, stdio: ['ignore', stdout, stderr] });
      let error;
      active.on('error', value => { error = value; });
      active.on('close', (exit, signal) => resolve({ exit, signal, error: error?.stack ?? null }));
    });
    Object.assign(receipt, result);
  } finally {
    active = undefined;
    if (killTimer) clearTimeout(killTimer);
    fs.closeSync(stdout); fs.closeSync(stderr);
    Object.assign(receipt, { finished: now(), interrupted: interrupted ?? null, resourcesAfter: resources(), stdoutSha256: hash(stdoutPath), stderrSha256: hash(stderrPath) });
    json(join(side, 'receipt.json'), receipt);
  }
  return receipt;
}
function assertions(report, root) {
  const rows = new Map();
  for (const file of report.testResults) {
    const path = relative(root, file.name), seen = new Map();
    for (const a of file.assertionResults) {
      const occurrence = (seen.get(a.fullName) ?? 0) + 1;
      seen.set(a.fullName, occurrence);
      rows.set(JSON.stringify([path, a.fullName, occurrence]), { path, fullName: a.fullName, occurrence, status: a.status, duration: a.duration, failureMessages: a.failureMessages });
    }
  }
  return rows;
}
const originalRows = assertions({ testResults: selection.files.map(f => f.original) }, manifest.currentRoot);
function reportEvidence(side, root) {
  const path = join(side, 'report.json');
  if (!fs.existsSync(path)) return { path, complete: false, problem: 'Report absent; inspect actual exit and human stderr/stdout' };
  let report;
  try { report = JSON.parse(fs.readFileSync(path, 'utf8')); } catch (error) { return { path, complete: false, problem: error.message }; }
  const files = report.testResults.map(f => relative(root, f.name)).sort(), rows = assertions(report, root);
  const missingAssertions = [...originalRows.keys()].filter(k => !rows.has(k));
  const additionalAssertions = [...rows.keys()].filter(k => !originalRows.has(k));
  const complete = JSON.stringify(files) === JSON.stringify([...manifest.files].sort()) && !missingAssertions.length && !additionalAssertions.length && [...rows.values()].every(a => ['passed', 'failed'].includes(a.status));
  return { path, sha256: hash(path), complete, files, total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests, missingAssertions, additionalAssertions, fileResults: report.testResults.map(f => ({ path: relative(root, f.name), status: f.status, message: f.message })), rows };
}

check(process.argv.length === 2, 'No arguments accepted; inspect manifest.json before execution');
check(process.platform === 'linux', 'Linux flock/bubblewrap required');
check(manifest.files.length === 113 && new Set(manifest.files).size === 113 && originalRows.size === 1251, 'Selection contract changed');
const run = fs.mkdtempSync(join(here, 'run-'));
fs.chmodSync(run, 0o700);
console.log(`Evidence: ${run}`);
const summary = { started: now(), status: 'incomplete', run, sides: [], safety: 'read-only product mounts; no-network namespace; no unsandboxed fallback', comparisonStatus: 'not an approval' };
let lockFd;
const before = {};
try {
  // The documented outer flock keeps its locked open-file description in the child.
  const descriptors = fs.readdirSync('/proc/self/fd').filter(n => /^\d+$/.test(n));
  for (const fd of descriptors) {
    try { if (fs.readlinkSync(`/proc/self/fd/${fd}`) === manifest.lock) lockFd = Number(fd); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  check(lockFd !== undefined, `Run under flock --timeout 900 ${manifest.lock}; do not use --close`);
  const inode = fs.fstatSync(lockFd).ino;
  const kernelLocks = fs.readFileSync('/proc/locks', 'utf8').split('\n').filter(line => line.includes('FLOCK  ADVISORY  WRITE') && line.split(/\s+/)[5]?.endsWith(`:${inode}`));
  check(kernelLocks.length > 0, 'Inherited QA lock has no kernel write-lock record');
  const acquired = spawnSync('flock', ['--nonblock', '3'], { stdio: ['ignore', 'pipe', 'pipe', lockFd], encoding: 'utf8', timeout: 30000 });
  json(join(run, 'lock.json'), { path: manifest.lock, outerCommand: ['flock', '--timeout', '900', manifest.lock, process.execPath, fileURLToPath(import.meta.url)], verifyCommand: ['flock', '--nonblock', '3'], inheritedFd: lockFd, kernelLocks, at: now(), exit: acquired.status, signal: acquired.signal, error: acquired.error?.message, stdout: acquired.stdout, stderr: acquired.stderr });
  check(acquired.status === 0, 'Inherited descriptor does not own the QA lock');
  protectedIdentity();
  check(!Object.keys(process.env).some(k => /UPDATE|REGENERATE|BLESS/.test(k) && !['', '0', 'false'].includes(process.env[k])), 'Update/regeneration environment is set; refusing baseline/product writes');
  check(!process.env.NODE_OPTIONS && !process.env.NODE_V8_COVERAGE, 'Unreviewed Node preload/coverage environment; refusing');
  const baseRecord = git(manifest.baseRoot, ['worktree', 'list', '--porcelain']).split('\n\n').find(s => s.startsWith(`worktree ${manifest.baseRoot}\n`));
  check(baseRecord?.includes('\ndetached\nlocked '), 'Base worktree must remain detached and locked');
  for (const label of ['current', 'base']) {
    const root = manifest[`${label}Root`];
    before[label] = cleanIdentity(root, manifest[`${label}Head`]);
    check(fs.realpathSync(join(root, 'node_modules')) === manifest.nodeModules, 'Dependency realpath mismatch');
    for (const [path, expected] of Object.entries(manifest.identity[label])) check(hash(join(root, path)) === expected, `Config/runtime identity changed: ${label}/${path}`);
    for (const file of selection.files) check(hash(join(root, file.path)) === file.sha256, `Whole test file changed: ${label}/${file.path}`);
  }
  json(join(run, 'preflight.json'), { before, resources: resources(), baseRecord, manifestSha256: hash(join(here, 'manifest.json')), selectionSha256: hash(join(here, 'selection.json')), runSha256: hash(fileURLToPath(import.meta.url)), environmentOverrides: manifest.environmentOverrides, inheritedEnvironmentSha256: sha(JSON.stringify(Object.entries(process.env).sort())), environmentKeys: Object.keys(process.env).sort() });
  for (const label of ['current', 'base']) {
    check(!interrupted, `Interrupted by ${interrupted}`);
    const root = manifest[`${label}Root`], side = join(run, label);
    for (const dir of ['cache/.vite', 'cache/.vite-temp', 'cache/.cache', 'cache/tracked-cache-view', 'cache/vitest', 'cache/nested', 'artifacts/output-evidence', 'artifacts/playwright-mcp', 'tmp']) fs.mkdirSync(join(side, dir), { recursive: true });
    const config = join(side, 'triage.config.mjs');
    fs.writeFileSync(config, configText(root, side), { flag: 'wx' });
    execFileSync(process.execPath, ['--check', config], { timeout: 30000 });
    const env = { ...process.env, ...manifest.environmentOverrides, VITE_CACHE_DIR: join(side, 'cache/nested') };
    const args = ['--signal=TERM', '--kill-after=15s', '1185s', 'bwrap', ...sandbox(root, side), '--', process.execPath, 'scripts/run-vitest.mjs', 'run', ...manifest.files, '--config', config, '--configLoader=bundle', '--no-file-parallelism', '--maxWorkers=1', '--minWorkers=1', '--no-cache', '--retry=0', '--silent=false', '--reporter=verbose', '--reporter=json', `--outputFile.json=${join(side, 'report.json')}`];
    const immediatelyBefore = cleanIdentity(root, manifest[`${label}Head`]);
    check(immediatelyBefore.productSha256 === before[label].productSha256, `Product moved before command: ${label}`);
    protectedIdentity();
    const receipt = await execute(root, side, args, env);
    const result = reportEvidence(side, root), after = cleanIdentity(root, manifest[`${label}Head`]);
    check(after.productSha256 === before[label].productSha256, `Product bytes changed: ${label}`);
    protectedIdentity();
    const { rows, ...evidence } = result;
    json(join(side, 'validation.json'), { ...evidence, after, unchangedProductBytes: true });
    summary.sides.push({ label, receipt: join(side, 'receipt.json'), exit: receipt.exit, signal: receipt.signal, ...evidence });
    console.log(`${label}: exit=${receipt.exit} complete=${result.complete} report=${result.path}`);
  }
  const current = reportEvidence(join(run, 'current'), manifest.currentRoot), base = reportEvidence(join(run, 'base'), manifest.baseRoot);
  const keys = new Set([...originalRows.keys(), ...(current.rows?.keys() ?? []), ...(base.rows?.keys() ?? [])]);
  json(join(run, 'comparison.json'), { rule: 'Observations only. Compare complete human error messages/received values, including every failed assertion within previously baselined files. STACK_TRACE_ERROR matches are not cause matches.', assertions: [...keys].map(key => ({ key: JSON.parse(key), outsideRecordedBaseline: selection.files.find(f => f.path === JSON.parse(key)[0])?.outsideRecordedBaseline ?? null, original: originalRows.get(key) ?? null, current: current.rows?.get(key) ?? null, base: base.rows?.get(key) ?? null })) });
  summary.status = current.complete && base.complete && summary.sides.every(s => [0, 1].includes(s.exit) && !s.signal) ? 'pair-complete-review-required' : 'pair-incomplete-review-required';
  // A completed red pair is not a passing gate. Individual exits remain verbatim.
  process.exitCode = summary.status === 'pair-complete-review-required' ? (summary.sides.some(s => s.exit !== 0) ? 1 : 0) : 2;
} catch (error) {
  summary.error = error.stack;
  process.exitCode = 2;
  console.error(error.message);
} finally {
  const cleanup = { started: now(), deletedPrivateScratch: [], errors: [], baseWorktreeRetainedLocked: true };
  for (const label of ['current', 'base']) {
    try {
      const after = cleanIdentity(manifest[`${label}Root`], manifest[`${label}Head`]);
      check(!before[label] || before[label].productSha256 === after.productSha256, `Final product bytes changed: ${label}`);
      cleanup[label] = after;
      for (const name of ['cache', 'tmp']) {
        const path = join(run, label, name);
        if (fs.existsSync(path)) { fs.rmSync(path, { recursive: true }); cleanup.deletedPrivateScratch.push(path); }
      }
    } catch (error) { cleanup.errors.push(error.stack); process.exitCode = 2; }
  }
  try { protectedIdentity(); } catch (error) { cleanup.errors.push(error.stack); process.exitCode = 2; }
  if (lockFd !== undefined) fs.closeSync(lockFd);
  if (killTimer) clearTimeout(killTimer);
  cleanup.inheritedLockDescriptorClosedAt = now();
  cleanup.lockRelease = 'Outer flock releases its remaining descriptor when this process exits';
  json(join(run, 'cleanup.json'), cleanup);
  summary.finished = now();
  summary.exit = process.exitCode ?? 2;
  if (cleanup.errors.length) summary.status = 'integrity-or-cleanup-failed';
  json(join(run, 'summary.json'), summary);
  console.log(`Summary: ${join(run, 'summary.json')}`);
}
