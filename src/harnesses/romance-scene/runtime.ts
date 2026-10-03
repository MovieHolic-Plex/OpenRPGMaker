import type { Project, Command, GameEvent, EventPage } from '../../project/types';
import { resolveEventPage } from '../../project/io';
import { runSceneTest, type SceneStep } from '../../testing/sceneTestRunner';
import { ROMANCE_IDS as I, compileRomanceContract, normalizeRomanceContract, romanceSource, supportsRomanceScene, type RomanceSceneContract } from './contract';
import type { ToolDefinition } from '../../editor/tools/types';
import { ToolError } from '../../editor/tools/types';
import { findCharsetAsset } from '../../assets/charsetCatalog';
import { createSaveSnapshot, applySaveSnapshot } from '../../player/saveSlots';

export function sceneContract(project: Project): RomanceSceneContract | undefined {
  const state = project.gameDesignBrief?.implementation;
  return state?.harnessId === 'romance-scene' ? normalizeRomanceContract(state.contract) : undefined;
}
export function romanceWritePrerequisite(project: Project): string | undefined {
  const c = sceneContract(project);
  return c && project.maps[c.mapId]?.events.find(e => e.id === I.npc)?.pages?.[0]?.id === I.npc + '_draft'
    ? 'author_romance_scene' : undefined;
}
const say = (speaker: string, body: string): Command => ({ kind: 'text', speaker, body });
function page(id: string, commands: Command[], graphic: EventPage['graphic'], conditions: EventPage['conditions'] = []): EventPage {
  return { id, name: id, conditions, commands, graphic, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
    movement: { type: 'fixed', speed: 3, frequency: 3 } };
}

interface SceneProse { opening: string[]; reactions: [string, string]; revisits: [string, string]; closing: string; }
export function applyRomanceScene(project: Project, prose: SceneProse, draft = false): void {
  const c = sceneContract(project);
  if (!c || c.source !== romanceSource(project.gameDesignBrief!)) throw new ToolError('확정 기획의 연애 장면 계약을 먼저 준비해야 합니다.', { code: 'romance-contract' });
  const map = project.maps[c.mapId];
  if (!map || Object.keys(project.maps).length !== 1) throw new ToolError('첫 만남 계약은 시작 맵 한 장만 허용합니다.', { code: 'romance-map-scope' });
  for (const [id, name] of [[I.choice, '첫 만남 선택'], [I.relation, '첫 만남 관계 변화']]) {
    if (!project.variables.some(v => v.id === id)) project.variables.push({ id: id!, name: name! });
  }
  if (!project.switches.some(s => s.id === I.complete)) project.switches.push({ id: I.complete, name: '첫 만남 완료' });
  const hero = project.database.actors.find(a => a.id === 'actor_hero');
  if (hero) hero.name = c.protagonist;
  map.name = c.place;
  const previous = map.events.find(e => e.id === I.npc);
  const resource = previous?.pages?.[0]?.graphic?.sprite?.id
    ?? project.database.actors.find(a => a.id !== 'actor_hero' && a.characterResourceId)?.characterResourceId
    ?? hero?.characterResourceId;
  if (!resource) throw new ToolError('임시 인물에 사용할 실제 캐릭터 자산이 없습니다.', { code: 'romance-graphic' });
  const character = project.database.actors.find(a => a.characterResourceId === resource && a.id !== 'actor_hero') ?? hero;
  const graphic: EventPage['graphic'] = previous?.pages?.[0]?.graphic ?? { sprite: { type: project.assets.uploaded[resource] ? 'uploaded' : 'bundled', id: resource }, direction: 'down', pattern: (character?.characterIndex ?? 0) * 12 + 1 };
  const choices: Command = { kind: 'choices', prompt: '어떻게 말을 걸까요?', cancelBehavior: 'branch',
    cancelBranch: [say(c.protagonist, '조금 뒤에 다시 말을 걸어 보자.')],
    options: c.choices.map((text, index) => ({ text, branch: [
      { kind: 'setVariable', variableId: I.choice, op: '=', value: index + 1 },
      { kind: 'setVariable', variableId: I.relation, op: '+=', value: index + 1 },
      { kind: 'setSwitch', switchId: I.complete, value: true }, say(c.partner, prose.reactions[index]!),
    ] })) };
  const npc: GameEvent = { id: I.npc, name: c.partner, x: previous?.x ?? Math.min(map.width - 2, project.startPos.x + 2),
    y: previous?.y ?? project.startPos.y, trigger: { kind: 'action' }, commands: [], pages: [
      page(I.npc + (draft ? '_draft' : '_first'), [...prose.opening.map(body => say(c.partner, body)), choices], graphic),
      ...prose.revisits.map((body, index) => page(I.npc + '_after_' + index, [say(c.partner, body),
        { kind: 'choices', prompt: '만남을 이어갈까요?', options: [
          { text: '조금 더 이야기한다', branch: [say(c.partner, body)] },
          { text: '만남을 마무리한다', branch: [say(c.protagonist, prose.closing), { kind: 'triggerEnding', endingId: I.ending }] },
        ], cancelBehavior: 'branch', cancelBranch: [] }], graphic,
        [{ kind: 'switch' as const, switchId: I.complete, value: true }, { kind: 'variable' as const, variableId: I.choice, op: '==' as const, value: index + 1 }])),
  ] };
  map.events = [...map.events.filter(e => e.id !== I.npc), npc];
  if (!(project.endings ?? []).some(e => e.id === I.ending)) project.endings = [...(project.endings ?? []),
    { id: I.ending, name: '첫 만남', conditions: [], epilogue: [] }];
}

