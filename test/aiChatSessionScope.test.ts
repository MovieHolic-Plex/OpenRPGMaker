// 채팅 세션 수명 계약: 새 대화 진입점, 프로젝트 전환 시 리셋, 턴마다 남는 맵/상황 스냅샷,
// 맵 이동 시 시스템 프롬프트 재조립.
//
// 왜 이 세 가지가 한 파일인가: 전부 "대화 하나가 어디에 속하고 어디서 입력됐는가"라는 같은
// 계약의 면이다. 프로젝트 전환은 대화를 갈고, 맵 이동은 갈지 않고 기록만 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { conversationScopeKey, clearConversations, listConversations, loadConversation, saveConversation } from "@/ai/conversationStore";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { getAgentBlueprintState, setAgentBlueprintFromSpec } from "@/editor/agentBlueprint";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
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

function renderPanel(dock: "side" | "float" | "glass" = "side"): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000, getChatDock: () => dock }) as unknown as FakeElement;
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
 * LLM 라운드만 세는 계측. 전역 fetch 를 세면 Supabase 미러·활동 로그 같은 best-effort
 * 쓰기까지 함께 잡혀(실측: 첫 전송 직후 2건) 라운드 수 단정이 무너지고, 그 resolver 가
 * 대기 큐에 섞여 `settle` 이 엉뚱한 요청을 깨운다. 채팅 요청은 본문에 messages 가 있다.
 */
function stubLlmFetch(): { readonly rounds: readonly unknown[]; settleNext: (content: string) => void } {
  const rounds: unknown[] = [];
  const pending: Array<(response: Response) => void> = [];
  vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
    let body: { messages?: unknown } = {};
    try {
      body = JSON.parse(String(init?.body ?? "{}")) as { messages?: unknown };
    } catch {
      body = {};
    }
    if (!Array.isArray(body.messages)) {
      return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    rounds.push(body);
    return new Promise<Response>((resolve) => pending.push(resolve));
  }));
  return {
    rounds,
    settleNext: (content: string) => {
      const resolve = pending.shift();
      if (!resolve) throw new Error("대기 중인 LLM 요청이 없습니다");
      resolve(new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    },
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  clearConversations();
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
  it("Given local sessions across reloads When the project shape is unchanged Then the scope is stable", () => {
    const project = createBlankProject();

    expect(conversationScopeKey({ kind: "local-session", id: "boot-a" }, project)).toBe(
      conversationScopeKey({ kind: "local-session", id: "boot-b" }, structuredClone(project)),
    );
    expect(conversationScopeKey({ kind: "local-session", id: "boot-a" }, project)).toBe(
      `local:새 프로젝트::${project.startMapId}`,
    );
  });

  it("Given remote projects with identical shapes When scoped Then each durable row id stays distinct", () => {
    const project = createBlankProject();

    expect(conversationScopeKey({ kind: "remote", id: "project-a" }, project)).toBe("remote:project-a");
    expect(conversationScopeKey({ kind: "remote", id: "project-b" }, project)).toBe("remote:project-b");
  });
});

