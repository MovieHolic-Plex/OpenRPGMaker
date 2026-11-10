import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, fail, mapOf, pass, runOn, sameExcept } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import { eventEditOn, eventOn } from './group-4-shared';
import { attempt, commandsOfKind, deepCommands, distinct, newEventsOn, withoutFlags } from './group-6b-shared';

const PLAZA = 'map_plaza';
const FIELD = 'map_field';
const WORLD = 'map_world';

type Cond = { kind: 'switch' | 'item' | 'timePhase'; id: string };

/** The page condition list holds the wanted condition (switch on / item carried / time phase). */
function hasCondition(conditions: any[] | undefined, want: Cond): boolean {
  return (conditions ?? []).some((condition: any) => {
    if (want.kind === 'switch') return condition.kind === 'switch' && condition.switchId === want.id && condition.value !== false;
    if (want.kind === 'item') return condition.kind === 'item' && condition.itemId === want.id && condition.present !== false;
    return condition.kind === 'timePhase' && condition.phase === want.id;
  });
}
const hasTransfer = (page: any) => (page.commands ?? []).some((command: any) => command.kind === 'transfer');
const unlockArg = (cond: Cond) => (cond.kind === 'switch' ? { switchId: cond.id } : cond.kind === 'item' ? { itemId: cond.id } : { timePhase: cond.id });

// ── lock-door-story ────────────────────────────────────────────────────────

