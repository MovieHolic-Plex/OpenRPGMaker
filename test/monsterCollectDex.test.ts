import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster } from '@/project/monsterCollection';
import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { monsterDexNote, monsterDexSpeciesIds, monsterJournalEntry, monsterSpeciesHabitats, recordMonsterSeen } from '@/project/monsterJournal';
import { createStatusMenuDetail } from '@/player/playerStatusMenuDetails';
import { habitatSummary } from '@/player/playerMonsterDexDetail';
import { listStatusMenuCommandIds } from '@/player/playerStatusMenuModel';

function fixture(collection: boolean) {
  const project = createBlankProject();
  project.system.battleParty = 'monsters';
  if (collection) project.system.monsterCollection = true;
  configureEmeraldMonsterStyle(project);
  project.database.monsterSpecies![0]!.dexNote = '도감 설명 한 줄.';
  return { project, session: startSession(project) };
}

const base = (v: ReturnType<typeof fixture>) => ({ project: v.project, session: v.session, selectedCommand: 'monster-dex' as const, slots: [], waitModeEnabled: true });

describe('monster dex without a campaign definition', () => {
  it('lists every species only for a capture game, and nothing for other games', () => {
    const on = fixture(true), off = fixture(false);
    expect(monsterDexSpeciesIds(on.project)).toEqual(on.project.database.monsterSpecies!.map((s) => s.id));
    expect(monsterDexSpeciesIds(off.project)).toEqual([]);
  });
  it('records sightings and captures without a campaign, and not for a non-capture game', () => {
    const on = fixture(true), off = fixture(false);
    const id = on.project.database.monsterSpecies![0]!.id;
    recordMonsterSeen(on.project, on.session, id);
    expect(monsterJournalEntry(on.session, id)).toEqual({ seen: true, caught: false });
    giveMonster(on.project, on.session, { speciesId: id, level: 5 });
    expect(monsterJournalEntry(on.session, id).caught).toBe(true);
    recordMonsterSeen(off.project, off.session, id);
    expect(off.session.switches[`mx_seen_${id}`]).toBeUndefined();
  });
  it('reads the note from the species record and falls back to nothing', () => {
    const { project } = fixture(true);
    expect(monsterDexNote(project, project.database.monsterSpecies![0]!.id)).toBe('도감 설명 한 줄.');
    expect(monsterDexNote(project, 'nope')).toBeUndefined();
  });
  it('builds a list with progress meter and a paged detail on the emerald skin', () => {
    const v = fixture(true);
    const id = v.project.database.monsterSpecies![0]!.id;
    recordMonsterSeen(v.project, v.session, id);
    const list = createStatusMenuDetail(base(v));
    expect(list.meter).toEqual({ seen: 1, caught: 0, total: v.project.database.monsterSpecies!.length });
    const detail = createStatusMenuDetail({ ...base(v), campaignSpeciesId: id, onDexPage: () => {}, onSelectCampaignSpecies: () => {} });
    expect(detail.entries.some((e) => e.testId === 'campaign-dex-page')).toBe(true);
    expect(detail.entries.some((e) => e.testId === `campaign-dex-habitat-${id}`)).toBe(true);
    const stats = createStatusMenuDetail({ ...base(v), campaignSpeciesId: id, dexPage: 'stats', onDexPage: () => {}, onSelectCampaignSpecies: () => {} });
    expect(stats.entries.some((e) => e.label === '공격')).toBe(true);
    expect(stats.entries.some((e) => e.testId === `campaign-dex-habitat-${id}`)).toBe(false);
  });
  it('shows the dex command for a capture game without a campaign, hides it otherwise', () => {
    const on = fixture(true), off = fixture(false);
    expect(listStatusMenuCommandIds(on.project, on.session)).toContain('monster-dex');
    expect(listStatusMenuCommandIds(off.project, off.session)).not.toContain('monster-dex');
  });
});

describe('habitats', () => {
  it('finds maps whose encounter table reaches the species through troop and enemy records', () => {
    const { project } = fixture(true);
    const species = project.database.monsterSpecies![0]!;
    const enemy = { ...project.database.enemies[0]!, id: 'dex_enemy', speciesId: species.id };
    project.database.enemies.push(enemy);
    const troop = { ...project.database.troops[0]!, id: 'dex_troop', enemyIds: ['dex_enemy'], members: undefined };
    project.database.troops.push(troop);
    const map = Object.values(project.maps)[0]!;
    map.name = '1번길';
    map.encounterTable = [{ troopId: 'dex_troop', weight: 1 }];
    expect(monsterSpeciesHabitats(project, species.id)).toEqual(['1번길']);
    expect(monsterSpeciesHabitats(project, 'nope')).toEqual([]);
  });
  it('folds long habitat lists', () => {
    expect(habitatSummary([])).toBe('');
    expect(habitatSummary(['가', '나'])).toBe('가 · 나');
    expect(habitatSummary(['가', '나', '다', '라'])).toBe('가 · 나 외 2곳');
  });
});