describe("새 대화 진입점", () => {
  it("Given any dock When the action menus render Then 새 대화 is available in both surfaces", () => {
    const side = renderPanel("side");
    expect(findByTestId(side, "ai-new-session")).toBeTruthy();
    expect(findByTestId(side, "ai-more-new-chat")?.textContent).toBe("새 대화");

    // 헤더가 없는 입력줄(float) 에서는 컴포저 ☰ 가 유일한 2차 액션 표면이다.
    const float = renderPanel("float");
    expect(findByTestId(float, "ai-command-menu-new-chat")?.textContent).toBe("새 대화");
  });

  it("Given any dock When the composer renders Then its fixed action row owns the visible new-chat control", () => {
    for (const dock of ["glass", "side", "float"] as const) {
      const panel = renderPanel(dock);
      const composer = findByTestId(panel, "ai-composer");
      const newChat = findByTestId(panel, "ai-new-chat");

      expect(newChat).toBeTruthy();
      expect(newChat?.getAttribute("title")).toBe("새 대화");
      expect(newChat?.getAttribute("aria-label")).toBe("새 대화 시작");
      expect(findByTestId(composer!, "ai-new-chat")).toBe(newChat);
      expect(findByTestId(panel, "ai-chat-toolbar")?.inert).toBe(true);
    }
  });

  it("Given an in-flight turn with a queued send When 새 대화 is clicked Then the outgoing turn cannot contaminate or replay into the new chat", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(CONFIG));
    const llm = stubLlmFetch();

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send");
    const queue = findByTestId(panel, "ai-pending-queue");

    input.value = "이전 대화 요청";
    send?.click();
    await flushAsync();
    expect(llm.rounds).toHaveLength(1);

    input.value = "이전 대화 대기 메시지";
    send?.click();
    expect(queue?.textContent).toContain("기다리는 메시지 1개");

    findByTestId(panel, "ai-new-chat")?.click();
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(queue?.hidden).toBe(true);

    llm.settleNext("이전 대화 늦은 응답");
    await flushAsync();

    const resetLog = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(resetLog).not.toContain("이전 대화 늦은 응답");
    expect(resetLog).not.toContain("이전 대화 대기 메시지");
    // 중단된 턴도, 버려진 대기 메시지도 새 라운드를 열지 않는다.
    expect(llm.rounds).toHaveLength(1);

    input.value = "새 대화 요청";
    send?.click();
    await flushAsync();
    expect(llm.rounds).toHaveLength(2);
    llm.settleNext("새 대화 응답");
    await flushAsync();

    const logText = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(logText).toContain("새 대화 요청");
    expect(logText).toContain("새 대화 응답");
    expect(logText).not.toContain("이전 대화 늦은 응답");
    expect(logText).not.toContain("이전 대화 대기 메시지");

    const records = listConversations().map((summary) => loadConversation(summary.id)!);
    const oldRecord = records.find((record) => record.entries.some((entry) => entry.kind === "user" && entry.text.includes("이전 대화 요청")));
    const newRecord = records.find((record) => record.entries.some((entry) => entry.kind === "user" && entry.text.includes("새 대화 요청")));
    expect(oldRecord?.id).toBeTruthy();
    expect(newRecord?.id).toBeTruthy();
    expect(newRecord?.id).not.toBe(oldRecord?.id);
    expect(oldRecord?.entries.some((entry) => "text" in entry && entry.text.includes("새 대화"))).toBe(false);
    expect(oldRecord?.entries.some((entry) => "text" in entry && entry.text.includes("대기 메시지"))).toBe(false);
    expect(newRecord?.entries.some((entry) => "text" in entry && entry.text.includes("이전 대화"))).toBe(false);
  });

  it("Given a live blueprint When 새 대화 is clicked Then the plan overlay is dropped with the session", () => {
    // 청사진(맵 위 계획 사각형)의 수명은 세션의 BuildSpec 이다 — 고스트 정리에 얹혀 있지 않으므로
    // 세션을 버리는 경로(새 대화·대화 복원·프로젝트 전환은 모두 dropSession 을 지난다)가
    // 직접 지워야 한다. 지우지 않으면 다음 대화 내내 남의 계획이 맵에 떠 있다.
    const panel = renderPanel();
    setAgentBlueprintFromSpec({
      mapId: store.getCurrent().startMapId,
      assets: [{ id: "site", kind: "clear", x: 0, y: 0, w: 4, h: 4 }],
    });
    expect(getAgentBlueprintState().entries).toHaveLength(1);

    findByTestId(panel, "ai-new-chat")?.click();

    expect(getAgentBlueprintState().entries).toEqual([]);
    expect(getAgentBlueprintState().mapId).toBeNull();
  });

  it("Given a restored conversation When 새 대화 is clicked Then the log empties and the panel reports empty", () => {
    saveConversation({
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
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("마을 만들어줘");

    findByTestId(panel, "ai-new-session")?.click();

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("마을 만들어줘");
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("새 대화");
  });
});

describe("프로젝트 전환", () => {
  it("Given an open conversation When the project identity changes Then the chat resets and the old chat keeps its own scope", () => {
    clearConversations();
    const firstScope = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    saveConversation({
      id: "conv_project_one",
      title: "이전 프로젝트 대화",
      model: "m",
      savedAt: 100,
      projectContextKey: firstScope,
      entries: [{ kind: "user", text: "이전 프로젝트 요청" }, { kind: "assistant", text: "네." }],
    });

    const panel = renderPanel();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("이전 프로젝트 요청");

    // 새 프로젝트 발급 = store 신원 교체 + 구독 통지. 신원만 진짜 경계다 —
    // 제목·시작맵은 새 blank 프로젝트마다 같은 값이라 대화가 새 프로젝트로 새어 들어왔다.
    vi.spyOn(store, "getProjectIdentity").mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());

    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").not.toContain("이전 프로젝트 요청");
    expect(panel.dataset.aiConversation).toBe("empty");
    expect(findByTestId(panel, "ai-status")?.textContent).toBe("새 프로젝트 — 새 대화");

    const stored = listConversations();
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
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫 프로젝트에서 시작한 요청";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    expect(llm.rounds).toHaveLength(1);

    identity.mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    expect(panel.dataset.aiConversation).toBe("empty");

    llm.settleNext("늦게 도착한 응답");
    await flushAsync();

    const stored = listConversations().filter((conversation) => conversation.turnCount > 0);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((conversation) => conversation.projectContextKey === "remote:project-one")).toBe(true);
    expect(stored.some((conversation) => conversation.projectContextKey === "remote:project-two")).toBe(false);
  });

  it("Given a conversation saved for another project When the panel mounts Then it is not restored", () => {
    clearConversations();
    saveConversation({
      id: "conv_other_project",
      title: "다른 프로젝트",
      model: "m",
      savedAt: 100,
      projectContextKey: "remote:some-other-project",
      entries: [{ kind: "user", text: "다른 프로젝트 요청" }],
    });

    const panel = renderPanel();

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
