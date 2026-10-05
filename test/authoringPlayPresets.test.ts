import { describe, expect, it } from 'vitest';
import { buildSessionRegistryTools } from '@/ai/sessionToolExposure';
import { FIRST_PLAY_TOOLS } from '@/ai/piAgent/firstPlay';
import { activeTools, getTool } from '@/editor/tools/toolRegistry';
import { runTool } from '@/editor/tools/toolRunner';
import { createEmptyToolProject } from '@/editor/tools/emptyProject';
import { AUTHORING_PRESETS, authoringPresetById, type AuthoringPreset } from '@/project/authoringPresets';
import type { Project } from '@/project/types';

const list = getTool('list_authoring_presets')!;
const read = getTool('read_authoring_preset')!;
interface ListData {
  entries: { id: string; category: string }[];
  total: number;
  nextOffset: number | null;
}
interface ReadData {
  preset: AuthoringPreset;
  verificationStatus: string;
  authoringState: {
    source: string;
    system: Record<string, unknown>;
    project: Record<string, unknown>;
    database: Record<string, unknown>;
    absentFields: string[];
    absentProjectFields: string[];
    absentDatabaseFields: string[];
    startSession: { gold: number };
  };
}
const listing = (project: Project, args: Record<string, unknown> = {}) => list.run(project, args).data as ListData;
const reading = (project: Project, presetId: string) => read.run(project, { presetId }).data as ReadData;

describe('assistant playable-pattern manuals', () => {
  it('pages the entire catalog once and respects filtered offsets', () => {
    const project = createEmptyToolProject();
    const ids: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = listing(project, { offset });
      expect(page.entries.length).toBeLessThanOrEqual(12);
      ids.push(...page.entries.map(entry => entry.id));
      if (page.nextOffset !== null) expect(page.nextOffset).toBeGreaterThan(offset);
      offset = page.nextOffset;
    }
    expect(ids).toEqual(AUTHORING_PRESETS.map(preset => preset.id));
    expect(new Set(ids).size).toBe(ids.length);
    const category = listing(project, { category: 'party' });
    const tail = listing(project, { category: 'party', offset: 3, limit: 2 });
    expect(tail.total).toBe(category.total);
    expect(tail.entries).toEqual(category.entries.slice(3, 5));
    expect(listing(project, { offset: 10000 }).nextOffset).toBeNull();
  });

  it('combines normalized search terms with the category filter', () => {
    const project = createEmptyToolProject();
    expect(listing(project, { query: '  과거   미래  ', category: 'time-causality' }).entries)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'past-world-change' })]));
    expect(listing(project, { query: 'ＤＵＡＬ－ＴＥＣＨ' }).entries.map(entry => entry.id)).toEqual(['dual-tech']);
    expect(listing(project, { query: 'dual-tech', category: 'endings' }).total).toBe(0);
  });

  it('rejects invalid pagination and identifiers in the actual runner', () => {
    const context = { project: createEmptyToolProject() };
    for (const args of [{ offset: -1 }, { offset: 0.5 }, { limit: 0 }, { limit: 13 },
      { category: 'unknown' }, { query: 7 }, { query: 'x'.repeat(201) }]) {
      expect(runTool(context, list.name, args).ok, JSON.stringify(args)).toBe(false);
    }
    expect(runTool(context, read.name, { presetId: 'unknown' }).ok).toBe(false);
    expect(runTool(context, read.name, {}).ok).toBe(false);
  });

  it('reads fresh originals without sharing mutable catalog or project arrays', () => {
    const project = createEmptyToolProject();
    project.system.sellPrices = [{ itemId: 'marker', price: 123 }];
    project.session.gold = 321;
    const first = reading(project, 'fish-museum');
    expect(first.authoringState.source).toBe('live-project-authoring-data');
    expect(first.authoringState.startSession.gold).toBe(321);
    (first.authoringState.system.sellPrices as { price: number }[])[0].price = 999;
    (first.preset.checks as string[]).push('caller mutation');
    expect(project.system.sellPrices[0].price).toBe(123);
    expect(authoringPresetById('fish-museum')!.checks).not.toContain('caller mutation');
    project.system.sellPrices = [{ itemId: 'marker', price: 456 }];
    const second = reading(project, 'fish-museum');
    expect(second.authoringState.system.sellPrices).toEqual(project.system.sellPrices);
    expect(first.authoringState.system.sellPrices).not.toEqual(second.authoringState.system.sellPrices);
    const context = { project };
    const result = runTool(context, read.name, { presetId: 'fish-museum' });
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toBeUndefined();
    expect(context.project).toBe(project);
    expect((result.data as ReadData).verificationStatus).toBe('not-run');
  });

  it('distinguishes absent fields from authored empty collections', () => {
    const project = createEmptyToolProject();
    delete project.system.sellPrices;
    project.database.fishSpecies = [];
    delete project.database.lifeSkills;
    delete project.endings;
    const life = reading(project, 'fish-museum').authoringState;
    expect(life.absentFields).toContain('sellPrices');
    expect(life.database.fishSpecies).toEqual([]);
    expect(life.absentDatabaseFields).not.toContain('fishSpecies');
    expect(life.absentDatabaseFields).toContain('lifeSkills');
    expect(reading(project, 'choice-endings').authoringState.absentProjectFields).toContain('endings');
  });

  it('references only active tools and classifies every declared write accurately', () => {
    const tools = new Map(activeTools().map(tool => [tool.name, tool]));
    for (const preset of AUTHORING_PRESETS) {
      const references = [...preset.tools.read, ...preset.tools.write, ...preset.tools.verify,
        ...preset.steps.flatMap(step => step.tools)];
      for (const name of references) expect(tools.has(name), `${preset.id}: ${name}`).toBe(true);
      for (const name of preset.tools.write) expect(tools.get(name)?.mode, `${preset.id}: ${name}`).toBe('write');
      for (const name of preset.tools.read) expect(tools.get(name)?.mode, `${preset.id}: ${name}`).toBe('read');
    }
  });

  it('exposes catalog reads before discovery and in the first-play lane', () => {
    const exposed = buildSessionRegistryTools({ requestText: '동료와 시간의 문을 만들어줘', intent: null })
      .map(tool => tool.function.name);
    for (const tool of [list, read]) {
      expect(tool.mode).toBe('read');
      expect(exposed).toContain(tool.name);
      expect(FIRST_PLAY_TOOLS).toContain(tool.name);
    }
    expect(read.parameters.properties?.presetId.enum).toBeUndefined();
  });
});
