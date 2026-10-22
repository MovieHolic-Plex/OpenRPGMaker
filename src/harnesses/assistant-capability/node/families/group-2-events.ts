import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  MAP, clone, fail, keepsInOrder, mapOf, pass, runOn,
} from '../matrixNativeSpec';
import { strArg, type Family, type FamilyOutcome } from './types';
import { G2, FLAGS_IGNORED, commandsAt, editEvent, lostFlags, prepareGroup2, sameDoc, sameWords } from './group-2-shared';

const firstTextOf = (project: Project, eventId: string, page = 0): any | undefined =>
  commandsAt(project, eventId, page).find((command: any) => command.kind === 'text');

const otherEventWithText = (project: Project, eventId: string): string => {
  const found = (mapOf(project).events as any[]).find((event: any) => event.id !== eventId
    && (event.pages ?? []).some((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'text')));
  if (!found) throw new Error('fixture 에 다른 대사 이벤트가 없다');
  return found.id;
};

const replaceCommand = (project: Project, eventId: string, index: number, next: any, page = 0): Project =>
  runOn(project, 'patch_event_page', {
    mapId: MAP, eventId, pageIndex: page,
    set: { commands: commandsAt(project, eventId, page).map((command, at) => (at === index ? next : command)) },
  });

const changeFirstLine: Family = {
  id: 'change-first-line',
  area: 'events',
  mode: 'write',
  title: '이벤트 첫 대사만 교체',
  variants: [
    { key: 'villager-polite', prompt: '이 주민의 첫 대사를 「오늘은 조심해서 다녀오세요.」로 바꿔 주세요.', args: { eventId: 'ev_utility_npc', body: '오늘은 조심해서 다녀오세요.' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인 첫 대사를 "방 하나 남았어, 들어와." 로 바꿔줘.', args: { eventId: 'ev_ember_inn', body: '방 하나 남았어, 들어와.' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 첫 대사 → "나도 데려가 줘!"', args: { eventId: 'ev_ember_child', body: '나도 데려가 줘!' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트의 첫 번째 대사만 「해가 지기 전에 돌아오게.」로 고쳐 주세요. 화자와 나머지 명령은 그대로 두세요.', args: { eventId: 'ev_ember_guard', body: '해가 지기 전에 돌아오게.' }, setup: { event: 'ev_ember_guard' } },
    { key: 'cutscene-rewrite', prompt: '장면 연출 이벤트의 첫 대사를 「해가 진다.」로 다시 써 줘.', args: { eventId: 'ev_test_cutscene', body: '해가 진다.' }, setup: { event: 'ev_test_cutscene' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const body = strArg(args, 'body');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const first = now[0];
      if (!first || first.kind !== 'text') return fail('첫 명령이 대사가 아니다');
      if (isDeepStrictEqual(first, was[0])) return fail('첫 대사가 그대로다');
      if (!sameWords(first.body, body)) return fail(`첫 대사가 요청한 문장이 아니다: 「${String(first.body ?? '').slice(0, 40)}」`);
      if (first.speaker !== (was[0] as any)?.speaker) return fail('요청하지 않은 화자(speaker)가 바뀌었다');
      if (!isDeepStrictEqual(now.map(command => command.kind), was.map(command => command.kind))) return fail('명령 종류가 바뀌었다');
      if (!isDeepStrictEqual(now.slice(1), was.slice(1))) return fail('첫 대사 밖의 명령이 바뀌었다');
      return pass('첫 대사만 교체, 화자·나머지 명령 보존');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    return replaceCommand(project, eventId, 0, { ...firstTextOf(project, eventId), body: strArg(args, 'body') });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const body = strArg(args, 'body');
    const was = commandsAt(project, eventId);
    const other = otherEventWithText(project, eventId);
    return [
      replaceCommand(project, other, 0, { ...firstTextOf(project, other), body }),
      replaceCommand(project, eventId, 0, { ...firstTextOf(project, eventId), body, speaker: '지나가는 행인' }),
      replaceCommand(project, eventId, 0, { ...firstTextOf(project, eventId), body: '요청과 다른 문장이다.' }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [{ ...firstTextOf(project, eventId), body }] } }),
    ];
  },
};

const addSwitchCondition: Family = {
  id: 'add-switch-condition',
  area: 'events',
  mode: 'write',
  title: '페이지에 스위치 조건 추가',
  variants: [
    { key: 'quest-started', prompt: '이 이벤트가 퀘스트 시작 스위치가 켜졌을 때만 나오게 조건을 붙여 주세요.', args: { eventId: 'ev_utility_npc', switchId: 'sw_ember_q1_started', value: true }, setup: { event: 'ev_utility_npc' } },
    { key: 'quest-clear-casual', prompt: '여관 주인 페이지에 클리어 스위치 조건 달아줘.', args: { eventId: 'ev_ember_inn', switchId: 'sw_ember_q1_clear', value: true }, setup: { event: 'ev_ember_inn' } },
    { key: 'unused-switch', prompt: '미루 이벤트 페이지에 「미사용 스위치」가 켜져 있을 때만 보이도록 조건을 추가해 줘.', args: { eventId: 'ev_ember_child', switchId: 'sw_unused', value: true }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트의 첫 페이지가 sw_ember_q1_started 스위치가 켜졌을 때만 실행되게 만들어 주세요. 대사와 명령은 그대로 두고요.', args: { eventId: 'ev_ember_guard', switchId: 'sw_ember_q1_started', value: true }, setup: { event: 'ev_ember_guard' } },
    { key: 'branch-gate', prompt: '성문 경비 페이지에 「초안 스위치」 조건 붙여 줘.', args: { eventId: G2.branches.gate, switchId: G2.switches.draft, value: true }, setup: { event: G2.branches.gate } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    const value = args.value === undefined ? true : Boolean(args.value);
    const known = new Set(((input.after as any).switches ?? []).map((entry: any) => entry.id));
    return editEvent(input, eventId, (before, after) => {
      const lost = lostFlags(input.before, input.after);
      if (lost) return fail(lost);
      const pagesOf = (event: any) => (event.pages ?? []) as any[];
      const beforePages = pagesOf(before), afterPages = pagesOf(after);
      const addedByPage = afterPages.map((page: any, index: number) => (page.conditions ?? [])
        .filter((condition: any) => !((beforePages[index]?.conditions ?? []) as any[]).some((old: any) => isDeepStrictEqual(old, condition))));
      const touched = addedByPage.filter((added: any[]) => added.length > 0);
      if (!touched.length) return fail('조건이 추가되지 않았다');
      if (!touched.every((added: any[]) => added.every((condition: any) => condition.kind === 'switch'))) return fail('추가된 조건이 스위치 조건이 아니다');
      const wanted = touched.some((added: any[]) => added.some((condition: any) => condition.switchId === switchId && condition.value === value));
      if (!wanted) return fail(`요청한 스위치(${switchId}=${value}) 조건이 아니다: ${touched.flat().map((condition: any) => `${condition.switchId}=${condition.value}`).join(', ')}`);
      if (!known.has(switchId)) return fail(`프로젝트에 없는 스위치(${switchId})를 조건으로 썼다`);
      const survives = afterPages.some((page: any) => isDeepStrictEqual(page.commands, beforePages[0]?.commands));
      return survives ? pass(`스위치 조건 ${switchId} 추가, 원래 명령 보존`) : fail('원래 대사·명령이 사라졌다');
    }, FLAGS_IGNORED);
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    const value = args.value === undefined ? true : Boolean(args.value);
    const page = (project as any).maps[MAP].events.find((event: any) => event.id === eventId).pages[0];
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { conditions: [...(page.conditions ?? []), { kind: 'switch', switchId, value }] } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    const other = otherEventWithText(project, eventId);
    const pageOf = (id: string) => (project as any).maps[MAP].events.find((event: any) => event.id === id).pages[0];
    const gated = (id: string, condition: any) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: id, pageIndex: 0, set: { conditions: [...(pageOf(id).conditions ?? []), condition] },
    });
    const differentSwitch = ((project as any).switches as any[]).map((entry: any) => entry.id).find(id => id !== switchId) ?? 'sw_ember_q1_clear';
    return [
      gated(other, { kind: 'switch', switchId, value: true }),
      gated(eventId, { kind: 'switch', switchId: differentSwitch, value: true }),
      gated(eventId, { kind: 'switch', switchId, value: false }),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { conditions: [...(pageOf(eventId).conditions ?? []), { kind: 'switch', switchId, value: true }], commands: commandsAt(project, eventId).slice(0, 1) },
      }),
    ];
  },
};

const removeMoveCommand: Family = {
  id: 'remove-move-command',
  area: 'events',
  mode: 'write',
  title: '이동 명령만 삭제',
  variants: [
    { key: 'villager-polite', prompt: '이 주민 이벤트에서 이동 명령만 지워 주세요.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'walker-one', prompt: '산책하는 주민의 이동 명령 빼줘.', args: { eventId: G2.walkers.a }, setup: { event: G2.walkers.a } },
    { key: 'walker-two', prompt: '짐꾼 이벤트에서 이동 명령을 전부 삭제해 줘. 대사는 그대로.', args: { eventId: G2.walkers.b }, setup: { event: G2.walkers.b } },
    { key: 'walker-first', prompt: '길 잃은 아이의 이동만 없애고 나머지는 남겨.', args: { eventId: G2.walkers.c }, setup: { event: G2.walkers.c } },
    { key: 'walker-two-explained', prompt: '짐꾼 이벤트의 페이지에서 moveEvent 명령만 제거해 주세요. 대사 두 줄과 순서는 유지하세요.', args: { eventId: G2.walkers.b, page: 0 }, setup: { event: G2.walkers.b } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      if (!was.some((command: any) => command.kind === 'moveEvent')) return fail('fixture 에 이동 명령이 없다');
      return isDeepStrictEqual(now, was.filter((command: any) => command.kind !== 'moveEvent'))
        ? pass('이동 명령만 삭제, 나머지 보존')
        : fail('이동 명령만 지워지지 않았다(다른 명령이 사라졌거나 남았다)');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: commandsAt(project, eventId).filter((command: any) => command.kind !== 'moveEvent') },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const was = commandsAt(project, eventId);
    const other = (mapOf(project).events as any[]).find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some((command: any) => command.kind === 'moveEvent'));
    const moves = was.filter((command: any) => command.kind === 'moveEvent').length;
    const noProps = was.filter((command: any) => command.kind !== 'moveEvent' && command.kind !== 'text');
    const wrongs: FamilyOutcome[] = [
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: noProps.length ? noProps : [{ kind: 'wait', ms: 60 }] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: was.filter((command: any) => command.kind !== 'text').length ? was.filter((command: any) => command.kind !== 'text') : [{ kind: 'wait', ms: 60 }] } }),
    ];
    if (other) wrongs.push(runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: other.id, pageIndex: 0,
      set: { commands: ((other.pages[0].commands ?? []) as any[]).filter((command: any) => command.kind !== 'moveEvent') },
    }));
    if (moves >= 2) {
      let removed = false;
      wrongs.push(runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: was.filter((command: any) => { if (command.kind !== 'moveEvent' || removed) return true; removed = true; return false; }) },
      }));
    }
    return wrongs;
  },
};

