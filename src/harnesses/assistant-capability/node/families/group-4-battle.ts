import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  AREA, MAP, clone, coordinatesIn, eventEdit, eventOf, fail, inside, mapOf, mentions, called, pass,
  readOnly, runOn, sameExcept,
} from '../matrixNativeSpec';
import { numArg, rectArg, strArg, type Family, type FamilyOutcome } from './types';
import type { JudgeInput } from '../matrixNativeSpec';
import { attempt, distinct, eventOn, gatesTo } from './group-4-shared';

const ARENA = 'ev_arena_keeper';
const GUARD = 'ev_arena_guard';
const FIELD = 'map_field';

function textOnlyEvent(id: string, name: string, x: number, y: number, body: string): any {
  return {
    id, name, x, y, trigger: { kind: 'action' },
    pages: [{
      id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
      priority: 'same', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: [{ kind: 'text', speaker: name, body }],
    }],
  };
}

function withArena(project: Project): Project {
  const keeper = runOn(project, 'upsert_event', { mapId: MAP, event: textOnlyEvent(ARENA, '투기장 문지기', 14, 12, '검을 들어라.') });
  return runOn(keeper, 'upsert_event', { mapId: MAP, event: textOnlyEvent(GUARD, '수문장', 6, 4, '통행증을 내라.') });
}

function withBattles(project: Project): Project {
  const arena = withArena(project);
  const keeper = runOn(arena, 'patch_event_page', {
    mapId: MAP, eventId: ARENA, pageIndex: 0,
    set: { commands: [{ kind: 'text', speaker: '투기장 문지기', body: '검을 들어라.' }, { kind: 'battleProcessing', troopId: 'troop_slime', canEscape: true, canLose: false }] },
  });
  return runOn(keeper, 'patch_event_page', {
    mapId: MAP, eventId: GUARD, pageIndex: 0,
    set: { commands: [{ kind: 'text', speaker: '수문장', body: '통행증을 내라.' }, { kind: 'battleProcessing', troopId: 'troop_slime_pair', canEscape: false, canLose: false }] },
  });
}

const battlesIn = (event: any): any[] => (event?.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind === 'battleProcessing');
const battleOf = (event: any) => battlesIn(event)[0];

/** Every command of the event in order, descending into choice/fork/loop/battle branches. */
const walkCommands = (list: any[] | undefined): any[] => (list ?? []).flatMap((command: any) => {
  if (!command || typeof command !== 'object') return [command];
  const nested: any[] = [];
  if (command.kind === 'choices') for (const option of command.options ?? []) nested.push(...walkCommands(option.branch));
  if (command.kind === 'presentItem') {
    for (const option of command.options ?? []) nested.push(...walkCommands(option.branch));
    nested.push(...walkCommands(command.cancelBranch), ...walkCommands(command.otherwiseBranch));
  }
  if (command.kind === 'fork') nested.push(...walkCommands(command.then), ...walkCommands(command.else));
  if (command.kind === 'loop') nested.push(...walkCommands(command.body));
  if (command.kind === 'battleProcessing') nested.push(...walkCommands(command.victoryBranch), ...walkCommands(command.defeatBranch), ...walkCommands(command.escapeBranch));
  return [command, ...nested];
});
const allCommands = (event: any): any[] => (event?.pages ?? []).flatMap((page: any) => walkCommands(page.commands));

