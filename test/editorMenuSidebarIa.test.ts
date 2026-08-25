// 좌측 사이드바 ↔ 상단 메뉴 정보구조(IA) 계약.
//
// 실측 배경(2026-08-26 감사, .omo/evidence/menu-ia/):
//  · 같은 동작이 사이드바와 상단 메뉴 양쪽에 있었다 — 레이어 3개, 되돌리기, 새 맵,
//    현재 맵을 시작 맵으로(라벨까지 동일)가 대표적이다.
//  · standard(기본 모드)의 ⋯ 메뉴는 `.open` 클래스를 붙이지 않아 영구히 열리지 않았고,
//    그 안의 4개 항목은 전부 도구 메뉴와 중복이었다. 항목 두 개는 라벨이 똑같이 "자료"였다.
//  · 음악·찾기는 전문가 클래식 툴바에만 있어서 초보/표준에서는 도달 경로가 없었다.
//  · standard/expert 사이드바에는 레이어 전환이 아예 없었다(초보 레일에만 있었다).
//    레이어 전환은 맵 작업 중 가장 잦은 조작이라 사이드바가 가져야 한다.
//
// 계약: 액션은 집이 하나다. 사이드바 = 매초 쓰는 캔버스 작업, 상단 = 세션/프로젝트 작업.
// Ctrl+K 팔레트는 전체 검색이므로 이 계약의 예외다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const { renderTopbar } = await import("@/editor/panels/menu");
const { renderTilePalette } = await import("@/editor/panels/tilePalette");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;
let previousWindow: unknown;

function fake(node: HTMLElement): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("expected FakeElement");
}

function installBrowserGlobals(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      innerWidth: 1600,
      innerHeight: 1000,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame: (cb: FrameRequestCallback) => { void cb; return 0; },
      scrollTo: vi.fn(),
      getComputedStyle: () => ({ getPropertyValue: () => "" }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
}

/** 상단 영역(메뉴바 + 클래식 툴바 + 열린 팝업)에 존재하는 모든 testid. */
function topRegionTestIds(topbar: HTMLElement): string[] {
  const ids: string[] = [];
  const walk = (node: FakeElement): void => {
    if (node.dataset.testid) ids.push(node.dataset.testid);
    for (const child of node.children) walk(child);
  };
  walk(fake(topbar));
  // 메뉴 팝업은 document.body 로 붙는다.
  for (const child of fake(document.body as unknown as HTMLElement).children) walk(child);
  return ids;
}

function openMenu(topbar: HTMLElement, menuId: string): FakeElement | null {
  const popupId = `menu-popup-${menuId.replace(/^menu-/, "")}`;
  const body = () => fake(document.body as unknown as HTMLElement);
  const trigger = findByTestId(fake(topbar), menuId);
  trigger?.click();
  // menu.ts keeps the open popup in module state that survives across tests, so the first
  // click can toggle a stale popup closed instead of opening this one. Click again in that case.
  if (!findByTestId(body(), popupId)) trigger?.click();
  return findByTestId(body(), popupId);
}

function commandIds(popup: FakeElement | null): string[] {
  return (popup?.children ?? []).map((child) => child.dataset.testid ?? "").filter(Boolean);
}

beforeEach(() => {
  previousWindow = globalThis.window;
  restoreDom = installFakeDom();
  installBrowserGlobals();
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    selectedEventId: null,
  });
});

afterEach(async () => {
  // menu.ts defers its outside-click listener with window.setTimeout(..., 0). That callback
  // touches `document`, so the fake DOM must still be installed when it runs. Draining the
  // task queue first is deterministic: the menu's 0ms callback was queued before this one.
  await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, 0); });
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  resetEditorUiModeForTests("standard");
  vi.restoreAllMocks();
});

/** 사이드바가 소유하는 액션 — 상단 영역 어디에도 나타나면 안 된다. */
const SIDEBAR_OWNED_IDS = [
  "layer-lower",
  "layer-upper",
  "layer-event",
  "menu-tools-layer-lower",
  "menu-tools-layer-upper",
  "menu-tools-layer-event",
  "menu-tools-undo",
  "menu-tools-redo",
  "menu-map",
  "menu-map-new",
  "menu-map-start",
  "menu-map-delete",
  "toolbar-left-panel",
] as const;