const insertSe: Family = {
  id: 'insert-se',
  area: 'events',
  mode: 'write',
  title: '효과음 하나 삽입(순서 보존)',
  variants: [
    { key: 'villager-polite', prompt: '이 주민 첫 대사 앞에 효과음을 하나 넣어 주세요. 기존 명령 순서는 그대로 두세요.', args: { eventId: 'ev_utility_npc', resourceId: 'cc0-se-osx-door-open', placement: 'before-first-text' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인 이벤트 끝에 종소리 효과음 하나만 끼워 넣어줘.', args: { eventId: 'ev_ember_inn', resourceId: 'cc0-se-osx-bell-01', placement: 'end' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 마지막 대사 뒤에 효과음 하나.', args: { eventId: 'ev_ember_child', resourceId: 'cc0-se-orp-interface-interface1', placement: 'after-last-text' }, setup: { event: 'ev_ember_child' } },
    { key: 'cutscene-explained', prompt: '노을 장면 이벤트의 첫 대사 뒤에 짧은 효과음을 한 번만 재생하도록 넣어 주세요. 다른 명령은 손대지 마세요.', args: { eventId: G2.cutscenes.plain, resourceId: 'cc0-se-osx-gong-01', placement: 'after-first-text' }, setup: { event: G2.cutscenes.plain } },
    { key: 'walker-metal', prompt: '산책하는 주민 이벤트에 금속 소리 효과음 한 번만 넣어 줘. 위치는 아무 데나 좋아.', args: { eventId: G2.walkers.a, resourceId: 'cc0-se-ors-metal-01', placement: 'any' }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const placement = typeof args.placement === 'string' ? args.placement : 'any';
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      const audio = added.filter((command: any) => command.kind === 'playAudio');
      if (audio.length !== 1) return fail(`추가된 효과음 명령이 ${audio.length}개다`);
      if (added.length !== 1) return fail(`효과음 말고도 명령 ${added.length - 1}개가 함께 들어갔다`);
      if (!String(audio[0].resourceId ?? '').trim()) return fail('효과음 리소스가 비었다');
      if (audio[0].channel === 'bgm' || audio[0].channel === 'bgs') return fail('효과음이 아니라 배경음 채널로 들어갔다');
      if (audio[0].loop === true) return fail('한 번 재생할 효과음이 반복 재생으로 들어갔다');
      if (!keepsInOrder(was, now)) return fail('기존 명령이 사라졌거나 순서가 바뀌었다');
      const audioAt = now.indexOf(audio[0]);
      const textIndexes = now.map((command: any, index: number) => (command.kind === 'text' ? index : -1)).filter((index: number) => index >= 0);
      const first = textIndexes[0] ?? -1;
      const last = textIndexes[textIndexes.length - 1] ?? -1;
      if (placement === 'before-first-text' && !(first >= 0 && audioAt < first)) return fail('첫 대사 앞이 아니라 다른 위치에 들어갔다');
      if (placement === 'after-first-text' && !(first >= 0 && audioAt === first + 1)) return fail('첫 대사 바로 뒤가 아니라 다른 위치에 들어갔다');
      if (placement === 'after-last-text' && !(last >= 0 && audioAt === last + 1)) return fail('마지막 대사 바로 뒤가 아니라 다른 위치에 들어갔다');
      if (placement === 'end' && audioAt !== now.length - 1) return fail('이벤트 끝이 아니라 중간에 들어갔다');
      return pass(`효과음 ${audio[0].resourceId} 하나 삽입(${placement}), 순서 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const resourceId = strArg(args, 'resourceId');
    const placement = typeof args.placement === 'string' ? args.placement : 'any';
    const commands = commandsAt(project, eventId);
    const first = commands.findIndex((command: any) => command.kind === 'text');
    const last = commands.map((command: any) => command.kind === 'text').lastIndexOf(true);
    const audio = { kind: 'playAudio', resourceId, loop: false, channel: 'se' };
    const at = placement === 'before-first-text' ? (first >= 0 ? first : 0)
      : placement === 'after-first-text' ? (first >= 0 ? first + 1 : 0)
        : placement === 'after-last-text' ? (last >= 0 ? last + 1 : commands.length)
          : placement === 'end' ? commands.length : Math.min(1, commands.length);
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: [...commands.slice(0, at), audio, ...commands.slice(at)] },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const resourceId = strArg(args, 'resourceId');
    const commands = commandsAt(project, eventId);
    const other = otherEventWithText(project, eventId);
    const audio = { kind: 'playAudio', resourceId, loop: false, channel: 'se' };
    const withAudio = (id: string, entry: any, at = 0) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: id, pageIndex: 0,
      set: { commands: [...commandsAt(project, id).slice(0, at), entry, ...commandsAt(project, id).slice(at)] },
    });
    const placement = typeof args.placement === 'string' ? args.placement : 'any';
    const first = commands.findIndex((command: any) => command.kind === 'text');
    const wrongAt = placement === 'before-first-text' ? (first >= 0 ? first + 1 : 0)
      : placement === 'after-first-text' ? (first >= 0 ? first : 0)
        : 0;
    const wrongs: FamilyOutcome[] = [
      withAudio(eventId, { ...audio, loop: true }),
      withAudio(eventId, { ...audio, channel: 'bgm', loop: true }),
      withAudio(other, audio),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: [audio, audio, ...commands] },
      }),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: [audio, ...commands.slice(1)] },
      }),
    ];
    if (placement !== 'any') wrongs.push(withAudio(eventId, audio, wrongAt));
    return wrongs;
  },
};

const touchTrigger: Family = {
  id: 'touch-trigger',
  area: 'events',
  mode: 'write',
  title: '실행 조건을 플레이어 접촉으로',
  variants: [
    { key: 'villager-polite', prompt: '이 이벤트를 플레이어가 닿으면 실행되게 바꿔 주세요.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인 접촉형으로 바꿔줘.', args: { eventId: 'ev_ember_inn' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루, 닿으면 실행.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트의 실행 조건을 플레이어 접촉으로 바꿔 주세요. 페이지의 대사·조건은 그대로 두세요.', args: { eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
    { key: 'house-door', prompt: '집 문 이벤트를 밟으면 열리게(플레이어 접촉) 바꿔 줘.', args: { eventId: 'ev_house_door' }, setup: { event: 'ev_house_door' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const isTouch = (trigger: any) => ['playerTouch', 'touch'].includes(trigger?.kind);
    return editEvent(input, eventId, (before, after) => {
      const pages = after.pages ?? [];
      if (!isTouch(pages[0]?.trigger)) return fail(`첫 페이지 트리거가 ${pages[0]?.trigger?.kind} 그대로다`);
      const changedPages = pages.filter((page: any, index: number) => !isDeepStrictEqual(page.trigger, before.pages?.[index]?.trigger));
      if (!changedPages.every((page: any) => isTouch(page.trigger))) return fail('접촉형이 아닌 트리거로 바뀐 페이지가 있다');
      if (!isDeepStrictEqual(pages[0].commands, before.pages[0].commands)) return fail('페이지 명령이 바뀌었다');
      return pass('실행 조건만 플레이어 접촉으로');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { trigger: { kind: 'playerTouch' } } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const other = otherEventWithText(project, eventId);
    const trigger = (id: string, kind: string) => runOn(project, 'patch_event_page', { mapId: MAP, eventId: id, pageIndex: 0, set: { trigger: { kind } } });
    return [
      trigger(eventId, 'auto'),
      trigger(eventId, 'eventTouch'),
      trigger(other, 'playerTouch'),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { trigger: { kind: 'playerTouch' }, commands: [{ kind: 'wait', ms: 60 }] },
      }),
    ];
  },
};

const faceRight: Family = {
  id: 'face-right',
  area: 'events',
  mode: 'write',
  title: 'NPC가 오른쪽을 바라봄',
  variants: [
    { key: 'villager-polite', prompt: '이 주민이 오른쪽을 바라보게 해 주세요.', args: { eventId: 'ev_utility_npc', direction: 'right' }, setup: { event: 'ev_utility_npc' } },
    { key: 'child-casual', prompt: '미루 오른쪽 봐.', args: { eventId: 'ev_ember_child', direction: 'right' }, setup: { event: 'ev_ember_child' } },
    { key: 'inn-explained', prompt: '여관 주인의 기본 방향만 오른쪽으로 돌려 주세요. 그림(스프라이트)은 그대로 두세요.', args: { eventId: 'ev_ember_inn', direction: 'right' }, setup: { event: 'ev_ember_inn' } },
    { key: 'guard-explained', prompt: '파수꾼이 오른쪽을 보도록 기본 방향을 바꿔 주세요. 다른 페이지·대사는 건드리지 마세요.', args: { eventId: 'ev_ember_guard', direction: 'right' }, setup: { event: 'ev_ember_guard' } },
    { key: 'shop-terse', prompt: '잡화점 주인 → 오른쪽.', args: { eventId: 'ev_test_shop', direction: 'right' }, setup: { event: 'ev_test_shop' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const direction = strArg(args, 'direction');
    return editEvent(input, eventId, (before, after) => {
      const graphic = after.pages[0]?.graphic;
      if (graphic?.direction !== direction) return fail(`방향이 ${graphic?.direction} 이다`);
      if (!isDeepStrictEqual(graphic?.sprite, before.pages[0]?.graphic?.sprite)) return fail('그림(스프라이트)이 바뀌었다');
      if (!isDeepStrictEqual(after.pages[0]?.commands, before.pages[0]?.commands)) return fail('명령이 바뀌었다');
      return pass(`방향만 ${direction}, 그림 유지`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const direction = strArg(args, 'direction');
    const graphic = (project as any).maps[MAP].events.find((event: any) => event.id === eventId).pages[0].graphic;
    return runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { graphic: { ...graphic, direction } } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const graphic = (project as any).maps[MAP].events.find((event: any) => event.id === eventId).pages[0].graphic;
    const other = otherEventWithText(project, eventId);
    const otherGraphic = (project as any).maps[MAP].events.find((event: any) => event.id === other).pages[0].graphic;
    const setGraphic = (id: string, next: any) => runOn(project, 'patch_event_page', { mapId: MAP, eventId: id, pageIndex: 0, set: { graphic: next } });
    const otherSprite = ['tex_easyrpg_charset_people1', 'tex_easyrpg_charset_people2', 'tex_easyrpg_charset_people3']
      .find(id => id !== graphic?.sprite?.id) ?? 'tex_easyrpg_charset_people1';
    return [
      setGraphic(eventId, { ...graphic, direction: 'left' }),
      setGraphic(eventId, { ...graphic, direction: 'down' }),
      setGraphic(eventId, { ...graphic, sprite: { ...(graphic?.sprite ?? { type: 'bundled' }), id: otherSprite }, direction: 'right' }),
      setGraphic(other, { ...otherGraphic, direction: 'right' }),
    ];
  },
};

const addNpcLine: Family = {
  id: 'add-npc-line',
  area: 'events',
  mode: 'write',
  title: '대사 한 줄 추가',
  variants: [
    { key: 'villager-polite', prompt: '이 주민에게 「오늘은 조심해서 다녀오세요.」 대사를 한 줄만 추가해 주세요.', args: { eventId: 'ev_utility_npc', line: '오늘은 조심해서 다녀오세요.' }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인한테 "방은 아직 하나 남았어." 한 줄 붙여줘.', args: { eventId: 'ev_ember_inn', line: '방은 아직 하나 남았어.' }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 + "나도 데려가 줘!"', args: { eventId: 'ev_ember_child', line: '나도 데려가 줘!' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트 맨 끝에 「문은 해가 지면 닫는다.」 대사를 하나만 덧붙여 주세요. 기존 대사와 순서는 그대로.', args: { eventId: 'ev_ember_guard', line: '문은 해가 지면 닫는다.' }, setup: { event: 'ev_ember_guard' } },
    { key: 'walker-short', prompt: '산책하는 주민에게 "길이 미끄러우니 조심해." 추가.', args: { eventId: G2.walkers.a, line: '길이 미끄러우니 조심해.' }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const line = strArg(args, 'line');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const added = now.filter((command: any) => !was.some((old: any) => isDeepStrictEqual(old, command)));
      if (added.length !== 1) return fail(`추가된 명령이 ${added.length}개다`);
      const command = added[0];
      if (command.kind !== 'text' || !String(command.body ?? '').trim()) return fail('추가된 명령이 대사가 아니다');
      if (!sameWords(command.body, line)) return fail(`요청한 대사가 아니다: 「${String(command.body).slice(0, 40)}」`);
      if (!keepsInOrder(was, now)) return fail('기존 명령이 사라졌거나 순서가 바뀌었다');
      return pass('대사 한 줄만 추가');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const line = strArg(args, 'line');
    const commands = commandsAt(project, eventId);
    const speaker = (commands.find((command: any) => command.kind === 'text') as any)?.speaker;
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: [...commands, { kind: 'text', ...(speaker ? { speaker } : {}), body: line }] },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const line = strArg(args, 'line');
    const commands = commandsAt(project, eventId);
    const other = otherEventWithText(project, eventId);
    const append = (id: string, extra: any[]) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: id, pageIndex: 0, set: { commands: [...commandsAt(project, id), ...extra] },
    });
    return [
      append(eventId, [{ kind: 'text', body: line }, { kind: 'text', body: `${line} (두 번째)` }]),
      append(eventId, [{ kind: 'text', body: '요청과 다른 대사.' }]),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands.slice(0, -1), { kind: 'text', body: line }] } }),
      append(other, [{ kind: 'text', body: line }]),
    ];
  },
};

const npcSchedule: Family = {
  id: 'npc-schedule',
  area: 'events',
  mode: 'write',
  title: 'NPC 하루 일정 등록',
  variants: [
    { key: 'villager-polite', prompt: '이 주민이 8시부터 18시까지 (15,3) 자리로 가 있게 하루 일정에 등록해 주세요.', args: { eventId: 'ev_utility_npc', hours: [8, 18], at: { x: 15, y: 3 } }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-casual', prompt: '여관 주인을 9시~21시에 (17,4)로 움직이게 일정 잡아줘.', args: { eventId: 'ev_ember_inn', hours: [9, 21], at: { x: 17, y: 4 } }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-terse', prompt: '미루 10시-16시 (19,5) 일정.', args: { eventId: 'ev_ember_child', hours: [10, 16], at: { x: 19, y: 5 } }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼에게 6시부터 20시까지 (16,6)에서 근무하는 시간표를 넣어 주세요. 페이지 대사는 그대로 두세요.', args: { eventId: 'ev_ember_guard', hours: [6, 20], at: { x: 16, y: 6 } }, setup: { event: 'ev_ember_guard' } },
    { key: 'walker-afternoon', prompt: '산책하는 주민을 7시부터 19시까지 (13,13)에서 보이게 해 줘.', args: { eventId: G2.walkers.a, hours: [7, 19], at: { x: 13, y: 13 } }, setup: { event: G2.walkers.a } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const at = args.at as { x: number; y: number };
    const hours = args.hours as [number, number] | undefined;
    return editEvent(input, eventId, (before, after) => {
      const schedule = (after.schedule ?? []) as any[];
      if (!schedule.length) return fail('일정이 등록되지 않았다');
      const maps = (input.after as any).maps;
      const broken = schedule.filter((entry: any) => !entry?.when || !entry?.at || !maps[entry.at.mapId]);
      if (broken.length) return fail(`일정 ${broken.length}개가 유효하지 않다(조건·목적지 맵 없음)`);
      if (!isDeepStrictEqual(after.pages, before.pages)) return fail('페이지(대사·그림·트리거)가 바뀌었다');
      const lands = schedule.filter((entry: any) => entry.at.mapId === MAP && entry.at.x === at.x && entry.at.y === at.y);
      if (!lands.length) return fail(`요청한 자리 (${at.x},${at.y}) 로 가는 일정이 없다`);
      if (hours) {
        const [start, end] = hours;
        const covers = schedule.some((entry: any) => {
          const range = entry.when?.hourRange;
          if (!Array.isArray(range) || range.length !== 2) return false;
          return Math.min(Number(range[1]), end) - Math.max(Number(range[0]), start) >= Math.min(2, end - start);
        });
        if (!covers) return fail(`요청한 시간대(${start}~${end}시)와 겹치는 일정이 없다`);
      }
      return pass(`일정 ${schedule.length}개 등록, 페이지 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const at = args.at as { x: number; y: number };
    const hours = (args.hours as [number, number]) ?? [8, 18];
    return runOn(project, 'set_npc_schedule', {
      mapId: MAP, eventId,
      schedule: [{ when: { hourRange: [hours[0], hours[1]] }, at: { mapId: MAP, x: at.x, y: at.y }, facing: 'down', activity: 'work' }],
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const at = args.at as { x: number; y: number };
    const hours = (args.hours as [number, number]) ?? [8, 18];
    const other = otherEventWithText(project, eventId);
    const schedule = (id: string, at2: { x: number; y: number }, range: [number, number]) => runOn(project, 'set_npc_schedule', {
      mapId: MAP, eventId: id, schedule: [{ when: { hourRange: range }, at: { mapId: MAP, x: at2.x, y: at2.y }, facing: 'down', activity: 'work' }],
    });
    const reference = schedule(eventId, at, hours);
    const noWhen = clone(reference) as any;
    noWhen.maps[MAP].events.find((event: any) => event.id === eventId).schedule = [{ at: { mapId: MAP, x: at.x, y: at.y } }];
    return [
      schedule(other, at, hours),
      schedule(eventId, at, [hours[1], Math.min(48, hours[1] + 2)]),
      runOn(reference, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commandsAt(reference, eventId).slice(0, 1) } }),
      noWhen,
    ];
  },
};

const screenShake: Family = {
  id: 'screen-shake',
  area: 'events',
  mode: 'write',
  title: '화면 흔들림 연출 추가',
  variants: [
    { key: 'cutscene-polite', prompt: '이 컷신에 화면 흔들림을 하나 넣어 주세요.', args: { eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'plain-casual', prompt: '노을 장면에 화면 흔들림 넣어줘. 세게.', args: { eventId: G2.cutscenes.plain, intensity: '6' }, setup: { event: G2.cutscenes.plain } },
    { key: 'two-fades-terse', prompt: '두 번 암전 장면에 흔들림 하나, 0.4초.', args: { eventId: G2.cutscenes.twoFades, durationMs: 400 }, setup: { event: G2.cutscenes.twoFades } },
    { key: 'child-explained', prompt: '미루 이벤트 마지막에 화면 흔들림 명령을 하나만 추가해 주세요. 기존 대사와 순서는 유지하세요.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'villager-short', prompt: '주민 연출에 흔들림 추가.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const same = (old: any, next: any) => isDeepStrictEqual(old, next)
        || (old?.kind === 'm2Command' && next?.kind === 'm2Command' && old.commandId === next.commandId
          && Object.entries(old.fields ?? {}).every(([key, value]) => isDeepStrictEqual(next.fields?.[key], value)));
      let at = 0;
      const added: any[] = [];
      for (const command of now) {
        if (at < was.length && same(was[at], command)) at++;
        else added.push(command);
      }
      if (at !== was.length) return fail('기존 명령이 사라졌다');
      const shakes = added.filter((command: any) => command.kind === 'm2Command' && /shake|m2-?0?48/i.test(String(command.commandId)));
      if (shakes.length !== 1) return fail(`화면 흔들림 명령이 ${shakes.length}개다`);
      if (!added.every((command: any) => command === shakes[0] || command.kind === 'wait')) return fail('요청하지 않은 명령이 함께 들어갔다');
      const fields = { ...(shakes[0].fields ?? {}), ...Object.fromEntries(Object.entries(shakes[0]).filter(([key]) => key !== 'fields')) };
      const values = Object.values(fields).map(value => String(value));
      if (args.intensity !== undefined && !values.includes(String(args.intensity))) return fail(`세기 ${args.intensity} 가 흔들림 명령에 없다`);
      if (args.durationMs !== undefined && !values.includes(String(args.durationMs))) return fail(`지속 ${args.durationMs}ms 가 흔들림 명령에 없다`);
      return pass('화면 흔들림 명령 하나 추가, 기존 순서 보존');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const fields: Record<string, unknown> = {
      ...(args.intensity !== undefined ? { intensity: String(args.intensity) } : {}),
      ...(args.durationMs !== undefined ? { durationMs: Number(args.durationMs) } : {}),
    };
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: [...commandsAt(project, eventId), { kind: 'm2Command', commandId: 'm2-048-shake-screen', fields }] },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const commands = commandsAt(project, eventId);
    const other = otherEventWithText(project, eventId);
    const shake = { kind: 'm2Command', commandId: 'm2-048-shake-screen', fields: { intensity: '3', durationMs: 300 } };
    return [
      runOn(project, 'patch_event_page', { mapId: MAP, eventId: other, pageIndex: 0, set: { commands: [...commandsAt(project, other), shake] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands, shake, shake] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands.slice(0, -1), shake] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands, shake, { kind: 'text', body: '요청에 없던 대사.' }] } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...commands, { kind: 'm2Command', commandId: 'm2-044-hide-screen', fields: {} }] } }),
    ];
  },
};

