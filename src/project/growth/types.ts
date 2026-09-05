import type { ActorParameterKey } from '@/project/types';

export interface TreePosition { x: number; y: number }
export interface SkillTreeNode extends TreePosition {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxRank: number;
  level: number;
  prerequisites: string[];
  effect: { kind: 'skill'; skillId: string } | { kind: 'parameter'; parameter: ActorParameterKey; amount: number };
}
export interface SkillTree {
  id: string;
  name: string;
  description: string;
  /** Empty = shared by every class. */
  classIds: string[];
  allowReset: boolean;
  nodes: SkillTreeNode[];
}
export interface GrowthDefinition {
  initialPoints: number;
  pointsPerLevel: number;
  /** Optional event variable grants this many extra points to each actor. */
  bonusVariableId?: string;
  classPositions: Record<string, TreePosition>;
  skillTrees: SkillTree[];
}
export interface GrowthInvestment { rank: number; spent: number }
export type GrowthProgress = Record<string, Record<string, Record<string, GrowthInvestment>>>;
export const GROWTH_PARAMETERS = ['maxHp', 'maxMp', 'attack', 'defense', 'mind', 'agility'] as const;
export const GROWTH_PARAMETER_LABELS: Record<ActorParameterKey, string> = {
  maxHp: '최대 HP', maxMp: '최대 MP', attack: '공격력', defense: '방어력', mind: '정신력', agility: '민첩성',
};
export function emptyGrowth(): GrowthDefinition {
  return { initialPoints: 0, pointsPerLevel: 1, classPositions: {}, skillTrees: [] };
}
