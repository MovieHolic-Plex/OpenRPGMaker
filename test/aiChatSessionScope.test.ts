// 채팅 세션 수명 계약: 새 대화 진입점, 프로젝트 전환 시 리셋, 턴마다 남는 맵/상황 스냅샷,
// 맵 이동 시 시스템 프롬프트 재조립.
//
// 왜 이 세 가지가 한 파일인가: 전부 "대화 하나가 어디에 속하고 어디서 입력됐는가"라는 같은
// 계약의 면이다. 프로젝트 전환은 대화를 갈고, 맵 이동은 갈지 않고 기록만 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { conversationScopeKey, clearConversations, listConversations, saveConversation } from "@/ai/conversationStore";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
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

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
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

    let settle!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { settle = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => response));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫 프로젝트에서 시작한 요청";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    expect(fetch).toHaveBeenCalledTimes(1);

    identity.mockReturnValue({ kind: "remote", id: "project-two" });
    store.replace(createBlankProject());
    expect(panel.dataset.aiConversation).toBe("empty");

    settle(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "늦게 도착한 응답" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
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
