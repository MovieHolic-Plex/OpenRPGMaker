import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster } from '@/project/monsterCollection';
import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { starterChoiceCommands, STARTER_PREVIEW_PICTURE_ID } from '@/project/starterChoice';
import { monsterSaveSummary, monsterSaveSummaryLine, readMonsterSaveSummary } from '@/project/monsterSaveSummary';
import { createSaveSnapshot } from '@/player/saveSlots';
import { saveSlotCardModel } from '@/player/playerLoadPanel';
import type { Command } from '@/project/types';

function fixture() {
  const project = createBlankProject();
  project.system.battleParty = 'monsters';
  project.system.monsterCollection = true;
  configureEmeraldMonsterStyle(project);
  const session = startSession(project);
  return { project, session };
}

describe('starter choice flow', () => {
  it('previews each species, asks for confirmation, gives only on yes and loops back on no', () => {
    const { project } = fixture();
    const ids = project.database.monsterSpecies!.slice(0, 3).map((s) => s.id);
    const commands = starterChoiceCommands(project, { speciesIds: ids, afterGive: () => [{ kind: 'setSwitch', switchId: 'mx_starter', value: true }] });
    expect(commands[0]).toEqual({ kind: 'label', name: 'starter_pick' });
    const pick = commands[1] as Extract<Command, { kind: 'choices' }>;
    expect(pick.options).toHaveLength(3);
    const branch = pick.options[0]!.branch;
    expect(branch.some((c) => c.kind === 'showPicture' && c.pictureId === STARTER_PREVIEW_PICTURE_ID)).toBe(true);
    expect(branch.some((c) => c.kind === 'giveMonster')).toBe(false);
    const confirm = branch.find((c) => c.kind === 'choices') as Extract<Command, { kind: 'choices' }>;
    expect(confirm.options.map((o) => o.text)).toEqual(['예', '아니오']);
    expect(confirm.options[0]!.branch.some((c) => c.kind === 'giveMonster')).toBe(true);
    expect(confirm.options[0]!.branch.some((c) => c.kind === 'erasePicture')).toBe(true);
    expect(confirm.options[1]!.branch).toContainEqual({ kind: 'gotoLabel', name: 'starter_pick' });
    expect(confirm.options[1]!.branch.some((c) => c.kind === 'giveMonster')).toBe(false);
  });
});

describe('monster save summary', () => {
  it('counts caught species, badges and party, and is absent for non-collection games', () => {
    const { project, session } = fixture();
    const species = project.database.monsterSpecies![0]!;
    expect(giveMonster(project, session, { speciesId: species.id, level: 5 }).ok).toBe(true);
    const summary = monsterSaveSummary(project, session)!;
    expect(summary.caught).toBe(1);
    expect(summary.party).toBe(1);
    expect(monsterSaveSummaryLine({ ...summary, badges: 2, badgeTotal: 8 })).toContain('배지 2/8');
    expect(monsterSaveSummaryLine({ ...summary, badgeTotal: 0 })).not.toContain('배지');
    const plain = createBlankProject();
    expect(monsterSaveSummary(plain, startSession(plain))).toBeUndefined();
  });
  it('round-trips through the snapshot and shows on the slot card; plain games write no field', () => {
    const { project, session } = fixture();
    giveMonster(project, session, { speciesId: project.database.monsterSpecies![0]!.id, level: 5 });
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.monsterSummary?.caught).toBe(1);
    expect(readMonsterSaveSummary(JSON.parse(JSON.stringify(snapshot.monsterSummary)))).toEqual(snapshot.monsterSummary);
    expect(readMonsterSaveSummary({ caught: 'x' })).toBeUndefined();
    const card = saveSlotCardModel({ kind: 'present', slot: 1, snapshot });
    expect(card.monster).toContain('도감 1/');
    const plain = createBlankProject();
    expect('monsterSummary' in createSaveSnapshot(plain, startSession(plain))).toBe(false);
  });
});
