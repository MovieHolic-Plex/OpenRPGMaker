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
import { failedToolRetrySummary, failedToolVisibleSummary, formatAiRunningStatus, formatToolActivityLine, isAiConfigReady, reasoningToggleText, renderAiChatPanel, renderToolActivityEntry, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import type { RegionTaskOptions, RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { editorState } from "@/editor/editorState";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { getInlineProposalActions, setInlineProposalActions } from "@/editor/proposalInlineApproval";
import { clearConversations, conversationScopeKey, loadLatestConversation, saveConversation } from "@/ai/conversationStore";
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
  return renderAiChatPanel({ clock: () => 37_000, getChatDock: () => "side", ...options }) as unknown as FakeElement;
}

function installFakeWindow(): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget() as EventTarget & Partial<Window> & { __oprnSkillHotkey?: boolean };
  target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
  target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
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
  // .env 의 VITE_LLM_API_URL 이 테스트 환경까지 로드되어 defaultAiConfig 가 apiKey 모드로
  // 바뀌는 것을 막고, 이 파일의 "chatgpt 기본" 전제를 deterministic 하게 유지한다.
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(async () => {
  // 패널을 살려두면 진행 중 턴이 restoreDom 이후에도 죽은 DOM 에 버블을 쓰고(실측: 이 파일에서
  // "document is not defined" unhandled rejection 4건), dispose 의 persistConversation 이 다음
  // 테스트의 clearConversations 뒤에 대화를 되살려 내보내기 버튼 상태까지 오염시켰다.
  teardownAiChatPanel();
  await clearConversations();
  setInlineProposalActions(null);
  restoreWindow?.();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
      expect(options.gate).toBe("immediate");
      expect(getInlineProposalActions()).toBeNull();
      options.onEvent?.({ type: "status", text: "영역 작업 시작" });
      options.onEvent?.({ type: "tool_call", name: "paint_tiles", args: { count: 2 }, result: { ok: true, summary: "타일 2칸" } });
      options.onEvent?.({ type: "assistant_message", content: "완료했습니다." });
      return { ok: true, applied: true, changedCells: 2, changedEvents: 0, clippedCells: 1, proposedCalls: 1, assistantText: "" };
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
      gate: "immediate",
    });
    expect(getInlineProposalActions()).toBeNull();
    // Status stays off the work log. Tool names are sanitized; the row is a command row, not a bubble.
    expect(findByTestId(panel, "ai-status")?.textContent).not.toBe("영역 작업 시작");
    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(logText).not.toContain("영역 작업 시작");
    expect(findByTestId(panel, "ai-command-row")).toBeTruthy();
    expect(findByTestId(panel, "ai-tool-activity")).toBeTruthy();
    expect(logText).toContain("타일 2칸");
    expect(logText).toContain("완료했습니다.");
    expect(logText).toContain("적용됨 — 2칸 타일 · 영역 밖 1칸 차단");
    expect(logText).not.toContain("적용 여부를 선택하세요");
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("적용됨");

    await whenAiChatPanelSettled();
    const userEntry = (await loadLatestConversation())?.entries.find((entry) => entry.kind === "user");
    expect(userEntry?.kind).toBe("user");
    if (userEntry?.kind !== "user") throw new Error("region user audit entry missing");
    expect(userEntry.context).toMatchObject({
      mapId,
      mapName: project.maps[mapId]?.name,
      mapWidth: project.maps[mapId]?.width,
      mapHeight: project.maps[mapId]?.height,
      selection: { mapId, x: 1, y: 2, width: 3, height: 4 },
    });
    teardownAiChatPanel();
    await clearConversations();
  });
});

