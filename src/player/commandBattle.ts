import { store } from '@/project/store';
import type { StepResult } from './interpreter';
import type { PlaySceneContext } from './playSceneTypes';
import { applyBattleDefeat } from './playSceneDefeat';

type BattleStep = Extract<StepResult, { kind: 'battleProcessing' }>;
export type CommandBattleResult = 'victory' | 'defeat' | 'escape' | null;

/** The caller owns foreground lifetime; both interpreters share resolution, awaiting and defeat semantics. */
export async function playCommandBattle(scene: PlaySceneContext, step: BattleStep, isCurrent: () => boolean): Promise<CommandBattleResult> {
  const session = scene.session, map = scene.map;
  if (!isCurrent()) return null;
  const result = await scene.playBattle({ ...step, troopId: resolveBattleTroopId(scene, step) }, isCurrent);
  if (result === null || scene.session !== session || scene.map !== map || !isCurrent() || scene.sys?.isActive() === false) return null;
  session.battleResult = result;
  if (result === 'defeat' && !step.canLose) applyBattleDefeat(scene);
  return result;
}

function resolveBattleTroopId(scene: PlaySceneContext, step: BattleStep): string {
  if (step.troopSource !== 'variable' || !step.troopVariableId) return step.troopId;
  const raw: unknown = scene.session.variables[step.troopVariableId];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const index = Math.trunc(raw), troops = store.getCurrent().database.troops;
    const troop = troops[index - 1] ?? troops[index]
      ?? troops.find(entry => entry.id.endsWith(String(index)) || entry.id === String(index));
    if (troop) return troop.id;
  }
  return step.troopId;
}
