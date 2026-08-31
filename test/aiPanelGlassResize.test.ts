// 조수 크기 조절 회귀 (감독 지시 2026-08-25: "조수의 크기를 좀 자연스럽게 키울 수 있게").
//
// 2026-08-31: 도크 축이 삭제됐다. glass/side/float 3분기가 사라지고 표면은 하나 —
// 컴포저 캡슐(ai-command-bar)의 **폭**이다. 그래서 계약도 하나로 줄었다:
//   · 소유 프로퍼티: commandBar 의 CSS 변수 `--ai-float-bar-width` (패널 인라인 크기는 안 쓴다)
//   · 저장 키: `oprn:ai-panel-size` (최초 1회 레거시 `oprn:ai-panel-size:float` 을 물려받는다)
//   · 핸들: 캡슐 왼쪽 끝(`is-edge-start`) — 왼쪽으로 끌면 넓어진다
//   · 높이는 어떤 경로로도 바뀌지 않는다
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
  readonly commandBar: FakeElement;
  readonly handle: FakeElement;
}

/** 패널을 띄우고 크기 계약에 관여하는 세 노드를 뽑는다. */
function renderSurface(): Surface {
  const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
  const commandBar = findByTestId(panel, "ai-command-bar");
  const handle = findByTestId(panel, "ai-resize-handle");
  if (!commandBar || !handle) throw new Error("resize fixtures missing");
  return { panel, commandBar, handle };
}

/** 캡슐이 실제로 쓰는 폭. fake DOM 의 style 은 Record 라 커스텀 프로퍼티를 인덱스로 읽는다. */
function barWidth(commandBar: FakeElement): string {
  return commandBar.style["--ai-float-bar-width"] ?? "";
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

    const { panel, commandBar } = renderSurface();

    expect(barWidth(commandBar)).toBe("520px");
    expectNoInlinePanelSize(panel);
  });

  it("저장값이 없으면 CSS 기본폭에 맡기고 변수를 쓰지 않는다", () => {
    installFakeWindow();

    const { commandBar } = renderSurface();

    // 변수를 안 쓰면 assistant-command-bar.css 의 `var(--ai-float-bar-width, 640px)` 폴백이 산다.
    expect(barWidth(commandBar)).toBe("");
  });

  it("레거시 float 키만 있어도 사용자가 맞춰 둔 폭을 물려받는다", () => {
    installFakeWindow();
    storage.set(LEGACY_FLOAT_SIZE_KEY, JSON.stringify({ width: 700, height: 400 }));

    const { commandBar } = renderSurface();

    expect(barWidth(commandBar)).toBe("700px");
  });

  it("뷰포트보다 큰 저장값은 화면 안으로 줄여서 적용한다", () => {
    installFakeWindow(800, 700);
    storage.set(SIZE_KEY, JSON.stringify({ width: 900, height: 900 }));

    const { commandBar } = renderSurface();

    // 캡슐 상한 = min(PANEL_SIZE_LIMITS.maxWidth, 뷰포트폭 − 24) = 776.
    expect(barWidth(commandBar)).toBe("776px");
  });
});

describe("핸들은 캡슐 왼쪽 끝의 세로 분리자다", () => {
  // 삭제: "핸들은 유리에서 우하단 코너 모드로 표시된다" — `is-corner-end` 는 도크와 함께 사라졌다.
  it("캡슐에 붙고 edge-start / vertical / 폭 전용 라벨을 쓴다", () => {
    installFakeWindow();
    storage.set(SIZE_KEY, JSON.stringify({ width: 520, height: 700 }));

    const { commandBar, handle } = renderSurface();

    expect(handle.parentElement).toBe(commandBar);
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
    const { panel, commandBar, handle } = renderSurface();

    handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 340, 450));

    // 핸들이 캡슐 왼쪽 끝이므로 dx 부호가 반전된다: 640 + (500 − 340) = 800.
    expect(barWidth(commandBar)).toBe("800px");

    globalThis.window.dispatchEvent(pointerEvent("pointerup", 340, 450));

    // clientY 가 150px 움직였어도 높이는 저장값 그대로다 — 높이는 조절 대상이 아니다.
    expect(savedSize()).toEqual({ width: 800, height: 400 });
    // 레거시 도크별 키는 더 쓰지 않는다.
    expect(storage.has(LEGACY_FLOAT_SIZE_KEY)).toBe(false);
    expectNoInlinePanelSize(panel);
  });

  it("오른쪽으로 끌면 좁아진다", () => {
    installFakeWindow();
    storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
    const { commandBar, handle } = renderSurface();

    handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 660, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 660, 300));

    expect(barWidth(commandBar)).toBe("480px");
    expect(savedSize()).toEqual({ width: 480, height: 400 });
  });

  it("과하게 끌어도 뷰포트·한계 범위 안에서 멈춘다", () => {
    installFakeWindow(800, 700);
    storage.set(SIZE_KEY, JSON.stringify({ width: 640, height: 400 }));
    const { commandBar, handle } = renderSurface();

    handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", -4000, 300));
    expect(barWidth(commandBar)).toBe("776px"); // 뷰포트폭 − 24

    globalThis.window.dispatchEvent(pointerEvent("pointermove", 4000, 300));
    expect(barWidth(commandBar)).toBe("280px"); // PANEL_SIZE_LIMITS.minWidth

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
    const { commandBar, handle } = renderSurface();

    handle.dispatchEvent(keyEvent("ArrowLeft"));

    expect(barWidth(commandBar)).toBe("408px");
    expect(handle.getAttribute("aria-valuenow")).toBe("408");
    expect(savedSize()).toEqual({ width: 408, height: 600 });

    // Shift 는 32px 스텝.
    handle.dispatchEvent(keyEvent("ArrowRight", true));

    expect(barWidth(commandBar)).toBe("376px");
    expect(savedSize()).toEqual({ width: 376, height: 600 });
  });

  it("위/아래 화살표는 아무 일도 하지 않는다 — 높이는 조절 축이 아니다", () => {
    installFakeWindow();
    storage.set(SIZE_KEY, JSON.stringify({ width: 400, height: 600 }));
    const { panel, commandBar, handle } = renderSurface();

    const up = keyEvent("ArrowUp", true);
    const down = keyEvent("ArrowDown", true);
    handle.dispatchEvent(up);
    handle.dispatchEvent(down);

    expect(barWidth(commandBar)).toBe("400px");
    expect(savedSize()).toEqual({ width: 400, height: 600 });
    // 소비하지 않으므로 기본 스크롤 동작을 막지도 않는다.
    expect(up.defaultPrevented).toBe(false);
    expect(down.defaultPrevented).toBe(false);
    expectNoInlinePanelSize(panel);
  });
});