export function seedRomanceScene(input: Project): Project | undefined {
  if (!supportsRomanceScene(input) || sceneContract(input)) return undefined;
  // Never discard an existing author's maps to satisfy a new one-map contract.
  if (Object.keys(input.maps).length !== 1) throw Error('첫 만남 준비에는 새 프로젝트의 시작 맵 한 장이 필요합니다.');
  const project = structuredClone(input);
  project.gameDesignBrief!.implementation = { harnessId: 'romance-scene', contract: compileRomanceContract(project) };
  const c = sceneContract(project)!;
  applyRomanceScene(project, { opening: [`${c.place}에서 마주쳤네요. 잠깐 이야기할까요?`],
    reactions: ['먼저 인사해 줘서 고마워요. 다음에도 편하게 말을 걸어요.', '제 이야기가 궁금했군요. 조금 더 이야기하고 싶어요.'],
    revisits: ['아까 먼저 인사해 준 일, 기억하고 있어요.', '아까 제 이야기를 물어봐 준 일, 기억하고 있어요.'],
    closing: '오늘 이야기해서 반가웠어요. 다음에 마주치면 또 인사할게요.' }, true);
  return project;
}

export function inspectRomanceScene(project: Project, expected?: Project, options: { allowDraft?: boolean } = {}) {
  try { return inspectScene(project, expected, options); }
  catch (error) { return { ok: false, blockers: ['장면 검사 실행 실패: ' + (error instanceof Error ? error.message : String(error))], ms: 0, paths: [] }; }
}

