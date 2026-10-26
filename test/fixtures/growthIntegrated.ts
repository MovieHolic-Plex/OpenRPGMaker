import { createBlankProject } from '@/project/defaults';
import { normalizeSkillRecord, normalizeClassRecord } from '@/project/databaseRecordModel';
import { startSession } from '@/project/session';
import { emptyGrowth, type SkillTree } from '@/project/growth/types';

export function integratedGrowthFixture() {
  const project = createBlankProject();
  const actor = project.database.actors[0];
  if (!actor) throw new Error('fixture actor missing');
  actor.classId = 'A'; actor.initialLevel = 3;
  actor.learnedSkills = [{ level: 1, skillId: 'actor-skill' }];
  project.database.skills.push(...['actor-skill', 'A-skill', 'B-skill', 'C-skill', 'D-skill', 'future', 'tree-skill'].map(id => normalizeSkillRecord({ id, name: id })));
  const classes = ['A', 'B', 'C', 'D'].map(id => normalizeClassRecord({ id, name: id, learnedSkills: [{ level: 1, skillId: `${id}-skill` }, { level: 9, skillId: 'future' }], promotions: (id === 'A' ? ['B', 'C'] : id === 'B' || id === 'C' ? ['D'] : ['A']).map(toClassId => ({ toClassId, requires: {} })) }));
  project.database.classes.unshift(...classes);
  const trees: SkillTree[] = ['A', 'B', 'C', 'D'].map(id => ({ id: `tree-${id}`, name: id, description: '', classIds: [id], inheritOnPromotion: true, allowReset: true, nodes: [
    { id: 'root', name: 'root', description: '', x: 0, y: 0, cost: 2, maxRank: 3, level: 1, prerequisites: [], effect: { kind: 'parameter', parameter: 'defense', amount: 7 } },
    { id: 'skill', name: 'skill', description: '', x: 250, y: 0, cost: 1, maxRank: 1, level: 1, prerequisites: ['root'], effect: { kind: 'skill', skillId: 'tree-skill' } },
  ] }));
  project.growth = { ...emptyGrowth(), initialPoints: 30, skillTrees: trees };
  // 첫 부대의 기본 적(enemy_slime)은 이제 산성 침 등 원작 로스터 행동(archetypeActions)으로 레벨 3 시험 배우를 한 턴에 쓰러뜨려,
  // 방어 명령 이벤트(승급·레벨 변경)가 돌기 전에 전투가 끝난다 — 성장 검사이므로 그 적을 맨 뒤에 서는 무해한 표적으로 둔다.
  const firstTroop = project.database.troops[0];
  for (const member of firstTroop?.members ?? []) {
    const enemy = project.database.enemies.find(e => e.id === member.enemyId);
    if (!enemy) continue;
    enemy.stats = { ...enemy.stats, attack: 1, mind: 1, agility: 1 };
    enemy.actions = [{ skillId: '', priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  }
  project.system.startActorIds = [actor.id]; project.session.partyActorIds = [actor.id];
  const session = startSession(project);
  return { project, actor, session, trees };
}
