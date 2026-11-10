// 작은 일 판정기 자기검사(모델·브라우저 없음). 일마다:
//   ① 손대지 않은 픽스처는 불합격  ② 손으로 적용한 정답(실제 도구 호출)은 합격  ③ 그럴듯한 오답은 모두 불합격
//   ④ 정답 + 시키지 않은 파괴(다른 이벤트 삭제 또는 다른 맵 이름 바꾸기)는 불합격
// 하나라도 어긋난 판정은 묶음에 둘 수 없다 — 그런 판정으로 잰 실모델 점수는 뜻이 없다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Project } from '../../../../project/types';
import { runCheck, type Verdict } from './checks';
import { buildFixture, type FixtureId } from './fixtures';
import { applyCalls, loadSuite, selectJobs, type SmallJob } from './suite';

type Row = { id: string; family: string; fixture: string; sound: boolean; problems: string[]; untouched: string; reference: string; wrongs: Array<{ note: string; verdict: string }>; damaged: string };
const brief = (verdict: Verdict): string => `${verdict.pass ? 'PASS' : 'FAIL'} — ${verdict.reason}`.slice(0, 260);

/** 정답 위에 얹는, 요청과 무관한 파괴 한 가지. 다른 이벤트가 있으면 지우고, 없으면 맵 이름을 바꾼다. */
function vandalize(job: SmallJob, fixture: Project, reference: Project): { project: Project; what: string } {
  const allow = job.allow ?? {};
  const touched = new Set([...(allow.movedEvents ?? []), ...(allow.removedEvents ?? []), job.check.eventId, ...(job.check.eventIds ?? [])].filter(Boolean));
  for (const [mapId, map] of Object.entries<any>((fixture as any).maps)) {
    const victim = (map.events ?? []).find((event: any) => !touched.has(event.id));
    if (victim) return { project: applyCalls(reference, [{ tool: 'remove_event', args: { mapId, eventId: victim.id } }]), what: `${map.name}의 ${victim.name ?? victim.id} 삭제` };
  }
  const mapId = Object.keys((fixture as any).maps).find(id => !(allow.renamedMaps ?? []).includes(id))!;
  return { project: applyCalls(reference, [{ tool: 'set_map_properties', args: { mapId, name: '엉뚱한 이름' } }]), what: '맵 이름 바꿈' };
}

function checkJob(job: SmallJob, fixture: Project): Row {
  const problems: string[] = [];
  const untouched = runCheck(job.check, job.allow, fixture, structuredClone(fixture));
  if (untouched.pass) problems.push(`손대지 않은 픽스처가 합격했다: ${untouched.reason}`);
  let reference: Verdict | null = null, referenceDoc: Project | null = null;
  try {
    referenceDoc = applyCalls(fixture, job.reference);
    reference = runCheck(job.check, job.allow, fixture, referenceDoc);
    if (!reference.pass) problems.push(`손 정답이 불합격했다: ${reference.reason}`);
  } catch (error) { problems.push(`손 정답을 적용하지 못했다: ${error instanceof Error ? error.message : String(error)}`); }
  const wrongs = job.wrong.map(wrong => {
    try {
      const verdict = runCheck(job.check, job.allow, fixture, applyCalls(fixture, wrong.calls));
      if (verdict.pass) problems.push(`오답 「${wrong.note}」이 합격했다: ${verdict.reason}`);
      return { note: wrong.note, verdict: brief(verdict) };
    } catch (error) {
      problems.push(`오답 「${wrong.note}」을 만들지 못했다: ${error instanceof Error ? error.message : String(error)}`);
      return { note: wrong.note, verdict: '만들지 못함' };
    }
  });
  let damaged = '-';
  if (referenceDoc) {
    try {
      const { project, what } = vandalize(job, fixture, referenceDoc);
      const verdict = runCheck(job.check, job.allow, fixture, project);
      if (verdict.pass) problems.push(`정답 + ${what} 이 합격했다`);
      damaged = `${what}: ${brief(verdict)}`;
    } catch (error) { problems.push(`파괴 반례를 만들지 못했다: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { id: job.id, family: job.family, fixture: job.fixture, sound: problems.length === 0, problems, untouched: brief(untouched), reference: reference ? brief(reference) : '적용 실패', wrongs, damaged };
}

export async function runSmallJobsSelfcheck(out: string | undefined, only: string | undefined): Promise<number> {
  const suite = loadSuite();
  const jobs = selectJobs(suite, only);
  const fixtures = new Map<FixtureId, Project>();
  const rows = jobs.map(job => {
    if (!fixtures.has(job.fixture)) fixtures.set(job.fixture, buildFixture(job.fixture));
    const row = checkJob(job, structuredClone(fixtures.get(job.fixture)!));
    console.log(`${row.sound ? 'ok  ' : 'FAIL'} ${row.id}${row.sound ? '' : ` :: ${row.problems.join(' / ')}`}`);
    return row;
  });
  const sound = rows.filter(row => row.sound).length;
  const table = ['| 일 | 가족 | 픽스처 | 손대지 않음 | 손 정답 | 오답 | 정답+파괴 | 판정 |', '|---|---|---|---|---|---|---|---|',
    ...rows.map(row => `| ${row.id} | ${row.family} | ${row.fixture} | ${row.untouched.startsWith('FAIL') ? 'FAIL ✓' : 'PASS ✗'} | ${row.reference.startsWith('PASS') ? 'PASS ✓' : 'FAIL ✗'} | ${row.wrongs.filter(wrong => wrong.verdict.startsWith('FAIL')).length}/${row.wrongs.length} FAIL | ${row.damaged.includes('FAIL') ? 'FAIL ✓' : '✗'} | ${row.sound ? 'sound' : `**unsound** — ${row.problems.join(' / ')}`} |`)].join('\n');
  console.log(`\nsmall-jobs selfcheck: ${sound}/${rows.length} sound`);
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'selfcheck.json'), JSON.stringify({ schemaVersion: 1, kind: 'assistant-small-jobs-selfcheck', jobs: rows.length, sound, rows }, null, 2));
    writeFileSync(resolve(out, 'SELFCHECK.md'), `# 작은 일 판정기 자기검사\n\n${sound}/${rows.length} sound — 손대지 않은 픽스처는 불합격, 손 정답(실제 도구 호출)은 합격, 오답과 「정답+시키지 않은 파괴」는 불합격이어야 한다.\n\n${table}\n`);
    console.log(`${resolve(out, 'SELFCHECK.md')}`);
  }
  return sound === rows.length ? 0 : 1;
}
