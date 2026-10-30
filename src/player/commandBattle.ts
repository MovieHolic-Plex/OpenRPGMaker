import { store } from '@/project/store';
import { battleStepCanLose } from '@/player/battleDuel';
import type { StepResult } from './interpreter';
import type { PlaySceneContext } from './playSceneTypes';
import { applyBattleDefeat } from './playSceneDefeat';
import { BattleAdmissionError } from '@/project/battleAdmission';
import { runTroopAfterBattle } from './troopAfterBattleRunner';
import { symbolContactFormation } from './playSceneFieldSpawns';
import { runtimeEventViewById } from '@/project/runtimeEventState';

type BattleStep = Extract<StepResult, { kind: 'battleProcessing' }>;
export type CommandBattleResult = 'victory' | 'defeat' | 'escape' | null;

/** The caller owns foreground lifetime; both interpreters share resolution, awaiting and defeat semantics. */
export async function playCommandBattle(
  scene: PlaySceneContext,
  step: BattleStep,
  isCurrent: () => boolean,
  isLive: () => boolean = isCurrent,
  contactEventId?: string,
): Promise<CommandBattleResult> {
  const session = scene.session, map = scene.map;
  if (!isCurrent()) return null;
  scene.clearRuntimeOverlay('runtime-error');
  let result: CommandBattleResult;
  let troopId = step.troopId;
  try {
    troopId = resolveBattleTroopId(scene, step);
    const formation = step.formation ?? contactEventFormation(scene, contactEventId);
    result = await scene.playBattle({ ...step, troopId, ...(formation ? { formation } : {}) }, isCurrent);
  } catch (error) {
    if (scene.session !== session || scene.map !== map || !isCurrent() || scene.sys?.isActive() === false) return null;
    throw error;
  }
  // 결과를 커밋한 뒤에는 페이지 조건을 보지 않는다(isLive). 트룹 이벤트가 자기 페이지를 끄는
  // switch 를 쓰면 그 **정상 커밋** 때문에 페이지가 비활성이 되는데, 여기서 isCurrent 로 보면
  // 결과가 취소로 위장되어 돌아가고 session.battleResult 가 직전 전투 값으로 남는다.
  if (result === null || scene.session !== session || scene.map !== map || !isLive() || scene.sys?.isActive() === false) return null;
  session.battleResult = result;
  if (result === 'defeat' && !battleStepCanLose(store.getCurrent(), { ...step, troopId }, scene.session)) {
    applyBattleDefeat(scene);
    return result;
  }
  // 적 그룹의 「전투 뒤」 이벤트가 먼저 돌고, 그다음 이 전투를 연 이벤트가 결과 분기로 이어진다.
  await runTroopAfterBattle(scene, troopId, result, isLive);
  if (scene.session !== session || !isLive() || scene.sys?.isActive() === false) return null;
  return result;
}

/**
 * 필드 적(접촉 트리거 이벤트)이 연 전투도 구역 스폰과 같이 접촉 방향으로 선제·기습을 정한다
 * (system.battleFormationRoll 이 켜졌을 때만 — symbolContactFormation 이 거른다). 조사(action) 전투는 해당 없음.
 */
function contactEventFormation(scene: PlaySceneContext, eventId: string | undefined) {
  if (!eventId) return undefined;
  const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, eventId);
  const kind = view?.trigger.kind;
  if (kind !== 'eventTouch' && kind !== 'touch' && kind !== 'playerTouch') return undefined;
  return symbolContactFormation(scene, eventId);
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
