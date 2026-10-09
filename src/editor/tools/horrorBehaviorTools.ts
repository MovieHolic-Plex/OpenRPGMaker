import type { ChaseAcrossMaps } from '@/project/types';
import { ToolError, type ToolDefinition, type JsonSchema } from './types';
import { requireMap } from './mapHelpers';
export const PURSUIT_SCHEMA: JsonSchema = {
  type: 'object', properties: {
    scope: { type: 'string', enum: ['map', 'connected'] },
    doorDelayMs: { type: 'number', minimum: 0, maximum: 60000 },
    searchMs: { type: 'number', minimum: 0, maximum: 60000 },
    onLost: { type: 'string', enum: ['wait', 'return'] },
    tracking: { type: 'string', enum: ['lastSeen', 'persistent'], description: 'lastSeen(기본): 본 곳까지만 쫓고 수색. persistent: 한 번 쫓기 시작하면 벽 너머로도 계속 따라온다(숨거나 안전지대면 놓친다). 「금고를 열자 달려온다」처럼 보지 않아도 오는 추격은 persistent.' },
    lostSwitchId: { type: 'string', description: '수색 끝에 포기하면 켜는 스위치 id(따돌림 연출·BGM 복귀). 다시 발견하면 꺼진다.' },
    followSwitchId: { type: 'string', description: '문을 따라 다른 맵으로 넘어오기 시작하면 켜는 스위치 id(「문이 열린다」 연출).' },
  }, required: ['scope', 'doorDelayMs', 'searchMs', 'onLost'],
};
export function parsePursuit(value: unknown): ChaseAcrossMaps | undefined {
  if (value === undefined) return undefined;
  const p = value as ChaseAcrossMaps;
  if (!p || !['map', 'connected'].includes(p.scope) || !['wait', 'return'].includes(p.onLost)
    || ![p.doorDelayMs, p.searchMs].every(ms => typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 && ms <= 60000)) throw new ToolError('추격 범위/대기/수색/복귀 설정이 잘못되었습니다.');
  if (p.tracking !== undefined && p.tracking !== 'lastSeen' && p.tracking !== 'persistent') throw new ToolError('pursuit.tracking 은 lastSeen 또는 persistent 입니다.');
  for (const key of ['lostSwitchId', 'followSwitchId'] as const) {
    if (p[key] !== undefined && typeof p[key] !== 'string') throw new ToolError(`pursuit.${key} 는 스위치 id 문자열입니다.`);
  }
  return {
    scope: p.scope, doorDelayMs: p.doorDelayMs, searchMs: p.searchMs, onLost: p.onLost,
    ...(p.tracking ? { tracking: p.tracking } : {}),
    ...(p.lostSwitchId ? { lostSwitchId: p.lostSwitchId } : {}),
    ...(p.followSwitchId ? { followSwitchId: p.followSwitchId } : {}),
  };
}
export const CONFIGURE_OBJECT_BEHAVIOR: ToolDefinition = {
  name: 'configure_object_behavior', mode: 'write',
  description: '기존 이벤트 페이지를 밀 수 있는 가구 또는 실제 은신처로 설정한다. 가구 그림은 이벤트에 지정하고 원래 가구 타일은 제거해 통행 가능한 바닥 위에 둔다. 조사 대사로 은신을 흉내 내지 말 것. 일반 조사 명령보다 물체 동작이 우선한다. 페이지 조건/그림/기존 명령은 보존한다.',
  parameters: { type: 'object', properties: { mapId: { type: 'string' }, eventId: { type: 'string' }, pageId: { type: 'string' }, kind: { type: 'string', enum: ['none', 'pushable', 'hiding'] } }, required: ['mapId', 'eventId', 'pageId', 'kind'] },
  run(project, args) {
    const map = requireMap(project, args.mapId as string);
    const page = map.events.find(e => e.id === args.eventId)?.pages?.find(p => p.id === args.pageId);
    if (!page || !['none', 'pushable', 'hiding'].includes(args.kind as string)) throw new ToolError('이벤트 페이지와 물체 종류를 확인하세요.');
    if (args.kind === 'none') delete page.interaction;
    else {
      page.interaction = { kind: args.kind as 'pushable' | 'hiding' };
      page.movement = { ...page.movement, type: 'fixed' };
      page.trigger = { kind: 'action' }; page.priority = 'same'; page.overlapForbidden = true;
    }
    return { summary: `${page.name}: ${args.kind}`, data: { eventId: args.eventId, pageId: page.id },
      warnings: page.commands.length ? ['물체 동작이 일반 조사 명령보다 우선합니다.'] : [] };
  },
};
