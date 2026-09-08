import { store } from '@/project/store';
import type { StepResult } from './interpreter';
import type { PlaySceneContext } from './playSceneTypes';
import { applyBattleDefeat } from './playSceneDefeat';
import { BattleAdmissionError } from '@/project/battleAdmission';

type BattleStep = Extract<StepResult, { kind: 'battleProcessing' }>;
export type CommandBattleResult = 'victory' | 'defeat' | 'escape' | null;

/** The caller owns foreground lifetime; both interpreters share resolution, awaiting and defeat semantics. */
export async function playCommandBattle(scene: PlaySceneContext, step: BattleStep, isCurrent: () => boolean): Promise<CommandBattleResult> {
  const session = scene.session, map = scene.map;
  if (!isCurrent()) return null;
  scene.clearRuntimeOverlay('runtime-error');
  let result: CommandBattleResult;
  try {
    result = await scene.playBattle({ ...step, troopId: resolveBattleTroopId(scene, step) }, isCurrent);
  } catch (error) {
    if (scene.session !== session || scene.map !== map || !isCurrent() || scene.sys?.isActive() === false) return null;
    throw error;
  }
  if (result === null || scene.session !== session || scene.map !== map || !isCurrent() || scene.sys?.isActive() === false) return null;
  session.battleResult = result;
  if (result === 'defeat' && !step.canLose) applyBattleDefeat(scene);
  return result;
}

function resolveBattleTroopId(scene: PlaySceneContext, step: BattleStep): string {
  if (step.troopSource !== 'variable') return step.troopId;
  const raw: unknown = step.troopVariableId ? scene.session.variables[step.troopVariableId] : undefined;
  const troops = store.getCurrent().database.troops;
  if (typeof raw === 'string' && troops.some(troop => troop.id === raw.trim())) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Preserve the existing 1-based lookup, 0 alias, truncation and legacy ID suffix lookup.
    const index = Math.trunc(raw);
    const troop = troops[index - 1] ?? troops[index]
      ?? troops.find(entry => entry.id.endsWith(String(index)) || entry.id === String(index));
    if (troop) return troop.id;
  }
  throw new BattleAdmissionError('BATTLE_VARIABLE_INVALID',
    `전투를 시작할 수 없습니다. 적 그룹 변수 '${step.troopVariableId || "미선택"}'의 값 (${String(raw)})이 유효한 적 그룹을 가리키지 않습니다. 변수와 값을 확인하세요.`);
}
