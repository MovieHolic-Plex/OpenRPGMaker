import type { Project } from '@/project/types';
import { GROWTH_PARAMETERS, type GrowthDefinition, type GrowthProgress } from './types';
import { wouldCreateCycle } from './graph';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max = 999999): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
/** Optional v4 extension: reject invalid structure instead of silently losing authored data. */
export function assertGrowthShape(value: unknown): asserts value is GrowthDefinition | undefined {
  if (value === undefined) return;
  const check = (ok: unknown, message: string): void => { if (!ok) throw new Error(`성장 트리: ${message}`); };
  check(object(value), '설정이 객체여야 합니다.');
  const g = value as GrowthDefinition;
  check(integer(g.initialPoints, 0) && integer(g.pointsPerLevel, 0, 1000), '포인트가 올바르지 않습니다.');
  check(g.bonusVariableId === undefined || typeof g.bonusVariableId === 'string', '보너스 변수 형식이 올바르지 않습니다.');
  check(object(g.classPositions), '직업 배치가 올바르지 않습니다.');
  const position = (p: unknown): boolean => object(p) && integer(p.x, 0, 10000) && integer(p.y, 0, 10000);
  for (const p of Object.values(g.classPositions)) check(position(p), '노드 좌표는 0~10000 정수입니다.');
  check(Array.isArray(g.skillTrees), '스킬 트리 목록이 필요합니다.');
  const treeIds = new Set<string>();
  for (const t of g.skillTrees) {
    check(object(t) && typeof t.id === 'string' && t.id.length > 0 && !treeIds.has(t.id), '트리 ID가 없거나 중복됩니다.');
    treeIds.add(t.id);
    check(typeof t.name === 'string' && typeof t.description === 'string', '트리 이름과 설명이 필요합니다.');
    check(Array.isArray(t.classIds) && t.classIds.every(id => typeof id === 'string'), '직업 연결 형식이 올바르지 않습니다.');
    check(typeof t.allowReset === 'boolean' && Array.isArray(t.nodes), '노드 목록과 초기화 설정이 필요합니다.');
    const nodeIds = new Set<string>();
    for (const n of t.nodes) {
      check(object(n) && typeof n.id === 'string' && n.id.length > 0 && !nodeIds.has(n.id), '노드 ID가 없거나 중복됩니다.');
      nodeIds.add(n.id);
      check(typeof n.name === 'string' && typeof n.description === 'string' && position(n), '노드 이름·설명·좌표가 올바르지 않습니다.');
      check(integer(n.cost, 1, 9999) && integer(n.maxRank, 1, 99) && integer(n.level, 1, 99), '비용·등급·레벨 범위를 확인하세요.');
      check(Array.isArray(n.prerequisites) && n.prerequisites.every(id => typeof id === 'string'), '선행 노드 목록이 올바르지 않습니다.');
      check(object(n.effect), '노드 효과가 필요합니다.');
      check(n.effect.kind === 'skill'
        ? typeof n.effect.skillId === 'string' && n.maxRank === 1
        : n.effect.kind === 'parameter' && GROWTH_PARAMETERS.includes(n.effect.parameter) && integer(n.effect.amount, 1, 9999), '스킬 또는 능력치 효과를 확인하세요.');
    }
  }
}
export function growthIssues(project: Project): string[] {
  const g = project.growth;
  if (!g) return [];
  const issues: string[] = [];
  if (g.bonusVariableId && !project.variables.some(v => v.id === g.bonusVariableId)) issues.push('성장 포인트 보너스 변수가 없습니다.');
  for (const t of g.skillTrees) {
    for (const id of t.classIds) if (!project.database.classes.some(c => c.id === id)) issues.push(`${t.name}: 연결된 직업이 없습니다 (${id}).`);
    const edges = t.nodes.flatMap(n => n.prerequisites.map(from => ({ from, to: n.id })));
    for (const n of t.nodes) {
      if (n.effect.kind === 'skill' && !project.database.skills.some(s => s.id === (n.effect as {skillId: string}).skillId)) issues.push(`${t.name} / ${n.name}: 스킬을 선택하세요.`);
      for (const id of n.prerequisites) if (!t.nodes.some(p => p.id === id)) issues.push(`${t.name} / ${n.name}: 선행 노드가 없습니다.`);
      if (edges.some(e => e.to === n.id && wouldCreateCycle(edges.filter(other => other !== e), e.from, e.to))) issues.push(`${t.name} / ${n.name}: 순환 연결이 있습니다.`);
    }
  }
  return [...new Set(issues)];
}
export function isGrowthProgress(v: unknown): v is GrowthProgress {
  return object(v) && Object.values(v).every(actor => object(actor) && Object.values(actor).every(tree => object(tree) && Object.values(tree).every(n => object(n) && integer(n.rank, 0, 99) && integer(n.spent, 0))));
}
