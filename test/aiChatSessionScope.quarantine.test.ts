// 채팅 세션 수명 계약: 새 대화 진입점, 프로젝트 전환 시 리셋, 턴마다 남는 맵/상황 스냅샷,
// 맵 이동 시 시스템 프롬프트 재조립.
//
// 왜 이 세 가지가 한 파일인가: 전부 "대화 하나가 어디에 속하고 어디서 입력됐는가"라는 같은
// 계약의 면이다. 프로젝트 전환은 대화를 갈고, 맵 이동은 갈지 않고 기록만 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";
import { sendAiTurn } from "./aiTurnHarness";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { conversationScopeKey, clearConversations, listConversations, loadConversation, saveConversation } from "@/ai/conversationStore";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { getAgentBlueprintState, setAgentBlueprintFromSpec } from "@/editor/agentBlueprint";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { clearAiUiEvents, listAiUiEvents } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "scope-test-model",
  liteModel: "scope-test-model",
  apiKey: "sk",
  maxToolCalls: 4,
  maxTokens: 100_000,
  agentMode: "chat",
};

let restoreDom: (() => void) | null = null;
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

async function flushAsync(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

function renderPanel(_legacyDock: "side" | "float" | "glass" = "side"): FakeElement {
  // The current composer has one layout; these retained session cases share it.
  return renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
}

function twoMapProject(): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  start.name = "마을 광장";
  const second = structuredClone(start);
  second.id = "map_forest";
  second.name = "숲길";
  project.maps[second.id] = second;
  return project;
}

/** 라운드마다 툴 없이 최종 응답만 내는 스텁 — 턴 수가 결정적이다. */
function stubChat(): { chat: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>; requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  return {
    requests,
    chat: async (_config, req) => {
      requests.push(req);
      return { message: { role: "assistant", content: "확인했습니다." }, finishReason: "stop" };
    },
  };
}

/**
 * LLM 라운드만 세는 계측. 전역 fetch 를 세면 LegacyDb 미러·활동 로그 같은 best-effort
 * 쓰기까지 함께 잡혀(실측: 첫 전송 직후 2건) 라운드 수 단정이 무너지고, 그 resolver 가
 * 대기 큐에 섞여 `settle` 이 엉뚱한 요청을 깨운다. 채팅 요청은 본문에 messages 가 있다.
 */
function stubLlmFetch(): { readonly rounds: readonly unknown[]; settleNext: (content: string) => void; waitForRound: (count: number) => Promise<void> } {
  const rounds: unknown[] = [];
  const pending: Array<(response: Response) => void> = [];
  const roundListeners = new Set<() => void>();
  // 턴 시작의 의도 선언(의도 라우터)은 모델 호출 1회다 — 본문 라운드가 아니라 즉시 유효 JSON 으로
  // 답해 라운드 계측·대기열에 섞이지 않게 한다. 본문에 messages 가 있다는 이유만으로 세면
  // 선언 호출까지 잡혀 턴 수 단정이 무너진다.
  const INTENT_JSON = JSON.stringify({ mode: "other", needsPlan: false });
  vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
    let body: { messages?: unknown; response_format?: unknown } = {};
    try {
      body = JSON.parse(String(init?.body ?? "{}")) as { messages?: unknown; response_format?: unknown };
    } catch {
      body = {};
    }
    if (!Array.isArray(body.messages)) {
      return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (isWikiExtraction(body.messages)) return Promise.resolve(emptyWikiResponse());
    if (body.response_format !== undefined) {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: INTENT_JSON }, finish_reason: "stop" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    rounds.push(body);
    for (const notify of roundListeners) notify();
    return new Promise<Response>((resolve) => pending.push(resolve));
  }));
  return {
    rounds,
    waitForRound: (count) => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { roundListeners.delete(check); reject(new Error(`LLM round ${count} did not start`)); }, 10_000);
      function check() {
        if (rounds.length < count) return;
        clearTimeout(timeout); roundListeners.delete(check); resolve();
      }
      roundListeners.add(check);
      check();
    }),
    settleNext: (content: string) => {
      const resolve = pending.shift();
      if (!resolve) throw new Error("대기 중인 LLM 요청이 없습니다");
      resolve(new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    },
  };
}

beforeEach(async () => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  await clearConversations();
});

