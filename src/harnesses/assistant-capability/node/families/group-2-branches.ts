import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  MAP, clone, fail, keepsInOrder, pass, runOn,
} from '../matrixNativeSpec';
import { strArg, type Family, type FamilyOutcome } from './types';
import {
  G2, FLAGS_AND_SYSTEM_IGNORED, FLAGS_IGNORED, commandsAt, core, editEvent, lostFlags, newSwitches, newVariables, nonEmptyText, prepareGroup2,
  sameWords, stripCommands,
} from './group-2-shared';

const choicesIndex = (project: Project, eventId: string): number => {
  const index = commandsAt(project, eventId).findIndex((command: any) => command.kind === 'choices' && (command.options ?? []).length >= 2);
  if (index < 0) throw new Error(`${eventId} 에 선택지 명령이 없다`);
  return index;
};

const fork = (condition: any, then: any[], otherwise?: any[]) => ({
  kind: 'fork', condition, then, ...(otherwise ? { else: otherwise } : {}),
});

const branchTwoChoices: Family = {
  id: 'branch-two-choices',
  area: 'events',
  mode: 'write',
  title: '선택지 두 갈래 추가',
  variants: [
    { key: 'villager-yesno', prompt: '이 주민 대화 끝에 「예」/「아니오」 두 갈래 선택지를 넣어 주세요. 양쪽 모두 무슨 일이 일어나게 해 주세요.', args: { eventId: 'ev_utility_npc', optionA: '예', optionB: '아니오' }, setup: { event: 'ev_utility_npc' } },
    { key: 'child-casual', prompt: '미루한테 "같이 간다"/"여기 남는다" 선택지 두 개 붙여줘. 각 갈래에 대사도 넣고.', args: { eventId: 'ev_ember_child', optionA: '같이 간다', optionB: '여기 남는다' }, setup: { event: 'ev_ember_child' } },
    { key: 'inn-terse', prompt: '여관 주인 선택지 2개: 묵는다 / 나간다.', args: { eventId: 'ev_ember_inn', optionA: '묵는다', optionB: '나간다' }, setup: { event: 'ev_ember_inn' } },
    { key: 'gate-explained', prompt: '성문 경비 이벤트 뒤에 「통행증을 낸다」와 「돌아간다」 두 선택지를 붙이고, 두 갈래 모두 비어 있지 않게 해 주세요. 기존 대사는 그대로 두세요.', args: { eventId: G2.branches.gate, optionA: '통행증을 낸다', optionB: '돌아간다' }, setup: { event: G2.branches.gate } },
    { key: 'guard-two', prompt: '파수꾼 이벤트에 "들어간다" / "나중에 온다" 선택지 두 갈래 추가해 줘.', args: { eventId: 'ev_ember_guard', optionA: '들어간다', optionB: '나중에 온다' }, setup: { event: 'ev_ember_guard' } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const optionA = strArg(args, 'optionA');
    const optionB = strArg(args, 'optionB');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      const choices = added.filter((command: any) => command.kind === 'choices' && Array.isArray(command.options));
      if (choices.length !== 1) return fail(`추가된 선택지 명령이 ${choices.length}개다`);
      const options = choices[0].options as any[];
      if (options.length !== 2) return fail(`선택지가 ${options.length}개다(2개여야 한다)`);
      if (!options.every((option: any) => nonEmptyText(option.text))) return fail('문구가 빈 선택지가 있다');
      if (new Set(options.map((option: any) => core(option.text))).size !== 2) return fail('두 선택지 문구가 같다');
      if (!options.every((option: any) => Array.isArray(option.branch) && option.branch.length >= 1)) return fail('분기가 빈 선택지가 있다');
      if (![optionA, optionB].every(text => options.some((option: any) => sameWords(option.text, text)))) return fail(`요청한 두 선택지(${optionA} / ${optionB})가 아니다: ${options.map((option: any) => option.text).join(' / ')}`);
      if (!keepsInOrder(was, now)) return fail('기존 대사·명령이 사라졌거나 순서가 바뀌었다');
      return pass('선택지 두 갈래 추가, 기존 대사 보존');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const optionA = strArg(args, 'optionA');
    const optionB = strArg(args, 'optionB');
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: {
        commands: [...commandsAt(project, eventId), {
          kind: 'choices',
          prompt: '어떻게 할까?',
          options: [
            { text: optionA, branch: [{ kind: 'text', body: `${optionA} 쪽을 골랐다.` }] },
            { text: optionB, branch: [{ kind: 'text', body: `${optionB} 쪽을 골랐다.` }] },
          ],
          cancelBehavior: 'disallow',
        }],
      },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const optionA = strArg(args, 'optionA');
    const optionB = strArg(args, 'optionB');
    const commands = commandsAt(project, eventId);
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'text')).id;
    const withChoices = (id: string, choices: any) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: id, pageIndex: 0, set: { commands: [...commandsAt(project, id), choices] },
    });
    return [
      withChoices(eventId, { kind: 'choices', prompt: '어떻게 할까?', options: [{ text: optionA, branch: [{ kind: 'text', body: '왔다.' }] }, { text: optionB, branch: [] }], cancelBehavior: 'disallow' }),
      withChoices(eventId, { kind: 'choices', prompt: '어떻게 할까?', options: [{ text: optionA, branch: [{ kind: 'text', body: '왔다.' }] }, { text: optionB, branch: [{ kind: 'text', body: '갔다.' }] }, { text: '모르겠다', branch: [{ kind: 'text', body: '음.' }] }], cancelBehavior: 'disallow' }),
      withChoices(eventId, { kind: 'choices', prompt: '어떻게 할까?', options: [{ text: optionA, branch: [{ kind: 'text', body: '왔다.' }] }, { text: optionA, branch: [{ kind: 'text', body: '갔다.' }] }], cancelBehavior: 'disallow' }),
      withChoices(other, { kind: 'choices', prompt: '어떻게 할까?', options: [{ text: optionA, branch: [{ kind: 'text', body: '왔다.' }] }, { text: optionB, branch: [{ kind: 'text', body: '갔다.' }] }], cancelBehavior: 'disallow' }),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: [{ kind: 'choices', prompt: '어떻게 할까?', options: [{ text: optionA, branch: [{ kind: 'text', body: '왔다.' }] }, { text: optionB, branch: [{ kind: 'text', body: '갔다.' }] }], cancelBehavior: 'disallow' }] },
      }),
    ];
  },
};

