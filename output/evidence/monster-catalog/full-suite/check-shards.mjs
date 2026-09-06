#!/usr/bin/env node
// Verification only, for the existing Vitest 3.2.4 JSON reporter and PR678 plan.
// Run from the repository root:
//   node output/evidence/monster-catalog/full-suite/check-shards.mjs --exits PATH > SUMMARY.json
// PATH: {"1":{"exitCode":0,"status":"completed"}, ..., "16":{...}}
// Supply exactly 16 terminal process records; timeout/signal records never count complete.
// Exit codes: 0 complete/pass, 1 complete/fail, 2 incomplete/invalid evidence.
// --self-test writes only temporary fixtures under this script's directory, then removes them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const countKeys = ['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites',
  'numPendingTestSuites', 'numTotalTests', 'numPassedTests', 'numFailedTests',
  'numPendingTests', 'numTodoTests'];
const snapshotCounts = ['added', 'filesAdded', 'filesRemoved', 'filesUnmatched',
  'filesUpdated', 'matched', 'total', 'unchecked', 'unmatched', 'updated'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const strings = value => Array.isArray(value) && value.every(x => typeof x === 'string');
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function load(file) {
  const text = fs.readFileSync(file, 'utf8');
  requireThat(text.trim().length > 0, `empty JSON: ${file}`);
  return JSON.parse(text);
}
function fileName(name) {
  requireThat(typeof name === 'string' && name.length > 0 && !name.includes('\0'), 'invalid file name');
  const relative = path.relative(root, path.resolve(root, name));
  requireThat(relative && relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative),
    `file outside repository: ${name}`);
  return relative;
}
function inputs() {
  const plan = load(path.join(root, '.omo/monster-shards/plan.json'));
  const discovery = load(path.join(root, '.omo/monster-expected-files.json'));
  const baseline = load(path.join(root, '.omo/gates-baseline.json'));
  requireThat(plan.shardCount === 16 && plan.expectedFileCount === 1768, 'unexpected shard plan');
  requireThat(typeof plan.revision === 'string' && /^[a-f0-9]{40}$/.test(plan.revision), 'invalid plan revision');
  requireThat(Array.isArray(discovery) && discovery.length === 1768, 'discovery must contain 1768 native file entries');
  const expected = discovery.map(entry => {
    requireThat(object(entry) && typeof entry.file === 'string' && path.isAbsolute(entry.file), 'invalid native discovery entry');
    return fileName(entry.file);
  });
  requireThat(new Set(expected).size === expected.length, 'duplicate discovered file');
  requireThat(strings(baseline.tests?.failedFiles) && baseline.tests.failedFiles.length === 98, 'baseline must retain 98 failed files');
  const baselineFiles = baseline.tests.failedFiles.map(fileName);
  requireThat(new Set(baselineFiles).size === 98, 'duplicate baseline file');
  return { plan, expected, baselineFiles, baselineRanAt: baseline.ranAt };
}

