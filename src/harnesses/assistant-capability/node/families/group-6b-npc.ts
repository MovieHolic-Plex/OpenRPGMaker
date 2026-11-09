import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, eventOf, fail, mapOf, pass, runOn, sameExcept, withoutEvent } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import { attempt, commandsOfKind, deepCommands, distinct, eventIn, newEventsOn, withoutFlags } from './group-6b-shared';

const textsOf = (event: any): string[] => commandsOfKind(event, 'text').map(command => String(command.body ?? ''));
const blankNew = (ids: string[]) => (doc: any) => {
  for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id));
  withoutFlags(doc);
};

// ── npc-blocks-until-switch ────────────────────────────────────────────────

const npcBlocks: Family = {
  id: 'npc-blocks-until-switch',
  area: 'gate',
  mode: 'write',
  title: '길을 막는 NPC 가 스위치가 켜지면 비켜 준다',
  variants: [
    { key: 'bridge-guard', prompt: '(12,15) 칸에 「다리 문지기」를 세워 줘. 「성문 개방」 스위치가 켜지기 전에는 「지금은 못 지나간다.」라며 길을 막고, 켜지면 비켜서 지나갈 수 있게.', args: { name: '다리 문지기', x: 12, y: 15, switchId: 'sw_catalog_gate_open', blockLine: '지금은 못 지나간다.' } },
    { key: 'lighthouse-keeper-polite', prompt: '(16,4) 칸에 「등대지기」라는 사람이 서서 길을 막고 있다가, 등대 점화 스위치가 켜지면 길을 열어 주도록 만들어 주세요. 막고 있을 땐 「불이 꺼져 있어 보낼 수 없네.」라고 말해요.', args: { name: '등대지기', x: 16, y: 4, switchId: 'sw_catalog_lighthouse_lit', blockLine: '불이 꺼져 있어 보낼 수 없네.' } },
    { key: 'archive-terse', prompt: '(9,12) 서고 문지기. 서고 봉인 해제 스위치 켜질 때까지 막기.', args: { name: '서고 문지기', x: 9, y: 12, switchId: 'sw_catalog_archive_unlock' } },
    { key: 'aqueduct-explained', prompt: '(18,13) 칸에 수로를 지키는 「수문장」을 놓아 줘. 수로 전환 스위치가 켜지면 그 자리에서 비켜 주고, 꺼져 있을 땐 「수로가 아직 안 열렸다.」라고만 말하게. 다른 이벤트는 건드리지 마.', args: { name: '수문장', x: 18, y: 13, switchId: 'sw_catalog_aqueduct_route', blockLine: '수로가 아직 안 열렸다.' } },
    { key: 'mine-lift', prompt: '(14,16) 칸 승강기 앞에 「광부」를 세우고, 광산 승강기 작동 스위치가 켜지기 전엔 못 가게 막다가 켜지면 비켜 줘.', args: { name: '광부', x: 14, y: 16, switchId: 'sw_catalog_mine_lift' } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name'), x = numArg(args, 'x'), y = numArg(args, 'y'), switchId = strArg(args, 'switchId');
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const npc = fresh[0];
    if (npc.x !== x || npc.y !== y) return fail('위치 (' + npc.x + ',' + npc.y + ') — (' + x + ',' + y + ') 여야 한다');
    if (!String(npc.name ?? '').includes(name)) return fail('이름 「' + npc.name + '」 — 「' + name + '」 여야 한다');
    const pages: any[] = npc.pages ?? [];
    const gated = (page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'switch' && condition.switchId === switchId && condition.value !== false);
    const blocking = (page: any) => page.priority === 'same' && page.graphic?.transparent !== true;
    const first = pages.find(page => !(page.conditions ?? []).length);
    if (!first) return fail('스위치가 꺼져 있을 때 쓰이는 조건 없는 페이지가 없다');
    if (!blocking(first)) return fail('스위치가 꺼져 있을 때의 페이지가 길을 막지 않는다(priority ' + first.priority + ')');
    if (typeof args.blockLine === 'string' && !textsOf({ pages: [first] }).some(body => body.includes(String(args.blockLine)))) return fail('막는 대사에 「' + args.blockLine + '」 가 없다');
    const open = pages.filter(gated);
    if (!open.length) return fail('스위치 ' + switchId + ' 가 켜졌을 때의 페이지가 없다');
    if (open.some(page => blocking(page))) return fail('스위치가 켜져도 여전히 길을 막는 페이지가 있다');
    return sameExcept(input.before, input.after, blankNew([npc.id])) ? pass(name + ' (' + x + ',' + y + '): ' + switchId + ' 켜지면 비킴') : fail('NPC 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const line = typeof args.blockLine === 'string' ? args.blockLine : '아직은 지나갈 수 없다.';
    const placed = runOn(project, 'place_npc', { mapId: MAP, x, y, name: strArg(args, 'name'), id: 'ev_ref_blocker', pages: [{ lines: [line] }, { conditions: [{ kind: 'switch', switchId: strArg(args, 'switchId'), value: true }], lines: ['이제 지나가도 좋다.'] }] });
    return runOn(placed, 'patch_event_page', { mapId: MAP, eventId: 'ev_ref_blocker', pageIndex: 1, set: { priority: 'below', overlapForbidden: false } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y'), switchId = strArg(args, 'switchId'), name = strArg(args, 'name');
    const line = typeof args.blockLine === 'string' ? args.blockLine : '아직은 지나갈 수 없다.';
    const reference = npcBlocks.reference!(clone(project), args) as Project;
    const place = (pages: any[], at = { x, y }) => attempt(() => runOn(clone(project), 'place_npc', { mapId: MAP, ...at, name, id: 'ev_ref_blocker', pages }));
    const open = (condSwitch: string) => ({ conditions: [{ kind: 'switch', switchId: condSwitch, value: true }], lines: ['이제 지나가도 좋다.'] });
    const other = switchId === 'sw_catalog_gate_open' ? 'sw_catalog_lighthouse_lit' : 'sw_catalog_gate_open';
    return distinct(reference, [
      // 스위치가 켜져도 계속 막는 오답(비켜서는 페이지를 안 만듦)
      place([{ lines: [line] }, open(switchId)]),
      // 항상 막기만 하는 오답
      place([{ lines: [line] }]),
      // 엉뚱한 스위치에 연결
      attempt(() => runOn(runOn(clone(project), 'place_npc', { mapId: MAP, x, y, name, id: 'ev_ref_blocker', pages: [{ lines: [line] }, open(other)] }), 'patch_event_page', { mapId: MAP, eventId: 'ev_ref_blocker', pageIndex: 1, set: { priority: 'below', overlapForbidden: false } })),
      // 엉뚱한 칸에 세움
      attempt(() => runOn(runOn(clone(project), 'place_npc', { mapId: MAP, x: x === 21 ? 20 : x + 3, y, name, id: 'ev_ref_blocker', pages: [{ lines: [line] }, open(switchId)] }), 'patch_event_page', { mapId: MAP, eventId: 'ev_ref_blocker', pageIndex: 1, set: { priority: 'below', overlapForbidden: false } })),
    ]);
  },
};

// ── npc-shop-new ───────────────────────────────────────────────────────────

const npcShopNew: Family = {
  id: 'npc-shop-new',
  area: 'town',
  mode: 'write',
  title: '새 NPC 가 상점을 연다(재고 지정)',
  variants: [
    { key: 'herbalist', prompt: '(15,5) 칸에 「약초상」을 새로 세우고, 말을 걸면 회복약과 초록 약초를 파는 상점이 열리게 해줘.', args: { name: '약초상', x: 15, y: 5, itemIds: ['item_potion', 'item_herb_green'] } },
    { key: 'baker-polite', prompt: '(17,6) 칸에 「빵집 주인」을 놓아 주세요. 호밀빵과 버터 과자를 파는 가게를 열어 주세요.', args: { name: '빵집 주인', x: 17, y: 6, itemIds: ['item_bread', 'item_cookie'] } },
    { key: 'peddler-terse', prompt: '(9,13) 행상인, 해독초 판매.', args: { name: '행상인', x: 9, y: 13, itemIds: ['item_antidote'] } },
    { key: 'mage-shop-three', prompt: '(19,3) 칸에 마법 상인을 놓고 이름은 「마법 상인」으로 해줘. 마력약, 마력차, 푸른 마력초 세 가지를 파는 상점이야.', args: { name: '마법 상인', x: 19, y: 3, itemIds: ['item_ether', 'item_mana_tea', 'item_herb_blue'] } },
    { key: 'keeps-old-shop-explained', prompt: '(14,15) 칸에 「잡상인」이라는 새 상점 NPC를 추가하고 회복약과 상급 회복약을 팔게 해 줘. 기존 잡화점은 건드리지 마.', args: { name: '잡상인', x: 14, y: 15, itemIds: ['item_potion', 'item_hi_potion'] } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name'), x = numArg(args, 'x'), y = numArg(args, 'y');
    const want = [...(args.itemIds as string[])].sort();
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const npc = fresh[0];
    if (npc.x !== x || npc.y !== y) return fail('위치 (' + npc.x + ',' + npc.y + ') — (' + x + ',' + y + ') 여야 한다');
    if (!String(npc.name ?? '').includes(name)) return fail('이름 「' + npc.name + '」 — 「' + name + '」 여야 한다');
    const shops = commandsOfKind(npc, 'shop');
    if (shops.length !== 1) return fail('상점 명령이 ' + shops.length + '개다(하나여야 한다)');
    const stocked = ((shops[0].stock ?? []).map((entry: any) => entry.itemId) as string[]).concat(shops[0].itemIds ?? []);
    const got = [...new Set(stocked)].sort();
    if (!isDeepStrictEqual(got, want)) return fail('재고 [' + got.join(',') + '] — [' + want.join(',') + '] 여야 한다');
    return sameExcept(input.before, input.after, blankNew([npc.id])) ? pass(name + ' 상점(' + got.join(',') + ')') : fail('상점 NPC 밖의 내용이 바뀌었다(기존 상점 포함)');
  },
  reference(project, args) {
    return runOn(project, 'make_villager', { mapId: MAP, name: strArg(args, 'name'), home: { x: numArg(args, 'x'), y: numArg(args, 'y') }, id: 'ev_ref_shop', dialogue: [{ text: '어서 오세요.' }], shop: { stock: (args.itemIds as string[]).map(itemId => ({ itemId })) } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const name = strArg(args, 'name'), x = numArg(args, 'x'), y = numArg(args, 'y');
    const ids = args.itemIds as string[];
    const reference = npcShopNew.reference!(clone(project), args) as Project;
    const make = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'make_villager', { mapId: MAP, name, home: { x, y }, id: 'ev_ref_shop', dialogue: [{ text: '어서 오세요.' }], shop: { stock: ids.map(itemId => ({ itemId })) }, ...patch }));
    const extra = ['item_ether', 'item_bread'].find(id => !ids.includes(id))!;
    return distinct(reference, [
      make({ shop: { stock: [...ids, extra].map(itemId => ({ itemId })) } }),
      ids.length > 1 ? make({ shop: { stock: ids.slice(0, -1).map(itemId => ({ itemId })) } }) : make({ shop: { stock: [{ itemId: extra }] } }),
      make({ home: { x: x === 21 ? 20 : x + 3, y } }),
      // 상점 없이 대사만 하는 NPC
      attempt(() => runOn(clone(project), 'make_villager', { mapId: MAP, name, home: { x, y }, id: 'ev_ref_shop', dialogue: [{ text: '어서 오세요.' }] })),
      // 기존 잡화점의 재고를 바꿔 버린 오답
      attempt(() => runOn(clone(project), 'set_shop_stock', { mapId: MAP, eventId: 'ev_test_shop', stock: ids.map(itemId => ({ itemId })) })),
    ]);
  },
};

// ── villager-dialogue ──────────────────────────────────────────────────────

const villagerDialogue: Family = {
  id: 'villager-dialogue',
  area: 'town',
  mode: 'write',
  title: '주민 NPC 를 집 자리와 대사로 만든다(선택: 낮 일터)',
  variants: [
    { key: 'baker-one-line', prompt: '(15,5) 칸에 「제빵사」라는 주민을 만들고, 말을 걸면 「갓 구운 빵이 있어요.」라고 하게 해줘.', args: { name: '제빵사', x: 15, y: 5, lines: ['갓 구운 빵이 있어요.'] } },
    { key: 'fisher-polite', prompt: '(10,15) 칸에 어부 「은호」를 놓아 주세요. 「오늘은 은어가 잘 잡혀요.」라고 말해요.', args: { name: '은호', x: 10, y: 15, lines: ['오늘은 은어가 잘 잡혀요.'] } },
    { key: 'child-terse', prompt: '(18,13) 꼬마 「다래」 대사 「숨바꼭질할래?」', args: { name: '다래', x: 18, y: 13, lines: ['숨바꼭질할래?'] } },
    { key: 'farmer-routine', prompt: '(14,10) 칸이 집인 「농부」를 만들어 줘. 낮 8시부터 18시까지는 (17,12) 밭에서 일하고, 말을 걸면 「밭일이 한창이야.」라고 해.', args: { name: '농부', x: 14, y: 10, lines: ['밭일이 한창이야.'], work: { x: 17, y: 12, hours: [8, 18] } } },
    { key: 'elder-two-lines-explained', prompt: '(11,13) 칸에 「노인」을 두고 두 마디를 하게 해 줘. 「옛날엔 이 마을도 컸지.」 그리고 「지금은 조용해서 좋구나.」 다른 주민은 건드리지 마.', args: { name: '노인', x: 11, y: 13, lines: ['옛날엔 이 마을도 컸지.', '지금은 조용해서 좋구나.'] } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name'), x = numArg(args, 'x'), y = numArg(args, 'y');
    const lines = args.lines as string[];
    const work = args.work as { x: number; y: number; hours: number[] } | undefined;
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const npc = fresh[0];
    if (npc.x !== x || npc.y !== y) return fail('집 자리 (' + npc.x + ',' + npc.y + ') — (' + x + ',' + y + ') 여야 한다');
    if (!String(npc.name ?? '').includes(name)) return fail('이름 「' + npc.name + '」 — 「' + name + '」 여야 한다');
    const spoken = textsOf(npc);
    for (const line of lines) if (!spoken.some(body => body.includes(line))) return fail('대사 「' + line + '」 가 없다: ' + spoken.join('|'));
    if (commandsOfKind(npc, 'shop', 'transfer', 'battleProcessing').length) return fail('요청하지 않은 상점·이동·전투 명령이 있다');
    const schedule: any[] = npc.schedule ?? [];
    if (work) {
      const entry = schedule.find(item => item.at?.x === work.x && item.at?.y === work.y && item.activity === 'work');
      if (!entry) return fail('(' + work.x + ',' + work.y + ') 일터 일정(activity work)이 없다: ' + JSON.stringify(schedule).slice(0, 200));
      if (!isDeepStrictEqual(entry.when?.hourRange, work.hours)) return fail('일하는 시간이 ' + JSON.stringify(entry.when?.hourRange) + ' — ' + JSON.stringify(work.hours) + ' 여야 한다');
    } else if (schedule.some(item => item.activity === 'work')) return fail('요청하지 않은 일터 일정이 있다');
    return sameExcept(input.before, input.after, blankNew([npc.id])) ? pass(name + ' (' + x + ',' + y + ') 주민') : fail('주민 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const work = args.work as { x: number; y: number; hours: number[] } | undefined;
    return runOn(project, 'make_villager', {
      mapId: MAP, name: strArg(args, 'name'), home: { x: numArg(args, 'x'), y: numArg(args, 'y') }, id: 'ev_ref_villager',
      dialogue: (args.lines as string[]).map(text => ({ text })),
      ...(work ? { dailyRoutine: { workAt: { x: work.x, y: work.y }, workHours: work.hours } } : {}),
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const name = strArg(args, 'name'), x = numArg(args, 'x'), y = numArg(args, 'y');
    const lines = args.lines as string[];
    const work = args.work as { x: number; y: number; hours: number[] } | undefined;
    const reference = villagerDialogue.reference!(clone(project), args) as Project;
    const make = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'make_villager', {
      mapId: MAP, name, home: { x, y }, id: 'ev_ref_villager', dialogue: lines.map(text => ({ text })),
      ...(work ? { dailyRoutine: { workAt: { x: work.x, y: work.y }, workHours: work.hours } } : {}), ...patch }));
    return distinct(reference, [
      make({ home: { x: x === 21 ? 20 : x + 3, y } }),
      make({ dialogue: [{ text: '……' }] }),
      lines.length > 1 ? make({ dialogue: lines.slice(0, 1).map(text => ({ text })) }) : make({ name: name + '의 형' }),
      work ? make({ dailyRoutine: undefined }) : make({ dailyRoutine: { workAt: { x: 17, y: 12 }, workHours: [8, 18] } }),
      work ? make({ dailyRoutine: { workAt: { x: work.x, y: work.y }, workHours: [work.hours[0]! + 4, work.hours[1]!] } }) : undefined,
    ]);
  },
};

// ── npc-patrol ─────────────────────────────────────────────────────────────

const GUARD = 'ev_g6b_guard';
const FARMER = 'ev_g6b_farmer';
const lone = (id: string, name: string, x: number, y: number, body: string): any => ({
  id, name, x, y, trigger: { kind: 'action' },
  pages: [{ id: id + '_page', name, conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: false, movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', speaker: name, body }] }],
});
function withPatrolNpcs(project: Project): Project {
  const a = runOn(project, 'make_villager', { mapId: MAP, name: '야간 경비', home: { x: 14, y: 10 }, id: GUARD, movement: 'fixed', dialogue: [{ text: '이상 없다.' }] });
  return runOn(a, 'make_villager', { mapId: MAP, name: '농부', home: { x: 10, y: 14 }, id: FARMER, movement: 'fixed', dialogue: [{ text: '날씨가 좋군.' }] });
}
void lone;

const routeOf = (event: any): string[] => ((event?.pages?.[0]?.movement?.route?.moves ?? []) as any[]).filter(move => move.kind === 'move').map(move => String(move.dir));

const npcPatrol: Family = {
  id: 'npc-patrol',
  area: 'town',
  mode: 'write',
  title: '생활 NPC 에게 닫힌 순찰 경로를 준다',
  variants: [
    { key: 'guard-east-west', prompt: '야간 경비가 오른쪽으로 두 칸 갔다가 다시 왼쪽으로 두 칸 돌아오는 순찰을 돌게 해줘.', args: { eventId: GUARD, dirs: ['right', 'right', 'left', 'left'] }, setup: { event: GUARD } },
    { key: 'guard-north-south-polite', prompt: '야간 경비가 위로 두 칸 올라갔다가 다시 아래로 두 칸 내려오는 순찰을 하도록 해 주세요.', args: { eventId: GUARD, dirs: ['up', 'up', 'down', 'down'] }, setup: { event: GUARD } },
    { key: 'farmer-square', prompt: '농부가 오른쪽·아래·왼쪽·위 순서로 한 칸씩 네모나게 도는 순찰.', args: { eventId: FARMER, dirs: ['right', 'down', 'left', 'up'] } },
    { key: 'farmer-short-terse', prompt: '농부 위아래 한 칸 왕복 순찰.', args: { eventId: FARMER, dirs: ['up', 'down'] } },
    { key: 'guard-left-explained', prompt: '야간 경비가 왼쪽으로 세 칸 걸어갔다가 같은 길로 돌아오게 해 줘. 대사나 위치는 그대로 두고.', args: { eventId: GUARD, dirs: ['left', 'left', 'left', 'right', 'right', 'right'] }, setup: { event: GUARD } },
  ],
  prepare: withPatrolNpcs,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const dirs = args.dirs as string[];
    if (!sameExcept(input.before, input.after, withoutEvent(eventId))) return fail(eventId + ' 밖의 내용이 바뀌었다');
    const before = eventIn(input.before, eventId), after = eventIn(input.after, eventId);
    if (!before || !after) return fail(eventId + ' 이벤트가 사라졌다');
    if (after.x !== before.x || after.y !== before.y) return fail('NPC 자리가 (' + after.x + ',' + after.y + ') 로 옮겨졌다 — 순찰의 출발점은 그대로여야 한다');
    for (const page of after.pages ?? []) {
      if (page.movement?.type !== 'custom' || page.movement?.route?.repeat !== true) return fail('페이지가 반복 순찰(custom route repeat)이 아니다: ' + JSON.stringify(page.movement).slice(0, 160));
    }
    const got = routeOf(after);
    if (!isDeepStrictEqual(got, dirs)) return fail('순찰 경로 [' + got.join(',') + '] — [' + dirs.join(',') + '] 여야 한다');
    if (!isDeepStrictEqual(textsOf(after), textsOf(before))) return fail('대사가 바뀌었다');
    return pass(eventId + ' 순찰 ' + dirs.join(','));
  },
  reference(project, args) {
    return runOn(project, 'configure_npc_patrol', { mapId: MAP, eventId: strArg(args, 'eventId'), directions: args.dirs });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const dirs = args.dirs as string[];
    const reference = npcPatrol.reference!(clone(project), args) as Project;
    const patrol = (id: string, directions: string[]) => attempt(() => runOn(clone(project), 'configure_npc_patrol', { mapId: MAP, eventId: id, directions }));
    const flipped: Record<string, string> = { left: 'right', right: 'left', up: 'down', down: 'up' };
    return distinct(reference, [
      patrol(eventId, dirs.map(dir => flipped[dir]!)),
      patrol(eventId === GUARD ? FARMER : GUARD, dirs),
      dirs.length > 2 ? patrol(eventId, [dirs[0]!, flipped[dirs[0]!]!]) : patrol(eventId, ['left', 'right']),
      // 순찰 없이 떠돌기만 하는 오답(random)
      attempt(() => runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { movement: { type: 'random', speed: 3, frequency: 3 } } })),
      // 돌아오지 않는 열린 경로를 손으로 박은 오답
      attempt(() => runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { movement: { type: 'custom', speed: 2, frequency: 2, route: { repeat: true, skippable: false, moves: dirs.slice(0, Math.ceil(dirs.length / 2)).map(dir => ({ kind: 'move', dir })) } } } })),
    ]);
  },
};

// ── npc-cast ───────────────────────────────────────────────────────────────

const CAST_A = 'ev_g6b_cast_a';
const CAST_B = 'ev_g6b_cast_b';
function withCastNpcs(project: Project): Project {
  const a = runOn(project, 'make_villager', { mapId: MAP, name: '새 주민 가', home: { x: 15, y: 5 }, id: CAST_A, movement: 'fixed', dialogue: [{ text: '……' }] });
  return runOn(a, 'make_villager', { mapId: MAP, name: '새 주민 나', home: { x: 17, y: 6 }, id: CAST_B, movement: 'fixed', dialogue: [{ text: '……' }] });
}
type Resident = { eventId: string; name: string; role: string; line: string };

const npcCast: Family = {
  id: 'npc-cast',
  area: 'town',
  mode: 'write',
  title: '이름 없는 주민들에게 이름·역할·대사를 채우고 세계관에 등록한다',
  variants: [
    { key: 'one-fisher', prompt: '「새 주민 가」에게 어부 「은호」라는 이름과 「새벽 그물을 걷는 중이에요.」라는 대사를 채워 줘.', args: { residents: [{ eventId: CAST_A, name: '은호', role: '어부', line: '새벽 그물을 걷는 중이에요.' }] } },
    { key: 'two-polite', prompt: '새 주민 두 명에게 각각 이름과 역할, 대사를 지어 주세요. 「새 주민 가」는 제빵사 「다래」(「빵이 막 나왔어요.」), 「새 주민 나」는 대장장이 「철수」(「칼이 필요하면 말해.」)로요.', args: { residents: [{ eventId: CAST_A, name: '다래', role: '제빵사', line: '빵이 막 나왔어요.' }, { eventId: CAST_B, name: '철수', role: '대장장이', line: '칼이 필요하면 말해.' }] } },
    { key: 'terse-guard', prompt: '새 주민 나 → 경비병 「한울」, 대사 「밤길 조심하게.」', args: { residents: [{ eventId: CAST_B, name: '한울', role: '경비병', line: '밤길 조심하게.' }] } },
    { key: 'swap-roles', prompt: '「새 주민 가」는 약초꾼 「미나」(「산에서 약초를 캐 왔어요.」), 「새 주민 나」는 사냥꾼 「도윤」(「오늘은 사슴을 봤지.」) 으로 정해 줘.', args: { residents: [{ eventId: CAST_A, name: '미나', role: '약초꾼', line: '산에서 약초를 캐 왔어요.' }, { eventId: CAST_B, name: '도윤', role: '사냥꾼', line: '오늘은 사슴을 봤지.' }] } },
    { key: 'only-one-explained', prompt: '「새 주민 나」만 우물지기 「서아」로 만들어 줘. 대사는 「물이 참 맑지요.」 그리고 「새 주민 가」는 건드리지 마.', args: { residents: [{ eventId: CAST_B, name: '서아', role: '우물지기', line: '물이 참 맑지요.' }] } },
  ],
  prepare: withCastNpcs,
  judge(input, args) {
    const residents = args.residents as Resident[];
    const touched = residents.map(resident => resident.eventId);
    for (const resident of residents) {
      const after = eventIn(input.after, resident.eventId);
      if (!after) return fail(resident.eventId + ' 이벤트가 사라졌다');
      if (!String(after.name ?? '').includes(resident.name) && !(after.pages ?? []).some((page: any) => String(page.name ?? '').includes(resident.name))) return fail(resident.eventId + ' 이름이 「' + resident.name + '」 가 아니다');
      const spoken = commandsOfKind(after, 'text');
      if (!spoken.some(command => String(command.body ?? '').includes(resident.line))) return fail(resident.eventId + ' 대사 「' + resident.line + '」 가 없다');
      if (!spoken.every(command => command.speaker === undefined || String(command.speaker).includes(resident.name))) return fail(resident.eventId + ' 화자가 「' + resident.name + '」 가 아니다');
    }
    const untouched = [CAST_A, CAST_B].filter(id => !touched.includes(id));
    for (const id of untouched) if (!isDeepStrictEqual(eventIn(input.before, id), eventIn(input.after, id))) return fail(id + ' 은 요청하지 않았는데 바뀌었다');
    const world: any = (input.after as any).world;
    for (const resident of residents) {
      const entity = (world?.entities ?? []).find((entry: any) => entry.type === 'character' && entry.name === resident.name && (entry.refs ?? []).some((ref: any) => ref.kind === 'event' && ref.id === resident.eventId));
      if (!entity) return fail(resident.name + ' 이(가) 세계관(world)에 인물로 등록되지 않았다');
    }
    const blank = (doc: any) => { withoutEvent(...touched)(doc); delete doc.world; };
    return sameExcept(input.before, input.after, blank) ? pass('주민 ' + residents.length + '명 캐스트 적용·세계관 등록') : fail('주민 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'author_npc_cast', { mapId: MAP, residents: (args.residents as Resident[]).map(resident => ({
      eventId: resident.eventId, name: resident.name, role: resident.role, summary: resident.role + ' ' + resident.name,
      pages: [{ pageId: resident.eventId + '_page', lines: [resident.line] }] })) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const residents = args.residents as Resident[];
    const reference = npcCast.reference!(clone(project), args) as Project;
    const cast = (list: Resident[]) => attempt(() => runOn(clone(project), 'author_npc_cast', { mapId: MAP, residents: list.map(resident => ({
      eventId: resident.eventId, name: resident.name, role: resident.role, summary: resident.role + ' ' + resident.name,
      pages: [{ pageId: resident.eventId + '_page', lines: [resident.line] }] })) }));
    const first = residents[0]!;
    const rename = (event: string, name: string, line: string) => attempt(() => runOn(clone(project), 'patch_event_page', { mapId: MAP, eventId: event, pageIndex: 0, set: { name, commands: [{ kind: 'text', speaker: name, body: line }] } }));
    return distinct(reference, [
      cast([{ ...first, line: '……' }, ...residents.slice(1)]),
      cast([{ ...first, name: first.name + '이' }, ...residents.slice(1)]),
      residents.length > 1 ? cast(residents.slice(0, 1)) : cast([{ ...first, eventId: first.eventId === CAST_A ? CAST_B : CAST_A }]),
      // 대사만 바꾸고 세계관 등록이 없는 부분 수행
      attempt(() => { let next = clone(project); for (const resident of residents) next = runOn(next, 'patch_event_page', { mapId: MAP, eventId: resident.eventId, pageIndex: 0, set: { name: resident.name, commands: [{ kind: 'text', speaker: resident.name, body: resident.line }] } }); return next; }),
      void rename,
    ].filter(Boolean) as Array<Project | undefined>);
  },
};

export const GROUP_6B_NPC: readonly Family[] = [npcBlocks, npcShopNew, villagerDialogue, npcPatrol, npcCast];
