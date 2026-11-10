// 작은 일 묶음 실행기(bun). 일마다: 새 픽스처 정본 → 실제 편집기 입력창에 한 턴(wholeGameSession.mjs) → 저장·새 컨텍스트 재로드 →
// 저장 문서 전/후를 기계 판정. 조수가 되물으면 「네가 판단해서 진행해 줘」를 한 번만 답한다. 실패·시간 초과·기반 오류는 그대로 적는다.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import type { Project } from '../../../../project/types';
import { initLocalProjectStore } from '../../../../../electron/local-store/store';
import { readProjectSqlite } from '../../../../../scripts/content/read-project-sqlite.mts';
import { sharedContentFile } from '../../../../../scripts/lib/sharedContentSqlite';
import { runCheck, type Verdict } from './checks';
import { buildFixture } from './fixtures';
import { loadSuite, selectJobs, type SmallJob } from './suite';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SESSION = resolve(REPO_ROOT, 'src/harnesses/assistant-capability/node/wholeGameSession.mjs');
const PROVIDER_ERROR = /\b(429|5\d\d)\b|rate.?limit|overloaded|quota|ECONN|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|upstream|network|timed? ?out/iu;
const MAX_PARALLEL = 2; // 값싼 모델 엔드포인트는 세션 둘을 넘기면 속도 제한에 걸린다.
const BOOT_LIMIT_MS = 12 * 60_000, STOP_LIMIT_MS = 8 * 60_000;
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
const readJson = (file: string): any => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const writeJson = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2));

export type RunOptions = { out?: string; model?: string; only?: string; v2: boolean; parallel?: string; timeoutMin?: string; skipCompleted: boolean };
export type JobStatus = 'pass' | 'fail' | 'timeout' | 'infra';
export type JobResult = {
  id: string; family: string; fixture: string; request: string; status: JobStatus; pass: boolean;
  /** 판정 글 한 줄(불합격·시간 초과·기반 오류의 까닭 포함). */
  reason: string;
  check: Verdict | null;
  /** 도구 호출(순서대로). ok=false 는 거절·실패한 호출. */
  toolCalls: Array<{ name: string; ok: boolean }>;
  toolCallCount: number; toolErrors: number;
  /** 요청을 보낸 뒤 턴이 가라앉을 때까지(되물음에 답한 턴 포함). */
  wallMs: number;
  /** 실행기가 잰 모델 실행 시간(턴 사이 대기 제외). */
  runMs: number;
  modelCalls: number;
  tokens: { input: number; output: number; cacheRead: number; reviewTotal: number };
  /** 첫 모델 호출의 지시문 글자 수와 처음부터 실린 도구 수. */
  systemPromptChars: number | null; toolsOffered: number | null; toolsOfferedNames: string[]; toolSchemaChars: number | null;
  /** v2 의 턴 끝 판정(할 일 장부). v1 은 null. */
  complete: boolean | null; completeNote: string;
  turns: Array<{ step: string; outcome: string; wallMs: number; tools: number }>;
  autoAnswered: boolean; pendingCards: string[];
  errors: string[];
  persistence: { saved: boolean; reloadedSame: boolean; rendererEqual: boolean } | null;
  model: string; provider: string; assistantVersion: string;
  answer: string;
  /** 도구 호출 발췌: 이름 · 성공 여부 · 모델이 받은 글 앞머리. */
  trace: Array<{ name: string; ok: boolean; args: string; result: string }>;
  statusNotes: string[];
  startedAt: string; finishedAt: string;
};

