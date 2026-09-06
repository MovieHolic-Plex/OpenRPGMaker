import type { Project } from '@/project/types';
import type { SkillTree, NodeRankRequirement } from '@/project/growth/types';
import { qualifiedNodeId } from '@/project/growth/requirements';
import type { TreeEdge } from '@/project/growth/graph';

/** Cross-tree prerequisites are visible portal nodes, never fictitious local edges. */
export function skillPrerequisiteGraph(project: Project, tree: SkillTree): {
  edges: TreeEdge[]; portals: { id: string; tree: SkillTree; requirement: NodeRankRequirement }[];
} {
  const edges: TreeEdge[] = [];
  const portals = new Map<string, { id: string; tree: SkillTree; requirement: NodeRankRequirement }>();
  const connect = (from: string, to: string): void => {
    if (!edges.some(e => e.from === from && e.to === to)) edges.push({ from, to });
  };
  for (const node of tree.nodes) {
    for (const from of node.prerequisites) connect(from, node.id);
    for (const requirement of node.requiredNodes ?? []) {
      if (requirement.treeId === tree.id) { connect(requirement.nodeId, node.id); continue; }
      const target = project.growth?.skillTrees.find(t => t.id === requirement.treeId);
      if (!target?.nodes.some(n => n.id === requirement.nodeId)) continue;
      const id = `required:${qualifiedNodeId(requirement.treeId, requirement.nodeId)}`;
      const previous = portals.get(id);
      if (!previous || previous.requirement.rank < requirement.rank) portals.set(id, { id, tree: target, requirement });
      connect(id, node.id);
    }
  }
  return { edges, portals: [...portals.values()] };
}