const battleTroopCreate: Family = {
  id: 'battle-troop-create',
  area: 'battle',
  mode: 'write',
  title: '적 그룹 하나 생성(구성 일치)',
  variants: [
    { key: 'slime-trio', prompt: '슬라임 셋으로 이루어진 「슬라임 삼인방」 적 그룹을 만들어줘.', args: { refId: 'troop_g4_slime_trio', name: '슬라임 삼인방', enemyIds: ['enemy_slime', 'enemy_slime', 'enemy_slime'] } },
    { key: 'bat-pair-polite', prompt: '동굴 박쥐 두 마리짜리 적 그룹을 새로 만들어 주세요. 이름은 「박쥐 한 쌍」입니다.', args: { refId: 'troop_g4_bat_pair', name: '박쥐 한 쌍', enemyIds: ['enemy_cave_bat', 'enemy_cave_bat'] } },
    { key: 'mixed-terse', prompt: '슬라임+초원 슬라임 섞인 그룹 하나 추가.', args: { refId: 'troop_g4_mixed', name: '슬라임 혼성', enemyIds: ['enemy_slime', 'enemy_meadow_slime'], nameContains: ['슬라임'] } },
    { key: 'golem-explained', prompt: '돌 골렘 하나로만 구성된 「골렘 파수꾼」 적 그룹을 추가해 주세요. 기존 적 그룹은 건드리지 마세요.', args: { refId: 'troop_g4_golem', name: '골렘 파수꾼', enemyIds: ['enemy_stone_golem'] } },
    { key: 'dragon-pair', prompt: '붉은 드래곤 두 마리 그룹 「쌍룡」 만들어.', args: { refId: 'troop_g4_dragon_pair', name: '쌍룡', enemyIds: ['enemy_dragon', 'enemy_dragon'] } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name');
    const want = [...(args.enemyIds as string[])].sort();
    const before = (input.before as any).database.troops as any[];
    const after = (input.after as any).database.troops as any[];
    const added = after.filter(troop => !before.some(old => old.id === troop.id));
    if (added.length !== 1) return fail(`새 적 그룹이 ${added.length}개다(하나여야 한다)`);
    const created = added[0]!;
    // The prompt names the troop and its composition, never an id — the editor assigns that itself.
    const nameWords = (args.nameContains as string[] | undefined) ?? [];
    const named = created.name === name || (nameWords.length > 0 && nameWords.every(word => String(created.name ?? '').includes(word)));
    if (!named) return fail(`이름이 「${created.name}」 — 「${name}」 여야 한다`);
    const got = [...(created.enemyIds ?? [])].sort();
    if (!isDeepStrictEqual(got, want)) return fail(`구성이 ${got.join(',')} — ${want.join(',')} 여야 한다`);
    for (const old of before) {
      const now = after.find(troop => troop.id === old.id);
      if (!now || !isDeepStrictEqual(now, old)) return fail(`기존 적 그룹 ${old.id} 가 바뀌었다`);
    }
    const blank = (doc: any) => { doc.database.troops = doc.database.troops.filter((troop: any) => troop.id !== created.id); };
    return sameExcept(input.before, input.after, blank) ? pass(`${created.id} (${got.length}마리) 추가, 기존 그룹 보존`) : fail('적 그룹 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    // The prompt names the troop and its roster, never an id: `reference` picks one, and the judge accepts any
    // new troop whose name and composition match.
    return runOn(project, 'upsert_troop', { troop: { id: strArg(args, 'refId'), name: strArg(args, 'name'), enemyIds: args.enemyIds as string[] } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const refId = strArg(args, 'refId');
    const name = strArg(args, 'name');
    const enemyIds = args.enemyIds as string[];
    const reference = battleTroopCreate.reference!(clone(project), args) as Project;
    const oneLess = enemyIds.length > 1 ? enemyIds.slice(0, -1) : ['enemy_meadow_slime'];
    const created = (ids: string[], label = name, id = refId) => attempt(() =>
      runOn(clone(project), 'upsert_troop', { troop: { id, name: label, enemyIds: ids } }));
    return distinct(reference, [
      created(oneLess),
      created([...enemyIds, 'enemy_meadow_slime']),
      created(enemyIds, `${name} 대장`),
      attempt(() => runOn(clone(project), 'upsert_troop', { troop: { id: 'troop_slime', name: '슬라임 정찰대', enemyIds: ['enemy_cave_bat'] } })),
    ]);
  },
};

const battleEventStart: Family = {
  id: 'battle-event-start',
  area: 'battle',
  mode: 'write',
  title: '이벤트 페이지가 그 troop 으로 전투',
  variants: [
    { key: 'keeper-slime', prompt: '투기장 문지기가 말을 걸면 슬라임 정찰대와 전투가 시작되게 해줘.', args: { eventId: ARENA, troopId: 'troop_slime', allowLeadText: true }, setup: { event: ARENA } },
    { key: 'keeper-polite', prompt: '투기장 문지기 이벤트에 전투 명령을 넣어 주세요. 상대는 「슬라임 정찰대」입니다. 대사는 그대로 두세요.', args: { eventId: ARENA, troopId: 'troop_slime' }, setup: { event: ARENA } },
    { key: 'guard-bats', prompt: '수문장이 동굴 박쥐 떼와 싸우게 해줘.', args: { eventId: GUARD, troopId: 'troop_bat_swarm', allowLeadText: true }, setup: { event: GUARD } },
    { key: 'guard-explained', prompt: '수문장 이벤트 페이지 끝에 「석상 수호병」 troop 과의 전투 명령을 하나 추가해 주세요. 기존 대사는 순서 그대로 남겨 주세요.', args: { eventId: GUARD, troopId: 'troop_golem_guard' }, setup: { event: GUARD } },
    { key: 'keeper-terse', prompt: '문지기 → 슬라임 정찰대 전투.', args: { eventId: ARENA, troopId: 'troop_slime', allowLeadText: true }, setup: { event: ARENA } },
  ],
  prepare: withArena,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const troopId = strArg(args, 'troopId');
    const allowLeadText = args.allowLeadText === true;
    const known = new Set(((input.after as any).database.troops ?? []).map((troop: any) => troop.id));
    if (!known.has(troopId)) return fail(`${troopId} 적 그룹이 프로젝트에 없다`);
    return eventEdit(input, eventId, (before, after) => {
      const battles = allCommands(after).filter((command: any) => command.kind === 'battleProcessing');
      const battle = battles.find((command: any) => command.troopId === troopId);
      if (!battle) return fail(`${eventId}: ${troopId} 로 시작하는 전투 명령이 없다`);
      const others = battles.filter((command: any) => command.troopId !== troopId);
      if (others.length) return fail(`${eventId}: 다른 troop(${others.map((command: any) => command.troopId).join(',')}) 전투가 함께 들어갔다`);
      const was = allCommands(before);
      const now = allCommands(after);
      // Existing commands survive in order; whatever is left is what the turn added.
      let at = 0;
      const added: any[] = [];
      for (const command of now) {
        if (at < was.length && isDeepStrictEqual(was[at], command)) at++;
        else added.push(command);
      }
      if (at !== was.length) return fail(`${eventId}: 기존 대사·명령이 사라졌거나 순서가 바뀌었다`);
      // A lead-in line before the battle is how the request reads; anything else added is an unrequested change.
      const allowed = allowLeadText
        ? new Set(['battleProcessing', 'text', 'displayTextSettings', 'wait', 'choices', 'fork', 'presentItem'])
        : new Set(['battleProcessing', 'displayTextSettings', 'wait']);
      const stray = added.filter((command: any) => !allowed.has(command?.kind));
      if (stray.length) return fail(`${eventId}: 요청하지 않은 명령(${stray.map((command: any) => command?.kind).join(',')})이 함께 들어갔다`);
      return pass(`${eventId}: ${troopId} 전투 명령 추가, 기존 대사 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const event = eventOf(project, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const commands = [...(event.pages[0].commands as any[]), { kind: 'battleProcessing', troopId: strArg(args, 'troopId'), canEscape: true, canLose: false }];
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const troopId = strArg(args, 'troopId');
    const event = eventOf(project, eventId);
    const base = (event.pages[0].commands as any[]).slice();
    const reference = battleEventStart.reference!(clone(project), args) as Project;
    const patch = (commands: any[], id = eventId) => attempt(() => runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId: id, pageIndex: 0, set: { commands } }));
    return distinct(reference, [
      patch([...base, { kind: 'battleProcessing', troopId: troopId === 'troop_slime' ? 'troop_slime_pair' : 'troop_slime', canEscape: true, canLose: false }]),
      patch([{ kind: 'battleProcessing', troopId, canEscape: true, canLose: false }]),
      patch([{ kind: 'battleProcessing', troopId, canEscape: true, canLose: false }], eventId === ARENA ? GUARD : ARENA),
      // 전투와 함께 전이·스위치를 끼워 넣는 것은 요청 밖이다.
      patch([...base, { kind: 'transfer', mapId: 'map_plaza', x: 2, y: 2 }, { kind: 'battleProcessing', troopId, canEscape: true, canLose: false }]),
    ]);
  },
};

const battleEscapeAllowed: Family = {
  id: 'battle-escape-allowed',
  area: 'battle',
  mode: 'write',
  title: '도주 플래그만 변경',
  variants: [
    { key: 'keeper-forbid', prompt: '투기장 문지기 전투에서는 도망칠 수 없게 해줘.', args: { eventId: ARENA, canEscape: false }, setup: { event: ARENA } },
    { key: 'keeper-polite', prompt: '투기장 전투의 도주 허용을 꺼 주세요. 다른 전투 설정은 그대로 두세요.', args: { eventId: ARENA, canEscape: false }, setup: { event: ARENA } },
    { key: 'guard-allow', prompt: '수문장 전투는 도망칠 수 있게 해줘.', args: { eventId: GUARD, canEscape: true }, setup: { event: GUARD } },
    { key: 'guard-explained', prompt: '수문장과의 전투에서 플레이어가 도주를 고를 수 있도록 canEscape 를 켜 주세요. 상대·패배 허용은 바꾸지 마세요.', args: { eventId: GUARD, canEscape: true }, setup: { event: GUARD } },
    { key: 'keeper-terse', prompt: '문지기 전투 도주 금지.', args: { eventId: ARENA, canEscape: false }, setup: { event: ARENA } },
  ],
  prepare: withBattles,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const want = args.canEscape === true;
    return eventEdit(input, eventId, (before, after) => {
      const was = battleOf(before), now = battleOf(after);
      if (!was || !now) return fail(`${eventId}: 전투 명령이 사라졌다`);
      if (now.canEscape !== want) return fail(`${eventId}: canEscape=${String(now.canEscape)} — ${String(want)} 여야 한다`);
      const fields = ['troopId', 'troopVariableId', 'canLose', 'branchOnResult', 'victoryBranch', 'defeatBranch', 'escapeBranch', 'formation'];
      for (const field of fields) {
        if (!isDeepStrictEqual(now[field], was[field])) return fail(`${eventId}: 도주 플래그 밖의 전투 값(${field})이 바뀌었다`);
      }
      const texts = (event: any) => (event.pages?.[0]?.commands ?? []).filter((command: any) => command.kind === 'text').map((command: any) => command.body);
      if (!isDeepStrictEqual(texts(after), texts(before))) return fail(`${eventId}: 대사가 바뀌었다`);
      return pass(`${eventId}: canEscape=${String(want)}`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const event = eventOf(project, eventId);
    const commands = (event.pages[0].commands as any[]).map((command: any) =>
      command.kind === 'battleProcessing' ? { ...command, canEscape: args.canEscape === true } : command);
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const want = args.canEscape === true;
    const event = eventOf(project, eventId);
    const reference = battleEscapeAllowed.reference!(clone(project), args) as Project;
    const patch = (mutate: (command: any) => any, id = eventId) => attempt(() => {
      const target = id === eventId ? event : eventOf(project, id);
      const commands = (target.pages[0].commands as any[]).map((command: any) => (command.kind === 'battleProcessing' ? mutate(command) : command));
      return runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId: id, pageIndex: 0, set: { commands } });
    });
    return distinct(reference, [
      patch(command => command),
      patch(command => ({ ...command, canEscape: want, canLose: !command.canLose })),
      patch(command => ({ ...command, canEscape: want }), eventId === ARENA ? GUARD : ARENA),
    ]);
  },
};

/**
 * A defeat branch that sends the party home needs a flag to remember the win, and a keeper fight may need its own
 * troop — new rows are append-only, so they are not side effects. Existing rows and every other change stay judged.
 */
const withNewRowsBlanked = (input: JudgeInput, collections: readonly string[]): JudgeInput => {
  const copy = clone(input.after) as any;
  for (const collection of collections) {
    const before = ((input.before as any).database?.[collection] ?? []) as any[];
    const known = new Set(before.map((row: any) => row.id));
    if (!copy.database?.[collection]) continue;
    copy.database[collection] = copy.database[collection].filter((row: any) => known.has(row.id));
  }
  const flags = new Set(((input.before as any).switches ?? []).map((entry: any) => entry.id));
  copy.switches = (copy.switches ?? []).filter((entry: any) => flags.has(entry.id));
  const vars = new Set(((input.before as any).variables ?? []).map((entry: any) => entry.id));
  copy.variables = (copy.variables ?? []).filter((entry: any) => vars.has(entry.id));
  if (copy.session) {
    copy.session.switches = Object.fromEntries(Object.entries(copy.session.switches ?? {}).filter(([id]) => flags.has(id)));
    copy.session.variables = Object.fromEntries(Object.entries(copy.session.variables ?? {}).filter(([id]) => vars.has(id)));
  }
  return { ...input, after: copy as Project };
};

const battleDefeatBranch: Family = {
  id: 'battle-defeat-branch',
  area: 'battle',
  mode: 'write',
  title: '승리·패배 분기 + 패배 시 맵 복귀',
  variants: [
    { key: 'keeper-branches', prompt: '투기장 전투에 승리·패배 분기를 만들고, 지면 게임오버 없이 마을로 돌아오게 해줘.', args: { eventId: ARENA, retreat: { x: 8, y: 8 } }, setup: { event: ARENA } },
    { key: 'keeper-polite', prompt: '투기장 문지기 전투 결과로 갈라지게 해 주세요. 이기면 문지기 대사가 나오고, 지면 마을 입구로 돌아가며 게임오버는 없어야 합니다.', args: { eventId: ARENA, retreat: { x: 9, y: 8 } }, setup: { event: ARENA } },
    { key: 'guard-branches', prompt: '수문장 전투에 승패 분기를 넣고, 패배하면 마을로 되돌려 보내줘.', args: { eventId: GUARD, retreat: { x: 10, y: 8 } }, setup: { event: GUARD } },
    { key: 'guard-explained', prompt: '수문장 전투를 branchOnResult 로 바꾸고 victoryBranch·defeatBranch 를 모두 채워 주세요. defeatBranch 는 게임오버가 아니라 마을 맵으로의 복귀여야 하고, canLose 도 켜 주세요.', args: { eventId: GUARD, retreat: { x: 7, y: 8 } }, setup: { event: GUARD } },
    { key: 'keeper-terse', prompt: '지면 마을로, 이기면 계속. 문지기 전투.', args: { eventId: ARENA, retreat: { x: 6, y: 8 } }, setup: { event: ARENA } },
  ],
  prepare: withBattles,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return eventEdit(withNewRowsBlanked(input, ['troops', 'enemies']), eventId, (_before, after) => {
      const battle = battlesIn(after)[0];
      if (!battle) return fail(`${eventId}: 전투 명령이 사라졌다`);
      const victory = battle.victoryBranch ?? [];
      const defeat = battle.defeatBranch ?? [];
      if (!battle.branchOnResult && (!victory.length || !defeat.length)) return fail(`${eventId}: 결과 분기가 켜지지 않았다`);
      if (!victory.length) return fail(`${eventId}: victoryBranch 가 비었다`);
      if (!defeat.length) return fail(`${eventId}: defeatBranch 가 비었다`);
      if (defeat.some((command: any) => command.kind === 'gameOver')) return fail(`${eventId}: 패배 분기가 게임오버로 끝난다`);
      if (battle.canLose !== true) return fail(`${eventId}: canLose 가 켜지지 않아 패배 분기가 실행되지 않는다`);
      const retreat = defeat.some((command: any) => command.kind === 'transfer' && command.mapId === MAP && command.x !== undefined);
      if (!retreat) return fail(`${eventId}: 패배 분기가 맵으로 복귀하지 않는다`);
      return pass(`${eventId}: 승리·패배 분기, 패배 시 ${MAP} 복귀`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const retreat = args.retreat as { x: number; y: number };
    const event = eventOf(project, eventId);
    const commands = (event.pages[0].commands as any[]).map((command: any) =>
      command.kind === 'battleProcessing'
        ? {
            ...command, canLose: true, branchOnResult: true,
            victoryBranch: [{ kind: 'text', speaker: event.name ?? '상대', body: '강하군. 통과해라.' }],
            defeatBranch: [{ kind: 'transfer', mapId: MAP, x: retreat.x, y: retreat.y, direction: 'down', fade: 'black' }],
          }
        : command);
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const retreat = args.retreat as { x: number; y: number };
    const event = eventOf(project, eventId);
    const reference = battleDefeatBranch.reference!(clone(project), args) as Project;
    const patch = (mutate: (command: any) => any) => attempt(() => {
      const commands = (event.pages[0].commands as any[]).map((command: any) => (command.kind === 'battleProcessing' ? mutate(command) : command));
      return runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands } });
    });
    const branches = (extra: Record<string, unknown>) => (command: any) => ({
      ...command, canLose: true, branchOnResult: true,
      victoryBranch: [{ kind: 'text', body: '이겼다.' }],
      defeatBranch: [{ kind: 'transfer', mapId: MAP, x: retreat.x, y: retreat.y, fade: 'black' }],
      ...extra,
    });
    return distinct(reference, [
      patch(branches({ defeatBranch: [{ kind: 'gameOver' }] })),
      patch(branches({ defeatBranch: [] })),
      patch(branches({ defeatBranch: [{ kind: 'text', body: '눈앞이 깜깜해졌다.' }] })),
      patch(branches({ canLose: false })),
      patch(branches({ victoryBranch: [] })),
    ]);
  },
};

const battleEncounterRate: Family = {
  id: 'battle-encounter-rate',
  area: 'battle',
  mode: 'write',
  title: '그 맵의 조우 스텝만 변경',
  variants: [
    { key: 'field-rate', prompt: '숲길 맵의 조우 발생률을 30으로 맞춰줘.', args: { mapId: FIELD, rate: 30 } },
    { key: 'field-polite', prompt: '숲길(map_field)의 인카운트율만 25로 설정해 주세요. 다른 맵은 건드리지 마세요.', args: { mapId: FIELD, rate: 25 } },
    { key: 'village-rate', prompt: '마을 조우 스텝 40으로.', args: { mapId: MAP, rate: 40 } },
    { key: 'plaza-explained', prompt: '광장 맵의 랜덤 조우 발생률을 12로 낮춰 주세요. 조우 테이블·타일·이벤트는 그대로 두세요.', args: { mapId: 'map_plaza', rate: 12 } },
    { key: 'field-terse', prompt: '숲길 조우 50.', args: { mapId: FIELD, rate: 50 } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const rate = numArg(args, 'rate');
    const map = mapOf(input.after, mapId);
    if (!map) return fail(`${mapId} 맵이 사라졌다`);
    if (map.encounterRate !== rate) return fail(`${mapId} 조우 스텝이 ${String(map.encounterRate ?? '(없음)')} — ${rate} 여야 한다`);
    const blank = (doc: any) => { delete doc.maps[mapId].encounterRate; };
    return sameExcept(input.before, input.after, blank)
      ? pass(`${mapId} 조우 스텝 ${rate}`)
      : fail('조우 스텝 밖의 내용(다른 맵·조우 테이블·이벤트)이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'set_map_properties', { mapId: strArg(args, 'mapId'), encounterRate: numArg(args, 'rate') });
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const rate = numArg(args, 'rate');
    const other = mapId === FIELD ? 'map_plaza' : FIELD;
    const reference = battleEncounterRate.reference!(clone(project), args) as Project;
    const setRate = (id: string, value: number) => attempt(() => runOn(clone(project), 'set_map_properties', { mapId: id, encounterRate: value }));
    const right = setRate(mapId, rate);
    const rightRate = right && attempt(() => runOn(right, 'set_map_properties', { mapId: other, encounterRate: rate }));
    const tableToo = right && attempt(() => runOn(right, 'set_encounter_table', { mapId, entries: [{ troopId: 'troop_slime', weight: 1 }] }));
    return distinct(reference, [
      setRate(other, rate),
      setRate(mapId, rate + 10),
      rightRate,
      tableToo,
    ]);
  },
};

const eventPlaytest: Family = {
  id: 'event-playtest',
  area: 'battle',
  mode: 'read',
  title: '이벤트를 실제 플레이처럼 실행',
  variants: [
    { key: 'utility-npc', prompt: '이 이벤트를 실제 플레이처럼 실행해줘.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'utility-polite', prompt: '선택한 NPC 이벤트를 실행해서 대사가 어떻게 나오는지 확인해 주세요.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'shop', prompt: '상점 이벤트 한 번 돌려봐.', args: { eventId: 'ev_test_shop' }, setup: { event: 'ev_test_shop' } },
    { key: 'cutscene-explained', prompt: '장면 연출 이벤트를 실행해 화면 숨기기·보이기와 대기가 제대로 지나가는지 결과를 알려 주세요.', args: { eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'arena-terse', prompt: '문지기 전투 이벤트 실행해 봐.', args: { eventId: ARENA }, setup: { event: ARENA } },
  ],
  readTools: ['run_scene_test'],
  prepare: withBattles,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return readOnly(input, eventId, () => {
      if (!called(input.tools, 'run_scene_test')) return fail(`${eventId}: run_scene_test 호출이 없다(실제 실행이 아니다)`);
      if (/실행하지 않았|실행은 하지 않|돌리지 않았/u.test(input.answer)) return fail(`${eventId}: 실행했다고 하면서 실행하지 않았다고 적었다`);
      if (!mentions(input.answer, '실행', '결과', '재생', '진행')) return fail(`${eventId}: 실행 결과를 보고하지 않았다`);
      return pass(`${eventId}: run_scene_test 로 실행, 결과 보고`);
    });
  },
  reference(_project, args): FamilyOutcome {
    const eventId = strArg(args, 'eventId');
    return `run_scene_test 로 ${eventId} 를 실행했습니다 — 대사가 순서대로 나오고, 명령이 끝까지 진행되었으며 오류는 없었습니다. (문서는 바꾸지 않았습니다)`;
  },
  wrongs(_project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    return [
      `${eventId} 의 명령을 코드로 읽어 보니 문제는 없어 보입니다. 실행은 하지 않았습니다.`,
      `${eventId} 이벤트의 명령 목록은 정상입니다.`,
    ];
  },
};

const summarizeDiff: Family = {
  id: 'summarize-diff',
  area: 'read',
  mode: 'read',
  title: '방금 변경만 요약',
  variants: [
    { key: 'map-changes', prompt: '현재 맵의 변경 사항만 요약해줘.', args: { x: 14, y: 2, material: '나무' }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'map-changes-polite', prompt: '방금 무엇을 바꿨는지 요약해 주세요.', args: { x: 14, y: 2, material: '나무' }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'terse-diff', prompt: '바뀐 것만.', args: { x: 14, y: 2, material: '나무' }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'explained-diff', prompt: '마지막 편집 이후 이 맵에서 실제로 바뀐 타일과 좌표만 알려 주세요. 없는 변경은 지어내지 마세요.', args: { x: 14, y: 2, material: '나무' }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'audit-diff', prompt: '편집 이력을 확인해서 방금 놓은 오브젝트를 짚어 줘.', args: { x: 14, y: 2, material: '나무' }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
  ],
  readTools: ['list_edit_history'],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const material = strArg(args, 'material');
    return readOnly(input, 'summarize-diff', () => {
      if (!called(input.tools, 'list_edit_history', 'get_map_region', 'find_events')) return fail('편집 이력·영역 조회 호출이 없다');
      const named = mentions(input.answer, material, '타일') || coordinatesIn(input.answer).some(cell => cell.x === x && cell.y === y);
      if (!named) return fail(`방금 바꾼 (${x},${y}) ${material} 를 요약하지 않았다`);
      return pass(`(${x},${y}) ${material} 변경 요약`);
    });
  },
  reference(_project, args): FamilyOutcome {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const material = strArg(args, 'material');
    return `마지막 편집에서 바뀐 곳은 (${x},${y}) 한 칸입니다 — 그 칸에 ${material} 를 놓았고 다른 칸은 그대로입니다.`;
  },
  wrongs(_project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    return [
      `이번 세션에서 맵 전체를 다시 칠한 것으로 보입니다. 특별히 바뀐 칸은 없습니다.`,
      `변경 사항을 찾지 못했습니다. (${x + 3},${y + 4}) 근처가 바뀐 것 같습니다.`,
    ];
  },
};

const planOnly: Family = {
  id: 'plan-only',
  area: 'plan',
  mode: 'read',
  title: '실행 없이 선택 영역 계획',
  variants: [
    { key: 'meadow', prompt: '이 작업을 실행하지 말고 계획만 보여줘.', args: { rect: AREA.meadow }, setup: { select: AREA.meadow } },
    { key: 'meadow-polite', prompt: '실행은 하지 마시고, 이 지역에 뭘 할 수 있을지 계획만 세워 주세요.', args: { rect: AREA.meadow }, setup: { select: AREA.meadow } },
    { key: 'trail-terse', prompt: '실행 말고 계획.', args: { rect: AREA.trail }, setup: { select: AREA.trail } },
    { key: 'dirt-explained', prompt: '지금은 아무것도 바꾸지 말고, 선택 영역을 어떻게 다듬을지 단계별 계획만 적어 주세요.', args: { rect: AREA.dirt }, setup: { select: AREA.dirt } },
    { key: 'barrels-plan', prompt: '선택 영역 정리 계획만 알려줘. 아직 실행은 하지 마.', args: { rect: AREA.barrels }, setup: { select: AREA.barrels } },
  ],
  readTools: ['get_project_summary', 'get_map_region'],
  judge(input, args) {
    const rect = rectArg(args);
    return readOnly(input, 'plan-only', () => {
      if (input.answer.trim().length < 20) return fail('계획 답변이 없다');
      // Naming an interior build as an option is a plan; claiming it was built is not a plan.
      if (/(지었|시공했|만들었|칠했|놓았|배치했|바꿨|적용했)(습니다|다|어요)/u.test(input.answer) && !/하겠|하실|예정|계획|제안|수 있/u.test(input.answer)) {
        return fail('계획만 요청했는데 이미 실행했다고 적었다');
      }
      const onSelection = coordinatesIn(input.answer).some(cell => inside(rect, cell.x, cell.y));
      const anchored = onSelection || mentions(input.answer, '선택') || /[?？]/u.test(input.answer);
      return anchored ? pass('실행 없이 선택 영역 기준 계획') : fail('선택 영역을 기준으로 하지도, 무엇을 할지 되묻지도 않았다');
    });
  },
  reference(_project, args): FamilyOutcome {
    const rect = rectArg(args);
    return `선택 영역(${rect.x},${rect.y} ${rect.w}×${rect.h}) 기준 계획입니다. 1) 영역 안의 통행 상태를 먼저 조회해 막힌 칸을 확인합니다. 2) 바닥을 유지한 채 소품을 1~2개만 배치합니다. 3) 출입구 쪽 동선이 끊기지 않는지 확인합니다. 실행은 요청하시면 하겠습니다.`;
  },
  wrongs(_project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    return [
      `선택 영역(${rect.x},${rect.y} ${rect.w}×${rect.h})에 벽과 가구를 새로 지었습니다. 마음에 드시면 다음으로 넘어가겠습니다.`,
      '계획: 마을 전체를 새로 칠합니다.',
    ];
  },
};

const suggestSelectionActions: Family = {
  id: 'suggest-selection-actions',
  area: 'plan',
  mode: 'read',
  title: '선택 영역 기준 추천',
  variants: [
    { key: 'meadow', prompt: '현재 선택 영역에 할 수 있는 작업을 추천해줘.', args: { rect: AREA.meadow }, setup: { select: AREA.meadow } },
    { key: 'meadow-polite', prompt: '선택한 지역에 어울릴 만한 작업을 두세 가지 추천해 주세요.', args: { rect: AREA.meadow }, setup: { select: AREA.meadow } },
    { key: 'trail-terse', prompt: '여기 뭐 할 수 있어?', args: { rect: AREA.trail }, setup: { select: AREA.trail } },
    { key: 'dirt-explained', prompt: '선택 영역의 현재 칩셋·레이어·통행 상태를 고려해 지금 바로 할 수 있는 작업을 추천해 주세요. 실행은 하지 마세요.', args: { rect: AREA.dirt }, setup: { select: AREA.dirt } },
    { key: 'barrels-suggest', prompt: '이 구역에서 할 만한 정리 작업 추천해줘.', args: { rect: AREA.barrels }, setup: { select: AREA.barrels } },
  ],
  readTools: ['find_empty_ground', 'get_map_region'],
  judge(input, args) {
    const rect = rectArg(args);
    return readOnly(input, 'suggest-selection-actions', () => {
      if (input.answer.trim().length < 20) return fail('추천이 없다(20자 이상이어야 한다)');
      const anchored = coordinatesIn(input.answer).some(cell => inside(rect, cell.x, cell.y)) || mentions(input.answer, '선택', '영역', '구역');
      return anchored ? pass('선택 영역 기준 추천') : fail('선택 영역을 기준으로 한 추천이 아니다');
    });
  },
  reference(_project, args): FamilyOutcome {
    const rect = rectArg(args);
    return `선택 영역(${rect.x},${rect.y} ${rect.w}×${rect.h})에는 이런 작업이 어울립니다: ① 잔디 위에 나무·덤불을 3~5칸 흩어 배치, ② 영역을 가로지르는 흙길 한 줄 깔기, ③ 우물이나 표지판 같은 기물 하나 놓기. 지금은 아무것도 바꾸지 않았습니다.`;
  },
  wrongs(_project, _args): FamilyOutcome[] {
    return [
      '추천: 없음.',
      '마을 전체를 새로 생성하는 것을 추천합니다.',
    ];
  },
};

export const GROUP_4_BATTLE_READ: readonly Family[] = [
  battleTroopCreate, battleEventStart, battleEscapeAllowed, battleDefeatBranch, battleEncounterRate,
  eventPlaytest, summarizeDiff, planOnly, suggestSelectionActions,
];
