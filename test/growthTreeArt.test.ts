import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { normalizeSkillRecord } from '@/project/databaseRecordModel';
import { classGrowthArt, skillGrowthArt, parameterGrowthArt, treeGrowthArt } from '@/assets/growthTreeArt';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { GROWTH_PARAMETERS } from '@/project/growth/types';

describe('growth role art', () => {
  it('distinguishes class roles without borrowing an arbitrary actor face', () => {
    const p = createBlankProject(), base = p.database.classes[0]!;
    const ids = ['전사', '마법사', '성직자', '궁수'].map(name => classGrowthArt(p, { ...base, name }));
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
  });
  it('uses skill effects, never the whole authored animation sheet', () => {
    const p = createBlankProject();
    const skill = normalizeSkillRecord({ id: 'custom', name: 'Custom', animationId: p.database.battleAnimations[0]?.id });
    skill.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
    expect(skillGrowthArt(skill)).toBe('cc0-jetrel-holy-water');
    skill.effect = { kind: 'damage', statistic: 'mind', affects: 'hp' };
    expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-magic');
    skill.effect = { kind: 'damage', statistic: 'attack', affects: 'hp' };
    expect(skillGrowthArt(skill)).toBe('cc0-jetrel-book-sword');
  });
  it('provides registered, distinct parameter symbols and missing-record fallback', () => {
    const ids = GROWTH_PARAMETERS.map(parameterGrowthArt);
    expect(new Set(ids).size).toBe(6);
    for (const id of [...ids, skillGrowthArt(undefined)]) expect(existsSync(`public${resolveAssetResourceUrl(id)}`)).toBe(true);
    expect(skillGrowthArt(undefined)).toBe('cc0-jetrel-skill-book');
  });
  it('supports custom classes through learned skills and empty trees without mutation', () => {
    const p = createBlankProject(), c = structuredClone(p.database.classes[0]!);
    c.name = '별지기'; c.options.dualWield = false; c.options.mightyGuard = false;
    const heal = normalizeSkillRecord({ id: 'custom-heal', name: '별빛' });
    heal.effect = { kind: 'healing', statistic: 'mind', affects: 'hp' };
    p.database.skills.push(heal); c.learnedSkills = [{ level: 1, skillId: heal.id }]; c.skillIds = [];
    const before = JSON.stringify(p);
    expect(classGrowthArt(p, c)).toBe('cc0-jetrel-holy-water');
    expect(treeGrowthArt(p, { id: 'empty', name: 'Empty', description: '', nodes: [], classIds: [], allowReset: true })).toBe('cc0-jetrel-skill-book');
    expect(JSON.stringify(p)).toBe(before);
  });
});
