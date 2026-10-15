import type { Project, Command, GameEvent, EventPage } from '../../project/types';
import { resolveEventPage } from '../../project/io';
import { runSceneTest, type SceneStep } from '../../testing/sceneTestRunner';
import { ROMANCE_IDS as I, compileRomanceContract, normalizeRomanceContract, romanceSource, supportsRomanceScene, type RomanceSceneContract } from './contract';
import type { ToolDefinition } from '../../editor/tools/types';
import { ToolError } from '../../editor/tools/types';
import { findCharsetAsset } from '../../assets/charsetCatalog';
import { createSaveSnapshot, applySaveSnapshot } from '../../player/saveSlots';
import { isPassable } from '../../project/collision';
import { COMPOSED_LAYOUT_TAG } from '../../project/mapNamedLocations';

export function sceneContract(project: Project): RomanceSceneContract | undefined {
  const state = project.gameDesignBrief?.implementation;
  return state?.harnessId === 'romance-scene' ? normalizeRomanceContract(state.contract) : undefined;
}
export function romanceWritePrerequisite(project: Project): string | undefined {
  const c = sceneContract(project);
  return c && project.maps[c.mapId]?.events.find(e => e.id === I.npc)?.pages?.[0]?.id === I.npc + '_draft'
    ? 'author_romance_scene' : undefined;
}
/** 무대(contract.mapId)에서 문(transfer)으로 이어지는 맵 id 들 — 무대 자신 포함. */
function linkedMapIds(project: Project, rootId: string): Set<string> {
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  const collect = (node: unknown, out: Set<string>): void => {
    if (Array.isArray(node)) { for (const item of node) collect(item, out); return; }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.kind === 'transfer' && typeof record.mapId === 'string') out.add(record.mapId);
    for (const value of Object.values(record)) collect(value, out);
  };
  while (queue.length) {
    const map = project.maps[queue.shift()!];
    if (!map) continue;
    const next = new Set<string>();
    collect(map.events, next);
    for (const id of next) if (project.maps[id] && !seen.has(id)) { seen.add(id); queue.push(id); }
  }
  return seen;
}

/**
 * 상대가 설 칸 — 시작 칸에서 동쪽 두 칸이 통행 가능하면 예전과 같은 자리(빈 잔디 시작 맵은 바이트까지 같다).
 * 구성기로 깐 캠퍼스·거리처럼 그 칸이 막혔으면 시작 칸에서 걸어 2~5걸음 안의 가장 가까운 통행 칸을 고른다.
 */
function partnerCell(project: Project, map: Project['maps'][string]): { x: number; y: number } {
  const start = project.startPos;
  const east = { x: Math.min(map.width - 2, start.x + 2), y: start.y };
  // 구성기로 깐 맵(교문·보도·횡단보도가 있는 거리)은 시작 칸 바로 옆이 길목이라 걸어서 4걸음 떨어진 보도에 세운다.
  const composed = (map.locations ?? []).some(l => (l.tags ?? []).includes(COMPOSED_LAYOUT_TAG));
  if (!composed && isPassable(project, map, east.x, east.y)) return east;
  const dist = new Map<number, number>([[start.y * map.width + start.x, 0]]);
  const queue: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!; const d = dist.get(cell.y * map.width + cell.x)!;
    if (d >= 5) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx, y = cell.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || dist.has(y * map.width + x) || !isPassable(project, map, x, y)) continue;
      dist.set(y * map.width + x, d + 1); queue.push({ x, y });
    }
  }
  const want = composed ? 4 : 2;
  const best = [...dist.entries()].filter(([, d]) => d >= 2).sort((a, b) => Math.abs(a[1] - want) - Math.abs(b[1] - want) || a[0] - b[0])[0];
  return best ? { x: best[0] % map.width, y: Math.floor(best[0] / map.width) } : east;
}

