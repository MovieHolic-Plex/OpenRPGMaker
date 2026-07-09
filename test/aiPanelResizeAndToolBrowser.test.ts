// 패널 크기 커스텀 + 툴 브라우저 계약(2026-07-05).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clampPanelSize, loadPanelSize, PANEL_SIZE_LIMITS, renderAiChatPanel, savePanelSize } from "@/editor/panels/aiChatPanel";
import { filterToolCategories, openToolBrowserModal, TOOL_CATEGORIES, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { allTools } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("패널 크기 커스텀", () => {
  it("클램프 범위를 강제하고 저장/복원이 왕복한다", () => {
    expect(clampPanelSize({ width: 100, height: 100 })).toEqual({ width: PANEL_SIZE_LIMITS.minWidth, height: PANEL_SIZE_LIMITS.minHeight });
    expect(clampPanelSize({ width: 5000, height: 5000 })).toEqual({ width: PANEL_SIZE_LIMITS.maxWidth, height: PANEL_SIZE_LIMITS.maxHeight });
    savePanelSize({ width: 480, height: 600 });
    expect(loadPanelSize()).toEqual({ width: 480, height: 600 });
    // 손상된 저장값은 무시.
    storage.set("rpg-zzu:ai-panel-size", "{broken");
    expect(loadPanelSize()).toBeNull();
  });

  it("저장된 크기가 있으면 (떠 있는 모드에서) 패널 인라인 스타일로 적용되고, 리사이즈 핸들이 렌더된다", () => {
    savePanelSize({ width: 500, height: 640 });
    // 커스텀 크기는 떠 있는(비도킹) 모드 전용 — 도킹이 기본값이라 float으로 전환해 확인한다.
    storage.set("rpg-zzu:ai-panel-docked", "0");
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-resize-handle")).toBeTruthy();
    expect(panel.getAttribute("style")).toContain("width:500px");
    expect(panel.getAttribute("style")).toContain("height:640px");
  });
});

describe("툴 브라우저", () => {
  it("카테고리 합계가 레지스트리 전체와 일치한다 — 새 툴 추가 시 브라우저 누락 방지", () => {
    expect(totalToolCount()).toBe(allTools().length);
    const categoryNames = new Set(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name)));
    for (const tool of allTools()) {
      expect(categoryNames.has(tool.name), `브라우저에 누락된 툴: ${tool.name}`).toBe(true);
    }
  });

  it("검색 필터가 이름/설명 부분 일치로 동작한다", () => {
    const byName = filterToolCategories("place_npc");
    expect(byName.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_npc");
    const byDescription = filterToolCategories("울타리");
    expect(byDescription.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("upsert_tile_group");
    expect(filterToolCategories("존재하지않는검색어xyz")).toEqual([]);
  });

  it("모달이 열리고 신규 툴 행이 렌더된다", () => {
    const modal = openToolBrowserModal() as unknown as FakeElement;
    expect(findByTestId(modal, "tool-browser-body")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-row-get_event")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-row-rename_variable")).toBeTruthy();
  });

  it("패널 헤더에 🧰 버튼이 렌더된다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-tools-browser")).toBeTruthy();
  });
});
