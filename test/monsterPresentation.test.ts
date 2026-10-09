import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { applyGenrePreset } from '@/project/genrePresets';
import { configureMonsterPresentation } from '@/project/monsterPresentation';
import { MONSTER_SYSTEM_TOOLS } from '@/editor/tools/monsterSystemTools';

describe('collector authoring presentation', () => {
  it('uses the common preset without retaining the stock kingdom intro', () => {
    const project = createBlankProject();
    applyGenrePreset(project, 'monster-collect');
    expect(project.system.battleParty).toBe('monsters');
    expect(project.system.menuUiStyle).toBe('pixel');
    expect(project.system.fieldHud).toMatchObject({ theme: 'collector', vitals: false });
    expect(project.system.opening?.enabled).toBe(false);
  });
  it('keeps an independently authored opening story', () => {
    const project = createBlankProject();
    project.system.opening!.scenes[0]!.narration = '우리 마을의 새로운 이야기';
    const opening = structuredClone(project.system.opening);
    expect(configureMonsterPresentation(project).defaultOpeningDisabled).toBe(false);
    expect(project.system.opening).toEqual(opening);
  });
  it('requires explicit presentation opt-in and declares configuration scope', () => {
    const project = createBlankProject();
    const prior = structuredClone(project.system.opening);
    const tool = MONSTER_SYSTEM_TOOLS.find(tool => tool.name === 'configure_monster_system')!;
    const result = tool.run(project, { enabled: true, battleParty: true });
    expect(project.system.opening).toEqual(prior);
    expect(result.data).toMatchObject({ verificationScope: 'configuration-only', partyPresentation: 'monster-party' });
    tool.run(project, { enabled: true, presentation: 'collector' });
    expect(project.system.opening?.enabled).toBe(false);
  });
});
