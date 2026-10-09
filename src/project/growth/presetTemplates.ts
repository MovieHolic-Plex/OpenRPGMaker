import type { ActorParameterKey, ClassRecord, SkillRecord } from '@/project/types';
import { ACTOR_LEVEL_MAX } from '@/project/actorModel';
import { normalizeClassRecord, normalizeSkillRecord } from '@/project/databaseRecordModel';
import type { SkillTree, SkillTreeNode } from './types';

export type GrowthPresetRole = 'vanguard' | 'arcane' | 'ranger';
export type GrowthStudioMode = 'promotion' | 'skill';
export type GrowthPresetKind = GrowthStudioMode | 'bundle';
export interface GrowthPresetMetadata {
  readonly id: string;
  readonly kind: GrowthPresetKind;
  readonly role: GrowthPresetRole;
  readonly name: string;
  readonly description: string;
  /** Editor-only cover, not an authored runtime asset reference. */
  readonly coverUrl: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly classCount: number;
  readonly skillCount: number;
}

const roles = {
  vanguard: {
    promotion: '강철 기사단', skill: '전열 무예',
    promotionDescription: '공격 기사와 수호 기사로 갈라지는 기사단의 승급 계보입니다.',
    skillDescription: '공격 숙련과 생존 훈련을 함께 익히는 전열 전투 경로입니다.',
    classes: ['견습 기사', '돌격 기사', '수호 기사', '검의 기사장', '철벽 기사장'],
    specialties: ['attack', 'attack', 'defense', 'attack', 'defense'],
    parameters: ['attack', 'maxHp', 'defense', 'maxHp'],
    passives: ['기초 무예', '체력 단련', '수비 훈련', '불굴의 체력'],
    amounts: [3, 15, 3, 25], starts: [70, 16, 20, 16, 10, 12],
    skills: [
      { name: '강타', description: '적 하나에게 공격력 기반 HP 피해를 줍니다.', scope: 'enemy', power: 20, mp: 2, effect: 'damage' },
      { name: '전열 정비', description: '아군 하나의 HP를 회복합니다.', scope: 'ally', power: 24, mp: 4, effect: 'healing' },
      { name: '결전 베기', description: '적 하나에게 강한 공격력 기반 HP 피해를 줍니다.', scope: 'enemy', power: 48, mp: 7, effect: 'damage' },
    ],
  },
  arcane: {
    promotion: '별빛 마법 학파', skill: '마력 연구',
    promotionDescription: '공격 마법과 회복 연구로 나뉘는 비속성 마법 학파입니다.',
    skillDescription: '정신력과 마력 용량을 키우며 공격·회복 술식을 연구합니다.',
    classes: ['견습 마법사', '전투 마법사', '치유 마법사', '대마법사', '현자 마법사'],
    specialties: ['mind', 'mind', 'maxMp', 'mind', 'maxMp'],
    parameters: ['mind', 'maxMp', 'maxHp', 'mind'],
    passives: ['술식 기초', '마력 그릇', '집중 체력', '심화 연구'],
    amounts: [3, 8, 12, 5], starts: [48, 32, 10, 11, 24, 13],
    skills: [
      { name: '마력탄', description: '적 하나에게 정신력 기반 비속성 HP 피해를 줍니다.', scope: 'enemy', power: 24, mp: 3, effect: 'damage' },
      { name: '치유 술식', description: '아군 하나의 HP를 회복합니다.', scope: 'ally', power: 32, mp: 5, effect: 'healing' },
      { name: '마력 파동', description: '적 전체에게 정신력 기반 비속성 HP 피해를 줍니다.', scope: 'allEnemies', power: 36, mp: 8, effect: 'damage' },
    ],
  },
  ranger: {
    promotion: '숲길 추적자 계보', skill: '생존과 정밀 사격',
    promotionDescription: '정밀 사격과 야전 생존으로 갈라지는 숲의 궁수 계보입니다.',
    skillDescription: '민첩성과 공격력을 단련하고 야전 회복과 전체 사격을 익힙니다.',
    classes: ['견습 궁수', '명사수', '숲길 정찰 궁수', '궁수 대장', '숲의 수호 궁수'],
    specialties: ['agility', 'attack', 'agility', 'attack', 'agility'],
    parameters: ['agility', 'maxHp', 'attack', 'agility'],
    passives: ['추적자의 발걸음', '야전 체력', '정밀 조준', '숙련된 기동'],
    amounts: [3, 12, 3, 5], starts: [56, 20, 19, 12, 12, 23],
    skills: [
      { name: '조준 사격', description: '적 하나에게 공격력 기반 HP 피해를 줍니다.', scope: 'enemy', power: 18, mp: 2, effect: 'damage' },
      { name: '야전 치료', description: '아군 하나의 HP를 회복합니다.', scope: 'ally', power: 26, mp: 4, effect: 'healing' },
      { name: '일제 사격', description: '적 전체에게 공격력 기반 HP 피해를 줍니다.', scope: 'allEnemies', power: 32, mp: 6, effect: 'damage' },
    ],
  },
} as const;

