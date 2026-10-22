import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, fail, mapOf, pass, runOn, sameExcept } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import {
  DOOR, HAMLET, HOUSE, PLAZA, SOUTH, attempt, distinct, eventEditOn, eventOn, facesGate, gatesTo, manhattan,
  pageWithTransfer, transfersOfEvent, walkableIn, withHamlet,
} from './group-4-shared';

const transferTwoWay: Family = {
  id: 'transfer-two-way',
  area: 'transfer',
  mode: 'write',
  title: '양방향 전이 + 마주 보는 착지',
  variants: [
    { key: 'house-hamlet', prompt: '집 문과 안동 어귀를 양방향으로 이어줘. 서로의 문 앞에 도착해야 해.', args: { from: { mapId: MAP, x: 7, y: 6 }, to: { mapId: HAMLET, x: 10, y: 12 } }, setup: { event: HOUSE } },
    { key: 'house-polite', prompt: '집 문에서 안동으로 나가고, 안동에서 다시 집 문 앞으로 돌아올 수 있게 두 방향 전이를 만들어 주세요.', args: { from: { mapId: MAP, x: 7, y: 6 }, to: { mapId: HAMLET, x: 11, y: 12 } }, setup: { event: HOUSE } },
    { key: 'south-hamlet', prompt: '남쪽 출입구랑 안동을 왕복으로 연결해줘.', args: { from: { mapId: MAP, x: 12, y: 16 }, to: { mapId: HAMLET, x: 10, y: 12 } }, setup: { event: SOUTH } },
    { key: 'explained-both-directions', prompt: '마을과 안동 사이에 왕복 출입구를 만들어 주세요. 도착 칸은 서로의 문 바로 앞이어야 하고, 도착하면 문을 등지고 서야 합니다.', args: { from: { mapId: MAP, x: 18, y: 9 }, to: { mapId: HAMLET, x: 10, y: 12 } }, setup: { select: { x: 18, y: 9, w: 1, h: 1 } } },
    { key: 'plaza-hamlet-terse', prompt: '광장 ↔ 안동 왕복.', args: { from: { mapId: PLAZA, x: 6, y: 6 }, to: { mapId: HAMLET, x: 10, y: 12 } }, setup: { select: { x: 6, y: 6, w: 1, h: 1 } } },
  ],
  prepare: withHamlet,
  judge(input, args) {
    const from = args.from as { mapId: string; x: number; y: number };
    const to = args.to as { mapId: string; x: number; y: number };
    const out = gatesTo(input.after, from.mapId, to.mapId);
    const back = gatesTo(input.after, to.mapId, from.mapId);
    if (!out.length) return fail(`${from.mapId} → ${to.mapId} 전이가 없다`);
    if (!back.length) return fail(`${to.mapId} → ${from.mapId} 전이가 없다(양방향이어야 한다)`);
    const pairs: Array<{ landing: any; destinationGate: any; side: string }> = [];
    for (const forward of out) {
      for (const reverse of back) {
        if (manhattan(forward.command, reverse.event) > 2) continue;
        if (manhattan(reverse.command, forward.event) > 2) continue;
        pairs.push({ landing: forward.command, destinationGate: reverse.event, side: to.mapId });
        pairs.push({ landing: reverse.command, destinationGate: forward.event, side: from.mapId });
      }
    }
    if (!pairs.length) return fail('두 방향의 착지가 서로의 문 앞이 아니다(문에서 2칸 넘게 떨어짐)');
    for (const entry of pairs) {
      if (!walkableIn(input.after, entry.side, entry.landing.x, entry.landing.y)) {
        return fail(`${entry.side} 착지 (${entry.landing.x},${entry.landing.y}) 가 통행 가능 칸이 아니다`);
      }
      if (facesGate(entry.landing, entry.destinationGate)) return fail(`${entry.side} 착지 방향이 문을 향한다(문을 등져야 한다)`);
    }
    const touched = new Set([...out, ...back].map(entry => entry.event.id));
    const blank = (doc: any) => {
      for (const mapId of [from.mapId, to.mapId]) {
        const map = doc.maps[mapId];
        if (map) map.events = (map.events ?? []).filter((event: any) => !touched.has(event.id));
      }
    };
    return sameExcept(input.before, input.after, blank)
      ? pass(`양방향 전이 ${out.length}/${back.length}, 착지가 서로의 문 앞`)
      : fail('전이 밖의 내용(다른 이벤트·타일·DB)이 바뀌었다');
  },
  reference(project, args) {
    const from = args.from as { mapId: string; x: number; y: number };
    const to = args.to as { mapId: string; x: number; y: number };
    return runOn(project, 'create_transfer_pair', { a: { mapId: from.mapId, x: from.x, y: from.y }, b: { mapId: to.mapId, x: to.x, y: to.y } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const from = args.from as { mapId: string; x: number; y: number };
    const to = args.to as { mapId: string; x: number; y: number };
    const reference = transferTwoWay.reference!(clone(project), args) as Project;
    const outGates = gatesTo(reference, from.mapId, to.mapId);
    const backGates = gatesTo(reference, to.mapId, from.mapId);
    const farLanding = outGates.length ? attempt(() => {
      const event = outGates[0]!.event;
      const pageIndex = pageWithTransfer(event);
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? { ...command, x: 3, y: 3 } : command);
      return runOn(clone(reference), 'patch_event_page', { mapId: from.mapId, eventId: event.id, pageIndex, set: { commands } });
    }) : undefined;
    const noReturn = backGates.length
      ? attempt(() => runOn(clone(reference), 'remove_event', { mapId: to.mapId, eventId: backGates[0]!.event.id }))
      : undefined;
    const facesDoor = outGates.length ? attempt(() => {
      const event = outGates[0]!.event;
      const pageIndex = pageWithTransfer(event);
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? { ...command, direction: 'up' } : command);
      return runOn(clone(reference), 'patch_event_page', { mapId: from.mapId, eventId: event.id, pageIndex, set: { commands } });
    }) : undefined;
    return distinct(reference, [
      farLanding,
      noReturn,
      facesDoor,
      attempt(() => runOn(clone(reference), 'paint_tiles', { mapId: from.mapId, layer: 'lower', mode: 'cells', tile: 534, cells: [{ x: 2, y: 2 }] })),
    ]);
  },
};

