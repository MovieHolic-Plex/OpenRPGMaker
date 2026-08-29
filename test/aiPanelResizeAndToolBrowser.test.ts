// 툴 브라우저 계약.
//
// 「패널 크기 커스텀」과 「사이드 도크 폭 1/3」 두 describe 는 2026-08-29 조수 띠에서
// 삭제됐다 — 리사이즈 핸들과 도크가 없어지면서 `clampPanelSize` · `computeSideChatWidth`
// 자체가 사라졌다. 띠 폭은 CSS 가 정한다(`min(640px, calc(100vw - 96px))`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
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

  // 진입점은 숨은 툴바의 🧰(`ai-tools-browser`)에서 컴포저 ☰ 항목으로 옮겼다.
  // 그 툴바는 `hidden` + `inert` + CSS `:not(.is-empty)` 요구가 겹쳐 영구히 도달 불가였다.
  it("컴포저 ☰ 에 툴 브라우저 항목이 있다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-command-menu-tools")).toBeTruthy();
    expect(findByTestId(panel, "ai-tools-browser")).toBeNull();
  });
});