export const GROWTH_PRESETS: readonly GrowthPresetMetadata[] = Object.freeze(
  (['bundle', 'promotion', 'skill'] as const).flatMap(kind =>
    (['vanguard', 'arcane', 'ranger'] as const).map(role => Object.freeze({
      id: `${kind}-${role}`, kind, role, name: kind === 'bundle' ? `${roles[role].promotion} · 연결 성장` : roles[role][kind],
      description: kind === 'bundle' ? '직업별 트리를 계승하며 5레벨과 12레벨에 승급하는 연결 성장 묶음입니다.' : kind === 'promotion' ? roles[role].promotionDescription : roles[role].skillDescription,
      coverUrl: `/assets/generated/growth-presets/${role}.png`,
      nodeCount: kind === 'bundle' ? 15 : kind === 'promotion' ? 5 : 7, edgeCount: kind === 'bundle' ? 13 : kind === 'promotion' ? 4 : 7,
      classCount: kind !== 'skill' ? 5 : 0, skillCount: 3,
    }))),
);

/** Fresh mutable records with template-local IDs; only the applicator publishes them. */
export function createGrowthPresetTemplate(preset: GrowthPresetMetadata): {
  skills: SkillRecord[]; classes: ClassRecord[]; trees: SkillTree[];
} {
  const role = roles[preset.role];
  const skills = role.skills.map((skill, index) => normalizeSkillRecord({
    id: `skill-${index}`, name: skill.name, description: skill.description,
    scope: skill.scope, power: skill.power, mpCost: { flat: skill.mp, percentMax: 0 },
    successRate: 100, hitRate: 100, variance: 0,
    effect: skill.effect === 'healing' ? { kind: 'healing', statistic: 'mind', affects: 'hp' }
      : { kind: 'damage', statistic: preset.role === 'arcane' ? 'mind' : 'attack', affects: 'hp' },
  }));
  if (preset.kind !== 'skill') {
    const classes = role.classes.map((name, index) => {
      const tier = index === 0 ? 0 : index < 3 ? 1 : 2;
      const specialty = role.specialties[index];
      const curve = (parameter: ActorParameterKey, start: number): number[] => Array.from(
        { length: ACTOR_LEVEL_MAX }, (_, level) => Math.round(start * (1 + tier * 0.12 + level * (parameter === specialty ? 0.09 : 0.05))),
      );
      const [hp, mp, attack, defense, mind, agility] = role.starts;
      const learnedSkills = [{ level: 1, skillId: 'skill-0' }];
      if (index === 2 || index === 4) learnedSkills.push({ level: 5, skillId: 'skill-1' });
      if (index === 1 || index >= 3) learnedSkills.push({ level: index === 1 ? 8 : 12, skillId: 'skill-2' });
      const klass = normalizeClassRecord({
        id: `class-${index}`, name, learnedSkills,
        promotions: index === 0 ? [{ toClassId: 'class-1', requires: { level: 5 } }, { toClassId: 'class-2', requires: { level: 5 } }]
          : index < 3 ? [{ toClassId: `class-${index + 2}`, requires: { level: 12 } }] : [],
        options: { dualWield: false, autoBattle: false, fixedEquipment: false, mightyGuard: preset.role === 'vanguard' && (index === 2 || index === 4) },
        battleCommands: [
          { id: 'attack', name: '공격', kind: 'attack' }, { id: 'skill', name: '스킬', kind: 'skill' },
          { id: 'defend', name: '방어', kind: 'defend' }, { id: 'item', name: '아이템', kind: 'item' },
          { id: 'escape', name: '도주', kind: 'escape' },
        ],
        parameterCurves: { maxHp: curve('maxHp', hp), maxMp: curve('maxMp', mp), attack: curve('attack', attack),
          defense: curve('defense', defense), mind: curve('mind', mind), agility: curve('agility', agility) },
        stateRates: {},
      });
      return klass;
    });
    if (preset.kind === 'promotion') return { skills, classes, trees: [] };
    // Each source tree costs 3 P (rank 2 + skill 1). Both paths cost 3 P at
    // Lv.5 and 6 P at Lv.12; all final-tree nodes fit the 13 P budget at Lv.12.
    const trees: SkillTree[] = classes.map((klass, index) => {
      const parent = index === 0 ? undefined : index < 3 ? 0 : index - 2;
      const level = index === 0 ? 1 : index < 3 ? 5 : 12;
      const skillIndex = index === 0 ? 0 : index === 2 || index === 4 ? 1 : 2;
      const treeId = `tree-${index}`;
      klass.skillIds = []; klass.learnedSkills = [];
      for (const edge of klass.promotions ?? []) edge.requires = {
        ...edge.requires,
        requiredSkillIds: [`skill-${skillIndex}`],
        requiredNodes: [{ treeId, nodeId: 'root', rank: 2 }],
        requiredTreePoints: [{ treeId, points: 3 }],
      };
      return { id: treeId, name: `${klass.name} · ${role.skill}`, description: '기초 2등급과 스킬을 익혀 다음 직업으로 승급하세요. 실제 승급 경로에서 계승됩니다.',
        classIds: [klass.id], inheritOnPromotion: true, allowReset: true, nodes: [
          { id: 'root', name: role.passives[index === 0 ? 0 : index === 2 || index === 4 ? 1 : 2], description: '',
            x: 56, y: 60, cost: 1, level, maxRank: 2, prerequisites: [],
            ...(parent === undefined ? {} : { requiredNodes: [{ treeId: `tree-${parent}`, nodeId: 'root', rank: 2 }] }),
            effect: { kind: 'parameter', parameter: role.parameters[index === 0 ? 0 : index === 2 || index === 4 ? 1 : 2], amount: role.amounts[index === 0 ? 0 : index === 2 || index === 4 ? 1 : 2] } },
          { id: 'technique', name: role.skills[skillIndex].name, description: role.skills[skillIndex].description,
            x: 304, y: 60, cost: 1, level: Math.max(2, level), maxRank: 1, prerequisites: ['root'],
            requiredNodes: [{ treeId, nodeId: 'root', rank: 2 }], effect: { kind: 'skill', skillId: `skill-${skillIndex}` } },
        ] };
    });
    return { skills, classes, trees };
  }
  const passive = (index: 0 | 1 | 2 | 3): SkillTreeNode['effect'] => ({
    kind: 'parameter', parameter: role.parameters[index], amount: role.amounts[index],
  });
  const nodes: SkillTreeNode[] = [
    { id: 'root', name: role.passives[0], description: '', x: 56, y: 136, cost: 1, level: 1, maxRank: 3, prerequisites: [], effect: passive(0) },
    { id: 'technique', name: role.skills[0].name, description: role.skills[0].description, x: 304, y: 60, cost: 2, level: 3, maxRank: 1, prerequisites: ['root'], effect: { kind: 'skill', skillId: 'skill-0' } },
    { id: 'endurance', name: role.passives[1], description: '', x: 304, y: 212, cost: 1, level: 2, maxRank: 3, prerequisites: ['root'], effect: passive(1) },
    { id: 'recovery', name: role.skills[1].name, description: role.skills[1].description, x: 552, y: 212, cost: 2, level: 6, maxRank: 1, prerequisites: ['endurance'], effect: { kind: 'skill', skillId: 'skill-1' } },
    { id: 'discipline', name: role.passives[2], description: '', x: 552, y: 60, cost: 1, level: 4, maxRank: 3, prerequisites: ['technique'], effect: passive(2) },
    { id: 'mastery', name: role.skills[2].name, description: role.skills[2].description, x: 800, y: 60, cost: 3, level: 10, maxRank: 1, prerequisites: ['discipline'], effect: { kind: 'skill', skillId: 'skill-2' } },
    { id: 'capstone', name: role.passives[3], description: '', x: 1048, y: 136, cost: 3, level: 12, maxRank: 2, prerequisites: ['mastery', 'recovery'], effect: passive(3) },
  ];
  return { skills, classes: [], trees: [{ id: 'tree', name: preset.name, description: preset.description, classIds: [], allowReset: true, nodes }] };
}