function validateReport(report) {
  requireThat(object(report), 'report must be an object');
  for (const key of countKeys) requireThat(count(report[key]), `invalid count: ${key}`);
  requireThat(typeof report.success === 'boolean' && finite(report.startTime), 'invalid success/startTime');
  requireThat(Array.isArray(report.testResults) && report.testResults.length > 0, 'missing or empty testResults');
  requireThat(report.numTotalTestSuites >= report.testResults.length, 'suite count below file count (suites include nested describes)');
  requireThat(report.numTotalTestSuites === report.numPassedTestSuites + report.numFailedTestSuites + report.numPendingTestSuites,
    'suite counters do not sum to total');
  const actual = { passed: 0, failed: 0, skipped: 0, pending: 0, todo: 0 };
  let failedFiles = 0;
  for (const file of report.testResults) {
    requireThat(object(file) && typeof file.name === 'string' && path.isAbsolute(file.name), 'invalid native testResults entry/name');
    fileName(file.name);
    requireThat(['passed', 'failed'].includes(file.status) && typeof file.message === 'string', 'invalid file status/message');
    requireThat(finite(file.startTime) && finite(file.endTime) && file.endTime >= file.startTime, 'invalid file times');
    requireThat(Array.isArray(file.assertionResults), 'missing assertionResults');
    let hasFailedAssertion = false;
    for (const test of file.assertionResults) {
      requireThat(object(test) && Object.hasOwn(actual, test.status), 'invalid assertion status');
      requireThat(strings(test.ancestorTitles) && typeof test.fullName === 'string' && typeof test.title === 'string', 'invalid assertion names');
      requireThat(strings(test.failureMessages), 'invalid assertion failureMessages');
      requireThat(test.duration === undefined || test.duration === null || finite(test.duration), 'invalid assertion duration');
      actual[test.status]++;
      hasFailedAssertion ||= test.status === 'failed';
    }
    requireThat(!hasFailedAssertion || file.status === 'failed', 'failed assertion hidden by passed file');
    requireThat(file.message === '' || file.status === 'failed', 'file error hidden by passed file');
    failedFiles += Number(file.status === 'failed');
  }
  requireThat(report.numTotalTests === Object.values(actual).reduce((a, b) => a + b, 0), 'test total differs from assertions');
  requireThat(report.numPassedTests === actual.passed && report.numFailedTests === actual.failed &&
    report.numPendingTests === actual.skipped + actual.pending && report.numTodoTests === actual.todo,
  'test counters differ from assertion statuses');
  requireThat(report.numFailedTestSuites >= failedFiles, 'failed suite count below failed file count');
  requireThat(report.success === (report.numFailedTests === 0 && report.numFailedTestSuites === 0), 'success contradicts failure counters');
  requireThat(object(report.snapshot), 'missing snapshot summary');
  for (const key of snapshotCounts) requireThat(count(report.snapshot[key]), `invalid snapshot count: ${key}`);
  requireThat(typeof report.snapshot.failure === 'boolean' && typeof report.snapshot.didUpdate === 'boolean' &&
    strings(report.snapshot.filesRemovedList) && Array.isArray(report.snapshot.uncheckedKeysByFile), 'invalid snapshot summary');
  for (const entry of report.snapshot.uncheckedKeysByFile) {
    requireThat(object(entry) && typeof entry.filePath === 'string' && strings(entry.keys), 'invalid unchecked snapshot entry');
  }
  // Native pending assertions map run/queued/only, not intentionally skipped tests.
  requireThat(actual.pending === 0, 'unfinished pending assertions in terminal report');
  return actual;
}

