// 좌측 사이드바 ↔ 상단 메뉴 정보구조(IA) 계약.
//
// 실측 배경(2026-08-26 감사, .omo/evidence/menu-ia/):
//  · 같은 동작이 사이드바와 상단 메뉴 양쪽에 있었다 — 레이어 3개, 되돌리기, 새 맵,
//    현재 맵을 시작 맵으로(라벨까지 동일)가 대표적이다.
//  · 당시 standard 모드의 ⋯ 메뉴는 `.open` 클래스를 붙이지 않아 영구히 열리지 않았고,
//    그 안의 4개 항목은 전부 도구 메뉴와 중복이었다. 항목 두 개는 라벨이 똑같이 "자료"였다.
//  · 음악·찾기는 전문가 클래식 툴바에만 있어서 다른 모드에서는 도달 경로가 없었다.
//  · 레이어 전환은 초보 레일에만 있었다. 2026-09-27 편집 모드를 걷어 화면은 하나다.
//    2026-09-18 레이어 전환은 팔레트와 독립적인 캔버스 상단으로 옮겼다.
//
// 계약: 액션은 집이 하나다. 사이드바 = 매초 쓰는 캔버스 작업, 상단 = 세션/프로젝트 작업.
// Ctrl+K 팔레트는 전체 검색이므로 이 계약의 예외다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
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
/**
 * 코드가 쓰는 시계는 테스트가 넘겨준 fake window 의 것이다. tilePalette 는 스크롤 복원을
 * `window.setTimeout(restore, 50)` 로 미루는데, 그 콜백은 fake DOM 이 해체된 뒤에 깨어나
 * `document` 를 만지며 터진다. 대기 시간으로 얼버무리지 않고 넘겨준 타이머를 직접 취소한다.
 */
let pendingTimers: ReturnType<typeof globalThis.setTimeout>[] = [];

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
      setTimeout: ((handler: TimerHandler, timeout?: number) => {
        const handle = globalThis.setTimeout(handler as () => void, timeout);
        pendingTimers.push(handle);
        return handle;
      }) as typeof globalThis.setTimeout,
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
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

