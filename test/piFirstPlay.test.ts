import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { buildPlayableSegmentSkeleton } from '@/project/playableSegment';
import { FIRST_PLAY_TOOLS, inspectFirstPlay, type FirstPlayReceipt } from '@/ai/piAgent/firstPlay';
import { inspectFirstScene, firstSceneSignature, firstSceneGraphicEvidence } from '@/ai/piAgent/firstScene';
import { DEFAULT_EASYRPG_CHARSET_ID } from '@/project/defaults/constants';
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
  it('rejects the observed empty-grass scene with invisible targets and a text-only opening', () => {
    const base = seed(), next = cloneProjectSharingSharedDictionaries(base);
    next.system.opening = { enabled: true, skippable: true, scenes: [
      { id: 'intro', kind: 'text', narration: '방 안 탁자에 시계가 있다.', durationMs: 20000 },
    ] };
    const issues = inspectFirstScene(base, next, receipt(base));
    expect(issues).toContain(`기본 빈 맵의 장소 구성이 그대로입니다: ${base.startMapId}`);
    expect(issues.some(issue => issue.includes('대상의 그림이 없습니다'))).toBe(true);
    expect(issues.some(issue => issue.includes('검은 화면'))).toBe(true);
  });
  it('expires a scene review when scenery or protagonist changes', () => {
    const project = seed(), before = firstSceneSignature(project, receipt(project));
    project.maps[project.startMapId]!.upperTiles[0] = 0;
    expect(firstSceneSignature(project, receipt(project))).not.toBe(before);
    const scenery = firstSceneSignature(project, receipt(project));
    Object.values(project.database.actors)[0]!.name = '다른 주인공';
    expect(firstSceneSignature(project, receipt(project))).not.toBe(scenery);
  });
  it('identifies the actual crystal asset instead of accepting its authored watch name', () => {
    const project = seed();
    const event = project.maps[project.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!;
    event.name = '회중시계';
    event.pages![0]!.graphic = {sprite:{type:'bundled',id:'tex_easyrpg_charset_object2'},pattern:79};
    expect(JSON.stringify(firstSceneGraphicEvidence(project, receipt(project)))).toContain('보석');
  });
  it('rejects visible escape characters inside choice results as well as opening dialogue', () => {
    const base = seed(), next = cloneProjectSharingSharedDictionaries(base);
    const event = next.maps[next.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!;
    event.pages![0]!.commands.unshift({kind:'choices',options:[
      {text:'간직한다',branch:[{kind:'text',body:'서린: '+String.fromCharCode(92)+'"기억한다."'}]},
      {text:'놓아준다',branch:[{kind:'text',body:'동쪽 문으로 향한다.'}]},
    ]});
    expect(inspectFirstScene(base,next,receipt(base)).some(issue=>issue.includes('JSON 이스케이프'))).toBe(true);
  });
  it('accepts positive inspection evidence and starts the coordinator only after verified core play', async () => {
    const order: string[] = [];
    const project = seed();
    await runPiTeam({ mode: 'team', provider: 'test', task: '장르 프리셋: 시계 이야기', project, mapIds: [], team: { ...defaultTeamSpec(), reviewAfterWork: false, workBudget: 600 } }, {
      runAgent: async (request, options) => {
        const tools = options.extraTools!;
        const core = tools.find(tool => tool.name === 'report_first_play');
        const review = tools.find(tool => tool.name === 'report_first_play_review');
        const places = tools.find(tool => tool.name === 'report_first_scene_places');
        const scene = tools.find(tool => tool.name === 'report_first_scene');
        const sceneReview = tools.find(tool => tool.name === 'report_first_scene_review');
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
        } else if (places) {
          order.push('places');
          for (const ref of receipt(request.project).events) {
            const map = request.project.maps[ref.mapId]!;
            map.upperTiles[0] = 0;
            for (const page of map.events.find(e => e.id === ref.eventId)!.pages!) page.graphic = { sprite: { type: 'bundled', id: DEFAULT_EASYRPG_CHARSET_ID } };
          }
          await options.onCheckpoint!({ project: request.project, toolName: 'build_hand_interior_room', label: '첫 장소' });
          await places.execute('places-report', { report: '두 장소 구조' });
        } else if (scene) {
          order.push('scene');
          expect(options.toolNames).not.toContain('list_resources');
          expect(options.toolNames).not.toContain('find_tools');
          expect(request.task).toContain('cc0-jetrel-clock');
          request.project.system.opening = { enabled: false, skippable: true, scenes: [] };
          const page = request.project.maps[request.project.startMapId]!.events.find(e => e.id === 'ev_segment_starter')!.pages![0]!;
          request.project.maps[request.project.startMapId]!.events.push({ id: 'intro', x: 0, y: 0, trigger: { kind: 'auto' }, commands: [], pages: [
            { ...page, id: 'intro-on', graphic: { transparent: true }, trigger: { kind: 'auto' }, conditions: [], commands: [{ kind: 'text', body: '오른쪽 시계를 Z로 조사하세요.' }, { kind: 'setSelfSwitch', key: 'A', value: true }] },
            { ...page, id: 'intro-off', graphic: { transparent: true }, trigger: { kind: 'action' }, conditions: [{ kind: 'selfSwitch', key: 'A', value: true }], commands: [] },
          ] });
          await options.onCheckpoint!({ project: request.project, toolName: 'upsert_event', label: '첫 장소' });
          await scene.execute('scene-report', { report: '보이는 대상과 도입' });
        } else if (sceneReview) {
          order.push('scene-review');
          const report = { ok: true, blockers: [], evidence: ['장소', '대상', '동선', '도입'] };
          await expect(sceneReview.execute('without-images', report)).rejects.toThrow('실제 전체 맵 이미지');
          for (const mapId of request.mapIds) {
            const map = request.project.maps[mapId]!;
            options.onEvent!({ type: 'execution_status', name: 'map.image.delivered', ok: true, summary: '테스트 이미지 전달', data: { mapId, x: 0, y: 0, w: map.width, h: map.height } });
          }
          await sceneReview.execute('with-images', report);
        } else {
          order.push('coordinator');
          expect(request.systemPrompt?.join('\n')).toContain('실제 장소 구성과 이미지 검수를 이미 마쳤다');
          await tools.find(tool => tool.name === 'finish')!.execute('finish', { report: '핵심 플레이와 첫 장소 완성.' });
        }
        return done(request);
      },
    });
    expect(order).toEqual(['core', 'review', 'places', 'scene', 'scene-review', 'coordinator', 'review']);
  });
});
