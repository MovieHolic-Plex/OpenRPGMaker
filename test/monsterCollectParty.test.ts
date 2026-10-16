import { describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster, swapMonsterPartyOrder } from '@/project/monsterCollection';
import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import type { MonsterCollectAction } from '@/player/playerMonsterCollectTypes';

function fixture(count = 3) {
  const project = createBlankProject();
  project.system.battleParty = 'monsters';
  configureEmeraldMonsterStyle(project);
  const session = startSession(project);
  const species = project.database.monsterSpecies![0]!;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const given = giveMonster(project, session, { speciesId: species.id, level: 5 + i, nickname: `동료${i}` });
    if (!given.ok) throw new Error('give failed');
    ids.push(given.instance.instanceId);
  }
  return { project, session, ids };
}

const base = (value: ReturnType<typeof fixture>) => ({ project: value.project, session: value.session, selectedCommand: 'monsters' as const, slots: [], waitModeEnabled: true });

describe('swapMonsterPartyOrder', () => {
  it('swaps two party slots and keeps instances', () => {
    const { session, ids } = fixture();
    expect(swapMonsterPartyOrder(session, ids[0]!, ids[2]!)).toEqual({ ok: true });
    expect(session.monsterParty).toEqual([ids[2], ids[1], ids[0]]);
    expect(Object.keys(session.monsterInstances)).toHaveLength(3);
  });
  it('rejects the same monster and box monsters without touching the party', () => {
    const { session, ids } = fixture();
    session.monsterBox = ['monster_box'];
    session.monsterInstances['monster_box'] = { ...session.monsterInstances[ids[0]!]!, instanceId: 'monster_box' };
    const before = [...session.monsterParty];
    expect(swapMonsterPartyOrder(session, ids[0]!, ids[0]!)).toEqual({ ok: false, reason: 'same' });
    expect(swapMonsterPartyOrder(session, ids[0]!, 'monster_box')).toEqual({ ok: false, reason: 'notInParty' });
    expect(session.monsterParty).toEqual(before);
  });
});

describe('emerald party list and summary pages', () => {
  it('a swap source turns the next party pick into a swap and picking it again cancels', () => {
    const value = fixture();
    const actions: MonsterCollectAction[] = [];
    const options = { ...base(value), monsterCollect: { swapSourceId: value.ids[0] }, onMonsterCollect: (action: MonsterCollectAction) => { actions.push(action); }, onSelectMonster: vi.fn() };
    const detail = createStatusMenuDetail(options);
    const slots = detail.entries.filter((row) => row.attributes?.partySlot !== undefined);
    slots.find((row) => row.testId === `status-menu-monster-${value.ids[2]}`)!.onActivate!();
    slots.find((row) => row.testId === `status-menu-monster-${value.ids[0]}`)!.onActivate!();
    expect(actions).toEqual([{ kind: 'swap', sourceId: value.ids[0], targetId: value.ids[2] }, { kind: 'cancelSwap' }]);
    expect(options.onSelectMonster).not.toHaveBeenCalled();
    expect(slots.find((row) => row.testId === `status-menu-monster-${value.ids[0]}`)?.attributes?.partySwapSource).toBe('true');
  });

  it('the summary shows one page at a time and the page row cycles stats, moves, manage', () => {
    const value = fixture();
    const actions: MonsterCollectAction[] = [];
    const options = { ...base(value), monsterInstanceId: value.ids[0], onMonsterCollect: (action: MonsterCollectAction) => { actions.push(action); }, onSelectMonster: vi.fn(), onMoveMonster: vi.fn() };
    const stats = createStatusMenuDetail({ ...options, monsterCollect: { summaryPage: 'stats' } });
    expect(stats.entries.some((row) => row.testId === 'status-menu-monster-current-stats')).toBe(true);
    expect(stats.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(false);
    stats.entries.find((row) => row.testId === 'status-menu-monster-page')!.onActivate!();
    expect(actions).toEqual([{ kind: 'summaryPage', page: 'moves' }]);
    const manage = createStatusMenuDetail({ ...options, monsterCollect: { summaryPage: 'manage' } });
    expect(manage.entries.some((row) => row.testId === `status-menu-monster-swap-${value.ids[0]}`)).toBe(true);
    expect(manage.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(true);
  });

  it('keeps the flat legacy list when no collect callbacks are wired (existing tests and non-emerald skins)', () => {
    const value = fixture();
    const detail = createStatusMenuDetail({ ...base(value), monsterInstanceId: value.ids[0], onSelectMonster: vi.fn(), onMoveMonster: vi.fn() });
    expect(detail.entries.some((row) => row.testId === 'status-menu-monster-current-stats')).toBe(true);
    expect(detail.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(true);
    expect(detail.entries.some((row) => row.testId === 'status-menu-monster-page')).toBe(false);
  });
});