const transferLandingOffset: Family = {
  id: 'transfer-landing-offset',
  area: 'transfer',
  mode: 'write',
  title: '착지 좌표만 오프셋',
  variants: [
    { key: 'village-door', prompt: '마을 문의 착지 좌표를 한 칸 오른쪽으로 옮겨줘.', args: { eventId: DOOR, dx: 1, dy: 0 }, setup: { event: DOOR } },
    { key: 'village-polite', prompt: '마을 문으로 광장에 도착하는 자리를 한 칸 아래로 내려 주세요. 다른 값은 그대로 두세요.', args: { eventId: DOOR, dx: 0, dy: 1 }, setup: { event: DOOR } },
    { key: 'plaza-back', prompt: '광장에서 마을로 오는 문의 착지를 한 칸 위로.', args: { eventId: 'ev_plaza_back', mapId: PLAZA, dx: 0, dy: -1 }, setup: { event: 'ev_plaza_back' } },
    { key: 'south-gate-explained', prompt: '남쪽 출입구의 전이 목적지 좌표를 x로 한 칸, y로 한 칸 옮겨 주세요. 페이드·방향은 유지하세요.', args: { eventId: SOUTH, dx: 1, dy: 1 }, setup: { event: SOUTH } },
    { key: 'terse-offset', prompt: '마을 문 착지 두 칸 오른쪽으로.', args: { eventId: DOOR, dx: 2, dy: 0 }, setup: { event: DOOR } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const dx = numArg(args, 'dx'), dy = numArg(args, 'dy');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    return eventEditOn(input, mapId, eventId, (was, after) => {
      const original = transfersOfEvent(was)[0], now = transfersOfEvent(after)[0];
      if (!original || !now) return fail(`${eventId} 에 전이 명령이 없다`);
      if (now.x !== original.x + dx || now.y !== original.y + dy) {
        return fail(`${eventId}: 착지가 (${now.x},${now.y}) — (${original.x + dx},${original.y + dy}) 여야 한다`);
      }
      for (const field of ['mapId', 'fade', 'direction', 'transition']) {
        if (!isDeepStrictEqual(now[field], original[field])) return fail(`${eventId}: 착지 밖의 값(${field})이 바뀌었다`);
      }
      return pass(`${eventId} 착지 (${original.x},${original.y}) → (${now.x},${now.y})`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const pageIndex = pageWithTransfer(event);
    const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
      command.kind === 'transfer' ? { ...command, x: command.x + numArg(args, 'dx'), y: command.y + numArg(args, 'dy') } : command);
    return runOn(project, 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const dx = numArg(args, 'dx'), dy = numArg(args, 'dy');
    const event = eventOn(project, mapId, eventId);
    const pageIndex = pageWithTransfer(event);
    const reference = transferLandingOffset.reference!(clone(project), args) as Project;
    const patch = (mutate: (command: any) => any) => attempt(() => {
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) => (command.kind === 'transfer' ? mutate(command) : command));
      return runOn(clone(project), 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
    });
    const bothSides = (() => {
      const moved = patch(command => ({ ...command, x: command.x + dx, y: command.y + dy }));
      const returnEvent = moved && eventOn(moved, 'map_plaza', 'ev_plaza_back');
      if (!moved || !returnEvent) return undefined;
      const returnCommands = (returnEvent.pages[0].commands as any[]).map((command: any) => ({ ...command, x: command.x + dx, y: command.y + dy }));
      return attempt(() => runOn(moved, 'patch_event_page', { mapId: 'map_plaza', eventId: 'ev_plaza_back', pageIndex: 0, set: { commands: returnCommands } }));
    })();
    return distinct(reference, [
      patch(command => ({ ...command, x: command.x - dx, y: command.y - dy })),
      patch(command => ({ ...command, x: command.x + dx, y: command.y + dy, fade: 'white' })),
      bothSides,
      patch(command => ({ ...command, mapId: 'map_field' })),
    ]);
  },
};

const switchGatedTransfers = (commands: any[], switchId: string, insideGate = false): boolean[] =>
  commands.flatMap((command: any) => {
    if (command.kind === 'transfer') return [insideGate];
    if (command.kind !== 'fork') return [];
    const condition = command.condition;
    const matches = condition?.kind === 'switch' && condition.switchId === switchId;
    return [...switchGatedTransfers(command.then ?? [], switchId, insideGate || matches), ...switchGatedTransfers(command.else ?? [], switchId, insideGate || matches)];
  });

const transferConditional: Family = {
  id: 'transfer-conditional',
  area: 'transfer',
  mode: 'write',
  title: '전이를 스위치 조건으로 게이팅',
  variants: [
    { key: 'south-clear', prompt: '남쪽 출입구는 sw_ember_q1_clear 스위치가 켜져 있을 때만 열리게 해줘.', args: { eventId: SOUTH, switchId: 'sw_ember_q1_clear' }, setup: { event: SOUTH } },
    { key: 'south-polite', prompt: '남쪽 출입구 전이에 「잿불 퀘스트 클리어」 스위치 조건을 붙여 주세요. 조건이 꺼져 있으면 지나갈 수 없어야 합니다.', args: { eventId: SOUTH, switchId: 'sw_ember_q1_clear' }, setup: { event: SOUTH } },
    { key: 'village-door', prompt: '마을 문은 sw_ember_q1_started 가 켜졌을 때만 작동하게.', args: { eventId: DOOR, switchId: 'sw_ember_q1_started' }, setup: { event: DOOR } },
    { key: 'plaza-back-explained', prompt: '광장에서 마을로 돌아오는 문을 sw_unused 스위치가 켜진 동안에만 통하게 해 주세요. 전이 자체는 그대로 두세요.', args: { eventId: 'ev_plaza_back', mapId: PLAZA, switchId: 'sw_unused' }, setup: { event: 'ev_plaza_back' } },
    { key: 'south-terse', prompt: '남쪽 출입구, sw_ember_q1_clear 켜야만 통과.', args: { eventId: SOUTH, switchId: 'sw_ember_q1_clear' }, setup: { event: SOUTH } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const switchId = strArg(args, 'switchId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const known = new Set(((input.after as any).switches ?? []).map((entry: any) => entry.id));
    if (!known.has(switchId)) return fail(`${switchId} 스위치가 프로젝트에 없다`);
    const before = eventOn(input.before, mapId, eventId);
    if (!before) return fail(`${eventId} 이벤트가 사라졌다`);
    return eventEditOn(input, mapId, eventId, (was, after) => {
      const pagesWithTransfer = (after.pages ?? []).filter((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'transfer'));
      if (!pagesWithTransfer.length) return fail(`${eventId} 의 전이가 사라졌다`);
      const gated = (page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && condition.switchId === switchId);
      const gatedByFork = (page: any) => {
        const marks = switchGatedTransfers(page.commands ?? [], switchId);
        return marks.length > 0 && marks.every(Boolean);
      };
      if (pagesWithTransfer.some((page: any) => !gated(page) && !gatedByFork(page))) {
        return fail(`${eventId}: 조건 없는 페이지에서도 전이된다(${switchId} 가 꺼져도 열린다)`);
      }
      const original = transfersOfEvent(was)[0];
      const now = transfersOfEvent(after)[0];
      if (!original || !now) return fail(`${eventId}: 전이 명령이 사라졌다`);
      for (const field of ['mapId', 'x', 'y', 'fade', 'direction', 'transition']) {
        if (!isDeepStrictEqual(now[field], original[field])) return fail(`${eventId}: 전이의 ${field} 가 바뀌었다`);
      }
      return pass(`${eventId} 전이가 ${switchId} 조건으로만 열린다`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const pageIndex = pageWithTransfer(event);
    const conditions = [...((event.pages[pageIndex].conditions ?? []) as any[]), { kind: 'switch', switchId: strArg(args, 'switchId'), value: true }];
    return runOn(project, 'patch_event_page', { mapId, eventId, pageIndex, set: { conditions } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const switchId = strArg(args, 'switchId');
    const event = eventOn(project, mapId, eventId);
    const pageIndex = pageWithTransfer(event);
    const reference = transferConditional.reference!(clone(project), args) as Project;
    const gatedPage = { ...clone(event.pages[pageIndex]), id: `${eventId}_gated`, conditions: [{ kind: 'switch', switchId, value: true }] };
    return distinct(reference, [
      attempt(() => runOn(clone(project), 'upsert_event', { mapId, event: { id: eventId, pages: [...(event.pages ?? []), gatedPage] } })),
      attempt(() => runOn(clone(project), 'patch_event_page', {
        mapId, eventId, pageIndex,
        set: { conditions: [{ kind: 'switch', switchId: switchId === 'sw_unused' ? 'sw_ember_q1_clear' : 'sw_unused', value: true }] },
      })),
      attempt(() => runOn(clone(project), 'patch_event_page', {
        mapId, eventId, pageIndex,
        set: { conditions: [{ kind: 'switch', switchId, value: true }], commands: [{ kind: 'text', body: '문이 잠겨 있다.' }] },
      })),
    ]);
  },
};

const transferFadeChoice: Family = {
  id: 'transfer-fade-choice',
  area: 'transfer',
  mode: 'write',
  title: '그 문의 페이드만 변경',
  variants: [
    { key: 'village-white', prompt: '마을 문 전이의 페이드를 흰색으로 바꿔줘.', args: { eventId: DOOR, fade: 'white' }, setup: { event: DOOR } },
    { key: 'village-none-polite', prompt: '마을 문으로 이동할 때 화면이 페이드되지 않게 해 주세요.', args: { eventId: DOOR, fade: 'none' }, setup: { event: DOOR } },
    { key: 'south-none', prompt: '남쪽 출입구 페이드를 없애줘.', args: { eventId: SOUTH, fade: 'none' }, setup: { event: SOUTH } },
    { key: 'plaza-explained', prompt: '광장에서 마을로 오는 문만 페이드를 흰색으로 바꿔 주세요. 다른 문의 페이드는 그대로 두세요.', args: { eventId: 'ev_plaza_back', mapId: PLAZA, fade: 'white' }, setup: { event: 'ev_plaza_back' } },
    { key: 'village-terse', prompt: '마을 문 페이드 없애.', args: { eventId: DOOR, fade: 'none' }, setup: { event: DOOR } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const fade = strArg(args, 'fade');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    return eventEditOn(input, mapId, eventId, (was, after) => {
      const transfers = transfersOfEvent(after);
      if (!transfers.length) return fail(`${eventId} 의 전이가 사라졌다`);
      if (!transfers.every((command: any) => command.fade === fade)) {
        return fail(`${eventId}: 페이드가 ${transfers.map((command: any) => command.fade ?? '(없음)').join(',')} — ${fade} 여야 한다`);
      }
      const original = transfersOfEvent(was)[0];
      for (const field of ['mapId', 'x', 'y', 'direction']) {
        if (!isDeepStrictEqual(transfers[0][field], original[field])) return fail(`${eventId}: 페이드 밖의 값(${field})이 바뀌었다`);
      }
      return pass(`${eventId} 페이드만 ${fade}`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const event = eventOn(project, mapId, eventId);
    if (!event) throw new Error(`fixture 에 ${eventId} 이벤트가 없다`);
    const pageIndex = pageWithTransfer(event);
    const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
      command.kind === 'transfer' ? { ...command, fade: strArg(args, 'fade') } : command);
    return runOn(project, 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const mapId = typeof args.mapId === 'string' ? args.mapId : MAP;
    const fade = strArg(args, 'fade');
    const event = eventOn(project, mapId, eventId);
    const pageIndex = pageWithTransfer(event);
    const reference = transferFadeChoice.reference!(clone(project), args) as Project;
    const patch = (nextFade: string, extra: (command: any) => any = command => command) => attempt(() => {
      const commands = (event.pages[pageIndex].commands as any[]).map((command: any) =>
        command.kind === 'transfer' ? extra({ ...command, fade: nextFade }) : command);
      return runOn(clone(project), 'patch_event_page', { mapId, eventId, pageIndex, set: { commands } });
    });
    const returnDoorToo = (() => {
      const done = patch(fade);
      const other = done && eventOn(done, 'map_plaza', 'ev_plaza_back');
      if (!done || !other) return undefined;
      const otherIndex = pageWithTransfer(other);
      const commands = (other.pages[otherIndex].commands as any[]).map((command: any) => (command.kind === 'transfer' ? { ...command, fade } : command));
      return attempt(() => runOn(done, 'patch_event_page', { mapId: 'map_plaza', eventId: 'ev_plaza_back', pageIndex: otherIndex, set: { commands } }));
    })();
    return distinct(reference, [
      patch(fade === 'white' ? 'black' : 'white'),
      patch(fade, command => ({ ...command, x: command.x + 2 })),
      returnDoorToo,
    ]);
  },
};

const chainCreateThenLink: Family = {
  id: 'chain-create-then-link',
  area: 'transfer',
  mode: 'write',
  title: '새 맵 생성 + 양방향 연결',
  variants: [
    { key: 'well-yard', prompt: '우물 마당이라는 새 맵(20×14)을 만들고 집 문과 양방향으로 이어줘.', args: { name: '우물 마당', width: 20, height: 14, from: { mapId: MAP, x: 7, y: 6 }, to: { x: 10, y: 8 } }, setup: { event: HOUSE } },
    { key: 'well-yard-polite', prompt: '「우물 마당」이라는 20×14 맵을 새로 만들어 주시고, 집 문에서 갔다가 돌아올 수 있게 연결해 주세요.', args: { name: '우물 마당', width: 20, height: 14, from: { mapId: MAP, x: 7, y: 6 }, to: { x: 6, y: 9 } }, setup: { event: HOUSE } },
    { key: 'cellar', prompt: '지하 창고 16×12 맵 만들고 남쪽 출입구랑 왕복 연결해줘.', args: { name: '지하 창고', width: 16, height: 12, from: { mapId: MAP, x: 12, y: 16 }, to: { x: 8, y: 10 } }, setup: { event: SOUTH } },
    { key: 'hamlet-yard-explained', prompt: '「안동 뒷마당」 18×12 맵을 새로 만든 뒤, 안동 어귀에서 그 맵으로 왕복 이동할 수 있게 해 주세요. 기존 맵과 이벤트는 그대로 두세요.', args: { name: '안동 뒷마당', width: 18, height: 12, from: { mapId: HAMLET, x: 10, y: 12 }, to: { x: 9, y: 6 } }, setup: { event: 'ev_hamlet_gate' } },
    { key: 'terse-yard', prompt: '새 맵 「뒷산」 16×16 만들고 집 문과 이어.', args: { name: '뒷산', width: 16, height: 16, from: { mapId: MAP, x: 7, y: 6 }, to: { x: 8, y: 8 } }, setup: { event: HOUSE } },
  ],
  prepare: withHamlet,
  judge(input, args) {
    const name = strArg(args, 'name');
    const width = numArg(args, 'width'), height = numArg(args, 'height');
    const from = args.from as { mapId: string; x: number; y: number };
    const beforeIds = new Set(Object.keys((input.before as any).maps));
    const added = Object.keys((input.after as any).maps).filter(id => !beforeIds.has(id));
    const named = added.filter(id => mapOf(input.after, id)?.name === name);
    if (!named.length) return fail(`「${name}」 새 맵이 없다(새 맵: ${added.join(', ') || '없음'})`);
    if (named.length > 1) return fail(`같은 이름의 새 맵이 ${named.length}개다`);
    const newId = named[0]!;
    const created = mapOf(input.after, newId);
    if (created.width !== width || created.height !== height) return fail(`${name} 크기가 ${created.width}×${created.height} (${width}×${height} 여야 한다)`);
    const out = gatesTo(input.after, from.mapId, newId);
    const back = gatesTo(input.after, newId, from.mapId);
    if (!out.length) return fail(`${from.mapId} → ${name} 전이가 없다`);
    if (!back.length) return fail(`${name} → ${from.mapId} 전이가 없다(왕복이어야 한다)`);
    if (!walkableIn(input.after, newId, out[0]!.command.x, out[0]!.command.y)) {
      return fail(`${name} 착지 (${out[0]!.command.x},${out[0]!.command.y}) 가 통행 가능 칸이 아니다`);
    }
    if (manhattan(out[0]!.command, back[0]!.event) > 2) return fail(`${name} 쪽 착지가 출입구 앞이 아니다`);
    if (manhattan(back[0]!.command, out[0]!.event) > 2) return fail(`${from.mapId} 쪽 착지가 출입구 앞이 아니다`);
    const gateIds = new Set([...out, ...back].map(entry => entry.event.id));
    const blank = (doc: any) => {
      for (const id of added) delete doc.maps[id];
      for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !gateIds.has(event.id));
      if (doc.mapTree) {
        const strip = (node: any): any => ({ ...node, children: (node.children ?? []).filter((child: any) => !added.includes(child.mapId)).map(strip) });
        doc.mapTree = strip(doc.mapTree);
      }
      delete doc.worldGraph;
      if (added.includes(doc.startMapId)) delete doc.startMapId;
    };
    return sameExcept(input.before, input.after, blank)
      ? pass(`${name}(${width}×${height}) 생성 + 왕복 전이`)
      : fail('새 맵·전이 밖의 내용(기존 맵·이벤트)이 바뀌었다');
  },
  reference(project, args) {
    const from = args.from as { mapId: string; x: number; y: number };
    const to = args.to as { x: number; y: number };
    const beforeIds = new Set(Object.keys((project as any).maps));
    const created = runOn(project, 'create_map', { name: strArg(args, 'name'), width: numArg(args, 'width'), height: numArg(args, 'height') });
    const newId = Object.keys((created as any).maps).find(id => !beforeIds.has(id));
    if (!newId) throw new Error('create_map 이 새 맵을 만들지 않았다');
    return runOn(created, 'create_transfer_pair', { a: { mapId: from.mapId, x: from.x, y: from.y }, b: { mapId: newId, x: to.x, y: to.y } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const from = args.from as { mapId: string; x: number; y: number };
    const to = args.to as { x: number; y: number };
    const name = strArg(args, 'name');
    const beforeIds = new Set(Object.keys((project as any).maps));
    const create = () => attempt(() => runOn(clone(project), 'create_map', { name, width: numArg(args, 'width'), height: numArg(args, 'height') }));
    const withNew = (mutate: (current: Project, newId: string) => Project | undefined) => {
      const created = create();
      if (!created) return undefined;
      const newId = Object.keys((created as any).maps).find(id => !beforeIds.has(id));
      return newId ? mutate(created, newId) : undefined;
    };
    const reference = chainCreateThenLink.reference!(clone(project), args) as Project;
    const newIdOfReference = Object.keys((reference as any).maps).find(id => !beforeIds.has(id));
    const returnGate = newIdOfReference ? gatesTo(reference, newIdOfReference, from.mapId)[0] : undefined;
    return distinct(reference, [
      create(),
      withNew((created, newId) => attempt(() => runOn(created, 'create_transfer_pair', { a: { mapId: from.mapId, x: from.x, y: from.y }, b: { mapId: 'map_field', x: 4, y: 4 } }))),
      returnGate ? attempt(() => runOn(clone(reference), 'remove_event', { mapId: newIdOfReference!, eventId: returnGate.event.id })) : undefined,
      withNew((created, newId) => attempt(() => runOn(created, 'resize_map', { mapId: newId, width: numArg(args, 'width') + 4, height: numArg(args, 'height') }))),
    ]);
  },
};

export const GROUP_4_TRANSFER: readonly Family[] = [
  transferTwoWay, transferLandingOffset, transferConditional, transferFadeChoice, chainCreateThenLink,
];
