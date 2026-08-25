import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { pickRandomTroopId } from "@/editor/panels/testPlayModal";
import { store } from "@/project/store";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";

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

  it("dispatches random-battle detail from the restored topbar button", async () => {
    // Break: bottom-bar cleanup removes the unrelated topbar battle shortcut.
    const { renderTopbar } = await import("@/editor/panels/menu");
    const topbar = document.createElement("div") as unknown as FakeElement;
    document.body.append(topbar as unknown as Node);

    const events: CustomEvent[] = [];
    const handler = (event: Event): void => {
      events.push(event as CustomEvent);
    };
    window.addEventListener("oprn:test-play-window", handler);

    renderTopbar(topbar as unknown as HTMLElement);
    const button = findByTestId(topbar, "topbar-battle-test");
    expect(button).toBeTruthy();
    button?.click();

    expect(events).toHaveLength(1);
    expect(events[0]?.detail).toEqual({ kind: "random-battle" });
    window.removeEventListener("oprn:test-play-window", handler);
  }, 30_000);
});
