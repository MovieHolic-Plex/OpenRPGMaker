/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { playLiftRide } from "@/player/playSceneLiftRide";
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
});