const dialoguePosition: Family = {
  id: 'dialogue-position',
  area: 'events',
  mode: 'write',
  title: '대사 표시 위치 변경',
  variants: [
    { key: 'cutscene-bottom', prompt: '이 대사의 표시 위치를 아래쪽으로 바꿔 주세요.', args: { eventId: 'ev_test_cutscene', position: 'bottom' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'child-top', prompt: '미루 첫 대사를 화면 위쪽에 띄워줘.', args: { eventId: 'ev_ember_child', position: 'top' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-center', prompt: '파수꾼 대사 위치를 가운데로.', args: { eventId: 'ev_ember_guard', position: 'center' }, setup: { event: 'ev_ember_guard' } },
    { key: 'plain-explained', prompt: '노을 장면의 대사창을 아래쪽에 고정해 주세요. 대사 본문과 화자는 그대로 두세요.', args: { eventId: G2.cutscenes.plain, position: 'bottom' }, setup: { event: G2.cutscenes.plain } },
    { key: 'inn-top', prompt: '여관 주인 대사는 위쪽에 나오게 해 줘.', args: { eventId: 'ev_ember_inn', position: 'top' }, setup: { event: 'ev_ember_inn' } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const position = strArg(args, 'position');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const strip = (list: any[]) => list.map((command: any) => (command.kind === 'text' ? { ...command, position: undefined } : command));
      const firstText = now.find((command: any) => command.kind === 'text');
      const viaText = firstText?.position === position && isDeepStrictEqual(strip(now), strip(was));
      const settings = now.filter((command: any) => command.kind === 'displayTextSettings');
      const firstTextIndex = now.findIndex((command: any) => command.kind === 'text');
      const viaSettings = settings.length === 1 && settings[0].position === position
        && now.indexOf(settings[0]) < firstTextIndex
        && isDeepStrictEqual(strip(now.filter((command: any) => command.kind !== 'displayTextSettings')), strip(was));
      return viaText || viaSettings ? pass(`대사 위치를 ${position} 으로`) : fail(`대사 위치가 ${position} 으로 바뀌지 않았거나 다른 명령이 바뀌었다`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const position = strArg(args, 'position');
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: commandsAt(project, eventId).map((command: any) => (command.kind === 'text' ? { ...command, position } : command)) },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const position = strArg(args, 'position');
    const commands = commandsAt(project, eventId);
    const other = otherEventWithText(project, eventId);
    const withPosition = (id: string, next: string) => runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: id, pageIndex: 0,
      set: { commands: commandsAt(project, id).map((command: any) => (command.kind === 'text' ? { ...command, position: next } : command)) },
    });
    const wrongPosition = position === 'top' ? 'bottom' : 'top';
    return [
      withPosition(eventId, wrongPosition),
      withPosition(other, position),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: commands.map((command: any) => (command.kind === 'text' ? { ...command, position, body: '요청과 다른 대사.' } : command)) },
      }),
      runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: [...commands, { kind: 'displayTextSettings', format: 'normal', position, preventObscuringPlayer: false, allowEventMovementDuringWait: false }] },
      }),
    ];
  },
};

