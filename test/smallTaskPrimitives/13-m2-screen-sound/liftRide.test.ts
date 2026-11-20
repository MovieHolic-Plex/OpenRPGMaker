/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { playSoundEffect } from "@/player/audio";
import { liftRideSnapshot, playLiftRide, syncLiftRide } from "@/player/playSceneLiftRide";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeLiftRide } from "@/project/eventCommands/liftRide";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

vi.mock("@/player/audio", async importOriginal => ({
  ...await importOriginal<typeof import("@/player/audio")>(),
  playSoundEffect: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

function setup(y: number) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const session = startSession(project);
  session.x = 1;
  session.y = y;
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  const platform = {
    clear: vi.fn(), destroy: vi.fn(), fillRect: vi.fn(), fillStyle: vi.fn(),
    setDepth: vi.fn().mockReturnThis(), setPosition: vi.fn(),
  };
  const graphics = vi.fn(() => platform);
  const centerCamera = vi.fn();
  const scene = {
    map, session, tileX: session.x, tileY: session.y, facing: "down", eventPositions: {},
    followerSprites: new Map(), centerCamera, add: { graphics },
    player: { x: 24, y: (y + 1) * 16, active: true, setDepth: vi.fn(), setCrop: vi.fn(), setPosition: vi.fn() },
  } as unknown as PlaySceneContext;
  return { scene, session, graphics, platform, centerCamera };
}

function move(up = true, riders: "party" | "none" = "party", y?: number) {
  return { kind: "liftRide" as const, ...normalizeLiftRide({
    mode: "move", direction: up ? "up" : "down", distance: 1, width: 1, depth: 1, riders, y,
  }) };
}

function controlMovement(scene: PlaySceneContext) {
  type Tween = { targets: { t: number }; onUpdate: () => void; onComplete: () => void };
  const remove = vi.fn();
  const add = vi.fn((config: Tween) => config);
  const addEvent = vi.fn((_config: { callback: () => void }) => ({ remove }));
  Object.assign(scene, {
    tweens: { add }, time: { addEvent, delayedCall: (_ms: number, callback: () => void) => callback() },
  });
  return { add, addEvent, remove };
}

describe("승강 발판의 같은 맵 이동", () => {
  it.each([true, false])("플레이어의 실제 도착 칸이 맵 밖이면 운행하지 않습니다 (위로 %s)", async up => {
    const { scene, session, centerCamera, graphics } = setup(0);
    const edge = up ? 0 : scene.map.height - 1;
    scene.tileY = session.y = edge;

    // The explicitly placed platform can land safely, but the player's actual tile cannot.
    await playLiftRide(scene, move(up, "party", 2));
    expect(scene.tileY).toBe(edge);
    expect(session.y).toBe(edge);
    expect(graphics).not.toHaveBeenCalled();
    expect(centerCamera).not.toHaveBeenCalled();
  });

  it("파티가 타면 같은 맵의 유효한 경계 칸까지 옮깁니다", async () => {
    const { scene, session, centerCamera } = setup(1);
    await playLiftRide(scene, move());
    expect(scene.tileY).toBe(0);
    expect(session.y).toBe(0);
    expect(centerCamera).toHaveBeenCalledOnce();
  });

  it("빈 발판을 움직여도 플레이어·세션 좌표는 그대로입니다", async () => {
    const { scene, session, platform, centerCamera } = setup(0);
    await playLiftRide(scene, move(true, "none", 2));
    expect(platform.setPosition).toHaveBeenLastCalledWith(16, 16);
    expect(scene.tileY).toBe(0);
    expect(session.y).toBe(0);
    expect(centerCamera).not.toHaveBeenCalled();
  });

  it("운행 중 맵이 교체되면 이전 도착 칸을 적용하지 않습니다", async () => {
    const { scene, session, centerCamera } = setup(1);
    const riding = playLiftRide(scene, move());
    scene.map = { ...scene.map, id: "next_map" };
    await riding;
    expect(scene.tileY).toBe(1);
    expect(session.y).toBe(1);
    expect(centerCamera).not.toHaveBeenCalled();
  });

  it("같은 맵에서 세션이 교체되면 이동 프레임에서 발판과 기계음을 정리합니다", async () => {
    const { scene, session, centerCamera } = setup(1);
    const { add, addEvent, remove } = controlMovement(scene);
    const riding = playLiftRide(scene, move());
    await Promise.resolve();
    const motion = add.mock.calls[0]![0];
    motion.targets.t = 0.5;
    motion.onUpdate();
    expect(liftRideSnapshot(scene)).toMatchObject({ offsetTiles: -0.5 });

    scene.session = { ...session };
    motion.onUpdate();
    expect(liftRideSnapshot(scene)).toBeNull();
    expect(remove).toHaveBeenCalledExactlyOnceWith(false);
    const soundCount = vi.mocked(playSoundEffect).mock.calls.length;
    addEvent.mock.calls[0]![0].callback();
    expect(playSoundEffect).toHaveBeenCalledTimes(soundCount);
    motion.onComplete();
    await riding;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(centerCamera).not.toHaveBeenCalled();
  });

  it("운행 중 옮긴 플레이어의 스프라이트를 현재 칸에 맞춥니다", async () => {
    const { scene, session } = setup(1);
    const { add } = controlMovement(scene);
    const riding = playLiftRide(scene, move());
    await Promise.resolve();
    scene.tileX = session.x = 3;
    scene.tileY = session.y = 4;
    const motion = add.mock.calls[0]![0];
    motion.targets.t = 1;
    motion.onUpdate();
    syncLiftRide(scene);
    motion.onComplete();
    await riding;

    expect(scene.player.setPosition).toHaveBeenLastCalledWith(56, 80);
    expect([scene.tileX, scene.tileY, session.x, session.y]).toEqual([3, 4, 3, 4]);
  });
});
