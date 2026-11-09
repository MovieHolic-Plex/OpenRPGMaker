import type { Project } from '../../../../project/types';
import { MAP, clone, fail, pass, runOn, sameExcept, withoutTiles } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import { eventEditOn, eventOn } from './group-4-shared';
import { attempt, commandsOfKind, deepCommands, distinct, newEventsOn, newRows, keepsRows, withoutFlags, withoutRows } from './group-6b-shared';

const PLAZA = 'map_plaza';
type Cell = { x: number; y: number };
const textsOf = (event: any): string[] => commandsOfKind(event, 'text').map(command => String(command.body ?? ''));
const blankNew = (ids: string[]) => (doc: any) => {
  for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id));
  withoutFlags(doc);
};

// ── chest-storage ──────────────────────────────────────────────────────────

const chestStorage: Family = {
  id: 'chest-storage',
  area: 'container',
  mode: 'write',
  title: '소지품을 넣고 빼는 보관 상자',
  variants: [
    { key: 'farm-default', prompt: '(15,5) 칸에 소지품을 넣고 뺄 수 있는 보관 상자를 놓아줘.', args: { x: 15, y: 5 } },
    { key: 'warehouse-polite', prompt: '(17,6) 칸에 「창고 상자」라는 이름의 보관 상자를 두어 주세요. 창고 템플릿으로요.', args: { x: 17, y: 6, name: '창고 상자', template: 'warehouse' } },
    { key: 'vault-terse', prompt: '(9,13)에 금고 보관함.', args: { x: 9, y: 13, template: 'vault' } },
    { key: 'farm-displayname', prompt: '농장 느낌으로 (14,15) 에 보관 상자를 놓고, 열었을 때 창에 「농장 창고」라고 보이게 해 줘.', args: { x: 14, y: 15, template: 'farm', displayName: '농장 창고' } },
    { key: 'not-reward-explained', prompt: '(19,3) 칸에 보관 상자를 놓아 줘. 열면 아이템을 주는 보물상자가 아니라, 넣어 둔 물건을 다시 꺼낼 수 있는 상자야. 다른 이벤트는 건드리지 마.', args: { x: 19, y: 3 } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const event = fresh[0];
    if (event.x !== x || event.y !== y) return fail('상자 위치 (' + event.x + ',' + event.y + ') — (' + x + ',' + y + ') 여야 한다');
    const opens = commandsOfKind(event, 'openChest');
    if (opens.length !== 1) return fail('보관 상자 열기(openChest) 명령이 ' + opens.length + '개다(하나여야 한다)');
    if (commandsOfKind(event, 'changeItem', 'changeGold').length) return fail('보관 상자인데 아이템·골드를 지급하는 명령이 있다(보물상자가 됐다)');
    if (typeof args.template === 'string' && opens[0].template !== args.template) return fail('템플릿 ' + opens[0].template + ' — ' + args.template + ' 여야 한다');
    if (typeof args.displayName === 'string' && opens[0].displayName !== args.displayName) return fail('표시 이름 ' + opens[0].displayName + ' — ' + args.displayName + ' 여야 한다');
    if (typeof args.name === 'string' && !String(event.name ?? '').includes(String(args.name)) && !(event.pages ?? []).some((page: any) => String(page.name ?? '').includes(String(args.name)))) return fail('이벤트 이름에 「' + args.name + '」 가 없다');
    return sameExcept(input.before, input.after, blankNew([event.id])) ? pass('(' + x + ',' + y + ') 보관 상자(' + opens[0].template + ')') : fail('상자 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const call: Record<string, unknown> = { mapId: MAP, x: args.x, y: args.y };
    for (const key of ['name', 'template', 'displayName']) if (args[key] !== undefined) call[key] = args[key];
    return runOn(project, 'place_storage_chest', call);
  },
  wrongs(project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const reference = chestStorage.reference!(clone(project), args) as Project;
    const base: Record<string, unknown> = { mapId: MAP, x, y };
    for (const key of ['name', 'template', 'displayName']) if (args[key] !== undefined) base[key] = args[key];
    const storage = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'place_storage_chest', { ...base, ...patch }));
    const other = args.template === 'vault' ? 'farm' : 'vault';
    return distinct(reference, [
      storage({ x: x + 3, y: y + 2 }),
      typeof args.template === 'string' ? storage({ template: other }) : undefined,
      // 소지품 보관이 아니라 보물상자(1회 보상)를 놓은 오답
      attempt(() => runOn(clone(project), 'place_chest', { mapId: MAP, x, y, contents: { itemId: 'item_potion' } })),
      typeof args.displayName === 'string' ? storage({ displayName: '상자' }) : undefined,
    ]);
  },
};

