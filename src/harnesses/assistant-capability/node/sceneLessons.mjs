// 장면 교훈 묶음(scene-lessons-seed.json)의 기계 채점 — 실제 입력창 시도(genre-run)가 남긴 저장본을 읽기만 한다.
//   node sceneLessons.mjs score --out <실행 폴더> [--case id] [--attempt n]
// 시도마다 attempt-N/score.json: 도구 호출·실패 호출·시간, scene-* 경고(과제가 0 을 요구하는 코드), qa-game 검사 막힘,
// 저장/재로드 SHA, 1배 맵 렌더 PNG 목록. 시각 판정은 여기서 하지 않는다(판정자 영수증은 visual.json 으로 따로).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const repo = process.cwd();
const GAME_LEVEL_CODES = new Set(['no-ending-trigger', 'no-ending', 'ending-unreachable']);

function attemptsOf(root, caseId) {
  const dir = resolve(root, caseId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => /^attempt-\d+$/.test(name)).map(name => resolve(dir, name));
}

function toolStats(trace) {
  const events = trace?.events ?? [];
  const starts = events.filter(event => event.type === 'tool_start');
  const ends = events.filter(event => event.type === 'tool_end');
  const failed = ends.filter(event => event.ok === false);
  const byName = {};
  for (const event of starts) byName[event.name ?? '?'] = (byName[event.name ?? '?'] ?? 0) + 1;
  return { calls: starts.length, failed: failed.length,
    failedNames: failed.map(event => event.name ?? '?'), byName,
    modelErrors: events.filter(event => event.type === 'error').map(event => String(event.message ?? '').slice(0, 300)) };
}

