import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import type { InventoryView } from '@/player/playerInventoryView';

function fixture() {
  const project = createBlankProject();
  const a = project.database.items[0]!;
  const b = project.database.items[1]!;
  Object.assign(a, { type: 'medicine', occasion: 'field', name: '가 약' });
  Object.assign(b, { type: 'normalGoods', name: '나 물품' });
  const equipment = project.database.equipment[0]!;
  const session = startSession(project);
  session.inventory = { [a.id]: 2, [b.id]: 8, [equipment.id]: 3, missing_record: 4 };
  const detail = (filter: InventoryView['filter'], sort: InventoryView['sort'] = 'default') => createStatusMenuDetail({
    project, session, slots: [], selectedCommand: 'items', waitModeEnabled: true,
    inventoryView: { filter, sort }, onInventoryViewChange() {}, onUseItem() {}, onSelectItemTarget() {},
  });
  return { project, session, a, b, equipment, detail };
}
describe('inventory display projection', () => {
  it('filters every category without changing quantities, charges, equipment or unknown stacks', () => {
    const f = fixture(), before = structuredClone(f.session);
    expect(f.detail('usable').entries.map(e => e.testId)).toContain(`status-menu-item-${f.a.id}`);
    expect(f.detail('usable').entries.map(e => e.testId)).not.toContain(`status-menu-item-${f.b.id}`);
    expect(f.detail('equipment').entries.map(e => e.testId)).toContain(`status-menu-owned-equipment-${f.equipment.id}`);
    expect(f.detail('other').entries.map(e => e.testId)).toContain('status-menu-item-missing_record');
    for (const sort of ['default', 'name', 'quantity'] as const) {
      const rows = f.detail('all', sort).entries;
      for (const id of [f.a.id, f.b.id, 'missing_record']) expect(rows.map(e => e.testId)).toContain(`status-menu-item-${id}`);
    }
    expect(f.session).toEqual(before);
  });
  it('uses the existing equipment classification for legacy item records too', () => {
    const f = fixture();
    f.b.type = 'weapon';
    expect(f.detail('equipment').entries.map(e => e.testId)).toContain(`status-menu-item-${f.b.id}`);
    expect(f.detail('other').entries.map(e => e.testId)).not.toContain(`status-menu-item-${f.b.id}`);
  });
  it('sorts names and numeric quantities while keeping control rows last', () => {
    const f = fixture();
    const rows = f.detail('all', 'quantity').entries.filter(e => e.testId?.startsWith('status-menu-item-'));
    expect(rows.map(e => e.testId)).toEqual([`status-menu-item-${f.b.id}`, 'status-menu-item-missing_record', `status-menu-item-${f.a.id}`]);
    const names = f.detail('all', 'name').entries.filter(e => [f.a.name, f.b.name].includes(e.label));
    expect(names.map(e => e.label)).toEqual([f.a.name, f.b.name]);
    expect(f.detail('all').entries.slice(-2).map(e => e.testId)).toEqual(['inventory-filter', 'inventory-sort']);
  });
  it('keeps controls accessible for empty inventory and does not inject them into target selection', () => {
    const f = fixture();
    f.session.inventory = {};
    expect(f.detail('usable').entries.map(e => e.testId)).toEqual(['inventory-filter-empty', 'inventory-filter', 'inventory-sort']);
    const targets = createStatusMenuDetail({ project: f.project, session: f.session, slots: [], selectedCommand: 'items', waitModeEnabled: true, targetItemId: f.a.id });
    expect(targets.entries.some(e => e.testId === 'inventory-filter')).toBe(false);
  });
});
