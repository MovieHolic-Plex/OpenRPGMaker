import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultYieldToUi, YIELD_TO_UI_FALLBACK_MS } from "@/ai/yieldToUi";

describe("defaultYieldToUi", () => {
  let doc: EventTarget & {
    visibilityState: DocumentVisibilityState;
    defaultView: EventTarget;
    hasFocus: () => boolean;
  };
  let focused: boolean;
  let paint: FrameRequestCallback;
  let requestFrame: ReturnType<typeof vi.fn>;
  let cancelFrame: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    focused = true;
    doc = Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
      defaultView: new EventTarget(),
      hasFocus: () => focused,
    });
    requestFrame = vi.fn((callback: FrameRequestCallback) => {
      paint = callback;
      return 7;
    });
    cancelFrame = vi.fn();
    vi.stubGlobal("document", doc);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("보이는 탭에서는 다음 프레임까지 기다리고 폴백을 정리한다", async () => {
    const done = vi.fn();
    const work = defaultYieldToUi().then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    paint(0);
    await work;
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("숨은 탭에서는 프레임과 타이머가 모두 멈춰도 이벤트 루프를 양보한다", async () => {
    doc.visibilityState = "hidden";
    const done = vi.fn();
    const work = defaultYieldToUi().then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled(); // 즉시 resolve하는 마이크로태스크 루프도 금지.
    // 가짜 타이머를 전진시키지 않는다. 실제 MessageChannel 태스크가 완료해야 한다.
    await work;
    expect(done).toHaveBeenCalledOnce();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("프레임을 기다리던 중 탭을 숨겨도 타이머 없이 이어지고 리스너를 정리한다", async () => {
    const removeListener = vi.spyOn(doc, "removeEventListener");
    const done = vi.fn();
    const work = defaultYieldToUi().then(done);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    await work;
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(removeListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    paint(0); // 취소 직전 이미 큐에 들어온 콜백도 중복 완료시키지 않는다.
    expect(done).toHaveBeenCalledOnce();
  });

  it("보이지만 포커스가 없는 창도 프레임과 타이머 없이 이어진다", async () => {
    focused = false;
    await defaultYieldToUi();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("프레임 대기 중 다른 창으로 포커스를 옮겨도 이어지고 blur 리스너를 정리한다", async () => {
    const removeListener = vi.spyOn(doc.defaultView, "removeEventListener");
    const work = defaultYieldToUi();
    focused = false;
    doc.defaultView.dispatchEvent(new Event("blur"));
    await work;
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(removeListener).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("보인다고 보고하지만 프레임이 멈추면 타이머로 이어지고 프레임을 취소한다", async () => {
    const work = defaultYieldToUi();
    await vi.advanceTimersByTimeAsync(YIELD_TO_UI_FALLBACK_MS);
    await work;
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rAF 호출이 실패해도 폴백으로 완료한다", async () => {
    requestFrame.mockImplementation(() => { throw new Error("rAF unavailable"); });
    const work = defaultYieldToUi();
    await vi.advanceTimersByTimeAsync(YIELD_TO_UI_FALLBACK_MS);
    await work;
  });

  it.each([undefined, class { constructor() { throw new Error("MessageChannel unavailable"); } }])(
    "MessageChannel을 쓸 수 없는 숨은 탭은 타이머로 양보한다 (%s)",
    async (channel) => {
      vi.stubGlobal("MessageChannel", channel);
      doc.visibilityState = "hidden";
      const work = defaultYieldToUi();
      await vi.runAllTimersAsync();
      await work;
      expect(requestFrame).not.toHaveBeenCalled();
    },
  );

  it("프레임 API가 없는 Node에서는 브라우저 자원 없이 완료한다", async () => {
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("requestAnimationFrame", undefined);
    await defaultYieldToUi();
    expect(vi.getTimerCount()).toBe(0);
  });
});
