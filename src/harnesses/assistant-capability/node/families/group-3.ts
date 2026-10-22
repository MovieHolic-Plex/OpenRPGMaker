import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import {
  MAP, EVENT_FIELDS, changedCells, called, clone, coordinatesIn, eventOf, fail, inside, keepsInOrder,
  mentions, pass, readOnly, runOn,
  type JudgeInput, type Verdict,
} from '../matrixNativeSpec';
import { numArg, rectArg, strArg, type Family, type FamilyOutcome } from './types';


const dbOf = (project: Project): any => (project as any).database ?? {};
const rows = (project: Project, name: string): any[] => dbOf(project)[name] ?? [];
const rowOf = (project: Project, name: string, id: string): any => rows(project, name).find((row: any) => row.id === id);
const sellableIds = (project: Project): Set<string> => new Set([...rows(project, 'items'), ...rows(project, 'equipment')].map((row: any) => row.id));

const strList = (args: Record<string, unknown>, key: string): string[] =>
  Array.isArray(args[key]) ? (args[key] as unknown[]).map(String) : [];
const optStr = (args: Record<string, unknown>, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};
const norm = (text: string) => text.replace(/\s+/gu, ' ').trim();

const walk = (commands: any[] | undefined): any[] => (commands ?? []).flatMap((command: any) => [
  command,
  ...(command?.kind === 'choices' ? (command.options ?? []).flatMap((option: any) => walk(option.branch)) : []),
  ...(command?.kind === 'choices' ? walk(command.cancelBranch) : []),
  ...(command?.kind === 'fork' ? [...walk(command.then), ...walk(command.else)] : []),
  ...(command?.kind === 'loop' ? walk(command.body) : []),
]);
const eventCommands = (event: any): any[] => [...(event?.commands ?? []), ...(event?.pages ?? []).flatMap((page: any) => walk(page.commands))];

const shopsOf = (event: any): any[] => eventCommands(event).filter((command: any) => command?.kind === 'shop');
/** A shop sells through both `itemIds` and `stock`; either one listing the good puts it on the counter. */
const shopGoods = (command: any): string[] => [...new Set<string>([
  ...((command?.itemIds ?? []) as string[]),
  ...((command?.stock ?? []) as any[]).map((entry: any) => entry?.itemId).filter((id: unknown): id is string => typeof id === 'string'),
])];

const blankCollections = (...names: string[]) => (doc: any) => {
  for (const name of names) if (Array.isArray(doc.database?.[name])) doc.database[name] = [];
};
const withoutEvent = (...ids: string[]) => (doc: any) => {
  for (const map of Object.values<any>(doc.maps ?? {})) map.events = (map.events ?? []).filter((event: any) => !ids.includes(event.id));
};
const withoutTilesHere = (doc: any) => {
  const map = doc.maps?.[MAP];
  if (!map) return;
  for (const key of EVENT_FIELDS) delete map[key];
};
/**
 * `normalizeContent` + structuredClone copies 30k-tile layers per call, which made this group's selfcheck minutes per
 * family. A shallow projection shares every subtree and only copies the map objects it blanks, so equality is the same
 * "everything else preserved" check without the clone.
 */
const projectExcept = (doc: any, blank: (copy: any) => void): any => {
  const copy: any = { ...doc };
  delete copy.meta; delete copy.tilesets; delete copy.assets;
  copy.maps = Object.fromEntries(Object.entries<any>(doc.maps ?? {}).map(([id, map]) => [id, { ...map }]));
  if (doc.database) copy.database = { ...doc.database };
  blank(copy);
  return copy;
};
const sameProjectExcept = (before: Project, after: Project, blank: (copy: any) => void) =>
  isDeepStrictEqual(projectExcept(before, blank), projectExcept(after, blank));
const tidy = (event: any) => {
  if (!event) return event;
  const copy = clone(event);
  for (const page of copy.pages ?? []) for (const command of page.commands ?? []) if (command.kind === 'choices' && Array.isArray(command.branch) && command.branch.length === 0) delete command.branch;
  return copy;
};
function eventEditHere(input: JudgeInput, id: string, check: (before: any, after: any) => Verdict): Verdict {
  if (!sameProjectExcept(input.before, input.after, withoutEvent(id))) return fail(`${id} 밖의 내용이 바뀌었다`);
  const before = tidy(eventOf(input.before, id)), after = tidy(eventOf(input.after, id));
  if (!before || !after) return fail(`${id} 이벤트가 사라졌다`);
  return check(before, after);
}
/** Everything except the named DB collections (and the boot dictionaries normalizeContent drops) is preserved. */
function dbEdit(input: JudgeInput, label: string, allow: string[], check: () => Verdict): Verdict {
  if (!sameProjectExcept(input.before, input.after, blankCollections(...allow))) return fail(`${label}: ${allow.join('·')} 밖의 내용이 바뀌었다`);
  return check();
}
const sameRows = (before: any[], after: any[], keep: (row: any) => boolean) =>
  isDeepStrictEqual(before.filter(keep), after.filter(keep));

const withDoc = (project: Project, mutate: (doc: any) => void): Project => {
  const doc: any = clone(project);
  mutate(doc);
  return doc;
};

const patchPage = (project: Project, eventId: string, pageIndex: number, set: Record<string, unknown>): Project =>
  runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex, set });

const withExtraLine = (project: Project, eventId: string, line: string): Project => {
  const event = eventOf(project, eventId);
  const pageIndex = 0;
  const commands = [...(event.pages?.[pageIndex]?.commands ?? []), { kind: 'text', body: line }];
  return patchPage(project, eventId, pageIndex, { commands });
};

const changedEvents = (before: Project, after: Project): any[] => {
  const out: any[] = [];
  for (const [mapId, map] of Object.entries<any>((before as any).maps)) {
    for (const event of map.events ?? []) {
      const next = ((after as any).maps[mapId]?.events ?? []).find((entry: any) => entry.id === event.id);
      if (!next || !isDeepStrictEqual(event, next)) out.push(event);
    }
  }
  return out;
};
const removedEventIds = (before: Project, after: Project): string[] => {
  const ids = new Set(Object.values<any>((after as any).maps).flatMap(map => (map.events ?? []).map((event: any) => event.id)));
  return Object.values<any>((before as any).maps).flatMap(map => (map.events ?? []).filter((event: any) => !ids.has(event.id)).map((event: any) => event.id));
};


const npcShop: Family = {
  id: 'npc-shop',
  area: 'npc',
  mode: 'write',
  title: 'NPC 대화에 상점 열기',
  variants: [
    { key: 'villager-polite', prompt: '이 주민과 대화하면 회복약과 해독초를 파는 상점이 열리게 해 주세요.', args: { eventId: 'ev_utility_npc', goods: ['item_potion', 'item_antidote'] }, setup: { event: 'ev_utility_npc' } },
    { key: 'inn-keeper-short', prompt: '여관 주인한테 상점도 붙여줘. 상급 회복약이랑 마력약.', args: { eventId: 'ev_ember_inn', goods: ['item_hi_potion', 'item_ether'] }, setup: { event: 'ev_ember_inn' } },
    { key: 'child-casual', prompt: '얘가 별사탕이랑 버터 과자를 팔게 해줘.', args: { eventId: 'ev_ember_child', goods: ['item_candy', 'item_cookie'] }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explained', prompt: '파수꾼 이벤트에 상점 명령을 하나 넣어 주세요. 파는 물건은 투척 단검과 독병이고, 지금 있는 대사는 그대로 두세요.', args: { eventId: 'ev_ember_guard', goods: ['item_throwing_knife', 'item_poison_vial'] }, setup: { event: 'ev_ember_guard' } },
    { key: 'equipment-goods', prompt: '잡화점 주인에게 철 검과 참나무 방패도 팔게 해 주세요.', args: { eventId: 'ev_test_shop', goods: ['equip_iron_sword', 'equip_oak_shield'] }, setup: { event: 'ev_test_shop' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const goods = strList(args, 'goods');
    const label = `${eventId} 상점`;
    return eventEditHere(input, eventId, (before, after) => {
      const shops = shopsOf(after);
      if (!shops.length) return fail(`${label}: 상점 명령이 없다`);
      const known = sellableIds(input.after);
      const stocked = shops.flatMap(shopGoods);
      const unknown = stocked.filter(id => !known.has(id));
      if (unknown.length) return fail(`${label}: 없는 물건 ${unknown.join(',')}`);
      const missing = goods.filter(id => !stocked.includes(id));
      if (missing.length) return fail(`${label}: 요청한 물건 ${missing.join(',')} 이 재고에 없다`);
      const beforeGoods = shopsOf(before).flatMap(shopGoods);
      const dropped = beforeGoods.filter(id => !stocked.includes(id));
      if (dropped.length) return fail(`${label}: 원래 팔던 물건 ${dropped.join(',')} 이 재고에서 빠졌다`);
      const was = (before.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind !== 'shop');
      const now = (after.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind !== 'shop');
      if (!keepsInOrder(was, now)) return fail(`${label}: 기존 대사·명령이 사라졌거나 순서가 바뀌었다`);
      return pass(`${label}: ${stocked.length}종 재고, 기존 대사 보존`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const goods = strList(args, 'goods');
    const existing = shopsOf(eventOf(project, eventId))[0];
    const existingStock = (existing?.stock ?? []) as any[];
    const untracked = shopGoods(existing).filter(id => !goods.includes(id) && !existingStock.some((entry: any) => entry?.itemId === id));
    const stock = [
      ...existingStock.filter((entry: any) => !goods.includes(entry?.itemId)),
      ...untracked.map(itemId => ({ itemId })),
      ...goods.map(itemId => ({ itemId })),
    ];
    return runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const goods = strList(args, 'goods');
    const other = (mapOfEvents(project).find((event: any) => event.id !== eventId && event.pages?.length)).id;
    const stockOf = (ids: string[]) => ids.map(itemId => ({ itemId }));
    const full = runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: stockOf(goods) });
    const replaced = (() => {
      const event = eventOf(full, eventId);
      const page = event.pages[0];
      const commands = page.commands.map((command: any, index: number) => (command.kind === 'text' && index === 0 ? { ...command, body: '어서 오세요! 좋은 물건 많습니다.' } : command));
      return patchPage(full, eventId, 0, { commands });
    })();
    const shopsBefore = shopsOf(eventOf(project, eventId)).flatMap(shopGoods);
    const wrongs: FamilyOutcome[] = [
      // 잘못된 대상: 다른 이벤트에 상점을 붙였다.
      runOn(project, 'set_shop_stock', { mapId: MAP, eventId: other, stock: stockOf(goods) }),
      // 부분 수행: 첫 물건만 넣었다.
      runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: stockOf(goods.slice(0, 1)) }),
      // 부작용: 상점은 붙였지만 기존 대사를 새로 썼다.
      replaced,
      // 잘못된 재고: 요청하지 않은 물건을 넣었다.
      runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: stockOf(['item_bread', 'item_water_flask']) }),
      // 상점 없이 대사만 늘렸다.
      withExtraLine(project, eventId, '오늘은 장사 안 합니다.'),
    ];
    // 재고를 새 물건으로 덮는 실패는 원래 팔던 물건이 있을 때만 실패다(빈 상점에 새로 차리는 것은 정답과 같다).
    if (shopsBefore.some(id => !goods.includes(id))) wrongs.push(runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: stockOf(goods) }));
    return wrongs;
  },
};

