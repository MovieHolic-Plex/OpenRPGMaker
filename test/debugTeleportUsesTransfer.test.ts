import { afterEach, describe, expect, it, vi } from "vitest";
import { installPlaySceneTestHooks, type RuntimeDebugHook } from "@/player/playSceneTestHooks";
import { store } from "@/project/store";
import { startSession } from "@/project/session";

// 도그푸딩 2026-09-23: __oprnDebug.teleport 로 다른 맵에 가면 화면이 검게 남고 행동이 안 먹었다.
// 세션만 쓰고 loadMap 만 불러 주인공 스프라이트·카메라가 옛 맵 좌표에 남았기 때문이다.
// 이제 다른 맵 순간이동은 실제 문과 같은 transferTo 경로를 탄다.
type HookWindow = Window & { __oprnDebug?: RuntimeDebugHook };

const previousWindow = globalThis.window;
afterEach(() => {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
});

function install() {
  const testWindow = { location: { search: "" } } as HookWindow;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
  const session = { currentMapId: "map_town", x: 1, y: 1, switches: {}, variables: {}, inventory: {}, gold: 0, flags: {}, timers: {} };
  const transferTo = vi.fn((request: { mapId: string; x: number; y: number }) => {
    session.currentMapId = request.mapId;
    session.x = request.x;
    session.y = request.y;
    return Promise.resolve();
  });
  const loadMap = vi.fn();
  const scene = { events: { once: vi.fn() }, getMapId: () => session.currentMapId, transferTo, loadMap, tileX: 1, tileY: 1 };
  const sync = vi.fn();
  installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => session as never, sync);
  return { debug: testWindow.__oprnDebug!, session, scene, transferTo, loadMap, sync };
}

describe("__oprnDebug.teleport", () => {
  it("routes a cross-map teleport through the real transfer path without a fade", () => {
    const { debug, session, transferTo, loadMap, sync } = install();
    debug.teleport("map_cave", 4, 7);
    expect(transferTo).toHaveBeenCalledTimes(1);
    expect(transferTo).toHaveBeenCalledWith({ mapId: "map_cave", x: 4, y: 7, fade: "none", direction: "retain" });
    // 화면 쪽 갱신(loadMap·스프라이트·카메라)은 transferTo 몫 — 훅이 따로 loadMap 을 부르지 않는다.
    expect(loadMap).not.toHaveBeenCalled();
    expect(session.currentMapId).toBe("map_cave");
    expect(sync).toHaveBeenCalled();
  });

  it("moves the player sprite and recenters the camera on a same-map teleport without reloading", () => {
    const testWindow = { location: { search: "" } } as HookWindow;
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    const session = startSession(project);
    const positions: Array<[number, number]> = [];
    const scene = {
      events: { once: vi.fn() },
      getMapId: () => session.currentMapId,
      map,
      session,
      transferTo: vi.fn(),
      loadMap: vi.fn(),
      tileX: session.x,
      tileY: session.y,
      moving: true,
      player: { setPosition: (x: number, y: number) => positions.push([x, y]), setDepth: vi.fn(), y: 0 },
      followerSprites: new Map(),
      centerCamera: vi.fn(),
    };
    installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => session as never, vi.fn());
    testWindow.__oprnDebug!.teleport(map.id, 3, 2);
    expect(scene.transferTo).not.toHaveBeenCalled();
    expect(scene.loadMap).not.toHaveBeenCalled();
    expect([scene.tileX, scene.tileY, session.x, session.y]).toEqual([3, 2, 3, 2]);
    expect(positions).toHaveLength(1);
    expect(scene.centerCamera).toHaveBeenCalledTimes(1);
    expect(scene.moving).toBe(false);
  });

  it("keeps same-map teleport as an in-place move", () => {
    const { debug, session, scene, transferTo } = install();
    debug.teleport("map_town", 5, 6);
    expect(transferTo).not.toHaveBeenCalled();
    expect([session.x, session.y, scene.tileX, scene.tileY]).toEqual([5, 6, 5, 6]);
  });
});
