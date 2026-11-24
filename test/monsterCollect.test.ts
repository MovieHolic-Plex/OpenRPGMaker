import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { giveMonster, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { configureEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { MONSTER_BOX_MIN_COUNT, MONSTER_BOX_SIZE, depositMonsterToBox, monsterBoxCount, monsterBoxLayout, monsterBoxName, normalizeMonsterBoxNames, placeBoxMonster, releaseMonsterFromBox } from "@/project/monsterBox";
import { BOX_HEADER_ENTRY_COUNT, boxCursorOf, boxIndexAt, moveBoxCursor } from "@/player/playerMonsterBoxGrid";
import { MONSTER_PC_TOOLS } from "@/editor/tools/monsterPcTools";
import { MONSTER_NICKNAME_MAX, normalizeGenderRatio, normalizeShinyRate, renameMonster, rollMonsterIdentity } from "@/project/monsterIdentity";
import { monsterInstanceDetail } from "@/player/playerMonsterPartyDetail";
import type { MonsterCollectAction } from "@/player/playerMonsterCollectTypes";
import { starterChoiceCommands, STARTER_PREVIEW_PICTURE_ID } from "@/project/starterChoice";
import { monsterSaveSummary, monsterSaveSummaryLine, readMonsterSaveSummary } from "@/project/monsterSaveSummary";
import { createSaveSnapshot } from "@/player/saveSlots";
import { saveSlotCardModel } from "@/player/playerLoadPanel";
import type { Command } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("monsterCollectBox", () => {
  isolateTimers();
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
});

describe("monsterCollectIdentity", () => {
  isolateTimers();
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
});

describe("monsterCollectStarterSave", () => {
  isolateTimers();
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
});
