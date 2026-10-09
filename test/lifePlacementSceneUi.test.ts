/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { createPlayerStatusMenuController } from "@/player/playerStatusMenuController";
import type { PlayScene } from "@/player/PlayScene";
import {
  createLifePlacementLiveReader,
  placementBlockedByRenderedBodies,
  readLifePlacementLiveContext,
  type LifePlacementSceneSource,
} from "@/player/lifePlacementScene";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import {
  adjacentSpatialPosition,
  type SpatialLiveActor,
  type SpatialLiveContextReader,
} from "@/project/spatialOccupancy";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { event, page } from "./runtimeEventPageFixtures";
import type { Dir, Project, SpatialFootprint } from "@/project/types";
import type { StatusMenuDetail } from "@/player/playerStatusMenuDetailTypes";

function spatialProject() {
  const project = createBlankProject();
  const item = project.database.items[0];
  if (!item) throw new Error("blank project requires a starter item");
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [
      {
        level: 1,
        footprint: { width: 2, height: 1 },
        capacity: 4,
        cost: { gold: 10, items: [{ itemId: item.id, count: 1 }] },
        graphicResourceId: "building-default",
      },
      {
        level: 2,
        footprint: { width: 3, height: 2 },
        capacity: 8,
        cost: { gold: 20 },
        graphicResourceId: "building-default",
      },
    ],
  }];
  project.database.homeDecorationTypes = [{
    id: "table",
    name: "Table",
    placementItemId: item.id,
    footprint: { width: 2, height: 1 },
    blocksMovement: true,
    allowedOrientations: ["down", "left", "right", "up"],
    graphicResourceId: "decor-default",
  }, {
    id: "rug",
    name: "Rug",
    placementItemId: item.id,
    footprint: { width: 2, height: 1 },
    blocksMovement: false,
    allowedOrientations: ["down", "left"],
    graphicResourceId: "decor-default",
  }];
  return { project, itemId: item.id };
}

function liveSession(project: Project, seed = 4401): PlaySession {
  const session = startSession(project, seed);
  session.currentMapId = project.startMapId;
  session.x = 5;
  session.y = 5;
  session.gold = 100;
  return session;
}

function activate(detail: StatusMenuDetail, testId: string): void {
  const entry = detail.entries.find((candidate) => candidate.testId === testId);
  expect(entry, `missing ledger action ${testId}`).toBeDefined();
  expect(entry?.disabled).not.toBe(true);
  entry?.onActivate?.();
}

function playerActor(project: Project, session: PlaySession, x = session.x, y = session.y): SpatialLiveActor {
  const body = resolvePlayerBody(project, session);
  return {
    mapId: session.currentMapId,
    x,
    y,
    footprint: body.footprint,
    passRows: body.passRows,
  };
}

function readerFor(
  project: Project,
  session: PlaySession,
  extras?: { npcs?: SpatialLiveActor[]; x?: number; y?: number },
): SpatialLiveContextReader {
  return () => ({
    player: playerActor(project, session, extras?.x ?? session.x, extras?.y ?? session.y),
    npcs: extras?.npcs ?? [],
  });
}

function spaces(project: Project, session: PlaySession, options?: {
  readLive?: SpatialLiveContextReader;
  placementDirection?: Dir;
  getPlacementDirection?: () => Dir | undefined;
  getScene?: () => LifePlacementSceneSource | undefined;
  onMutation?: (ok: boolean, message: string) => void;
}) {
  return createLifeLedgerDetail({
    project,
    session,
    tab: "spaces",
    onMutation: options?.onMutation,
    readLive: options?.readLive,
    placementDirection: options?.placementDirection,
    getPlacementDirection: options?.getPlacementDirection,
    getScene: options?.getScene,
  });
}

function expectedAdjacent(
  project: Project,
  session: PlaySession,
  direction: Dir,
  footprint: SpatialFootprint,
  orientation: Dir,
) {
  return adjacentSpatialPosition(playerActor(project, session), direction, footprint, orientation);
}

