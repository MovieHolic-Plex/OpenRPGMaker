// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStudioShell, type StudioShell } from "@/editor/panels/aiStudioShell";
import { readCssFamily } from "./cssFamily";

// Tool execution is unrelated to column layout; keep shell controls and CSS real.
vi.mock("@/editor/tools/toolRegistry", () => ({ activeTools: () => [] }));

const css = readCssFamily(
  "src/styles/database/index.css",
  "src/styles/database/tabs-b-assistant-panel/08-studio-mode-start-screen.css",
);
const layoutKey = "oprn:ai-studio-layout";
let shell: StudioShell;
let style: HTMLStyleElement;
let restoreViewport: (() => void) | null = null;

/** 셸은 좁은 화면에서 좌·우 열을 깎는다(맵 360px 보장) — 기본 케이스는 «넉넉한 화면» 을 전제로 본다. */
function setViewport(width: number): void {
  const original = Object.getOwnPropertyDescriptor(window, "innerWidth");
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  restoreViewport = () => {
    if (original) Object.defineProperty(window, "innerWidth", original);
  };
}

beforeEach(() => {
  localStorage.clear();
  setViewport(1920);
  style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
});

afterEach(() => {
  shell?.dispose();
  restoreViewport?.();
  restoreViewport = null;
  style.remove();
  document.body.replaceChildren();
  localStorage.clear();
});

function boot(sizes?: { scenes: number; chat: number }): void {
  if (sizes) localStorage.setItem(layoutKey, JSON.stringify(sizes));
  shell = createStudioShell({ onExit: () => {}, onFontZoom: () => {} });
  document.body.append(shell.root);
}

function control(id: string): HTMLElement {
  const node = shell.root.querySelector<HTMLElement>(`[data-testid="ai-studio-${id}"]`);
  if (!node) throw new Error(`Missing studio control: ${id}`);
  return node;
}

function expectColumns(scenes: number, chat: number): void {
  // Happy DOM resolves the real cascade and var() references, not pixel geometry.
  // Assert both grid tracks and pane widths: a class-only test missed this defect.
  expect(getComputedStyle(shell.root).gridTemplateColumns)
    .toBe(`${scenes}px 8px minmax(0, 1fr) 8px ${chat}px`);
  const scenesPane = shell.root.querySelector<HTMLElement>(".ai-studio-scenes");
  if (!scenesPane) throw new Error("Missing studio scenes pane");
  expect(getComputedStyle(scenesPane).width).toBe(`${scenes}px`);
  expect(getComputedStyle(control("chat")).width).toBe(`${chat}px`);
}

function key(column: "scenes" | "chat", value: string, shiftKey = false): void {
  const event = new KeyboardEvent("keydown", { key: value, shiftKey, cancelable: true });
  control(`split-${column}`).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
}

describe("studio column collapse layout", () => {
  it("reclaims both default column tracks and restores them independently", () => {
    boot();
    expectColumns(252, 400);
    control("scenes-collapse").click();
    expectColumns(52, 400);
    expect(getComputedStyle(control("split-scenes")).display).toBe("none");
    control("chat-collapse").click();
    expectColumns(52, 52);
    expect(getComputedStyle(control("split-chat")).display).toBe("none");
    control("scenes-collapse").click();
    expectColumns(252, 52);
    control("chat-collapse").click();
    expectColumns(252, 400);
    expect(getComputedStyle(control("split-scenes")).display).not.toBe("none");
    expect(getComputedStyle(control("split-chat")).display).not.toBe("none");
    expect(localStorage.getItem(layoutKey)).toBeNull();
  });

  it("preserves saved expanded sizes through collapse and resizing after restore", () => {
    const saved = { scenes: 316, chat: 464 };
    boot(saved);
    expectColumns(316, 464);
    control("scenes-collapse").click();
    control("chat-collapse").click();
    expectColumns(52, 52);
    expect(JSON.parse(localStorage.getItem(layoutKey) ?? "null")).toEqual(saved);
    control("scenes-collapse").click();
    control("chat-collapse").click();
    expectColumns(316, 464);

    key("scenes", "ArrowRight");
    key("chat", "ArrowLeft", true);
    expectColumns(332, 400);
    expect(JSON.parse(localStorage.getItem(layoutKey) ?? "null")).toEqual({ scenes: 332, chat: 400 });
    // The right handle grows leftwards; the left handle grows rightwards.
    for (const [column, endX] of [["scenes", 132], ["chat", 68]] as const) {
      control(`split-${column}`).dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 100 }));
      document.dispatchEvent(new PointerEvent("pointermove", { clientX: endX }));
      document.dispatchEvent(new PointerEvent("pointerup"));
    }
    expectColumns(364, 432);
    expect(JSON.parse(localStorage.getItem(layoutKey) ?? "null")).toEqual({ scenes: 364, chat: 432 });
    control("scenes-collapse").click();
    control("chat-collapse").click();
    expectColumns(52, 52);
    control("scenes-collapse").click();
    control("chat-collapse").click();
    expectColumns(364, 432);

    key("scenes", "Home");
    key("chat", "End");
    expectColumns(180, 640);
    control("split-scenes").dispatchEvent(new MouseEvent("dblclick"));
    control("split-chat").dispatchEvent(new MouseEvent("dblclick"));
    expectColumns(252, 400);
    expect(JSON.parse(localStorage.getItem(layoutKey) ?? "null")).toEqual({ scenes: 252, chat: 400 });
  });

  it("좁은 화면에서는 가운데 맵을 지키려고 오른쪽 열부터 깎는다(저장값은 그대로)", () => {
    setViewport(1024);
    const saved = { scenes: 252, chat: 400 };
    boot(saved);
    // 1024 - 36 - 252 - 400 = 336px 밖에 안 남는다 → 오른쪽을 376 까지 깎아 맵 360 을 만든다.
    expectColumns(252, 376);
    expect(JSON.parse(localStorage.getItem(layoutKey) ?? "null")).toEqual(saved);
  });
});