const branchNestedCondition: Family = {
  id: 'branch-nested-condition',
  area: 'events',
  mode: 'write',
  title: '기존 분기 안에 변수 조건 분기',
  variants: [
    { key: 'trust-3', prompt: '문 앞 선택의 첫 갈래 안에 「신뢰가 3 이상이면」 변수 조건 분기를 넣어 주세요. 갈래의 기존 대사는 그대로 두세요.', args: { eventId: G2.branches.choice, variableId: G2.variables.trust, op: '>=', value: 3 }, setup: { event: G2.branches.choice } },
    { key: 'trust-5-casual', prompt: '문 앞 선택 첫 번째 갈래에 신뢰 5 이상일 때만 나오는 분기 하나 끼워줘.', args: { eventId: G2.branches.choice, variableId: G2.variables.trust, op: '>=', value: 5 }, setup: { event: G2.branches.choice } },
    { key: 'met-1-terse', prompt: '성문 경비 첫 갈래에 만남 횟수 1 이상 분기.', args: { eventId: G2.branches.gate, variableId: G2.variables.met, op: '>=', value: 1 }, setup: { event: G2.branches.gate } },
    { key: 'purse-explained', prompt: '성문 경비의 「통행증을 보여준다」 갈래 안에 「가진 돈이 100 이상」이면 통행료를 내는 분기를 중첩해 주세요. 그 갈래의 기존 명령은 지우지 마세요.', args: { eventId: G2.branches.gate, variableId: G2.variables.purse, op: '>=', value: 100 }, setup: { event: G2.branches.gate } },
    { key: 'met-2', prompt: '문 앞 선택의 두 번째 갈래에 만남 횟수가 2 이상인지 보는 분기를 넣어 줘.', args: { eventId: G2.branches.choice, variableId: G2.variables.met, op: '>=', value: 2 }, setup: { event: G2.branches.choice } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const variableId = strArg(args, 'variableId');
    const op = typeof args.op === 'string' ? args.op : undefined;
    const value = typeof args.value === 'number' ? args.value : undefined;
    return editEvent(input, eventId, (before, after) => {
      const nested: any[] = [];
      const walk = (list: any[], depth: number): void => {
        for (const command of list) {
          if (!command || typeof command !== 'object') continue;
          if (command.kind === 'fork' && depth > 0) nested.push(command);
          if (command.kind === 'choices' || command.kind === 'presentItem') {
            for (const option of command.options ?? []) walk(option.branch ?? [], depth + 1);
            if (Array.isArray(command.cancelBranch)) walk(command.cancelBranch, depth + 1);
          }
          if (command.kind === 'fork') {
            walk(command.then ?? [], depth);
            if (Array.isArray(command.else)) walk(command.else, depth);
          }
          if (command.kind === 'loop') walk(command.body ?? [], depth);
        }
      };
      walk(after.pages[0].commands ?? [], 0);
      const wanted = nested.filter((command: any) => command.condition?.kind === 'variable' && command.condition.variableId === variableId);
      if (!wanted.length) return fail('기존 분기 안에 그 변수 조건 분기가 없다(최상위에 놓인 분기는 중첩이 아니다)');
      const target = wanted[0];
      if (!Array.isArray(target.then) || !target.then.length) return fail('분기 본문(then)이 비었다');
      if (op && target.condition.op !== op) return fail(`비교 연산자가 ${target.condition.op} 이다`);
      if (value !== undefined && Number(target.condition.value) !== value) return fail(`비교 값이 ${target.condition.value} 이다`);
      const withoutForks = stripCommands(after.pages[0].commands ?? [], (command: any) => command.kind === 'fork');
      if (!isDeepStrictEqual(withoutForks, before.pages[0].commands)) return fail('분기 밖의 명령이 바뀌었거나 기존 갈래 명령이 사라졌다');
      return pass(`기존 갈래 안에 변수 조건(${variableId} ${op ?? ''} ${value ?? ''}) 분기 추가`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const variableId = strArg(args, 'variableId');
    const op = typeof args.op === 'string' ? args.op : '>=';
    const value = typeof args.value === 'number' ? args.value : 1;
    const index = choicesIndex(project, eventId);
    const commands = commandsAt(project, eventId).map((command: any, at: number) => {
      if (at !== index) return command;
      return {
        ...command,
        options: command.options.map((option: any, optionIndex: number) => (optionIndex === 0
          ? { ...option, branch: [...option.branch, fork({ kind: 'variable', variableId, op, value }, [{ kind: 'text', body: '조건을 만족했다.' }], [{ kind: 'text', body: '아직 부족하다.' }])] }
          : option)),
      };
    });
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const variableId = strArg(args, 'variableId');
    const op = typeof args.op === 'string' ? args.op : '>=';
    const value = typeof args.value === 'number' ? args.value : 1;
    const commands = commandsAt(project, eventId);
    const index = choicesIndex(project, eventId);
    const inside = (next: any) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: commands.map((command: any, at: number) => (at === index ? next(command) : command)) },
    });
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'choices')).id;
    const otherIndex = choicesIndex(project, other);
    const nested = (condition: any, then: any[]) => (command: any) => ({
      ...command,
      options: command.options.map((option: any, optionIndex: number) => (optionIndex === 0 ? { ...option, branch: [...option.branch, fork(condition, then)] } : option)),
    });
    return [
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: [...commands, fork({ kind: 'variable', variableId, op, value }, [{ kind: 'text', body: '최상위 분기.' }])] },
      }),
      inside(nested({ kind: 'switch', switchId: 'sw_ember_q1_started', value: true }, [{ kind: 'text', body: '스위치 분기.' }])),
      inside(nested({ kind: 'variable', variableId, op, value }, [])),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: commands.map((command: any, at: number) => (at === index ? { ...command, options: command.options.map((option: any, optionIndex: number) => (optionIndex === 0 ? { ...option, branch: [fork({ kind: 'variable', variableId, op, value }, [{ kind: 'text', body: '갈래를 갈아치웠다.' }])] } : option)) } : command)) },
      }),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId: other, pageIndex: 0,
        set: { commands: commandsAt(project, other).map((command: any, at: number) => (at === otherIndex
          ? { ...command, options: command.options.map((option: any, optionIndex: number) => (optionIndex === 0 ? { ...option, branch: [...option.branch, fork({ kind: 'variable', variableId, op, value }, [{ kind: 'text', body: '다른 이벤트.' }])] } : option)) }
          : command)) },
      }),
    ];
  },
};