/** x,y 를 안 준 새 무대의 시작 칸 — 걸어 다니는 큰 덩어리 안에서 맵 아래 가운데(교문·보도가 있는 자리)에 가장 가까운 통행 칸. */
function defaultStageStart(project: Project, map: Project['maps'][string]): { x: number; y: number } | undefined {
  const reach = (from: number): Set<number> => {
    const seen = new Set<number>([from]); const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const cx = queue[head]! % map.width, cy = Math.floor(queue[head]! / map.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = cx + dx, y = cy + dy, k = y * map.width + x;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(k) || !isPassable(project, map, x, y)) continue;
        seen.add(k); queue.push(k);
      }
    }
    return seen;
  };
  const ideal = { x: Math.floor(map.width / 2), y: map.height - 3 };
  const cells: number[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) cells.push(y * map.width + x);
  cells.sort((a, b) => Math.abs(a % map.width - ideal.x) + Math.abs(Math.floor(a / map.width) - ideal.y) - Math.abs(b % map.width - ideal.x) - Math.abs(Math.floor(b / map.width) - ideal.y));
  for (const cell of cells.slice(0, 40)) if (reach(cell).size >= 40) return { x: cell % map.width, y: Math.floor(cell / map.width) };
  return undefined;
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
  if (!map || project.startMapId !== c.mapId) throw new ToolError('첫 만남 무대는 시작 맵이어야 합니다. 다른 맵을 무대로 쓰려면 set_romance_stage 로 먼저 지정하세요.', { code: 'romance-map-scope' });
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
  const placed = partnerCell(project, map);
  const npc: GameEvent = { id: I.npc, name: c.partner, x: previous?.x ?? placed.x,
    y: previous?.y ?? placed.y, trigger: { kind: 'action' }, commands: [], pages: [
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
    { id: I.ending, name: '첫 만남', conditions: [], priority: 0, epilogue: [] }];
}

