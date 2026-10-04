import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { buildPlayableSegmentSkeleton } from '@/project/playableSegment';
import { FIRST_PLAY_TOOLS, inspectFirstPlay, type FirstPlayReceipt } from '@/ai/piAgent/firstPlay';
import { resolvePiToolShape } from '@/ai/piAgent/toolAdapter';
import { cloneProjectSharingSharedDictionaries } from '@/project/projectClone';
import { runPiTeam } from '../scripts/lib/piTeamRuntime';
import { defaultTeamSpec } from '@/ai/piAgent/teamSpec';
import type { PiAgentDoneEvent, PiAgentRequest } from '@/ai/piAgent/protocol';

function seed() {
  const project = createBlankProject();
  project.system.genre = 'story-cutscene';
  return buildPlayableSegmentSkeleton(project);
}
const receipt = (project: ReturnType<typeof seed>): FirstPlayReceipt => ({ events: [
  { mapId: project.startMapId, eventId: 'ev_segment_starter', role: 'interaction' },
  { mapId: 'map_segment_route', eventId: 'ev_segment_end', role: 'resolution' },
], report: '조사 → 두 선택 → 다른 반응 → 길 → 마무리' });
const stats = { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 };
const done = (request: PiAgentRequest): PiAgentDoneEvent => ({ type: 'done', project: request.project, stats, changedKeys: [] });

describe('first playable creation boundary', () => {
  it('rejects unchanged seed play and cosmetic event renaming', () => {
    const base = seed(), next = cloneProjectSharingSharedDictionaries(base);
    next.maps[next.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!.name = '회중시계';
    expect(inspectFirstPlay(base, next, receipt(base))).toContain('기본 샘플 명령이 그대로입니다: ev_segment_starter');
  });
  it('does not resolve decorating tools through discovery fallback', () => {
    const project = seed();
    for (const name of ['stamp_object', 'copy_map_region', 'author_village', 'paint_tiles', 'reset_project', 'generate_opening_image']) {
      expect(resolvePiToolShape({ project }, name, { toolNames: FIRST_PLAY_TOOLS })).toBeUndefined();
    }
    expect(resolvePiToolShape({ project }, 'upsert_event', { toolNames: FIRST_PLAY_TOOLS })).toBeDefined();
  });
  it('rejects two differently labelled choices with identical result commands', () => {
    const base = seed(), next = cloneProjectSharingSharedDictionaries(base);
    const event = next.maps[next.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!;
    event.pages![0]!.commands.unshift({ kind: 'choices', options: [
      { text: '간직한다', branch: [{ kind: 'text', body: '같은 반응' }] },
      { text: '놓아준다', branch: [{ kind: 'text', body: '같은 반응' }] },
    ] });
    expect(inspectFirstPlay(base, next, receipt(base))).toContain('서로 같은 선택 결과가 있습니다: ev_segment_starter');
  });
  it('starts the restricted core before a coordinator and refuses to continue without its receipt', async () => {
    const calls: PiAgentRequest[] = [];
    await expect(runPiTeam({ mode: 'team', provider: 'test', task: '장르 프리셋: 시계 이야기', project: seed(), mapIds: [], team: { ...defaultTeamSpec(), reviewAfterWork: false, workBudget: 600 } }, {
      runAgent: async (request, options) => {
        calls.push(request);
        expect(request.maxTurns).toBe(32);
        expect(options.toolNames).toEqual(FIRST_PLAY_TOOLS);
        expect(options.extraTools!.some(tool => tool.name === 'report_first_play')).toBe(true);
        return done(request);
      },
    })).rejects.toThrow('핵심 플레이 제작 보고');
    expect(calls).toHaveLength(1);
  });
  it('accepts positive inspection evidence and starts the coordinator only after verified core play', async () => {
    const order: string[] = [];
    const project = seed();
    await runPiTeam({ mode: 'team', provider: 'test', task: '장르 프리셋: 시계 이야기', project, mapIds: [], team: { ...defaultTeamSpec(), reviewAfterWork: false, workBudget: 600 } }, {
      runAgent: async (request, options) => {
        const tools = options.extraTools!;
        const core = tools.find(tool => tool.name === 'report_first_play');
        const review = tools.find(tool => tool.name === 'report_first_play_review');
        if (core) {
          order.push('core');
          const starter = request.project.maps[request.project.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!;
          starter.pages![0]!.commands.unshift({ kind: 'choices', options: [
            { text: '간직한다', branch: [{ kind: 'text', body: '내 안에 품는다.' }] },
            { text: '놓아준다', branch: [{ kind: 'text', body: '이제 보내 준다.' }] },
          ] });
          request.project.maps.map_segment_route!.events.find(e => e.id === 'ev_segment_end')!.pages![0]!.commands.unshift({ kind: 'text', body: '시계의 기억이 돌아왔다.' });
          await options.onCheckpoint!({ project: request.project, toolName: 'upsert_event', label: '핵심 이벤트' });
          await core.execute('core-report', receipt(request.project));
        } else if (review) {
          order.push('review');
          expect(request.readOnly).toBe(true);
          await review.execute('review-report', { ok: true, blockers: [], evidence: ['두 선택과 서로 다른 대사가 실제 이벤트에 있다.'] });
        } else {
          order.push('coordinator');
          expect(request.systemPrompt?.join('\n')).toContain('핵심 플레이 제작과 원문 요구 검사를 이미 마쳤다');
          await tools.find(tool => tool.name === 'finish')!.execute('finish', { report: '핵심 플레이 완성. 장식은 다음 요청.' });
        }
        return done(request);
      },
    });
    expect(order).toEqual(['core', 'review', 'coordinator']);
  });
});
