/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { playerCanStep } from "@/player/playSceneMovement";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import type { StatusMenuDetail } from "@/player/playerStatusMenuDetailTypes";

function spatialProject() {
  const project = createBlankProject();
  const item = project.database.items[0];
  if (!item) throw new Error("blank project requires a starter item");
  const itemId = item.id;
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [{
      level: 1,
      footprint: { width: 2, height: 1 },
      capacity: 4,
      graphicResourceId: "building-default",
      orientationGraphicResourceIds: { left: "building-left" },
    }],
  }];
  project.database.homeDecorationTypes = [{
    id: "table",
    name: "Table",
    placementItemId: itemId,
    footprint: { width: 1, height: 1 },
    blocksMovement: false,
    allowedOrientations: ["down", "left"],
    graphicResourceId: "decor-default",
  }];
  return { project, itemId };
}

function activate(detail: StatusMenuDetail, testId: string): void {
  const entry = detail.entries.find((candidate) => candidate.testId === testId);
  expect(entry, `missing ledger action ${testId}`).toBeDefined();
  expect(entry?.disabled).not.toBe(true);
  entry?.onActivate?.();
}

describe("P2 spatial play integration", () => {
  it("lets the player place, move, and remove buildings and decorations from the life ledger", () => {
    // Given: authored spatial types and enough inventory to place one decoration.
    const { project, itemId } = spatialProject();
    const session = startSession(project, 1201);
    session.currentMapId = project.startMapId;
    session.x = 2;
    session.y = 2;
    session.inventory[itemId] = 1;
    const mutations: boolean[] = [];
    const detail = (): StatusMenuDetail => createLifeLedgerDetail({
      project,
      session,
      tab: "spaces",
      onMutation: (ok) => mutations.push(ok),
    });

    // When: each player-facing building action is activated.
    activate(detail(), "life-ledger-space-building-place-shed");
    const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
    if (!buildingId) throw new Error("building placement was not created");
    session.x = 5;
    activate(detail(), `life-ledger-space-building-move-${buildingId}`);
    expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: 5, y: 2 });
    activate(detail(), `life-ledger-space-building-remove-${buildingId}`);

    // Then: decoration place/move/remove is reachable through the same ledger and conserves its item.
    session.x = 8;
    activate(detail(), "life-ledger-space-decoration-place-table");
    const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
    if (!decorationId) throw new Error("decoration placement was not created");
    expect(session.inventory[itemId] ?? 0).toBe(0);
    session.x = 10;
    activate(detail(), `life-ledger-space-decoration-move-${decorationId}`);
    expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({ x: 10, y: 2 });
    activate(detail(), `life-ledger-space-decoration-remove-${decorationId}`);
    expect(session.inventory[itemId]).toBe(1);
    expect(session.farmBuildingPlacements).toEqual({});
    expect(session.homeDecorationPlacements).toEqual({});
    expect(mutations).toEqual([true, true, true, true, true, true]);
  });

  it("renders current-map placements with orientation-specific graphics and fallback graphics", () => {
    // Given: one rotated building and one decoration on the current map.
    const { project } = spatialProject();
    const session = startSession(project, 1202);
    session.farmBuildingPlacements = {
      shed_1: {
        instanceId: "shed_1",
        typeId: "shed",
        level: 1,
        mapId: project.startMapId,
        x: 2,
        y: 3,
        orientation: "left",
      },
    };
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1",
        typeId: "table",
        mapId: project.startMapId,
        x: 6,
        y: 4,
        orientation: "down",
      },
    };
    store.replaceProject(project);
    const calls: unknown[][] = [];
    const added: unknown[] = [];
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("blank project requires a start map");
    const scene = {
      map,
      session,
      tileLayer: { add: (object: unknown) => added.push(object) },
      add: {
        sprite: (...args: unknown[]) => {
          calls.push(args);
          return { setOrigin() {}, setDepth() {} };
        },
      },
    };

    // When: the map's existing session-overlay renderer runs.
    renderPlaceableOverlays(scene);

    // Then: the selected orientation resource and the default fallback are consumed as textures.
    expect(calls.map((args) => args[2])).toEqual(["building-left", "decor-default"]);
    expect(added).toHaveLength(2);
  });

  it("consults decoration blocksMovement when the player steps into its footprint", () => {
    // Given: a non-blocking decoration in the destination tile.
    const { project } = spatialProject();
    const session = startSession(project, 1203);
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1",
        typeId: "table",
        mapId: project.startMapId,
        x: 3,
        y: 2,
        orientation: "down",
      },
    };
    store.replaceProject(project);
    const map = project.maps[project.startMapId];
    const decorationType = project.database.homeDecorationTypes?.[0];
    if (!map || !decorationType) throw new Error("spatial fixture is incomplete");
    const scene = { map, session, tileX: 2, tileY: 2 };

    // When/Then: non-blocking decor permits the step, while the same authored footprint blocks when enabled.
    expect(playerCanStep(scene, { footprint: { width: 1, height: 1 }, passRows: 1 }, 1, 0)).toBe(true);
    project.database.homeDecorationTypes = [{
      ...decorationType,
      blocksMovement: true,
    }];
    store.replaceProject(project);
    expect(playerCanStep(scene, { footprint: { width: 1, height: 1 }, passRows: 1 }, 1, 0)).toBe(false);
  });
});