function mapOfEvents(project: Project): any[] {
  return ((project as any).maps[MAP]?.events ?? []) as any[];
}

const removeShopHerb: Family = {
  id: 'remove-shop-herb',
  area: 'npc',
  mode: 'write',
  title: '상점 재고에서 약초만 빼기',
  variants: [
    { key: 'polite-herb', prompt: '잡화점 주인 재고에서 약초만 빼 주세요. 상점 자체는 그대로 두고요.', args: { eventId: 'ev_test_shop', itemId: 'item_herb' }, setup: { event: 'ev_test_shop' } },
    { key: 'terse-potion', prompt: '잡화점, 회복약 빼.', args: { eventId: 'ev_test_shop', itemId: 'item_potion' }, setup: { event: 'ev_test_shop' } },
    { key: 'casual-herb', prompt: '여기 상점에서 약초는 안 팔게 해줘.', args: { eventId: 'ev_test_shop', itemId: 'item_herb' }, setup: { event: 'ev_test_shop' } },
    { key: 'explained-potion', prompt: '잡화점 재고에서 회복약(item_potion)만 제거해 주세요. 상점 명령과 다른 물건은 그대로 남겨 주세요.', args: { eventId: 'ev_test_shop', itemId: 'item_potion' }, setup: { event: 'ev_test_shop' } },
    { key: 'herbalist-herb', prompt: '약초 상인 재고에서 약초를 빼 주세요. 해독초는 계속 팔아야 합니다.', args: { eventId: 'ev_g3_herbalist', itemId: 'item_herb' }, setup: { event: 'ev_g3_herbalist' } },
  ],
  prepare(project) {
    // 덧붙이기 전용: 기존 이벤트·좌표·DB 행은 그대로 두고 약초 상인 하나만 더 놓는다.
    let next = runOn(project, 'place_npc', {
      mapId: MAP, x: 2, y: 3, name: '약초 상인', id: 'ev_g3_herbalist',
      pages: [{ lines: ['약초가 필요하신가요?'] }],
    });
    next = runOn(next, 'set_shop_stock', { mapId: MAP, eventId: 'ev_g3_herbalist', stock: [{ itemId: 'item_herb' }, { itemId: 'item_antidote' }] });
    return next;
  },
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const itemId = strArg(args, 'itemId');
    const label = `${eventId} −${itemId}`;
    return eventEditHere(input, eventId, (before, after) => {
      const left = shopsOf(after);
      if (!left.length) return fail(`${label}: 상점 명령이 통째로 사라졌다`);
      const was = shopsOf(before).flatMap(shopGoods);
      const now = left.flatMap(shopGoods);
      if (now.includes(itemId)) return fail(`${label}: 재고에 ${itemId} 이 아직 있다`);
      const lost = was.filter(id => id !== itemId && !now.includes(id));
      if (lost.length) return fail(`${label}: 다른 물건 ${lost.join(',')} 이 함께 빠졌다`);
      return pass(`${label}: 해당 물건만 재고에서 제거, 상점 유지`);
    });
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const itemId = strArg(args, 'itemId');
    const shop = shopsOf(eventOf(project, eventId))[0];
    const stock = (shop?.stock ?? []).filter((entry: any) => entry?.itemId !== itemId);
    const kept = stock.length ? stock : ((shop?.itemIds ?? []) as string[]).filter(id => id !== itemId).map(itemId2 => ({ itemId: itemId2 }));
    return runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: kept });
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const itemId = strArg(args, 'itemId');
    const shop = shopsOf(eventOf(project, eventId))[0];
    const others = shopGoods(shop).filter(id => id !== itemId);
    const removeShop = (() => {
      const event = eventOf(project, eventId);
      const commands = event.pages[0].commands.filter((command: any) => command.kind !== 'shop');
      return patchPage(project, eventId, 0, { commands });
    })();
    return [
      removeShop,
      // 잘못된 물건: 다른 물건을 뺐다(요청한 물건은 그대로).
      runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: [{ itemId: itemId }, ...others.slice(1).map(itemId2 => ({ itemId: itemId2 }))] }),
      // 부분 수행: itemIds 에서만 빼고 재고(stock)에는 남겼다.
      withDoc(project, doc => {
        const event = ((doc as any).maps[MAP].events as any[]).find(entry => entry.id === eventId);
        for (const page of event.pages ?? []) for (const command of page.commands ?? []) if (command.kind === 'shop') command.itemIds = (command.itemIds ?? []).filter((id: string) => id !== itemId);
      }),
      // 부작용: 상점은 고쳤지만 다른 이벤트도 바뀌었다.
      patchPage(runOn(project, 'set_shop_stock', { mapId: MAP, eventId, stock: others.map(itemId2 => ({ itemId: itemId2 })) }), 'ev_utility_npc', 0, { name: '마을 주민 (수정)' }),
    ];
  },
};

