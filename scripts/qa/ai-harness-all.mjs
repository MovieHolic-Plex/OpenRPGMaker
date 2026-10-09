#!/usr/bin/env node
// Item 10 runner: every deterministic editor scenario in one gate.
//
// 왜 별도 프로세스인가 — 각 시나리오는 자기 Vite 서버·Firefox·격리 원격 프로젝트·독점
// listener 를 소유하고 끝에서 전부 정리한다. 한 프로세스에서 이어 돌리면 그 소유권이 섞여
// "정리 영수증"이 무의미해진다. 그래서 시나리오마다 새 프로세스를 띄우고, 하나라도
// typed PASS 조건을 어기면 즉시 nonzero 로 끝낸다.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: { scenario: { type: 'string' }, report: { type: 'string' } } });
assert.equal(values.scenario, 'all', 'Only --scenario all is supported here; run a single scenario through ai-harness-contracts.mjs');
const out = resolve(root, process.env.EVIDENCE_DIR ?? 'output/evidence/ai-harness/editor');
const reportPath = values.report ? resolve(values.report) : resolve(out, 'all.json');

// 계획의 이름 → 실제 시나리오. checkpoint-upgrade 는 별도 스크립트(실제 IndexedDB 이관),
// crash-after-apply 는 recovery 시나리오가 소유한다.
const SCENARIOS = [
  { name: 'proof-failure', kind: 'contract' },
  { name: 'required-skip', kind: 'contract' },
  { name: 'outcome-matrix', kind: 'contract' },
  { name: 'retained-draft-ask', kind: 'contract' },
  { name: 'wiki-delivery', kind: 'contract' },
  { name: 'new-goal-draft', kind: 'contract' },
  { name: 'late-cancel', kind: 'contract' },
  { name: 'human-edit-race', kind: 'contract' },
  { name: 'checkpoint-upgrade', kind: 'upgrade' },
  { name: 'crash-after-apply', kind: 'contract', scenario: 'recovery' },
];

function freePort() {
  return new Promise((yes, no) => {
    const probe = createServer();
    probe.once('error', no);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? no(error) : yes(port));
    });
  });
}

async function runOne(entry) {
  const dir = resolve(out, entry.name);
  await mkdir(dir, { recursive: true });
  const port = await freePort();
  const args = entry.kind === 'upgrade'
    ? ['scripts/qa/ai-harness-checkpoint-upgrade.mjs']
    : ['scripts/qa/ai-harness-contracts.mjs', '--scenario', entry.scenario ?? entry.name];
  const started = new Date().toISOString();
  const child = spawn('xvfb-run', ['-a', 'node', ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, QA_PORT: String(port), EVIDENCE_DIR: dir } });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const exitCode = await new Promise(done => child.once('close', code => done(code ?? 1)));
  await writeFile(resolve(dir, 'runner.log'), log);
  // 산출물이 곧 판정이다. 종료 코드만 믿지 않고 하네스 자신의 typed 결과를 읽는다.
  let artifact = null;
  for (const file of ['actions.json', 'report.json']) {
    try { artifact = JSON.parse(await readFile(resolve(dir, file), 'utf8')); break; } catch { /* next */ }
  }
  const pass = exitCode === 0 && artifact !== null && artifact.pass === true;
  return { name: entry.name, scenario: entry.scenario ?? entry.name, port, dir, started,
    finished: new Date().toISOString(), exitCode, pass,
    artifactPass: artifact?.pass ?? null, cleanup: artifact?.cleanup ?? null, failure: artifact?.failure ?? null };
}

await mkdir(out, { recursive: true });
const report = { schemaVersion: 1, scenario: 'all', startedAt: new Date().toISOString(), results: [], pass: false };
for (const entry of SCENARIOS) {
  const result = await runOne(entry);
  report.results.push(result);
  process.stdout.write(JSON.stringify({ type: 'scenario-result', ...result }) + '\n');
  if (!result.pass) break; // 첫 실패에서 멈춘다 — 뒤 시나리오의 통과가 앞 실패를 덮지 못한다.
}
report.finishedAt = new Date().toISOString();
report.pass = report.results.length === SCENARIOS.length && report.results.every(result => result.pass);
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ type: 'all-result', pass: report.pass, report: reportPath }) + '\n');
process.exitCode = report.pass ? 0 : 1;