// ── search-containers ──────────────────────────────────────────────────────

type Box = { x: number; y: number; style: string; name: string; itemId?: string; count?: number; gold?: number; ownerId?: string };

const searchContainers: Family = {
  id: 'search-containers',
  area: 'container',
  mode: 'write',
  title: '뒤지면 전리품이 나오는 통·상자·항아리(처음 한 번만)',
  variants: [
    { key: 'barrel-gold', prompt: '(15,5) 칸에 뒤질 수 있는 통을 놓고, 뒤지면 30골드가 나오게 해줘. 한 번 뒤지면 다시는 안 나와야 해.', args: { boxes: [{ x: 15, y: 5, style: 'barrel', name: '통', gold: 30 }] } },
    { key: 'crate-potion-polite', prompt: '(16,5) 칸에 나무 상자를 두고, 뒤지면 회복약이 2개 나오도록 해 주세요. 처음 한 번만요.', args: { boxes: [{ x: 16, y: 5, style: 'crate', name: '나무 상자', itemId: 'item_potion', count: 2 }] } },
    { key: 'jar-empty-terse', prompt: '(17,5)에 빈 항아리. 뒤지면 아무것도 없다고.', args: { boxes: [{ x: 17, y: 5, style: 'jar', name: '항아리' }] } },
    { key: 'three-mixed', prompt: '(15,12) 통에는 10골드, (16,12) 나무 상자에는 약초(회복약 말고 item_herb_green), (17,12) 항아리는 비워 둔 채로 뒤질 수 있는 수납 세 개를 한꺼번에 놓아 줘.', args: { boxes: [{ x: 15, y: 12, style: 'barrel', name: '통', gold: 10 }, { x: 16, y: 12, style: 'crate', name: '나무 상자', itemId: 'item_herb_green', count: 1 }, { x: 17, y: 12, style: 'jar', name: '항아리' }] } },
    { key: 'owner-watch-explained', prompt: '(18,9) 칸에 마을 주민이 지켜보는 나무 상자를 놓아 줘. 뒤져서 마력약 한 개를 얻을 수 있지만, 주민이 보고 있으면 「남의 물건에 손대지 마!」 하고 꾸중하게. 주민 이벤트는 그대로 두고.', args: { boxes: [{ x: 18, y: 9, style: 'crate', name: '나무 상자', itemId: 'item_ether', count: 1, ownerId: 'ev_utility_npc' }], caughtLine: '남의 물건에 손대지 마!' } },
  ],
  judge(input, args) {
    const boxes = args.boxes as Box[];
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== boxes.length) return fail('새 이벤트가 ' + fresh.length + '개 — 수납 ' + boxes.length + '개여야 한다');
    for (const box of boxes) {
      const event = fresh.find(entry => entry.x === box.x && entry.y === box.y);
      if (!event) return fail('(' + box.x + ',' + box.y + ') 에 수납이 없다');
      const all = deepCommands(event);
      const items = all.filter(command => command.kind === 'changeItem'), golds = all.filter(command => command.kind === 'changeGold');
      if (box.itemId) {
        if (!items.length || items.some(command => command.itemId !== box.itemId || command.amount !== (box.count ?? 1))) return fail('(' + box.x + ',' + box.y + ') 전리품 아이템이 ' + box.itemId + ' ×' + (box.count ?? 1) + ' 가 아니다: ' + JSON.stringify(items));
      } else if (items.length) return fail('(' + box.x + ',' + box.y + ') 요청하지 않은 아이템 전리품이 있다');
      if (box.gold) {
        if (!golds.length || golds.some(command => command.amount !== box.gold)) return fail('(' + box.x + ',' + box.y + ') 골드가 ' + box.gold + ' 가 아니다: ' + JSON.stringify(golds));
      } else if (golds.length) return fail('(' + box.x + ',' + box.y + ') 요청하지 않은 골드 전리품이 있다');
      const pages: any[] = event.pages ?? [];
      const spent = pages.filter(page => (page.conditions ?? []).some((condition: any) => condition.kind === 'selfSwitch'));
      if (!spent.length) return fail('(' + box.x + ',' + box.y + ') 이미 뒤진 뒤의 페이지(셀프스위치 조건)가 없다 — 다시 뒤지면 또 나온다');
      if (spent.some(page => deepCommands({ pages: [page] }).some(command => command.kind === 'changeItem' || command.kind === 'changeGold'))) return fail('(' + box.x + ',' + box.y + ') 이미 뒤진 뒤에도 전리품이 나온다');
      if (!String(event.name ?? '').includes(box.name)) return fail('(' + box.x + ',' + box.y + ') 이름 「' + event.name + '」 — 「' + box.name + '」 여야 한다');
      if (box.ownerId) {
        const owner = String(eventOn(input.after, MAP, box.ownerId)?.name ?? '');
        const lines = textsOf(event).concat(...deepCommands(event).filter(command => command.kind === 'text' && command.speaker === owner).map(command => [String(command.body ?? '')]));
        if (!deepCommands(event).some(command => command.kind === 'text' && command.speaker === owner && String(command.body ?? '').includes(String(args.caughtLine)))) return fail('(' + box.x + ',' + box.y + ') 주인(' + owner + ')의 꾸중 「' + args.caughtLine + '」 가 없다: ' + lines.join('|'));
      }
    }
    const blank = (doc: any) => { blankNew(fresh.map(event => event.id))(doc); withoutTiles(doc); };
    return sameExcept(input.before, input.after, blank) ? pass('수납 ' + boxes.length + '개') : fail('수납 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'place_search_containers', { mapId: MAP, containers: (args.boxes as Box[]).map(box => ({
      x: box.x, y: box.y, style: box.style,
      ...(box.itemId || box.gold ? { loot: { ...(box.itemId ? { itemId: box.itemId, count: box.count ?? 1 } : {}), ...(box.gold ? { gold: box.gold } : {}) } } : {}),
      ...(box.ownerId ? { ownerId: box.ownerId, caughtLines: [String(args.caughtLine)] } : {}),
    })) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const boxes = args.boxes as Box[];
    const reference = searchContainers.reference!(clone(project), args) as Project;
    const build = (list: Box[], extra: Record<string, unknown> = {}) => attempt(() => runOn(clone(project), 'place_search_containers', { mapId: MAP, containers: list.map(box => ({
      x: box.x, y: box.y, style: box.style,
      ...(box.itemId || box.gold ? { loot: { ...(box.itemId ? { itemId: box.itemId, count: box.count ?? 1 } : {}), ...(box.gold ? { gold: box.gold } : {}) } } : {}),
      ...(box.ownerId ? { ownerId: box.ownerId, caughtLines: [String(args.caughtLine)] } : {}), ...extra })) }));
    const first = boxes[0]!;
    return distinct(reference, [
      build([{ ...first, x: first.x + 3, y: first.y + 1 }, ...boxes.slice(1)]),
      boxes.length > 1 ? build(boxes.slice(0, -1)) : build([{ ...first, gold: (first.gold ?? 0) + 70, itemId: undefined }]),
      build([{ ...first, itemId: undefined, gold: undefined }, ...boxes.slice(1)]),
      first.itemId ? build([{ ...first, count: (first.count ?? 1) + 1 }, ...boxes.slice(1)]) : build([{ ...first, itemId: 'item_potion', count: 1 }, ...boxes.slice(1)]),
      // 한 번만 나오지 않는 오답: 뒤진 뒤 페이지를 지운다
      attempt(() => {
        const next = build(boxes) as Project;
        for (const box of boxes) { const event = eventOn(next, MAP, newEventsOn(project, next).find(entry => entry.x === box.x && entry.y === box.y)!.id); event.pages = event.pages.slice(0, 1); }
        return next;
      }),
    ]);
  },
};