function check(exitsFile, reportDir = path.join(root, '.omo/monster-shards')) {
  const { plan, expected, baselineFiles, baselineRanAt } = inputs();
  const issues = [];
  const processRecords = new Map();
  try {
    const exits = load(exitsFile);
    requireThat(object(exits), 'exit evidence must be an object keyed by decimal shard numbers');
    for (const [key, record] of Object.entries(exits)) {
      requireThat(/^(?:[1-9]|1[0-6])$/.test(key) && object(record), `invalid shard process record: ${key}`);
      processRecords.set(Number(key), record);
    }
  } catch (error) { issues.push({ source: 'process-exits', error: error.message }); }
  const seen = new Map();
  const failures = [];
  const shards = [];
  const totals = Object.fromEntries(countKeys.map(key => [key, 0]));
  const assertionStatuses = { passed: 0, failed: 0, skipped: 0, pending: 0, todo: 0 };
  for (let shard = 1; shard <= plan.shardCount; shard++) {
    const reportFile = path.join(reportDir, `shard-${String(shard).padStart(2, '0')}.json`);
    const record = processRecords.get(shard);
    const terminal = object(record) && (record.exitCode === 0 || record.exitCode === 1) &&
      record.status === 'completed' && (!Object.hasOwn(record, 'signal') || record.signal === null) &&
      (!Object.hasOwn(record, 'timedOut') || record.timedOut === false);
    const result = { shard, reportFile, process: record ?? null, terminal, reportValid: false, complete: false, failureReasons: [] };
    shards.push(result);
    if (!terminal) issues.push({ shard, error: 'missing known exit 0/1 with status:completed, or contradictory timeout/signal evidence' });
    if (record?.exitCode === 1) result.failureReasons.push('process-exit-1 (includes failures not represented by native JSON, such as unhandled errors)');
    let report;
    try { report = load(reportFile); }
    catch (error) { issues.push({ shard, error: error.message }); continue; }
    // Preserve observable failures even when other parts of this report are malformed.
    result.reportedSuccess = report?.success ?? null;
    result.reportedCounts = Object.fromEntries(countKeys.map(key => [key, report?.[key] ?? null]));
    result.snapshot = report?.snapshot ?? null;
    if (report?.success === false) result.failureReasons.push('report-success-false');
    if (report?.numFailedTestSuites > 0 || report?.numFailedTests > 0) result.failureReasons.push('reported-failure-counts');
    if (report?.snapshot?.failure || report?.snapshot?.unmatched > 0) result.failureReasons.push('snapshot-failure');
    // Not present in 3.2.4 native JSON; retain if supplied, never pretend it is zero.
    result.unhandledErrors = report?.unhandledErrors ?? null;
    if (report?.unhandledErrors !== undefined) {
      if (!Array.isArray(report.unhandledErrors)) issues.push({ shard, error: 'malformed unhandledErrors extension' });
      else if (report.unhandledErrors.length) result.failureReasons.push('unhandled-errors');
    }
    if (Array.isArray(report?.testResults)) for (const file of report.testResults) {
      let name;
      try { name = fileName(file?.name); }
      catch (error) { issues.push({ shard, error: error.message }); continue; }
      seen.set(name, [...(seen.get(name) ?? []), shard]);
      const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
      const failedAssertions = assertions.filter(test => test?.status === 'failed' || test?.failureMessages?.length > 0);
      if (file.status === 'failed' || file.message || failedAssertions.length) {
        failures.push({ shard, file: name, status: file.status, message: file.message,
          fileLevelFailureWithoutFailedAssertions: file.status === 'failed' && !assertions.some(test => test?.status === 'failed'),
          assertionResults: failedAssertions });
        result.failureReasons.push(`failed-file:${name}`);
      }
    }
    try {
      const statuses = validateReport(report);
      result.reportValid = true;
      result.complete = terminal;
      for (const key of countKeys) totals[key] += report[key];
      for (const key of Object.keys(assertionStatuses)) assertionStatuses[key] += statuses[key];
    } catch (error) { issues.push({ shard, error: error.message }); }
  }
  const expectedSet = new Set(expected);
  const missingFiles = expected.filter(name => !seen.has(name)).sort();
  const unexpectedFiles = [...seen.keys()].filter(name => !expectedSet.has(name)).sort();
  const duplicates = [...seen].filter(([, occurrences]) => occurrences.length > 1)
    .map(([file, shardOccurrences]) => ({ file, shardOccurrences })).sort((a, b) => a.file.localeCompare(b.file));
  if (missingFiles.length) issues.push({ error: 'expected files omitted', count: missingFiles.length });
  if (unexpectedFiles.length) issues.push({ error: 'unexpected reported files', count: unexpectedFiles.length });
  if (duplicates.length) issues.push({ error: 'duplicate reported files', count: duplicates.length });
  const failedFiles = [...new Set(failures.map(f => f.file))].sort();
  const baselineSet = new Set(baselineFiles);
  const complete = issues.length === 0 && shards.every(shard => shard.complete);
  const failureObserved = shards.some(shard => shard.failureReasons.length > 0);
  const exitCode = !complete ? 2 : failureObserved ? 1 : 0;
  return {
    schemaVersion: 1, planRevision: plan.revision,
    completeness: { complete, expectedShards: 16, completeShards: shards.filter(s => s.complete).length,
      expectedFiles: expected.length, reportedUniqueFiles: seen.size, missingFiles, unexpectedFiles, duplicates, issues },
    outcome: { status: failureObserved ? 'failed' : complete ? 'passed' : 'unknown', failureObserved,
      passed: complete && !failureObserved, exitCode },
    counts: { scope: 'schema-valid reports only; not a full-suite total unless complete', ...totals, assertionStatuses },
    failures, failedFiles,
    baseline: { source: '.omo/gates-baseline.json', ranAt: baselineRanAt, failedFileCount: 98,
      newFailedFiles: failedFiles.filter(name => !baselineSet.has(name)),
      stillFailingFiles: failedFiles.filter(name => baselineSet.has(name)),
      baselineFilesWithoutObservedFailure: baselineFiles.filter(name => !failedFiles.includes(name)).sort(),
      comparisonComplete: complete, refreshed: false },
    limitations: [
      'Vitest 3.2.4 JSON ignores onFinished errors: unhandled error counts/details are unavailable, not zero. Nonzero process exits stay failed; consult shard logs for details.',
      'File message retains only the first file-level error in native JSON; failures without failed assertions may be collection or hook errors.',
      'numPendingTests includes skipped tests; assertionStatuses separates skipped and unfinished pending. Suite counts include nested describes, not just files.',
      'Baseline files without observed failure are not claimed fixed, especially when evidence is incomplete. Baseline never determines pass/fail.',
      'newFailedFiles means absent from the fixed baseline, not confirmed introduced by this PR. Pristine-upstream classification is separate.',
      'Process status:completed is the parent receipt of terminal execution; explicit timeout/signal evidence overrides it.'
    ], shards
  };
}

