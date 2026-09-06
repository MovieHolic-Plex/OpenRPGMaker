import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = new URL('./', import.meta.url);
const entry = JSON.parse(await readFile(new URL('entry.json', root), 'utf8'));
const browser = JSON.parse(await readFile(new URL('browser.json', root), 'utf8'));
const assertionAudit = [];
for (const path of execFileSync('git', ['diff', '--diff-filter=M', '--name-only', entry.head, '--', 'test'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)) {
  const original = execFileSync('git', ['show', `${entry.head}:${path}`], { encoding: 'utf8' });
  const current = await readFile(path, 'utf8');
  const assertions = text => text.split('\n').map(line => line.trim()).filter(line => line.includes('expect(') || line.includes('expect.'));
  assert.deepEqual(assertions(current), assertions(original), path);
  assertionAudit.push({ path, unchangedAssertionLines: assertions(original).length });
}
const receipts = [];
for (const name of await readdir(root)) {
  if (!name.endsWith('.json')) continue;
  const value = JSON.parse(await readFile(new URL(name, root), 'utf8'));
  if (!Array.isArray(value.command) || typeof value.output !== 'string') continue;
  assert.equal(createHash('sha256').update(value.output).digest('hex'), value.sha256, name);
  assert.equal(await readFile(new URL(name.replace(/\.json$/, '.txt'), root), 'utf8'), value.output ? value.output.split('\n').map(line => line.trimEnd()).join('\n').trimEnd() + '\n' : '', name);
  receipts.push({ name, command: value.command, exit: value.exit, signal: value.signal });
}
assert.equal(browser.ok, true);
const audio = browser.runs.map(run => {
  assert.equal(run.nativePlayback.event, 'playing');
  assert.equal(run.nativePlayback.paused, false);
  assert.equal(run.nativePlayback.readyState, 4);
  assert.equal(run.nativePlayback.error, null);
  if (!run.qa) {
    assert.deepEqual(run.observed, { globals: [], mirrors: 0, markers: 0 });
    assert.deepEqual(run.audioObservation.allOprnGlobals.sort(), ['__oprnJuiceLog', '__oprnPlayBootLog', '__oprnRuntimeJuice']);
  } else {
    assert.deepEqual(run.audioObservation.qaState, run.audioObservation.publicState);
    assert.ok(run.audioObservation.resources.includes('cc0-bgm-rtp-fld-003'));
    assert.equal(run.first.receipt.sequence, 1);
    assert.equal(run.second.receipt.sequence, 2);
    assert.equal(run.rejectedObservedStateUnchanged, true);
  }
  // The real probe asserted empty failures before deliberate teardown; its arrays remain live
  // through stopAll/context close, retaining subsequent aborts instead of filtering them out.
  for (const failure of run.failedRequests) {
    assert.equal(failure.failure.errorText, 'net::ERR_ABORTED');
    assert.equal(failure.url, run.nativePlayback.src);
  }
  assert.deepEqual(run.errors, []);assert.deepEqual(run.consoleErrors, []);assert.deepEqual(run.httpErrors, []);
  return { bootFlag: run.bootFlag, nativePlayback: run.nativePlayback, audioObservation: run.audioObservation, audioCleanup: run.audioCleanup, postAssertionRequestFailures: run.failedRequests };
});
execFileSync('git', ['diff', '--exit-code', entry.head, '--', 'WISH.md', 'package.json', 'package-lock.json', 'vitest.config.ts', '.omo/gates-baseline.json', 'test/actionDebounceFootprint.test.ts', 'test/fixtures/life-full/coverage.json', 'src/player/runtimeJuice.ts', 'src/player/playBootDiagnostics.ts', 'src/player/saveSlots.ts', 'src/project/session.ts', 'scripts/lib/runtimeQaRun.mjs']);
const result = { head: entry.head, tree: entry.tree, assertionAudit, receipts, browserUrl: browser.url, browserVersion: browser.browserVersion, audio, limits: ['No audible speaker-output claim', 'Screenshots captured but this model cannot view images', 'Editor audio-dialog spec opt-in is diagnostic-checked; its full editor journey was not rerun', 'Two existing registry-fixture failures retained; full gates/later life journeys not rerun'] };
await writeFile(new URL('audio.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
