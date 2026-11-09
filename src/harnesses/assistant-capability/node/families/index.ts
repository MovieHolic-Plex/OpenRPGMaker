import type { Family } from './types';
import { GROUP_1 } from './group-1';
import { GROUP_2 } from './group-2';
import { GROUP_3 } from './group-3';
import { GROUP_4 } from './group-4';
import { GROUP_5 } from './group-5';
import { GROUP_6A } from './group-6a';
import { GROUP_6B } from './group-6b';

export type { Family, FamilyArea, FamilyOutcome, FamilyVariant } from './types';
export { rectArg, strArg, numArg } from './types';

/** The original 100-family / 500-row matrix (spec `500`). Its counts are a contract; new game-making families live in `dsFamilies()`. */
export function baseFamilies(): readonly Family[] {
  return [...GROUP_1, ...GROUP_2, ...GROUP_3, ...GROUP_4, ...GROUP_5];
}

/** Game-making families added for the ds500 matrix (quests, towns, endings, bosses …) — no drawing or tile painting. */
export function dsFamilies(): readonly Family[] {
  return [...GROUP_6A, ...GROUP_6B];
}

export function allFamilies(): readonly Family[] {
  return [...baseFamilies(), ...dsFamilies()];
}

export function findFamily(id: string): Family | undefined {
  return allFamilies().find(family => family.id === id);
}

/** Structural problems a group author must fix before a spec can be generated. */
export function familyProblems(families: readonly Family[] = allFamilies()): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const family of families) {
    if (ids.has(family.id)) problems.push(`${family.id}: id 중복`);
    ids.add(family.id);
    if (family.variants.length !== 5) problems.push(`${family.id}: 변형 ${family.variants.length}개(5개여야 한다)`);
    const keys = new Set<string>();
    for (const variant of family.variants) {
      if (keys.has(variant.key)) problems.push(`${family.id}: 변형 key 중복 ${variant.key}`);
      keys.add(variant.key);
      if (!variant.prompt.trim()) problems.push(`${family.id}__${variant.key}: 프롬프트가 비었다`);
      if (!variant.args || typeof variant.args !== 'object') problems.push(`${family.id}__${variant.key}: args 가 없다`);
    }
  }
  return problems;
}
