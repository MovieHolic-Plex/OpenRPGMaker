import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster, normalizeMonsterSpeciesRecord } from '@/project/monsterCollection';
import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { MONSTER_NICKNAME_MAX, normalizeGenderRatio, normalizeShinyRate, renameMonster, rollMonsterIdentity } from '@/project/monsterIdentity';
import { monsterInstanceDetail } from '@/player/playerMonsterPartyDetail';
import type { MonsterCollectAction } from '@/player/playerMonsterCollectTypes';

function fixture(count = 1) {
  const project = createBlankProject();
  project.system.battleParty = 'monsters';
  configureEmeraldMonsterStyle(project);
  const session = startSession(project);
  const species = project.database.monsterSpecies![0]!;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const given = giveMonster(project, session, { speciesId: species.id, level: 5 });
    if (!given.ok) throw new Error('give failed');
    ids.push(given.instance.instanceId);
  }
  return { project, session, species, ids };
}

describe('identity roll', () => {
  it('is off by default: no genderRatio and no shinyRate means no gender and no shiny', () => {
    const { project, session, ids } = fixture();
    expect(session.monsterInstances[ids[0]!]!.gender).toBeUndefined();
    expect(session.monsterInstances[ids[0]!]!.shiny).toBeUndefined();
    expect(rollMonsterIdentity(project, { id: 'x' }, 'seed')).toEqual({});
  });
  it('is deterministic per seed and follows the ratio', () => {
    const { project } = fixture();
    const allFemale = { id: 'x', genderRatio: 1 };
    const allMale = { id: 'x', genderRatio: 0 };
    expect(rollMonsterIdentity(project, allFemale, 'a').gender).toBe('female');
    expect(rollMonsterIdentity(project, allMale, 'a').gender).toBe('male');
    const half = { id: 'x', genderRatio: 0.5 };
    const sample = Array.from({ length: 400 }, (_, i) => rollMonsterIdentity(project, half, `k${i}`).gender);
    const females = sample.filter((g) => g === 'female').length;
    expect(females).toBeGreaterThan(140);
    expect(females).toBeLessThan(260);
    expect(rollMonsterIdentity(project, half, 'same')).toEqual(rollMonsterIdentity(project, half, 'same'));
  });
  it('shinyRate 1/N makes roughly 1 in N shiny and respects the bounds', () => {
    const { project } = fixture();
    project.system.shinyRate = 4;
    const hits = Array.from({ length: 800 }, (_, i) => rollMonsterIdentity(project, { id: 'x' }, `s${i}`).shiny).filter(Boolean).length;
    expect(hits).toBeGreaterThan(120);
    expect(hits).toBeLessThan(290);
    expect(normalizeShinyRate(1)).toBeUndefined();
    expect(normalizeShinyRate(65537)).toBeUndefined();
    expect(normalizeShinyRate(4096)).toBe(4096);
    expect(normalizeGenderRatio(1.2)).toBeUndefined();
    expect(normalizeMonsterSpeciesRecord({ id: 's', name: 'S', genderRatio: 0.25 }).genderRatio).toBe(0.25);
    expect(normalizeMonsterSpeciesRecord({ id: 's', name: 'S' }).genderRatio).toBeUndefined();
  });
  it('giveMonster input overrides the roll', () => {
    const { project, session, species } = fixture();
    const given = giveMonster(project, session, { speciesId: species.id, level: 5, gender: 'female', shiny: true });
    expect(given.ok && given.instance.gender).toBe('female');
    expect(given.ok && given.instance.shiny).toBe(true);
  });
});

describe('rename', () => {
  it('sets, trims to the max length and clears back to the species name', () => {
    const { session, ids } = fixture();
    expect(renameMonster(session, ids[0]!, '  불꽃이  ')).toEqual({ ok: true, nickname: '불꽃이' });
    expect(session.monsterInstances[ids[0]!]!.nickname).toBe('불꽃이');
    const long = renameMonster(session, ids[0]!, '아주아주긴이름이에요');
    expect(long.ok && long.nickname).toHaveLength(MONSTER_NICKNAME_MAX);
    expect(renameMonster(session, ids[0]!, '   ')).toEqual({ ok: true, nickname: undefined });
    expect(session.monsterInstances[ids[0]!]!.nickname).toBeUndefined();
    expect(renameMonster(session, 'nope', 'x')).toEqual({ ok: false, reason: 'missingInstance' });
  });
});

describe('summary manage page', () => {
  const options = (value: ReturnType<typeof fixture>, extra: Record<string, unknown> = {}) => ({
    project: value.project, session: value.session, selectedCommand: 'monsters' as const, slots: [], waitModeEnabled: true,
    monsterInstanceId: value.ids[0], monsterView: 'party' as const,
    monsterCollect: { summaryPage: 'manage' as const, ...extra }, onMonsterCollect: (_action: MonsterCollectAction) => undefined, ...extra,
  });
  it('offers a rename row, and the rename row becomes a text input while renaming', () => {
    const value = fixture();
    const idle = monsterInstanceDetail(options(value) as never, [])!;
    expect(idle.entries.some((entry) => entry.testId === `status-menu-monster-rename-${value.ids[0]}` && entry.textInput === undefined)).toBe(true);
    const renaming = monsterInstanceDetail({ ...options(value), monsterCollect: { summaryPage: 'manage', renameId: value.ids[0] } } as never, [])!;
    const row = renaming.entries.find((entry) => entry.textInput);
    expect(row?.textInput?.maxLength).toBe(MONSTER_NICKNAME_MAX);
  });
  it('prefixes a star for shiny and lists gender on the stats page', () => {
    const value = fixture();
    value.session.monsterInstances[value.ids[0]!] = { ...value.session.monsterInstances[value.ids[0]!]!, shiny: true, gender: 'female' };
    const stats = monsterInstanceDetail({ ...options(value), monsterCollect: { summaryPage: 'stats' } } as never, [])!;
    expect(stats.title.startsWith('★ ')).toBe(true);
    expect(stats.entries.some((entry) => entry.testId === 'status-menu-monster-gender' && entry.value === '암컷')).toBe(true);
    expect(stats.artwork === undefined || stats.artwork.shiny === true).toBe(true);
  });
});
