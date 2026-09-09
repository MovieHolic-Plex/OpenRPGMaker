import { createBlankProject } from '@/project/defaults';
import { qualifiedNodeId } from './requirements';
import type { Project } from '@/project/types';
import { arrangeTree, promotionEdges } from './graph';
import { emptyGrowth, type TreePosition } from './types';
import { createGrowthPresetTemplate, GROWTH_PRESETS, type GrowthPresetKind } from './presetTemplates';

export { GROWTH_PRESETS } from './presetTemplates';
export type { GrowthPresetMetadata, GrowthPresetKind, GrowthPresetRole, GrowthStudioMode } from './presetTemplates';

export interface GrowthPresetApplication {
  readonly presetId: string;
  readonly kind: GrowthPresetKind;
  /** Template order: root class first; skill nodes are topologically ordered. */
  readonly addedClassIds: readonly string[];
  readonly addedSkillIds: readonly string[];
  readonly addedTreeIds: readonly string[];
  readonly addedNodeIds: readonly string[];
}

/**
 * Explicit additive mutation; call inside editGrowth's snapshot/store boundary.
 * Preview uses detached templates, never this allocation path.
 * No existing records or settings are normalized, replaced, or attached to the added graph.
 * New growth starts with 2 points + 1 per level; existing budgets (including zero) win.
 * Unknown IDs / exhausted canvas space throw before any mutation.
 */
export function applyGrowthPreset(project: Project, presetId: string): GrowthPresetApplication {
  const preset = GROWTH_PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error(`Unknown growth preset: ${presetId}`);
  const template = createGrowthPresetTemplate(preset);
  const occupiedIds = new Set([
    ...project.database.classes.map(c => c.id), ...project.database.skills.map(s => s.id),
    ...Object.keys(project.growth?.classPositions ?? {}),
    ...(project.growth?.skillTrees ?? []).flatMap(t => [t.id, ...t.nodes.map(n => n.id)]),
  ]);
  const allocate = (localId: string): string => {
    const base = `${preset.id}-${localId}`;
    let id = base, suffix = 2;
    while (occupiedIds.has(id)) id = `${base}-${suffix++}`;
    occupiedIds.add(id);
    return id;
  };
  const skillIds = new Map(template.skills.map(s => [s.id, allocate(s.id)]));
  const classIds = new Map(template.classes.map(c => [c.id, allocate(c.id)]));
  const treeIds = new Map(template.trees.map(t => [t.id, allocate(t.id)]));
  const nodeIds = new Map(template.trees.flatMap(t => t.nodes.map(n => [qualifiedNodeId(t.id, n.id), allocate(template.trees.length === 1 ? n.id : `${t.id}-${n.id}`)] as const)));
  const remap = (ids: ReadonlyMap<string, string>, id: string): string => {
    const mapped = ids.get(id);
    if (mapped === undefined) throw new Error(`Missing growth preset template reference: ${id}`);
    return mapped;
  };
  for (const skill of template.skills) skill.id = remap(skillIds, skill.id);
  for (const klass of template.classes) {
    klass.id = remap(classIds, klass.id);
    // Retain only normalizer rates backed by this database, including on custom/empty projects.
    klass.elementRates = Object.fromEntries(Object.entries(klass.elementRates).filter(([id]) => project.database.elements?.some(e => e.id === id)));
    klass.skillIds = klass.skillIds.map(id => remap(skillIds, id));
    for (const skill of klass.learnedSkills) skill.skillId = remap(skillIds, skill.skillId);
    for (const edge of klass.promotions ?? []) {
      edge.toClassId = remap(classIds, edge.toClassId);
      if (edge.requires.requiredSkillIds) edge.requires.requiredSkillIds = edge.requires.requiredSkillIds.map(id => remap(skillIds, id));
      for (const req of edge.requires.requiredNodes ?? []) {
        req.nodeId = remap(nodeIds, qualifiedNodeId(req.treeId, req.nodeId));
        req.treeId = remap(treeIds, req.treeId);
      }
      for (const req of edge.requires.requiredTreePoints ?? []) req.treeId = remap(treeIds, req.treeId);
    }
  }
  for (const tree of template.trees) {
    const localTreeId = tree.id;
    tree.id = remap(treeIds, tree.id);
    tree.classIds = tree.classIds.map(id => remap(classIds, id));
    for (const node of tree.nodes) {
      node.id = remap(nodeIds, qualifiedNodeId(localTreeId, node.id));
      node.prerequisites = node.prerequisites.map(id => remap(nodeIds, qualifiedNodeId(localTreeId, id)));
      for (const req of node.requiredNodes ?? []) {
        req.nodeId = remap(nodeIds, qualifiedNodeId(req.treeId, req.nodeId));
        req.treeId = remap(treeIds, req.treeId);
      }
      if (node.effect.kind === 'skill') node.effect.skillId = remap(skillIds, node.effect.skillId);
    }
  }
  const positions = placePromotionNodes(project, template.classes.map(c => c.id),
    template.classes.flatMap(c => (c.promotions ?? []).map(p => ({ from: c.id, to: p.toClassId }))));
  project.growth ??= { ...emptyGrowth(), initialPoints: 2 };
  project.database.skills.push(...template.skills);
  project.database.classes.push(...template.classes);
  project.growth.skillTrees.push(...template.trees);
  Object.assign(project.growth.classPositions, positions);
  return { presetId, kind: preset.kind, addedClassIds: [...classIds.values()], addedSkillIds: [...skillIds.values()],
    addedTreeIds: [...treeIds.values()], addedNodeIds: [...nodeIds.values()] };
}

/** First free graph-sized block; include auto positions and orphan authored positions. */
function placePromotionNodes(project: Project, ids: readonly string[], edges: readonly { from: string; to: string }[]): Record<string, TreePosition> {
  if (!ids.length) return {};
  const layout = arrangeTree(ids, edges);
  const existingIds = project.database.classes.map(c => c.id);
  // Match the studio's post-append layout: imported cycles move after the new acyclic layers.
  const combinedAuto = arrangeTree([...existingIds, ...ids], [...promotionEdges(project), ...edges]);
  const existingAuto = Object.fromEntries(existingIds.map(id => [id, combinedAuto[id]]));
  const occupied = Object.values({ ...existingAuto, ...project.growth?.classPositions });
  // Three columns / two rows plus a full node pitch between blocks. All origins stay in the schema's 0..10000 range.
  for (let y = 60; y <= 9848; y += 456) for (let x = 56; x <= 9504; x += 744) {
    const candidate = Object.fromEntries(Object.entries(layout).map(([id, p]) => [id, { x: p.x - 56 + x, y: p.y - 60 + y }]));
    if (Object.values(candidate).every(p => occupied.every(old => Math.abs(p.x - old.x) >= 248 || Math.abs(p.y - old.y) >= 152))) return candidate;
  }
  throw new Error('No free canvas space for growth preset; move existing promotion nodes first.');
}

/** Destination-independent records for read-only browsing; no ID allocation or store reads. */
export function createGrowthPresetPreview(presetId: string): Project {
  const preset = GROWTH_PRESETS.find(p => p.id === presetId);
  if (!preset) throw new Error(`Unknown growth preset: ${presetId}`);
  const template = createGrowthPresetTemplate(preset);
  const project = createBlankProject();
  project.database.classes = template.classes;
  project.database.skills = template.skills;
  project.growth = { ...emptyGrowth(), initialPoints: 2, skillTrees: template.trees };
  project.growth.classPositions = arrangeTree(template.classes.map(c => c.id), promotionEdges(project));
  return project;
}
