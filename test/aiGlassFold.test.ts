// 유리 도크(왼쪽 위 조수)의 본문 접힘(fold) 계약.
//
// `is-collapsed`(48px 칩)와 다른 축이다: fold 는 `.ai-chat-body` 만 접고 입력줄·완료
// 스트립은 남긴다. 그래서 2026-08-27 에 걷어낸 "턴 뒤 자동 접기"를 되살리면서도 답이
// 얼굴 뒤로 사라지지 않는다 — 이 파일이 그 안전핀들을 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { GLASS_FOLD_IDLE_MS, renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const assistantMock = vi.hoisted(() => {
  const sentMessages: string[] = [];

  class MockAssistantSession {
    constructor(_project: unknown, _options: unknown) {}

    async sendUserMessage(text: string, _onEvent: (event: unknown) => void): Promise<{
      assistantText: string;
      proposedCalls: [];
      stoppedReason: "final";
    }> {
      sentMessages.push(text);
      return { assistantText: "완료.", proposedCalls: [], stoppedReason: "final" };
    }

    getAuditEntries(): [] {
      return [];
    }

    getActiveSpec(): null {
      return null;
    }

    getProposedProject(): ReturnType<typeof store.getCurrent> {
      return store.getCurrent();
    }

    getHarnessSnapshot(): null {
      return null;
    }

    updateConfig(_config: unknown): void {}
  }

  return {
    MockAssistantSession,
    sentMessages,
    reset() {
      sentMessages.length = 0;
    },
  };
});

vi.mock("@/ai/assistantSession", () => ({
  AssistantSession: assistantMock.MockAssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS: 48,
  METADATA_ONLY_TOOLS: new Set(["set_tile_metadata", "set_tile_rules", "upsert_tile_group"]),
}));

type ChatDock = "glass" | "side" | "float";

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

function installFakeWindow(): () => void {
  const previous = globalThis.window;
  const listeners = new Map<string, Set<EventListener>>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      innerHeight: 900,
      innerWidth: 1440,
      location: { search: "aiBridge=0" },
      addEventListener: (type: string, listener: EventListener) => {
        const bucket = listeners.get(type) ?? new Set<EventListener>();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event): boolean => {
        for (const listener of listeners.get(event.type) ?? []) listener(event);
        return true;
      },
      clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
      setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
      setInterval: (...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args),
      clearInterval: (...args: Parameters<typeof clearInterval>) => globalThis.clearInterval(...args),
    },
  });
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "window");
      return;
    }
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previous });
  };
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function renderPanel(dock: ChatDock = "glass"): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel({ getChatDock: () => dock }));
}

function bridge(): { send: (text: string) => Promise<unknown> } {
  const found = (globalThis.window as unknown as {
    __oprnAiBridge?: { send: (text: string) => Promise<unknown> };
  }).__oprnAiBridge;
  if (!found) throw new Error("__oprnAiBridge 가 없다");
  return found;
}

/** 턴을 한 번 돌려 fold 타이머를 무장시킨다. */
async function runTurn(text = "안녕"): Promise<void> {
  await bridge().send(text);
  await flushAsync();
}

async function idle(extraMs = 50): Promise<void> {
  await vi.advanceTimersByTimeAsync(GLASS_FOLD_IDLE_MS + extraMs);
  await flushAsync();
}

