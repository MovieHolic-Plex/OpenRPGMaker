// UXA AI 채팅 패널 수리 회귀: 중단, 진행 표시, 대화 복원, 키 온보딩, 로그/추론/칩.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import {
  AI_CONFIG_STORAGE_KEY,
  LlmAbortError,
  defaultAiConfig,
  type ChatRequest,
  type ChatResult,
} from "@/ai/llmClient";
import {
  failedToolRetrySummary,
  formatAiRunningStatus,
  formatToolActivityLine,
  isAiConfigReady,
  reasoningToggleText,
  renderAiChatPanel,
  renderToolActivityEntry,
} from "@/editor/panels/aiChatPanel";
import type { RegionTaskOptions, RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { editorState } from "@/editor/editorState";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { clearConversations, projectConversationContextKey, saveConversation } from "@/ai/conversationStore";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;
let restoreWindow: (() => void) | null = null;

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

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function renderPanel(options: Parameters<typeof renderAiChatPanel>[0] = {}): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000, ...options }) as unknown as FakeElement;
}

function installFakeWindow(): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget() as EventTarget & Partial<Window> & { __rpgzzuSkillHotkey?: boolean };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: target,
  });
  restoreWindow = () => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
    restoreWindow = null;
  };
}

function dispatchInputKey(input: HTMLElement, key: string): void {
  const event = new Event("keydown");
  Object.defineProperty(event, "key", { configurable: true, value: key });
  Object.defineProperty(event, "shiftKey", { configurable: true, value: false });
  Object.defineProperty(event, "isComposing", { configurable: true, value: false });
  input.dispatchEvent(event);
}

beforeEach(() => {
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
});

describe("선택 영역 AI 직결 칩", () => {
  it("드래그 완료 신호로 칩을 붙이고 선택 변경/X/Escape/선택 해제를 반영한다", () => {
    installFakeWindow();
    const project = store.getCurrent();
    const mapId = project.startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 2, y: 3, width: 4, height: 5 } });
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;

    requestAiSelectionContext(editorState.get().selection);

    expect(findByTestId(panel, "ai-selection-chip")?.textContent).toContain("선택 (2,3) 4×5");
    expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(input);

    editorState.set({ selection: { mapId, x: 7, y: 8, width: 2, height: 3 } });
    expect(findByTestId(panel, "ai-selection-chip")?.textContent).toContain("선택 (7,8) 2×3");

    findByTestId(panel, "ai-selection-chip-clear")?.click();
    expect(findByTestId(panel, "ai-selection-chip")).toBeNull();

    requestAiSelectionContext(editorState.get().selection);
    dispatchInputKey(input, "Escape");
    expect(findByTestId(panel, "ai-selection-chip")).toBeNull();

    requestAiSelectionContext(editorState.get().selection);
    expect(findByTestId(panel, "ai-selection-chip")).toBeTruthy();
    editorState.set({ selection: null });
    expect(findByTestId(panel, "ai-selection-chip")).toBeNull();
  });

  it("칩이 붙은 상태에서 Enter 제출은 runRegionTask 러너로 선택 영역을 넘긴다", async () => {
    installFakeWindow();
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const runner = vi.fn(async (options: RegionTaskOptions): Promise<RegionTaskResult> => {
      options.onEvent?.({ type: "status", text: "영역 작업 시작" });
      options.onEvent?.({ type: "tool_call", name: "paint_tiles", args: { count: 2 }, result: { ok: true, summary: "타일 2칸" } });
      options.onEvent?.({ type: "assistant_message", content: "완료했습니다." });
      return { ok: true, applied: true, changedCells: 2, clippedCells: 1, proposedCalls: 1, assistantText: "" };
    });
    editorState.set({ currentMapId: mapId, selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });
    const panel = renderPanel({ regionTaskRunner: runner });
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    requestAiSelectionContext(editorState.get().selection);

    input.value = "여기를 모래밭으로";
    dispatchInputKey(input, "Enter");
    await flushAsync();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0]?.[0]).toMatchObject({
      instruction: "여기를 모래밭으로",
      mapId,
      region: { x: 1, y: 2, width: 3, height: 4 },
    });
    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(logText).toContain("영역 작업 시작");
    expect(logText).toContain("paint_tiles");
    expect(logText).toContain("완료했습니다.");
    expect(logText).toContain("완료 — 2칸 변경 · 영역 밖 1칸 차단");
  });
});

