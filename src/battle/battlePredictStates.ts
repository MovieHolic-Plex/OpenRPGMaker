import type { MutableBattler } from '@/battle/battleBattlers';
import { applyStateEffects, recoverStatesWhenHit } from '@/battle/battleStates';
import { applyGen1MajorStatus, gen1EffectChanceSucceeds, gen1MajorStatusBlockedByType, readGen1MajorStatus } from '@/battle/gen1/status';
import { battlerTypes, gen1CanonicalTypeForId } from '@/battle/typeChart';
import type { Project, SkillRecord } from '@/project/types';

/** Follow guaranteed ordinary-hit transitions only; do not sample stochastic procs. */
export function advancePredictedHitStates(project: Project, target: MutableBattler, skill: SkillRecord, amount: number): void {
  if (project.system.battleModel !== 'gen1') {
    if (skill.effect.kind === 'damage' && amount > 0) recoverStatesWhenHit(project, target, () => 1);
    const equipment = target.equipmentEffects;
    const guaranteedCandidates = skill.stateEffects?.filter(effect => effect.operation === 'remove'
      || equipment?.stateDefenseMode !== 'resist' || equipment.stateResistanceChance <= 0
      || !equipment.stateDefenseIds.includes(effect.stateId));
    applyStateEffects(project, target, guaranteedCandidates, () => 1);
    return;
  }
  if (skill.effect.kind === 'damage' && amount <= 0) return;
  const records = project.database.states.map(state => ({ id: state.id, gen1MajorStatus: state.gen1MajorStatus }));
  const moveType = gen1CanonicalTypeForId(project, skill.elementId);
  const current = readGen1MajorStatus(target.stateIds, target.stateTurns, records);
  const defrost = skill.effect.kind === 'damage' && moveType === 'fire' && current?.kind === 'freeze'
    && skill.stateEffects?.some(effect => effect.operation === 'add' && records.find(state => state.id === effect.stateId)?.gen1MajorStatus === 'burn');
  const remove = (id: string): void => { target.stateIds = target.stateIds.filter(stateId => stateId !== id); delete target.stateTurns[id]; };
  if (defrost && current) remove(current.stateId);
  for (const effect of skill.stateEffects ?? []) {
    const record = records.find(state => state.id === effect.stateId);
    if (defrost && record?.gen1MajorStatus === 'burn') continue;
    if (!gen1EffectChanceSucceeds(effect.chance, () => 255)) continue;
    if (effect.operation === 'remove') { remove(effect.stateId); continue; }
    if (record?.gen1MajorStatus) {
      const types = battlerTypes(project, target).flatMap(id => { const type = gen1CanonicalTypeForId(project, id); return type ? [type] : []; });
      if (gen1MajorStatusBlockedByType(record.gen1MajorStatus, moveType, types, skill.effect.kind === 'damage' ? 'damage' : 'status')) continue;
      const applied = applyGen1MajorStatus({ stateIds: target.stateIds, stateTurns: target.stateTurns, stateRecords: records, incomingStateId: effect.stateId }, () => 255);
      target.stateIds = [...applied.stateIds]; target.stateTurns = { ...applied.stateTurns };
    } else if (!target.stateIds.includes(effect.stateId)) {
      target.stateIds.push(effect.stateId); target.stateTurns[effect.stateId] = 0;
    }
  }
}
