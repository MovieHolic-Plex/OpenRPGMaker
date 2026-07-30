import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import type { RpgMakerToolbarModel } from "@/editor/panels/rpgMakerTileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type HistoryMeta = {
  readonly index: number;
  readonly label: string;
  readonly mapId: string | null;
  readonly at: number;
  readonly current: boolean;
};

type LintMeta = {
  readonly code: string;
  readonly mapId?: string;
  readonly message: string;
  readonly severity: string;
  readonly x?: number;
  readonly y?: number;
};

const lintMock = vi.hoisted((): { issues: LintMeta[] } => ({
  issues: [],
}));

const historyMock = vi.hoisted((): {
  entries: HistoryMeta[];
  state: { canUndo: boolean; canRedo: boolean };
  undoMapEdit: ReturnType<typeof vi.fn>;
  redoMapEdit: ReturnType<typeof vi.fn>;
  revertToHistoryIndex: ReturnType<typeof vi.fn>;
} => ({
  entries: [],
  state: { canUndo: false, canRedo: false },
  undoMapEdit: vi.fn(() => true),
  redoMapEdit: vi.fn(() => true),
  revertToHistoryIndex: vi.fn(() => true),
}));

vi.mock("@/project/lint/projectLint", () => ({
  projectLint: vi.fn(() => lintMock.issues),
}));

vi.mock("@/editor/mapEditHistory", () => ({
  MAP_EDIT_HISTORY_EVENT: "rpgzzu:map-edit-history-change",
  getMapEditHistoryEntries: () => historyMock.entries,
  getMapEditHistoryState: () => historyMock.state,
  undoMapEdit: historyMock.undoMapEdit,
  redoMapEdit: historyMock.redoMapEdit,
  revertToHistoryIndex: historyMock.revertToHistoryIndex,
}));

import { mapHistoryEntryCount } from "@/editor/panels/mapHistoryPanel";
import { ruleAuditViolationCount } from "@/editor/panels/ruleAuditPanel";
import {
  makeHistoryDropdown,
  makeRuleAuditDropdown,
} from "@/editor/panels/rpgMakerTileToolbarMenus";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  store.replace(project);
  editorState.set({
    activePaletteStamp: null,
    currentMapId: project.startMapId,
    layer: "lower",
    paintShape: "pen",
    selectedTile: 360,
    tool: "paint",
  });
  lintMock.issues = [];
  historyMock.entries = [];
  historyMock.state = { canUndo: false, canRedo: false };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: vi.fn(),
      confirm: vi.fn(() => true),
      dispatchEvent: vi.fn(() => true),
      removeEventListener: vi.fn(),
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "window");
});

function toolbarModel(rerender = vi.fn()): RpgMakerToolbarModel {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("missing start tileset");
  return { map, rerender, state: editorState.get(), tileset };
}

function renderRuleDropdown(): FakeElement {
  return renderWithFakeDom(() => makeRuleAuditDropdown(toolbarModel()));
}

function renderHistoryDropdown(): FakeElement {
  return renderWithFakeDom(() => makeHistoryDropdown(toolbarModel()));
}

function openRuleDropdown(): FakeElement {
  const current = renderRuleDropdown();
  if (findByTestId(current, "rule-audit-panel")) return current;
  findByTestId(current, "toolbar-toggle-ruleAudit")?.click();
  return renderRuleDropdown();
}

function openHistoryDropdown(): FakeElement {
  const current = renderHistoryDropdown();
  if (findByTestId(current, "map-history-panel")) return current;
  findByTestId(current, "toolbar-toggle-history")?.click();
  return renderHistoryDropdown();
}

describe("인스펙터 옆 규칙 감사/작업 기록 배지", () => {
  it("규칙 감사와 작업 기록 카운트를 상태에서 계산한다", () => {
    lintMock.issues = [
      { code: "cluster-rule-count", message: "꽃 과밀", severity: "info" },
      { code: "cluster-rule-spacing", message: "창문 간격", severity: "warning" },
      { code: "transfer-bounds", message: "무시", severity: "error" },
    ];
    historyMock.entries = [
      { index: 0, label: "타일 편집", mapId: store.getCurrent().startMapId, at: 0, current: false },
      { index: 1, label: "AI: 집 건설", mapId: store.getCurrent().startMapId, at: 1, current: true },
    ];

    expect(ruleAuditViolationCount()).toBe(2);
    expect(mapHistoryEntryCount()).toBe(2);
  });

  it("카운트가 있으면 토글에 숫자 배지를 렌더하고 0이면 숨긴다", () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "꽃 과밀", severity: "info" }];
    historyMock.entries = [{ index: 0, label: "타일 편집", mapId: store.getCurrent().startMapId, at: 0, current: true }];

    const rule = renderRuleDropdown();
    const history = renderHistoryDropdown();

    expect(findByTestId(rule, "toolbar-toggle-ruleAudit")).toBeTruthy();
    expect(findByTestId(rule, "rule-audit-badge")?.textContent).toBe("1");
    expect(findByTestId(history, "toolbar-toggle-history")).toBeTruthy();
    expect(findByTestId(history, "history-badge")?.textContent).toBe("1");

    lintMock.issues = [];
    historyMock.entries = [];

    expect(findByTestId(renderRuleDropdown(), "rule-audit-badge")).toBeNull();
    expect(findByTestId(renderHistoryDropdown(), "history-badge")).toBeNull();
  });

  it("토글을 열면 드롭다운에 규칙 감사와 작업 기록 패널 내용을 넣는다", () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "꽃 과밀", severity: "info" }];
    historyMock.entries = [{ index: 0, label: "타일 편집", mapId: store.getCurrent().startMapId, at: 0, current: true }];

    const rule = openRuleDropdown();
    const history = openHistoryDropdown();

    expect(findByTestId(rule, "tile-rule-audit-menu")).toBeTruthy();
    expect(findByTestId(rule, "rule-audit-panel")?.textContent).toContain("꽃 과밀");
    expect(findByTestId(history, "tile-history-menu")).toBeTruthy();
    expect(findByTestId(history, "map-history-panel")?.textContent).toContain("타일 편집");
  });

  it("하나를 열면 다른 드롭다운은 닫힌다", () => {
    lintMock.issues = [{ code: "cluster-rule-count", message: "꽃 과밀", severity: "info" }];
    historyMock.entries = [{ index: 0, label: "타일 편집", mapId: store.getCurrent().startMapId, at: 0, current: true }];

    expect(findByTestId(openRuleDropdown(), "rule-audit-panel")).toBeTruthy();
    expect(findByTestId(renderHistoryDropdown(), "map-history-panel")).toBeNull();

    findByTestId(renderHistoryDropdown(), "toolbar-toggle-history")?.click();

    expect(findByTestId(renderRuleDropdown(), "rule-audit-panel")).toBeNull();
    expect(findByTestId(renderHistoryDropdown(), "map-history-panel")).toBeTruthy();
  });
});
