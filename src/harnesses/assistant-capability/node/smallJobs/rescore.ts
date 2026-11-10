// 오프라인 재판정(모델 없음): 판정기만 고쳤을 때 저장해 둔 전/후 문서(before/after.json.gz)에 지금의 판정을 다시 돌린다.
// 실모델 시도는 그대로 두고 판정만 바꾼다. 처음 판정은 result.json 의 liveVerdict 에 남겨, 무엇이 재판정으로 뒤집혔는지 보이게 한다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createBlankProject } from '../../../../project/defaults';
import type { Project } from '../../../../project/types';
import { runCheck } from './checks';
import { decide, writeRunSummary, type JobResult } from './run';
import { loadSuite } from './suite';

/** 타일셋 본문을 뺀 저장 문서 + 번들 타일셋 → 판정에 넣을 문서. */
function restore(file: string): Project {
  return Object.assign(createBlankProject() as any, JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))) as Project;
}

export function rescoreSmallJobs(options: { run?: string }): number {
  if (!options.run) throw Error('small-jobs-rescore --run <실행 폴더>');
  const root = resolve(options.run);
  const summary = JSON.parse(readFileSync(resolve(root, 'summary.json'), 'utf8'));
  const jobs = new Map(loadSuite().jobs.map(job => [job.id, job]));
  let flipped = 0, skipped = 0;
  const results: JobResult[] = (summary.jobs as JobResult[]).map(live => {
    const dir = resolve(root, 'jobs', live.id), job = jobs.get(live.id);
    const before = resolve(dir, 'before.json.gz'), after = resolve(dir, 'after.json.gz');
    // 전/후 문서가 없는 일(기동 실패 등)은 처음 결과를 그대로 둔다.
    if (!job || !existsSync(before) || !existsSync(after)) { skipped += 1; return live; }
    const check = runCheck(job.check, job.allow, restore(before), restore(after));
    const { status, reason } = decide({ check, turnOutcomes: live.turns.map(turn => turn.outcome), waitedLimit: false, errors: live.errors, toolCallCount: live.toolCallCount, persistence: live.persistence, limitMs: (summary.timeLimitMin ?? 10) * 60_000 });
    const first = (live as any).liveVerdict ?? { status: live.status, reason: live.reason };
    const next = { ...live, check, status, pass: status === 'pass', reason, ...(first.status !== status || first.reason !== reason ? { liveVerdict: first } : {}) } as JobResult;
    if (first.status !== status) { flipped += 1; console.log(`${live.id}: ${first.status} → ${status} — ${reason.slice(0, 140)}`); }
    writeFileSync(resolve(dir, 'result.json'), JSON.stringify(next, null, 2));
    return next;
  });
  const { jobs: _jobs, counts: _counts, perFamily: _perFamily, perFixture: _perFixture, medians: _medians, totals: _totals, schemaVersion: _version, kind: _kind, ...meta } = summary;
  const rewritten = writeRunSummary(root, results, { ...meta, rescoredAt: new Date().toISOString() });
  console.log(`rescore: ${results.length}개 중 상태가 바뀐 것 ${flipped} · 전/후 문서가 없어 그대로 둔 것 ${skipped} → 통과 ${rewritten.counts.pass}/${rewritten.counts.jobs}`);
  return 0;
}