function inspectScene(project: Project, expected?: Project, options: { allowDraft?: boolean } = {}) {
  const started = Date.now(); const blockers: string[] = []; const paths: unknown[] = [];
  const c = expected ? sceneContract(expected) : sceneContract(project);
  const fail = (message: string) => blockers.push(message);
  if (!c) return { ok: false, blockers: ['연애 장면 계약이 없습니다.'], ms: Date.now() - started, paths };
  if (JSON.stringify(sceneContract(project)) !== JSON.stringify(c)) fail('확정한 장면 계약이 삭제되거나 바뀌었습니다.');
  if (!project.gameDesignBrief || c.source !== romanceSource(project.gameDesignBrief)) fail('현재 기획과 계약의 원문이 다릅니다. 다시 기획을 확정하세요.');
  if (Object.keys(project.maps).length !== 1 || project.startMapId !== c.mapId) fail('첫 만남 범위는 시작 맵 한 장입니다.');
  const map = project.maps[c.mapId]; const npc = map?.events.find(e => e.id === I.npc);
  if (!map || !npc) fail('첫 만남 상대 이벤트가 없습니다.');
  if (project.database.actors.find(a => a.id === 'actor_hero')?.name !== c.protagonist) fail('주인공 이름이 확정 기획과 다릅니다.');
  const originalHero = expected?.database.actors.find(a => a.id === 'actor_hero');
  const hero = project.database.actors.find(a => a.id === 'actor_hero');
  if (originalHero && (originalHero.characterResourceId !== hero?.characterResourceId || originalHero.characterIndex !== hero?.characterIndex)) fail('사용자가 고르지 않은 주인공 외형을 바꿀 수 없습니다.');
  if (npc?.name !== c.partner || map?.name !== c.place) fail('상대 또는 만남 장소가 확정 기획과 다릅니다.');
  const first = npc?.pages?.[0]; const choice = first?.commands.find(cmd => cmd.kind === 'choices');
  if (!options.allowDraft && first?.id !== I.npc + '_first') fail('첫 만남은 아직 임시 초안입니다. author_romance_scene으로 실제 대사를 작성하세요.');
  const original = expected?.maps[c.mapId]?.events.find(e => e.id === I.npc);
  if (!options.allowDraft && original?.pages?.[0]?.id === I.npc + '_draft'
    && JSON.stringify(npc?.pages?.map(p => p.commands)) === JSON.stringify(original.pages.map(p => p.commands))) {
    fail('임시 초안의 대사가 그대로입니다. 페이지 이름만 바꾸어 완료할 수 없습니다.');
  }
  if (choice?.kind !== 'choices' || JSON.stringify(choice.options.map(o => o.text)) !== JSON.stringify(c.choices)) fail('두 선택 문구 또는 분기가 확정 계약과 다릅니다.');
  if (npc?.pages?.some(p => p.graphic.transparent || !p.graphic.sprite?.id
    || !project.assets.uploaded[p.graphic.sprite.id] && !findCharsetAsset(p.graphic.sprite.id))) fail('상대 인물의 실제 그림 자산이 없거나 화면에 보이지 않습니다.');
  if (blockers.length || !map || !npc) return { ok: false, blockers, ms: Date.now() - started, paths };
  const approach = (event: GameEvent): SceneStep[] => [{ kind: 'walk', to: { x: event.x, y: event.y }, adjacent: true }, { kind: 'interact', eventId: event.id }];
  const reactions: string[] = []; const memories: string[] = [];
  for (let index = 0; index < 2; index++) {
    const prefix: SceneStep[] = [...approach(npc), { kind: 'choose', index },
      { kind: 'expect', variableEquals: { [I.choice]: index + 1, [I.relation]: index + 1 }, switchOn: I.complete, interactionComplete: true, cutsceneLocked: false }];
    const chosen = runSceneTest(project, { mapId: c.mapId, start: project.startPos, steps: prefix });
    const reaction = chosen.finalState.messages.at(-1) ?? ''; reactions.push(reaction);
    const repeated = runSceneTest(project, { mapId: c.mapId, start: project.startPos, steps: [...prefix,
      ...approach(npc), { kind: 'choose', index: 0 }, ...approach(npc), { kind: 'choose', index: 0 },
      { kind: 'expect', variableEquals: { [I.choice]: index + 1, [I.relation]: index + 1 }, interactionComplete: true, cutsceneLocked: false }] });
    const memory = repeated.finalState.messages.at(-1) ?? ''; memories.push(memory);
    const finished = runSceneTest(project, { mapId: c.mapId, start: project.startPos, steps: [...prefix,
      ...approach(npc), { kind: 'choose', index: 1 }, { kind: 'expect', endingReached: I.ending, cutsceneLocked: false }] });
    const active = resolveEventPage(npc, repeated.session, c.mapId);
    const restored = applySaveSnapshot(project, JSON.parse(JSON.stringify(createSaveSnapshot(project, chosen.session))));
    const resumed = runSceneTest(project, { mapId: c.mapId, start: { x: restored.x, y: restored.y }, steps: [
      ...approach(npc), { kind: 'choose', index: 0 },
      { kind: 'expect', variableEquals: { [I.choice]: index + 1, [I.relation]: index + 1 }, interactionComplete: true, cutsceneLocked: false },
    ] }, undefined, { initialSession: restored });
    if (!chosen.ok || !repeated.ok || !finished.ok) fail(`선택 ${index + 1}: ${chosen.failureReason ?? repeated.failureReason ?? finished.failureReason ?? '실행 실패'}`);
    if (!reaction.trim() || !memory.trim() || active?.id === first?.id) fail(`선택 ${index + 1}의 반응 또는 선택을 기억하는 재대화가 없습니다.`);
    if (!resumed.ok || resumed.finalState.messages.at(-1) !== memory) fail(`선택 ${index + 1} 저장 후 재대화 실패: ${resumed.failureReason ?? '기억 대사 불일치'}`);
    paths.push({ choice: c.choices[index], choiceValue: index + 1, reaction, revisit: memory,
      choiceOk: chosen.ok, repeatOk: repeated.ok, endOk: finished.ok, ending: finished.finalState.endingsReached,
      relationAfterRepeat: repeated.finalState.variables[I.relation], saveResumeOk: resumed.ok });
  }
  if (reactions[0] === reactions[1] || memories[0] === memories[1]) fail('두 선택의 반응 또는 재대화가 똑같습니다.');
  const cancel = runSceneTest(project, { mapId: c.mapId, start: project.startPos, steps: [...approach(npc),
    { kind: 'choose', index: -1 }, { kind: 'expect', switchOff: I.complete, variableEquals: { [I.choice]: 0, [I.relation]: 0 }, interactionComplete: true, cutsceneLocked: false }] });
  if (!cancel.ok) fail('선택 취소 뒤 상태 또는 입력 복귀 실패: ' + cancel.failureReason);
  // Clone/serialize tests are not called canonical SQLite reload proof.
  return { ok: blockers.length === 0, blockers, ms: Date.now() - started, paths, cancelOk: cancel.ok };
}

