// 실제 입력창 수행. assistant-capability 의 execute(입력창 POST → Pi → 저장 → 새 브라우저 재로드)를 그대로 쓴다.
// 모델 시도를 덮어쓰지 않는다: result.json 이 있는 시도는 건너뛰고(--skip-completed) 아니면 거부한다.
import { readFileSync, writeFileSync, existsSync, readdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { execute, digest } from '../../assistant-capability/node/editorDriver.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(option('out') ?? '');
const seed = JSON.parse(readFileSync(resolve('harness-data/space-craft/seed.json'), 'utf8'));
const aiConfigFile = option('ai-config');
const aiConfig = aiConfigFile ? JSON.parse(readFileSync(resolve(aiConfigFile), 'utf8')) : {};
const chosen = option('case')?.split(',');
let stop = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop = true; });

const attempts = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(resolve(root, d.name, 'fixture.json')))
  .map(d => d.name).filter(name => !chosen || chosen.some(id => name === id || name.startsWith(`${id}-r`))).sort();
if (!attempts.length) throw Error('준비된 시도가 없습니다. prepare 먼저');
let failed = 0;
for (const attempt of attempts) {
  if (stop) break;
  const dir = resolve(root, attempt);
  const fixture = JSON.parse(readFileSync(resolve(dir, 'fixture.json'), 'utf8'));
  if (existsSync(resolve(dir, 'result.json'))) {
    if (args.includes('--skip-completed')) continue;
    throw Error(`기존 시도 덮어쓰기 거부: ${attempt}. --skip-completed 또는 새 --out`);
  }
  const lock = resolve(dir, 'run.lock'); const fd = openSync(lock, 'wx');
  writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); closeSync(fd);
  const entry = seed.cases.find(value => value.id === fixture.caseId);
  const result = { schemaVersion: 1, attempt, caseId: entry.id, category: entry.category, prompt: entry.prompt,
    codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    aiConfig: aiConfigFile ? { file: relative(process.cwd(), resolve(aiConfigFile)), digest: digest(readFileSync(resolve(aiConfigFile))) } : null,
    startedAt: new Date().toISOString() };
  try {
    const run = await execute({ id: attempt, prompt: entry.prompt, mode: entry.mode }, dir, Number(option('timeout-ms', seed.timeoutMs)), aiConfig);
    const done = run.events.findLast(e => e.type === 'done');
    Object.assign(result, {
      status: run.realRun && !run.events.some(e => e.type === 'error' || e.type === 'stream_error') ? 'ran' : 'run-error',
      elapsedMs: run.elapsedMs, models: run.requests, answer: run.answer, stats: done?.stats ?? null,
      tools: run.events.filter(e => e.type === 'tool_end').map(e => ({ name: e.name, ok: e.ok })),
      errors: [...run.errors, ...run.events.filter(e => e.type === 'error' || e.type === 'stream_error').map(e => e.message)],
      persistence: { sameTarget: run.receipt.sameTarget, sameStoredDocument: run.receipt.sameStoredDocument, reloadEqual: run.receipt.reloadEqual,
        libraryRevisionChange: run.receipt.libraryRevisionChange ?? null },
    });
  } catch (error) {
    failed += 1;
    Object.assign(result, { status: 'harness-error', failure: error.message, failurePhase: error.harnessPhase ?? 'host-start' });
  }
  result.finishedAt = new Date().toISOString();
  writeFileSync(resolve(dir, 'result.json'), JSON.stringify(result, null, 2));
  unlinkSync(lock);
  console.log(`${attempt}: ${result.status}`);
}
process.exit(failed ? 1 : 0);
