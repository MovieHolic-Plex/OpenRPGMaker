/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";

const FORCE_BLOCK_GLOBAL = globalThis as { __oprnForcePointerBlock?: boolean };
const originalMatchMedia = window.matchMedia.bind(window);
const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");

function setTouchCapabilities(coarse: boolean, maxTouchPoints: number): void {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = originalMatchMedia(query);
    Object.defineProperty(result, "matches", {
      configurable: true,
      value: coarse && query === "(pointer: coarse)",
    });
    return result;
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

function installPointerCapture(element: HTMLElement): { readonly release: ReturnType<typeof vi.fn> } {
  let capturedPointerId: number | null = null;
  const release = vi.fn((pointerId: number) => {
    if (capturedPointerId === pointerId) capturedPointerId = null;
  });
  Object.defineProperties(element, {
    setPointerCapture: {
      configurable: true,
      value: (pointerId: number) => {
        capturedPointerId = pointerId;
      },
    },
    hasPointerCapture: {
      configurable: true,
      value: (pointerId: number) => capturedPointerId === pointerId,
    },
    releasePointerCapture: { configurable: true, value: release },
  });
  return { release };
}

function pointerEvent(
  type: string,
  options: { readonly pointerId?: number; readonly clientX?: number; readonly clientY?: number } = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: options.pointerId ?? 7,
    pointerType: "touch",
    clientX: options.clientX ?? 120,
    clientY: options.clientY ?? 66,
  });
}

function keyboardTrace(): { readonly events: string[]; readonly cleanup: () => void } {
  const events: string[] = [];
  const controller = new AbortController();
  const record = (event: KeyboardEvent): void => {
    events.push(`${event.type}:${event.key}`);
  };
  document.addEventListener("keydown", record, { signal: controller.signal });
  document.addEventListener("keyup", record, { signal: controller.signal });
  return { events, cleanup: () => controller.abort() };
}

function translatedRect(element: HTMLElement, initial: DOMRect, scale = 1): DOMRect {
  const match = element.style.transform.match(/^translate\(([-\d.eE]+)px, ([-\d.eE]+)px\)$/);
  const offsetX = Number(match?.[1] ?? Number.NaN);
  const offsetY = Number(match?.[2] ?? Number.NaN);
  return new DOMRect(initial.x + offsetX * scale, initial.y + offsetY * scale, initial.width, initial.height);
}

function setElementSize(element: HTMLElement, width: number, height: number): void {
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: width },
    offsetHeight: { configurable: true, value: height },
  });
}

function expectRectContained(inner: DOMRect, outer: DOMRect): void {
  expect(Number.isFinite(inner.x)).toBe(true);
  expect(Number.isFinite(inner.y)).toBe(true);
  expect(inner.left).toBeGreaterThanOrEqual(outer.left);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top);
  expect(inner.right).toBeLessThanOrEqual(outer.right);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom);
  expect(inner.left + inner.width / 2).toBeGreaterThanOrEqual(outer.left);
  expect(inner.left + inner.width / 2).toBeLessThanOrEqual(outer.right);
  expect(inner.top + inner.height / 2).toBeGreaterThanOrEqual(outer.top);
  expect(inner.top + inner.height / 2).toBeLessThanOrEqual(outer.bottom);
}

async function loadTouchPad(env: Record<string, string> = {}) {
  // 명시하지 않은 키는 빈 문자열로 고정해 외부 환경의 값이 새어들지 않게 한다.
  vi.stubEnv("VITE_TOUCH_CONTROLS", env.VITE_TOUCH_CONTROLS ?? "");
  vi.stubEnv("OPENRPG_PLAYER_TOUCH_CONTROLS", env.OPENRPG_PLAYER_TOUCH_CONTROLS ?? "");
  vi.resetModules();
  return import("@/player/touchPad");
}

beforeEach(() => {
  document.body.replaceChildren();
  setTouchCapabilities(true, 0);
  delete FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock;
});

afterEach(() => {
  delete FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  if (originalMaxTouchPoints) {
    Object.defineProperty(navigator, "maxTouchPoints", originalMaxTouchPoints);
  } else {
    delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
  }
  delete (document as unknown as { visibilityState?: DocumentVisibilityState }).visibilityState;
  document.body.replaceChildren();
});

