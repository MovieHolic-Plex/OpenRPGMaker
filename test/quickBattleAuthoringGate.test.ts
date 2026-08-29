import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const battleMocks = vi.hoisted(() => ({
  createBattleRuntime: vi.fn(() => ({})),
  mountBattleScene: vi.fn(() => ({ destroy: vi.fn() })),
  startSession: vi.fn(() => ({})),
}));

vi.mock("@/battle/runtime", () => ({ createBattleRuntime: battleMocks.createBattleRuntime }));
vi.mock("@/player/battleDom", () => ({ mountBattleScene: battleMocks.mountBattleScene }));
vi.mock("@/project/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/project/session")>(),
  startSession: battleMocks.startSession,
}));

import { troopFields } from "@/editor/panels/databaseBasicRecordFields";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: () => void = () => undefined;
let previousWindow: PropertyDescriptor | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    },
  });
  battleMocks.createBattleRuntime.mockClear();
  battleMocks.mountBattleScene.mockClear();
  battleMocks.startSession.mockClear();
});

afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
  restoreDom();
});

describe("database quick battle launch", () => {
  // 끊긴 참조는 전투 미리보기를 막지 않는다 — 예전 fail-closed 게이트가 이 진입점도 조용히 되돌렸다.
  it("launches a databaseBasicRecordFields quick battle even with broken references", () => {
    const project = createBlankProject();
    const troopId = project.database.troops[0]?.id;
    if (!troopId) throw new Error("blank project must include a troop fixture");
    project.system.startActorIds = ["missing-actor"];
    store.replaceProject(project);
    const form = document.createElement("form");
    troopFields(form, troopId);

    const button = findByTestId(form as unknown as FakeElement, "quick-battle-test-btn");
    if (!button) throw new Error("missing database Quick Battle button");
    const clickHandler = (button as unknown as HTMLButtonElement).onclick;
    if (!clickHandler) throw new Error("Quick Battle button has no click handler");
    clickHandler.call(button as unknown as HTMLButtonElement, new Event("click") as MouseEvent);

    expect(document.querySelector("[data-testid='quick-battle-modal']")).not.toBeNull();
    expect(battleMocks.startSession).toHaveBeenCalled();
    expect(battleMocks.createBattleRuntime).toHaveBeenCalled();
    expect(battleMocks.mountBattleScene).toHaveBeenCalled();
  });
});