describe("진행 상태와 중단", () => {
  it("진행 배지는 경과초와 도구 카운터를 함께 표시한다", () => {
    expect(formatAiRunningStatus(0, 37_400, 5)).toBe("생각 중… 37초 · 도구 5/30");
  });

  it("오케스트레이션 phase가 있으면 진행 배지에 phase 라벨을 합쳐 표시한다", () => {
    expect(formatAiRunningStatus(0, 12_400, 3, 200, "계획 중(m3)")).toBe("계획 중(m3) … 12초 · 도구 3/200");
    expect(formatAiRunningStatus(0, 45_900, 12, 200, "실행 중(flash)")).toBe("실행 중(flash) … 45초 · 도구 12/200");
  });

  it("진행 배지는 음수 경과시간을 0초로 보정한다", () => {
    expect(formatAiRunningStatus(10_000, 9_000, 0)).toBe("생각 중… 0초 · 도구 0/30");
  });

  it("패널에 중단 버튼이 있고 기본 상태에서는 비활성화되어 있다", () => {
    const panel = renderPanel();
    const abort = findByTestId(panel, "ai-abort");
    expect(abort).toBeTruthy();
    expect(abort?.hidden).toBe(true);
    expect(abort?.disabled).toBe(true);
    expect(abort?.getAttribute("aria-label")).toBe("AI 응답 중단");
  });

  it("AssistantSession은 AbortSignal을 LLM 호출에 전달하고 중단 결과로 종료한다", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      receivedSignal = req.signal;
      return await new Promise((_resolve, reject) => {
        req.signal?.addEventListener("abort", () => reject(new LlmAbortError()));
      });
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk-test" },
      chat,
    });

    const pending = session.sendUserMessage("길 깔아줘", () => {}, controller.signal);
    await Promise.resolve();
    controller.abort();
    const result = await pending;

    expect(receivedSignal).toBe(controller.signal);
    expect(result.stoppedReason).toBe("aborted");
    expect(result.error).toBe("사용자가 중단했습니다");
    expect(session.canRetryLastTurn()).toBe(false);
  });
});

describe("도구 로그와 추론 표시", () => {
  it("파괴적 도구 성공 로그에는 초안 접두를 붙인다", () => {
    expect(formatToolActivityLine("remove_map", { ok: true, summary: "맵 삭제됨" })).toContain("(초안)");
    expect(formatToolActivityLine("paint_road", { ok: true, summary: "길 5칸" })).not.toContain("(초안)");
  });

  it("실패 도구 요약은 내부 재시도 횟수를 추출한다", () => {
    expect(failedToolRetrySummary("밑그림 검증 실패(3회) — 계획 폐기")).toBe("내부 재시도 3회");
    expect(failedToolRetrySummary("실행 실패")).toBe("내부 재시도 1회");
  });

  it("실패 도구 행은 details로 접히고 원시 실패 문구를 기본 문구에 드러내지 않는다", () => {
    const entry = renderToolActivityEntry("set_build_spec", {
      ok: false,
      summary: "밑그림 검증 실패(3회) — id를 생략하세요",
    }) as unknown as FakeElement;
    const summary = findByTestId(entry, "ai-tool-failure-summary");
    expect(entry.tagName).toBe("DETAILS");
    expect(summary?.textContent).toContain("내부 재시도 3회");
    expect(entry.textContent).not.toContain("id를 생략하세요");
  });

  it("연속 추론 토글 문구는 병합 횟수를 표시한다", () => {
    expect(reasoningToggleText(7, true)).toBe("💭 추론 7회 보기 ▸");
    expect(reasoningToggleText(7, false)).toBe("💭 추론 7회 ▾");
  });
});