describe("진행 상태와 중단", () => {
  it("진행 배지는 경과초와 도구 카운터를 함께 표시한다", () => {
    expect(formatAiRunningStatus(0, 37_400, 5)).toBe("생각 중… 37초 · 도구 5");
  });

  it("오케스트레이션 phase가 있으면 진행 배지에 phase 라벨을 합쳐 표시한다", () => {
    expect(formatAiRunningStatus(0, 12_400, 3, 200, "계획 중")).toBe("계획 중… 12초 · 도구 3");
    expect(formatAiRunningStatus(0, 45_900, 12, 200, "실행 중")).toBe("실행 중… 45초 · 도구 12");
  });

  it("진행 배지는 음수 경과시간을 0초로 보정한다", () => {
    expect(formatAiRunningStatus(10_000, 9_000, 0)).toBe("생각 중… 0초");
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

  it("실패 도구 요약은 원문과 첫 issue를 노출하고 내부 재시도 횟수를 덧붙인다", () => {
    expect(failedToolRetrySummary("밑그림 검증 실패(3회) — 계획 폐기")).toBe("내부 재시도 3회");
    expect(failedToolVisibleSummary({
      summary: "'upsert_event' 인자 검증 실패",
      issues: [{ severity: "error", code: "invalid-args", message: "필수 인자 누락: event" }],
    })).toBe("'upsert_event' 인자 검증 실패: 필수 인자 누락: event (내부 재시도 1회)");
  });

  it("실패 도구 행은 details로 접히고 원시 실패 문구를 기본 문구에 드러낸다", () => {
    const entry = renderToolActivityEntry("set_build_spec", {
      ok: false,
      summary: "밑그림 검증 실패(3회) — id를 생략하세요",
    }) as unknown as FakeElement;
    const summary = findByTestId(entry, "ai-tool-failure-summary");
    expect(entry.tagName).toBe("DETAILS");
    expect(summary?.textContent).toContain("밑그림 검증 실패(3회) — id를 생략하세요");
    expect(summary?.textContent).toContain("내부 재시도 3회");
  });

  it("연속 추론 토글 문구는 병합 횟수를 표시한다", () => {
    for (const collapsed of [true, false]) {
      expect(Number(reasoningToggleText(7, collapsed).match(/\d+/u)?.[0])).toBe(7);
    }
  });
});

describe("대화 복원과 내보내기", () => {
  it("같은 프로젝트 컨텍스트의 직전 대화는 부팅 시 자동 복원된다", async () => {
    await saveConversation({
      id: "conv_same",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘\n\n[컨텍스트] 현재 맵: 빈 맵" },
        { kind: "assistant", text: "초안을 준비했습니다." },
      ],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(findByTestId(panel, "ai-start-screen")).toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("마을 만들어줘");
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).not.toContain("[컨텍스트]");
    expect(findByTestId(panel, "ai-export")?.disabled).toBe(false);
  });

  it("다른 프로젝트 컨텍스트의 직전 대화는 자동 복원하지 않고 빈 키트도 안 붙인다", async () => {
    // Break: other-project latest conv remounts start-screen / resume CTA, or auto-restores the log.
    await saveConversation({
      id: "conv_other",
      title: "다른 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "other-project",
      entries: [{ kind: "user", text: "다른 요청" }],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(findByTestId(panel, "ai-start-screen")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-resume-conversation")).toBeNull();
    expect(findByTestId(panel, "ai-composer-chips")).toBeTruthy();
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).not.toContain("다른 요청");
  });

  it("내보내기는 빈 대화에서 비활성화되고 라벨은 내보내기다", async () => {
    await clearConversations();
    const panel = renderPanel();
    await whenAiChatPanelSettled();
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
    // `.ai-rising-overlay` 는 사이드 도크 전용 표면이라 2026-08-31 에 삭제됐다.
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(menu?.hidden).toBe(true);

    findByTestId(panel, "ai-command-menu-toggle")?.click();
    expect(menu?.hidden).toBe(false);
    expect(findByTestId(menu!, "ai-command-menu-export")).toBeTruthy();
    expect(findByTestId(menu!, "ai-command-menu-tools")).toBeTruthy();
    expect(findByTestId(menu!, "ai-command-menu-instructions")).toBeTruthy();
    // 중복·잔재: 새 대화/이전 대화/되돌리기/설정/스튜디오/가르치기 3종/도크.
    expect(findByTestId(menu!, "ai-command-menu-undo")).toBeNull();
    expect(findByTestId(menu!, "ai-command-menu-dock")).toBeNull();
    expect(findByTestId(menu!, "ai-command-menu-studio")).toBeNull();
    expect(findByTestId(menu!, "ai-command-menu-settings")).toBeTruthy();
    expect(findByTestId(menu!, "ai-command-menu-new-chat")).toBeNull();
    expect(findByTestId(menu!, "ai-new-session")).toBeNull();
    expect(findByTestId(menu!, "ai-studio-toggle")).toBeNull();
    expect((globalThis.document as unknown as { body: FakeElement }).body.classList.contains("ai-command-bar-active")).toBe(true);
  });

  it("OAuth 는 전송 전에 'API 키' 안내로 막지 않는다 (키 온보딩 개념 자체가 없다)", () => {
    // 옛 스펙은 apiKey 모드 + 빈 키를 저장해 전송 전 키 안내·apiKey 입력 포커스를 요구했다.
    // 인증이 무조건 OAuth 가 된 뒤 저장값은 OAuth 로 승격되므로(loadAiConfig) 그 경로가 없다 —
    // 미로그인은 전송 전 안내가 아니라 요청 시점 401 로 드러난다(아래 401 버블 스펙이 담당).
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "" }));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send");
    input.value = "마을 만들어줘";

    send?.click();

    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(logText).not.toContain("API 키가 필요합니다");
    // 전송이 실제로 진행됐다(입력창이 비워졌다) — 키 안내로 가로막지 않았다는 뜻.
    expect(input.value).toBe("");
  });

  it("401 오류 버블에도 설정 열기 버튼을 붙인다", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "bad-key" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no key", { status: 401 })));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "테스트";
    findByTestId(panel, "ai-send")?.click();

    // 전송은 fetch → Response → 스트림 판독을 지나므로 마이크로태스크 flush 만으로는
    // 오류 버블이 붙기 전에 단정이 돌았다(실측: 이 단정이 기준선에서 null 로 실패). 조건 자체를
    // 기다린다 — 고정 sleep 이 아니라 상한이 있는 조건 대기다.
    await vi.waitFor(() => {
      expect(findByTestId(panel, "ai-error-open-settings")).toBeTruthy();
    }, { timeout: 2_000, interval: 5 });
    // OAuth 경로의 401 문구는 Google Gemini 로그인을 안내한다 — apiKey 시절의 "인증 실패" 가 아니다.
    expect((findByTestId(panel, "ai-chat-log")?.textContent ?? "")).toContain("Gemini");
  });

  it("☰ 의 설정 항목은 전용 모달을 열고 첫 입력에 포커스한다", () => {
    const panel = renderPanel();
    findByTestId(panel, "ai-command-menu-settings")?.click();

    const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
    expect(modal).not.toBeNull();
    expect(findByTestId(panel, "ai-config")).toBeNull();
    expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(findByTestId(modal!, "ai-auth-oauth"));
  });

  it("AI 패널의 아이콘 버튼에는 aria-label이 있다", () => {
    const panel = renderPanel();
    // 출하되는 아이콘 버튼 집합. ai-studio-toggle·ai-new-session 은 패널 크롬에서 빠져
    // 숨은 훅 컨테이너로 갔고(헤더 제거), 설정은 ☰ 항목이다 — 라벨 계약은 그 셋에 걸린다.
    for (const testId of ["ai-command-menu-settings", "ai-collapse", "ai-new-chat", "ai-command-menu-toggle"]) {
      expect(findByTestId(panel, testId)?.getAttribute("aria-label"), testId).toBeTruthy();
    }
  });

  it("설정 준비 판정은 API 키까지 확인한다", () => {
    expect(isAiConfigReady({ ...defaultAiConfig(), apiKey: "" })).toBe(true);
    expect(isAiConfigReady({ ...defaultAiConfig(), authMode: "apiKey", apiKey: "" })).toBe(false);
    expect(isAiConfigReady({ ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "sk-test" })).toBe(true);
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