describe("touch pad capability and input parity", () => {
  it("stays disabled on a coarse-pointer device without an explicit mobile-build override", async () => {
    const { createTouchPad } = await loadTouchPad();
    const host = document.createElement("div");

    const handle = createTouchPad(host);

    expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
    handle.cleanup();
  });

  it("stays disabled when only maxTouchPoints reports touch capability", async () => {
    setTouchCapabilities(false, 2);
    const { createTouchPad } = await loadTouchPad();
    const host = document.createElement("div");

    const handle = createTouchPad(host);

    expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
    handle.cleanup();
  });

  it("does not mount on a fine-pointer desktop without env config", async () => {
    setTouchCapabilities(false, 0);
    const { createTouchPad } = await loadTouchPad();
    const host = document.createElement("div");

    const handle = createTouchPad(host);

    expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
    handle.cleanup();
  });

  it("does not auto-mount from maxTouchPoints when matchMedia is unavailable", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 2 });
    try {
      const { createTouchPad } = await loadTouchPad();
      const host = document.createElement("div");

      const handle = createTouchPad(host);

      expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
      handle.cleanup();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "matchMedia", descriptor);
      } else {
        Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
      }
    }
  });

  it.each(["1", "true", "on"])(
    "force-enables via VITE_TOUCH_CONTROLS=%s even on a fine-pointer desktop",
    async (value) => {
      setTouchCapabilities(false, 0);
      const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: value });
      const host = document.createElement("div");

      const handle = createTouchPad(host);

      expect(host.querySelector("[data-testid='touch-pad']")).toBeTruthy();
      handle.cleanup();
    },
  );

  it.each(["0", "false", "off"])(
    "force-disables via VITE_TOUCH_CONTROLS=%s on touch-capable devices",
    async (value) => {
      const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: value });
      const host = document.createElement("div");

      const handle = createTouchPad(host);

      expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
      handle.cleanup();
    },
  );

  it("recognizes the OPENRPG_PLAYER_ prefix for force-enable", async () => {
    setTouchCapabilities(false, 0);
    const { createTouchPad } = await loadTouchPad({ OPENRPG_PLAYER_TOUCH_CONTROLS: "on" });
    const host = document.createElement("div");

    const handle = createTouchPad(host);

    expect(host.querySelector("[data-testid='touch-pad']")).toBeTruthy();
    handle.cleanup();
  });

  it("recognizes the OPENRPG_PLAYER_ prefix for force-disable", async () => {
    const { createTouchPad } = await loadTouchPad({ OPENRPG_PLAYER_TOUCH_CONTROLS: "0" });
    const host = document.createElement("div");

    const handle = createTouchPad(host);

    expect(host.querySelector("[data-testid='touch-pad']")).toBeNull();
    handle.cleanup();
  });

  it("keeps an extreme scaled D-pad drag contained while preserving blocker-delivered direction edges", async () => {
    const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: "1" });
    const root = document.createElement("div");
    const stage = document.createElement("div");
    root.append(stage);
    document.body.append(root);
    FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock = true;
    const cleanupBlocker = installPlayPointerBlocker(root);
    const handle = createTouchPad(stage);
    const base = stage.querySelector<HTMLElement>(".touch-dpad-base");
    const knob = stage.querySelector<HTMLElement>(".touch-dpad-knob");
    expect(base).toBeTruthy();
    expect(knob).toBeTruthy();
    if (!base || !knob) return;
    installPointerCapture(base);
    const layoutScale = 2;
    const stageRect = new DOMRect(0, 0, 320, 360);
    let baseRect = new DOMRect(20, 40, 264, 264);
    const initialKnobRect = new DOMRect(96, 116, 112, 112);
    let knobGeometryAvailable = true;
    setElementSize(base, 132, 132);
    setElementSize(knob, 56, 56);
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue(stageRect);
    vi.spyOn(base, "getBoundingClientRect").mockImplementation(() => baseRect);
    vi.spyOn(knob, "getBoundingClientRect").mockImplementation(() =>
      knobGeometryAvailable ? translatedRect(knob, initialKnobRect, layoutScale) : new DOMRect()
    );
    const trace = keyboardTrace();

    base.dispatchEvent(pointerEvent("pointerdown", { clientX: 1_000, clientY: 1_000 }));
    const diagonalKnobRect = knob.getBoundingClientRect();
    expectRectContained(diagonalKnobRect, baseRect);
    expectRectContained(diagonalKnobRect, stageRect);
    expect(trace.events).toEqual(["keydown:ArrowRight", "keydown:ArrowDown"]);

    base.dispatchEvent(pointerEvent("pointermove", { clientX: 1_000, clientY: 172 }));
    const cardinalKnobRect = knob.getBoundingClientRect();
    expectRectContained(cardinalKnobRect, baseRect);
    expectRectContained(cardinalKnobRect, stageRect);
    expect(trace.events).toEqual(["keydown:ArrowRight", "keydown:ArrowDown", "keyup:ArrowDown"]);

    baseRect = new DOMRect();
    knobGeometryAvailable = false;
    setElementSize(base, 0, 0);
    setElementSize(knob, 0, 0);
    base.dispatchEvent(pointerEvent("pointermove", { clientX: -1_000, clientY: 0 }));
    expect(knob.style.transform).toBe("translate(0px, 0px)");
    expect(knob.style.transform).not.toContain("NaN");

    base.dispatchEvent(pointerEvent("pointerup", { clientX: -1_000, clientY: 0 }));

    expect(trace.events).toEqual(["keydown:ArrowRight", "keydown:ArrowDown", "keyup:ArrowDown", "keyup:ArrowRight", "keydown:ArrowLeft", "keyup:ArrowLeft"]);
    trace.cleanup();
    handle.cleanup();
    cleanupBlocker();
  });

  it.each(["pointerup", "pointercancel"])("releases a held D-pad key on %s", async (releaseType) => {
    const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: "1" });
    const host = document.createElement("div");
    const handle = createTouchPad(host);
    const base = host.querySelector<HTMLElement>(".touch-dpad-base");
    expect(base).toBeTruthy();
    if (!base) return;
    installPointerCapture(base);
    vi.spyOn(base, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 132, 132));
    const trace = keyboardTrace();
    base.dispatchEvent(pointerEvent("pointerdown"));

    base.dispatchEvent(pointerEvent(releaseType));

    expect(trace.events).toEqual(["keydown:ArrowRight", "keyup:ArrowRight"]);
    trace.cleanup();
    handle.cleanup();
  });

  it.each(["blur", "visibilitychange", "cleanup"])("releases A on %s", async (releaseType) => {
    const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: "1" });
    const host = document.createElement("div");
    const handle = createTouchPad(host);
    const actionA = host.querySelector<HTMLElement>("[data-testid='touch-action-a']");
    expect(actionA).toBeTruthy();
    if (!actionA) return;
    const capture = installPointerCapture(actionA);
    const trace = keyboardTrace();
    actionA.dispatchEvent(pointerEvent("pointerdown"));

    if (releaseType === "blur") window.dispatchEvent(new Event("blur"));
    if (releaseType === "visibilitychange") {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    }
    if (releaseType === "cleanup") handle.cleanup();

    expect(trace.events).toEqual(["keydown:Enter", "keyup:Enter"]);
    expect(actionA.classList.contains("active")).toBe(false);
    expect(capture.release).toHaveBeenCalledWith(7);
    trace.cleanup();
    handle.cleanup();
  });

  it("emits one action-key edge for repeated pointerdown and removes listeners on cleanup", async () => {
    const { createTouchPad } = await loadTouchPad({ VITE_TOUCH_CONTROLS: "1" });
    const host = document.createElement("div");
    const handle = createTouchPad(host);
    const actionB = host.querySelector<HTMLElement>("[data-testid='touch-action-b']");
    expect(actionB).toBeTruthy();
    if (!actionB) return;
    installPointerCapture(actionB);
    const trace = keyboardTrace();
    actionB.dispatchEvent(pointerEvent("pointerdown"));
    actionB.dispatchEvent(pointerEvent("pointerdown"));
    handle.cleanup();

    actionB.dispatchEvent(pointerEvent("pointerdown", { pointerId: 8 }));

    expect(trace.events).toEqual(["keydown:Escape", "keyup:Escape"]);
    trace.cleanup();
  });
});