// ── examine-hotspots ───────────────────────────────────────────────────────

type Spot = { x: number; y: number; name: string; lines: string[]; once?: boolean; itemId?: string };

const examineHotspots: Family = {
  id: 'examine-hotspots',
  area: 'container',
  mode: 'write',
  title: '조사 지점(말 한 줄, 한 번만, 아이템 줍기)',
  variants: [
    { key: 'frame-once', prompt: '(15,5) 칸에 「낡은 액자」를 조사하면 「먼지가 쌓여 있다.」라고 말하게 해줘. 한 번 조사하면 그 뒤로는 조용히 넘어가게.', args: { spots: [{ x: 15, y: 5, name: '낡은 액자', lines: ['먼지가 쌓여 있다.'], once: true }] } },
    { key: 'two-spots-polite', prompt: '(15,12)에는 「책장」 조사 시 「오래된 책들이 빼곡하다.」, (17,12)에는 「벽난로」 조사 시 「불씨가 꺼져 있다.」라고 나오는 조사 지점 두 개를 만들어 주세요.', args: { spots: [{ x: 15, y: 12, name: '책장', lines: ['오래된 책들이 빼곡하다.'] }, { x: 17, y: 12, name: '벽난로', lines: ['불씨가 꺼져 있다.'] }] } },
    { key: 'key-pickup', prompt: '(9,13) 「열쇠 구멍 아래 틈」을 조사하면 낡은 열쇠를 줍게 해줘. 「틈 사이에서 열쇠가 나왔다.」라고 뜨고.', args: { spots: [{ x: 9, y: 13, name: '열쇠 구멍 아래 틈', lines: ['틈 사이에서 열쇠가 나왔다.'], itemId: 'item_old_key' }] } },
    { key: 'terse-sign', prompt: '(19,3) 「표지판」 조사: 「북쪽 숲은 위험하다.」', args: { spots: [{ x: 19, y: 3, name: '표지판', lines: ['북쪽 숲은 위험하다.'] }] } },
    { key: 'three-lines-explained', prompt: '(18,9) 칸의 「오래된 우물」을 조사하면 두 줄이 차례로 나오게 해 줘. 「깊이를 알 수 없다.」 그리고 「돌을 던지니 한참 뒤에 소리가 났다.」 기존 이벤트는 건드리지 마.', args: { spots: [{ x: 18, y: 9, name: '오래된 우물', lines: ['깊이를 알 수 없다.', '돌을 던지니 한참 뒤에 소리가 났다.'] }] } },
  ],
  judge(input, args) {
    const spots = args.spots as Spot[];
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== spots.length) return fail('새 이벤트가 ' + fresh.length + '개 — 조사 지점 ' + spots.length + '개여야 한다');
    for (const spot of spots) {
      const event = fresh.find(entry => entry.x === spot.x && entry.y === spot.y);
      if (!event) return fail('(' + spot.x + ',' + spot.y + ') 에 조사 지점이 없다');
      const kinds = [event.trigger?.kind, ...(event.pages ?? []).map((page: any) => page.trigger?.kind)];
      if (!kinds.includes('action')) return fail('(' + spot.x + ',' + spot.y + ') 조사(action) 방식이 아니다');
      const spoken = textsOf(event);
      for (const line of spot.lines) if (!spoken.some(body => body.includes(line))) return fail('(' + spot.x + ',' + spot.y + ') 대사 「' + line + '」 가 없다: ' + spoken.join('|'));
      const label = [event.name, ...(event.pages ?? []).map((page: any) => page.name)].join(' ');
      if (!label.includes(spot.name) && !spoken.some(body => body.includes(spot.name))) return fail('(' + spot.x + ',' + spot.y + ') 이름 「' + spot.name + '」 이 이벤트에 없다');
      const items = commandsOfKind(event, 'changeItem');
      if (spot.itemId) { if (items.length !== 1 || items[0].itemId !== spot.itemId) return fail('(' + spot.x + ',' + spot.y + ') 줍는 아이템이 ' + spot.itemId + ' 가 아니다'); }
      else if (items.length) return fail('(' + spot.x + ',' + spot.y + ') 요청하지 않은 아이템 지급이 있다');
      const gated = (event.pages ?? []).some((page: any) => (page.conditions ?? []).some((condition: any) => condition.kind === 'selfSwitch'));
      if (spot.once === true && !gated) return fail('(' + spot.x + ',' + spot.y + ') 한 번만 조사하게 하는 셀프스위치 페이지가 없다');
      if (spot.once !== true && gated) return fail('(' + spot.x + ',' + spot.y + ') 요청하지 않은 한 번만 조사 제한이 있다');
    }
    return sameExcept(input.before, input.after, blankNew(fresh.map(event => event.id))) ? pass('조사 지점 ' + spots.length + '개') : fail('조사 지점 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'place_examine_hotspots', { mapId: MAP, hotspots: (args.spots as Spot[]).map(spot => ({
      at: { x: spot.x, y: spot.y }, name: spot.name, lines: spot.lines, ...(spot.once ? { once: true } : {}), ...(spot.itemId ? { itemId: spot.itemId } : {}) })) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const spots = args.spots as Spot[];
    const reference = examineHotspots.reference!(clone(project), args) as Project;
    const build = (list: Spot[]) => attempt(() => runOn(clone(project), 'place_examine_hotspots', { mapId: MAP, hotspots: list.map(spot => ({
      at: { x: spot.x, y: spot.y }, name: spot.name, lines: spot.lines, ...(spot.once ? { once: true } : {}), ...(spot.itemId ? { itemId: spot.itemId } : {}) })) }));
    const first = spots[0]!;
    return distinct(reference, [
      build([{ ...first, x: first.x + 2, y: first.y + 1 }, ...spots.slice(1)]),
      build([{ ...first, lines: ['……'] }, ...spots.slice(1)]),
      spots.length > 1 ? build(spots.slice(0, -1)) : build([{ ...first, once: first.once !== true }]),
      first.itemId ? build([{ ...first, itemId: undefined }, ...spots.slice(1)]) : build([{ ...first, itemId: 'item_potion' }, ...spots.slice(1)]),
    ]);
  },
};

