import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { installRuleAuditPanelAutoMount, renderRuleAuditPanel, ruleAuditViolationCount } from "@/editor/panels/ruleAuditPanel";
import { clusterRuleLintIssues } from "@/project/lint/clusterRuleLint";
import { projectLint } from "@/project/lint/projectLint";
import { editorState } from "@/editor/editorState";
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

// 규칙 감사는 cluster-rule 만 보는 clusterRuleLintIssues 를 쓴다. projectLint 는 전체 왕복 lint 라
// 호출되면 안 된다 — 빈 목록 대역으로 두고 호출 여부만 본다.
vi.mock("@/project/lint/projectLint", () => ({
  projectLint: vi.fn(() => []),
}));
vi.mock("@/project/lint/clusterRuleLint", () => ({
  clusterRuleLintIssues: vi.fn(() => lintMock.issues),
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
  it("reuses project diagnostics for navigation and refreshes them after edits", () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "위반", severity: "info" }];
    expect(ruleAuditViolationCount()).toBe(1);
    const calls = vi.mocked(clusterRuleLintIssues).mock.calls.length;
    editorState.set({ currentMapId: "other-map" });
    expect(ruleAuditViolationCount()).toBe(1);
    renderRuleAuditPanel();
    expect(vi.mocked(clusterRuleLintIssues).mock.calls.length).toBe(calls);
    lintMock.issues = [];
    store.update(project => { project.meta.title = "changed"; });
    expect(ruleAuditViolationCount()).toBe(0);
    expect(vi.mocked(clusterRuleLintIssues).mock.calls.length).toBe(calls + 1);
  });

  // 칠하기 드래그 렉(2026-09-23): 배지·패널이 cluster-rule 몇 건을 세려고 projectLint 전체를 돌렸다.
  // 그 안의 직렬화 왕복이 100×100 마을에서 ~800ms 라, 드래그 중 250ms 마다 메인 스레드가 섰다.
  it("전체 projectLint(직렬화 왕복)를 돌리지 않고 cluster-rule 진단만 계산한다", () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "위반", severity: "info" }];
    vi.mocked(projectLint).mockClear();
    store.update(project => { project.meta.title = "paint burst"; });

    expect(ruleAuditViolationCount()).toBe(1);
    renderRuleAuditPanel();

    expect(vi.mocked(projectLint)).not.toHaveBeenCalled();
  });

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