const isHide = (command: any): boolean => command?.kind === 'm2Command' && /m2-044|hide-screen/i.test(String(command.commandId));
const isShow = (command: any): boolean => command?.kind === 'm2Command' && /m2-045|show-screen/i.test(String(command.commandId));
const isFade = (command: any): boolean => isHide(command) || isShow(command);

/** 페이드는 숨기기…보이기 짝이다. 사이의 wait 는 길이를 나타낸다. */
type FadeBlock = { from: number; to: number };
const fadeBlocks = (commands: any[]): FadeBlock[] => {
  const blocks: FadeBlock[] = [];
  commands.forEach((command, index) => {
    if (!isHide(command)) return;
    let to = index;
    for (let at = index + 1; at < commands.length; at++) {
      if (isShow(commands[at])) { to = at; break; }
      if (!isFade(commands[at]) && commands[at]?.kind !== 'wait') break;
    }
    blocks.push({ from: index, to });
  });
  return blocks;
};
const hidesScreen = (list: any[]): number => list.filter(isHide).length;
const showsScreen = (list: any[]): number => list.filter(isShow).length;

const removeFinalFade: Family = {
  id: 'remove-final-fade',
  area: 'events',
  mode: 'write',
  title: '마지막 페이드만 제거',
  variants: [
    { key: 'cutscene-polite', prompt: '이 컷신의 마지막 페이드만 제거해 주세요.', args: { eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'two-fades-casual', prompt: '두 번 암전 장면에서 마지막 암전만 빼줘.', args: { eventId: G2.cutscenes.twoFades }, setup: { event: G2.cutscenes.twoFades } },
    { key: 'fade-a-terse', prompt: '촛불 장면 마지막 페이드 삭제.', args: { eventId: G2.cutscenes.fadeA }, setup: { event: G2.cutscenes.fadeA } },
    { key: 'fade-b-explained', prompt: '어둠에서 시작하는 장면의 마지막 페이드만 지우고, 화면이 어두운 채 남지 않게 해 주세요.', args: { eventId: G2.cutscenes.fadeB }, setup: { event: G2.cutscenes.fadeB } },
    { key: 'fade-c-short', prompt: '끝 암전만 없애.', args: { eventId: G2.cutscenes.fadeC }, setup: { event: G2.cutscenes.fadeC } },
  ],
  prepare: prepareGroup2,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return editEvent(input, eventId, (before, after) => {
      const was = before.pages[0].commands as any[];
      const now = after.pages[0].commands as any[];
      const blocks = fadeBlocks(was);
      if (!blocks.length) return fail('fixture 에 페이드가 없다');
      const last = blocks[blocks.length - 1]!;
      // 명령 객체는 같아도 위치가 다르다(암전이 둘이면 hide 두 개가 동일) — 위치로 비교해야 어느 블록이 빠졌는지 안다.
      const outside = was.filter((_: any, index: number) => index < last.from || index > last.to);
      const outsideSolid = outside.filter((command: any) => command.kind !== 'wait');
      const nowSolid = now.filter((command: any) => command.kind !== 'wait');
      if (!isDeepStrictEqual(nowSolid, outsideSolid)) {
        const keptFade = nowSolid.filter(isFade).length;
        if (keptFade >= outsideSolid.filter(isFade).length) return fail('마지막 페이드가 그대로 남았다');
        return fail('마지막 페이드 블록 밖의 명령이 바뀌거나 사라졌다');
      }
      if (hidesScreen(now) !== showsScreen(now)) return fail('페이드의 숨기기/보이기 짝이 깨져 화면이 어두운 채 남는다');
      if (fadeBlocks(now).length !== blocks.length - 1) return fail('남은 페이드 블록 수가 맞지 않는다(마지막 하나만 지워야 한다)');
      return pass('마지막 페이드 블록만 제거, 다른 장면 보존');
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const commands = commandsAt(project, eventId);
    const last = fadeBlocks(commands).at(-1);
    if (!last) throw new Error(`${eventId} 에 페이드가 없다`);
    return runOn(project, 'patch_event_page', {
      mapId: MAP, eventId, pageIndex: 0,
      set: { commands: commands.filter((_: any, index: number) => index < last.from || index > last.to) },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const commands = commandsAt(project, eventId);
    const blocks = fadeBlocks(commands);
    const last = blocks[blocks.length - 1]!;
    const other = (mapOf(project).events as any[]).find((event: any) => event.id !== eventId
      && (event.pages?.[0]?.commands ?? []).some(isFade));
    const wrongs: FamilyOutcome[] = [
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commands.filter((_: any, index: number) => index !== last.to) } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commands.filter((_: any, index: number) => index !== 0) } }),
    ];
    if (blocks.length >= 2) {
      const first = blocks[0]!;
      wrongs.push(runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: commands.filter((_: any, index: number) => index < first.from || index > first.to) },
      }));
    } else {
      wrongs.push(runOn(project, 'patch_event_page', {
        mapId: MAP, eventId, pageIndex: 0,
        set: { commands: commands.filter((_: any, index: number) => index !== last.from) },
      }));
    }
    const eatsPreviousBeat = commands.filter((_: any, index: number) => index < last.from - 1 || index > last.to);
    if (eatsPreviousBeat.length < commands.length) {
      wrongs.push(runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: eatsPreviousBeat } }));
    }
    if (other) wrongs.push(runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: other.id, pageIndex: 0,
      set: { commands: ((other.pages[0].commands ?? []) as any[]).filter((_: any, index: number) => index < last.from || index > last.to) },
    }));
    return wrongs;
  },
};

