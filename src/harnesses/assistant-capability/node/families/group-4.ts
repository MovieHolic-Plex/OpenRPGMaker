import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  MAP, changedCells, clone, eventEdit, eventOf, fail, mapOf, pass, runOn, sameExcept, withoutEvent,
} from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import type { JudgeInput, Verdict } from '../matrixNativeSpec';
import {
  DOOR, HAMLET, HOUSE, SOUTH, WORLD, attempt, distinct, eventEditOn, eventOn, facingAway, gatesTo, gateUnsealCells, newEventOn, pageWithTransfer,
  transfersOfEvent, walkableIn, withHamlet,
} from './group-4-shared';
import { GROUP_4_TRANSFER } from './group-4-transfer';
import { GROUP_4_BATTLE_READ } from './group-4-battle';

const ARENA = 'ev_arena_keeper';

const EVENT_FIELDS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits'] as const;

function changedCellsOn(before: Project, after: Project, mapId: string): Array<{ x: number; y: number }> {
  const a = mapOf(before, mapId), b = mapOf(after, mapId);
  if (!a || !b) return [];
  if (a.width !== b.width || a.height !== b.height) return [{ x: -1, y: -1 }];
  const cells = new Set<number>();
  for (const key of EVENT_FIELDS) {
    const left: number[] = a[key] ?? [], right: number[] = b[key] ?? [];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if ((left[i] ?? (key === 'shadowBits' ? 0 : -1)) !== (right[i] ?? (key === 'shadowBits' ? 0 : -1))) cells.add(i);
    }
  }
  return [...cells].map(i => ({ x: i % a.width, y: Math.floor(i / a.width) }));
}

function arenaKeeper(): any {
  return {
    id: ARENA, name: '투기장 문지기', x: 14, y: 12, trigger: { kind: 'action' },
    pages: [{
      id: `${ARENA}_page`, name: '투기장 문지기', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
      priority: 'same', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: [
        { kind: 'text', speaker: '문지기', body: '검을 들어라.' },
        { kind: 'battleProcessing', troopId: 'troop_slime', canEscape: true, canLose: false },
      ],
    }],
  };
}

function withArena(project: Project): Project {
  return runOn(project, 'upsert_event', { mapId: MAP, event: arenaKeeper() });
}

