import { describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster, monsterBattleStats, monsterMaxHp } from '@/project/monsterCollection';
import { createPlayerStatusMenuSnapshot, listStatusMenuCommandIds } from '@/player/playerStatusMenuModel';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import { monsterBoxUnavailableReason, monsterMoveDescription, monsterTypeLabel } from '@/player/playerMonsterPartyModel';
import { recoveryPreview } from '@/player/shopPartyFit';
import { itemToGoods } from '@/player/playSceneShopGoods';
import { applySaveSnapshot, createSaveSnapshot } from '@/player/saveSlots';

function fixture(legacyFlag = false) {
  const project = createBlankProject();
  if (legacyFlag) project.system.monsterBattleParty = true;
  else project.system.battleParty = 'monsters';
  const session = startSession(project);
  const species = project.database.monsterSpecies![0];
  const skill = project.database.skills.find(record => record.maxPp !== undefined && record.maxPp > 1)!;
  if (!species || !skill) throw new Error('Monster and PP skill fixtures are required');
  const given = giveMonster(project, session, { speciesId: species.id, level: 12, nickname: '동료', skillIds: [skill.id], skillPp: { [skill.id]: 1 } });
  if (!given.ok) throw new Error('Failed to give fixture monster');
  session.monsterInstances[given.instance.instanceId] = { ...given.instance, currentHp: 1 };
  return { project, session, species, skill, id: given.instance.instanceId };
}

function detailOptions(value: ReturnType<typeof fixture>) {
  return { project: value.project, session: value.session, selectedCommand: 'monsters' as const, slots: [], waitModeEnabled: true };
}

describe('monster party menu dogfood regressions', () => {
  it.each([false, true])('uses actual monster HP and current PP for both party flags (%s)', legacy => {
    const { project, session, id, skill } = fixture(legacy);
    const rows = createPlayerStatusMenuSnapshot(project, session).partyRows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ monsterInstanceId: id, name: '동료', level: 12, hpValueLabel: `1/${monsterMaxHp(project, session.monsterInstances[id])}`, mpValueLabel: `1/${skill.maxPp}`, resourceLabel: 'PP' });
    for (const command of ['equipment', 'row', 'formation']) expect(listStatusMenuCommandIds(project, session)).not.toContain(command);
    session.monsterParty = [];
    expect(createPlayerStatusMenuSnapshot(project, session).partyRows).toEqual([]);
  });

  it('inspects the instance before an explicit box action and shows battle stats and known PP', () => {
    const value = fixture();
    const select = vi.fn(), move = vi.fn();
    const options = { ...detailOptions(value), onSelectMonster: select, onMoveMonster: move };
    const list = createStatusMenuDetail(options);
    list.entries.find(row => row.testId === `status-menu-monster-${value.id}`)!.onActivate!();
    expect(select).toHaveBeenCalledWith(value.id);
    expect(move).not.toHaveBeenCalled();
    const detail = createStatusMenuDetail({ ...options, monsterInstanceId: value.id });
    expect(detail.entries.find(row => row.testId === `status-menu-monster-known-skill-${value.id}-${value.skill.id}`)?.value).toBe(`PP 1/${value.skill.maxPp}`);
    const stats = monsterBattleStats(value.project, value.session.monsterInstances[value.id]);
    expect(detail.entries.find(row => row.testId === 'status-menu-monster-current-stats')?.value).toBe(String(stats.attack));
    expect(detail.entries.find(row => row.testId === `status-menu-monster-move-${value.id}`)?.unavailableReason).toContain('마지막 파티');
    expect(monsterBoxUnavailableReason(value.project, value.session, value.id)).toContain('마지막 파티');
    const second = giveMonster(value.project, value.session, { speciesId: value.species.id, level: 2 });
    expect(second.ok).toBe(true);
    expect(monsterBoxUnavailableReason(value.project, value.session, value.id)).toBeUndefined();
  });

  it('field skills contain only the selected monster’s known moves', () => {
    const value = fixture();
    const detail = createStatusMenuDetail({ ...detailOptions(value), selectedCommand: 'skills', skillActorId: value.id });
    expect(detail.entries.map(row => row.label)).toEqual([value.skill.name]);
    expect(detail.entries[0].value).toBe(`PP 1/${value.skill.maxPp}`);
  });

  it('shop purchase preview uses the damaged monster and allows an unowned medicine without mutating it', () => {
    const { project, session, id } = fixture();
    const item = project.database.items.find(record => record.type === 'medicine' && record.scope === 'ally' && record.hpRecovery.flat > 0 && !record.usableActorIds.length && !record.usableClassIds.length && record.occasion !== 'battle')!;
    if (!item) throw new Error('Required unrestricted medicine fixture');
    session.inventory[item.id] = 0;
    const before = JSON.stringify(session);
    const rows = recoveryPreview(project, session, itemToGoods(item));
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ actorId: id, name: '동료', current: 1, kind: 'hp' });
    expect(rows![0].next).toBeGreaterThan(1);
    expect(rows![0].max).toBe(monsterMaxHp(project, session.monsterInstances[id]));
    expect(JSON.stringify(session)).toBe(before);
  });

  it('save metadata follows the leading monster and persisted menu vitals survive load', () => {
    const { project, session, id, skill } = fixture();
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.partyLevel).toBe(12);
    const loaded = applySaveSnapshot(project, JSON.parse(JSON.stringify(snapshot)));
    const row = createPlayerStatusMenuSnapshot(project, loaded).partyRows[0];
    expect(row.monsterInstanceId).toBe(id);
    expect(row.hpValueLabel).toContain('1/');
    expect(row.mpValueLabel).toBe(`1/${skill.maxPp}`);
  });

  it('uses authored element names in type labels and move description tokens', () => {
    const { project } = fixture();
    const element = project.database.elements[0];
    expect(monsterTypeLabel(project, [element.id])).toBe(element.name);
    expect(monsterMoveDescription(project, `${element.id} 타입의 기술입니다.`)).toBe(`${element.name} 타입의 기술입니다.`);
  });

  it('retains actor RPG overview, skills and save metadata when monster mode is absent', () => {
    const project = createBlankProject(), session = startSession(project);
    const rows = createPlayerStatusMenuSnapshot(project, session).partyRows;
    expect(rows[0].actorId).toBe(session.partyActorIds[0]);
    expect(rows[0].monsterInstanceId).toBeUndefined();
    expect(listStatusMenuCommandIds(project, session)).toEqual(expect.arrayContaining(['equipment', 'row', 'formation']));
    expect(createSaveSnapshot(project, session).partyLevel).toBe(session.actorLevels[session.partyActorIds[0]]);
  });
});