const lockDoorStory: Family = {
  id: 'lock-door-story',
  area: 'gate',
  mode: 'write',
  title: '이야기 조건이 참일 때까지 기존 문 잠그기',
  variants: [
    { key: 'gate-switch', prompt: '마을 문은 「성문 개방」 스위치가 켜지기 전에는 잠겨 있어서 못 지나가게 해줘. 잠겨 있을 땐 「문이 굳게 잠겨 있다.」라고 뜨게.', args: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8, cond: { kind: 'switch', id: 'sw_catalog_gate_open' }, lockedText: '문이 굳게 잠겨 있다.' }, setup: { event: 'ev_test_door' } },
    { key: 'door-key-polite', prompt: '마을 문을 낡은 열쇠를 가지고 있어야만 열리도록 잠가 주세요. 안내 문구는 알아서 적당히 넣어 주세요.', args: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8, cond: { kind: 'item', id: 'item_old_key' } }, setup: { event: 'ev_test_door' } },
    { key: 'plaza-back-archive', prompt: '광장에서 마을로 돌아가는 문은 서고 봉인 해제 스위치가 켜질 때까지 닫아 둬.', args: { mapId: PLAZA, eventId: 'ev_plaza_back', x: 1, y: 2, cond: { kind: 'switch', id: 'sw_catalog_archive_unlock' } } },
    { key: 'south-night-terse', prompt: '남쪽 출입구 밤에만 열리게 잠그기.', args: { mapId: MAP, eventId: 'ev_south_gate', x: 12, y: 17, cond: { kind: 'timePhase', id: 'night' } } },
    { key: 'lighthouse-explained', prompt: '등대에 불을 붙이기(「등대 점화」 스위치) 전에는 마을 문이 안 열리도록 해 줘. 막혔을 때 「등대가 꺼져 있어 지날 수 없다.」 라고 말하고, 문 이동 자체는 그대로 두고.', args: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8, cond: { kind: 'switch', id: 'sw_catalog_lighthouse_lit' }, lockedText: '등대가 꺼져 있어 지날 수 없다.' }, setup: { event: 'ev_test_door' } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId'), eventId = strArg(args, 'eventId');
    const cond = args.cond as Cond;
    return eventEditOn(input, mapId, eventId, (before, after) => {
      const pages: any[] = after.pages ?? [];
      const open = pages.filter(hasTransfer);
      if (!open.length) return fail(eventId + ': 이동 명령이 사라졌다');
      const unguarded = open.filter(page => !hasCondition(page.conditions, cond));
      if (unguarded.length) return fail(eventId + ': 조건(' + cond.kind + ' ' + cond.id + ') 없이 열리는 이동 페이지가 있다');
      const oldTransfers = deepCommands(before).filter(command => command.kind === 'transfer');
      const newTransfers = deepCommands(after).filter(command => command.kind === 'transfer');
      if (!oldTransfers.every(old => newTransfers.some(now => now.mapId === old.mapId && now.x === old.x && now.y === old.y))) return fail(eventId + ': 이동 목적지가 바뀌었다');
      const firstOpen = pages.findIndex(hasTransfer);
      const locked = pages.slice(0, firstOpen).filter(page => !hasTransfer(page) && !(page.conditions ?? []).length);
      if (!locked.length) return fail(eventId + ': 조건이 안 맞을 때 쓰이는 잠김 페이지(조건 없음·이동 없음·열림 페이지보다 앞)가 없다');
      const talk = locked.flatMap(page => commandsOfKind({ pages: [page] }, 'text')).map(command => String(command.body ?? ''));
      if (!talk.length) return fail(eventId + ': 잠겼을 때 안내 대사가 없다');
      if (typeof args.lockedText === 'string' && !talk.some(body => body.includes(String(args.lockedText)))) return fail(eventId + ': 안내 문구가 「' + args.lockedText + '」 를 포함하지 않는다');
      return pass(eventId + ': ' + cond.kind + ' ' + cond.id + ' 일 때만 이동, 아니면 잠김');
    }, { unseal: eventId === 'ev_south_gate', blank: withoutFlags });
  },
  reference(project, args) {
    const cond = args.cond as Cond;
    return runOn(project, 'lock_door', {
      mapId: strArg(args, 'mapId'), x: numArg(args, 'x'), y: numArg(args, 'y'), unlockWhen: unlockArg(cond),
      lockedText: typeof args.lockedText === 'string' ? args.lockedText : '문이 잠겨 있다.',
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const cond = args.cond as Cond;
    const mapId = strArg(args, 'mapId'), eventId = strArg(args, 'eventId');
    const reference = lockDoorStory.reference!(clone(project), args) as Project;
    const text = typeof args.lockedText === 'string' ? args.lockedText : '문이 잠겨 있다.';
    const lock = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'lock_door', { mapId, x: numArg(args, 'x'), y: numArg(args, 'y'), unlockWhen: unlockArg(cond), lockedText: text, ...patch }));
    const other: Cond = cond.kind === 'switch' && cond.id === 'sw_catalog_lighthouse_lit' ? { kind: 'switch', id: 'sw_catalog_gate_open' } : cond.kind === 'switch' ? { kind: 'switch', id: 'sw_catalog_lighthouse_lit' } : { kind: 'switch', id: 'sw_catalog_gate_open' };
    const door = eventOn(project, mapId, eventId);
    return distinct(reference, [
      lock({ unlockWhen: unlockArg(other) }),
      // 같은 맵의 다른 문을 잠근 오답(광장에는 문이 하나뿐이라 마을 문 변형에서만)
      mapId === MAP ? attempt(() => runOn(clone(project), 'lock_door', { mapId, x: eventId === 'ev_test_door' ? 12 : 20, y: eventId === 'ev_test_door' ? 17 : 8, unlockWhen: unlockArg(cond), lockedText: text })) : undefined,
      // 안내문만 붙이고 이동은 무조건 열려 있는 부분 수행
      attempt(() => {
        const next = clone(project);
        const event = eventOn(next, mapId, eventId);
        event.pages[0].commands = [{ kind: 'text', body: text }, ...event.pages[0].commands];
        return next;
      }),
      // 이동 자체를 없애 버린 오답
      attempt(() => {
        const next = clone(project);
        const event = eventOn(next, mapId, eventId);
        event.pages = [{ ...clone(door.pages[0]), commands: [{ kind: 'text', body: text }] }];
        return next;
      }),
    ]);
  },
};

// ── badge-gate ─────────────────────────────────────────────────────────────

