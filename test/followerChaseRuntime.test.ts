import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { runTool } from "@/editor/tools";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { findChasePath, nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep } from "@/player/followers";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  createHorrorPhase5Fixture,
  PHASE5_CHASER_ID,
  PHASE5_MAP_ID,
  PHASE5_SAFE_CHASER_ID,
} from "./fixtures/horrorPhase5Fixture";

describe("chase pathfinding", () => {
  it("A*는 벽 사이 경로를 우회해 플레이어 쪽 경로를 찾는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles.fill(TILE.GRASS);
    for (const y of [1, 2, 3]) map.lowerTiles[y * map.width + 3] = TILE.WATER;

    const path = findChasePath(project, map, { x: 1, y: 2 }, { x: 5, y: 2 });

    expect(path.at(-1)).toEqual({ x: 5, y: 2 });
    expect(path.length).toBeGreaterThan(4);
    expect(path.some((point) => point.x === 3 && point.y >= 1 && point.y <= 3)).toBe(false);
  });

  it("시야 밖에서는 대기하고 giveUpRange 밖에서는 추격을 해제한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles.fill(TILE.GRASS);
    const mover: ChaseRuntimeState = { timer: 999, moveIntervalMs: 0 };

    expect(nextChaseDecision({
      project,
      map,
      from: { x: 1, y: 1 },
      player: { x: 8, y: 1 },
      deltaMs: 16,
      mover,
      sightRange: 3,
      giveUpRange: 10,
      pathfind: true,
    })).toEqual({ kind: "wait" });
    expect(mover.chaseActive).not.toBe(true);

    const seen = nextChaseDecision({
      project,
      map,
      from: { x: 1, y: 1 },
      player: { x: 3, y: 1 },
      deltaMs: 16,
      mover,
      sightRange: 3,
      giveUpRange: 10,
      pathfind: true,
    });
    expect(seen.kind).toBe("move");
    expect(mover.chaseActive).toBe(true);

    const gaveUp = nextChaseDecision({
      project,
      map,
      from: { x: 1, y: 1 },
      player: { x: 20, y: 1 },
      deltaMs: 16,
      mover,
      sightRange: 3,
      giveUpRange: 4,
      pathfind: true,
    });
    expect(gaveUp).toEqual({ kind: "wait" });
    expect(mover.chaseActive).toBe(false);
  });
});

describe("followers", () => {
  it("플레이어 이동 궤적을 순서대로 승계한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, {
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 },
      name: "메리",
    });

    recordFollowerPlayerStep(session, { x: 2, y: 2, direction: "right" });
    recordFollowerPlayerStep(session, { x: 3, y: 2, direction: "right" });

    expect(followerPositions(session).map((entry) => ({ name: entry.follower.name, x: entry.x, y: entry.y }))).toEqual([
      { name: "가리", x: 3, y: 2 },
      { name: "메리", x: 2, y: 2 },
    ]);
  });

  it("followers와 trail은 세이브/로드 왕복으로 보존된다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    recordFollowerPlayerStep(session, { x: 2, y: 2, direction: "down" });

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

    expect(restored.followers).toEqual(session.followers);
    expect(restored.followerTrail).toEqual(session.followerTrail);
  });
});

describe("run_scene_test Phase 5 integration", () => {
  it("추격자가 장애물을 우회해 플레이어와의 거리를 줄인다", () => {
    const project = createHorrorPhase5Fixture();

    const result = runSceneTest(project, {
      mapId: PHASE5_MAP_ID,
      start: { x: 1, y: 4 },
      steps: [
        { kind: "wait", ticks: 40 },
        { kind: "expect", eventDistanceToPlayerLessThan: { eventId: PHASE5_CHASER_ID, distance: 8 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });

  it("플레이어가 safeZone 안에 있으면 추격자 접촉으로 죽지 않는다", () => {
    const project = createHorrorPhase5Fixture();

    const result = runSceneTest(project, {
      mapId: PHASE5_MAP_ID,
      start: { x: 2, y: 1 },
      steps: [
        { kind: "wait", ticks: 80 },
        { kind: "expect", gameOver: false, eventAt: { eventId: PHASE5_SAFE_CHASER_ID, x: 5, y: 1 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });

  it("접촉 killPlayer 후 체크포인트 리트라이로 시작 위치를 복원한다", () => {
    const project = createHorrorPhase5Fixture();

    const result = runSceneTest(project, {
      mapId: PHASE5_MAP_ID,
      start: { x: 8, y: 4 },
      steps: [
        { kind: "wait", ticks: 20 },
        { kind: "expect", gameOver: true },
        { kind: "retryCheckpoint" },
        { kind: "expect", gameOver: false, playerAt: { x: 8, y: 4, mapId: PHASE5_MAP_ID } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
  });

  it("addFollower 후 이동하면 followerAt 기대값을 만족한다", () => {
    const project = createHorrorPhase5Fixture();

    const result = runSceneTest(project, {
      mapId: PHASE5_MAP_ID,
      start: { x: 1, y: 4 },
      steps: [
        { kind: "move", dir: "up" },
        { kind: "interact" },
        { kind: "expect", followerCount: 1 },
        { kind: "move", dir: "down" },
        { kind: "expect", followerAt: { name: "가리", x: 1, y: 3 } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.followerCount).toBe(1);
  });
});

describe("make_chase_scene tool", () => {
  it("추격자 이벤트, 안전지대, 진입 체크포인트를 생성한다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const ctx = { project };

    const result = runTool(
      ctx,
      "make_chase_scene",
      {
        mapId,
        chaser: { at: { x: 4, y: 4 }, graphic: { textureKey: "tex_easyrpg_charset_monster1" }, speed: 6, sightRange: 7 },
        killOnTouch: true,
        safeZone: { x: 1, y: 1, w: 2, h: 2 },
        activateSwitch: "sw_chase_on",
        checkpointOnEntry: true,
      }
    );

    expect(result.ok, result.summary).toBe(true);
    const changed = ctx.project;
    const map = changed.maps[mapId];
    expect(map.safeZones).toContainEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(map.events.some((event) => event.id === `${map.id}_checkpoint_auto`)).toBe(true);
    const chaser = map.events.find((event) => event.pages?.some((page) => page.movement.type === "chase"));
    expect(chaser?.pages?.[0]?.movement).toMatchObject({ type: "chase", speed: 6, sightRange: 7, pathfind: true });
    expect(chaser?.pages?.[0]?.commands).toContainEqual({ kind: "killPlayer", message: "붙잡혔다." });
  });
});