/**
 * 「직전 상태로 되돌려」의 정답은 **`original` 과 같은 문서**다 — 그래서 이 가족은 mode read 로 둔다.
 * selfcheck 는 write 가족에 「무변경 문서도 실패해야 한다」를 요구하는데, 선행 턴이 없는 자기검사에서는
 * `before` 와 `original` 이 같은 문서라 되돌리기와 무변경을 문서로 구분할 수 없다. 실제 실행에서는
 * 선행 턴이 `before` 를 바꿔 두므로 무변경은 곧 실패다(아래 비교가 그것을 잡는다).
 */
const rewindTurn: Family = {
  id: 'rewind-turn',
  area: 'events',
  mode: 'read',
  title: '직전 상태로 되돌리기',
  variants: [
    { key: 'polite', prompt: '이 지시 직전 상태로 되돌려 주세요.', args: { steps: 1 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'casual', prompt: '방금 한 거 취소하고 되돌려줘.', args: { steps: 1 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'terse', prompt: '되돌려.', args: { steps: 1 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'explained', prompt: '직전 턴에서 바꾼 내용을 모두 취소하고, 그 전 상태 그대로로 되돌려 주세요. 다른 곳은 건드리지 마세요.', args: { steps: 1 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'undo-label', prompt: 'undo — 마지막 편집 이전으로.', args: { steps: 1 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
  ],
  judge(input) {
    return sameDoc(input.after, input.original)
      ? pass('직전 턴 이전 문서와 같다')
      : fail('직전 상태로 되돌려지지 않았다');
  },
  reference(project) {
    return clone(project);
  },
  wrongs(project, args): FamilyOutcome[] {
    const placed = runOn(project, 'place_props', { mapId: MAP, area: { x: 14, y: 2, w: 1, h: 1 }, material: '버들항 · 나무·덤불', count: 1, seed: 1 });
    const partiallyUndone = clone(placed) as any;
    partiallyUndone.maps[MAP].name = `${partiallyUndone.maps[MAP].name} (되돌림)`;
    const cleared = runOn(project, 'clear_region', { mapId: MAP, x: 14, y: 2, w: 1, h: 1, layer: 'both', fill: 'empty' });
    return [placed, partiallyUndone, cleared];
  },
};

export const GROUP_2_EVENTS: readonly Family[] = [
  changeFirstLine, addSwitchCondition, removeMoveCommand, insertSe, touchTrigger, faceRight,
  addNpcLine, npcSchedule, screenShake, dialoguePosition, removeFinalFade, rewindTurn,
];
