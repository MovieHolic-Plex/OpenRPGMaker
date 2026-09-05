import type { StatusMenuDetail, StatusMenuDetailOptions, StatusMenuDetailEntry } from './playerStatusMenuDetailTypes';
import { activeSkillTrees, growthPoints, nodeRank, skillNodeBlocker } from '@/project/growth/runtime';
import { effectiveActorClassId, promotionRequirementsMet } from '@/project/sessionClass';
import { GROWTH_PARAMETER_LABELS } from '@/project/growth/types';
export type GrowthMenuTab = 'skills' | 'tree' | 'promotion';
export type GrowthMenuMutation = { kind: 'invest'; actorId: string; treeId: string; nodeId: string } | { kind: 'reset'; actorId: string; treeId: string } | { kind: 'promote'; actorId: string; classId: string };
export function growthMenuTabs(o: StatusMenuDetailOptions): NonNullable<StatusMenuDetail['tabs']> {
  return ([['skills', '사용 스킬'], ['tree', '스킬 트리'], ['promotion', '직업 승급']] as const).map(([id, label]) => ({ id, label, selected: (o.growthTab ?? 'skills') === id, testId: `growth-menu-tab-${id}`, onActivate: () => o.onSelectGrowthTab?.(id) }));
}
export function createGrowthMenu(o: StatusMenuDetailOptions): StatusMenuDetail {
  const { project: p, session: s } = o, actorId = o.skillActorId!;
  const actor = p.database.actors.find(a => a.id === actorId);
  const entries: StatusMenuDetailEntry[] = [];
  const points = growthPoints(p, s, actorId);
  if (o.growthTab === 'promotion') {
    const klass = p.database.classes.find(c => c.id === effectiveActorClassId(p, s, actorId));
    for (const path of klass?.promotions ?? []) {
      const target = p.database.classes.find(c => c.id === path.toClassId);
      if (!target) continue;
      const conditions = [path.requires.level ? `레벨 ${path.requires.level}` : '', path.requires.itemId ? `${p.database.items.find(i => i.id === path.requires.itemId)?.name ?? path.requires.itemId} 1개 소비` : '', path.requires.switchId ? `${p.switches.find(v => v.id === path.requires.switchId)?.name ?? path.requires.switchId} 켜짐` : '', path.requires.variableId ? `${p.variables.find(v => v.id === path.requires.variableId)?.name ?? path.requires.variableId} ≥ ${path.requires.atLeast ?? 1}` : ''].filter(Boolean).join(' · ');
      entries.push({ label: `${klass?.name} → ${target.name}`, value: '승급', description: conditions || '조건 없이 승급할 수 있습니다.', disabled: !promotionRequirementsMet(s, actorId, path.requires), testId: `growth-menu-promote-${target.id}`, onActivate: () => o.onGrowthMutation?.({ kind: 'promote', actorId, classId: target.id }) });
    }
    return { title: `직업 승급: ${actor?.name ?? ''}`, tabs: growthMenuTabs(o), entries, emptyLabel: '이 직업에서 이어지는 승급 경로가 없습니다.' };
  }
  for (const tree of activeSkillTrees(p, s, actorId)) {
    for (const node of tree.nodes) {
      const rank = nodeRank(s, actorId, tree.id, node.id), blocked = skillNodeBlocker(p, s, actorId, tree, node);
      const skill = node.effect.kind === 'skill' ? p.database.skills.find(k => k.id === (node.effect as { skillId: string }).skillId) : undefined;
      const effect = node.effect.kind === 'parameter' ? `${GROWTH_PARAMETER_LABELS[node.effect.parameter]} +${node.effect.amount} / 등급` : `스킬: ${skill?.name ?? '미연결'}`;
      entries.push({ label: node.name, value: `${rank}/${node.maxRank} · ${node.cost} P`, description: `${tree.name} · ${effect}. ${blocked ?? node.description ?? '습득할 수 있습니다.'}`, disabled: Boolean(blocked), testId: `growth-menu-node-${node.id}`, onActivate: () => o.onGrowthMutation?.({ kind: 'invest', actorId, treeId: tree.id, nodeId: node.id }) });
    }
  }
  // Investments in a previous class must still be refundable after changing class.
  for (const tree of p.growth?.skillTrees ?? []) {
    if (tree.allowReset && Object.keys(s.growthProgress?.[actorId]?.[tree.id] ?? {}).length) entries.push({ label: `${tree.name} 초기화`, value: '포인트 환급', description: '이 트리에 사용한 포인트를 모두 환급합니다.', testId: `growth-menu-reset-${tree.id}`, onActivate: () => o.onGrowthMutation?.({ kind: 'reset', actorId, treeId: tree.id }) });
  }
  return { title: `스킬 트리 · ${points.available} P`, tabs: growthMenuTabs(o), entries, emptyLabel: '현재 직업에서 사용할 수 있는 스킬 트리가 없습니다.' };
}