const textField = { type: 'string' as const, minLength: 8, maxLength: 500 };
const partnerLine = { ...textField, description: '확정 상대가 직접 말하는 대사만 쓴다. 주인공의 발언을 인용하거나 화자 이름이 붙은 서술문을 섞지 않는다.' };
export const ROMANCE_SCENE_TOOLS: readonly ToolDefinition[] = [
  { name: 'author_romance_scene', description: '확정 연애 첫 만남 계약의 두 선택·다른 반응·재대화·중복 방지·종료를 원자적으로 작성한다. 인물·장소·선택 문구는 계약을 보존한다. 그래픽 외형은 임시이며 기존 인물 이미지를 유지한다. 이후 inspect_romance_scene으로 검사한다.',
    mode: 'write', domains: ['event'], parameters: { type: 'object', properties: {
      opening: { type: 'array', items: partnerLine, description: '상대의 도입 대사 1~6줄' }, reactionA: partnerLine, reactionB: partnerLine,
      revisitA: partnerLine, revisitB: partnerLine, closing: { ...textField, description: '주인공이 만남을 마무리하며 직접 말하는 대사. 서술문을 섞지 않는다.' },
    }, required: ['opening', 'reactionA', 'reactionB', 'revisitA', 'revisitB', 'closing'], additionalProperties: false },
    run(project, args) {
      if (!Array.isArray(args.opening) || args.opening.length < 1 || args.opening.length > 6) throw new ToolError('도입 대사는 1~6줄이어야 합니다.');
      const prose: SceneProse = { opening: args.opening as string[], reactions: [String(args.reactionA), String(args.reactionB)],
        revisits: [String(args.revisitA), String(args.revisitB)], closing: String(args.closing) };
      if (prose.reactions[0] === prose.reactions[1] || prose.revisits[0] === prose.revisits[1]) throw new ToolError('선택별 반응과 재대화를 다르게 작성하세요.');
      applyRomanceScene(project, prose);
      const result = inspectRomanceScene(project);
      if (!result.ok) throw new ToolError('첫 만남 구현 반려: ' + result.blockers.join(' / '), { code: 'romance-scene-rejected' });
      return { summary: '첫 만남 두 선택·재대화·취소·종료 구현 확인', data: result };
    } },
  { name: 'inspect_romance_scene', description: '확정 계약을 기준으로 연애 첫 만남 두 선택·관계 상태·다른 반응·재대화 중복 방지·취소·종료를 실제 런타임 해석자로 검사한다. 저장·재로드나 미술 검수의 대체는 아니다.',
    mode: 'read', domains: ['event'], parameters: { type: 'object', properties: {}, additionalProperties: false },
    run(project) { const data = inspectRomanceScene(project); return { summary: data.ok ? '첫 만남 동작 검사 통과' : '첫 만남 반려: ' + data.blockers.join(' / '), data }; } },
];
