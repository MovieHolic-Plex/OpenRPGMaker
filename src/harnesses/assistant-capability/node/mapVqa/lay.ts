// 맵 깔기 묶음 실행기(bun) — map-vqa 의 말뭉치 B. 요청마다: 빈 프로젝트 정본 → 실제 편집기 입력창에 한 턴(wholeGameSession.mjs, v2 + 고정 모델)
// → 저장·새 컨텍스트 재로드 → 저장 문서 전/후를 남긴다. 기계 합격은 없다(그림 검수자가 본다). 작은 일 실행기(smallJobs/run.ts)와 같은 길·같은 규칙:
// 동시 최대 2, 되물으면 한 번만 답함, 결과가 있는 요청은 덮어쓰지 않음, 실패·시간 초과·기반 오류를 그대로 적음.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '../../../../project/defaults';
import { initLocalProjectStore } from '../../../../../electron/local-store/store';
import { readProjectSqlite } from '../../../../../scripts/content/read-project-sqlite.mts';
import { sharedContentFile } from '../../../../../scripts/lib/sharedContentSqlite';
import { collect, gitInfo, keepSlim, modelPin, sessionEnv, waitFor } from '../smallJobs/run';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const REQUESTS_FILE = resolve(REPO_ROOT, 'harness-data/assistant-capability/map-vqa/requests.json');
const MAX_PARALLEL = 2, BOOT_LIMIT_MS = 12 * 60_000, STOP_LIMIT_MS = 8 * 60_000;
const readJson = (file: string): any => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const writeJson = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2));

export type LayJob = { id: string; kind: string; maps: number; request: string };
export type LaySet = { schemaVersion: 1; kind: 'assistant-map-laying-set'; title: string; description: string; autoAnswer: string; jobs: LayJob[] };
export type LayStatus = 'laid' | 'nothing' | 'timeout' | 'infra';
export type LayResult = {
  id: string; kind: string; request: string; status: LayStatus; reason: string;
  /** 조수가 새로 만들었거나 고친 맵(턴 전 문서와 다른 맵). */
  maps: Array<{ id: string; name: string; width: number; height: number; tilesetId: string; events: number; isNew: boolean }>;
  wantedMaps: number;
  toolCalls: Array<{ name: string; ok: boolean }>; toolCallCount: number; toolErrors: number; wallMs: number; modelCalls: number;
  tokens: { input: number; output: number; cacheRead: number; reviewTotal: number };
  complete: boolean | null; completeNote: string; autoAnswered: boolean; errors: string[];
  persistence: { saved: boolean; reloadedSame: boolean; rendererEqual: boolean } | null;
  model: string; provider: string; assistantVersion: string; answer: string; startedAt: string; finishedAt: string;
};

export function loadLaySet(file = REQUESTS_FILE): LaySet {
  const set = JSON.parse(readFileSync(file, 'utf8')) as LaySet;
  const seen = new Set<string>();
  for (const job of set.jobs) {
    if (!/^[a-z0-9-]+$/u.test(job.id) || seen.has(job.id)) throw Error(`${file}: id ${job.id} 가 잘못됐거나 겹친다`);
    seen.add(job.id);
    if (!/[가-힣]/u.test(job.request) || /\(\s*\d+\s*,\s*\d+\s*\)|\d+\s*[x×]\s*\d+/u.test(job.request)) throw Error(`${file}: ${job.id} 의 request 는 좌표·크기 없는 한국어 문장이어야 한다`);
  }
  return set;
}

/** 턴 전 문서와 다른 맵(새 맵 포함). 이름만 같은 빈 시작 맵은 뺀다. */
export function laidMaps(before: any, after: any): LayResult['maps'] {
  // 열쇠 순서가 달라도 같은 맵은 같은 맵이다(저장소에서 다시 읽으면 순서가 바뀐다).
  const stable = (value: any): string => JSON.stringify(value, (_key, inner) => inner && typeof inner === 'object' && !Array.isArray(inner) ? Object.fromEntries(Object.keys(inner).sort().map(key => [key, inner[key]])) : inner);
  return Object.values<any>(after.maps ?? {}).filter(map => stable(before.maps?.[map.id] ?? null) !== stable(map))
    .map(map => ({ id: map.id, name: map.name ?? map.id, width: map.width, height: map.height, tilesetId: map.tilesetId, events: (map.events ?? []).length, isNew: !before.maps?.[map.id] }));
}