const badgeGate: Family = {
  id: 'badge-gate',
  area: 'gate',
  mode: 'write',
  title: '배지 N개 이상이어야 지나가는 문지기',
  variants: [
    { key: 'three-badges', prompt: '(14,12) 칸에 배지가 3개 이상 있어야 지나갈 수 있는 문지기를 세워줘.', args: { cells: [{ x: 14, y: 12 }], badges: 3 } },
    { key: 'five-named-polite', prompt: '(18,5) 칸에 「관문지기」라는 이름으로, 배지를 5개 모아야 통과시켜 주는 문지기를 놓아 주세요.', args: { cells: [{ x: 18, y: 5 }], badges: 5, name: '관문지기' } },
    { key: 'eight-terse', prompt: '(10,15) 배지 8개 문지기.', args: { cells: [{ x: 10, y: 15 }], badges: 8 } },
    { key: 'wide-three-cells', prompt: '(15,5), (16,5), (17,5) 세 칸을 가로로 막아서, 배지 4개 이상 가진 사람만 지나가게 문지기를 나란히 세워 줘. 옆으로 돌아가면 안 돼.', args: { cells: [{ x: 15, y: 5 }, { x: 16, y: 5 }, { x: 17, y: 5 }], badges: 4 } },
    { key: 'two-badges-line', prompt: '(12,14)에 「챔피언 로드 문지기」를 세우고, 배지가 2개가 안 되면 「아직 멀었다.」라고 말하게 해줘. 배지가 2개 이상이면 지나가게 하고.', args: { cells: [{ x: 12, y: 14 }], badges: 2, name: '챔피언 로드 문지기', lockedText: '아직 멀었다.' } },
  ],
  judge(input, args) {
    const cells = args.cells as Array<{ x: number; y: number }>;
    const badges = numArg(args, 'badges');
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== cells.length) return fail('새 이벤트가 ' + fresh.length + '개 — 문지기 ' + cells.length + '칸이어야 한다');
    for (const cell of cells) {
      const keeper = fresh.find(event => event.x === cell.x && event.y === cell.y);
      if (!keeper) return fail('(' + cell.x + ',' + cell.y + ') 에 문지기가 없다');
      const pages: any[] = keeper.pages ?? [];
      const gated = pages.filter(page => (page.conditions ?? []).some((condition: any) => condition.kind === 'badgeCount' && ((condition.op === '>=' && condition.value === badges) || (condition.op === '>' && condition.value === badges - 1))));
      if (!gated.length) return fail('(' + cell.x + ',' + cell.y + '): 배지 ' + badges + '개 이상 조건 페이지가 없다');
      const blocker = pages.find(page => !(page.conditions ?? []).length && (page.commands ?? []).length > 0);
      if (!blocker) return fail('(' + cell.x + ',' + cell.y + '): 배지가 모자랄 때의 막는 페이지(조건 없음·대사)가 없다');
      if (blocker.overlapForbidden === false && blocker.priority === 'below') return fail('(' + cell.x + ',' + cell.y + '): 막는 페이지가 통과 가능하다');
      const talk = commandsOfKind({ pages: [blocker] }, 'text').map(command => String(command.body ?? ''));
      if (typeof args.lockedText === 'string' && !talk.some(body => body.includes(String(args.lockedText)))) return fail('막는 대사가 「' + args.lockedText + '」 를 포함하지 않는다');
      if (typeof args.name === 'string' && !String(keeper.name ?? '').startsWith(String(args.name))) return fail('이름이 「' + keeper.name + '」 — 「' + args.name + '」 여야 한다');
    }
    const ids = fresh.map(event => event.id);
    const blank = (doc: any) => { for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id)); withoutFlags(doc); };
    return sameExcept(input.before, input.after, blank) ? pass('배지 ' + badges + '개 문지기 ' + cells.length + '칸') : fail('문지기 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const cells = args.cells as Array<{ x: number; y: number }>;
    const call: Record<string, unknown> = { mapId: MAP, x: cells[0]!.x, y: cells[0]!.y, badges: args.badges };
    if (cells.length > 1) call.cells = cells.slice(1);
    if (typeof args.name === 'string') call.name = args.name;
    if (typeof args.lockedText === 'string') call.lockedLine = args.lockedText;
    return runOn(project, 'place_badge_gate', call);
  },
  wrongs(project, args): FamilyOutcome[] {
    const cells = args.cells as Array<{ x: number; y: number }>;
    const badges = numArg(args, 'badges');
    const reference = badgeGate.reference!(clone(project), args) as Project;
    const base: Record<string, unknown> = { mapId: MAP, x: cells[0]!.x, y: cells[0]!.y, badges };
    if (typeof args.name === 'string') base.name = args.name;
    if (typeof args.lockedText === 'string') base.lockedLine = args.lockedText;
    const place = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'place_badge_gate', { ...base, ...patch }));
    return distinct(reference, [
      place({ badges: badges + 1 }),
      place({ badges: Math.max(1, badges - 1) }),
      place({ x: cells[0]!.x + 2 <= 21 ? cells[0]!.x + 2 : cells[0]!.x - 2, y: cells[0]!.y === 14 ? 16 : cells[0]!.y }),
      cells.length > 1 ? place({}) : undefined,
      typeof args.lockedText === 'string' ? place({ lockedLine: '지나가라.' }) : undefined,
      typeof args.name === 'string' ? place({ name: '문지기' }) : undefined,
    ]);
  },
};