const buildVariableCreateAndSet = (project: Project, args: Record<string, unknown>): Project => {
  const eventId = strArg(args, 'eventId');
  const variableId = strArg(args, 'variableId');
  const name = strArg(args, 'name');
  const value = typeof args.value === 'number' ? args.value : 0;
  const created = runOn(project, 'rename_variable', { to: variableId, name });
  return runOn(created, 'patch_event_page', {
    mapId: MAP, eventId, pageIndex: 0,
    set: { commands: [...commandsAt(created, eventId), { kind: 'setVariable', variableId, op: '=', value }] },
  });
};

const variableCreateAndSet: Family = {
  id: 'variable-create-and-set',
  area: 'events',
  mode: 'write',
  title: '변수 생성 + 값 설정',
  variants: [
    { key: 'visit-polite', prompt: '「방문 횟수」 변수를 새로 만들고, 이 이벤트에서 그 값을 3으로 설정해 주세요.', args: { eventId: 'ev_utility_npc', variableId: 'var_g2_visit', name: '방문 횟수', value: 3 }, setup: { event: 'ev_utility_npc' } },
    { key: 'coins-casual', prompt: '「모은 동전」 변수 하나 새로 만들어서 여관 주인 이벤트에서 10으로 놔줘.', args: { eventId: 'ev_ember_inn', variableId: 'var_g2_coins', name: '모은 동전', value: 10 }, setup: { event: 'ev_ember_inn' } },
    { key: 'step-terse', prompt: '변수 var_g2_step 새로 만들고 미루 이벤트에서 2로.', args: { eventId: 'ev_ember_child', variableId: 'var_g2_step', name: '진행 단계', value: 2 }, setup: { event: 'ev_ember_child' } },
    { key: 'forest-explained', prompt: '「숲 방문」 변수를 만들고 파수꾼 이벤트에서 그 변수를 1로 설정하는 명령을 넣어 주세요. 기존 대사는 지우지 마세요.', args: { eventId: 'ev_ember_guard', variableId: 'var_g2_forest', name: '숲 방문', value: 1 }, setup: { event: 'ev_ember_guard' } },
    { key: 'walker-short', prompt: '산책 주민 이벤트에 「산책 수」 변수 만들고 7로 설정.', args: { eventId: G2.walkers.a, variableId: 'var_g2_walks', name: '산책 수', value: 7 }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const value = typeof args.value === 'number' ? args.value : 0;
    return editEvent(input, eventId, (before, after) => {
      const lost = lostFlags(input.before, input.after);
      if (lost) return fail(lost);
      const created = newVariables(input.before, input.after);
      if (created.length !== 1) return fail(`새로 만든 변수가 ${created.length}개다`);
      if (!nonEmptyText(created[0].name)) return fail(`변수 ${created[0].id} 에 표시 이름이 없다`);
      const commands = after.pages[0].commands as any[];
      const settings = commands.filter((command: any) => command.kind === 'setVariable' && command.variableId === created[0].id);
      if (!settings.length) return fail(`새 변수 ${created[0].id} 를 설정하는 명령이 없다`);
      if (!settings.some((command: any) => (command.op ?? '=') === '=' && Number(command.value) === value)) return fail(`변수를 ${value} 로 설정하지 않았다(${settings.map((command: any) => `${command.op}${command.value}`).join(', ')})`);
      if (!keepsInOrder(before.pages[0].commands, commands)) return fail('기존 명령이 사라졌거나 순서가 바뀌었다');
      return pass(`변수 ${created[0].id}(${created[0].name}) 생성, 값 ${value} 설정`);
    }, FLAGS_IGNORED);
  },
  reference(project, args) {
    return buildVariableCreateAndSet(project, args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const variableId = strArg(args, 'variableId');
    const name = strArg(args, 'name');
    const value = typeof args.value === 'number' ? args.value : 0;
    const reference = buildVariableCreateAndSet(project, args);
    const commands = commandsAt(reference, eventId);
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'text')).id;
    const existing = ((project as any).variables ?? []).find((entry: any) => entry.id !== variableId)?.id;
    const noCommand = clone(reference) as any;
    noCommand.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = commands.filter((command: any) => command.kind !== 'setVariable');
    const noVariable = clone(reference) as any;
    noVariable.variables = noVariable.variables.filter((entry: any) => entry.id !== variableId);
    noVariable.session.variables = Object.fromEntries(Object.entries(noVariable.session.variables ?? {}).filter(([id]) => id !== variableId));
    noVariable.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = commands.map((command: any) => (command.kind === 'setVariable' ? { ...command, variableId: existing } : command));
    const wrongValue = clone(reference) as any;
    wrongValue.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = commands.map((command: any) => (command.kind === 'setVariable' ? { ...command, value: value + 1 } : command));
    const destroysExisting = clone(reference) as any;
    destroysExisting.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = commands.filter((command: any, index: number) => index > 0);
    const twoVariables = clone(reference) as any;
    twoVariables.variables = [...twoVariables.variables, { id: `${variableId}_extra`, name: `${name} 보조` }];
    twoVariables.session.variables = { ...twoVariables.session.variables, [`${variableId}_extra`]: 0 };
    return [
      noVariable,
      noCommand,
      wrongValue,
      destroysExisting,
      twoVariables,
      runOn(reference, 'patch_event_page', { mapId: MAP, eventId: other, pageIndex: 0, set: { commands: [...commandsAt(reference, other), { kind: 'setVariable', variableId, op: '=', value }] } }),
    ];
  },
};