const moveDoor: Family = {
  id: 'move-door',
  area: 'events',
  mode: 'write',
  title: '문·기물 이벤트 이동(페이지 보존)',
  variants: [
    { key: 'house-left', prompt: '이 집의 문을 한 칸 왼쪽으로 옮겨줘.', args: { eventId: HOUSE, dx: -1, dy: 0 }, setup: { event: HOUSE } },
    { key: 'village-door-polite', prompt: '마을 문을 한 칸 왼쪽으로 옮겨 주세요. 전이 목적지는 그대로 두세요.', args: { eventId: DOOR, dx: -1, dy: 0 }, setup: { event: DOOR } },
    { key: 'crate-right', prompt: '상자를 한 칸 오른쪽으로.', args: { eventId: 'ev_crate', dx: 1, dy: 0 }, setup: { event: 'ev_crate' } },
    { key: 'far-barrel-down', prompt: '먼 통을 한 칸 아래로 옮겨 주세요. 다른 기물은 건드리지 마세요.', args: { eventId: 'ev_barrel_far', dx: 0, dy: 1 }, setup: { event: 'ev_barrel_far' } },
    { key: 'arena-keeper-explained', prompt: '투기장 문지기를 한 칸 왼쪽으로 옮겨 주세요. 페이지와 전투 명령은 그대로 두세요.', args: { eventId: ARENA, dx: -1, dy: 0 }, setup: { event: ARENA } },
  ],
  prepare: withArena,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const dx = numArg(args, 'dx'), dy = numArg(args, 'dy');
    return eventEdit(input, eventId, (before, after) => {
      if (after.x !== before.x + dx || after.y !== before.y + dy) {
        return fail(`${eventId}: (${after.x},${after.y}) — (${before.x + dx},${before.y + dy}) 여야 한다`);
      }
      const strip = (event: any) => { const copy = clone(event); delete copy.x; delete copy.y; return copy; };
      if (!isDeepStrictEqual(strip(after), strip(before))) return fail(`${eventId}: 위치 밖의 내용(페이지·트리거·이름)이 바뀌었다`);
      return pass(`${eventId} 를 (${before.x},${before.y}) → (${after.x},${after.y}) 로 이동, 페이지 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const target = eventOf(project, eventId);
    if (!target) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    return runOn(project, 'move_event', { mapId: MAP, eventId, x: target.x + numArg(args, 'dx'), y: target.y + numArg(args, 'dy') });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const dx = numArg(args, 'dx'), dy = numArg(args, 'dy');
    const target = eventOf(project, eventId);
    const reference = moveDoor.reference!(clone(project), args) as Project;
    const other = (mapOf(project).events as any[]).find(event => event.id !== eventId);
    const moved = attempt(() => runOn(clone(project), 'move_event', { mapId: MAP, eventId, x: target.x + dx, y: target.y + dy }));
    return distinct(reference, [
      attempt(() => runOn(clone(project), 'move_event', { mapId: MAP, eventId, x: target.x - dx, y: target.y - dy })),
      attempt(() => runOn(clone(project), 'move_event', { mapId: MAP, eventId, x: target.x + dy, y: target.y + dx })),
      moved && attempt(() => runOn(moved, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [{ kind: 'text', body: '옮겨진 기물.' }] } })),
      attempt(() => runOn(clone(project), 'move_event', { mapId: MAP, eventId: other.id, x: other.x + dx, y: other.y + dy })),
    ]);
  },
};

const removeBarrels: Family = {
  id: 'remove-barrels',
  area: 'events',
  mode: 'write',
  title: '영역 안 통만 제거(상자·먼 통 보존)',
  variants: [
    { key: 'all-in-area', prompt: '이 지역의 통을 모두 제거해줘.', args: { removeIds: ['ev_barrel_a', 'ev_barrel_b'], keepIds: ['ev_crate', 'ev_barrel_far'] }, setup: { select: { x: 2, y: 11, w: 5, h: 4 } } },
    { key: 'polite-two', prompt: '선택한 구역의 통 두 개를 없애 주세요. 상자는 그대로 두세요.', args: { removeIds: ['ev_barrel_a', 'ev_barrel_b'], keepIds: ['ev_crate', 'ev_barrel_far'] }, setup: { select: { x: 2, y: 11, w: 5, h: 4 } } },
    { key: 'terse-one', prompt: '(4,13) 통만 치워.', args: { removeIds: ['ev_barrel_b'], keepIds: ['ev_barrel_a', 'ev_crate', 'ev_barrel_far'] }, setup: { select: { x: 4, y: 13, w: 1, h: 1 } } },
    { key: 'explained-scope', prompt: '선택 영역 안의 통만 지우고, 영역 밖 통과 상자는 남겨 주세요.', args: { removeIds: ['ev_barrel_a', 'ev_barrel_b'], keepIds: ['ev_crate', 'ev_barrel_far'] }, setup: { select: { x: 2, y: 11, w: 5, h: 4 } } },
    { key: 'crate-safe', prompt: '창고 앞 통을 정리해줘. 상자까지 없애면 안 돼.', args: { removeIds: ['ev_barrel_a', 'ev_barrel_b'], keepIds: ['ev_crate', 'ev_barrel_far'] }, setup: { select: { x: 2, y: 11, w: 5, h: 4 } } },
  ],
  judge(input, args) {
    const removeIds = args.removeIds as string[];
    const keepIds = args.keepIds as string[];
    const cells = changedCells(input.before, input.after);
    if (cells.length) return fail(`타일 ${cells.length}칸이 바뀌었다(통만 지우라는 요청)`);
    const left = removeIds.filter(id => eventOf(input.after, id));
    if (left.length) return fail(`지워야 할 통이 남았다: ${left.join(', ')}`);
    for (const id of keepIds) {
      if (!eventOf(input.after, id)) return fail(`${id} 까지 제거했다(남겨야 하는 기물)`);
      if (!isDeepStrictEqual(eventOf(input.after, id), eventOf(input.before, id))) return fail(`${id} 의 내용이 바뀌었다`);
    }
    return sameExcept(input.before, input.after, withoutEvent(...removeIds))
      ? pass(`통 ${removeIds.length}개만 제거, 상자·먼 통·타일 보존`)
      : fail('통 밖의 내용(다른 이벤트·맵)이 바뀌었다');
  },
  reference(project, args) {
    let next = project;
    for (const id of args.removeIds as string[]) next = runOn(next, 'remove_event', { mapId: MAP, eventId: id });
    return next;
  },
  wrongs(project, args): FamilyOutcome[] {
    const removeIds = args.removeIds as string[];
    const keepIds = args.keepIds as string[];
    const reference = removeBarrels.reference!(clone(project), args) as Project;
    const remove = (ids: string[]) => attempt(() => ids.reduce((acc, id) => runOn(acc, 'remove_event', { mapId: MAP, eventId: id }), clone(project)));
    const kept = remove(removeIds);
    return distinct(reference, [
      remove([...new Set([...removeIds, keepIds[0]!])]),
      remove([...new Set([...removeIds, keepIds[keepIds.length - 1]!])]),
      removeIds.length > 1 ? remove(removeIds.slice(0, removeIds.length - 1)) : remove([]),
      kept && attempt(() => runOn(kept, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: 534, cells: [{ x: 3, y: 12 }] })),
    ]);
  },
};

const SE_DOOR = 'cc0-se-osx-door-open';
const SE_CLOSE = 'cc0-se-osx-door-close-01';

function judgeDoorSe(input: JudgeInput, args: Record<string, unknown>, target: { mapId: string; eventId: string }): Verdict {
  const { mapId, eventId } = target;
  const allowWait = args.allowWait === true;
  return eventEditOn(input, mapId, eventId, (before, after) => {
    const pageIndex = pageWithTransfer(before);
    if (pageIndex < 0) return fail(`fixture 의 ${eventId} 에 전이 명령이 없다`);
    const was: any[] = before.pages[pageIndex].commands ?? [];
    const now: any[] = after.pages?.[pageIndex]?.commands ?? [];
    const audio = now.findIndex((command: any) => command.kind === 'playAudio');
    const transfer = now.findIndex((command: any) => command.kind === 'transfer');
    if (audio < 0) return fail(`${eventId}: 효과음(playAudio) 명령이 없다`);
    if (transfer < 0) return fail(`${eventId}: 전이 명령이 사라졌다`);
    if (audio > transfer) return fail(`${eventId}: 효과음이 이동 뒤에 있다(이동 앞이어야 한다)`);
    // The sound has to be audible before the screen changes: a wait between sound and transfer is that, nothing more.
    const kept = now.filter((command: any, index: number) => index !== audio && !(allowWait && command.kind === 'wait'));
    if (!isDeepStrictEqual(kept, was)) return fail(`${eventId}: 효과음 밖의 명령이 바뀌었다`);
    const waits = now.filter((command: any) => command.kind === 'wait');
    if (!allowWait && now.length !== was.length + 1) return fail(`${eventId}: 명령이 ${now.length - was.length}개 늘었다(효과음 하나만 추가되어야 한다)`);
    if (allowWait && waits.length > 1) return fail(`${eventId}: 대기 명령이 ${waits.length}개다`);
    return pass(`${eventId}: 전이 앞에 효과음 삽입(${now[audio].resourceId ?? '리소스 미지정'})`);
  }, { unseal: true });
}

const doorSe: Family = {
  id: 'door-se',
  area: 'transfer',
  mode: 'write',
  title: '이동 앞에 효과음 하나',
  variants: [
    { key: 'village-door', prompt: '문이 열릴 때 효과음을 재생해줘.', args: { eventId: DOOR, resourceId: SE_DOOR, allowWait: true }, setup: { event: DOOR } },
    { key: 'south-gate-polite', prompt: '남쪽 출입구로 이동하기 직전에 문 여는 소리를 넣어 주세요.', args: { eventId: SOUTH, resourceId: SE_DOOR, allowWait: true }, setup: { event: SOUTH } },
    // 「광장 가는 문」은 마을 문(광장으로 가는 쪽)을 가리킬 수도 있다 — 선택된 돌아오는 문과 둘 다 정답으로 본다.
    { key: 'plaza-door-terse', prompt: '광장 가는 문, 이동 전에 문 닫는 소리 하나.', args: { eventId: 'ev_plaza_back', mapId: 'map_plaza', resourceId: SE_CLOSE, allowWait: true, alsoAccept: [{ mapId: MAP, eventId: DOOR }] }, setup: { event: 'ev_plaza_back' } },
    { key: 'door-explained', prompt: '마을 문 전이 명령 바로 앞에 효과음 재생 명령을 하나만 넣어 주세요. 다른 명령 순서는 그대로 두세요.', args: { eventId: DOOR, resourceId: SE_DOOR }, setup: { event: DOOR } },
    { key: 'gate-casual', prompt: '출입구 밟으면 소리 나게 해줘.', args: { eventId: SOUTH, resourceId: SE_DOOR, allowWait: true }, setup: { event: SOUTH } },
  ],
  judge(input, args) {
    const targets = [
      { mapId: typeof args.mapId === 'string' ? args.mapId : MAP, eventId: strArg(args, 'eventId') },
      ...((args.alsoAccept as Array<{ mapId: string; eventId: string }> | undefined) ?? []),
    ];
    const verdicts = targets.map(target => judgeDoorSe(input, args, target));
    return verdicts.find(verdict => verdict.ok) ?? verdicts[0]!;
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const pageIndex = pageWithTransfer(event);
    const commands = (event.pages[pageIndex].commands as any[]).slice();
    const at = commands.findIndex(command => command.kind === 'transfer');
    commands.splice(at, 0, { kind: 'playAudio', resourceId: strArg(args, 'resourceId'), loop: false });
    return runOn(project, 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    const pageIndex = pageWithTransfer(event);
    const was = (event.pages[pageIndex].commands as any[]).slice();
    const reference = doorSe.reference!(clone(project), args) as Project;
    const audio = { kind: 'playAudio', resourceId: SE_DOOR, loop: false };
    const insertAt = (offset: number, extra: any[]) => attempt(() => {
      const commands = was.slice();
      commands.splice(was.findIndex(command => command.kind === 'transfer') + offset, 0, ...extra);
      return runOn(clone(project), 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
    });
    return distinct(reference, [
      insertAt(1, [audio]),
      insertAt(0, [audio, { ...audio, resourceId: SE_CLOSE }]),
      attempt(() => runOn(clone(project), 'patch_event_page', {
        mapId, eventId, pageIndex,
        set: { commands: [...was.filter(command => command.kind !== 'transfer'), audio] },
      })),
      // 허용한 두 동반 편집의 경계: 게이트에서 먼 칸을 열거나, 대기 대신 다른 명령을 넣으면 실패다.
      attempt(() => runOn(clone(reference), 'paint_tiles', { mapId, layer: 'lower', mode: 'cells', tile: 737, cells: [{ x: Math.max(0, event.x - 3), y: Math.max(0, event.y - 3) }] })),
      insertAt(0, [audio, { kind: 'text', body: '문이 열린다.' }]),
    ]);
  },
};

const doorToPlaza: Family = {
  id: 'door-to-plaza',
  area: 'transfer',
  mode: 'write',
  title: '집 문을 광장으로 연결',
  variants: [
    { key: 'house-door', prompt: '이 문을 마을 맵의 광장으로 연결해줘.', args: { eventId: HOUSE, targetMapId: 'map_plaza', x: 2, y: 2 }, setup: { event: HOUSE } },
    { key: 'house-polite', prompt: '집 문을 열면 광장으로 나가게 해 주세요.', args: { eventId: HOUSE, targetMapId: 'map_plaza', x: 4, y: 3 }, setup: { event: HOUSE } },
    { key: 'hamlet-gate', prompt: '안동 어귀 문을 광장으로 이어줘.', args: { eventId: 'ev_hamlet_gate', mapId: HAMLET, targetMapId: 'map_plaza', x: 6, y: 4 }, setup: { event: 'ev_hamlet_gate' } },
    { key: 'explained-landing', prompt: '집 문에 광장(map_plaza)으로 가는 전이를 넣어 주세요. 착지는 광장 안 통행 가능한 칸이면 됩니다.', args: { eventId: HOUSE, targetMapId: 'map_plaza', x: 3, y: 3 }, setup: { event: HOUSE } },
    { key: 'terse-door', prompt: '집 문 → 광장.', args: { eventId: HOUSE, targetMapId: 'map_plaza', x: 5, y: 2 }, setup: { event: HOUSE } },
  ],
  prepare: withHamlet,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const targetMapId = strArg(args, 'targetMapId');
    // 이어 준 뒤 돌아오는 문을 새로 놓는 것은 같은 연결의 반대쪽이다 — 대상 맵의 **기존** 이벤트·타일은 그대로여야 한다.
    const backGate = newEventOn(input.before, input.after, targetMapId).find((event: any) => transfersOfEvent(event).some((command: any) => command.mapId === mapId));
    const scope = backGate ? { blank: (doc: any) => { const map = doc.maps[targetMapId]; if (map) map.events = (map.events ?? []).filter((event: any) => event.id !== backGate.id); } } : {};
    return eventEditOn(input, mapId, eventId, (_before, after) => {
      const transfers = transfersOfEvent(after).filter((command: any) => command.mapId === targetMapId);
      if (!transfers.length) return fail(`${eventId}: ${targetMapId} 로 가는 전이 명령이 없다`);
      const landings = transfers.map((command: any) => ({ x: command.x, y: command.y }));
      const good = landings.find(cell => walkableIn(input.after, targetMapId, cell.x, cell.y));
      if (!good) return fail(`${eventId}: 착지 ${landings.map(cell => `(${cell.x},${cell.y})`).join(', ')} 가 ${targetMapId} 의 통행 가능 칸이 아니다`);
      if (backGate && !transfersOfEvent(backGate).some((command: any) => command.mapId === mapId)) return fail('돌아오는 문이 원래 맵으로 오지 않는다');
      return pass(`${eventId} → ${targetMapId} (${good.x},${good.y})`);
    }, { unseal: true, ...scope });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const kept = (event.pages[0].commands ?? []).filter((command: any) => command.kind !== 'text');
    const transfer = { kind: 'transfer', mapId: strArg(args, 'targetMapId'), x: numArg(args, 'x'), y: numArg(args, 'y'), direction: 'down', fade: 'black' };
    return runOn(project, 'patch_event_page', { mapId, eventId, pageIndex: 0, set: { trigger: { kind: 'playerTouch' }, commands: [...kept, transfer] } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    const kept = (event.pages[0].commands ?? []).filter((command: any) => command.kind !== 'text');
    const patch = (target: string, x: number, y: number) => attempt(() =>
      runOn(clone(project), 'patch_event_page', {
        mapId, eventId, pageIndex: 0,
        set: { trigger: { kind: 'playerTouch' }, commands: [...kept, { kind: 'transfer', mapId: target, x, y, fade: 'black' }] },
      }));
    const reference = doorToPlaza.reference!(clone(project), args) as Project;
    const right = patch(strArg(args, 'targetMapId'), numArg(args, 'x'), numArg(args, 'y'));
    return distinct(reference, [
      patch('map_field', 2, 2),
      patch(strArg(args, 'targetMapId'), 40, 40),
      right && attempt(() => runOn(right, 'paint_tiles', { mapId, layer: 'lower', mode: 'cells', tile: 534, cells: [{ x: 8, y: 5 }] })),
      attempt(() => runOn(clone(project), 'patch_event_page', { mapId, eventId, pageIndex: 0, set: { trigger: { kind: 'playerTouch' } } })),
      // 돌아오는 문을 놓으면서 대상 맵의 **기존** 이벤트까지 바꾸면 부작용이다.
      right && attempt(() => runOn(right, 'remove_event', { mapId: targetMapId, eventId: (mapOf(right, targetMapId).events as any[])[0]?.id })),
    ]);
  },
};

const alignPortals: Family = {
  id: 'align-portals',
  area: 'transfer',
  mode: 'write',
  title: '두 출입구 방향 정렬',
  variants: [
    { key: 'plaza-pair', prompt: '두 맵 사이의 출입구 방향을 맞춰줘.', args: { out: { mapId: MAP, eventId: DOOR, dir: 'right' }, back: { mapId: 'map_plaza', eventId: 'ev_plaza_back', dir: 'left' } }, setup: { event: DOOR } },
    { key: 'plaza-polite', prompt: '마을 문과 광장 문이 서로 마주 보게 방향을 맞춰 주세요.', args: { out: { mapId: MAP, eventId: DOOR, dir: 'right' }, back: { mapId: 'map_plaza', eventId: 'ev_plaza_back', dir: 'left' } }, setup: { event: DOOR } },
    { key: 'field-pair', prompt: '남쪽 출입구와 숲길 쪽 문의 방향을 서로 마주 보게 해줘.', args: { out: { mapId: MAP, eventId: SOUTH, dir: 'down' }, back: { mapId: 'map_field', eventId: 'ev_field_gate', dir: 'up' } }, setup: { event: SOUTH } },
    { key: 'explained-both', prompt: '가는 문과 돌아오는 문 **둘 다**의 전이 방향을 맞춰 주세요. 좌표와 목적지는 바꾸지 마세요.', args: { out: { mapId: MAP, eventId: DOOR, dir: 'right' }, back: { mapId: 'map_plaza', eventId: 'ev_plaza_back', dir: 'left' } }, setup: { event: DOOR } },
    { key: 'terse-mirror', prompt: '두 문 방향 반대로 맞춰.', args: { out: { mapId: MAP, eventId: DOOR, dir: 'right' }, back: { mapId: 'map_plaza', eventId: 'ev_plaza_back', dir: 'left' } }, setup: { event: DOOR } },
  ],
  prepare(project) {
    return runOn(project, 'upsert_event', {
      mapId: 'map_field',
      event: {
        id: 'ev_field_gate', name: '숲길 어귀', x: 12, y: 1, trigger: { kind: 'playerTouch' },
        pages: [{
          id: 'ev_field_gate_page', name: '숲길 어귀', conditions: [], graphic: { transparent: true }, trigger: { kind: 'playerTouch' },
          priority: 'below', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 },
          commands: [{ kind: 'transfer', mapId: MAP, x: 12, y: 16, fade: 'black', direction: 'down' }],
        }],
      },
    });
  },
  judge(input, args) {
    const out = args.out as { mapId: string; eventId: string; dir: string };
    const back = args.back as { mapId: string; eventId: string; dir: string };
    const transferOf = (project: Project, mapId: string, eventId: string) => {
      const event = eventOn(project, mapId, eventId);
      return event ? transfersOfEvent(event)[0] : undefined;
    };
    const gateOf = (project: Project, side: { mapId: string; eventId: string }) => eventOn(project, side.mapId, side.eventId);
    const nowOut = transferOf(input.after, out.mapId, out.eventId);
    const nowBack = transferOf(input.after, back.mapId, back.eventId);
    if (!nowOut || !nowBack) return fail('두 출입구 중 하나가 사라졌다');
    const otherGate = (side: { mapId: string; eventId: string }) => gateOf(input.after, side.mapId === out.mapId ? back : out);
    const accepts = (command: any, side: { dir: string }, other: any) => {
      const directions = new Set([side.dir]);
      if (other) directions.add(facingAway(other, { x: command.x, y: command.y }));
      return directions.has(command.direction);
    };
    if (!accepts(nowOut, out, otherGate(out))) return fail(`${out.eventId} 방향이 ${nowOut.direction ?? '(없음)'} — ${out.dir} 여야 한다`);
    if (!accepts(nowBack, back, otherGate(back))) return fail(`${back.eventId} 방향이 ${nowBack.direction ?? '(없음)'} — ${back.dir} 여야 한다`);
    const unsealed = gateUnsealCells(input, out.mapId, out.eventId);
    const keep = (project: Project) => {
      const copy: any = clone(project);
      for (const side of [out, back]) {
        for (const event of copy.maps[side.mapId]?.events ?? []) {
          if (event.id !== side.eventId) continue;
          for (const page of event.pages ?? []) for (const command of page.commands ?? []) if (command.kind === 'transfer') delete command.direction;
        }
      }
      const source = mapOf(input.before, out.mapId);
      for (const cell of unsealed) copy.maps[out.mapId].lowerTiles[cell.y * source.width + cell.x] = source.lowerTiles[cell.y * source.width + cell.x];
      return copy;
    };
    return isDeepStrictEqual(keep(input.before), keep(input.after))
      ? pass(`방향 정렬(가는 쪽 ${nowOut.direction}, 돌아오는 쪽 ${nowBack.direction}), 좌표·목적지 보존`)
      : fail('방향 밖의 내용(좌표·목적지·다른 이벤트)이 바뀌었다');
  },
  reference(project, args) {
    const setDirection = (current: Project, side: { mapId: string; eventId: string; dir: string }) => {
      const event = eventOn(current, side.mapId, side.eventId);
      if (!event) throw new Error(`fixture 에 ${side.eventId} 이벤트가 없다`);
      const pageIndex = pageWithTransfer(event);
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? { ...command, direction: side.dir } : command);
      return runOn(current, 'patch_event_page', { mapId: side.mapId, eventId: side.eventId, pageIndex, set: { commands } });
    };
    const out = args.out as { mapId: string; eventId: string; dir: string };
    const back = args.back as { mapId: string; eventId: string; dir: string };
    return setDirection(setDirection(project, out), back);
  },
  wrongs(project, args): FamilyOutcome[] {
    const out = args.out as { mapId: string; eventId: string; dir: string };
    const back = args.back as { mapId: string; eventId: string; dir: string };
    const reference = alignPortals.reference!(clone(project), args) as Project;
    const setDirection = (current: Project, side: { mapId: string; eventId: string; dir: string }) => attempt(() => {
      const event = eventOn(current, side.mapId, side.eventId);
      const pageIndex = pageWithTransfer(event);
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? { ...command, direction: side.dir } : command);
      return runOn(current, 'patch_event_page', { mapId: side.mapId, eventId: side.eventId, pageIndex, set: { commands } });
    });
    const movedLanding = (() => {
      const event = eventOn(reference, out.mapId, out.eventId);
      const pageIndex = pageWithTransfer(event);
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? { ...command, x: command.x + 3, y: command.y } : command);
      return attempt(() => runOn(clone(reference), 'patch_event_page', { mapId: out.mapId, eventId: out.eventId, pageIndex, set: { commands } }));
    })();
    const swapped = setDirection(setDirection(clone(project), { ...out, dir: back.dir })!, { ...back, dir: out.dir });
    return distinct(reference, [
      setDirection(clone(project), out),
      swapped,
      movedLanding,
      // 게이트에서 먼 칸을 여는 것은 방향 정렬이 아니다.
      attempt(() => runOn(clone(reference), 'paint_tiles', { mapId: out.mapId, layer: 'lower', mode: 'cells', tile: 737, cells: [{ x: 4, y: 4 }] })),
    ]);
  },
};

const worldmapNorth: Family = {
  id: 'worldmap-north',
  area: 'transfer',
  mode: 'write',
  title: '월드맵 북쪽 ↔ 마을 양방향',
  variants: [
    { key: 'village-north', prompt: '이 맵을 월드맵의 북쪽에 연결해줘.', args: { worldMapId: WORLD, villageMapId: MAP, gateX: 12, gateY: 1 }, setup: { select: { x: 12, y: 0, w: 1, h: 3 } } },
    { key: 'village-polite', prompt: '마을에서 월드맵 북쪽으로 나갈 수 있게 이어 주세요. 왕복이 되어야 합니다.', args: { worldMapId: WORLD, villageMapId: MAP, gateX: 16, gateY: 1 }, setup: { select: { x: 16, y: 0, w: 1, h: 3 } } },
    { key: 'terse-north', prompt: '월드맵 북쪽에 이 마을 붙여.', args: { worldMapId: WORLD, villageMapId: MAP, gateX: 6, gateY: 1 }, setup: { select: { x: 6, y: 0, w: 1, h: 3 } } },
    { key: 'explained-preserve', prompt: '월드맵 북쪽 가장자리(y가 작은 쪽)에 이 마을로 오는 출입구를 만들고, 마을에서 돌아가는 출입구도 함께 넣어 주세요. 출입구 밖 타일과 기존 이벤트는 그대로 두세요.', args: { worldMapId: WORLD, villageMapId: MAP, gateX: 20, gateY: 1 }, setup: { select: { x: 20, y: 0, w: 1, h: 3 } } },
    { key: 'hamlet-north', prompt: '안동 마을을 월드맵 북쪽에 연결해줘.', args: { worldMapId: WORLD, villageMapId: HAMLET, gateX: 10, gateY: 1 }, setup: { event: 'ev_hamlet_gate' } },
  ],
  prepare: withHamlet,
  judge(input, args) {
    const worldId = strArg(args, 'worldMapId');
    const villageId = strArg(args, 'villageMapId');
    // 「북쪽」은 띠가 아니라 월드맵 위쪽 1/3 이다 — y<=2 로 좁히면 정답(11,3)을 실패시킨다.
    const worldHeight = mapOf(input.after, worldId)?.height ?? 18;
    const northEdge = Math.max(3, Math.floor(worldHeight / 3));
    const north = gatesTo(input.after, worldId, villageId).filter(({ event }) => event.y < northEdge);
    const way = gatesTo(input.after, villageId, worldId);
    if (!north.length) return fail(`${worldId} 북쪽(y<${northEdge})에 ${villageId} 로 가는 출입구가 없다`);
    if (!way.length) return fail(`${villageId} 에서 ${worldId} 로 가는 출입구가 없다`);
    for (const mapId of [worldId, villageId]) {
      for (const event of mapOf(input.before, mapId)?.events ?? []) {
        const now = (mapOf(input.after, mapId)?.events ?? []).find((entry: any) => entry.id === event.id);
        if (!now || !isDeepStrictEqual(now, event)) return fail(`${mapId} 의 기존 이벤트 ${event.id} 가 바뀌었다`);
      }
    }
    const gates = [...north.map(entry => entry.event), ...way.map(entry => entry.event)];
    const near = (cell: { x: number; y: number }) => gates.some(gate => Math.abs(gate.x - cell.x) <= 2 && Math.abs(gate.y - cell.y) <= 2);
    for (const mapId of [worldId, villageId]) {
      const stray = changedCellsOn(input.before, input.after, mapId).filter(cell => !near(cell));
      if (stray.length) return fail(`${mapId} 의 출입구 밖 타일 ${stray.length}칸이 바뀌었다 (예: ${stray[0]!.x},${stray[0]!.y})`);
    }
    if (!north.some(({ command }) => walkableIn(input.after, villageId, command.x, command.y))) {
      return fail(`${worldId} 북쪽 출입구의 착지가 ${villageId} 의 통행 가능 칸이 아니다`);
    }
    return pass(`${worldId} 북쪽 (${north[0]!.event.x},${north[0]!.event.y}) ↔ ${villageId} (${way[0]!.event.x},${way[0]!.event.y})`);
  },
  reference(project, args) {
    return runOn(project, 'create_transfer_pair', {
      a: { mapId: strArg(args, 'villageMapId'), x: numArg(args, 'gateX'), y: numArg(args, 'gateY') },
      b: { mapId: strArg(args, 'worldMapId'), x: numArg(args, 'gateX'), y: 1 },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const worldId = strArg(args, 'worldMapId');
    const villageId = strArg(args, 'villageMapId');
    const gx = numArg(args, 'gateX'), gy = numArg(args, 'gateY');
    const reference = worldmapNorth.reference!(clone(project), args) as Project;
    const returnGates = gatesTo(reference, worldId, villageId);
    return distinct(reference, [
      attempt(() => runOn(clone(project), 'create_transfer_pair', {
        a: { mapId: villageId, x: gx, y: gy }, b: { mapId: worldId, x: gx, y: 16 },
      })),
      returnGates.length ? attempt(() => runOn(clone(reference), 'remove_event', { mapId: worldId, eventId: returnGates[0]!.event.id })) : undefined,
      attempt(() => runOn(clone(reference), 'paint_tiles', { mapId: villageId, layer: 'lower', mode: 'cells', tile: 534, cells: [{ x: 12, y: 16 }] })),
      attempt(() => runOn(clone(reference), 'remove_event', { mapId: villageId, eventId: gatesTo(reference, villageId, worldId)[0]!.event.id })),
    ]);
  },
};

export const GROUP_4: readonly Family[] = [
  moveDoor, removeBarrels, doorSe, doorToPlaza, alignPortals, worldmapNorth,
  ...GROUP_4_TRANSFER,
  ...GROUP_4_BATTLE_READ,
];
