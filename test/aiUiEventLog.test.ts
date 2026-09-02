// AI 표면 프론트 액션 수집기(src/ai/uiEventLog.ts) 계약.
//
// 왜 이 4가지를 잠그는가: 이 모듈은 «빠짐없이 남기기» 를 위해 document capture 를 쓴다. 그 힘
// 때문에 틀리면 (a) 조수와 무관한 클릭까지 삼켜 로그가 수십 배로 늘고, (b) 링버퍼가 넘쳐
// 정작 필요한 구간이 사라지고, (c) 최악으로는 입력을 가로채 기능을 죽인다. 특히 (c) 는
// 2026-08-19 에 전면 투명 레이어가 맵 클릭을 삼켜 P0 이 된 것과 같은 실패 방식이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiUiEventMarker,
  clearAiUiEvents,
  flushAiUiEvents,
  installAiUiEventCapture,
  listAiUiEvents,
  recordAiUiEvent,
  resetAiUiEventLogForTest,
  resolveAiUiSurface,
  setAiUiEventSink,
  takeAiUiEventsSince,
} from "@/ai/uiEventLog";
import type { AiUiEvent } from "@/ai/uiEventTypes";

function stubStorage(): void {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  });
}

describe("ai ui event log", () => {
  beforeEach(() => {
    stubStorage();
    resetAiUiEventLogForTest();
  });

  afterEach(() => {
    resetAiUiEventLogForTest();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps at most 300 events and drops the oldest", () => {
    for (let index = 0; index < 320; index += 1) {
      recordAiUiEvent({ surface: "panel", action: `click:btn-${index}` });
    }
    const rows = listAiUiEvents();
    expect(rows).toHaveLength(300);
    expect(rows[0]?.action).toBe("click:btn-20");
    expect(rows.at(-1)?.action).toBe("click:btn-319");
  });

  it("slices a turn window by monotonic seq, not by index", () => {
    recordAiUiEvent({ surface: "panel", action: "click:before" });
    const marker = aiUiEventMarker();
    recordAiUiEvent({ surface: "panel", action: "click:during-1" });
    recordAiUiEvent({ surface: "context-panel", action: "context-compact" });
    expect(takeAiUiEventsSince(marker).map((event) => event.action)).toEqual([
      "click:during-1",
      "context-compact",
    ]);
    // 두 번 꺼내도 같은 구간이 나온다 — 소비가 아니라 조회다(턴 행 + ui 행이 둘 다 싣는다).
    expect(takeAiUiEventsSince(marker)).toHaveLength(2);
  });

  it("carries the detail payload that the click alone cannot tell", () => {
    recordAiUiEvent({
      surface: "context-panel",
      action: "context-compact",
      label: "context-compact",
      detail: { beforeTokens: 110_869, afterTokens: 21_004 },
    });
    expect(listAiUiEvents(1)[0]?.detail).toEqual({ beforeTokens: 110_869, afterTokens: 21_004 });
    expect(listAiUiEvents(1)[0]?.reason).toBe("사용자 클릭: context-compact");
  });

  it("flushes a batch to the sink and clears pending", () => {
    const seen: AiUiEvent[][] = [];
    setAiUiEventSink((events) => seen.push([...events]));
    recordAiUiEvent({ surface: "panel", action: "click:a" });
    recordAiUiEvent({ surface: "panel", action: "click:b" });
    flushAiUiEvents();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.map((event) => event.action)).toEqual(["click:a", "click:b"]);
    flushAiUiEvents();
    expect(seen).toHaveLength(1); // 빈 flush 는 sink 를 부르지 않는다
  });

  it("survives a sink that throws — 기록이 앱을 죽이면 안 된다", () => {
    setAiUiEventSink(() => {
      throw new Error("remote down");
    });
    recordAiUiEvent({ surface: "panel", action: "click:a" });
    expect(() => flushAiUiEvents()).not.toThrow();
  });

  it("keeps the ring in memory when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    resetAiUiEventLogForTest();
    const marker = aiUiEventMarker();
    recordAiUiEvent({ surface: "panel", action: "click:a" });
    expect(listAiUiEvents().map((event) => event.action)).toEqual(["click:a"]);
    expect(takeAiUiEventsSince(marker)).toHaveLength(1);
  });

  describe("delegated capture", () => {
    class FakeElement {
      constructor(
        readonly matchList: readonly string[],
        readonly testid: string | null,
        readonly text = "",
      ) {}
      closest(selector: string): FakeElement | null {
        if (selector === "[data-testid]") return this.testid === null ? null : this;
        return this.matchList.includes(selector) ? this : null;
      }
      getAttribute(): string | null {
        return null;
      }
      get dataset(): { testid?: string } {
        return this.testid === null ? {} : { testid: this.testid };
      }
      get textContent(): string {
        return this.text;
      }
    }

    type Listener = (event: unknown) => void;

    function fakeDocument(): {
      readonly target: Parameters<typeof installAiUiEventCapture>[0];
      dispatch: (type: string, event: unknown) => void;
      readonly captureFlags: boolean[];
    } {
      const listeners = new Map<string, Listener[]>();
      const captureFlags: boolean[] = [];
      const target = {
        addEventListener: (type: string, listener: Listener, capture?: boolean) => {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
          if (capture !== undefined) captureFlags.push(capture);
        },
        removeEventListener: (type: string, listener: Listener) => {
          listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
        },
        defaultView: null,
      };
      return {
        target: target as unknown as Parameters<typeof installAiUiEventCapture>[0],
        dispatch: (type, event) => (listeners.get(type) ?? []).forEach((listener) => listener(event)),
        captureFlags,
      };
    }

    it("records clicks inside AI surfaces and ignores everything else", () => {
      const doc = fakeDocument();
      // FakeElement 는 instanceof Element 를 통과하지 못하므로 전역 Element 를 갈아둔다.
      vi.stubGlobal("Element", FakeElement);
      installAiUiEventCapture(doc.target);

      doc.dispatch("click", {
        type: "click",
        target: new FakeElement([".ai-chat-panel"], "ai-send", "보내기"),
      });
      // 맵 캔버스는 계측 범위 밖이다 — AI 표면 선택자에 안 걸리므로 아무것도 남지 않아야 한다.
      doc.dispatch("click", {
        type: "click",
        target: new FakeElement([".map-canvas"], "map-canvas"),
      });
      // AI 표면 안이지만 testid 가 없으면 나중에 무엇이었는지 못 읽는다 — 남기지 않는다.
      doc.dispatch("click", {
        type: "click",
        target: new FakeElement([".ai-chat-panel"], null, "여백"),
      });

      const rows = listAiUiEvents();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.action).toBe("click:ai-send");
      expect(rows[0]?.surface).toBe("panel");
      expect(rows[0]?.label).toBe("보내기");
    });

    it("never calls preventDefault or stopPropagation — 읽기 전용 관찰자다", () => {
      const doc = fakeDocument();
      vi.stubGlobal("Element", FakeElement);
      installAiUiEventCapture(doc.target);
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      const stopImmediatePropagation = vi.fn();
      doc.dispatch("click", {
        type: "click",
        target: new FakeElement([".ai-chat-panel"], "ai-send"),
        preventDefault,
        stopPropagation,
        stopImmediatePropagation,
      });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
      expect(stopImmediatePropagation).not.toHaveBeenCalled();
      // capture 단계로 붙는다(click/change 각각) — 그래서 삼키지 않는 것이 계약으로 중요하다.
      expect(doc.captureFlags.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    });

    it("installs one listener set even when called twice", () => {
      const doc = fakeDocument();
      vi.stubGlobal("Element", FakeElement);
      installAiUiEventCapture(doc.target);
      installAiUiEventCapture(doc.target);
      doc.dispatch("click", {
        type: "click",
        target: new FakeElement([".ai-chat-panel"], "ai-send"),
      });
      expect(listAiUiEvents()).toHaveLength(1);
    });
  });

  it("resolves the narrowest surface first", () => {
    const inModal = {
      closest: (selector: string) =>
        selector === ".ai-history-window" || selector === ".ai-chat-panel" ? {} : null,
    } as unknown as Element;
    expect(resolveAiUiSurface(inModal)).toBe("history-modal");
    expect(resolveAiUiSurface(null)).toBeNull();
  });

  it("clears the buffer on demand", () => {
    recordAiUiEvent({ surface: "panel", action: "click:a" });
    clearAiUiEvents();
    expect(listAiUiEvents()).toHaveLength(0);
  });
});