const buildAutorunPage = (project: Project, args: Record<string, unknown>): Project => {
  const eventId = strArg(args, 'eventId');
  const pages = (project as any).maps[MAP].events.find((event: any) => event.id === eventId).pages as any[];
  const autoPage = {
    ...clone(pages[0]),
    id: `${eventId}_autorun`,
    name: `${eventId} 자동 실행`,
    trigger: { kind: 'auto' },
    conditions: [],
    commands: [{ kind: 'text', body: '맵에 들어오면 한 번 안내한다.' }],
  };
  return runOn(project, 'upsert_event', { mapId: MAP, replacePages: true, event: { id: eventId, pages: [...pages, autoPage] } });
};

const autorunPage: Family = {
  id: 'autorun-page',
  area: 'events',
  mode: 'write',
  title: '자동 실행 페이지 추가',
  variants: [
    { key: 'villager-polite', prompt: '이 이벤트에 맵에 들어오면 저절로 실행되는 페이지를 하나 추가해 주세요. 원래 페이지는 그대로 두세요.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인에 자동 실행 페이지 하나 붙여줘. 첫 페이지는 건드리지 마.', args: { eventId: 'ev_ember_inn' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 이벤트 autorun 페이지 추가.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트에 자동 실행(autorun) 페이지를 새로 넣고, 그 페이지에서 안내 대사가 한 번 나오게 해 주세요. 기존 페이지의 대사는 그대로 유지하세요.', args: { eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
    { key: 'walker-short', prompt: '산책 주민에 autorun 페이지 하나.', args: { eventId: G2.walkers.a }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return editEvent(input, eventId, (before, after) => {
      const beforePages = before.pages ?? [];
      const afterPages = after.pages ?? [];
      if (!isDeepStrictEqual(afterPages[0]?.trigger, beforePages[0]?.trigger)) return fail('첫 페이지의 실행 조건이 바뀌었다');
      if (!isDeepStrictEqual(afterPages[0]?.commands, beforePages[0]?.commands)) return fail('첫 페이지의 명령이 바뀌었다');
      const auto = afterPages.filter((page: any) => page.trigger?.kind === 'auto');
      if (!auto.length) return fail('자동 실행(auto) 페이지가 없다');
      const fresh = auto.filter((page: any) => !beforePages.some((old: any) => isDeepStrictEqual(old, page)));
      if (!fresh.length) return fail('새로 추가된 자동 실행 페이지가 없다');
      if (!fresh.every((page: any) => (page.commands ?? []).length >= 1)) return fail('자동 실행 페이지에 명령이 없다');
      if (!beforePages.every((page: any) => afterPages.some((next: any) => isDeepStrictEqual(next.commands, page.commands)))) return fail('기존 페이지의 명령이 사라졌다');
      return pass(`자동 실행 페이지 ${fresh.length}개 추가, 기존 페이지 보존`);
    }, FLAGS_AND_SYSTEM_IGNORED);
  },
  reference(project, args) {
    return buildAutorunPage(project, args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const reference = buildAutorunPage(project, args);
    const pages = (reference as any).maps[MAP].events.find((event: any) => event.id === eventId).pages as any[];
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'text')).id;
    const parallel = clone(reference) as any;
    parallel.maps[MAP].events.find((event: any) => event.id === eventId).pages = pages.map((page: any, index: number) => (index === pages.length - 1 ? { ...page, trigger: { kind: 'parallel' } } : page));
    const emptied = clone(reference) as any;
    emptied.maps[MAP].events.find((event: any) => event.id === eventId).pages = pages.map((page: any, index: number) => (index === pages.length - 1 ? { ...page, commands: [] } : page));
    const replacedFirst = clone(reference) as any;
    replacedFirst.maps[MAP].events.find((event: any) => event.id === eventId).pages = pages.map((page: any, index: number) => (index === 0 ? { ...page, commands: (page.commands ?? []).slice(0, 1) } : page));
    const converted = runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { trigger: { kind: 'auto' } } });
    return [
      converted,
      parallel,
      emptied,
      replacedFirst,
      runOn(project, 'upsert_event', {
        mapId: MAP, replacePages: true,
        event: { id: other, pages: [...((project as any).maps[MAP].events.find((event: any) => event.id === other).pages as any[]), clone(pages[pages.length - 1])] },
      }),
    ];
  },
};

