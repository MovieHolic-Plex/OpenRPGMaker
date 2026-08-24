import { store } from "@/project/store";
import type { FieldSpawnDef } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  addFieldSpawnEntry,
  advanceFieldSpawns,
  createFieldSpawnRuntime,
  fieldSpawnTroopId,
  fieldSpawnRuntimeNeedsRefresh,
  removeFieldSpawnEntry,
  resolveFieldSpawnVictory,
  syncFieldSpawnEventsIntoMap,
  type NormalizedFieldSpawn,
} from "@/player/fieldSpawns";
import { syncActorVitals } from "@/project/sessionVitals";
import { enterRoguelikeRunRoom } from "@/project/roguelikeRun";
import { roguelikeRoomId, syncRoguelikeRoomEventGeneration } from "@/project/roguelikeRooms";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";

// 처치 결과를 세션에 영속(persistKill)하고 킬 스위치를 켠다.
export function recordFieldSpawnKill(scene: PlaySceneContext, spawn: NormalizedFieldSpawn | null): void {
  if (!spawn) return;
  if (spawn.persistKill && scene.session.roguelikeRun?.status !== "active") {
    scene.session.killedFieldSpawns ??= {};
    const mapKills = (scene.session.killedFieldSpawns[scene.map.id] ??= {});
    mapKills[spawn.id] = (mapKills[spawn.id] ?? 0) + 1;
  }
  if (spawn.onKillSwitchId) scene.session.switches[spawn.onKillSwitchId] = true;
}

export function initializeFieldSpawnsForScene(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  enterRoguelikeRunRoom(scene.session, roguelikeRoomId(scene.map));
  if (syncRoguelikeRoomEventGeneration(scene.map, scene.session)) {
    resetRoguelikeRoomEventRuntime(scene);
  }
  scene.fieldSpawnState = createFieldSpawnRuntime(
    project,
    scene.map,
    { x: scene.session.x, y: scene.session.y },
    scene.session.killedFieldSpawns?.[scene.map.id],
    scene.session.roguelikeRun
  );
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
}

export function updateFieldSpawnsForScene(scene: PlaySceneContext, deltaMs: number): void {
  if (scene.running) return;
  const project = store.getCurrent();
  if (refreshRoguelikeRoomForScene(scene)) return;
  const changed = advanceFieldSpawns(scene.fieldSpawnState, project, scene.map, { x: scene.tileX, y: scene.tileY }, deltaMs);
  if (!changed) return;
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
}

export function refreshRoguelikeRoomForScene(scene: PlaySceneContext): boolean {
  if (!fieldSpawnRuntimeNeedsRefresh(scene.fieldSpawnState, scene.map, scene.session.roguelikeRun)) return false;
  const project = store.getCurrent();
  enterRoguelikeRunRoom(scene.session, roguelikeRoomId(scene.map));
  if (syncRoguelikeRoomEventGeneration(scene.map, scene.session)) {
    resetRoguelikeRoomEventRuntime(scene);
  }
  scene.fieldSpawnState = createFieldSpawnRuntime(
    project,
    scene.map,
    { x: scene.tileX, y: scene.tileY },
    scene.session.killedFieldSpawns?.[scene.map.id],
    scene.session.roguelikeRun
  );
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
  return true;
}

function resetRoguelikeRoomEventRuntime(scene: PlaySceneContext): void {
  syncFieldSpawnEventsIntoMap(scene.map, null, scene.eventPositions);
  scene.eventPositions = initialRuntimeEventPositions(scene.map.events);
  scene.parallelProcesses.clear();
  scene.autoStartedKeys.clear();
  scene.pageMoveRouteKeys.clear();
  scene.pageMoveRouteEventIds.clear();
  scene.commandMoveRouteEventIds.clear();
  scene.eventGraphicPatternOverrides.clear();
  scene.autonomousNPCs.clear();
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
      recordFieldSpawnKill(scene, resolveFieldSpawnVictory(scene.fieldSpawnState, eventId));
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

// spawnFieldEnemy 커맨드: 런타임 스폰을 추가하고 즉시 배치·동기화한다.
export function spawnFieldEnemyForScene(scene: PlaySceneContext, spawn: FieldSpawnDef): void {
  const project = store.getCurrent();
  if (!scene.fieldSpawnState || scene.fieldSpawnState.mapId !== scene.map.id) {
    scene.fieldSpawnState = createFieldSpawnRuntime(
      project,
      scene.map,
      { x: scene.session.x, y: scene.session.y },
      scene.session.killedFieldSpawns?.[scene.map.id],
      scene.session.roguelikeRun
    );
  }
  addFieldSpawnEntry(
    scene.fieldSpawnState,
    project,
    scene.map,
    spawn,
    { x: scene.tileX, y: scene.tileY },
    scene.session.roguelikeRun?.status === "active"
      ? 0
      : scene.session.killedFieldSpawns?.[scene.map.id]?.[spawn.id] ?? 0
  );
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
}

// despawnFieldEnemy 커맨드: 런타임 스폰을 제거한다. 액션 전투 적은 다음 syncActionEnemies에서 자동 해제된다.
export function despawnFieldEnemyForScene(scene: PlaySceneContext, spawnId: string): void {
  if (!scene.fieldSpawnState) return;
  removeFieldSpawnEntry(scene.fieldSpawnState, spawnId);
  syncFieldSpawnEventsIntoMap(scene.map, scene.fieldSpawnState, scene.eventPositions);
  scene.renderTiles();
  scene.registerPageMoveRoutes();
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
