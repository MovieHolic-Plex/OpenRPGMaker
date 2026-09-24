import { afterEach, describe, expect, it, vi } from "vitest";
import { installPlaySceneTestHooks } from "@/player/playSceneTestHooks";

// 도그푸딩 2026-09-24 (추리 레인): 런타임 QA 증거 런이 엔딩 → 타이틀 복귀 시점에
// cameraDebug 의 "Cannot read properties of undefined (reading 'centerX')" TypeError 로
// 런 전체(SUMMARY 미작성)가 죽었다. Phaser CameraManager.shutdown() 은 SHUTDOWN 에서
// main 을 undefined 로 비우는데 훅 제거는 그 뒤에 돌도록 등록돼 있어 그 틈에
// __oprnCamera() 를 부르면 죽는다. 훅 계약은 "카메라가 없으면 null" — 실제 소비자
// (runtimeQaRun 의 canvasView/readShadowGeometry)는 이미 null 을 받는 쪽으로 쓴다.

type HookWindow = Window & { __oprnCamera?: () => unknown };

const previousWindow = globalThis.window;
afterEach(() => {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
});

function install(sceneExtra: Record<string, unknown>): void {
  const testWindow = { location: { search: "" } } as HookWindow;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
  const session = { currentMapId: "map_town", x: 1, y: 1, switches: {}, variables: {}, inventory: {}, gold: 0, flags: {}, timers: {} };
  const scene = { events: { once: vi.fn() }, getMapId: () => session.currentMapId, tileX: 1, tileY: 1, ...sceneExtra };
  installPlaySceneTestHooks(
    scene as never,
    { injectActionEdge: vi.fn(), injectAttackEdge: vi.fn(), injectSkillEdge: vi.fn(), injectDirection: vi.fn() } as never,
    () => session as never,
    vi.fn(),
  );
}

describe("cameraDebug — 씬 종료 틈의 관측 계약", () => {
  it("카메라가 이미 비워진 Scene SHUTDOWN 틈에도 __oprnCamera() 는 던지지 않고 null 을 준다", () => {
    install({ cameras: { main: undefined } });
    expect(() => window.__oprnCamera?.()).not.toThrow();
    expect(window.__oprnCamera?.()).toBeNull();
  });

  it("카메라 매니저 자체가 아직 없어도 TypeError 대신 null 을 준다", () => {
    install({});
    expect(window.__oprnCamera?.()).toBeNull();
  });

  it("카메라가 살아 있으면 수치를 그대로 돌려준다", () => {
    const main = { centerX: 1, centerY: 2, height: 3, scrollX: 4, scrollY: 5, width: 6, zoom: 7 };
    install({ cameras: { main } });
    expect(window.__oprnCamera?.()).toEqual({
      centerX: 1, centerY: 2, height: 3, scrollX: 4, scrollY: 5, width: 6, zoom: 7,
    });
  });
});
