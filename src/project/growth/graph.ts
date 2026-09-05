import type { Project } from '@/project/types';
import type { TreePosition } from './types';
export interface TreeEdge { from: string; to: string }
export function wouldCreateCycle(edges: readonly TreeEdge[], from: string, to: string): boolean {
  const pending = [to], seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges) if (edge.from === id) pending.push(edge.to);
  }
  return false;
}
export function promotionEdges(project: Project): TreeEdge[] {
  return project.database.classes.flatMap(c => (c.promotions ?? []).map(p => ({ from: c.id, to: p.toClassId })));
}
/** Deterministic Kahn layout; legacy cycles remain visible in the last column. */
export function arrangeTree(ids: readonly string[], edges: readonly TreeEdge[]): Record<string, TreePosition> {
  const positions: Record<string, TreePosition> = {}, remaining = new Set(ids);
  let column = 0;
  while (remaining.size) {
    const roots = [...remaining].filter(id => !edges.some(e => e.to === id && remaining.has(e.from)));
    const layer = roots.length ? roots : [...remaining];
    layer.forEach((id, row) => { positions[id] = { x: 56 + column * 248, y: 60 + row * 152 }; remaining.delete(id); });
    column++;
  }
  return positions;
}
