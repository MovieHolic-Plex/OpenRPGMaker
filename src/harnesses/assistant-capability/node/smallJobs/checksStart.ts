// 다섯째 묶음(새 게임 첫 생성 MVP · 다음 지역 확장)의 판정. 저장 문서 전/후만 본다(안내 문장은 run.ts 가 조수 답에서 따로 본다).
// mvpStart(2026-11-23 오너 «3맵에 굳이 엔딩이 있어야 하나»): 맵 minMaps~maxMaps 장, 모든 맵이 시작에서 문으로 닿음(마지막 맵 도달),
//   엔딩·결말 이벤트 없음, 자동 플레이가 첫 판 끝 지점 스위치(mvp_reached)까지 간다(핵심 루프 1회).
// regionAdded: 확장 요청 뒤 시작에서 문으로 닿는 새 맵이 생기고, 있던 맵의 바닥을 거의 그대로 둔다(파괴는 runCheck 의 damage 가 따로 본다).
import type { Project } from '../../../../project/types';
import { MVP_REACHED_SWITCH } from '../../../../project/gameBlueprint';
import { countMaps } from '../../../../ai/v2/judge/mapCount';
import { runSwitchPlay } from '../../../../qa/gameCheck/autoPlay';
import { allPages, visitPageCommands } from '../../../../qa/gameCheck/walk';
import { no, ok, type CheckSpec, type Doc, type Result } from './checkSupport';

const PLAY_BUDGET_MS = 120_000;

/** 자동 플레이(계획표)가 첫 판 끝 지점 스위치를 켜는 이벤트까지 가나. */
export function playToMvpEnd(doc: Doc): { reached: boolean; note: string } {
  const project = doc as unknown as Project;
  try {
    let target: Parameters<typeof runSwitchPlay>[2] | undefined;
    for (const page of allPages(project)) {
      if (target || !page.map || !page.event) continue;
      visitPageCommands(page, (visit) => { if (!target && visit.command.kind === 'setSwitch' && visit.command.switchId === MVP_REACHED_SWITCH && visit.command.value !== false) target = visit; });
    }
    if (!target) return { reached: false, note: `끝 지점 스위치(${MVP_REACHED_SWITCH})를 켜는 이벤트가 없다` };
    const run = runSwitchPlay(project, '첫 판 끝 지점', target, MVP_REACHED_SWITCH, PLAY_BUDGET_MS);
    return run.ok ? { reached: true, note: `자동 플레이 끝 지점 도달(목표 ${run.steps.length}개, ${target.where.mapName ?? target.where.mapId})` }
      : { reached: false, note: `자동 플레이 끝 지점 못 닿음: ${(run.failure ? `${run.failure.goal}: ${run.failure.detail}` : '').slice(0, 200)}` };
  } catch (error) {
    return { reached: false, note: `자동 플레이 오류: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200) };
  }
}

function endingCalls(doc: Doc): number {
  let n = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (o.kind === 'triggerEnding' || o.kind === 'ending') n += 1;
    Object.values(o).forEach(walk);
  };
  walk(Object.values(doc.maps ?? {}).map((m: any) => m.events));
  walk(doc.commonEvents ?? []);
  return n;
}

export function mapShape(doc: Doc): { maps: number; counted: number; unreachable: string[] } {
  const res = countMaps(doc as unknown as Project);
  return { maps: Object.keys(doc.maps ?? {}).length, counted: res.counted.length, unreachable: res.uncounted.filter(m => m.reason === 'unreachable').map(m => m.name) };
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
    const shape = mapShape(after), play = playToMvpEnd(after), endings = endingCalls(after) + (after.endings?.length ?? 0);
    const note = `맵 ${shape.maps}장(센 맵 ${shape.counted}) · 시작에서 못 닿는 맵 ${shape.unreachable.length} · 엔딩 ${endings} · ${play.note}`;
    if (shape.maps < spec.minMaps || shape.maps > spec.maxMaps) return no(`MVP 크기 밖 — ${note} (기대 ${spec.minMaps}~${spec.maxMaps}장)`);
    if (shape.unreachable.length) return no(`마지막 맵까지 못 간다(${shape.unreachable.join(', ').slice(0, 80)}) — ${note}`);
    if (endings) return no(`MVP 인데 엔딩·결말을 만들었다 — ${note}`);
    if (!play.reached) return no(note);
    return ok(note);
  },
  regionAdded(spec, before, after) {
    const added = Object.keys(after.maps ?? {}).filter(id => !before.maps?.[id]);
    const counted = new Set(countMaps(after as unknown as Project).counted);
    const reachedNew = added.filter(id => counted.has(id));
    const repainted = Object.keys(before.maps ?? {}).filter(id => after.maps?.[id] && changedShare(before.maps[id], after.maps[id]) > (spec.maxRepaint ?? 0.1));
    const note = `새 맵 ${added.length}장(문으로 닿는 센 맵 ${reachedNew.length}) · 있던 맵 ${Object.keys(before.maps ?? {}).length}장 중 바닥을 크게 다시 깐 맵 ${repainted.length}`;
    if (reachedNew.length < (spec.minNew ?? 1)) return no(`새 지역이 시작에서 닿지 않는다 — ${note}`);
    if (repainted.length) return no(`있던 맵을 다시 깔았다(${repainted.map(id => after.maps[id]?.name ?? id).join(', ').slice(0, 80)}) — ${note}`);
    return ok(note);
  },
};
