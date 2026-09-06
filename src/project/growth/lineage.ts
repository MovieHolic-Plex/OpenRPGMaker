import type { ActorId, ClassId, Project } from '@/project/types';
import type { PromotionLineage } from './types';

export interface ActorClassState {
  readonly classOverrides?: Readonly<Record<string, string>>;
  readonly promotionLineage?: PromotionLineage;
}
export function effectiveActorClassId(project: Project, session: ActorClassState | undefined, actorId: ActorId): ClassId | undefined {
  const override = session?.classOverrides?.[actorId];
  if (override && project.database.classes.some(c => c.id === override)) return override;
  return project.database.actors.find(a => a.id === actorId)?.classId;
}
/** Only an actual valid override changes the actor's authored curves. */
export function validActorClassOverride(project: Project, session: ActorClassState | undefined, actorId: ActorId): boolean {
  const override = session?.classOverrides?.[actorId];
  return Boolean(override && project.database.classes.some(c => c.id === override));
}
/** Earned chain, never ancestry inferred from the authored graph. */
export function effectivePromotionLineage(project: Project, session: ActorClassState, actorId: ActorId): ClassId[] {
  const current = effectiveActorClassId(project, session, actorId);
  if (!current) return [];
  const override = session.classOverrides?.[actorId];
  const earned = session.promotionLineage?.[actorId];
  if ((override && !validActorClassOverride(project, session, actorId)) || !earned?.includes(current)) return [current];
  return [...new Set(earned.filter(id => project.database.classes.some(c => c.id === id)))];
}
