import type { Project } from '../types';
import { isPassable } from '../collision';
import type { LintIssue } from './projectLint';

/** Review prompts, not aesthetic verdicts. These never prevent intentional authoring. */
export function lintHorrorAuthoring(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  const globalIds = new Map<string, number>();
  for (const map of Object.values(project.maps)) for (const e of map.events) globalIds.set(e.id, (globalIds.get(e.id) ?? 0) + 1);
  for (const map of Object.values(project.maps)) {
    const add = (code: string, message: string, x?: number, y?: number) => issues.push({ severity: 'warning', code: `authoring:${code}`, mapId: map.id, message, x, y });
    const images = new Map<string, Set<string>>();
    for (const event of map.events) for (const page of event.pages ?? []) {
      // projectLint also reviews malformed imports; command-shape owns that warning.
      const commands = Array.isArray(page.commands) ? page.commands : [];
      if (page.interaction || page.movement.pursuit?.scope === 'connected') {
        if ((globalIds.get(event.id) ?? 0) > 1) add('persistent-id', `${page.name}: 위치를 저장하는 이벤트는 프로젝트 전체에서 고유한 ID가 필요합니다.`, event.x, event.y);
      }
      if (page.interaction) {
        if (!page.graphic.sprite || page.graphic.transparent) add('object-graphic', `${page.name}: 물체 동작은 있지만 보이는 그림이 없습니다.`, event.x, event.y);
        if (!isPassable(project, map, event.x, event.y)) add('object-floor', `${page.name}: 물체 아래에 통행을 막는 타일이 남아 있습니다. 이벤트에 그림을 붙이고 바닥을 비워 주세요.`, event.x, event.y);
        if (page.movement.type !== 'fixed' || page.trigger.kind !== 'action' || page.priority !== 'same' || page.overlapForbidden === false) add('object-contract', `${page.name}: 물체는 정지·조사·주인공과 같은 높이·겹침 금지로 설정하세요.`, event.x, event.y);
        if (commands.length) add('object-commands', `${page.name}: 물체 동작이 일반 조사 명령보다 우선합니다.`, event.x, event.y);
      }
      if (page.trigger.kind === 'action' && commands.some(c => c?.kind === 'text') && page.graphic.sprite) {
        const key = JSON.stringify(page.graphic);
        const names = images.get(key) ?? new Set<string>(); names.add(page.name); images.set(key, names);
      }
      const transfers = commands.filter(c => c?.kind === 'transfer');
      if (transfers.length && map.roomHarnessPlan && [[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy]) => isPassable(project, map, event.x+dx!, event.y+dy!))) add('interior-door', `${page.name}: 사방이 열린 바닥에 출입구가 있습니다. 벽·문 뒤 공간과 연결이 의도한 배치인지 확인하세요.`, event.x, event.y);
    }
    for (const names of images.values()) if (names.size >= 3) add('shared-object-graphic', `서로 다른 조사물 ${names.size}개가 같은 그림입니다 (${[...names].slice(0,3).join(', ')}). 임시 표식이면 실제 물체 그림으로 교체하세요.`);
    const plan = map.roomHarnessPlan?.plan as { theme?: string; rooms?: unknown[]; wings?: {w:number;h:number}[] } | undefined;
    if (plan && !plan.rooms?.length && plan.wings?.length === 1 && plan.wings[0]!.w * plan.wings[0]!.h >= 160) add('interior-plan', '큰 실내를 단일 방으로 만들었습니다. 방의 용도·문 연결·우회 통로를 먼저 검토하세요. 가구 밀도만으로 완성도를 판정하지 마세요.');
  }
  return issues;
}