export function seedRomanceScene(input: Project): Project | undefined {
  if (!supportsRomanceScene(input) || sceneContract(input)) return undefined;
  // Never discard an existing author's maps. The stage is the start map; other maps stay as they are.
  if (!input.maps[input.startMapId]) throw Error('첫 만남 준비에는 시작 맵이 필요합니다.');
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
  // 무대 맵 id 는 set_romance_stage 로 지정할 수 있다 — 인물·장소·선택 문구·원문은 그대로여야 하고 mapId 만 달라도 된다.
  const current = sceneContract(project);
  if (!current || JSON.stringify({ ...current, mapId: '' }) !== JSON.stringify({ ...c, mapId: '' })) fail('확정한 장면 계약이 삭제되거나 바뀌었습니다.');
  const stageId = current?.mapId ?? c.mapId;
  if (!project.gameDesignBrief || c.source !== romanceSource(project.gameDesignBrief)) fail('현재 기획과 계약의 원문이 다릅니다. 다시 기획을 확정하세요.');
  // 범위는 「무대 한 장 + 거기서 문으로 이어진 맵」이다 — 무대가 아닌 맵을 지우거나 하나로 줄일 필요는 없다(저자의 맵을 버리지 않는다).
  // 이어지지 않은 맵(옛 빈 시작 맵·방치된 시드)은 첫 만남 범위를 흐리므로 지우거나 문으로 잇게 한다.
  if (!project.maps[stageId] || project.startMapId !== stageId) fail('첫 만남 무대는 시작 맵이어야 합니다. 다른 맵을 무대로 쓰려면 set_romance_stage 로 지정하세요.');
  else {
    const linked = linkedMapIds(project, stageId);
    const loose = Object.values(project.maps).filter(m => !linked.has(m.id));
    if (loose.length) fail(`무대와 문으로 이어지지 않은 맵이 있습니다: ${loose.map(m => `${m.name}(${m.id})`).join(', ')} — remove_map 으로 지우거나 문으로 잇습니다.`);
  }
  const map = project.maps[stageId]; const npc = map?.events.find(e => e.id === I.npc);
  if (!map || !npc) fail('첫 만남 상대 이벤트가 없습니다.');
  if (project.database.actors.find(a => a.id === 'actor_hero')?.name !== c.protagonist) fail('주인공 이름이 확정 기획과 다릅니다.');
  const originalHero = expected?.database.actors.find(a => a.id === 'actor_hero');
  const hero = project.database.actors.find(a => a.id === 'actor_hero');
  if (originalHero && (originalHero.characterResourceId !== hero?.characterResourceId || (originalHero.characterIndex ?? 0) !== (hero?.characterIndex ?? 0))) fail('사용자가 고르지 않은 주인공 외형을 바꿀 수 없습니다.');
  if (npc?.name !== c.partner || map?.name !== c.place) fail('상대 또는 만남 장소가 확정 기획과 다릅니다.');
  const first = npc?.pages?.[0]; const choice = first?.commands.find(cmd => cmd.kind === 'choices');
  if (!options.allowDraft && first?.id !== I.npc + '_first') fail('첫 만남은 아직 임시 초안입니다. author_romance_scene으로 실제 대사를 작성하세요.');
  const original = expected ? Object.values(expected.maps).flatMap(m => m.events).find(e => e.id === I.npc) : undefined;
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
    const chosen = runSceneTest(project, { mapId: stageId, start: project.startPos, steps: prefix });
    const reaction = chosen.finalState.messages.at(-1) ?? ''; reactions.push(reaction);
    const repeated = runSceneTest(project, { mapId: stageId, start: project.startPos, steps: [...prefix,
      ...approach(npc), { kind: 'choose', index: 0 }, ...approach(npc), { kind: 'choose', index: 0 },
      { kind: 'expect', variableEquals: { [I.choice]: index + 1, [I.relation]: index + 1 }, interactionComplete: true, cutsceneLocked: false }] });
    const memory = repeated.finalState.messages.at(-1) ?? ''; memories.push(memory);
    const finished = runSceneTest(project, { mapId: stageId, start: project.startPos, steps: [...prefix,
      ...approach(npc), { kind: 'choose', index: 1 }, { kind: 'expect', endingReached: I.ending, cutsceneLocked: false }] });
    const active = resolveEventPage(npc, repeated.session, { locations: map.locations });
    const restored = applySaveSnapshot(project, JSON.parse(JSON.stringify(createSaveSnapshot(project, chosen.session))));
    const resumed = runSceneTest(project, { mapId: stageId, start: { x: restored.x, y: restored.y }, steps: [
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
  const cancel = runSceneTest(project, { mapId: stageId, start: project.startPos, steps: [...approach(npc),
    { kind: 'choose', index: -1 }, { kind: 'expect', switchOff: I.complete, variableEquals: { [I.choice]: 0, [I.relation]: 0 }, interactionComplete: true, cutsceneLocked: false }] });
  if (!cancel.ok) fail('선택 취소 뒤 상태 또는 입력 복귀 실패: ' + cancel.failureReason);
  // Clone/serialize tests are not called canonical SQLite reload proof.
  return { ok: blockers.length === 0, blockers, ms: Date.now() - started, paths, cancelOk: cancel.ok };
}

const textField = { type: 'string' as const, minLength: 8, maxLength: 500 };
const partnerLine = { ...textField, description: '확정 상대가 직접 말하는 대사만 쓴다. 주인공의 발언을 인용하거나 화자 이름이 붙은 서술문을 섞지 않는다.' };
export const ROMANCE_SCENE_TOOLS: readonly ToolDefinition[] = [
  { name: 'set_romance_stage', description: '연애 첫 만남의 무대(장면이 열리는 맵)를 현재 프로젝트의 다른 맵 하나로 옮겨 지정한다. 상대 이벤트가 새 무대로 옮겨지고 시작 맵·시작 칸이 새 무대가 되며 계약의 mapId 만 바뀐다(인물·장소·선택 문구·원문은 그대로). 시작 맵이 단색 잔디라 캠퍼스·도시 구성기를 못 쓰는 경우에 쓴다: create_map({tilesetId:"modern_campus"|"modern_city"}) 로 새 맵을 만들고 compose_campus_grounds / compose_modern_city_street 로 깐 뒤 이 도구로 무대로 지정한다. 옛 무대는 비어 있으면 remove_map 으로 지운다(무대와 문으로 이어지지 않은 맵은 inspect 가 반려한다). 첫 대화 작성 전에도 쓸 수 있다.',
    mode: 'write', domains: ['event', 'map'], parameters: { type: 'object', properties: {
      mapId: { type: 'string', description: '새 무대 맵 id. 이미 있는 맵이어야 한다' },
      x: { type: 'integer', description: '새 무대에서 시작할 통행 칸 x(생략하면 맵 아래 가운데에 가까운 통행 칸 — 구성기가 까는 교문·보도 자리)' },
      y: { type: 'integer', description: '새 무대에서 시작할 통행 칸 y' },
    }, required: ['mapId'], additionalProperties: false },
    run(project, args) {
      const c = sceneContract(project);
      if (!c) throw new ToolError('확정된 연애 장면 계약이 없습니다.', { code: 'romance-contract' });
      const mapId = String(args.mapId ?? '').trim();
      const target = project.maps[mapId];
      if (!target) throw new ToolError(`맵 '${mapId}' 이 없습니다 — create_map 으로 먼저 만드세요.`, { code: 'map-not-found' });
      if (mapId === c.mapId && project.startMapId === mapId) return { summary: `'${target.name}' 은 이미 첫 만남 무대입니다.`, data: { mapId } };
      const from = project.maps[c.mapId];
      const npc = from?.events.find(e => e.id === I.npc) ?? Object.values(project.maps).flatMap(m => m.events).find(e => e.id === I.npc);
      if (!npc) throw new ToolError('옮길 첫 만남 상대 이벤트가 없습니다.', { code: 'romance-npc' });
      const at = typeof args.x === 'number' && typeof args.y === 'number' ? { x: Math.trunc(args.x), y: Math.trunc(args.y) }
        : mapId === project.startMapId ? { ...project.startPos } : defaultStageStart(project, target);
      if (!at) throw new ToolError('새 무대에서 걸어 다닐 수 있는 넓은 영역을 찾지 못했습니다 — x,y(시작할 통행 칸)를 직접 주세요.', { code: 'invalid-args' });
      if (at.x < 0 || at.y < 0 || at.x >= target.width || at.y >= target.height || !isPassable(project, target, at.x, at.y)) {
        throw new ToolError(`시작 칸 (${at.x},${at.y}) 이 맵 밖이거나 통행 불가입니다 — 걸어 다닐 수 있는 칸을 고르세요.`, { code: 'invalid-args' });
      }
      const prevStart = project.startMapId; const prevPos = project.startPos;
      project.startMapId = mapId; project.startPos = at;
      const cell = partnerCell(project, target);
      for (const m of Object.values(project.maps)) m.events = m.events.filter(e => e.id !== I.npc);
      target.events = [...target.events, { ...npc, x: cell.x, y: cell.y }];
      target.name = c.place;
      project.gameDesignBrief!.implementation = { harnessId: 'romance-scene', contract: { ...c, mapId } };
      const old = prevStart !== mapId ? project.maps[prevStart] : undefined;
      void prevPos;
      return { summary: `첫 만남 무대를 '${target.name}'(${mapId}) 로 지정했습니다 — 상대는 (${cell.x},${cell.y}), 시작 칸 (${at.x},${at.y}).` + (old ? ` 옛 무대 '${old.name}'(${old.id}) 은 이제 이어지지 않은 맵입니다 — 비었으면 remove_map 으로 지우세요.` : ''), data: { mapId, partner: cell, start: at } };
    } },
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
