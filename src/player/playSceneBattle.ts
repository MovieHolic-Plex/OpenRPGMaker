import type { BattleResult } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBattleRuntime } from "@/battle/runtime";
import type { StepResult } from "@/player/interpreter";
import { mountBattleScene } from "@/player/battleDom";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { markBattleEntry } from "@/app/perfMetrics";
import { nextSessionRandom } from "@/project/session";

export function showBattleScene(scene: PlaySceneContext, troopId: string): void {
  scene.showRuntimeOverlay("battle-scene", troopId || "battle");
}

export function playBattle(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "battleProcessing" }>,
  startedAt: number
): Promise<BattleResult> {
  const host = dialogueHost(scene);
  if (!host) return Promise.resolve("defeat");
  const runtime = createBattleRuntime({
    project: store.getCurrent(),
    troopId: step.troopId,
    canEscape: step.canEscape,
    canLose: step.canLose,
    battleFlow: step.battleFlow,
    party: {
      levels: scene.session.actorLevels,
      experience: scene.session.actorExperience,
      names: scene.session.actorNames,
      vitals: scene.session.actorVitals,
      paramBonuses: scene.session.actorParamBonuses,
      equipment: scene.session.actorEquipment,
      skillIds: scene.session.actorSkillIds,
      stateIds: scene.session.actorStateIds,
      // 플레이 중 파티 편성(라이브 세션). 없으면 전투가 에디터 시작 상태 파티를 쓴다.
      partyActorIds: scene.session.partyActorIds,
    },
    sessionState: {
      switches: scene.session.switches,
      variables: scene.session.variables,
      inventory: scene.session.inventory,
    },
    rng: () => nextSessionRandom(scene.session, "battle"),
  });
  advanceBattleRuntime(runtime);
  return new Promise<BattleResult>((resolve) => {
    const battleScene = mountBattleScene({
      host,
      runtime,
      onResult: (result, snapshot) => {
        applyBattleRewardsToSession(
          scene.session,
          { result, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState },
          store.getCurrent()
        );
        battleScene.destroy();
        resolve(result);
      },
    });
    markBattleEntry(startedAt);
  });
}