async function runJob(job: LayJob, root: string, editorRoot: string, pin: { file: string; config: any }, env: NodeJS.ProcessEnv, options: { v2: boolean; limitMs: number; autoAnswer: string }): Promise<LayResult> {
  const startedAt = new Date().toISOString();
  const dir = resolve(root, 'jobs', job.id), projectDir = resolve(dir, 'project'), session = resolve(dir, 'session');
  mkdirSync(resolve(session, 'inbox'), { recursive: true });
  const base: LayResult = { id: job.id, kind: job.kind, request: job.request, status: 'infra', reason: '', maps: [], wantedMaps: job.maps, toolCalls: [], toolCallCount: 0, toolErrors: 0, wallMs: 0, modelCalls: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, reviewTotal: 0 }, complete: null, completeNote: '', autoAnswered: false, errors: [], persistence: null, model: '', provider: '', assistantVersion: '', answer: '', startedAt, finishedAt: startedAt };
  const finish = (patch: Partial<LayResult>): LayResult => { const result = { ...base, ...patch, finishedAt: new Date().toISOString() }; writeJson(resolve(dir, 'result.json'), result); return result; };
  const store = await initLocalProjectStore({ projectDir });
  try { await store.saveProject(createBlankProject()); } finally { store.close(); }
  const child = spawn(process.env.SMALL_JOBS_NODE ?? 'node', [resolve(editorRoot, 'src/harnesses/assistant-capability/node/wholeGameSession.mjs'), '--project-dir', projectDir, '--out', session, ...(options.v2 ? ['--v2'] : []), '--ai-config', pin.file, '--turn-timeout-ms', String(options.limitMs), '--no-live'],
    { cwd: editorRoot, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let driverLog = '', exited = false;
  child.stdout?.on('data', data => { driverLog = (driverLog + data).slice(-4000); });
  child.stderr?.on('data', data => { driverLog = (driverLog + data).slice(-4000); });
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
    if (booted !== 'ok' || state().phase !== 'idle') { await killGroup(); return finish({ status: 'infra', reason: `편집기 기동 실패(${booted}, phase ${state().phase ?? '-'}): ${String(state().failure ?? driverLog).slice(-400)}` }); }
    const before = readProjectSqlite(projectDir);
    keepSlim(resolve(dir, 'before.json.gz'), before);
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
    const stopStep = String(steps.length + 1).padStart(3, '0');
    if (alive()) writeFileSync(resolve(session, 'inbox', `${stopStep}.stop`), '');
    const stopped = await waitFor(() => exited, STOP_LIMIT_MS, alive);
    if (stopped !== 'ok' && !exited) await killGroup();
    const turns = steps.map(step => readJson(resolve(session, 'turns', `${step}.json`))).filter(Boolean);
    const metrics = collect(turns);
    const picked = { toolCalls: metrics.toolCalls ?? [], toolCallCount: metrics.toolCallCount ?? 0, toolErrors: metrics.toolErrors ?? 0, wallMs: metrics.wallMs ?? 0, modelCalls: metrics.modelCalls ?? 0, tokens: metrics.tokens ?? base.tokens,
      complete: metrics.complete ?? null, completeNote: metrics.completeNote ?? '', errors: metrics.errors ?? [], model: metrics.model ?? '', provider: metrics.provider ?? '', assistantVersion: metrics.assistantVersion ?? '', answer: metrics.answer ?? '', autoAnswered };
    const persistenceFile = readdirSync(session).find(name => name.startsWith('persistence-final-'));
    const receipt = persistenceFile ? readJson(resolve(session, persistenceFile)) : null;
    const persistence = receipt ? { saved: ['idle', 'saved'].includes(receipt.saveKind), reloadedSame: receipt.sameStoredDocument === true, rendererEqual: receipt.rendererMapsAndDatabaseEqual === true } : null;
    if (!turns.length) return finish({ ...picked, status: 'infra', reason: `턴 기록이 없다(${waited}, phase ${state().phase ?? '-'}): ${String(state().failure ?? driverLog).slice(-400)}` });
    const after = readProjectSqlite(projectDir);
    keepSlim(resolve(dir, 'after.json.gz'), after);
    const maps = laidMaps(before, after);
    const timedOut = turns.some(turn => turn.outcome === 'timeout') || waited === 'limit';
    const realErrors = picked.errors.filter(error => !error.startsWith('page: '));
    const status: LayStatus = !maps.length && realErrors.length && picked.toolCallCount === 0 ? 'infra' : timedOut ? 'timeout' : maps.length ? 'laid' : 'nothing';
    const reason = status === 'infra' ? `기반 오류: ${realErrors[0]?.slice(0, 240)}` : `${status === 'timeout' ? `시간 초과(${Math.round(options.limitMs / 60_000)}분) — 그때까지 ` : ''}바뀐 맵 ${maps.length}장(${maps.map(map => `${map.name} ${map.width}×${map.height}`).join(', ') || '없음'}) · 바란 맵 ${job.maps}장`;
    return finish({ ...picked, persistence, maps, status, reason });
  } catch (error) {
    await killGroup();
    return finish({ status: 'infra', reason: `실행기 오류: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
  } finally { await killGroup(); }
}

export type LayOptions = { out?: string; model?: string; only?: string; v2: boolean; parallel?: string; timeoutMin?: string; skipCompleted: boolean; /** 빌드된 편집기가 있는 체크아웃(dist · dist-electron). 없으면 이 저장소. */ editorRoot?: string };
export async function runMapLaying(options: LayOptions): Promise<number> {
  const set = loadLaySet();
  const only = (options.only ?? '').split(',').map(id => id.trim()).filter(Boolean);
  const unknown = only.filter(id => !set.jobs.some(job => job.id === id || job.kind === id));
  if (unknown.length) throw Error(`--only: 없는 요청·종류 ${unknown.join(', ')}`);
  const jobs = only.length ? set.jobs.filter(job => only.includes(job.id) || only.includes(job.kind)) : set.jobs;
  if (!options.out) throw Error('map-vqa-lay --out <새 실행 폴더> --model terra-high --v2 [--editor-root <빌드된 체크아웃>]');
  const root = resolve(options.out), editorRoot = resolve(options.editorRoot ?? REPO_ROOT);
  if (!existsSync(resolve(editorRoot, 'dist-electron/browser-bridge.js')) || !existsSync(resolve(editorRoot, 'dist/index.html'))) throw Error(`${editorRoot} 에 편집기 빌드(dist · dist-electron)가 없다 — 먼저 npm run -s build:fast && node scripts/build-electron.mjs, 또는 --editor-root 로 빌드된 체크아웃을 준다`);
  mkdirSync(resolve(root, 'jobs'), { recursive: true });
  const pinName = options.model ?? 'terra-high', pin = modelPin(pinName);
  const pinned = resolve(root, 'shared-content.sqlite');
  if (!existsSync(pinned)) { const source = new DatabaseSync(sharedContentFile(), { readOnly: true }); try { await backup(source, pinned); } finally { source.close(); } }
  const env = { ...sessionEnv(pin.config, pinned), HARNESS_DIST_DIR: 'dist' };
  const limitMs = Math.round(Number(options.timeoutMin ?? 20) * 60_000);
  const parallel = Math.max(1, Math.min(MAX_PARALLEL, Number(options.parallel ?? MAX_PARALLEL) || MAX_PARALLEL));
  const editorGit = (() => { try { return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { cwd: editorRoot, encoding: 'utf8' }).trim(); } catch { return ''; } })();
  const startedAt = new Date().toISOString(), results = new Map<string, LayResult>(), queue: LayJob[] = [];
  for (const job of jobs) {
    const dir = resolve(root, 'jobs', job.id), done = readJson(resolve(dir, 'result.json')) as LayResult | null;
    if (done && options.skipCompleted) { results.set(job.id, done); continue; }
    if (done) throw Error(`${job.id}: 이미 실행한 결과가 있다(${dir}). 새 --out 을 쓰거나 --skip-completed 로 남은 것만 돌린다 — 실모델 시도는 덮어쓰지 않는다.`);
    if (existsSync(dir)) renameSync(dir, `${dir}.aborted-${Date.now()}`);
    queue.push(job);
  }
  console.log(`map-vqa-lay: ${queue.length}개 실행(${results.size}개는 이미 끝남) · 모델 ${pinName} · ${options.v2 ? 'v2' : 'v1'} · 동시 ${parallel} · 요청당 상한 ${limitMs / 60_000}분 · 편집기 ${editorRoot}@${editorGit} → ${root}`);
  const writeSummary = () => {
    const ordered = jobs.map(job => results.get(job.id)).filter((result): result is LayResult => !!result);
    const count = (status: LayStatus) => ordered.filter(result => result.status === status).length;
    const summary = { schemaVersion: 1, kind: 'assistant-map-laying-run', set: 'harness-data/assistant-capability/map-vqa/requests.json', title: set.title, modelPin: pinName,
      model: ordered.find(result => result.model) ? `${ordered.find(result => result.model)!.provider} ${ordered.find(result => result.model)!.model} (${pin.config.reasoningEffort ?? '-'})` : `${pin.config.providerId} ${pin.config.model}`,
      assistantVersion: options.v2 ? 'v2' : 'v1', timeLimitMin: limitMs / 60_000, parallel, editorRoot, editorHead: editorGit, git: gitInfo(), startedAt, finishedAt: new Date().toISOString(), planned: jobs.length,
      counts: { jobs: ordered.length, laid: count('laid'), nothing: count('nothing'), timeout: count('timeout'), infra: count('infra'), complete: ordered.filter(result => result.complete === true).length, maps: ordered.reduce((n, result) => n + result.maps.length, 0) },
      jobs: ordered };
    writeJson(resolve(root, 'summary.json'), summary);
    return summary;
  };
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const result = await runJob(job, root, editorRoot, pin, env, { v2: options.v2, limitMs, autoAnswer: set.autoAnswer });
      results.set(job.id, result);
      console.log(`${result.status.toUpperCase().padEnd(7)} ${job.id} — 호출 ${result.toolCallCount} · ${(result.wallMs / 60_000).toFixed(1)}분 · ${result.reason.slice(0, 160)}`);
      writeSummary();
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  const summary = writeSummary();
  console.log(`\nmap-vqa-lay: 맵을 깐 요청 ${summary.counts.laid}/${summary.counts.jobs} · 아무것도 안 깔림 ${summary.counts.nothing} · 시간 초과 ${summary.counts.timeout} · 기반 오류 ${summary.counts.infra} · 맵 ${summary.counts.maps}장\n${resolve(root, 'summary.json')}`);
  return summary.counts.jobs === jobs.length ? 0 : 1;
}
