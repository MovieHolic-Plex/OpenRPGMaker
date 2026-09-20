import type { StatusMenuDetailEntry } from '@/player/playerStatusMenuDetailTypes';
import type { Project } from '@/project/types';
import type { PlaySession } from '@/project/session';
import { itemAllowsMenu } from '@/project/itemUsage';
import { EQUIPPABLE_ITEM_TYPES } from '@/player/playSceneShopGoods';
export type InventoryView = { filter: 'all' | 'usable' | 'equipment' | 'other'; sort: 'default' | 'name' | 'quantity' };
export const DEFAULT_INVENTORY_VIEW: InventoryView = { filter: 'all', sort: 'default' };
const filters = ['all', 'usable', 'equipment', 'other'] as const;
const sorts = ['default', 'name', 'quantity'] as const;
export function inventoryViewEntries(
  entries: readonly StatusMenuDetailEntry[], project: Project, session: PlaySession,
  view: InventoryView = DEFAULT_INVENTORY_VIEW, onChange?: (view: InventoryView) => void,
): StatusMenuDetailEntry[] {
  const idOf = (entry: StatusMenuDetailEntry) => entry.testId?.replace(/^status-menu-(?:owned-equipment-|item-)/, '') ?? '';
  const equipment = new Set([...project.database.equipment.map(item => item.id),
    ...project.database.items.filter(item => EQUIPPABLE_ITEM_TYPES.has(item.type)).map(item => item.id)]);
  const usable = new Set(project.database.items.filter(itemAllowsMenu).map(item => item.id));
  const known = new Set([...equipment, ...project.database.items.map(item => item.id)]);
  const unknown: StatusMenuDetailEntry[] = Object.entries(session.inventory)
    .filter(([id, count]) => count > 0 && !known.has(id))
    .map(([id, count]) => ({ label: id, value: `${count}개`, description: '현재 자료집에 없는 아이템입니다. 보유 수량은 유지됩니다.', testId: `status-menu-item-${id}` }));
  const rows = [...entries, ...unknown].filter(entry => {
    if (view.filter === 'all') return true;
    const id = idOf(entry);
    if (entry.testId === 'status-menu-owned-equipment-worn') return view.filter === 'equipment';
    return view.filter === 'equipment' ? equipment.has(id)
      : view.filter === 'usable' ? usable.has(id) : !equipment.has(id) && !usable.has(id);
  });
  if (view.sort !== 'default') rows.sort((a, b) => {
    if (a.testId === 'status-menu-owned-equipment-worn') return -1;
    if (b.testId === 'status-menu-owned-equipment-worn') return 1;
    const delta = view.sort === 'quantity' ? (session.inventory[idOf(b)] ?? 0) - (session.inventory[idOf(a)] ?? 0) : 0;
    return delta || a.label.localeCompare(b.label, 'ko') || idOf(a).localeCompare(idOf(b));
  });
  // Append controls so the historical first-item shortcut/preview remains intact.
  return [...rows, ...(rows.length ? [] : [{ label: '조건에 맞는 아이템이 없습니다', value: '', testId: 'inventory-filter-empty' }]), {
    label: '분류', value: { all: '전체', usable: '사용 가능 종류', equipment: '장비', other: '기타' }[view.filter],
    description: 'Enter로 전체 / 사용 가능 종류 / 장비 / 기타 전환', testId: 'inventory-filter',
    onActivate: onChange ? () => onChange({ ...view, filter: filters[(filters.indexOf(view.filter) + 1) % filters.length]! }) : undefined,
  }, {
    label: '정렬', value: { default: '기본 순서', name: '이름순', quantity: '수량순' }[view.sort],
    description: 'Enter로 기본 순서 / 이름순 / 수량순 전환', testId: 'inventory-sort',
    onActivate: onChange ? () => onChange({ ...view, sort: sorts[(sorts.indexOf(view.sort) + 1) % sorts.length]! }) : undefined,
  }];
}