function syntheticReport(names) {
  return {
    numTotalTestSuites: names.length * 2, numPassedTestSuites: names.length * 2,
    numFailedTestSuites: 0, numPendingTestSuites: 0,
    numTotalTests: names.length, numPassedTests: names.length, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    snapshot: { added: 0, failure: false, filesAdded: 0, filesRemoved: 0, filesRemovedList: [], filesUnmatched: 0,
      filesUpdated: 0, matched: 0, total: 0, unchecked: 0, uncheckedKeysByFile: [], unmatched: 0, updated: 0, didUpdate: false },
    startTime: 1, success: true,
    testResults: names.map(name => ({ name: path.join(root, name), status: 'passed', message: '', startTime: 1, endTime: 2,
      assertionResults: [{ ancestorTitles: ['nested suite'], fullName: 'nested suite synthetic test', title: 'synthetic test',
        status: 'passed', duration: 1, failureMessages: [], meta: {} }] }))
  };
}
function selfTest() {
  const { expected, baselineFiles } = inputs();
  const dir = fs.mkdtempSync(path.join(here, '.checker-self-test-'));
  const evidence = [];
  const makeExits = () => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [String(i + 1), { exitCode: 0, status: 'completed' }]));
  const pristine = Array.from({ length: 16 }, (_, i) => syntheticReport(expected.filter((_, index) => index % 16 === i)));
  const reportPath = i => path.join(dir, `shard-${String(i + 1).padStart(2, '0')}.json`);
  const exitsPath = path.join(dir, 'exits.json');
  const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
  function run(name, modify, expectedComplete, expectedExit, verify = () => {}) {
    const reports = structuredClone(pristine);
    const exits = makeExits();
    modify(reports, exits);
    reports.forEach((report, i) => {
      if (report === undefined) { if (fs.existsSync(reportPath(i))) fs.unlinkSync(reportPath(i)); }
      else if (typeof report === 'string') fs.writeFileSync(reportPath(i), report);
      else save(reportPath(i), report);
    });
    save(exitsPath, exits);
    const summary = check(exitsPath, dir);
    assert.equal(summary.completeness.complete, expectedComplete, name);
    assert.equal(summary.outcome.exitCode, expectedExit, name);
    assert.equal(summary.outcome.passed, expectedExit === 0, name);
    verify(summary);
    evidence.push({ name, passed: true, complete: summary.completeness.complete, outcome: summary.outcome,
      issues: summary.completeness.issues, missingFiles: summary.completeness.missingFiles.length,
      duplicates: summary.completeness.duplicates.length, failedFiles: summary.failedFiles,
      newFailedFiles: summary.baseline.newFailedFiles, counts: summary.counts });
  }
  try {
    run('complete passing control with nested suites', () => {}, true, 0);
    run('missing shard', reports => { reports[0] = undefined; }, false, 2);
    run('duplicate file across shards with internally consistent counts', reports => {
      reports[1] = syntheticReport([...reports[1].testResults.map(f => fileName(f.name)), fileName(reports[0].testResults[0].name)]);
    }, false, 2, s => assert.equal(s.completeness.duplicates.length, 1));
    run('omitted expected file with internally consistent counts', reports => {
      reports[0] = syntheticReport(reports[0].testResults.slice(1).map(f => fileName(f.name)));
    }, false, 2, s => assert.equal(s.completeness.missingFiles.length, 1));
    run('malformed negative count', reports => { reports[0].numPassedTests = -1; }, false, 2);
    run('plausible but inconsistent count', reports => { reports[0].numTotalTests++; }, false, 2);
    run('malformed JSON report', reports => { reports[0] = '{'; }, false, 2);
    run('empty report', reports => { reports[0] = ''; }, false, 2);
    run('empty testResults', reports => { reports[0] = syntheticReport([]); }, false, 2);
    run('missing terminal exit', (_, exits) => { delete exits[1].exitCode; }, false, 2);
    run('missing process record preserves other terminal receipts', (_, exits) => { delete exits[1]; }, false, 2,
      s => assert.equal(s.completeness.completeShards, 15));
    run('missing completed status', (_, exits) => { delete exits[1].status; }, false, 2);
    run('running status with exit 0', (_, exits) => { exits[1].status = 'running'; }, false, 2);
    run('timeout status with exit 1', (_, exits) => { exits[1] = { exitCode: 1, status: 'timeout' }; }, false, 2);
    run('unexpected shard process key', (_, exits) => { exits[17] = { exitCode: 0, status: 'completed' }; }, false, 2);
    run('noncanonical shard process key', (_, exits) => { exits['01'] = exits[1]; delete exits[1]; }, false, 2);
    run('timeout despite reported exit 1', (_, exits) => { exits[1].exitCode = 1; exits[1].timedOut = true; }, false, 2);
    run('signal despite reported exit 0', (_, exits) => { exits[1].signal = 'SIGTERM'; }, false, 2);
    run('failed but complete, including existing and new failed files', (reports, exits) => {
      const targets = [baselineFiles[0], expected.find(name => !baselineFiles.includes(name))];
      for (const name of targets) {
        const index = reports.findIndex(r => r.testResults.some(f => fileName(f.name) === name));
        const report = reports[index];
        const file = report.testResults.find(f => fileName(f.name) === name);
        file.status = 'failed'; file.assertionResults[0].status = 'failed';
        file.assertionResults[0].failureMessages = ['synthetic assertion failure'];
        report.numFailedTests++; report.numPassedTests--;
        report.numFailedTestSuites += 2; report.numPassedTestSuites -= 2; report.success = false;
        exits[index + 1].exitCode = 1;
      }
    }, true, 1, s => { assert.equal(s.failedFiles.length, 2); assert.equal(s.baseline.newFailedFiles.length, 1); assert.equal(s.baseline.stillFailingFiles.length, 1); });
    run('collection error with zero assertions remains complete and failed', (reports, exits) => {
      const report = reports[0]; const file = report.testResults[0];
      file.assertionResults = []; file.status = 'failed'; file.message = 'synthetic collection error';
      report.numTotalTests--; report.numPassedTests--; report.numTotalTestSuites--;
      report.numFailedTestSuites++; report.numPassedTestSuites -= 2; report.success = false; exits[1].exitCode = 1;
    }, true, 1, s => assert.equal(s.failures[0].fileLevelFailureWithoutFailedAssertions, true));
    run('exit 1 with success true retains non-assertion/unhandled failure', (_, exits) => { exits[1].exitCode = 1; }, true, 1,
      s => { assert.equal(s.shards[0].reportedSuccess, true); assert.equal(s.shards[0].unhandledErrors, null); });
    run('skipped and todo counted honestly', reports => {
      const report = reports[0]; report.testResults[0].assertionResults[0].status = 'skipped';
      report.testResults[1].assertionResults[0].status = 'todo';
      report.numPassedTests -= 2; report.numPendingTests++; report.numTodoTests++;
    }, true, 0, s => { assert.equal(s.counts.assertionStatuses.skipped, 1); assert.equal(s.counts.numTodoTests, 1); });
    run('unfinished pending assertion fails completeness', reports => {
      reports[0].testResults[0].assertionResults[0].status = 'pending';
      reports[0].numPassedTests--; reports[0].numPendingTests++;
    }, false, 2);
    run('unexpected file', reports => {
      reports[0] = syntheticReport([...reports[0].testResults.map(f => fileName(f.name)), 'test/not-in-discovery.synthetic.test.ts']);
    }, false, 2, s => assert.equal(s.completeness.unexpectedFiles.length, 1));
    // Exercise the real CLI and its observable exit code, without reading unfinished shards.
    const cli = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--exits', path.join(dir, 'absent.json')],
      { encoding: 'utf8', env: { ...process.env, MONSTER_CHECKER_SELF_TEST_REPORT_DIR: dir }, timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
    assert.ifError(cli.error); assert.equal(cli.signal, null); assert.equal(cli.status, 2);
    assert.equal(JSON.parse(cli.stdout).completeness.complete, false);
    evidence.push({ name: 'CLI returns JSON and exit 2 for missing process evidence', passed: true, exitCode: cli.status });
    return { selfTest: 'passed', synthetic: true, expectedFiles: expected.length, baselineFailedFiles: baselineFiles.length,
      cases: evidence.length, results: evidence };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

try {
  const args = process.argv.slice(2);
  let summary;
  if (args.length === 1 && args[0] === '--self-test') summary = selfTest();
  else {
    requireThat(args.length === 2 && args[0] === '--exits', 'usage: check-shards.mjs --exits PATH | --self-test');
    // This override is only accepted for transient fixtures inside the evidence folder.
    const fixtureDir = process.env.MONSTER_CHECKER_SELF_TEST_REPORT_DIR;
    if (fixtureDir) requireThat(path.dirname(fixtureDir) === here && path.basename(fixtureDir).startsWith('.checker-self-test-'), 'invalid self-test fixture directory');
    summary = check(path.resolve(args[1]), fixtureDir);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.outcome?.exitCode ?? 0;
} catch (error) {
  process.stdout.write(`${JSON.stringify({ completeness: { complete: false, issues: [{ error: error.message }] },
    outcome: { status: 'unknown', passed: false, exitCode: 2 } }, null, 2)}\n`);
  process.exitCode = 2;
}
