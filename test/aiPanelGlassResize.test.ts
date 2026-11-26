import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel, renderEmptyProposalNotice, EMPTY_PROPOSAL_NOTICE_DISMISS_MS } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

// 조수 크기 조절 회귀 (감독 지시 2026-08-25: "조수의 크기를 좀 자연스럽게 키울 수 있게").
//
// 2026-08-31: 도크 축이 삭제됐다. glass/side/float 3분기가 사라지고 표면은 하나다.
// 2026-09-03 데크: 그 표면은 컴포저 캡슐이 아니라 레일·기록·컴포저를 담은 `.ai-deck` 이다.
//   · 소유 프로퍼티: deck 의 CSS 변수 `--ai-float-bar-width` (패널 인라인 크기는 안 쓴다)
//   · 저장 키: `oprn:ai-panel-size` (최초 1회 레거시 `oprn:ai-panel-size:float` 을 물려받는다)
//   · 핸들: 데크 왼쪽 끝(`is-edge-start`) — 왼쪽으로 끌면 넓어진다
//   · 높이는 어떤 경로로도 바뀌지 않는다 — 기록 높이 축(상단 핸들·oprn:ai-log-height)도 걷었다
describe("aiPanelGlassResize", () => {
  isolateTimers();
  const SIZE_KEY = "oprn:ai-panel-size";
  const LEGACY_FLOAT_SIZE_KEY = "oprn:ai-panel-size:float";
  let restoreDom: (() => void) | null = null;
  let restoreWindow: (() => void) | null = null;
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
  function installFakeWindow(innerWidth = 1600, innerHeight = 1000): void {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    const target = new EventTarget() as EventTarget & Partial<Window>;
    target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
    target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
    // 상태 띠(aiStatusBar)가 window.setInterval 로 시계를 돌린다 — setTimeout 처럼 멈춘 타이머로 둔다.
    target.setInterval = ((..._args: Parameters<typeof setInterval>) => 0) as typeof setInterval;
    target.clearInterval = ((..._args: Parameters<typeof clearInterval>) => undefined) as typeof clearInterval;
    Object.defineProperty(target, "innerWidth", { configurable: true, value: innerWidth });
    Object.defineProperty(target, "innerHeight", { configurable: true, value: innerHeight });
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: target });
    restoreWindow = () => {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
      restoreWindow = null;
    };
  }
  interface Surface {
    readonly panel: FakeElement;
    readonly deck: FakeElement;
    readonly handle: FakeElement;
  }
  /** 패널을 띄우고 크기 계약에 관여하는 세 노드를 뽑는다. */
  function renderSurface(): Surface {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const deck = findByTestId(panel, "ai-deck");
    const handle = findByTestId(panel, "ai-resize-handle");
    if (!deck || !handle) throw new Error("resize fixtures missing");
    return { panel, deck, handle };
  }
  /** 데크가 실제로 쓰는 폭. fake DOM 의 style 은 Record 라 커스텀 프로퍼티를 인덱스로 읽는다. */
  function barWidth(deck: FakeElement): string {
    return deck.style["--ai-float-bar-width"] ?? "";
  }
  /** 패널 자체에는 크기용 인라인 스타일이 남지 않아야 한다. */
  function expectNoInlinePanelSize(panel: FakeElement): void {
    expect(panel.style.width ?? "").toBe("");
    expect(panel.style.height ?? "").toBe("");
    expect(panel.style.maxWidth ?? "").toBe("");
    expect(panel.style.maxHeight ?? "").toBe("");
  }
  function pointerEvent(type: string, clientX: number, clientY: number): Event {
    const event = new Event(type);
    Object.defineProperty(event, "clientX", { configurable: true, value: clientX });
    Object.defineProperty(event, "clientY", { configurable: true, value: clientY });
    Object.defineProperty(event, "preventDefault", { configurable: true, value: () => undefined });
    return event;
  }
  function keyEvent(key: string, shiftKey = false): Event {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperties(event, {
      key: { configurable: true, value: key },
      shiftKey: { configurable: true, value: shiftKey },
    });
    return event;
  }
  function savedSize(): unknown {
    return JSON.parse(storage.get(SIZE_KEY) ?? "null");
  }
  beforeEach(() => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
    store.replace(createBlankProject());
    editorState.set({ currentMapId: null, selection: null });
    restoreDom = installFakeDom();
    installFakeLocalStorage();
    // 이 파일은 펼친 데크의 위치·폭을 본다. 첫 부팅 접힘 기본값(aiChatPanel loadPanelCollapsed(true))과는 무관하니 펼침을 저장해 둔다.
    storage.set("oprn:ai-panel-collapsed", "0");
  });
  afterEach(() => {
    restoreWindow?.();
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  describe("컴포저 캡슐은 저장된 폭으로 열린다", () => {
    // 삭제: "도크별 키에 저장된 크기를 인라인 스타일로 적용", "접힌 입력줄은 저장 폭을 유지하고 높이만 푼다",
    // "사이드와 float 은 패널 자체 크기를 건드리지 않는다" — 세 케이스 모두 도크별 키/패널 인라인 크기,
    // 즉 삭제된 축을 주제로 삼는다. 남은 계약(저장 폭 적용·뷰포트 clamp)은 아래 케이스가 덮는다.
    it("저장된 폭을 캡슐 CSS 변수로 적용하고 패널에는 인라인 크기를 남기지 않는다", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 520, height: 700 }));

      const { panel, deck } = renderSurface();

      expect(barWidth(deck)).toBe("520px");
      expect(panel.style["--ai-float-bar-width"]).toBe("520px");
      expectNoInlinePanelSize(panel);
    });

    it("저장값이 없으면 CSS 기본폭에 맡기고 변수를 쓰지 않는다", () => {
      installFakeWindow();

      const { deck } = renderSurface();

      // 변수를 안 쓰면 assistant-command-bar.css 의 `var(--ai-float-bar-width, 640px)` 폴백이 산다.
      expect(barWidth(deck)).toBe("");
    });

    it("레거시 float 키만 있어도 사용자가 맞춰 둔 폭을 물려받는다", () => {
      installFakeWindow();
      storage.set(LEGACY_FLOAT_SIZE_KEY, JSON.stringify({ width: 700, height: 400 }));

      const { deck } = renderSurface();

      expect(barWidth(deck)).toBe("700px");
    });

    it("뷰포트보다 큰 저장값은 화면 안으로 줄여서 적용한다", () => {
      installFakeWindow(800, 700);
      storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 900 }));

      const { deck } = renderSurface();

      // 캡슐 상한 = min(PANEL_SIZE_LIMITS.maxWidth, 뷰포트폭 − 24) = 776.
      expect(barWidth(deck)).toBe("776px");
    });

    it("뷰포트 축소 후 ARIA valuemax/now 는 표시 클램프 폭을 따르고 저장 선호폭은 유지한다", () => {
      // Break: aria-valuenow advertises raw saved 900 while max is 776.
      installFakeWindow(800, 700);
      storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 400 }));
      const { deck, handle } = renderSurface();

      expect(barWidth(deck)).toBe("776px");
      expect(handle.getAttribute("aria-valuemax")).toBe("776");
      expect(handle.getAttribute("aria-valuenow")).toBe("776");
      // Preferred storage untouched by viewport-only apply.
      expect(savedSize()).toEqual({ width: 900, height: 400 });
    });
  });
  describe("핸들은 캡슐 왼쪽 끝의 세로 분리자다", () => {
    // 삭제: "핸들은 유리에서 우하단 코너 모드로 표시된다" — `is-corner-end` 는 도크와 함께 사라졌다.
    it("캡슐에 붙고 edge-start / vertical / 폭 전용 라벨을 쓴다", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 520, height: 700 }));

      const { deck, handle } = renderSurface();

      expect(handle.parentElement).toBe(deck);
      expect(handle.className).toContain("is-edge-start");
      expect(handle.className).not.toContain("is-corner-end");
      expect(handle.getAttribute("role")).toBe("separator");
      expect(handle.getAttribute("tabindex")).toBe("0");
      expect(handle.getAttribute("aria-orientation")).toBe("vertical");
      expect(handle.getAttribute("aria-label")).toBe("조수 입력줄 폭 조절");
      expect(handle.getAttribute("aria-valuemin")).toBe("280");
      expect(handle.getAttribute("aria-valuemax")).toBe("960");
      expect(handle.getAttribute("aria-valuenow")).toBe("520");
    });
  });
  describe("드래그는 폭만 바꾼다", () => {
    // 삭제: "side는 왼쪽 edge 드래그로 width callback만 갱신하고 side 키에 저장한다"(사이드 도크 없음),
    // "유리에서 오른쪽·아래로 끌면 커지고 놓으면 유리 키에 저장된다"(코너 드래그·유리 키 없음).
    it("왼쪽으로 끌면 넓어지고 놓을 때 저장된다 — 높이는 그대로", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
      const { panel, deck, handle } = renderSurface();

      handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
      globalThis.window.dispatchEvent(pointerEvent("pointermove", 340, 450));

      // 핸들이 캡슐 왼쪽 끝이므로 dx 부호가 반전된다: 640 + (500 − 340) = 800.
      expect(barWidth(deck)).toBe("800px");

      globalThis.window.dispatchEvent(pointerEvent("pointerup", 340, 450));

      // clientY 가 150px 움직였어도 높이는 저장값 그대로다 — 높이는 조절 대상이 아니다.
      expect(savedSize()).toEqual({ width: 800, height: 400 });
      // 레거시 도크별 키는 더 쓰지 않는다.
      expect(storage.has(LEGACY_FLOAT_SIZE_KEY)).toBe(false);
      expectNoInlinePanelSize(panel);
    });

    it("뷰포트 클램프된 표시 폭에서 안쪽 드래그는 즉시 줄어든다", () => {
      // Break: seed drag from raw saved 900; 80px inward stays clamped at 776.
      installFakeWindow(800, 700);
      storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 400 }));
      const { deck, handle } = renderSurface();
      expect(barWidth(deck)).toBe("776px");

      handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
      globalThis.window.dispatchEvent(pointerEvent("pointermove", 580, 300)); // +80 clientX = narrower
      // Effective start 776 - 80 = 696.
      expect(barWidth(deck)).toBe("696px");
      expect(handle.getAttribute("aria-valuenow")).toBe("696");
      globalThis.window.dispatchEvent(pointerEvent("pointerup", 580, 300));
      expect(savedSize()).toEqual({ width: 696, height: 400 });
    });

    it("드래그 시작 폭은 전환 중 레이아웃 값이 아니라 커밋된 barSize를 쓴다", () => {
      // Break: seed startWidth from getBoundingClientRect while CSS width is still animating.
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
      const { panel, deck, handle } = renderSurface();
      (deck as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () =>
        ({ width: 600, height: 400, x: 0, y: 0, top: 0, left: 0, bottom: 400, right: 600, toJSON: () => ({}) });

      handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
      expect(panel.className).toContain("is-resizing");
      expect(deck.className).toContain("is-resizing");
      globalThis.window.dispatchEvent(pointerEvent("pointermove", 420, 300));
      // 640 + (500-420) = 720, not 600+80=680.
      expect(barWidth(deck)).toBe("720px");
      expect(handle.getAttribute("aria-valuenow")).toBe("720");
      globalThis.window.dispatchEvent(pointerEvent("pointerup", 420, 300));
      expect(savedSize()).toEqual({ width: 720, height: 400 });
      expect(panel.className).not.toContain("is-resizing");
      expect(deck.className).not.toContain("is-resizing");
    });

    it("오른쪽으로 끌면 좁아진다", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
      const { deck, handle } = renderSurface();

      handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
      globalThis.window.dispatchEvent(pointerEvent("pointermove", 660, 300));
      globalThis.window.dispatchEvent(pointerEvent("pointerup", 660, 300));

      expect(barWidth(deck)).toBe("480px");
      expect(savedSize()).toEqual({ width: 480, height: 400 });
    });

    it("과하게 끌어도 뷰포트·한계 범위 안에서 멈춘다", () => {
      installFakeWindow(800, 700);
      storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
      const { deck, handle } = renderSurface();

      handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
      globalThis.window.dispatchEvent(pointerEvent("pointermove", -4000, 300));
      expect(barWidth(deck)).toBe("776px"); // 뷰포트폭 − 24

      globalThis.window.dispatchEvent(pointerEvent("pointermove", 4000, 300));
      expect(barWidth(deck)).toBe("280px"); // PANEL_SIZE_LIMITS.minWidth

      globalThis.window.dispatchEvent(pointerEvent("pointerup", 4000, 300));
      expect(savedSize()).toEqual({ width: 280, height: 400 });
    });
  });
  describe("키보드는 폭만 조절한다", () => {
    // 삭제: "키보드는 width를 조절하고 glass에서만 height 화살표를 허용한다" — 도크별 분기와
    // 높이 화살표가 함께 사라졌다. 아래 두 케이스가 폭 조절 + 높이 불변을 각각 못박는다.
    it("ArrowLeft는 넓히고 ArrowRight는 좁히며 즉시 저장한다", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 400, height: 600 }));
      const { deck, handle } = renderSurface();

      handle.dispatchEvent(keyEvent("ArrowLeft"));

      expect(barWidth(deck)).toBe("408px");
      expect(handle.getAttribute("aria-valuenow")).toBe("408");
      expect(savedSize()).toEqual({ width: 408, height: 600 });

      // Shift 는 32px 스텝.
      handle.dispatchEvent(keyEvent("ArrowRight", true));

      expect(barWidth(deck)).toBe("376px");
      expect(savedSize()).toEqual({ width: 376, height: 600 });
    });

    it("위/아래 화살표는 아무 일도 하지 않는다 — 높이는 조절 축이 아니다", () => {
      installFakeWindow();
      storage.set(SIZE_KEY, JSON.stringify({ width: 400, height: 600 }));
      const { panel, deck, handle } = renderSurface();

      const up = keyEvent("ArrowUp", true);
      const down = keyEvent("ArrowDown", true);
      handle.dispatchEvent(up);
      handle.dispatchEvent(down);

      expect(barWidth(deck)).toBe("400px");
      expect(savedSize()).toEqual({ width: 400, height: 600 });
      // 소비하지 않으므로 기본 스크롤 동작을 막지도 않는다.
      expect(up.defaultPrevented).toBe(false);
      expect(down.defaultPrevented).toBe(false);
      expectNoInlinePanelSize(panel);
    });
  });
  describe("기록 높이 축은 없다 — 데크가 한 표면이다", () => {
    it("기록 높이 핸들·기록 줌 크롬이 렌더되지 않는다", () => {
      // Break: 데크 안에 옛 기록 카드 상단 핸들이나 − 100% + 스테퍼가 되살아난다.
      installFakeWindow();
      const { panel, deck } = renderSurface();
      expect(findByTestId(panel, "ai-log-resize-handle")).toBeNull();
      expect(findByTestId(panel, "ai-log-zoom")).toBeNull();
      expect(findByTestId(panel, "ai-log-chrome")).toBeNull();
      // 데크는 레일 → 기록 → 컴포저 순서다.
      const order = deck.children.map((child) => (child as FakeElement).dataset.testid ?? (child as FakeElement).className);
      expect(order.indexOf("ai-deck-rail")).toBeLessThan(order.indexOf("ai-chat-body"));
      expect(order.indexOf("ai-chat-body")).toBeLessThan(order.indexOf("ai-command-bar"));
    });
  });
});

