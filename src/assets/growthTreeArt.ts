import type { ActorParameterKey, ClassRecord, Project, SkillRecord } from '@/project/types';
import type { SkillTree, SkillTreeNode } from '@/project/growth/types';

// Presentation only: ClassRecord/SkillRecord have no art field. Semantic bundled
// icons work in the player's single-image contract without displaying a sprite sheet.
const icon = (name: string): string => `cc0-jetrel-${name}`;
const BOOK = icon('skill-book');
const CLASS_ROLES: readonly [RegExp, string][] = [
  [/성직|치유|사제|힐러|cleric|healer|priest/i, 'holy-water'],
  [/궁수|사냥꾼|레인저|정찰|ranger|archer|hunter/i, 'gen-bow-short'],
  [/마법|마도|술사|현자|mage|wizard|sorcer|sage/i, 'mage-staff'],
  [/도적|암살|닌자|rogue|thief|assassin|ninja/i, 'scout-dagger'],
  [/수호|기사|성기사|knight|guard|paladin/i, 'oak-shield'],
  [/전사|검사|검객|용사|warrior|fighter|swordsman/i, 'bronze-sword'],
];

export function skillGrowthArt(skill: SkillRecord | undefined): string {
  if (!skill) return BOOK;
  if (skill.type === 'teleport') return icon('warp-scroll');
  if (skill.type === 'escape') return icon('wind-feather');
  switch (skill.effect.kind) {
    case 'healing': return icon(skill.effect.affects === 'mp' ? 'ether-blue' : 'holy-water');
    case 'damage': return icon(skill.effect.statistic === 'mind' ? 'book-magic' : 'book-sword');
    case 'support': return icon('oak-shield');
    case 'switch': return icon('gear');
    default: return icon('book-magic');
  }
}

export function classGrowthArt(project: Project, record: ClassRecord): string {
  const role = CLASS_ROLES.find(([pattern]) => pattern.test(record.name));
  if (role) return icon(role[1]);
  if (record.options.mightyGuard) return icon('oak-shield');
  if (record.options.dualWield) return icon('scout-dagger');
  const skillIds = [...record.learnedSkills.map(s => s.skillId), ...record.skillIds];
  const skill = skillIds.map(id => project.database.skills.find(s => s.id === id)).find(Boolean);
  return skillGrowthArt(skill);
}

const PARAMETER_ART: Record<ActorParameterKey, string> = {
  maxHp: icon('potion-red'), maxMp: icon('ether-blue'), attack: icon('bronze-sword'),
  defense: icon('oak-shield'), mind: icon('focus-charm'), agility: icon('wind-feather'),
};
export function parameterGrowthArt(parameter: ActorParameterKey): string { return PARAMETER_ART[parameter]; }
export function nodeGrowthArt(project: Project, node: SkillTreeNode): string {
  const effect = node.effect;
  return effect.kind === 'parameter' ? parameterGrowthArt(effect.parameter)
    : skillGrowthArt(project.database.skills.find(s => s.id === effect.skillId));
}
export function treeGrowthArt(project: Project, tree: SkillTree): string {
  const record = project.database.classes.find(c => tree.classIds.includes(c.id));
  return record ? classGrowthArt(project, record) : tree.nodes[0] ? nodeGrowthArt(project, tree.nodes[0]) : BOOK;
}
