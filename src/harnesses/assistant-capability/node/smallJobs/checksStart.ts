// 다섯째 묶음(새 게임 첫 생성 MVP · 다음 지역 확장)의 판정. 저장 문서 전/후만 본다.
// mvpStart: 첫 생성이 작은 MVP(맵 minMaps~maxMaps 장)이고 정직한 자동 플레이가 엔딩에 닿는다.
// regionAdded: 확장 요청 뒤 시작에서 문으로 닿는 새 맵이 생기고, 있던 맵의 바닥을 거의 그대로 둔다(파괴는 runCheck 의 damage 가 따로 본다).
import type { Project } from '../../../../project/types';
import { countMaps } from '../../../../ai/v2/judge/mapCount';
import { runGameCheck } from '../../../../qa/gameCheck';
import { no, ok, type CheckSpec, type Doc, type Result } from './checkSupport';

const PLAY_BUDGET_MS = 120_000;

function playOnce(doc: Doc, honestPlay: boolean): { reached: string | null; note: string } {
  const mode = honestPlay ? '정직한 자동 플레이' : '계획표 자동 플레이';
  try {
    const report = runGameCheck(doc as unknown as Project, { autoPlayBudgetMs: PLAY_BUDGET_MS, honestPlay });
    const runs = report.autoPlay?.runs ?? [];
    const hit = runs.find(run => run.ok && run.endingReached);
    if (hit) return { reached: hit.endingReached!, note: `${mode} 엔딩 ${hit.endingReached} 도달(목표 ${hit.steps.length}개)` };
    const failed = report.findings.find(finding => finding.code === 'autoplay-failed');
    return { reached: null, note: runs.length ? `${mode} 엔딩 못 닿음: ${(failed?.message ?? runs.map(run => run.failure ?? '').join(' / ')).slice(0, 160)}` : `${mode} 계획 없음(엔딩·목표가 없다)` };
  } catch (error) {
    return { reached: null, note: `${mode} 오류: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200) };
  }
}

/**
 * 자동 플레이가 엔딩에 닿았나. 먼저 정직한 플레이(보이는 것과 읽은 글만), 못 닿으면 계획표 플레이(좌표를 아는 기계) —
 * 정직한 플레이는 몬스터 캐페인 체육관의 회전문 장치를 풀지 못한다(2026-11-23 실측, 전체 캐페인도 같다). 둘 다 글에 남긴다.
 */
export function playToEnding(doc: Doc): { reached: string | null; note: string } {
  const honest = playOnce(doc, true);
  if (honest.reached) return honest;
  const planned = playOnce(doc, false);
  return { reached: planned.reached, note: `${planned.note} · ${honest.note}` };
}

export function mapShape(doc: Doc): { maps: number; counted: number } {
  return { maps: Object.keys(doc.maps ?? {}).length, counted: countMaps(doc as unknown as Project).counted.length };
}

function changedShare(before: any, after: any): number {
  const a: number[] = before?.lowerTiles ?? [], b: number[] = after?.lowerTiles ?? [];
  if (a.length !== b.length) return 1;
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
  return a.length ? changed / a.length : 0;
}

export const START_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  mvpStart(spec, _before, after) {
    const shape = mapShape(after), play = playToEnding(after);
    const note = `맵 ${shape.maps}장(센 맵 ${shape.counted}) · ${play.note}`;
    if (shape.maps < spec.minMaps || shape.maps > spec.maxMaps) return no(`MVP 크기 밖 — ${note} (기대 ${spec.minMaps}~${spec.maxMaps}장)`);
    if (!play.reached) return no(note);
    return ok(note);
  },
  regionAdded(spec, before, after) {
    const added = Object.keys(after.maps ?? {}).filter(id => !before.maps?.[id]);
    const counted = new Set(countMaps(after as unknown as Project).counted);
    const reachedNew = added.filter(id => counted.has(id));
    const repainted = Object.keys(before.maps ?? {}).filter(id => after.maps?.[id] && changedShare(before.maps[id], after.maps[id]) > (spec.maxRepaint ?? 0.1));
    const play = playToEnding(after);
    const note = `새 맵 ${added.length}장(문으로 닿는 센 맵 ${reachedNew.length}) · 있던 맵 ${Object.keys(before.maps ?? {}).length}장 중 바닥을 크게 다시 깐 맵 ${repainted.length} · ${play.note}`;
    if (reachedNew.length < (spec.minNew ?? 1)) return no(`새 지역이 시작에서 닿지 않는다 — ${note}`);
    if (repainted.length) return no(`있던 맵을 다시 깔았다(${repainted.map(id => after.maps[id]?.name ?? id).join(', ').slice(0, 80)}) — ${note}`);
    return ok(note);
  },
};