describe("좌측 사이드바 ↔ 상단 메뉴 정보구조", () => {
  for (const mode of ["beginner", "standard", "expert"] as const) {
    it(`${mode}: 상단 영역이 사이드바 소유 액션을 중복 노출하지 않는다`, () => {
      // Break: 레이어·되돌리기·맵 트리 동작이 다시 상단 메뉴/툴바로 새어 들어온다.
      resetEditorUiModeForTests(mode);
      const topbar = document.createElement("div");
      renderTopbar(topbar);
      for (const menuId of ["menu-project", "menu-tools", "menu-game", "menu-help"]) {
        if (findByTestId(fake(topbar), menuId)) openMenu(topbar, menuId);
      }

      const ids = topRegionTestIds(topbar);
      const leaked = SIDEBAR_OWNED_IDS.filter((id) => ids.includes(id));
      expect(leaked, `상단에 남은 사이드바 액션: ${leaked.join(", ")}`).toEqual([]);
    });
  }

  it("standard: 열리지 않던 ⋯ 중복 메뉴를 제거한다", () => {
    // Break: `.open` 없이 hidden 만 토글하는 ⋯ 메뉴가 되살아난다.
    resetEditorUiModeForTests("standard");
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    expect(findByTestId(fake(topbar), "standard-more-tools")).toBeNull();
    expect(findByTestId(fake(topbar), "standard-more-tools-menu")).toBeNull();
  });

  for (const mode of ["beginner", "standard", "expert"] as const) {
    it(`${mode}: 편집 모드를 패널 메뉴에서 고를 수 있다`, () => {
      // Break: 모드 전환이 다시 깨진 ⋯ 메뉴나 Ctrl+K 전용 경로로만 남는다.
      resetEditorUiModeForTests(mode);
      const topbar = document.createElement("div");
      renderTopbar(topbar);

      for (const id of ["workspace-ui-mode-beginner", "workspace-ui-mode-standard", "workspace-ui-mode-expert"]) {
        expect(findByTestId(fake(topbar), id), `${mode}/${id}`).not.toBeNull();
      }
    });
  }

  for (const mode of ["beginner", "standard", "expert"] as const) {
    it(`${mode}: 음악·찾기를 도구 메뉴에서 연다`, () => {
      // Break: 음악/찾기가 전문가 클래식 툴바 전용으로 되돌아가 초보·표준에서 사라진다.
      resetEditorUiModeForTests(mode);
      const topbar = document.createElement("div");
      renderTopbar(topbar);

      const ids = commandIds(openMenu(topbar, "menu-tools"));
      expect(ids, `${mode} 도구 메뉴`).toContain("menu-tools-audio");
      expect(ids, `${mode} 도구 메뉴`).toContain("menu-tools-search");
    });
  }

  it("프로젝트 메뉴는 예제 프로젝트를 하위 메뉴로 접고 내보내기 두 종류를 함께 둔다", () => {
    // Break: 데모 로더 9개가 다시 최상위로 펼쳐져 프로젝트 메뉴를 14줄로 만든다.
    resetEditorUiModeForTests("standard");
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    const ids = commandIds(openMenu(topbar, "menu-project"));
    expect(ids).toContain("menu-project-samples");
    expect(ids).toContain("menu-project-export");
    expect(ids).toContain("menu-project-export-web");
    for (const demo of [
      "menu-project-sample-adventure",
      "menu-project-sky-stair",
      "menu-project-training-examples",
      "menu-project-snow-mountain-60",
      "menu-project-ice-plain-64",
      "menu-project-scarloxy-demo",
      "menu-project-scarloxy-pokemon-demo",
      "menu-project-farming-demo",
    ]) {
      expect(ids, `${demo} 는 하위 메뉴 안에 있어야 한다`).not.toContain(demo);
    }
  });

  it("게임 메뉴에서 같은 동작을 하던 시연 실행 항목 중복을 없앤다", () => {
    // Break: menu-game-play 와 menu-game-test-window 가 다시 같은 창을 두 줄로 연다.
    resetEditorUiModeForTests("standard");
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    const ids = commandIds(openMenu(topbar, "menu-game"));
    expect(ids).toContain("menu-game-play");
    expect(ids).not.toContain("menu-game-test-window");
    expect(ids).not.toContain("menu-game-export");
  });

  for (const mode of ["standard", "expert"] as const) {
    it(`${mode}: 사이드바 최상단이 도구 → 레이어 순서다`, () => {
      // Break: 레이어 전환이 다시 사이드바에서 빠져 도구 메뉴로만 남는다.
      resetEditorUiModeForTests(mode);
      const container = document.createElement("div");
      document.body.append(container);
      renderTilePalette(container);

      const switcher = findByTestId(fake(container), "left-layer-switcher");
      expect(switcher, `${mode} 사이드바 레이어 전환`).not.toBeNull();
      for (const id of ["layer-lower", "layer-upper", "layer-event"]) {
        expect(findByTestId(switcher as unknown as FakeElement, id), `${mode}/${id}`).not.toBeNull();
      }

      const pane = findByTestId(fake(container), "palette-work-pane-paint");
      const order = (pane?.children ?? []).map((child) => child.dataset.testid ?? "");
      const toolsAt = order.indexOf("oprn-tile-toolbar");
      const layersAt = order.indexOf("left-layer-switcher");
      expect(toolsAt, "도구 줄이 팔레트 최상단 그룹이어야 한다").toBeGreaterThanOrEqual(0);
      expect(layersAt, "레이어 줄이 도구 바로 다음이어야 한다").toBe(toolsAt + 1);
    });
  }
});
