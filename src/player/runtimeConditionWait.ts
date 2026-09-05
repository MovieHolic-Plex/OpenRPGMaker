import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { runtimeEventViewById } from "@/project/runtimeEventState";
/** Foreground condition waits let parallel producers run while input remains locked. */
export const conditionWaitScenes = new WeakSet<object>();
export function isRuntimeEventIdle(scene: PlaySceneContext, target: string): boolean {
  if (target === "player" || target === "@player") return !scene.playerRoute && !scene.moving && !scene.playerHop;
  const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, target);
  return !!view && !scene.autonomousNPCs.has(target);
}
