import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

// 배치 A: P1 그리드 붕괴 재발 방지 — CSS는 :nth-child 대신 각 패널의 명시 클래스를
// grid-area 로 매핑한다(03-class-panels.css / enemies.part-*.css). 패널이 추가되거나
// 순서가 바뀌어도 "패널 수 == 클래스 부여 수"가 어긋나는 순간 이 테스트가 즉시 잡아낸다.

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
  resetDatabaseRecordViewSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

function restoreBrowserGlobal<Key extends keyof FakeBrowserGlobals>(key: Key, value: FakeBrowserGlobals[Key]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
  const host = document.createElement("div");
  renderRecordTab(host, collection, () => undefined);
  if (host instanceof FakeElement) return host;
  throw new Error("Expected fake database host");
}

function panelGridClasses(panel: FakeElement, prefix: string): string[] {
  return panel.className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.startsWith(prefix));
}

describe("Database record panel grid-area classes (P1 재발 방지)", () => {
  it("gives every classes-tab panel exactly one db-class-panel-* class, no duplicates", () => {
    const host = renderRecordHost("classes");
    const panels = host.querySelectorAll(".db-advanced-panel");

    expect(panels.length).toBe(11);

    const assigned = panels.map((panel) => panelGridClasses(panel, "db-class-panel-"));
    expect(assigned.every((classes) => classes.length === 1)).toBe(true);

    const names = assigned.map((classes) => classes[0]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "db-class-panel-name",
      "db-class-panel-animation",
      "db-class-panel-curves",
      "db-class-panel-exp",
      "db-class-panel-commands",
      "db-class-panel-options",
      "db-class-panel-skills",
      "db-class-panel-promotion",
      "db-class-panel-state",
      "db-class-panel-element",
      "db-class-panel-equipment",
    ]);
  });

  it("gives every enemies-tab panel exactly one db-enemy-panel-* class, no duplicates", () => {
    const host = renderRecordHost("enemies");
    const panels = host.querySelectorAll(".db-advanced-panel");

    // "액션 전투" 패널(db-enemy-panel-action-combat)이 뒤늦게 추가되면서 11 개가 됐는데
    // 이 기대값만 10 에 멈춰 있어 계속 빨간불이었다. 소스가 맞다 — studio-theme.css:339
    // 의 area 맵에 `combat` 행이 있고 :353 이 그 패널에 grid-area 를 준다. 기대값을
    // 실제 배치 순서에 맞춘다.
    expect(panels.length).toBe(11);

    const assigned = panels.map((panel) => panelGridClasses(panel, "db-enemy-panel-"));
    expect(assigned.every((classes) => classes.length === 1)).toBe(true);

    const names = assigned.map((classes) => classes[0]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      "db-enemy-panel-name",
      "db-enemy-panel-stats",
      "db-enemy-panel-graphic",
      "db-enemy-panel-species",
      "db-enemy-panel-rewards",
      "db-enemy-panel-critical",
      "db-enemy-panel-options",
      "db-enemy-panel-action-combat",
      "db-enemy-panel-state",
      "db-enemy-panel-element",
      "db-enemy-panel-actions",
    ]));
  });

  it("marks the equipment graphic panel with db-panel-equipment-graphic so the icon 설정 button can be styled/clicked", () => {
    const host = renderRecordHost("equipment");
    const panels = host.querySelectorAll(".db-advanced-panel");

    expect(panels.length).toBeGreaterThan(0);

    const graphicPanels = panels.filter((panel) => panel.classList.contains("db-panel-equipment-graphic"));
    expect(graphicPanels).toHaveLength(1);
    expect(graphicPanels[0]?.querySelector("[data-testid='db-field-equipment-icon-resource']")).not.toBeNull();
  });
});