afterEach(async () => {
  // 패널을 먼저 내려 세션·턴의 늦은 비동기 꼬리가 다음 테스트의 새 저장소에 대화를 쓰지
  // 못하게 한다. 이게 없으면 복원 대상(최신 대화)이 테스트 순서·타이밍에 따라 달라진다.
  teardownAiChatPanel();
  await flushAsync();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("대화 저장 범위", () => {
  it("Given local sessions across reloads When the project shape is unchanged Then the scope is stable", async () => {
    const project = createBlankProject();

    expect(conversationScopeKey({ kind: "local-session", id: "boot-a" }, project)).toBe(
      conversationScopeKey({ kind: "local-session", id: "boot-b" }, structuredClone(project)),
    );
    expect(conversationScopeKey({ kind: "local-session", id: "boot-a" }, project)).toBe(
      `local:새 프로젝트::${project.startMapId}`,
    );
  });

  it("Given remote projects with identical shapes When scoped Then each durable row id stays distinct", async () => {
    const project = createBlankProject();

    expect(conversationScopeKey({ kind: "remote", id: "project-a" }, project)).toBe("remote:project-a");
    expect(conversationScopeKey({ kind: "remote", id: "project-b" }, project)).toBe("remote:project-b");
  });
});

describe("새 대화 진입점", () => {
  it("Given any dock When the action menus render Then 새 대화는 ☰ 가 아니라 ＋ 에 있다", async () => {
    const side = renderPanel("side");
    expect(findByTestId(side, "ai-new-session")).toBeTruthy();
    expect(findByTestId(side, "ai-more-new-chat")).toBeNull();
    expect(findByTestId(side, "ai-new-chat")).toBeTruthy();

    const float = renderPanel("float");
    expect(findByTestId(float, "ai-command-menu-new-chat")).toBeNull();
    // 데크(2026-09-03): 글리프 "+" 대신 SVG 아이콘 + aria-label.
    const newChat = findByTestId(float, "ai-new-chat");
    expect(newChat?.getAttribute("aria-label")).toBe("새 대화 시작");
    expect(newChat?.childNodes.some((child) => (child as { tagName?: string }).tagName?.toLowerCase() === "svg")).toBe(true);
  });

  it("Given any dock When the composer renders Then its fixed action row owns the visible new-chat control", async () => {
    for (const dock of ["glass", "side", "float"] as const) {
      const panel = renderPanel(dock);
      await whenAiChatPanelSettled();
      const rail = findByTestId(panel, "ai-deck-rail");
      const newChat = findByTestId(panel, "ai-new-chat");

      expect(newChat).toBeTruthy();
      expect(newChat?.getAttribute("title")).toBe("새 대화");
      expect(newChat?.getAttribute("aria-label")).toBe("새 대화 시작");
      // 데크(2026-09-03): 새 대화는 컴포저 행이 아니라 상태 레일의 아이콘 슬롯에 산다.
      expect(findByTestId(rail!, "ai-new-chat")).toBe(newChat);
      expect(findByTestId(panel, "ai-chat-toolbar")?.inert).toBe(true);
    }
  });

  it("Given an in-flight turn with a queued send When 새 대화 is clicked Then the outgoing turn cannot contaminate or replay into the new chat", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(CONFIG));
    const llm = stubLlmFetch();

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send");
    const queue = findByTestId(panel, "ai-pending-queue");

    input.value = "이전 대화 요청";
    const firstStarted = llm.waitForRound(1);
    const firstTurn = sendAiTurn(panel);
    await firstStarted;
    expect(llm.rounds).toHaveLength(1);

    input.value = "이전 대화 대기 메시지";
    send?.click();
    expect(queue?.textContent).toContain("기다리는 메시지 1개");

    findByTestId(panel, "ai-new-chat")?.click();
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(queue?.hidden).toBe(true);

    llm.settleNext("이전 대화 늦은 응답");
    await firstTurn;
    await whenAiChatPanelSettled();

    const resetLog = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(resetLog).not.toContain("이전 대화 늦은 응답");
    expect(resetLog).not.toContain("이전 대화 대기 메시지");
    // 중단된 턴도, 버려진 대기 메시지도 새 라운드를 열지 않는다.
    expect(llm.rounds).toHaveLength(1);

    input.value = "새 대화 요청";
    const nextStarted = llm.waitForRound(2);
    const nextTurn = sendAiTurn(panel);
    await nextStarted;
    expect(llm.rounds).toHaveLength(2);
    llm.settleNext("새 대화 응답");
    await nextTurn;

    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(logText).toContain("새 대화 요청");
    expect(logText).toContain("새 대화 응답");
    expect(logText).not.toContain("이전 대화 늦은 응답");
    expect(logText).not.toContain("이전 대화 대기 메시지");

    await whenAiChatPanelSettled();
    const records = (await Promise.all((await listConversations()).map((summary) => loadConversation(summary.id)))).filter((record): record is NonNullable<typeof record> => record !== null);
    const oldRecord = records.find((record) => record.entries.some((entry) => entry.kind === "user" && entry.text.includes("이전 대화 요청")));
    const newRecord = records.find((record) => record.entries.some((entry) => entry.kind === "user" && entry.text.includes("새 대화 요청")));
    expect(oldRecord?.id).toBeTruthy();
    expect(newRecord?.id).toBeTruthy();
    expect(newRecord?.id).not.toBe(oldRecord?.id);
    expect(oldRecord?.entries.some((entry) => "text" in entry && entry.text.includes("새 대화"))).toBe(false);
    expect(oldRecord?.entries.some((entry) => "text" in entry && entry.text.includes("대기 메시지"))).toBe(false);
    expect(newRecord?.entries.some((entry) => "text" in entry && entry.text.includes("이전 대화"))).toBe(false);
  });

  it("Given a live blueprint When 새 대화 is clicked Then the plan overlay is dropped with the session", async () => {
    // 청사진(맵 위 계획 사각형)의 수명은 세션의 BuildSpec 이다 — 고스트 정리에 얹혀 있지 않으므로
    // 세션을 버리는 경로(새 대화·대화 복원·프로젝트 전환은 모두 dropSession 을 지난다)가
    // 직접 지워야 한다. 지우지 않으면 다음 대화 내내 남의 계획이 맵에 떠 있다.
    const panel = renderPanel();
    await whenAiChatPanelSettled();
    setAgentBlueprintFromSpec({
      mapId: store.getCurrent().startMapId,
      assets: [{ id: "site", kind: "clear", x: 0, y: 0, w: 4, h: 4 }],
    });
    expect(getAgentBlueprintState().entries).toHaveLength(1);

    findByTestId(panel, "ai-new-chat")?.click();

    expect(getAgentBlueprintState().entries).toEqual([]);
    expect(getAgentBlueprintState().mapId).toBeNull();
  });

  it("Given a restored conversation When 새 대화 is clicked Then the log empties and the panel reports empty", async () => {
    await saveConversation({
      id: "conv_scope_a",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘" },
        { kind: "assistant", text: "초안을 준비했습니다." },
      ],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("마을 만들어줘");

    findByTestId(panel, "ai-new-session")?.click();

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("마을 만들어줘");
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("새 대화");
  });
});

describe("이전 대화 진입점", () => {
  /**
   * 왜 고정 행인가: 이어가기 입구가 ☰ 메뉴 안에만 있었다. 생성(＋)은 한 번에 닿는데 이어가기는
   * 두 단계라, 그 배치 자체가 "새 세션" 을 기본값으로 만든다("ui 에서 기존 세션 불러오기가 매우
   * 힘든거같은데" — 감독 2026-08-30).
   */
  it("Given any dock When the composer renders Then 이전 대화 sits next to 새 대화 in the fixed action row", async () => {
    for (const dock of ["glass", "side", "float"] as const) {
      const panel = renderPanel(dock);
      await whenAiChatPanelSettled();
      const rail = findByTestId(panel, "ai-deck-rail");
      const open = findByTestId(panel, "ai-open-conversations");

      expect(open, dock).toBeTruthy();
      expect(open?.getAttribute("aria-label")).toBe("이전 대화 열기");
      expect(findByTestId(open as unknown as FakeElement, "ai-map-history-open")).not.toBeNull();
      expect(findByTestId(rail!, "ai-open-conversations")).toBe(open);
      expect(findByTestId(panel, "ai-map-history-open")).toBe(findByTestId(open as unknown as FakeElement, "ai-map-history-open"));
    }
  });

  it("Given an open conversation When the current map changes Then the conversation id is unchanged", async () => {
    const project = twoMapProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selection: null });
    await saveConversation({
      id: "conv_keep_map",
      title: "유지",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), project),
      entries: [
        { kind: "user", text: "광장 요청", context: { mapId: project.startMapId, mapName: "마을 광장", mapWidth: 20, mapHeight: 15 } },
        { kind: "assistant", text: "네." },
      ],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(panel.dataset.aiConversationId).toBe("conv_keep_map");

    editorState.set({ currentMapId: "map_forest" });
    expect(panel.dataset.aiConversationId).toBe("conv_keep_map");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("광장 요청");
  });
});