describe("대화 복원과 내보내기", () => {
  it("같은 프로젝트 컨텍스트의 직전 대화는 부팅 시 자동 복원된다", () => {
    const project = store.getCurrent();
    saveConversation({
      id: "conv_same",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: projectConversationContextKey(project),
      entries: [
        { kind: "user", text: "마을 만들어줘\n\n[컨텍스트] 현재 맵: 빈 맵" },
        { kind: "assistant", text: "초안을 준비했습니다." },
      ],
    });

    const panel = renderPanel();
    expect(findByTestId(panel, "ai-start-screen")).toBeNull();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("마을 만들어줘");
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).not.toContain("[컨텍스트]");
    expect(findByTestId(panel, "ai-export")?.disabled).toBe(false);
  });

  it("다른 프로젝트 컨텍스트의 직전 대화는 자동 복원하지 않고 이어가기 진입점을 보인다", () => {
    saveConversation({
      id: "conv_other",
      title: "다른 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "other-project",
      entries: [{ kind: "user", text: "다른 요청" }],
    });

    const panel = renderPanel();
    expect(findByTestId(panel, "ai-start-screen")).toBeTruthy();
    expect(findByTestId(panel, "ai-resume-conversation")).toBeTruthy();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).not.toContain("다른 요청");

    findByTestId(panel, "ai-resume-conversation")?.click();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("다른 요청");
  });

  it("내보내기는 빈 대화에서 비활성화되고 라벨은 내보내기다", () => {
    clearConversations();
    const panel = renderPanel();
    const button = findByTestId(panel, "ai-export");
    expect(button?.textContent).toBe("내보내기");
    expect(button?.disabled).toBe(true);
  });
});

describe("키 온보딩과 설정 접근성", () => {
  it("하단 커맨드 바에 입력과 확장 메뉴를 마운트한다", () => {
    const panel = renderPanel();
    const commandBar = findByTestId(panel, "ai-command-bar");
    const menu = findByTestId(panel, "ai-command-menu");

    expect(commandBar).toBeTruthy();
    expect(findByTestId(commandBar!, "ai-input")).toBeTruthy();
    expect(findByTestId(commandBar!, "ai-send")).toBeTruthy();
    expect(findByTestId(commandBar!, "ai-context-chips")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeTruthy();
    expect(menu?.hidden).toBe(true);

    findByTestId(panel, "ai-command-menu-toggle")?.click();
    expect(menu?.hidden).toBe(false);
    expect(menu?.textContent).toContain("전체 기록");
    expect(menu?.textContent).toContain("새 대화");
    expect(menu?.textContent).toContain("설정");
    expect(menu?.textContent).toContain("스튜디오");
    expect((globalThis.document as unknown as { body: FakeElement }).body.classList.contains("ai-command-bar-active")).toBe(true);
  });

  it("키가 없으면 전송 전에 설정을 열고 API 키 입력에 포커스하며 안내를 중복하지 않는다", () => {
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send");
    input.value = "마을 만들어줘";

    send?.click();
    send?.click();

    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(input.value).toBe("마을 만들어줘");
    expect((logText.match(/API 키가 필요합니다/gu) ?? []).length).toBe(1);
    expect(findByTestId(panel, "ai-config")?.getAttribute("open")).toBe("");
    expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(findByTestId(panel, "ai-config-apikey"));
    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
  });

  it("401 오류 버블에도 설정 열기 버튼을 붙인다", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "bad-key" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no key", { status: 401 })));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "테스트";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("인증 실패");
  });

  it("설정 아이콘은 펼친 상태로 열고 첫 입력에 포커스한다", () => {
    const panel = renderPanel();
    findByTestId(panel, "ai-settings-toggle")?.click();

    expect(findByTestId(panel, "ai-config")?.getAttribute("open")).toBe("");
    expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(findByTestId(panel, "ai-config-baseurl"));
  });

  it("AI 패널의 아이콘 버튼에는 aria-label이 있다", () => {
    const panel = renderPanel();
    for (const testId of ["ai-settings-toggle", "ai-tools-browser", "ai-collapse", "chat-dock-toggle", "ai-dock-toggle", "ai-studio-toggle", "ai-skill-slash-toggle"]) {
      expect(findByTestId(panel, testId)?.getAttribute("aria-label"), testId).toBeTruthy();
    }
  });

  it("설정 준비 판정은 API 키까지 확인한다", () => {
    expect(isAiConfigReady({ ...defaultAiConfig(), apiKey: "" })).toBe(false);
    expect(isAiConfigReady({ ...defaultAiConfig(), apiKey: "sk-test" })).toBe(true);
  });
});

describe("현재 맵 칩", () => {
  it("스토어에서 현재 맵 이름이 바뀌면 컨텍스트 칩도 즉시 갱신된다", () => {
    const panel = renderPanel();
    const mapId = store.getCurrent().startMapId;
    store.update((draft) => {
      draft.maps[mapId].name = "숲 속 작은 마을";
    });

    expect(findByTestId(panel, "ai-context-chips")?.textContent).toContain("숲 속 작은 마을");
  });
});
