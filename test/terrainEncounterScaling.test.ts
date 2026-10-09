import { describe, expect, it } from "vitest";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { GameMap } from "@/project/types";

function authorTerrain(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("missing tileset");
  const tile = map.lowerTiles[project.startPos.y * map.width + project.startPos.x] ?? 0;
  if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
  while (tileset.terrain.length <= tile) tileset.terrain.push(0);
  tileset.terrain[tile] = tag;
  const meta = [...(tileset.tileMeta ?? [])];
  while (meta.length <= tile) meta.push({ label: "", description: "" });
  meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
  tileset.tileMeta = meta;
  return { mapId, x: project.startPos.x, y: project.startPos.y };
}

function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
  const scene = {
    running: false,
    inputEnabled: true,
    map,
    tileX: 0,
    tileY: 0,
    session: { partyActorIds: [], switches: {}, variables: {} },
    playBattle: async (cmd: { kind: string }) => {
      playBattleCalls.push(cmd.kind);
      return "escape" as const;
    },
    setInputEnabled: (enabled: boolean) => {
      scene.inputEnabled = enabled;
    },
  } as unknown as PlaySceneContext & { inputEnabled: boolean };
  return scene;
}

describe("terrain encounter scaling", () => {
  it("scales map encounter rate by terrain encounterRatePercent", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: false };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing map");
    map.encounterRate = 1000;
    map.troopIds = ["troop_a"];
    map.encounterTable = undefined;
    const loc = authorTerrain(project, 2);
    project.database.terrains = [
      { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      { id: "t2", name: "안전지대", damage: 0, encounterRatePercent: 0, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
    ];
    store.replaceProject(project);
    const calls: string[] = [];
    const scene = makeScene(store.getCurrent().maps[loc.mapId] as GameMap, calls);
    scene.tileX = loc.x;
    scene.tileY = loc.y;

    resetEncounterCounter();
    for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

    expect(calls).toEqual([]);
  });
});