// 0건 프로포절 비블로킹화(도그푸딩 결함 ⑤) 회귀 테스트.
// - 전용 알림(ai-proposal-empty-notice)과 전용 닫기 버튼(ai-proposal-dismiss)을 쓴다 —
//   기존에 [확인] 버튼이 ai-proposal-reject testid를 재사용하던 문제 정리.
// - 완성도 린트 경고 라인이 알림 본문에 담긴다(대화 로그 기록은 패널 통합 경로에서 수행).
describe("aiProposalEmptyNotice", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    vi.restoreAllMocks();
  });
  describe("renderEmptyProposalNotice", () => {
    it("전용 testid(알림/닫기)를 쓰고 완성도 린트 라인을 담는다", () => {
      const onDismiss = vi.fn();
      const lines = ["⚠ 미이행: road_horiz/road_vert/house_a 외 2개 영역 미변경"];
      const notice = renderWithFakeDom(() => renderEmptyProposalNotice(lines, onDismiss));

      expect(notice.dataset.testid).toBe("ai-proposal-empty-notice");
      // 기존 결함: [확인]이 ai-proposal-reject testid를 재사용 → 전용 dismiss testid로 교체 확인.
      expect(findByTestId(notice, "ai-proposal-reject")).toBeNull();
      const dismiss = findByTestId(notice, "ai-proposal-dismiss");
      expect(dismiss).toBeTruthy();
      expect(notice.textContent).toContain("변경 없음");
      expect(notice.textContent).toContain("⚠ 미이행");

      dismiss?.click();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("자동 소거 지연은 양수 상수로 정의된다(패시브 알림 계약)", () => {
      expect(EMPTY_PROPOSAL_NOTICE_DISMISS_MS).toBeGreaterThan(0);
    });
  });
});