afterEach(() => {
  for (const handle of pendingTimers) globalThis.clearTimeout(handle);
  pendingTimers = [];
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

/** 사이드바가 소유하는 액션 — 상단 영역 어디에도 나타나면 안 된다. */
const SIDEBAR_OWNED_IDS = [
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
  it("상단 영역이 사이드바 소유 액션을 중복 노출하지 않는다", () => {
    // Break: 레이어·되돌리기·맵 트리 동작이 다시 상단 메뉴/툴바로 새어 들어온다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);
    for (const menuId of ["menu-project", "menu-help"]) {
      if (findByTestId(fake(topbar), menuId)) openMenu(topbar, menuId);
    }

    const ids = topRegionTestIds(topbar);
    const leaked = SIDEBAR_OWNED_IDS.filter((id) => ids.includes(id));
    expect(leaked, `상단에 남은 사이드바 액션: ${leaked.join(", ")}`).toEqual([]);
  });

  it("열리지 않던 ⋯ 중복 메뉴를 제거한다", () => {
    // Break: `.open` 없이 hidden 만 토글하는 ⋯ 메뉴가 되살아난다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    expect(findByTestId(fake(topbar), "standard-more-tools")).toBeNull();
    expect(findByTestId(fake(topbar), "standard-more-tools-menu")).toBeNull();
  });

  it("편집 모드 선택지가 없다", () => {
    // Break: 2026-09-27 걷어 낸 초보/표준/전문가 라디오가 보기 메뉴에 되살아난다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    for (const id of ["workspace-ui-mode-beginner", "workspace-ui-mode-standard", "workspace-ui-mode-expert"]) {
      expect(findByTestId(fake(topbar), id), id).toBeNull();
    }
  });

  it("세계관·음악·찾기는 인라인 아이콘 버튼이고 도구 메뉴는 없다", () => {
    // Break: 「도구 ▾」 메뉴가 되살아나 인라인 버튼과 같은 동작을 두 자리에 놓는다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    for (const id of ["toolbar-world", "toolbar-sound-test", "toolbar-search"]) {
      expect(findByTestId(fake(topbar), id), id).not.toBeNull();
    }
    expect(findByTestId(fake(topbar), "menu-tools")).toBeNull();
  });

  it("자료집·소재는 톱바 버튼이 집이다", () => {
    // Break: 자료집이 다시 버튼과 메뉴 항목 두 자리에 놓인다(2026-09-03 이전의 3중 진입점).
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    expect(findByTestId(fake(topbar), "toolbar-database")).not.toBeNull();
    expect(findByTestId(fake(topbar), "toolbar-resource-manager")).not.toBeNull();
    // 클래식 툴바 행과 작업 칩은 없다 — 복제 표면이었다.
    for (const gone of ["oprn-toolbar", "toolbar-new", "toolbar-map-copy", "authoring-task-launcher", "authoring-task-data", "window-toolbar-collapse"]) {
      expect(findByTestId(fake(topbar), gone), gone).toBeNull();
    }
  });

  it("프로젝트 메뉴는 예제 프로젝트를 하위 메뉴로 접고 내보내기 두 종류를 함께 둔다", () => {
    // Break: 데모 로더 9개가 다시 최상위로 펼쳐져 프로젝트 메뉴를 14줄로 만든다.
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

  it("게임 메뉴는 없다 — 테스트 실행·전투 테스트는 오른쪽 버튼이 유일한 집이다", () => {
    // Break: 게임 메뉴가 되살아나 ▶ 테스트·⚔ 와 같은 창을 두 번째 자리에서 연다
    // (2026-09-03 이전에는 테스트 실행의 집이 작업 칩·▶ 버튼·게임 메뉴·클래식 툴바 넷이었다).
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    expect(findByTestId(fake(topbar), "menu-game")).toBeNull();
    expect(findByTestId(fake(topbar), "mode-play")).not.toBeNull();
    expect(findByTestId(fake(topbar), "topbar-battle-test")).not.toBeNull();
    const ids = topRegionTestIds(topbar);
    expect(ids.filter((id) => id === "mode-play")).toHaveLength(1);
    expect(ids.filter((id) => id === "topbar-battle-test")).toHaveLength(1);
  });

  it("예제 하위 메뉴도 Escape 로 닫힌다", () => {
    // Break: 하위 메뉴를 여는 사이 항목 버튼이 DOM 에서 사라지며 포서스가 러지고,
    // Escape 핸들러가 팝업/트리거 포서스에만 달려 있으면 닫힐 방법이 사라진다.
    // 그 상태에서 팝업은 트리거 자리(증 상단 왼쪽)에 떠 있어 사이드바를 가린다.
    const topbar = document.createElement("div");
    renderTopbar(topbar);

    const body = () => fake(document.body as unknown as HTMLElement);
    const projectPopup = openMenu(topbar, "menu-project");
    expect(projectPopup).not.toBeNull();
    findByTestId(body(), "menu-project-samples")?.click();
    expect(findByTestId(body(), "menu-popup-project-samples"), "하위 메뉴가 열려야 한다").not.toBeNull();

    const escape = new Event("keydown") as Event & { key?: string };
    Object.defineProperty(escape, "key", { value: "Escape" });
    document.dispatchEvent(escape);

    expect(findByTestId(body(), "menu-popup-project-samples"), "Escape 가 하위 메뉴를 닫아야 한다").toBeNull();
  });

  {
    const mode = "default";
    it("레이어는 앱 헤더에, 맵과 도구는 팔레트에 둔다", () => {
      // 팔레트를 접어도 소재 옆 헤더에서 레이어를 전환할 수 있어야 한다.
      const container = document.createElement("div");
      document.body.append(container);
      renderTilePalette(container);

      expect(findByTestId(fake(container), "left-layer-switcher")).toBeNull();
      const header = document.createElement("div");
      document.body.append(header);
      renderTopbar(header);
      const switcher = findByTestId(fake(header), "left-layer-switcher");
      expect(switcher, `${mode} 헤더 레이어 전환`).not.toBeNull();
      for (const id of ["layer-lower", "layer-upper", "layer-event"]) {
        expect(findByTestId(switcher as unknown as FakeElement, id), `${mode}/${id}`).not.toBeNull();
      }

      const lead = findByTestId(fake(header), "studio-bar-lead");
      const headerOrder = (lead?.children ?? []).map(child => child.dataset.testid);
      expect(headerOrder.indexOf("left-layer-switcher")).toBe(headerOrder.indexOf("toolbar-resource-manager") + 1);
      const pane = findByTestId(fake(container), "palette-work-pane-paint");
      const order = (pane?.children ?? []).map((child) => child.dataset.testid ?? "");
      const toolsAt = order.indexOf("oprn-tile-toolbar");
      const layersAt = order.indexOf("left-layer-switcher");
      expect(toolsAt, "도구 줄이 팔레트 최상단 그룹이어야 한다").toBeGreaterThanOrEqual(0);
      expect(order.indexOf('sidebar-map-header')).toBe(0);
      expect(layersAt).toBe(-1);
      expect(toolsAt).toBe(1);
    });
  }
  {
    const mode = "default";
    it("이벤트 팔레트는 레이어 탭 없이 맵·도구·목록을 표시한다", () => {
      // 이벤트 분기도 같은 팔레트 셸에서 목록을 렌더한다.
      editorState.set({ layer: "event", tool: "event" });
      const container = document.createElement("div");
      document.body.append(container);
      renderTilePalette(container);

      const shell = findByTestId(fake(container), "palette-work-shell");
      expect(shell, `${mode} 이벤트 셸`).not.toBeNull();
      const pane = findByTestId(fake(container), "palette-work-pane-event");
      expect(pane, `${mode} 이벤트 페인`).not.toBeNull();
      const order = (pane?.children ?? []).map((child) => child.dataset.testid ?? "");
      expect(order.indexOf("sidebar-map-header")).toBe(0);
      expect(order.indexOf("left-layer-switcher")).toBe(-1);
      expect(order.indexOf("oprn-tile-toolbar")).toBe(1);
      expect(order.indexOf("palette-event-pane")).toBe(2);
    });
  }
});
