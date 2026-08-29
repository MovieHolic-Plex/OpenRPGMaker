// 조수 카드 크기 조절 회귀 (감독 지시 2026-08-25: "조수의 크기를 좀 자연스럽게 키울 수 있게").
//
// 실측한 결함: `applySize()` 는 chat-dock-float / chat-dock-glass / chat-dock-side 세 경우
// 전부에서 style 을 비우고 빠져나갔다. ChatDock 은 언제나 그 셋 중 하나이므로(src/editor/chatDock.ts)
// 저장된 PanelSize 는 어떤 상태에서도 적용되지 않았고 코너 드래그도 아무 일을 하지 못했다.
// CSS 도 유리에서 `.ai-chat-resize-handle` 을 display:none 으로 감췄다. 실측: 유리 카드는
// 부팅·포커스·타이핑·슬래시·도크 순환 내내 정확히 360x620 을 유지했다.
//
// 범위: 크기 조절은 **유리 카드**만이다. 사이드는 에디터 셸의 열(chat-side-panel)이 폭을
// 가지고 있고, float 은 inset:0 전면 오버레이라 패널 자체 크기가 의미를 갖지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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

function renderPanel(dock: "glass" | "side" | "float", options: Parameters<typeof renderAiChatPanel>[0] = {}): FakeElement {
  const panel = renderAiChatPanel({ clock: () => 37_000, getChatDock: () => dock, ...options }) as unknown as FakeElement;
  // glass 는 접힌 입력줄로 부팅한다(17-assistant-modern-shell.css 의 fold 섹션 / aiGlassFold.test.ts). 접힘은
  // 카드를 컴포저 한 줄로 줄이므로 저장 높이가 적용되지 않는다 — 크기 계약은 펼친 상태의 것이다.
  if (dock === "glass") findByTestId(panel, "ai-collapse")?.click();
  return panel;
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

describe("유리 카드는 저장된 크기로 열린다", () => {
  it("도크별 키에 저장된 크기를 인라인 스타일로 적용하고 CSS 상한도 함께 푼다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 520, height: 700 }));

    const panel = renderPanel("glass");

    expect(panel.style.width).toBe("520px");
    expect(panel.style.height).toBe("700px");
    // 유리의 CSS 는 max-width/max-height 로 카드를 묶는다(02-chat-dock.css). 인라인 폭만 주면
    // 상한이 이겨서 커지지 않는다 — 상한도 같이 풀어야 실제로 커진다.
    expect(panel.style.maxWidth).toBe("520px");
    expect(panel.style.maxHeight).toBe("700px");
  });

  it("뷰포트보다 큰 저장값은 화면 안으로 줄여서 적용한다", () => {
    installFakeWindow(800, 700);
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 900, height: 900 }));

    const panel = renderPanel("glass");

    expect(panel.style.width).toBe("720px"); // 800 * 0.9
    expect(panel.style.height).toBe("630px"); // 700 * 0.9
  });

  it("접힌 입력줄은 저장 폭을 유지하고 높이만 푼다 — 펼칠 때 폭이 튀지 않는다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 520, height: 700 }));

    // renderPanel 과 달리 셰브론을 누르지 않는다: 부팅 직후의 접힌 상태를 본다.
    const panel = renderAiChatPanel({ clock: () => 37_000, getChatDock: () => "glass" }) as unknown as FakeElement;

    expect(panel.classList.contains("is-glass-folded")).toBe(true);
    expect(panel.style.width).toBe("520px");
    expect(panel.style.maxWidth).toBe("520px");
    // 높이는 CSS `height: auto` 가 이겨 컴포저 한 줄로 줄어야 한다.
    expect(panel.style.height ?? "").toBe("");
    expect(panel.style.maxHeight ?? "").toBe("");

    findByTestId(panel, "ai-collapse")?.click();
    expect(panel.style.width).toBe("520px"); // 폭은 그대로
    expect(panel.style.height).toBe("700px");
  });

  it("사이드와 float 은 패널 자체 크기를 건드리지 않는다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 640, height: 800 }));
    storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 640, height: 800 }));

    expect(renderPanel("side").style.width ?? "").toBe("");
    expect(renderPanel("float").style.width ?? "").toBe("");
  });
});

