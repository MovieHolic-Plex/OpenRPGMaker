import type { StatusMenuDetailEntry } from '@/player/playerStatusMenuDetailTypes';
import type { ItemBagPocket, Project } from '@/project/types';
import { BAG_POCKETS, DEFAULT_BAG_POCKET, bagPocketOf, holdsKeyItems, isKeyItem } from '@/player/playerBagPockets';
import { usesMonsterParty } from '@/player/playerMonsterPartyModel';
import type { PlaySession } from '@/project/session';
import { itemAllowsMenu } from '@/project/itemUsage';
import { itemAllowsFieldMenu } from '@/project/monsterEvolutionItems';
import { EQUIPPABLE_ITEM_TYPES } from '@/player/playSceneShopGoods';
export type InventoryView = { filter: 'all' | 'key' | 'usable' | 'equipment' | 'other'; sort: 'default' | 'name' | 'quantity'; /** 몬스터 수집 게임 가방의 포켓. 다른 장르는 쓰지 않는다(분류 필터가 그대로). */ pocket?: ItemBagPocket };
export const DEFAULT_INVENTORY_VIEW: InventoryView = { filter: 'all', sort: 'default' };
const filters = ['all', 'usable', 'equipment', 'other'] as const;
/** 「중요한 물건」이 있는 일반 장르 가방: 전체 다음 첫 분류가 그 칸이다(기본 보기는 전체 그대로 — 약만 가진 플레이어가 빈 목록을 보지 않는다). */
const keyFilters = ['all', 'key', 'usable', 'equipment', 'other'] as const;
const FILTER_LABELS = { key: '중요한 물건', all: '전체', usable: '사용 가능 종류', equipment: '장비', other: '기타' } as const;
const sorts = ['default', 'name', 'quantity'] as const;
export function inventoryViewEntries(
  entries: readonly StatusMenuDetailEntry[], project: Project, session: PlaySession,
  view: InventoryView = DEFAULT_INVENTORY_VIEW, onChange?: (view: InventoryView) => void,
): StatusMenuDetailEntry[] {
  const idOf = (entry: StatusMenuDetailEntry) => entry.testId?.replace(/^status-menu-(?:owned-equipment-|item-)/, '') ?? '';
  const equipment = new Set([...project.database.equipment.map(item => item.id),
    ...project.database.items.filter(item => EQUIPPABLE_ITEM_TYPES.has(item.type)).map(item => item.id)]);
  const usable = new Set(project.database.items.filter(item => itemAllowsMenu(item) || itemAllowsFieldMenu(project, item)).map(item => item.id));
  const known = new Set([...equipment, ...project.database.items.map(item => item.id)]);
  const unknown: StatusMenuDetailEntry[] = Object.entries(session.inventory)
    .filter(([id, count]) => count > 0 && !known.has(id))
    .map(([id, count]) => ({ label: id, value: `${count}개`, description: '현재 자료집에 없는 아이템입니다. 보유 수량은 유지됩니다.', testId: `status-menu-item-${id}` }));
  const pocketMode = usesMonsterParty(project);
  const pocket = pocketMode ? view.pocket ?? DEFAULT_BAG_POCKET : undefined;
  const itemById = new Map(project.database.items.map(item => [item.id, item]));
  const hasKey = !pocketMode && holdsKeyItems(project, session.inventory);
  const order = hasKey ? keyFilters : filters;
  // 중요한 물건을 하나도 안 가졌는데 key 보기가 남아 있으면(쓰고 없어진 뒤·옛 세션) 전체로 본다.
  const filter = view.filter === 'key' && !hasKey ? 'all' : view.filter;
  const key = new Set(hasKey ? project.database.items.filter(isKeyItem).map(item => item.id) : []);
  const rows = [...entries, ...unknown].filter(entry => {
    // 몬스터 게임: 포켓이 목록을 가른다(분류 필터는 쓰지 않는다). 자료집에 없는 아이템은 중요한 물건.
    if (pocket) {
      const item = itemById.get(idOf(entry));
      return (item ? bagPocketOf(project, item) : 'key') === pocket;
    }
    if (filter === 'all') return true;
    const id = idOf(entry);
    if (entry.testId === 'status-menu-owned-equipment-worn') return filter === 'equipment';
    if (filter === 'key') return key.has(id);
    return filter === 'equipment' ? equipment.has(id)
      : filter === 'usable' ? usable.has(id) : !equipment.has(id) && !usable.has(id) && !key.has(id);
  });
  if (view.sort !== 'default') rows.sort((a, b) => {
    if (a.testId === 'status-menu-owned-equipment-worn') return -1;
    if (b.testId === 'status-menu-owned-equipment-worn') return 1;
    const delta = view.sort === 'quantity' ? (session.inventory[idOf(b)] ?? 0) - (session.inventory[idOf(a)] ?? 0) : 0;
    return delta || a.label.localeCompare(b.label, 'ko') || idOf(a).localeCompare(idOf(b));
  });
  // Append controls so the historical first-item shortcut/preview remains intact.
  const sortControl: StatusMenuDetailEntry = {
    label: '정렬', value: { default: '기본 순서', name: '이름순', quantity: '수량순' }[view.sort],
    description: 'Enter로 정렬 바꾸기', testId: 'inventory-sort',
    onActivate: onChange ? () => onChange({ ...view, sort: sorts[(sorts.indexOf(view.sort) + 1) % sorts.length]! }) : undefined,
  };
  if (pocket) {
    const label = BAG_POCKETS.find(entry => entry.id === pocket)?.label ?? pocket;
    return [...rows, ...(rows.length ? [] : [{ label: `${label} 포켓에는 아이템이 없습니다`, value: '', testId: 'inventory-pocket-empty' }]), sortControl];
  }
  return [...rows, ...(rows.length ? [] : [{ label: filter === 'key' ? '중요한 물건이 아직 없습니다' : '조건에 맞는 아이템이 없습니다', value: '', testId: 'inventory-filter-empty' }]), {
    label: '분류', value: FILTER_LABELS[filter],
    description: `Enter로 ${order.map(id => FILTER_LABELS[id]).join(' / ')} 전환`, testId: 'inventory-filter',
    onActivate: onChange ? () => onChange({ ...view, filter: order[(Math.max(0, (order as readonly string[]).indexOf(filter)) + 1) % order.length]! }) : undefined,
  }, sortControl];
}