describe("프로젝트 전환", () => {
  it("Given an open conversation When the project identity changes Then the chat resets and the old chat keeps its own scope", async () => {
    await clearConversations();
    const firstScope = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    await saveConversation({
      id: "conv_project_one",
      title: "이전 프로젝트 대화",
      model: "m",
      savedAt: 100,
      projectContextKey: firstScope,
      entries: [{ kind: "user", text: "이전 프로젝트 요청" }, { kind: "assistant", text: "네." }],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("이전 프로젝트 요청");

    // 새 프로젝트 발급 = store 신원 교체 + 구독 통지. 신원만 진짜 경계다 —
    // 제목·시작맵은 새 blank 프로젝트마다 같은 값이라 대화가 새 프로젝트로 새어 들어왔다.
    vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    await whenAiChatPanelSettled();

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("이전 프로젝트 요청");
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("새 프로젝트 — 새 대화");

    await whenAiChatPanelSettled();
    const stored = await listConversations();
    expect(stored.find((conversation) => conversation.id === "conv_project_one")?.projectContextKey).toBe(firstScope);
  });

  it("Given an in-flight turn When the project identity changes Then it can only persist to its captured scope", async () => {
    const firstProject = createBlankProject();
    firstProject.meta.title = "첫 작업";
    store.replace(firstProject);
    const identity = vi.spyOn(store, "getProjectIdentity");
    identity.mockReturnValue({ kind: "remote", id: "project-one" });
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(CONFIG));

    const llm = stubLlmFetch();
    const panel = renderPanel();
    await whenAiChatPanelSettled();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫 프로젝트에서 시작한 요청";
    const started = llm.waitForRound(1);
    const turn = sendAiTurn(panel);
    await started;
    expect(llm.rounds).toHaveLength(1);

    identity.mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    await whenAiChatPanelSettled();
    expect(panel.dataset.aiConversation).toBe("empty");

    llm.settleNext("늦게 도착한 응답");
    await turn;

    await whenAiChatPanelSettled();
    const stored = (await listConversations()).filter((conversation) => conversation.turnCount > 0);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((conversation) => conversation.projectContextKey === "remote:project-one")).toBe(true);
    expect(stored.some((conversation) => conversation.projectContextKey === "remote:project-two")).toBe(false);
  });

  /**
   * 이어가기 계약(감독 지시 2026-08-30): "새 세션으로 강제되는 거 같은데, 사용자가 의식하고
   * 새 세션 누르지 않으면 걍 이어서 하게 해."
   *
   * 옛 결함: 부팅 복원이 **전역 최신 대화 하나**만 보고 스코프가 다르면 포기했다. 두 프로젝트를
   * 번갈아 열면 내 대화가 그대로 있는데도 매번 빈 대화로 시작했다.
   */
  it("Given another project's newer conversation When the panel mounts Then this project's own latest is still resumed", async () => {
    await clearConversations();
    const identity = vi.spyOn(store, "getProjectIdentity");
    identity.mockReturnValue({ kind: "remote", id: "project-mine" });
    await saveConversation({
      id: "conv_mine",
      title: "내 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "remote:project-mine",
      entries: [{ kind: "user", text: "내 프로젝트 요청" }, { kind: "assistant", text: "네." }],
    });
    // 남의 프로젝트 대화가 더 최근이다 — 예전엔 이것 때문에 복원이 통째로 포기됐다.
    await saveConversation({
      id: "conv_other",
      title: "다른 프로젝트",
      model: "m",
      savedAt: 900,
      projectContextKey: "remote:project-other",
      entries: [{ kind: "user", text: "남의 프로젝트 요청" }],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").toContain("내 프로젝트 요청");
    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("남의 프로젝트 요청");
  });

  /**
   * 계측 계약: 이어받은 전환이 "새 대화" 로 기록되면 「대화가 사라졌다」 신고를 가를 증거가 거짓이 된다
   * (openwiki/editor-observability.md). 기록되는 값은 사람이 읽는 산문이 아니라 기계가 먹는 detail 이다.
   */
  it("Given the switch resumes a saved conversation When it is recorded Then the UI event says resumed", async () => {
    await clearConversations();
    clearAiUiEvents();
    const identity = vi.spyOn(store, "getProjectIdentity");
    identity.mockReturnValue({ kind: "remote", id: "project-one" });
    await saveConversation({
      id: "conv_two_resumed",
      title: "둘째",
      model: "m",
      savedAt: 200,
      projectContextKey: "remote:project-two",
      entries: [{ kind: "user", text: "둘째 프로젝트 요청" }],
    });

    renderPanel();
    await whenAiChatPanelSettled();
    identity.mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    await whenAiChatPanelSettled();

    const events = listAiUiEvents().filter((event) => event.action === AI_UI_ACTIONS.newConversation);
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1]!;
    expect(last.detail).toMatchObject({ reason: "project-switch", resumed: true });
  });
  it("Given the new project has its own saved conversation When the identity changes Then it is resumed instead of blanked", async () => {
    await clearConversations();
    const identity = vi.spyOn(store, "getProjectIdentity");
    identity.mockReturnValue({ kind: "remote", id: "project-one" });
    await saveConversation({
      id: "conv_one",
      title: "첫 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "remote:project-one",
      entries: [{ kind: "user", text: "첫 프로젝트 요청" }],
    });
    await saveConversation({
      id: "conv_two",
      title: "둘째 프로젝트",
      model: "m",
      savedAt: 200,
      projectContextKey: "remote:project-two",
      entries: [{ kind: "user", text: "둘째 프로젝트 요청" }, { kind: "assistant", text: "이어서 하죠." }],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();
    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").toContain("첫 프로젝트 요청");

    identity.mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    await whenAiChatPanelSettled();

    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).toContain("둘째 프로젝트 요청");
    expect(log).not.toContain("첫 프로젝트 요청");
    expect(panel.dataset.aiConversation).not.toBe("empty");
  });

  it("Given a conversation saved for another project When the panel mounts Then it is not restored", async () => {
    await clearConversations();
    await saveConversation({
      id: "conv_other_project",
      title: "다른 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "remote:some-other-project",
      entries: [{ kind: "user", text: "다른 프로젝트 요청" }],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("다른 프로젝트 요청");
    expect(panel.dataset.aiConversation).toBe("empty");
  });
});

describe("턴 상황 스냅샷", () => {
  it("Given a turn on a map When it is recorded Then the audit entry carries map, viewport and selection", async () => {
    const project = twoMapProject();
    const stub = stubChat();
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: stub.chat,
      contextOptions: {
        getCurrentMapId: () => project.startMapId,
        getViewport: () => ({ mapId: project.startMapId, centerX: 5, centerY: 5, x: 1, y: 2, w: 8, h: 6 }),
      },
      getTurnSelection: () => ({ mapId: project.startMapId, x: 3, y: 4, width: 2, height: 2 }),
    });

    await session.sendUserMessage("여기에 집 지어줘");

    const userEntry = session.getAuditEntries().find((entry) => entry.kind === "user");
    expect(userEntry?.kind).toBe("user");
    if (userEntry?.kind !== "user") throw new Error("user entry missing");
    expect(userEntry.context).toEqual({
      mapId: project.startMapId,
      mapName: "마을 광장",
      mapWidth: 20,
      mapHeight: 15,
      viewport: { mapId: project.startMapId, centerX: 5, centerY: 5, x: 1, y: 2, w: 8, h: 6 },
      selection: { mapId: project.startMapId, x: 3, y: 4, width: 2, height: 2 },
    });
    expect(userEntry.at).toBeTypeOf("string");
  });

  it("Given the user moves to another map When the next turn runs Then the transition is recorded and the system prompt follows", async () => {
    const project = twoMapProject();
    const stub = stubChat();
    let currentMapId = project.startMapId;
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: stub.chat,
      contextOptions: { getCurrentMapId: () => currentMapId },
    });

    await session.sendUserMessage("광장부터 볼게");
    currentMapId = "map_forest";
    await session.sendUserMessage("이제 여기 정리해줘");

    const audit = session.getAuditEntries();
    expect(audit.some((entry) => entry.kind === "status" && entry.text === "맵 이동: 마을 광장 → 숲길")).toBe(true);

    const userEntries = audit.filter((entry) => entry.kind === "user");
    expect(userEntries).toHaveLength(2);
    expect(userEntries[0]?.kind === "user" && userEntries[0].context?.mapId).toBe(project.startMapId);
    expect(userEntries[1]?.kind === "user" && userEntries[1].context?.mapId).toBe("map_forest");

    // 시스템 프롬프트는 세션 생성 시점 맵에 고정돼 있었다 — 이동 후 요청은 새 맵을 설명해야 한다.
    const lastSystemPrompt = String(stub.requests.at(-1)?.messages[0]?.content ?? "");
    expect(lastSystemPrompt).toContain("숲길");
  });

  it("Given the same map across turns When turns run Then no transition noise is recorded", async () => {
    const project = twoMapProject();
    const stub = stubChat();
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: stub.chat,
      contextOptions: { getCurrentMapId: () => project.startMapId },
    });

    await session.sendUserMessage("첫 요청");
    await session.sendUserMessage("두 번째 요청");

    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.startsWith("맵 이동"))).toBe(
      false,
    );
  });
});