const placeChest: Family = {
  id: 'place-chest',
  area: 'events',
  mode: 'write',
  title: '보물상자 이벤트 배치',
  variants: [
    { key: 'potion-gold', prompt: '여기 (4,7) 칸에 회복약 하나와 30골드가 든 보물상자를 놓아 주세요.', args: { x: 4, y: 7, itemId: 'item_potion', gold: 30 }, setup: { select: { x: 4, y: 7, w: 1, h: 1 } } },
    { key: 'ether-short', prompt: '(10,3)에 마력약이랑 50골드짜리 상자.', args: { x: 10, y: 3, itemId: 'item_ether', gold: 50 }, setup: { select: { x: 10, y: 3, w: 1, h: 1 } } },
    { key: 'candy-casual', prompt: '(18,4)에 상자 하나 놓고 별사탕 넣어줘. 돈은 10골드만.', args: { x: 18, y: 4, itemId: 'item_candy', gold: 10 }, setup: { select: { x: 18, y: 4, w: 1, h: 1 } } },
    { key: 'antidote-explained', prompt: '선택한 (2,6) 칸에 해독초와 20골드가 나오는 보물상자를 만들어 주세요. 조사하면 열리는 상자여야 합니다.', args: { x: 2, y: 6, itemId: 'item_antidote', gold: 20 }, setup: { select: { x: 2, y: 6, w: 1, h: 1 } } },
    { key: 'hi-potion-polite', prompt: '맵 오른쪽 (14,4) 자리에 상급 회복약과 100골드가 들어 있는 보물상자를 하나 놓아 주시겠어요?', args: { x: 14, y: 4, itemId: 'item_hi_potion', gold: 100 }, setup: { select: { x: 14, y: 4, w: 1, h: 1 } } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const itemId = strArg(args, 'itemId');
    const gold = numArg(args, 'gold');
    const label = `상자 (${x},${y})`;
    const known = new Set(mapOfEvents(input.before).map((event: any) => event.id));
    const added = mapOfEvents(input.after).filter((event: any) => !known.has(event.id));
    if (added.length !== 1) return fail(`${label}: 새 이벤트가 ${added.length}개다`);
    const chest = added[0];
    if (chest.x !== x || chest.y !== y) return fail(`${label}: 상자가 (${chest.x},${chest.y}) 에 놓였다`);
    const commands = eventCommands(chest);
    const grantsItem = commands.some((command: any) => command?.kind === 'changeItem' && command.itemId === itemId);
    const grantsGold = commands.some((command: any) => command?.kind === 'changeGold' && Number(command.amount ?? 0) >= gold);
    if (!grantsItem) return fail(`${label}: ${itemId} 를 주는 명령이 없다`);
    if (!grantsGold) return fail(`${label}: ${gold}골드를 주는 명령이 없다`);
    if (!sameProjectExcept(input.before, input.after, withoutEvent(chest.id))) return fail(`${label}: 상자 밖의 내용이 바뀌었다`);
    return pass(`${label}: 상자 1개, ${itemId}·${gold}G 지급`);
  },
  reference(project, args) {
    return runOn(project, 'place_chest', {
      mapId: MAP, x: numArg(args, 'x'), y: numArg(args, 'y'),
      contents: { itemId: strArg(args, 'itemId'), gold: numArg(args, 'gold') }, name: '보물상자',
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const itemId = strArg(args, 'itemId');
    const gold = numArg(args, 'gold');
    const contents = { itemId, gold };
    return [
      // 잘못된 칸
      runOn(project, 'place_chest', { mapId: MAP, x: x + 2, y, contents }),
      // 부분 수행: 아이템만 넣고 골드를 빠뜨렸다.
      runOn(project, 'place_chest', { mapId: MAP, x, y, contents: { itemId } }),
      // 부작용: 상자는 놓았는데 다른 이벤트를 지웠다.
      runOn(runOn(project, 'place_chest', { mapId: MAP, x, y, contents }), 'remove_event', { mapId: MAP, eventId: 'ev_barrel_far' }),
      // 잘못된 보상: 다른 아이템.
      runOn(project, 'place_chest', { mapId: MAP, x, y, contents: { itemId: 'item_apple', gold } }),
    ];
  },
};

const potionPrice: Family = {
  id: 'potion-price',
  area: 'database',
  mode: 'write',
  title: '아이템 가격 변경',
  variants: [
    { key: 'potion-polite', prompt: '회복약 가격을 30골드로 바꿔 주세요. 다른 아이템 가격은 그대로 두세요.', args: { itemId: 'item_potion', price: 30 } },
    { key: 'ether-short', prompt: '마력약 값 100으로.', args: { itemId: 'item_ether', price: 100 } },
    { key: 'antidote-casual', prompt: '해독초 25골드로 내려줘.', args: { itemId: 'item_antidote', price: 25 } },
    { key: 'hi-potion-explained', prompt: '상급 회복약의 판매 가격을 120골드로 조정해 주세요. 나머지 아이템은 손대지 마세요.', args: { itemId: 'item_hi_potion', price: 120 } },
    { key: 'candy-terse', prompt: '별사탕 12골드.', args: { itemId: 'item_candy', price: 12 } },
  ],
  judge(input, args) {
    const itemId = strArg(args, 'itemId');
    const price = numArg(args, 'price');
    const label = `${itemId} 가격`;
    return dbEdit(input, label, ['items'], () => {
      const target = rowOf(input.after, 'items', itemId);
      if (!target) return fail(`${label}: 아이템이 사라졌다`);
      if (target.price !== price) return fail(`${label}: ${target.price}(요청 ${price})`);
      const before = rows(input.before, 'items'), after = rows(input.after, 'items');
      if (after.length !== before.length) return fail(`${label}: 아이템 수가 ${before.length} → ${after.length}`);
      if (!sameRows(before, after, (row: any) => row.id !== itemId)) return fail(`${label}: 다른 아이템이 바뀌었다`);
      return pass(`${label}: ${price}골드`);
    });
  },
  reference(project, args) {
    return runOn(project, 'upsert_item', { item: { id: strArg(args, 'itemId'), price: numArg(args, 'price') } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const itemId = strArg(args, 'itemId');
    const price = numArg(args, 'price');
    const other = rows(project, 'items').find((row: any) => row.id !== itemId && row.price > 0)?.id ?? 'item_bread';
    return [
      // 잘못된 대상
      runOn(project, 'upsert_item', { item: { id: other, price } }),
      // 잘못된 값
      runOn(project, 'upsert_item', { item: { id: itemId, price: price + 10 } }),
      // 부작용: 다른 아이템 가격도 함께 바꿨다.
      runOn(runOn(project, 'upsert_item', { item: { id: itemId, price } }), 'upsert_item', { item: { id: other, price: 999 } }),
      // 부분 수행: 아이템을 복제해 새 가격표만 만들었다.
      withDoc(project, doc => {
        const items = doc.database.items as any[];
        const target = items.find((row: any) => row.id === itemId);
        items.push({ ...clone(target), id: `${itemId}_cheap`, price });
      }),
    ];
  },
};

const swordAttack: Family = {
  id: 'sword-attack',
  area: 'database',
  mode: 'write',
  title: '장비 능력치 조정',
  variants: [
    { key: 'iron-sword', prompt: '철 검 공격력을 5 올려 주세요. 다른 장비는 그대로 두세요.', args: { equipmentId: 'equip_iron_sword', stat: 'attack', delta: 5 } },
    { key: 'steel-sword-short', prompt: '강철 검 공격력 +3.', args: { equipmentId: 'equip_steel_sword', stat: 'attack', delta: 3 } },
    { key: 'oak-shield-casual', prompt: '참나무 방패 방어력 2만 올려줘.', args: { equipmentId: 'equip_oak_shield', stat: 'defense', delta: 2 } },
    { key: 'mage-hat-explained', prompt: '별무늬 수습모의 정신력 보너스를 1 올려 주세요. 다른 부위 장비는 손대지 마세요.', args: { equipmentId: 'equip_mage_hat', stat: 'mind', delta: 1 } },
    { key: 'boots-polite', prompt: '바람길 가죽 장화의 민첩 보너스를 2 올려 주시겠어요?', args: { equipmentId: 'equip_boots', stat: 'agility', delta: 2 } },
  ],
  judge(input, args) {
    const equipmentId = strArg(args, 'equipmentId');
    const stat = strArg(args, 'stat');
    const delta = numArg(args, 'delta');
    const label = `${equipmentId} ${stat}`;
    const bonus = (row: any) => (row?.statBonuses?.[stat] ?? row?.stats?.[stat] ?? 0) as number;
    return dbEdit(input, label, ['equipment'], () => {
      const before = rowOf(input.before, 'equipment', equipmentId);
      const after = rowOf(input.after, 'equipment', equipmentId);
      if (!before || !after) return fail(`${label}: 장비가 사라졌다`);
      if (bonus(after) !== bonus(before) + delta) return fail(`${label}: ${bonus(before)} → ${bonus(after)} (요청 +${delta})`);
      const changedStats = Object.keys({ ...(before.statBonuses ?? {}), ...(after.statBonuses ?? {}) })
        .filter(key => key !== stat && (before.statBonuses?.[key] ?? 0) !== (after.statBonuses?.[key] ?? 0));
      if (changedStats.length) return fail(`${label}: 요청하지 않은 능력치(${changedStats.join(',')})도 바뀌었다`);
      if (!sameRows(rows(input.before, 'equipment'), rows(input.after, 'equipment'), (row: any) => row.id !== equipmentId)) return fail(`${label}: 다른 장비가 바뀌었다`);
      return pass(`${label}: ${bonus(before)} → ${bonus(after)}`);
    });
  },
  reference(project, args) {
    const equipmentId = strArg(args, 'equipmentId');
    const stat = strArg(args, 'stat');
    const current = rowOf(project, 'equipment', equipmentId)?.statBonuses ?? {};
    return runOn(project, 'upsert_equipment', { equipment: { id: equipmentId, statBonuses: { ...current, [stat]: (current[stat] ?? 0) + numArg(args, 'delta') } } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const equipmentId = strArg(args, 'equipmentId');
    const stat = strArg(args, 'stat');
    const delta = numArg(args, 'delta');
    const current = rowOf(project, 'equipment', equipmentId)?.statBonuses ?? {};
    const bump = (id: string, key: string, amount: number) => runOn(project, 'upsert_equipment', { equipment: { id, statBonuses: { ...(rowOf(project, 'equipment', id)?.statBonuses ?? {}), [key]: ((rowOf(project, 'equipment', id)?.statBonuses ?? {})[key] ?? 0) + amount } } });
    const other = rows(project, 'equipment').find((row: any) => row.id !== equipmentId && row.slot === 'weapon')?.id ?? 'equip_sword';
    const second = stat === 'defense' ? 'mind' : 'defense';
    return [
      // 잘못된 대상
      bump(other, stat, delta),
      // 잘못된 값(내림)
      bump(equipmentId, stat, -delta),
      // 부작용: 다른 능력치도 함께 올렸다.
      runOn(project, 'upsert_equipment', { equipment: { id: equipmentId, statBonuses: { ...current, [stat]: (current[stat] ?? 0) + delta, [second]: (current[second] ?? 0) + delta } } }),
      // 잘못된 대상(같은 부위의 다른 장비까지)
      runOn(bump(equipmentId, stat, delta), 'upsert_equipment', { equipment: { id: other, statBonuses: { ...(rowOf(project, 'equipment', other)?.statBonuses ?? {}), [stat]: ((rowOf(project, 'equipment', other)?.statBonuses ?? {})[stat] ?? 0) + delta } } }),
    ];
  },
};

const itemDescription: Family = {
  id: 'item-description',
  area: 'database',
  mode: 'write',
  title: '설명 없는 아이템에 설명 추가',
  variants: [
    { key: 'exact-line', prompt: '낡은 열쇠 아이템 설명을 "오래된 창고 문을 여는 열쇠." 로 넣어 주세요.', args: { itemId: 'item_old_key', description: '오래된 창고 문을 여는 열쇠.', exact: true } },
    { key: 'unnamed-fill', prompt: '설명이 비어 있는 아이템 하나에 어울리는 설명을 채워 줘.', args: { itemId: 'item_old_key', exact: false } },
    { key: 'old-key-polite', prompt: '낡은 열쇠 설명이 비어 있네요. 열쇠에 어울리는 설명 한 줄만 넣어 주세요.', args: { itemId: 'item_old_key', exact: false } },
    { key: 'terse', prompt: '낡은 열쇠 설명 추가.', args: { itemId: 'item_old_key', exact: false } },
    { key: 'explained', prompt: '낡은 열쇠 아이템에 설명을 붙여 주세요. 다른 아이템 설명은 건드리지 마세요.', args: { itemId: 'item_old_key', exact: false } },
  ],
  judge(input, args) {
    const itemId = strArg(args, 'itemId');
    const exact = args.exact === true;
    const wanted = optStr(args, 'description');
    const label = `${itemId} 설명`;
    return dbEdit(input, label, ['items'], () => {
      const before = rows(input.before, 'items'), after = rows(input.after, 'items');
      if (after.length !== before.length) return fail(`${label}: 아이템 수가 ${before.length} → ${after.length}`);
      const changed = after.filter((row: any) => !isDeepStrictEqual(row, before.find((old: any) => old.id === row.id)));
      if (changed.length !== 1) return fail(`${label}: 바뀐 아이템이 ${changed.length}개다`);
      const target = changed[0];
      if (target.id !== itemId) return fail(`${label}: ${target.id} 가 바뀌었다`);
      const description = String(target.description ?? '').trim();
      if (!description) return fail(`${label}: 설명이 비어 있다`);
      if (exact && wanted && norm(description) !== norm(wanted)) return fail(`${label}: 설명이 요청 문장과 다르다(「${description}」)`);
      const strip = (row: any) => ({ ...row, description: undefined });
      if (!isDeepStrictEqual(strip(target), strip(before.find((old: any) => old.id === itemId)))) return fail(`${label}: 설명 밖의 필드가 바뀌었다`);
      return pass(`${label}: 「${description}」`);
    });
  },
  reference(project, args) {
    const description = optStr(args, 'description') ?? '오래된 창고 문을 여는 열쇠.';
    return runOn(project, 'upsert_item', { item: { id: strArg(args, 'itemId'), description } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const itemId = strArg(args, 'itemId');
    const other = rows(project, 'items').find((row: any) => row.id !== itemId)?.id ?? 'item_potion';
    const described = '오래된 창고 문을 여는 열쇠.';
    return [
      // 잘못된 대상: 다른 아이템에 설명을 붙였다.
      runOn(project, 'upsert_item', { item: { id: other, description: described } }),
      // 부분 수행: 이름만 바꾸고 설명은 비워 뒀다.
      runOn(project, 'upsert_item', { item: { id: itemId, name: '창고 열쇠' } }),
      // 부작용: 설명을 붙이면서 다른 아이템 설명도 바꿨다.
      runOn(runOn(project, 'upsert_item', { item: { id: itemId, description: described } }), 'upsert_item', { item: { id: other, description: '설명을 새로 썼습니다.' } }),
      // 부작용: 설명을 붙이면서 가격까지 바꿨다.
      runOn(project, 'upsert_item', { item: { id: itemId, description: described, price: 500 } }),
    ];
  },
};

const createKeyItem: Family = {
  id: 'create-key-item',
  area: 'database',
  mode: 'write',
  title: '열쇠 아이템 만들기',
  variants: [
    { key: 'storage-polite', prompt: '창고 열쇠 아이템을 하나 만들어 주세요. 기존 아이템은 그대로 두세요.', args: { name: '창고 열쇠', id: 'item_g3_storage_key' } },
    { key: 'brass-short', prompt: '놋쇠 열쇠 아이템 추가.', args: { name: '놋쇠 열쇠', id: 'item_g3_brass_key' } },
    { key: 'cellar-casual', prompt: '지하실 열쇠 하나 새로 만들어줘.', args: { name: '지하실 열쇠', id: 'item_g3_cellar_key' } },
    { key: 'gold-explained', prompt: '퀘스트 보상으로 쓸 금빛 열쇠 아이템을 새로 등록해 주세요. 설명은 "성문을 여는 금빛 열쇠." 로 하고, 다른 아이템 항목은 바꾸지 마세요.', args: { name: '금빛 열쇠', id: 'item_g3_gold_key', description: '성문을 여는 금빛 열쇠.' } },
    { key: 'gate-terse', prompt: '성문 열쇠.', args: { name: '성문 열쇠', id: 'item_g3_gate_key' } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name');
    const label = `열쇠 아이템 ${name}`;
    return dbEdit(input, label, ['items'], () => {
      const before = rows(input.before, 'items'), after = rows(input.after, 'items');
      const known = new Set(before.map((row: any) => row.id));
      const added = after.filter((row: any) => !known.has(row.id));
      if (added.length !== 1) return fail(`${label}: 새 아이템이 ${added.length}개다`);
      if (after.length !== before.length + 1) return fail(`${label}: 아이템 수가 ${before.length} → ${after.length}`);
      const item = added[0];
      if (!/열쇠|key/iu.test(String(item.name ?? ''))) return fail(`${label}: 열쇠 아이템이 아니다(「${item.name}」)`);
      if (!sameRows(before, after, (row: any) => known.has(row.id))) return fail(`${label}: 기존 아이템이 바뀌었다`);
      return pass(`${label}: ${item.id} 추가, 기존 항목 보존`);
    });
  },
  reference(project, args) {
    return runOn(project, 'upsert_item', {
      item: {
        id: strArg(args, 'id'), name: strArg(args, 'name'), price: 0, type: 'special',
        description: optStr(args, 'description') ?? '특정 문을 여는 열쇠 아이템입니다.',
      },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const name = strArg(args, 'name');
    const id = strArg(args, 'id');
    const make = (item: Record<string, unknown>) => runOn(project, 'upsert_item', { item: { price: 0, type: 'special', ...item } });
    return [
      // 잘못된 대상: 새로 만들지 않고 기존 열쇠의 이름만 바꿨다.
      runOn(project, 'upsert_item', { item: { id: 'item_old_key', name } }),
      // 부분 수행: 하나만 만들고 사본을 하나 더 만들었다.
      runOn(make({ id, name }), 'upsert_item', { item: { id: `${id}_2`, name: `${name} 사본`, price: 0, type: 'special' } }),
      // 부작용: 아이템은 만들었지만 기존 아이템 가격을 바꿨다.
      runOn(make({ id, name }), 'upsert_item', { item: { id: 'item_potion', price: 999 } }),
      // 열쇠가 아닌 물건을 만들었다.
      make({ id, name: '창고 문 표식' }),
    ];
  },
};

const dbSkillCreate: Family = {
  id: 'db-skill-create',
  area: 'database',
  mode: 'write',
  title: '스킬 하나 만들기',
  variants: [
    { key: 'ember-wave-polite', prompt: '위력 120, MP 14를 쓰는 「잿불 파동」 스킬을 하나 만들어 주세요. 기존 스킬은 그대로 두세요.', args: { name: '잿불 파동', id: 'skill_g3_ember_wave', power: 120, mpCost: 14 } },
    { key: 'frost-needle-short', prompt: '「서리 침」 스킬 추가. 위력 90, MP 8.', args: { name: '서리 침', id: 'skill_g3_frost_needle', power: 90, mpCost: 8 } },
    { key: 'stone-fist-casual', prompt: '「바위 주먹」이라는 기술 만들어줘. 위력 110에 MP 12.', args: { name: '바위 주먹', id: 'skill_g3_stone_fist', power: 110, mpCost: 12 } },
    { key: 'gale-explained', prompt: '적 하나에게 쓰는 공격 기술 「돌풍 베기」를 새로 등록해 주세요. 위력은 75, MP 소모는 6이며, 다른 스킬 레코드는 손대지 마세요.', args: { name: '돌풍 베기', id: 'skill_g3_gale_slash', power: 75, mpCost: 6 } },
    { key: 'spark-terse', prompt: '「불꽃 파편」, 위력 60, MP 4.', args: { name: '불꽃 파편', id: 'skill_g3_spark', power: 60, mpCost: 4 } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name');
    const power = numArg(args, 'power');
    const mpCost = numArg(args, 'mpCost');
    const label = `스킬 ${name}`;
    return dbEdit(input, label, ['skills'], () => {
      const before = rows(input.before, 'skills'), after = rows(input.after, 'skills');
      const known = new Set(before.map((row: any) => row.id));
      const added = after.filter((row: any) => !known.has(row.id));
      if (added.length !== 1) return fail(`${label}: 새 스킬이 ${added.length}개다`);
      if (after.length !== before.length + 1) return fail(`${label}: 스킬 수가 ${before.length} → ${after.length}`);
      const ids = after.map((row: any) => row.id);
      if (new Set(ids).size !== ids.length) return fail(`${label}: id 가 중복됐다`);
      const skill = added[0];
      if (Number(skill.power) !== power) return fail(`${label}: 위력 ${skill.power}(요청 ${power})`);
      const cost = Number(skill.mpCost?.flat ?? skill.mpCost ?? 0);
      if (cost !== mpCost) return fail(`${label}: MP 소모 ${cost}(요청 ${mpCost})`);
      if (!sameRows(before, after, (row: any) => known.has(row.id))) return fail(`${label}: 기존 스킬이 바뀌었다`);
      return pass(`${label}: 위력 ${power}·MP ${mpCost}, 기존 스킬 보존`);
    });
  },
  reference(project, args) {
    return runOn(project, 'upsert_skill', {
      skill: {
        id: strArg(args, 'id'), name: strArg(args, 'name'), power: numArg(args, 'power'),
        mpCost: { flat: numArg(args, 'mpCost'), percentMax: 0 }, scope: 'enemy', effect: { kind: 'damage' },
        description: `${strArg(args, 'name')} 기술입니다.`,
      },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const name = strArg(args, 'name');
    const id = strArg(args, 'id');
    const power = numArg(args, 'power');
    const mpCost = numArg(args, 'mpCost');
    const make = (skill: Record<string, unknown>) => runOn(project, 'upsert_skill', { skill: { scope: 'enemy', effect: { kind: 'damage' }, description: `${name} 기술입니다.`, ...skill } });
    return [
      // 잘못된 값
      make({ id, name, power: power + 20, mpCost: { flat: mpCost, percentMax: 0 } }),
      // 부분 수행: 하나만 만들고 사본을 하나 더 만들었다.
      runOn(make({ id, name, power, mpCost: { flat: mpCost, percentMax: 0 } }), 'upsert_skill', { skill: { id: `${id}_2`, name: `${name} 2`, power, mpCost: { flat: mpCost, percentMax: 0 }, scope: 'enemy', effect: { kind: 'damage' } } }),
      // 부작용: 기존 스킬 위력까지 바꿨다.
      runOn(make({ id, name, power, mpCost: { flat: mpCost, percentMax: 0 } }), 'upsert_skill', { skill: { id: 'skill_fire', power: 999 } }),
      // MP 소모 누락
      make({ id, name, power }),
    ];
  },
};

const dbEnemyStat: Family = {
  id: 'db-enemy-stat',
  area: 'database',
  mode: 'write',
  title: '적 HP·공격력 올리기',
  variants: [
    { key: 'slime-polite', prompt: '슬라임의 최대 HP를 50, 공격력을 5 올려 주세요. 다른 능력치와 다른 적은 그대로 두세요.', args: { enemyId: 'enemy_slime', hpDelta: 50, attackDelta: 5 } },
    { key: 'bat-short', prompt: '동굴 박쥐 HP +30, 공격력 +4.', args: { enemyId: 'enemy_cave_bat', hpDelta: 30, attackDelta: 4 } },
    { key: 'golem-casual', prompt: '돌 골렘 체력 100 올리고 공격력도 10 올려줘.', args: { enemyId: 'enemy_stone_golem', hpDelta: 100, attackDelta: 10 } },
    { key: 'meadow-explained', prompt: '초원 슬라임을 조금 더 단단하게 만들어 주세요. 최대 HP를 20, 공격력을 3 올리되 방어력·민첩 같은 다른 수치는 건드리지 마세요.', args: { enemyId: 'enemy_meadow_slime', hpDelta: 20, attackDelta: 3 } },
    { key: 'dragon-terse', prompt: '붉은 드래곤 HP 200, 공격력 20 올려.', args: { enemyId: 'enemy_dragon', hpDelta: 200, attackDelta: 20 } },
  ],
  judge(input, args) {
    const enemyId = strArg(args, 'enemyId');
    const hpDelta = numArg(args, 'hpDelta');
    const attackDelta = numArg(args, 'attackDelta');
    const label = `${enemyId} 능력치`;
    return dbEdit(input, label, ['enemies'], () => {
      const before = rowOf(input.before, 'enemies', enemyId);
      const after = rowOf(input.after, 'enemies', enemyId);
      if (!before || !after) return fail(`${label}: 적이 사라졌다`);
      const hp = Number(after.stats?.maxHp ?? 0), attack = Number(after.stats?.attack ?? 0);
      if (hp !== Number(before.stats?.maxHp ?? 0) + hpDelta) return fail(`${label}: HP ${before.stats?.maxHp} → ${hp} (요청 +${hpDelta})`);
      if (attack !== Number(before.stats?.attack ?? 0) + attackDelta) return fail(`${label}: 공격력 ${before.stats?.attack} → ${attack} (요청 +${attackDelta})`);
      const keys = new Set([...Object.keys(before.stats ?? {}), ...Object.keys(after.stats ?? {})]);
      const changed = [...keys].filter(key => key !== 'maxHp' && key !== 'attack' && (before.stats?.[key] ?? 0) !== (after.stats?.[key] ?? 0));
      if (changed.length) return fail(`${label}: 요청하지 않은 수치(${changed.join(',')})도 바뀌었다`);
      if (!sameRows(rows(input.before, 'enemies'), rows(input.after, 'enemies'), (row: any) => row.id !== enemyId)) return fail(`${label}: 다른 적이 바뀌었다`);
      return pass(`${label}: HP ${hp}, 공격력 ${attack}`);
    });
  },
  reference(project, args) {
    const enemyId = strArg(args, 'enemyId');
    const stats = rowOf(project, 'enemies', enemyId)?.stats ?? {};
    return runOn(project, 'upsert_enemy', {
      enemy: { id: enemyId, stats: { ...stats, maxHp: (stats.maxHp ?? 0) + numArg(args, 'hpDelta'), attack: (stats.attack ?? 0) + numArg(args, 'attackDelta') } },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const enemyId = strArg(args, 'enemyId');
    const hpDelta = numArg(args, 'hpDelta');
    const attackDelta = numArg(args, 'attackDelta');
    const stats = rowOf(project, 'enemies', enemyId)?.stats ?? {};
    const other = rows(project, 'enemies').find((row: any) => row.id !== enemyId)?.id ?? 'enemy_slime';
    return [
      // 잘못된 대상
      runOn(project, 'upsert_enemy', { enemy: { id: other, stats: { ...(rowOf(project, 'enemies', other)?.stats ?? {}), maxHp: (rowOf(project, 'enemies', other)?.stats?.maxHp ?? 0) + hpDelta } } }),
      // 부분 수행: HP 만 올렸다.
      runOn(project, 'upsert_enemy', { enemy: { id: enemyId, stats: { ...stats, maxHp: (stats.maxHp ?? 0) + hpDelta } } }),
      // 부작용: 방어력까지 올렸다.
      runOn(project, 'upsert_enemy', { enemy: { id: enemyId, stats: { ...stats, maxHp: (stats.maxHp ?? 0) + hpDelta, attack: (stats.attack ?? 0) + attackDelta, defense: (stats.defense ?? 0) + 5 } } }),
      // 잘못된 값: 두 배로 올렸다.
      runOn(project, 'upsert_enemy', { enemy: { id: enemyId, stats: { ...stats, maxHp: (stats.maxHp ?? 0) + hpDelta * 2, attack: (stats.attack ?? 0) + attackDelta } } }),
    ];
  },
};

const dbClassSkillList: Family = {
  id: 'db-class-skill-list',
  area: 'database',
  mode: 'write',
  title: '클래스 습득 스킬 추가',
  variants: [
    { key: 'squire-polite', prompt: '견습 기사 클래스가 30레벨에 「브레이브 블레이드」를 배우게 해 주세요. 다른 클래스는 그대로 두세요.', args: { classId: 'class_squire', level: 30, skillId: 'skill_hero_brave_blade' } },
    { key: 'swordsman-short', prompt: '검객, 25레벨에 화염검.', args: { classId: 'class_swordsman', level: 25, skillId: 'skill_hero_flame_sword' } },
    { key: 'mage-casual', prompt: '마법사가 18레벨에 메테오 배우게 해줘.', args: { classId: 'class_mage', level: 18, skillId: 'skill_mage_meteor' } },
    { key: 'miner-explained', prompt: '광부 클래스의 습득 목록에 20레벨 「다이너마이트」를 추가해 주세요. 이미 있는 습득 항목은 지우지 마세요.', args: { classId: 'class_miner', level: 20, skillId: 'skill_miner_dynamite' } },
    { key: 'guard-terse', prompt: '수호 기사 24레벨 성스러운 방패.', args: { classId: 'class_guardian', level: 24, skillId: 'skill_guard_holy_shield' } },
  ],
  judge(input, args) {
    const classId = strArg(args, 'classId');
    const level = numArg(args, 'level');
    const skillId = strArg(args, 'skillId');
    const label = `${classId} Lv${level} ${skillId}`;
    return dbEdit(input, label, ['classes'], () => {
      const before = rowOf(input.before, 'classes', classId);
      const after = rowOf(input.after, 'classes', classId);
      if (!before || !after) return fail(`${label}: 클래스가 사라졌다`);
      const learned = (after.learnedSkills ?? []) as any[];
      if (!learned.some((entry: any) => Number(entry?.level) === level && entry?.skillId === skillId)) return fail(`${label}: 습득 항목이 없다`);
      const lost = ((before.learnedSkills ?? []) as any[]).filter(entry => !learned.some((next: any) => next?.level === entry?.level && next?.skillId === entry?.skillId));
      if (lost.length) return fail(`${label}: 기존 습득 항목 ${lost.length}개가 사라졌다`);
      if (!sameRows(rows(input.before, 'classes'), rows(input.after, 'classes'), (row: any) => row.id !== classId)) return fail(`${label}: 다른 클래스가 바뀌었다`);
      return pass(`${label}: 습득 목록에 추가`);
    });
  },
  reference(project, args) {
    const classId = strArg(args, 'classId');
    const learned = (rowOf(project, 'classes', classId)?.learnedSkills ?? []) as any[];
    return runOn(project, 'upsert_class', {
      class: { id: classId, learnedSkills: [...learned, { level: numArg(args, 'level'), skillId: strArg(args, 'skillId') }] },
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const classId = strArg(args, 'classId');
    const level = numArg(args, 'level');
    const skillId = strArg(args, 'skillId');
    const other = rows(project, 'classes').find((row: any) => row.id !== classId)?.id ?? 'class_berserker';
    const add = (id: string, lv: number, skill: string) => runOn(project, 'upsert_class', {
      class: { id, learnedSkills: [...((rowOf(project, 'classes', id)?.learnedSkills ?? []) as any[]), { level: lv, skillId: skill }] },
    });
    return [
      // 잘못된 대상
      add(other, level, skillId),
      // 잘못된 레벨
      add(classId, level + 5, skillId),
      // 부작용: 기존 습득 항목을 지우고 새 목록으로 덮었다.
      runOn(project, 'upsert_class', { class: { id: classId, learnedSkills: [{ level, skillId }] } }),
      // 부작용: 다른 클래스도 바꿨다.
      runOn(add(classId, level, skillId), 'upsert_class', { class: { id: other, learnedSkills: [...((rowOf(project, 'classes', other)?.learnedSkills ?? []) as any[]), { level, skillId }] } }),
    ];
  },
};

const dbItemPriceBatch: Family = {
  id: 'db-item-price-batch',
  area: 'database',
  mode: 'write',
  title: '여러 아이템 가격 한 번에',
  variants: [
    { key: 'two-items-polite', prompt: '회복약 30골드, 해독초 25골드로 바꿔 주세요. 다른 아이템 가격은 그대로 두세요.', args: { entries: [{ itemId: 'item_potion', price: 30 }, { itemId: 'item_antidote', price: 25 }] } },
    { key: 'three-items-short', prompt: '마력약 100, 각성초 30, 붉은 사과 15.', args: { entries: [{ itemId: 'item_ether', price: 100 }, { itemId: 'item_wake_herb', price: 30 }, { itemId: 'item_apple', price: 15 }] } },
    { key: 'food-casual', prompt: '호밀빵 20, 소금 주먹밥 25로 내려줘.', args: { entries: [{ itemId: 'item_bread', price: 20 }, { itemId: 'item_rice_ball', price: 25 }] } },
    { key: 'explained-batch', prompt: '상점 밸런스를 맞추려고 합니다. 상급 회복약 120골드, 만능약 50골드, 엘릭서 5000골드로 조정해 주세요. 나머지 아이템은 손대지 마세요.', args: { entries: [{ itemId: 'item_hi_potion', price: 120 }, { itemId: 'item_panacea', price: 50 }, { itemId: 'item_elixir', price: 5000 }] } },
    { key: 'tools-terse', prompt: '응급 붕대 40, 버터 과자 20.', args: { entries: [{ itemId: 'item_bandages', price: 40 }, { itemId: 'item_cookie', price: 20 }] } },
  ],
  judge(input, args) {
    const entries = (args.entries as Array<{ itemId: string; price: number }>) ?? [];
    const label = `가격 ${entries.map(entry => `${entry.itemId}=${entry.price}`).join(',')}`;
    return dbEdit(input, label, ['items'], () => {
      const before = rows(input.before, 'items'), after = rows(input.after, 'items');
      if (after.length !== before.length) return fail(`${label}: 아이템 수가 ${before.length} → ${after.length}`);
      const wrong = entries.filter(entry => rowOf(input.after, 'items', entry.itemId)?.price !== entry.price);
      if (wrong.length) return fail(`${label}: ${wrong.map(entry => `${entry.itemId}=${rowOf(input.after, 'items', entry.itemId)?.price}`).join(',')}`);
      const ids = new Set(entries.map(entry => entry.itemId));
      if (!sameRows(before, after, (row: any) => !ids.has(row.id))) return fail(`${label}: 나열하지 않은 아이템이 바뀌었다`);
      return pass(`${label}: ${entries.length}종 가격만 변경`);
    });
  },
  reference(project, args) {
    let next = project;
    for (const entry of (args.entries as Array<{ itemId: string; price: number }>) ?? []) next = runOn(next, 'upsert_item', { item: { id: entry.itemId, price: entry.price } });
    return next;
  },
  wrongs(project, args): FamilyOutcome[] {
    const entries = (args.entries as Array<{ itemId: string; price: number }>) ?? [];
    const first = entries[0]!;
    const other = rows(project, 'items').find((row: any) => !entries.some(entry => entry.itemId === row.id) && row.price > 0)?.id ?? 'item_bread';
    let all = project;
    for (const entry of entries) all = runOn(all, 'upsert_item', { item: { id: entry.itemId, price: entry.price } });
    return [
      // 부분 수행: 첫 항목만 바꿨다.
      runOn(project, 'upsert_item', { item: { id: first.itemId, price: first.price } }),
      // 잘못된 값: 마지막 항목 가격이 어긋났다.
      runOn(all, 'upsert_item', { item: { id: entries[entries.length - 1]!.itemId, price: entries[entries.length - 1]!.price + 10 } }),
      // 부작용: 나열하지 않은 아이템 가격까지 바꿨다.
      runOn(all, 'upsert_item', { item: { id: other, price: 999 } }),
      // 잘못된 대상: 나열한 아이템 대신 다른 아이템에 같은 가격을 넣었다.
      runOn(project, 'upsert_item', { item: { id: other, price: first.price } }),
    ];
  },
};

const dbTroopMemberCount: Family = {
  id: 'db-troop-member-count',
  area: 'database',
  mode: 'write',
  title: '트룹 구성 수 바꾸기',
  variants: [
    { key: 'bat-swarm-polite', prompt: '동굴 박쥐 떼 트룹의 적 수를 2마리로 줄여 주세요. 다른 트룹은 그대로 두세요.', args: { troopId: 'troop_bat_swarm', count: 2 } },
    { key: 'slime-pair-short', prompt: '초원 슬라임 둘을 네 마리로.', args: { troopId: 'troop_slime_pair', count: 4 } },
    { key: 'slime-casual', prompt: '슬라임 정찰대를 세 마리로 늘려줘.', args: { troopId: 'troop_slime', count: 3 } },
    { key: 'archers-explained', prompt: '광산 해골 궁수 트룹의 구성 인원을 2마리로 맞춰 주세요. 다른 트룹 구성은 건드리지 마세요.', args: { troopId: 'troop_mine_archers', count: 2 } },
    { key: 'hornets-terse', prompt: '숲 말벌 무리 5마리.', args: { troopId: 'troop_forest_hornets', count: 5 } },
  ],
  judge(input, args) {
    const troopId = strArg(args, 'troopId');
    const count = numArg(args, 'count');
    const label = `${troopId} ${count}마리`;
    return dbEdit(input, label, ['troops'], () => {
      const after = rowOf(input.after, 'troops', troopId);
      if (!after) return fail(`${label}: 트룹이 사라졌다`);
      const members = (after.members ?? []) as any[];
      const enemyIds = (after.enemyIds ?? []) as string[];
      const memberCount = members.length || enemyIds.length;
      if (memberCount !== count) return fail(`${label}: 구성 ${memberCount}마리`);
      if (enemyIds.length !== count) return fail(`${label}: enemyIds ${enemyIds.length}개, 구성 ${count}마리`);
      if (!sameRows(rows(input.before, 'troops'), rows(input.after, 'troops'), (row: any) => row.id !== troopId)) return fail(`${label}: 다른 트룹이 바뀌었다`);
      return pass(`${label}: 구성 ${memberCount}마리`);
    });
  },
  reference(project, args) {
    const troopId = strArg(args, 'troopId');
    const count = numArg(args, 'count');
    const enemyId = (rowOf(project, 'troops', troopId)?.enemyIds ?? [])[0];
    return runOn(project, 'upsert_troop', { troop: { id: troopId, enemyIds: Array.from({ length: count }, () => enemyId) } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const troopId = strArg(args, 'troopId');
    const count = numArg(args, 'count');
    const enemyId = (rowOf(project, 'troops', troopId)?.enemyIds ?? [])[0];
    const other = rows(project, 'troops').find((row: any) => row.id !== troopId)?.id ?? 'troop_slime';
    const set = (id: string, n: number) => runOn(project, 'upsert_troop', { troop: { id, enemyIds: Array.from({ length: n }, () => (rowOf(project, 'troops', id)?.enemyIds ?? [])[0]) } });
    return [
      // 잘못된 대상
      set(other, count),
      // 잘못된 수
      set(troopId, count + 1),
      // 부작용: 다른 트룹도 함께 바꿨다.
      runOn(set(troopId, count), 'upsert_troop', { troop: { id: other, enemyIds: Array.from({ length: count }, () => (rowOf(project, 'troops', other)?.enemyIds ?? [])[0]) } }),
      // 부분 수행: enemyIds 만 고치고 구성(members)은 옛 값으로 남겼다.
      withDoc(project, doc => {
        const troop = (doc.database.troops as any[]).find((row: any) => row.id === troopId);
        troop.enemyIds = Array.from({ length: count }, () => enemyId);
        troop.members = Array.from({ length: Math.max(1, count - 1) }, (_: unknown, index: number) => ({ enemyId, x: 96 + index * 56, y: 96, hidden: false }));
      }),
    ];
  },
};

const dbStateDuration: Family = {
  id: 'db-state-duration',
  area: 'database',
  mode: 'write',
  title: '상태 지속 턴 바꾸기',
  variants: [
    { key: 'poison-polite', prompt: '독 상태의 지속 턴을 5턴으로 바꿔 주세요. 다른 상태는 그대로 두세요.', args: { stateId: 'state_poison', turns: 5 } },
    { key: 'sleep-short', prompt: '수면 4턴으로.', args: { stateId: 'state_sleep', turns: 4 } },
    { key: 'paralysis-casual', prompt: '마비가 3턴만 지속되게 해줘.', args: { stateId: 'state_paralysis', turns: 3 } },
    { key: 'silence-explained', prompt: '침묵 상태의 자연 회복 시점을 6턴으로 조정해 주세요. 회복 확률과 다른 상태 값은 바꾸지 마세요.', args: { stateId: 'state_silence', turns: 6 } },
    { key: 'regen-terse', prompt: '재생 지속 7턴.', args: { stateId: 'state_regen', turns: 7 } },
  ],
  judge(input, args) {
    const stateId = strArg(args, 'stateId');
    const turns = numArg(args, 'turns');
    const label = `${stateId} ${turns}턴`;
    return dbEdit(input, label, ['states'], () => {
      const before = rowOf(input.before, 'states', stateId);
      const after = rowOf(input.after, 'states', stateId);
      if (!before || !after) return fail(`${label}: 상태가 사라졌다`);
      if (Number(after.recoverNaturallyFromTurn) !== turns) return fail(`${label}: 지속 ${after.recoverNaturallyFromTurn}턴`);
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      // 「턴 경과로 풀린다」는 지속 턴 설정에 딸린 같은 뜻의 서술이라 removalCondition 변경은 허용한다.
      const allowed = new Set(['recoverNaturallyFromTurn', 'removalCondition']);
      const changed = [...keys].filter(key => !allowed.has(key) && !isDeepStrictEqual(before[key], after[key]));
      if (changed.length) return fail(`${label}: 요청하지 않은 필드(${changed.join(',')})가 바뀌었다`);
      if (!sameRows(rows(input.before, 'states'), rows(input.after, 'states'), (row: any) => row.id !== stateId)) return fail(`${label}: 다른 상태가 바뀌었다`);
      return pass(`${label}: 지속 턴만 변경`);
    });
  },
  reference(project, args) {
    return runOn(project, 'upsert_state', { state: { id: strArg(args, 'stateId'), recoverNaturallyFromTurn: numArg(args, 'turns') } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const stateId = strArg(args, 'stateId');
    const turns = numArg(args, 'turns');
    const other = rows(project, 'states').find((row: any) => row.id !== stateId)?.id ?? 'state_sleep';
    return [
      // 잘못된 대상
      runOn(project, 'upsert_state', { state: { id: other, recoverNaturallyFromTurn: turns } }),
      // 잘못된 값
      runOn(project, 'upsert_state', { state: { id: stateId, recoverNaturallyFromTurn: turns + 2 } }),
      // 부작용: 회복 확률까지 바꿨다.
      runOn(project, 'upsert_state', { state: { id: stateId, recoverNaturallyFromTurn: turns, recoverNaturallyChance: 90 } }),
      // 부작용: 턴 피해 필드까지 건드렸다.
      runOn(project, 'upsert_state', { state: { id: stateId, recoverNaturallyFromTurn: turns, hpReleaseTurn: 1 } }),
    ];
  },
};

const chainDbItemThenShop: Family = {
  id: 'chain-db-item-then-shop',
  area: 'database',
  mode: 'write',
  title: '아이템을 만들고 상점에 올리기',
  variants: [
    { key: 'lantern-polite', prompt: '「등불 기름」 아이템을 40골드로 만들고, 잡화점 주인 재고에 넣어 주세요. 기존 아이템과 기존 상점 물건은 그대로 두세요.', args: { eventId: 'ev_test_shop', itemId: 'item_g3_lantern_oil', itemName: '등불 기름', price: 40 } },
    { key: 'rope-short', prompt: '「밧줄」 25골드로 만들고 잡화점에 팔게 해줘.', args: { eventId: 'ev_test_shop', itemId: 'item_g3_rope', itemName: '밧줄', price: 25 } },
    { key: 'compass-casual', prompt: '「낡은 나침반」을 150골드짜리로 하나 만들어서 잡화점 주인한테 팔게 해줘.', args: { eventId: 'ev_test_shop', itemId: 'item_g3_compass', itemName: '낡은 나침반', price: 150 } },
    { key: 'flask-explained', prompt: '잡화점에 새 물건을 들여놓으려 합니다. 「빈 물약병」 아이템을 15골드로 등록하고, 그 아이템이 잡화점 주인 상점 재고에 들어가게 해 주세요. 다른 아이템 가격과 기존 재고는 건드리지 마세요.', args: { eventId: 'ev_test_shop', itemId: 'item_g3_empty_flask', itemName: '빈 물약병', price: 15 } },
    { key: 'tinder-terse', prompt: '「불쏘시개」 10골드, 잡화점 재고에.', args: { eventId: 'ev_test_shop', itemId: 'item_g3_tinder', itemName: '불쏘시개', price: 10 } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const itemName = strArg(args, 'itemName');
    const price = numArg(args, 'price');
    const label = `${itemName} @${eventId}`;
    const allow = (doc: any) => { blankCollections('items')(doc); withoutEvent(eventId)(doc); };
    if (!sameProjectExcept(input.before, input.after, allow)) return fail(`${label}: 아이템·상점 이벤트 밖의 내용이 바뀌었다`);
    const before = rows(input.before, 'items'), after = rows(input.after, 'items');
    const known = new Set(before.map((row: any) => row.id));
    const added = after.filter((row: any) => !known.has(row.id));
    if (added.length !== 1) return fail(`${label}: 새 아이템이 ${added.length}개다`);
    const item = added[0];
    if (norm(String(item.name ?? '')) !== norm(itemName)) return fail(`${label}: 이름이 「${item.name}」`);
    if (Number(item.price) !== price) return fail(`${label}: 가격 ${item.price}(요청 ${price})`);
    if (!sameRows(before, after, (row: any) => known.has(row.id))) return fail(`${label}: 기존 아이템이 바뀌었다`);
    const shopBefore = shopsOf(eventOf(input.before, eventId)).flatMap(shopGoods);
    const shopAfter = shopsOf(eventOf(input.after, eventId)).flatMap(shopGoods);
    if (!shopAfter.includes(item.id)) return fail(`${label}: 만든 아이템이 상점 재고에 없다`);
    const dropped = shopBefore.filter(id => !shopAfter.includes(id));
    if (dropped.length) return fail(`${label}: 기존 상점 물건 ${dropped.join(',')} 이 빠졌다`);
    return pass(`${label}: 아이템 생성 + 재고 등록`);
  },
  reference(project, args) {
    const eventId = strArg(args, 'eventId');
    const itemId = strArg(args, 'itemId');
    const itemName = strArg(args, 'itemName');
    let next = runOn(project, 'upsert_item', { item: { id: itemId, name: itemName, price: numArg(args, 'price'), description: `${itemName} 아이템입니다.` } });
    const shop = shopsOf(eventOf(next, eventId))[0];
    const stock = [...(shop?.stock ?? []), { itemId }];
    next = runOn(next, 'set_shop_stock', { mapId: MAP, eventId, stock });
    return next;
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const itemId = strArg(args, 'itemId');
    const itemName = strArg(args, 'itemName');
    const price = numArg(args, 'price');
    const made = runOn(project, 'upsert_item', { item: { id: itemId, name: itemName, price } });
    const shop = shopsOf(eventOf(project, eventId))[0];
    return [
      // 부분 수행: 아이템만 만들고 상점에 넣지 않았다.
      made,
      // 부작용: 상점 재고를 새 아이템 하나로 덮어 기존 물건이 사라졌다.
      runOn(made, 'set_shop_stock', { mapId: MAP, eventId, stock: [{ itemId }] }),
      // 잘못된 값: 가격이 다르다.
      runOn(runOn(project, 'upsert_item', { item: { id: itemId, name: itemName, price: price + 25 } }), 'set_shop_stock', { mapId: MAP, eventId, stock: [...(shop?.stock ?? []), { itemId }] }),
      // 잘못된 물건: 만든 아이템이 아니라 다른 아이템을 재고에 넣었다.
      runOn(made, 'set_shop_stock', { mapId: MAP, eventId, stock: [...(shop?.stock ?? []), { itemId: 'item_bread' }] }),
    ];
  },
};

const chainNpcThenLine: Family = {
  id: 'chain-npc-then-line',
  area: 'npc',
  mode: 'write',
  title: 'NPC 배치하고 대사 한 줄',
  variants: [
    { key: 'traveler-polite', prompt: '(8,6) 칸에 「나그네」라는 NPC를 놓고, 말을 걸면 "요즘 길이 험하구먼." 이라고 하게 해 주세요. 다른 이벤트는 그대로 두세요.', args: { x: 8, y: 6, name: '나그네', line: '요즘 길이 험하구먼.' }, setup: { select: { x: 8, y: 6, w: 1, h: 1 } } },
    { key: 'merchant-short', prompt: '(5,4)에 「행상인」 놓고 "싼 물건 많아요." 하게.', args: { x: 5, y: 4, name: '행상인', line: '싼 물건 많아요.' }, setup: { select: { x: 5, y: 4, w: 1, h: 1 } } },
    { key: 'kid-casual', prompt: '(10,10)에 「동네 아이」 하나 세우고 "숨바꼭질 할래?" 라고 말하게 해줘.', args: { x: 10, y: 10, name: '동네 아이', line: '숨바꼭질 할래?' }, setup: { select: { x: 10, y: 10, w: 1, h: 1 } } },
    { key: 'elder-explained', prompt: '마을 어귀 (18,3) 자리에 「마을 노인」 NPC를 추가해 주세요. 조사하면 "이 마을은 오래되었다네." 라는 대사가 나와야 하고, 기존 이벤트는 하나도 바뀌면 안 됩니다.', args: { x: 18, y: 3, name: '마을 노인', line: '이 마을은 오래되었다네.' }, setup: { select: { x: 18, y: 3, w: 1, h: 1 } } },
    { key: 'guard-terse', prompt: '(20,2) 「순찰병」, "밤에는 다니지 마시오."', args: { x: 20, y: 2, name: '순찰병', line: '밤에는 다니지 마시오.' }, setup: { select: { x: 20, y: 2, w: 1, h: 1 } } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const name = strArg(args, 'name');
    const line = strArg(args, 'line');
    const label = `${name} (${x},${y})`;
    const known = new Set(mapOfEvents(input.before).map((event: any) => event.id));
    const added = mapOfEvents(input.after).filter((event: any) => !known.has(event.id));
    if (added.length !== 1) return fail(`${label}: 새 이벤트가 ${added.length}개다`);
    const npc = added[0];
    if (npc.x !== x || npc.y !== y) return fail(`${label}: (${npc.x},${npc.y}) 에 놓였다`);
    const shown = npc.name ?? npc.pages?.[0]?.name;
    if (shown !== name) return fail(`${label}: 이름이 「${shown}」`);
    const said = eventCommands(npc).filter((command: any) => command?.kind === 'text').map((command: any) => norm(String(command.body ?? '')));
    if (!said.some(body => body.includes(norm(line)))) return fail(`${label}: 요청한 대사가 없다`);
    if (!sameProjectExcept(input.before, input.after, withoutEvent(npc.id))) return fail(`${label}: 다른 내용이 바뀌었다`);
    return pass(`${label}: NPC 1개 + 대사 한 줄, 나머지 보존`);
  },
  reference(project, args) {
    return runOn(project, 'place_npc', {
      mapId: MAP, x: numArg(args, 'x'), y: numArg(args, 'y'), name: strArg(args, 'name'),
      pages: [{ lines: [strArg(args, 'line')] }],
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const name = strArg(args, 'name');
    const line = strArg(args, 'line');
    const placed = runOn(project, 'place_npc', { mapId: MAP, x, y, name, pages: [{ lines: [line] }] });
    return [
      // 잘못된 칸
      runOn(project, 'place_npc', { mapId: MAP, x: x + 2, y, name, pages: [{ lines: [line] }] }),
      // 부분 수행: NPC 만 놓고 요청한 대사를 넣지 않았다.
      runOn(project, 'place_npc', { mapId: MAP, x, y, name }),
      // 부작용: 기존 이벤트 대사도 함께 바꿨다.
      patchPage(placed, 'ev_utility_npc', 0, { name: `${name} (수정)` }),
      // 잘못된 이름
      runOn(project, 'place_npc', { mapId: MAP, x, y, name: `${name} 2`, pages: [{ lines: [line] }] }),
    ];
  },
};

const ambiguousThisNpc: Family = {
  id: 'ambiguous-this-npc',
  area: 'npc',
  mode: 'write',
  title: '선택한 NPC만 손보기',
  variants: [
    { key: 'this-npc-polite', prompt: '이 NPC 좀 손봐 주세요. 다른 이벤트는 건드리지 마세요.', args: { eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'this-one-short', prompt: '이거 다듬어 줘.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'this-npc-casual', prompt: '얘 좀 더 낫게 만들어줘.', args: { eventId: 'ev_test_shop' }, setup: { event: 'ev_test_shop' } },
    { key: 'this-event-explained', prompt: '선택한 이벤트를 조금 더 자연스럽게 다듬어 주세요. 다른 이벤트나 맵은 그대로 두세요.', args: { eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
    { key: 'this-scene-terse', prompt: '이 장면 이벤트 손봐.', args: { eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
  ],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const label = `${eventId} 만 수정`;
    if (!sameProjectExcept(input.before, input.after, withoutEvent(eventId))) return fail(`${label}: 선택한 이벤트 밖의 내용이 바뀌었다`);
    const before = eventOf(input.before, eventId), after = eventOf(input.after, eventId);
    if (!before) return fail(`${label}: 픽스처에 이벤트가 없다`);
    if (!after) return fail(`${label}: 선택한 이벤트가 삭제됐다`);
    // 「손봐 줘」에는 무엇을 손볼지가 없다: 할 일을 되묻는 답도 유효하다(무변경 문서는 selfcheck 에서 여전히 실패한다).
    if (isDeepStrictEqual(before, after)) {
      return /[?？]|어떤|무엇|어느|어떻게/iu.test(input.answer)
        ? pass(`${label}: 변경 없이 무엇을 손볼지 되물었다`)
        : fail(`${label}: 선택한 이벤트가 바뀌지 않았다`);
    }
    return pass(`${label}: 선택한 이벤트만 수정`);
  },
  reference(project, args) {
    return withExtraLine(project, strArg(args, 'eventId'), '요즘 마을에선 무슨 일이 있나요?');
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const other = mapOfEvents(project).find((event: any) => event.id !== eventId && event.pages?.length)?.id ?? 'ev_utility_npc';
    return [
      // 잘못된 대상: 다른 이벤트만 손봤다.
      withExtraLine(project, other, '요즘 마을에선 무슨 일이 있나요?'),
      // 부작용: 선택한 이벤트와 다른 이벤트를 함께 바꿨다.
      withExtraLine(withExtraLine(project, eventId, '요즘 마을에선 무슨 일이 있나요?'), other, '덧붙인 대사.'),
      // 부작용: 선택한 이벤트를 손보면서 다른 이벤트를 지웠다.
      runOn(withExtraLine(project, eventId, '요즘 마을에선 무슨 일이 있나요?'), 'remove_event', { mapId: MAP, eventId: other }),
      // 잘못된 범위: 선택한 이벤트를 지웠다.
      runOn(project, 'remove_event', { mapId: MAP, eventId }),
    ];
  },
};

const ambiguousTidyArea: Family = {
  id: 'ambiguous-tidy-area',
  area: 'plan',
  mode: 'write',
  title: '선택 영역만 작게 정리',
  variants: [
    { key: 'meadow-polite', prompt: '선택한 영역이 좀 밋밋하네요. 작게만 정리해 주세요. 영역 밖은 그대로 두고요.', args: { rect: { x: 14, y: 2, w: 6, h: 5 } }, setup: { select: { x: 14, y: 2, w: 6, h: 5 } } },
    { key: 'meadow-short', prompt: '여기 조금만 손봐.', args: { rect: { x: 2, y: 6, w: 6, h: 4 } }, setup: { select: { x: 2, y: 6, w: 6, h: 4 } } },
    { key: 'grass-casual', prompt: '이 구역 좀 정리해줘. 다 지우진 말고.', args: { rect: { x: 14, y: 8, w: 6, h: 5 } }, setup: { select: { x: 14, y: 8, w: 6, h: 5 } } },
    { key: 'trail-explained', prompt: '선택한 영역을 조금 더 자연스럽게 다듬어 주세요. 영역 밖 타일과 기존 이벤트는 그대로 두어야 합니다.', args: { rect: { x: 2, y: 14, w: 10, h: 3 } }, setup: { select: { x: 2, y: 14, w: 10, h: 3 } } },
    { key: 'field-terse', prompt: '이 칸들 정리.', args: { rect: { x: 16, y: 14, w: 5, h: 3 } }, setup: { select: { x: 16, y: 14, w: 5, h: 3 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h}`;
    const cells = changedCells(input.before, input.after);
    const removed = removedEventIds(input.before, input.after);
    if (removed.length) return fail(`${label}: 이벤트 ${removed.length}개를 지웠다`);
    const outside = cells.filter(cell => !inside(rect, cell.x, cell.y));
    if (outside.length) return fail(`${label}: 영역 밖 칸 ${outside.length}개가 바뀌었다 (예: ${outside[0]!.x},${outside[0]!.y})`);
    const touchedOutside = changedEvents(input.before, input.after).filter(event => !inside(rect, event.x, event.y));
    if (touchedOutside.length) return fail(`${label}: 영역 밖 이벤트 ${touchedOutside.map((event: any) => event.id).join(',')} 가 바뀌었다`);
    const eventsIn = (doc: any) => { for (const map of Object.values<any>(doc.maps)) map.events = (map.events ?? []).filter((event: any) => !inside(rect, event.x, event.y)); };
    if (!sameProjectExcept(input.before, input.after, doc => { withoutTilesHere(doc); eventsIn(doc); })) return fail(`${label}: 영역 밖의 다른 내용이 바뀌었다`);
    const cleared = cells.filter(cell => (input.after as any).maps[MAP]?.lowerTiles?.[cell.y * ((input.after as any).maps[MAP]?.width ?? 24) + cell.x] === -1);
    if (cells.length && cleared.length === rect.w * rect.h) return fail(`${label}: 영역 바닥을 전부 지웠다`);
    const touchedInside = changedEvents(input.before, input.after).some(event => inside(rect, event.x, event.y));
    if (!cells.length && !touchedInside) {
      return /[?？]|어떤|무엇|어느|어떻게/iu.test(input.answer) ? pass(`${label}: 변경 없이 무엇을 할지 되물었다`) : fail(`${label}: 아무 개선도 없고 되묻지도 않았다`);
    }
    return pass(`${label}: 영역 안 ${cells.length}칸만 작게 정리`);
  },
  reference(project, args) {
    const rect = rectArg(args);
    return runOn(project, 'fill_region', {
      mapId: MAP, x: rect.x + 1, y: rect.y + 1, w: Math.min(2, Math.max(1, rect.w - 1)), h: 1, layer: 'lower', material: '버들항 모랫길',
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const events = mapOfEvents(project);
    const outside = events.filter((event: any) => !inside(rect, event.x, event.y));
    const inner = events.filter((event: any) => inside(rect, event.x, event.y));
    // 영역 밖으로 나가는 칸 하나. 사각형 바로 옆이 아니라 멀리 떨어진 바닥을 쓴다(테두리 침범과 구분되게).
    const stray = { x: 1, y: 16 };
    return [
      // 영역 밖 이벤트 삭제
      runOn(project, 'remove_event', { mapId: MAP, eventId: outside[0].id }),
      // 영역 안 이벤트까지 삭제(작은 정리가 아니라 파괴)
      runOn(project, 'remove_event', { mapId: MAP, eventId: (inner[0] ?? outside[1] ?? outside[0]).id }),
      // 영역 밖 칸 칠하기(부작용)
      runOn(project, 'fill_region', { mapId: MAP, x: stray.x, y: stray.y, w: 1, h: 1, layer: 'lower', material: '버들항 모랫길' }),
      // 무변경 + 되묻지 않음
      project,
    ];
  },
};

const showToolLog: Family = {
  id: 'show-tool-log',
  area: 'read',
  mode: 'read',
  title: '방금 수정한 타일 알려 주기',
  readTools: ['list_edit_history'],
  variants: [
    { key: 'cell-14-2', prompt: '방금 어떤 타일을 수정했는지 목록으로 알려 주세요.', args: { x: 14, y: 2 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'cell-4-4-short', prompt: '방금 수정한 타일 목록.', args: { x: 4, y: 4 }, setup: { prior: { prompt: '(4,4) 칸에 나무 한 그루를 놓아줘.', select: { x: 4, y: 4, w: 1, h: 1 } } } },
    { key: 'cell-18-3-casual', prompt: '아까 어디 건드렸는지 좀 보여줘.', args: { x: 18, y: 3 }, setup: { prior: { prompt: '(18,3) 칸에 나무 한 그루를 놓아줘.', select: { x: 18, y: 3, w: 1, h: 1 } } } },
    { key: 'cell-10-10-explained', prompt: '직전 턴에서 수정한 타일이 몇 번 칸이었는지 정확한 좌표로 알려 주세요.', args: { x: 10, y: 10 }, setup: { prior: { prompt: '(10,10) 칸에 나무 한 그루를 놓아줘.', select: { x: 10, y: 10, w: 1, h: 1 } } } },
    { key: 'cell-2-8-terse', prompt: '수정한 타일 좌표.', args: { x: 2, y: 8 }, setup: { prior: { prompt: '(2,8) 칸에 나무 한 그루를 놓아줘.', select: { x: 2, y: 8, w: 1, h: 1 } } } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    return readOnly(input, `타일 로그 (${x},${y})`, () => coordinatesIn(input.answer).some(cell => cell.x === x && cell.y === y)
      ? pass(`수정한 타일 (${x},${y}) 를 목록에 넣었다`)
      : fail(`수정한 타일 (${x},${y}) 를 목록에 넣지 않았다`));
  },
  reference(_project, args) {
    return `직전 턴에 수정한 타일은 (${numArg(args, 'x')},${numArg(args, 'y')}) 한 칸입니다. 나무 한 그루를 놓았고 다른 칸은 바뀌지 않았습니다.`;
  },
  wrongs(_project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    return [
      `직전 턴에는 타일을 수정하지 않았습니다.`,
      `나무 한 그루를 놓았습니다. 좌표는 기억나지 않습니다.`,
      `직전 턴에 수정한 타일은 (${x + 1},${y}) 입니다.`,
      `타일이 아니라 아이템 가격을 바꿨습니다.`,
    ];
  },
};

const undoPreview: Family = {
  id: 'undo-preview',
  area: 'read',
  mode: 'read',
  title: '되돌릴 변경 미리보기',
  readTools: ['list_edit_history'],
  variants: [
    { key: 'tree-14-2', prompt: '방금 한 작업을 되돌리면 뭐가 취소되는지 미리 보여 주세요.', args: { x: 14, y: 2 }, setup: { prior: { prompt: '(14,2) 칸에 나무 한 그루를 놓아줘.', select: { x: 14, y: 2, w: 1, h: 1 } } } },
    { key: 'tree-4-4-short', prompt: '방금 거 되돌리면?', args: { x: 4, y: 4 }, setup: { prior: { prompt: '(4,4) 칸에 나무 한 그루를 놓아줘.', select: { x: 4, y: 4, w: 1, h: 1 } } } },
    { key: 'tree-18-3-casual', prompt: '아까 놓은 나무 취소하면 어떻게 되는지 보여줘.', args: { x: 18, y: 3 }, setup: { prior: { prompt: '(18,3) 칸에 나무 한 그루를 놓아줘.', select: { x: 18, y: 3, w: 1, h: 1 } } } },
    { key: 'tree-10-10-explained', prompt: '직전 변경을 되돌릴 경우 되돌아갈 내용을 정리해 주세요. 어떤 타일이 원래대로 돌아가는지 포함해 주세요.', args: { x: 10, y: 10 }, setup: { prior: { prompt: '(10,10) 칸에 나무 한 그루를 놓아줘.', select: { x: 10, y: 10, w: 1, h: 1 } } } },
    { key: 'tree-2-8-terse', prompt: '되돌리기 미리보기.', args: { x: 2, y: 8 }, setup: { prior: { prompt: '(2,8) 칸에 나무 한 그루를 놓아줘.', select: { x: 2, y: 8, w: 1, h: 1 } } } },
  ],
  judge(input, args) {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    return readOnly(input, `되돌리기 (${x},${y})`, () => {
      if (!called(input.tools, 'list_edit_history')) return fail('list_edit_history 호출이 없다');
      if (!/되돌|취소|복원|미리/iu.test(input.answer)) return fail('되돌리기 미리보기가 없다');
      const named = mentions(input.answer, '나무', '타일') || coordinatesIn(input.answer).some(cell => cell.x === x && cell.y === y);
      return named ? pass(`방금 변경(나무 ${x},${y})을 되돌릴 미리보기 제시`) : fail('되돌릴 변경(나무 배치)을 지목하지 않았다');
    });
  },
  reference(_project, args) {
    return `직전 변경 한 건을 되돌리면 (${numArg(args, 'x')},${numArg(args, 'y')}) 에 놓은 나무 타일이 원래 잔디로 돌아갑니다. 다른 칸은 그대로입니다.`;
  },
  wrongs(_project, args): FamilyOutcome[] {
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    return [
      `되돌릴 변경이 없습니다.`,
      `직전에 놓은 나무는 그대로 남습니다.`,
      `되돌리면 (${x + 5},${y + 5}) 칸의 바닥이 바뀝니다.`,
      `되돌리기 기능은 이 편집기에 없습니다.`,
    ];
  },
};

export const GROUP_3: readonly Family[] = [
  npcShop,
  removeShopHerb,
  placeChest,
  potionPrice,
  swordAttack,
  itemDescription,
  createKeyItem,
  dbSkillCreate,
  dbEnemyStat,
  dbClassSkillList,
  dbItemPriceBatch,
  dbTroopMemberCount,
  dbStateDuration,
  chainDbItemThenShop,
  chainNpcThenLine,
  ambiguousThisNpc,
  ambiguousTidyArea,
  showToolLog,
  undoPreview,
];
