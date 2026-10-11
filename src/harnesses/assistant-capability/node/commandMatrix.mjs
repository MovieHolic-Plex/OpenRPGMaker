import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const matrixFile = resolve('harness-data/assistant-capability/command-matrix.json');
const matrix = JSON.parse(readFileSync(matrixFile, 'utf8'));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`--${name} 값 필요`);
  return value;
};
const out = resolve(option('out', 'qa-runs/harnesses/assistant-capability/command-matrix'));
const digest = value => createHash('sha256').update(value).digest('hex');
const errors = [];
const agentIds = new Set(matrix.agents.map(agent => agent.id));
const numbers = new Set();
const ids = new Set();
const required = ['id', 'n', 'agent', 'mode', 'prompt', 'scope', 'oracle', 'runtime', 'visual', 'toolNames', 'executionKind', 'check'];

for (const command of matrix.commands) {
  for (const key of required) if (command[key] === undefined || command[key] === '') errors.push(`${command.id ?? command.n}: missing ${key}`);
  if (ids.has(command.id)) errors.push(`${command.id}: duplicate id`);
  if (numbers.has(command.n)) errors.push(`${command.id}: duplicate n`);
  ids.add(command.id); numbers.add(command.n);
  if (!agentIds.has(command.agent)) errors.push(`${command.id}: unknown agent ${command.agent}`);
  if (command.mode === 'read' && command.runtime === 'battle') errors.push(`${command.id}: read command cannot require battle mutation`);
  if (command.mode === 'write' && command.visual === 'none') errors.push(`${command.id}: write command must declare visual evidence`);
  if (!Array.isArray(command.toolNames) || command.toolNames.length === 0) errors.push(`${command.id}: toolNames must name the canonical execution tools`);
  if (!['direct', 'composite'].includes(command.executionKind)) errors.push(`${command.id}: executionKind must be direct or composite`);
  if (command.executionKind === 'direct' && command.toolNames?.length !== 1) errors.push(`${command.id}: direct command must have one tool`);
  if (command.executionKind === 'composite' && command.toolNames?.length < 2) errors.push(`${command.id}: composite command must have two or more tools`);
}
for (let n = 1; n <= 50; n += 1) if (!numbers.has(n)) errors.push(`missing command number ${n}`);
if (matrix.commands.length !== 50) errors.push(`expected 50 commands, got ${matrix.commands.length}`);

const counts = Object.fromEntries(matrix.agents.map(agent => [agent.id, 0]));
const modes = { read: 0, write: 0 };
const runtime = {};
for (const command of matrix.commands) {
  counts[command.agent] += 1;
  modes[command.mode] = (modes[command.mode] ?? 0) + 1;
  runtime[command.runtime] = (runtime[command.runtime] ?? 0) + 1;
}

mkdirSync(out, { recursive: true });
const result = {
  schemaVersion: 1,
  suite: matrix.suite,
  coverage: 'contract-only',
  execution: { performed: false, nativeModelTrials: 0, sqliteReloads: 0, runtimeRuns: 0, visualReviews: 0 },
  matrixDigest: digest(readFileSync(matrixFile)),
  commandCount: matrix.commands.length,
  agentCount: matrix.agents.length,
  counts,
  modes,
  runtime,
  valid: errors.length === 0,
  errors,
  commands: matrix.commands.map(({ id, n, agent, mode, runtime: runtimeKind, visual, toolNames, executionKind, check }) => ({ id, n, agent, mode, runtime: runtimeKind, visual, toolNames, executionKind, check }))
};
writeFileSync(resolve(out, 'matrix-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(resolve(out, 'agent-briefs.json'), `${JSON.stringify(matrix.agents.map(agent => ({ ...agent, commands: matrix.commands.filter(command => command.agent === agent.id).map(command => command.id) })), null, 2)}\n`);
const status = errors.length ? '실패' : '통과';
const lines = [
  '# 작은 명령 50개 실행 매트릭스', '',
  `상태: **${status}**`, '',
  `계약 검증 전용 · 실제 모델 호출 0건 · SQLite 재로드 0건 · 플레이 0건 · 시각 판정 0건`, '',
  `명령 ${matrix.commands.length}개 · 역할 ${matrix.agents.length}개 · 읽기 ${modes.read}개 · 쓰기 ${modes.write}개`, '',
  '## 에이전트별 분담', '',
  '| 에이전트 | 직접 명령 수 | 명령 |', '|---|---:|---|',
  ...matrix.agents.map(agent => `| ${agent.id} | ${counts[agent.id]} | ${matrix.commands.filter(command => command.agent === agent.id).map(command => `#${command.n}`).join(', ')} |`),
  '', '## 실행 유형', '',
  '| 유형 | 수 |', '|---|---:|', ...Object.entries(runtime).map(([key, value]) => `| ${key} | ${value} |`),
  '', '## 판정', '',
  ...(errors.length ? errors.map(error => `- 실패: ${error}`) : ['- 1부터 50까지 번호가 정확히 존재합니다.', '- 모든 명령에 담당 에이전트·범위·독립 판정 기준이 있습니다.', '- 쓰기 명령은 저장·재로드와 화면 증거를 요구합니다.'])
];
writeFileSync(resolve(out, 'SUMMARY.md'), `${lines.join('\n')}\n`);
writeFileSync(resolve(out, 'report.html'), `<!doctype html><meta charset="utf-8"><title>작은 명령 50개 매트릭스</title><style>body{font:16px system-ui;max-width:1300px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #bbb;text-align:left}.ok{color:#18794e}.bad{color:#b42318}</style><h1>작은 명령 50개 실행 매트릭스</h1><p class="${errors.length ? 'bad' : 'ok'}">${status} · ${matrix.commands.length}개 명령 · ${matrix.agents.length}개 에이전트</p><p>이 문서는 계약 선언을 검증한다. 실제 도구 계약 결과는 matrix-tools 단계의 별도 영수증이다.</p><table><thead><tr><th>#</th><th>명령</th><th>에이전트</th><th>모드</th><th>도구</th><th>실행</th><th>플레이</th><th>시각</th></tr></thead><tbody>${matrix.commands.map(command => `<tr><td>${command.n}</td><td>${command.id}</td><td>${command.agent}</td><td>${command.mode}</td><td>${command.toolNames.join(' + ')}</td><td>${command.executionKind}</td><td>${command.runtime}</td><td>${command.visual}</td></tr>`).join('')}</tbody></table>`);
console.log(JSON.stringify({ out, valid: result.valid, commandCount: result.commandCount, agentCount: result.agentCount, errors }));
if (errors.length) process.exitCode = 1;
