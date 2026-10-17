import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { giveMonster } from '@/project/monsterCollection';
import { configureEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import {
  MONSTER_BOX_MIN_COUNT, MONSTER_BOX_SIZE, depositMonsterToBox, monsterBoxCount, monsterBoxLayout, monsterBoxName,
  normalizeMonsterBoxNames, placeBoxMonster, releaseMonsterFromBox,
} from '@/project/monsterBox';
import { BOX_HEADER_ENTRY_COUNT, boxCursorOf, boxIndexAt, moveBoxCursor } from '@/player/playerMonsterBoxGrid';
import { MONSTER_PC_TOOLS } from '@/editor/tools/monsterPcTools';

function fixture(count: number) {
  const project = createBlankProject();
  project.system.battleParty = 'monsters';
  configureEmeraldMonsterStyle(project);
  const session = startSession(project);
  const species = project.database.monsterSpecies![0]!;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const given = giveMonster(project, session, { speciesId: species.id, level: 5, nickname: `동료${i}` });
    if (!given.ok) throw new Error('give failed');
    ids.push(given.instance.instanceId);
  }
  return { project, session, ids };
}

describe('monster box layout', () => {
  it('has at least eight boxes of thirty and grows with the stored count', () => {
    const { session } = fixture(1);
    expect(monsterBoxCount(session)).toBe(MONSTER_BOX_MIN_COUNT);
    session.monsterBox = Array.from({ length: MONSTER_BOX_SIZE * MONSTER_BOX_MIN_COUNT + 1 }, (_, i) => `x${i}`);
    expect(monsterBoxCount(session)).toBe(MONSTER_BOX_MIN_COUNT + 1);
  });
  it('names boxes from the authored list and falls back to 상자 N', () => {
    const { project } = fixture(1);
    project.system.monsterBoxNames = ['모험'];
    expect(monsterBoxName(project, 0)).toBe('모험');
    expect(monsterBoxName(project, 1)).toBe('상자 2');
    expect(normalizeMonsterBoxNames(['a', '', ''])).toEqual(['a']);
    expect(normalizeMonsterBoxNames(['', ''])).toBeUndefined();
  });
  it('places stored monsters in the first free cells without a boxSlot', () => {
    const { project, session, ids } = fixture(3);
    for (const id of ids) depositMonsterToBox(project, session, id);
    const layout = monsterBoxLayout(session);
    expect(layout.filter(Boolean)).toHaveLength(session.monsterBox.length);
  });
});

describe('box moves', () => {
  it('moves to an empty cell in another box and swaps with an occupant', () => {
    const { project, session, ids } = fixture(4);
    ids.slice(1).forEach((id) => depositMonsterToBox(project, session, id));
    const [a, b] = session.monsterBox as [string, string];
    expect(placeBoxMonster(session, a, MONSTER_BOX_SIZE + 2)).toEqual({ ok: true });
    expect(monsterBoxLayout(session)[MONSTER_BOX_SIZE + 2]).toBe(a);
    const slotB = monsterBoxLayout(session).indexOf(b);
    expect(placeBoxMonster(session, a, slotB)).toEqual({ ok: true, swappedWith: b });
    expect(monsterBoxLayout(session)[slotB]).toBe(a);
    expect(placeBoxMonster(session, a, slotB)).toEqual({ ok: false, reason: 'same' });
    expect(placeBoxMonster(session, ids[0]!, 0)).toEqual({ ok: false, reason: 'notInBox' });
  });
  it('deposits to a chosen box but never the last party monster', () => {
    const { project, session, ids } = fixture(2);
    const result = depositMonsterToBox(project, session, ids[1]!, 2);
    expect(result.ok && result.slot).toBe(2 * MONSTER_BOX_SIZE);
    expect(depositMonsterToBox(project, session, ids[0]!)).toEqual({ ok: false, reason: 'lastPartyMonster' });
  });
});

describe('release', () => {
  it('removes the monster, keeps the dex record and returns the held item', () => {
    const { project, session, ids } = fixture(2);
    const item = project.database.items[0]!.id;
    session.monsterInstances[ids[1]!] = { ...session.monsterInstances[ids[1]!]!, heldItemId: item };
    depositMonsterToBox(project, session, ids[1]!);
    const before = session.inventory[item] ?? 0;
    const result = releaseMonsterFromBox(project, session, ids[1]!);
    expect(result.ok && result.returnedItemId).toBe(item);
    expect(session.monsterBox).not.toContain(ids[1]);
    expect(session.monsterInstances[ids[1]!]).toBeUndefined();
    expect(session.inventory[item] ?? 0).toBe(before + 1);
  });
});

describe('box grid cursor', () => {
  it('walks header, cells and edges', () => {
    expect(boxCursorOf(0)).toEqual({ row: 0, col: 0 });
    expect(boxIndexAt(1, 2)).toBe(BOX_HEADER_ENTRY_COUNT + 2);
    expect(moveBoxCursor(1, 'down')).toBe(BOX_HEADER_ENTRY_COUNT + 1);
    expect(moveBoxCursor(0, 'left')).toBeNull();
    expect(moveBoxCursor(BOX_HEADER_ENTRY_COUNT, 'left')).toBeNull();
    expect(moveBoxCursor(BOX_HEADER_ENTRY_COUNT + 5, 'right')).toBe(BOX_HEADER_ENTRY_COUNT + 5);
    expect(moveBoxCursor(BOX_HEADER_ENTRY_COUNT + 24, 'down')).toBe(boxIndexAt(0, 0));
  });
});

describe('place_monster_pc', () => {
  it('requires monsterCollection and plants an action event with the box screen command', () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const tool = MONSTER_PC_TOOLS[0]!;
    expect(() => tool.run(project, { mapId, x: 1, y: 1 })).toThrow();
    project.system.monsterCollection = true;
    const result = tool.run(project, { mapId, x: 1, y: 1 });
    const event = project.maps[mapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId)!;
    const commands = event.pages![0]!.commands;
    expect(commands.some((c) => c.kind === 'm2Command' && c.commandId === 'm2-078-open-menu-screen' && (c.fields as { screen?: string }).screen === 'monster-box')).toBe(true);
  });
});