// ── time-gate ──────────────────────────────────────────────────────────────

type End = { mapId: string; x: number; y: number };

const timeGate: Family = {
  id: 'time-gate',
  area: 'gate',
  mode: 'write',
  title: '두 지점을 잇는 시간의 문(왕복·선택 잠금)',
  variants: [
    { key: 'village-plaza', prompt: '잿불 마을 (16,4) 와 광장 (8,5) 를 잇는 시간의 문을 만들어줘. 양쪽에서 들어가면 반대편으로 가게.', args: { a: { mapId: MAP, x: 16, y: 4 }, b: { mapId: PLAZA, x: 8, y: 5 } } },
    { key: 'village-field-locked-polite', prompt: '마을 (17,3) 과 숲길 (6,6) 사이에 시간의 문을 놓아 주세요. 「성문 개방」 스위치가 켜져야 열리고, 닫혀 있을 땐 「시간이 아직 흐르지 않는다.」라고 나오게요.', args: { a: { mapId: MAP, x: 17, y: 3 }, b: { mapId: FIELD, x: 6, y: 6 }, cond: { kind: 'switch', id: 'sw_catalog_gate_open' }, lockedText: '시간이 아직 흐르지 않는다.' } },
    { key: 'village-world-terse', prompt: '시간의 문: 마을(15,6) ↔ 월드맵(5,5).', args: { a: { mapId: MAP, x: 15, y: 6 }, b: { mapId: WORLD, x: 5, y: 5 } } },
    { key: 'plaza-field-night', prompt: '광장 (4,10) 과 숲길 (20,3) 을 잇는 시간의 문인데, 밤에만 열리게 해줘.', args: { a: { mapId: PLAZA, x: 4, y: 10 }, b: { mapId: FIELD, x: 20, y: 3 }, cond: { kind: 'timePhase', id: 'night' } } },
    { key: 'plaza-village-lighthouse', prompt: '광장 (10,12) 의 시간의 문이 마을 (19,14) 로 이어지게 해 줘. 등대 점화 스위치가 켜지기 전엔 막히고 「등대가 꺼져 있다.」라고 나오게. 기존 이벤트는 건드리지 말고.', args: { a: { mapId: PLAZA, x: 10, y: 12 }, b: { mapId: MAP, x: 19, y: 14 }, cond: { kind: 'switch', id: 'sw_catalog_lighthouse_lit' }, lockedText: '등대가 꺼져 있다.' } },
  ],
  judge(input, args) {
    const a = args.a as End, b = args.b as End;
    const cond = args.cond as Cond | undefined;
    const gateAt = (end: End, other: End): string | undefined => {
      const candidates = newEventsOn(input.before, input.after, end.mapId).filter(event => deepCommands(event).some(command => command.kind === 'transfer'));
      const here = candidates.find(event => event.x === end.x && event.y === end.y);
      if (!here) return '(' + end.mapId + ' ' + end.x + ',' + end.y + ') 에 이동 문이 없다';
      const pages: any[] = here.pages ?? [];
      const moves = pages.filter(hasTransfer);
      const targets = moves.flatMap(page => (page.commands ?? []).filter((command: any) => command.kind === 'transfer'));
      if (!targets.length || targets.some((command: any) => command.mapId !== other.mapId)) return end.mapId + ' 문의 목적지 맵이 ' + other.mapId + ' 가 아니다';
      if (!targets.every((command: any) => Math.abs(command.x - other.x) + Math.abs(command.y - other.y) <= 2)) return end.mapId + ' 문의 착지가 ' + other.mapId + ' (' + other.x + ',' + other.y + ') 곁이 아니다: ' + JSON.stringify(targets.map((command: any) => [command.x, command.y]));
      if (cond) {
        if (moves.some(page => !hasCondition(page.conditions, cond))) return end.mapId + ' 문에 조건 없이 열리는 이동 페이지가 있다';
        const firstMove = pages.findIndex(hasTransfer);
        const locked = pages.slice(0, firstMove).filter(page => !hasTransfer(page) && !(page.conditions ?? []).length);
        if (!locked.length) return end.mapId + ' 문에 잠겼을 때의 안내 페이지가 없다';
        if (typeof args.lockedText === 'string' && !locked.some(page => commandsOfKind({ pages: [page] }, 'text').some(command => String(command.body ?? '').includes(String(args.lockedText))))) return end.mapId + ' 문의 안내 문구가 「' + args.lockedText + '」 를 포함하지 않는다';
      } else if (moves.some(page => (page.conditions ?? []).length)) return end.mapId + ' 문에 요청하지 않은 조건이 붙었다';
      return undefined;
    };
    const problem = gateAt(a, b) ?? gateAt(b, a);
    if (problem) return fail(problem);
    const blank = (doc: any) => {
      for (const id of new Set([a.mapId, b.mapId])) {
        const known = new Set((mapOf(input.before, id)?.events ?? []).map((event: any) => event.id));
        doc.maps[id].events = (doc.maps[id].events ?? []).filter((event: any) => known.has(event.id));
      }
      withoutFlags(doc);
    };
    return sameExcept(input.before, input.after, blank) ? pass('시간의 문 ' + a.mapId + ' ↔ ' + b.mapId) : fail('새 문 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const call: Record<string, unknown> = { a: args.a, b: args.b };
    if (args.cond) { call.unlockWhen = unlockArg(args.cond as Cond); call.lockedMessage = typeof args.lockedText === 'string' ? args.lockedText : '문이 닫혀 있다.'; }
    return runOn(project, 'create_time_gate', call);
  },
  wrongs(project, args): FamilyOutcome[] {
    const a = args.a as End, b = args.b as End;
    const cond = args.cond as Cond | undefined;
    const reference = timeGate.reference!(clone(project), args) as Project;
    const call = (patch: Record<string, unknown>) => attempt(() => {
      const base: Record<string, unknown> = { a, b };
      if (cond) { base.unlockWhen = unlockArg(cond); base.lockedMessage = typeof args.lockedText === 'string' ? args.lockedText : '문이 닫혀 있다.'; }
      return runOn(clone(project), 'create_time_gate', { ...base, ...patch });
    });
    const third = [MAP, PLAZA, FIELD, WORLD].find(id => id !== a.mapId && id !== b.mapId)!;
    return distinct(reference, [
      call({ b: { ...b, mapId: third } }),
      call({ a: { ...a, x: a.x + 2 } }),
      call({ b: { ...b, y: b.y === 18 ? 16 : b.y + 3 } }),
      cond ? attempt(() => runOn(clone(project), 'create_time_gate', { a, b })) : call({ unlockWhen: { switchId: 'sw_catalog_gate_open' }, lockedMessage: '닫혀 있다.' }),
      // 문 한 쪽만 있는 오답: 반대편 문을 지운 문서
      attempt(() => {
        const next = call({}) as Project;
        const known = new Set(mapOf(project, b.mapId).events.map((event: any) => event.id));
        mapOf(next, b.mapId).events = mapOf(next, b.mapId).events.filter((event: any) => known.has(event.id));
        return next;
      }),
    ]);
  },
};

// ── trap-place ─────────────────────────────────────────────────────────────

const trapPlace: Family = {
  id: 'trap-place',
  area: 'gate',
  mode: 'write',
  title: '즉사 함정 배치(칸·발동 방식·체크포인트)',
  variants: [
    { key: 'one-touch-message', prompt: '(15,5) 칸을 밟으면 「바닥이 꺼졌다.」라고 뜨면서 죽는 함정을 놓아줘.', args: { cells: [{ x: 15, y: 5 }], trigger: 'touch', message: '바닥이 꺼졌다.' } },
    { key: 'three-poison-polite', prompt: '(15,5), (16,5), (17,5) 세 칸에 독침 함정을 깔아 주세요. 밟으면 「독침이 날아왔다!」라고 나오고 죽게요.', args: { cells: [{ x: 15, y: 5 }, { x: 16, y: 5 }, { x: 17, y: 5 }], trigger: 'touch', message: '독침이 날아왔다!' } },
    { key: 'terse-touch', prompt: '(9,12)에 즉사 함정.', args: { cells: [{ x: 9, y: 12 }], trigger: 'touch' } },
    { key: 'action-chest-trap', prompt: '(19,10) 칸을 조사하면(밟는 게 아니라 조사하면) 죽는 함정으로 해 줘. 「미끼 상자였다!」라고 뜨게.', args: { cells: [{ x: 19, y: 10 }], trigger: 'action', message: '미끼 상자였다!' } },
    { key: 'checkpoint-explained', prompt: '(11,13) 칸을 밟으면 죽는 함정을 놓고, 죽으면 맵 처음 자리에서 다시 시작하도록 체크포인트도 같이 만들어 줘. 다른 이벤트는 그대로 두고.', args: { cells: [{ x: 11, y: 13 }], trigger: 'touch', checkpoint: true } },
  ],
  judge(input, args) {
    const cells = args.cells as Array<{ x: number; y: number }>;
    const trigger = strArg(args, 'trigger');
    const fresh = newEventsOn(input.before, input.after);
    const kills = fresh.filter(event => commandsOfKind(event, 'killPlayer').length > 0);
    const saves = fresh.filter(event => commandsOfKind(event, 'checkpointSave').length > 0);
    if (kills.length !== cells.length) return fail('즉사 함정 이벤트가 ' + kills.length + '개 — ' + cells.length + '개여야 한다');
    for (const cell of cells) {
      const trap = kills.find(event => event.x === cell.x && event.y === cell.y);
      if (!trap) return fail('(' + cell.x + ',' + cell.y + ') 에 함정이 없다');
      const kinds = [trap.trigger?.kind, ...(trap.pages ?? []).map((page: any) => page.trigger?.kind)].filter(Boolean);
      if (!kinds.includes(trigger)) return fail('(' + cell.x + ',' + cell.y + ') 함정의 발동이 ' + kinds.join(',') + ' — ' + trigger + ' 여야 한다');
      if (typeof args.message === 'string' && !commandsOfKind(trap, 'killPlayer').some(command => String(command.message ?? '').includes(String(args.message)))) return fail('즉사 메시지가 「' + args.message + '」 가 아니다');
    }
    if (args.checkpoint === true && !saves.length) return fail('체크포인트(checkpointSave) 이벤트가 없다');
    if (args.checkpoint !== true && saves.length) return fail('요청하지 않은 체크포인트가 만들어졌다');
    const ids = fresh.map(event => event.id);
    const stray = fresh.filter(event => !kills.includes(event) && !saves.includes(event));
    if (stray.length) return fail('함정·체크포인트가 아닌 새 이벤트가 있다: ' + stray.map(event => event.id).join(','));
    const blank = (doc: any) => { for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id)); withoutFlags(doc); };
    return sameExcept(input.before, input.after, blank) ? pass('함정 ' + cells.length + '칸(' + trigger + ')') : fail('함정 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const cells = args.cells as Array<{ x: number; y: number }>;
    return runOn(project, 'place_trap', { mapId: MAP, cells, trigger: args.trigger, ...(typeof args.message === 'string' ? { message: args.message } : {}), ...(args.checkpoint === true ? { respawnCheckpoint: true } : {}) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const cells = args.cells as Array<{ x: number; y: number }>;
    const trigger = strArg(args, 'trigger');
    const reference = trapPlace.reference!(clone(project), args) as Project;
    const trap = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'place_trap', { mapId: MAP, cells, trigger, ...(typeof args.message === 'string' ? { message: args.message } : {}), ...(args.checkpoint === true ? { respawnCheckpoint: true } : {}), ...patch }));
    return distinct(reference, [
      trap({ trigger: trigger === 'touch' ? 'action' : 'touch' }),
      trap({ cells: cells.map(cell => ({ x: cell.x + 3, y: cell.y + 1 })) }),
      cells.length > 1 ? trap({ cells: cells.slice(0, 1) }) : undefined,
      args.checkpoint === true ? trap({ respawnCheckpoint: false }) : trap({ respawnCheckpoint: true }),
      typeof args.message === 'string' ? trap({ message: '쿵.' }) : undefined,
    ]);
  },
};

export const GROUP_6B_GATE: readonly Family[] = [lockDoorStory, badgeGate, timeGate, trapPlace];