describe("aiSelectionAutoChip", () => {
  isolateTimers();
  describe("selection auto chip", () => {
    let restore: () => void;
    beforeEach(() => {
      restore = installFakeDom({ window: true });
      store.replace(createBlankProject());
      editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
      document.body.append(renderAiChatPanel());
    });
    afterEach(() => {
      editorState.set({ selection: null });
      restore();
    });

    function chip(): unknown {
      return findByTestId(document.body as unknown as FakeElement, "ai-selection-chip");
    }

    it("선택이 생기면 칩이 자동 부착되고, ×로 해제하면 같은 선택엔 다시 붙지 않는다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
      expect(chip()).toBeTruthy();
      (findByTestId(document.body as unknown as FakeElement, "ai-selection-chip-clear") as unknown as HTMLElement).click();
      expect(chip()).toBeFalsy();
      // 같은 선택 그대로 → 재부착 없음
      editorState.set({ zoom: 3 });
      expect(chip()).toBeFalsy();
      // 새 선택 → 재부착
      editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
      expect(chip()).toBeTruthy();
    });
  });
});

describe("aiSharedSurface", () => {
  isolateTimers();
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
    restoreDom = installFakeDom({ window: true });
    installFakeLocalStorage();
    document.body.className = "";
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  // 도크 축 삭제(float 단일) — "다음에 갈 도크" 라벨 계산과 「떼기」의 도크 이동 단언은
  // 대상이 없어져 고정 라벨·무동작 계약으로 뒤집었다.
  describe("AI shared surface", () => {
    it("shows the shared empty composer surface", () => {
      // Break: the panel remounts the start-screen empty kit or a private expert board.
      const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
      expect(findByTestId(panel, "ai-start-screen")).toBeNull();
      expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
      expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
      expect(findByTestId(panel, "ai-expert-board")).toBeNull();
      expect(findByTestId(panel, "ai-composer-chips")).toBeNull();
      expect(findByTestId(panel, "ai-input")).toBeTruthy();
      expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
      expect(findByTestId(panel, "ai-send")).toBeTruthy();
      expect(panel.dataset.uiDensity).toBe("shared");
    });

    it("도크 전환 진입점은 하나도 남지 않고, 붙은 곳은 dataset 으로만 읽는다", () => {
      // Break: 「입력줄」이라고만 적힌 채 눌러도 아무 일이 없는 도크 노드가 되살아났다.
      // 그런 노드는 없는 선택지를 광고하므로 «있으면» 회귀다.
      const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

      for (const dead of [
        "ai-dock-mode-btn",
        "ai-dock-mode-btn-header",
        "ai-chat-detach",
        "chat-dock-toggle",
      ]) {
        expect(findByTestId(panel, dead), dead).toBeNull();
      }

      // ☰ 두 표면 모두에서 「도크 전환」 항목이 빠졌다.
      findByTestId(panel, "ai-more-menu-toggle")?.click();
      expect(findByTestId(panel, "ai-more-dock")).toBeNull();
      findByTestId(panel, "ai-command-menu-toggle")?.click();
      expect(findByTestId(panel, "ai-command-menu-dock")).toBeNull();

      // 배치를 읽는 창구는 dataset 하나다 — 레이아웃 테스트가 여기만 본다.
      expect(panel.dataset.chatDock).toBe("float");
    });

    it("대기 화면 선택은 더보기와 컴포저 메뉴 어디에도 없다", () => {
      const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

      const menu = findByTestId(panel, "ai-more-menu");
      if (menu) menu.hidden = true;
      findByTestId(panel, "ai-more-menu-toggle")?.click();
      expect(menu?.hidden).toBe(false);
      expect(findByTestId(panel, "ai-temperature-quiet-gold")).toBeNull();
      expect(findByTestId(panel, "ai-command-temperature-quiet-gold")).toBeNull();
      expect(panel.dataset.temperature).toBeUndefined();
    });
  });
});
