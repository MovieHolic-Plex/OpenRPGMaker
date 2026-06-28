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
  });
  advanceBattleRuntime(runtime);
  return new Promise<BattleResult>((resolve) => {
    const battleScene = mountBattleScene({
      host,
      runtime,
      onResult: (result, snapshot) => {
        applyBattleRewardsToSession(scene.session, { result, rewards: snapshot.rewards });
        battleScene.destroy();
        resolve(result);
      },
    });
    markBattleEntry(startedAt);
  });
}