// ── chest-key-pair ─────────────────────────────────────────────────────────

type Pair = { keyName: string; keyDesc: string; chest: Cell; door: { mapId: string; eventId: string; x: number; y: number } };

const chestKeyPair: Family = {
  id: 'chest-key-pair',
  area: 'container',
  mode: 'write',
  title: '열쇠 아이템 + 그 열쇠를 주는 상자 + 열쇠로만 열리는 문',
  variants: [
    { key: 'cellar-key', prompt: '「지하실 열쇠」라는 열쇠 아이템을 만들고, (15,5) 상자를 열면 그 열쇠가 나오게 해줘. 그리고 마을 문은 그 열쇠가 있어야만 열리도록 잠가 줘.', args: { keyName: '지하실 열쇠', keyDesc: '지하실 문을 여는 열쇠', chest: { x: 15, y: 5 }, door: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8 } } },
    { key: 'brass-polite', prompt: '놋쇠 열쇠를 새 아이템으로 만들어 주세요. (17,6) 보물상자에 그 열쇠를 넣고, 광장에서 마을로 가는 문을 놋쇠 열쇠를 가진 사람만 지나가게 잠가 주세요.', args: { keyName: '놋쇠 열쇠', keyDesc: '놋쇠로 만든 열쇠', chest: { x: 17, y: 6 }, door: { mapId: PLAZA, eventId: 'ev_plaza_back', x: 1, y: 2 } } },
    { key: 'tower-terse', prompt: '「탑 열쇠」 아이템 추가, (9,13) 상자에 넣고, 마을 문을 그 열쇠로 잠가.', args: { keyName: '탑 열쇠', keyDesc: '탑의 문을 여는 열쇠', chest: { x: 9, y: 13 }, door: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8 } } },
    { key: 'silver-explained', prompt: '은 열쇠를 만들고 (19,3) 상자에 숨겨 줘. 은 열쇠를 가진 사람만 광장의 마을 문을 열 수 있게 하고, 열쇠가 없으면 「은 열쇠가 필요하다.」라고 말하게. 다른 이벤트는 건드리지 마.', args: { keyName: '은 열쇠', keyDesc: '은으로 만든 열쇠', chest: { x: 19, y: 3 }, door: { mapId: PLAZA, eventId: 'ev_plaza_back', x: 1, y: 2 }, lockedText: '은 열쇠가 필요하다.' } },
    { key: 'moon-key', prompt: '「달빛 열쇠」(설명: 달빛에 반짝이는 열쇠)를 아이템으로 등록하고, (14,15) 보물상자에서 얻게 한 다음, 마을 문을 이 열쇠로만 열리게 잠가 줘.', args: { keyName: '달빛 열쇠', keyDesc: '달빛에 반짝이는 열쇠', chest: { x: 14, y: 15 }, door: { mapId: MAP, eventId: 'ev_test_door', x: 20, y: 8 } } },
  ],
  judge(input, args) {
    const keyName = strArg(args, 'keyName');
    const chest = args.chest as Cell, door = args.door as Pair['door'];
    const added = newRows(input.before, input.after, 'items');
    if (added.length !== 1) return fail('새 아이템이 ' + added.length + '개다(열쇠 하나여야 한다)');
    const key = added[0];
    if (String(key.name ?? '').trim() !== keyName) return fail('열쇠 이름 「' + key.name + '」 — 「' + keyName + '」 여야 한다');
    const moved = keepsRows(input.before, input.after, 'items');
    if (moved) return fail(moved);
    const fresh = newEventsOn(input.before, input.after);
    const box = fresh.find(event => event.x === chest.x && event.y === chest.y);
    if (!box) return fail('(' + chest.x + ',' + chest.y + ') 에 상자가 없다');
    const grants = commandsOfKind(box, 'changeItem').filter(command => command.itemId === key.id && (command.op === '+=' || command.op === undefined) && (command.amount ?? 1) === 1);
    if (grants.length !== 1) return fail('상자가 새 열쇠(' + key.id + ')를 하나 주지 않는다');
    if (fresh.length !== 1) return fail('상자 말고 새 이벤트가 ' + (fresh.length - 1) + '개 더 있다');
    const blank = (doc: any) => { blankNew([box.id])(doc); withoutRows('items', [key.id])(doc); };
    // 문 이벤트는 따로 본다(문 이벤트가 같은 맵의 상자 판정에 섞이지 않게 문을 제외하고 비교).
    const result = eventEditOn(input, door.mapId, door.eventId, (before, after) => {
      const pages: any[] = after.pages ?? [];
      const open = pages.filter(page => (page.commands ?? []).some((command: any) => command.kind === 'transfer'));
      if (!open.length) return fail(door.eventId + ': 이동 명령이 사라졌다');
      const guarded = open.every(page => (page.conditions ?? []).some((condition: any) => condition.kind === 'item' && condition.itemId === key.id && condition.present !== false));
      if (!guarded) return fail(door.eventId + ': 열쇠(' + key.id + ')가 있을 때만 열리도록 잠기지 않았다');
      const first = pages.findIndex(page => (page.commands ?? []).some((command: any) => command.kind === 'transfer'));
      const locked = pages.slice(0, first).filter(page => !(page.commands ?? []).some((command: any) => command.kind === 'transfer') && !(page.conditions ?? []).length);
      if (!locked.length) return fail(door.eventId + ': 열쇠가 없을 때의 잠김 페이지가 없다');
      if (typeof args.lockedText === 'string' && !locked.some(page => commandsOfKind({ pages: [page] }, 'text').some(command => String(command.body ?? '').includes(String(args.lockedText))))) return fail(door.eventId + ': 안내 문구가 「' + args.lockedText + '」 를 포함하지 않는다');
      return pass('열쇠 ' + key.id + ' · 상자 (' + chest.x + ',' + chest.y + ') · 문 ' + door.eventId);
    }, { blank });
    return result;
  },
  reference(project, args) {
    const chest = args.chest as Cell, door = args.door as Pair['door'];
    const withKey = runOn(project, 'upsert_item', { item: { id: 'item_ref_key', name: strArg(args, 'keyName'), type: 'key', description: strArg(args, 'keyDesc') } });
    const withChest = runOn(withKey, 'place_chest', { mapId: MAP, x: chest.x, y: chest.y, contents: { itemId: 'item_ref_key' }, name: '상자' });
    return runOn(withChest, 'lock_door', { mapId: door.mapId, x: door.x, y: door.y, unlockWhen: { itemId: 'item_ref_key' }, lockedText: typeof args.lockedText === 'string' ? args.lockedText : '열쇠가 필요하다.' });
  },
  wrongs(project, args): FamilyOutcome[] {
    const chest = args.chest as Cell, door = args.door as Pair['door'];
    const reference = chestKeyPair.reference!(clone(project), args) as Project;
    const text = typeof args.lockedText === 'string' ? args.lockedText : '열쇠가 필요하다.';
    const withKey = () => runOn(clone(project), 'upsert_item', { item: { id: 'item_ref_key', name: strArg(args, 'keyName'), type: 'key', description: strArg(args, 'keyDesc') } });
    return distinct(reference, [
      // 문 잠금이 빠진 부분 수행
      attempt(() => runOn(withKey(), 'place_chest', { mapId: MAP, x: chest.x, y: chest.y, contents: { itemId: 'item_ref_key' } })),
      // 상자가 빠진 부분 수행
      attempt(() => runOn(withKey(), 'lock_door', { mapId: door.mapId, x: door.x, y: door.y, unlockWhen: { itemId: 'item_ref_key' }, lockedText: text })),
      // 상자가 열쇠가 아닌 다른 물건을 준다
      attempt(() => runOn(runOn(withKey(), 'place_chest', { mapId: MAP, x: chest.x, y: chest.y, contents: { itemId: 'item_potion' } }), 'lock_door', { mapId: door.mapId, x: door.x, y: door.y, unlockWhen: { itemId: 'item_ref_key' }, lockedText: text })),
      // 문이 열쇠가 아닌 기존 열쇠(낡은 열쇠)로 잠긴다
      attempt(() => runOn(runOn(withKey(), 'place_chest', { mapId: MAP, x: chest.x, y: chest.y, contents: { itemId: 'item_ref_key' } }), 'lock_door', { mapId: door.mapId, x: door.x, y: door.y, unlockWhen: { itemId: 'item_old_key' }, lockedText: text })),
      // 엉뚱한 아이템 이름
      attempt(() => runOn(runOn(runOn(clone(project), 'upsert_item', { item: { id: 'item_ref_key', name: '이름 없는 열쇠', type: 'key', description: 'x' } }), 'place_chest', { mapId: MAP, x: chest.x, y: chest.y, contents: { itemId: 'item_ref_key' } }), 'lock_door', { mapId: door.mapId, x: door.x, y: door.y, unlockWhen: { itemId: 'item_ref_key' }, lockedText: text })),
    ]);
  },
};

export const GROUP_6B_CONTAINER: readonly Family[] = [chestStorage, searchContainers, examineHotspots, chestKeyPair];