beforeEach(() => {
  assistantMock.reset();
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  restoreWindow = installFakeWindow();
  installFakeLocalStorage();
  vi.useFakeTimers();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-or-test" }));
  const mapId = store.getCurrent().startMapId;
  editorState.set({
    currentMapId: mapId,
    layer: "lower",
    tool: "paint",
    selection: null,
    chatDock: "glass",
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreWindow?.();
  restoreWindow = null;
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("유리 도크 본문 접힘(fold)", () => {
  it("glass 는 접힌 입력줄로 부팅한다 — 칩 접힘(is-collapsed)은 쓰지 않는다", () => {
    const panel = renderPanel("glass");
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });

  it("저장된 칩 접힘 '1' 도 glass 에서는 fold 로 라우팅된다 — 새 키를 쓰지 않는다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel("glass");
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    // fold 는 저장하지 않는다 — 사용자가 명시한 칩 접힘 값은 건드리지 않는다.
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");
  });

  it("접혀 있어도 입력줄이 살아 있고, 대화 본문만 inert 가 된다", () => {
    const panel = renderPanel("glass");
    expect(panel.classList.contains("is-glass-folded")).toBe(true);

    const input = findByTestId(panel, "ai-input");
    const send = findByTestId(panel, "ai-send");
    expect(input).toBeTruthy();
    expect(send).toBeTruthy();
    expect(input?.hidden).toBe(false);
    expect(send?.hidden).toBe(false);
    expect(input?.style.display ?? "").not.toBe("none");

    const body = panel.querySelector(".ai-chat-body");
    expect(body?.inert).toBe(true);
  });

  it("셰브론을 누르면 펼쳐지고 aria-expanded 가 따라온다", () => {
    const panel = renderPanel("glass");
    const chevron = findByTestId(panel, "ai-collapse");
    expect(chevron?.getAttribute("aria-expanded")).toBe("false");

    chevron?.click();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(chevron?.getAttribute("aria-expanded")).toBe("true");
    expect(panel.querySelector(".ai-chat-body")?.inert).toBe(false);

    chevron?.click();
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
    expect(chevron?.getAttribute("aria-expanded")).toBe("false");
  });

  it("셰브론으로 직접 펼친 것은 유휴 시간이 지나도 접히지 않는다", async () => {
    const panel = renderPanel("glass");
    findByTestId(panel, "ai-collapse")?.click();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);

    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
  });

  it("접힌 채 전송하면 즉시 펼쳐지고, 턴이 끝나고 유휴 시간이 지나면 다시 접힌다", async () => {
    const panel = renderPanel("glass");
    expect(panel.classList.contains("is-glass-folded")).toBe(true);

    await runTurn("지도 그려줘");
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
    expect(assistantMock.sentMessages).toHaveLength(1);

    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
  });

  it("실패한 턴(is-turn-error)은 유휴 시간이 지나도 접지 않는다", async () => {
    const panel = renderPanel("glass");
    await runTurn();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);

    panel.classList.add("is-turn-error");
    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);
  });

  it("입력창에 쓰던 내용이 남아 있으면 접지 않는다", async () => {
    const panel = renderPanel("glass");
    await runTurn();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);

    const input = findByTestId(panel, "ai-input");
    expect(input).toBeTruthy();
    input!.value = "아직 쓰던 중";
    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);

    // 지우면 다음 유휴에 접힌다 — 조작이 타이머를 다시 센다.
    input!.value = "";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
  });

  it("포인터가 카드 위에 있으면 접지 않고, 떠나면 다시 센다", async () => {
    const panel = renderPanel("glass");
    await runTurn();

    panel.dispatchEvent(new Event("pointerenter"));
    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(false);

    panel.dispatchEvent(new Event("pointerleave"));
    await idle();
    expect(panel.classList.contains("is-glass-folded")).toBe(true);
  });

  it("side·float 에는 fold 가 붙지 않고 칩 접힘 계약이 그대로다", async () => {
    for (const dock of ["side", "float"] as const) {
      const panel = renderPanel(dock);
      expect(panel.classList.contains("is-glass-folded")).toBe(false);
      // 저장값 없는 첫 방문은 칩 접힘도 아니다(기존 계약).
      expect(panel.classList.contains("is-collapsed")).toBe(false);
      expect(panel.querySelector(".ai-chat-body")?.inert).toBe(false);

      await runTurn();
      await idle();
      expect(panel.classList.contains("is-glass-folded")).toBe(false);
    }
  });
});