describe("도크별 실제 surface를 조절한다", () => {
  it("side는 왼쪽 edge 드래그로 width callback만 갱신하고 side 키에 저장한다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 480, height: 851 }));
    const preview = vi.fn();
    const commit = vi.fn();
    const panel = renderPanel("side", { onSideWidthPreview: preview, onSideWidthCommit: commit });
    const handle = findByTestId(panel, "ai-resize-handle");
    if (!handle) throw new Error("resize handle missing");

    handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 380, 420));
    expect(preview).toHaveBeenLastCalledWith(600, 851);
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 380, 420));
    expect(commit).toHaveBeenLastCalledWith(600, 851);
    expect(panel.style.height ?? "").toBe("");
  });

  it("float는 command bar width만 바꾸고 높이는 저장값 그대로 유지한다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 640, height: 400 }));
    const panel = renderPanel("float");
    const handle = findByTestId(panel, "ai-resize-handle");
    const commandBar = findByTestId(panel, "ai-command-bar");
    if (!handle || !commandBar) throw new Error("float resize fixtures missing");

    expect(handle.parentElement).toBe(commandBar);
    handle.dispatchEvent(pointerEvent("pointerdown", 500, 300));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 340, 450));
    globalThis.window.dispatchEvent(pointerEvent("pointerup", 340, 450));

    expect(commandBar.style.getPropertyValue("--ai-float-bar-width")).toBe("800px");
    expect(JSON.parse(storage.get("oprn:ai-panel-size:float") ?? "{}")).toEqual({ width: 800, height: 400 });
    expect(panel.style.width ?? "").toBe("");
    expect(panel.style.height ?? "").toBe("");
  });

  it("키보드는 width를 조절하고 glass에서만 height 화살표를 허용한다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 600 }));
    const panel = renderPanel("glass");
    const handle = findByTestId(panel, "ai-resize-handle");
    if (!handle) throw new Error("resize handle missing");

    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("tabindex")).toBe("0");
    handle.dispatchEvent(keyEvent("ArrowRight"));
    handle.dispatchEvent(keyEvent("ArrowDown", true));

    expect(panel.style.width).toBe("408px");
    expect(panel.style.height).toBe("632px");
    expect(handle.getAttribute("aria-valuenow")).toBe("408");
    expect(JSON.parse(storage.get("oprn:ai-panel-size:glass") ?? "{}")).toEqual({ width: 408, height: 632 });
  });
});

describe("코너 드래그로 커진다", () => {
  it("유리에서 오른쪽·아래로 끌면 커지고 놓으면 유리 키에 저장된다", () => {
    installFakeWindow();
    storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 600 }));

    const panel = renderPanel("glass");
    const handle = findByTestId(panel, "ai-resize-handle");
    if (!handle) throw new Error("resize handle missing");

    handle.dispatchEvent(pointerEvent("pointerdown", 500, 500));
    globalThis.window.dispatchEvent(pointerEvent("pointermove", 620, 590));

    expect(panel.style.width).toBe("520px"); // 400 + (620-500)
    expect(panel.style.height).toBe("690px"); // 600 + (590-500)

    globalThis.window.dispatchEvent(pointerEvent("pointerup", 620, 590));

    expect(JSON.parse(storage.get("oprn:ai-panel-size:glass") ?? "{}")).toEqual({ width: 520, height: 690 });
  });

  it("핸들은 유리에서 우하단 코너 모드로 표시된다", () => {
    installFakeWindow();
    const handle = findByTestId(renderPanel("glass"), "ai-resize-handle");

    expect(handle?.className).toContain("is-corner-end");
  });
});
