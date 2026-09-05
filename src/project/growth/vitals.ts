import type { Project } from '@/project/types';
import type { ClassOverrideSession } from '@/project/sessionClass';
import { normalizeActorRecord, parameterValueAtLevel } from '@/project/actorModel';
import { growthEffects, type GrowthSession } from './runtime';
/** Recompute maxima without healing; effects never become permanent parameter bonuses. */
export function refreshGrowthVitals(project: Project, session: GrowthSession & Pick<ClassOverrideSession, 'actorVitals' | 'actorParamBonuses'>, actorId: string): void {
  const record = project.database.actors.find(a => a.id === actorId);
  if (!record) return;
  const actor = normalizeActorRecord(record), klass = project.database.classes.find(c => c.id === session.classOverrides?.[actorId]);
  const curves = klass?.parameterCurves ?? actor.parameterCurves;
  const level = session.actorLevels?.[actorId] ?? actor.initialLevel;
  const growth = growthEffects(project, session, actorId).bonuses, bonus = session.actorParamBonuses?.[actorId];
  const maxHp = Math.max(1, parameterValueAtLevel(curves.maxHp, level) + (bonus?.maxHp ?? 0) + growth.maxHp);
  const maxMp = Math.max(0, parameterValueAtLevel(curves.maxMp, level) + (bonus?.maxMp ?? 0) + growth.maxMp);
  const before = session.actorVitals[actorId];
  session.actorVitals[actorId] = { maxHp, maxMp, hp: Math.min(maxHp, before?.hp ?? maxHp), mp: Math.min(maxMp, before?.mp ?? maxMp) };
}
