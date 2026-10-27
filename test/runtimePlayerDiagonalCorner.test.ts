/** @vitest-environment happy-dom */
// 대각으로 걸을 때 모서리 칸의 사람(같은 층·겹침 금지)을 직선으로 가로지르지 않는다.
// 벽 모서리는 resolveDiagonalStep 이 이미 미끄러지지만, 인물은 목적지 칸에서만 봤다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { updatePlayScene } from "@/player/playSceneMovement";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { EventPage, GameEvent } from "@/project/types";

const FRAME_MS = 1000 / 60;

function solid(id: string, x: number, y: number, trigger: EventPage["trigger"] = { kind: "action" }): GameEvent {
  return {
    id,
    x,
    y,
    trigger,
    commands: [],
    pages: [{
      id: `${id}_p`,
      name: id,
      conditions: [],
      graphic: {},
      trigger,
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  };
}

function cornerScene(events: GameEvent[], input: { x: number; y: number; dir: "right" | "down" }): {
  scene: PlaySceneContext;
  ran: string[];
} {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.events = events;
  store.replace(project);
  const ran: string[] = [];
  const scene = {
    game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
    session: startSession(project),
    map,
    eventPositions: initialRuntimeEventPositions(map.events),
    player: {
      x: 0, y: 0, setFrame: () => undefined, setPosition: () => undefined, setVisible: () => undefined,
      setDepth: () => undefined, setOrigin: () => undefined,
    },
    playerSprite: { idleFrameFor: () => 1, walkFrameFor: () => 2, walkFrameCount: 3 },
    input_: {
      update: () => ({ x: input.x, y: input.y, dir: input.dir, dash: false, actionPressed: false, attackPressed: false, skillPressed: false }),
      resetEdges: () => undefined,
      clearDirectionTaps: () => undefined,
    },
    followerSprites: new Map(),
    autonomousNPCs: new Map(),
    tileX: 4,
    tileY: 4,
    movingFrom: { x: 4, y: 4 },
    movingTo: { x: 4, y: 4 },
    moving: false,
    moveProgress: 0,
    moveDurationMs: 160,
    logicTickAccumulatorMs: 0,
    dashing: false,
    facing: "down",
    walkFrame: 0,
    walkTimer: 0,
    lastActionTargetKey: "",
    playerRoute: null,
    playerHop: null,
    running: false,
    inputEnabled: true,
    runEvent: async (id: string) => { ran.push(id); },
    updateAutonomousNPCs: () => undefined,
    updateParallelEvents: () => undefined,
    updateTimers: () => undefined,
    updateFieldSpawns: () => undefined,
    syncRuntimeState: () => undefined,
  } as unknown as PlaySceneContext;
  return { scene, ran };
}

describe("대각 걸음은 모서리의 사람을 가로지르지 않는다", () => {
  it("오른쪽 모서리에 사람이 있으면 아래로 미끄러진다", () => {
    const { scene, ran } = cornerScene([solid("npc", 5, 4)], { x: 1, y: 1, dir: "right" });
    updatePlayScene(scene, FRAME_MS);
    expect(scene.moving).toBe(true);
    expect(scene.movingTo).toEqual({ x: 4, y: 5 });
    expect(scene.facing).toBe("down");
    expect(ran).toEqual([]);
  });

  it("발밑 이벤트(아래 층)는 모서리를 막지 않는다", () => {
    const rug = solid("rug", 5, 4);
    rug.pages![0]!.priority = "below";
    rug.pages![0]!.overlapForbidden = false;
    const { scene } = cornerScene([rug], { x: 1, y: 1, dir: "right" });
    updatePlayScene(scene, FRAME_MS);
    expect(scene.movingTo).toEqual({ x: 5, y: 5 });
  });

  it("양쪽 모서리가 사람이면 대각으로 들어가지 않고 바라보는 쪽에게 부딪힌다", () => {
    const { scene, ran } = cornerScene(
      [solid("side", 5, 4, { kind: "playerTouch" }), solid("ahead", 4, 5, { kind: "playerTouch" })],
      { x: 1, y: 1, dir: "right" },
    );
    updatePlayScene(scene, FRAME_MS);
    expect(scene.moving).toBe(false);
    expect(scene.tileX).toBe(4);
    expect(scene.tileY).toBe(4);
    expect(scene.facing).toBe("right");
    expect(ran).toEqual(["side"]);
  });

  it("대각 목적지 칸의 사람에게는 미끄러지지 않고 그 자리에서 부딪힌다", () => {
    const { scene, ran } = cornerScene([solid("npc", 5, 5, { kind: "playerTouch" })], { x: 1, y: 1, dir: "right" });
    updatePlayScene(scene, FRAME_MS);
    expect(scene.moving).toBe(false);
    expect(scene.tileX).toBe(4);
    expect(scene.tileY).toBe(4);
    expect(ran).toEqual(["npc"]);
  });

  it("정면의 사람에게 똑바로 걸으면 여전히 부딪혀 접촉이 발동한다", () => {
    const { scene, ran } = cornerScene([solid("npc", 5, 4, { kind: "playerTouch" })], { x: 1, y: 0, dir: "right" });
    updatePlayScene(scene, FRAME_MS);
    expect(scene.moving).toBe(false);
    expect(ran).toEqual(["npc"]);
  });
});
