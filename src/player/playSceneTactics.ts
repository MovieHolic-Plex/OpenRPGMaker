// tacticsBattle 명령의 플레이 씬 연결: 격자 오버레이를 띄우고, 끝나면 파티 HP 를 세션에 되돌리고 결과를 돌려준다.
import { store } from "@/project/store";
import type { StepResult } from "@/player/interpreter";
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createTacticsState, partyTacticsSeeds, troopTacticsSeeds, writeTacticsVitals } from "@/player/tacticsBattle";
import { mountTacticsBattle } from "@/player/tacticsBattleOverlay";

type TacticsStep = Extract<StepResult, { kind: "tacticsBattle" }>;

/** 결과("victory"|"defeat"). 적 그룹이 비었거나 화면이 없으면 undefined(전투 없이 넘어간다). */
export async function playTacticsBattle(scene: PlaySceneContext, step: TacticsStep): Promise<"victory" | "defeat" | undefined> {
  const project = store.getCurrent();
  const enemies = troopTacticsSeeds(project, step.troopId);
  if (enemies.length === 0) {
    console.warn(`[tacticsBattle] 적 그룹 ${JSON.stringify(step.troopId)} 에 적이 없어 전술 전투를 건너뜁니다.`);
    return undefined;
  }
  const host = dialogueHost(scene);
  const layer = host?.closest(".play-viewport") ?? host;
  if (!(layer instanceof HTMLElement)) return undefined;
  const state = createTacticsState(partyTacticsSeeds(project, scene.session), enemies, { width: step.width, height: step.height });
  scene.setInputEnabled(false);
  try {
    const result = await new Promise<"victory" | "defeat">((resolve) => {
      const controller = mountTacticsBattle(layer, state, (outcome) => {
        controller.destroy();
        resolve(outcome);
      });
    });
    writeTacticsVitals(project, scene.session, state);
    scene.session.battleResult = result;
    return result;
  } finally {
    scene.setInputEnabled(true);
  }
}