function sceneLint(live) {
  const run = spawnSync('npx', ['--no-install', 'tsx', 'scripts/qa/scene-polish-lint.mts', live, '--json'],
    { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (run.status !== 0) return { error: (run.stderr || run.stdout).slice(-800) };
  return { issues: JSON.parse(run.stdout) };
}

function gameCheck(live, out) {
  const run = spawnSync('bun', ['scripts/qa-game/check.mts', '--project', live, '--out', out, '--no-autoplay', '--quiet'],
    { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 600000 });
  const file = resolve(out, 'check.json');
  if (!existsSync(file)) return { error: (run.stderr || run.stdout || '').slice(-800), exit: run.status };
  const report = read(file);
  const findings = report.findings ?? report.issues ?? [];
  // A one-scene task is not a whole game: game-completion blockers are out of scope here.
  const sceneScope = f => !GAME_LEVEL_CODES.has(f.code);
  return { exit: run.status, outOfScope: findings.filter(f => f.severity === 'blocker' && !sceneScope(f)).map(f => f.code),
    blockers: findings.filter(f => f.severity === 'blocker' && sceneScope(f)).map(f => ({ code: f.code, message: String(f.message ?? '').slice(0, 240) })),
    warnings: findings.filter(f => f.severity === 'warning').length };
}

function renderMaps(live, out) {
  const run = spawnSync('bun', ['scripts/qa-game/render.mts', '--project', live, '--out', out, '--scale', '1'],
    { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 600000 });
  const dir = resolve(out, 'render');
  const pngs = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.png')).map(name => `render/render/${name}`) : [];
  return { exit: run.status, pngs, ...(run.status ? { error: (run.stderr || '').slice(-600) } : {}) };
}

export function scoreAttempt(root, entry, dir) {
  const resultFile = resolve(dir, 'result.json');
  if (!existsSync(resultFile)) return { caseId: entry.id, dir, pending: true };
  const result = read(resultFile);
  const trace = existsSync(resolve(dir, 'trace.json')) ? read(resolve(dir, 'trace.json')) : null;
  const live = resolve(dir, 'live.json');
  const score = { caseId: entry.id, attempt: result.attempt, dir, engine: result.assistantEngine,
    nativeModels: [...new Set((result.requests ?? []).map(r => `${r.provider ?? '?'}/${r.model ?? '?'}`))],
    elapsedMs: result.elapsedMs, turnSettled: result.turnSettled ?? null, turnFailure: result.turnFailure ?? null,
    modelDone: result.modelDone ?? false, completedMeasurement: result.completedMeasurement ?? false,
    failure: result.failure ?? null, contentChanged: result.contentChanged ?? false,
    persistence: result.persistence ? { sameStoredDocument: result.persistence.sameStoredDocument,
      rendererMapsAndDatabaseEqual: result.persistence.rendererMapsAndDatabaseEqual, afterSha256: result.persistence.afterSha256 } : null,
    tools: toolStats(trace) };
  if (existsSync(live)) {
    const lint = sceneLint(live);
    const required = new Set(entry.lint0 ?? []);
    score.sceneLint = lint.error ? { error: lint.error } : {
      total: lint.issues.length,
      byCode: lint.issues.reduce((acc, issue) => ({ ...acc, [issue.code]: (acc[issue.code] ?? 0) + 1 }), {}),
      requiredZeroViolations: lint.issues.filter(issue => required.has(issue.code)).map(issue => ({ code: issue.code, mapId: issue.mapId, message: String(issue.message).slice(0, 240) })),
    };
    score.gameCheck = gameCheck(live, resolve(dir, 'check'));
    score.render = renderMaps(live, resolve(dir, 'render'));
    const project = read(live);
    score.maps = Object.values(project.maps ?? {}).map(map => ({ id: map.id, name: map.name, w: map.width, h: map.height,
      events: (map.events ?? []).length, bgm: map.bgm?.mode ?? null }));
  }
  const lintOk = score.sceneLint && !score.sceneLint.error && score.sceneLint.requiredZeroViolations.length === 0;
  const saveOk = score.persistence?.sameStoredDocument === true && score.persistence?.rendererMapsAndDatabaseEqual === true;
  score.clarifyAsked = result.clarifyAsked ?? false;
  // 되묻기 건: 조수가 먼저 짧게 묻고 아무것도 바꾸지 않아야 합격이다(변경·저장·막힘 검사 대신).
  score.machine = (entry.lessons ?? []).includes('clarify-ambiguous-request')
    ? { executed: Boolean(score.turnSettled), asked: score.clarifyAsked === true, unchanged: score.contentChanged === false }
    : { executed: Boolean(score.modelDone && score.turnSettled), changed: score.contentChanged, saved: saveOk,
      sceneLintZero: Boolean(lintOk), noBlockers: Boolean(score.gameCheck && !score.gameCheck.error && score.gameCheck.blockers.length === 0) };
  score.machinePass = Object.values(score.machine).every(Boolean);
  const visualFile = resolve(dir, 'visual.json');
  score.visual = existsSync(visualFile) ? read(visualFile) : { verdict: 'pending' };
  score.pass = score.machinePass && score.visual.verdict === 'pass';
  writeFileSync(resolve(dir, 'score.json'), JSON.stringify(score, null, 2));
  return score;
}

if (argv[0] === 'score') {
  const root = resolve(option('out') ?? '');
  const manifest = read(resolve(root, 'experiment.json'));
  const rows = [];
  for (const entry of manifest.cases) {
    if (option('case') && option('case') !== entry.id) continue;
    for (const dir of attemptsOf(root, entry.id)) {
      if (option('attempt') && !dir.endsWith(`attempt-${option('attempt')}`)) continue;
      const row = scoreAttempt(root, entry, dir);
      rows.push(row);
      console.log(JSON.stringify({ case: entry.id, attempt: row.attempt, machine: row.machine, calls: row.tools?.calls, failed: row.tools?.failed,
        lint: row.sceneLint?.requiredZeroViolations?.map(v => v.code), blockers: row.gameCheck?.blockers?.length, minutes: row.elapsedMs ? +(row.elapsedMs / 60000).toFixed(1) : null }));
    }
  }
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, 'scores.json'), JSON.stringify(rows, null, 2));
}
