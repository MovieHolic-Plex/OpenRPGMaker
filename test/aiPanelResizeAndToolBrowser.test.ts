// 패널 크기 커스텀 + 툴 브라우저 계약(2026-07-05).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clampPanelSize, loadPanelSize, PANEL_SIZE_LIMITS, renderAiChatPanel, savePanelSize } from "@/editor/panels/aiChatPanel";
import { filterToolCategories, openToolBrowserModal, TOOL_CATEGORIES, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { activeTools } from "@/editor/tools";
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

// 삭제(2026-08-31): describe("사이드 도크 폭 (1/3)") 2케이스 — `computeSideChatWidth` /
// `resolveSideChatWidth` / `SIDE_CHAT_WIDTH` 가 사이드 도크와 함께 삭제됐다. 캔버스는 항상
// 전폭이고 `--ai-chat-side-width` 는 영구 0px 다.
describe("패널 크기 커스텀", () => {
  // 삭제: "저장된 크기가 있으면 유리 카드에 인라인 크기로 적용되고, 리사이즈 핸들이 렌더된다" —
  // 패널 인라인 크기는 삭제된 계약이다. 저장 폭 적용·핸들 렌더는 test/aiPanelGlassResize.test.ts
  // 가 새 표면(컴포저 캡슐의 `--ai-float-bar-width`)으로 덮는다.
  it("클램프 범위를 강제하고 저장/복원이 왕복한다", () => {
    expect(clampPanelSize({ width: 100, height: 100 })).toEqual({ width: PANEL_SIZE_LIMITS.minWidth, height: PANEL_SIZE_LIMITS.minHeight });
    expect(clampPanelSize({ width: 5000, height: 5000 })).toEqual({ width: PANEL_SIZE_LIMITS.maxWidth, height: PANEL_SIZE_LIMITS.maxHeight });
    savePanelSize({ width: 480, height: 600 });
    expect(loadPanelSize()).toEqual({ width: 480, height: 600 });
    // 손상된 저장값은 무시.
    storage.set("oprn:ai-panel-size", "{broken");
    expect(loadPanelSize()).toBeNull();
  });
});

describe("툴 브라우저", () => {
  it("카테고리 합계가 활성 툴과 일치한다 — deprecated 레거시는 브라우저 숨김", () => {
    expect(totalToolCount()).toBe(activeTools().length);
    const categoryNames = new Set(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name)));
    for (const tool of activeTools()) {
      expect(categoryNames.has(tool.name), `브라우저에 누락된 활성 툴: ${tool.name}`).toBe(true);
    }
  });

  it("검색 필터가 이름/설명 부분 일치로 동작한다", () => {
    const byName = filterToolCategories("place_npc");
    expect(byName.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_npc");
    const byDescription = filterToolCategories("소품");
    expect(byDescription.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("place_props");
    expect(filterToolCategories("존재하지않는검색어xyz")).toEqual([]);
  });

  it("첫 화면은 자주 쓰는 툴 + 검색 진입이며 전체 목록은 확장으로 연다", () => {
    const modal = openToolBrowserModal() as unknown as FakeElement;
    expect(findByTestId(modal, "tool-browser-body")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-search")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-frequent")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-show-all")).toBeTruthy();
    // 전체 덤프가 첫 페인트에 깔리지 않는다
    expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeNull();
    findByTestId(modal, "tool-browser-show-all")?.click();
    expect(findByTestId(modal, "tool-browser-row-remove_map")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-row-get_event")).toBeTruthy();
    expect(findByTestId(modal, "tool-browser-row-rename_variable")).toBeTruthy();
  });

  it("패널 헤더에 🧰 버튼이 렌더된다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-tools-browser")).toBeTruthy();
  });
});
