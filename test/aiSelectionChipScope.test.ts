// 선택 칩을 × 로 해제하면 그 턴의 스코프도 사라져야 한다 — 2026-09-03 적대적 리뷰 13(해제 뒤에도 옛 영역 안에만 시공).
// 그리고 대기 상태(idle)에서도 선택 칩은 보여야 한다 — 스코프가 붙는지 사용자가 볼 수 있어야 × 를 누를 수 있다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { completeChatTurn, completeRegionTurn } from "./helpers/aiChatTestSignals";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
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
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", agentMode: "chat" }));
  editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
});

afterEach(() => {
  teardownAiChatPanel();
  editorState.set({ selection: null });
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
});

describe("선택 칩 해제와 턴 스코프", () => {
  it("× 로 해제한 뒤 보내면 세션 스코프가 null 이고 영역 실행부를 타지 않는다", async () => {
    const sendSpy = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue({
      assistantText: "",
      proposedCalls: [],
      stoppedReason: "final",
    });
    const regionRunner = vi.fn();
    const panel = renderAiChatPanel({ regionTaskRunner: regionRunner as never }) as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    expect(findByTestId(panel, "ai-selection-chip")).toBeTruthy();
    (findByTestId(panel, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(findByTestId(panel, "ai-selection-chip")).toBeFalsy();

    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "나무 세 그루 심어줘";
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());

    expect(regionRunner).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const options = sendSpy.mock.calls[0]?.[3];
    expect(options?.scope ?? null).toBeNull();
    // 컨텍스트 꼬리표에도 선택 영역이 남지 않는다.
    expect(String(sendSpy.mock.calls[0]?.[0])).not.toContain("사용자 선택 영역");
  });

  it("칩이 살아 있으면 영역 실행부로 간다(대조군)", async () => {
    const sendSpy = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue({
      assistantText: "",
      proposedCalls: [],
      stoppedReason: "final",
    });
    const regionRunner = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, mapsAdded: 0, clippedCells: 0, proposedCalls: 0, assistantText: "",
    }));
    const panel = renderAiChatPanel({ regionTaskRunner: regionRunner as never }) as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "여기 물 채워줘";
    await completeRegionTurn(panel, () => findByTestId(panel, "ai-send")?.click());
    expect(regionRunner).toHaveBeenCalledTimes(1);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("대기 상태에서도 선택 칩은 보인다", () => {
  it("선택 칩이 붙으면 칩 호스트에 has-selection-scope 가 서고, 해제하면 내려간다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    const host = findByTestId(panel, "ai-context-chips") as unknown as HTMLElement;
    expect(host.classList.contains("has-selection-scope")).toBe(false);
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(host.classList.contains("has-selection-scope")).toBe(true);
    (findByTestId(panel, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(host.classList.contains("has-selection-scope")).toBe(false);
  });

  it("idle 패널에서 has-selection-scope 칩 호스트의 사용 display 는 none 이 아니다", () => {
    // 이름 붙인 파괴: 12-assistant-temperature.css 의 idle 숨김을 그대로 두면 display 가 none 으로 남는다.
    const css = readFileSync(resolve("src/styles/database/tabs-b-assistant-panel/12-assistant-temperature.css"), "utf8");
    const window = new Window();
    try {
      const doc = window.document;
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.append(style);
      const panel = doc.createElement("aside");
      panel.className = "ai-chat-panel is-assistant-idle";
      const plain = doc.createElement("div");
      plain.className = "ai-context-chips";
      const scoped = doc.createElement("div");
      scoped.className = "ai-context-chips has-selection-scope";
      panel.append(plain, scoped);
      doc.body.append(panel);
      expect(window.getComputedStyle(plain).display).not.toBe("none");
      expect(window.getComputedStyle(scoped).display).not.toBe("none");
    } finally {
      window.close();
    }
  });
});

describe("컴포저 힌트는 숨을 때 자리를 비운다", () => {
  it("키 힌트는 별도 행 없이 입력창 title로 제공된다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input");
    expect(panel.querySelector(".ai-composer-hint")).toBeNull();
    expect(input?.getAttribute("title")).toBeTruthy();
    input?.dispatchEvent(new Event("focus"));
    expect(panel.querySelector(".ai-composer-hint")).toBeNull();
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
  });
});