function modelPin(name: string): { file: string; config: any } {
  const file = resolve(REPO_ROOT, 'harness-data/assistant-capability/ai-configs', `${name}.json`);
  if (!existsSync(file)) throw Error(`--model ${name}: ${file} 가 없다(ai-configs 의 파일 이름으로 고른다)`);
  return { file, config: JSON.parse(readFileSync(file, 'utf8')) };
}
function sessionEnv(config: any, pinned: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, OPRN_TURN_DIAG: '1', OPRN_SHARED_CONTENT_SQLITE: pinned };
  if (!env.HARNESS_DIST_DIR && existsSync(resolve(REPO_ROOT, 'dist/index.html'))) env.HARNESS_DIST_DIR = 'dist';
  if (String(config.providerId ?? '').startsWith('openai-compat:') && !env.OPRN_OPENAI_COMPAT_PATH) {
    // 사용자 지정 엔드포인트(주소·키)는 저장소 밖 파일에서만 읽는다. 값은 찍지 않는다.
    const store = resolve(homedir(), '.oprn-suite/openai-compat-endpoints.json');
    if (!existsSync(store)) throw Error(`OPRN_OPENAI_COMPAT_PATH 가 없고 ${store} 도 없다 — ${config.providerId} 엔드포인트 저장 파일이 필요하다`);
    const known = Object.keys(readJson(store)?.endpoints ?? {});
    if (!known.includes(config.providerId)) throw Error(`${store} 에 ${config.providerId} 엔드포인트가 없다`);
    env.OPRN_OPENAI_COMPAT_PATH = store;
  }
  return env;
}
/** 저장 문서에서 타일셋 본문을 뺀 사본(오프라인 재판정용, gz 수백 KB). 타일셋은 번들에서 다시 얻는다. */
function keepSlim(file: string, project: Project): void {
  const { tilesets: _tilesets, ...rest } = project as any;
  writeFileSync(file, gzipSync(JSON.stringify(rest), { level: 6 }));
}
function gitInfo(): { sha: string; branch: string; dirty: boolean; mainBase: string } {
  const git = (...args: string[]) => { try { return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
  // mainBase = 이 체크아웃이 올라탄 main 커밋(측정 브랜치의 머리가 아니라 조수 코드의 기준을 말한다).
  return { sha: git('rev-parse', '--short=10', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'), dirty: git('status', '--porcelain', '--', 'src', 'scripts', 'electron').length > 0,
    mainBase: git('merge-base', 'HEAD', 'origin/main').slice(0, 10) };
}

async function waitFor(test: () => boolean, limitMs: number, alive: () => boolean): Promise<'ok' | 'limit' | 'exited'> {
  const until = Date.now() + limitMs;
  for (;;) {
    if (test()) return 'ok';
    if (!alive()) return test() ? 'ok' : 'exited';
    if (Date.now() > until) return 'limit';
    await sleep(2000);
  }
}

async function runJob(job: SmallJob, root: string, pin: { file: string; config: any }, env: NodeJS.ProcessEnv, options: { v2: boolean; limitMs: number; autoAnswer: string }): Promise<JobResult> {
  const startedAt = new Date().toISOString();
  const dir = resolve(root, 'jobs', job.id), projectDir = resolve(dir, 'project'), session = resolve(dir, 'session');
  mkdirSync(resolve(session, 'inbox'), { recursive: true });
  const base: JobResult = { id: job.id, family: job.family, fixture: job.fixture, request: job.request, status: 'infra', pass: false, reason: '', check: null,
    toolCalls: [], toolCallCount: 0, toolErrors: 0, wallMs: 0, runMs: 0, modelCalls: 0, tokens: { input: 0, output: 0, cacheRead: 0, reviewTotal: 0 },
    systemPromptChars: null, toolsOffered: null, toolsOfferedNames: [], toolSchemaChars: null, complete: null, completeNote: '', turns: [], autoAnswered: false, pendingCards: [],
    errors: [], persistence: null, model: '', provider: '', assistantVersion: '', answer: '', trace: [], statusNotes: [], startedAt, finishedAt: startedAt };
  const finish = (patch: Partial<JobResult>): JobResult => {
    const result = { ...base, ...patch, finishedAt: new Date().toISOString() };
    writeJson(resolve(dir, 'result.json'), result);
    return result;
  };

  // 1) 새 정본: 픽스처를 이 일만의 SQLite 프로젝트로 저장한다.
  const store = await initLocalProjectStore({ projectDir });
  try { await store.saveProject(buildFixture(job.fixture)); } finally { store.close(); }

  // 2) 실제 편집기 세션(자기 프로세스 그룹). 끝나면 그 그룹만 정리한다.
  const child = spawn(process.env.SMALL_JOBS_NODE ?? 'node', [SESSION, '--project-dir', projectDir, '--out', session, ...(options.v2 ? ['--v2'] : []), '--ai-config', pin.file, '--turn-timeout-ms', String(options.limitMs), '--no-live'],
    { cwd: REPO_ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let driverLog = '';
  child.stdout?.on('data', data => { driverLog = (driverLog + data).slice(-4000); });
  child.stderr?.on('data', data => { driverLog = (driverLog + data).slice(-4000); });
  let exited = false;
  child.once('exit', () => { exited = true; });
  const alive = () => !exited;
  const killGroup = async () => {
    if (exited || !child.pid) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* 이미 끝남 */ }
    await waitFor(() => exited, 15000, alive);
    if (!exited) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 이미 끝남 */ } }
  };
  const state = () => readJson(resolve(session, 'state.json')) ?? {};
  try {
    const booted = await waitFor(() => ['idle', 'crashed'].includes(state().phase), BOOT_LIMIT_MS, alive);
    if (booted !== 'ok' || state().phase !== 'idle') {
      await killGroup();
      return finish({ status: 'infra', reason: `편집기 기동 실패(${booted}, phase ${state().phase ?? '-'}): ${String(state().failure ?? driverLog).slice(-400)}` });
    }
    // 3) 요청 전 저장 문서(편집기 첫 부팅이 공용 라이브러리를 설치한 뒤) — 판정의 「전」.
    const before = readProjectSqlite(projectDir);
    keepSlim(resolve(dir, 'before.json.gz'), before);

    // 4) 한 턴. 되물으면 한 번만 답한다. 상한은 요청을 보낸 순간부터 잰다.
    const steps = ['001'];
    writeFileSync(resolve(session, 'deadline'), String(Date.now() + options.limitMs + 20_000));
    writeFileSync(resolve(session, 'inbox', '001.txt'), job.request);
    const turnDone = (step: string) => existsSync(resolve(session, 'turns', `${step}.json`)) && state().phase !== 'turn';
    let waited = await waitFor(() => turnDone('001'), options.limitMs + 4 * 60_000, alive);
    let autoAnswered = false;
    if (waited === 'ok' && state().phase === 'awaiting-answer') {
      autoAnswered = true; steps.push('002');
      writeFileSync(resolve(session, 'inbox', '002.txt'), options.autoAnswer);
      waited = await waitFor(() => turnDone('002'), options.limitMs + 4 * 60_000, alive);
    }
    // 5) 저장 → 새 브라우저 컨텍스트 재로드 → 종료.
    const stopStep = String(steps.length + 1).padStart(3, '0');
    if (alive()) writeFileSync(resolve(session, 'inbox', `${stopStep}.stop`), '');
    const stopped = await waitFor(() => exited, STOP_LIMIT_MS, alive);
    if (stopped !== 'ok' && !exited) await killGroup();

    // 6) 기록 읽기 + 판정.
    const turns = steps.map(step => readJson(resolve(session, 'turns', `${step}.json`))).filter(Boolean);
    const metrics = collect(turns);
    const persistenceFile = readdirSync(session).find(name => name.startsWith('persistence-final-'));
    const receipt = persistenceFile ? readJson(resolve(session, persistenceFile)) : null;
    const persistence = receipt ? { saved: ['idle', 'saved'].includes(receipt.saveKind), reloadedSame: receipt.sameStoredDocument === true, rendererEqual: receipt.rendererMapsAndDatabaseEqual === true } : null;
    if (!turns.length) return finish({ ...metrics, autoAnswered, status: 'infra', reason: `턴 기록이 없다(${waited}, phase ${state().phase ?? '-'}): ${String(state().failure ?? driverLog).slice(-400)}` });
    const after = readProjectSqlite(projectDir);
    keepSlim(resolve(dir, 'after.json.gz'), after);
    const check = runCheck(job.check, job.allow, before, after);
    const { status, reason } = decide({ check, turnOutcomes: turns.map(turn => String(turn.outcome)), waitedLimit: waited === 'limit', errors: metrics.errors ?? [], toolCallCount: metrics.toolCallCount ?? 0, persistence, limitMs: options.limitMs });
    return finish({ ...metrics, autoAnswered, persistence, check, status, pass: status === 'pass', reason });
  } catch (error) {
    await killGroup();
    return finish({ status: 'infra', reason: `실행기 오류: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
  } finally {
    await killGroup();
  }
}

/**
 * 판정 + 턴 기록 → 상태 한 가지. 실행기와 오프라인 재판정(rescore)이 같은 규칙을 쓴다.
 * 통과 = 판정 합격 + 저장·재로드 확인 + 시간 안. 기반 오류 = 모델·호스트 쪽 오류로 일을 못 한 것(조수의 불합격과 따로 센다).
 */
export function decide(input: { check: Verdict; turnOutcomes: string[]; waitedLimit: boolean; errors: string[]; toolCallCount: number; persistence: JobResult['persistence']; limitMs: number }): { status: JobStatus; reason: string } {
  const { check, persistence } = input;
  const errors = input.errors.filter(error => !error.startsWith('page: '));
  const timedOut = input.turnOutcomes.includes('timeout') || input.waitedLimit;
  const stillAsking = input.turnOutcomes.at(-1) === 'awaiting-answer';
  // 도구 호출 없이 오류로 끝났거나, 제공자 오류(속도 제한·연결·5xx)가 난 채 불합격이면 기반 오류다.
  const infra = !check.pass && errors.length > 0 && (input.toolCallCount === 0 || errors.some(error => PROVIDER_ERROR.test(error)));
  const persisted = !!persistence && persistence.saved && persistence.reloadedSame;
  const status: JobStatus = infra ? 'infra' : timedOut ? 'timeout' : check.pass && persisted ? 'pass' : 'fail';
  const reason = infra ? `기반 오류: ${errors[0]?.slice(0, 240)}`
    : timedOut ? `시간 초과(${Math.round(input.limitMs / 60_000)}분) — 그때까지의 저장 결과: ${check.pass ? '판정은 통과' : check.reason}`
      : !check.pass ? `${check.reason}${stillAsking ? ' · 조수가 두 번째 질문에서 멈췄다' : ''}${errors.length ? ` · 턴 오류: ${errors[0]!.slice(0, 160)}` : ''}`
        : !persisted ? `판정은 통과했지만 저장·재로드 확인 실패(${JSON.stringify(persistence)})` : check.reason;
  return { status, reason };
}

/** 턴 기록(wholeGameSession 의 turns/NNN.json)에서 숫자와 발췌를 뽑는다. */
function collect(turns: any[]): Partial<JobResult> {
  const calls = turns.flatMap(turn => (turn.toolCalls ?? []).map((call: any) => ({ name: String(call.name), ok: call.ok !== false, result: String(call.modelText ?? call.summary ?? '') })));
  const args = turns.flatMap(turn => turn.toolArgs ?? []);
  const done = turns.flatMap(turn => turn.done ?? []).map((entry: any) => entry.stats ?? {});
  const sum = (pick: (stats: any) => number | undefined) => done.reduce((total, stats) => total + (pick(stats) ?? 0), 0);
  const prompts = turns.flatMap(turn => turn.prompts ?? []);
  const requests = turns.flatMap(turn => turn.requests ?? []).filter((request: any) => request.endpoint === '/v1/agent/run');
  const final = turns.flatMap(turn => turn.v2Final ?? []).at(-1);
  return {
    toolCalls: calls.map(({ name, ok }) => ({ name, ok })), toolCallCount: calls.length, toolErrors: calls.filter(call => !call.ok).length,
    wallMs: turns.reduce((total, turn) => total + (turn.turnMs ?? turn.elapsedMs ?? 0), 0), runMs: sum(stats => stats.ms), modelCalls: sum(stats => stats.usage?.calls),
    tokens: { input: sum(stats => stats.usage?.input), output: sum(stats => stats.usage?.output), cacheRead: sum(stats => stats.usage?.cacheRead), reviewTotal: sum(stats => stats.review?.totalTokens) },
    systemPromptChars: prompts[0]?.systemChars ?? null, toolsOffered: prompts[0]?.toolCount ?? null, toolsOfferedNames: prompts[0]?.toolNames ?? [], toolSchemaChars: prompts[0]?.sectionChars?.tools ?? null,
    complete: final ? final.complete === true : null, completeNote: final?.summary ?? '',
    turns: turns.map(turn => ({ step: turn.step, outcome: turn.outcome, wallMs: turn.turnMs ?? turn.elapsedMs ?? 0, tools: (turn.toolCalls ?? []).length })),
    pendingCards: turns.flatMap(turn => (turn.pendingCards ?? []).map((card: any) => `${card.testid}: ${String(card.text).split('\n')[0]?.slice(0, 160)}`)),
    errors: turns.flatMap(turn => [...(turn.errors ?? []), ...(turn.pageErrors ?? []).map((error: any) => `page: ${error.message}`)]).map(String),
    model: [...new Set(requests.map((request: any) => request.model))].join('/'), provider: [...new Set(requests.map((request: any) => request.provider))].join('/'),
    assistantVersion: [...new Set(requests.map((request: any) => request.assistantVersion ?? 'v1'))].join('/'),
    answer: String(turns.at(-1)?.answer ?? '').slice(0, 2000),
    trace: calls.map((call, index) => ({ name: call.name, ok: call.ok, args: JSON.stringify(args[index]?.name === call.name ? args[index]?.args ?? {} : {}).slice(0, 400), result: call.result.slice(0, 500) })),
    statusNotes: turns.flatMap(turn => turn.statusNotes ?? []).filter((note: string) => !/^(turn\.diag|tool\.size)/u.test(note)).map((note: string) => note.slice(0, 300)).slice(-30),
  };
}

const median = (values: number[]): number => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : Math.round((sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2)) : 0; };
export function summarize(results: JobResult[], meta: Record<string, unknown>): Record<string, unknown> {
  const count = (list: JobResult[]) => ({ jobs: list.length, pass: list.filter(r => r.status === 'pass').length, fail: list.filter(r => r.status === 'fail').length, timeout: list.filter(r => r.status === 'timeout').length, infra: list.filter(r => r.status === 'infra').length, complete: list.filter(r => r.complete === true).length });
  const families = [...new Set(results.map(r => r.family))];
  const ran = results.filter(r => r.status !== 'infra');
  return { schemaVersion: 1, kind: 'assistant-small-jobs-run', ...meta, counts: count(results),
    perFamily: Object.fromEntries(families.map(family => [family, count(results.filter(r => r.family === family))])),
    perFixture: Object.fromEntries([...new Set(results.map(r => r.fixture))].map(fixture => [fixture, count(results.filter(r => r.fixture === fixture))])),
    medians: { toolCalls: median(ran.map(r => r.toolCallCount)), wallMs: median(ran.map(r => r.wallMs)), runMs: median(ran.map(r => r.runMs)), modelCalls: median(ran.map(r => r.modelCalls)),
      inputTokens: median(ran.map(r => r.tokens.input + r.tokens.cacheRead)), outputTokens: median(ran.map(r => r.tokens.output)), systemPromptChars: median(ran.map(r => r.systemPromptChars ?? NaN)), toolsOffered: median(ran.map(r => r.toolsOffered ?? NaN)), toolSchemaChars: median(ran.map(r => r.toolSchemaChars ?? NaN)) },
    totals: { wallMs: results.reduce((n, r) => n + r.wallMs, 0), inputTokens: results.reduce((n, r) => n + r.tokens.input + r.tokens.cacheRead, 0), outputTokens: results.reduce((n, r) => n + r.tokens.output, 0), toolCalls: results.reduce((n, r) => n + r.toolCallCount, 0) },
    jobs: results };
}
const minutes = (ms: number) => (ms / 60_000).toFixed(1);
function summaryMarkdown(summary: any): string {
  const c = summary.counts, m = summary.medians;
  const rows = (summary.jobs as JobResult[]).map(r => `| ${r.id} | ${r.family} | ${r.status.toUpperCase()} | ${r.complete === null ? '-' : r.complete ? '완료' : '미완료'} | ${r.toolCallCount}${r.toolErrors ? ` (✗${r.toolErrors})` : ''} | ${minutes(r.wallMs)} | ${Math.round((r.tokens.input + r.tokens.cacheRead) / 1000)}k/${(r.tokens.output / 1000).toFixed(1)}k | ${r.systemPromptChars ?? '-'} | ${r.toolsOffered ?? '-'} | ${r.reason.replace(/\|/gu, '/').slice(0, 160)} |`);
  return `# 작은 일 30가지 — ${summary.model} · ${summary.assistantVersion}\n\n기준 main ${summary.git.mainBase || '-'} · 머리 ${summary.git.sha}(${summary.git.branch}${summary.git.dirty ? ', 작업 트리 변경 있음' : ''}) · ${summary.startedAt} ~ ${summary.finishedAt}\n\n` +
    `**통과 ${c.pass}/${c.jobs}** · 불합격 ${c.fail} · 시간 초과 ${c.timeout} · 기반 오류 ${c.infra} · 턴이 «완료»로 끝난 것 ${c.complete}\n\n` +
    `중앙값: 도구 호출 ${m.toolCalls} · 시간 ${minutes(m.wallMs)}분 · 모델 호출 ${m.modelCalls} · 입력 ${Math.round(m.inputTokens / 1000)}k 토큰 · 출력 ${(m.outputTokens / 1000).toFixed(1)}k 토큰 · 지시문 ${m.systemPromptChars}자 · 처음 실린 도구 ${m.toolsOffered}개(도구 설명 ${m.toolSchemaChars}자)\n\n` +
    `| 가족 | 통과 | 불합격 | 시간 초과 | 기반 오류 |\n|---|---|---|---|---|\n${Object.entries<any>(summary.perFamily).map(([family, n]) => `| ${family} | ${n.pass}/${n.jobs} | ${n.fail} | ${n.timeout} | ${n.infra} |`).join('\n')}\n\n` +
    `| 일 | 가족 | 결과 | 턴 끝 | 호출 | 분 | 토큰 in/out | 지시문 자 | 도구 수 | 까닭 |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

export function writeRunSummary(root: string, results: JobResult[], meta: Record<string, unknown>): any {
  const summary = summarize(results, meta);
  writeJson(resolve(root, 'summary.json'), summary);
  writeFileSync(resolve(root, 'SUMMARY.md'), summaryMarkdown(summary));
  return summary;
}

export async function runSmallJobs(options: RunOptions): Promise<number> {
  const suite = loadSuite();
  const jobs = selectJobs(suite, options.only);
  const pinName = options.model ?? 'terra-high';
  const pin = modelPin(pinName);
  const root = resolve(options.out ?? resolve(REPO_ROOT, 'qa-runs/harnesses/assistant-capability', `small-jobs-${new Date().toISOString().replace(/[:.]/gu, '-')}`));
  mkdirSync(resolve(root, 'jobs'), { recursive: true });
  if (!existsSync(resolve(REPO_ROOT, 'dist-electron/browser-bridge.js'))) throw Error('dist-electron/browser-bridge.js 가 없다 — 먼저 npm run -s build:fast && node scripts/build-electron.mjs');
  // 공용 라이브러리 판본을 실행 한 번에 하나로 고정한다(일마다 다른 판본이 설치되지 않게).
  const pinned = resolve(root, 'shared-content.sqlite');
  if (!existsSync(pinned)) { const source = new DatabaseSync(sharedContentFile(), { readOnly: true }); try { await backup(source, pinned); } finally { source.close(); } }
  const env = sessionEnv(pin.config, pinned);
  const limitMs = Math.round(Number(options.timeoutMin ?? 10) * 60_000);
  const parallel = Math.max(1, Math.min(MAX_PARALLEL, Number(options.parallel ?? MAX_PARALLEL) || MAX_PARALLEL));
  const startedAt = new Date().toISOString(), git = gitInfo();
  const results = new Map<string, JobResult>();
  const queue: SmallJob[] = [];
  for (const job of jobs) {
    const dir = resolve(root, 'jobs', job.id), done = readJson(resolve(dir, 'result.json')) as JobResult | null;
    if (done && options.skipCompleted) { results.set(job.id, done); continue; }
    if (done) throw Error(`${job.id}: 이미 실행한 결과가 있다(${dir}). 새 --out 을 쓰거나 --skip-completed 로 남은 일만 돌린다 — 실모델 시도는 덮어쓰지 않는다.`);
    // 결과 없이 남은 폴더(중단된 시도)는 지우지 않고 옆으로 치운다.
    if (existsSync(dir)) renameSync(dir, `${dir}.aborted-${Date.now()}`);
    queue.push(job);
  }
  console.log(`small-jobs: ${queue.length}개 실행(${results.size}개는 이미 끝남) · 모델 ${pinName} · ${options.v2 ? 'v2' : 'v1'} · 동시 ${parallel} · 일당 상한 ${limitMs / 60_000}분 → ${root}`);
  const writeSummary = () => {
    const ordered = jobs.map(job => results.get(job.id)).filter((result): result is JobResult => !!result);
    const first = ordered.find(result => result.model);
    return writeRunSummary(root, ordered, { suite: 'harness-data/assistant-capability/small-jobs.json', modelPin: pinName, model: first ? `${first.provider} ${first.model} (${pin.config.reasoningEffort ?? '-'})` : `${pin.config.providerId} ${pin.config.model} (${pin.config.reasoningEffort ?? '-'})`,
      assistantVersion: options.v2 ? 'v2' : 'v1', timeLimitMin: limitMs / 60_000, parallel, git, startedAt, finishedAt: new Date().toISOString(), planned: jobs.length });
  };
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const result = await runJob(job, root, pin, env, { v2: options.v2, limitMs, autoAnswer: suite.autoAnswer });
      results.set(job.id, result);
      console.log(`${result.status.toUpperCase().padEnd(7)} ${job.id} — 호출 ${result.toolCallCount} · ${minutes(result.wallMs)}분 · ${result.reason.slice(0, 140)}`);
      writeSummary();
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  const summary = writeSummary();
  console.log(`\nsmall-jobs: 통과 ${summary.counts.pass}/${summary.counts.jobs} · 불합격 ${summary.counts.fail} · 시간 초과 ${summary.counts.timeout} · 기반 오류 ${summary.counts.infra}\n${resolve(root, 'SUMMARY.md')}`);
  // 실행기가 끝까지 돌았으면 0 — 조수의 통과율은 종료 코드가 아니라 summary.json 이 말한다.
  return summary.counts.jobs === jobs.length ? 0 : 1;
}
