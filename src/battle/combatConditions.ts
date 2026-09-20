import type { EnemyActionCondition } from '@/project/types';
export interface CombatConditionSubject { hp: number; maxHp: number; mp: number; maxMp: number; stateIds: readonly string[] }
/** Inclusive ranges. Allies means living, visible teammates other than the subject. No RNG. */
export function combatConditionMet(condition: EnemyActionCondition, subject: CombatConditionSubject, turn: number, livingAllies: number, switches: Readonly<Record<string, boolean>> = {}): boolean {
  switch (condition.kind) {
    case 'switch': return (switches[condition.switchId] === true) === condition.value;
    case 'always': return true;
    case 'turn': return turn >= condition.start && (turn - condition.start) % Math.max(1, condition.interval) === 0;
    case 'hp': case 'mp': {
      const maximum = condition.kind === 'hp' ? subject.maxHp : subject.maxMp;
      const percent = maximum > 0 ? subject[condition.kind] * 100 / maximum : 0;
      return percent >= condition.minPercent && percent <= condition.maxPercent;
    }
    case 'status': return subject.stateIds.includes(condition.stateId) === condition.present;
    case 'allies': return livingAllies >= condition.min && livingAllies <= condition.max;
    default: return false;
  }
}
