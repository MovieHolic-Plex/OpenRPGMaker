// tacticsBattle 명령의 플레이 씬 연결: 격자 오버레이를 띄우고, 끝나면 파티 HP 를 세션에 되돌리고 결과를 돌려준다.
import { store } from "@/project/store";
import type { StepResult } from "@/player/interpreter";
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createTacticsState, partyTacticsSeeds, troopTacticsSeeds, writeTacticsVitals } from "@/player/tacticsBattle";
import { mountTacticsBattle, type TacticsController } from "@/player/tacticsBattleOverlay";

type TacticsStep = Extract<StepResult, { kind: "tacticsBattle" }>;

/**
 * 결과("victory"|"defeat"). 적 그룹이 비었거나 화면이 없으면 undefined(전투 없이 넘어간다).
 * 플레이가 전투 도중 끝나면(씬 shutdown/destroy — 편집으로 돌아가기·창 닫기) null: 격자·keydown 리스너를
 * 정리하고 대기 중인 Promise 를 끝낸다. 호출자는 이벤트를 더 진행하지 않는다(#2586, 일반 전투 playBattle 과 같은 규칙).
 */
export async function playTacticsBattle(scene: PlaySceneContext, step: TacticsStep): Promise<"victory" | "defeat" | undefined | null> {
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
  const session = scene.session;
  scene.setInputEnabled(false);
  let stopped = false;
  try {
    const result = await new Promise<"victory" | "defeat" | null>((resolve) => {
      let controller: TacticsController | undefined;
      let done = false;
      const finish = (outcome: "victory" | "defeat" | null): void => {
        if (done) return;
        done = true;
        scene.events?.off("shutdown", onStop);
        scene.events?.off("destroy", onStop);
        controller?.destroy();
        resolve(outcome);
      };
      const onStop = (): void => { stopped = true; finish(null); };
      scene.events?.once("shutdown", onStop);
      scene.events?.once("destroy", onStop);
      controller = mountTacticsBattle(layer, state, finish);
    });
    if (result === null || scene.session !== session) return null;
    writeTacticsVitals(project, session, state);
    session.battleResult = result;
    return result;
  } finally {
    if (!stopped) scene.setInputEnabled(true);
  }
}
