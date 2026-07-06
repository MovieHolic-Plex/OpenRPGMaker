import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { installRuleAuditPanelAutoMount, renderRuleAuditPanel } from "@/editor/panels/ruleAuditPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

type TestMutationObserverCallback = (records: MutationRecord[], observer: MutationObserver) => void;

const lintMock = vi.hoisted(() => ({
  issues: [] as {
    readonly code: string;
    readonly mapId?: string;
    readonly message: string;
    readonly severity: string;
    readonly x?: number;
    readonly y?: number;
  }[],
}));

vi.mock("@/project/lint/projectLint", () => ({
  projectLint: vi.fn(() => lintMock.issues),
}));

let restoreDom: (() => void) | null = null;
let listeners: Map<string, EventListener[]>;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  lintMock.issues = [];
  listeners = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "MutationObserver");
});

describe("규칙 감사 패널", () => {
  it("cluster-rule issue를 강도별 문구와 색상 클래스로 렌더한다", () => {
    lintMock.issues = [
      { code: "cluster-rule-adjacency", mapId: "map_1", message: "지붕 아래에는 벽", severity: "error", x: 3, y: 4 },
      { code: "cluster-rule-adjacency", mapId: "map_1", message: "지붕 아래에는 벽", severity: "error", x: 5, y: 4 },
      { code: "cluster-rule-spacing", message: "창문 간격 2칸", severity: "warning" },
      { code: "cluster-rule-count", message: "꽃 과밀", severity: "info" },
      { code: "transfer-bounds", message: "무시", severity: "error" },
    ];

    const panel = renderRuleAuditPanel();
    const items = panel.querySelectorAll('[data-testid="rule-audit-item"]');

    expect(items).toHaveLength(3);
    expect(items[0]?.className).toContain("is-hard");
    expect(items[0]?.textContent).toContain("반드시");
    expect(items[0]?.textContent).toContain("위반 2건");
    expect(items[0]?.textContent).toContain("map_1 (3, 4)");
    expect(items[1]?.className).toContain("is-medium");
    expect(items[1]?.textContent).toContain("권장");
    expect(items[2]?.className).toContain("is-soft");
    expect(items[2]?.textContent).toContain("참고");
  });

  it("위반이 없으면 없음 문구를 렌더한다", () => {
    const panel = renderRuleAuditPanel();

    expect(panel.textContent).toContain("규칙 위반 없음");
    expect(panel.querySelector('[data-testid="rule-audit-item"]')).toBeNull();
  });

  it("left-palette-root 재렌더 뒤에도 MutationObserver로 다시 마운트한다", async () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "꽃 과밀", severity: "info" }];
    const observerState: { callback?: TestMutationObserverCallback; observer?: MutationObserver } = {};
    class TestMutationObserver implements MutationObserver {
      constructor(callback: TestMutationObserverCallback) {
        observerState.callback = callback;
        observerState.observer = this;
      }

      disconnect(): void {
      }

      observe(): void {
      }

      takeRecords(): MutationRecord[] {
        return [];
      }
    }
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: TestMutationObserver,
    });
    const root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);

    installRuleAuditPanelAutoMount();
    await Promise.resolve();

    expect(root.querySelector('[data-testid="rule-audit-panel"]')).toBeTruthy();
    root.replaceChildren();
    expect(root.querySelector('[data-testid="rule-audit-panel"]')).toBeNull();
    const observer = observerState.observer;
    const observerCallback = observerState.callback;
    if (!observer || !observerCallback) throw new Error("rule audit observer was not installed");

    observerCallback([], observer);
    window.dispatchEvent(new Event(MAP_EDIT_HISTORY_EVENT));

    expect(root.querySelector('[data-testid="rule-audit-panel"]')?.textContent).toContain("꽃 과밀");
  });
});
