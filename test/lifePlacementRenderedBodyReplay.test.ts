/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import {
  createLifePlacementLiveReader,
  readLifePlacementLiveContext,
  type LifePlacementSceneSource,
} from "@/player/lifePlacementScene";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { adjacentSpatialPosition } from "@/project/spatialOccupancy";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { event, page } from "./runtimeEventPageFixtures";
import type { Project } from "@/project/types";
import type { StatusMenuDetail } from "@/player/playerStatusMenuDetailTypes";

function spatialProject() {
  const project = createBlankProject();
  const item = project.database.items[0];
  if (!item) throw new Error("blank project requires a starter item");
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [{
      level: 1,
      footprint: { width: 2, height: 1 },
      capacity: 4,
      cost: { gold: 10, items: [{ itemId: item.id, count: 1 }] },
      graphicResourceId: "building-default",
    }],
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

describe("life placement rendered-body replay (new, not historical RED)", () => {
  it("refuses construction through the ledger while an interpolating NPC body still covers the target and the destination body does not", () => {
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
    const scene = sceneFor(project, session, {
      map,
      tileX: 12,
      tileY: 2,
      eventPositions: { npc_walker: { x: 12, y: 5 } },
      autonomousNPCs: new Map([
        ["npc_walker", {
          activeMove: { fromX: 12, fromY: 5, toX: 12, toY: 6, elapsedMs: 200, durationMs: 400 },
          moveDurationMs: 400,
        }],
      ]),
    });
    const body = resolvePlayerBody(project, session);
    const target = adjacentSpatialPosition(
      { mapId: session.currentMapId, x: session.x, y: session.y, footprint: body.footprint, passRows: body.passRows },
      "down",
      { width: 2, height: 1 },
      "down",
    );
    expect(target.y).toBe(3);
    const readLive = createLifePlacementLiveReader(() => scene, () => project);
    const core = readLive();
    expect(core.npcs[0]).toMatchObject({ x: 12, y: 6 });
    const before = structuredClone(session);
    const mutations: Array<{ ok: boolean; message: string }> = [];
    activate(createLifeLedgerDetail({
      project,
      session,
      tab: "spaces",
      readLive,
      placementDirection: "down",
      getScene: () => scene,
      onMutation: (ok, message) => mutations.push({ ok, message }),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    expect(mutations).toEqual([{ ok: false, message: "처리할 수 없습니다: blocked" }]);
  });

  it("refuses visible below and pass-through overlap through the ledger without making them walking walls", () => {
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
    const scene = sceneFor(project, session, {
      map,
      eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } },
    });
    const live = readLifePlacementLiveContext(project, scene);
    expect(live?.npcs).toEqual([]);
    const mutations: Array<{ ok: boolean; message: string }> = [];
    const before = structuredClone(session);
    activate(createLifeLedgerDetail({
      project,
      session,
      tab: "spaces",
      readLive: createLifePlacementLiveReader(() => scene, () => project),
      placementDirection: "down",
      getScene: () => scene,
      onMutation: (ok, message) => mutations.push({ ok, message }),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    session.x = 8;
    session.y = 7;
    const throughScene = sceneFor(project, session, {
      map,
      tileX: 8,
      tileY: 7,
      eventPositions: { below: { x: 5, y: 6 }, through: { x: 8, y: 8 } },
    });
    const throughBefore = structuredClone(session);
    activate(createLifeLedgerDetail({
      project,
      session,
      tab: "spaces",
      readLive: createLifePlacementLiveReader(() => throughScene, () => project),
      placementDirection: "down",
      getScene: () => throughScene,
      onMutation: (ok, message) => mutations.push({ ok, message }),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(throughBefore);
    expect(mutations).toEqual([
      { ok: false, message: "처리할 수 없습니다: blocked" },
      { ok: false, message: "처리할 수 없습니다: blocked" },
    ]);
  });

  it("refuses an in-flight player through the ledger while the integer origin is still committed", () => {
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
    expect(readLive().player).toMatchObject({ x: 5, y: 5 });
    const before = structuredClone(session);
    const mutations: Array<{ ok: boolean; message: string }> = [];
    activate(createLifeLedgerDetail({
      project,
      session,
      tab: "spaces",
      readLive,
      placementDirection: "right",
      getScene: () => scene,
      onMutation: (ok, message) => mutations.push({ ok, message }),
    }), "life-ledger-space-building-place-shed");
    expect(session).toEqual(before);
    expect(mutations).toEqual([{ ok: false, message: "처리할 수 없습니다: blocked" }]);
  });
});