function sceneFor(
  project: Project,
  session: PlaySession,
  extras?: Partial<LifePlacementSceneSource>,
): LifePlacementSceneSource {
  return {
    map: project.maps[project.startMapId]!,
    session,
    tileX: session.x,
    tileY: session.y,
    facing: "down",
    eventPositions: {},
    moving: false,
    autonomousNPCs: new Map(),
    ...extras,
  };
}

describe("life placement live UI", () => {
  it("refuses all six live mutations without a scene reader and leaves costs/state unchanged", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 4;
    session.farmBuildingPlacements = {
      shed_1: {
        instanceId: "shed_1", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 1, y: 1, orientation: "down",
      },
    };
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1", typeId: "table",
        mapId: project.startMapId, x: 8, y: 1, orientation: "down",
      },
    };
    const before = structuredClone(session);
    const mutations: Array<{ ok: boolean; message: string }> = [];
    const detail = spaces(project, session, {
      onMutation: (ok, message) => mutations.push({ ok, message }),
    });
    activate(detail, "life-ledger-space-building-place-shed");
    activate(detail, "life-ledger-space-building-move-shed_1");
    activate(detail, "life-ledger-space-building-upgrade-shed_1");
    activate(detail, "life-ledger-space-decoration-place-table");
    activate(detail, "life-ledger-space-decoration-move-table_1");
    activate(detail, "life-ledger-space-decoration-rotate-table_1");
    expect(session).toEqual(before);
    expect(mutations).toEqual(Array.from({ length: 6 }, () => ({
      ok: false,
      message: "처리할 수 없습니다: blocked",
    })));
  });

  it("displays and applies the adjacent full-body target, not the player foot tile", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 3;
    const body = resolvePlayerBody(project, session);
    const target = adjacentSpatialPosition(
      { mapId: session.currentMapId, x: session.x, y: session.y, footprint: body.footprint, passRows: body.passRows },
      "down",
      { width: 2, height: 1 },
      "down",
    );
    expect(target).toEqual({ mapId: project.startMapId, x: 5, y: 6, orientation: "down" });
    expect(target.y).not.toBe(session.y);
    const missing = createLifeLedgerDetail({ project, session, tab: "spaces" });
    const missingPlace = missing.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
    expect(missingPlace?.value).not.toBe(`${project.startMapId} (5, 5)`);
    expect(missingPlace?.value).toBe("장면을 확인할 수 없습니다");
    const readLive = readerFor(project, session);
    const detail = () => spaces(project, session, {
      readLive,
      placementDirection: "down",
    });
    const placeBuilding = detail().entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
    expect(placeBuilding?.value).toBe(`${project.startMapId} (5, 6)`);
    expect(placeBuilding?.value).not.toBe(`${project.startMapId} (5, 5)`);
    activate(detail(), "life-ledger-space-building-place-shed");
    const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
    expect(session.farmBuildingPlacements?.[buildingId ?? ""]).toMatchObject({ x: 5, y: 6, mapId: project.startMapId });
    expect(session.farmBuildingPlacements?.[buildingId ?? ""]).not.toMatchObject({ x: 5, y: 5 });
  });

  it("still removes buildings and decorations and keeps other ledger tabs without a reader", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 0;
    session.farmBuildingPlacements = {
      shed_1: {
        instanceId: "shed_1", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 1, y: 1, orientation: "down",
      },
    };
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1", typeId: "table",
        mapId: project.startMapId, x: 8, y: 1, orientation: "down",
      },
    };
    const mutations: boolean[] = [];
    const detail = spaces(project, session, { onMutation: (ok) => mutations.push(ok) });
    activate(detail, "life-ledger-space-building-remove-shed_1");
    activate(detail, "life-ledger-space-decoration-remove-table_1");
    expect(session.farmBuildingPlacements).toEqual({});
    expect(session.homeDecorationPlacements).toEqual({});
    expect(session.inventory[itemId]).toBe(1);
    expect(mutations).toEqual([true, true]);
    const shipping = createLifeLedgerDetail({
      project,
      session,
      tab: "shipping",
      onMutation: (ok) => mutations.push(ok),
    });
    expect(shipping.entries.every((entry) => entry.testId?.startsWith("life-ledger-shipping-") || entry.testId === undefined || !entry.testId.includes("space"))).toBe(true);
  });

  it("places and moves on the adjacent full-body target, not the player foot tile", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 3;
    const readLive = readerFor(project, session);
    const buildingTarget = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
    const decorationTarget = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
    expect(buildingTarget).toEqual({ mapId: project.startMapId, x: 5, y: 6, orientation: "down" });
    expect(buildingTarget.y).not.toBe(session.y);
    const mutations: boolean[] = [];
    const detail = () => spaces(project, session, {
      readLive,
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    });
    const placeBuilding = detail().entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
    expect(placeBuilding?.value).toBe(`${project.startMapId} (5, 6)`);
    expect(placeBuilding?.value).not.toBe(`${project.startMapId} (5, 5)`);
    activate(detail(), "life-ledger-space-building-place-shed");
    const buildingId = Object.keys(session.farmBuildingPlacements ?? {})[0];
    if (!buildingId) throw new Error("building was not placed");
    expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: 5, y: 6, mapId: project.startMapId });
    expect(session.farmBuildingPlacements?.[buildingId]).not.toMatchObject({ x: 5, y: 5 });
    session.x = 2;
    session.y = 2;
    const moveTarget = expectedAdjacent(project, session, "right", { width: 2, height: 1 }, "down");
    activate(spaces(project, session, {
      readLive: readerFor(project, session),
      placementDirection: "right",
      onMutation: (ok) => mutations.push(ok),
    }), `life-ledger-space-building-move-${buildingId}`);
    expect(session.farmBuildingPlacements?.[buildingId]).toMatchObject({ x: moveTarget.x, y: moveTarget.y });
    session.x = 8;
    session.y = 8;
    activate(spaces(project, session, {
      readLive: readerFor(project, session),
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-decoration-place-table");
    const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
    if (!decorationId) throw new Error("decoration was not placed");
    expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({
      x: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").x,
      y: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").y,
    });
    session.x = 10;
    session.y = 10;
    activate(spaces(project, session, {
      readLive: readerFor(project, session),
      placementDirection: "left",
      onMutation: (ok) => mutations.push(ok),
    }), `life-ledger-space-decoration-move-${decorationId}`);
    expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject(
      expectedAdjacent(project, session, "left", { width: 2, height: 1 }, "down"),
    );
    expect(mutations.every((ok) => ok)).toBe(true);
    void decorationTarget;
  });

  it("targets all four facing directions with oriented footprints", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 8;
    const directions: Array<{ direction: Dir; x: number; y: number }> = [
      { direction: "up", x: 8, y: 8 },
      { direction: "down", x: 2, y: 2 },
      { direction: "left", x: 12, y: 4 },
      { direction: "right", x: 4, y: 12 },
    ];
    for (const { direction, x, y } of directions) {
      session.x = x;
      session.y = y;
      const target = expectedAdjacent(project, session, direction, { width: 2, height: 1 }, "down");
      const beforeGold = session.gold;
      const mutations: boolean[] = [];
      const beforeIds = new Set(Object.keys(session.farmBuildingPlacements ?? {}));
      activate(spaces(project, session, {
        readLive: readerFor(project, session),
        placementDirection: direction,
        onMutation: (ok) => mutations.push(ok),
      }), "life-ledger-space-building-place-shed");
      const placedId = Object.keys(session.farmBuildingPlacements ?? {}).find((id) => !beforeIds.has(id));
      expect(session.farmBuildingPlacements?.[placedId ?? ""]).toMatchObject({ x: target.x, y: target.y, orientation: "down" });
      expect(session.gold).toBe(beforeGold - 10);
      expect(mutations).toEqual([true]);
    }
    session.x = 12;
    session.y = 8;
    const left = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "left");
    expect(left.orientation).toBe("left");
    const mutations: boolean[] = [];
    const detail = spaces(project, session, {
      readLive: readerFor(project, session),
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    });
    activate(detail, "life-ledger-space-decoration-place-table");
    const decorationId = Object.keys(session.homeDecorationPlacements ?? {})[0];
    if (!decorationId) throw new Error("decoration missing");
    expect(session.homeDecorationPlacements?.[decorationId]?.orientation).toBe("down");
    activate(spaces(project, session, {
      readLive: readerFor(project, session),
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    }), `life-ledger-space-decoration-rotate-${decorationId}`);
    expect(session.homeDecorationPlacements?.[decorationId]?.orientation).toBe("left");
    expect(session.homeDecorationPlacements?.[decorationId]).toMatchObject({
      x: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").x,
      y: expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down").y,
    });
    expect(mutations).toEqual([true, true]);
  });

  it("protects all six callers against a live NPC body and rereads eventLocations after preview", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 4;
    session.gold = 100;
    const npcState = { x: 12, y: 8 };
    const readLive = () => ({
      player: playerActor(project, session),
      npcs: [{
        mapId: project.startMapId,
        x: npcState.x,
        y: npcState.y,
        footprint: { width: 3, height: 3 },
        passRows: 1,
      }],
    });
    const target = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
    expect(target.y).toBe(6);
    const preview = spaces(project, session, { readLive, placementDirection: "down" });
    expect(preview.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed")?.value)
      .toBe(`${project.startMapId} (5, 6)`);
    npcState.x = 5;
    npcState.y = 6;
    session.eventLocations = { npc_1: { mapId: project.startMapId, x: 5, y: 6 } };
    const before = structuredClone(session);
    const mutations: Array<{ ok: boolean; message: string }> = [];
    const onMutation = (ok: boolean, message: string) => mutations.push({ ok, message });
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);

    session.farmBuildingPlacements = {
      shed_1: {
        instanceId: "shed_1", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 4, y: 4, orientation: "down",
      },
    };
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1", typeId: "table",
        mapId: project.startMapId, x: 8, y: 1, orientation: "down",
      },
    };
    const beforeAll = structuredClone(session);
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-move-shed_1");
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-upgrade-shed_1");
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-place-table");
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-move-table_1");
    npcState.x = 8;
    npcState.y = 2;
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-decoration-rotate-table_1");
    expect(session.gold).toBe(beforeAll.gold);
    expect(session.inventory).toEqual(beforeAll.inventory);
    expect(session.farmBuildingPlacements).toEqual(beforeAll.farmBuildingPlacements);
    expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
    expect(mutations.every((entry) => entry.ok === false && entry.message.includes("blocked"))).toBe(true);
  });

  it("uses the full 3x3 body with passRows 1, not the passage row, for live overlap", () => {
    const { project, itemId } = spatialProject();
    project.system.playerFootprint = { width: 3, height: 3 };
    project.system.playerPassRows = 1;
    const session = liveSession(project);
    session.inventory[itemId] = 2;
    const npcState = { x: 5, y: 8 };
    const readLive = () => ({
      player: playerActor(project, session),
      npcs: [{
        mapId: project.startMapId,
        x: npcState.x,
        y: npcState.y,
        footprint: { width: 3, height: 3 },
        passRows: 1,
      }],
    });
    const target = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
    expect(target).toEqual({ mapId: project.startMapId, x: 4, y: 6, orientation: "down" });
    const mutations: Array<{ ok: boolean }> = [];
    const onMutation = (ok: boolean) => mutations.push({ ok });
    const blocked = structuredClone(session);
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(blocked);
    expect(mutations).toEqual([{ ok: false }]);
    npcState.y = 12;
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation }), "life-ledger-space-building-place-shed");
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 4, y: 6 });
    expect(mutations.at(-1)?.ok).toBe(true);
  });

  it("refuses rotation, upgrade, plots and last-exit without spending", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 4;
    session.farmBuildingPlacements = {
      shed_1: {
        instanceId: "shed_1", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 4, y: 4, orientation: "down",
      },
    };
    session.homeDecorationPlacements = {
      table_1: {
        instanceId: "table_1", typeId: "table",
        mapId: project.startMapId, x: 4, y: 3, orientation: "down",
      },
    };
    const readLive = readerFor(project, session);
    const beforeUpgrade = structuredClone(session);
    const mutations: boolean[] = [];
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation: (ok) => mutations.push(ok) }), "life-ledger-space-building-upgrade-shed_1");
    expect(session).toEqual(beforeUpgrade);
    activate(spaces(project, session, { readLive, placementDirection: "down", onMutation: (ok) => mutations.push(ok) }), "life-ledger-space-decoration-rotate-table_1");
    expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
    expect(session.gold).toBe(100);

    const plotSession = liveSession(project, 4402);
    plotSession.inventory[itemId] = 2;
    const plotTarget = expectedAdjacent(project, plotSession, "down", { width: 2, height: 1 }, "down");
    plotSession.farmPlots = {
      [project.startMapId]: {
        [`${plotTarget.x},${plotTarget.y}`]: { tilled: true, watered: false },
      },
    };
    const beforePlot = structuredClone(plotSession);
    activate(spaces(project, plotSession, {
      readLive: readerFor(project, plotSession),
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(plotSession).toEqual(beforePlot);

    const exitSession = liveSession(project, 4403);
    exitSession.x = 5;
    exitSession.y = 5;
    exitSession.gold = 100;
    exitSession.inventory[itemId] = 4;
    exitSession.farmBuildingPlacements = {
      a: { instanceId: "a", typeId: "shed", level: 1, mapId: project.startMapId, x: 3, y: 5, orientation: "down" },
      b: { instanceId: "b", typeId: "shed", level: 1, mapId: project.startMapId, x: 5, y: 4, orientation: "down" },
      c: { instanceId: "c", typeId: "shed", level: 1, mapId: project.startMapId, x: 5, y: 6, orientation: "down" },
    };
    const beforeExit = structuredClone(exitSession);
    activate(spaces(project, exitSession, {
      readLive: readerFor(project, exitSession),
      placementDirection: "right",
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(exitSession).toEqual(beforeExit);
    expect(mutations.every((ok) => ok === false)).toBe(true);
  });

  it("does not pass a mid-step fractional player anchor into the discrete body test", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 2;
    const logical = readerFor(project, session, { x: 5, y: 5 });
    const fractional = () => ({
      player: { ...playerActor(project, session), x: 5.4, y: 5.7 },
      npcs: [],
    });
    const mutations: boolean[] = [];
    activate(spaces(project, session, {
      readLive: fractional,
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(session.farmBuildingPlacements ?? {}).toEqual({});
    expect(mutations).toEqual([false]);
    activate(spaces(project, session, {
      readLive: logical,
      placementDirection: "down",
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });
    expect(mutations).toEqual([false, true]);
  });

  it("refuses in-flight player actions while the integer origin is still committed", () => {
    const { project, itemId } = spatialProject();
    project.system.playerFootprint = { width: 3, height: 3 };
    project.system.playerPassRows = 1;
    const session = liveSession(project);
    session.inventory[itemId] = 2;
    const scene = sceneFor(project, session, {
      moving: true,
      movingFrom: { x: 5, y: 5 },
      movingTo: { x: 6, y: 5 },
      moveProgress: 0.5,
      facing: "right",
    });
    const readLive = createLifePlacementLiveReader(() => scene, () => project);
    const live = readLive();
    expect(live.player).toMatchObject({ x: 5, y: 5 });
    expect(Number.isSafeInteger(live.player.x)).toBe(true);
    const target = adjacentSpatialPosition(live.player, "right", { width: 2, height: 1 }, "down");
    expect(target).toEqual({ mapId: project.startMapId, x: 7, y: 3, orientation: "down" });
    const before = structuredClone(session);
    const mutations: boolean[] = [];
    activate(spaces(project, session, {
      readLive,
      placementDirection: "right",
      getScene: () => scene,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    expect(mutations).toEqual([false]);
    const landed = sceneFor(project, session, { moving: false, facing: "right" });
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => landed, () => project),
      placementDirection: "right",
      getScene: () => landed,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 7, y: 3 });
    expect(mutations).toEqual([false, true]);
  });

  it("blocks a target that the interpolating NPC body still occupies after destination commit", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.x = 12;
    session.y = 2;
    session.inventory[itemId] = 2;
    const map = project.maps[project.startMapId]!;
    map.events = [
      event("npc_walker", 12, 5, [{
        ...page("walk", "same", { kind: "action" }),
        footprint: { width: 3, height: 3 },
        passRows: 1,
      }]),
    ];
    session.eventLocations = { npc_walker: { mapId: map.id, x: 12, y: 6 } };
    const movers = new Map([
      ["npc_walker", {
        activeMove: { fromX: 12, fromY: 5, toX: 12, toY: 6, elapsedMs: 200, durationMs: 400 },
        moveDurationMs: 400,
      }],
    ]);
    const scene = sceneFor(project, session, {
      map,
      tileX: 12,
      tileY: 2,
      eventPositions: { npc_walker: { x: 12, y: 5 } },
      autonomousNPCs: movers,
    });
    const destination = adjacentSpatialPosition(playerActor(project, session), "down", { width: 2, height: 1 }, "down");
    expect(destination.y).toBe(3);
    expect(placementBlockedByRenderedBodies(project, scene, destination, { width: 2, height: 1 })).toBe(true);
    const readLive = createLifePlacementLiveReader(() => scene, () => project);
    const core = readLive();
    expect(core.npcs[0]).toMatchObject({ x: 12, y: 6 });
    const before = structuredClone(session);
    const mutations: boolean[] = [];
    activate(spaces(project, session, {
      readLive,
      placementDirection: "down",
      getScene: () => scene,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    expect(mutations).toEqual([false]);
    const idle = sceneFor(project, session, {
      map,
      tileX: 12,
      tileY: 2,
      eventPositions: { npc_walker: { x: 12, y: 6 } },
    });
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => idle, () => project),
      placementDirection: "down",
      getScene: () => idle,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: destination.x, y: destination.y });
    expect(mutations).toEqual([false, true]);
  });

  it("does not ban construction because an unrelated NPC is interpolating elsewhere", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 2;
    const map = project.maps[project.startMapId]!;
    map.events = [
      event("npc_far", 2, 2, [{
        ...page("walk", "same", { kind: "action" }),
        footprint: { width: 3, height: 3 },
        passRows: 1,
      }]),
    ];
    session.eventLocations = { npc_far: { mapId: map.id, x: 2, y: 3 } };
    const scene = sceneFor(project, session, {
      map,
      autonomousNPCs: new Map([["npc_far", {
        activeMove: { fromX: 2, fromY: 2, toX: 2, toY: 3, elapsedMs: 100, durationMs: 400 },
        moveDurationMs: 400,
      }]]),
    });
    const mutations: boolean[] = [];
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => scene, () => project),
      placementDirection: "down",
      getScene: () => scene,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(mutations).toEqual([true]);
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });
  });

  it("protects visible below and pass-through bodies without turning them into walking walls", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 3;
    const map = project.maps[project.startMapId]!;
    map.events = [
      event("below", 5, 6, [{
        ...page("floor", "below", { kind: "touch" }),
        footprint: { width: 2, height: 1 },
      }]),
      event("through", 8, 8, [{
        ...page("open", "same", { kind: "action" }),
        overlapForbidden: false,
        footprint: { width: 2, height: 1 },
      }]),
    ];
    const scene = sceneFor(project, session, { map, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
    const live = readLifePlacementLiveContext(project, scene);
    expect(live?.npcs).toEqual([]);
    const down = expectedAdjacent(project, session, "down", { width: 2, height: 1 }, "down");
    expect(placementBlockedByRenderedBodies(project, scene, down, { width: 2, height: 1 })).toBe(true);
    const mutations: boolean[] = [];
    const before = structuredClone(session);
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => scene, () => project),
      placementDirection: "down",
      getScene: () => scene,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    session.x = 8;
    session.y = 7;
    const throughScene = sceneFor(project, session, { map, tileX: 8, tileY: 7, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => throughScene, () => project),
      placementDirection: "down",
      getScene: () => throughScene,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(session.farmBuildingPlacements ?? {}).toEqual({});
    expect(mutations).toEqual([false, false]);
    session.x = 2;
    session.y = 2;
    const clear = sceneFor(project, session, { map, tileX: 2, tileY: 2, eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } } });
    activate(spaces(project, session, {
      readLive: createLifePlacementLiveReader(() => clear, () => project),
      placementDirection: "down",
      getScene: () => clear,
      onMutation: (ok) => mutations.push(ok),
    }), "life-ledger-space-building-place-shed");
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 2, y: 3 });
    expect(mutations.at(-1)).toBe(true);
  });

  it("threads the live reader through status details and the status controller", () => {
    const { project, itemId } = spatialProject();
    const session = liveSession(project);
    session.inventory[itemId] = 2;
    store.replaceProject(project);
    const readLive = readerFor(project, session);
    const detail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "life-ledger",
      slots: [],
      waitModeEnabled: false,
      lifeLedgerTab: "spaces",
      readLive,
      placementDirection: "down",
    });
    const place = detail.entries.find((entry) => entry.testId === "life-ledger-space-building-place-shed");
    expect(place?.value).toBe(`${project.startMapId} (5, 6)`);
    place?.onActivate?.();
    expect(Object.values(session.farmBuildingPlacements ?? {})[0]).toMatchObject({ x: 5, y: 6 });

    const layout = document.createElement("div");
    document.body.append(layout);
    const playStage = document.createElement("div");
    layout.append(playStage);
    const scene = {
      session,
      map: project.maps[project.startMapId],
      tileX: session.x,
      tileY: session.y,
      facing: "down" as const,
      eventPositions: {},
      getSession: () => session,
      refreshRuntimeSurfaces: () => undefined,
      syncRuntimeState: () => undefined,
    };
    const controller = createPlayerStatusMenuController({
      layout,
      getActiveScene: () => scene as unknown as PlayScene,
      getPlayStage: () => playStage,
      getPlayStartedAt: () => 0,
      closeMenu: () => undefined,
      closeMenuWithJuice: () => undefined,
      renderTitle: () => undefined,
      emitMenuJuice: (_event, target) => target ?? null,
      menuCloseJuiceMs: 0,
      loadSlot: () => undefined,
    });
    session.x = 3;
    session.y = 3;
    scene.tileX = 3;
    scene.tileY = 3;
    const menu = controller.renderMenu(undefined, "life-ledger");
    expect(menu).toBeTruthy();
    layout.remove();
  });
});

