import { describe, expect, it, vi } from "vitest";
import * as debug from "@/testing/debugSession";
import { installPlaySceneTestHooks, type RuntimeDebugHook } from "@/player/playSceneTestHooks";
import { startSession } from "@/project/session";
import { createEmberQuestProject, EMBER_SWITCH, EMBER_ITEM, EMBER_MAP } from "@/project/defaults/emberQuestGame";

// Imports belong to collection, not the first operation's deadline. These tests
// exercise synchronous authorities; no test should race cold module loading.

describe("debugSession — 런타임 디버그 조작", () => {
  it("applyDebugOp가 스위치/변수/아이템/골드/텔레포트를 반영한다", () => {
    const session = startSession(createEmberQuestProject());

    debug.applyDebugOp(session, { kind: "setSwitch", switchId: EMBER_SWITCH.q1Started, value: true });
    debug.applyDebugOp(session, { kind: "setVariable", variableId: "var_ember_moon_herbs", value: 3 });
    debug.applyDebugOp(session, { kind: "giveItem", itemId: EMBER_ITEM.oldKey, amount: 2 });
    debug.applyDebugOp(session, { kind: "setGold", amount: 999 });
    debug.applyDebugOp(session, { kind: "teleport", mapId: EMBER_MAP.mine, x: 5, y: 6 });

    expect(session.switches[EMBER_SWITCH.q1Started]).toBe(true);
    expect(session.variables["var_ember_moon_herbs"]).toBe(3);
    expect(session.inventory[EMBER_ITEM.oldKey]).toBe(2);
    expect(session.gold).toBe(999);
    expect(session.currentMapId).toBe(EMBER_MAP.mine);
    expect(session.x).toBe(5);
    expect(session.y).toBe(6);
  });

  it("applyStatePreset가 지정 키만 부분 적용한다", () => {
    const session = startSession(createEmberQuestProject());
    const goldBefore = session.gold;

    debug.applyStatePreset(session, {
      id: "p1",
      name: "테스트 프리셋",
      switches: { [EMBER_SWITCH.q1Started]: true, [EMBER_SWITCH.q1Clear]: true },
    });

    expect(session.switches[EMBER_SWITCH.q1Started]).toBe(true);
    expect(session.switches[EMBER_SWITCH.q1Clear]).toBe(true);
    // gold 미지정 → 변경되지 않아야 한다.
    expect(session.gold).toBe(goldBefore);
  });

  it("testHerePreset가 시작 좌표 오버라이드 프리셋을 만든다", () => {
    const session = startSession(createEmberQuestProject());
    debug.applyStatePreset(session, debug.testHerePreset(EMBER_MAP.pass, 8, 9));
    expect(session.currentMapId).toBe(EMBER_MAP.pass);
    expect(session.x).toBe(8);
    expect(session.y).toBe(9);
  });

  it("PlayScene 테스트 훅은 세션 교체 후 라이브 세션을 읽고 쓴다", () => {
    const previousWindow = globalThis.window;
    const testWindow = { location: { search: "" } } as Window & { __oprnDebug?: RuntimeDebugHook };
    const project = createEmberQuestProject();
    const originalSession = startSession(project);
    let liveSession = originalSession;
    let syncCount = 0;

    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: testWindow,
      });

      installPlaySceneTestHooks(
        { events: { once: vi.fn() } } as never,
        { injectActionEdge: vi.fn(), injectDirection: vi.fn() } as never,
        () => liveSession,
        () => {
          syncCount += 1;
        }
      );

      const restoredSession = startSession(project);
      restoredSession.currentMapId = EMBER_MAP.forest;
      restoredSession.x = 2;
      restoredSession.y = 14;
      liveSession = restoredSession;

      expect(testWindow.__oprnDebug?.readState().currentMapId).toBe(EMBER_MAP.forest);

      testWindow.__oprnDebug?.setSwitch(EMBER_SWITCH.q1Started, true);

      expect(restoredSession.switches[EMBER_SWITCH.q1Started]).toBe(true);
      expect(originalSession.switches[EMBER_SWITCH.q1Started]).toBe(false);
      expect(syncCount).toBe(1);
    } finally {
      restoreWindow(previousWindow);
    }
  });
});

function restoreWindow(previousWindow: Window & typeof globalThis | undefined): void {
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: previousWindow,
  });
}
