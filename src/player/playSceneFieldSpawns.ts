import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  advanceFieldSpawns,
  createFieldSpawnRuntime,
  fieldSpawnTroopId,
  resolveFieldSpawnVictory,
  syncFieldSpawnEventsIntoMap,
} from "@/player/fieldSpawns";
import { syncActorVitals } from "@/project/sessionVitals";

export function initializeFieldSpawnsForScene(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  scene.fieldSpawnState = createFieldSpawnRuntime(project, scene.map, { x: scene.session.x, y: scene.session.y });
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
}

export function updateFieldSpawnsForScene(scene: PlaySceneContext, deltaMs: number): void {
  if (scene.running) return;
  const project = store.getCurrent();
  const changed = advanceFieldSpawns(scene.fieldSpawnState, project, scene.map, { x: scene.tileX, y: scene.tileY }, deltaMs);
  if (!changed) return;
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
}

export async function runFieldSpawnEventBattle(scene: PlaySceneContext, eventId: string): Promise<boolean> {
  const troopId = fieldSpawnTroopId(scene.fieldSpawnState, eventId);
  if (!troopId) return false;
  if (scene.running) return true;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    const result = await scene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: true });
    scene.session.battleResult = result;
    if (result === "victory") {
      resolveFieldSpawnVictory(scene.fieldSpawnState, eventId);
      syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
      scene.renderTiles();
      scene.registerPageMoveRoutes();
    } else if (result === "defeat") {
      killPartyForFieldBattle(scene);
      scene.showGameOverScreen("전투에서 패배했습니다.");
    }
  } finally {
    scene.running = false;
    scene.lastActionTargetKey = "";
    scene.setInputEnabled(true);
    scene.refreshRuntimeSurfaces();
  }
  return true;
}

function killPartyForFieldBattle(scene: PlaySceneContext): void {
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
}