const commonEventCall: Family = {
  id: 'common-event-call',
  area: 'events',
  mode: 'write',
  title: '커먼 이벤트 호출 삽입',
  variants: [
    { key: 'villager-polite', prompt: '이 주민 대사 끝에서 「마을 소식」 커먼 이벤트를 부르게 해 주세요.', args: { eventId: 'ev_utility_npc', commonEventId: G2.commonEvents.hello }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인 이벤트에서 축제 안내 커먼 이벤트 불러줘.', args: { eventId: 'ev_ember_inn', commonEventId: G2.commonEvents.notice }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 → 마을 소식 커먼 이벤트 호출.', args: { eventId: 'ev_ember_child', commonEventId: G2.commonEvents.hello }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트 마지막에 「축제 안내」 커먼 이벤트를 호출하는 명령을 하나 넣어 주세요. 커먼 이벤트 본문과 기존 대사는 그대로 두세요.', args: { eventId: 'ev_ember_guard', commonEventId: G2.commonEvents.notice }, setup: { event: 'ev_ember_guard' } },
    { key: 'walker-short', prompt: '산책 주민이 마을 소식 커먼 이벤트 부르게.', args: { eventId: G2.walkers.a, commonEventId: G2.commonEvents.hello }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const commonEventId = strArg(args, 'commonEventId');
    return editEvent(input, eventId, (before, after) => {
      if (!isDeepStrictEqual((input.after as any).commonEvents, (input.before as any).commonEvents)) return fail('커먼 이벤트 본문이 바뀌었다');
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      if (added.length !== 1) return fail(`추가된 명령이 ${added.length}개다`);
      if (added[0].kind !== 'callCommonEvent') return fail(`추가된 명령이 커먼 이벤트 호출이 아니다(${added[0].kind})`);
      if (added[0].commonEventId !== commonEventId) return fail(`부른 커먼 이벤트가 ${added[0].commonEventId} 다`);
      if (!((input.after as any).commonEvents ?? []).some((entry: any) => entry.id === commonEventId)) return fail(`없는 커먼 이벤트(${commonEventId})를 불렀다`);
      if (!keepsInOrder(was, now)) return fail('기존 명령이 사라졌거나 순서가 바뀌었다');
      return pass(`커먼 이벤트 ${commonEventId} 호출 삽입, 본문 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const commonEventId = strArg(args, 'commonEventId');
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: [...commandsAt(project, eventId), { kind: 'callCommonEvent', commonEventId }] },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const commonEventId = strArg(args, 'commonEventId');
    const commands = commandsAt(project, eventId);
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'text')).id;
    const different = Object.values(G2.commonEvents).find(id => id !== commonEventId) ?? G2.commonEvents.notice;
    const call = (id: string) => ({ kind: 'callCommonEvent', commonEventId: id });
    const missing = clone(project) as any;
    missing.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = [...commands, call('ce_g2_missing')];    return [
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands, call(different)] } }),
      missing,
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands, call(commonEventId), call(commonEventId)] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId: other, pageIndex: 0, set: { commands: [...commandsAt(project, other), call(commonEventId)] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands.slice(0, -1), call(commonEventId)] } }),
    ];
  },
};

const buildChainSwitchThenGate = (project: Project, args: Record<string, unknown>): Project => {
  const eventId = strArg(args, 'eventId');
  const switchId = strArg(args, 'switchId');
  const switchName = strArg(args, 'switchName');
  const created = runOn(project, 'rename_switch', { to: switchId, name: switchName });
  const pages = (created as any).maps[MAP].events.find((event: any) => event.id === eventId).pages as any[];
  const gatedPage = {
    ...clone(pages[0]),
    id: `${eventId}_${switchId}`,
    name: switchName,
    conditions: [{ kind: 'switch', switchId, value: true }],
    commands: [{ kind: 'text', body: `${switchName} 상태의 안내.` }],
  };
  return runOn(created, 'upsert_event', { mapId: MAP, replacePages: true, event: { id: eventId, pages: [...pages, gatedPage] } });
};

const chainSwitchThenGate: Family = {
  id: 'chain-switch-then-gate',
  area: 'events',
  mode: 'write',
  title: '스위치 생성 + 페이지 조건 연결',
  variants: [
    { key: 'villager-gate', prompt: '「문 열림」 스위치를 새로 만들고, 이 주민 이벤트에 그 스위치가 켜졌을 때만 보이는 페이지를 붙여 주세요.', args: { eventId: 'ev_utility_npc', switchId: 'sw_g2_gate_open', switchName: '문 열림' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 준비 스위치(sw_g2_inn_ready) 하나 만들고, 여관 주인 이벤트를 그 스위치 조건 페이지로 갈라줘.', args: { eventId: 'ev_ember_inn', switchId: 'sw_g2_inn_ready', switchName: '여관 준비' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: 'sw_g2_child_met 스위치 만들고 미루 이벤트 조건에 물려.', args: { eventId: 'ev_ember_child', switchId: 'sw_g2_child_met', switchName: '미루 만남' }, setup: { event: 'ev_ember_child' } },
    { key: 'gate-explained', prompt: '「선택 완료」 스위치를 새로 등록한 뒤, 성문 경비 이벤트에 그 스위치가 켜져 있을 때만 나오는 페이지를 추가해 주세요. 기존 페이지 명령은 그대로 두세요.', args: { eventId: G2.branches.gate, switchId: 'sw_g2_branch_pick', switchName: '선택 완료' }, setup: { event: G2.branches.gate } },
    { key: 'walker-short', prompt: '산책 완료 스위치 만들고 산책 주민 페이지 조건으로.', args: { eventId: G2.walkers.a, switchId: 'sw_g2_walk_done', switchName: '산책 완료' }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    return editEvent(input, eventId, (before, after) => {
      const lost = lostFlags(input.before, input.after);
      if (lost) return fail(lost);
      const created = newSwitches(input.before, input.after);
      if (!created.length) return fail('새로 만든 스위치가 없다');
      if (!created.every((entry: any) => nonEmptyText(entry.name))) return fail('새 스위치에 표시 이름이 없다');
      const gated = (after.pages ?? []).filter((page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && created.some((entry: any) => entry.id === condition.switchId)));
      if (!gated.length) return fail('새 스위치를 조건으로 쓰는 페이지가 없다');
      if (!gated.some((page: any) => created.some((entry: any) => entry.id === switchId))) return fail(`요청한 스위치(${switchId})가 조건에 쓰이지 않았다`);
      if (!(after.pages ?? []).some((page: any) => isDeepStrictEqual(page.commands, before.pages[0].commands))) return fail('원래 페이지 명령이 사라졌다');
      return pass(`스위치 ${switchId} 생성 + 페이지 조건 연결`);
    }, FLAGS_AND_SYSTEM_IGNORED);
  },
  reference(project, args) {
    return buildChainSwitchThenGate(project, args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    const switchName = strArg(args, 'switchName');
    const reference = buildChainSwitchThenGate(project, args);
    const created = runOn(project, 'rename_switch', { to: switchId, name: switchName });
    const pages = (reference as any).maps[MAP].events.find((event: any) => event.id === eventId).pages as any[];
    const other = (project as any).maps[MAP].events.find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'text')).id;
    const otherPages = (project as any).maps[MAP].events.find((event: any) => event.id === other).pages as any[];
    const unnamed = clone(reference) as any;
    unnamed.switches = unnamed.switches.map((entry: any) => (entry.id === switchId ? { ...entry, name: '' } : entry));
    const replacedOriginal = clone(reference) as any;
    replacedOriginal.maps[MAP].events.find((event: any) => event.id === eventId).pages[0].commands = commandsAt(reference, eventId).slice(0, 1);
    const existingGate = runOn(project, 'upsert_event', {
      mapId: MAP, replacePages: true,
      event: { id: eventId, pages: [...((project as any).maps[MAP].events.find((event: any) => event.id === eventId).pages as any[]), { ...clone(otherPages[0]), id: `${eventId}_gated`, conditions: [{ kind: 'switch', switchId: 'sw_ember_q1_started', value: true }], commands: [{ kind: 'text', body: '조건부 안내.' }] }] },
    });
    return [
      clone(created) as Project,
      existingGate,
      runOn(created, 'upsert_event', {
        mapId: MAP, replacePages: true,
        event: { id: other, pages: [...otherPages, { ...clone(pages[pages.length - 1]), id: `${other}_gated` }] },
      }),
      unnamed,
      replacedOriginal,
    ];
  },
};

export const GROUP_2_BRANCHES: readonly Family[] = [
  branchTwoChoices, branchNestedCondition, variableCreateAndSet, autorunPage, commonEventCall, chainSwitchThenGate,
];
