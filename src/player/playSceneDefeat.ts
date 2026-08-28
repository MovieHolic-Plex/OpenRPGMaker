import { store } from "@/project/store";
import { syncActorVitals } from "@/project/sessionVitals";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export const BATTLE_DEFEAT_MESSAGE = "전투에서 패배했습니다.";

// RM2K3 규칙: canLose=false 전투의 패배는 게임 오버다. 파티를 전멸로 확정하고 종단
// 오버레이를 띄운다(체크포인트가 있으면 '다시 시도'가 붙는다 — playSceneOverlays.ts).
// 이벤트 전투·랜덤 인카운터·필드 스폰 접촉이 모두 이 한 경로를 쓴다.
export function applyBattleDefeat(scene: PlaySceneContext, message: string = BATTLE_DEFEAT_MESSAGE): void {
  const project = store.getCurrent();
  for (const actorId of scene.session.partyActorIds) {
    syncActorVitals(project, scene.session.actorVitals, actorId);
    const vitals = scene.session.actorVitals[actorId];
    if (vitals) vitals.hp = 0;
    scene.session.actorStateIds ??= {};
    const states = new Set(scene.session.actorStateIds[actorId] ?? []);
    states.add("state_death");
    scene.session.actorStateIds[actorId] = [...states];
  }
  scene.showGameOverScreen(message);
}