describe("life placement scene reader eligibility", () => {
  it("includes relocated and spawned actors and drops erased, off-map, and page-less ghosts", () => {
    const { project } = spatialProject();
    const map = project.maps[project.startMapId]!;
    map.events = [
      event("npc_here", 4, 4, [page("p1", "same", { kind: "action" })]),
      event("ghost", 6, 6, []),
      event("below", 7, 7, [page("floor", "below", { kind: "touch" })]),
      event("through", 3, 3, [{ ...page("open", "same", { kind: "action" }), overlapForbidden: false }]),
      event("erased", 8, 8, [page("p1", "same", { kind: "action" })]),
      event("away", 9, 9, [page("p1", "same", { kind: "action" })]),
    ];
    const session = liveSession(project);
    session.erasedEventIds = ["erased"];
    session.eventLocations = {
      away: { mapId: "other-map", x: 1, y: 1 },
      incoming: { mapId: map.id, x: 2, y: 3 },
    };
    session.spawnedEvents = {
      spawn_1: {
        templateMapId: map.id,
        templateEventId: "npc_here",
        mapId: map.id,
        x: 11,
        y: 4,
      },
    };
    const other = createBlankProject();
    const otherMap = other.maps[other.startMapId]!;
    otherMap.id = "other-map";
    otherMap.events = [event("incoming", 0, 0, [page("p1", "same", { kind: "action" })])];
    project.maps["other-map"] = otherMap;
    const live = readLifePlacementLiveContext(project, {
      map,
      session,
      tileX: 5,
      tileY: 5,
      facing: "down",
      eventPositions: { npc_here: { x: 4, y: 4 } },
    });
    expect(live?.player).toMatchObject({ mapId: map.id, x: 5, y: 5 });
    const cells = new Set(live?.npcs.map((actor) => `${actor.x},${actor.y}`));
    expect(cells.has("4,4")).toBe(true);
    expect(cells.has("2,3")).toBe(true);
    expect(cells.has("11,4")).toBe(true);
    expect(cells.has("6,6")).toBe(false);
    expect(cells.has("7,7")).toBe(false);
    expect(cells.has("3,3")).toBe(false);
    expect(cells.has("8,8")).toBe(false);
    expect(cells.has("9,9")).toBe(false);
  });
});
