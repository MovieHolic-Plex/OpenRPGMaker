import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { pickRandomTroopId } from "@/editor/panels/testPlayModal";
import { store } from "@/project/store";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";

// menu.ts 는 트리 모듈 그래프를 지나므로 변환에 수십 초가 들열 수 있다. 함수 새로 동적
// import 하면 그 시간이 **테스트 타이아웃**에 공제되어 상황에 다른 결과가 난다(이 테스트는
// 생생한 워키트리에서 30s 타임아웃으로 죽었다). 모듈 스코프에서 한 번 지나게 해 변환을
// collect 단계로 넘긴다 — 다른 헤더 테스트(editorMenuSidebarIa · editorHeaderTerminology)와 같은 패턴이다.
const { renderTopbar, RETIRED_TOPBAR_CONTROLS } = await import("@/editor/panels/menu");
const { listEditorCommands } = await import("@/editor/commandRegistry");

describe("pickRandomTroopId", () => {
  it("picks only troops that have members/enemies", () => {
    const project = createBlankProject();
    const withMembers = project.database.troops.filter(
      (t) => (t.members?.length ?? 0) > 0 || (t.enemyIds?.length ?? 0) > 0
    );
    expect(withMembers.length).toBeGreaterThan(0);

    const fixed = pickRandomTroopId(project, () => 0);
    expect(fixed).toBe(withMembers[0]?.id);

    const last = pickRandomTroopId(project, () => 0.999);
    expect(last).toBe(withMembers[withMembers.length - 1]?.id);
  });

  it("falls back to initialTroopId when every troop is empty", () => {
    const project = createBlankProject();
    for (const troop of project.database.troops) {
      troop.members = [];
      troop.enemyIds = [];
    }
    project.system.initialTroopId = "troop_fallback";
    project.database.troops.push({
      id: "troop_fallback",
      name: "Fallback",
      enemyIds: [],
      members: [],
      autoAlign: true,
      uncapturable: false,
      battleEventPages: [],
    });
    expect(pickRandomTroopId(project, () => 0.5)).toBe("troop_fallback");
  });
});

describe("topbar random battle button", () => {
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    previousWindow = globalThis.window;
    const listeners = new Map<string, Set<EventListener>>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener(type: string, listener: EventListener): void {
          const set = listeners.get(type) ?? new Set();
          set.add(listener);
          listeners.set(type, set);
        },
        removeEventListener(type: string, listener: EventListener): void {
          listeners.get(type)?.delete(listener);
        },
        dispatchEvent(event: Event): boolean {
          const type = event.type;
          for (const listener of listeners.get(type) ?? []) listener.call(globalThis, event);
          return true;
        },
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
      },
    });
    store.replace(createBlankProject());
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    restoreDom?.();
    restoreDom = undefined;
  });

  it("dispatches random-battle detail from the ⌘K battle-test command and the retired topbar button", () => {
    // Break: the battle-test shortcut loses its only home when the topbar button moved to ⌘K (2026-11).
    const topbar = document.createElement("div") as unknown as FakeElement;
    document.body.append(topbar as unknown as Node);

    const events: CustomEvent[] = [];
    const handler = (event: Event): void => {
      events.push(event as CustomEvent);
    };
    window.addEventListener("oprn:test-play-window", handler);

    renderTopbar(topbar as unknown as HTMLElement);
    expect(findByTestId(topbar, "topbar-battle-test"), "톱바에는 단추가 없다").toBeNull();
    const command = listEditorCommands().find((entry) => entry.id === "topbar-battle-test");
    expect(command?.label).toBe("화면: 랜덤 전투 테스트");
    command?.run();
    // 보관된 단추(되살릴 때 쓰는 것)도 같은 이벤트를 보낸다.
    (RETIRED_TOPBAR_CONTROLS.battleTest() as unknown as FakeElement).click();

    expect(events).toHaveLength(2);
    expect(events[0]?.detail).toEqual({ kind: "random-battle" });
    expect(events[1]?.detail).toEqual({ kind: "random-battle" });
    window.removeEventListener("oprn:test-play-window", handler);
  });
});
